import type { Metadata, Viewport } from "next";
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from "react";
import ConnectionStatus from '@/components/offline/ConnectionStatus';
import ServiceWorkerRegistration from '@/components/offline/ServiceWorkerRegistration';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fishfinder-pro.online"),
  verification: { google: 'a1XlKud9pKxjKX_l5Qza5Npsxzo9a3li0DucnsXgZ38' },
  title: {
    default: 'Oklahoma SeamCast',
    template: '%s | Oklahoma SeamCast',
  },
  description: "Oklahoma public fishing access, species, conditions, and AI-powered trip planning.",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Oklahoma SeamCast',
    title: 'Oklahoma SeamCast',
    description: 'Oklahoma public fishing access, species, conditions, and AI-powered trip planning.',
    url: '/',
    images: [{ url: '/icons/icon-512.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oklahoma SeamCast',
    description: 'Oklahoma public fishing access, species, conditions, and AI-powered trip planning.',
    images: ['/icons/icon-512.png'],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1e",
};

const siteUrl = "https://www.fishfinder-pro.online";
const siteStructure = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Oklahoma SeamCast",
    url: siteUrl,
    logo: siteUrl + "/icons/icon-512.png",
    inLanguage: "en-US",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Oklahoma SeamCast",
    url: siteUrl,
    description: "Oklahoma public fishing access, species, conditions, and AI-powered trip planning.",
    publisher: {
      "@type": "Organization",
      name: "Oklahoma SeamCast",
      logo: siteUrl + "/icons/icon-512.png",
    },
    inLanguage: "en-US",
  },
]);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <head>
        <script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: siteStructure }}
        />
      </head>
      <body style={{ height: "100%", margin: 0 }} className="min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        <ConnectionStatus />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
