/**
 * Settings Page
 * User preferences and application settings with REAL Firebase save
 */

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  UserCircleIcon,
  BellIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  ClockIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ArrowRightOnRectangleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader, Button, Input, Badge, Avatar } from '@/components/ui';
import { cn, parseErrorMessage } from '@/lib/utils';
import { useAuthStore, useUIStore } from '@/store';
import {
  updateUserDisplayName,
  updateUserPreferences,
  compressImage,
  updateProfilePicture,
  exportUserData,
  deleteUserData,
  resetPassword,
  signOut,
} from '@/services/authService';
import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { requestBrowserNotificationPermission } from '@/services/notificationsService';
import type { UserProfile } from '@/types';

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

type AccentColor = 'cyan' | 'purple' | 'pink' | 'green';

interface NotificationSettings {
  emailReminders: boolean;
  pushNotifications: boolean;
  sessionReminders: boolean;
  weeklyReports: boolean;
  achievements: boolean;
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: AccentColor;
  compactMode: boolean;
}

interface StudySettings {
  defaultSessionDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  soundEnabled: boolean;
}

interface SettingsSnapshot {
  displayName: string;
  timezone: string;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
  studySettings: StudySettings;
}

const DEFAULT_TIMEZONE = 'America/New_York';

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailReminders: true,
  pushNotifications: true,
  sessionReminders: true,
  weeklyReports: true,
  achievements: true,
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  accentColor: 'cyan',
  compactMode: false,
};

const DEFAULT_STUDY: StudySettings = {
  defaultSessionDuration: 45,
  breakDuration: 10,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: true,
  soundEnabled: true,
};

