/**
 * Exam Routine Service
 * Handles CRUD operations for exam routines with Firebase
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ExamRoutine, Exam } from '@/types';

function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const COLLECTION_NAME = 'examRoutines';

/**
 * Create a new exam routine
 */
export async function createExamRoutine(
    userId: string,
    routine: Omit<ExamRoutine, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<ExamRoutine> {
    if (!db) throw new Error('Firebase not initialized');

    const routineRef = collection(db, COLLECTION_NAME);

    // Ensure each exam has an ID
    const examsWithIds = routine.exams.map((exam) => ({
        ...exam,
        id: exam.id || generateId(),
    }));

    const docData = {
        ...routine,
        exams: examsWithIds,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(routineRef, docData);

    return {
        id: docRef.id,
        ...routine,
        exams: examsWithIds,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

/**
 * Get all exam routines for a user
 */
export async function getUserExamRoutines(userId: string): Promise<ExamRoutine[]> {
    if (!db) throw new Error('Firebase not initialized');

    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    const safeToDate = (ts: any): Date => {
        if (!ts) return new Date();
        if (typeof ts.toDate === 'function') {
            try { return ts.toDate(); } catch { return new Date(); }
        }
        if (typeof ts === 'object' && typeof ts.seconds === 'number') {
            return new Date(ts.seconds * 1000);
        }
        const d = new Date(ts);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const routines = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            createdAt: safeToDate(data.createdAt),
            updatedAt: safeToDate(data.updatedAt),
            exams: data.exams || [],
        } as ExamRoutine;
    });

    return routines.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Update an exam routine
 */
export async function updateExamRoutine(
    routineId: string,
    updates: Partial<Omit<ExamRoutine, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, routineId);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete an exam routine
 */
export async function deleteExamRoutine(routineId: string): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, routineId);
    await deleteDoc(docRef);
}

/**
 * Add an exam to a routine
 */
export async function addExamToRoutine(
    routineId: string,
    exam: Omit<Exam, 'id'>
): Promise<Exam> {
    if (!db) throw new Error('Firebase not initialized');

    const newExam: Exam = {
        ...exam,
        id: generateId(),
    };

    const docRef = doc(db, COLLECTION_NAME, routineId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error('Routine not found');

    const currentExams = docSnap.data().exams || [];

    await updateDoc(docRef, {
        exams: [...currentExams, newExam],
        updatedAt: serverTimestamp(),
    });

    return newExam;
}

/**
 * Remove an exam from a routine
 */
export async function removeExamFromRoutine(
    routineId: string,
    examId: string
): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, routineId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error('Routine not found');

    const currentExams = docSnap.data().exams || [];
    const updatedExams = currentExams.filter((e: Exam) => e.id !== examId);

    await updateDoc(docRef, {
        exams: updatedExams,
        updatedAt: serverTimestamp(),
    });
}
