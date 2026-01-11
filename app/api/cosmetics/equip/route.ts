import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { equipCosmetic } from '@/lib/cosmetics';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) { // Assuming decoded has a userId property
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await request.json();
        const { cosmeticId } = body;

        if (!cosmeticId || typeof cosmeticId !== 'number') {
            return NextResponse.json(
                { error: 'Invalid cosmetic ID' },
                { status: 400 }
            );
        }

        const result = equipCosmetic(decoded.userId, cosmeticId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({ message: result.message });
    } catch (error: any) {
        console.error('Error equipping cosmetic:', error);
        return NextResponse.json(
            { error: 'Failed to equip cosmetic' },
            { status: 500 }
        );
    }
}