function createSnapshot(profile: UserProfile | null, fallbackName: string): SettingsSnapshot {
  const preferences = profile?.preferences;
  return {
    displayName: profile?.displayName || fallbackName,
    timezone: preferences?.timezone || DEFAULT_TIMEZONE,
    notifications: {
      emailReminders: preferences?.emailReminders ?? DEFAULT_NOTIFICATIONS.emailReminders,
      pushNotifications: preferences?.notifications ?? DEFAULT_NOTIFICATIONS.pushNotifications,
      sessionReminders: preferences?.sessionReminders ?? DEFAULT_NOTIFICATIONS.sessionReminders,
      weeklyReports: preferences?.weeklyReports ?? DEFAULT_NOTIFICATIONS.weeklyReports,
      achievements: preferences?.achievements ?? DEFAULT_NOTIFICATIONS.achievements,
    },
    appearance: {
      theme: preferences?.theme || DEFAULT_APPEARANCE.theme,
      accentColor: preferences?.accentColor || DEFAULT_APPEARANCE.accentColor,
      compactMode: preferences?.compactMode ?? DEFAULT_APPEARANCE.compactMode,
    },
    studySettings: {
      defaultSessionDuration:
        preferences?.defaultStudyDuration || DEFAULT_STUDY.defaultSessionDuration,
      breakDuration: preferences?.breakDuration || DEFAULT_STUDY.breakDuration,
      longBreakDuration: preferences?.longBreakDuration || DEFAULT_STUDY.longBreakDuration,
      sessionsBeforeLongBreak:
        preferences?.sessionsBeforeLongBreak || DEFAULT_STUDY.sessionsBeforeLongBreak,
      autoStartBreaks: preferences?.autoStartBreaks ?? DEFAULT_STUDY.autoStartBreaks,
      soundEnabled: preferences?.soundEnabled ?? DEFAULT_STUDY.soundEnabled,
    },
  };
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
  const { user, profile, setProfile } = useAuthStore();
  const setTheme = useUIStore((state) => state.setTheme);
  const [activeSection, setActiveSection] = useState('profile');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<SettingsSnapshot | null>(null);

  // Form states initialized with profile data
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);

  // Appearance settings
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  // Study settings
  const [studySettings, setStudySettings] = useState<StudySettings>(DEFAULT_STUDY);

  const parseIntOrFallback = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const applySnapshot = (snapshot: SettingsSnapshot) => {
    setDisplayName(snapshot.displayName);
    setTimezone(snapshot.timezone);
    setNotifications(snapshot.notifications);
    setAppearance(snapshot.appearance);
    setStudySettings(snapshot.studySettings);
  };

  // Update local state when auth/profile changes.
  useEffect(() => {
    const fallbackName =
      user?.displayName || user?.email?.split('@')[0] || profile?.displayName || 'Student';
    const snapshot = createSnapshot(profile, fallbackName);
    applySnapshot(snapshot);
    setInitialSnapshot(snapshot);
    setIsDirty(false);
  }, [profile, user?.displayName, user?.email]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    setNotificationPermission(window.Notification.permission);
  }, []);

  const connectedProviders = useMemo(() => {
    if (user?.isAnonymous) {
      return [
        {
          id: 'anonymous',
          label: 'Guest Session',
          detail: 'Anonymous account',
        },
      ];
    }

    const providers = user?.providerData || [];
    if (providers.length === 0) {
      return [
        {
          id: 'account',
          label: 'Account',
          detail: 'Primary sign-in',
        },
      ];
    }

    return providers.map((provider) => {
      if (provider.providerId === 'google.com') {
        return {
          id: provider.providerId,
          label: 'Google',
          detail: provider.email || 'Connected',
        };
      }

      if (provider.providerId === 'password') {
        return {
          id: provider.providerId,
          label: 'Email & Password',
          detail: provider.email || 'Connected',
        };
      }

      return {
        id: provider.providerId,
        label: provider.providerId,
        detail: provider.email || 'Connected',
      };
    });
  }, [user?.isAnonymous, user?.providerData]);

  const handleSave = async () => {
    if (!user?.uid) return;
    setIsSaving(true);

    try {
      // 1. Update Profile (DisplayName)
      if (displayName !== profile?.displayName) {
        await updateUserDisplayName(displayName);
      }

      // 2. Update Preferences
      const nextPreferences = {
        theme: appearance.theme,
        timezone,
        defaultStudyDuration: studySettings.defaultSessionDuration,
        breakDuration: studySettings.breakDuration,
        longBreakDuration: studySettings.longBreakDuration,
        sessionsBeforeLongBreak: studySettings.sessionsBeforeLongBreak,
        autoStartBreaks: studySettings.autoStartBreaks,
        soundEnabled: studySettings.soundEnabled,
        notifications: notifications.pushNotifications,
        emailReminders: notifications.emailReminders,
        sessionReminders: notifications.sessionReminders,
        weeklyReports: notifications.weeklyReports,
        achievements: notifications.achievements,
        accentColor: appearance.accentColor,
        compactMode: appearance.compactMode,
      } as const;

      await updateUserPreferences(user.uid, {
        ...nextPreferences,
      });

      setTheme(appearance.theme);
      if (profile) {
        setProfile({
          ...profile,
          displayName,
          updatedAt: new Date(),
          preferences: {
            ...profile.preferences,
            ...nextPreferences,
          },
        });
      }

      const savedSnapshot: SettingsSnapshot = {
        displayName,
        timezone,
        notifications,
        appearance,
        studySettings,
      };
      setInitialSnapshot(savedSnapshot);
      setIsDirty(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(parseErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!initialSnapshot) return;
    applySnapshot(initialSnapshot);
    setIsDirty(false);
  };

  const handleChangePassword = async () => {
    if (!user) return;

    const providerIds = user.providerData.map((provider) => provider.providerId);
    if (!providerIds.includes('password')) {
      window.open('https://myaccount.google.com/security', '_blank', 'noopener,noreferrer');
      toast.success('Manage password from your Google account settings');
      return;
    }

    if (!user.email) {
      toast.error('No email found for this account');
      return;
    }

    try {
      await resetPassword(user.email);
      toast.success('Password reset email sent');
    } catch (error) {
      toast.error(parseErrorMessage(error));
    }
  };

  const handleManageSecurity = async () => {
    try {
      const permission = await requestBrowserNotificationPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        toast.success('Browser notifications enabled');
      } else if (permission === 'denied') {
        toast.error('Notifications are blocked. Enable them in browser settings.');
      } else if (permission === 'unsupported') {
        toast.error('Browser notifications are not supported');
      }
    } catch (error) {
      toast.error(parseErrorMessage(error));
    }
  };

  const downloadJson = (filename: string, payload: Record<string, unknown>) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleDataExport = async (kind: 'export' | 'backup') => {
    if (!user?.uid) return;

    setIsExporting(true);
    try {
      const data = await exportUserData(user.uid);
      const today = new Date().toISOString().split('T')[0];
      const payload: Record<string, unknown> = {
        ...data,
        exportKind: kind,
        schemaVersion: 1,
      };
      const filename =
        kind === 'backup'
          ? `eduplanr-backup-${today}.json`
          : `eduplanr-export-${today}.json`;

      downloadJson(filename, payload);
      toast.success(kind === 'backup' ? 'Backup downloaded' : 'Data export downloaded');
    } catch (error) {
      toast.error(parseErrorMessage(error));
    } finally {
      setIsExporting(false);
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
      if (!auth?.currentUser || !user?.uid) return;

      const currentUser = auth.currentUser;
      const providerIds = currentUser.providerData.map((provider) => provider.providerId);

      // Re-authenticate before destructive operations to avoid partial delete states.
      if (providerIds.includes('google.com')) {
        await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      } else if (providerIds.includes('password')) {
        const password = window.prompt('Please enter your password to confirm account deletion:');
        if (!password) {
          toast.error('Account deletion cancelled');
          return;
        }
        if (!currentUser.email) {
          throw new Error('No email found for this account');
        }
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }

      await deleteUserData(user.uid);
      await deleteUser(currentUser);
      router.push('/auth/login');
      toast.success('Account and data deleted');
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error(parseErrorMessage(error));
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
        setProfile({ ...profile, photoURL: base64Image, updatedAt: new Date() });
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
                    setStudySettings({
                      ...studySettings,
                      defaultSessionDuration: parseIntOrFallback(
                        e.target.value,
                        studySettings.defaultSessionDuration
                      ),
                    });
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
                    setStudySettings({
                      ...studySettings,
                      breakDuration: parseIntOrFallback(e.target.value, studySettings.breakDuration),
                    });
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
                    setStudySettings({
                      ...studySettings,
                      longBreakDuration: parseIntOrFallback(
                        e.target.value,
                        studySettings.longBreakDuration
                      ),
                    });
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
                    setStudySettings({
                      ...studySettings,
                      sessionsBeforeLongBreak: parseIntOrFallback(
                        e.target.value,
                        studySettings.sessionsBeforeLongBreak
                      ),
                    });
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
                {connectedProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-dark-600 text-white flex items-center justify-center text-sm font-semibold">
                        {provider.label.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{provider.label}</p>
                        <p className="text-sm text-gray-400">{provider.detail}</p>
                      </div>
                    </div>
                    <Badge variant="green">Connected</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Password */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Password</h3>
              <Button variant="secondary" onClick={() => void handleChangePassword()}>
                Change Password
              </Button>
            </div>

            {/* Browser alerts */}
            <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-xl">
              <div>
                <h4 className="font-medium text-white">Browser Notification Access</h4>
                <p className="text-sm text-gray-400">
                  Current status:{' '}
                  {notificationPermission === 'unsupported'
                    ? 'Not supported'
                    : notificationPermission}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void handleManageSecurity()}>
                {notificationPermission === 'granted' ? 'Refresh' : 'Enable'}
              </Button>
            </div>

            {/* Data export */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Your Data</h3>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => void handleDataExport('export')}
                >
                  Export Data
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isExporting}
                  onClick={() => void handleDataExport('backup')}
                >
                  Download Backup
                </Button>
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
                <Button variant="secondary" onClick={handleCancel}>
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
