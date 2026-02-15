/**
 * Notifications Page
 * Lists in-app notifications with quick actions.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BellIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Card, Button, Badge } from '@/components/ui';
import { useNotificationsStore } from '@/store';
import { formatSmartDate } from '@/lib/utils';

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotificationsStore();

  const sorted = [...notifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-white font-display">Notifications</h1>
          <p className="text-gray-400 mt-1">
            {sorted.length} total • {unreadCount} unread
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CheckIcon className="w-4 h-4" />}
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<TrashIcon className="w-4 h-4" />}
            onClick={clearAll}
            disabled={sorted.length === 0}
          >
            Clear All
          </Button>
        </div>
      </motion.div>

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
                      onClick={() => markAsRead(item.id)}
                    >
                      Read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeNotification(item.id)}
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
