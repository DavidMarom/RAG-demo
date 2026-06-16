// src/app/api/search/route.ts
// Debug endpoint — do NOT expose without auth in production

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieve } from '@/lib/retrieval/retriever';

const SearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().int().min(1).max(20).optional().default(5),
  minScore: z.number().min(0).max(1).optional().default(0.3),
  department: z.string().optional(),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Basic auth guard for debug endpoint
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.INGESTION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof SearchRequestSchema>;
  try {
    body = SearchRequestSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', details: String(err) },
      { status: 400 }
    );
  }

  try {
    const filter = body.department ? { department: body.department } : undefined;
    const results = await retrieve(body.query, {
      topK: body.topK,
      rerankTopN: body.topK,
      filter,
      minScore: body.minScore,
    });

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    console.error('Search route error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}
