import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ServiceWorkerRegister } from "@/components/ui/sw-register";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
import { SWUpdateToast } from "@/components/ui/sw-update-toast";

const geistSans = Geist( {
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
} );

const geistMono = Geist_Mono( {
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
} );

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6366f1",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "FinanceOS",
  description: "AI-powered personal finance management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "FinanceOS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout ( {
  children,
}: Readonly<{
  children: React.ReactNode;
}> ) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head />
      <body className={`${ geistSans.variable } ${ geistMono.variable } h-full antialiased`}>
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
        <SWUpdateToast />
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
