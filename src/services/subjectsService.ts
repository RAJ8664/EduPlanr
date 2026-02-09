/**
 * Subjects Service
 * Handles CRUD operations for subjects with real-time Firebase data
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Subject, SubjectStatus } from '@/types';

const COLLECTION_NAME = 'subjects';

console.log('subjectsService loaded. DB available:', !!db);

/**
 * Create a new subject
 */
export async function createSubject(
    userId: string,
    subject: Omit<Subject, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Subject> {
    if (!db) throw new Error('Firebase not initialized');

    const subjectRef = collection(db, COLLECTION_NAME);

    const docData = {
        ...subject,
        userId,
        status: subject.status || 'ongoing',
        progress: subject.progress || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    console.log('Creating subject for user:', userId, 'with data:', docData);

    try {
        const docRef = await addDoc(subjectRef, docData);
        console.log('Subject created with ID:', docRef.id);

        return {
            id: docRef.id,
            ...subject,
            userId,
            status: subject.status || 'ongoing',
            progress: subject.progress || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    } catch (error) {
        console.error('Error creating subject in Firestore:', error);
        throw error;
    }
}

/**
 * Get a single subject by ID
 */
export async function getSubject(subjectId: string): Promise<Subject | null> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, subjectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    const safeToDate = (ts: any) => (ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date());

    return {
        id: docSnap.id,
        ...data,
        createdAt: safeToDate(data.createdAt),
        updatedAt: safeToDate(data.updatedAt),
    } as Subject;
}

/**
 * Get all subjects for a user
 */
export async function getUserSubjects(userId: string): Promise<Subject[]> {
    if (!db) throw new Error('Firebase not initialized');

    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    const subjects = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const safeToDate = (ts: any) => (ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date());
        return {
            id: docSnap.id,
            ...data,
            createdAt: safeToDate(data.createdAt),
            updatedAt: safeToDate(data.updatedAt),
        } as Subject;
    });

    return subjects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get subjects for a specific semester
 */
export async function getSubjectsBySemester(
    userId: string,
    semesterId: string
): Promise<Subject[]> {
    if (!db) throw new Error('Firebase not initialized');

    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    const subjects = snapshot.docs
        .map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Subject;
        })
        .filter(s => s.semesterId === semesterId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return subjects;
}

/**
 * Update subject details
 */
export async function updateSubject(
    subjectId: string,
    updates: Partial<Omit<Subject, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, subjectId);

    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Update subject status with optional CGPA
 */
export async function updateSubjectStatus(
    subjectId: string,
    status: SubjectStatus,
    cgpa?: number
): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, subjectId);

    const updates: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
    };

    // Only set CGPA if status is 'passed'
    if (status === 'passed' && cgpa !== undefined) {
        // Validate CGPA is between 0-10
        updates.cgpa = Math.min(10, Math.max(0, cgpa));
    } else if (status !== 'passed') {
        // Clear CGPA if not passed
        updates.cgpa = null;
    }

    await updateDoc(docRef, updates);
}

/**
 * Update subject progress
 */
export async function updateSubjectProgress(
    subjectId: string,
    progress: number
): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, subjectId);

    await updateDoc(docRef, {
        progress: Math.min(100, Math.max(0, progress)),
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a subject
 */
export async function deleteSubject(subjectId: string): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, subjectId);
    await deleteDoc(docRef);
}

/**
 * Get subject statistics for a user
 */
export async function getSubjectStats(userId: string): Promise<{
    total: number;
    ongoing: number;
    passed: number;
    failed: number;
    averageCgpa: number;
}> {
    const subjects = await getUserSubjects(userId);

    const ongoing = subjects.filter(s => s.status === 'ongoing').length;
    const passed = subjects.filter(s => s.status === 'passed').length;
    const failed = subjects.filter(s => s.status === 'failed').length;

    const passedSubjects = subjects.filter(s => s.status === 'passed' && s.cgpa !== undefined);
    const averageCgpa = passedSubjects.length > 0
        ? passedSubjects.reduce((sum, s) => sum + (s.cgpa || 0), 0) / passedSubjects.length
        : 0;

    return {
        total: subjects.length,
        ongoing,
        passed,
        failed,
        averageCgpa: Math.round(averageCgpa * 100) / 100,
    };
}
