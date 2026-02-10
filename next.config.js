/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Ignore ESLint warnings during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    unoptimized: true,
    domains: ['lh3.googleusercontent.com', 'firebasestorage.googleapis.com'],
  },

  // Environment variables exposed to browser
  env: {
    APP_NAME: 'EduPlanr',
    APP_VERSION: '1.0.0',
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  // Conditional static export for mobile builds
  output: process.env.NEXT_PUBLIC_EXPORT === 'true' ? 'export' : undefined,
};

module.exports = nextConfig;
