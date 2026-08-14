import { LanguageProvider } from "@/lib/LanguageContext";
import { PlanProvider } from "@/lib/PlanContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import AttributionCapture from "@/components/AttributionCapture";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { loadDict } from "@/lib/translations";
import type { Lang } from "@/lib/translations";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";

const LANGS: Lang[] = ["fr", "en", "de", "es"];

/** Resolve the visitor's language server-side from the NEXT_LOCALE cookie so
 *  the first paint is already in the right language (no English-first flash on
 *  cookie-based routes such as the dashboard). Defaults to English. */
function resolveServerLang(): Lang {
  const cookieLang = cookies().get("NEXT_LOCALE")?.value;
  return cookieLang && (LANGS as string[]).includes(cookieLang) ? (cookieLang as Lang) : "en";
}

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
// Display serif for landing-page h1/h2 (see .landing-page rules in globals.css).
// Self-hosted at build time by next/font — no runtime Google Fonts request.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tradediscipline.app"),
  title: "TradeDiscipline",
  description: "Journal de trading intelligent",
  // Search-engine ownership verification (meta-tag method). Set the matching
  // env var on Vercel to the token each console gives you; omitted when unset.
  // Google = NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, Bing = NEXT_PUBLIC_BING_SITE_VERIFICATION.
  ...((process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION)
    ? {
        verification: {
          ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
            ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
            : {}),
          ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
            ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
            : {}),
        },
      }
    : {}),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ssrLang = resolveServerLang();
  const ssrDict = await loadDict(ssrLang);
  return (
    <html
      lang={ssrLang}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <head>
        {/* Impact.com site-ownership proof. Written by hand rather than through the
            metadata API: their tag carries the token in `value`, and Metadata.other
            always renders it as `content`. */}
        <meta
          name="impact-site-verification"
          {...({ value: "7e6f0b8c-3035-448d-a9c5-1a607c94b38a" } as { content?: string })}
        />
        {/* Prevent flash of wrong theme — must run before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tm-theme');if(t==='light'){document.documentElement.classList.add('light');}else{document.documentElement.classList.remove('light');}}catch(e){}`,
          }}
        />
        {/* Set html lang attribute from stored preference or browser language */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=['fr','en','de','es'];var l=localStorage.getItem('TradeDiscipline_lang');if(!l){var n=(navigator.languages||[navigator.language]);for(var i=0;i<n.length;i++){var p=n[i].split('-')[0].toLowerCase();if(s.indexOf(p)!==-1){l=p;break;}}if(!l)l='en';}if(s.indexOf(l)!==-1)document.documentElement.lang=l;}catch(e){}`,
          }}
        />
      </head>
      <body
        className="font-sans antialiased"
      >
        <ThemeProvider>
          <LanguageProvider ssrLang={ssrLang} ssrDict={ssrDict}>
            <PlanProvider>{children}</PlanProvider>
          </LanguageProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
        <AttributionCapture />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
