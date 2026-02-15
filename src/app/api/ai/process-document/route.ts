import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiAuthError, requireApiUser } from '@/lib/serverAuth';
import { ApiRateLimitError, enforceRateLimit } from '@/lib/serverRateLimit';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODELS_TO_TRY = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
];

function cleanModelJsonResponse(textResponse: string): string {
    return textResponse
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
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
        enforceRateLimit(`ai:process-document:user:${apiUser.uid}`, { limit: 10, windowMs: 60_000 });
        enforceRateLimit(`ai:process-document:ip:${clientIp}`, { limit: 30, windowMs: 60_000 });

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const text = formData.get('text') as string | null;
        const type = formData.get('type') as 'subject' | 'syllabus' | 'exam-routine';

        if (!type || !['subject', 'syllabus', 'exam-routine'].includes(type) || (!file && !text)) {
            return NextResponse.json(
                { error: 'Missing required fields: type and either file or text' },
                { status: 400 }
            );
        }

        if (file && file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'File is too large. Maximum allowed size is 10MB.' },
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

        let prompt = '';
        if (type === 'subject') {
            prompt = `
        Analyze the following text and extract ALL subjects/courses mentioned.
        Return ONLY a JSON object with a "subjects" field containing an array of subject objects.
        Each subject object should have:
        - name: (string) The name of the subject/course
        - description: (string) A brief description (max 200 chars)
        - creditHours: (number) Credit hours if mentioned, default to 3
        - color: (string) A suggested unique hex color code for this subject (make each subject a different color)
        - icon: (string) A suggested single emoji icon for this subject

        If the text mentions only one subject, still return it inside the subjects array.
        If the text is just a subject name or a short list, infer reasonable descriptions and details.

        Text to analyze:
        ${extractedText.slice(0, 25000)}
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
        } else if (type === 'exam-routine') {
            prompt = `
        Analyze the following text and extract ALL exam/test entries mentioned.
        Return ONLY a JSON object with an "exams" field containing an array of exam objects.
        Each exam object should have:
        - subjectName: (string) The subject or course name for this exam
        - date: (string) The exam date in YYYY-MM-DD format. If only a relative date like "next Monday" is given, make your best guess.
        - startTime: (string) Start time in HH:mm (24-hour) format. Default to "09:00" if not mentioned.
        - endTime: (string) End time in HH:mm (24-hour) format. Default to "12:00" if not mentioned.
        - venue: (string) Exam venue/room if mentioned, otherwise empty string
        - notes: (string) Any additional notes like "open book", "calculator allowed", etc. Empty string if none.

        Extract every exam mentioned. If dates are ambiguous, use the current year 2026.
        If a time range is given like "10am-1pm", convert to 24-hour format.

        Text to analyze:
        ${extractedText.slice(0, 25000)}
      `;
        }

        let textResponse = '';
        let lastModelError: unknown = null;

        for (const modelName of MODELS_TO_TRY) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                textResponse = response.text();
                if (textResponse) {
                    break;
                }
            } catch (error) {
                lastModelError = error;
                console.warn(`Model ${modelName} failed for process-document route`);
            }
        }

        if (!textResponse) {
            return NextResponse.json(
                {
                    error: 'All configured Gemini models failed',
                    details:
                        lastModelError instanceof Error
                            ? lastModelError.message
                            : 'Unknown model error',
                },
                { status: 502 }
            );
        }

        // Clean up markdown code blocks if present
        const jsonString = cleanModelJsonResponse(textResponse);

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
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('Error processing document:', error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
