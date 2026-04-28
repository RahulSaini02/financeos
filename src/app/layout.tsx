import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ServiceWorkerRegister } from "@/components/ui/sw-register";

const geistSans = Geist( {
  variable: "--font-geist-sans",
  subsets: ["latin"],
} );

const geistMono = Geist_Mono( {
  variable: "--font-geist-mono",
  subsets: ["latin"],
} );

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
      { url: "/app-icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
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
      <body className={`${ geistSans.variable } ${ geistMono.variable } h-full antialiased`}>
        <ServiceWorkerRegister />
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
