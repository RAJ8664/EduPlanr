import 'server-only';

import { NextRequest } from 'next/server';

interface FirebaseLookupUser {
  localId: string;
  email?: string;
}

interface FirebaseLookupResponse {
  users?: FirebaseLookupUser[];
}

export interface ApiUser {
  uid: string;
  email?: string;
}

export class ApiAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

function getBearerToken(request: NextRequest): string {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiAuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new ApiAuthError('Missing bearer token', 401);
  }
  return token;
}

async function verifyIdToken(idToken: string): Promise<ApiUser> {
  if (!FIREBASE_API_KEY) {
    throw new ApiAuthError('Server is missing Firebase API key configuration', 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: controller.signal,
      }
    );

    const data = (await response.json()) as FirebaseLookupResponse & { error?: { message?: string } };
    if (!response.ok) {
      const message = data?.error?.message || 'Token verification failed';
      throw new ApiAuthError(message, 401);
    }

    const user = data.users?.[0];
    if (!user?.localId) {
      throw new ApiAuthError('Invalid auth token payload', 401);
    }

    return { uid: user.localId, email: user.email };
  } catch (error) {
    if (error instanceof ApiAuthError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiAuthError('Auth verification timed out', 503);
    }

    throw new ApiAuthError('Unable to verify auth token', 401);
  } finally {
    clearTimeout(timeout);
  }
}

export async function requireApiUser(request: NextRequest): Promise<ApiUser> {
  const token = getBearerToken(request);
  return verifyIdToken(token);
}
