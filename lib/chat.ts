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
  equipped_name_color_data: any | null;
  equipped_badge_data: any | null;
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
          u.profile_picture,
          nc.data as equipped_name_color_data,
          cb.data as equipped_badge_data
         FROM chat_messages cm
         JOIN users u ON cm.user_id = u.id
         LEFT JOIN user_equipped_cosmetics uec_name 
           ON u.id = uec_name.user_id AND uec_name.cosmetic_type = 'name_color'
         LEFT JOIN cosmetics nc ON uec_name.cosmetic_id = nc.id
         LEFT JOIN user_equipped_cosmetics uec_badge
           ON u.id = uec_badge.user_id AND uec_badge.cosmetic_type = 'chat_badge'
         LEFT JOIN cosmetics cb ON uec_badge.cosmetic_id = cb.id
         WHERE cm.created_at >= ?
         ORDER BY cm.created_at ASC
         LIMIT ?`
      )
      .all(cutoffTime, limit) as any[];

    // Parse JSON data fields
    return messages.map(msg => ({
      ...msg,
      equipped_name_color_data: msg.equipped_name_color_data ? JSON.parse(msg.equipped_name_color_data) : null,
      equipped_badge_data: msg.equipped_badge_data ? JSON.parse(msg.equipped_badge_data) : null
    }));
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

    // Return the newly created message with profile picture and cosmetics
    const newMessage = db
      .prepare(
        `SELECT 
          cm.id,
          cm.user_id,
          cm.username,
          cm.message,
          cm.created_at,
          u.profile_picture,
          nc.data as equipped_name_color_data,
          cb.data as equipped_badge_data
         FROM chat_messages cm
         JOIN users u ON cm.user_id = u.id
         LEFT JOIN user_equipped_cosmetics uec_name 
           ON u.id = uec_name.user_id AND uec_name.cosmetic_type = 'name_color'
         LEFT JOIN cosmetics nc ON uec_name.cosmetic_id = nc.id
         LEFT JOIN user_equipped_cosmetics uec_badge
           ON u.id = uec_badge.user_id AND uec_badge.cosmetic_type = 'chat_badge'
         LEFT JOIN cosmetics cb ON uec_badge.cosmetic_id = cb.id
         WHERE cm.id = ?`
      )
      .get(result.lastInsertRowid) as any;

    // Parse JSON data fields
    return {
      ...newMessage,
      equipped_name_color_data: newMessage.equipped_name_color_data ? JSON.parse(newMessage.equipped_name_color_data) : null,
      equipped_badge_data: newMessage.equipped_badge_data ? JSON.parse(newMessage.equipped_badge_data) : null
    };
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}
