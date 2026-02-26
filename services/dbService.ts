import { Conversation, MediaKind, Message } from '../types';

declare global {
  interface Window {
    initSqlJs: (config: any) => Promise<any>;
  }
}

let dbInstance: any = null;
const UNKNOWN_FILE_NAME = 'arquivo-desconhecido';
const UNKNOWN_MIME = 'unknown/unknown';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  opus: 'audio/ogg; codecs=opus',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  vcf: 'text/vcard',
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const basenameFromPath = (path: string | null): string | null => {
  if (!path) return null;
  const parts = path.split(/[\\/]/);
  const last = parts[parts.length - 1]?.trim();
  return last ? last : path;
};

const extensionFromValue = (value: string | null): string | null => {
  if (!value) return null;
  const base = basenameFromPath(value);
  if (!base) return null;
  const dotIndex = base.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === base.length - 1) return null;
  return base.slice(dotIndex + 1).toLowerCase();
};

const resolveMime = (
  rawMimeType: string | null,
  fileName: string | null,
  filePath: string | null
): string => {
  const mime = toNonEmptyString(rawMimeType);
  if (mime) return mime;

  const extension = extensionFromValue(fileName) ?? extensionFromValue(filePath);
  if (extension && MIME_BY_EXTENSION[extension]) {
    return MIME_BY_EXTENSION[extension];
  }

  return UNKNOWN_MIME;
};

const classifyMedia = (
  mime: string,
  fileName: string | null,
  filePath: string | null,
  messageType: number | null
): { media_kind: MediaKind; media_type_label: string; media_mime: string } => {
  const mimeLower = mime.toLowerCase();
  const nameOrPath = `${fileName || ''} ${filePath || ''}`.toLowerCase();

  if (nameOrPath.includes('sticker') || messageType === 20) {
    return { media_kind: 'sticker', media_type_label: 'Sticker', media_mime: mime };
  }

  if (mimeLower.startsWith('image/')) {
    return { media_kind: 'image', media_type_label: 'Imagem', media_mime: mime };
  }
  if (mimeLower.startsWith('video/')) {
    return { media_kind: 'video', media_type_label: 'Vídeo', media_mime: mime };
  }
  if (mimeLower.startsWith('audio/')) {
    return { media_kind: 'audio', media_type_label: 'Áudio', media_mime: mime };
  }
  if (mimeLower.startsWith('application/') || mimeLower.startsWith('text/')) {
    return { media_kind: 'document', media_type_label: 'Documento', media_mime: mime };
  }

  if (messageType === 1) {
    return { media_kind: 'image', media_type_label: 'Imagem', media_mime: mime };
  }
  if (messageType === 2) {
    return { media_kind: 'audio', media_type_label: 'Áudio', media_mime: mime };
  }
  if (messageType === 3) {
    return { media_kind: 'video', media_type_label: 'Vídeo', media_mime: mime };
  }

  return { media_kind: 'unknown', media_type_label: 'Desconhecido', media_mime: mime };
};

export const initDatabase = async (buffer: ArrayBuffer): Promise<void> => {
  if (!window.initSqlJs) {
    throw new Error("SQL.js not loaded");
  }

  const SQL = await window.initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
  });

  dbInstance = new SQL.Database(new Uint8Array(buffer));
};

