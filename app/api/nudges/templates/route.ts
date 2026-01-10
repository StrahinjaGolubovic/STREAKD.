import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { isPremiumUser } from '@/lib/premium';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import { formatDateTimeSerbia } from '@/lib/timezone';

// GET - Fetch user's custom nudge templates (premium only)
export async function GET(request: NextRequest) {
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

        // Check if user is premium
        if (!isPremiumUser(decoded.userId)) {
            return NextResponse.json({ error: 'Premium required' }, { status: 403 });
        }

        // Get user's templates
        const templates = db.prepare(`
            SELECT id, message, created_at
            FROM nudge_templates
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(decoded.userId);

        return NextResponse.json({ templates });
    } catch (error) {
        console.error('Error fetching nudge templates:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create new custom nudge template (premium only)
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

        // Check if user is premium
        if (!isPremiumUser(decoded.userId)) {
            return NextResponse.json({ error: 'Premium required' }, { status: 403 });
        }

        const { message } = await request.json();

        if (!message || message.trim().length === 0) {
            return NextResponse.json({ error: 'Message required' }, { status: 400 });
        }

        if (message.length > 200) {
            return NextResponse.json({ error: 'Message too long (max 200 characters)' }, { status: 400 });
        }

        // Check if user already has max templates (limit to 5)
        const count = db.prepare('SELECT COUNT(*) as count FROM nudge_templates WHERE user_id = ?')
            .get(decoded.userId) as { count: number };

        if (count.count >= 5) {
            return NextResponse.json({ error: 'Maximum 5 templates allowed' }, { status: 400 });
        }

        // Create template
        const createdAt = formatDateTimeSerbia();
        const result = db.prepare(`
            INSERT INTO nudge_templates (user_id, message, created_at)
            VALUES (?, ?, ?)
        `).run(decoded.userId, message.trim(), createdAt);

        return NextResponse.json({
            success: true,
            template: {
                id: result.lastInsertRowid,
                message: message.trim(),
                created_at: createdAt
            }
        });
    } catch (error) {
        console.error('Error creating nudge template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Remove custom nudge template (premium only)
export async function DELETE(request: NextRequest) {
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

        // Check if user is premium
        if (!isPremiumUser(decoded.userId)) {
            return NextResponse.json({ error: 'Premium required' }, { status: 403 });
        }

        const { templateId } = await request.json();

        if (!templateId) {
            return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
        }

        // Delete template (only if owned by user)
        const result = db.prepare('DELETE FROM nudge_templates WHERE id = ? AND user_id = ?')
            .run(templateId, decoded.userId);

        if (result.changes === 0) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting nudge template:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
