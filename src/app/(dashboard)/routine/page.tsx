/**
 * Routine Page
 * Customizable animated daily routine timeline
 * Allows users to build and visualize their daily schedule
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    ClockIcon,
    PlusIcon,
    TrashIcon,
    PencilSquareIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { Card, Button, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { RoutineBlock, RoutineCategory } from '@/types';
import { useAuthStore } from '@/store';
import {
    createRoutineBlock,
    getUserRoutineBlocks,
    updateRoutineBlock,
    deleteRoutineBlock,
    calculateRoutineStats,
} from '@/services/routineService';

// Category config with colors, icons, and labels
const CATEGORIES: Record<RoutineCategory, { label: string; icon: string; color: string; bg: string; glow: string }> = {
    study: { label: 'Study', icon: '📚', color: '#00d4ff', bg: 'from-cyan-500/20 to-blue-500/20', glow: 'shadow-[0_0_20px_rgba(0,212,255,0.3)]' },
    break: { label: 'Break', icon: '☕', color: '#00ff88', bg: 'from-green-500/20 to-emerald-500/20', glow: 'shadow-[0_0_20px_rgba(0,255,136,0.3)]' },
    exercise: { label: 'Exercise', icon: '🏃', color: '#ff6b35', bg: 'from-orange-500/20 to-red-500/20', glow: 'shadow-[0_0_20px_rgba(255,107,53,0.3)]' },
    personal: { label: 'Personal', icon: '🎯', color: '#a855f7', bg: 'from-purple-500/20 to-violet-500/20', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]' },
    sleep: { label: 'Sleep', icon: '😴', color: '#6366f1', bg: 'from-indigo-500/20 to-blue-500/20', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]' },
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getCurrentTimeMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

export default function RoutinePage() {
    const { user } = useAuthStore();
    const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
    const [currentTime, setCurrentTime] = useState(getCurrentTimeMinutes());

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState<RoutineCategory>('study');
    const [formStartTime, setFormStartTime] = useState('08:00');
    const [formEndTime, setFormEndTime] = useState('09:00');
    const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5]);

    // Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(getCurrentTimeMinutes());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch routine blocks
    const fetchBlocks = useCallback(async () => {
        if (!user?.uid) return;
        try {
            setIsLoading(true);
            const data = await getUserRoutineBlocks(user.uid);
            setBlocks(data);
        } catch (error) {
            console.error('Error fetching routine:', error);
            toast.error('Failed to load routine');
        } finally {
            setIsLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        fetchBlocks();
    }, [fetchBlocks]);

    // Sorted blocks by start time
    const sortedBlocks = useMemo(() => {
        const today = new Date().getDay();
        return [...blocks]
            .filter((b) => b.daysOfWeek.includes(today))
            .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    }, [blocks]);

    // Stats
    const stats = useMemo(() => calculateRoutineStats(sortedBlocks), [sortedBlocks]);

    // Find current block
    const currentBlock = useMemo(() => {
        return sortedBlocks.find((b) => {
            const start = timeToMinutes(b.startTime);
            const end = timeToMinutes(b.endTime);
            return currentTime >= start && currentTime < end;
        });
    }, [sortedBlocks, currentTime]);

    // Block status helper
    const getBlockStatus = useCallback(
        (block: RoutineBlock): 'past' | 'current' | 'upcoming' => {
            const start = timeToMinutes(block.startTime);
            const end = timeToMinutes(block.endTime);
            if (currentTime >= end) return 'past';
            if (currentTime >= start && currentTime < end) return 'current';
            return 'upcoming';
        },
        [currentTime]
    );

    // Progress within current block
    const currentProgress = useMemo(() => {
        if (!currentBlock) return 0;
        const start = timeToMinutes(currentBlock.startTime);
        const end = timeToMinutes(currentBlock.endTime);
        const total = end - start;
        if (total <= 0) return 0;
        return Math.min(100, ((currentTime - start) / total) * 100);
    }, [currentBlock, currentTime]);

    // Reset form
    const resetForm = () => {
        setFormTitle('');
        setFormCategory('study');
        setFormStartTime('08:00');
        setFormEndTime('09:00');
        setFormDays([1, 2, 3, 4, 5]);
        setEditingBlock(null);
    };

    // Open modal for editing
    const openEdit = (block: RoutineBlock) => {
        setEditingBlock(block);
        setFormTitle(block.title);
        setFormCategory(block.category);
        setFormStartTime(block.startTime);
        setFormEndTime(block.endTime);
        setFormDays(block.daysOfWeek);
        setIsModalOpen(true);
    };

    // Save block
    const handleSave = async () => {
        if (!user?.uid || !formTitle.trim()) {
            toast.error('Please enter a title');
            return;
        }

        if (timeToMinutes(formEndTime) <= timeToMinutes(formStartTime)) {
            toast.error('End time must be after start time');
            return;
        }

        const cat = CATEGORIES[formCategory];
        const blockData = {
            title: formTitle.trim(),
            category: formCategory,
            startTime: formStartTime,
            endTime: formEndTime,
            color: cat.color,
            icon: cat.icon,
            isActive: true,
            daysOfWeek: formDays,
        };

        try {
            if (editingBlock) {
                await updateRoutineBlock(editingBlock.id, blockData);
                setBlocks((prev) =>
                    prev.map((b) => (b.id === editingBlock.id ? { ...b, ...blockData, updatedAt: new Date() } : b))
                );
                toast.success('Block updated!');
            } else {
                const newBlock = await createRoutineBlock(user.uid, blockData);
                setBlocks((prev) => [...prev, newBlock]);
                toast.success('Block added!');
            }
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error saving block:', error);
            toast.error('Failed to save block');
        }
    };

    // Delete block
    const handleDelete = async (blockId: string) => {
        try {
            await deleteRoutineBlock(blockId);
            setBlocks((prev) => prev.filter((b) => b.id !== blockId));
            toast.success('Block removed');
        } catch (error) {
            console.error('Error deleting block:', error);
            toast.error('Failed to delete block');
        }
    };

    // Toggle day in form
    const toggleDay = (day: number) => {
        setFormDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-display">
                        <span className="gradient-text">My Routine</span>
                    </h1>
                    <p className="text-gray-400 mt-1">
                        {sortedBlocks.length} activities today • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <Button
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="gap-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    Add Block
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Study', value: `${stats.studyHours}h`, color: CATEGORIES.study.color, icon: '📚' },
                    { label: 'Break', value: `${stats.breakHours}h`, color: CATEGORIES.break.color, icon: '☕' },
                    { label: 'Exercise', value: `${stats.exerciseHours}h`, color: CATEGORIES.exercise.color, icon: '🏃' },
                    { label: 'Total', value: `${stats.totalHours}h`, color: '#00d4ff', icon: '⏱️' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="relative overflow-hidden rounded-2xl border border-dark-600/50 bg-dark-800/50 backdrop-blur-sm p-4"
                    >
                        <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${stat.color}, transparent)` }} />
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{stat.icon}</span>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">{stat.label}</p>
                                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Current Activity Banner */}
            <AnimatePresence>
                {currentBlock && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                            'relative overflow-hidden rounded-2xl border p-5',
                            'bg-gradient-to-r',
                            CATEGORIES[currentBlock.category].bg,
                            CATEGORIES[currentBlock.category].glow
                        )}
                        style={{ borderColor: `${CATEGORIES[currentBlock.category].color}40` }}
                    >
                        {/* Animated pulse ring */}
                        <motion.div
                            className="absolute top-4 right-4 w-3 h-3 rounded-full"
                            style={{ backgroundColor: CATEGORIES[currentBlock.category].color }}
                            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />

                        <div className="flex items-center gap-4">
                            <span className="text-3xl">{currentBlock.icon}</span>
                            <div className="flex-1">
                                <p className="text-xs text-gray-300 uppercase tracking-wider mb-1">Now</p>
                                <h3 className="text-xl font-bold text-white">{currentBlock.title}</h3>
                                <p className="text-sm text-gray-300 mt-1">
                                    {formatTime12h(currentBlock.startTime)} — {formatTime12h(currentBlock.endTime)}
                                </p>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-4 h-1.5 bg-dark-900/50 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: CATEGORIES[currentBlock.category].color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${currentProgress}%` }}
                                transition={{ duration: 1 }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-right">{Math.round(currentProgress)}% complete</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-neon-cyan/50 via-neon-purple/30 to-transparent" />

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <motion.div
                            className="w-8 h-8 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                    </div>
                ) : sortedBlocks.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <ClockIcon className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-400 mb-2">No routine blocks yet</h3>
                        <p className="text-gray-500 mb-6">Start building your daily routine to boost productivity</p>
                        <Button
                            onClick={() => {
                                resetForm();
                                setIsModalOpen(true);
                            }}
                            className="gap-2"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Add Your First Block
                        </Button>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        {sortedBlocks.map((block, index) => {
                            const status = getBlockStatus(block);
                            const cat = CATEGORIES[block.category];
                            const startMins = timeToMinutes(block.startTime);
                            const endMins = timeToMinutes(block.endTime);
                            const duration = endMins - startMins;

                            return (
                                <motion.div
                                    key={block.id}
                                    initial={{ opacity: 0, x: -30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.08, type: 'spring', stiffness: 100 }}
                                    className="relative flex items-start gap-4 pl-4"
                                >
                                    {/* Timeline dot */}
                                    <div className="relative z-10 mt-5">
                                        {status === 'current' ? (
                                            <motion.div
                                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                                style={{ borderColor: cat.color, backgroundColor: `${cat.color}30` }}
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                            </motion.div>
                                        ) : status === 'past' ? (
                                            <CheckCircleSolidIcon className="w-5 h-5 text-neon-green" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-gray-600 bg-dark-800" />
                                        )}
                                    </div>

                                    {/* Block card */}
                                    <motion.div
                                        className={cn(
                                            'flex-1 rounded-2xl border p-4 transition-all group',
                                            status === 'current' && cn('bg-gradient-to-r', cat.bg, cat.glow),
                                            status === 'past' && 'bg-dark-800/30 border-dark-600/30 opacity-60',
                                            status === 'upcoming' && 'bg-dark-800/50 border-dark-600/50 hover:border-dark-500'
                                        )}
                                        style={status === 'current' ? { borderColor: `${cat.color}40` } : undefined}
                                        whileHover={{ scale: 1.01, x: 4 }}
                                        transition={{ type: 'spring', stiffness: 300 }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{cat.icon}</span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-white">{block.title}</h4>
                                                        {status === 'current' && (
                                                            <motion.span
                                                                className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full"
                                                                style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                                                                animate={{ opacity: [1, 0.6, 1] }}
                                                                transition={{ duration: 2, repeat: Infinity }}
                                                            >
                                                                Now
                                                            </motion.span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-400 mt-0.5">
                                                        {formatTime12h(block.startTime)} — {formatTime12h(block.endTime)}
                                                        <span className="text-gray-500 ml-2">
                                                            ({Math.floor(duration / 60)}h {duration % 60 > 0 ? `${duration % 60}m` : ''})
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEdit(block)}
                                                    className="p-2 rounded-lg hover:bg-dark-600/50 text-gray-400 hover:text-white transition-colors"
                                                >
                                                    <PencilSquareIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(block.id)}
                                                    className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress for current block */}
                                        {status === 'current' && (
                                            <div className="mt-3">
                                                <div className="h-1 bg-dark-900/50 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full rounded-full"
                                                        style={{ backgroundColor: cat.color }}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${currentProgress}%` }}
                                                        transition={{ duration: 1 }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Day pills */}
                                        <div className="flex gap-1 mt-3">
                                            {DAY_LABELS.map((label, dayIndex) => (
                                                <span
                                                    key={label}
                                                    className={cn(
                                                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                                        block.daysOfWeek.includes(dayIndex)
                                                            ? 'bg-dark-600/80 text-gray-300'
                                                            : 'text-gray-600'
                                                    )}
                                                >
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                    </motion.div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add / Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={editingBlock ? 'Edit Block' : 'Add Routine Block'}
                description="Define an activity for your daily schedule"
            >
                <div className="space-y-4">
                    <Input
                        label="Activity Name"
                        placeholder="e.g., Morning Study Session"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                    />

                    {/* Category selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                        <div className="grid grid-cols-5 gap-2">
                            {(Object.entries(CATEGORIES) as [RoutineCategory, typeof CATEGORIES[RoutineCategory]][]).map(
                                ([key, cat]) => (
                                    <button
                                        key={key}
                                        onClick={() => setFormCategory(key)}
                                        className={cn(
                                            'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                                            formCategory === key
                                                ? 'border-neon-cyan bg-neon-cyan/10'
                                                : 'border-dark-600 hover:border-dark-500 bg-dark-800/50'
                                        )}
                                    >
                                        <span className="text-xl">{cat.icon}</span>
                                        <span className="text-[10px] font-medium text-gray-300">{cat.label}</span>
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* Time inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Start Time</label>
                            <input
                                type="time"
                                value={formStartTime}
                                onChange={(e) => setFormStartTime(e.target.value)}
                                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/50 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">End Time</label>
                            <input
                                type="time"
                                value={formEndTime}
                                onChange={(e) => setFormEndTime(e.target.value)}
                                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Days of week */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Active Days</label>
                        <div className="flex gap-2">
                            {DAY_LABELS.map((label, i) => (
                                <button
                                    key={label}
                                    onClick={() => toggleDay(i)}
                                    className={cn(
                                        'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                                        formDays.includes(i)
                                            ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                                            : 'bg-dark-800 text-gray-500 border border-dark-600 hover:border-dark-500'
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setIsModalOpen(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleSave}>
                            {editingBlock ? 'Update Block' : 'Add Block'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
