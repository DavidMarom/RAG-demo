// src/lib/generation/generator.ts

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { SearchResult } from '@/types';
import { buildSystemPrompt, buildContextBlock, buildUserPrompt } from './prompts';

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  traceId?: string;
}

/**
 * Generate a streaming response grounded in the retrieved chunks.
 *
 * Uses Vercel AI SDK's streamText so the response is never buffered —
 * tokens are forwarded to the client as they arrive from the LLM.
 *
 * Temperature is kept low (default 0.1) to minimise hallucinations:
 * this is factual retrieval, not creative writing.
 */
export async function generateStreamingResponse(
  query: string,
  retrievedChunks: SearchResult[],
  options: GenerationOptions = {}
) {
  const {
    model = 'gpt-4o',
    temperature = 0.1,
    maxTokens = 1024,
  } = options;

  const context = buildContextBlock(retrievedChunks);
  const userPrompt = buildUserPrompt(query, context);

  return streamText({
    model: openai(model),
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: userPrompt }],
    temperature,
    maxTokens,
  });
}
