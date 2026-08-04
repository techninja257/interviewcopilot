import dotenv from 'dotenv';

// .env is the single source of truth for provider credentials. A key that is
// only exported in the developer's shell (a stale ANTHROPIC_API_KEY, say)
// would otherwise silently outrank .env and point the app at the wrong
// provider — so clear the ambient ones first, then load .env over the top.
for (const name of [
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'ANTHROPIC_API_KEY',
  'LLM_PROVIDER',
  'GROQ_MODEL',
  'GEMINI_MODEL',
  'ANTHROPIC_MODEL',
]) {
  delete process.env[name];
}
dotenv.config({ override: true });

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { resolveProvider, type Provider } from './providers';

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT ?? 8787);
const ENV_PATH = path.resolve(process.cwd(), '.env');

let provider: Provider | null = resolveProvider();

/**
 * A key being present doesn't mean it works — an invalid key would otherwise
 * let the UI offer live mode and fail on the first generation. Verified once
 * with a trivial call, then cached.
 */
let verified: boolean | null = null;
let verifyError: string | null = null;

/**
 * Re-reads .env and rebuilds the provider, so switching keys or providers is
 * an edit-and-save rather than a restart. The verification cache is cleared
 * with it — a new key has to prove itself the same way the old one did.
 */
function reloadProvider(reason: string) {
  // Clear every variable .env controls before re-reading it. dotenv only sets
  // what the file contains, so a setting the user *deleted* would otherwise
  // survive in process.env and keep taking effect — commenting out
  // LLM_PROVIDER would appear to do nothing.
  for (const name of [
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'ANTHROPIC_API_KEY',
    'LLM_PROVIDER',
    'GROQ_MODEL',
    'GEMINI_MODEL',
    'ANTHROPIC_MODEL',
  ]) {
    delete process.env[name];
  }
  dotenv.config({ override: true });

  const next = resolveProvider();
  const changed = next?.id !== provider?.id || next?.model !== provider?.model;
  provider = next;
  verified = null;
  verifyError = null;

  console.log(
    next
      ? `[${reason}] provider: ${next.id} · model: ${next.model}${changed ? ' (changed)' : ''}`
      : `[${reason}] no API key found in .env — demo mode only.`,
  );
}

// Editors usually save by replacing the file, which fires `rename` and leaves
// the old watch pointing at a deleted inode — so re-arm after every event, and
// debounce because a single save can emit several.
let watchTimer: NodeJS.Timeout | null = null;
function watchEnv() {
  try {
    const watcher = fs.watch(ENV_PATH, { persistent: false }, () => {
      if (watchTimer) clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        reloadProvider('.env changed');
        watcher.close();
        watchEnv();
      }, 150);
    });
  } catch {
    /* .env may not exist yet; the app still runs in demo mode */
  }
}
watchEnv();

const NO_KEY_MESSAGE =
  'No API key configured. Add GROQ_API_KEY to .env (free from console.groq.com/keys) and restart, or keep exploring in Demo mode.';

const ENV_VAR = { groq: 'GROQ_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' };
const MODEL_VAR = { groq: 'GROQ_MODEL', gemini: 'GEMINI_MODEL', anthropic: 'ANTHROPIC_MODEL' };

/** Turns provider error blobs into something a user can act on. */
export function explainError(detail: string): string {
  const id = provider?.id ?? 'groq';
  const keyVar = ENV_VAR[id];

  // Order matters: a 413 "request too large" mentions both the token budget and
  // a billing upgrade link, so it must be matched before the credits and
  // generic rate-limit rules or it gets reported as the wrong problem entirely.
  if (/413|request too large|reduce your message size|tokens per minute|TPM/i.test(detail)) {
    const limit = /Limit (\d+), Requested (\d+)/i.exec(detail);
    const detailSuffix = limit ? ` (needed ${limit[2]} tokens, limit is ${limit[1]} per minute)` : '';
    return `The request exceeded the per-minute token budget for this model${detailSuffix}. Generate fewer questions, or set ${MODEL_VAR[id]} in .env to a model with a higher limit.`;
  }
  if (/tool_use_failed|did not call a tool/i.test(detail)) {
    return 'The model answered in prose instead of the required structured format, twice in a row. Try again — this is usually transient.';
  }
  // A daily-cap 429 also carries an upgrade link, so it has to be matched
  // before the credits rule — otherwise a quota that resets in an hour gets
  // reported as an empty account, which sends you to the wrong fix entirely.
  if (/tokens per day|TPD/i.test(detail)) {
    const retry = /try again in ([0-9hms.]+?)\.?\s*(?:Need|$|")/i.exec(detail);
    const when = retry ? ` It resets in ${retry[1].replace(/\.\d+(?=s)/, '')}.` : '';
    return `The daily token limit for this ${id} key is used up.${when} Demo mode still works, or add a different provider key to .env.`;
  }
  if (/credits are depleted|insufficient_quota|billing/i.test(detail)) {
    return `The ${id} account is out of credits. Top up, or switch providers by setting a different key in .env.`;
  }
  if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(detail)) {
    return 'Rate limited by the provider. Wait a moment and try again.';
  }
  if (/no longer available|NOT_FOUND|model_not_found|does not exist|404/i.test(detail)) {
    return `That model is not available to this key. Set ${MODEL_VAR[id]} in .env to one your account can reach.`;
  }
  if (/API key not valid|API_KEY_INVALID|authentication_error|invalid_api_key|401/i.test(detail)) {
    return `The API key was rejected. Check ${keyVar} in .env.`;
  }
  return detail;
}

