import type { Metadata } from "next";
import { locales, type Locale, ogLocaleMap } from "@/i18n/config";

/**
 * Métadonnées SEO de la landing — source de vérité unique.
 *
 * La landing anglaise est servie à la racine par app/page.tsx (hors segment
 * [locale]) : avant cette factorisation, son bloc title/description/hreflang/
 * OpenGraph était recopié à la main depuis app/[locale]/layout.tsx et les deux
 * copies divergeaient silencieusement. Les deux endroits appellent désormais
 * landingMetadata(locale).
 */

export const SITE_URL = "https://tradediscipline.app";

// Titres : marque + mot-clé métier (« journal de trading », "AI trading
// journal") — c'est ce que Google matche sur les requêtes catégorie, et ça
// ancre l'entité TradeDiscipline (sans quoi Google corrige la recherche
// « tradediscipline » en « trade discipline »). L'accroche transformation
// reste dans la description et le hero de la landing.
const LANDING_META: Record<Locale, { title: string; description: string }> = {
  en: {
    title: "TradeDiscipline: AI trading journal & discipline coach",
    description:
      "Stop repeating the same mistakes. The AI that turns your trading journal into a personal coach: it detects your destructive patterns, measures your discipline and tells you exactly what is costing you money.",
  },
  fr: {
    title: "TradeDiscipline : journal de trading IA et coach discipline",
    description:
      "Arrête de répéter les mêmes erreurs. L'IA qui transforme ton journal de trading en coach personnel : elle détecte tes patterns destructeurs, mesure ta discipline et te dit exactement ce qui te coûte de l'argent.",
  },
  de: {
    title: "TradeDiscipline: KI-Trading-Tagebuch & Disziplin-Coach",
    description:
      "Hör auf, dieselben Fehler zu wiederholen. Die KI, die dein Trading-Journal in einen persönlichen Coach verwandelt: Sie erkennt deine destruktiven Muster, misst deine Disziplin und sagt dir genau, was dich Geld kostet.",
  },
  es: {
    title: "TradeDiscipline: diario de trading con IA y coach de disciplina",
    description:
      "Deja de repetir los mismos errores. La IA que convierte tu diario de trading en un coach personal: detecta tus patrones destructivos, mide tu disciplina y te dice exactamente qué te está costando dinero.",
  },
};

/** hreflang partagé : la version EN vit à la racine, les autres sous /{locale}. */
const LANGUAGE_ALTERNATES = {
  en: `${SITE_URL}/`,
  fr: `${SITE_URL}/fr`,
  de: `${SITE_URL}/de`,
  es: `${SITE_URL}/es`,
  "x-default": `${SITE_URL}/`,
};

export function landingMetadata(locale: Locale): Metadata {
  if (!(locales as readonly string[]).includes(locale)) return {};
  const meta = LANDING_META[locale];
  const path = locale === "en" ? "" : `/${locale}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${SITE_URL}${path || "/"}`,
      languages: LANGUAGE_ALTERNATES,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${SITE_URL}${path || "/"}`,
      siteName: "TradeDiscipline",
      locale: ogLocaleMap[locale],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

/**
 * MÉTADONNÉES D'UNE PAGE AUTRE QUE LA LANDING.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ /fr/faq ET /fr/contact SE DÉCLARAIENT COMME ÉTANT LA PAGE D'ACCUEIL.
 * Les métadonnées de la landing étaient posées sur le LAYOUT du segment
 * `[locale]`, donc héritées par tout ce qui vit dessous : la FAQ et le contact
 * en français, en allemand et en espagnol annonçaient le titre de la landing
 * ET, plus grave, `canonical = https://tradediscipline.app/fr`. Une page qui
 * déclare une autre URL comme canonique demande à Google de ne pas l'indexer.
 * La FAQ, dont c'est pourtant le seul métier, était invisible par
 * construction, dans trois langues sur quatre.
 *
 * ⚠️ LA RÈGLE QUI EN SORT : des métadonnées de PAGE ne se posent jamais sur un
 * layout partagé. La landing les porte désormais elle-même.
 */
export type TextesDePage = { title: string; description: string };

/**
 * ⚠️ LE CHEMIN EST DONNÉ SANS PRÉFIXE DE LANGUE (« /faq ») : c'est lui qui sert
 * à la fois de canonique et de table des versions, et le laisser se construire
 * chez l'appelant serait quatre occasions de se tromper par page.
 */
export function pageMetadata({
  chemin,
  locale,
  textes,
  indexer = true,
}: {
  chemin: string;
  locale: Locale;
  textes: Record<Locale, TextesDePage>;
  indexer?: boolean;
}): Metadata {
  const meta = textes[locale] ?? textes.en;
  const url = `${SITE_URL}${locale === "en" ? "" : `/${locale}`}${chemin}`;
  const versions: Record<string, string> = { "x-default": `${SITE_URL}${chemin}` };
  for (const l of locales) versions[l] = `${SITE_URL}${l === "en" ? "" : `/${l}`}${chemin}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    alternates: { canonical: url, languages: versions },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      siteName: "TradeDiscipline",
      locale: ogLocaleMap[locale],
      type: "website",
    },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description },
    robots: {
      index: indexer,
      follow: true,
      googleBot: { index: indexer, follow: true },
    },
  };
}

/**
 * Métadonnées d'une page qui n'existe qu'à UNE adresse, quelle que soit la
 * langue lue.
 *
 * ⚠️ LES PAGES LÉGALES SONT DANS CE CAS : leur contenu se traduit côté client,
 * mais `/fr/legal/terms` redirige en 301 vers `/legal/terms`. Leur annoncer
 * quatre versions serait annoncer trois URL qui n'existent pas.
 */
export function pageMonoAdresse(chemin: string, textes: TextesDePage, indexer = true): Metadata {
  const url = `${SITE_URL}${chemin}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: textes.title,
    description: textes.description,
    alternates: { canonical: url },
    openGraph: {
      title: textes.title,
      description: textes.description,
      url,
      siteName: "TradeDiscipline",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: textes.title, description: textes.description },
    robots: { index: indexer, follow: true, googleBot: { index: indexer, follow: true } },
  };
}

