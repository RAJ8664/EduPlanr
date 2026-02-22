import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

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

        // 2. Query Firestore users collection by email using Admin SDK
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

        const sessionsSnapshot = await adminDb.collection('sessions')
            .where('userId', '==', userId)
            .where('startTime', '>=', thirtyDaysAgo)
            .get();

        // 5. Fetch all tasks for the user
        const tasksSnapshot = await adminDb.collection('tasks')
            .where('userId', '==', userId)
            .get();

        // 6. Fetch all subjects for the user
        const subjectsSnapshot = await adminDb.collection('subjects')
            .where('userId', '==', userId)
            .get();

        // 7. Fetch all syllabi for the user
        const syllabiSnapshot = await adminDb.collection('syllabi')
            .where('userId', '==', userId)
            .get();

        // 8. Fetch all exam routines for the user
        const examRoutinesSnapshot = await adminDb.collection('examRoutines')
            .where('userId', '==', userId)
            .get();

        // Helper to safely convert Admin SDK timestamps
        const safeIso = (ts: any): string | null => {
            if (!ts) return null;
            if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
            if (ts instanceof Date) return ts.toISOString();
            if (typeof ts === 'string') return ts;
            return null;
        };

        // 9. Map data to the required Nexora schema format
        const events = sessionsSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: `eduplanr-session-${doc.id}`,
                title: data.title || 'Study Session',
                description: data.notes || '',
                startTime: safeIso(data.startTime),
                endTime: safeIso(data.endTime),
                allDay: data.allDay || false,
                source: 'eduplanr',
                category: 'learning',
                energyRequired: 'medium',
                isFlexible: false,
                externalId: doc.id,
                subjectId: data.subjectId || null,
                type: data.type || 'study',
            };
        });

        const tasks = tasksSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: `eduplanr-task-${doc.id}`,
                title: data.title,
                description: data.description || '',
                status: data.status === 'completed' ? 'done' : data.status === 'in-progress' ? 'in-progress' : 'todo',
                priority: data.priority === 'critical' ? 'critical' : data.priority === 'high' ? 'high' : 'medium',
                energyLevel: 'medium',
                dueDate: safeIso(data.dueDate),
                source: 'eduplanr',
                category: 'academic',
                externalId: doc.id,
                subjectId: data.subjectId || null,
            };
        });

        const subjects = subjectsSnapshot.docs.map((doc: any) => {
            const data = doc.data();

            // Find syllabus for this subject
            const matchingSyllabus = syllabiSnapshot.docs.find(
                (s: any) => s.data().subjectId === doc.id
            );
            const syllabusData = matchingSyllabus ? matchingSyllabus.data() : null;

            // Map EduPlanr SyllabusTopic into Nexora Topic format
            const mappedTopics = syllabusData && syllabusData.topics ? syllabusData.topics.map((t: any) => ({
                id: `topic-${t.id || Math.random()}`,
                name: t.title,
                description: t.description || '',
                masteryLevel: t.isCompleted ? 100 : (t.status === 'in-progress' ? 50 : 0),
                studyTime: t.estimatedHours ? t.estimatedHours * 60 : 0,
                resources: [],
                notes: t.notes ? [t.notes] : [],
                weakAreas: []
            })) : [];

            return {
                id: doc.id,
                name: data.name,
                color: data.color || '#06b6d4',
                icon: data.icon || '📚',
                description: data.description || '',
                status: data.status || 'ongoing',
                progress: data.progress || 0,
                cgpa: data.cgpa || null,
                creditHours: data.creditHours || 0,
                semesterId: data.semesterId || null,
                source: data.source || 'eduplanr',
                topics: mappedTopics,
            };
        });

        const syllabi = syllabiSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: doc.id,
                subjectId: data.subjectId,
                title: data.title,
                description: data.description || '',
                totalTopics: data.totalTopics || 0,
                completedTopics: data.completedTopics || 0,
                topics: (data.topics || []).map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status || 'not-started',
                    estimatedHours: t.estimatedHours || 0,
                    priority: t.priority || 'medium',
                })),
                startDate: safeIso(data.startDate),
                endDate: safeIso(data.endDate),
            };
        });

        // Flatten exam routines into individual exam events for Nexora's calendar
        const examEvents: any[] = [];
        examRoutinesSnapshot.docs.forEach((doc: any) => {
            const data = doc.data();
            const routineName = data.name || 'Exam Routine';
            (data.exams || []).forEach((exam: any) => {
                examEvents.push({
                    id: `eduplanr-exam-${doc.id}-${exam.id}`,
                    title: `📝 ${exam.subjectName || 'Exam'}`,
                    description: `${routineName}${exam.venue ? ` • Venue: ${exam.venue}` : ''}${exam.notes ? ` • ${exam.notes}` : ''}`,
                    date: exam.date,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    source: 'eduplanr',
                    category: 'exam',
                    subjectColor: exam.subjectColor || '#ef4444',
                    externalId: `${doc.id}__${exam.id}`,
                    routineId: doc.id,
                    routineName,
                });
            });
        });

        // 10. Return full data payload
        return NextResponse.json({
            success: true,
            data: {
                events,
                tasks,
                subjects,
                syllabi,
                examEvents,
            }
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('Nexora Sync API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500, headers: corsHeaders }
        );
    }
}
