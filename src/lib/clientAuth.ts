import { auth } from '@/lib/firebase';

export async function getAuthToken(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use this feature');
  }
  return user.getIdToken();
}

export async function buildAuthHeaders(
  baseHeaders?: Record<string, string>
): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return {
    ...(baseHeaders || {}),
    Authorization: `Bearer ${token}`,
  };
}
