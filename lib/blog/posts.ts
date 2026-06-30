/**
 * Blog content, stored as data (mirrors the lib/legal/* pattern) and rendered as
 * markdown. To publish a new article, append a BlogPost here with content in the
 * four supported languages — no new routes or migrations needed.
 *
 * SEO: the listing + each article are added to app/sitemap.ts. Each article page
 * sets its own title/description/canonical via generateMetadata.
 */

export type BlogLang = "fr" | "en" | "de" | "es";

export interface LocalizedPost {
  title: string;
  excerpt: string;
  /** Article body in Markdown. */
  body: string;
}

export interface BlogPost {
  slug: string;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  readingMinutes: number;
  content: Record<BlogLang, LocalizedPost>;
}

export const POSTS: BlogPost[] = [
  {
    slug: "stop-revenge-trading",
    date: "2026-06-30",
    readingMinutes: 4,
    content: {
      en: {
        title: "How to stop revenge trading: a 4-step framework",
        excerpt:
          "Revenge trading turns a small loss into a blown account. Here's a simple, repeatable framework to break the cycle before it costs you.",
        body: `Revenge trading is the fastest way to turn a small, normal loss into a blown account. It's the impulse to immediately "win it back" after a losing trade — and it almost always makes things worse, because the decision is driven by emotion, not by your edge.

## Why it happens

A loss triggers a threat response. Your brain treats the red number as danger and pushes you to act *now* to make the pain go away. That urgency is the problem: good trades come from patience, not from a need to feel better in the next five minutes.

## A 4-step framework

### 1. Name the trigger

The moment you feel the urge to "get it back", say it out loud: *"This is revenge, not a setup."* Naming the emotion creates a half-second of distance — and that distance is where discipline lives.

### 2. Enforce a cooldown

After a loss that stings, step away from the screen for a fixed time — 15 minutes is enough to let the stress hormones drop. No charts, no order ticket. A hard rule beats willpower every time.

### 3. Re-read your plan

Before the next entry, confront yourself with your own rules: is this an A+ setup, or are you forcing it? If it doesn't match your written plan, it isn't a trade — it's a reaction.

### 4. Journal the urge, not just the trade

Most journals only log fills. Log the *impulse* too: what you felt, what triggered it, whether you acted. Over a few weeks you'll see your pattern clearly — and what you can measure, you can fix.

## Make it automatic

Discipline isn't a personality trait, it's a system. A pre-trade checklist, a daily loss limit, and an honest journal remove the decision from the heat of the moment. That's exactly what TradeDiscipline is built to do: confront you with your own rules before you click, and show you the patterns that quietly cost you money.`,
      },
      fr: {
        title: "Arrêter le revenge trading : une méthode en 4 étapes",
        excerpt:
          "Le revenge trading transforme une petite perte en compte cramé. Voici une méthode simple et répétable pour briser le cycle avant qu'il ne coûte cher.",
        body: `Le revenge trading est le moyen le plus rapide de transformer une perte petite et normale en compte cramé. C'est l'impulsion de vouloir « se refaire » immédiatement après un trade perdant — et ça aggrave presque toujours les choses, parce que la décision est dictée par l'émotion, pas par ton edge.

## Pourquoi ça arrive

Une perte déclenche une réaction de menace. Ton cerveau traite le chiffre rouge comme un danger et te pousse à agir *maintenant* pour faire disparaître la douleur. C'est cette urgence le problème : les bons trades naissent de la patience, pas du besoin de se sentir mieux dans les cinq minutes.

## Une méthode en 4 étapes

### 1. Nomme le déclencheur

Dès que tu sens l'envie de « te refaire », dis-le à voix haute : *« C'est de la revanche, pas un setup. »* Nommer l'émotion crée une demi-seconde de recul — et c'est là que vit la discipline.

### 2. Impose un temps de pause

Après une perte qui pique, éloigne-toi de l'écran pendant une durée fixe — 15 minutes suffisent pour faire retomber le stress. Pas de graphique, pas d'ordre. Une règle stricte bat la volonté à tous les coups.

### 3. Relis ton plan

Avant la prochaine entrée, confronte-toi à tes propres règles : est-ce un setup A+, ou est-ce que tu forces ? Si ça ne colle pas à ton plan écrit, ce n'est pas un trade — c'est une réaction.

### 4. Journalise l'impulsion, pas seulement le trade

La plupart des journaux ne notent que les exécutions. Note aussi l'*impulsion* : ce que tu as ressenti, ce qui l'a déclenchée, si tu es passé à l'acte. En quelques semaines, ton pattern devient évident — et ce qui se mesure se corrige.

## Rends-le automatique

La discipline n'est pas un trait de caractère, c'est un système. Une checklist pré-trade, une limite de perte journalière et un journal honnête sortent la décision du feu de l'action. C'est exactement ce pour quoi TradeDiscipline est conçu : te confronter à tes propres règles avant que tu cliques, et te montrer les patterns qui te coûtent de l'argent en silence.`,
      },
      de: {
        title: "Revenge-Trading stoppen: ein 4-Schritte-Framework",
        excerpt:
          "Revenge-Trading macht aus einem kleinen Verlust ein gesprengtes Konto. Hier ist ein einfaches, wiederholbares Framework, um den Kreislauf zu durchbrechen.",
        body: `Revenge-Trading ist der schnellste Weg, einen kleinen, normalen Verlust in ein gesprengtes Konto zu verwandeln. Es ist der Impuls, nach einem Verlusttrade sofort „alles zurückzuholen" — und es macht die Sache fast immer schlimmer, weil die Entscheidung von Emotion getrieben ist, nicht von deinem Edge.

## Warum es passiert

Ein Verlust löst eine Bedrohungsreaktion aus. Dein Gehirn behandelt die rote Zahl als Gefahr und drängt dich, *jetzt* zu handeln, damit der Schmerz verschwindet. Genau diese Dringlichkeit ist das Problem: Gute Trades entstehen aus Geduld, nicht aus dem Bedürfnis, sich in den nächsten fünf Minuten besser zu fühlen.

## Ein 4-Schritte-Framework

### 1. Benenne den Auslöser

Sobald du den Drang spürst, „es zurückzuholen", sprich es laut aus: *„Das ist Rache, kein Setup."* Die Emotion zu benennen schafft eine halbe Sekunde Abstand — und genau dort lebt Disziplin.

### 2. Erzwinge eine Abkühlphase

Nach einem schmerzhaften Verlust geh für eine feste Zeit vom Bildschirm weg — 15 Minuten reichen, damit die Stresshormone sinken. Keine Charts, kein Orderticket. Eine harte Regel schlägt Willenskraft jedes Mal.

### 3. Lies deinen Plan erneut

Vor dem nächsten Einstieg konfrontiere dich mit deinen eigenen Regeln: Ist das ein A+-Setup, oder erzwingst du es? Wenn es nicht zu deinem schriftlichen Plan passt, ist es kein Trade — es ist eine Reaktion.

### 4. Journalisiere den Impuls, nicht nur den Trade

Die meisten Journale erfassen nur Ausführungen. Erfasse auch den *Impuls*: was du gefühlt hast, was ihn ausgelöst hat, ob du gehandelt hast. Nach ein paar Wochen siehst du dein Muster klar — und was du messen kannst, kannst du beheben.

## Mach es automatisch

Disziplin ist kein Charakterzug, sondern ein System. Eine Pre-Trade-Checkliste, ein tägliches Verlustlimit und ein ehrliches Journal nehmen die Entscheidung aus der Hitze des Moments. Genau dafür ist TradeDiscipline gebaut: dich mit deinen eigenen Regeln zu konfrontieren, bevor du klickst, und dir die Muster zu zeigen, die dich still Geld kosten.`,
      },
      es: {
        title: "Cómo dejar el revenge trading: un método en 4 pasos",
        excerpt:
          "El revenge trading convierte una pequeña pérdida en una cuenta reventada. Aquí tienes un método simple y repetible para romper el ciclo.",
        body: `El revenge trading es la forma más rápida de convertir una pérdida pequeña y normal en una cuenta reventada. Es el impulso de querer "recuperarlo" de inmediato tras un trade perdedor — y casi siempre empeora las cosas, porque la decisión la dicta la emoción, no tu edge.

## Por qué ocurre

Una pérdida dispara una respuesta de amenaza. Tu cerebro trata el número rojo como un peligro y te empuja a actuar *ya* para que el dolor desaparezca. Esa urgencia es el problema: los buenos trades nacen de la paciencia, no de la necesidad de sentirte mejor en los próximos cinco minutos.

## Un método en 4 pasos

### 1. Nombra el detonante

En cuanto sientas el impulso de "recuperarlo", dilo en voz alta: *"Esto es revancha, no un setup."* Nombrar la emoción crea medio segundo de distancia — y ahí es donde vive la disciplina.

### 2. Impón un tiempo de enfriamiento

Tras una pérdida que duele, aléjate de la pantalla durante un tiempo fijo — 15 minutos bastan para que bajen las hormonas del estrés. Sin gráficos, sin orden. Una regla estricta gana a la fuerza de voluntad siempre.

### 3. Relee tu plan

Antes de la siguiente entrada, confróntate con tus propias reglas: ¿es un setup A+, o lo estás forzando? Si no encaja con tu plan escrito, no es un trade — es una reacción.

### 4. Registra el impulso, no solo el trade

La mayoría de diarios solo anotan las ejecuciones. Registra también el *impulso*: qué sentiste, qué lo detonó, si actuaste. En unas semanas verás tu patrón con claridad — y lo que puedes medir, lo puedes corregir.

## Hazlo automático

La disciplina no es un rasgo de personalidad, es un sistema. Una checklist previa, un límite de pérdida diaria y un diario honesto sacan la decisión del calor del momento. Para eso está hecho TradeDiscipline: confrontarte con tus propias reglas antes de que hagas clic, y mostrarte los patrones que te cuestan dinero en silencio.`,
      },
    },
  },
];

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function postContent(post: BlogPost, lang: string): LocalizedPost {
  return post.content[lang as BlogLang] ?? post.content.en;
}
