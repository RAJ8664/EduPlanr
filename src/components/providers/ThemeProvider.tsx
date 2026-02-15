/**
 * Theme Provider
 * Applies persisted UI theme to the document root.
 */

'use client';

import React, { useEffect } from 'react';
import { useUIStore } from '@/store';

interface ThemeProviderProps {
  children: React.ReactNode;
}

function resolveTheme(theme: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme = resolveTheme(theme);

    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = document.documentElement;
      const resolvedTheme = resolveTheme('system');
      root.classList.remove('light', 'dark');
      root.classList.add(resolvedTheme);
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
}
