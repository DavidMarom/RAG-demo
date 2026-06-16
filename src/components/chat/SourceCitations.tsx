'use client';
// src/components/chat/SourceCitations.tsx

import type { Source } from './ChatInterface';

interface SourceCitationsProps {
  sources: Source[];
}

export function SourceCitations({ sources }: SourceCitationsProps) {
  return (
    <div className="border-t p-3 bg-gray-50">
      <p className="text-xs font-semibold text-gray-500 mb-2">Sources:</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, index) => (
          <a
            key={index}
            href={source.url ?? '#'}
            target={source.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs bg-white border rounded-full px-3 py-1 hover:bg-gray-100 transition-colors"
          >
            <span>📄</span>
            <span className="max-w-[120px] truncate">{source.sourceName}</span>
            <span className="text-green-600 font-medium">
              {(source.score * 100).toFixed(0)}%
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
