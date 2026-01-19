import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  serverExternalPackages: ['esbuild-wasm'],
};

export default nextConfig;
