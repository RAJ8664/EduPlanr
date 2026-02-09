
/**
 * AI Service for client-side interactions
 */

export interface ProcessDocumentResponse {
    data: any;
    error?: string;
}

export async function processDocument(
    type: 'subject' | 'syllabus',
    file?: File | null,
    text?: string
): Promise<any> {
    const formData = new FormData();
    formData.append('type', type);

    if (file) {
        formData.append('file', file);
    }

    if (text) {
        formData.append('text', text);
    }

    try {
        const response = await fetch('/api/ai/process-document', {
            method: 'POST',
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

        return result.data;
    } catch (error) {
        console.error('Error in aiService:', error);
        throw error;
    }
}
