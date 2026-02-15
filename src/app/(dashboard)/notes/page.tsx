/**
 * Notes Editor Page
 * Rich text editor for study notes
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  StarIcon,
  ClockIcon,
  TrashIcon,
  EllipsisHorizontalIcon,
  SparklesIcon,
  ArrowPathIcon,
  BoldIcon,
  ItalicIcon,
  ListBulletIcon,
  LinkIcon,
  PhotoIcon,
  CodeBracketIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Card, Button, Input, Badge, Modal } from '@/components/ui';
import { cn, formatSmartDate } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mock notes data
const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Calculus Integration Techniques',
    content: `<h2>Integration by Parts</h2>
<p>The integration by parts formula is derived from the product rule:</p>
<p><strong>∫u dv = uv - ∫v du</strong></p>
<h3>LIATE Rule</h3>
<p>When choosing u and dv, follow the LIATE rule:</p>
<ul>
<li><strong>L</strong>ogarithmic functions</li>
<li><strong>I</strong>nverse trig functions</li>
<li><strong>A</strong>lgebraic functions</li>
<li><strong>T</strong>rigonometric functions</li>
<li><strong>E</strong>xponential functions</li>
</ul>`,
    tags: ['calculus', 'integration'],
    isFavorite: true,
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    title: 'Binary Search Tree Operations',
    content: `<h2>BST Operations</h2>
<h3>Insertion</h3>
<p>Time complexity: O(log n) average, O(n) worst case</p>
<pre><code>function insert(node, value) {
  if (node === null) return new Node(value);
  if (value < node.value) {
    node.left = insert(node.left, value);
  } else {
    node.right = insert(node.right, value);
  }
  return node;
}</code></pre>`,
    tags: ['data-structures', 'algorithms'],
    isFavorite: false,
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: '3',
    title: 'Physics: Newton\'s Laws',
    content: `<h2>Three Laws of Motion</h2>
<h3>First Law (Inertia)</h3>
<p>An object remains at rest or in uniform motion unless acted upon by a force.</p>
<h3>Second Law (F = ma)</h3>
<p>Force equals mass times acceleration.</p>
<h3>Third Law (Action-Reaction)</h3>
<p>For every action, there is an equal and opposite reaction.</p>`,
    tags: ['physics', 'mechanics'],
    isFavorite: true,
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(Date.now() - 172800000),
  },
];

// Simplified rich text toolbar buttons
const toolbarButtons = [
  { icon: 'B', command: 'bold', title: 'Bold (Ctrl+B)' },
  { icon: 'I', command: 'italic', title: 'Italic (Ctrl+I)' },
  { icon: 'U', command: 'underline', title: 'Underline (Ctrl+U)' },
  { icon: 'H1', command: 'formatBlock', value: 'h1', title: 'Heading 1' },
  { icon: 'H2', command: 'formatBlock', value: 'h2', title: 'Heading 2' },
  { icon: '• ', command: 'insertUnorderedList', title: 'Bullet List' },
  { icon: '1.', command: 'insertOrderedList', title: 'Numbered List' },
  { icon: '""', command: 'formatBlock', value: 'blockquote', title: 'Quote' },
  { icon: '</>', command: 'formatBlock', value: 'pre', title: 'Code Block' },
];

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  const sanitizeHtml = (html: string) =>
    DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

  // Filter notes
  const filteredNotes = notes.filter((note) =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Select note
  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(sanitizeHtml(note.content));
    setIsEditing(false);
  };

  // Create new note
  const handleNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '<p>Start writing...</p>',
      tags: [],
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setNotes((prev) => [newNote, ...prev]);
    handleSelectNote(newNote);
    setIsEditing(true);
  };

  // Save note
  const handleSaveNote = () => {
    if (!selectedNote) return;
    const sanitizedContent = sanitizeHtml(editContent);
    
    setNotes((prev) =>
      prev.map((note) =>
        note.id === selectedNote.id
          ? { ...note, title: editTitle, content: sanitizedContent, updatedAt: new Date() }
          : note
      )
    );
    setSelectedNote({ ...selectedNote, title: editTitle, content: sanitizedContent });
    setEditContent(sanitizedContent);
    setIsEditing(false);
  };

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === id ? { ...note, isFavorite: !note.isFavorite } : note
      )
    );
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, isFavorite: !selectedNote.isFavorite });
    }
  };

  // Delete note
  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }
  };

  // Execute formatting command
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Notes sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 flex flex-col bg-dark-800/50 rounded-2xl border border-dark-600/50 overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="p-4 border-b border-dark-600/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">Notes</h2>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<PlusIcon className="w-4 h-4" />}
                  onClick={handleNewNote}
                >
                  New
                </Button>
              </div>
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
              />
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={cn(
                    'w-full p-3 rounded-xl text-left transition-all',
                    selectedNote?.id === note.id
                      ? 'bg-neon-cyan/10 border border-neon-cyan/30'
                      : 'hover:bg-dark-700/50 border border-transparent'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-white line-clamp-1">
                      {note.title}
                    </h3>
                    {note.isFavorite && (
                      <StarSolidIcon className="w-4 h-4 text-neon-yellow flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatSmartDate(note.updatedAt)}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {note.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="default" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </button>
              ))}

              {filteredNotes.length === 0 && (
                <div className="text-center py-8">
                  <DocumentTextIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No notes found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor area */}
      <div className="flex-1 flex flex-col bg-dark-800/50 rounded-2xl border border-dark-600/50 overflow-hidden">
        {selectedNote ? (
          <>
            {/* Editor toolbar */}
            <div className="flex items-center justify-between p-3 border-b border-dark-600/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="p-2 rounded-lg hover:bg-dark-700/50 transition-colors text-gray-400 md:hidden"
                >
                  <ChevronLeftIcon className={cn('w-5 h-5 transition-transform', !showSidebar && 'rotate-180')} />
                </button>
                
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="font-semibold text-lg"
                  />
                ) : (
                  <h2 className="text-lg font-semibold text-white">{selectedNote.title}</h2>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleFavorite(selectedNote.id)}
                  className="p-2 rounded-lg hover:bg-dark-700/50 transition-colors"
                >
                  {selectedNote.isFavorite ? (
                    <StarSolidIcon className="w-5 h-5 text-neon-yellow" />
                  ) : (
                    <StarIcon className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {isEditing ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveNote}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                )}

                <button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Formatting toolbar (only in edit mode) */}
            {isEditing && (
              <div className="flex items-center gap-1 p-2 border-b border-dark-600/50 overflow-x-auto">
                {toolbarButtons.map((btn, index) => (
                  <button
                    key={index}
                    onClick={() => execCommand(btn.command, btn.value)}
                    title={btn.title}
                    className="px-3 py-1.5 rounded-lg hover:bg-dark-700/50 text-gray-300 hover:text-white transition-colors font-mono text-sm"
                  >
                    {btn.icon}
                  </button>
                ))}
                <div className="h-6 w-px bg-dark-600 mx-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<SparklesIcon className="w-4 h-4" />}
                  className="text-neon-purple hover:text-neon-pink"
                >
                  AI Enhance
                </Button>
              </div>
            )}

            {/* Editor content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isEditing ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="prose prose-invert prose-neon max-w-none min-h-full focus:outline-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(editContent) }}
                  onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
                />
              ) : (
                <div
                  className="prose prose-invert prose-neon max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedNote.content) }}
                />
              )}
            </div>

            {/* Footer with metadata */}
            <div className="flex items-center justify-between p-3 border-t border-dark-600/50 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>Created {formatSmartDate(selectedNote.createdAt)}</span>
                <span>Updated {formatSmartDate(selectedNote.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedNote.tags.map((tag) => (
                  <Badge key={tag} variant="default" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
                <DocumentTextIcon className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Select or create a note
              </h3>
              <p className="text-gray-400 mb-6 max-w-md">
                Choose a note from the sidebar or create a new one to get started
              </p>
              <Button
                variant="primary"
                onClick={handleNewNote}
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                Create Note
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
