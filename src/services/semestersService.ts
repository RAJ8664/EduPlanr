/**
 * Semesters Service
 * Handles CRUD operations for semesters (1-8)
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
import { Semester } from '@/types';

const COLLECTION_NAME = 'semesters';

/**
 * Create a new semester
 */
export async function createSemester(
    userId: string,
    semester: Omit<Semester, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Semester> {
    if (!db) throw new Error('Firebase not initialized');

    const semesterRef = collection(db, COLLECTION_NAME);

    const docData = {
        ...semester,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(semesterRef, docData);

    return {
        id: docRef.id,
        ...semester,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

/**
 * Get a single semester by ID
 */
export async function getSemester(semesterId: string): Promise<Semester | null> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, semesterId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    const safeToDate = (ts: any) => (ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date());

    return {
        id: docSnap.id,
        ...data,
        startDate: data.startDate ? safeToDate(data.startDate) : undefined,
        endDate: data.endDate ? safeToDate(data.endDate) : undefined,
        createdAt: safeToDate(data.createdAt),
        updatedAt: safeToDate(data.updatedAt),
    } as Semester;
}

/**
 * Get all semesters for a user
 */
export async function getUserSemesters(userId: string): Promise<Semester[]> {
    if (!db) throw new Error('Firebase not initialized');

    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    const semesters = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const safeToDate = (ts: any) => (ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date());
        return {
            id: docSnap.id,
            ...data,
            startDate: data.startDate ? safeToDate(data.startDate) : undefined,
            endDate: data.endDate ? safeToDate(data.endDate) : undefined,
            createdAt: safeToDate(data.createdAt),
            updatedAt: safeToDate(data.updatedAt),
        } as Semester;
    });

    return semesters.sort((a, b) => a.number - b.number);
}

/**
 * Update semester details
 */
export async function updateSemester(
    semesterId: string,
    updates: Partial<Omit<Semester, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, semesterId);

    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Delete a semester
 */
export async function deleteSemester(semesterId: string): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, semesterId);
    await deleteDoc(docRef);
}

/**
 * Initialize default semesters (1-8) for a new user
 */
export async function initializeUserSemesters(userId: string): Promise<Semester[]> {
    if (!db) throw new Error('Firebase not initialized');

    const existingSemesters = await getUserSemesters(userId);
    if (existingSemesters.length > 0) {
        return existingSemesters;
    }

    const semesters: Semester[] = [];
    for (let i = 1; i <= 8; i++) {
        const semester = await createSemester(userId, {
            number: i,
            name: `Semester ${i}`,
            isActive: i === 1,
        });
        semesters.push(semester);
    }

    return semesters;
}
