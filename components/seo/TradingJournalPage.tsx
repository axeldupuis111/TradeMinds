import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import { type Locale, ogLocaleMap, defaultLocale, locales } from "@/i18n/config";
import { SITE_URL } from "@/lib/seo";
import RiskDisclosure from "@/components/legal/RiskDisclosure";
import { Check, X, ArrowRight, Zap, Brain, Target, ShieldCheck } from "lucide-react";

/**
 * Page mots-clés « journal de trading » / "trading journal" — le format qui
 * ranke sur la requête catégorie (les concurrents positionnés ont tous une
 * page dédiée avec le mot-clé en title + H1, pas seulement des articles).
 * Servie sur /trading-journal (EN, canonique x-default) et
 * /{fr|de|es}/trading-journal, contenu 100 % rendu serveur dans la langue de
 * l'URL. La landing principale reste la page de conversion : celle-ci est la
 * porte d'entrée SEO, elle pousse vers /login et vers le blog.
 */

interface FaqItem {
  q: string;
  a: string;
}

interface PageContent {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  ctaPrimary: string;
  ctaNote: string;
  compareTitle: string;
  compareIntro: string;
  compareCols: [string, string];
  compareRows: { label: string; manual: string; td: string }[];
  syncTitle: string;
  syncIntro: string;
  platforms: string[];
  aiTitle: string;
  aiIntro: string;
  aiItems: { title: string; desc: string }[];
  articlesTitle: string;
  articles: { slug: string; label: string }[];
  faqTitle: string;
  faq: FaqItem[];
  finalTitle: string;
  finalCta: string;
}

