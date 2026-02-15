
/**
 * AI Service for client-side interactions
 */

import { buildAuthHeaders } from '@/lib/clientAuth';

export interface ProcessDocumentResponse {
    data: Record<string, unknown>;
    error?: string;
}

export async function processDocument(
    type: 'subject' | 'syllabus' | 'exam-routine',
    file?: File | null,
    text?: string
): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append('type', type);

    if (file) {
        formData.append('file', file);
    }

    if (text) {
        formData.append('text', text);
    }

    try {
        const headers = await buildAuthHeaders();
        const response = await fetch('/api/ai/process-document', {
            method: 'POST',
            headers,
            body: formData,
        });

        const textResponse = await response.text();
        let result;
        try {
            result = JSON.parse(textResponse);
        } catch {
            // If parsing fails, use text for error logging
            result = { error: 'Invalid JSON response', raw: textResponse };
        }

        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            console.error('API Response Text:', textResponse);
            throw new Error(result.error || `Failed to process document: ${response.status}`);
        }

        if (result && typeof result === 'object' && 'data' in result) {
            const data = (result as ProcessDocumentResponse).data;
            if (data && typeof data === 'object') {
                return data;
            }
        }

        throw new Error('Invalid response payload from AI endpoint');
    } catch (error) {
        console.error('Error in aiService:', error);
        throw error;
    }
}
