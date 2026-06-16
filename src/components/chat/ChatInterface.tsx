'use client';
// src/components/chat/ChatInterface.tsx

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { SourceCitations } from './SourceCitations';

export interface Source {
  sourceName: string;
  chunkIndex: number;
  score: number;
  url?: string;
}

export function ChatInterface() {
  const [sources, setSources] = useState<Source[]>([]);
  const [department, setDepartment] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: '/api/chat',
    body: department ? { department } : {},
    onResponse: (response) => {
      const sourcesHeader = response.headers.get('X-Sources');
      if (sourcesHeader) {
        try {
          setSources(JSON.parse(sourcesHeader));
        } catch {
          setSources([]);
        }
      }
    },
    onError: (err) => {
      console.error('Chat error:', err);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">DocuChat</h1>
          <p className="text-sm text-gray-500">
            Ask questions about the organizational knowledge base
          </p>
        </div>
        <div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All departments</option>
            <option value="Engineering">Engineering</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Legal">Legal</option>
            <option value="Product">Product</option>
          </select>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MessageList messages={messages} isLoading={isLoading} />
        <div ref={bottomRef} />
      </div>

      {/* Source citations */}
      {sources.length > 0 && (
        <SourceCitations sources={sources} />
      )}

      {/* Error banner */}
      {error && (
        <div className="border-t p-3 bg-red-50 text-red-600 text-sm">
          Error: {error.message}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? '⟳ Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
