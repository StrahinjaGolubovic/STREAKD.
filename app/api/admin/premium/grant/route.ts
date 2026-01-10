import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { grantPremium } from '@/lib/premium';
import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
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

        const { userId, usernameColor } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // Grant premium to user
        const success = grantPremium(userId, decoded.userId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to grant premium' }, { status: 500 });
        }

        // Set custom username color if provided
        if (usernameColor) {
            db.prepare('UPDATE users SET username_color = ? WHERE id = ?').run(usernameColor, userId);
        }

        return NextResponse.json({
            success: true,
            message: 'Premium granted successfully'
        });
    } catch (error) {
        console.error('Error granting premium:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
