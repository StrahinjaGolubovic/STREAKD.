import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import db from '@/lib/db';
import { cookies } from 'next/headers';

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

        const { achievementId } = await request.json();

        if (!achievementId) {
            return NextResponse.json({ error: 'Achievement ID required' }, { status: 400 });
        }

        // Mark achievement as notified
        db.prepare(`
            UPDATE user_achievements 
            SET notified = 1 
            WHERE user_id = ? AND achievement_id = ?
        `).run(decoded.userId, achievementId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking achievement as notified:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
