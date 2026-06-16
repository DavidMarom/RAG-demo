// src/app/api/ingest/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ingestDocument, ingestHTML } from '@/lib/ingestion/pipeline';

const IngestFileSchema = z.object({
  type: z.literal('file').optional(),
  filePath: z.string(),
  metadata: z
    .object({
      department: z.string().optional(),
      url: z.string().url().optional(),
      sourceId: z.string().optional(),
    })
    .optional(),
});

const IngestHTMLSchema = z.object({
  type: z.literal('html'),
  html: z.string().min(1),
  sourceName: z.string().min(1),
  metadata: z
    .object({
      department: z.string().optional(),
      url: z.string().url().optional(),
      sourceId: z.string().optional(),
    })
    .optional(),
});

const IngestRequestSchema = z.union([IngestFileSchema, IngestHTMLSchema]);

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Bearer token auth — protect this endpoint
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.INGESTION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof IngestRequestSchema>;
  try {
    body = IngestRequestSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', details: String(err) },
      { status: 400 }
    );
  }

  try {
    let result;

    if (body.type === 'html') {
      result = await ingestHTML(
        body.html,
        body.sourceName,
        body.metadata ?? {}
      );
    } else {
      result = await ingestDocument(
        body.filePath,
        body.metadata ?? {}
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ingestion error:', error);
    return NextResponse.json(
      { error: 'Ingestion failed', details: String(error) },
      { status: 500 }
    );
  }
}
