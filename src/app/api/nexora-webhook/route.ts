import { NextResponse } from 'next/server';
import { pushSubjectToNexora, deleteSubjectFromNexora } from '@/services/nexoraWebhookService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, subject, userId, subjectId } = body;

        if (!action) {
            return NextResponse.json({ success: false, error: 'Missing action parameter' }, { status: 400 });
        }

        if (action === 'push') {
            if (!subject || !userId) {
                return NextResponse.json({ success: false, error: 'Missing subject or userId' }, { status: 400 });
            }
            await pushSubjectToNexora(subject, userId);
            return NextResponse.json({ success: true, message: 'Subject pushed' });
        }

        if (action === 'delete') {
            if (!subjectId) {
                return NextResponse.json({ success: false, error: 'Missing subjectId' }, { status: 400 });
            }
            await deleteSubjectFromNexora(subjectId);
            return NextResponse.json({ success: true, message: 'Subject deleted' });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Internal Webhook Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
