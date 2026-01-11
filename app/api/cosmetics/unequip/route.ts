import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { unequipCosmetic } from '@/lib/cosmetics';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await request.json();
        const { cosmeticType } = body;

        if (!cosmeticType || typeof cosmeticType !== 'string') {
            return NextResponse.json(
                { error: 'Invalid cosmetic type' },
                { status: 400 }
            );
        }

        const validTypes = ['avatar_frame', 'name_color', 'chat_badge'];
        if (!validTypes.includes(cosmeticType)) {
            return NextResponse.json(
                { error: 'Invalid cosmetic type' },
                { status: 400 }
            );
        }

        const result = unequipCosmetic(decoded.userId, cosmeticType);

        if (!result.success) {
            return NextResponse.json(
                { error: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({ message: result.message });
    } catch (error: any) {
        console.error('Error unequipping cosmetic:', error);
        return NextResponse.json(
            { error: 'Failed to unequip cosmetic' },
            { status: 500 }
        );
    }
}
