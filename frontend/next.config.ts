import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Production builds emit a self-contained server bundle. This matters because
  // Server 1 is a small host shared with the existing Apache portfolio.
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
