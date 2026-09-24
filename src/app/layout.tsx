import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import ServiceWorkerRegistration from "@/components/offline/ServiceWorkerRegistration";
import "./globals.css";

const description =
  "Oklahoma public fishing access, provider-reported environmental conditions, species information, and optional AI trip planning.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.fishfinder-pro.online"),
  verification: { google: "a1XlKud9pKxjKX_l5Qza5Npsxzo9a3li0DucnsXgZ38" },
  title: {
    default: "Oklahoma SeamCast",
    template: "%s | Oklahoma SeamCast",
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Oklahoma SeamCast",
    title: "Oklahoma SeamCast",
    description,
    url: "/",
    images: [{ url: "/icons/icon-512.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oklahoma SeamCast",
    description,
    images: ["/icons/icon-512.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0 }}>
        {/* Registers /sw.js so the offline app shell and web notifications work. */}
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
