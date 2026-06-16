'use client';
// src/components/chat/MessageList.tsx

import type { Message } from 'ai';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-16">
        <span className="text-4xl">💬</span>
        <p className="text-sm">Start a conversation to query the knowledge base</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          isStreaming={
            isLoading &&
            index === messages.length - 1 &&
            message.role === 'assistant'
          }
        />
      ))}
    </>
  );
}
