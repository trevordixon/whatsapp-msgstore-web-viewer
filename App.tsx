import React, { useState, useEffect } from 'react';
import { initDatabase, getConversations, getMessages } from './services/dbService';
import { ConversationList } from './components/ConversationList';
import { ChatWindow } from './components/ChatWindow';
import { Conversation, Message } from './types';
import { Database, Upload, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [dbLoaded, setDbLoaded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Settings
  const [maxChats, setMaxChats] = useState(1000);
  const [maxMessages, setMaxMessages] = useState(5000);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      await initDatabase(buffer);
      setDbLoaded(true);
      loadChats(maxChats);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load database. Please ensure it is a valid, unencrypted msgstore.db file.");
      setDbLoaded(false);
    }
  };

  const loadChats = (limit: number) => {
    try {
      const chats = getConversations(limit);
      setConversations(chats);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChatSelect = (chat: Conversation) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    // Small timeout to allow UI to render loading state
    setTimeout(() => {
        const msgs = getMessages(chat._id, maxMessages);
        setMessages(msgs);
        setLoadingMessages(false);
    }, 10);
  };

  // Reload chats if settings change and DB is loaded
  useEffect(() => {
    if (dbLoaded) {
      loadChats(maxChats);
    }
  }, [maxChats, dbLoaded]);

  // Reload messages if settings change and chat is selected
  useEffect(() => {
    if (dbLoaded && selectedChat) {
      handleChatSelect(selectedChat);
    }
  }, [maxMessages]);

  if (!dbLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full text-center">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
            <Database size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">WhatsApp DB Viewer</h1>
          <p className="text-gray-500 mb-8">
            Open your <code>msgstore.db</code> file to view chats, messages, and history in a clean interface.
            <br/><span className="text-xs text-gray-400 mt-2 block">(No data is uploaded. Everything is processed locally in your browser.)</span>
          </p>

          <label className="block w-full cursor-pointer group">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-green-500 hover:bg-green-50 transition-all flex flex-col items-center">
              <Upload size={32} className="text-gray-400 group-hover:text-green-500 mb-2" />
              <span className="text-sm font-medium text-gray-600 group-hover:text-green-600">
                Click to select msgstore.db
              </span>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".db,application/vnd.sqlite3"
              onChange={handleFileChange} 
            />
          </label>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start text-left text-sm border border-red-200">
              <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
        {/* Settings Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm z-20">
            <div className="flex items-center space-x-2 text-green-700 font-semibold">
                <Database size={18} />
                <span>WA Viewer Pro</span>
            </div>
            
            <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-2">
                    <label className="text-gray-500">Max Chats:</label>
                    <input 
                        type="number" 
                        value={maxChats} 
                        onChange={(e) => setMaxChats(Number(e.target.value))}
                        className="w-16 border rounded px-2 py-1 bg-gray-50 focus:ring-1 focus:ring-green-500 outline-none"
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <label className="text-gray-500">Max Msgs:</label>
                    <input 
                        type="number" 
                        value={maxMessages} 
                        onChange={(e) => setMaxMessages(Number(e.target.value))}
                        className="w-16 border rounded px-2 py-1 bg-gray-50 focus:ring-1 focus:ring-green-500 outline-none"
                    />
                </div>
                <button 
                  onClick={() => setDbLoaded(false)}
                  className="text-red-500 hover:text-red-700 font-medium px-2"
                >
                  Close File
                </button>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden relative">
            <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full flex-shrink-0 border-r border-gray-200 bg-white`}>
                <ConversationList 
                    conversations={conversations} 
                    selectedId={selectedChat?._id || null} 
                    onSelect={handleChatSelect} 
                />
            </div>
            <div className={`${!selectedChat ? 'hidden md:flex' : 'flex'} flex-1 h-full min-w-0 bg-[#efeae2] relative`}>
                 <ChatWindow 
                    conversation={selectedChat}
                    messages={messages}
                    loading={loadingMessages}
                 />
                 {/* Mobile Back Button Overlay */}
                 {selectedChat && (
                    <button 
                        onClick={() => setSelectedChat(null)}
                        className="md:hidden absolute top-3 left-3 z-50 bg-white/80 p-2 rounded-full shadow-md text-gray-700 backdrop-blur-sm"
                    >
                        ← Back
                    </button>
                 )}
            </div>
        </div>
    </div>
  );
};

export default App;