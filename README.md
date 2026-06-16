Three manual steps required before going live:

Run npx ts-node --project tsconfig.scripts.json scripts/create-index.ts once to create the Pinecone index.
Add all env vars via vercel env add <KEY> production.
Ingest your first documents by POSTing to /api/ingest with the bearer token.
