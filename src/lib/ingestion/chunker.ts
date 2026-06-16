// src/lib/ingestion/chunker.ts

import { DocumentChunk } from '@/types';
import { RawDocument } from './loaders';
import { randomUUID } from 'crypto';

export interface ChunkingOptions {
  chunkSize: number;     // in characters
  chunkOverlap: number;  // overlap between chunks
  minChunkSize?: number; // chunks smaller than this are dropped
}

/**
 * Fixed-size chunking — simple and effective for most cases.
 * Splits by character count with overlap, tries to break on sentence/paragraph
 * boundaries when possible.
 */
export function fixedSizeChunk(
  doc: RawDocument,
  options: ChunkingOptions = {
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 100,
  }
): DocumentChunk[] {
  const { chunkSize, chunkOverlap, minChunkSize = 100 } = options;
  const chunks: DocumentChunk[] = [];
  const text = doc.content;

  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // If we haven't reached the end, try to cut on a sentence/paragraph boundary
    if (end < text.length) {
      const nearbyNewline = text.lastIndexOf('\n', end);
      const nearbyPeriod = text.lastIndexOf('. ', end);

      const boundary = Math.max(nearbyNewline, nearbyPeriod);
      if (boundary > start + chunkSize * 0.5) {
        end = boundary + 1;
      }
    } else {
      end = text.length;
    }

    const content = text.slice(start, end).trim();

    if (content.length >= minChunkSize) {
      chunks.push({
        id: randomUUID(),
        content,
        metadata: {
          ...doc.metadata,
          chunkIndex,
          totalChunks: 0, // updated after all chunks are collected
        },
      });
      chunkIndex++;
    }

    start = end - chunkOverlap;
  }

  // Update totalChunks on every chunk
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: { ...chunk.metadata, totalChunks: chunks.length },
  }));
}

/**
 * Recursive chunking — respects document structure.
 * Tries to split on paragraphs first, then sentences, then words.
 * Adds overlap between consecutive chunks.
 */
export function recursiveChunk(
  doc: RawDocument,
  options: ChunkingOptions = {
    chunkSize: 1000,
    chunkOverlap: 200,
  }
): DocumentChunk[] {
  const separators = ['\n\n', '\n', '. ', ' ', ''];

  function splitWithSeparator(
    text: string,
    separatorIndex: number
  ): string[] {
    if (separatorIndex >= separators.length || text.length <= options.chunkSize) {
      return [text];
    }

    const separator = separators[separatorIndex];
    const splits = separator ? text.split(separator) : text.split('');

    const result: string[] = [];
    let current = '';

    for (const split of splits) {
      const candidate = current ? current + separator + split : split;

      if (candidate.length <= options.chunkSize) {
        current = candidate;
      } else {
        if (current) result.push(current);

        if (split.length > options.chunkSize) {
          // chunk is too large — split recursively with the next separator
          result.push(...splitWithSeparator(split, separatorIndex + 1));
          current = '';
        } else {
          current = split;
        }
      }
    }

    if (current) result.push(current);
    return result;
  }

  const rawChunks = splitWithSeparator(doc.content, 0);

  // Add overlap between consecutive chunks
  const mergedChunks: string[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    if (i === 0) {
      mergedChunks.push(rawChunks[i]);
    } else {
      const overlapText = mergedChunks[i - 1].slice(-options.chunkOverlap);
      mergedChunks.push(overlapText + rawChunks[i]);
    }
  }

  return mergedChunks
    .filter((c) => c.trim().length > 50)
    .map((content, chunkIndex) => ({
      id: randomUUID(),
      content: content.trim(),
      metadata: {
        ...doc.metadata,
        chunkIndex,
        totalChunks: mergedChunks.length,
      },
    }));
}

/**
 * Semantic chunking — requires embedding each sentence, more expensive but more accurate.
 * Computes cosine similarity between consecutive sentences and breaks where similarity
 * drops sharply (topic shift).
 */
export async function semanticChunk(
  doc: RawDocument,
  embedFn: (texts: string[]) => Promise<number[][]>,
  options: { breakpointThreshold?: number; minChunkSize?: number } = {}
): Promise<DocumentChunk[]> {
  const { breakpointThreshold = 0.3, minChunkSize = 100 } = options;

  // Split into sentences
  const sentences = doc.content
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 10);

  if (sentences.length <= 1) {
    return fixedSizeChunk(doc);
  }

  // Embed every sentence
  const embeddings = await embedFn(sentences);

  // Compute cosine similarity between each pair of consecutive sentences
  const similarities: number[] = [];
  for (let i = 0; i < embeddings.length - 1; i++) {
    similarities.push(cosineSimilarity(embeddings[i], embeddings[i + 1]));
  }

  // Find breakpoints — positions where similarity drops significantly
  const avgSim =
    similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const stdSim = Math.sqrt(
    similarities.reduce((sum, s) => sum + Math.pow(s - avgSim, 2), 0) /
      similarities.length
  );

  const breakpoints = new Set<number>();
  for (let i = 0; i < similarities.length; i++) {
    if (similarities[i] < avgSim - breakpointThreshold * stdSim) {
      breakpoints.add(i + 1);
    }
  }

  // Build chunks from sentence groups
  const chunks: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    if (breakpoints.has(i) && current.join(' ').length >= minChunkSize) {
      chunks.push(current.join(' '));
      current = [];
    }
    current.push(sentences[i]);
  }
  if (current.length > 0) chunks.push(current.join(' '));

  return chunks.map((content, chunkIndex) => ({
    id: randomUUID(),
    content,
    metadata: {
      ...doc.metadata,
      chunkIndex,
      totalChunks: chunks.length,
    },
  }));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}
