import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/ingestion/pipeline';

export const runtime = 'nodejs';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'md', 'mdx'];

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  const department = form.get('department') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type ".${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    );
  }

  const tmpPath = join('/tmp', `${randomUUID()}-${file.name}`);
  try {
    await writeFile(tmpPath, Buffer.from(await file.arrayBuffer()));
    const result = await ingestDocument(tmpPath, {
      department: department || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Upload ingestion error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
