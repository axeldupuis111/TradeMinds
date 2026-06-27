import type { Lang } from "@/lib/translations";

// Structured legal document model. Long-form legal prose is kept here (not in
// the flat i18n dicts) so it can carry headings / lists / inline links and stay
// readable. Content is provided per locale, with French as the binding
// reference and required fallback.

export interface LegalLink {
  /** Token to find in the paragraph text, e.g. "{privacy}". */
  token: string;
  label: string;
  href: string;
}

export type LegalBlock =
  | { kind: "p"; text: string; links?: LegalLink[] }
  | { kind: "ul"; items: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** e.g. "Dernière mise à jour : 27 juin 2026". */
  updated: string;
  intro?: string;
  sections: LegalSection[];
  /** Shown in italics at the bottom, e.g. the "French version prevails" note. */
  footerNote?: string;
}

/** Per-locale content. French is mandatory and used as the fallback. */
export type LegalContent = Partial<Record<Lang, LegalDoc>> & { fr: LegalDoc };
