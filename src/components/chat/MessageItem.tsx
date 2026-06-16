'use client';
// src/components/chat/MessageItem.tsx

import type { Message } from 'ai';

interface MessageItemProps {
  message: Message;
  isStreaming: boolean;
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white border shadow-sm'
        }`}
      >
        <div className="text-xs mb-1 opacity-60">
          {isUser ? 'You' : '🤖 DocuChat'}
        </div>
        <div className="whitespace-pre-wrap" dir="auto">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
          )}
        </div>
      </div>
    </div>
  );
}
