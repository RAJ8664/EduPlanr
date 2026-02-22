import { collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store'; // EduPlanr's store

/**
 * Cleanup script to remove duplicated subjects from EduPlanr.
 * Run this directly in the browser console while logged into EduPlanr by calling window.cleanupEduPlanrDuplicates().
 */
export async function cleanupEduPlanrDuplicates() {
    console.log('Starting duplicate subject cleanup in EduPlanr...');

    // Attempt to get user ID from store
    const userId = useAuthStore.getState().user?.uid;
    if (!userId) {
        console.error('You must be logged in to run this script.');
        return;
    }

    try {
        const subjectsRef = collection(db, 'subjects');
        const q = query(subjectsRef, where('userId', '==', userId));
        const snapshot = await getDocs(q);

        const subjectsByName = new Map<string, any[]>();

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const name = data.name.trim().toLowerCase();
            if (!subjectsByName.has(name)) {
                subjectsByName.set(name, []);
            }
            subjectsByName.get(name)!.push({ id: docSnap.id, ...data, ref: docSnap.ref });
        });

        let deletedCount = 0;

        Array.from(subjectsByName.entries()).forEach(async ([name, duplicates]) => {
            if (duplicates.length > 1) {
                console.log(`Found ${duplicates.length} instances of "${name}"`);

                // Keep the one created earliest (assumed original)
                duplicates.sort((a: any, b: any) => {
                    // Try to get timestamp, fallback to 0
                    const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0) || 0;
                    const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0) || 0;
                    return timeA - timeB; // ascending
                });

                const original = duplicates[0];
                const toDelete = duplicates.slice(1);

                for (const item of toDelete) {
                    // console.log(`Deleting duplicate subject ID: ${item.id}`);
                    await deleteDoc(item.ref);
                    deletedCount++;
                }
            }
        });

        // Give promises a second to run and output
        setTimeout(() => {
            console.log(`Cleanup complete. Triggered deletion for ${deletedCount} duplicate subjects.`);
        }, 3000);

    } catch (e) {
        console.error('Error during cleanup:', e);
    }
}

if (typeof window !== 'undefined') {
    (window as any).cleanupEduPlanrDuplicates = cleanupEduPlanrDuplicates;
}
