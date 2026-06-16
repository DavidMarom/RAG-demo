// src/lib/generation/prompts.ts

import { SearchResult } from '@/types';

export function buildSystemPrompt(): string {
  return `You are a helpful assistant for an organization's internal knowledge base.
Your task is to answer questions based ONLY on the provided context documents.

Rules:
1. Answer based strictly on the provided context. Do not use outside knowledge.
2. If the context doesn't contain enough information to answer, say so clearly.
3. Always cite which document(s) your answer comes from using [Source: document_name] notation.
4. Be concise but complete. Don't pad your answer.
5. If asked something outside the scope of the provided documents, politely redirect.`;
}

export function buildContextBlock(results: SearchResult[]): string {
  if (results.length === 0) return 'No relevant documents found.';

  return results
    .map((result, index) => {
      const { sourceName, chunkIndex, totalChunks, department } =
        result.chunk.metadata;
      const deptInfo = department ? ` | Department: ${department}` : '';
      const score = (result.rerankScore ?? result.score).toFixed(3);

      return `--- Document ${index + 1} ---
Source: ${sourceName} (chunk ${chunkIndex + 1}/${totalChunks})${deptInfo}
Relevance: ${score}
Content:
${result.chunk.content}`;
    })
    .join('\n\n');
}

export function buildUserPrompt(query: string, context: string): string {
  return `Context Documents:
${context}

---

Question: ${query}

Please answer based on the context documents above. Cite your sources.`;
}
