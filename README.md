# DocuChat — Production-Grade RAG System

Live demo: [https://rag-demo-woad.vercel.app/](https://rag-demo-woad.vercel.app/)

A full-stack Retrieval-Augmented Generation (RAG) application built with Next.js 14, OpenAI, and Pinecone. Upload your documents, ask questions in natural language, and get answers grounded in your own knowledge base — with cited sources.

---

## Architecture Overview

```
┌──────────────┐     ┌─────────────────────────────────────────────┐
│   Browser    │────▶│              Next.js API Routes              │
│  (Chat UI)   │◀────│  /api/chat   /api/upload   /api/ingest      │
└──────────────┘     └──────────────────┬──────────────────────────┘
                                        │
              ┌─────────────────────────▼─────────────────────────┐
              │                  RAG Pipeline                      │
              │                                                    │
              │  Document Ingestion          Retrieval             │
              │  ┌─────────────┐        ┌──────────────────┐      │
              │  │ PDF/DOCX/MD │        │  ANN Vector Search│      │
              │  │  Loaders    │        │    (Pinecone)     │      │
              │  └──────┬──────┘        └────────┬─────────┘      │
              │         │                        │                 │
              │  ┌──────▼──────┐        ┌────────▼─────────┐      │
              │  │  Recursive  │        │  Cohere Rerank   │      │
              │  │  Chunker    │        │  (BM25 fallback) │      │
              │  └──────┬──────┘        └────────┬─────────┘      │
              │         │                        │                 │
              │  ┌──────▼──────┐        ┌────────▼─────────┐      │
              │  │  OpenAI     │        │  MMR Diversity   │      │
              │  │  Embeddings │        │  Selector        │      │
              │  └──────┬──────┘        └────────┬─────────┘      │
              │         │                        │                 │
              │  ┌──────▼──────┐        ┌────────▼─────────┐      │
              │  │  Pinecone   │        │  GPT-4o Streaming│      │
              │  │  Upsert     │        │  Response        │      │
              │  └─────────────┘        └──────────────────┘      │
              └────────────────────────────────────────────────────┘
                             │                    │
                    ┌────────▼────┐      ┌────────▼────────┐
                    │   Upstash   │      │    Langfuse     │
                    │ Redis Cache │      │  Observability  │
                    └─────────────┘      └─────────────────┘
```

---

## Key Technical Features

### Ingestion Pipeline
- **Multi-format loaders** — PDF (`pdf-parse`), DOCX (`mammoth`), Markdown, and HTML (via `cheerio`)
- **Recursive chunking** — 1,000-token chunks with 200-token overlap, preserving semantic context across boundaries
- **Batched embedding generation** — parallelised calls to `text-embedding-3-small` using `p-limit` to stay within rate limits
- **Metadata-aware storage** — every chunk carries `sourceId`, `sourceName`, `department`, `chunkIndex`, and `totalChunks` for filtered retrieval

### Retrieval Pipeline
- **ANN vector search** — queries Pinecone with a 4× over-fetch buffer to give the reranker more candidates to work with
- **Dual reranking strategy** — uses the Cohere Rerank API (`rerank-english-v3.0`) when a key is present; falls back to an in-process BM25 implementation (70% vector score + 30% lexical score) with no external dependency
- **Maximal Marginal Relevance (MMR)** — greedy selection algorithm that balances relevance against diversity, controlled by a configurable `lambda` parameter
- **Metadata filtering** — supports department-scoped queries so users only retrieve from their permitted knowledge domains

### Generation
- **Streaming responses** via Vercel AI SDK — tokens stream to the client as they are produced, with no waiting for the full completion
- **Source citations** — retrieved chunk metadata is serialised into the `X-Sources` response header and rendered as clickable citations in the UI
- **Structured prompt templates** — separate prompt builder keeps system instructions, context injection, and safety instructions composable and testable

### Infrastructure
- **Redis caching** (Upstash) — retrieval results are cached for 1 hour by a SHA-256 hash of the query and filter; cache is invalidated on document re-ingestion
- **Rate limiting** (Upstash) — per-IP sliding window enforced at the API route level before any LLM calls are made
- **LLM observability** (Langfuse) — each request generates a trace with spans for retrieval, reranking, and generation; errors are tagged and surfaced in the Langfuse dashboard
- **Lazy initialisation** — Langfuse client is constructed only when a key is present, so tests and dev environments run without any observability config

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| LLM | OpenAI GPT-4o via Vercel AI SDK |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector DB | Pinecone |
| Reranking | Cohere Rerank v3 / BM25 (fallback) |
| Caching & Rate Limiting | Upstash Redis |
| Observability | Langfuse |
| Styling | Tailwind CSS |
| Testing | Vitest + MSW |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/          # Streaming chat endpoint (RAG pipeline entry point)
│   │   ├── upload/        # Multipart file upload handler
│   │   ├── ingest/        # Document ingestion trigger
│   │   ├── search/        # Direct vector search endpoint
│   │   └── documents/     # List ingested documents
│   ├── chat/              # Chat UI page
│   └── upload/            # Document upload UI page
├── components/
│   ├── chat/              # ChatInterface, MessageList, SourceCitations
│   └── upload/            # UploadForm, DocumentList
└── lib/
    ├── ingestion/
    │   ├── loaders.ts      # PDF / DOCX / MD / HTML parsers
    │   ├── chunker.ts      # Recursive text splitter
    │   └── pipeline.ts     # Orchestrates load → chunk → embed → upsert
    ├── retrieval/
    │   ├── embeddings.ts   # Batched OpenAI embedding calls
    │   ├── vectorstore.ts  # Pinecone read/write abstraction
    │   ├── reranker.ts     # Cohere + BM25 reranking strategies
    │   └── retriever.ts    # Full retrieval pipeline (ANN → filter → rerank → MMR)
    ├── generation/
    │   ├── generator.ts    # Streaming GPT-4o call
    │   └── prompts.ts      # System prompt and context injection templates
    ├── cache.ts            # Redis-backed retrieval cache
    ├── ratelimit.ts        # Per-IP rate limiting
    └── observability.ts    # Langfuse trace/span wrappers
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- OpenAI API key
- Pinecone account (free tier works)
- Upstash Redis database (free tier works)

### Installation

```bash
git clone https://github.com/your-username/docuchat.git
cd docuchat
npm install
```

### Environment Setup

```bash
cp .env.local.example .env.local
```

Fill in the required variables in `.env.local`:

```env
# Required
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk-...
PINECONE_INDEX_NAME=docuchat
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
INGESTION_SECRET=<openssl rand -hex 32>

# Optional — enables higher-quality reranking
COHERE_API_KEY=

# Optional — enables LLM observability dashboard
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASEURL=https://cloud.langfuse.com
```

### Create the Pinecone Index

```bash
npm run create-index
```

This creates a Pinecone index with 1,536 dimensions (matching `text-embedding-3-small`) and cosine similarity metric.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000/upload](http://localhost:3000/upload) to upload documents, then [http://localhost:3000/chat](http://localhost:3000/chat) to start asking questions.

---

## Running Tests

```bash
npm test                  # run all tests
npm run test:coverage     # with coverage report
npm run type-check        # TypeScript strict check
```

---

## Deployment

The project includes a `vercel.json` and is optimised for Vercel deployment. All API routes run on the Node.js runtime (not Edge) to support Pinecone's SDK and streaming simultaneously.

```bash
vercel deploy
```

Add the environment variables from `.env.local` to your Vercel project settings before deploying.

---

## Design Decisions

**Why BM25 fallback instead of requiring Cohere?** Cohere adds measurable quality gains for cross-encoder reranking, but treating it as optional means the system degrades gracefully rather than failing — important for cost-conscious deployments or CI test runs.

**Why MMR on top of reranking?** Reranking optimises for individual document relevance; MMR optimises for the set. Without it, the top-5 results are often near-duplicates from the same source chunk, which wastes context window space.

**Why Redis for both caching and rate limiting?** Collocating both in Upstash keeps the dependency count low and allows a single serverless Redis connection to handle both concerns. The retrieval cache alone cuts Pinecone + Cohere costs significantly for repeated queries.
