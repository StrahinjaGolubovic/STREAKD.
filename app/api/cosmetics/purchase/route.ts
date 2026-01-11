import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { purchaseCosmetic } from '@/lib/cosmetics';

export async function POST(request: Request) {
    try {
        const authResult = await verifyAuth(request);
        if (!authResult.valid || !authResult.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { cosmeticId } = body;

        if (!cosmeticId || typeof cosmeticId !== 'number') {
            return NextResponse.json(
                { error: 'Invalid cosmetic ID' },
                { status: 400 }
            );
        }

        const result = purchaseCosmetic(authResult.userId, cosmeticId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            message: result.message,
            newBalance: result.newBalance
        });
    } catch (error: any) {
        console.error('Error purchasing cosmetic:', error);
        return NextResponse.json(
            { error: 'Failed to purchase cosmetic' },
            { status: 500 }
        );
    }
}
