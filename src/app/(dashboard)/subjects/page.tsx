/**
 * Subjects Management Page
 * Organize subjects by semester with status tracking and CGPA
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    PlusIcon,
    AcademicCapIcon,
    ChevronRightIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { Card, Button, Input, Badge, Modal, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Subject, SubjectStatus, SyllabusTopic } from '@/types';
import { useAuthStore, useSubjectsStore } from '@/store';
import {
    initializeUserSemesters,
} from '@/services/semestersService';
import {
    getUserSubjects,
    createSubject,
    updateSubject,
    updateSubjectStatus,
    deleteSubject,
} from '@/services/subjectsService';
import {
    getUserSyllabi,
    createSyllabus,
    updateTopicStatus,
    addTopic,
    deleteTopic,
} from '@/services/syllabusService';
import { processDocument } from '@/services/aiService';
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

// Color options for subjects
const SUBJECT_COLORS = [
    { name: 'Cyan', value: '#00d4ff' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
];

// Status badge styling
const STATUS_STYLES: Record<SubjectStatus, { bg: string; text: string; label: string }> = {
    ongoing: { bg: 'bg-neon-yellow/20', text: 'text-neon-yellow', label: 'Ongoing' },
    passed: { bg: 'bg-neon-green/20', text: 'text-neon-green', label: 'Passed' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
    withdrawn: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Withdrawn' },
    incomplete: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Incomplete' },
    audit: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Audit' },
};

export default function SubjectsPage() {
    const { user } = useAuthStore();
    const {
        subjects,
        semesters,
        setSubjects,
        setSemesters,
        addSubject: addSubjectToStore,
        updateSubject: updateSubjectInStore,
        removeSubject,
        isLoading,
        setLoading
    } = useSubjectsStore();

    const [expandedSemester, setExpandedSemester] = useState<string | null>(null);
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
    const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
    const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
    const [syllabi, setSyllabi] = useState<Record<string, { topics: SyllabusTopic[]; id: string }>>({});

    // Form states
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectDescription, setNewSubjectDescription] = useState('');
    const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0].value);
    const [newSubjectCredits, setNewSubjectCredits] = useState('');

    // Edit states
    // const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    // const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Topic states
    const [newTopicTitle, setNewTopicTitle] = useState('');
    const [addingTopicForSubject, setAddingTopicForSubject] = useState<string | null>(null);

    // AI Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiFile, setAiFile] = useState<File | null>(null);
    const [aiText, setAiText] = useState('');


    // Multi-subject AI extraction state
    interface ExtractedSubject {
        name: string;
        description: string;
        creditHours: number;
        color: string;
        icon: string;
        selected: boolean;
    }
    const [aiExtractedSubjects, setAiExtractedSubjects] = useState<ExtractedSubject[]>([]);
    const [modalMode, setModalMode] = useState<'ai' | 'preview' | 'manual'>('ai');
    const [isBatchCreating, setIsBatchCreating] = useState(false);

    const selectedCount = useMemo(() => aiExtractedSubjects.filter(s => s.selected).length, [aiExtractedSubjects]);

    // Fetch data on mount
    const fetchData = useCallback(async () => {
        if (!user?.uid) return;

        setLoading(true);
        try {
            // Initialize or fetch semesters
            const userSemesters = await initializeUserSemesters(user.uid);
            setSemesters(userSemesters);

            // Auto-expand first semester
            if (userSemesters.length > 0 && !expandedSemester) {
                setExpandedSemester(userSemesters[0].id);
            }

            // Fetch subjects
            const userSubjects = await getUserSubjects(user.uid);
            setSubjects(userSubjects);

            // Fetch syllabi for all subjects
            const userSyllabi = await getUserSyllabi(user.uid);
            const syllabiMap: Record<string, { topics: SyllabusTopic[]; id: string }> = {};
            userSyllabi.forEach(s => {
                syllabiMap[s.subjectId] = { topics: s.topics || [], id: s.id };
            });
            setSyllabi(syllabiMap);
        } catch (error) {
            console.error('Error fetching data in fetchData:', error);
            toast.error('Failed to load subjects');
        } finally {
            setLoading(false);
        }
    }, [user?.uid, setLoading, setSemesters, setSubjects, expandedSemester]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate progress for a subject based on syllabus
    const getSubjectProgress = (subjectId: string): number => {
        const syllabus = syllabi[subjectId];
        if (!syllabus || syllabus.topics.length === 0) return 0;
        const completed = syllabus.topics.filter(t => t.status === 'completed').length;
        return Math.round((completed / syllabus.topics.length) * 100);
    };

    // Get subjects for a semester
    const getSubjectsForSemester = (semesterId: string): Subject[] => {
        return subjects.filter(s => s.semesterId === semesterId);
    };

    // Handle add subject
    const handleAddSubject = async () => {
        if (!user?.uid || !selectedSemesterId || !newSubjectName.trim()) {
            console.error('Missing invalid data for creating subject');
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const newSubjectData = {
                semesterId: selectedSemesterId,
                name: newSubjectName.trim(),
                description: newSubjectDescription.trim(),
                color: newSubjectColor,
                icon: '📚',
                status: 'ongoing' as SubjectStatus,
                creditHours: newSubjectCredits ? parseInt(newSubjectCredits) : 0,
                progress: 0,
            };
            const newSubject = await createSubject(user.uid, newSubjectData);

            try {
                // Create empty syllabus for the subject
                const syllabus = await createSyllabus(user.uid, {
                    subjectId: newSubject.id,
                    title: `${newSubjectName} Syllabus`,
                    description: 'Course syllabus and topics',
                    topics: [],
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 4 months
                    totalTopics: 0,
                    completedTopics: 0,
                });
                setSyllabi(prev => ({ ...prev, [newSubject.id]: { topics: [], id: syllabus.id } }));
            } catch (syllabusError) {
                console.error('Error creating syllabus, but subject was created:', syllabusError);
                toast.error('Subject created, but failed to initialize syllabus');
            }

            addSubjectToStore(newSubject);

            // Reset form
            setNewSubjectName('');
            setNewSubjectDescription('');
            setNewSubjectColor(SUBJECT_COLORS[0].value);
            setNewSubjectCredits('');
            setIsAddSubjectModalOpen(false);

            toast.success('Subject added successfully!');
        } catch (error) {
            console.error('Error adding subject:', error);
            toast.error('Failed to add subject');
        }
    };

    // Handle status change
    const handleStatusChange = async (subject: Subject, newStatus: SubjectStatus) => {
        try {
            await updateSubjectStatus(subject.id, newStatus);
            // If passed, keep existing CGPA (or init to 0 if null). 
            // If failed/withdrawn, CGPA is effectively 0 but stored as null usually unless we want to track it.
            // Service handles nulling CGPA for non-passed statuses except we might want to allow 0 for failed.
            // For now, simple update.
            updateSubjectInStore(subject.id, { status: newStatus });
            toast.success(`Status updated to ${STATUS_STYLES[newStatus].label}`);
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        }
    };

    // Handle CGPA change
    const handleCgpaChange = async (subject: Subject, cgpa: number) => {
        if (cgpa < 0 || cgpa > 10) {
            toast.error('CGPA must be between 0 and 10');
            return;
        }
        try {
            await updateSubjectStatus(subject.id, 'passed', cgpa);
            updateSubjectInStore(subject.id, { cgpa });
        } catch (error) {
            console.error('Error updating CGPA:', error);
            toast.error('Failed to update CGPA');
        }
    };

    // Handle delete subject
    const handleDeleteSubject = async (subjectId: string) => {
        if (!confirm('Are you sure you want to delete this subject?')) return;

        try {
            await deleteSubject(subjectId);
            removeSubject(subjectId);
            toast.success('Subject deleted');
        } catch (error) {
            console.error('Error deleting subject:', error);
            toast.error('Failed to delete subject');
        }
    };

    // Handle topic completion
    const handleToggleTopic = async (subjectId: string, topicId: string, currentStatus: string) => {
        const syllabus = syllabi[subjectId];
        if (!syllabus) return;

        const newStatus = currentStatus === 'completed' ? 'not-started' : 'completed';

        try {
            await updateTopicStatus(syllabus.id, topicId, newStatus as 'completed' | 'not-started');

            setSyllabi(prev => ({
                ...prev,
                [subjectId]: {
                    ...prev[subjectId],
                    topics: prev[subjectId].topics.map(t =>
                        t.id === topicId ? { ...t, status: newStatus as 'completed' | 'not-started', isCompleted: newStatus === 'completed' } : t
                    ),
                },
            }));

            // Update subject progress
            const updatedTopics = syllabi[subjectId].topics.map(t =>
                t.id === topicId ? { ...t, status: newStatus } : t
            );
            const completed = updatedTopics.filter(t => t.status === 'completed').length;
            const progress = Math.round((completed / updatedTopics.length) * 100);

            await updateSubject(subjectId, { progress });
            updateSubjectInStore(subjectId, { progress });
        } catch (error) {
            console.error('Error toggling topic:', error);
            toast.error('Failed to update topic');
        }
    };

    // Handle add topic
    const handleAddTopic = async (subjectId: string) => {
        if (!newTopicTitle.trim()) {
            toast.error('Please enter a topic title');
            return;
        }

        const syllabus = syllabi[subjectId];
        if (!syllabus) return;

        try {
            const newTopic = await addTopic(syllabus.id, {
                syllabusId: syllabus.id,
                title: newTopicTitle.trim(),
                description: '',
                estimatedHours: 2,
                priority: 'medium',
                status: 'not-started',
                order: syllabus.topics.length,
                isCompleted: false,
                notes: '',
            });

            setSyllabi(prev => ({
                ...prev,
                [subjectId]: {
                    ...prev[subjectId],
                    topics: [...prev[subjectId].topics, newTopic],
                },
            }));

            setNewTopicTitle('');
            setAddingTopicForSubject(null);
            toast.success('Topic added!');
        } catch (error) {
            console.error('Error adding topic:', error);
            toast.error('Failed to add topic');
        }
    };

    // Handle delete topic
    const handleDeleteTopic = async (subjectId: string, topicId: string) => {
        const syllabus = syllabi[subjectId];
        if (!syllabus) return;

        try {
            await deleteTopic(syllabus.id, topicId);

            setSyllabi(prev => ({
                ...prev,
                [subjectId]: {
                    ...prev[subjectId],
                    topics: prev[subjectId].topics.filter(t => t.id !== topicId),
                },
            }));

            toast.success('Topic deleted');
        } catch (error) {
            console.error('Error deleting topic:', error);
            toast.error('Failed to delete topic');
        }
    };

    // Calculate semester stats
    const getSemesterStats = (semesterId: string) => {
        const semesterSubjects = getSubjectsForSemester(semesterId);
        const passed = semesterSubjects.filter(s => s.status === 'passed').length;
        const failed = semesterSubjects.filter(s => s.status === 'failed').length;
        const ongoing = semesterSubjects.filter(s => s.status === 'ongoing').length;

        const passedWithCgpa = semesterSubjects.filter(s => s.status === 'passed' && s.cgpa != null);
        const avgCgpa = passedWithCgpa.length > 0
            ? passedWithCgpa.reduce((sum, s) => sum + (s.cgpa || 0), 0) / passedWithCgpa.length
            : null;

        return { total: semesterSubjects.length, passed, failed, ongoing, avgCgpa };
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
                    <h1 className="text-3xl font-bold text-white font-display">My Subjects</h1>
                    <p className="text-gray-400 mt-1">
                        {subjects.length} subjects across {semesters.length} semesters
                    </p>
                </div>
            </motion.div>

            {/* Overall Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card variant="glow" glowColor="cyan" className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-white">{subjects.length}</p>
                            <p className="text-sm text-gray-400">Total Subjects</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-neon-green">{subjects.filter(s => s.status === 'passed').length}</p>
                            <p className="text-sm text-gray-400">Passed</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-neon-yellow">{subjects.filter(s => s.status === 'ongoing').length}</p>
                            <p className="text-sm text-gray-400">Ongoing</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-bold text-red-400">{subjects.filter(s => s.status === 'failed').length}</p>
                            <p className="text-sm text-gray-400">Failed</p>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Semesters List */}
            <div className="space-y-4">
                {semesters.map((semester, index) => {
                    const isExpanded = expandedSemester === semester.id;
                    const stats = getSemesterStats(semester.id);
                    const semesterSubjects = getSubjectsForSemester(semester.id);

                    return (
                        <motion.div
                            key={semester.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + index * 0.05 }}
                        >
                            <Card className="overflow-hidden">
                                {/* Semester Header */}
                                <button
                                    className="w-full p-4 flex items-center gap-4 hover:bg-dark-700/30 transition-colors"
                                    onClick={() => setExpandedSemester(isExpanded ? null : semester.id)}
                                >
                                    <motion.div
                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                                    </motion.div>

                                    <div className="p-2 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20">
                                        <AcademicCapIcon className="w-6 h-6 text-neon-cyan" />
                                    </div>

                                    <div className="flex-1 text-left">
                                        <h3 className="text-lg font-semibold text-white">{semester.name}</h3>
                                        <p className="text-sm text-gray-400">
                                            {stats.total} subjects • {stats.passed} passed
                                            {stats.avgCgpa !== null && ` • Avg CGPA: ${stats.avgCgpa.toFixed(2)}`}
                                        </p>
                                    </div>

                                    <div className="hidden md:flex items-center gap-3">
                                        {stats.passed > 0 && (
                                            <Badge variant="green">{stats.passed} Passed</Badge>
                                        )}
                                        {stats.ongoing > 0 && (
                                            <Badge variant="yellow">{stats.ongoing} Ongoing</Badge>
                                        )}
                                        {stats.failed > 0 && (
                                            <Badge variant="red">{stats.failed} Failed</Badge>
                                        )}
                                    </div>
                                </button>

                                {/* Subjects List */}
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
                                                {semesterSubjects.length === 0 ? (
                                                    <p className="text-center text-gray-500 py-4">
                                                        No subjects added yet. Add your first subject!
                                                    </p>
                                                ) : (
                                                    semesterSubjects.map((subject) => {
                                                        const progress = getSubjectProgress(subject.id);
                                                        const isSubjectExpanded = expandedSubject === subject.id;
                                                        const subjectSyllabus = syllabi[subject.id];

                                                        return (
                                                            <div key={subject.id} className="space-y-2">
                                                                {/* Subject Card */}
                                                                <motion.div
                                                                    className={cn(
                                                                        'p-4 rounded-xl border transition-all',
                                                                        'bg-dark-700/30 border-dark-600/50 hover:border-dark-500'
                                                                    )}
                                                                    style={{ borderLeftColor: subject.color, borderLeftWidth: 4 }}
                                                                >
                                                                    <div className="flex items-start gap-4">
                                                                        {/* Subject Info */}
                                                                        <button
                                                                            className="flex-1 text-left"
                                                                            onClick={() => setExpandedSubject(isSubjectExpanded ? null : subject.id)}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <h4 className="font-semibold text-white">{subject.name}</h4>
                                                                                <Badge
                                                                                    variant={
                                                                                        subject.status === 'passed' ? 'green' :
                                                                                            subject.status === 'failed' ? 'red' :
                                                                                                subject.status === 'withdrawn' ? 'default' : // Gray equivalent
                                                                                                    subject.status === 'incomplete' ? 'yellow' : // Orange-ish
                                                                                                        subject.status === 'audit' ? 'blue' : 'yellow'
                                                                                    }
                                                                                    size="sm"
                                                                                >
                                                                                    {STATUS_STYLES[subject.status].label}
                                                                                </Badge>
                                                                            </div>
                                                                            {subject.description && (
                                                                                <p className="text-sm text-gray-400 mt-1 line-clamp-1">{subject.description}</p>
                                                                            )}
                                                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                                                                {subject.creditHours && (
                                                                                    <span>{subject.creditHours} credits</span>
                                                                                )}
                                                                                <span>{progress}% complete</span>
                                                                            </div>
                                                                        </button>

                                                                        {/* Actions */}
                                                                        <div className="flex items-center gap-2">
                                                                            {/* Status Dropdown */}
                                                                            <select
                                                                                value={subject.status}
                                                                                onChange={(e) => handleStatusChange(subject, e.target.value as SubjectStatus)}
                                                                                className="px-2 py-1 text-sm bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                                                                            >
                                                                                <option value="ongoing">Ongoing</option>
                                                                                <option value="passed">Passed</option>
                                                                                <option value="failed">Failed</option>
                                                                                <option value="withdrawn">Withdrawn</option>
                                                                                <option value="incomplete">Incomplete</option>
                                                                                <option value="audit">Audit</option>
                                                                            </select>

                                                                            {/* CGPA Input (only for passed) */}
                                                                            {subject.status === 'passed' && (
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-xs text-gray-400">Grade Pts:</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        max="10"
                                                                                        step="0.01"
                                                                                        value={subject.cgpa || ''}
                                                                                        onChange={(e) => handleCgpaChange(subject, parseFloat(e.target.value))}
                                                                                        placeholder="0-10"
                                                                                        className="w-16 px-2 py-1 text-sm bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-neon-green"
                                                                                    />
                                                                                </div>
                                                                            )}

                                                                            {/* Delete Button */}
                                                                            <button
                                                                                onClick={() => handleDeleteSubject(subject.id)}
                                                                                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                                                                            >
                                                                                <TrashIcon className="w-5 h-5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Progress Bar */}
                                                                    <div className="mt-3">
                                                                        <Progress value={progress} max={100} size="sm" />
                                                                    </div>
                                                                </motion.div>

                                                                {/* Expanded Syllabus Topics */}
                                                                <AnimatePresence>
                                                                    {isSubjectExpanded && subjectSyllabus && (
                                                                        <motion.div
                                                                            initial={{ height: 0, opacity: 0 }}
                                                                            animate={{ height: 'auto', opacity: 1 }}
                                                                            exit={{ height: 0, opacity: 0 }}
                                                                            className="ml-6 pl-4 border-l-2 border-dark-600"
                                                                        >
                                                                            <div className="py-2 space-y-2">
                                                                                <p className="text-sm font-medium text-gray-400 mb-2">
                                                                                    Syllabus Topics ({subjectSyllabus.topics.length})
                                                                                </p>

                                                                                {subjectSyllabus.topics.map((topic) => (
                                                                                    <div
                                                                                        key={topic.id}
                                                                                        className={cn(
                                                                                            'flex items-center gap-3 p-2 rounded-lg',
                                                                                            topic.status === 'completed' ? 'bg-neon-green/5' : 'bg-dark-700/30'
                                                                                        )}
                                                                                    >
                                                                                        <button
                                                                                            onClick={() => handleToggleTopic(subject.id, topic.id, topic.status)}
                                                                                        >
                                                                                            {topic.status === 'completed' ? (
                                                                                                <CheckCircleSolidIcon className="w-5 h-5 text-neon-green" />
                                                                                            ) : (
                                                                                                <div className="w-5 h-5 rounded-full border-2 border-gray-500 hover:border-neon-green transition-colors" />
                                                                                            )}
                                                                                        </button>
                                                                                        <span className={cn(
                                                                                            'flex-1 text-sm',
                                                                                            topic.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'
                                                                                        )}>
                                                                                            {topic.title}
                                                                                        </span>
                                                                                        <button
                                                                                            onClick={() => handleDeleteTopic(subject.id, topic.id)}
                                                                                            className="p-1 text-gray-600 hover:text-red-400"
                                                                                        >
                                                                                            <TrashIcon className="w-4 h-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}

                                                                                {/* Add Topic */}
                                                                                {addingTopicForSubject === subject.id ? (
                                                                                    <div className="flex items-center gap-2">
                                                                                        <input
                                                                                            type="text"
                                                                                            value={newTopicTitle}
                                                                                            onChange={(e) => setNewTopicTitle(e.target.value)}
                                                                                            placeholder="Topic title..."
                                                                                            className="flex-1 px-3 py-2 text-sm bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                                                                                            autoFocus
                                                                                            onKeyDown={(e) => {
                                                                                                if (e.key === 'Enter') handleAddTopic(subject.id);
                                                                                                if (e.key === 'Escape') setAddingTopicForSubject(null);
                                                                                            }}
                                                                                        />
                                                                                        <Button size="sm" onClick={() => handleAddTopic(subject.id)}>Add</Button>
                                                                                        <Button size="sm" variant="ghost" onClick={() => setAddingTopicForSubject(null)}>Cancel</Button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => setAddingTopicForSubject(subject.id)}
                                                                                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-neon-cyan transition-colors"
                                                                                    >
                                                                                        <PlusIcon className="w-4 h-4" />
                                                                                        Add Topic
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        );
                                                    })
                                                )}

                                                {/* Add Subject Button */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedSemesterId(semester.id);
                                                        setIsAddSubjectModalOpen(true);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-dark-500 hover:border-neon-cyan/50 hover:bg-dark-700/30 transition-colors text-gray-400 hover:text-neon-cyan"
                                                >
                                                    <PlusIcon className="w-5 h-5" />
                                                    <span>Add Subject</span>
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

            {/* Add Subject Modal */}
            <Modal
                isOpen={isAddSubjectModalOpen}
                onClose={() => {
                    setIsAddSubjectModalOpen(false);
                    setModalMode('ai');
                    setAiExtractedSubjects([]);
                    setAiFile(null);
                    setAiText('');
                    setAiText('');
                }}
                title={modalMode === 'preview' ? `Extracted Subjects (${aiExtractedSubjects.length})` : 'Add Subject'}
                description={modalMode === 'preview' ? 'Select the subjects you want to add' : 'Add subjects using AI or manually'}
            >
                <div className="space-y-4">
                    {/* Mode Tabs */}
                    {modalMode !== 'preview' && (
                        <div className="flex gap-2 bg-dark-800/50 rounded-xl p-1">
                            <button
                                onClick={() => setModalMode('ai')}
                                className={cn(
                                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                                    modalMode === 'ai'
                                        ? 'bg-neon-cyan/20 text-neon-cyan'
                                        : 'text-gray-400 hover:text-white'
                                )}
                            >
                                ✨ AI Extract
                            </button>
                            <button
                                onClick={() => setModalMode('manual')}
                                className={cn(
                                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                                    modalMode === 'manual'
                                        ? 'bg-neon-cyan/20 text-neon-cyan'
                                        : 'text-gray-400 hover:text-white'
                                )}
                            >
                                ✏️ Manual Add
                            </button>
                        </div>
                    )}

                    {/* AI Mode - Input */}
                    {modalMode === 'ai' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-3"
                        >
                            <p className="text-xs text-gray-400">
                                Upload a course outline (PDF) or paste text to extract multiple subjects at once.
                            </p>

                            <input
                                type="file"
                                accept=".pdf,.txt"
                                onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-gray-400
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-neon-cyan/10 file:text-neon-cyan
                                    hover:file:bg-neon-cyan/20
                                    cursor-pointer"
                            />

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-dark-600"></div>
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="px-2 bg-dark-900 text-gray-500">OR</span>
                                </div>
                            </div>

                            <textarea
                                placeholder="Paste subject names, course outline, or curriculum text...\n\ne.g., Computer Networks, Operating Systems, DBMS, Software Engineering"
                                value={aiText}
                                onChange={(e) => setAiText(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-dark-900/50 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-neon-cyan resize-none"
                                rows={4}
                            />

                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10"
                                disabled={(!aiFile && !aiText) || isProcessing}
                                onClick={async () => {
                                    if (!aiFile && !aiText) return;
                                    setIsProcessing(true);
                                    try {
                                        const data = await processDocument('subject', aiFile, aiText);
                                        if (data && data.subjects && Array.isArray(data.subjects)) {
                                            const extracted = data.subjects.map((subject) => {
                                                const parsed = subject && typeof subject === 'object'
                                                    ? (subject as Record<string, unknown>)
                                                    : {};
                                                return {
                                                name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : 'Untitled',
                                                description: typeof parsed.description === 'string' ? parsed.description : '',
                                                creditHours: typeof parsed.creditHours === 'number' ? parsed.creditHours : 3,
                                                color: typeof parsed.color === 'string' && parsed.color.trim()
                                                    ? parsed.color
                                                    : SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)].value,
                                                icon: typeof parsed.icon === 'string' && parsed.icon.trim() ? parsed.icon : '📚',
                                                selected: true,
                                            } satisfies ExtractedSubject;
                                            });
                                            setAiExtractedSubjects(extracted);
                                            setModalMode('preview');
                                            toast.success(`Found ${extracted.length} subject${extracted.length !== 1 ? 's' : ''}!`);
                                        } else {
                                            toast.error('No subjects found in the text');
                                        }
                                    } catch (error) {
                                        console.error(error);
                                        toast.error('Failed to process document');
                                    } finally {
                                        setIsProcessing(false);
                                    }
                                }}
                            >
                                {isProcessing ? (
                                    <>
                                        <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                                        Extracting subjects...
                                    </>
                                ) : (
                                    <>
                                        <DocumentTextIcon className="w-4 h-4 mr-2" />
                                        Extract Subjects
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    )}

                    {/* AI Mode - Preview extracted subjects */}
                    {modalMode === 'preview' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-3"
                        >
                            {/* Select all / Deselect all */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                    {selectedCount} of {aiExtractedSubjects.length} selected
                                </span>
                                <button
                                    onClick={() => {
                                        const allSelected = aiExtractedSubjects.every(s => s.selected);
                                        setAiExtractedSubjects(prev =>
                                            prev.map(s => ({ ...s, selected: !allSelected }))
                                        );
                                    }}
                                    className="text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                                >
                                    {aiExtractedSubjects.every(s => s.selected) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>

                            {/* Subject list */}
                            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                                {aiExtractedSubjects.map((subject, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={cn(
                                            'flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer',
                                            subject.selected
                                                ? 'bg-dark-700/50 border-neon-cyan/30'
                                                : 'bg-dark-800/30 border-dark-600/30 opacity-50'
                                        )}
                                        onClick={() => {
                                            setAiExtractedSubjects(prev =>
                                                prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s)
                                            );
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <div className="pt-0.5">
                                            {subject.selected ? (
                                                <CheckCircleSolidIcon className="w-5 h-5 text-neon-cyan" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-gray-500" />
                                            )}
                                        </div>

                                        {/* Subject info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: subject.color }}
                                                />
                                                <span className="text-lg">{subject.icon}</span>
                                                <h4 className="font-medium text-white text-sm truncate">{subject.name}</h4>
                                            </div>
                                            {subject.description && (
                                                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{subject.description}</p>
                                            )}
                                            <span className="text-xs text-gray-500 mt-1 inline-block">
                                                {subject.creditHours} credit hours
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => {
                                        setModalMode('ai');
                                        setAiExtractedSubjects([]);
                                    }}
                                >
                                    ← Back
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1"
                                    disabled={selectedCount === 0 || isBatchCreating}
                                    onClick={async () => {
                                        if (!user?.uid || !selectedSemesterId) return;
                                        setIsBatchCreating(true);
                                        const selected = aiExtractedSubjects.filter(s => s.selected);
                                        let created = 0;

                                        try {
                                            for (const subjectData of selected) {
                                                try {
                                                    const newSubject = await createSubject(user.uid, {
                                                        semesterId: selectedSemesterId,
                                                        name: subjectData.name,
                                                        description: subjectData.description,
                                                        color: subjectData.color,
                                                        icon: subjectData.icon || '📚',
                                                        status: 'ongoing' as SubjectStatus,
                                                        creditHours: subjectData.creditHours,
                                                        progress: 0,
                                                    });

                                                    addSubjectToStore(newSubject);

                                                    // Create empty syllabus
                                                    try {
                                                        const syllabus = await createSyllabus(user.uid, {
                                                            subjectId: newSubject.id,
                                                            title: `${subjectData.name} Syllabus`,
                                                            description: 'Course syllabus and topics',
                                                            topics: [],
                                                            startDate: new Date(),
                                                            endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
                                                            totalTopics: 0,
                                                            completedTopics: 0,
                                                        });
                                                        setSyllabi(prev => ({ ...prev, [newSubject.id]: { topics: [], id: syllabus.id } }));
                                                    } catch (e) {
                                                        console.error('Error creating syllabus for', subjectData.name, e);
                                                    }

                                                    created++;
                                                } catch (e) {
                                                    console.error('Error creating subject', subjectData.name, e);
                                                }
                                            }

                                            toast.success(`Added ${created} subject${created !== 1 ? 's' : ''} successfully!`);
                                            setIsAddSubjectModalOpen(false);
                                            setModalMode('ai');
                                            setAiExtractedSubjects([]);
                                            setAiFile(null);
                                            setAiText('');
                                        } catch (error) {
                                            console.error('Batch create error:', error);
                                            toast.error('Failed to add subjects');
                                        } finally {
                                            setIsBatchCreating(false);
                                        }
                                    }}
                                >
                                    {isBatchCreating ? (
                                        <>
                                            <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        `Add ${selectedCount} Subject${selectedCount !== 1 ? 's' : ''}`
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Manual Mode - Single subject form */}
                    {modalMode === 'manual' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4"
                        >
                            <Input
                                label="Subject Name"
                                placeholder="e.g., Advanced Mathematics"
                                value={newSubjectName}
                                onChange={(e) => setNewSubjectName(e.target.value)}
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    placeholder="Brief description of the subject..."
                                    value={newSubjectDescription}
                                    onChange={(e) => setNewSubjectDescription(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/50 transition-all resize-none"
                                    rows={2}
                                />
                            </div>

                            <Input
                                label="Credit Hours"
                                type="number"
                                placeholder="e.g., 3"
                                value={newSubjectCredits}
                                onChange={(e) => setNewSubjectCredits(e.target.value)}
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Color
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {SUBJECT_COLORS.map((color) => (
                                        <button
                                            key={color.value}
                                            onClick={() => setNewSubjectColor(color.value)}
                                            className={cn(
                                                'w-8 h-8 rounded-full border-2 transition-all',
                                                newSubjectColor === color.value ? 'border-white scale-110' : 'border-transparent'
                                            )}
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="secondary" onClick={() => setIsAddSubjectModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="primary" onClick={handleAddSubject}>
                                    Add Subject
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
