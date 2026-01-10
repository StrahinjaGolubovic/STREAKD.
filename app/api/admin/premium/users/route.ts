import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getPremiumUsers } from '@/lib/premium';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        console.log('[PREMIUM API] Starting request...');
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            console.log('[PREMIUM API] No token found');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            console.log('[PREMIUM API] Invalid token');
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        console.log('[PREMIUM API] User authenticated:', decoded.userId);

        // Check if user is admin
        const admin = db.prepare('SELECT COALESCE(is_admin, 0) as is_admin FROM users WHERE id = ?').get(decoded.userId) as { is_admin: number } | undefined;
        console.log('[PREMIUM API] Admin check result:', admin);

        if (!admin || admin.is_admin !== 1) {
            console.log('[PREMIUM API] User is not admin');
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
        }

        console.log('[PREMIUM API] Fetching users...');
        // Get all users with search
        const searchQuery = request.nextUrl.searchParams.get('search');

        let users;
        try {
            if (searchQuery) {
                users = db.prepare(`
                    SELECT id, username, COALESCE(is_premium, 0) as is_premium, 
                           premium_granted_at, username_color, created_at
                    FROM users
                    WHERE username LIKE ?
                    ORDER BY username ASC
                    LIMIT 50
                `).all(`%${searchQuery}%`);
            } else {
                users = db.prepare(`
                    SELECT id, username, COALESCE(is_premium, 0) as is_premium, 
                           premium_granted_at, username_color, created_at
                    FROM users
                    ORDER BY id DESC
                    LIMIT 50
                `).all();
            }
            console.log('[PREMIUM API] Users fetched:', users.length);
        } catch (usersError) {
            console.error('[PREMIUM API] Error fetching users:', usersError);
            throw usersError;
        }

        // Get premium users
        console.log('[PREMIUM API] Fetching premium users...');
        let premiumUsers;
        try {
            premiumUsers = getPremiumUsers();
            console.log('[PREMIUM API] Premium users fetched:', premiumUsers.length);
        } catch (premiumError) {
            console.error('[PREMIUM API] Error fetching premium users:', premiumError);
            throw premiumError;
        }

        console.log('[PREMIUM API] Returning response');
        return NextResponse.json({
            users,
            premiumUsers
        });
    } catch (error: any) {
        console.error('[PREMIUM API] Fatal error:', error);
        // Return detailed error for debugging on Railway
        return NextResponse.json({
            error: 'Internal server error',
            details: error?.message || String(error),
            stack: error?.stack
        }, { status: 500 });
    }
}
