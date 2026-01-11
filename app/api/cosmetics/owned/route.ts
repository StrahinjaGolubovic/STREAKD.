import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserCosmetics, getEquippedCosmetics } from '@/lib/cosmetics';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
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
        const userId = decoded.userId;

        const owned = getUserCosmetics(decoded.userId);
        const equipped = getEquippedCosmetics(decoded.userId);

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
