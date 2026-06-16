// src/lib/retrieval/reranker.ts

import { SearchResult } from '@/types';

/**
 * Re-rank results using the Cohere Rerank API.
 * Falls back gracefully to the original vector scores if the API call fails.
 */
export async function rerankWithCohere(
  query: string,
  results: SearchResult[],
  topN: number
): Promise<SearchResult[]> {
  if (results.length === 0) return [];

  const response = await fetch('https://api.cohere.ai/v1/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'rerank-english-v3.0',
      query,
      documents: results.map((r) => r.chunk.content),
      top_n: topN,
      return_documents: false,
    }),
  });

  if (!response.ok) {
    console.warn(
      `Cohere rerank failed (${response.status}), falling back to original scores`
    );
    return results.slice(0, topN);
  }

  const data = await response.json();

  return (data.results as Array<{ index: number; relevance_score: number }>)
    .map((item) => ({
      ...results[item.index],
      rerankScore: item.relevance_score,
    }))
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
}

/**
 * BM25-based re-ranking — no external API required.
 * Combines the original vector score (70%) with a BM25 lexical score (30%).
 */
export function rerankBM25(
  query: string,
  results: SearchResult[],
  topN: number
): SearchResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/);

  const scored = results.map((result) => {
    const content = result.chunk.content.toLowerCase();
    const words = content.split(/\s+/);
    const docLength = words.length;
    const k1 = 1.2;
    const b = 0.75;
    const avgDocLength = 150;

    let bm25Score = 0;
    for (const term of queryTerms) {
      const tf = words.filter((w) => w.includes(term)).length;
      const matchingDocs = results.filter((r) =>
        r.chunk.content.toLowerCase().includes(term)
      ).length;
      const idf = Math.log(
        (results.length - matchingDocs + 0.5) / (matchingDocs + 0.5) + 1
      );
      bm25Score +=
        (idf * (tf * (k1 + 1))) /
        (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
    }

    const combinedScore =
      0.7 * result.score + 0.3 * (bm25Score / (bm25Score + 1));

    return { ...result, rerankScore: combinedScore };
  });

  return scored
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
    .slice(0, topN);
}

/**
 * Main rerank entry point.
 * Uses Cohere if COHERE_API_KEY is set, otherwise falls back to BM25.
 * Cohere failures are caught inside rerankWithCohere and return original scores.
 */
export async function rerank(
  query: string,
  results: SearchResult[],
  topN: number
): Promise<SearchResult[]> {
  if (process.env.COHERE_API_KEY) {
    try {
      return await rerankWithCohere(query, results, topN);
    } catch (err) {
      console.warn('rerankWithCohere threw unexpectedly, falling back:', err);
      return rerankBM25(query, results, topN);
    }
  }
  return rerankBM25(query, results, topN);
}
