import db from './db';
import { formatDateTimeSerbia } from './timezone';

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  related_user_id?: number | null;
  related_crew_id?: number | null;
  read: boolean;
  created_at: string;
}

// Create a notification
export function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  relatedUserId?: number,
  relatedCrewId?: number
): Notification {
  const now = formatDateTimeSerbia();

  const result = db
    .prepare(
      `INSERT INTO notifications (user_id, type, title, message, related_user_id, related_crew_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(userId, type, title, message, relatedUserId || null, relatedCrewId || null, now);

  return db
    .prepare('SELECT * FROM notifications WHERE id = ?')
    .get(result.lastInsertRowid) as Notification;
}

// Get user notifications
export function getUserNotifications(userId: number, limit: number = 50): Notification[] {
  try {
    return db
      .prepare(
        `SELECT * FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(userId, limit) as Notification[];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

// Get unread notification count
export function getUnreadNotificationCount(userId: number): number {
  try {
    const result = db
      .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0')
      .get(userId) as { count: number };
    return result.count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

// Mark notification as read
export function markNotificationAsRead(notificationId: number, userId: number): boolean {
  try {
    const result = db
      .prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
      .run(notificationId, userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

// Mark all notifications as read
export function markAllNotificationsAsRead(userId: number): boolean {
  try {
    const result = db
      .prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0')
      .run(userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}

// Delete all notifications for a user (clear inbox)
export function clearAllNotifications(userId: number): boolean {
  try {
    const result = db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    // result.changes can be 0 if already empty; still a "success"
    return typeof result.changes === 'number';
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return false;
  }
}

// Send nudge notification to a friend
export function sendNudgeNotification(fromUserId: number, fromUsername: string, toUserId: number): Notification {
  return createNotification(
    toUserId,
    'nudge',
    'You got a nudge!',
    `@${fromUsername} nudged you!`,
    fromUserId
  );
}

