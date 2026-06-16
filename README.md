Three manual steps required before going live:

Run npx ts-node --project tsconfig.scripts.json scripts/create-index.ts once to create the Pinecone index.
Add all env vars via vercel env add <KEY> production.
Ingest your first documents by POSTing to /api/ingest with the bearer token.


Setup pinecone
===============
Go to app.pinecone.io, sign in, then:

Click "Create index"
Fill in:

Index name: docuchat (must match your PINECONE_INDEX_NAME env var)
Dimensions: 1536
Metric: Cosine


Under configuration, choose Serverless, then pick AWS / us-east-1
Click Create index

That's it. Once it's ready (takes a minute or two), copy the index's host URL from the dashboard — it looks like https://docuchat-abc123.svc.us-east1-gcp.pinecone.io — and paste it as PINECONE_HOST in your .env.local if you need it, though the current code only requires PINECONE_API_KEY and PINECONE_INDEX_NAME.
You can safely ignore scripts/create-index.ts if you're doing it through the UI.