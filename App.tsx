import React, { useState, useEffect } from 'react';
import { initDatabase, getConversations, getMessages } from './services/dbService';
import { ConversationList } from './components/ConversationList';
import { ChatWindow } from './components/ChatWindow';
import { Conversation, Message } from './types';
import { Database, Upload, AlertCircle, Download, Key, Loader } from 'lucide-react';
import { detectEncryptionType, extractKey, decryptDatabase, EncryptionType } from './services/encryptionService';
import { KeyEntryModal } from './components/KeyEntryModal';

const App: React.FC = () => {
  const [dbLoaded, setDbLoaded] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Encryption Support
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [encryptionType, setEncryptionType] = useState<EncryptionType | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [progressStatus, setProgressStatus] = useState("Decrypting...");

  // Settings
  const [maxChats, setMaxChats] = useState(1000);
  const [maxMessages, setMaxMessages] = useState(5000);



  const processFile = async (file: File) => {
    setError(null);
    setPendingFile(null);
    setEncryptionType(null);
    setShowKeyModal(false);

    try {
      const buffer = await file.arrayBuffer();

      // Check for encryption
      const detectedType = detectEncryptionType(buffer, file.name);
      if (detectedType) {
        // console.log("Detected encryption:", detectedType);
        setPendingFile(file);
        setEncryptionType(detectedType);
        setShowKeyModal(true);
        return;
      }

      // If not encrypted, load directly
      await initDatabase(buffer);
      setDbLoaded(true);
      loadChats(maxChats);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load database. Please ensure it is a valid msgstore.db file.");
      setDbLoaded(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };



  const handleKeySubmit = async (keyInput: File | string) => {
    if (!pendingFile || !encryptionType) return;

    setIsDecrypting(true);
    setError(null);

    try {
      // 1. Extract Key
      let keyBuffer: ArrayBuffer;
      if (typeof keyInput === 'string') {
        // It's a hex string
        keyBuffer = new TextEncoder().encode(keyInput).buffer;
      } else {
        keyBuffer = await keyInput.arrayBuffer();
      }

      const { cryptoKey, raw } = await extractKey(keyBuffer);

      // 2. Decrypt Database
      const dbBuffer = await pendingFile.arrayBuffer();
      const decryptedBuffer = await decryptDatabase(
        dbBuffer,
        cryptoKey,
        encryptionType,
        raw,
        (status) => setProgressStatus(status)
      );

      // 3. Init Database
      setProgressStatus("Initializing Database...");
      // Small timeout to allow UI to render the status change before main thread blocks again for init
      await new Promise(r => setTimeout(r, 10));

      await initDatabase(decryptedBuffer);
      setDbLoaded(true);
      loadChats(maxChats);

      // Reset Modal State
      setShowKeyModal(false);
      setPendingFile(null);
    } catch (err: any) {
      console.error("Decryption/Load Error:", err);
      setError(err.message || "Decryption failed. Please check your key file.");
    } finally {
      setIsDecrypting(false);
    }
  };

  const cancelKeyEntry = () => {
    setShowKeyModal(false);
    setPendingFile(null);
    setEncryptionType(null);
    // Reset file input? 
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
            <br /><span className="text-xs text-gray-400 mt-2 block">(No data is uploaded. Everything is processed locally in your browser.)</span>
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
              accept=".db,application/vnd.sqlite3,.crypt12,.crypt14,.crypt15"
              onChange={handleFileChange}
            />
          </label>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Don't have a file?</p>
            <a
              href="https://github.com/trevordixon/whatsapp-msgstore-web-viewer/raw/refs/heads/main/msgstore.db"
              className="inline-flex items-center text-sm text-green-600 hover:text-green-700 font-medium hover:underline"
              download
            >
              <Download size={16} className="mr-1.5" />
              Download sample msgstore.db
            </a>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start text-left text-sm border border-red-200">
              <AlertCircle size={20} className="mr-2 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>


        {
          showKeyModal && (
            <KeyEntryModal
              onKeySubmit={handleKeySubmit}
              onCancel={cancelKeyEntry}
              error={isDecrypting ? "Decrypting... Please wait." : error} // Simple reused error prop usage or separate status
            />
          )
        }

        {
          isDecrypting && !showKeyModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl flex items-center space-x-4">
                <Loader className="animate-spin text-green-600" />
                <span className="font-medium text-gray-700">{progressStatus}</span>
              </div>
            </div>
          )
        }
      </div >
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