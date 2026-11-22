import type { Metadata } from "next";
import { Caveat, Inter, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Historio",
  description: "See everything you've read on one map and one timeline.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${newsreader.variable} ${inter.variable} ${caveat.variable}`}
    >
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
