// src/lib/evaluation.ts

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { SearchResult } from '@/types';

/**
 * Faithfulness — measures whether the answer is grounded in the provided context.
 * Scores 0 (fully hallucinated) to 1 (perfectly faithful).
 *
 * Uses GPT-4o as the judge; temperature=0 for deterministic scoring.
 */
export async function evaluateFaithfulness(
  query: string,
  answer: string,
  context: SearchResult[]
): Promise<number> {
  const contextText = context.map((r) => r.chunk.content).join('\n---\n');

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `Rate the faithfulness of this answer to the context. Score 0-1 only.

Context: ${contextText}

Question: ${query}
Answer: ${answer}

Respond with ONLY a decimal number 0-1.`,
    temperature: 0,
    maxTokens: 10,
  });

  const score = parseFloat(text.trim());
  return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
}

/**
 * Context recall — measures whether the retrieved chunks actually contain
 * information relevant to the expected answer.
 *
 * @param expectedAnswer - the ground-truth answer
 * @param context - retrieved search results
 * @returns score 0-1
 */
export async function evaluateContextRecall(
  query: string,
  expectedAnswer: string,
  context: SearchResult[]
): Promise<number> {
  const contextText = context.map((r) => r.chunk.content).join('\n---\n');

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `Given the expected answer and the retrieved context, rate how well the context supports the expected answer. Score 0-1 only.

Query: ${query}
Expected Answer: ${expectedAnswer}
Retrieved Context: ${contextText}

Respond with ONLY a decimal number 0-1.`,
    temperature: 0,
    maxTokens: 10,
  });

  const score = parseFloat(text.trim());
  return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
}

/**
 * Run a batch evaluation over a test set.
 *
 * @param testSet - array of { query, expectedAnswer } pairs
 * @param retrieveFn - function that retrieves chunks for a query
 * @param generateFn - function that generates an answer from chunks
 */
export async function runEvaluation(
  testSet: Array<{ query: string; expectedAnswer: string }>,
  retrieveFn: (query: string) => Promise<SearchResult[]>,
  generateFn: (
    query: string,
    chunks: SearchResult[]
  ) => Promise<string>
): Promise<{
  avgFaithfulness: number;
  avgContextRecall: number;
  results: Array<{
    query: string;
    faithfulness: number;
    contextRecall: number;
  }>;
}> {
  const results: Array<{
    query: string;
    faithfulness: number;
    contextRecall: number;
  }> = [];

  for (const { query, expectedAnswer } of testSet) {
    const chunks = await retrieveFn(query);
    const answer = await generateFn(query, chunks);

    const [faithfulness, contextRecall] = await Promise.all([
      evaluateFaithfulness(query, answer, chunks),
      evaluateContextRecall(query, expectedAnswer, chunks),
    ]);

    results.push({ query, faithfulness, contextRecall });
  }

  const avgFaithfulness =
    results.reduce((sum, r) => sum + r.faithfulness, 0) / results.length;
  const avgContextRecall =
    results.reduce((sum, r) => sum + r.contextRecall, 0) / results.length;

  return { avgFaithfulness, avgContextRecall, results };
}
