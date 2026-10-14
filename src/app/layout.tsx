import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temutasks.top';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "TemuTasks — Get Temu Invites & Earn Daily Rewards",
  description: "Complete simple Temu tasks, accept invite links, and earn ₦1,000 to ₦5,000 everyday with instant airtime and bank cashout.",
  openGraph: {
    title: "TemuTasks — Available Balance ₦10,000.00 | Complete Tasks & Earn Daily",
    description: "Earn ₦1,000 to ₦5,000 everyday on TemuTasks! Withdraw your balance immediately to your bank or buy instant airtime on all networks.",
    url: appUrl,
    siteName: "TemuTasks",
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TemuTasks — Available Balance ₦10,000.00 | Complete Tasks & Earn Daily",
    description: "Earn ₦1,000 to ₦5,000 everyday on TemuTasks! Withdraw your balance immediately to your bank or buy instant airtime on all networks.",
  },
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Direct static stylesheet link guarantees 100% full styled UI */}
        <link rel="stylesheet" href="/tailwind.css" />
      </head>
      <body className={`${inter.variable} antialiased bg-[#F7F7F8] text-[#111827]`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
