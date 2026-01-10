import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserAchievements } from '@/lib/achievements';
import { cookies } from 'next/headers';

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

        const userId = decoded.userId;
        const achievements = getUserAchievements(userId);

        return NextResponse.json({ achievements });
    } catch (error) {
        console.error('Error fetching achievements:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
