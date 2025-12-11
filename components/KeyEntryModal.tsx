import React, { useRef, useState } from 'react';
import { Upload, Key, X } from 'lucide-react';

interface KeyEntryModalProps {
    onKeySubmit: (key: File | string) => void;
    onCancel: () => void;
    error: string | null;
}

export const KeyEntryModal: React.FC<KeyEntryModalProps> = ({ onKeySubmit, onCancel, error }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [hexKey, setHexKey] = useState("");

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onKeySubmit(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            onKeySubmit(e.target.files[0]);
        }
    };

    const handleHexSubmit = () => {
        if (hexKey.length === 64) {
            onKeySubmit(hexKey);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-6">
                    <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                        <Key size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Decryption Key Required</h2>
                    <p className="text-gray-500 text-sm mt-2">
                        This database is encrypted. Please provide the key file or your 64-digit recovery key.
                    </p>
                </div>

                <div
                    className={`border-2 border-dashed rounded-lg p-8 transition-all text-center cursor-pointer mb-6
                        ${dragActive ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">
                        Drag & drop your key file here
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        or click to browse
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleChange}
                    />
                </div>

                <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or enter using hex key</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <input
                        type="text"
                        value={hexKey}
                        onChange={(e) => setHexKey(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                        placeholder="Paste 64-character hex key..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none uppercase"
                        maxLength={64}
                    />
                    <button
                        onClick={handleHexSubmit}
                        disabled={hexKey.length !== 64}
                        className={`w-full py-3 rounded-lg font-medium transition-colors
                            ${hexKey.length === 64
                                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                        Decrypt Database
                    </button>
                </div>

                {error && (
                    <div className={`mt-4 text-sm p-3 rounded border ${error.includes('Decrypting') || error.includes('Please wait') || error.includes('Deriving') || error.includes('Decompressing') || error.includes('Parsing') || error.includes('Initializing')
                            ? 'text-blue-700 bg-blue-50 border-blue-200'
                            : 'text-red-600 bg-red-50 border-red-200'
                        }`}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
