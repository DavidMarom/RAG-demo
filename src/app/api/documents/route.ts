import { Pinecone } from '@pinecone-database/pinecone';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export interface DocumentSummary {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  department: string;
  url: string;
  createdAt: string;
  totalChunks: number;
}

function getPineconeIndex() {
  const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return client.index(process.env.PINECONE_INDEX_NAME!);
}

export async function GET() {
  try {
    const index = getPineconeIndex();

    // Page through all vector IDs using Pinecone's list API
    const allIds: string[] = [];
    let paginationToken: string | undefined;

    do {
      const page = await index.listPaginated({ paginationToken, limit: 100 });
      const ids = page.vectors?.map((v) => v.id) ?? [];
      allIds.push(...ids);
      paginationToken = page.pagination?.next;
    } while (paginationToken);

    if (allIds.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch metadata in batches of 100
    const BATCH_SIZE = 100;
    const docMap = new Map<string, DocumentSummary>();

    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE);
      const fetched = await index.fetch(batch);

      for (const record of Object.values(fetched.records)) {
        const meta = record.metadata;
        if (!meta) continue;
        // Only use the first chunk of each document for document-level metadata
        if ((meta.chunkIndex as number) !== 0) continue;

        const sourceId = meta.sourceId as string;
        if (!docMap.has(sourceId)) {
          docMap.set(sourceId, {
            sourceId,
            sourceName: meta.sourceName as string,
            sourceType: meta.sourceType as string,
            department: (meta.department as string) || '',
            url: (meta.url as string) || '',
            createdAt: meta.createdAt as string,
            totalChunks: meta.totalChunks as number,
          });
        }
      }
    }

    const docs = Array.from(docMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(docs);
  } catch (err) {
    console.error('Documents list error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
