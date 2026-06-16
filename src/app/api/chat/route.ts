// src/app/api/chat/route.ts

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { retrieve } from '@/lib/retrieval/retriever';
import { generateStreamingResponse } from '@/lib/generation/generator';
import { checkRateLimit } from '@/lib/ratelimit';

const ChatRequestSchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })).min(1),
  department: z.string().optional(),
});

// Use Node.js runtime for streaming + Pinecone (not edge-compatible)
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // 1. Rate limiting — identify caller by IP
  const ip =
    request.ip ??
    request.headers.get('x-forwarded-for') ??
    'anonymous';

  const rateLimitResult = await checkRateLimit(ip);

  if (!rateLimitResult.success) {
    return new Response('Too many requests', {
      status: 429,
      headers: {
        'Retry-After': String(rateLimitResult.reset),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      },
    });
  }

  // 2. Validate request body
  let body: z.infer<typeof ChatRequestSchema>;
  try {
    body = ChatRequestSchema.parse(await request.json());
  } catch {
    return new Response('Invalid request body', { status: 400 });
  }

  const { messages, department } = body;
  const lastUserMessage = messages.findLast((m) => m.role === 'user');
  if (!lastUserMessage) return new Response('No user message', { status: 400 });
  const query = lastUserMessage.content.trim().slice(0, 1000);
  if (!query) return new Response('Empty query', { status: 400 });

  try {
    // 3. Retrieval
    const filter = department ? { department } : undefined;
    const results = await retrieve(query, {
      topK: 5,
      rerankTopN: 5,
      useMMR: true,
      filter,
    });

    // 4. Streaming generation
    const stream = await generateStreamingResponse(query, results);

    // 5. Attach sources as a response header so the client can show citations
    const sourcesHeader = JSON.stringify(
      results.map((r) => ({
        sourceName: r.chunk.metadata.sourceName,
        chunkIndex: r.chunk.metadata.chunkIndex,
        score: r.rerankScore ?? r.score,
        url: r.chunk.metadata.url,
      }))
    );

    return stream.toAIStreamResponse({
      headers: { 'X-Sources': sourcesHeader },
    });
  } catch (error) {
    console.error('Chat route error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
