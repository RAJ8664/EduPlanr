/**
 * Syllabus Service
 * Handles CRUD operations for syllabi and topic progress tracking
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
import { safeParseDate } from '@/lib/utils';
import { Syllabus, SyllabusTopic, TopicStatus } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = 'syllabi';

function safeToDate(value: unknown): Date {
  return safeParseDate(value) || new Date();
}

function safeToDateOrNull(value: unknown): Date | null {
  return safeParseDate(value);
}

/**
 * Create a new syllabus
 */
export async function createSyllabus(
  userId: string,
  syllabus: Omit<Syllabus, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Syllabus> {
  if (!db) throw new Error('Firebase not initialized');

  const syllabusRef = collection(db, COLLECTION_NAME);

  // Ensure each topic has an ID
  const topicsWithIds = syllabus.topics.map((topic, index) => ({
    ...topic,
    id: topic.id || uuidv4(),
    order: topic.order ?? index,
  }));

  const docData = {
    ...syllabus,
    topics: topicsWithIds,
    userId,
    startDate: syllabus.startDate,
    endDate: syllabus.endDate,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(syllabusRef, docData);

  return {
    id: docRef.id,
    ...syllabus,
    topics: topicsWithIds,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get a single syllabus by ID
 */
export async function getSyllabus(syllabusId: string): Promise<Syllabus | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, syllabusId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();

  return {
    id: docSnap.id,
    ...data,
    startDate: safeToDate(data.startDate),
    endDate: safeToDate(data.endDate),
    createdAt: safeToDate(data.createdAt),
    updatedAt: safeToDate(data.updatedAt),
    topics: data.topics?.map((topic: SyllabusTopic) => ({
      ...topic,
      completedAt: safeToDateOrNull(topic.completedAt),
    })) || [],
  } as Syllabus;
}

/**
 * Get all syllabi for a user
 */
export async function getUserSyllabi(userId: string): Promise<Syllabus[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);

  const syllabi = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      startDate: safeToDate(data.startDate),
      endDate: safeToDate(data.endDate),
      createdAt: safeToDate(data.createdAt),
      updatedAt: safeToDate(data.updatedAt),
      topics: data.topics?.map((topic: SyllabusTopic) => ({
        ...topic,
        completedAt: safeToDateOrNull(topic.completedAt),
      })) || [],
    } as Syllabus;
  });

  return syllabi.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Get syllabi for a specific subject
 */
export async function getSyllabiBySubject(
  userId: string,
  subjectId: string
): Promise<Syllabus[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);

  const syllabi = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        startDate: safeToDate(data.startDate),
        endDate: safeToDate(data.endDate),
        createdAt: safeToDate(data.createdAt),
        updatedAt: safeToDate(data.updatedAt),
      } as Syllabus;
    })
    .filter(s => s.subjectId === subjectId)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return syllabi;
}

/**
 * Update syllabus details
 */
export async function updateSyllabus(
  syllabusId: string,
  updates: Partial<Omit<Syllabus, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, syllabusId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a syllabus
 */
export async function deleteSyllabus(syllabusId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, syllabusId);
  await deleteDoc(docRef);
}

/**
 * Add a topic to a syllabus
 */
export async function addTopic(
  syllabusId: string,
  topic: Omit<SyllabusTopic, 'id'>
): Promise<SyllabusTopic> {
  const syllabus = await getSyllabus(syllabusId);
  if (!syllabus) throw new Error('Syllabus not found');

  const newTopic: SyllabusTopic = {
    ...topic,
    id: uuidv4(),
    order: syllabus.topics.length,
  };

  const updatedTopics = [...syllabus.topics, newTopic];

  await updateSyllabus(syllabusId, { topics: updatedTopics });

  return newTopic;
}

/**
 * Update a topic within a syllabus
 */
export async function updateTopic(
  syllabusId: string,
  topicId: string,
  updates: Partial<Omit<SyllabusTopic, 'id'>>
): Promise<void> {
  const syllabus = await getSyllabus(syllabusId);
  if (!syllabus) throw new Error('Syllabus not found');

  const updatedTopics = syllabus.topics.map((topic) =>
    topic.id === topicId ? { ...topic, ...updates } : topic
  );

  await updateSyllabus(syllabusId, { topics: updatedTopics });
}

/**
 * Update topic status with completion tracking
 */
export async function updateTopicStatus(
  syllabusId: string,
  topicId: string,
  status: TopicStatus
): Promise<void> {
  const syllabus = await getSyllabus(syllabusId);
  if (!syllabus) throw new Error('Syllabus not found');

  const updatedTopics = syllabus.topics.map((topic) => {
    if (topic.id === topicId) {
      return {
        ...topic,
        status,
        completedAt: status === 'completed' ? new Date() : null,
      };
    }
    return topic;
  });

  await updateSyllabus(syllabusId, { topics: updatedTopics });
}

/**
 * Delete a topic from a syllabus
 */
export async function deleteTopic(
  syllabusId: string,
  topicId: string
): Promise<void> {
  const syllabus = await getSyllabus(syllabusId);
  if (!syllabus) throw new Error('Syllabus not found');

  const updatedTopics = syllabus.topics
    .filter((topic) => topic.id !== topicId)
    .map((topic, index) => ({ ...topic, order: index }));

  await updateSyllabus(syllabusId, { topics: updatedTopics });
}

/**
 * Reorder topics within a syllabus
 */
export async function reorderTopics(
  syllabusId: string,
  topicIds: string[]
): Promise<void> {
  const syllabus = await getSyllabus(syllabusId);
  if (!syllabus) throw new Error('Syllabus not found');

  const topicMap = new Map(syllabus.topics.map((t) => [t.id, t]));
  const reorderedTopics = topicIds
    .map((id, index) => {
      const topic = topicMap.get(id);
      return topic ? { ...topic, order: index } : null;
    })
    .filter((t): t is SyllabusTopic => t !== null);

  await updateSyllabus(syllabusId, { topics: reorderedTopics });
}

/**
 * Calculate syllabus progress percentage
 */
export function calculateProgress(syllabus: Syllabus): number {
  if (syllabus.topics.length === 0) return 0;

  const completedTopics = syllabus.topics.filter(
    (topic) => topic.status === 'completed'
  ).length;

  return Math.round((completedTopics / syllabus.topics.length) * 100);
}

/**
 * Get total estimated hours for a syllabus
 */
export function getTotalEstimatedHours(syllabus: Syllabus): number {
  return syllabus.topics.reduce(
    (total, topic) => total + (topic.estimatedHours || 0),
    0
  );
}

/**
 * Get remaining estimated hours (incomplete topics only)
 */
export function getRemainingHours(syllabus: Syllabus): number {
  return syllabus.topics
    .filter((topic) => topic.status !== 'completed' && topic.status !== 'skipped')
    .reduce((total, topic) => total + (topic.estimatedHours || 0), 0);
}
