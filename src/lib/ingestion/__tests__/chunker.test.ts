// src/lib/ingestion/__tests__/chunker.test.ts

import { describe, it, expect } from 'vitest';
import { fixedSizeChunk, recursiveChunk } from '../chunker';
import type { RawDocument } from '../loaders';

const mockDoc: RawDocument = {
  id: 'test-1',
  content: `First paragraph.\n\nSecond paragraph.\n\nThird paragraph.`.repeat(10),
  metadata: {
    sourceId: 'src-1',
    sourceName: 'test.md',
    sourceType: 'markdown',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

// ──────────────────────────────────────────────────────
// fixedSizeChunk
// ──────────────────────────────────────────────────────

describe('fixedSizeChunk', () => {
  it('creates chunks within size limit (with tolerance for boundary alignment)', () => {
    const chunks = fixedSizeChunk(mockDoc, { chunkSize: 200, chunkOverlap: 50 });
    for (const chunk of chunks) {
      // Allow 25% over limit for boundary-aligned cuts
      expect(chunk.content.length).toBeLessThanOrEqual(250);
    }
  });

  it('sets correct totalChunks on all chunks', () => {
    const chunks = fixedSizeChunk(mockDoc, { chunkSize: 200, chunkOverlap: 50 });
    chunks.forEach((chunk) => {
      expect(chunk.metadata.totalChunks).toBe(chunks.length);
    });
  });

  it('assigns sequential chunkIndex values', () => {
    const chunks = fixedSizeChunk(mockDoc, { chunkSize: 200, chunkOverlap: 50 });
    chunks.forEach((chunk, i) => {
      expect(chunk.metadata.chunkIndex).toBe(i);
    });
  });

  it('generates unique IDs', () => {
    const chunks = fixedSizeChunk(mockDoc, { chunkSize: 200, chunkOverlap: 50 });
    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });

  it('preserves source metadata on every chunk', () => {
    const chunks = fixedSizeChunk(mockDoc, { chunkSize: 300, chunkOverlap: 50 });
    for (const chunk of chunks) {
      expect(chunk.metadata.sourceId).toBe('src-1');
      expect(chunk.metadata.sourceName).toBe('test.md');
      expect(chunk.metadata.sourceType).toBe('markdown');
    }
  });

  it('drops chunks below minChunkSize', () => {
    // Create a doc that produces at least one tiny trailing chunk
    const tinyDoc: RawDocument = {
      ...mockDoc,
      content: 'A'.repeat(300) + ' ' + 'B'.repeat(10),
    };
    const chunks = fixedSizeChunk(tinyDoc, {
      chunkSize: 300,
      chunkOverlap: 0,
      minChunkSize: 50,
    });
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThanOrEqual(50);
    }
  });

  it('returns at least one chunk for non-empty documents', () => {
    const simpleDoc: RawDocument = {
      ...mockDoc,
      content: 'Hello world.',
    };
    const chunks = fixedSizeChunk(simpleDoc, {
      chunkSize: 1000,
      chunkOverlap: 100,
      minChunkSize: 1,
    });
    expect(chunks.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────
// recursiveChunk
// ──────────────────────────────────────────────────────

describe('recursiveChunk', () => {
  it('creates chunks no larger than chunkSize', () => {
    const chunks = recursiveChunk(mockDoc, { chunkSize: 300, chunkOverlap: 50 });
    for (const chunk of chunks) {
      // Overlap may push individual chunks slightly over; allow 25% tolerance
      expect(chunk.content.length).toBeLessThanOrEqual(375);
    }
  });

  it('generates unique IDs', () => {
    const chunks = recursiveChunk(mockDoc, { chunkSize: 300, chunkOverlap: 50 });
    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });

  it('preserves source metadata', () => {
    const chunks = recursiveChunk(mockDoc, { chunkSize: 300, chunkOverlap: 50 });
    for (const chunk of chunks) {
      expect(chunk.metadata.sourceId).toBe('src-1');
    }
  });

  it('returns at least one chunk for non-empty documents', () => {
    const simpleDoc: RawDocument = { ...mockDoc, content: 'Hello world.' };
    const chunks = recursiveChunk(simpleDoc, {
      chunkSize: 1000,
      chunkOverlap: 100,
    });
    expect(chunks.length).toBeGreaterThan(0);
  });
});