export const FAQ_META: Record<Locale, TextesDePage> = {
  en: {
    title: "FAQ: trading journal, AI coach and plans - TradeDiscipline",
    description:
      "What TradeDiscipline does, which brokers it syncs with, what the AI coach reads, what is free and what is not. The answers to the questions asked before signing up.",
  },
  fr: {
    title: "FAQ : journal de trading, coach IA et formules - TradeDiscipline",
    description:
      "Ce que fait TradeDiscipline, avec quels brokers il se synchronise, ce que lit le coach IA, ce qui est gratuit et ce qui ne l'est pas. Les réponses aux questions qu'on se pose avant de s'inscrire.",
  },
  de: {
    title: "FAQ: Trading-Tagebuch, KI-Coach und Tarife - TradeDiscipline",
    description:
      "Was TradeDiscipline macht, mit welchen Brokern es sich synchronisiert, was der KI-Coach liest, was kostenlos ist und was nicht. Die Antworten auf die Fragen vor der Anmeldung.",
  },
  es: {
    title: "FAQ: diario de trading, coach con IA y planes - TradeDiscipline",
    description:
      "Qué hace TradeDiscipline, con qué brokers se sincroniza, qué lee el coach con IA, qué es gratis y qué no. Las respuestas a las preguntas que surgen antes de registrarse.",
  },
};

export const CONTACT_META: Record<Locale, TextesDePage> = {
  en: {
    title: "Contact - TradeDiscipline",
    description:
      "A question, a bug, a suggestion: write to us. Every message reaches the person who builds TradeDiscipline.",
  },
  fr: {
    title: "Contact - TradeDiscipline",
    description:
      "Une question, un bug, une suggestion : écris-nous. Chaque message arrive chez la personne qui construit TradeDiscipline.",
  },
  de: {
    title: "Kontakt - TradeDiscipline",
    description:
      "Eine Frage, ein Bug, ein Vorschlag: schreib uns. Jede Nachricht erreicht die Person, die TradeDiscipline baut.",
  },
  es: {
    title: "Contacto - TradeDiscipline",
    description:
      "Una pregunta, un bug, una sugerencia: escríbenos. Cada mensaje llega a la persona que construye TradeDiscipline.",
  },
};

/**
 * ⚠️ LA CONNEXION NE S'INDEXE PAS : elle n'apporte rien à une recherche et ne
 * ferait que doubler la landing. Elle garde en revanche un titre, parce qu'un
 * onglet et un historique, eux, se lisent.
 */
export const LOGIN_META: Record<Locale, TextesDePage> = {
  en: {
    title: "Sign in - TradeDiscipline",
    description: "Sign in to your TradeDiscipline trading journal.",
  },
  fr: {
    title: "Connexion - TradeDiscipline",
    description: "Connecte-toi à ton journal de trading TradeDiscipline.",
  },
  de: {
    title: "Anmelden - TradeDiscipline",
    description: "Melde dich bei deinem TradeDiscipline-Trading-Tagebuch an.",
  },
  es: {
    title: "Iniciar sesión - TradeDiscipline",
    description: "Inicia sesión en tu diario de trading TradeDiscipline.",
  },
};

export const MOT_DE_PASSE_META: Record<Locale, TextesDePage> = {
  en: {
    title: "Reset your password - TradeDiscipline",
    description: "Choose a new password for your TradeDiscipline account.",
  },
  fr: {
    title: "Nouveau mot de passe - TradeDiscipline",
    description: "Choisis un nouveau mot de passe pour ton compte TradeDiscipline.",
  },
  de: {
    title: "Neues Passwort - TradeDiscipline",
    description: "Wähle ein neues Passwort für dein TradeDiscipline-Konto.",
  },
  es: {
    title: "Nueva contraseña - TradeDiscipline",
    description: "Elige una nueva contraseña para tu cuenta de TradeDiscipline.",
  },
};

