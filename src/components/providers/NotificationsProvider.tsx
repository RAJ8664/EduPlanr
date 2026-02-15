/**
 * Notifications Provider
 * Subscribes to realtime notifications and delivers due reminders.
 */

'use client';

import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore, useNotificationsStore } from '@/store';
import {
  getVisibleNotifications,
  markReminderAsDelivered,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  subscribeToUserNotifications,
  syncReminderNotifications,
} from '@/services/notificationsService';

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const { user, profile } = useAuthStore();
  const setNotifications = useNotificationsStore((state) => state.setNotifications);

  const deliveringRef = useRef<Set<string>>(new Set());
  const permissionRequestedRef = useRef(false);
  const notificationsEnabled = profile?.preferences?.notifications ?? true;

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }

    const delivering = deliveringRef.current;
    const unsubscribe = subscribeToUserNotifications(user.uid, async (allNotifications) => {
      const visibleNotifications = getVisibleNotifications(allNotifications);
      setNotifications(visibleNotifications);

      const dueReminders = allNotifications.filter((notification) => {
        if (notification.type !== 'reminder') return false;
        if (!notification.scheduledFor) return false;
        if (notification.deliveredAt) return false;
        return notification.scheduledFor.getTime() <= Date.now();
      });

      for (const reminder of dueReminders) {
        if (deliveringRef.current.has(reminder.id)) continue;
        deliveringRef.current.add(reminder.id);

        try {
          await markReminderAsDelivered(user.uid, reminder.id);

          if (notificationsEnabled) {
            toast(reminder.message, { icon: '⏰' });
            showBrowserNotification(reminder);
          }
        } catch (error) {
          console.error('Failed to deliver reminder:', error);
        } finally {
          deliveringRef.current.delete(reminder.id);
        }
      }
    });

    return () => {
      unsubscribe();
      delivering.clear();
    };
  }, [user?.uid, notificationsEnabled, setNotifications]);

  useEffect(() => {
    if (!user?.uid) return;

    let isCancelled = false;

    const runSync = async () => {
      if (isCancelled) return;
      try {
        await syncReminderNotifications(user.uid);
      } catch (error) {
        console.error('Reminder sync failed:', error);
      }
    };

    runSync();
    const interval = setInterval(runSync, 5 * 60 * 1000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !notificationsEnabled) return;
    if (permissionRequestedRef.current) return;

    permissionRequestedRef.current = true;
    requestBrowserNotificationPermission().catch((error) => {
      console.error('Notification permission request failed:', error);
    });
  }, [user?.uid, notificationsEnabled]);

  return <>{children}</>;
}
