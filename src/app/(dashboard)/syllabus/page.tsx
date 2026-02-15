/**
 * Syllabus Management Page
 * Track courses, topics, and progress - REAL Firebase data
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  AcademicCapIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { Card, Button, Input, Badge, Modal, Progress } from '@/components/ui';
import { cn, formatSmartDate } from '@/lib/utils';
import { Syllabus, SyllabusTopic, Subject } from '@/types';
import { useAuthStore } from '@/store';
import {
  getUserSyllabi,
  createSyllabus,
  deleteSyllabus,
  updateTopicStatus,
  addTopic,
  deleteTopic,
  calculateProgress,
} from '@/services/syllabusService';
import { getUserSubjects } from '@/services/subjectsService';
import { processDocument } from '@/services/aiService';
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

export default function SyllabusPage() {
  const { user } = useAuthStore();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSyllabus, setExpandedSyllabus] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [newCourseSubjectId, setNewCourseSubjectId] = useState('');

  // Topic add state
  const [addingTopicFor, setAddingTopicFor] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicHours, setNewTopicHours] = useState('2');

  // AI Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiText, setAiText] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);
  const [generatedTopics, setGeneratedTopics] = useState<SyllabusTopic[]>([]);


  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user?.uid) return;

    setIsLoading(true);
    try {
      const [fetchedSyllabi, fetchedSubjects] = await Promise.all([
        getUserSyllabi(user.uid),
        getUserSubjects(user.uid)
      ]);
      setSyllabi(fetchedSyllabi);
      setSubjects(fetchedSubjects);

      // Auto-expand first syllabus if none expanded
      if (fetchedSyllabi.length > 0 && !expandedSyllabus) {
        setExpandedSyllabus(fetchedSyllabi[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, expandedSyllabus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate overall progress
  const totalTopics = syllabi.reduce((sum, s) => sum + (s.topics?.length || 0), 0);
  const completedTopics = syllabi.reduce(
    (sum, s) => sum + (s.topics?.filter(t => t.status === 'completed').length || 0),
    0
  );
  const overallProgress = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;

  // Toggle topic completion
  const handleToggleTopic = async (syllabusId: string, topicId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'not-started' : 'completed';

    try {
      await updateTopicStatus(syllabusId, topicId, newStatus as 'completed' | 'not-started');

      setSyllabi(prev => prev.map(syllabus => {
        if (syllabus.id !== syllabusId) return syllabus;

        const updatedTopics = syllabus.topics.map(topic =>
          topic.id === topicId
            ? {
              ...topic,
              status: newStatus as 'completed' | 'not-started',
              isCompleted: newStatus === 'completed',
              completedAt: newStatus === 'completed' ? new Date() : null,
            }
            : topic
        );

        const completedCount = updatedTopics.filter(t => t.status === 'completed').length;

        return {
          ...syllabus,
          topics: updatedTopics,
          completedTopics: completedCount,
        };
      }));
    } catch (error) {
      console.error('Error updating topic:', error);
      toast.error('Failed to update topic');
    }
  };

  // Add new syllabus/course
  const handleAddCourse = async () => {
    if (!user?.uid || !newCourseTitle.trim()) {
      toast.error('Please enter a course title');
      return;
    }

    try {
      const newSyllabus = await createSyllabus(user.uid, {
        subjectId: newCourseSubjectId,
        title: newCourseTitle.trim(),
        description: newCourseDescription.trim(),
        topics: generatedTopics,
        startDate: new Date(),
        endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 4 months
        totalTopics: generatedTopics.length,
        completedTopics: 0,
      });

      setSyllabi(prev => [newSyllabus, ...prev]);

      // Reset form
      setNewCourseTitle('');
      setNewCourseDescription('');
      setNewCourseSubjectId('');
      setGeneratedTopics([]);
      setAiFile(null);
      setAiText('');
      setShowAiInput(false);
      setIsAddModalOpen(false);
      toast.success('Course added successfully!');
    } catch (error) {
      console.error('Error creating syllabus:', error);
      toast.error('Failed to create course');
    }
  };

  // Delete syllabus
  const handleDeleteSyllabus = async (syllabusId: string) => {
    if (!confirm('Are you sure you want to delete this course and all its topics?')) return;

    try {
      await deleteSyllabus(syllabusId);
      setSyllabi(prev => prev.filter(s => s.id !== syllabusId));
      toast.success('Course deleted');
    } catch (error) {
      console.error('Error deleting syllabus:', error);
      toast.error('Failed to delete course');
    }
  };

  // Add topic to syllabus
  const handleAddTopic = async (syllabusId: string) => {
    if (!newTopicTitle.trim()) {
      toast.error('Please enter a topic title');
      return;
    }

    try {
      const syllabus = syllabi.find(s => s.id === syllabusId);
      if (!syllabus) return;

      const newTopic = await addTopic(syllabusId, {
        syllabusId,
        title: newTopicTitle.trim(),
        description: '',
        estimatedHours: parseInt(newTopicHours) || 2,
        priority: 'medium',
        status: 'not-started',
        order: syllabus.topics?.length || 0,
        isCompleted: false,
        notes: '',
      });

      setSyllabi(prev => prev.map(s =>
        s.id === syllabusId
          ? { ...s, topics: [...(s.topics || []), newTopic], totalTopics: (s.totalTopics || 0) + 1 }
          : s
      ));

      setNewTopicTitle('');
      setNewTopicHours('2');
      setAddingTopicFor(null);
      toast.success('Topic added!');
    } catch (error) {
      console.error('Error adding topic:', error);
      toast.error('Failed to add topic');
    }
  };

  // Delete topic
  const handleDeleteTopic = async (syllabusId: string, topicId: string) => {
    try {
      await deleteTopic(syllabusId, topicId);

      setSyllabi(prev => prev.map(s => {
        if (s.id !== syllabusId) return s;
        const updatedTopics = s.topics.filter(t => t.id !== topicId);
        return {
          ...s,
          topics: updatedTopics,
          totalTopics: updatedTopics.length,
          completedTopics: updatedTopics.filter(t => t.status === 'completed').length,
        };
      }));

      toast.success('Topic deleted');
    } catch (error) {
      console.error('Error deleting topic:', error);
      toast.error('Failed to delete topic');
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
          <h1 className="text-3xl font-bold text-white font-display">Syllabus</h1>
          <p className="text-gray-400 mt-1">
            {syllabi.length} courses • {completedTopics}/{totalTopics} topics completed
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<PlusIcon className="w-5 h-5" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Course
        </Button>
      </motion.div>

      {/* Overall progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card variant="glow" glowColor="purple" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20">
                <AcademicCapIcon className="w-6 h-6 text-neon-purple" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Overall Progress</h3>
                <p className="text-sm text-gray-400">Across all courses</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{Math.round(overallProgress)}%</p>
              <p className="text-sm text-gray-400">{completedTopics} of {totalTopics} topics</p>
            </div>
          </div>
          <Progress
            value={overallProgress}
            max={100}
            variant="default"
            size="lg"
            showLabel={false}
          />
        </Card>
      </motion.div>

      {/* Syllabi list */}
      <div className="space-y-4">
        {syllabi.map((syllabus, index) => {
          const progress = calculateProgress(syllabus);
          const isExpanded = expandedSyllabus === syllabus.id;
          const topicsCount = syllabus.topics?.length || 0;
          const completedCount = syllabus.topics?.filter(t => t.status === 'completed').length || 0;
          const linkedSubject = subjects.find(s => s.id === syllabus.subjectId);

          return (
            <motion.div
              key={syllabus.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card className="overflow-hidden">
                {/* Syllabus header */}
                <div className="flex items-center">
                  <button
                    className="flex-1 p-4 flex items-center gap-4 hover:bg-dark-700/30 transition-colors"
                    onClick={() => setExpandedSyllabus(isExpanded ? null : syllabus.id)}
                  >
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                    </motion.div>

                    <div className="p-2 rounded-xl bg-dark-700/50">
                      <BookOpenIcon className="w-6 h-6 text-neon-cyan" />
                    </div>

                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{syllabus.title}</h3>
                        {linkedSubject && (
                          <Badge variant="default" className="text-xs">
                            {linkedSubject.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-1">
                        {syllabus.description || 'No description'}
                      </p>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">
                          {completedCount}/{topicsCount}
                        </p>
                        <p className="text-xs text-gray-400">topics</p>
                      </div>
                      <div className="w-32">
                        <Progress
                          value={progress}
                          max={100}
                          variant="default"
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    </div>

                    {progress === 100 && (
                      <Badge variant="green">
                        <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteSyllabus(syllabus.id)}
                    className="p-4 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Topics list */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-dark-600/50"
                    >
                      <div className="p-4 space-y-2">
                        {(!syllabus.topics || syllabus.topics.length === 0) ? (
                          <p className="text-center text-gray-500 py-4">
                            No topics yet. Add your first topic!
                          </p>
                        ) : (
                          syllabus.topics.map((topic, topicIndex) => (
                            <motion.div
                              key={topic.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: topicIndex * 0.05 }}
                              className={cn(
                                'flex items-center gap-4 p-3 rounded-xl transition-colors',
                                topic.status === 'completed'
                                  ? 'bg-neon-green/5 border border-neon-green/20'
                                  : 'bg-dark-700/30 hover:bg-dark-700/50'
                              )}
                            >
                              <button
                                onClick={() => handleToggleTopic(syllabus.id, topic.id, topic.status)}
                                className="flex-shrink-0"
                              >
                                {topic.status === 'completed' ? (
                                  <CheckCircleSolidIcon className="w-6 h-6 text-neon-green" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full border-2 border-gray-500 hover:border-neon-green transition-colors" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <h4
                                  className={cn(
                                    'font-medium',
                                    topic.status === 'completed' ? 'text-gray-400 line-through' : 'text-white'
                                  )}
                                >
                                  {topic.title}
                                </h4>
                                {topic.description && (
                                  <p className="text-sm text-gray-500 line-clamp-1">
                                    {topic.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-sm">
                                <div className="flex items-center gap-1 text-gray-400">
                                  <ClockIcon className="w-4 h-4" />
                                  <span>{topic.estimatedHours}h</span>
                                </div>
                                {topic.completedAt && (
                                  <span className="text-xs text-gray-500">
                                    {formatSmartDate(topic.completedAt)}
                                  </span>
                                )}
                                <button
                                  onClick={() => handleDeleteTopic(syllabus.id, topic.id)}
                                  className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </motion.div>
                          ))
                        )}

                        {/* Add topic form */}
                        {addingTopicFor === syllabus.id ? (
                          <div className="flex items-center gap-2 p-2">
                            <input
                              type="text"
                              value={newTopicTitle}
                              onChange={(e) => setNewTopicTitle(e.target.value)}
                              placeholder="Topic title..."
                              className="flex-1 px-3 py-2 text-sm bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTopic(syllabus.id);
                                if (e.key === 'Escape') setAddingTopicFor(null);
                              }}
                            />
                            <input
                              type="number"
                              value={newTopicHours}
                              onChange={(e) => setNewTopicHours(e.target.value)}
                              placeholder="Hours"
                              className="w-16 px-2 py-2 text-sm bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan"
                            />
                            <Button size="sm" onClick={() => handleAddTopic(syllabus.id)}>Add</Button>
                            <Button size="sm" variant="ghost" onClick={() => setAddingTopicFor(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingTopicFor(syllabus.id)}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-dark-500 hover:border-neon-cyan/50 hover:bg-dark-700/30 transition-colors text-gray-400 hover:text-neon-cyan"
                          >
                            <PlusIcon className="w-5 h-5" />
                            <span>Add Topic</span>
                          </button>
                        )}
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
      {syllabi.length === 0 && (
        <Card className="py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
            <AcademicCapIcon className="w-10 h-10 text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No syllabi yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create your first syllabus to start tracking your learning progress
          </p>
          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<PlusIcon className="w-5 h-5" />}
          >
            Add Course
          </Button>
        </Card>
      )}

      {/* Add syllabus modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Course"
        description="Create a new syllabus to track your progress"
      >
        <div className="space-y-4">

          {/* AI Auto-fill Section */}
          <div className="bg-dark-800/50 rounded-xl p-4 border border-dark-600/50">
            <button
              onClick={() => setShowAiInput(!showAiInput)}
              className="flex items-center gap-2 text-sm font-medium text-neon-purple hover:text-neon-purple/80 transition-colors w-full"
            >
              <span className="flex items-center gap-2">
                ✨ Generate from Syllabus (PDF/Text)
              </span>
              <ChevronRightIcon className={cn("w-4 h-4 transition-transform", showAiInput ? "rotate-90" : "")} />
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
                      Upload a syllabus PDF or paste text to generate topics automatically.
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
                      placeholder="Paste syllabus content here..."
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-dark-900/50 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-neon-purple resize-none"
                      rows={3}
                    />

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-neon-purple/30 text-neon-purple hover:bg-neon-purple/10"
                      disabled={(!aiFile && !aiText) || isProcessing}
                      onClick={async () => {
                        if (!aiFile && !aiText) return;
                        setIsProcessing(true);
                        try {
                          const data = await processDocument('syllabus', aiFile, aiText);
                          if (data && data.topics && Array.isArray(data.topics)) {
                            const topics = data.topics.map((topic, index) => {
                              const parsed = topic && typeof topic === 'object'
                                ? (topic as Record<string, unknown>)
                                : {};

                              const priorityValue = parsed.priority;
                              const priority =
                                priorityValue === 'low' ||
                                priorityValue === 'medium' ||
                                priorityValue === 'high' ||
                                priorityValue === 'critical'
                                  ? priorityValue
                                  : 'medium';

                              return {
                                id: typeof parsed.id === 'string' ? parsed.id : '',
                                syllabusId: '',
                                title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : `Topic ${index + 1}`,
                                description: typeof parsed.description === 'string' ? parsed.description : '',
                                estimatedHours: typeof parsed.estimatedHours === 'number' ? parsed.estimatedHours : 2,
                                priority,
                                status: 'not-started',
                                completedAt: null,
                                order: index,
                                isCompleted: false,
                                notes: typeof parsed.notes === 'string' ? parsed.notes : '',
                              } satisfies SyllabusTopic;
                            });
                            setGeneratedTopics(topics);
                            toast.success(`Generated ${topics.length} topics! Review them below.`);
                            setShowAiInput(false);
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
                          Processing...
                        </>
                      ) : (
                        <>
                          <DocumentTextIcon className="w-4 h-4 mr-2" />
                          Generate Topics
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generated Topics Preview */}
            {generatedTopics.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-neon-green flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4" />
                  {generatedTopics.length} Topics Generated
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {generatedTopics.map((topic, idx) => (
                    <div key={idx} className="bg-dark-900/50 p-2 rounded-lg text-xs border border-dark-600/30">
                      <p className="font-medium text-gray-200">{topic.title}</p>
                      <p className="text-gray-500 line-clamp-1">{topic.description}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setGeneratedTopics([])}
                  className="text-xs text-red-400 hover:text-red-300 underline"
                >
                  Clear topics
                </button>
              </div>
            )}
          </div>

          <Input
            label="Course Title"
            placeholder="e.g., Advanced Mathematics"
            value={newCourseTitle}
            onChange={(e) => setNewCourseTitle(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Link to Subject (Optional)
            </label>
            <select
              value={newCourseSubjectId}
              onChange={(e) => setNewCourseSubjectId(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
            >
              <option value="">None</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              placeholder="What will you learn in this course?"
              value={newCourseDescription}
              onChange={(e) => setNewCourseDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/50 transition-all resize-none"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddCourse}>
              Create Course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
