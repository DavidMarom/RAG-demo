// src/lib/retrieval/__tests__/retriever.integration.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retrieve } from '../retriever';
import * as vectorstore from '../vectorstore';
import * as embeddings from '../embeddings';

vi.mock('../vectorstore');
vi.mock('../embeddings');

const mockEmbedding = new Array(1536).fill(0.1);

const mockSearchResults = [
  {
    chunk: {
      id: 'chunk-1',
      content: 'Relevant content about remote work policy.',
      metadata: {
        sourceId: 'doc-1',
        sourceName: 'remote-work-policy.pdf',
        sourceType: 'pdf' as const,
        chunkIndex: 0,
        totalChunks: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
    score: 0.92,
  },
  {
    chunk: {
      id: 'chunk-2',
      content: 'Additional context about work from home.',
      metadata: {
        sourceId: 'doc-2',
        sourceName: 'hr-guidelines.md',
        sourceType: 'markdown' as const,
        chunkIndex: 2,
        totalChunks: 10,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
    score: 0.78,
  },
  {
    chunk: {
      id: 'chunk-3',
      content: 'Irrelevant content that falls below minScore.',
      metadata: {
        sourceId: 'doc-3',
        sourceName: 'other.pdf',
        sourceType: 'pdf' as const,
        chunkIndex: 0,
        totalChunks: 2,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
    score: 0.35, // below default minScore of 0.5
  },
];

describe('retrieve (integration)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(embeddings.embedQuery).mockResolvedValue(mockEmbedding);
    vi.mocked(vectorstore.similaritySearch).mockResolvedValue(mockSearchResults);
  });

  it('calls embedQuery with the user query', async () => {
    await retrieve('What is the remote work policy?');
    expect(embeddings.embedQuery).toHaveBeenCalledWith(
      'What is the remote work policy?'
    );
  });

  it('calls similaritySearch with the embedded query vector', async () => {
    await retrieve('What is the remote work policy?');
    expect(vectorstore.similaritySearch).toHaveBeenCalledWith(
      mockEmbedding,
      expect.objectContaining({ topK: expect.any(Number) })
    );
  });

  it('filters out results below minScore', async () => {
    const results = await retrieve('test query', { minScore: 0.5 });
    expect(results.every((r) => r.score >= 0.5)).toBe(true);
  });

  it('passes filter to similaritySearch', async () => {
    await retrieve('test query', { filter: { department: 'Engineering' } });
    expect(vectorstore.similaritySearch).toHaveBeenCalledWith(
      mockEmbedding,
      expect.objectContaining({ filter: { department: 'Engineering' } })
    );
  });

  it('returns an empty array when similaritySearch returns no results', async () => {
    vi.mocked(vectorstore.similaritySearch).mockResolvedValue([]);
    const results = await retrieve('obscure query with no matches');
    expect(results).toHaveLength(0);
  });

  it('returns an empty array when all results are below minScore', async () => {
    vi.mocked(vectorstore.similaritySearch).mockResolvedValue([
      { ...mockSearchResults[2] }, // score 0.35
    ]);
    const results = await retrieve('query', { minScore: 0.5 });
    expect(results).toHaveLength(0);
  });

  it('respects the topK option', async () => {
    const results = await retrieve('test query', { topK: 1, minScore: 0 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('requests a larger searchK than topK for reranking buffer', async () => {
    await retrieve('test query', { topK: 3 });
    const callArgs = vi.mocked(vectorstore.similaritySearch).mock.calls[0][1];
    expect(callArgs.topK).toBeGreaterThanOrEqual(12); // topK * 4
  });
});
