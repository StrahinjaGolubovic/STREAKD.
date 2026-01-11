import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getUserCosmetics, getEquippedCosmetics } from '@/lib/cosmetics';

export async function GET(request: Request) {
    try {
        const authResult = await verifyAuth(request);
        if (!authResult.valid || !authResult.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const owned = getUserCosmetics(authResult.userId);
        const equipped = getEquippedCosmetics(authResult.userId);

        // Parse JSON data fields
        const ownedWithParsedData = owned.map(cosmetic => ({
            ...cosmetic,
            data: JSON.parse(cosmetic.data),
            requirements: cosmetic.requirements ? JSON.parse(cosmetic.requirements) : null
        }));

        const equippedWithParsedData: Record<string, any> = {};
        for (const [type, cosmetic] of Object.entries(equipped)) {
            equippedWithParsedData[type] = {
                ...cosmetic,
                data: JSON.parse(cosmetic.data),
                requirements: cosmetic.requirements ? JSON.parse(cosmetic.requirements) : null
            };
        }

        return NextResponse.json({
            owned: ownedWithParsedData,
            equipped: equippedWithParsedData
        });
    } catch (error: any) {
        console.error('Error fetching owned cosmetics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch owned cosmetics' },
            { status: 500 }
        );
    }
}
