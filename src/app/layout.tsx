import type { Metadata } from "next";
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://fishfinder-pro.online"),
  title: "Fishfinder Pro",
  description: "Fishing conditions, forecasts, and AI-powered trip planning.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body style={{height:"100%",margin:0}} className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
