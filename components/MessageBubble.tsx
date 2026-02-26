import React, { useEffect, useMemo, useState } from 'react';
import { Message } from '../types';
import { Check, Image as ImageIcon } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  mediaServerUrl: string;
}

const buildMediaUrl = (baseUrl: string, filePath: string) => {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  if (!normalizedBase) return null;

  const encodedPath = filePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return encodedPath ? `${normalizedBase}/${encodedPath}` : null;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, mediaServerUrl }) => {
  const isSent = message.from_me;
  const mediaFilePath = message.media_file_path || message.media_file_name || 'arquivo-desconhecido';
  const mediaFileName = message.media_file_name || message.media_file_path || 'arquivo-desconhecido';
  const downloadFileName =
    message.media_file_name ||
    (message.media_file_path ? message.media_file_path.split('/').pop() || 'arquivo-desconhecido' : 'arquivo-desconhecido');
  const mediaTypeLabel = message.media_type_label || 'Desconhecido';
  const mediaMime = message.media_mime || 'unknown/unknown';
  const showMediaMetadata = Boolean(
    message.has_media ||
    message.media_file_name ||
    message.media_file_path ||
    message.media_mime ||
    message.media_type_label
  );
  const canPreviewMediaKind =
    message.media_kind === 'image' || message.media_kind === 'video' || message.media_kind === 'audio';
  const mediaUrl = useMemo(
    () => (message.media_file_path ? buildMediaUrl(mediaServerUrl, message.media_file_path) : null),
    [mediaServerUrl, message.media_file_path]
  );
  const [previewError, setPreviewError] = useState(false);
  const showMediaPreview = showMediaMetadata && canPreviewMediaKind && Boolean(mediaUrl) && !previewError;
  const canDownloadNonPreviewMedia = showMediaMetadata && !canPreviewMediaKind && Boolean(mediaUrl);

  useEffect(() => {
    setPreviewError(false);
  }, [mediaUrl]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} mb-2 group w-full`}>
      <div
        className={`relative max-w-[85%] md:max-w-[70%] px-2 pt-2 pb-1 rounded-lg shadow-sm text-sm ${
          isSent ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'
        }`}
      >
        {/* Tail SVG */}
        {isSent ? (
          <span className="absolute -right-[8px] top-0 text-[#d9fdd3]">
             <svg viewBox="0 0 8 13" height="13" width="8" className="fill-current block"><path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"></path></svg>
          </span>
        ) : (
          <span className="absolute -left-[8px] top-0 text-white">
             <svg viewBox="0 0 8 13" height="13" width="8" className="fill-current block"><path d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"></path></svg>
          </span>
        )}

        {/* Quoted Message */}
        {message.quoted_text && (
          <div className={`mb-1 p-2 rounded bg-opacity-30 text-xs border-l-4 w-full overflow-hidden ${
              isSent ? 'bg-green-800 border-green-600 text-green-900' : 'bg-gray-200 border-gray-400 text-gray-700'
          }`}>
             <span className="font-bold block mb-0.5 opacity-80">Quoted</span>
             <div className="whitespace-pre-wrap break-words line-clamp-4 min-w-0 w-full" style={{ wordBreak: 'break-word' }}>
               {message.quoted_text}
             </div>
          </div>
        )}

        {/* Content */}
        <div className="text-gray-900 px-1 leading-relaxed min-w-0 w-full" style={{ wordBreak: 'break-word' }}>
          {message.text_data ? (
            <div className="whitespace-pre-wrap break-words">
              {message.text_data}
            </div>
          ) : showMediaMetadata ? (
            <div className="flex items-center text-gray-500 italic py-1">
              <ImageIcon size={16} className="mr-2" />
              <span>Media omitted</span>
            </div>
          ) : (
            <div className="text-gray-500 italic py-1">
              Mensagem sem conteudo
            </div>
          )}

          {showMediaMetadata && (
            <div className={`${message.text_data ? 'mt-2' : 'mt-1'} rounded-md bg-black/5 px-2 py-1.5 text-xs break-all`}>
              <div>
                <span className="font-semibold text-gray-600">Arquivo:</span>{' '}
                <span className="text-gray-700">{mediaFilePath}</span>
              </div>
              <div className="mt-1">
                <span className="font-semibold text-gray-600">Tipo:</span>{' '}
                <span className="text-gray-700">{`${mediaTypeLabel} (${mediaMime})`}</span>
              </div>
              {showMediaPreview && mediaUrl && (
                <div className="mt-2">
                  <span className="font-semibold text-gray-600">Conteudo:</span>
                  <div className="mt-1">
                    {message.media_kind === 'image' && (
                      <img
                        src={mediaUrl}
                        alt={mediaFileName}
                        loading="lazy"
                        onError={() => setPreviewError(true)}
                        className="max-h-64 w-auto max-w-full rounded border border-gray-200 bg-white"
                      />
                    )}
                    {message.media_kind === 'video' && (
                      <video
                        src={mediaUrl}
                        controls
                        preload="metadata"
                        onError={() => setPreviewError(true)}
                        className="max-h-64 w-full rounded border border-gray-200 bg-black"
                      />
                    )}
                    {message.media_kind === 'audio' && (
                      <audio
                        src={mediaUrl}
                        controls
                        preload="metadata"
                        onError={() => setPreviewError(true)}
                        className="w-full"
                      />
                    )}
                  </div>
                </div>
              )}
              {!showMediaPreview && canPreviewMediaKind && mediaUrl && (
                <div className="mt-2 text-[11px] text-amber-700">
                  Conteudo indisponivel nesta URL.
                </div>
              )}
              {canDownloadNonPreviewMedia && mediaUrl && (
                <div className="mt-2">
                  <span className="font-semibold text-gray-600">Conteudo:</span>
                  <div className="mt-1">
                    <a
                      href={mediaUrl}
                      download={downloadFileName}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-2.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Baixar arquivo
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-end mt-1 space-x-1 select-none">
          <time className="text-[10px] text-gray-500 min-w-[45px] text-right">
            {formatTime(message.timestamp)}
          </time>
          {isSent && (
            <span className="text-blue-500">
              <Check size={12} strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
