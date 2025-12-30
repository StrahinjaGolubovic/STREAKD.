import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { formatDateTimeSerbia } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    // Ensure user_activity table exists
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_activity (
          user_id INTEGER PRIMARY KEY,
          last_seen DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
    } catch (error) {
      // Table might already exist
    }

    // Calculate cutoff time (5 minutes ago to match admin panel)
    const now = Date.now();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
    const cutoffTime = formatDateTimeSerbia(fiveMinutesAgo);
    
    // Count users who have sent a heartbeat in the last 5 minutes
    // Using string comparison works because format is YYYY-MM-DD HH:MM:SS
    const onlineUsers = db
      .prepare(
        `SELECT COUNT(*) as count 
         FROM user_activity 
         WHERE last_seen >= ?`
      )
      .get(cutoffTime) as { count: number };

    return NextResponse.json({ onlineUsers: onlineUsers.count });
  } catch (error) {
    console.error('Online users error:', error);
    return NextResponse.json({ onlineUsers: 0 });
  }
}

