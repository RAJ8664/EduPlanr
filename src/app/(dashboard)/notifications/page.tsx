/**
 * Notifications Page
 * Lists in-app notifications with quick actions.
 */

'use client';

import React, { useState } from 'react';
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Card, Button, Badge, PageHero } from '@/components/ui';
import { useAuthStore, useNotificationsStore } from '@/store';
import { formatSmartDate } from '@/lib/utils';
import {
  clearUserNotifications,
  deleteNotificationById,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notificationsService';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
  } = useNotificationsStore();
  const [isWorking, setIsWorking] = useState(false);

  const sorted = [...notifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const handleMarkAllRead = async () => {
    if (!user?.uid || unreadCount === 0) return;
    setIsWorking(true);
    try {
      await markAllNotificationsAsRead(user.uid);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      toast.error('Failed to mark all as read');
    } finally {
      setIsWorking(false);
    }
  };

  const handleClearAll = async () => {
    if (!user?.uid || sorted.length === 0) return;
    setIsWorking(true);
    try {
      await clearUserNotifications(user.uid);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      toast.error('Failed to clear notifications');
    } finally {
      setIsWorking(false);
    }
  };

  const handleMarkOneRead = async (notificationId: string) => {
    if (!user?.uid) return;
    try {
      await markNotificationAsRead(user.uid, notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const handleDeleteOne = async (notificationId: string) => {
    if (!user?.uid) return;
    try {
      await deleteNotificationById(user.uid, notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        tone="rose"
        icon={BellIcon}
        title="Notifications"
        subtitle="See reminders, deadlines, and system updates in one focused feed."
        metrics={[
          { label: 'Total', value: sorted.length },
          { label: 'Unread', value: unreadCount },
          { label: 'Read', value: Math.max(0, sorted.length - unreadCount) },
        ]}
        action={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckIcon className="w-4 h-4" />}
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || isWorking}
            >
              Mark All Read
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<TrashIcon className="w-4 h-4" />}
              onClick={handleClearAll}
              disabled={sorted.length === 0 || isWorking}
            >
              Clear All
            </Button>
          </>
        }
      />

      {sorted.length === 0 ? (
        <Card className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
            <BellIcon className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400">You have no notifications yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium truncate">{item.title}</h3>
                    {!item.isRead && <Badge variant="neon">New</Badge>}
                  </div>
                  <p className="text-sm text-gray-400">{item.message}</p>
                  <p className="text-xs text-gray-500 mt-2">{formatSmartDate(item.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!item.isRead && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleMarkOneRead(item.id)}
                    >
                      Read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteOne(item.id)}
                    aria-label="Delete notification"
                  >
                    <TrashIcon className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
