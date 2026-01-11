import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserDashboard } from '@/lib/challenges';
import { formatDateSerbia } from '@/lib/timezone';
import { runDailyRollupForUser } from '@/lib/streak-core';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;

    // Apply once-per-day rollup so missed-day penalties and streak reset happen at midnight.
    runDailyRollupForUser(userId);
    const dashboard = getUserDashboard(userId);

    // Get user username, profile picture, coins, crew info, and equipped cosmetics
    const user = db.prepare(`
      SELECT 
        u.username, 
        u.profile_picture, 
        COALESCE(u.trophies, 0) as trophies,
        COALESCE(u.coins, 0) as coins,
        u.last_daily_claim,
        u.crew_id,
        c.name as crew_name,
        c.tag as crew_tag,
        COALESCE(c.tag_color, '#0ea5e9') as crew_tag_color,
        af.data as equipped_avatar_frame_data,
        nc.data as equipped_name_color_data,
        cb.data as equipped_badge_data
      FROM users u
      LEFT JOIN crews c ON u.crew_id = c.id
      LEFT JOIN user_equipped_cosmetics uec_frame 
        ON u.id = uec_frame.user_id AND uec_frame.cosmetic_type = 'avatar_frame'
      LEFT JOIN cosmetics af ON uec_frame.cosmetic_id = af.id
      LEFT JOIN user_equipped_cosmetics uec_name 
        ON u.id = uec_name.user_id AND uec_name.cosmetic_type = 'name_color'
      LEFT JOIN cosmetics nc ON uec_name.cosmetic_id = nc.id
      LEFT JOIN user_equipped_cosmetics uec_badge
        ON u.id = uec_badge.user_id AND uec_badge.cosmetic_type = 'chat_badge'
      LEFT JOIN cosmetics cb ON uec_badge.cosmetic_id = cb.id
      WHERE u.id = ?
    `).get(userId) as any;

    // Parse cosmetics JSON data
    const equippedCosmetics = {
      avatar_frame: user?.equipped_avatar_frame_data ? JSON.parse(user.equipped_avatar_frame_data) : null,
      name_color: user?.equipped_name_color_data ? JSON.parse(user.equipped_name_color_data) : null,
      chat_badge: user?.equipped_badge_data ? JSON.parse(user.equipped_badge_data) : null
    };

    // Ensure rest_days_available is always present (default to 3 if missing)
    const restDaysAvailable = dashboard.challenge.rest_days_available ?? 3;
    const challenge = {
      ...dashboard.challenge,
      rest_days_available: typeof restDaysAvailable === 'number' ? restDaysAvailable : 3,
    };

    const today = formatDateSerbia();
    const canClaimDaily = user?.last_daily_claim !== today;

    return NextResponse.json({
      ...dashboard,
      challenge,
      userId,
      server_serbia_today: today,
      username: user?.username,
      profilePicture: user?.profile_picture || null,
      trophies: user?.trophies ?? 0,
      coins: user?.coins ?? 0,
      canClaimDaily,
      crew_id: user?.crew_id || null,
      crew_name: user?.crew_name || null,
      crew_tag: user?.crew_tag || null,
      crew_tag_color: user?.crew_tag_color || '#0ea5e9',
      equippedCosmetics,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    return NextResponse.json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
  }
}

