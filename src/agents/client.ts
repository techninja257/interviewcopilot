/**
 * Calls the agent proxy. The API key stays server-side — see server/index.ts.
 */
export interface AgentCallResult<T> {
  data: T;
  ms: number;
  raw: string;
}

export async function callAgent<T>(params: {
  agent: string;
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: unknown;
  maxTokens?: number;
}): Promise<AgentCallResult<T>> {
  const started = performance.now();

  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body?.error ?? `Agent "${params.agent}" failed (${res.status}).`);
  }

  return {
    data: body.data as T,
    ms: Math.round(performance.now() - started),
    raw: JSON.stringify(body.data, null, 2),
  };
}

export interface LiveStatus {
  ready: boolean;
  provider: 'groq' | 'gemini' | 'anthropic' | null;
  model: string | null;
  /** Why live mode is unavailable, phrased for a user. */
  error: string | null;
}

/** Whether the server has a working key, so the UI can gate live mode. */
export async function checkLiveReady(): Promise<LiveStatus> {
  const offline: LiveStatus = {
    ready: false,
    provider: null,
    model: null,
    error: 'Could not reach the agent proxy. Is it running? (npm run dev)',
  };
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return offline;
    const body = await res.json();
    return {
      ready: Boolean(body.ready),
      provider: body.provider ?? null,
      model: body.model ?? null,
      error: body.error ?? null,
    };
  } catch {
    return offline;
  }
}
