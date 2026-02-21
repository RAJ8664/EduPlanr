import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, syncToken, payload } = body;

        // 1. Validate request body
        if (!email || !syncToken || !payload) {
            return NextResponse.json(
                { success: false, error: 'Missing email, syncToken, or payload' },
                { status: 400, headers: corsHeaders }
            );
        }

        // 2. Authenticate via email + syncToken
        const adminDb = getAdminDb();
        const usersRef = adminDb.collection('users');
        const userSnapshot = await usersRef.where('email', '==', email).limit(1).get();

        if (userSnapshot.empty) {
            return NextResponse.json(
                { success: false, error: 'User not found or unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        if (!userData.syncToken || userData.syncToken !== syncToken) {
            return NextResponse.json(
                { success: false, error: 'Invalid syncToken or unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const userId = userDoc.id;
        const now = new Date();
        let updatedFields: string[] = [];

        // 3. Store Nexora context data in the user's nexoraContext subcollection
        const contextRef = adminDb.collection('nexoraContext').doc(userId);

        // Build the context update object
        const contextUpdate: Record<string, any> = {
            lastSyncedAt: now,
            syncSource: 'nexora',
        };

        // 3a. Wellness data (sleep, stress, energy, nutrition)
        if (payload.wellness) {
            contextUpdate.wellness = {
                ...payload.wellness,
                receivedAt: now,
            };
            updatedFields.push('wellness');
        }

        // 3b. Active habits (study-related)
        if (payload.habits && Array.isArray(payload.habits)) {
            contextUpdate.habits = payload.habits.map((h: any) => ({
                name: h.name || h.title,
                streak: h.streak || 0,
                category: h.category || 'general',
                frequency: h.frequency || 'daily',
                lastCompleted: h.lastCompleted || null,
            }));
            updatedFields.push('habits');
        }

        // 3c. Active goals
        if (payload.goals && Array.isArray(payload.goals)) {
            contextUpdate.goals = payload.goals.map((g: any) => ({
                title: g.title,
                category: g.category || 'general',
                progress: g.progress || 0,
                status: g.status || 'in-progress',
                targetDate: g.targetDate || null,
            }));
            updatedFields.push('goals');
        }

        // 3d. Personal calendar events (non-academic)
        if (payload.events && Array.isArray(payload.events)) {
            contextUpdate.personalEvents = payload.events.map((e: any) => ({
                title: e.title,
                startTime: e.startTime,
                endTime: e.endTime,
                category: e.category || 'personal',
                allDay: e.allDay || false,
            }));
            updatedFields.push('events');
        }

        // Write the context update
        await contextRef.set(contextUpdate, { merge: true });

        // 4. Sync task status updates back to EduPlanr's tasks collection
        if (payload.taskUpdates && Array.isArray(payload.taskUpdates)) {
            const batch = adminDb.batch();
            let taskUpdateCount = 0;

            for (const update of payload.taskUpdates) {
                if (!update.externalId || !update.status) continue;

                const taskRef = adminDb.collection('tasks').doc(update.externalId);
                const taskDoc = await taskRef.get();

                if (taskDoc.exists()) {
                    const eduplanrStatus = update.status === 'done' ? 'completed' :
                        update.status === 'in-progress' ? 'in-progress' : 'pending';
                    batch.update(taskRef, {
                        status: eduplanrStatus,
                        ...(update.status === 'done' ? { completedAt: now } : {}),
                        updatedAt: now,
                    });
                    taskUpdateCount++;
                }
            }

            if (taskUpdateCount > 0) {
                await batch.commit();
                updatedFields.push(`${taskUpdateCount} task statuses`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Received Nexora data: ${updatedFields.join(', ') || 'no fields'}`,
            updatedFields,
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('Nexora Push API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500, headers: corsHeaders }
        );
    }
}