const CONTENT: Record<Locale, PageContent> = {
  fr: {
    metaTitle: "Journal de trading avec IA, gratuit pour commencer - TradeDiscipline",
    metaDescription:
      "Journal de trading en ligne : synchro automatique MT4, MT5, cTrader, NinjaTrader et TradingView, score de discipline, et une IA qui détecte revenge trading, FOMO et overtrading. Gratuit pour commencer, sans carte bancaire.",
    h1: "Le journal de trading qui te dit pourquoi tu perds",
    intro:
      "Un journal de trading ne sert à rien s'il se contente d'empiler tes trades. TradeDiscipline enregistre tes positions automatiquement, note ta discipline à chaque session, et son IA met le doigt sur les patterns qui te coûtent de l'argent : revenge trading, FOMO, overtrading, stops déplacés.",
    ctaPrimary: "Créer mon journal gratuit",
    ctaNote: "Sans carte bancaire. Journal complet et screenshots inclus dans le plan gratuit.",
    compareTitle: "Excel ou Notion ne suffisent pas",
    compareIntro:
      "Un tableur trace ce que tu as fait. Il ne te dira jamais ce que tu aurais dû éviter. La différence se joue sur trois points : la saisie, l'analyse, et ce que tu en fais.",
    compareCols: ["Excel / Notion", "TradeDiscipline"],
    compareRows: [
      { label: "Saisie des trades", manual: "Manuelle, abandonnée au bout de 3 semaines", td: "Automatique depuis ta plateforme" },
      { label: "Stats (win rate, R:R, drawdown)", manual: "Formules à construire et maintenir", td: "Calculées en temps réel" },
      { label: "Patterns émotionnels", manual: "Invisibles dans un tableur", td: "Détectés par l'IA (revenge, FOMO, overtrading)" },
      { label: "Discipline", manual: "Aucun suivi", td: "Score de discipline par session" },
      { label: "Après l'analyse", manual: "Rien ne change", td: "Coach IA, objectifs et défis concrets" },
    ],
    syncTitle: "Tes trades s'enregistrent tout seuls",
    syncIntro:
      "Le meilleur journal est celui que tu n'as pas à remplir. Installe le connecteur de ta plateforme une fois, et chaque trade clôturé arrive dans ton journal en quelques secondes.",
    platforms: ["MetaTrader 4", "MetaTrader 5", "cTrader", "NinjaTrader", "TradingView", "Tradovate", "Exness"],
    aiTitle: "Ce que l'IA voit dans ton journal",
    aiIntro:
      "Les chiffres disent ce qui s'est passé. L'IA de TradeDiscipline explique pourquoi, et te dit quoi changer en premier.",
    aiItems: [
      { title: "Patterns destructeurs", desc: "Revenge trading après une perte, entrées FOMO, overtrading en fin de session : détectés et chiffrés en euros perdus." },
      { title: "Score de discipline", desc: "Chaque session est notée sur le comportement, pas sur le résultat : respect du plan, du risque, de ta checklist." },
      { title: "Analyse visuelle", desc: "Attache un screenshot à ton trade et l'IA relit ton graphique comme un mentor : timing d'entrée, placement du stop, logique de sortie." },
      { title: "Coach qui agit", desc: "Le coach IA ne fait pas que discuter : il crée tes objectifs, annote tes trades et suit tes défis de discipline." },
    ],
    articlesTitle: "Pour aller plus loin",
    articles: [
      { slug: "journal-de-trading-gratuit", label: "Journal de trading gratuit : ce qu'il doit contenir" },
      { slug: "journal-de-trading-mt5-automatique", label: "Journal automatique pour MT4/MT5" },
      { slug: "journal-tradingview-automatique", label: "Synchroniser TradingView avec ton journal" },
      { slug: "trading-journal-mistakes", label: "5 erreurs qui rendent un journal inutile" },
    ],
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "C'est quoi un journal de trading ?",
        a: "Un journal de trading est le registre de tous tes trades : instrument, entrée, sortie, taille, résultat, et surtout le contexte de ta décision (setup, émotion, respect du plan). C'est l'outil n°1 pour progresser, parce qu'il transforme ton historique en données exploitables : sans journal, tu répètes les mêmes erreurs sans les voir.",
      },
      {
        q: "Quelle différence avec un journal Excel ou Notion ?",
        a: "Un tableur exige une saisie manuelle que presque tout le monde abandonne, et il ne détecte rien : ni tes patterns émotionnels, ni tes écarts de discipline. TradeDiscipline synchronise tes trades automatiquement, calcule tes stats en temps réel et son IA identifie les comportements qui te coûtent de l'argent.",
      },
      {
        q: "Quelles plateformes sont compatibles ?",
        a: "MetaTrader 4, MetaTrader 5, cTrader, NinjaTrader, TradingView (par webhook), Tradovate et Exness. L'installation prend quelques minutes : un fichier à ajouter à ta plateforme, et tes trades clôturés arrivent seuls dans le journal.",
      },
      {
        q: "Le journal de trading est-il gratuit ?",
        a: "Oui. Le plan gratuit inclut le journal complet, la synchronisation automatique, les screenshots et une analyse IA de découverte, sans carte bancaire. Les analyses IA illimitées, le coach et les objectifs avancés sont dans les plans payants.",
      },
      {
        q: "Comment l'IA m'aide à être plus discipliné ?",
        a: "Elle croise tes trades avec ton plan de trading : elle repère le revenge trading, le FOMO et l'overtrading, chiffre ce que chaque pattern te coûte, note ta discipline session par session, et le coach transforme ce diagnostic en objectifs concrets à suivre.",
      },
    ],
    finalTitle: "Ton prochain trade mérite un vrai journal",
    finalCta: "Commencer gratuitement",
  },
  en: {
    metaTitle: "AI trading journal, free to start - TradeDiscipline",
    metaDescription:
      "Online trading journal: automatic sync from MT4, MT5, cTrader, NinjaTrader and TradingView, a discipline score, and an AI that detects revenge trading, FOMO and overtrading. Free to start, no credit card.",
    h1: "The trading journal that tells you why you lose",
    intro:
      "A trading journal is useless if it just stacks up your trades. TradeDiscipline records your positions automatically, scores your discipline every session, and its AI pinpoints the patterns that cost you money: revenge trading, FOMO, overtrading, moved stops.",
    ctaPrimary: "Create my free journal",
    ctaNote: "No credit card. Full journal and screenshots included in the free plan.",
    compareTitle: "Excel or Notion is not enough",
    compareIntro:
      "A spreadsheet records what you did. It will never tell you what you should have avoided. The difference comes down to three things: logging, analysis, and what you do next.",
    compareCols: ["Excel / Notion", "TradeDiscipline"],
    compareRows: [
      { label: "Trade logging", manual: "Manual, abandoned after 3 weeks", td: "Automatic from your platform" },
      { label: "Stats (win rate, R:R, drawdown)", manual: "Formulas to build and maintain", td: "Computed in real time" },
      { label: "Emotional patterns", manual: "Invisible in a spreadsheet", td: "Detected by AI (revenge, FOMO, overtrading)" },
      { label: "Discipline", manual: "No tracking", td: "Discipline score per session" },
      { label: "After the analysis", manual: "Nothing changes", td: "AI coach, goals and concrete challenges" },
    ],
    syncTitle: "Your trades log themselves",
    syncIntro:
      "The best journal is the one you never have to fill in. Install your platform's connector once, and every closed trade lands in your journal within seconds.",
    platforms: ["MetaTrader 4", "MetaTrader 5", "cTrader", "NinjaTrader", "TradingView", "Tradovate", "Exness"],
    aiTitle: "What the AI sees in your journal",
    aiIntro:
      "Numbers tell you what happened. TradeDiscipline's AI explains why, and tells you what to fix first.",
    aiItems: [
      { title: "Destructive patterns", desc: "Revenge trading after a loss, FOMO entries, late-session overtrading: detected and priced in money lost." },
      { title: "Discipline score", desc: "Every session is scored on behavior, not outcome: plan compliance, risk respected, checklist completed." },
      { title: "Visual analysis", desc: "Attach a screenshot to a trade and the AI rereads your chart like a mentor: entry timing, stop placement, exit logic." },
      { title: "A coach that acts", desc: "The AI coach doesn't just chat: it creates your goals, annotates your trades and tracks your discipline challenges." },
    ],
    articlesTitle: "Go deeper",
    articles: [
      { slug: "journal-de-trading-gratuit", label: "Free trading journal: what it must contain" },
      { slug: "journal-de-trading-mt5-automatique", label: "Automatic journal for MT4/MT5" },
      { slug: "journal-tradingview-automatique", label: "Sync TradingView with your journal" },
      { slug: "trading-journal-mistakes", label: "5 mistakes that make a journal useless" },
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      {
        q: "What is a trading journal?",
        a: "A trading journal is the record of all your trades: instrument, entry, exit, size, result, and above all the context of your decision (setup, emotion, plan compliance). It is the number one tool for improving, because it turns your history into usable data: without a journal, you repeat the same mistakes without seeing them.",
      },
      {
        q: "How is it different from an Excel or Notion journal?",
        a: "A spreadsheet requires manual logging that almost everyone abandons, and it detects nothing: neither your emotional patterns nor your discipline slips. TradeDiscipline syncs your trades automatically, computes your stats in real time, and its AI identifies the behaviors costing you money.",
      },
      {
        q: "Which platforms are supported?",
        a: "MetaTrader 4, MetaTrader 5, cTrader, NinjaTrader, TradingView (via webhook), Tradovate and Exness. Setup takes a few minutes: add one file to your platform and closed trades arrive in the journal on their own.",
      },
      {
        q: "Is the trading journal free?",
        a: "Yes. The free plan includes the full journal, automatic sync, screenshots and one discovery AI analysis, no credit card required. Unlimited AI analyses, the coach and advanced goals are in the paid plans.",
      },
      {
        q: "How does the AI help me stay disciplined?",
        a: "It crosses your trades with your trading plan: it spots revenge trading, FOMO and overtrading, prices what each pattern costs you, scores your discipline session by session, and the coach turns that diagnosis into concrete goals to follow.",
      },
    ],
    finalTitle: "Your next trade deserves a real journal",
    finalCta: "Start for free",
  },
  de: {
    metaTitle: "Trading-Tagebuch mit KI, kostenlos starten - TradeDiscipline",
    metaDescription:
      "Trading-Tagebuch online: automatische Synchronisation mit MT4, MT5, cTrader, NinjaTrader und TradingView, Disziplin-Score und eine KI, die Revenge-Trading, FOMO und Overtrading erkennt. Kostenlos starten, ohne Kreditkarte.",
    h1: "Das Trading-Tagebuch, das dir sagt, warum du verlierst",
    intro:
      "Ein Trading-Tagebuch bringt nichts, wenn es deine Trades nur stapelt. TradeDiscipline erfasst deine Positionen automatisch, bewertet deine Disziplin in jeder Session, und die KI zeigt dir die Muster, die dich Geld kosten: Revenge-Trading, FOMO, Overtrading, verschobene Stops.",
    ctaPrimary: "Mein kostenloses Tagebuch erstellen",
    ctaNote: "Ohne Kreditkarte. Vollständiges Tagebuch und Screenshots im Gratis-Plan enthalten.",
    compareTitle: "Excel oder Notion reicht nicht",
    compareIntro:
      "Eine Tabelle protokolliert, was du getan hast. Sie sagt dir nie, was du hättest vermeiden sollen. Der Unterschied liegt in drei Punkten: Erfassung, Analyse, und was danach passiert.",
    compareCols: ["Excel / Notion", "TradeDiscipline"],
    compareRows: [
      { label: "Trade-Erfassung", manual: "Manuell, nach 3 Wochen aufgegeben", td: "Automatisch von deiner Plattform" },
      { label: "Stats (Win-Rate, R:R, Drawdown)", manual: "Formeln bauen und pflegen", td: "In Echtzeit berechnet" },
      { label: "Emotionale Muster", manual: "In einer Tabelle unsichtbar", td: "Von der KI erkannt (Revenge, FOMO, Overtrading)" },
      { label: "Disziplin", manual: "Kein Tracking", td: "Disziplin-Score pro Session" },
      { label: "Nach der Analyse", manual: "Nichts ändert sich", td: "KI-Coach, Ziele und konkrete Challenges" },
    ],
    syncTitle: "Deine Trades erfassen sich von selbst",
    syncIntro:
      "Das beste Tagebuch ist das, das du nie ausfüllen musst. Installiere den Connector deiner Plattform einmal, und jeder geschlossene Trade landet in Sekunden in deinem Tagebuch.",
    platforms: ["MetaTrader 4", "MetaTrader 5", "cTrader", "NinjaTrader", "TradingView", "Tradovate", "Exness"],
    aiTitle: "Was die KI in deinem Tagebuch sieht",
    aiIntro:
      "Zahlen sagen dir, was passiert ist. Die KI von TradeDiscipline erklärt warum, und sagt dir, was du zuerst ändern solltest.",
    aiItems: [
      { title: "Destruktive Muster", desc: "Revenge-Trading nach einem Verlust, FOMO-Einstiege, Overtrading am Sessionende: erkannt und in verlorenem Geld beziffert." },
      { title: "Disziplin-Score", desc: "Jede Session wird nach Verhalten bewertet, nicht nach Ergebnis: Plantreue, Risiko eingehalten, Checkliste erledigt." },
      { title: "Visuelle Analyse", desc: "Hänge einen Screenshot an einen Trade und die KI liest deinen Chart wie ein Mentor: Einstiegs-Timing, Stop-Platzierung, Exit-Logik." },
      { title: "Ein Coach, der handelt", desc: "Der KI-Coach redet nicht nur: Er erstellt deine Ziele, annotiert deine Trades und verfolgt deine Disziplin-Challenges." },
    ],
    articlesTitle: "Zum Weiterlesen",
    articles: [
      { slug: "journal-de-trading-gratuit", label: "Kostenloses Trading-Tagebuch: was es enthalten muss" },
      { slug: "journal-de-trading-mt5-automatique", label: "Automatisches Tagebuch für MT4/MT5" },
      { slug: "journal-tradingview-automatique", label: "TradingView mit deinem Tagebuch synchronisieren" },
      { slug: "trading-journal-mistakes", label: "5 Fehler, die ein Tagebuch nutzlos machen" },
    ],
    faqTitle: "Häufige Fragen",
    faq: [
      {
        q: "Was ist ein Trading-Tagebuch?",
        a: "Ein Trading-Tagebuch ist das Register all deiner Trades: Instrument, Einstieg, Ausstieg, Größe, Ergebnis, und vor allem der Kontext deiner Entscheidung (Setup, Emotion, Plantreue). Es ist das wichtigste Werkzeug, um besser zu werden, denn es macht aus deiner Historie nutzbare Daten: Ohne Tagebuch wiederholst du dieselben Fehler, ohne sie zu sehen.",
      },
      {
        q: "Was ist der Unterschied zu Excel oder Notion?",
        a: "Eine Tabelle verlangt manuelle Erfassung, die fast jeder aufgibt, und sie erkennt nichts: weder deine emotionalen Muster noch deine Disziplin-Ausrutscher. TradeDiscipline synchronisiert deine Trades automatisch, berechnet deine Stats in Echtzeit, und die KI identifiziert die Verhaltensweisen, die dich Geld kosten.",
      },
      {
        q: "Welche Plattformen werden unterstützt?",
        a: "MetaTrader 4, MetaTrader 5, cTrader, NinjaTrader, TradingView (per Webhook), Tradovate und Exness. Die Einrichtung dauert wenige Minuten: eine Datei zur Plattform hinzufügen, und geschlossene Trades kommen von selbst ins Tagebuch.",
      },
      {
        q: "Ist das Trading-Tagebuch kostenlos?",
        a: "Ja. Der Gratis-Plan enthält das vollständige Tagebuch, automatische Synchronisation, Screenshots und eine KI-Analyse zum Kennenlernen, ohne Kreditkarte. Unbegrenzte KI-Analysen, der Coach und erweiterte Ziele sind in den Bezahlplänen.",
      },
      {
        q: "Wie hilft mir die KI, diszipliniert zu bleiben?",
        a: "Sie gleicht deine Trades mit deinem Trading-Plan ab: Sie erkennt Revenge-Trading, FOMO und Overtrading, beziffert, was dich jedes Muster kostet, bewertet deine Disziplin Session für Session, und der Coach macht aus der Diagnose konkrete Ziele.",
      },
    ],
    finalTitle: "Dein nächster Trade verdient ein echtes Tagebuch",
    finalCta: "Kostenlos starten",
  },
  es: {
    metaTitle: "Diario de trading con IA, gratis para empezar - TradeDiscipline",
    metaDescription:
      "Diario de trading online: sincronización automática con MT4, MT5, cTrader, NinjaTrader y TradingView, puntuación de disciplina y una IA que detecta revenge trading, FOMO y overtrading. Gratis para empezar, sin tarjeta.",
    h1: "El diario de trading que te dice por qué pierdes",
    intro:
      "Un diario de trading no sirve de nada si solo acumula tus operaciones. TradeDiscipline registra tus posiciones automáticamente, puntúa tu disciplina en cada sesión, y su IA señala los patrones que te cuestan dinero: revenge trading, FOMO, overtrading, stops movidos.",
    ctaPrimary: "Crear mi diario gratis",
    ctaNote: "Sin tarjeta. Diario completo y capturas incluidos en el plan gratuito.",
    compareTitle: "Excel o Notion no es suficiente",
    compareIntro:
      "Una hoja de cálculo registra lo que hiciste. Nunca te dirá lo que deberías haber evitado. La diferencia está en tres puntos: el registro, el análisis, y lo que haces después.",
    compareCols: ["Excel / Notion", "TradeDiscipline"],
    compareRows: [
      { label: "Registro de operaciones", manual: "Manual, abandonado a las 3 semanas", td: "Automático desde tu plataforma" },
      { label: "Stats (win rate, R:R, drawdown)", manual: "Fórmulas que construir y mantener", td: "Calculadas en tiempo real" },
      { label: "Patrones emocionales", manual: "Invisibles en una hoja de cálculo", td: "Detectados por la IA (revenge, FOMO, overtrading)" },
      { label: "Disciplina", manual: "Sin seguimiento", td: "Puntuación de disciplina por sesión" },
      { label: "Después del análisis", manual: "Nada cambia", td: "Coach IA, objetivos y retos concretos" },
    ],
    syncTitle: "Tus operaciones se registran solas",
    syncIntro:
      "El mejor diario es el que nunca tienes que rellenar. Instala el conector de tu plataforma una vez, y cada operación cerrada llega a tu diario en segundos.",
    platforms: ["MetaTrader 4", "MetaTrader 5", "cTrader", "NinjaTrader", "TradingView", "Tradovate", "Exness"],
    aiTitle: "Lo que la IA ve en tu diario",
    aiIntro:
      "Los números dicen qué pasó. La IA de TradeDiscipline explica por qué, y te dice qué corregir primero.",
    aiItems: [
      { title: "Patrones destructivos", desc: "Revenge trading tras una pérdida, entradas FOMO, overtrading al final de la sesión: detectados y cuantificados en dinero perdido." },
      { title: "Puntuación de disciplina", desc: "Cada sesión se puntúa por el comportamiento, no por el resultado: respeto del plan, del riesgo, de tu checklist." },
      { title: "Análisis visual", desc: "Adjunta una captura a tu operación y la IA relee tu gráfico como un mentor: timing de entrada, colocación del stop, lógica de salida." },
      { title: "Un coach que actúa", desc: "El coach IA no solo conversa: crea tus objetivos, anota tus operaciones y sigue tus retos de disciplina." },
    ],
    articlesTitle: "Para profundizar",
    articles: [
      { slug: "journal-de-trading-gratuit", label: "Diario de trading gratis: qué debe contener" },
      { slug: "journal-de-trading-mt5-automatique", label: "Diario automático para MT4/MT5" },
      { slug: "journal-tradingview-automatique", label: "Sincronizar TradingView con tu diario" },
      { slug: "trading-journal-mistakes", label: "5 errores que hacen inútil un diario" },
    ],
    faqTitle: "Preguntas frecuentes",
    faq: [
      {
        q: "¿Qué es un diario de trading?",
        a: "Un diario de trading es el registro de todas tus operaciones: instrumento, entrada, salida, tamaño, resultado, y sobre todo el contexto de tu decisión (setup, emoción, respeto del plan). Es la herramienta número uno para progresar, porque convierte tu historial en datos accionables: sin diario, repites los mismos errores sin verlos.",
      },
      {
        q: "¿En qué se diferencia de un diario en Excel o Notion?",
        a: "Una hoja de cálculo exige un registro manual que casi todo el mundo abandona, y no detecta nada: ni tus patrones emocionales ni tus fallos de disciplina. TradeDiscipline sincroniza tus operaciones automáticamente, calcula tus stats en tiempo real y su IA identifica los comportamientos que te cuestan dinero.",
      },
      {
        q: "¿Qué plataformas son compatibles?",
        a: "MetaTrader 4, MetaTrader 5, cTrader, NinjaTrader, TradingView (por webhook), Tradovate y Exness. La instalación lleva unos minutos: un archivo que añadir a tu plataforma, y las operaciones cerradas llegan solas al diario.",
      },
      {
        q: "¿El diario de trading es gratis?",
        a: "Sí. El plan gratuito incluye el diario completo, la sincronización automática, las capturas y un análisis IA de descubrimiento, sin tarjeta. Los análisis IA ilimitados, el coach y los objetivos avanzados están en los planes de pago.",
      },
      {
        q: "¿Cómo me ayuda la IA a ser más disciplinado?",
        a: "Cruza tus operaciones con tu plan de trading: detecta el revenge trading, el FOMO y el overtrading, cuantifica lo que te cuesta cada patrón, puntúa tu disciplina sesión a sesión, y el coach convierte ese diagnóstico en objetivos concretos.",
      },
    ],
    finalTitle: "Tu próxima operación merece un diario de verdad",
    finalCta: "Empezar gratis",
  },
};

