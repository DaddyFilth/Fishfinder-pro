import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import ServiceWorkerRegistration from "@/components/offline/ServiceWorkerRegistration";
import "./globals.css";

const siteUrl = "https://www.fishfinder-pro.online";
const description =
  "Find Oklahoma public fishing spots, compare provider-reported conditions, check species information, and plan your next fishing trip.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Oklahoma SeamCast",
  category: "sports",
  keywords: [
    "Oklahoma fishing",
    "Oklahoma fishing spots",
    "public fishing access",
    "fishing conditions",
    "fishing forecast",
    "fish logbook",
  ],
  authors: [{ name: "Oklahoma SeamCast" }],
  creator: "Oklahoma SeamCast",
  publisher: "Oklahoma SeamCast",
  verification: { google: "a1XlKud9pKxjKX_l5Qza5Npsxzo9a3li0DucnsXgZ38" },
  title: {
    default: "Oklahoma SeamCast",
    template: "%s | Oklahoma SeamCast",
  },
  description,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    locale: "en_US",
    type: "website",
    siteName: "Oklahoma SeamCast",
    title: "Oklahoma SeamCast",
    description,
    url: "/",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Oklahoma SeamCast" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oklahoma SeamCast",
    description,
    images: ["/icons/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Oklahoma SeamCast',
    url: siteUrl,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Any',
    description,
  };
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0 }}>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        />
        {/* Registers /sw.js so the offline app shell and web notifications work. */}
        <ServiceWorkerRegistration />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
