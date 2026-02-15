/**
 * Summarize Notes API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const openAIKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (openAIKey) {
      const openai = new OpenAI({ apiKey: openAIKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, well-structured summaries of study materials. Use bullet points and highlight key concepts.'
          },
          {
            role: 'user',
            content: `Please summarize the following study notes, highlighting the most important concepts and key points:\n\n${content}`
          },
        ],
        max_tokens: 800,
        temperature: 0.5,
      });

      const summary = response.choices[0]?.message?.content || 'Unable to generate summary.';
      return NextResponse.json({ summary });
    }

    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt =
        'Create a concise, structured summary with key bullet points from these study notes:\n\n' +
        content;
      const result = await model.generateContent(prompt);
      const summary = result.response.text() || 'Unable to generate summary.';
      return NextResponse.json({ summary });
    }

    return NextResponse.json(
      { error: 'No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Summarize API error:', error);
    return NextResponse.json({ error: 'Failed to summarize notes' }, { status: 500 });
  }
}
