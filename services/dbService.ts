import { Conversation, Message } from '../types';

declare global {
  interface Window {
    initSqlJs: (config: any) => Promise<any>;
  }
}

let dbInstance: any = null;

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

  // Note: Schema compatibility can vary by WA version. 
  // This query attempts to fetch standard fields.
  const query = `
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
    const res = dbInstance.exec(query);
    if (res.length > 0 && res[0].values) {
      return res[0].values.map((row: any[]) => ({
        _id: row[0],
        jid: row[1] || 'Unknown',
        subject: row[2],
        timestamp: row[3],
      }));
    }
    return [];
  } catch (e) {
    console.error("Error fetching conversations:", e);
    throw new Error("Failed to query conversations. Database schema might be incompatible.");
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
      (SELECT text_data FROM message_quoted WHERE message_quoted.message_row_id = message._id) AS quoted_text
    FROM
      message
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
        .map((row: any[]) => ({
          _id: row[0],
          from_me: row[1] === 1,
          text_data: row[2],
          timestamp: new Date(row[3]), // WA usually stores ms timestamps in newer DBs
          quoted_text: row[4],
          has_media: row[2] === null, // Rudimentary check: if no text, likely media
        }))
        .reverse();
    }
    return [];
  } catch (e) {
    console.error("Error fetching messages:", e);
    return [];
  }
};

export const getDbInstance = () => dbInstance;
