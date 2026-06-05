import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import TopLoader from "@/components/TopLoader";
import { Suspense } from "react";
import Script from "next/script";
import Link from "next/link";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MyPahad – Local Businesses in Pahadi Towns",
  description: "Apne Pahad ka Bazaar - Find local shops, products, and services in your town.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full antialiased`}
    >
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QC4K73RYBE"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QC4K73RYBE');
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <div className="flex-grow">
          {children}
        </div>
        {/* Global Professional Footer */}
        <footer className="bg-gray-900 text-gray-400 text-xs py-8 px-6 border-t border-gray-800 font-sans mt-auto">
          <div className="max-w-[600px] mx-auto flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <svg viewBox="0 0 690 690" className="w-5 h-5 text-white shrink-0" role="img" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="170,480 310,200 450,480" fill="currentColor" opacity="0.18" />
                  <polygon points="310,480 460,240 610,480" fill="currentColor" opacity="0.30" />
                  <polygon points="210,480 370,170 530,480" fill="currentColor" opacity="0.80" />
                </svg>
                <span>MyPahad</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-normal">
                Apne Pahad ka Bazaar. Connect directly with local businesses, sellers, services, and craftsmen across Pahad. Supporting local livelihoods through technology.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
              <div className="flex flex-col gap-2">
                <span className="text-white font-semibold text-[11px] uppercase tracking-wider text-gray-300">Quick Links</span>
                <Link href="/" className="hover:text-white transition-colors">Home Market</Link>
                <Link href="/search" className="hover:text-white transition-colors">Search Bazaar</Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-white font-semibold text-[11px] uppercase tracking-wider text-gray-300">Support</span>
                <a href="https://support.mypahad.in" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Support Portal</a>
                <a href="mailto:contact@mypahad.in" className="hover:text-white transition-colors">contact@mypahad.in</a>
                <a href="https://partner.mypahad.in" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Partner Dashboard</a>
              </div>
            </div>
            
            <div className="text-center text-[10px] text-gray-600 pt-6 border-t border-gray-800 mt-2">
              © {new Date().getFullYear()} MyPahad.in. All rights reserved. Built for Pahadi Empowerment.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

