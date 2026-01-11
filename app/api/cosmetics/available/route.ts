import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getCosmeticsWithOwnership } from '@/lib/cosmetics';

export async function GET(request: Request) {
    try {
        const authResult = await verifyAuth(request);
        if (!authResult.valid || !authResult.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cosmetics = getCosmeticsWithOwnership(authResult.userId);

        // Parse JSON data fields for easier frontend consumption
        const cosmeticsWithParsedData = cosmetics.map(cosmetic => ({
            ...cosmetic,
            data: JSON.parse(cosmetic.data),
            requirements: cosmetic.requirements ? JSON.parse(cosmetic.requirements) : null
        }));

        return NextResponse.json({ cosmetics: cosmeticsWithParsedData });
    } catch (error: any) {
        console.error('Error fetching cosmetics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch cosmetics' },
            { status: 500 }
        );
    }
}
