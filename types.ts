export interface Conversation {
  _id: number;
  jid: string;
  subject: string | null;
  timestamp: number;
  messageCount?: number;
}

export interface Message {
  _id: number;
  from_me: boolean;
  text_data: string | null;
  timestamp: Date;
  quoted_text: string | null;
  has_media: boolean;
  media_type?: string;
}

export interface DbStats {
  chatCount: number;
  messageCount: number;
}
