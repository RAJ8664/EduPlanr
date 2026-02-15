/**
 * AI Tutor API Client
 * Calls Next.js API routes for secure OpenAI integration
 */

import { ChatMessage } from '@/types';
import { buildAuthHeaders } from '@/lib/clientAuth';

/**
 * Send a message to the AI Tutor
 */
export async function sendTutorMessage(
  messages: ChatMessage[],
  userMessage: string
): Promise<string> {
  try {
    const headers = await buildAuthHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch('/api/tutor/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        userMessage,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get response');
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Tutor API error:', error);
    throw error;
  }
}

/**
 * Generate flashcards from content
 */
export async function generateFlashcards(
  content: string,
  count: number = 5
): Promise<Array<{ question: string; answer: string }>> {
  try {
    const headers = await buildAuthHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch('/api/tutor/flashcards', {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, count }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate flashcards');
    }

    const data = await response.json();
    return data.flashcards;
  } catch (error) {
    console.error('Flashcards API error:', error);
    throw error;
  }
}

/**
 * Summarize notes
 */
export async function summarizeNotes(content: string): Promise<string> {
  try {
    const headers = await buildAuthHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch('/api/tutor/summarize', {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to summarize');
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('Summarize API error:', error);
    throw error;
  }
}

/**
 * Generate practice questions
 */
export async function generateQuestions(
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  count: number = 5
): Promise<Array<{ question: string; options?: string[]; answer: string; explanation: string }>> {
  try {
    const headers = await buildAuthHeaders({
      'Content-Type': 'application/json',
    });

    const response = await fetch('/api/tutor/questions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic, difficulty, count }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate questions');
    }

    const data = await response.json();
    return data.questions;
  } catch (error) {
    console.error('Questions API error:', error);
    throw error;
  }
}
