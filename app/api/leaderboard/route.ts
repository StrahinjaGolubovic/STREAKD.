import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

    // Get top users by trophies, excluding private profiles and admin users
    // Join with crews to get crew name for badge display
    // Also check crew_members table in case crew_id is NULL (for old crews)
    const ADMIN_USERNAMES = ['admin', 'seuq', 'jakow', 'nikola'];
    const placeholders = ADMIN_USERNAMES.map(() => '?').join(',');
    const leaderboard = db
      .prepare(`
        SELECT 
          u.id,
          u.username,
          u.trophies,
          u.profile_picture,
          u.profile_private,
          COALESCE(u.crew_id, cm.crew_id) as crew_id,
          c.name as crew_name,
          c.tag as crew_tag,
          COALESCE(c.tag_color, '#0ea5e9') as crew_tag_color,
          s.current_streak,
          s.longest_streak
        FROM users u
        LEFT JOIN crew_members cm ON u.id = cm.user_id
        LEFT JOIN crews c ON COALESCE(u.crew_id, cm.crew_id) = c.id
        LEFT JOIN streaks s ON u.id = s.user_id
        WHERE (u.profile_private = 0 OR u.profile_private IS NULL)
          AND u.username NOT IN (${placeholders})
        ORDER BY u.trophies DESC, u.id ASC
        LIMIT ? OFFSET ?
      `)
      .all(...ADMIN_USERNAMES, limit, offset) as Array<{
        id: number;
        username: string;
        trophies: number;
        profile_picture: string | null;
        profile_private: number | null;
        crew_id: number | null;
        crew_name: string | null;
        crew_tag: string | null;
        crew_tag_color: string;
        current_streak: number | null;
        longest_streak: number | null;
      }>;

    // Get total count for pagination (excluding admin users)
    const totalCount = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM users
        WHERE (profile_private = 0 OR profile_private IS NULL)
          AND username NOT IN (${placeholders})
      `)
      .get(...ADMIN_USERNAMES) as { count: number };

    return NextResponse.json({
      leaderboard: leaderboard.map((user, index) => ({
        rank: offset + index + 1,
        id: user.id,
        username: user.username,
        trophies: user.trophies || 0,
        profile_picture: user.profile_picture,
        crew: user.crew_name ? { 
          id: user.crew_id, 
          name: user.crew_name,
          tag: user.crew_tag,
          tag_color: user.crew_tag_color || '#0ea5e9',
        } : null,
        current_streak: user.current_streak || 0,
        longest_streak: user.longest_streak || 0,
      })),
      total: totalCount.count,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

