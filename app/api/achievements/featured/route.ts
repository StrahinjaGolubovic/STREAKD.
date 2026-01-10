import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { setFeaturedBadges } from '@/lib/achievements';
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

        const userId = decoded.userId;
        const { achievementIds } = await request.json();

        if (!Array.isArray(achievementIds)) {
            return NextResponse.json({ error: 'Invalid achievement IDs' }, { status: 400 });
        }

        // Limit to 3 badges
        if (achievementIds.length > 3) {
            return NextResponse.json({ error: 'Maximum 3 featured badges allowed' }, { status: 400 });
        }

        const success = setFeaturedBadges(userId, achievementIds);

        if (!success) {
            return NextResponse.json({ error: 'Failed to set featured badges' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error setting featured badges:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
