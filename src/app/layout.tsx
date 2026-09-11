import type { Metadata, Viewport } from "next";
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from "react";
import ConnectionStatus from '@/components/offline/ConnectionStatus';
import ServiceWorkerRegistration from '@/components/offline/ServiceWorkerRegistration';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fishfinder-pro.online"),
  title: "Oklahoma Fishfinder Pro",
  description: "Oklahoma public fishing access, species, conditions, and AI-powered trip planning.",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body style={{ height: "100%", margin: 0 }} className="min-h-full flex flex-col">
        <ServiceWorkerRegistration />
        <ConnectionStatus />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
