import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import Groq from 'groq-sdk';

export interface AgentRequest {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface AgentResponse {
  data: unknown;
  usage: Record<string, number | undefined>;
}

export interface Provider {
  id: 'groq' | 'gemini' | 'anthropic';
  model: string;
  /** Runs one agent call, forcing structured output via the tool schema. */
  run(req: AgentRequest): Promise<AgentResponse>;
}

/**
 * Gemini's function-declaration schema is close to JSON Schema but not
 * identical: types are uppercase enum values, and it rejects several
 * validation keywords we use for Anthropic. Strip what it won't accept
 * rather than sending a schema that 400s.
 */
const GEMINI_UNSUPPORTED = new Set([
  'additionalProperties',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  '$schema',
]);

function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node === null || typeof node !== 'object') return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (GEMINI_UNSUPPORTED.has(key)) continue;
    if (key === 'type' && typeof value === 'string') {
      out.type = value.toUpperCase();
    } else {
      out[key] = toGeminiSchema(value);
    }
  }
  return out;
}

export function createGeminiProvider(apiKey: string, model: string): Provider {
  const client = new GoogleGenAI({ apiKey });

  return {
    id: 'gemini',
    model,
    async run({ system, prompt, toolName, toolDescription, schema, maxTokens }) {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens,
          tools: [
            {
              functionDeclarations: [
                {
                  name: toolName,
                  description: toolDescription,
                  parameters: toGeminiSchema(schema) as never,
                },
              ],
            },
          ],
          // Forcing the call is what guarantees the shape the UI renders.
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: [toolName],
            },
          },
        },
      });

      const call = response.functionCalls?.[0];
      if (!call?.args) {
        const finish = response.candidates?.[0]?.finishReason ?? 'unknown';
        throw new Error(
          `Model returned no structured output (finishReason: ${finish}). ` +
            (finish === 'MAX_TOKENS'
              ? 'The response hit the output cap — try fewer questions.'
              : 'Try again, or reduce the size of the job description.'),
        );
      }

      const meta = response.usageMetadata;
      return {
        data: call.args,
        usage: {
          input_tokens: meta?.promptTokenCount,
          output_tokens: meta?.candidatesTokenCount,
          cached_tokens: meta?.cachedContentTokenCount,
        },
      };
    },
  };
}

/**
 * Even with tool_choice set, a model occasionally answers in the format its
 * task implies — the bias audit, asked for a "compliance review", has come
 * back as a markdown table, which Groq rejects as `tool_use_failed`. That is
 * a coin-flip failure rather than a bad request, so retry once with an
 * explicit correction before surfacing it. Losing a whole generated guide to
 * one stray response is the worse outcome.
 */
function isToolRefusal(err: unknown): boolean {
  const detail = err instanceof Error ? err.message : String(err);
  return /tool_use_failed|did not call a tool/i.test(detail);
}

export function createGroqProvider(apiKey: string, model: string): Provider {
  const client = new Groq({ apiKey });

  return {
    id: 'groq',
    model,
    async run({ system, prompt, toolName, toolDescription, schema, maxTokens }) {
      const request = (extraNudge: boolean) =>
        client.chat.completions.create({
          model,
          max_completion_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
            ...(extraNudge
              ? [
                  {
                    role: 'user' as const,
                    content: `Respond only by calling the ${toolName} function. Do not write any prose, tables, or markdown.`,
                  },
                ]
              : []),
          ],
          tools: [
            {
              type: 'function' as const,
              function: { name: toolName, description: toolDescription, parameters: schema },
            },
          ],
          // Forcing the call is what guarantees the shape the UI renders.
          tool_choice: { type: 'function' as const, function: { name: toolName } },
        });

      let completion;
      try {
        completion = await request(false);
      } catch (err) {
        if (!isToolRefusal(err)) throw err;
        completion = await request(true);
      }

      const choice = completion.choices[0];
      const call = choice?.message?.tool_calls?.[0];

      if (!call) {
        throw new Error(
          `Model returned no structured output (finish_reason: ${choice?.finish_reason ?? 'unknown'}). ` +
            (choice?.finish_reason === 'length'
              ? 'The response hit the output cap — try fewer questions.'
              : 'Try again, or shorten the job description.'),
        );
      }

      // Unlike the other two providers, Groq returns arguments as a JSON
      // *string* — a truncated response yields invalid JSON rather than a
      // clean error, so surface that as the length problem it usually is.
      let data: unknown;
      try {
        data = JSON.parse(call.function.arguments);
      } catch {
        throw new Error(
          'The model returned malformed JSON, which usually means the response was cut off. Try generating fewer questions.',
        );
      }

      return {
        data,
        usage: {
          input_tokens: completion.usage?.prompt_tokens,
          output_tokens: completion.usage?.completion_tokens,
        },
      };
    },
  };
}

export function createAnthropicProvider(apiKey: string, model: string): Provider {
  const client = new Anthropic({ apiKey });

  return {
    id: 'anthropic',
    model,
    async run({ system, prompt, toolName, toolDescription, schema, maxTokens }) {
      const message = await client.messages.create({
        model,
        max_tokens: maxTokens,
        // The preamble is identical across agents, so cache it.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        tools: [{ name: toolName, description: toolDescription, input_schema: schema as never }],
        tool_choice: { type: 'tool', name: toolName },
        messages: [{ role: 'user', content: prompt }],
      });

      if (message.stop_reason === 'refusal') {
        throw new Error(
          'The model declined this request. If the job description or resume contains unusual content, try trimming it.',
        );
      }

      const toolUse = message.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error(
          `Model returned no structured output (stop_reason: ${message.stop_reason}).`,
        );
      }

      return {
        data: toolUse.input,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          cached_tokens: message.usage.cache_read_input_tokens ?? undefined,
        },
      };
    },
  };
}

/**
 * Picks a provider from the environment. Groq is the default — its free tier
 * is generous and it is by far the fastest. Set LLM_PROVIDER to override.
 */
export function resolveProvider(): Provider | null {
  const preference = process.env.LLM_PROVIDER?.toLowerCase();

  // An exported-but-empty env var should not count as a configured key, and
  // neither should a placeholder left in .env.
  const read = (...names: string[]): string | undefined => {
    for (const name of names) {
      const value = process.env[name]?.trim();
      if (value) return value;
    }
    return undefined;
  };

  const keys = {
    groq: read('GROQ_API_KEY'),
    gemini: read('GEMINI_API_KEY', 'GOOGLE_API_KEY'),
    anthropic: read('ANTHROPIC_API_KEY'),
  };

  const models = {
    groq: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
    gemini: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
  };

  const build = {
    groq: createGroqProvider,
    gemini: createGeminiProvider,
    anthropic: createAnthropicProvider,
  };

  if (preference === 'groq' || preference === 'gemini' || preference === 'anthropic') {
    const key = keys[preference];
    return key ? build[preference](key, models[preference]) : null;
  }

  for (const id of ['groq', 'gemini', 'anthropic'] as const) {
    if (keys[id]) return build[id](keys[id], models[id]);
  }
  return null;
}
