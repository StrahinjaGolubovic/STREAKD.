import { NextRequest, NextResponse } from 'next/server';
import { getAchievementStats } from '@/lib/achievements';

export async function GET(request: NextRequest) {
    try {
        const stats = getAchievementStats();
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching achievement stats:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
