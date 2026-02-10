/**
 * Routine Service
 * Firebase CRUD operations for daily routine blocks
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RoutineBlock } from '@/types';

const COLLECTION_NAME = 'routines';

/**
 * Create a new routine block
 */
export async function createRoutineBlock(
    userId: string,
    data: Omit<RoutineBlock, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<RoutineBlock> {
    if (!db) throw new Error('Firebase not initialized');

    const now = new Date();
    const docData = {
        userId,
        title: data.title,
        category: data.category,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color,
        icon: data.icon,
        isActive: data.isActive ?? true,
        daysOfWeek: data.daysOfWeek ?? [1, 2, 3, 4, 5], // Default weekdays
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

    return {
        id: docRef.id,
        ...docData,
        createdAt: now,
        updatedAt: now,
    } as RoutineBlock;
}

/**
 * Get all routine blocks for a user
 */
export async function getUserRoutineBlocks(userId: string): Promise<RoutineBlock[]> {
    if (!db) throw new Error('Firebase not initialized');

    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('startTime', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            userId: data.userId,
            title: data.title,
            category: data.category,
            startTime: data.startTime,
            endTime: data.endTime,
            color: data.color,
            icon: data.icon,
            isActive: data.isActive ?? true,
            daysOfWeek: data.daysOfWeek ?? [1, 2, 3, 4, 5],
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as RoutineBlock;
    });
}

/**
 * Update a routine block
 */
export async function updateRoutineBlock(
    blockId: string,
    updates: Partial<Omit<RoutineBlock, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    const docRef = doc(db, COLLECTION_NAME, blockId);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
    });
}

/**
 * Delete a routine block
 */
export async function deleteRoutineBlock(blockId: string): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');

    await deleteDoc(doc(db, COLLECTION_NAME, blockId));
}

/**
 * Calculate routine stats
 */
export function calculateRoutineStats(blocks: RoutineBlock[]) {
    const activeBlocks = blocks.filter((b) => b.isActive);

    const categoryMinutes: Record<string, number> = {};
    let totalMinutes = 0;

    for (const block of activeBlocks) {
        const [sh, sm] = block.startTime.split(':').map(Number);
        const [eh, em] = block.endTime.split(':').map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        const duration = mins > 0 ? mins : 0;
        totalMinutes += duration;
        categoryMinutes[block.category] = (categoryMinutes[block.category] || 0) + duration;
    }

    return {
        totalBlocks: activeBlocks.length,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        studyHours: Math.round(((categoryMinutes['study'] || 0) / 60) * 10) / 10,
        breakHours: Math.round(((categoryMinutes['break'] || 0) / 60) * 10) / 10,
        exerciseHours: Math.round(((categoryMinutes['exercise'] || 0) / 60) * 10) / 10,
        personalHours: Math.round(((categoryMinutes['personal'] || 0) / 60) * 10) / 10,
        categoryMinutes,
    };
}
