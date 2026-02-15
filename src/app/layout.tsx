/**
 * Root Layout
 * Next.js App Router root layout with global providers
 */

import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import '@/styles/globals.css';
import { ThemeProvider } from '@/components/providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://eduplanr.app'),
  title: {
    default: 'EduPlanr - Smart Study Planner',
    template: '%s | EduPlanr',
  },
  description: 'Your intelligent companion for academic success. Plan, study, and achieve your goals with AI-powered assistance.',
  keywords: ['study planner', 'education', 'learning', 'productivity', 'student', 'academic'],
  authors: [{ name: 'EduPlanr Team' }],
  creator: 'EduPlanr',
  publisher: 'EduPlanr',
  robots: 'index, follow',
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://eduplanr.app',
    siteName: 'EduPlanr',
    title: 'EduPlanr - Smart Study Planner',
    description: 'Your intelligent companion for academic success.',
    images: [
      {
        url: '/favicon.svg',
        width: 1200,
        height: 630,
        alt: 'EduPlanr Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EduPlanr - Smart Study Planner',
    description: 'Your intelligent companion for academic success.',
    images: ['/favicon.svg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#030712',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>

        {/* Toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a2332',
              color: '#f3f4f6',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '12px',
            },
            success: {
              iconTheme: {
                primary: '#00ff88',
                secondary: '#1a2332',
              },
            },
            error: {
              iconTheme: {
                primary: '#ff0080',
                secondary: '#1a2332',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
