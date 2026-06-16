// src/lib/ingestion/loaders.ts

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { ChunkMetadata } from '@/types';
import { randomUUID } from 'crypto';

export interface RawDocument {
  id: string;
  content: string;
  metadata: Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>;
}

export async function loadPDF(
  filePath: string,
  metadata: Partial<ChunkMetadata> = {}
): Promise<RawDocument> {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);

  // pdf-parse returns text with form-feeds between pages (\f)
  const cleanContent = data.text
    .replace(/\f/g, '\n\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    id: randomUUID(),
    content: cleanContent,
    metadata: {
      sourceName: path.basename(filePath),
      sourceType: 'pdf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...metadata,
      sourceId: metadata.sourceId ?? randomUUID(),
    },
  };
}

export async function loadMarkdown(
  filePath: string,
  metadata: Partial<ChunkMetadata> = {}
): Promise<RawDocument> {
  const content = await fs.readFile(filePath, 'utf-8');

  return {
    id: randomUUID(),
    content,
    metadata: {
      sourceName: path.basename(filePath),
      sourceType: 'markdown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...metadata,
      sourceId: metadata.sourceId ?? randomUUID(),
    },
  };
}

export async function loadDocx(
  filePath: string,
  metadata: Partial<ChunkMetadata> = {}
): Promise<RawDocument> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });

  const cleanContent = result.value
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    id: randomUUID(),
    content: cleanContent,
    metadata: {
      sourceName: path.basename(filePath),
      sourceType: 'text',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...metadata,
      sourceId: metadata.sourceId ?? randomUUID(),
    },
  };
}

export async function loadHTML(
  html: string,
  sourceName: string,
  metadata: Partial<ChunkMetadata> = {}
): Promise<RawDocument> {
  const $ = cheerio.load(html);

  // Remove navigation, footer, scripts
  $('nav, footer, script, style, header, aside').remove();

  // Extract clean text
  const content = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  return {
    id: randomUUID(),
    content,
    metadata: {
      sourceName,
      sourceType: 'html',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...metadata,
      sourceId: metadata.sourceId ?? randomUUID(),
    },
  };
}
