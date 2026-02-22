import { getNexoraAdminDb } from '@/lib/firebase-admin';
import { Subject } from '@/types';

/**
 * Transforms an EduPlanr Subject into a Nexora Subject format
 */
function transformToNexoraSubject(eduplanrSubject: Subject, userId: string): Record<string, any> {
    return {
        userId, // The user's Nexora Auth ID (assumed to be matching)
        name: eduplanrSubject.name,
        description: eduplanrSubject.description || '',
        color: eduplanrSubject.color || '#06b6d4',
        icon: null, // EduPlanr doesn't have icons for subjects
        topics: [], // EduPlanr tracks topics in Syllabus, but Nexora tracks them locally
        resources: [],
        examDates: [], // Handled by ExamRoutines in EduPlanr
        grades: [],
        studyTime: 0,
        masteryLevel: eduplanrSubject.progress || 0, // Map progress to mastery
        createdAt: eduplanrSubject.createdAt instanceof Date ? eduplanrSubject.createdAt : new Date(),
        updatedAt: new Date(),
        source: 'eduplanr',
    };
}

/**
 * Pushes an EduPlanr Subject creation/update directly to Nexora's Firestore
 * using the configured Nexora Admin Service Account.
 */
export async function pushSubjectToNexora(subject: Subject, userId: string) {
    try {
        const nexoraDb = getNexoraAdminDb();
        const nexoraSubjectRef = nexoraDb.collection('subjects').doc(subject.id);

        const nexoraData = transformToNexoraSubject(subject, userId);

        // Use merge to avoid overwriting Nexora's local topics/resources if it already exists
        await nexoraSubjectRef.set(nexoraData, { merge: true });
        // console.log(`[Nexora Webhook] Successfully pushed Subject ${subject.id} to Nexora`);
    } catch (error) {
        console.error(`[Nexora Webhook] Failed to push Subject ${subject.id} to Nexora:`, error);
        // We don't throw here to avoid breaking EduPlanr's main operations if Nexora sync fails
    }
}

/**
 * Deletes a Subject from Nexora when it's deleted in EduPlanr
 */
export async function deleteSubjectFromNexora(subjectId: string) {
    try {
        const nexoraDb = getNexoraAdminDb();
        await nexoraDb.collection('subjects').doc(subjectId).delete();
    } catch (error) {
        console.error(`[Nexora Webhook] Failed to delete Subject ${subjectId} from Nexora:`, error);
    }
}
