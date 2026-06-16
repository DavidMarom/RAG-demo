// src/lib/cache.ts

import { Redis } from '@upstash/redis';
import { SearchResult } from '@/types';
import crypto from 'crypto';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const RETRIEVAL_CACHE_TTL = 3600; // 1 hour

function hashQuery(
  query: string,
  filter?: Record<string, unknown>
): string {
  const key = JSON.stringify({ query: query.toLowerCase().trim(), filter });
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Retrieve cached results for a query+filter combination.
 * Returns null on cache miss.
 */
export async function getCachedRetrieval(
  query: string,
  filter?: Record<string, unknown>
): Promise<SearchResult[] | null> {
  try {
    return await redis.get<SearchResult[]>(
      `retrieval:${hashQuery(query, filter)}`
    );
  } catch (err) {
    console.warn('Cache read error:', err);
    return null;
  }
}

/**
 * Store retrieval results in Redis with a 1-hour TTL.
 */
export async function setCachedRetrieval(
  query: string,
  results: SearchResult[],
  filter?: Record<string, unknown>
): Promise<void> {
  try {
    await redis.setex(
      `retrieval:${hashQuery(query, filter)}`,
      RETRIEVAL_CACHE_TTL,
      results
    );
  } catch (err) {
    console.warn('Cache write error:', err);
  }
}

/**
 * Invalidate all cached retrievals for a specific document source.
 * Call this after re-ingesting or deleting a document.
 * Note: this performs a SCAN which is O(n) — acceptable for small key sets.
 */
export async function invalidateDocumentCache(sourceId: string): Promise<void> {
  try {
    // Redis SCAN to find matching keys
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: 'retrieval:*',
        count: 100,
      });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...(keys as string[]));
      }
    } while (cursor !== 0);

    console.log(`Cache invalidated after update for sourceId=${sourceId}`);
  } catch (err) {
    console.warn('Cache invalidation error:', err);
  }
}
