/**
 * Materials Service
 * Handles CRUD operations for study materials (notes, links, etc.)
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StudyMaterial } from '@/types';

const COLLECTION_NAME = 'materials';

/**
 * Create a new study material
 */
export async function createMaterial(
  userId: string,
  material: Omit<StudyMaterial, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<StudyMaterial> {
  if (!db) throw new Error('Firebase not initialized');

  const materialRef = collection(db, COLLECTION_NAME);

  const docData = {
    ...material,
    userId,
    isFavorite: false,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(materialRef, docData);

  return {
    id: docRef.id,
    ...material,
    userId,
    isFavorite: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get all materials for a user
 */
export async function getUserMaterials(userId: string): Promise<StudyMaterial[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);

  const materials = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as StudyMaterial;
  });

  // Sort by updatedAt in memory
  return materials.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Update material
 */
export async function updateMaterial(
  materialId: string,
  updates: Partial<Omit<StudyMaterial, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, materialId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Toggle favorite status
 */
export async function toggleMaterialFavorite(
  materialId: string,
  isFavorite: boolean
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, materialId);
  await updateDoc(docRef, {
    isFavorite,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete material
 */
export async function deleteMaterial(materialId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, materialId);
  await deleteDoc(docRef);
}