/** Quota and rate limits are transient, so don't cache them as a hard failure. */
function isTransient(detail: string): boolean {
  return /429|quota|rate limit|RESOURCE_EXHAUSTED|credits are depleted/i.test(detail);
}

async function isProviderUsable(): Promise<boolean> {
  if (!provider) return false;
  if (verified === true) return true;
  if (verified === false && verifyError && !isTransient(verifyError)) return false;
  try {
    await provider.run({
      system: 'You respond with structured data.',
      prompt: 'Record the word "ok".',
      toolName: 'record',
      toolDescription: 'Record a value.',
      schema: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      },
      maxTokens: 256,
    });
    verified = true;
    verifyError = null;
  } catch (err) {
    verifyError = err instanceof Error ? err.message : String(err);
    console.warn(`[${provider.id}] key check failed — live mode disabled. ${explainError(verifyError)}`);
    verified = false;
  }
  return verified;
}

app.get('/api/health', async (_req, res) => {
  const ready = await isProviderUsable();
  const error = ready
    ? null
    : !provider
      ? NO_KEY_MESSAGE
      : verifyError
        ? explainError(verifyError)
        : null;

  res.json({ ready, provider: provider?.id ?? null, model: provider?.model ?? null, error });
});

/**
 * Single proxy for all four agents. The caller supplies the prompt and the
 * tool schema; forcing the tool call is what guarantees the response shape
 * the UI renders, so a malformed rubric can't reach the client.
 */
app.post('/api/agent', async (req, res) => {
  // Pinned for the life of the request — a .env reload mid-flight must not
  // change which provider the logs and error messages attribute this call to.
  const active = provider;
  if (!active) {
    return res.status(503).json({ error: NO_KEY_MESSAGE });
  }

  const { agent, system, prompt, toolName, toolDescription, schema, maxTokens } = req.body ?? {};

  if (!system || !prompt || !toolName || !schema) {
    return res.status(400).json({ error: 'Missing required agent parameters.' });
  }

  try {
    const started = Date.now();
    const result = await active.run({
      system,
      prompt,
      toolName,
      toolDescription: toolDescription ?? 'Record the structured result.',
      schema,
      maxTokens: maxTokens ?? 8000,
    });

    const u = result.usage;
    console.log(
      `[${active.id}/${agent}] ${Date.now() - started}ms · in ${u.input_tokens ?? '?'} · out ${u.output_tokens ?? '?'}${u.cached_tokens ? ` · cached ${u.cached_tokens}` : ''}`,
    );

    res.json({ data: result.data, usage: result.usage });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[${active.id}/${agent}] failed:`, detail);

    const isRateLimit = /429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(detail);
    res.status(isRateLimit ? 429 : 500).json({ error: explainError(detail) });
  }
});

// In dev, Vite (port 5173) serves the app and proxies /api here. In
// production there is no separate Vite server, so this same process also
// serves the built assets — one Render service instead of two.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  // Plain middleware, not a route pattern — Express 5's stricter path-to-regexp
  // rejects/misbehaves on wildcard+lookahead route strings, so matching here in
  // code is the reliable way to fall back to index.html for client-side routes.
  app.use((req, res) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`InterviewCopilot agent proxy on http://localhost:${PORT}`);
  console.log(
    provider
      ? `Provider: ${provider.id} · model: ${provider.model}`
      : 'No API key in .env (GROQ_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY) — demo mode only.',
  );
});
