import React, { useEffect, useRef } from 'react';
import { Message, Conversation } from '../types';
import { MessageBubble } from './MessageBubble';
import { Phone, Video, Search, MoreVertical } from 'lucide-react';

interface ChatWindowProps {
  messages: Message[];
  conversation: Conversation | null;
  loading: boolean;
}

// Helper to group messages by date
const groupMessagesByDate = (messages: Message[]) => {
  const groups: { [key: string]: Message[] } = {};
  
  messages.forEach((msg) => {
    const dateStr = msg.timestamp.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }
    groups[dateStr].push(msg);
  });
  
  return groups;
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, conversation, loading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-l border-gray-300 h-full p-8 text-center">
        <div className="bg-gray-200 p-6 rounded-full mb-6">
          <Search size={48} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-light text-gray-700 mb-2">WhatsApp Viewer</h2>
        <p className="text-gray-500 max-w-md">
          Select a conversation from the sidebar to view its history. 
          Your database is processed locally in your browser.
        </p>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2] relative w-full min-w-0">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
            backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
            backgroundRepeat: 'repeat'
        }}
      />

      {/* Header */}
      <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-gray-300 z-10 shadow-sm sticky top-0 w-full">
        <div className="flex items-center min-w-0">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white mr-3 flex-shrink-0">
             <span className="text-sm font-bold text-gray-600">
               {conversation.subject ? conversation.subject.charAt(0).toUpperCase() : '#'}
             </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-800 text-sm md:text-base truncate">
              {conversation.subject || conversation.jid}
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {conversation.jid}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-gray-500 flex-shrink-0">
            <Search size={20} className="cursor-not-allowed opacity-50" />
            <MoreVertical size={20} className="cursor-not-allowed opacity-50" />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 z-0 md:px-12 lg:px-24 w-full">
        {loading ? (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
        ) : (
            <>
                {Object.entries(messageGroups).map(([date, msgs]) => (
                    <div key={date}>
                        <div className="flex justify-center mb-4 sticky top-2 z-10">
                            <span className="bg-white/90 shadow-sm px-3 py-1 rounded-lg text-xs text-gray-600 font-medium backdrop-blur-sm border border-gray-100">
                                {date}
                            </span>
                        </div>
                        {msgs.map((msg) => (
                            <MessageBubble key={msg._id} message={msg} />
                        ))}
                    </div>
                ))}
                <div ref={bottomRef} />
            </>
        )}
      </div>

      {/* Read-Only Input Area */}
      <div className="bg-[#f0f2f5] p-3 border-t border-gray-300 z-10 flex items-center gap-2 w-full">
        <div className="p-2 text-gray-500 flex-shrink-0">
            <span className="text-2xl">😊</span>
        </div>
        <div className="flex-1 bg-white rounded-lg px-4 py-3 text-sm text-gray-400 border border-gray-200 italic shadow-sm truncate">
            You are viewing a read-only archive
        </div>
        <div className="p-2 text-gray-500 flex-shrink-0">
            <span className="text-xl">🎤</span>
        </div>
      </div>
    </div>
  );
};