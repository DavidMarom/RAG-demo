// src/types/index.ts

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

export interface ChunkMetadata {
  sourceId: string;
  sourceName: string;
  sourceType: 'pdf' | 'markdown' | 'html' | 'text';
  chunkIndex: number;
  totalChunks: number;
  pageNumber?: number;
  department?: string;
  createdAt: string;
  updatedAt: string;
  url?: string;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  rerankScore?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchResult[];
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  traceId?: string;
}
