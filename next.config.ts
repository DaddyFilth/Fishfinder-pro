import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          // Strict-Transport-Security is intentionally NOT set here. It is emitted by src/proxy.ts,
          // which only sends it over HTTPS; pinning it unconditionally in next.config also applies
          // it to plain-HTTP local development.
        ],
      },
    ];
  },
  images: { remotePatterns: [] },
};

export default nextConfig;