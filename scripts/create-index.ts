// scripts/create-index.ts
// Run once: npx ts-node scripts/create-index.ts

import { Pinecone } from '@pinecone-database/pinecone';

async function createIndex(): Promise<void> {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not set');
  }
  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error('PINECONE_INDEX_NAME is not set');
  }

  const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  const indexName = process.env.PINECONE_INDEX_NAME;

  // Check if the index already exists
  const existingIndexes = await client.listIndexes();
  const alreadyExists = existingIndexes.indexes?.some(
    (idx) => idx.name === indexName
  );

  if (alreadyExists) {
    console.log(`Index "${indexName}" already exists. Skipping creation.`);
    const stats = await client.index(indexName).describeIndexStats();
    console.log('Index stats:', JSON.stringify(stats, null, 2));
    return;
  }

  console.log(`Creating Pinecone index "${indexName}"...`);

  await client.createIndex({
    name: indexName,
    dimension: 1536,  // matches text-embedding-3-small
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
  });

  console.log(`Index "${indexName}" created successfully.`);
  console.log('It may take 1-2 minutes to become ready.');
}

createIndex().catch((err) => {
  console.error('Failed to create index:', err);
  process.exit(1);
});