/**
 * ⚠️ LES QUATRE PAGES LÉGALES N'EXISTENT QU'À UNE ADRESSE : leur contenu se
 * traduit côté client, et `/fr/legal/terms` redirige en 301 vers
 * `/legal/terms`. Leur titre suit donc la langue du visiteur, pas l'URL.
 */
export const LEGAL_META: Record<string, Record<Locale, TextesDePage>> = {
  terms: {
    en: { title: "Terms of use - TradeDiscipline", description: "The terms of use of TradeDiscipline: what the service does, what it does not do, and what each party commits to." },
    fr: { title: "Conditions générales d'utilisation - TradeDiscipline", description: "Les conditions d'utilisation de TradeDiscipline : ce que le service fait, ce qu'il ne fait pas, et ce que chacun s'engage à respecter." },
    de: { title: "Nutzungsbedingungen - TradeDiscipline", description: "Die Nutzungsbedingungen von TradeDiscipline: was der Dienst tut, was er nicht tut und wozu sich beide Seiten verpflichten." },
    es: { title: "Condiciones de uso - TradeDiscipline", description: "Las condiciones de uso de TradeDiscipline: qué hace el servicio, qué no hace y a qué se compromete cada parte." },
  },
  privacy: {
    en: { title: "Privacy policy - TradeDiscipline", description: "Which data TradeDiscipline collects, why, how long it is kept, and how to have it deleted." },
    fr: { title: "Politique de confidentialité - TradeDiscipline", description: "Quelles données TradeDiscipline collecte, pourquoi, combien de temps elles sont conservées, et comment les faire supprimer." },
    de: { title: "Datenschutzerklärung - TradeDiscipline", description: "Welche Daten TradeDiscipline erhebt, warum, wie lange sie gespeichert werden und wie man sie löschen lässt." },
    es: { title: "Política de privacidad - TradeDiscipline", description: "Qué datos recoge TradeDiscipline, por qué, cuánto tiempo se conservan y cómo hacer que se eliminen." },
  },
  cgv: {
    en: { title: "Terms of sale - TradeDiscipline", description: "Prices, billing, renewal, right of withdrawal and cancellation of a TradeDiscipline subscription." },
    fr: { title: "Conditions générales de vente - TradeDiscipline", description: "Tarifs, facturation, reconduction, droit de rétractation et résiliation d'un abonnement TradeDiscipline." },
    de: { title: "Verkaufsbedingungen - TradeDiscipline", description: "Preise, Abrechnung, Verlängerung, Widerrufsrecht und Kündigung eines TradeDiscipline-Abonnements." },
    es: { title: "Condiciones de venta - TradeDiscipline", description: "Precios, facturación, renovación, derecho de desistimiento y cancelación de una suscripción a TradeDiscipline." },
  },
  mentions: {
    en: { title: "Legal notice - TradeDiscipline", description: "Publisher, host and contact details of the TradeDiscipline site." },
    fr: { title: "Mentions légales - TradeDiscipline", description: "Éditeur, hébergeur et coordonnées du site TradeDiscipline." },
    de: { title: "Impressum - TradeDiscipline", description: "Herausgeber, Hoster und Kontaktdaten der Website TradeDiscipline." },
    es: { title: "Aviso legal - TradeDiscipline", description: "Editor, alojamiento y datos de contacto del sitio TradeDiscipline." },
  },
};

/**
 * L'ADRESSE D'UN LIEN DESTINÉ À ÊTRE PARTAGÉ.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR « PARAMÈTRES », LE « LIEN PUBLIC » PROPOSÉ À LA COPIE ÉTAIT :
 * `https://tradediscipline-git-feat-backtes-…vercel.app/profile/besttrader`.
 * Il était construit sur `window.location.origin`, c'est-à-dire sur l'adresse
 * où l'on se trouve. Copié depuis une préversion, il mène à un domaine protégé
 * que personne d'autre ne peut ouvrir : le lien qu'on partage ne doit pas
 * dépendre de la porte par laquelle on est entré.
 *
 * ⚠️ LA RÈGLE ÉTAIT DÉJÀ ÀMOITIÉ ÉCRITE : les deux pages partenaires
 * retombaient sur `https://tradediscipline.app` côté serveur, ce qui dit bien
 * quelle adresse fait foi, mais gardaient l'origine courante côté navigateur,
 * c'est-à-dire exactement là où le lien est copié.
 *
 * ⚠️ À NE PAS CONFONDRE AVEC UNE REDIRECTION D'AUTHENTIFICATION : celle-là doit
 * ramener là où l'on est, et garde donc `window.location.origin`.
 */
export function lienPartageable(chemin: string): string {
  return `${SITE_URL}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}
