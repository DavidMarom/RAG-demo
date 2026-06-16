'use client';

import { useState } from 'react';
import { UploadForm } from '@/components/upload/UploadForm';
import { DocumentList } from '@/components/upload/DocumentList';
import Link from 'next/link';

export default function UploadPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 pt-12">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Upload Document</h1>
            <p className="text-sm text-gray-500 mt-1">
              Add PDFs, Word documents, or Markdown files to the knowledge base.
            </p>
          </div>

          <UploadForm onSuccess={() => setRefreshKey((k) => k + 1)} />

          <div className="mt-6 text-center">
            <Link href="/chat" className="text-sm text-blue-600 hover:underline">
              Back to chat
            </Link>
          </div>
        </div>

        <DocumentList refreshKey={refreshKey} />
      </div>
    </div>
  );
}
