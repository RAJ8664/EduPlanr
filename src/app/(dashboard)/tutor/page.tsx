/**
 * Smart Tutor Page
 * AI tutor chat with persistent conversation history.
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Avatar, Button, Card, PageHero } from '@/components/ui';
import { cn, formatSmartDate, parseErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/store';
import { ChatMessage, Conversation } from '@/types';
import { sendTutorMessage } from '@/services/tutorApiClient';
import {
  createConversation,
  deleteConversation,
  getUserConversations,
  updateConversationMessages,
} from '@/services/conversationsService';

const QUICK_PROMPTS = [
  'Help me make a 7-day study plan for finals.',
  'Explain this topic like I am a beginner.',
  'Quiz me with 5 practice questions on my subject.',
];

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildWelcomeMessage(displayName: string | null | undefined): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: `Hi ${displayName?.split(' ')[0] || 'there'}! I am your Smart Tutor. Ask for explanations, study plans, summaries, or practice questions and I will help you step by step.`,
    timestamp: new Date(),
  };
}

function deriveConversationTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return 'New Chat';
  const trimmed = firstUserMessage.content.trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
}

export default function TutorPage() {
  const { user, profile } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const welcomeMessage = useMemo(() => buildWelcomeMessage(profile?.displayName), [profile?.displayName]);

  const loadConversations = useCallback(async () => {
    if (!user?.uid) {
      setConversations([]);
      setActiveConversationId(null);
      setMessages([welcomeMessage]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const fetched = await getUserConversations(user.uid);
      setConversations(fetched);
      if (fetched.length > 0) {
        setActiveConversationId(fetched[0].id);
        setMessages(fetched[0].messages.length > 0 ? fetched[0].messages : [welcomeMessage]);
      } else {
        setActiveConversationId(null);
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load chat history');
      setMessages([welcomeMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, welcomeMessage]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([welcomeMessage]);
      return;
    }

    const nextActive = conversations.find((conversation) => conversation.id === activeConversationId);
    if (!nextActive) {
      setMessages([welcomeMessage]);
      return;
    }

    setMessages(nextActive.messages.length > 0 ? nextActive.messages : [welcomeMessage]);
  }, [activeConversationId, conversations, welcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const syncConversationInList = useCallback((conversationId: string, nextMessages: ChatMessage[]) => {
    const updatedAt = new Date();
    setConversations((prev) => {
      const existing = prev.find((conversation) => conversation.id === conversationId);
      if (!existing) return prev;

      const updatedConversation: Conversation = {
        ...existing,
        title: deriveConversationTitle(nextMessages),
        messages: nextMessages,
        updatedAt,
      };

      return [updatedConversation, ...prev.filter((conversation) => conversation.id !== conversationId)];
    });
  }, []);

  const handleSendMessage = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!user?.uid || isTyping || !input.trim()) return;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      };

      const beforeResponse = [...messages, userMessage];
      setMessages(beforeResponse);
      setInput('');
      setIsTyping(true);

      try {
        const aiResponse = await sendTutorMessage(beforeResponse, userMessage.content);
        const assistantMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
        };

        const finalMessages = [...beforeResponse, assistantMessage];
        setMessages(finalMessages);

        if (activeConversationId) {
          await updateConversationMessages(activeConversationId, user.uid, finalMessages);
          syncConversationInList(activeConversationId, finalMessages);
        } else {
          const created = await createConversation(user.uid, finalMessages);
          setActiveConversationId(created.id);
          setConversations((prev) => [created, ...prev]);
        }
      } catch (error) {
        console.error('Tutor request failed:', error);
        const message = parseErrorMessage(error);
        const failureMessage: ChatMessage = {
          id: createMessageId(),
          role: 'assistant',
          content: `I could not complete that request right now. ${message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, failureMessage]);
        toast.error('Tutor request failed');
      } finally {
        setIsTyping(false);
      }
    },
    [activeConversationId, input, isTyping, messages, syncConversationInList, user?.uid]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([welcomeMessage]);
    setInput('');
  }, [welcomeMessage]);

  const handleDeleteActiveConversation = useCallback(async () => {
    if (!user?.uid || !activeConversationId) {
      handleNewChat();
      return;
    }

    if (!confirm('Delete this conversation?')) return;

    try {
      await deleteConversation(activeConversationId, user.uid);
      setConversations((prev) => prev.filter((conversation) => conversation.id !== activeConversationId));
      const remaining = conversations.filter((conversation) => conversation.id !== activeConversationId);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        handleNewChat();
      }
      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  }, [activeConversationId, conversations, handleNewChat, user?.uid]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-4">
      <Card className="hidden lg:flex flex-col overflow-hidden border-dark-600/50 bg-dark-800/50">
        <div className="p-4 border-b border-dark-600/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">Tutor Chats</h2>
              <p className="text-xs text-gray-400">{conversations.length} saved</p>
            </div>
            <Button variant="primary" size="sm" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={handleNewChat}>
              New
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={handleNewChat}
            className={cn(
              'w-full rounded-xl p-3 text-left border transition-colors',
              !activeConversationId
                ? 'border-neon-cyan/40 bg-neon-cyan/10'
                : 'border-transparent hover:bg-dark-700/50'
            )}
          >
            <p className="text-sm font-medium text-white">New Chat</p>
            <p className="text-xs text-gray-500 mt-1">Start a fresh conversation</p>
          </button>

          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setActiveConversationId(conversation.id)}
              className={cn(
                'w-full rounded-xl p-3 text-left border transition-colors',
                activeConversationId === conversation.id
                  ? 'border-neon-cyan/40 bg-neon-cyan/10'
                  : 'border-transparent hover:bg-dark-700/50'
              )}
            >
              <p className="text-sm font-medium text-white line-clamp-1">{conversation.title || 'New Chat'}</p>
              <p className="text-xs text-gray-500 mt-1">{formatSmartDate(conversation.updatedAt)}</p>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-4 min-h-0">
        <PageHero
          tone="violet"
          icon={SparklesIcon}
          title="Smart Tutor"
          subtitle="Persistent AI tutor chat with real conversation history."
          metrics={[
            { label: 'Chats', value: conversations.length },
            { label: 'Messages', value: messages.length },
            { label: 'Mode', value: isTyping ? 'Typing' : 'Ready' },
          ]}
          action={
            <>
              <Button variant="secondary" size="sm" leftIcon={<PlusIcon className="w-4 h-4" />} onClick={handleNewChat}>
                New Chat
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<TrashIcon className="w-4 h-4" />}
                onClick={() => void handleDeleteActiveConversation()}
                disabled={!activeConversationId}
              >
                Delete
              </Button>
            </>
          }
        />

        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-dark-600/50 bg-dark-800/50">
          <div className="p-3 border-b border-dark-600/50 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="px-3 py-1.5 text-xs rounded-full border border-dark-500/60 bg-dark-700/40 text-gray-300 hover:text-white hover:border-neon-cyan/40 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex gap-3 max-w-[88%]', isUser && 'ml-auto flex-row-reverse')}
                >
                  <div className="flex-shrink-0">
                    {isUser ? (
                      <Avatar name={profile?.displayName || 'User'} size="sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
                        <CpuChipIcon className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      'p-4 rounded-2xl text-sm leading-relaxed',
                      isUser
                        ? 'bg-neon-cyan text-dark-900 rounded-tr-none font-medium'
                        : 'bg-dark-700 border border-dark-600 text-gray-100 rounded-tl-none'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className={cn('text-xs mt-2 opacity-60', isUser ? 'text-cyan-900' : 'text-gray-400')}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-[88%]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
                  <CpuChipIcon className="w-5 h-5 text-white" />
                </div>
                <div className="bg-dark-700 border border-dark-600 p-4 rounded-2xl rounded-tl-none flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-neon-cyan/60 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 rounded-full bg-neon-cyan/60 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-neon-cyan/60 animate-bounce" />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-dark-600/50">
            <form onSubmit={(event) => void handleSendMessage(event)} className="relative">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask for explanations, plans, summaries, or questions..."
                disabled={isTyping}
                className="w-full rounded-xl border border-dark-500/60 bg-dark-700/40 text-white px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
              />

              <button
                type="submit"
                disabled={isTyping || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-neon-cyan text-dark-900 hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTyping ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PaperAirplaneIcon className="w-5 h-5" />}
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                {messages.length} messages in current chat
              </span>
              <span>Verify important information independently.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
