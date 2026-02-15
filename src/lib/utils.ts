/**
 * Utility functions for common operations
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isYesterday, isTomorrow, isValid } from 'date-fns';

/**
 * Merge Tailwind classes with proper precedence
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse any date-like value (Firestore Timestamp, string, Date, etc.)
 * Returns a valid Date or null
 */
interface ToDateLike {
  toDate: () => Date;
}

interface SecondsLike {
  seconds: number;
}

function hasToDate(value: unknown): value is ToDateLike {
  return !!value && typeof value === 'object' && 'toDate' in value && typeof (value as ToDateLike).toDate === 'function';
}

function hasSeconds(value: unknown): value is SecondsLike {
  return !!value && typeof value === 'object' && 'seconds' in value && typeof (value as SecondsLike).seconds === 'number';
}

export function safeParseDate(value: unknown): Date | null {
  if (!value) return null;
  // Firestore Timestamp with .toDate()
  if (hasToDate(value)) {
    try {
      const d = value.toDate();
      return isValid(d) ? d : null;
    } catch { return null; }
  }
  // Raw Firestore timestamp object { seconds, nanoseconds }
  if (hasSeconds(value)) {
    const d = new Date(value.seconds * 1000);
    return isValid(d) ? d : null;
  }
  // Already a Date
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }
  // String or number
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isValid(d) ? d : null;
  }

  return null;
}

/**
 * Format date for display with smart relative formatting
 */
export function formatSmartDate(date: unknown): string {
  const parsed = safeParseDate(date);
  if (!parsed) return '';

  if (isToday(parsed)) {
    return `Today at ${format(parsed, 'h:mm a')}`;
  }
  if (isYesterday(parsed)) {
    return `Yesterday at ${format(parsed, 'h:mm a')}`;
  }
  if (isTomorrow(parsed)) {
    return `Tomorrow at ${format(parsed, 'h:mm a')}`;
  }

  // Within the last 7 days
  const daysAgo = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7 && daysAgo > 0) {
    return formatDistanceToNow(parsed, { addSuffix: true });
  }

  // Same year
  if (parsed.getFullYear() === new Date().getFullYear()) {
    return format(parsed, 'MMM d');
  }

  return format(parsed, 'MMM d, yyyy');
}

/**
 * Format duration in minutes to human readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatTimer(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a random color from a predefined palette
 */
export function getRandomColor(): string {
  const colors = [
    '#00f5ff', // cyan
    '#bf00ff', // purple
    '#ff0080', // pink
    '#00ff88', // green
    '#ff8800', // orange
    '#6366f1', // indigo
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#14b8a6', // teal
    '#f59e0b', // amber
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Generate color based on string hash (consistent color per string)
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#00f5ff', '#bf00ff', '#ff0080', '#00ff88', '#ff8800',
    '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b',
  ];

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if running on client side
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Parse error message from various error types
 */
export function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Generate a unique ID (for client-side use)
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Strip HTML tags from string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Get greeting based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
