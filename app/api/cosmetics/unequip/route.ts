import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { unequipCosmetic } from '@/lib/cosmetics';

export async function POST(request: Request) {
    try {
        const authResult = await verifyAuth(request);
        if (!authResult.valid || !authResult.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        const result = unequipCosmetic(authResult.userId, cosmeticType);

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
