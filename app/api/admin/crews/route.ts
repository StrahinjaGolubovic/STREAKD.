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

    const crews = db
      .prepare(`
        SELECT 
          c.id,
          c.name,
          c.tag,
          c.tag_color,
          u.username as leader_username,
          COUNT(cm.user_id) as member_count,
          AVG(COALESCE(s.current_streak, 0)) as average_streak,
          AVG(COALESCE(u2.trophies, 0)) as average_trophies
        FROM crews c
        LEFT JOIN users u ON c.leader_id = u.id
        LEFT JOIN crew_members cm ON c.id = cm.crew_id
        LEFT JOIN users u2 ON cm.user_id = u2.id
        LEFT JOIN streaks s ON cm.user_id = s.user_id
        GROUP BY c.id
        ORDER BY member_count DESC, c.name ASC
      `)
      .all() as Array<{
      id: number;
      name: string;
      tag: string | null;
      tag_color: string;
      leader_username: string;
      member_count: number;
      average_streak: number;
      average_trophies: number;
    }>;

    return NextResponse.json({
      crews: crews.map((crew) => ({
        id: crew.id,
        name: crew.name,
        tag: crew.tag,
        tag_color: crew.tag_color || '#0ea5e9',
        leader_username: crew.leader_username || 'Unknown',
        member_count: Number(crew.member_count) || 0,
        average_streak: Math.round(Number(crew.average_streak) || 0),
        average_trophies: Math.round(Number(crew.average_trophies) || 0),
      })),
    });
  } catch (error: any) {
    console.error('Admin crews error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crews' },
      { status: 500 }
    );
  }
}

