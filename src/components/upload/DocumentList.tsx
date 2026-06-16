'use client';

import { useEffect, useState } from 'react';
import type { DocumentSummary } from '@/app/api/documents/route';

interface Props {
  refreshKey: number;
}

export function DocumentList({ refreshKey }: Props) {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch('/api/documents')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setDocs(data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-gray-800 mb-3">Knowledge base</h2>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">Failed to load documents: {error}</p>
      )}

      {!loading && !error && docs.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          No documents yet. Upload one above.
        </p>
      )}

      {!loading && !error && docs.length > 0 && (
        <div className="divide-y border rounded-lg overflow-hidden">
          {docs.map((doc) => (
            <div key={doc.sourceId} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 truncate">{doc.sourceName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {doc.sourceType.toUpperCase()}
                  {doc.department ? ` · ${doc.department}` : ''}
                  {' · '}
                  {doc.totalChunks} chunks
                </p>
              </div>
              <span className="ml-4 text-xs text-gray-400 whitespace-nowrap">
                {new Date(doc.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
