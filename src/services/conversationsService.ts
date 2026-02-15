/**
 * Conversations Service
 * Client-safe CRUD for tutor chat conversations.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChatMessage, Conversation } from '@/types';
import { safeParseDate } from '@/lib/utils';

const COLLECTION_NAME = 'conversations';

function mapConversation(data: Record<string, unknown>, id: string): Conversation {
  const messages = Array.isArray(data.messages) ? data.messages : [];

  return {
    id,
    userId: String(data.userId || ''),
    title: String(data.title || 'New Chat'),
    messages: messages
      .map((message) => {
        if (!message || typeof message !== 'object') return null;
        const msg = message as Record<string, unknown>;
        const role = msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user';
        return {
          id: String(msg.id || ''),
          role,
          content: String(msg.content || ''),
          timestamp: safeParseDate(msg.timestamp) || new Date(),
        } as ChatMessage;
      })
      .filter((message): message is ChatMessage => Boolean(message)),
    createdAt: safeParseDate(data.createdAt) || new Date(),
    updatedAt: safeParseDate(data.updatedAt) || new Date(),
    isArchived: Boolean(data.isArchived),
  };
}

function resolveTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage?.content) return 'New Chat';
  const preview = firstUserMessage.content.trim();
  return preview.length > 60 ? `${preview.slice(0, 60)}...` : preview;
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId),
    where('isArchived', '==', false)
  );

  const snapshot = await getDocs(q);
  const conversations = snapshot.docs.map((docSnap) =>
    mapConversation(docSnap.data() as Record<string, unknown>, docSnap.id)
  );

  return conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function createConversation(
  userId: string,
  messages: ChatMessage[]
): Promise<Conversation> {
  if (!db) throw new Error('Firebase not initialized');

  const title = resolveTitle(messages);
  const ref = await addDoc(collection(db, COLLECTION_NAME), {
    userId,
    title,
    messages,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    userId,
    title,
    messages,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updateConversationMessages(
  conversationId: string,
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(db, COLLECTION_NAME, conversationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Conversation not found');
  if (snap.data().userId !== userId) throw new Error('Unauthorized conversation update');

  await updateDoc(ref, {
    messages,
    title: resolveTitle(messages),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(db, COLLECTION_NAME, conversationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().userId !== userId) throw new Error('Unauthorized conversation delete');

  await deleteDoc(ref);
}
