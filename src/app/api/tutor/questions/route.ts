/**
 * Generate Practice Questions API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiAuthError, requireApiUser } from '@/lib/serverAuth';
import { ApiRateLimitError, enforceRateLimit } from '@/lib/serverRateLimit';

function parseJsonArray(text: string): unknown[] {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
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
    enforceRateLimit(`tutor:questions:user:${apiUser.uid}`, { limit: 12, windowMs: 60_000 });
    enforceRateLimit(`tutor:questions:ip:${clientIp}`, { limit: 40, windowMs: 60_000 });

    const { topic, difficulty = 'medium', count = 5 } = await request.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }

    if (topic.length > 1000) {
      return NextResponse.json({ error: 'topic is too long' }, { status: 400 });
    }

    const safeDifficulty = ['easy', 'medium', 'hard'].includes(String(difficulty))
      ? String(difficulty)
      : 'medium';
    const safeCount = Number.isFinite(Number(count))
      ? Math.max(1, Math.min(20, Number(count)))
      : 5;

    const openAIKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    const prompt = `Generate ${safeCount} ${safeDifficulty} level practice questions about: ${topic}

For each question, provide:
- The question itself
- 4 multiple choice options (A, B, C, D) if applicable
- The correct answer
- A brief explanation of why that's the correct answer

Format as a JSON array with objects containing: question, options (array), answer, explanation.`;

    if (openAIKey) {
      const openai = new OpenAI({ apiKey: openAIKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an educational content creator. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      });

      const responseText = response.choices[0]?.message?.content || '[]';
      const questions = parseJsonArray(responseText);
      return NextResponse.json({ questions });
    }

    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(
        `${prompt}\n\nRespond with valid JSON only.`
      );
      const questions = parseJsonArray(result.response.text() || '[]');
      return NextResponse.json({ questions });
    }

    return NextResponse.json(
      { error: 'No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.' },
      { status: 503 }
    );
  } catch (error) {
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
    console.error('Questions API error:', error);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
