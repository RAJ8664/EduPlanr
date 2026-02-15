/**
 * Notes Page
 * Real Firebase-backed notes editor with smart writing tools.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ChevronLeftIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Badge, Button, Input, PageHero } from '@/components/ui';
import { cn, formatSmartDate, stripHtml } from '@/lib/utils';
import { useAuthStore } from '@/store';
import { NoteMaterial, createNote, deleteNote, getUserNotes, toggleNoteFavorite, updateNote } from '@/services/notesService';
import { summarizeNotes } from '@/services/tutorApiClient';
import DOMPurify from 'dompurify';

const toolbarButtons: Array<{
  label: string;
  command: string;
  value?: string;
  title: string;
}> = [
  { label: 'B', command: 'bold', title: 'Bold (Ctrl+B)' },
  { label: 'I', command: 'italic', title: 'Italic (Ctrl+I)' },
  { label: 'U', command: 'underline', title: 'Underline (Ctrl+U)' },
  { label: 'H1', command: 'formatBlock', value: 'h1', title: 'Heading 1' },
  { label: 'H2', command: 'formatBlock', value: 'h2', title: 'Heading 2' },
  { label: '•', command: 'insertUnorderedList', title: 'Bullet List' },
  { label: '1.', command: 'insertOrderedList', title: 'Numbered List' },
  { label: '</>', command: 'formatBlock', value: 'pre', title: 'Code Block' },
];

const EMPTY_NOTE_HTML = '<p>Start writing...</p>';

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function sanitizePlainText(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export default function NotesPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [notes, setNotes] = useState<NoteMaterial[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftTagsInput, setDraftTagsInput] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return notes.filter((note) => {
      const matchesFavorites = !showFavoritesOnly || note.isFavorite;
      if (!matchesFavorites) return false;

      if (!query) return true;

      const titleMatch = note.title.toLowerCase().includes(query);
      const tagMatch = note.tags.some((tag) => tag.toLowerCase().includes(query));
      const contentMatch = stripHtml(note.content).toLowerCase().includes(query);
      return titleMatch || tagMatch || contentMatch;
    });
  }, [notes, searchQuery, showFavoritesOnly]);

  const favoriteCount = useMemo(() => notes.filter((note) => note.isFavorite).length, [notes]);

  const loadNotes = useCallback(async () => {
    if (!user?.uid) {
      setNotes([]);
      setSelectedNoteId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const fetchedNotes = await getUserNotes(user.uid);
      setNotes(fetchedNotes);
      setSelectedNoteId((prev) => prev || fetchedNotes[0]?.id || null);
    } catch (error) {
      console.error('Failed to load notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  const syncEditorWithNote = useCallback((note: NoteMaterial | null) => {
    const safeContent = sanitizeHtml(note?.content || EMPTY_NOTE_HTML);
    if (editorRef.current) {
      editorRef.current.innerHTML = safeContent;
    }
    setDraftTitle(note?.title || '');
    setDraftTagsInput((note?.tags || []).join(', '));
    setPreviewHtml(safeContent);
    setIsDirty(false);
    setIsEditing(true);
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    syncEditorWithNote(selectedNote);
  }, [selectedNote, syncEditorWithNote]);

  useEffect(() => {
    const queryFromUrl = searchParams.get('q');
    if (queryFromUrl !== null) {
      setSearchQuery(queryFromUrl);
    }
  }, [searchParams]);

  const handleSelectNote = useCallback(
    (note: NoteMaterial) => {
      if (selectedNoteId === note.id) return;
      setSelectedNoteId(note.id);
      setShowSidebar(true);
    },
    [selectedNoteId]
  );

  const handleCreateNote = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const created = await createNote(user.uid, {
        title: 'Untitled Note',
        content: EMPTY_NOTE_HTML,
        tags: [],
      });

      setNotes((prev) => [created, ...prev]);
      setSelectedNoteId(created.id);
      setShowSidebar(true);
      toast.success('Note created');
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to create note');
    }
  }, [user?.uid]);

  const handleToggleFavorite = useCallback(
    async (noteId: string) => {
      const target = notes.find((note) => note.id === noteId);
      if (!target) return;

      const nextFavorite = !target.isFavorite;
      setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, isFavorite: nextFavorite } : note)));

      try {
        await toggleNoteFavorite(noteId, nextFavorite);
      } catch (error) {
        console.error('Failed to update favorite:', error);
        setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, isFavorite: target.isFavorite } : note)));
        toast.error('Failed to update favorite');
      }
    },
    [notes]
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!confirm('Delete this note permanently?')) return;

      const deletedIndex = notes.findIndex((note) => note.id === noteId);
      if (deletedIndex < 0) return;

      const deletedNote = notes[deletedIndex];
      const nextSelection =
        notes[deletedIndex + 1]?.id || notes[deletedIndex - 1]?.id || null;

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(nextSelection);
      }

      try {
        await deleteNote(noteId);
        toast.success('Note deleted');
      } catch (error) {
        console.error('Failed to delete note:', error);
        setNotes((prev) => {
          const restored = [...prev];
          restored.splice(deletedIndex, 0, deletedNote);
          return restored;
        });
        if (selectedNoteId === noteId) {
          setSelectedNoteId(noteId);
        }
        toast.error('Failed to delete note');
      }
    },
    [notes, selectedNoteId]
  );

  const handleSaveNote = useCallback(async () => {
    if (!selectedNote) return;
    const editorContent = sanitizeHtml(editorRef.current?.innerHTML || EMPTY_NOTE_HTML);

    const cleanTitle = draftTitle.trim() || 'Untitled Note';
    const tags = draftTagsInput
      .split(',')
      .map((tag) => sanitizePlainText(tag.trim().toLowerCase()))
      .filter(Boolean);

    setIsSaving(true);
    try {
      await updateNote(selectedNote.id, {
        title: cleanTitle,
        content: editorContent,
        tags,
      });

      setNotes((prev) =>
        prev
          .map((note) =>
            note.id === selectedNote.id
              ? {
                  ...note,
                  title: cleanTitle,
                  content: editorContent,
                  tags,
                  updatedAt: new Date(),
                }
              : note
          )
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      );

      setDraftTitle(cleanTitle);
      setDraftTagsInput(tags.join(', '));
      setPreviewHtml(editorContent);
      setIsDirty(false);
      toast.success('Note saved');
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  }, [draftTagsInput, draftTitle, selectedNote]);

  const handleEnhanceSummary = useCallback(async () => {
    const rawContent = stripHtml(editorRef.current?.innerHTML || '').trim();
    if (!rawContent) {
      toast.error('Write something first');
      return;
    }

    setIsEnhancing(true);
    try {
      const summary = await summarizeNotes(rawContent);
      const safeSummaryText = sanitizePlainText(summary).replace(/\n/g, '<br/>');
      const summaryBlock = `<h3>AI Summary</h3><p>${safeSummaryText}</p>`;
      const currentContent = sanitizeHtml(editorRef.current?.innerHTML || EMPTY_NOTE_HTML);
      const merged = `${currentContent}<hr/>${summaryBlock}`;

      if (editorRef.current) {
        editorRef.current.innerHTML = merged;
      }

      setPreviewHtml(merged);
      setIsDirty(true);
      toast.success('Summary added to your note');
    } catch (error) {
      console.error('Failed to summarize note:', error);
      toast.error('AI summary failed');
    } finally {
      setIsEnhancing(false);
    }
  }, []);

  const execFormatCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    setIsDirty(true);
  }, []);

  useEffect(() => {
    const handleKeyboardSave = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      if (!selectedNote || !isEditing) return;
      event.preventDefault();
      void handleSaveNote();
    };

    window.addEventListener('keydown', handleKeyboardSave);
    return () => window.removeEventListener('keydown', handleKeyboardSave);
  }, [handleSaveNote, isEditing, selectedNote]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHero
        tone="emerald"
        icon={DocumentTextIcon}
        title="Notes"
        subtitle="Capture ideas fast, organize by tags, and summarize with AI support."
        metrics={[
          { label: 'Total', value: notes.length },
          { label: 'Starred', value: favoriteCount },
          { label: 'Visible', value: filteredNotes.length },
        ]}
        action={
          <Button variant="primary" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={handleCreateNote}>
            New Note
          </Button>
        }
      />

      <div className="flex h-[calc(100vh-14.5rem)] gap-4">
      <aside
        className={cn(
          'w-full md:w-[340px] md:flex-shrink-0 flex-col bg-dark-800/50 rounded-2xl border border-dark-600/50 overflow-hidden',
          showSidebar ? 'flex' : 'hidden md:flex'
        )}
      >
        <div className="p-4 border-b border-dark-600/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Notes</h2>
              <p className="text-xs text-gray-400">{notes.length} total • {favoriteCount} starred</p>
            </div>
            <Button variant="primary" size="sm" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={handleCreateNote}>
              New
            </Button>
          </div>

          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
          />

          <button
            onClick={() => setShowFavoritesOnly((prev) => !prev)}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm border transition-colors',
              showFavoritesOnly
                ? 'border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow'
                : 'border-dark-600/60 bg-dark-700/40 text-gray-300 hover:text-white'
            )}
          >
            <StarSolidIcon className="w-4 h-4" />
            Starred Only
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-10">
              <DocumentTextIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No notes found</p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={cn(
                  'w-full p-3 rounded-xl text-left transition-all border',
                  selectedNoteId === note.id
                    ? 'bg-neon-cyan/10 border-neon-cyan/30'
                    : 'border-transparent hover:bg-dark-700/50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-white line-clamp-1">{note.title}</h3>
                  {note.isFavorite ? (
                    <StarSolidIcon className="w-4 h-4 text-neon-yellow flex-shrink-0" />
                  ) : (
                    <StarIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{stripHtml(note.content) || 'Empty note'}</p>
                <p className="text-xs text-gray-500 mt-2">{formatSmartDate(note.updatedAt)}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col bg-dark-800/50 rounded-2xl border border-dark-600/50 overflow-hidden">
        {selectedNote ? (
          <>
            <div className="border-b border-dark-600/50 p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => setShowSidebar((prev) => !prev)}
                    className="md:hidden p-2 rounded-lg hover:bg-dark-700/50 text-gray-400"
                  >
                    <ChevronLeftIcon className={cn('w-5 h-5 transition-transform', !showSidebar && 'rotate-180')} />
                  </button>
                  <Input
                    value={draftTitle}
                    onChange={(event) => {
                      setDraftTitle(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Untitled Note"
                    className="font-semibold"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleToggleFavorite(selectedNote.id)}
                    leftIcon={selectedNote.isFavorite ? <StarSolidIcon className="w-4 h-4 text-neon-yellow" /> : <StarIcon className="w-4 h-4" />}
                  >
                    Star
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isEditing) {
                        setPreviewHtml(sanitizeHtml(editorRef.current?.innerHTML || EMPTY_NOTE_HTML));
                        setIsEditing(false);
                        return;
                      }
                      setIsEditing(true);
                    }}
                  >
                    {isEditing ? 'Preview' : 'Edit'}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleEnhanceSummary()}
                    isLoading={isEnhancing}
                    leftIcon={<SparklesIcon className="w-4 h-4" />}
                  >
                    Summarize
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleSaveNote()}
                    isLoading={isSaving}
                    disabled={!isDirty}
                  >
                    Save
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDeleteNote(selectedNote.id)}
                    leftIcon={<TrashIcon className="w-4 h-4" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <Input
                value={draftTagsInput}
                onChange={(event) => {
                  setDraftTagsInput(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="tags (comma separated): math, revision, finals"
              />
            </div>

            {isEditing && (
              <div className="p-2 border-b border-dark-600/50 flex items-center gap-1 overflow-x-auto">
                {toolbarButtons.map((btn) => (
                  <button
                    key={`${btn.command}-${btn.label}`}
                    title={btn.title}
                    onClick={() => execFormatCommand(btn.command, btn.value)}
                    className="px-3 py-1.5 rounded-lg text-sm font-mono text-gray-300 hover:text-white hover:bg-dark-700/50 transition-colors"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5">
              {isEditing ? (
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => setIsDirty(true)}
                  className="prose prose-invert prose-neon max-w-none min-h-full focus:outline-none"
                />
              ) : (
                <div
                  className="prose prose-invert prose-neon max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
                />
              )}
            </div>

            <div className="border-t border-dark-600/50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-3">
                <span>Created {formatSmartDate(selectedNote.createdAt)}</span>
                <span>Updated {formatSmartDate(selectedNote.updatedAt)}</span>
                {isDirty && <span className="text-neon-yellow">Unsaved changes</span>}
              </div>

              <div className="flex flex-wrap gap-1">
                {draftTagsInput
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((tag) => (
                    <Badge key={tag} size="sm" variant="outline">
                      {tag}
                    </Badge>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
                <DocumentTextIcon className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Start your notes workspace</h3>
              <p className="text-gray-400 mb-6">Create a note to capture ideas, summaries, and revision points.</p>
              <Button variant="primary" leftIcon={<PlusIcon className="w-5 h-5" />} onClick={() => void handleCreateNote()}>
                Create Note
              </Button>
            </motion.div>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
