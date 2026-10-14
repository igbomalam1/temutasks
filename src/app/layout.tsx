import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "TemuTasks — Get Temu Invites & Earn Rewards",
  description: "Get real participants for your Temu invitation links, earn daily task rewards, and receive lifetime referral commissions.",
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
