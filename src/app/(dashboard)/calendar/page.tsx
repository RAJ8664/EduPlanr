/**
 * Calendar Page
 * Study schedule visualization and session management with REAL Firebase data
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ClockIcon,
  AcademicCapIcon,
  MapPinIcon,
  SparklesIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
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
  setHours,
  setMinutes,
  isValid,
} from 'date-fns';
import { Card, CardHeader, Button, Badge, Modal, Input, PageHero } from '@/components/ui';
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
import { getUserExamRoutines } from '@/services/examRoutineService';

const sessionTypeColors: Record<SessionType, string> = {
  study: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30',
  review: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
  break: 'bg-neon-green/20 text-neon-green border-neon-green/30',
  exam: 'bg-red-500/20 text-red-400 border-red-500/30',
  assignment: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/30',
};

const sessionPillColors: Record<SessionType, string> = {
  study: 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30',
  review: 'bg-neon-purple/15 text-neon-purple border-neon-purple/30',
  break: 'bg-neon-green/15 text-neon-green border-neon-green/30',
  exam: 'bg-red-500/15 text-red-300 border-red-500/30',
  assignment: 'bg-neon-yellow/15 text-neon-yellow border-neon-yellow/30',
};

interface CalendarExamEvent {
  id: string;
  routineId: string;
  routineName: string;
  subjectName: string;
  venue: string;
  notes: string;
  startTime: Date;
  endTime: Date;
}

type SessionCalendarEvent = {
  id: string;
  kind: 'session';
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  subjectName?: string;
  sessionType: SessionType;
  isCompleted: boolean;
  sessionId: string;
};

type ExamCalendarEvent = {
  id: string;
  kind: 'exam';
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  subjectName: string;
  venue: string;
  routineName: string;
};

type CalendarEvent = SessionCalendarEvent | ExamCalendarEvent;

interface SmartReminder {
  id: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel?: string;
  actionHref?: string;
}

function toSafeDate(dateStr: string, timeStr: string | undefined, fallbackTime: string): Date | null {
  if (!dateStr) return null;
  const time = timeStr && /^\d{1,2}:\d{2}$/.test(timeStr) ? timeStr : fallbackTime;
  const parsed = new Date(`${dateStr}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function CalendarPage() {
  const { user } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [examEvents, setExamEvents] = useState<CalendarExamEvent[]>([]);
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
      const [fetchedSessions, fetchedSubjects, fetchedExamRoutines] = await Promise.all([
        getUserSessions(user.uid),
        getUserSubjects(user.uid),
        getUserExamRoutines(user.uid),
      ]);

      const flattenedExams: CalendarExamEvent[] = fetchedExamRoutines.flatMap((routine) =>
        (routine.exams || []).flatMap((exam, examIndex) => {
          const startTime = toSafeDate(exam.date, exam.startTime, '09:00');
          const parsedEndTime = toSafeDate(exam.date, exam.endTime, exam.startTime || '10:00');
          if (!startTime || !parsedEndTime) return [];

          const endTime =
            parsedEndTime.getTime() > startTime.getTime()
              ? parsedEndTime
              : new Date(startTime.getTime() + 60 * 60 * 1000);

          return [
            {
              id: exam.id || `${routine.id}_${examIndex}_${exam.date}`,
              routineId: routine.id,
              routineName: routine.name,
              subjectName: exam.subjectName || 'Exam',
              venue: exam.venue || '',
              notes: exam.notes || '',
              startTime,
              endTime,
            },
          ];
        })
      );

      setSessions(fetchedSessions);
      setSubjects(fetchedSubjects);
      setExamEvents(flattenedExams.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()));
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

  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects]
  );

  const allCalendarEvents = useMemo<CalendarEvent[]>(() => {
    const sessionEvents: CalendarEvent[] = sessions.map((session) => ({
      id: `session_${session.id}`,
      kind: 'session',
      title: session.title,
      description: session.description || '',
      startTime: session.startTime,
      endTime: session.endTime,
      subjectName: session.subjectId ? subjectNameById.get(session.subjectId) : undefined,
      sessionType: session.type,
      isCompleted: session.isCompleted,
      sessionId: session.id,
    }));

    const examCalendarEvents: CalendarEvent[] = examEvents.map((exam) => ({
      id: `exam_${exam.routineId}_${exam.id}`,
      kind: 'exam',
      title: `${exam.subjectName} Exam`,
      description: exam.notes,
      startTime: exam.startTime,
      endTime: exam.endTime,
      subjectName: exam.subjectName,
      venue: exam.venue,
      routineName: exam.routineName,
    }));

    return [...sessionEvents, ...examCalendarEvents].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
  }, [examEvents, sessions, subjectNameById]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of allCalendarEvents) {
      const key = format(event.startTime, 'yyyy-MM-dd');
      const dayEvents = map.get(key);
      if (dayEvents) {
        dayEvents.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return map;
  }, [allCalendarEvents]);

  const getEventsForDay = useCallback(
    (date: Date) => eventsByDay.get(format(date, 'yyyy-MM-dd')) || [],
    [eventsByDay]
  );

  const selectedDateEvents = useMemo(
    () => (selectedDate ? getEventsForDay(selectedDate) : []),
    [getEventsForDay, selectedDate]
  );

  const smartReminders = useMemo<SmartReminder[]>(() => {
    if (!selectedDate) return [];

    const reminders: SmartReminder[] = [];
    const now = Date.now();

    if (selectedDateEvents.length === 0) {
      reminders.push({
        id: 'free-slot',
        title: 'Open day detected',
        message: 'Use this free space for a 45-60 minute focused revision session.',
        priority: 'medium',
      });
    }

    const nextExam = examEvents
      .filter((exam) => exam.startTime.getTime() > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

    if (nextExam) {
      const hoursLeft = Math.max(
        1,
        Math.floor((nextExam.startTime.getTime() - now) / (60 * 60 * 1000))
      );

      if (hoursLeft <= 24) {
        reminders.push({
          id: 'next-exam-urgent',
          title: `${nextExam.subjectName} exam in ${hoursLeft}h`,
          message: `${format(nextExam.startTime, 'EEE, h:mm a')}${nextExam.venue ? ` at ${nextExam.venue}` : ''}.`,
          priority: 'high',
          actionLabel: 'Open exam routine',
          actionHref: '/exams',
        });
      } else if (hoursLeft <= 72) {
        reminders.push({
          id: 'next-exam-soon',
          title: `${nextExam.subjectName} exam this week`,
          message: `Starts ${format(nextExam.startTime, 'EEEE, h:mm a')}. Plan at least one revision block.`,
          priority: 'medium',
          actionLabel: 'Open exam routine',
          actionHref: '/exams',
        });
      }
    }

    if (isToday(selectedDate)) {
      const pendingToday = selectedDateEvents.filter(
        (event) => event.kind === 'session' && !event.isCompleted
      );
      if (pendingToday.length > 0) {
        reminders.push({
          id: 'today-pending',
          title: `${pendingToday.length} pending session${pendingToday.length > 1 ? 's' : ''} today`,
          message: 'Complete or reschedule them to avoid rollover to tomorrow.',
          priority: 'low',
        });
      }
    }

    if (reminders.length === 0) {
      reminders.push({
        id: 'balanced-plan',
        title: 'Schedule looks balanced',
        message: 'No urgent reminders right now. Keep your current rhythm.',
        priority: 'low',
      });
    }

    return reminders.slice(0, 3);
  }, [examEvents, selectedDate, selectedDateEvents]);

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

  const handleToggleComplete = async (sessionId: string, nextCompletedValue: boolean) => {
    if (!user?.uid) return;
    try {
      await toggleSessionComplete(sessionId, nextCompletedValue);
      setSessions(prev =>
        prev.map((session) =>
          session.id === sessionId ? { ...session, isCompleted: nextCompletedValue } : session
        )
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
      <PageHero
        tone="cyan"
        icon={ClockIcon}
        title="Calendar"
        subtitle="Unified timeline for sessions, exams, and smart reminders"
        metrics={[
          { label: 'Sessions', value: sessions.length },
          { label: 'Exams', value: examEvents.length },
          { label: 'Smart Tips', value: smartReminders.length },
        ]}
        action={
          <>
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
          </>
        }
      />

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

            {/* Calendar Weeks */}
            <div className="flex flex-col gap-1">
              {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => {
                const week = days.slice(weekIndex * 7, (weekIndex + 1) * 7);

                const validDays = week.filter(Boolean);
                if (validDays.length === 0) return null;
                const weekStartTime = setHours(validDays[0], 0).getTime();
                const weekEndTime = new Date(validDays[validDays.length - 1]).setHours(23, 59, 59, 999);

                const weekEvents = allCalendarEvents.filter(e => {
                  const eStart = new Date(e.startTime).getTime();
                  const eEnd = new Date(e.endTime).getTime();
                  return eStart <= weekEndTime && eEnd >= weekStartTime;
                }).sort((a, b) => {
                  const aStart = new Date(a.startTime).getTime();
                  const bStart = new Date(b.startTime).getTime();
                  if (aStart !== bStart) return aStart - bStart;
                  const aDur = new Date(a.endTime).getTime() - aStart;
                  const bDur = new Date(b.endTime).getTime() - bStart;
                  return bDur - aDur;
                });

                const tracks: CalendarEvent[][] = [];
                const eventPositions = new Map<string, { track: number, startCol: number, span: number }>();

                weekEvents.forEach(event => {
                  const eStart = new Date(event.startTime);
                  const eEnd = new Date(event.endTime);

                  let startCol = 0;
                  const dayIdx = week.findIndex(d => d && isSameDay(d, eStart));
                  if (dayIdx !== -1) startCol = dayIdx;

                  let endCol = 6;
                  const endDayIdx = week.findIndex(d => d && isSameDay(d, eEnd));
                  if (endDayIdx !== -1) endCol = endDayIdx;

                  const span = endCol - startCol + 1;

                  let trackIdx = 0;
                  while (true) {
                    if (!tracks[trackIdx]) tracks[trackIdx] = [];
                    let overlaps = false;
                    for (const placed of tracks[trackIdx]) {
                      const pos = eventPositions.get(placed.id)!;
                      const placedStart = pos.startCol;
                      const placedEnd = pos.startCol + pos.span - 1;
                      const myEnd = startCol + span - 1;
                      if (!(myEnd < placedStart || startCol > placedEnd)) {
                        overlaps = true;
                        break;
                      }
                    }
                    if (!overlaps) {
                      tracks[trackIdx].push(event);
                      eventPositions.set(event.id, { track: trackIdx, startCol, span });
                      break;
                    }
                    trackIdx++;
                  }
                });

                const trackHeight = 24;
                const minCellHeight = 90;
                const totalHeight = Math.max(minCellHeight, 36 + tracks.length * trackHeight);

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: weekIndex * 0.05 }}
                    key={weekIndex}
                    className="relative grid grid-cols-7 gap-1"
                    style={{ minHeight: `${totalHeight}px` }}
                  >
                    {/* Day Cells */}
                    {week.map((day, index) => {
                      if (!day) return <div key={index} className="rounded-xl bg-dark-800/10" style={{ minHeight: `${totalHeight}px` }} />;

                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isDayToday = isToday(day);

                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            'p-2 rounded-xl transition-all text-left flex flex-col',
                            'hover:bg-dark-700/50',
                            !isCurrentMonth && 'opacity-40',
                            isSelected && 'bg-dark-700/50 ring-2 ring-neon-cyan/50',
                            isDayToday && !isSelected && 'bg-dark-700/30'
                          )}
                          style={{ minHeight: `${totalHeight}px` }}
                        >
                          <span className={cn(
                            'inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm z-10 relative mb-1',
                            isDayToday && 'bg-neon-cyan text-dark-900 font-bold',
                            !isDayToday && isCurrentMonth && 'text-gray-200',
                            !isDayToday && !isCurrentMonth && 'text-gray-500'
                          )}>
                            {format(day, 'd')}
                          </span>
                        </button>
                      );
                    })}

                    {/* Spanning Event Blocks */}
                    {weekEvents.map(event => {
                      const pos = eventPositions.get(event.id)!;
                      const blockColorClass = event.kind === 'exam'
                        ? 'bg-red-500/80 text-white border-red-500'
                        : sessionPillColors[event.sessionType || 'study'].replace('/15', '/40').replace(/text-\S+/, 'text-white border border-white/10');

                      // Slightly dim completed sessions
                      const completedClass = (event.kind === 'session' && event.isCompleted) ? 'opacity-40 grayscale' : '';

                      return (
                        <motion.div
                          layoutId={`event-${event.id}`}
                          key={`${event.id}-${weekIndex}`}
                          className={cn(
                            'absolute h-[20px] rounded px-1.5 text-[10px] font-medium truncate flex items-center shadow-sm cursor-pointer transition-transform hover:scale-[1.02] z-20 text-white',
                            blockColorClass,
                            completedClass,
                            'backdrop-blur-sm shadow-black/20'
                          )}
                          style={{
                            left: `calc(${(pos.startCol / 7) * 100}% + 4px)`,
                            width: `calc(${(pos.span / 7) * 100}% - 8px)`,
                            top: `${34 + pos.track * trackHeight}px`
                          }}
                        >
                          <span className="truncate drop-shadow-md">
                            {(pos.startCol === week.findIndex(d => d && isSameDay(d, new Date(event.startTime))))
                              ? `${isValid(event.startTime) ? format(event.startTime, 'HH:mm') : '--:--'} ${event.title}`
                              : event.title}
                          </span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
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
              subtitle={`${selectedDateEvents.length} event${selectedDateEvents.length !== 1 ? 's' : ''}`}
              icon={<ClockIcon className="w-5 h-5" />}
            />

            {selectedDateEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDateEvents.map((event) =>
                  event.kind === 'session' ? (
                    <div
                      key={event.id}
                      className={cn(
                        'p-4 rounded-xl border transition-all',
                        sessionTypeColors[event.sessionType || 'study'],
                        event.isCompleted && 'opacity-60 grayscale'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className={cn('font-medium text-white', event.isCompleted && 'line-through')}>
                              {event.title}
                            </h4>
                            {event.sessionType && (
                              <Badge size="sm" variant="outline" className="capitalize">
                                {event.sessionType}
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleComplete(event.sessionId, !event.isCompleted)}
                          className={cn(
                            'p-1 rounded-full hover:bg-white/10 transition-colors',
                            event.isCompleted ? 'text-neon-green' : 'text-gray-500'
                          )}
                        >
                          <CheckCircleIcon className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {isValid(event.startTime) ? format(event.startTime, 'h:mm a') : 'N/A'}
                        </span>
                        {event.subjectName && (
                          <span className="flex items-center gap-1">
                            <AcademicCapIcon className="w-4 h-4" />
                            {event.subjectName}
                          </span>
                        )}
                        <span className="ml-auto">
                          <button
                            onClick={() => handleDeleteSession(event.sessionId)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={event.id}
                      className="p-4 rounded-xl border border-red-500/30 bg-red-500/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">{event.title}</h4>
                            <Badge size="sm" variant="red">Exam</Badge>
                          </div>
                          {event.routineName && (
                            <p className="text-sm text-red-300/90 mt-0.5">
                              {event.routineName}
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <Link
                          href="/exams"
                          className="text-red-300 hover:text-red-200 transition-colors"
                          aria-label="Open Exams page"
                        >
                          <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                        </Link>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-300">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {isValid(event.startTime) ? format(event.startTime, 'h:mm a') : 'N/A'}
                        </span>
                        {event.subjectName && (
                          <span className="flex items-center gap-1">
                            <AcademicCapIcon className="w-4 h-4" />
                            {event.subjectName}
                          </span>
                        )}
                        {event.venue && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-4 h-4" />
                            {event.venue}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
                  <ClockIcon className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 mb-4">No events scheduled</p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setIsAddModalOpen(true)}
                    leftIcon={<PlusIcon className="w-4 h-4" />}
                  >
                    Add Session
                  </Button>
                  <Link
                    href="/exams"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-dark-700/50 hover:text-white transition-colors"
                  >
                    <AcademicCapIcon className="w-4 h-4" />
                    View Exams
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-dark-600/50 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-4 h-4 text-neon-cyan" />
                <h4 className="text-sm font-semibold text-white">Smart Reminders</h4>
              </div>

              <div className="space-y-2">
                {smartReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={cn(
                      'p-3 rounded-xl border',
                      reminder.priority === 'high' && 'border-red-500/40 bg-red-500/10',
                      reminder.priority === 'medium' && 'border-neon-yellow/40 bg-neon-yellow/10',
                      reminder.priority === 'low' && 'border-neon-cyan/30 bg-neon-cyan/10'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white font-medium">{reminder.title}</p>
                      <Badge
                        size="sm"
                        variant={
                          reminder.priority === 'high'
                            ? 'red'
                            : reminder.priority === 'medium'
                              ? 'yellow'
                              : 'neon'
                        }
                      >
                        {reminder.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">{reminder.message}</p>

                    {reminder.actionHref && (
                      <Link
                        href={reminder.actionHref}
                        className="inline-flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-cyan/80 mt-2"
                      >
                        {reminder.actionLabel || 'Open'}
                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
