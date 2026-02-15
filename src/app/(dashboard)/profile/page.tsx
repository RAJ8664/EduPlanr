/**
 * Profile Page
 * Basic account profile overview.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { UserCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { Card, Button, Avatar, Badge, PageHero } from '@/components/ui';
import { useAuthStore } from '@/store';

export default function ProfilePage() {
  const { user, profile } = useAuthStore();

  return (
    <div className="space-y-6">
      <PageHero
        tone="blue"
        icon={UserCircleIcon}
        title="Profile"
        subtitle="Your account identity, access status, and preferences at a glance."
        metrics={[
          { label: 'Account', value: user?.isAnonymous ? 'Guest' : 'Verified' },
          { label: 'Email', value: profile?.email || user?.email || 'No email' },
          { label: 'Timezone', value: profile?.preferences?.timezone || 'Not set' },
        ]}
        action={
          <Link href="/settings">
            <Button variant="secondary" leftIcon={<Cog6ToothIcon className="w-4 h-4" />}>
              Edit in Settings
            </Button>
          </Link>
        }
      />

      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <Avatar
            size="xl"
            name={profile?.displayName || user?.email || 'User'}
            src={profile?.photoURL || user?.photoURL}
          />
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2">
              <UserCircleIcon className="w-5 h-5 text-neon-cyan" />
              <h2 className="text-2xl font-semibold text-white truncate">
                {profile?.displayName || 'Unnamed User'}
              </h2>
            </div>
            <p className="text-gray-400 truncate">{profile?.email || user?.email || 'No email'}</p>
            <div className="flex items-center gap-2">
              <Badge variant={user?.isAnonymous ? 'yellow' : 'green'}>
                {user?.isAnonymous ? 'Anonymous Account' : 'Verified Account'}
              </Badge>
              {profile?.preferences?.timezone && (
                <Badge variant="default">{profile.preferences.timezone}</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
