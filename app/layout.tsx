import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "Side Scout — NBA Stats Tracker & Live Game Monitor",
  description: "Track NBA player and team stats in real time. Analyze performance trends, shooting efficiency, live game scores, and more. Built for serious basketball fans and parlay bettors.",
  keywords: [
    "NBA stats",
    "NBA player stats",
    "NBA live game tracker",
    "basketball stats app",
    "NBA performance trends",
    "NBA parlay tool",
    "NBA team stats",
    "NBA shooting efficiency",
    "Side Scout",
  ],
  authors: [{ name: "Side Scout" }],
  creator: "Side Scout",
  openGraph: {
    title: "Side Scout — NBA Stats Tracker & Live Game Monitor",
    description: "Real-time NBA player and team stats, performance trends, live game tracking, and shooting splits. Make smarter decisions before every game.",
    url: "https://sidescout.app",
    siteName: "Side Scout",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Side Scout — NBA Stats Tracker",
    description: "Real-time NBA player and team stats, performance trends, and live game tracking.",
  },
  robots: {
    index: true,
    follow: true,
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
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-GZ8CG01JK7"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-GZ8CG01JK7');
        `}} />
        {/* Google AdSense */}
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6842407308565661"
             crossOrigin="anonymous"></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} antialiased`}
      >
        {children}
        {/* Shopify Footer Banner */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-700 via-blue-700 to-cyan-700 border-t border-indigo-500/40 shadow-[0_-2px_10px_rgba(0,0,0,0.15)]">
          <a
            href="https://shopify.pxf.io/m4OXk1"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center justify-center w-full py-1 px-4 hover:opacity-90 transition-opacity"
          >
            <img src="/ShopifyAddImg.png" alt="Try Shopify free" className="h-8 md:h-10 w-auto object-contain" />
          </a>
        </div>
      </body>
    </html>
  );
}
