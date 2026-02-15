/**
 * Sidebar Navigation Component
 * Main navigation sidebar with collapsible state
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  CalendarDaysIcon,
  BookOpenIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Calendar', href: '/calendar', icon: CalendarDaysIcon },
  { name: 'Materials', href: '/materials', icon: DocumentTextIcon },
  { name: 'Syllabus', href: '/syllabus', icon: BookOpenIcon },
  { name: 'Subjects', href: '/subjects', icon: AcademicCapIcon },
  { name: 'Routine', href: '/routine', icon: ClockIcon },
  { name: 'Exams', href: '/exams', icon: ClipboardDocumentListIcon },
  { name: 'Smart Tutor', href: '/tutor', icon: SparklesIcon },
];

const bottomNavigation: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <motion.aside
      className={cn(
        'fixed left-0 top-0 h-screen z-40',
        'bg-dark-900/80 backdrop-blur-xl border-r border-white/10',
        'flex flex-col transition-all duration-300'
      )}
      initial={false}
      animate={{ width: sidebarCollapsed ? 80 : 260 }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-neon-cyan">
            <span className="text-lg font-bold text-white font-display">E</span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-xl font-bold gradient-text font-display"
              >
                EduPlanr
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {!sidebarCollapsed && (
          <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-gray-500">
            Study Workspace
          </p>
        )}
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl',
                'transition-all duration-200 group relative',
                isActive
                  ? 'bg-gradient-to-r from-cyan-400/20 to-blue-500/15 text-white border border-cyan-300/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-cyan-300 to-blue-500"
                />
              )}

              <item.icon
                className={cn(
                  'w-6 h-6 flex-shrink-0 transition-colors',
                  isActive ? 'text-cyan-200' : 'text-gray-400 group-hover:text-white'
                )}
              />

              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-medium whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Badge */}
              {item.badge && item.badge > 0 && (
                <span className="ml-auto px-2 py-0.5 text-xs font-medium rounded-full bg-neon-cyan/20 text-neon-cyan">
                  {item.badge}
                </span>
              )}

              {/* Tooltip for collapsed state */}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-2 px-3 py-2 bg-dark-700 border border-white/10 rounded-lg text-sm font-medium text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="py-4 px-3 border-t border-white/10">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl',
                'transition-all duration-200 group',
                isActive
                  ? 'bg-white/8 text-white border border-white/15'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-medium"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-3 mt-2 rounded-xl',
            'text-gray-400 hover:text-white hover:bg-white/5',
            'transition-all duration-200'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRightIcon className="w-6 h-6 mx-auto" />
          ) : (
            <>
              <ChevronLeftIcon className="w-6 h-6" />
              <span className="font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
