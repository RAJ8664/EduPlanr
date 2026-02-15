/**
 * Notifications and Reminder Service
 * Handles realtime notifications, scheduled reminders, and delivery updates.
 */

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification as AppNotification } from '@/types';
import { safeParseDate } from '@/lib/utils';
import { getUserSessions } from '@/services/sessionsService';
import { getUserExamRoutines } from '@/services/examRoutineService';

const COLLECTION_NAME = 'notifications';
const REMINDER_SYNC_WINDOW_DAYS = 14;

interface ScheduledReminder {
  id: string;
  userId: string;
  title: string;
  message: string;
  actionUrl: string;
  scheduledFor: Date;
  sourceType: 'session' | 'exam';
  sourceId: string;
}

function toDateOrNull(value: unknown): Date | null {
  const parsed = safeParseDate(value);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function mapNotificationDoc(data: Record<string, unknown>, id: string): AppNotification {
  const createdAt = toDateOrNull(data.createdAt) || new Date();
  const scheduledFor = toDateOrNull(data.scheduledFor);
  const deliveredAt = toDateOrNull(data.deliveredAt);

  return {
    id,
    userId: String(data.userId || ''),
    title: String(data.title || ''),
    message: String(data.message || ''),
    type: (data.type as AppNotification['type']) || 'system',
    isRead: Boolean(data.isRead),
    actionUrl: data.actionUrl ? String(data.actionUrl) : undefined,
    createdAt,
    scheduledFor,
    deliveredAt,
    sourceType:
      data.sourceType === 'session' || data.sourceType === 'exam'
        ? data.sourceType
        : null,
    sourceId: data.sourceId ? String(data.sourceId) : null,
  };
}

function parseExamDateTime(date: string, startTime: string): Date | null {
  const parsed = new Date(`${date}T${startTime}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function sortByCreatedAtDesc(notifications: AppNotification[]): AppNotification[] {
  return [...notifications].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function isWithinSyncWindow(target: Date, now: Date): boolean {
  const maxDate = new Date(now.getTime() + REMINDER_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return target.getTime() >= now.getTime() && target.getTime() <= maxDate.getTime();
}

async function upsertScheduledReminder(reminder: ScheduledReminder): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(db, COLLECTION_NAME, reminder.id);
  const snap = await getDoc(ref);
  const scheduledTimestamp = Timestamp.fromDate(reminder.scheduledFor);

  if (!snap.exists()) {
    await setDoc(ref, {
      id: reminder.id,
      userId: reminder.userId,
      title: reminder.title,
      message: reminder.message,
      type: 'reminder',
      isRead: false,
      actionUrl: reminder.actionUrl,
      sourceType: reminder.sourceType,
      sourceId: reminder.sourceId,
      scheduledFor: scheduledTimestamp,
      deliveredAt: null,
      createdAt: scheduledTimestamp,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const data = snap.data();
  const existingScheduledAt = toDateOrNull(data.scheduledFor);
  const isScheduleChanged =
    !existingScheduledAt ||
    existingScheduledAt.getTime() !== reminder.scheduledFor.getTime();

  const updates: Record<string, unknown> = {
    title: reminder.title,
    message: reminder.message,
    actionUrl: reminder.actionUrl,
    sourceType: reminder.sourceType,
    sourceId: reminder.sourceId,
    scheduledFor: scheduledTimestamp,
    updatedAt: serverTimestamp(),
  };

  if (isScheduleChanged && reminder.scheduledFor.getTime() > Date.now()) {
    updates.createdAt = scheduledTimestamp;
    updates.deliveredAt = null;
    updates.isRead = false;
  }

  await updateDoc(ref, updates);
}

export function getVisibleNotifications(notifications: AppNotification[]): AppNotification[] {
  const now = Date.now();

  const visible = notifications.filter((notification) => {
    if (!notification.scheduledFor) return true;
    if (notification.deliveredAt) return true;
    return notification.scheduledFor.getTime() <= now;
  });

  return sortByCreatedAtDesc(visible);
}

export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((docSnap) =>
        mapNotificationDoc(docSnap.data() as Record<string, unknown>, docSnap.id)
      );
      callback(sortByCreatedAtDesc(notifications));
    },
    (error) => {
      console.error('Notifications subscription error:', error);
      callback([]);
    }
  );
}

export async function createNotification(
  userId: string,
  data: {
    title: string;
    message: string;
    type: AppNotification['type'];
    actionUrl?: string;
  }
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(collection(db, COLLECTION_NAME));
  await setDoc(ref, {
    id: ref.id,
    userId,
    title: data.title,
    message: data.message,
    type: data.type,
    isRead: false,
    actionUrl: data.actionUrl || null,
    scheduledFor: null,
    deliveredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(db, COLLECTION_NAME, notificationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().userId !== userId) return;

  await updateDoc(ref, {
    isRead: true,
    updatedAt: serverTimestamp(),
  });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  let batch = writeBatch(db);
  let count = 0;

  for (const docSnap of snapshot.docs) {
    batch.update(docSnap.ref, { isRead: true, updatedAt: serverTimestamp() });
    count++;

    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

export async function deleteNotificationById(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(db, COLLECTION_NAME, notificationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  if (snap.data().userId !== userId) return;

  await deleteDoc(ref);
}

export async function clearUserNotifications(userId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  let batch = writeBatch(db);
  let count = 0;

  const now = Date.now();

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const scheduledFor = toDateOrNull(data.scheduledFor);
    const deliveredAt = toDateOrNull(data.deliveredAt);
    const isFuturePendingReminder =
      !!scheduledFor &&
      !deliveredAt &&
      scheduledFor.getTime() > now;

    // Keep future reminders so clear-all does not disable upcoming alerts.
    if (isFuturePendingReminder) {
      continue;
    }

    batch.delete(docSnap.ref);
    count++;

    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
}

export async function markReminderAsDelivered(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(db, COLLECTION_NAME, notificationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.userId !== userId) return;
  if (data.deliveredAt) return;

  await updateDoc(ref, {
    deliveredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    isRead: false,
    updatedAt: serverTimestamp(),
  });
}

export async function syncReminderNotifications(userId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const [sessions, examRoutines] = await Promise.all([
    getUserSessions(userId),
    getUserExamRoutines(userId),
  ]);

  const now = new Date();
  const reminders: ScheduledReminder[] = [];

  // Session reminders: 30 minutes before start.
  for (const session of sessions) {
    if (session.isCompleted) continue;

    const startTime =
      session.startTime instanceof Date ? session.startTime : safeParseDate(session.startTime);
    if (!startTime) continue;
    if (!isWithinSyncWindow(startTime, now)) continue;

    const reminderTime = new Date(startTime.getTime() - 30 * 60 * 1000);
    if (reminderTime.getTime() <= now.getTime()) continue;

    reminders.push({
      id: `reminder_session_${session.id}_30m`,
      userId,
      title: 'Study session starts soon',
      message: `${session.title} starts in 30 minutes.`,
      actionUrl: '/calendar',
      scheduledFor: reminderTime,
      sourceType: 'session',
      sourceId: session.id,
    });
  }

  // Exam reminders: 24 hours and 1 hour before start.
  for (const routine of examRoutines) {
    for (const exam of routine.exams || []) {
      if (!exam.id) continue;

      const examStart = parseExamDateTime(exam.date, exam.startTime || '09:00');
      if (!examStart) continue;
      if (!isWithinSyncWindow(examStart, now)) continue;

      const reminderOffsets = [
        { minutes: 24 * 60, label: '24h' as const },
        { minutes: 60, label: '1h' as const },
      ];

      for (const offset of reminderOffsets) {
        const reminderTime = new Date(examStart.getTime() - offset.minutes * 60 * 1000);
        if (reminderTime.getTime() <= now.getTime()) continue;

        reminders.push({
          id: `reminder_exam_${exam.id}_${offset.label}`,
          userId,
          title: `${exam.subjectName} exam reminder`,
          message:
            offset.label === '24h'
              ? `${exam.subjectName} exam is tomorrow.`
              : `${exam.subjectName} exam starts in 1 hour.`,
          actionUrl: '/exams',
          scheduledFor: reminderTime,
          sourceType: 'exam',
          sourceId: exam.id,
        });
      }
    }
  }

  const expectedIds = new Set(reminders.map((reminder) => reminder.id));

  for (const reminder of reminders) {
    await upsertScheduledReminder(reminder);
  }

  // Remove orphaned pending reminders that no longer match source data.
  const existingQuery = query(collection(db, COLLECTION_NAME), where('userId', '==', userId));
  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) {
    let batch = writeBatch(db);
    let count = 0;

    for (const docSnap of existingSnapshot.docs) {
      const data = docSnap.data();
      const isReminder = data.type === 'reminder';
      const isPending = !data.deliveredAt;

      if (isReminder && isPending && !expectedIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        count++;
      }

      if (count >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (window.Notification.permission === 'default') {
    return window.Notification.requestPermission();
  }

  return window.Notification.permission;
}

export function showBrowserNotification(notification: AppNotification): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;

  const browserNotification = new window.Notification(notification.title, {
    body: notification.message,
  });

  browserNotification.onclick = () => {
    window.focus();
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    browserNotification.close();
  };
}
