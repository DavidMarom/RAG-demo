// src/app/chat/page.tsx

import { ChatInterface } from '@/components/chat/ChatInterface';

export const metadata = {
  title: 'DocuChat — Knowledge Base',
  description: 'Chat with your organization\'s knowledge base',
};

export default function ChatPage() {
  return <ChatInterface />;
}
