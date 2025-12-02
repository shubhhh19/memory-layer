import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CosmicAnalyticsProvider } from "cosmic-analytics";
import { AuthProvider } from "./components/auth/AuthProvider";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import OfflineIndicator from "./components/OfflineIndicator";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Memory Mesh - Semantic Memory for AI Systems",
  description: "Store, search, and manage conversational memories with vector embeddings, importance scoring, and automated retention policies. Built for developers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--background)] text-[var(--text)]`}
      >
        <style>{`:root{--background:#eef2f7;--surface:#ffffff;--text:#0f172a;--muted-text:#64748b;--border:#e2e8f0;--accent:#0ea5e9;--background-rgb:238 242 247;--surface-rgb:255 255 255;--text-rgb:15 23 42;--accent-rgb:14 165 233}`}</style>
        <div aria-hidden="true" className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(14,165,233,0.08),transparent_60%),radial-gradient(800px_400px_at_110%_110%,rgba(2,6,23,0.08),transparent_55%)]" />
        <main className="h-screen">
          <ErrorBoundary>
            <CosmicAnalyticsProvider>
              <AuthProvider>
                <OfflineIndicator />
                {children}
                <Toaster position="top-right" />
              </AuthProvider>
            </CosmicAnalyticsProvider>
          </ErrorBoundary>
        </main>
      </body>
    </html>
  );
}
