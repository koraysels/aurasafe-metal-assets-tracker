import type { NextConfig } from 'next';
import { withSerwist } from 'serwist/next';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
};

export default withSerwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
})(nextConfig);
