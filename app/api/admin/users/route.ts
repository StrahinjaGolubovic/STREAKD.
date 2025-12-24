import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    const adminCheck = await checkAdmin(token);
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const users = db
      .prepare(
        `SELECT 
          u.id,
          u.username,
          COALESCE(u.trophies, 0) as trophies,
          u.created_at,
          u.profile_picture,
          COALESCE(s.current_streak, 0) as current_streak,
          COALESCE(s.longest_streak, 0) as longest_streak,
          s.last_activity_date as last_activity_date,
          (SELECT COUNT(*) FROM daily_uploads WHERE user_id = u.id) as total_uploads,
          (SELECT COUNT(*) FROM daily_uploads WHERE user_id = u.id AND verification_status = 'approved') as approved_uploads
         FROM users u
         LEFT JOIN streaks s ON u.id = s.user_id
         ORDER BY u.username ASC`
      )
      .all();

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

