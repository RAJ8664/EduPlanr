/**
 * Main Layout Component
 * Wraps authenticated pages with sidebar and header
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed } = useUIStore();
  const pathname = usePathname();

  const sectionAccent = (() => {
    if (pathname.startsWith('/calendar')) return 'calendar';
    if (pathname.startsWith('/subjects')) return 'subjects';
    if (pathname.startsWith('/syllabus')) return 'syllabus';
    if (pathname.startsWith('/materials') || pathname.startsWith('/notes')) return 'materials';
    if (pathname.startsWith('/routine')) return 'routine';
    if (pathname.startsWith('/exams')) return 'exams';
    if (pathname.startsWith('/tutor')) return 'tutor';
    if (pathname.startsWith('/notifications')) return 'notifications';
    if (pathname.startsWith('/settings') || pathname.startsWith('/profile')) return 'settings';
    return 'dashboard';
  })();

  return (
    <div className="min-h-screen bg-dark-950 app-shell">
      {/* Sidebar */}
      <Sidebar />

      {/* Header */}
      <Header />

      {/* Main content */}
      <motion.main
        className={cn(
          'pt-16 min-h-screen',
          'transition-all duration-300',
          sidebarCollapsed ? 'pl-20' : 'pl-[260px]'
        )}
        initial={false}
        animate={{ paddingLeft: sidebarCollapsed ? 80 : 260 }}
      >
        <div className="p-4 md:p-6">
          {children}
        </div>
      </motion.main>

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className={cn(
            'absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl',
            sectionAccent === 'calendar' && 'bg-cyan-400/15',
            sectionAccent === 'subjects' && 'bg-blue-400/15',
            sectionAccent === 'syllabus' && 'bg-indigo-400/15',
            sectionAccent === 'materials' && 'bg-emerald-400/15',
            sectionAccent === 'routine' && 'bg-teal-400/15',
            sectionAccent === 'exams' && 'bg-amber-400/15',
            sectionAccent === 'tutor' && 'bg-fuchsia-400/15',
            sectionAccent === 'notifications' && 'bg-rose-400/15',
            sectionAccent === 'settings' && 'bg-sky-400/15',
            sectionAccent === 'dashboard' && 'bg-cyan-400/15'
          )}
        />
        <div
          className={cn(
            'absolute -bottom-28 left-1/4 h-72 w-72 rounded-full blur-3xl',
            sectionAccent === 'calendar' && 'bg-sky-500/12',
            sectionAccent === 'subjects' && 'bg-blue-500/12',
            sectionAccent === 'syllabus' && 'bg-violet-500/12',
            sectionAccent === 'materials' && 'bg-emerald-500/12',
            sectionAccent === 'routine' && 'bg-teal-500/12',
            sectionAccent === 'exams' && 'bg-orange-500/12',
            sectionAccent === 'tutor' && 'bg-fuchsia-500/12',
            sectionAccent === 'notifications' && 'bg-pink-500/12',
            sectionAccent === 'settings' && 'bg-sky-500/12',
            sectionAccent === 'dashboard' && 'bg-cyan-500/12'
          )}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 cyber-grid opacity-20" />
      </div>
    </div>
  );
}
