import { LanguageProvider } from "@/lib/LanguageContext";
import { PlanProvider } from "@/lib/PlanContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  title: "TradeDiscipline",
  description: "Journal de trading intelligent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <LanguageProvider>
            <PlanProvider>{children}</PlanProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
