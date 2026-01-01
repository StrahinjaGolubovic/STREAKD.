import db from './db';
import { formatDateTimeSerbia } from './timezone';

export interface ChatMessage {
  id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: string;
}

// Clean up messages from previous days (resets at midnight 00:00 Serbia time)
export function cleanupOldMessages(): void {
  try {
    // Delete messages from before today (midnight 00:00 Serbia time)
    const { formatDateSerbia } = require('./timezone');
    const todayDate = formatDateSerbia(); // YYYY-MM-DD in Serbia timezone
    const cutoffTime = `${todayDate} 00:00:00`; // Today at midnight
    
    const result = db
      .prepare(
        `DELETE FROM chat_messages 
         WHERE created_at < ?`
      )
      .run(cutoffTime);
    
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} old chat messages`);
    }
  } catch (error) {
    console.error('Error cleaning up old messages:', error);
  }
}

export interface ChatMessageWithProfile extends ChatMessage {
  profile_picture: string | null;
}

// Get recent messages (from today since midnight 00:00, limit 100)
export function getRecentMessages(limit: number = 100): ChatMessageWithProfile[] {
  // Clean up old messages first
  cleanupOldMessages();
  
  try {
    // Get messages from today (since midnight 00:00 Serbia time)
    const { formatDateSerbia } = require('./timezone');
    const todayDate = formatDateSerbia(); // YYYY-MM-DD in Serbia timezone
    const cutoffTime = `${todayDate} 00:00:00`; // Today at midnight
    
    const messages = db
      .prepare(
        `SELECT 
          cm.id,
          cm.user_id,
          cm.username,
          cm.message,
          cm.created_at,
          u.profile_picture
         FROM chat_messages cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.created_at >= ?
         ORDER BY cm.created_at ASC
         LIMIT ?`
      )
      .all(cutoffTime, limit) as ChatMessageWithProfile[];
    
    return messages;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

// Add a new message
export function addMessage(userId: number, username: string, message: string): ChatMessageWithProfile | null {
  try {
    // Clean up old messages before adding new one
    cleanupOldMessages();
    
    if (!message || message.trim().length === 0) {
      return null;
    }

    if (message.length > 500) {
      return null;
    }
    
    // Server controls timestamp - always use Serbia timezone
    const timeString = formatDateTimeSerbia();
    
    const result = db
      .prepare(
        `INSERT INTO chat_messages (user_id, username, message, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(userId, username, message, timeString);
    
    // Return the newly created message with profile picture
    const newMessage = db
      .prepare(
        `SELECT 
          cm.id,
          cm.user_id,
          cm.username,
          cm.message,
          cm.created_at,
          u.profile_picture
         FROM chat_messages cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.id = ?`
      )
      .get(result.lastInsertRowid) as ChatMessageWithProfile;
    
    return newMessage;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

