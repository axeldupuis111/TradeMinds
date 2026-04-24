import { LanguageProvider } from "@/lib/LanguageContext";
import { PlanProvider } from "@/lib/PlanContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  style: ["italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "TradeMinds",
  description: "Journal de trading intelligent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <LanguageProvider>
            <PlanProvider>{children}</PlanProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
