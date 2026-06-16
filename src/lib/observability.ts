// src/lib/observability.ts

import Langfuse from 'langfuse';

// Langfuse client — constructed lazily so missing env vars don't break
// non-traced code paths (e.g. unit tests)
let _langfuse: Langfuse | null = null;

function getLangfuse(): Langfuse {
  if (!_langfuse) {
    _langfuse = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_BASEURL,
    });
  }
  return _langfuse;
}

export const trace = {
  /**
   * Start a new trace and return its ID.
   */
  async start(params: {
    name: string;
    input: Record<string, unknown>;
  }): Promise<string> {
    if (!process.env.LANGFUSE_PUBLIC_KEY) return 'no-trace';
    const t = getLangfuse().trace({ name: params.name, input: params.input });
    return t.id;
  },

  /**
   * Log a span (sub-step) on an existing trace.
   */
  async log(
    traceId: string,
    spanName: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!process.env.LANGFUSE_PUBLIC_KEY || traceId === 'no-trace') return;
    getLangfuse().span({ traceId, name: spanName, input: data });
  },

  /**
   * Log an error on an existing trace.
   */
  async error(traceId: string, error: unknown): Promise<void> {
    if (!process.env.LANGFUSE_PUBLIC_KEY || traceId === 'no-trace') return;
    getLangfuse().span({
      traceId,
      name: 'error',
      level: 'ERROR',
      statusMessage: String(error),
    });
  },

  /**
   * Flush all pending events (call before process exit / at end of request in serverless).
   */
  async flush(): Promise<void> {
    if (!process.env.LANGFUSE_PUBLIC_KEY) return;
    await getLangfuse().flushAsync();
  },
};
