
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    console.log(`[AI API] ${request.method} request received`);
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const text = formData.get('text') as string | null;
        const type = formData.get('type') as 'subject' | 'syllabus';

        if (!type || (!file && !text)) {
            return NextResponse.json(
                { error: 'Missing required fields: type and either file or text' },
                { status: 400 }
            );
        }

        // Extract text from file if provided
        let extractedText = text || '';
        if (file) {
            if (file.type === 'application/pdf') {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    const data = await pdf(buffer);
                    extractedText = data.text;
                } catch (error) {
                    console.error('Error parsing PDF:', error);
                    return NextResponse.json(
                        { error: 'Failed to parse PDF file' },
                        { status: 400 }
                    );
                }
            } else {
                // Assume text file
                extractedText = await file.text();
            }
        }

        if (!extractedText.trim()) {
            return NextResponse.json(
                { error: 'No text content found to process' },
                { status: 400 }
            );
        }

        // Initialize Gemini
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Server configuration error: API key missing' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Use gemini-3-flash-preview (corrected ID)
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        let prompt = '';
        if (type === 'subject') {
            prompt = `
        Analyze the following text and extract Subject information.
        Return ONLY a JSON object with the following fields:
        - name: (string) The name of the subject/course
        - description: (string) A brief description (max 200 chars)
        - creditHours: (number) Creating hours if mentioned, default to 3
        - color: (string) A suggested hex color code for this subject
        - icon: (string) A suggested single emoji icon for this subject

        Text to analyze:
        ${extractedText.slice(0, 15000)} // Limit context window
      `;
        } else if (type === 'syllabus') {
            prompt = `
        Analyze the following text and extract a list of Syllabus Topics.
        Return ONLY a JSON object with a "topics" field, which is an array of objects.
        Each topic object should have:
        - title: (string) Topic title
        - description: (string) Brief description
        - estimatedHours: (number) Estimated hours to study (default to 2 if not found)

        Text to analyze:
        ${extractedText.slice(0, 25000)} // Limit context window
      `;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textResponse = response.text();

        // Clean up markdown code blocks if present
        const jsonString = textResponse.replace(/^```json\n|\n```$/g, '').trim();

        try {
            const data = JSON.parse(jsonString);
            return NextResponse.json({ data });
        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            return NextResponse.json(
                { error: 'Failed to parse AI response', raw: textResponse },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('Error processing document:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({ message: 'API route is working' }, { status: 200 });
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
