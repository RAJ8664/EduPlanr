/**
 * Exam Routine Page
 * AI-powered exam schedule management with PDF/text extraction
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    PlusIcon,
    ClipboardDocumentListIcon,
    ChevronRightIcon,
    TrashIcon,
    CalendarDaysIcon,
    ClockIcon,
    MapPinIcon,
    ArrowPathIcon,
    DocumentTextIcon,
    PencilIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Card, Button, Input, Badge, Modal, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ExamRoutine, Exam } from '@/types';
import { useAuthStore } from '@/store';
import {
    getUserExamRoutines,
    createExamRoutine,
    deleteExamRoutine,
    updateExamRoutine,
} from '@/services/examRoutineService';
import { processDocument } from '@/services/aiService';
import { syncReminderNotifications } from '@/services/notificationsService';

// Subject color palette for AI-generated exams
const EXAM_COLORS = [
    '#00f5ff', '#bf00ff', '#ff0080', '#00ff88', '#ff8800',
    '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b',
    '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316',
];

function formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return time;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatExamDate(dateStr: string): string {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function isExamUpcoming(dateStr: string): boolean {
    try {
        const examDate = new Date(dateStr + 'T23:59:59');
        return examDate >= new Date();
    } catch {
        return false;
    }
}

export default function ExamsPage() {
    const { user } = useAuthStore();
    const [routines, setRoutines] = useState<ExamRoutine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form states
    const [routineName, setRoutineName] = useState('');
    const [routineDescription, setRoutineDescription] = useState('');

    // AI states
    const [showAiInput, setShowAiInput] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiFile, setAiFile] = useState<File | null>(null);
    const [aiText, setAiText] = useState('');
    const [extractedExams, setExtractedExams] = useState<Partial<Exam>[]>([]);
    const [editingExamIndex, setEditingExamIndex] = useState<number | null>(null);

    // Manual add exam states
    const [isAddExamModalOpen, setIsAddExamModalOpen] = useState(false);
    const [addExamToRoutineId, setAddExamToRoutineId] = useState<string | null>(null);
    const [manualExam, setManualExam] = useState({
        subjectName: '',
        date: '',
        startTime: '09:00',
        endTime: '12:00',
        venue: '',
        notes: '',
    });

    // Fetch data
    const fetchData = useCallback(async () => {
        if (!user?.uid) return;
        setIsLoading(true);
        try {
            const fetched = await getUserExamRoutines(user.uid);
            setRoutines(fetched);
            if (fetched.length > 0 && !expandedRoutine) {
                setExpandedRoutine(fetched[0].id);
            }
        } catch (error) {
            console.error('Error fetching exam routines:', error);
            toast.error('Failed to load exam routines');
        } finally {
            setIsLoading(false);
        }
    }, [user?.uid, expandedRoutine]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Stats
    const totalExams = routines.reduce((sum, r) => sum + (r.exams?.length || 0), 0);
    const upcomingExams = routines.reduce(
        (sum, r) => sum + (r.exams?.filter(e => isExamUpcoming(e.date)).length || 0), 0
    );
    const pastExams = totalExams - upcomingExams;

    const runReminderSync = useCallback((uid?: string) => {
        if (!uid) return;
        void syncReminderNotifications(uid).catch((error) => {
            console.error('Failed to sync reminders:', error);
        });
    }, []);

    // AI extract handler
    const handleAiExtract = async () => {
        if (!aiFile && !aiText) return;
        setIsProcessing(true);
        try {
            const data = await processDocument('exam-routine', aiFile, aiText);
            if (data && data.exams && Array.isArray(data.exams)) {
                const exams = data.exams.map((e: any, index: number) => ({
                    subjectName: e.subjectName || 'Unknown Subject',
                    subjectColor: EXAM_COLORS[index % EXAM_COLORS.length],
                    date: e.date || '',
                    startTime: e.startTime || '09:00',
                    endTime: e.endTime || '12:00',
                    venue: e.venue || '',
                    notes: e.notes || '',
                    selected: true,
                }));
                setExtractedExams(exams);
                toast.success(`Extracted ${exams.length} exam${exams.length !== 1 ? 's' : ''}!`);
                setShowAiInput(false);
            } else {
                toast.error('No exams found in the text');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to process document');
        } finally {
            setIsProcessing(false);
        }
    };

    // Create routine handler
    const handleCreateRoutine = async () => {
        if (!user?.uid || !routineName.trim()) {
            toast.error('Please enter a routine name');
            return;
        }

        try {
            const selectedExams = extractedExams
                .filter((e: any) => e.selected !== false)
                .map((e) => ({
                    id: '',
                    subjectName: e.subjectName || '',
                    subjectColor: e.subjectColor || EXAM_COLORS[0],
                    date: e.date || '',
                    startTime: e.startTime || '09:00',
                    endTime: e.endTime || '12:00',
                    venue: e.venue || '',
                    notes: e.notes || '',
                }));

            const newRoutine = await createExamRoutine(user.uid, {
                name: routineName.trim(),
                description: routineDescription.trim(),
                exams: selectedExams,
            });
            runReminderSync(user.uid);

            setRoutines(prev => [newRoutine, ...prev]);
            setRoutineName('');
            setRoutineDescription('');
            setExtractedExams([]);
            setAiFile(null);
            setAiText('');
            setShowAiInput(false);
            setIsAddModalOpen(false);
            toast.success('Exam routine created!');
        } catch (error) {
            console.error('Error creating exam routine:', error);
            toast.error('Failed to create exam routine');
        }
    };

    // Delete routine
    const handleDeleteRoutine = async (routineId: string) => {
        if (!confirm('Delete this exam routine and all its exams?')) return;
        try {
            await deleteExamRoutine(routineId);
            runReminderSync(user?.uid);
            setRoutines(prev => prev.filter(r => r.id !== routineId));
            toast.success('Exam routine deleted');
        } catch (error) {
            console.error('Error deleting routine:', error);
            toast.error('Failed to delete routine');
        }
    };

    // Delete single exam
    const handleDeleteExam = async (routineId: string, examId: string) => {
        try {
            const routine = routines.find(r => r.id === routineId);
            if (!routine) return;
            const updatedExams = routine.exams.filter(e => e.id !== examId);
            await updateExamRoutine(routineId, { exams: updatedExams });
            runReminderSync(user?.uid);
            setRoutines(prev => prev.map(r =>
                r.id === routineId ? { ...r, exams: updatedExams } : r
            ));
            toast.success('Exam removed');
        } catch (error) {
            console.error('Error removing exam:', error);
            toast.error('Failed to remove exam');
        }
    };

    // Add manual exam
    const handleAddManualExam = async () => {
        if (!addExamToRoutineId || !manualExam.subjectName.trim() || !manualExam.date) {
            toast.error('Please fill in subject name and date');
            return;
        }

        try {
            const routine = routines.find(r => r.id === addExamToRoutineId);
            if (!routine) return;

            const newExam: Exam = {
                id: Math.random().toString(36).substring(2, 15),
                subjectName: manualExam.subjectName.trim(),
                subjectColor: EXAM_COLORS[routine.exams.length % EXAM_COLORS.length],
                date: manualExam.date,
                startTime: manualExam.startTime,
                endTime: manualExam.endTime,
                venue: manualExam.venue.trim(),
                notes: manualExam.notes.trim(),
            };

            const updatedExams = [...routine.exams, newExam];
            await updateExamRoutine(addExamToRoutineId, { exams: updatedExams });
            runReminderSync(user?.uid);
            setRoutines(prev => prev.map(r =>
                r.id === addExamToRoutineId ? { ...r, exams: updatedExams } : r
            ));

            setManualExam({ subjectName: '', date: '', startTime: '09:00', endTime: '12:00', venue: '', notes: '' });
            setIsAddExamModalOpen(false);
            setAddExamToRoutineId(null);
            toast.success('Exam added!');
        } catch (error) {
            console.error('Error adding exam:', error);
            toast.error('Failed to add exam');
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
                    <h1 className="text-3xl font-bold text-white font-display">Exam Routine</h1>
                    <p className="text-gray-400 mt-1">
                        {routines.length} routine{routines.length !== 1 ? 's' : ''} • {totalExams} exam{totalExams !== 1 ? 's' : ''} total
                    </p>
                </div>

                <Button
                    variant="primary"
                    leftIcon={<PlusIcon className="w-5 h-5" />}
                    onClick={() => setIsAddModalOpen(true)}
                >
                    Add Exam Routine
                </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                <Card variant="glow" glowColor="cyan" className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-cyan/5">
                            <ClipboardDocumentListIcon className="w-6 h-6 text-neon-cyan" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{totalExams}</p>
                            <p className="text-sm text-gray-400">Total Exams</p>
                        </div>
                    </div>
                </Card>

                <Card variant="glow" glowColor="green" className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-neon-green/20 to-neon-green/5">
                            <CalendarDaysIcon className="w-6 h-6 text-neon-green" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{upcomingExams}</p>
                            <p className="text-sm text-gray-400">Upcoming</p>
                        </div>
                    </div>
                </Card>

                <Card variant="glow" glowColor="purple" className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-purple/5">
                            <CheckCircleIcon className="w-6 h-6 text-neon-purple" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{pastExams}</p>
                            <p className="text-sm text-gray-400">Completed</p>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Routines list */}
            <div className="space-y-4">
                {routines.map((routine, index) => {
                    const isExpanded = expandedRoutine === routine.id;
                    const examsCount = routine.exams?.length || 0;
                    const upcomingCount = routine.exams?.filter(e => isExamUpcoming(e.date)).length || 0;
                    const sortedExams = [...(routine.exams || [])].sort((a, b) =>
                        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
                    );

                    return (
                        <motion.div
                            key={routine.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + index * 0.05 }}
                        >
                            <Card className="overflow-hidden">
                                {/* Routine header */}
                                <div className="flex items-center">
                                    <button
                                        className="flex-1 p-4 flex items-center gap-4 hover:bg-dark-700/30 transition-colors"
                                        onClick={() => setExpandedRoutine(isExpanded ? null : routine.id)}
                                    >
                                        <motion.div
                                            animate={{ rotate: isExpanded ? 90 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                                        </motion.div>

                                        <div className="p-2 rounded-xl bg-dark-700/50">
                                            <ClipboardDocumentListIcon className="w-6 h-6 text-neon-cyan" />
                                        </div>

                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-semibold text-white">{routine.name}</h3>
                                                {upcomingCount > 0 && (
                                                    <Badge variant="neon" className="text-xs">
                                                        {upcomingCount} upcoming
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-400 line-clamp-1">
                                                {routine.description || `${examsCount} exam${examsCount !== 1 ? 's' : ''}`}
                                            </p>
                                        </div>

                                        <div className="hidden md:flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-white">{examsCount}</p>
                                                <p className="text-xs text-gray-400">exams</p>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handleDeleteRoutine(routine.id)}
                                        className="p-4 text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Exams list */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="border-t border-dark-600/50"
                                        >
                                            <div className="p-4 space-y-3">
                                                {sortedExams.length === 0 ? (
                                                    <p className="text-center text-gray-500 py-4">
                                                        No exams yet. Add your first exam!
                                                    </p>
                                                ) : (
                                                    sortedExams.map((exam, examIndex) => {
                                                        const upcoming = isExamUpcoming(exam.date);
                                                        return (
                                                            <motion.div
                                                                key={exam.id}
                                                                initial={{ opacity: 0, x: -20 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: examIndex * 0.05 }}
                                                                className={cn(
                                                                    'flex items-center gap-4 p-4 rounded-xl transition-all border',
                                                                    upcoming
                                                                        ? 'bg-dark-700/30 hover:bg-dark-700/50 border-dark-600/30'
                                                                        : 'bg-dark-800/20 border-dark-700/20 opacity-60'
                                                                )}
                                                            >
                                                                {/* Subject color bar */}
                                                                <div
                                                                    className="w-1.5 h-14 rounded-full flex-shrink-0"
                                                                    style={{ backgroundColor: exam.subjectColor || '#00f5ff' }}
                                                                />

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <h4 className="font-semibold text-white truncate">
                                                                            {exam.subjectName}
                                                                        </h4>
                                                                        {!upcoming && (
                                                                            <Badge variant="default" className="text-xs opacity-70">
                                                                                Past
                                                                            </Badge>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                                                        <span className="flex items-center gap-1">
                                                                            <CalendarDaysIcon className="w-4 h-4" />
                                                                            {formatExamDate(exam.date)}
                                                                        </span>
                                                                        <span className="flex items-center gap-1">
                                                                            <ClockIcon className="w-4 h-4" />
                                                                            {formatTime12h(exam.startTime)} - {formatTime12h(exam.endTime)}
                                                                        </span>
                                                                        {exam.venue && (
                                                                            <span className="flex items-center gap-1">
                                                                                <MapPinIcon className="w-4 h-4" />
                                                                                {exam.venue}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {exam.notes && (
                                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                                                            📝 {exam.notes}
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    onClick={() => handleDeleteExam(routine.id, exam.id)}
                                                                    className="p-2 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </motion.div>
                                                        );
                                                    })
                                                )}

                                                {/* Add exam button */}
                                                <button
                                                    onClick={() => {
                                                        setAddExamToRoutineId(routine.id);
                                                        setIsAddExamModalOpen(true);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-dark-500 hover:border-neon-cyan/50 hover:bg-dark-700/30 transition-colors text-gray-400 hover:text-neon-cyan"
                                                >
                                                    <PlusIcon className="w-5 h-5" />
                                                    <span>Add Exam</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Empty state */}
            {routines.length === 0 && (
                <Card className="py-16 text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
                        <ClipboardDocumentListIcon className="w-10 h-10 text-gray-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">No exam routines yet</h3>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">
                        Create your first exam routine by uploading a PDF or pasting your exam schedule
                    </p>
                    <Button
                        variant="primary"
                        onClick={() => setIsAddModalOpen(true)}
                        leftIcon={<PlusIcon className="w-5 h-5" />}
                    >
                        Add Exam Routine
                    </Button>
                </Card>
            )}

            {/* Add Exam Routine Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setExtractedExams([]);
                    setShowAiInput(false);
                }}
                title="Add Exam Routine"
                description="Create a new exam schedule — paste text or upload a PDF"
            >
                <div className="space-y-4">
                    {/* AI Auto-fill Section */}
                    <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600/50">
                        <button
                            onClick={() => setShowAiInput(!showAiInput)}
                            className="flex items-center gap-2 text-sm font-medium text-neon-purple hover:text-neon-purple/80 transition-colors w-full"
                        >
                            <span className="flex items-center gap-2">
                                ✨ Extract from Exam Schedule (PDF/Text)
                            </span>
                            <ChevronRightIcon className={cn("w-4 h-4 transition-transform ml-auto", showAiInput ? "rotate-90" : "")} />
                        </button>

                        <AnimatePresence>
                            {showAiInput && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="pt-4 space-y-3">
                                        <p className="text-xs text-gray-400">
                                            Upload a PDF or paste your exam schedule to extract exams automatically.
                                        </p>

                                        <input
                                            type="file"
                                            accept=".pdf,.txt"
                                            onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                                            className="block w-full text-sm text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-neon-purple/10 file:text-neon-purple
                        hover:file:bg-neon-purple/20
                        cursor-pointer"
                                        />

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-dark-600"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs">
                                                <span className="px-2 bg-dark-800 text-gray-500">OR</span>
                                            </div>
                                        </div>

                                        <textarea
                                            placeholder="Paste exam schedule here...&#10;Example: Math - Feb 20, 9AM-12PM, Room 301&#10;Physics - Feb 22, 2PM-5PM, Hall A"
                                            value={aiText}
                                            onChange={(e) => setAiText(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-dark-900/50 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-neon-purple resize-none placeholder:text-gray-600"
                                            rows={4}
                                        />

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10"
                                            disabled={(!aiFile && !aiText) || isProcessing}
                                            onClick={handleAiExtract}
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                                                    Extracting exams...
                                                </>
                                            ) : (
                                                <>
                                                    <DocumentTextIcon className="w-4 h-4 mr-2" />
                                                    Extract Exams
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Extracted Exams Preview */}
                        {extractedExams.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-neon-green flex items-center gap-2">
                                        <CheckCircleIcon className="w-4 h-4" />
                                        {extractedExams.filter((e: any) => e.selected !== false).length} of {extractedExams.length} Exams Selected
                                    </p>
                                    <button
                                        onClick={() => {
                                            const allSelected = extractedExams.every((e: any) => e.selected !== false);
                                            setExtractedExams(prev => prev.map(e => ({ ...e, selected: !allSelected } as any)));
                                        }}
                                        className="text-xs text-neon-cyan hover:text-neon-cyan/80"
                                    >
                                        {extractedExams.every((e: any) => e.selected !== false) ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {extractedExams.map((exam: any, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                setExtractedExams(prev =>
                                                    prev.map((e, i) => i === idx ? { ...e, selected: !(e as any).selected } as any : e)
                                                );
                                            }}
                                            className={cn(
                                                'p-3 rounded-lg border cursor-pointer transition-all',
                                                exam.selected !== false
                                                    ? 'bg-dark-700/50 border-neon-cyan/20'
                                                    : 'bg-dark-900/30 border-dark-700/20 opacity-50'
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: exam.subjectColor }}
                                                />
                                                <span className="font-medium text-white text-sm">{exam.subjectName}</span>

                                                {editingExamIndex === idx ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingExamIndex(null); }}
                                                        className="ml-auto text-xs text-neon-green"
                                                    >
                                                        Done
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditingExamIndex(idx); }}
                                                        className="ml-auto text-xs text-gray-500 hover:text-neon-cyan"
                                                    >
                                                        <PencilIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {editingExamIndex === idx ? (
                                                <div className="space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={exam.subjectName}
                                                        onChange={(e) => {
                                                            setExtractedExams(prev =>
                                                                prev.map((ex, i) => i === idx ? { ...ex, subjectName: e.target.value } : ex)
                                                            );
                                                        }}
                                                        className="w-full px-2 py-1 text-xs bg-dark-900/50 border border-dark-600 rounded text-white"
                                                        placeholder="Subject name"
                                                    />
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <input
                                                            type="date"
                                                            value={exam.date}
                                                            onChange={(e) => {
                                                                setExtractedExams(prev =>
                                                                    prev.map((ex, i) => i === idx ? { ...ex, date: e.target.value } : ex)
                                                                );
                                                            }}
                                                            className="px-2 py-1 text-xs bg-dark-900/50 border border-dark-600 rounded text-white"
                                                        />
                                                        <input
                                                            type="time"
                                                            value={exam.startTime}
                                                            onChange={(e) => {
                                                                setExtractedExams(prev =>
                                                                    prev.map((ex, i) => i === idx ? { ...ex, startTime: e.target.value } : ex)
                                                                );
                                                            }}
                                                            className="px-2 py-1 text-xs bg-dark-900/50 border border-dark-600 rounded text-white"
                                                        />
                                                        <input
                                                            type="time"
                                                            value={exam.endTime}
                                                            onChange={(e) => {
                                                                setExtractedExams(prev =>
                                                                    prev.map((ex, i) => i === idx ? { ...ex, endTime: e.target.value } : ex)
                                                                );
                                                            }}
                                                            className="px-2 py-1 text-xs bg-dark-900/50 border border-dark-600 rounded text-white"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={exam.venue || ''}
                                                        onChange={(e) => {
                                                            setExtractedExams(prev =>
                                                                prev.map((ex, i) => i === idx ? { ...ex, venue: e.target.value } : ex)
                                                            );
                                                        }}
                                                        className="w-full px-2 py-1 text-xs bg-dark-900/50 border border-dark-600 rounded text-white"
                                                        placeholder="Venue (optional)"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                                                    <span>📅 {formatExamDate(exam.date)}</span>
                                                    <span>⏰ {formatTime12h(exam.startTime)} - {formatTime12h(exam.endTime)}</span>
                                                    {exam.venue && <span>📍 {exam.venue}</span>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setExtractedExams([])}
                                    className="text-xs text-red-400 hover:text-red-300 underline"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>

                    <Input
                        label="Routine Name"
                        placeholder="e.g., Spring 2026 Finals"
                        value={routineName}
                        onChange={(e) => setRoutineName(e.target.value)}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            Description (Optional)
                        </label>
                        <textarea
                            placeholder="Brief description of this exam routine..."
                            value={routineDescription}
                            onChange={(e) => setRoutineDescription(e.target.value)}
                            className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 transition-all resize-none"
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleCreateRoutine}>
                            {extractedExams.filter((e: any) => e.selected !== false).length > 0
                                ? `Create with ${extractedExams.filter((e: any) => e.selected !== false).length} Exams`
                                : 'Create Routine'
                            }
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Add Single Exam Modal */}
            <Modal
                isOpen={isAddExamModalOpen}
                onClose={() => {
                    setIsAddExamModalOpen(false);
                    setAddExamToRoutineId(null);
                }}
                title="Add Exam"
                description="Add a single exam to the routine"
            >
                <div className="space-y-4">
                    <Input
                        label="Subject Name"
                        placeholder="e.g., Advanced Mathematics"
                        value={manualExam.subjectName}
                        onChange={(e) => setManualExam(prev => ({ ...prev, subjectName: e.target.value }))}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Exam Date</label>
                        <input
                            type="date"
                            value={manualExam.date}
                            onChange={(e) => setManualExam(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Start Time</label>
                            <input
                                type="time"
                                value={manualExam.startTime}
                                onChange={(e) => setManualExam(prev => ({ ...prev, startTime: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">End Time</label>
                            <input
                                type="time"
                                value={manualExam.endTime}
                                onChange={(e) => setManualExam(prev => ({ ...prev, endTime: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                            />
                        </div>
                    </div>

                    <Input
                        label="Venue (Optional)"
                        placeholder="e.g., Room 301, Building A"
                        value={manualExam.venue}
                        onChange={(e) => setManualExam(prev => ({ ...prev, venue: e.target.value }))}
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes (Optional)</label>
                        <textarea
                            placeholder="e.g., Open book, calculator allowed..."
                            value={manualExam.notes}
                            onChange={(e) => setManualExam(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 transition-all resize-none"
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setIsAddExamModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleAddManualExam}>
                            Add Exam
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
