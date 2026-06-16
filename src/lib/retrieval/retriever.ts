// src/lib/retrieval/retriever.ts

import { embedQuery } from './embeddings';
import { similaritySearch } from './vectorstore';
import { rerank } from './reranker';
import { SearchResult } from '@/types';

export interface RetrieverOptions {
  topK?: number;
  rerankTopN?: number;
  useMMR?: boolean;
  mmrLambda?: number;  // 0 = max diversity, 1 = max relevance
  filter?: Record<string, string | number | boolean>;
  minScore?: number;
}

/**
 * Full retrieval pipeline:
 * 1. Embed the query
 * 2. ANN search (fetches 4× topK for reranking buffer)
 * 3. Filter by minimum score
 * 4. Re-rank (Cohere or BM25)
 * 5. Optional MMR diversification
 */
export async function retrieve(
  query: string,
  options: RetrieverOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 5,
    rerankTopN = 5,
    useMMR = false,
    mmrLambda = 0.7,
    filter,
    minScore = 0.2,
  } = options;

  // 1. Embed the query
  const queryEmbedding = await embedQuery(query);

  // 2. ANN search — fetch more than needed for the reranking buffer
  const searchK = Math.max(topK * 4, 20);
  const rawResults = await similaritySearch(queryEmbedding, {
    topK: searchK,
    filter,
    includeMetadata: true,
  });

  // 3. Filter by minimum score
  const filteredResults = rawResults.filter((r) => r.score >= minScore);

  if (filteredResults.length === 0) return [];

  // 4. Re-rank
  const rerankedResults = await rerank(query, filteredResults, rerankTopN);

  // 5. Optional MMR diversification
  if (useMMR) {
    return maximalMarginalRelevance(
      queryEmbedding,
      rerankedResults,
      topK,
      mmrLambda
    );
  }

  return rerankedResults.slice(0, topK);
}

/**
 * Maximal Marginal Relevance — greedily selects documents that are
 * relevant to the query while also being diverse from already-selected docs.
 *
 * @param _queryEmbedding - retained for API consistency; similarity is approximated
 *                          from rerank scores to avoid storing raw embeddings.
 * @param candidates - already re-ranked candidates
 * @param topK - number of results to return
 * @param lambda - trade-off: 0 = maximum diversity, 1 = maximum relevance
 */
function maximalMarginalRelevance(
  _queryEmbedding: number[],
  candidates: SearchResult[],
  topK: number,
  lambda: number
): SearchResult[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= topK) return candidates;

  const selected: SearchResult[] = [];
  const remaining = [...candidates];

  // Always pick the top-ranked candidate first
  selected.push(remaining[0]);
  remaining.splice(0, 1);

  while (selected.length < topK && remaining.length > 0) {
    let bestScore = -Infinity;
    let bestIdx = 0;

    for (let i = 0; i < remaining.length; i++) {
      const relevanceScore =
        remaining[i].rerankScore ?? remaining[i].score;

      // Approximate inter-document similarity from score proximity
      const maxSimilarityToSelected = Math.max(
        ...selected.map((s) => {
          const scoreDiff = Math.abs(
            (s.rerankScore ?? s.score) - relevanceScore
          );
          return Math.max(0, 1 - scoreDiff);
        })
      );

      const mmrScore =
        lambda * relevanceScore - (1 - lambda) * maxSimilarityToSelected;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}
