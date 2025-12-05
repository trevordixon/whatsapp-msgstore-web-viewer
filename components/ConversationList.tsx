import React, { useState, useMemo } from 'react';
import { Conversation } from '../types';
import { Search, User, Users } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (conv: Conversation) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    const lower = searchTerm.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.subject && c.subject.toLowerCase().includes(lower)) ||
        (c.jid && c.jid.toLowerCase().includes(lower))
    );
  }, [conversations, searchTerm]);

  const formatDate = (ts: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full md:w-80 lg:w-96">
      {/* Header */}
      <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
        <h2 className="font-semibold text-gray-700">Chats</h2>
        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
          {conversations.length}
        </span>
      </div>

      {/* Search */}
      <div className="p-3 bg-white border-b border-gray-100">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent rounded-lg text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No chats found matching "{searchTerm}"
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv._id}
              onClick={() => onSelect(conv)}
              className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                selectedId === conv._id ? 'bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500' : 'border-l-4 border-l-transparent'
              }`}
            >
              {/* Avatar Placeholder */}
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 mr-3 flex-shrink-0">
                {conv.subject ? <Users size={20} /> : <User size={20} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {conv.subject || conv.jid}
                  </h3>
                  <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                    {formatDate(conv.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {conv.subject ? `~ ${conv.jid}` : 'Private Chat'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