const PATH = "/trading-journal";

function pageUrl(locale: Locale): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${SITE_URL}${prefix}${PATH}`;
}

export function tradingJournalMetadata(locale: Locale): Metadata {
  const c = CONTENT[locale] ?? CONTENT.en;
  const url = pageUrl(locale);
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, pageUrl(l)])),
        "x-default": pageUrl(defaultLocale),
      },
    },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url,
      siteName: "TradeDiscipline",
      locale: ogLocaleMap[locale],
      type: "website",
    },
    twitter: { card: "summary_large_image", title: c.metaTitle, description: c.metaDescription },
  };
}

const AI_ICONS = [Zap, Target, Brain, ShieldCheck];

export default function TradingJournalPage({ locale }: { locale: Locale }) {
  const c = CONTENT[locale] ?? CONTENT.en;
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  const login = `${prefix}/login`;

  // FAQPage : le schema qui donne les questions dépliables dans la SERP.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: c.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PublicHeader />

      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        {/* Hero */}
        <header>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">{c.h1}</h1>
          <p className="mt-5 text-lg text-foreground-muted leading-relaxed">{c.intro}</p>
          <div className="mt-7">
            <Link
              href={login}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {c.ctaPrimary} <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <p className="mt-3 text-xs text-foreground-muted">{c.ctaNote}</p>
          </div>
        </header>

        {/* Comparatif tableur vs journal auto */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">{c.compareTitle}</h2>
          <p className="mt-3 text-foreground-muted leading-relaxed">{c.compareIntro}</p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-3 text-left font-semibold" />
                  <th className="px-4 py-3 text-left font-semibold text-foreground-muted">{c.compareCols[0]}</th>
                  <th className="px-4 py-3 text-left font-semibold text-accent">{c.compareCols[1]}</th>
                </tr>
              </thead>
              <tbody>
                {c.compareRows.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-foreground-muted">
                      <span className="inline-flex items-start gap-1.5">
                        <X className="h-4 w-4 shrink-0 mt-0.5 text-red-400" strokeWidth={2} />
                        {row.manual}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      <span className="inline-flex items-start gap-1.5">
                        <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" strokeWidth={2} />
                        {row.td}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Synchro auto */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">{c.syncTitle}</h2>
          <p className="mt-3 text-foreground-muted leading-relaxed">{c.syncIntro}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {c.platforms.map((p) => (
              <span key={p} className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground-muted">
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* IA */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">{c.aiTitle}</h2>
          <p className="mt-3 text-foreground-muted leading-relaxed">{c.aiIntro}</p>
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {c.aiItems.map((item, i) => {
              const Icon = AI_ICONS[i % AI_ICONS.length];
              return (
                <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                      <Icon className="h-4 w-4 text-accent" strokeWidth={2} />
                    </div>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-foreground-muted leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Liens internes blog */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">{c.articlesTitle}</h2>
          <ul className="mt-5 space-y-2.5">
            {c.articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`${prefix}/blog/${a.slug}`}
                  className="inline-flex items-center gap-1.5 text-accent hover:underline"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={2} /> {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">{c.faqTitle}</h2>
          <div className="mt-6 space-y-4">
            {c.faq.map((f) => (
              <div key={f.q} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold">{f.q}</h3>
                <p className="mt-2 text-sm text-foreground-muted leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-16 rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
          <p className="text-xl font-bold">{c.finalTitle}</p>
          <Link
            href={login}
            className="mt-4 inline-block rounded-lg bg-gradient-to-r from-accent to-blue-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {c.finalCta}
          </Link>
        </section>
      </main>
      {/* `trademark` : cette page cite nommément la plateforme NinjaTrader,
          la mention de marque doit donc figurer sur la page elle-même. */}
      <RiskDisclosure trademark />
    </div>
  );
}
