import db from './db';
import { getUserStreak } from './challenges';

export interface InviteCode {
  id: number;
  user_id: number;
  code: string;
  created_at: string;
}

export interface Friend {
  id: number;
  user_id: number;
  friend_id: number;
  created_at: string;
}

export interface FriendInfo {
  id: number;
  username: string;
  trophies: number;
  current_streak: number;
  longest_streak: number;
  profile_picture: string | null;
  created_at: string;
}

// Generate a unique invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get or create invite code for user
export function getOrCreateInviteCode(userId: number): InviteCode {
  // Check if user already has an invite code
  let inviteCode = db
    .prepare('SELECT * FROM invite_codes WHERE user_id = ?')
    .get(userId) as InviteCode | undefined;

  if (!inviteCode) {
    // Generate a unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateInviteCode();
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique invite code');
      }
    } while (db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code));

    // Create invite code
    const result = db
      .prepare('INSERT INTO invite_codes (user_id, code) VALUES (?, ?)')
      .run(userId, code);

    inviteCode = db
      .prepare('SELECT * FROM invite_codes WHERE id = ?')
      .get(result.lastInsertRowid) as InviteCode;
  }

  return inviteCode;
}

// Accept an invite code
export function acceptInviteCode(userId: number, code: string): { success: boolean; message: string } {
  // Find the invite code
  const inviteCode = db
    .prepare('SELECT * FROM invite_codes WHERE code = ?')
    .get(code) as InviteCode | undefined;

  if (!inviteCode) {
    return { success: false, message: 'Invalid invite code' };
  }

  // Can't add yourself
  if (inviteCode.user_id === userId) {
    return { success: false, message: 'You cannot add yourself as a friend' };
  }

  // Check if already friends
  const existingFriendship = db
    .prepare('SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
    .get(userId, inviteCode.user_id, inviteCode.user_id, userId) as Friend | undefined;

  if (existingFriendship) {
    return { success: false, message: 'You are already friends with this user' };
  }

  // Create bidirectional friendship
  db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)').run(userId, inviteCode.user_id);
  db.prepare('INSERT INTO friends (user_id, friend_id) VALUES (?, ?)').run(inviteCode.user_id, userId);

  return { success: true, message: 'Friend added successfully' };
}

// Get all friends for a user
export function getUserFriends(userId: number): FriendInfo[] {
  const friends = db
    .prepare(
      `
    SELECT 
      u.id,
      u.username,
      COALESCE(u.trophies, 0) as trophies,
      u.profile_picture,
      u.created_at,
      COALESCE(s.current_streak, 0) as current_streak,
      COALESCE(s.longest_streak, 0) as longest_streak
    FROM friends f
    JOIN users u ON f.friend_id = u.id
    LEFT JOIN streaks s ON u.id = s.user_id
    WHERE f.user_id = ?
    ORDER BY u.username
  `
    )
    .all(userId) as Array<FriendInfo & { trophies: number; current_streak: number; longest_streak: number; profile_picture: string | null }>;

  return friends.map((f) => ({
    id: f.id,
    username: f.username,
    trophies: f.trophies,
    current_streak: f.current_streak,
    longest_streak: f.longest_streak,
    profile_picture: f.profile_picture,
    created_at: f.created_at,
  }));
}

// Get friend's detailed stats
export function getFriendStats(friendId: number, userId: number): FriendInfo | null {
  // Verify friendship exists
  const friendship = db
    .prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ?')
    .get(userId, friendId) as Friend | undefined;

  if (!friendship) {
    return null;
  }

  const friend = db
    .prepare('SELECT id, username, COALESCE(trophies, 0) as trophies, profile_picture, created_at FROM users WHERE id = ?')
    .get(friendId) as { id: number; username: string; trophies: number; profile_picture: string | null; created_at: string } | undefined;

  if (!friend) {
    return null;
  }

  const streak = getUserStreak(friendId);

  return {
    id: friend.id,
    username: friend.username,
    trophies: friend.trophies,
    current_streak: streak.current_streak,
    longest_streak: streak.longest_streak,
    profile_picture: friend.profile_picture,
    created_at: friend.created_at,
  };
}

// Remove a friend
export function removeFriend(userId: number, friendId: number): boolean {
  // Remove bidirectional friendship
  const result1 = db
    .prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?')
    .run(userId, friendId);
  const result2 = db
    .prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?')
    .run(friendId, userId);

  return result1.changes > 0 || result2.changes > 0;
}

