/**
 * Study Materials Page
 * CRUD interface for notes, links, and documents with REAL Firebase data
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  DocumentTextIcon,
  LinkIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  ListBulletIcon,
  HeartIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { Card, Button, Input, Badge, Modal } from '@/components/ui';
import { cn, formatSmartDate } from '@/lib/utils';
import { StudyMaterial, MaterialType, Subject } from '@/types';
import { useAuthStore } from '@/store';
import {
  getUserMaterials,
  createMaterial,
  deleteMaterial,
  toggleMaterialFavorite,
} from '@/services/materialsService';
import { getUserSubjects } from '@/services/subjectsService';

const materialTypeConfig: Record<MaterialType, { icon: React.ElementType; color: string }> = {
  note: { icon: DocumentTextIcon, color: 'text-neon-cyan' },
  link: { icon: LinkIcon, color: 'text-neon-purple' },
  document: { icon: FolderIcon, color: 'text-neon-green' },
  flashcard: { icon: Squares2X2Icon, color: 'text-neon-yellow' },
};

export default function MaterialsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MaterialType | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<MaterialType>('note');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newTags, setNewTags] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    try {
      const [fetchedMaterials, fetchedSubjects] = await Promise.all([
        getUserMaterials(user.uid),
        getUserSubjects(user.uid),
      ]);
      setMaterials(fetchedMaterials);
      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast.error('Failed to load materials');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const queryFromUrl = searchParams.get('q');
    if (queryFromUrl !== null) {
      setSearchQuery(queryFromUrl);
    }
  }, [searchParams]);

  // Filter materials
  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || material.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleToggleFavorite = async (e: React.MouseEvent, id: string, currentStatus: boolean) => {
    e.stopPropagation();
    try {
      await toggleMaterialFavorite(id, !currentStatus);
      setMaterials(prev => prev.map(m => m.id === id ? { ...m, isFavorite: !currentStatus } : m));
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    try {
      await deleteMaterial(id);
      setMaterials(prev => prev.filter(m => m.id !== id));
      setSelectedMaterial(null);
      toast.success('Material deleted');
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('Failed to delete material');
    }
  };

  const handleAddMaterial = async () => {
    if (!user?.uid || !newTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      const tagsArray = newTags.split(',').map(t => t.trim()).filter(Boolean);

      const newMaterial = await createMaterial(user.uid, {
        title: newTitle.trim(),
        content: newContent.trim(),
        type: newType,
        tags: tagsArray,
        subjectId: newSubjectId || null,
        syllabusId: null,
        url: newType === 'link' ? newUrl : null,
        isFavorite: false,
        isArchived: false,
      });

      setMaterials(prev => [newMaterial, ...prev]);

      // Reset form
      setNewTitle('');
      setNewContent('');
      setNewUrl('');
      setNewType('note');
      setNewSubjectId('');
      setNewTags('');
      setIsAddModalOpen(false);
      toast.success('Material added successfully!');
    } catch (error) {
      console.error('Error adding material:', error);
      toast.error('Failed to add material');
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
          <h1 className="text-3xl font-bold text-white font-display">Materials</h1>
          <p className="text-gray-400 mt-1">
            {materials.length} items • {materials.filter((m) => m.isFavorite).length} favorites
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<PlusIcon className="w-5 h-5" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Material
        </Button>
      </motion.div>

      {/* Filters and search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col md:flex-row gap-4"
      >
        {/* Search */}
        <div className="flex-1">
          <Input
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <Button
            variant={selectedType === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setSelectedType('all')}
          >
            All
          </Button>
          {(Object.keys(materialTypeConfig) as MaterialType[]).map((type) => {
            const config = materialTypeConfig[type];
            return (
              <Button
                key={type}
                variant={selectedType === type ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedType(type)}
                leftIcon={<config.icon className="w-4 h-4" />}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}s
              </Button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-dark-800 rounded-xl p-1">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
            className="!rounded-lg"
          >
            <Squares2X2Icon className="w-5 h-5" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
            className="!rounded-lg"
          >
            <ListBulletIcon className="w-5 h-5" />
          </Button>
        </div>
      </motion.div>

      {/* Materials grid/list */}
      <AnimatePresence mode="wait">
        {filteredMaterials.length > 0 ? (
          viewMode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredMaterials.map((material, index) => {
                const TypeIcon = materialTypeConfig[material.type].icon;
                const typeColor = materialTypeConfig[material.type].color;

                return (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      hoverable
                      className="h-full cursor-pointer flex flex-col"
                      onClick={() => setSelectedMaterial(material)}
                    >
                      <div className="flex items-start justify-between">
                        <div className={cn('p-2 rounded-xl bg-dark-700/50', typeColor)}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleToggleFavorite(e, material.id, material.isFavorite)}
                            className="p-1.5 rounded-lg hover:bg-dark-700/50 transition-colors"
                          >
                            {material.isFavorite ? (
                              <HeartSolidIcon className="w-5 h-5 text-neon-pink" />
                            ) : (
                              <HeartIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-white mt-4 line-clamp-2">
                        {material.title}
                      </h3>

                      {material.type === 'link' && material.url && (
                        <p className="text-sm text-gray-400 mt-1 truncate">
                          {material.url}
                        </p>
                      )}

                      {material.content && material.type !== 'link' && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                          {material.content}
                        </p>
                      )}

                      <div className="flex-1" />

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {material.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="default" size="sm">
                            {tag}
                          </Badge>
                        ))}
                        {material.tags.length > 3 && (
                          <Badge variant="default" size="sm">
                            +{material.tags.length - 3}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-4">
                        Updated {formatSmartDate(material.updatedAt)}
                      </p>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {filteredMaterials.map((material, index) => {
                const TypeIcon = materialTypeConfig[material.type].icon;
                const typeColor = materialTypeConfig[material.type].color;

                return (
                  <motion.div
                    key={material.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-dark-700/30 transition-colors"
                      onClick={() => setSelectedMaterial(material)}
                    >
                      <div className={cn('p-2 rounded-xl bg-dark-700/50', typeColor)}>
                        <TypeIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">
                          {material.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {material.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="default" size="sm">
                              {tag}
                            </Badge>
                          ))}
                          <span className="text-xs text-gray-500">
                            {formatSmartDate(material.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleToggleFavorite(e, material.id, material.isFavorite)}
                          className="p-2 rounded-lg hover:bg-dark-700/50 transition-colors"
                        >
                          {material.isFavorite ? (
                            <HeartSolidIcon className="w-5 h-5 text-neon-pink" />
                          ) : (
                            <HeartIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card className="py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-dark-700/50 flex items-center justify-center">
                <DocumentTextIcon className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No materials found</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Start adding study materials to organize your learning'}
              </p>
              <Button
                variant="primary"
                onClick={() => setIsAddModalOpen(true)}
                leftIcon={<PlusIcon className="w-5 h-5" />}
              >
                Add Material
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add material modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Material"
        description="Create a new study material"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Calculus Notes"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as MaterialType)}
                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
              >
                <option value="note">Note</option>
                <option value="link">Link</option>
                <option value="document">Document</option>
                <option value="flashcard">Flashcard Set</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Subject</label>
              <select
                value={newSubjectId}
                onChange={(e) => setNewSubjectId(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
              >
                <option value="">None</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {newType === 'link' && (
            <Input
              label="URL"
              placeholder="https://..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Content/Description</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
              placeholder="Enter notes or description..."
              className="w-full px-4 py-2.5 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 resize-none"
            />
          </div>

          <Input
            label="Tags (comma separated)"
            placeholder="math, calculus, important"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddMaterial}>
              Create Material
            </Button>
          </div>
        </div>
      </Modal>

      {/* Material detail modal */}
      <Modal
        isOpen={!!selectedMaterial}
        onClose={() => setSelectedMaterial(null)}
        title={selectedMaterial?.title || ''}
        size="lg"
      >
        {selectedMaterial && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="neon">{selectedMaterial.type}</Badge>
              {selectedMaterial.tags.map((tag) => (
                <Badge key={tag} variant="default">
                  {tag}
                </Badge>
              ))}
              {selectedMaterial.subjectId && subjects.find(s => s.id === selectedMaterial.subjectId) && (
                <Badge variant="default" className="bg-neon-purple/20 text-neon-purple border-neon-purple/20">
                  {subjects.find(s => s.id === selectedMaterial.subjectId)?.name}
                </Badge>
              )}
            </div>

            {selectedMaterial.type === 'link' && selectedMaterial.url && (
              <div className="p-4 rounded-xl bg-dark-700/30 flex items-center justify-between">
                <a
                  href={selectedMaterial.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neon-cyan hover:underline truncate mr-4"
                >
                  {selectedMaterial.url}
                </a>
                <a
                  href={selectedMaterial.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="secondary" leftIcon={<ArrowTopRightOnSquareIcon className="w-4 h-4" />}>
                    Open
                  </Button>
                </a>
              </div>
            )}

            {selectedMaterial.content && (
              <div
                className="prose prose-invert max-w-none p-4 rounded-xl bg-dark-700/30 whitespace-pre-wrap"
              >
                {selectedMaterial.content}
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-dark-600/50">
              <p className="text-xs text-gray-500">
                Created: {formatSmartDate(selectedMaterial.createdAt)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  leftIcon={<TrashIcon className="w-4 h-4" />}
                  onClick={() => {
                    handleDelete(selectedMaterial.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
