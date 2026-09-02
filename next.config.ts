import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://server.arcgisonline.com https://basemap.nationalmap.gov https://tiles.openseamap.org https://cdnjs.cloudflare.com",
              "connect-src 'self' https://*.supabase.co https://api.weather.gov https://api.waterdata.usgs.gov https://marine-api.open-meteo.com https://api.tidesandcurrents.noaa.gov",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  images: { remotePatterns: [] },
};

export default nextConfig;
