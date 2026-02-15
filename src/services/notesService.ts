/**
 * Notes Service
 * Firebase-backed CRUD operations for note materials.
 */

import { StudyMaterial } from '@/types';
import {
  createMaterial,
  deleteMaterial,
  getUserMaterials,
  toggleMaterialFavorite,
  updateMaterial,
} from '@/services/materialsService';

export type NoteMaterial = StudyMaterial & { type: 'note' };

function isNoteMaterial(material: StudyMaterial): material is NoteMaterial {
  return material.type === 'note';
}

export async function getUserNotes(userId: string): Promise<NoteMaterial[]> {
  const materials = await getUserMaterials(userId);
  return materials.filter(isNoteMaterial).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function createNote(
  userId: string,
  data?: {
    title?: string;
    content?: string;
    tags?: string[];
  }
): Promise<NoteMaterial> {
  const note = await createMaterial(userId, {
    title: data?.title?.trim() || 'Untitled Note',
    content: data?.content || '<p>Start writing...</p>',
    type: 'note',
    tags: data?.tags || [],
    subjectId: null,
    syllabusId: null,
    url: null,
    isFavorite: false,
    isArchived: false,
  });

  return { ...note, type: 'note' };
}

export async function updateNote(
  noteId: string,
  updates: {
    title?: string;
    content?: string;
    tags?: string[];
    isFavorite?: boolean;
  }
): Promise<void> {
  await updateMaterial(noteId, updates);
}

export async function toggleNoteFavorite(noteId: string, isFavorite: boolean): Promise<void> {
  await toggleMaterialFavorite(noteId, isFavorite);
}

export async function deleteNote(noteId: string): Promise<void> {
  await deleteMaterial(noteId);
}
