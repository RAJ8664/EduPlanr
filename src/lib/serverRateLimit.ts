import 'server-only';

export class ApiRateLimitError extends Error {
  status: number;
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface RateLimitState {
  count: number;
  resetAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __eduplanrRateLimitStore: Map<string, RateLimitState> | undefined;
}

const rateLimitStore = globalThis.__eduplanrRateLimitStore ?? new Map<string, RateLimitState>();
if (!globalThis.__eduplanrRateLimitStore) {
  globalThis.__eduplanrRateLimitStore = rateLimitStore;
}

export function enforceRateLimit(
  key: string,
  options?: {
    limit?: number;
    windowMs?: number;
  }
): void {
  const limit = options?.limit ?? 30;
  const windowMs = options?.windowMs ?? 60_000;

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    throw new ApiRateLimitError('Rate limit exceeded', retryAfterSeconds);
  }

  entry.count += 1;
  rateLimitStore.set(key, entry);
}
