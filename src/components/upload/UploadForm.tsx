'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';

type Status =
  | { type: 'idle' }
  | { type: 'uploading' }
  | { type: 'success'; chunksCreated: number; processingTimeMs: number; documentId: string }
  | { type: 'error'; message: string };

const DEPARTMENTS = ['Engineering', 'HR', 'Finance', 'Legal', 'Product'];
const ACCEPTED = '.pdf,.docx,.md,.mdx';

interface Props {
  onSuccess?: () => void;
}

export function UploadForm({ onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [department, setDepartment] = useState('');
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File) {
    setFile(f);
    setStatus({ type: 'idle' });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus({ type: 'uploading' });

    const form = new FormData();
    form.append('file', file);
    if (department) form.append('department', department);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: 'error', message: data.error ?? 'Upload failed' });
        return;
      }

      setStatus({
        type: 'success',
        chunksCreated: data.chunksCreated,
        processingTimeMs: data.processingTimeMs,
        documentId: data.documentId,
      });
      onSuccess?.();
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setStatus({ type: 'error', message: String(err) });
    }
  }

  const isUploading = status.type === 'uploading';

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onFileChange}
          className="hidden"
        />
        {file ? (
          <div>
            <p className="text-sm font-medium text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500">
              Drag & drop a file here, or <span className="text-blue-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, MD — up to any size</p>
          </div>
        )}
      </div>

      {/* Department */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Department <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!file || isUploading}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isUploading ? 'Uploading...' : 'Upload Document'}
      </button>

      {/* Status */}
      {status.type === 'success' && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          <p className="font-medium">Upload successful</p>
          <p className="mt-1 text-green-600">
            {status.chunksCreated} chunks indexed in {(status.processingTimeMs / 1000).toFixed(1)}s
          </p>
        </div>
      )}

      {status.type === 'error' && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <p className="font-medium">Upload failed</p>
          <p className="mt-1 text-red-600">{status.message}</p>
        </div>
      )}
    </form>
  );
}
