/**
 * Settings Page
 * User preferences and application settings with REAL Firebase save
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  UserCircleIcon,
  BellIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  ClockIcon,
  GlobeAltIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ArrowRightOnRectangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader, Button, Input, Badge, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';
import {
  updateUserDisplayName,
  updateUserPreferences,
  compressImage,
  updateProfilePicture,
  signOut,
} from '@/services/authService';
import { deleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const settingSections: SettingSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'Manage your account information',
    icon: UserCircleIcon,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Control your notification preferences',
    icon: BellIcon,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Customize how EduPlanr looks',
    icon: PaintBrushIcon,
  },
  {
    id: 'study',
    title: 'Study Preferences',
    description: 'Configure your study session settings',
    icon: ClockIcon,
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    description: 'Manage your security settings',
    icon: ShieldCheckIcon,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const [activeSection, setActiveSection] = useState('profile');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states initialized with profile data
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [timezone, setTimezone] = useState(profile?.preferences?.timezone || 'America/New_York');

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailReminders: true,
    pushNotifications: true,
    sessionReminders: true,
    weeklyReports: true,
    achievements: true,
  });

  // Appearance settings
  const [appearance, setAppearance] = useState({
    theme: (profile?.preferences?.theme || 'dark') as 'light' | 'dark' | 'system',
    accentColor: 'cyan' as 'cyan' | 'purple' | 'pink' | 'green',
    compactMode: false,
  });

  // Study settings
  const [studySettings, setStudySettings] = useState({
    defaultSessionDuration: profile?.preferences?.defaultStudyDuration || 45,
    breakDuration: profile?.preferences?.breakDuration || 10,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: true,
    soundEnabled: profile?.preferences?.soundEnabled ?? true,
  });

  // Update local state when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setTimezone(profile.preferences?.timezone || 'America/New_York');
      setAppearance(prev => ({ ...prev, theme: profile.preferences?.theme || 'dark' }));
      setStudySettings(prev => ({
        ...prev,
        defaultSessionDuration: profile.preferences?.defaultStudyDuration || 45,
        breakDuration: profile.preferences?.breakDuration || 10,
        soundEnabled: profile.preferences?.soundEnabled ?? true
      }));
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user?.uid) return;
    setIsSaving(true);

    try {
      // 1. Update Profile (DisplayName)
      if (displayName !== profile?.displayName) {
        await updateUserDisplayName(displayName);
      }

      // 2. Update Preferences
      await updateUserPreferences(user.uid, {
        theme: appearance.theme,
        timezone: timezone,
        defaultStudyDuration: studySettings.defaultSessionDuration,
        breakDuration: studySettings.breakDuration,
        soundEnabled: studySettings.soundEnabled,
        notifications: notifications.pushNotifications
      });

      setIsDirty(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/login');
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you ABSOLUTELY sure? This action cannot be undone and will delete all your data.')) return;

    try {
      if (auth?.currentUser) {
        await deleteUser(auth.currentUser);
        router.push('/auth/login');
        toast.success('Account deleted');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Failed to delete account. You may need to re-login deeply first.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    // check if file is an image or not
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // check file size (e.g., max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const base64Image = await compressImage(file);
      await updateProfilePicture(base64Image, user.uid);
      if (profile) {
        useAuthStore.getState().setProfile({ ...profile, photoURL: base64Image });
      }
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to update profile picture');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* Avatar */}

            <div className="flex items-center gap-4">
              <Avatar
                name={displayName || user?.email || 'User'}
                src={profile?.photoURL || user?.photoURL}
                size="xl"
              />
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Change Photo'}
                </Button>
                <p className="text-xs text-gray-500 mt-1">Recommended: Square image, max 5MB</p>
              </div>
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setIsDirty(true);
                }}
              />
              <Input
                label="Email"
                type="email"
                value={user?.email || ''}
                disabled
                hint="Email cannot be changed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">GMT</option>
                <option value="Europe/Paris">Central European Time</option>
                <option value="Asia/Tokyo">Japan Standard Time</option>
              </select>
            </div>

            {/* Danger zone */}
            <div className="pt-6 border-t border-dark-600/50">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-400 mb-4">
                Permanently delete your account and all associated data.
              </p>
              <Button variant="danger" size="sm" onClick={handleDeleteAccount} leftIcon={<TrashIcon className="w-4 h-4" />}>
                Delete Account
              </Button>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            {Object.entries({
              emailReminders: { label: 'Email Reminders', description: 'Receive study session reminders via email' },
              pushNotifications: { label: 'Push Notifications', description: 'Browser notifications for important updates' },
              sessionReminders: { label: 'Session Reminders', description: 'Get notified before scheduled study sessions' },
              weeklyReports: { label: 'Weekly Reports', description: 'Receive weekly progress summaries' },
              achievements: { label: 'Achievements', description: 'Get notified when you earn achievements' },
            }).map(([key, { label, description }]) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl"
              >
                <div>
                  <h4 className="font-medium text-white">{label}</h4>
                  <p className="text-sm text-gray-400">{description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifications[key as keyof typeof notifications]}
                    onChange={(e) => {
                      setNotifications({ ...notifications, [key]: e.target.checked });
                      setIsDirty(true);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-neon-cyan/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
                </label>
              </div>
            ))}
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Theme
              </label>
              <div className="flex gap-3">
                {[
                  { value: 'light', icon: SunIcon, label: 'Light' },
                  { value: 'dark', icon: MoonIcon, label: 'Dark' },
                  { value: 'system', icon: ComputerDesktopIcon, label: 'System' },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setAppearance({ ...appearance, theme: value as typeof appearance.theme });
                      setIsDirty(true);
                    }}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                      appearance.theme === value
                        ? 'border-neon-cyan bg-neon-cyan/10'
                        : 'border-dark-600/50 hover:border-dark-500'
                    )}
                  >
                    <Icon className={cn('w-6 h-6', appearance.theme === value ? 'text-neon-cyan' : 'text-gray-400')} />
                    <span className={cn('text-sm', appearance.theme === value ? 'text-neon-cyan' : 'text-gray-400')}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Accent Color
              </label>
              <div className="flex gap-3">
                {[
                  { value: 'cyan', color: 'bg-neon-cyan' },
                  { value: 'purple', color: 'bg-neon-purple' },
                  { value: 'pink', color: 'bg-neon-pink' },
                  { value: 'green', color: 'bg-neon-green' },
                ].map(({ value, color }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setAppearance({ ...appearance, accentColor: value as typeof appearance.accentColor });
                      setIsDirty(true);
                    }}
                    className={cn(
                      'w-10 h-10 rounded-full transition-all',
                      color,
                      appearance.accentColor === value
                        ? 'ring-2 ring-offset-2 ring-offset-dark-900 ring-white'
                        : 'opacity-60 hover:opacity-100'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Compact mode */}
            <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl">
              <div>
                <h4 className="font-medium text-white">Compact Mode</h4>
                <p className="text-sm text-gray-400">Use less space in the interface</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={appearance.compactMode}
                  onChange={(e) => {
                    setAppearance({ ...appearance, compactMode: e.target.checked });
                    setIsDirty(true);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-neon-cyan/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
              </label>
            </div>
          </div>
        );

      case 'study':
        return (
          <div className="space-y-6">
            {/* Timer settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Focus Duration (minutes)
                </label>
                <input
                  type="number"
                  value={studySettings.defaultSessionDuration}
                  onChange={(e) => {
                    setStudySettings({ ...studySettings, defaultSessionDuration: parseInt(e.target.value) });
                    setIsDirty(true);
                  }}
                  min={5}
                  max={120}
                  className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Short Break (minutes)
                </label>
                <input
                  type="number"
                  value={studySettings.breakDuration}
                  onChange={(e) => {
                    setStudySettings({ ...studySettings, breakDuration: parseInt(e.target.value) });
                    setIsDirty(true);
                  }}
                  min={1}
                  max={30}
                  className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Long Break (minutes)
                </label>
                <input
                  type="number"
                  value={studySettings.longBreakDuration}
                  onChange={(e) => {
                    setStudySettings({ ...studySettings, longBreakDuration: parseInt(e.target.value) });
                    setIsDirty(true);
                  }}
                  min={5}
                  max={60}
                  className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Sessions Before Long Break
                </label>
                <input
                  type="number"
                  value={studySettings.sessionsBeforeLongBreak}
                  onChange={(e) => {
                    setStudySettings({ ...studySettings, sessionsBeforeLongBreak: parseInt(e.target.value) });
                    setIsDirty(true);
                  }}
                  min={2}
                  max={10}
                  className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                />
              </div>
            </div>

            {/* Toggle settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl">
                <div>
                  <h4 className="font-medium text-white">Auto-start Breaks</h4>
                  <p className="text-sm text-gray-400">Automatically start break timer after focus session</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={studySettings.autoStartBreaks}
                    onChange={(e) => {
                      setStudySettings({ ...studySettings, autoStartBreaks: e.target.checked });
                      setIsDirty(true);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-neon-cyan/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl">
                <div>
                  <h4 className="font-medium text-white">Sound Effects</h4>
                  <p className="text-sm text-gray-400">Play sounds when timer completes</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={studySettings.soundEnabled}
                    onChange={(e) => {
                      setStudySettings({ ...studySettings, soundEnabled: e.target.checked });
                      setIsDirty(true);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-600 peer-focus:ring-2 peer-focus:ring-neon-cyan/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan"></div>
                </label>
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            {/* Connected accounts */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Connected Accounts</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-white">Google</p>
                      <p className="text-sm text-gray-400">Connected</p>
                    </div>
                  </div>
                  <Badge variant="green">Connected</Badge>
                </div>
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Password</h3>
              <Button variant="secondary">Change Password</Button>
            </div>

            {/* Two-factor */}
            <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl">
              <div>
                <h4 className="font-medium text-white">Two-Factor Authentication</h4>
                <p className="text-sm text-gray-400">Add an extra layer of security</p>
              </div>
              <Button variant="secondary" size="sm">Enable</Button>
            </div>

            {/* Data export */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Your Data</h3>
              <div className="flex gap-3">
                <Button variant="secondary" size="sm">Export Data</Button>
                <Button variant="secondary" size="sm">Download Backup</Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white font-display">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and preferences</p>
      </motion.div>

      {/* Settings layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:w-64 flex-shrink-0"
        >
          <Card className="p-2">
            <nav className="space-y-1">
              {settingSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left',
                      activeSection === section.id
                        ? 'bg-neon-cyan/10 text-neon-cyan'
                        : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.title}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 pt-4 border-t border-dark-600/50">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-1"
        >
          <Card>
            <CardHeader
              title={settingSections.find((s) => s.id === activeSection)?.title || ''}
              subtitle={settingSections.find((s) => s.id === activeSection)?.description}
            />
            <div className="p-6">
              {renderSectionContent()}
            </div>

            {/* Save button */}
            {isDirty && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end gap-3 p-6 border-t border-dark-600/50"
              >
                <Button variant="secondary" onClick={() => setIsDirty(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
