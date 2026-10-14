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
    images: [
      {
        url: `${appUrl}/og-image.jpg`,
        secureUrl: `${appUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "TemuTasks — Available Balance ₦10,000.00 | Add Funds & Cash Out",
      },
      {
        url: `${appUrl}/og-image.png`,
        secureUrl: `${appUrl}/og-image.png`,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "TemuTasks — Available Balance ₦10,000.00 | Add Funds & Cash Out",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TemuTasks — Available Balance ₦10,000.00 | Complete Tasks & Earn Daily",
    description: "Earn ₦1,000 to ₦5,000 everyday on TemuTasks! Withdraw your balance immediately to your bank or buy instant airtime on all networks.",
    images: [`${appUrl}/og-image.jpg`],
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
        {/* Direct Open Graph Meta Tags for WhatsApp, Telegram & Social Scrapers */}
        <meta property="og:image" content={`${appUrl}/og-image.jpg`} />
        <meta property="og:image:secure_url" content={`${appUrl}/og-image.jpg`} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="TemuTasks — Available Balance ₦10,000.00 | Add Funds & Cash Out" />
        <meta name="twitter:image" content={`${appUrl}/og-image.jpg`} />
      </head>
      <body className={`${inter.variable} antialiased bg-[#F7F7F8] text-[#111827]`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
