import { LanguageProvider } from "@/lib/LanguageContext";
import { PlanProvider } from "@/lib/PlanContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { loadDict } from "@/lib/translations";
import type { Lang } from "@/lib/translations";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://tradediscipline.app"),
  title: "TradeDiscipline",
  description: "Journal de trading intelligent",
  // Google Search Console ownership verification. Set
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION on Vercel to the token Search Console
  // gives you (meta-tag method); omitted when unset.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
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
    <html lang={ssrLang} suppressHydrationWarning>
      <head>
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <LanguageProvider ssrLang={ssrLang} ssrDict={ssrDict}>
            <PlanProvider>{children}</PlanProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
