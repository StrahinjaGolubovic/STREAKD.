import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { revokePremium } from '@/lib/premium';
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

        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // Revoke premium from user
        const success = revokePremium(userId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to revoke premium' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Premium revoked successfully'
        });
    } catch (error) {
        console.error('Error revoking premium:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
