/**
 * Dashboard Page
 * Main overview with stats, recent activities, and quick actions
 * Uses REAL Firebase data - no mock data
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ClockIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ChartBarIcon,
  PlusIcon,
  PlayIcon,
  SparklesIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader, Button, ProgressBar, CircularProgress, Badge } from '@/components/ui';
import { useAuthStore } from '@/store';
import { useTimer } from '@/hooks';
import { formatTimer, getGreeting } from '@/lib/utils';
import { getUserSubjects, getSubjectStats } from '@/services/subjectsService';
import { getUserSyllabi, calculateProgress } from '@/services/syllabusService';
import { Subject, Syllabus } from '@/types';

// Stats interface
interface DashboardStats {
  totalSubjects: number;
  ongoingSubjects: number;
  passedSubjects: number;
  failedSubjects: number;
  averageCgpa: number;
  syllabusProgress: number;
  totalTopics: number;
  completedTopics: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const timer = useTimer();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalSubjects: 0,
    ongoingSubjects: 0,
    passedSubjects: 0,
    failedSubjects: 0,
    averageCgpa: 0,
    syllabusProgress: 0,
    totalTopics: 0,
    completedTopics: 0,
  });
  const [recentSubjects, setRecentSubjects] = useState<Subject[]>([]);
  const [recentSyllabi, setRecentSyllabi] = useState<Syllabus[]>([]);

  // Fetch real data from Firebase
  const fetchDashboardData = useCallback(async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      // Fetch subjects
      const subjects = await getUserSubjects(user.uid);
      const subjectStats = await getSubjectStats(user.uid);

      // Fetch syllabi
      const syllabi = await getUserSyllabi(user.uid);

      // Calculate syllabus progress
      let totalTopics = 0;
      let completedTopics = 0;
      syllabi.forEach(s => {
        totalTopics += s.topics?.length || 0;
        completedTopics += s.topics?.filter(t => t.status === 'completed').length || 0;
      });

      const syllabusProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      setStats({
        totalSubjects: subjectStats.total,
        ongoingSubjects: subjectStats.ongoing,
        passedSubjects: subjectStats.passed,
        failedSubjects: subjectStats.failed,
        averageCgpa: subjectStats.averageCgpa,
        syllabusProgress,
        totalTopics,
        completedTopics,
      });

      // Set recent subjects (last 5)
      setRecentSubjects(subjects.slice(0, 5));

      // Set recent syllabi (last 3)
      setRecentSyllabi(syllabi.slice(0, 3));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const progressPercentage = stats.syllabusProgress;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-white font-display">
            {getGreeting()}, {profile?.displayName?.split(' ')[0] || 'Student'}! 👋
          </h1>
          <p className="text-gray-400 mt-1">
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<SparklesIcon className="w-5 h-5" />}
            onClick={() => router.push('/tutor')}
          >
            Ask AI Tutor
          </Button>
          <Button
            variant="primary"
            leftIcon={<PlayIcon className="w-5 h-5" />}
            onClick={() => timer.startStudySession(45)}
          >
            Start Session
          </Button>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="gradient" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400">Syllabus Progress</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.completedTopics}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}/ {stats.totalTopics} topics
                  </span>
                </p>
              </div>
              <CircularProgress
                value={progressPercentage}
                size={60}
                strokeWidth={6}
                variant={progressPercentage >= 100 ? 'success' : 'default'}
              />
            </div>
            <ProgressBar value={progressPercentage} className="mt-4" size="sm" />
          </Card>
        </motion.div>

        {/* Subjects Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card variant="gradient" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400">Subjects</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.passedSubjects}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}/ {stats.totalSubjects} passed
                  </span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neon-green/20 flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-neon-green" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              {stats.ongoingSubjects} ongoing • {stats.failedSubjects} failed
            </p>
          </Card>
        </motion.div>

        {/* Average CGPA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="gradient" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400">Average CGPA</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.averageCgpa > 0 ? stats.averageCgpa.toFixed(2) : 'N/A'}
                  <span className="text-sm font-normal text-gray-400">
                    {' '}/ 10
                  </span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neon-purple/20 flex items-center justify-center">
                <AcademicCapIcon className="w-6 h-6 text-neon-purple" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Based on {stats.passedSubjects} passed subjects
            </p>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card variant="gradient" className="h-full">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400">Quick Actions</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link href="/subjects">
                    <Button size="sm" variant="secondary">Subjects</Button>
                  </Link>
                  <Link href="/syllabus">
                    <Button size="sm" variant="secondary">Syllabus</Button>
                  </Link>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-neon-cyan/20 flex items-center justify-center">
                <ChartBarIcon className="w-6 h-6 text-neon-cyan" />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Study timer / Active session */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader
              title={timer.isRunning ? 'Active Session' : 'Quick Start'}
              subtitle={timer.isRunning ? 'Focus mode' : 'Begin a study session'}
              icon={<ClockIcon className="w-5 h-5" />}
            />

            {timer.isRunning ? (
              <div className="text-center py-8">
                <div className="text-6xl font-bold font-mono text-white mb-4">
                  {formatTimer(timer.remaining)}
                </div>
                <p className="text-gray-400 mb-6">
                  {timer.sessionType === 'study' ? '📚 Study session' : '☕ Break time'}
                </p>
                <ProgressBar
                  value={timer.progress}
                  className="max-w-md mx-auto mb-6"
                  variant={timer.sessionType === 'study' ? 'default' : 'success'}
                />
                <div className="flex items-center justify-center gap-3">
                  {timer.isPaused ? (
                    <Button variant="primary" onClick={timer.resumeTimer}>
                      Resume
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={timer.pauseTimer}>
                      Pause
                    </Button>
                  )}
                  <Button variant="ghost" onClick={timer.stopTimer}>
                    End Session
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[15, 25, 45, 60].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => timer.startStudySession(minutes)}
                    className="p-4 rounded-xl bg-dark-700/50 border border-dark-600/50 hover:border-neon-cyan/50 hover:bg-dark-700 transition-all group"
                  >
                    <p className="text-2xl font-bold text-white group-hover:text-neon-cyan transition-colors">
                      {minutes}
                    </p>
                    <p className="text-sm text-gray-400">minutes</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Recent Subjects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="h-full">
            <CardHeader
              title="Your Subjects"
              subtitle={`${stats.totalSubjects} total`}
              icon={<BookOpenIcon className="w-5 h-5" />}
              action={
                <Link href="/subjects">
                  <Button variant="ghost" size="sm">View all</Button>
                </Link>
              }
            />

            {recentSubjects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No subjects yet</p>
                <Link href="/subjects">
                  <Button variant="secondary" size="sm" leftIcon={<PlusIcon className="w-4 h-4" />}>
                    Add Subject
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSubjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="p-3 rounded-xl bg-dark-700/30 border border-dark-600/30 hover:border-dark-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {subject.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {subject.creditHours ? `${subject.creditHours} credits` : 'No credits set'}
                        </p>
                      </div>
                      <Badge
                        variant={
                          subject.status === 'passed'
                            ? 'green'
                            : subject.status === 'failed'
                              ? 'red'
                              : 'yellow'
                        }
                        size="sm"
                      >
                        {subject.status === 'passed' && subject.cgpa
                          ? `${subject.cgpa.toFixed(1)}`
                          : subject.status.charAt(0).toUpperCase() + subject.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link href="/subjects">
              <Button variant="secondary" fullWidth className="mt-4" leftIcon={<PlusIcon className="w-4 h-4" />}>
                Manage Subjects
              </Button>
            </Link>
          </Card>
        </motion.div>
      </div>

      {/* Recent Syllabi */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader
            title="Recent Syllabi"
            subtitle="Your study progress"
            icon={<BookOpenIcon className="w-5 h-5" />}
            action={
              <Link href="/syllabus">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            }
          />

          {recentSyllabi.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No syllabi yet. Add subjects to get started!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-dark-600/50">
                    <th className="pb-3 font-medium">Course</th>
                    <th className="pb-3 font-medium">Topics</th>
                    <th className="pb-3 font-medium">Progress</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {recentSyllabi.map((syllabus) => {
                    const progress = calculateProgress(syllabus);
                    const completedCount = syllabus.topics?.filter(t => t.status === 'completed').length || 0;
                    const totalCount = syllabus.topics?.length || 0;

                    return (
                      <tr key={syllabus.id} className="border-b border-dark-600/30 last:border-0">
                        <td className="py-4">
                          <span className="text-white font-medium">{syllabus.title}</span>
                        </td>
                        <td className="py-4 text-gray-300">
                          {completedCount} / {totalCount}
                        </td>
                        <td className="py-4">
                          <div className="w-24">
                            <ProgressBar value={progress} size="sm" />
                          </div>
                        </td>
                        <td className="py-4">
                          <Badge variant={progress === 100 ? 'green' : progress > 50 ? 'yellow' : 'default'}>
                            {progress}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