export const getConversations = (limit: number = 1000): Conversation[] => {
  if (!dbInstance) return [];

  // Preferred query for modern WA schemas:
  // - Converts LID-only IDs to real phone numbers via jid_map.
  // - Tries to resolve a usable contact name when available.
  const mappedQuery = `
    SELECT
      chat._id,
      COALESCE(jid_phone.user, jid.user) AS resolved_user,
      COALESCE(
        chat.subject,
        CASE
          -- In many databases this column stores masked numbers (e.g. +55∙∙∙∙),
          -- so only use it when it does not look masked.
          WHEN lid_display_name.display_name IS NOT NULL
           AND trim(lid_display_name.display_name) <> ''
           AND instr(lid_display_name.display_name, '∙') = 0
          THEN lid_display_name.display_name
          ELSE NULL
        END
      ) AS resolved_subject,
      chat.sort_timestamp
    FROM
      chat
    LEFT JOIN
      jid ON chat.jid_row_id = jid._id
    LEFT JOIN
      jid_map ON jid_map.lid_row_id = jid._id
    LEFT JOIN
      jid AS jid_phone ON jid_phone._id = jid_map.jid_row_id
    LEFT JOIN
      lid_display_name ON lid_display_name.lid_row_id = jid._id
    ORDER BY chat.sort_timestamp DESC
    LIMIT ${limit}
  `;

  // Legacy fallback for older schemas without jid_map/lid_display_name.
  const legacyQuery = `
    SELECT
      chat._id,
      jid.user,
      chat.subject,
      chat.sort_timestamp
    FROM chat
    LEFT JOIN jid ON chat.jid_row_id = jid._id
    ORDER BY chat.sort_timestamp DESC
    LIMIT ${limit}
  `;

  try {
    let res = dbInstance.exec(mappedQuery);
    if (res.length === 0) {
      return [];
    }

    if (res.length > 0 && res[0].values) {
      return res[0].values.map((row: any[]) => ({
        _id: row[0],
        jid: row[1] || 'Unknown',
        subject: row[2],
        timestamp: row[3],
      }));
    }
    return [];
  } catch (mappedQueryError) {
    // If modern columns/tables are missing, use the previous compatible query.
    try {
      const res = dbInstance.exec(legacyQuery);
      if (res.length > 0 && res[0].values) {
        return res[0].values.map((row: any[]) => ({
          _id: row[0],
          jid: row[1] || 'Unknown',
          subject: row[2],
          timestamp: row[3],
        }));
      }
      return [];
    } catch (legacyQueryError) {
      console.error("Error fetching conversations:", mappedQueryError, legacyQueryError);
      throw new Error("Failed to query conversations. Database schema might be incompatible.");
    }
  }
};

export const getMessages = (chatRowId: number, limit: number = 5000): Message[] => {
  if (!dbInstance) return [];

  const query = `
    SELECT
      message._id,
      message.from_me,
      message.text_data,
      message.timestamp,
      message.message_type,
      (SELECT text_data FROM message_quoted WHERE message_quoted.message_row_id = message._id) AS quoted_text,
      message_media.media_name,
      message_media.file_path,
      message_media.mime_type
    FROM
      message
    LEFT JOIN
      message_media ON message_media.message_row_id = message._id
    WHERE
      message.chat_row_id = ${chatRowId}
    ORDER BY
      message.sort_id DESC
    LIMIT
      ${limit}
  `;

  try {
    const res = dbInstance.exec(query);
    if (res.length > 0 && res[0].values) {
      // Map and reverse so oldest is first (bottom-up chat style)
      return res[0].values
        .map((row: any[]) => {
          const text = toNonEmptyString(row[2]);
          const messageType = typeof row[4] === 'number' ? row[4] : null;
          const mediaName = toNonEmptyString(row[6]);
          const mediaPath = toNonEmptyString(row[7]);
          const rawMimeType = toNonEmptyString(row[8]);

          const resolvedFilePath = mediaPath;
          const resolvedFileName = mediaName || basenameFromPath(resolvedFilePath) || UNKNOWN_FILE_NAME;
          const resolvedMime = resolveMime(rawMimeType, resolvedFileName, resolvedFilePath);
          const mediaClassification = classifyMedia(
            resolvedMime,
            resolvedFileName,
            resolvedFilePath,
            messageType
          );

          const hasMediaMetadata = Boolean(mediaName || mediaPath || rawMimeType);
          const hasKnownMediaMessageType = messageType === 1 || messageType === 2 || messageType === 3;
          const hasMedia = hasMediaMetadata || hasKnownMediaMessageType;

          return {
            _id: row[0],
            from_me: row[1] === 1,
            text_data: text,
            timestamp: new Date(row[3]), // WA usually stores ms timestamps in newer DBs
            quoted_text: toNonEmptyString(row[5]),
            has_media: hasMedia,
            media_file_name: hasMedia ? resolvedFileName : null,
            media_file_path: hasMedia ? resolvedFilePath : null,
            media_mime: hasMedia ? mediaClassification.media_mime : null,
            media_kind: hasMedia ? mediaClassification.media_kind : null,
            media_type_label: hasMedia ? mediaClassification.media_type_label : null,
            media_type: hasMedia ? mediaClassification.media_mime : null,
          };
        })
        .reverse();
    }
    return [];
  } catch (e) {
    console.error("Error fetching messages:", e);
    return [];
  }
};

export const getDbInstance = () => dbInstance;
