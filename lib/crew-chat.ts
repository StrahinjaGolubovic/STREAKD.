import db from './db';
import { formatDateTimeSerbia } from './timezone';

export interface CrewChatMessage {
  id: number;
  crew_id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: string;
  profile_picture?: string | null;
}

// Clean up crew chat messages older than 48 hours
export function cleanupOldCrewMessages(): void {
  try {
    // Delete messages older than 48 hours (using Serbia timezone)
    const nowDate = new Date();
    const fortyEightHoursAgo = new Date(nowDate.getTime() - 48 * 60 * 60 * 1000);
    const cutoffTime = formatDateTimeSerbia(fortyEightHoursAgo);
    
    const result = db
      .prepare(
        `DELETE FROM crew_chat_messages 
         WHERE created_at < ?`
      )
      .run(cutoffTime);
    
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} old crew chat messages`);
    }
  } catch (error) {
    console.error('Error cleaning up old crew messages:', error);
  }
}

// Get recent crew chat messages (last 48 hours)
export function getCrewChatMessages(crewId: number, limit: number = 100): CrewChatMessage[] {
  // Clean up old messages first
  cleanupOldCrewMessages();
  
  try {
    // Calculate 48 hours ago in Serbia timezone
    const nowDate = new Date();
    const fortyEightHoursAgo = new Date(nowDate.getTime() - 48 * 60 * 60 * 1000);
    const cutoffTime = formatDateTimeSerbia(fortyEightHoursAgo);
    
    const messages = db
      .prepare(
        `SELECT 
          ccm.id,
          ccm.crew_id,
          ccm.user_id,
          ccm.username,
          ccm.message,
          ccm.created_at,
          u.profile_picture
        FROM crew_chat_messages ccm
        JOIN users u ON ccm.user_id = u.id
        WHERE ccm.crew_id = ? AND ccm.created_at >= ?
        ORDER BY ccm.created_at DESC
        LIMIT ?`
      )
      .all(crewId, cutoffTime, limit) as CrewChatMessage[];

    return messages.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Error fetching crew chat messages:', error);
    return [];
  }
}

// Add a new crew chat message
export function addCrewChatMessage(
  crewId: number,
  userId: number,
  username: string,
  message: string
): CrewChatMessage | null {
  try {
    // Clean up old messages before adding new one
    cleanupOldCrewMessages();
    
    // Validate message length
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
        `INSERT INTO crew_chat_messages (crew_id, user_id, username, message, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(crewId, userId, username, message, timeString);

    // Return the newly created message with profile picture
    const newMessage = db
      .prepare(
        `SELECT 
          ccm.id,
          ccm.crew_id,
          ccm.user_id,
          ccm.username,
          ccm.message,
          ccm.created_at,
          u.profile_picture
         FROM crew_chat_messages ccm
         JOIN users u ON ccm.user_id = u.id
         WHERE ccm.id = ?`
      )
      .get(result.lastInsertRowid) as CrewChatMessage;

    return newMessage;
  } catch (error) {
    console.error('Error adding crew chat message:', error);
    throw error;
  }
}

