import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

// Reusable CORS headers
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
        const { email, syncToken } = body;

        // 1. Validate request body
        if (!email || !syncToken) {
            return NextResponse.json(
                { success: false, error: 'Missing email or syncToken' },
                { status: 400, headers: corsHeaders }
            );
        }

        if (!db) {
            return NextResponse.json(
                { success: false, error: 'Database not initialized' },
                { status: 500, headers: corsHeaders }
            );
        }

        // 2. Query Firestore users collection by email using Web SDK
        const usersRef = collection(db, 'users');
        const qUsers = query(usersRef, where('email', '==', email), limit(1));
        const userSnapshot = await getDocs(qUsers);

        if (userSnapshot.empty) {
            return NextResponse.json(
                { success: false, error: 'User not found or unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        // 3. Validate syncToken matches user document
        if (!userData.syncToken || userData.syncToken !== syncToken) {
            return NextResponse.json(
                { success: false, error: 'Invalid syncToken or unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const userId = userDoc.id;

        // 4. Fetch recent study sessions (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const sessionsRef = collection(db, 'sessions');
        const qSessions = query(sessionsRef, where('userId', '==', userId), where('startTime', '>=', thirtyDaysAgo));
        const sessionsSnapshot = await getDocs(qSessions);

        // 5. Fetch all tasks for the user
        const tasksRef = collection(db, 'tasks');
        const qTasks = query(tasksRef, where('userId', '==', userId));
        const tasksSnapshot = await getDocs(qTasks);

        // 6. Map data to the required Nexora schema format
        const events = sessionsSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: `eduplanr-session-${doc.id}`,
                title: data.title || 'Study Session',
                description: data.notes || '',
                startTime: data.startTime?.toDate().toISOString(),
                endTime: data.endTime?.toDate().toISOString(),
                allDay: data.allDay || false,
                source: 'eduplanr',
                category: 'learning',
                energyRequired: 'medium',
                isFlexible: false,
                externalId: doc.id
            };
        });

        const tasks = tasksSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: `eduplanr-task-${doc.id}`,
                title: data.title,
                description: data.description || '',
                status: data.status === 'completed' ? 'done' : 'todo',
                priority: data.priority === 'critical' ? 'critical' : data.priority === 'high' ? 'high' : 'medium',
                energyLevel: 'medium',
                dueDate: data.dueDate?.toDate().toISOString(),
                source: 'eduplanr',
                category: 'academic',
                externalId: doc.id
            };
        });

        // 7. Return JSON with CORS headers
        return NextResponse.json({
            success: true,
            data: {
                events,
                tasks
            }
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('Nexora Sync API Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        );
    }
}
