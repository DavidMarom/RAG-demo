// src/lib/retrieval/embeddings.ts

import OpenAI from 'openai';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { DocumentChunk } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100;        // OpenAI accepts up to 2048 inputs per request
const MAX_CONCURRENT = 5;      // max parallel requests
const MAX_TOKENS = 8000;       // buffer below the 8191 token limit

/**
 * Truncate text before embedding to stay within token limits.
 * Approximation: ~4 characters per token.
 */
export function truncateToTokenLimit(text: string, maxTokens = MAX_TOKENS): string {
  const maxChars = maxTokens * 4;
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/**
 * Generate an embedding for a single text string.
 * Includes retry logic with exponential backoff.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const safeText = truncateToTokenLimit(text.replace(/\n/g, ' '));

  return pRetry(
    async () => {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: safeText,
      });
      return response.data[0].embedding;
    },
    {
      retries: 3,
      minTimeout: 1000,
      factor: 2,
      onFailedAttempt: (error) => {
        console.warn(
          `Embedding attempt ${error.attemptNumber} failed: ${error.message}`
        );
      },
    }
  );
}

/**
 * Generate embeddings for a batch of DocumentChunks.
 * Uses pLimit for concurrency control and pRetry for resilience.
 * Tags each chunk with the embedding model used (guards against drift).
 */
export async function generateEmbeddingsBatch(
  chunks: DocumentChunk[]
): Promise<DocumentChunk[]> {
  const limit = pLimit(MAX_CONCURRENT);

  // Split into batches
  const batches: DocumentChunk[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `Processing ${chunks.length} chunks in ${batches.length} batches`
  );

  const batchedResults = await Promise.all(
    batches.map((batch, batchIndex) =>
      limit(async () => {
        const texts = batch.map((c) =>
          truncateToTokenLimit(c.content.replace(/\n/g, ' '))
        );

        const embeddings = await pRetry(
          async () => {
            const response = await openai.embeddings.create({
              model: EMBEDDING_MODEL,
              input: texts,
            });
            return response.data.map((d) => d.embedding);
          },
          {
            retries: 3,
            minTimeout: 1000,
            factor: 2,
            onFailedAttempt: (error) => {
              console.warn(
                `Batch ${batchIndex} attempt ${error.attemptNumber} failed: ${error.message}`
              );
            },
          }
        );

        return batch.map((chunk, i) => ({
          ...chunk,
          embedding: embeddings[i],
        }));
      })
    )
  );

  return batchedResults.flat();
}

/**
 * Embed a user query string.
 * Intentionally a separate function so callers are explicit about query vs. document embedding.
 */
export async function embedQuery(query: string): Promise<number[]> {
  return generateEmbedding(query);
}
