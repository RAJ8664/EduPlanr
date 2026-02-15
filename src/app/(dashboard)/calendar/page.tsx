/**
 * Calendar Page
 * Study schedule visualization and session management with REAL Firebase data
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ClockIcon,
  AcademicCapIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addDays,
  setHours,
  setMinutes,
  isValid,
} from 'date-fns';
import { Card, CardHeader, Button, Badge, Modal, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { StudySession, SessionType, Subject } from '@/types';
import { useAuthStore } from '@/store';
import {
  getUserSessions,
  createSession,
  deleteSession,
  toggleSessionComplete,
} from '@/services/sessionsService';
import { getUserSubjects } from '@/services/subjectsService';
import { syncReminderNotifications } from '@/services/notificationsService';

const sessionTypeColors: Record<SessionType, string> = {
  study: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30',
  review: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
  break: 'bg-neon-green/20 text-neon-green border-neon-green/30',
  exam: 'bg-red-500/20 text-red-400 border-red-500/30',
  assignment: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/30',
};

export default function CalendarPage() {
  const { user } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionDesc, setNewSessionDesc] = useState('');
  const [newSessionType, setNewSessionType] = useState<SessionType>('study');
  const [newSessionSubjectId, setNewSessionSubjectId] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('09:00');
  const [newSessionDuration, setNewSessionDuration] = useState('60');

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      const [fetchedSessions, fetchedSubjects] = await Promise.all([
        getUserSessions(user.uid),
        getUserSubjects(user.uid)
      ]);
      setSessions(fetchedSessions);
      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar dates generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter sessions
  const getSessionsForDay = (date: Date) => {
    return sessions.filter((session) => isSameDay(session.startTime, date));
  };

  const selectedDateSessions = selectedDate ? getSessionsForDay(selectedDate) : [];

  const runReminderSync = useCallback((uid: string) => {
    void syncReminderNotifications(uid).catch((error) => {
      console.error('Failed to sync reminders:', error);
    });
  }, []);

  // Handlers
  const handleAddSession = async () => {
    if (!user?.uid || !selectedDate || !newSessionTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      const [hours, minutes] = newSessionTime.split(':').map(Number);
      const startTime = setMinutes(setHours(selectedDate, hours), minutes);
      const endTime = setMinutes(startTime, minutes + parseInt(newSessionDuration));

      const newSession = await createSession(user.uid, {
        title: newSessionTitle.trim(),
        description: newSessionDesc.trim(),
        subjectId: newSessionSubjectId || null,
        syllabusId: null,
        topicId: null,
        startTime,
        endTime,
        isCompleted: false,
        notes: '',
        type: newSessionType,
      });

      setSessions(prev => [...prev, newSession].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
      runReminderSync(user.uid);

      // Reset form
      setNewSessionTitle('');
      setNewSessionDesc('');
      setNewSessionType('study');
      setNewSessionSubjectId('');
      setIsAddModalOpen(false);
      toast.success('Session added!');
    } catch (error) {
      console.error('Error adding session:', error);
      toast.error('Failed to add session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user?.uid) return;
    if (!confirm('Delete this session?')) return;
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      runReminderSync(user.uid);
      toast.success('Session deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const handleToggleComplete = async (session: StudySession) => {
    if (!user?.uid) return;
    try {
      await toggleSessionComplete(session.id, !session.isCompleted);
      setSessions(prev =>
        prev.map(s => s.id === session.id ? { ...s, isCompleted: !s.isCompleted } : s)
      );
      runReminderSync(user.uid);
    } catch (error) {
      console.error('Error updating session:', error);
      toast.error('Failed to update session');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-white font-display">Calendar</h1>
          <p className="text-gray-400 mt-1">
            Plan and track your study sessions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button
            variant="primary"
            leftIcon={<PlusIcon className="w-5 h-5" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Session
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card>
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeftIcon className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRightIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const daySessions = getSessionsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isDayToday = isToday(day);

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'relative p-2 min-h-[80px] rounded-xl transition-all text-left',
                      'hover:bg-dark-700/50',
                      !isCurrentMonth && 'opacity-40',
                      isSelected && 'bg-dark-700/50 ring-2 ring-neon-cyan/50',
                      isDayToday && !isSelected && 'bg-dark-700/30'
                    )}
                  >
                    <span className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm',
                      isDayToday && 'bg-neon-cyan text-dark-900 font-bold',
                      !isDayToday && isCurrentMonth && 'text-gray-200',
                      !isDayToday && !isCurrentMonth && 'text-gray-500'
                    )}>
                      {format(day, 'd')}
                    </span>

                    {/* Dots for sessions */}
                    {daySessions.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {daySessions.slice(0, 3).map((session) => (
                          <div
                            key={session.id}
                            className={cn(
                              'h-1.5 rounded-full w-full',
                              session.type === 'exam' ? 'bg-red-500' : 'bg-neon-cyan',
                              session.isCompleted && 'opacity-50'
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Selected Date Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <CardHeader
              title={selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
              subtitle={`${selectedDateSessions.length} session${selectedDateSessions.length !== 1 ? 's' : ''}`}
              icon={<ClockIcon className="w-5 h-5" />}
            />

            {selectedDateSessions.length > 0 ? (
              <div className="space-y-3">
                {selectedDateSessions.map((session) => {
                  const subject = subjects.find(s => s.id === session.subjectId);

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all',
                        sessionTypeColors[session.type],
                        session.isCompleted && 'opacity-60 grayscale'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className={cn("font-medium text-white", session.isCompleted && "line-through")}>
                            {session.title}
                          </h4>
                          {session.description && (
                            <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                              {session.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleComplete(session)}
                          className={cn(
                            "p-1 rounded-full hover:bg-white/10 transition-colors",
                            session.isCompleted ? "text-neon-green" : "text-gray-500"
                          )}
                        >
                          <CheckCircleIcon className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {isValid(session.startTime) ? format(session.startTime, 'h:mm a') : 'N/A'}
                        </span>
                        {subject && (
                          <span className="flex items-center gap-1">
                            <AcademicCapIcon className="w-4 h-4" />
                            {subject.name}
                          </span>
                        )}
                        <span className="ml-auto">
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
                  <ClockIcon className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 mb-4">No sessions scheduled</p>
                <Button
                  variant="secondary"
                  onClick={() => setIsAddModalOpen(true)}
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                >
                  Add Session
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Add Session Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Session"
        description={`Schedule for ${selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}`}
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Calculus Review"
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Start Time</label>
              <input
                type="time"
                value={newSessionTime}
                onChange={(e) => setNewSessionTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Duration (mins)</label>
              <input
                type="number"
                value={newSessionDuration}
                onChange={(e) => setNewSessionDuration(e.target.value)}
                min="15"
                step="15"
                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
              <select
                value={newSessionType}
                onChange={(e) => setNewSessionType(e.target.value as SessionType)}
                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
              >
                <option value="study">Study</option>
                <option value="review">Review</option>
                <option value="exam">Exam</option>
                <option value="assignment">Assignment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Subject</label>
              <select
                value={newSessionSubjectId}
                onChange={(e) => setNewSessionSubjectId(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
              >
                <option value="">None</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              value={newSessionDesc}
              onChange={(e) => setNewSessionDesc(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddSession}>Add Session</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
