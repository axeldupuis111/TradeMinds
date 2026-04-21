"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { LANGUAGES, type Lang } from "@/lib/translations";
import { useEffect, useRef, useState } from "react";

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-muted hover:text-foreground rounded-lg hover:bg-white/5 transition-colors"
      >
        <span>{current.flag}</span>
        <span className="text-xs font-medium">{current.label}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50 min-w-[120px]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code as Lang);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                lang === l.code ? "text-accent" : "text-foreground"
              }`}
            >
              <span>{l.flag}</span>
              <span className="font-medium">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
