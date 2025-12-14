import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { MobileWarning } from "@/components/mobile-warning";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IdeaFlow | Conversational workflow maps",
  description:
    "Turn plain ideas into structured, connected workflows with AI assistance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <ConvexClientProvider>
          <ThemeProvider>
            <MobileWarning />
            {children}
          </ThemeProvider>
          <Toaster theme="dark" position="top-center" />
        </ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
