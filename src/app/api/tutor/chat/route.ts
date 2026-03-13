/**
 * AI Tutor Chat API Route (Gemini)
 * Secure server-side Google Gemini integration with Model Fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiAuthError, requireApiUser } from '@/lib/serverAuth';
import { ApiRateLimitError, enforceRateLimit } from '@/lib/serverRateLimit';

const SYSTEM_PROMPT = `You are EduPlanr's Smart Tutor, an intelligent and friendly study assistant. Your role is to help students learn effectively.

Guidelines:
1. Be encouraging and supportive - celebrate progress and effort
2. Explain concepts clearly, using analogies when helpful
3. Break down complex topics into digestible parts
4. Ask clarifying questions to understand the student's level
5. Provide examples and practice problems when appropriate
6. Suggest study techniques and memory aids
7. Be concise but thorough - respect the student's time
8. If you don't know something, be honest and suggest resources

You can help with:
- Explaining difficult concepts in any subject
- Creating study plans and schedules
- Generating practice questions and flashcards
- Summarizing notes and textbook chapters
- Providing tips for exam preparation
- Motivating and encouraging students

Remember: You're here to empower students to learn, not just give answers. Guide them to understanding.`;

// List of models to try in order of preference (Verified Mar 2026)
const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

const MAX_OUTPUT_TOKENS = 2048;
const MAX_CONTINUATIONS = 2;

function didHitTokenLimit(response: { candidates?: Array<{ finishReason?: unknown }> } | null | undefined): boolean {
  const finishReason = response?.candidates?.[0]?.finishReason;
  if (typeof finishReason !== 'string') return false;
  return finishReason.toUpperCase().includes('MAX_TOKENS');
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown error');
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  return realIp || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const apiUser = await requireApiUser(request);
    const clientIp = getClientIp(request);
    enforceRateLimit(`tutor:chat:user:${apiUser.uid}`, { limit: 20, windowMs: 60_000 });
    enforceRateLimit(`tutor:chat:ip:${clientIp}`, { limit: 80, windowMs: 60_000 });

    const { messages, userMessage } = await request.json();

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: 'userMessage is required' }, { status: 400 });
    }

    if (userMessage.length > 6000) {
      return NextResponse.json({ error: 'userMessage is too long' }, { status: 400 });
    }

    // Support both GEMINI_API_KEY and GOOGLE_API_KEY
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI tutor is not configured on the server. Set GEMINI_API_KEY or GOOGLE_API_KEY.' },
        { status: 503 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Prepare history once
    // OpenAI format: { role: 'user' | 'assistant', content: string }
    // Gemini format: { role: 'user' | 'model', parts: [{ text: string }] }
    let history = (Array.isArray(messages) ? messages : [])
      .slice(-10)
      .filter((msg: unknown) => {
        if (!msg || typeof msg !== 'object') return false;
        const row = msg as { role?: string; content?: string };
        return Boolean(row.content && typeof row.content === 'string');
      })
      .map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content.slice(0, 4000) }],
      }));

    // Gemini requires the first message in history to be from 'user'
    if (history.length > 0 && history[0].role === 'model') {
      history = history.slice(1);
    }

    // Try models in sequence
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
        });

        const chat = model.startChat({
          history: history,
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0.7,
          },
        });

        const firstResult = await chat.sendMessage(userMessage);
        const firstResponse = await firstResult.response;
        let fullContent = firstResponse.text();

        let continuationCount = 0;
        let currentResponse = firstResponse;

        while (didHitTokenLimit(currentResponse) && continuationCount < MAX_CONTINUATIONS) {
          const continuationResult = await chat.sendMessage(
            'Continue exactly from where you stopped. Do not repeat earlier text. Keep the same structure and complete the answer.'
          );
          currentResponse = await continuationResult.response;
          const continuationText = currentResponse.text();

          if (!continuationText.trim()) {
            break;
          }

          fullContent = `${fullContent}\n\n${continuationText}`;
          continuationCount += 1;
        }

        // If successful, return immediately
        return NextResponse.json({ content: fullContent });

      } catch (error: unknown) {
        lastError = error;

        // Check for specific fatal errors
        const message = getErrorMessage(error);
        if (message.includes('API key') || message.includes('location')) {
          // If key is invalid or location blocked, stop trying others
          break;
        }
      }
    }

    // If all failed, return the error to the user as a chat message for debugging
    const detail = lastError ? ` ${getErrorMessage(lastError)}` : '';
    return NextResponse.json(
      { error: `All available Gemini models failed.${detail}` },
      { status: 502 }
    );

  } catch (error: unknown) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof ApiRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            'Retry-After': String(error.retryAfterSeconds),
          },
        }
      );
    }

    return NextResponse.json(
      { error: `Tutor request failed: ${getErrorMessage(error)}` },
      { status: 500 }
    );
  }
}
