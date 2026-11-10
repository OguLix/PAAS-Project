import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The Docker image runs `node frontend/server.js` from `.next/standalone`.
  output: 'standalone',
  // Trace files from the monorepo root so the standalone output can resolve the
  // hoisted workspace dependencies (shared, react, next) that live in the root
  // `node_modules` folder.
  outputFileTracingRoot: path.join(__dirname, '..'),
  allowedDevOrigins: ['192.168.174.144', 'localhost:3000'],
};

export default nextConfig;
