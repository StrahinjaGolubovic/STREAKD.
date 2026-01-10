import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getPremiumUsers } from '@/lib/premium';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Check if user is admin
        const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(decoded.userId) as { is_admin: number } | undefined;
        if (!admin || admin.is_admin !== 1) {
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
        }

        // Get all users with search
        const searchQuery = request.nextUrl.searchParams.get('search');

        let users;
        if (searchQuery) {
            users = db.prepare(`
                SELECT id, username, is_premium, premium_granted_at, username_color, created_at
                FROM users
                WHERE username LIKE ?
                ORDER BY username ASC
                LIMIT 50
            `).all(`%${searchQuery}%`);
        } else {
            users = db.prepare(`
                SELECT id, username, is_premium, premium_granted_at, username_color, created_at
                FROM users
                ORDER BY id DESC
                LIMIT 50
            `).all();
        }

        // Get premium users
        const premiumUsers = getPremiumUsers();

        return NextResponse.json({
            users,
            premiumUsers
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
