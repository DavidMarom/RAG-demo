// src/lib/ingestion/pipeline.ts

import { loadPDF, loadMarkdown, loadDocx, loadHTML, RawDocument } from './loaders';
import { recursiveChunk } from './chunker';
import { generateEmbeddingsBatch } from '../retrieval/embeddings';
import { upsertChunks } from '../retrieval/vectorstore';
import { ChunkMetadata } from '@/types';

export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  processingTimeMs: number;
}

export async function ingestDocument(
  filePath: string,
  metadata: Partial<Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>> = {}
): Promise<IngestionResult> {
  const start = Date.now();

  // 1. Load document based on extension
  let rawDoc: RawDocument;
  if (filePath.endsWith('.pdf')) {
    rawDoc = await loadPDF(filePath, metadata);
  } else if (filePath.endsWith('.md') || filePath.endsWith('.mdx')) {
    rawDoc = await loadMarkdown(filePath, metadata);
  } else if (filePath.endsWith('.docx') || filePath.endsWith('.doc')) {
    rawDoc = await loadDocx(filePath, metadata);
  } else {
    throw new Error(`Unsupported file type: ${filePath}`);
  }

  // 2. Split into chunks
  const chunks = recursiveChunk(rawDoc, {
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  // 3. Generate embeddings (batched)
  const chunksWithEmbeddings = await generateEmbeddingsBatch(chunks);

  // 4. Upsert to vector store
  await upsertChunks(chunksWithEmbeddings);

  return {
    documentId: rawDoc.metadata.sourceId,
    chunksCreated: chunks.length,
    processingTimeMs: Date.now() - start,
  };
}

export async function ingestHTML(
  html: string,
  sourceName: string,
  metadata: Partial<Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>> = {}
): Promise<IngestionResult> {
  const start = Date.now();

  const rawDoc = await loadHTML(html, sourceName, metadata);

  const chunks = recursiveChunk(rawDoc, {
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunksWithEmbeddings = await generateEmbeddingsBatch(chunks);
  await upsertChunks(chunksWithEmbeddings);

  return {
    documentId: rawDoc.metadata.sourceId,
    chunksCreated: chunks.length,
    processingTimeMs: Date.now() - start,
  };
}
