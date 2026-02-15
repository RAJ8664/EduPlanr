/**
 * Generate Flashcards API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

export async function POST(request: NextRequest) {
  try {
    const { content, count = 5 } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const openAIKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    const prompt = `Based on the following study content, generate ${count} flashcard question-answer pairs.
Format your response strictly as a JSON array with objects containing "question" and "answer" fields.
Make questions test understanding, not just memorization.

Content:
${content}`;

    if (openAIKey) {
      const openai = new OpenAI({ apiKey: openAIKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that creates educational flashcards. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const responseText = response.choices[0]?.message?.content || '[]';
      const flashcards = parseJsonArray(responseText);
      return NextResponse.json({ flashcards });
    }

    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(
        `${prompt}\n\nRespond with valid JSON only.`
      );
      const flashcards = parseJsonArray(result.response.text() || '[]');
      return NextResponse.json({ flashcards });
    }

    return NextResponse.json(
      { error: 'No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Flashcards API error:', error);
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 });
  }
}
