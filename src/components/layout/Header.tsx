/**
 * Header Component
 * Top navigation bar with search, notifications, and user menu
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { cn, getGreeting } from '@/lib/utils';
import { useAuthStore, useUIStore, useNotificationsStore } from '@/store';
import { signOut } from '@/services/authService';
import { Avatar, Button } from '@/components/ui';
import { useClickOutside } from '@/hooks';

interface SearchTarget {
  href: string;
  keywords: string[];
}

const SEARCH_TARGETS: SearchTarget[] = [
  { href: '/dashboard', keywords: ['dashboard', 'overview', 'home'] },
  { href: '/calendar', keywords: ['calendar', 'session', 'schedule', 'plan'] },
  { href: '/subjects', keywords: ['subject', 'course', 'cgpa', 'semester'] },
  { href: '/syllabus', keywords: ['syllabus', 'topic', 'progress'] },
  { href: '/materials', keywords: ['material', 'document', 'file', 'resource'] },
  { href: '/notes', keywords: ['note', 'notes', 'markdown'] },
  { href: '/routine', keywords: ['routine', 'daily', 'habit', 'timetable'] },
  { href: '/exams', keywords: ['exam', 'test', 'assessment'] },
  { href: '/tutor', keywords: ['ai', 'tutor', 'chat', 'question', 'explain'] },
  { href: '/notifications', keywords: ['notification', 'alert', 'reminder'] },
  { href: '/settings', keywords: ['setting', 'profile', 'preference'] },
];

function resolveSearchHref(query: string): string {
  const normalized = query.toLowerCase();
  for (const target of SEARCH_TARGETS) {
    if (target.keywords.some((keyword) => normalized.includes(keyword) || keyword.includes(normalized))) {
      return target.href;
    }
  }
  return '/materials';
}

export function Header() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { theme, setTheme, sidebarCollapsed } = useUIStore();
  const { unreadCount } = useNotificationsStore();
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const userMenuRef = useClickOutside<HTMLDivElement>(() => setIsUserMenuOpen(false));

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setIsSearchOpen(false);
      return;
    }

    const href = resolveSearchHref(trimmedQuery);
    router.push(`${href}?q=${encodeURIComponent(trimmedQuery)}`);
    setIsSearchOpen(false);
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 z-30',
        'bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50',
        'flex items-center justify-between px-6',
        'transition-all duration-300',
        sidebarCollapsed ? 'left-20' : 'left-[260px]'
      )}
    >
      {/* Left section - Greeting */}
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm text-gray-400">{getGreeting()}</p>
          <h1 className="text-lg font-semibold text-white">
            {profile?.displayName || 'Student'}
          </h1>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="absolute right-10 top-1/2 -translate-y-1/2"
              >
                <form onSubmit={handleSearchSubmit}>
                  <input
                    type="text"
                    placeholder="Search materials, notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-dark-800 border border-dark-600 text-gray-100 placeholder-gray-500 text-sm focus:border-neon-cyan/50 focus:outline-none"
                    autoFocus
                  />
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="text-gray-400 hover:text-white"
          >
            <MagnifyingGlassIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-gray-400 hover:text-white"
        >
          {theme === 'dark' ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </Button>

        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/notifications')}
            className="text-gray-400 hover:text-white"
          >
            <BellIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-neon-pink text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-dark-600" />

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-dark-700/50 transition-colors"
          >
            <Avatar
              src={profile?.photoURL}
              name={profile?.displayName || 'User'}
              size="sm"
            />
            <span className="text-sm font-medium text-gray-200 hidden md:block">
              {profile?.displayName || 'User'}
            </span>
          </button>

          {/* Dropdown menu */}
          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-56 glass-card p-2 z-50"
              >
                {/* User info */}
                <div className="px-3 py-2 border-b border-dark-600/50 mb-2">
                  <p className="text-sm font-medium text-white truncate">
                    {profile?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {profile?.email || 'Anonymous'}
                  </p>
                </div>

                {/* Menu items */}
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push('/profile');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-dark-700/50 hover:text-white transition-colors"
                >
                  <UserCircleIcon className="w-5 h-5" />
                  <span className="text-sm">Profile</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    router.push('/settings');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-dark-700/50 hover:text-white transition-colors"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  <span className="text-sm">Settings</span>
                </button>

                <div className="border-t border-dark-600/50 my-2" />

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  <span className="text-sm">Sign out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
