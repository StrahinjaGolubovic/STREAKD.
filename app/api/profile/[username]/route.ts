import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: usernameParam } = await params;
    const username = decodeURIComponent(usernameParam);
    
    // Get user by username with crew info
    // Also check crew_members table in case crew_id is NULL (for old crews)
    const user = db.prepare(`
      SELECT 
        u.id,
        u.username,
        COALESCE(u.trophies, 0) as trophies,
        u.profile_picture,
        u.profile_private,
        COALESCE(u.crew_id, cm.crew_id) as crew_id,
        c.name as crew_name,
        c.tag as crew_tag,
        COALESCE(c.tag_color, '#0ea5e9') as crew_tag_color,
        u.created_at
      FROM users u
      LEFT JOIN crew_members cm ON u.id = cm.user_id
      LEFT JOIN crews c ON COALESCE(u.crew_id, cm.crew_id) = c.id
      WHERE u.username = ?
    `).get(username) as {
      id: number;
      username: string;
      trophies: number;
      profile_picture: string | null;
      profile_private: number | null;
      crew_id: number | null;
      crew_name: string | null;
      crew_tag: string | null;
      crew_tag_color: string;
      created_at: string;
    } | undefined;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if current user is viewing their own profile
    let isOwnProfile = false;
    let currentUserId: number | null = null;
    try {
      const token = request.cookies.get('token')?.value;
      if (token) {
        const decoded = verifyToken(token);
        if (decoded && decoded.userId === user.id) {
          isOwnProfile = true;
          currentUserId = decoded.userId;
        } else if (decoded) {
          currentUserId = decoded.userId;
        }
      }
    } catch {
      // Not logged in or invalid token
    }

    // Check privacy - if profile is private and user is not viewing their own profile, return 403 with user-friendly message
    if (user.profile_private && !isOwnProfile) {
      return NextResponse.json({ 
        error: 'This user has privated their account',
        isPrivate: true 
      }, { status: 403 });
    }

    // Get streak data
    const streak = db.prepare(`
      SELECT 
        current_streak,
        longest_streak
      FROM streaks 
      WHERE user_id = ?
    `).get(user.id) as {
      current_streak: number;
      longest_streak: number;
    } | undefined;

    // Get upload stats
    const uploadStats = db.prepare(`
      SELECT 
        COUNT(*) as total_uploads,
        SUM(CASE WHEN verification_status = 'approved' THEN 1 ELSE 0 END) as approved_uploads,
        SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) as rejected_uploads,
        SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) as pending_uploads
      FROM daily_uploads 
      WHERE user_id = ?
    `).get(user.id) as {
      total_uploads: number;
      approved_uploads: number;
      rejected_uploads: number;
      pending_uploads: number;
    } | undefined;

    // Get recent uploads (last 7 approved)
    const recentUploads = db.prepare(`
      SELECT 
        id,
        upload_date,
        photo_path,
        verification_status,
        created_at
      FROM daily_uploads 
      WHERE user_id = ? AND verification_status = 'approved'
      ORDER BY upload_date DESC
      LIMIT 7
    `).all(user.id) as Array<{
      id: number;
      upload_date: string;
      photo_path: string;
      verification_status: string;
      created_at: string;
    }>;


    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        trophies: user.trophies,
        profile_picture: user.profile_picture,
        profile_private: user.profile_private ? true : false,
        crew: user.crew_name ? { 
          id: user.crew_id, 
          name: user.crew_name,
          tag: user.crew_tag,
          tag_color: user.crew_tag_color || '#0ea5e9',
        } : null,
        created_at: user.created_at,
      },
      streak: {
        current_streak: streak?.current_streak ?? 0,
        longest_streak: streak?.longest_streak ?? 0,
      },
      stats: {
        total_uploads: uploadStats?.total_uploads ?? 0,
        approved_uploads: uploadStats?.approved_uploads ?? 0,
        rejected_uploads: uploadStats?.rejected_uploads ?? 0,
        pending_uploads: uploadStats?.pending_uploads ?? 0,
      },
      recent_uploads: recentUploads,
      is_own_profile: isOwnProfile,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

