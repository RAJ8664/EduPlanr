/**
 * Dashboard Layout
 * Wrapper for authenticated pages with sidebar navigation
 */

'use client';

import React from 'react';
import { AuthProvider, NotificationsProvider } from '@/components/providers';
import { MainLayout } from '@/components/layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <MainLayout>{children}</MainLayout>
      </NotificationsProvider>
    </AuthProvider>
  );
}
