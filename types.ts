export interface Conversation {
  _id: number;
  jid: string;
  subject: string | null;
  timestamp: number;
  messageCount?: number;
}

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'unknown';

export interface Message {
  _id: number;
  from_me: boolean;
  text_data: string | null;
  timestamp: Date;
  quoted_text: string | null;
  has_media: boolean;
  media_file_name?: string | null;
  media_file_path?: string | null;
  media_mime?: string | null;
  media_kind?: MediaKind | null;
  media_type_label?: string | null;
  media_type?: string | null; // Backward compatibility with previous field name
}

export interface DbStats {
  chatCount: number;
  messageCount: number;
}
