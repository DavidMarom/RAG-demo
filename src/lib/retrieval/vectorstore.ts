// src/lib/retrieval/vectorstore.ts

import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { DocumentChunk, SearchResult } from '@/types';
import { EMBEDDING_MODEL } from './embeddings';

// Singleton Pinecone client
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

function getIndex() {
  return getPineconeClient().index(process.env.PINECONE_INDEX_NAME!);
}

/**
 * Convert a DocumentChunk to a Pinecone upsert record.
 * The embeddingModel field guards against embedding drift: if the model changes
 * in the future, vectors tagged with the old model can be identified and re-indexed.
 */
function chunkToPineconeRecord(chunk: DocumentChunk) {
  if (!chunk.embedding) {
    throw new Error(`Chunk ${chunk.id} is missing embedding`);
  }

  return {
    id: chunk.id,
    values: chunk.embedding,
    metadata: {
      content: chunk.content,
      sourceId: chunk.metadata.sourceId,
      sourceName: chunk.metadata.sourceName,
      sourceType: chunk.metadata.sourceType,
      chunkIndex: chunk.metadata.chunkIndex,
      totalChunks: chunk.metadata.totalChunks,
      createdAt: chunk.metadata.createdAt,
      updatedAt: chunk.metadata.updatedAt,
      department: chunk.metadata.department ?? '',
      url: chunk.metadata.url ?? '',
      embeddingModel: EMBEDDING_MODEL, // guards against embedding drift
    } satisfies RecordMetadata,
  };
}

/**
 * Upsert chunks into Pinecone in batches of 100 (Pinecone recommendation).
 */
export async function upsertChunks(chunks: DocumentChunk[]): Promise<void> {
  const index = getIndex();
  const records = chunks.map(chunkToPineconeRecord);

  const UPSERT_BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    await index.upsert(batch);
    console.log(
      `Upserted batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}/${Math.ceil(
        records.length / UPSERT_BATCH_SIZE
      )}`
    );
  }
}

/**
 * Approximate nearest-neighbour search with optional metadata filtering.
 */
export async function similaritySearch(
  queryEmbedding: number[],
  options: {
    topK?: number;
    filter?: Record<string, string | number | boolean>;
    includeMetadata?: boolean;
  } = {}
): Promise<SearchResult[]> {
  const { topK = 10, filter, includeMetadata = true } = options;
  const index = getIndex();

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK,
    filter,
    includeMetadata,
    includeValues: false, // we don't need the raw vectors back
  });

  return queryResponse.matches
    .filter((match) => match.metadata)
    .map((match) => ({
      chunk: {
        id: match.id,
        content: match.metadata!.content as string,
        metadata: {
          sourceId: match.metadata!.sourceId as string,
          sourceName: match.metadata!.sourceName as string,
          sourceType: match.metadata!.sourceType as
            | 'pdf'
            | 'markdown'
            | 'html'
            | 'text',
          chunkIndex: match.metadata!.chunkIndex as number,
          totalChunks: match.metadata!.totalChunks as number,
          createdAt: match.metadata!.createdAt as string,
          updatedAt: (match.metadata!.updatedAt ?? match.metadata!.createdAt) as string,
          department: match.metadata!.department
            ? (match.metadata!.department as string)
            : undefined,
          url: match.metadata!.url
            ? (match.metadata!.url as string)
            : undefined,
        },
      },
      score: match.score ?? 0,
    }));
}

/**
 * Delete all chunks belonging to a document.
 *
 * Pinecone Starter plan does not support delete-by-metadata directly.
 * We use the query-then-delete pattern: fetch IDs with a filter, then deleteMany.
 */
export async function deleteDocumentChunks(sourceId: string): Promise<void> {
  const index = getIndex();

  // Use a zero-vector query to retrieve all matching IDs
  const dummyVector = new Array(1536).fill(0);
  const results = await index.query({
    vector: dummyVector,
    topK: 10000,
    filter: { sourceId },
    includeMetadata: false,
  });

  const ids = results.matches.map((m) => m.id);
  if (ids.length > 0) {
    // Delete in chunks of 1000 (Pinecone limit per deleteMany call)
    for (let i = 0; i < ids.length; i += 1000) {
      await index.deleteMany(ids.slice(i, i + 1000));
    }
    console.log(`Deleted ${ids.length} chunks for sourceId=${sourceId}`);
  }
}

/**
 * Return index statistics (total vector count, dimension, etc.)
 */
export async function getIndexStats() {
  const index = getIndex();
  return index.describeIndexStats();
}
