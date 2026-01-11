import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getCosmeticsWithOwnership } from '@/lib/cosmetics';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const cosmetics = getCosmeticsWithOwnership(decoded.userId);

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
