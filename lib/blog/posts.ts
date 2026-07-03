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
  /** Illustration key (see components/blog/BlogIllustration). */
  cover: string;
  content: Record<BlogLang, LocalizedPost>;
}

export const POSTS: BlogPost[] = [
  {
    slug: "tradediscipline-vs-focuspips",
    date: "2026-07-03",
    readingMinutes: 5,
    cover: "target",
    content: {
      en: {
        title: "TradeDiscipline vs FocusPips: two French AI trading journals compared (2026)",
        excerpt:
          "Both promise to show you where you lose money. Here's an honest, feature-by-feature look at how they actually differ — pricing, AI, real-time coaching.",
        body: `FocusPips and TradeDiscipline share the same conviction: most traders don't need more indicators, they need to see where they lose money. So how do the two products actually differ? Honest comparison below.

*Prices and features as observed in July 2026 on each product's public website.*

## The quick comparison

| | TradeDiscipline | FocusPips |
|---|---|---|
| Price | Plus €9.99/mo · Premium €19.99/mo (€179.88/yr) | Basic free · Premium €290/yr (~€24.17/mo) |
| AI coach | ✓ chat with **long-term memory** of your commitments | ✓ Atlas chat (5 questions free, unlimited Premium) |
| Cost of mistakes in € | ✓ automatic capital-leaks block on the dashboard | via questions to the AI chat |
| "What if I'd followed my plan?" | ✓ counterfactual discipline curve | — |
| Candle-by-candle backtesting | — | ✓ (Premium) |
| Trade replay | — | ✓ |
| Real-time guards & tilt push alerts | ✓ | — |
| Broker sync | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | MT4/MT5, cTrader + CSV |
| Community & gamification | ✓ leaderboard, challenges, streaks | — |
| Daily AI macro briefing | ✓ (Premium) | — (economic calendar, COT, seasonality) |
| Languages | FR, EN, DE, ES | FR |

## Where FocusPips is genuinely stronger

If **candle-by-candle backtesting and trade replay** are central to your process, FocusPips has both built in. It also offers market-context data (COT positioning, seasonality) that TradeDiscipline doesn't carry.

## Where TradeDiscipline wins

- **The mistake report comes to you.** Capital leaks are computed automatically and displayed on your dashboard in euros — with the counterfactual curve showing where your account would be with your plan followed. No need to ask the right question to a chatbot.
- **A coach with memory.** Our AI remembers what you committed to last session and tells you when you break it. A conversation, not a Q&A.
- **Real-time protection.** Stop-trading guards, prop-firm challenge limits, tilt push alerts — during the session, not after.
- **Price.** Unlimited AI coaching costs €179.88/year here versus €290/year there — 38% less.
- **Four languages and a community** (leaderboard, community challenges, streaks) if consistency motivates you socially.

## Which one is for you?

Choose **FocusPips** if replay and candle-by-candle backtesting are the core of your routine.

Choose **TradeDiscipline** if you want your discipline priced in euros automatically, a coach that remembers, and guardrails that act in real time — at a lower price. [Try it free](/login).`,
      },
      fr: {
        title: "TradeDiscipline vs FocusPips : deux journaux de trading IA français comparés (2026)",
        excerpt:
          "Les deux promettent de te montrer où tu perds de l'argent. Comparatif honnête, fonctionnalité par fonctionnalité : prix, IA, coaching temps réel.",
        body: `FocusPips et TradeDiscipline partagent la même conviction : la plupart des traders n'ont pas besoin de plus d'indicateurs, mais de voir où ils perdent de l'argent. Alors, en quoi les deux produits diffèrent-ils vraiment ? Comparatif honnête ci-dessous.

*Prix et fonctionnalités constatés en juillet 2026 sur les sites publics des deux produits.*

## Le comparatif express

| | TradeDiscipline | FocusPips |
|---|---|---|
| Prix | Plus 9,99 €/mois · Premium 19,99 €/mois (179,88 €/an) | Basic gratuit · Premium 290 €/an (~24,17 €/mois) |
| Coach IA | ✓ chat avec **mémoire longue durée** de tes engagements | ✓ chat Atlas (5 questions en gratuit, illimité en Premium) |
| Coût des erreurs en € | ✓ bloc fuites de capital automatique sur le dashboard | via questions au chat IA |
| « Et si j'avais respecté mon plan ? » | ✓ courbe de discipline contrefactuelle | — |
| Backtest bougie par bougie | — | ✓ (Premium) |
| Trade replay | — | ✓ |
| Garde-fous temps réel & push tilt | ✓ | — |
| Synchro broker | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | MT4/MT5, cTrader + CSV |
| Communauté & gamification | ✓ classement, défis, séries | — |
| Brief macro IA quotidien | ✓ (Premium) | — (calendrier éco, COT, saisonnalité) |
| Langues | FR, EN, DE, ES | FR |

## Là où FocusPips est réellement plus fort

Si le **backtest bougie par bougie et le trade replay** sont au cœur de ton process, FocusPips intègre les deux. Il propose aussi des données de contexte de marché (positionnement COT, saisonnalité) que TradeDiscipline n'embarque pas.

## Là où TradeDiscipline gagne

- **Le rapport d'erreurs vient à toi.** Les fuites de capital sont calculées automatiquement et affichées en euros sur ton dashboard — avec la courbe contrefactuelle qui montre où serait ton compte si tu avais respecté ton plan. Pas besoin de poser la bonne question à un chatbot.
- **Un coach avec mémoire.** Notre IA se souvient de ce que tu t'étais engagé à corriger la session dernière et te le dit quand tu récidives. Une conversation, pas un Q&R.
- **De la protection en temps réel.** Garde-fous stop-trading, limites de challenge prop firm, alertes push tilt — pendant la session, pas après.
- **Le prix.** Le coaching IA illimité coûte 179,88 €/an chez nous contre 290 €/an — 38 % de moins.
- **Quatre langues et une communauté** (classement, défis communautaires, séries) si la régularité te motive aussi socialement.

## Lequel est fait pour toi ?

Choisis **FocusPips** si le replay et le backtest bougie par bougie sont le cœur de ta routine.

Choisis **TradeDiscipline** si tu veux ta discipline chiffrée en euros automatiquement, un coach qui se souvient, et des garde-fous qui agissent en temps réel — pour moins cher. [Essaie gratuitement](/login).`,
      },
      de: {
        title: "TradeDiscipline vs. FocusPips: zwei französische KI-Trading-Journals im Vergleich (2026)",
        excerpt:
          "Beide versprechen zu zeigen, wo du Geld verlierst. Ein ehrlicher Funktionsvergleich: Preise, KI, Echtzeit-Coaching.",
        body: `FocusPips und TradeDiscipline teilen dieselbe Überzeugung: Die meisten Trader brauchen nicht mehr Indikatoren, sondern müssen sehen, wo sie Geld verlieren. Worin unterscheiden sich die beiden Produkte wirklich? Ehrlicher Vergleich unten.

*Preise und Funktionen: Stand Juli 2026, laut den öffentlichen Websites beider Produkte.*

## Der Schnellvergleich

| | TradeDiscipline | FocusPips |
|---|---|---|
| Preis | Plus 9,99 €/Monat · Premium 19,99 €/Monat (179,88 €/Jahr) | Basic gratis · Premium 290 €/Jahr (~24,17 €/Monat) |
| KI-Coach | ✓ Chat mit **Langzeitgedächtnis** deiner Vorsätze | ✓ Atlas-Chat (5 Fragen gratis, unbegrenzt Premium) |
| Fehlerkosten in € | ✓ automatischer Kapitalleck-Block im Dashboard | über Fragen an den KI-Chat |
| „Was wäre bei Planbefolgung?" | ✓ kontrafaktische Disziplin-Kurve | — |
| Kerze-für-Kerze-Backtesting | — | ✓ (Premium) |
| Trade Replay | — | ✓ |
| Echtzeit-Wächter & Tilt-Push | ✓ | — |
| Broker-Sync | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | MT4/MT5, cTrader + CSV |
| Community & Gamification | ✓ Rangliste, Challenges, Serien | — |
| Tägliches KI-Makro-Briefing | ✓ (Premium) | — (Wirtschaftskalender, COT, Saisonalität) |
| Sprachen | DE, EN, FR, ES | FR |

## Wo FocusPips wirklich stärker ist

Wenn **Kerze-für-Kerze-Backtesting und Trade Replay** zentral für deinen Prozess sind, hat FocusPips beides eingebaut — plus Marktkontext-Daten (COT, Saisonalität), die TradeDiscipline nicht mitbringt.

## Wo TradeDiscipline gewinnt

- **Der Fehlerbericht kommt zu dir.** Kapitallecks werden automatisch berechnet und in Euro im Dashboard angezeigt — samt kontrafaktischer Kurve. Du musst keinem Chatbot die richtige Frage stellen.
- **Ein Coach mit Gedächtnis.** Unsere KI erinnert sich an deine Vorsätze und meldet Rückfälle.
- **Echtzeit-Schutz.** Stop-Trading-Wächter, Prop-Firm-Limits, Tilt-Push — während der Session, nicht danach.
- **Der Preis.** Unbegrenztes KI-Coaching kostet hier 179,88 €/Jahr gegenüber 290 €/Jahr — 38 % weniger.
- **Vier Sprachen und Community** (Rangliste, Challenges, Serien) — FocusPips ist nur auf Französisch verfügbar.

## Was passt zu dir?

Wähle **FocusPips**, wenn Replay und Kerzen-Backtesting das Herz deiner Routine sind (und du Französisch sprichst).

Wähle **TradeDiscipline** für automatisch bezifferte Disziplin, einen Coach mit Gedächtnis und Echtzeit-Leitplanken — zum niedrigeren Preis. [Kostenlos testen](/login).`,
      },
      es: {
        title: "TradeDiscipline vs FocusPips: dos diarios de trading IA franceses comparados (2026)",
        excerpt:
          "Ambos prometen mostrarte dónde pierdes dinero. Comparativa honesta, función por función: precios, IA, coaching en tiempo real.",
        body: `FocusPips y TradeDiscipline comparten la misma convicción: la mayoría de los traders no necesitan más indicadores, sino ver dónde pierden dinero. ¿En qué se diferencian realmente? Comparativa honesta abajo.

*Precios y funciones observados en julio de 2026 en las webs públicas de ambos productos.*

## La comparativa rápida

| | TradeDiscipline | FocusPips |
|---|---|---|
| Precio | Plus 9,99 €/mes · Premium 19,99 €/mes (179,88 €/año) | Basic gratis · Premium 290 €/año (~24,17 €/mes) |
| Coach IA | ✓ chat con **memoria a largo plazo** de tus compromisos | ✓ chat Atlas (5 preguntas gratis, ilimitado Premium) |
| Coste de errores en € | ✓ bloque de fugas de capital automático en el dashboard | vía preguntas al chat IA |
| «¿Y si hubiera seguido mi plan?» | ✓ curva de disciplina contrafactual | — |
| Backtesting vela a vela | — | ✓ (Premium) |
| Trade replay | — | ✓ |
| Guardias en tiempo real & push de tilt | ✓ | — |
| Sincronización broker | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | MT4/MT5, cTrader + CSV |
| Comunidad & gamificación | ✓ ranking, retos, rachas | — |
| Brief macro IA diario | ✓ (Premium) | — (calendario económico, COT, estacionalidad) |
| Idiomas | ES, EN, FR, DE | FR |

## Donde FocusPips es realmente más fuerte

Si el **backtesting vela a vela y el trade replay** son el centro de tu proceso, FocusPips integra ambos — además de datos de contexto de mercado (COT, estacionalidad) que TradeDiscipline no incluye.

## Donde gana TradeDiscipline

- **El informe de errores viene a ti.** Las fugas de capital se calculan automáticamente y se muestran en euros en tu dashboard — con la curva contrafactual. Sin necesidad de hacerle la pregunta correcta a un chatbot.
- **Un coach con memoria.** Nuestra IA recuerda tus compromisos y te señala las recaídas.
- **Protección en tiempo real.** Guardias stop-trading, límites de prop firm, push de tilt — durante la sesión, no después.
- **El precio.** El coaching IA ilimitado cuesta aquí 179,88 €/año frente a 290 €/año — un 38 % menos.
- **Cuatro idiomas y comunidad** (ranking, retos, rachas) — FocusPips solo está en francés.

## ¿Cuál es para ti?

Elige **FocusPips** si el replay y el backtesting vela a vela son el corazón de tu rutina (y hablas francés).

Elige **TradeDiscipline** para una disciplina cuantificada automáticamente, un coach que recuerda y barreras en tiempo real — a menor precio. [Pruébalo gratis](/login).`,
      },
    },
  },
  {
    slug: "tradediscipline-vs-edgewonk",
    date: "2026-07-03",
    readingMinutes: 5,
    cover: "discipline",
    content: {
      en: {
        title: "TradeDiscipline vs Edgewonk: psychology journal vs discipline coach (2026)",
        excerpt:
          "Both take trading psychology seriously. One analyzes it, the other quantifies it in euros and intervenes in real time. An honest comparison.",
        body: `Edgewonk is the reference for psychology-focused traders, and at $197/year all-inclusive it's the cheapest premium journal on the market. If you're comparing it with TradeDiscipline, you're already asking the right question: both products believe your P&L problem is a behavior problem. Here's where they differ.

*Prices and features as observed in July 2026 on each product's public website.*

## The quick comparison

| | TradeDiscipline | Edgewonk |
|---|---|---|
| Price | €9.99/month (Plus), free tier | $197/year, one plan |
| Emotional tracking | ✓ per-trade emotions + edge by emotion | ✓ Tiltmeter |
| Cost of mistakes in € | ✓ capital leaks, quantified per habit | — (patterns shown, not priced) |
| AI analysis | ✓ daily, against your written strategy | Edge Finder AI: weekly report |
| AI coach chat | ✓ with long-term memory of your commitments | — |
| Real-time intervention | ✓ stop-trading guards, tilt push alerts | — (post-session reflection) |
| Broker auto-sync | ✓ MT4/MT5, cTrader, NinjaTrader, Tradovate | — (file import only) |
| Custom metrics | Fixed, discipline-focused | ✓ 50+ customizable, 20 custom slots |
| Mobile | PWA (installable) | — |
| Languages | FR, EN, DE, ES | EN |

## Where Edgewonk is genuinely stronger

If you love **building your own statistics** — custom metrics, custom classifications, deep manual reflection — Edgewonk gives you 50+ configurable metrics and rewards the effort. Its one-price-for-everything model is also admirably simple.

## Where TradeDiscipline wins

**Edgewonk describes your psychology. TradeDiscipline prices it and interrupts it.**

- **Euros, not adjectives.** Our capital-leaks block tells you "revenge trading cost you €480 this month" and draws the equity curve you'd have if you had followed your plan. Naming a pattern is step one; seeing its price is what changes behavior.
- **Daily AI, not weekly.** Edge Finder sends a weekly report. TradeDiscipline analyzes on every import, and its coach chat remembers your commitments from last week — and calls out relapses.
- **Real time.** Tilt push alerts and stop-trading guards act during the session, not in Sunday's report.
- **No manual homework.** Broker auto-sync means the journal fills itself; Edgewonk requires file imports and manual upkeep.

## Which one is for you?

Choose **Edgewonk** if you enjoy deep manual journaling, want maximum metric customization, and prefer a one-time yearly price.

Choose **TradeDiscipline** if you want the psychology work done *for* you — quantified in euros, surfaced daily, and interrupted live when you tilt. [Try it free](/login), no credit card required.`,
      },
      fr: {
        title: "TradeDiscipline vs Edgewonk : journal psycho vs coach de discipline (2026)",
        excerpt:
          "Les deux prennent la psychologie du trading au sérieux. L'un l'analyse, l'autre la chiffre en euros et intervient en temps réel. Comparatif honnête.",
        body: `Edgewonk est la référence des traders orientés psychologie, et à 197 $/an tout compris, c'est le journal premium le moins cher du marché. Si tu le compares à TradeDiscipline, tu poses déjà la bonne question : les deux produits considèrent que ton problème de P&L est un problème de comportement. Voici où ils divergent.

*Prix et fonctionnalités constatés en juillet 2026 sur les sites publics des deux produits.*

## Le comparatif express

| | TradeDiscipline | Edgewonk |
|---|---|---|
| Prix | 9,99 €/mois (Plus), plan gratuit | 197 $/an, plan unique |
| Suivi émotionnel | ✓ émotion par trade + edge par émotion | ✓ Tiltmeter |
| Coût des erreurs en € | ✓ fuites de capital chiffrées par habitude | — (patterns décrits, pas chiffrés) |
| Analyse IA | ✓ quotidienne, face à ta stratégie écrite | Edge Finder AI : rapport hebdo |
| Chat coach IA | ✓ avec mémoire longue durée de tes engagements | — |
| Intervention temps réel | ✓ garde-fous stop-trading, push tilt | — (réflexion post-session) |
| Synchro broker | ✓ MT4/MT5, cTrader, NinjaTrader, Tradovate | — (import fichier uniquement) |
| Métriques custom | Fixes, orientées discipline | ✓ 50+ configurables, 20 slots custom |
| Mobile | PWA (installable) | — |
| Langues | FR, EN, DE, ES | EN |

## Là où Edgewonk est réellement plus fort

Si tu aimes **construire tes propres statistiques** — métriques custom, classifications maison, réflexion manuelle approfondie — Edgewonk t'offre 50+ métriques configurables et récompense l'effort. Son prix unique tout compris est aussi d'une simplicité admirable.

## Là où TradeDiscipline gagne

**Edgewonk décrit ta psychologie. TradeDiscipline la chiffre et l'interrompt.**

- **Des euros, pas des adjectifs.** Notre bloc fuites de capital te dit « le revenge trading t'a coûté 480 € ce mois » et trace la courbe que ton compte aurait suivie si tu avais respecté ton plan. Nommer un pattern, c'est l'étape un ; voir son prix, c'est ce qui change le comportement.
- **De l'IA quotidienne, pas hebdomadaire.** Edge Finder envoie un rapport le dimanche. TradeDiscipline analyse à chaque import, et son coach se souvient de tes engagements de la semaine dernière — et te signale les récidives.
- **Du temps réel.** Alertes push tilt et garde-fous stop-trading agissent pendant la session, pas dans le rapport du dimanche.
- **Zéro devoir à la maison.** La synchro broker remplit le journal toute seule ; Edgewonk exige des imports de fichiers et de l'entretien manuel.

## Lequel est fait pour toi ?

Choisis **Edgewonk** si tu aimes le journaling manuel profond, la personnalisation maximale des métriques et un prix annuel unique.

Choisis **TradeDiscipline** si tu veux que le travail psychologique soit fait *pour* toi — chiffré en euros, remonté chaque jour, et interrompu en direct quand tu tiltes. [Essaie gratuitement](/login), sans carte bancaire.`,
      },
      de: {
        title: "TradeDiscipline vs. Edgewonk: Psycho-Journal vs. Disziplin-Coach (2026)",
        excerpt:
          "Beide nehmen Trading-Psychologie ernst. Das eine analysiert sie, das andere beziffert sie in Euro und greift in Echtzeit ein. Ein ehrlicher Vergleich.",
        body: `Edgewonk ist die Referenz für psychologie-orientierte Trader, und mit 197 $/Jahr all-inclusive das günstigste Premium-Journal am Markt. Wer es mit TradeDiscipline vergleicht, stellt bereits die richtige Frage: Beide Produkte sehen dein P&L-Problem als Verhaltensproblem. Hier die Unterschiede.

*Preise und Funktionen: Stand Juli 2026, laut den öffentlichen Websites beider Produkte.*

## Der Schnellvergleich

| | TradeDiscipline | Edgewonk |
|---|---|---|
| Preis | 9,99 €/Monat (Plus), Gratis-Plan | 197 $/Jahr, ein Plan |
| Emotions-Tracking | ✓ Emotion pro Trade + Edge pro Emotion | ✓ Tiltmeter |
| Fehlerkosten in € | ✓ Kapitallecks pro Gewohnheit beziffert | — (Muster beschrieben, nicht bepreist) |
| KI-Analyse | ✓ täglich, gegen deine schriftliche Strategie | Edge Finder AI: Wochenbericht |
| KI-Coach-Chat | ✓ mit Langzeitgedächtnis deiner Vorsätze | — |
| Echtzeit-Eingriff | ✓ Stop-Trading-Wächter, Tilt-Push | — (Reflexion nach der Session) |
| Broker-Auto-Sync | ✓ MT4/MT5, cTrader, NinjaTrader, Tradovate | — (nur Datei-Import) |
| Custom-Metriken | Fest, disziplin-fokussiert | ✓ 50+ konfigurierbar |
| Mobile | PWA (installierbar) | — |
| Sprachen | DE, EN, FR, ES | EN |

## Wo Edgewonk wirklich stärker ist

Wenn du **eigene Statistiken bauen** willst — Custom-Metriken, eigene Klassifikationen, tiefe manuelle Reflexion — belohnt Edgewonk den Aufwand mit 50+ konfigurierbaren Metriken. Der Ein-Preis-für-alles-Ansatz ist zudem bewundernswert einfach.

## Wo TradeDiscipline gewinnt

**Edgewonk beschreibt deine Psychologie. TradeDiscipline beziffert und unterbricht sie.**

- **Euro statt Adjektive.** Unser Kapitalleck-Block sagt dir „Revenge-Trading hat dich diesen Monat 480 € gekostet" und zeichnet die Kurve, die dein Konto bei Planbefolgung hätte.
- **Tägliche KI statt wöchentlich.** Edge Finder schickt sonntags einen Bericht. TradeDiscipline analysiert bei jedem Import, und der Coach erinnert sich an deine Vorsätze — und meldet Rückfälle.
- **Echtzeit.** Tilt-Push und Stop-Trading-Wächter greifen während der Session ein, nicht im Sonntagsbericht.
- **Keine Hausaufgaben.** Broker-Sync füllt das Journal von selbst; Edgewonk verlangt Datei-Importe und manuelle Pflege.

## Was passt zu dir?

Wähle **Edgewonk** für tiefes manuelles Journaling und maximale Metrik-Anpassung zum Jahres-Festpreis.

Wähle **TradeDiscipline**, wenn die Psychologie-Arbeit *für dich* erledigt werden soll — in Euro beziffert, täglich sichtbar, live unterbrochen, wenn du tiltest. [Kostenlos testen](/login), ohne Kreditkarte.`,
      },
      es: {
        title: "TradeDiscipline vs Edgewonk: diario psicológico vs coach de disciplina (2026)",
        excerpt:
          "Ambos se toman en serio la psicología del trading. Uno la analiza, el otro la cuantifica en euros e interviene en tiempo real. Comparativa honesta.",
        body: `Edgewonk es la referencia para traders centrados en la psicología, y a 197 $/año todo incluido es el diario premium más barato del mercado. Si lo comparas con TradeDiscipline, ya te haces la pregunta correcta: ambos productos consideran que tu problema de P&L es un problema de comportamiento. Aquí sus diferencias.

*Precios y funciones observados en julio de 2026 en las webs públicas de ambos productos.*

## La comparativa rápida

| | TradeDiscipline | Edgewonk |
|---|---|---|
| Precio | 9,99 €/mes (Plus), plan gratuito | 197 $/año, plan único |
| Seguimiento emocional | ✓ emoción por trade + edge por emoción | ✓ Tiltmeter |
| Coste de errores en € | ✓ fugas de capital cuantificadas | — (patrones descritos, sin precio) |
| Análisis IA | ✓ diario, contra tu estrategia escrita | Edge Finder AI: informe semanal |
| Chat coach IA | ✓ con memoria de tus compromisos | — |
| Intervención en tiempo real | ✓ guardias stop-trading, push de tilt | — (reflexión post-sesión) |
| Sincronización broker | ✓ MT4/MT5, cTrader, NinjaTrader, Tradovate | — (solo importar archivos) |
| Métricas custom | Fijas, centradas en disciplina | ✓ 50+ configurables |
| Móvil | PWA (instalable) | — |
| Idiomas | ES, EN, FR, DE | EN |

## Donde Edgewonk es realmente más fuerte

Si te gusta **construir tus propias estadísticas** — métricas custom, clasificaciones propias, reflexión manual profunda — Edgewonk recompensa el esfuerzo con 50+ métricas configurables. Su precio único todo incluido es además admirablemente simple.

## Donde gana TradeDiscipline

**Edgewonk describe tu psicología. TradeDiscipline le pone precio y la interrumpe.**

- **Euros, no adjetivos.** Nuestro bloque de fugas de capital te dice «el revenge trading te costó 480 € este mes» y traza la curva que tendría tu cuenta si hubieras respetado tu plan.
- **IA diaria, no semanal.** Edge Finder envía un informe el domingo. TradeDiscipline analiza en cada importación, y su coach recuerda tus compromisos de la semana pasada — y te señala las recaídas.
- **Tiempo real.** Alertas push de tilt y guardias stop-trading actúan durante la sesión, no en el informe del domingo.
- **Cero deberes.** La sincronización broker rellena el diario sola; Edgewonk exige importar archivos y mantenimiento manual.

## ¿Cuál es para ti?

Elige **Edgewonk** si disfrutas del journaling manual profundo y la personalización máxima de métricas a precio anual único.

Elige **TradeDiscipline** si quieres que el trabajo psicológico se haga *por* ti — cuantificado en euros, visible a diario e interrumpido en vivo cuando entras en tilt. [Pruébalo gratis](/login), sin tarjeta.`,
      },
    },
  },
  {
    slug: "tradediscipline-vs-tradezella",
    date: "2026-07-03",
    readingMinutes: 6,
    cover: "journal",
    content: {
      en: {
        title: "TradeDiscipline vs TradeZella: which trading journal should you choose in 2026?",
        excerpt:
          "An honest, feature-by-feature comparison: where TradeZella is genuinely stronger, where TradeDiscipline wins, and how to pick based on what actually makes you profitable.",
        body: `TradeZella is the best-known trading journal on the market, and it earns that reputation. So why would you pick TradeDiscipline instead? Short answer: it depends on what's actually holding your trading back. Here's an honest comparison — including the areas where TradeZella is stronger.

*Prices and features below are as observed in July 2026 on each product's public website.*

## The quick comparison

| | TradeDiscipline | TradeZella |
|---|---|---|
| Price (monthly) | €9.99 (Plus) / €19.99 (Premium) | $29 (Basic) / $49 (Premium) |
| AI trade analysis | ✓ against **your** written strategy | ✓ per-trade, always-on |
| AI coach with long-term memory | ✓ remembers your commitments across sessions | — |
| Cost of your mistakes in € | ✓ capital leaks, quantified per habit | — |
| "What if I'd followed my plan?" curve | ✓ counterfactual equity curve | — |
| Real-time guards (stop-trading, prop-firm limits) | ✓ before you click | — |
| Market backtesting (historical data) | — | ✓ 11+ years of data |
| Trade replay | — | ✓ tick by tick |
| Broker auto-sync | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | 500+ brokers |
| Languages | French, English, German, Spanish | English |
| Daily AI macro briefing | ✓ (Premium) | — |

## Where TradeZella is genuinely stronger

Let's be fair. If you spend your evenings **backtesting strategies against historical market data**, TradeZella is built for that: years of data, plain-English strategy testing, tick-by-tick replay. TradeDiscipline doesn't do market backtesting. TradeZella also syncs with far more brokers — if you trade through a niche US stockbroker, it probably connects natively.

## Where TradeDiscipline wins

**The thesis is different.** Most traders don't fail for lack of backtesting — they fail because they don't follow the plan they already have. TradeDiscipline is built entirely around that problem:

- **Your mistakes, in euros.** The capital-leaks block crosses your behavior (revenge trading, FOMO entries, oversized positions after a loss, your worst hour) with your real P&L and tells you what each habit cost you — plus a counterfactual curve showing where your account would be if you had followed your plan.
- **A coach that remembers.** Every AI journal answers questions about your data. TradeDiscipline's coach keeps a longitudinal memory: it knows what you committed to last week and tells you when you broke it. That's what a real coach does.
- **Intervention, not autopsy.** Stop-trading guards, prop-firm challenge limits and tilt alerts act *while you trade* — not in a report you read after the damage.
- **A third of the price.** €9.99/month versus $29/month for the entry plan, with a genuinely useful free tier.

## Which one is for you?

Choose **TradeZella** if your priority is researching and validating strategies against historical data, or if you need a niche broker integration.

Choose **TradeDiscipline** if your strategy already works *when you follow it* — and your real problem is consistency, discipline and the expensive habits you repeat. That's the gap between backtest results and your live account, and it's exactly what we measure.

You can [try TradeDiscipline for free](/login) — no credit card, with demo data available so you can explore everything in two minutes.`,
      },
      fr: {
        title: "TradeDiscipline vs TradeZella : quel journal de trading choisir en 2026 ?",
        excerpt:
          "Comparatif honnête, fonctionnalité par fonctionnalité : où TradeZella est réellement plus fort, où TradeDiscipline gagne, et comment choisir selon ce qui te rend vraiment rentable.",
        body: `TradeZella est le journal de trading le plus connu du marché, et cette réputation est méritée. Alors pourquoi choisir TradeDiscipline ? Réponse courte : ça dépend de ce qui freine réellement ton trading. Voici un comparatif honnête — y compris les points où TradeZella est plus fort.

*Prix et fonctionnalités constatés en juillet 2026 sur les sites publics des deux produits.*

## Le comparatif express

| | TradeDiscipline | TradeZella |
|---|---|---|
| Prix (mensuel) | 9,99 € (Plus) / 19,99 € (Premium) | 29 $ (Basic) / 49 $ (Premium) |
| Analyse IA des trades | ✓ face à **ta** stratégie écrite | ✓ par trade, en continu |
| Coach IA avec mémoire longue durée | ✓ se souvient de tes engagements | — |
| Coût de tes erreurs en € | ✓ fuites de capital chiffrées par habitude | — |
| Courbe « et si j'avais respecté mon plan ? » | ✓ contrefactuel sur ton historique | — |
| Garde-fous temps réel (stop-trading, limites prop firm) | ✓ avant que tu cliques | — |
| Backtesting de marché (données historiques) | — | ✓ 11+ ans de données |
| Trade replay | — | ✓ tick par tick |
| Synchro broker | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | 500+ brokers |
| Langues | français, anglais, allemand, espagnol | anglais |
| Brief macro IA quotidien | ✓ (Premium) | — |

## Là où TradeZella est réellement plus fort

Soyons justes. Si tu passes tes soirées à **backtester des stratégies sur des données historiques**, TradeZella est fait pour ça : des années de données, du backtest en langage naturel, un replay tick par tick. TradeDiscipline ne fait pas de backtesting de marché. TradeZella se synchronise aussi avec beaucoup plus de brokers — si tu trades chez un courtier actions US confidentiel, il y a sûrement une intégration native.

## Là où TradeDiscipline gagne

**La thèse est différente.** La plupart des traders n'échouent pas par manque de backtesting — ils échouent parce qu'ils ne respectent pas le plan qu'ils ont déjà. TradeDiscipline est entièrement construit autour de ce problème :

- **Tes erreurs, en euros.** Le bloc fuites de capital croise ton comportement (revenge trading, entrées FOMO, taille gonflée après une perte, ta pire heure) avec ton P&L réel et te dit ce que chaque habitude t'a coûté — avec une courbe contrefactuelle qui montre où serait ton compte si tu avais respecté ton plan.
- **Un coach qui se souvient.** Tous les journaux IA répondent à des questions sur tes données. Le coach de TradeDiscipline garde une mémoire longitudinale : il sait ce que tu t'étais engagé à corriger la semaine dernière et te le dit quand tu récidives. C'est ça, un vrai coach.
- **De l'intervention, pas de l'autopsie.** Garde-fous stop-trading, limites de challenge prop firm et alertes tilt agissent *pendant* que tu trades — pas dans un rapport lu après les dégâts.
- **Trois fois moins cher.** 9,99 €/mois contre 29 $/mois pour le plan d'entrée, avec un plan gratuit réellement utile.

## Lequel est fait pour toi ?

Choisis **TradeZella** si ta priorité est de rechercher et valider des stratégies sur données historiques, ou s'il te faut une intégration broker exotique.

Choisis **TradeDiscipline** si ta stratégie fonctionne déjà *quand tu la respectes* — et que ton vrai problème, c'est la régularité, la discipline et les habitudes coûteuses que tu répètes. C'est l'écart entre tes résultats de backtest et ton compte réel, et c'est exactement ce qu'on mesure.

Tu peux [essayer TradeDiscipline gratuitement](/login) — sans carte bancaire, avec des données de démo pour tout explorer en deux minutes.`,
      },
      de: {
        title: "TradeDiscipline vs. TradeZella: Welches Trading-Journal 2026 wählen?",
        excerpt:
          "Ein ehrlicher Vergleich, Funktion für Funktion: wo TradeZella wirklich stärker ist, wo TradeDiscipline gewinnt — und wie du nach dem auswählst, was dich tatsächlich profitabel macht.",
        body: `TradeZella ist das bekannteste Trading-Journal am Markt — und dieser Ruf ist verdient. Warum also TradeDiscipline wählen? Kurze Antwort: Es hängt davon ab, was dein Trading wirklich bremst. Hier ein ehrlicher Vergleich — inklusive der Punkte, in denen TradeZella stärker ist.

*Preise und Funktionen: Stand Juli 2026, laut den öffentlichen Websites beider Produkte.*

## Der Schnellvergleich

| | TradeDiscipline | TradeZella |
|---|---|---|
| Preis (monatlich) | 9,99 € (Plus) / 19,99 € (Premium) | 29 $ (Basic) / 49 $ (Premium) |
| KI-Trade-Analyse | ✓ gegen **deine** schriftliche Strategie | ✓ pro Trade, always-on |
| KI-Coach mit Langzeitgedächtnis | ✓ erinnert sich an deine Vorsätze | — |
| Kosten deiner Fehler in € | ✓ Kapitallecks pro Gewohnheit beziffert | — |
| „Was wäre, wenn ich meinem Plan gefolgt wäre?" | ✓ kontrafaktische Equity-Kurve | — |
| Echtzeit-Schutzmechanismen (Stop-Trading, Prop-Firm-Limits) | ✓ bevor du klickst | — |
| Markt-Backtesting (historische Daten) | — | ✓ 11+ Jahre Daten |
| Trade Replay | — | ✓ Tick für Tick |
| Broker-Auto-Sync | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | 500+ Broker |
| Sprachen | Deutsch, Englisch, Französisch, Spanisch | Englisch |
| Tägliches KI-Makro-Briefing | ✓ (Premium) | — |

## Wo TradeZella wirklich stärker ist

Fair bleiben: Wenn du deine Abende mit **Backtesting von Strategien auf historischen Marktdaten** verbringst, ist TradeZella dafür gebaut — jahrelange Daten, Backtests in natürlicher Sprache, Tick-für-Tick-Replay. TradeDiscipline macht kein Markt-Backtesting. TradeZella verbindet sich außerdem mit deutlich mehr Brokern.

## Wo TradeDiscipline gewinnt

**Die These ist eine andere.** Die meisten Trader scheitern nicht an fehlendem Backtesting — sie scheitern daran, den Plan nicht zu befolgen, den sie längst haben. TradeDiscipline ist vollständig um dieses Problem herum gebaut:

- **Deine Fehler, in Euro.** Der Kapitalleck-Block kreuzt dein Verhalten (Revenge-Trading, FOMO-Einstiege, zu große Positionen nach einem Verlust, deine schlechteste Stunde) mit deinem echten P&L und beziffert, was dich jede Gewohnheit gekostet hat — samt kontrafaktischer Kurve, die zeigt, wo dein Konto stünde, wenn du deinem Plan gefolgt wärst.
- **Ein Coach, der sich erinnert.** Jedes KI-Journal beantwortet Fragen zu deinen Daten. Der Coach von TradeDiscipline führt ein Langzeitgedächtnis: Er weiß, was du dir letzte Woche vorgenommen hast, und sagt es dir, wenn du rückfällig wirst.
- **Intervention statt Autopsie.** Stop-Trading-Wächter, Prop-Firm-Limits und Tilt-Alarme greifen ein, *während* du tradest — nicht in einem Bericht nach dem Schaden.
- **Ein Drittel des Preises.** 9,99 €/Monat gegenüber 29 $/Monat für den Einstiegsplan, plus ein wirklich brauchbarer Gratis-Plan.

## Welches passt zu dir?

Wähle **TradeZella**, wenn deine Priorität das Erforschen und Validieren von Strategien auf historischen Daten ist oder du eine exotische Broker-Integration brauchst.

Wähle **TradeDiscipline**, wenn deine Strategie bereits funktioniert, *wenn du sie befolgst* — und dein echtes Problem Konstanz, Disziplin und teure Gewohnheiten sind. Genau diese Lücke messen wir.

Du kannst [TradeDiscipline kostenlos testen](/login) — ohne Kreditkarte, mit Demo-Daten, um alles in zwei Minuten zu erkunden.`,
      },
      es: {
        title: "TradeDiscipline vs TradeZella: ¿qué diario de trading elegir en 2026?",
        excerpt:
          "Comparativa honesta, función por función: dónde TradeZella es realmente más fuerte, dónde gana TradeDiscipline, y cómo elegir según lo que de verdad te hace rentable.",
        body: `TradeZella es el diario de trading más conocido del mercado, y esa reputación es merecida. Entonces, ¿por qué elegir TradeDiscipline? Respuesta corta: depende de lo que realmente frena tu trading. Aquí va una comparativa honesta — incluidos los puntos donde TradeZella es más fuerte.

*Precios y funciones observados en julio de 2026 en las webs públicas de ambos productos.*

## La comparativa rápida

| | TradeDiscipline | TradeZella |
|---|---|---|
| Precio (mensual) | 9,99 € (Plus) / 19,99 € (Premium) | 29 $ (Basic) / 49 $ (Premium) |
| Análisis IA de trades | ✓ contra **tu** estrategia escrita | ✓ por trade, siempre activo |
| Coach IA con memoria a largo plazo | ✓ recuerda tus compromisos | — |
| Coste de tus errores en € | ✓ fugas de capital cuantificadas por hábito | — |
| Curva «¿y si hubiera respetado mi plan?» | ✓ contrafactual sobre tu historial | — |
| Guardias en tiempo real (stop-trading, límites prop firm) | ✓ antes de que hagas clic | — |
| Backtesting de mercado (datos históricos) | — | ✓ 11+ años de datos |
| Trade replay | — | ✓ tick a tick |
| Sincronización broker | MT4/MT5, cTrader, NinjaTrader, Tradovate + CSV | 500+ brokers |
| Idiomas | español, inglés, francés, alemán | inglés |
| Brief macro IA diario | ✓ (Premium) | — |

## Donde TradeZella es realmente más fuerte

Seamos justos. Si pasas las tardes **backtesteando estrategias sobre datos históricos**, TradeZella está hecho para eso: años de datos, backtesting en lenguaje natural, replay tick a tick. TradeDiscipline no hace backtesting de mercado. TradeZella también se sincroniza con muchos más brokers.

## Donde gana TradeDiscipline

**La tesis es distinta.** La mayoría de los traders no fracasan por falta de backtesting — fracasan porque no siguen el plan que ya tienen. TradeDiscipline está construido enteramente alrededor de ese problema:

- **Tus errores, en euros.** El bloque de fugas de capital cruza tu comportamiento (revenge trading, entradas FOMO, tamaño inflado tras una pérdida, tu peor hora) con tu P&L real y te dice lo que te costó cada hábito — con una curva contrafactual que muestra dónde estaría tu cuenta si hubieras respetado tu plan.
- **Un coach que recuerda.** Todos los diarios con IA responden preguntas sobre tus datos. El coach de TradeDiscipline mantiene una memoria longitudinal: sabe lo que te comprometiste a corregir la semana pasada y te lo dice cuando reincides.
- **Intervención, no autopsia.** Guardias de stop-trading, límites de challenge prop firm y alertas de tilt actúan *mientras* operas — no en un informe leído después del daño.
- **Un tercio del precio.** 9,99 €/mes frente a 29 $/mes en el plan de entrada, con un plan gratuito realmente útil.

## ¿Cuál es para ti?

Elige **TradeZella** si tu prioridad es investigar y validar estrategias sobre datos históricos, o si necesitas una integración de broker exótica.

Elige **TradeDiscipline** si tu estrategia ya funciona *cuando la sigues* — y tu verdadero problema es la constancia, la disciplina y los hábitos caros que repites. Esa es la brecha entre tu backtest y tu cuenta real, y es exactamente lo que medimos.

Puedes [probar TradeDiscipline gratis](/login) — sin tarjeta, con datos de demostración para explorarlo todo en dos minutos.`,
      },
    },
  },
  {
    slug: "stop-revenge-trading",
    date: "2026-06-30",
    readingMinutes: 4,
    cover: "psychology",
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
  {
    slug: "prop-firm-discipline",
    date: "2026-06-29",
    readingMinutes: 5,
    cover: "prop",
    content: {
      en: {
        title: "Passing a prop firm challenge: it's a discipline test, not a profit test",
        excerpt:
          "Most traders blow prop challenges not because they can't trade, but because they break one rule under pressure. Here's how to treat it as the discipline exam it really is.",
        body: `Prop firms don't fail you for being unprofitable. They fail you for breaking a rule — usually the daily loss limit or the max drawdown — in a single emotional moment. The challenge isn't a profit test. It's a discipline test with a profit target attached.

## The two numbers that actually matter

Forget the profit target for a second. The two numbers that end challenges are the **daily loss limit** and the **maximum drawdown**. You can be up for three weeks and lose the account in one afternoon of revenge trading. Protect those two limits like your life depends on it, and the profit target tends to take care of itself.

## Trade like you have half the limit

A simple trick: mentally halve your daily loss limit. If the firm allows a 5% daily loss, treat 2.5% as your hard stop. That buffer is what keeps one bad trade from becoming a blown account, and it forces you to size positions sanely.

## Stop for the day on purpose, not on tilt

The traders who pass have a rule for when to *stop*, not just when to enter. After two losses, or after hitting your self-imposed daily limit, you're done — no exceptions. Walking away with the account intact is a win, not a failure.

## Track the rules, not just the P&L

Most journals only show profit and loss. To pass a challenge you need to see, in real time, how close you are to each limit. That's exactly what TradeDiscipline does: it tracks your daily loss, your drawdown and your distance to target live, and warns you before you cross a line — so the firm never has to.`,
      },
      fr: {
        title: "Réussir un challenge prop firm : un test de discipline, pas de profit",
        excerpt:
          "La plupart des traders échouent un challenge non parce qu'ils ne savent pas trader, mais parce qu'ils cassent une règle sous pression. Voici comment le traiter comme l'examen de discipline qu'il est.",
        body: `Les prop firms ne te recalent pas parce que tu n'es pas rentable. Elles te recalent parce que tu as cassé une règle — en général la perte journalière ou le drawdown max — dans un seul moment d'émotion. Le challenge n'est pas un test de profit. C'est un test de discipline, avec un objectif de gain en prime.

## Les deux chiffres qui comptent vraiment

Oublie l'objectif de profit une seconde. Les deux chiffres qui mettent fin à un challenge sont la **limite de perte journalière** et le **drawdown maximum**. Tu peux être en gain pendant trois semaines et cramer le compte en un après-midi de revenge trading. Protège ces deux limites comme ta vie en dépendait, et l'objectif de profit se règle souvent tout seul.

## Trade comme si ta limite était moitié moindre

Une astuce simple : divise mentalement ta limite de perte journalière par deux. Si la firme autorise 5 % de perte par jour, traite 2,5 % comme ton stop dur. Ce matelas, c'est ce qui empêche un mauvais trade de devenir un compte cramé, et ça te force à dimensionner tes positions sainement.

## Arrête-toi pour la journée volontairement, pas sur tilt

Les traders qui passent ont une règle pour s'**arrêter**, pas seulement pour entrer. Après deux pertes, ou après avoir atteint ta limite journalière auto-imposée, c'est fini — sans exception. Repartir avec le compte intact, c'est une victoire, pas un échec.

## Suis les règles, pas seulement le P&L

La plupart des journaux n'affichent que le profit et la perte. Pour passer un challenge, il faut voir en temps réel à quel point tu es proche de chaque limite. C'est exactement ce que fait TradeDiscipline : il suit ta perte du jour, ton drawdown et ta distance à l'objectif en direct, et t'alerte avant que tu ne franchisses une ligne — pour que la firme n'ait jamais à le faire.`,
      },
      de: {
        title: "Eine Prop-Firm-Challenge bestehen: ein Disziplin-Test, kein Profit-Test",
        excerpt:
          "Die meisten Trader scheitern an Challenges nicht, weil sie nicht traden können, sondern weil sie unter Druck eine Regel brechen. So behandelst du sie als die Disziplinprüfung, die sie ist.",
        body: `Prop-Firmen lassen dich nicht durchfallen, weil du unprofitabel bist. Sie lassen dich durchfallen, weil du eine Regel gebrochen hast — meist das tägliche Verlustlimit oder den maximalen Drawdown — in einem einzigen emotionalen Moment. Die Challenge ist kein Profit-Test. Sie ist ein Disziplin-Test mit einem angehängten Gewinnziel.

## Die zwei Zahlen, die wirklich zählen

Vergiss das Gewinnziel kurz. Die zwei Zahlen, die Challenges beenden, sind das **tägliche Verlustlimit** und der **maximale Drawdown**. Du kannst drei Wochen im Plus sein und das Konto an einem Nachmittag Revenge-Trading verlieren. Schütze diese zwei Limits, als hinge dein Leben davon ab — das Gewinnziel erledigt sich dann oft von selbst.

## Trade, als hättest du nur das halbe Limit

Ein einfacher Trick: halbiere im Kopf dein tägliches Verlustlimit. Erlaubt die Firma 5 % Tagesverlust, behandle 2,5 % als hartes Stopp. Dieser Puffer verhindert, dass ein schlechter Trade zum gesprengten Konto wird, und zwingt dich zu vernünftiger Positionsgröße.

## Hör bewusst für den Tag auf, nicht im Tilt

Trader, die bestehen, haben eine Regel zum **Aufhören**, nicht nur zum Einsteigen. Nach zwei Verlusten oder beim Erreichen deines selbst gesetzten Tageslimits ist Schluss — ausnahmslos. Mit intaktem Konto weggehen ist ein Sieg, kein Versagen.

## Verfolge die Regeln, nicht nur die G/V

Die meisten Journale zeigen nur Gewinn und Verlust. Um eine Challenge zu bestehen, musst du in Echtzeit sehen, wie nah du an jedem Limit bist. Genau das macht TradeDiscipline: es verfolgt deinen Tagesverlust, deinen Drawdown und deinen Abstand zum Ziel live und warnt dich, bevor du eine Linie überschreitest — damit die Firma es nie muss.`,
      },
      es: {
        title: "Pasar un challenge de prop firm: es una prueba de disciplina, no de beneficio",
        excerpt:
          "La mayoría de traders revientan challenges no porque no sepan operar, sino porque rompen una regla bajo presión. Así se trata como el examen de disciplina que realmente es.",
        body: `Las prop firms no te suspenden por no ser rentable. Te suspenden por romper una regla — normalmente el límite de pérdida diaria o el drawdown máximo — en un solo momento emocional. El challenge no es una prueba de beneficio. Es una prueba de disciplina, con un objetivo de ganancia añadido.

## Los dos números que de verdad importan

Olvida el objetivo de beneficio un momento. Los dos números que terminan los challenges son el **límite de pérdida diaria** y el **drawdown máximo**. Puedes ir en positivo tres semanas y reventar la cuenta en una tarde de revenge trading. Protege esos dos límites como si tu vida dependiera de ello, y el objetivo de beneficio suele resolverse solo.

## Opera como si tu límite fuera la mitad

Un truco simple: divide mentalmente entre dos tu límite de pérdida diaria. Si la firma permite un 5 % de pérdida diaria, trata el 2,5 % como tu stop duro. Ese colchón es lo que evita que un mal trade se convierta en una cuenta reventada, y te obliga a dimensionar posiciones con sensatez.

## Para por hoy a propósito, no en tilt

Los traders que pasan tienen una regla para **parar**, no solo para entrar. Tras dos pérdidas, o al alcanzar tu límite diario autoimpuesto, has terminado — sin excepciones. Irte con la cuenta intacta es una victoria, no un fracaso.

## Sigue las reglas, no solo el P&L

La mayoría de diarios solo muestran beneficio y pérdida. Para pasar un challenge necesitas ver en tiempo real cuán cerca estás de cada límite. Eso es justo lo que hace TradeDiscipline: sigue tu pérdida del día, tu drawdown y tu distancia al objetivo en directo, y te avisa antes de cruzar una línea — para que la firma nunca tenga que hacerlo.`,
      },
    },
  },
  {
    slug: "trading-journal-guide",
    date: "2026-06-28",
    readingMinutes: 5,
    cover: "journal",
    content: {
      en: {
        title: "How to keep a trading journal that actually changes your behaviour",
        excerpt:
          "A list of entries and exits won't make you a better trader. A journal that captures why you traded — and confronts you with it — will.",
        body: `Most trading journals are graveyards of numbers: entry, exit, P&L. They feel productive but change nothing, because the problem was never the numbers — it was the decision behind them. A journal that works captures the *decision*, not just the result.

## Log the why, not just the what

For every trade, write one line: what was the setup, and what did you feel? "Saw the level, waited, took it — calm" is a different trade from "missed the move, jumped in late — FOMO", even if both are green. Over a month, the patterns become impossible to ignore.

## Score your discipline, separate from your P&L

A winning trade can be a bad trade (you broke your rules and got lucky). A losing trade can be a good trade (you followed your plan, the market didn't cooperate). Rate every session on *process*, not outcome. This is the single shift that turns a journal into a coach.

## Review weekly, not just daily

Daily review catches mistakes; weekly review catches *patterns*. Once a week, ask: which day, pair or hour costs me money? When do I break my rules? Most traders discover they're profitable in one window and give it all back in another.

## Make it frictionless

The best journal is the one you actually fill in. If logging a trade takes five minutes, you'll stop. Keep it to a few taps — pair, emotion, did-I-follow-my-plan — and let the analysis happen automatically. That's how TradeDiscipline is built: quick logging, automatic discipline scoring, and weekly patterns surfaced for you.`,
      },
      fr: {
        title: "Tenir un journal de trading qui change vraiment ton comportement",
        excerpt:
          "Une liste d'entrées et de sorties ne fera pas de toi un meilleur trader. Un journal qui capture pourquoi tu as tradé — et te le met sous le nez — oui.",
        body: `La plupart des journaux de trading sont des cimetières de chiffres : entrée, sortie, P&L. Ça donne l'impression d'être productif mais ça ne change rien, parce que le problème n'a jamais été les chiffres — c'était la décision derrière. Un journal qui marche capture la *décision*, pas seulement le résultat.

## Note le pourquoi, pas juste le quoi

Pour chaque trade, écris une ligne : quel était le setup, et qu'as-tu ressenti ? « J'ai vu le niveau, attendu, pris — calme » est un trade différent de « j'ai loupé le move, sauté en retard — FOMO », même si les deux sont verts. Sur un mois, les patterns deviennent impossibles à ignorer.

## Note ta discipline, séparément du P&L

Un trade gagnant peut être un mauvais trade (tu as cassé tes règles et eu de la chance). Un trade perdant peut être un bon trade (tu as suivi ton plan, le marché n'a pas coopéré). Évalue chaque session sur le *process*, pas le résultat. C'est LE basculement qui transforme un journal en coach.

## Fais un bilan hebdo, pas seulement quotidien

Le bilan quotidien attrape les erreurs ; le bilan hebdo attrape les *patterns*. Une fois par semaine, demande-toi : quel jour, quelle paire ou quelle heure me coûte de l'argent ? Quand est-ce que je casse mes règles ? La plupart des traders découvrent qu'ils sont rentables sur une plage et rendent tout sur une autre.

## Rends-le sans friction

Le meilleur journal est celui que tu remplis vraiment. Si noter un trade prend cinq minutes, tu arrêteras. Réduis ça à quelques clics — paire, émotion, ai-je suivi mon plan — et laisse l'analyse se faire toute seule. C'est ainsi qu'est conçu TradeDiscipline : saisie rapide, score de discipline automatique, et patterns hebdo remontés pour toi.`,
      },
      de: {
        title: "Ein Trading-Journal führen, das dein Verhalten wirklich ändert",
        excerpt:
          "Eine Liste von Ein- und Ausstiegen macht dich nicht zum besseren Trader. Ein Journal, das festhält, warum du getradet hast — und dich damit konfrontiert — schon.",
        body: `Die meisten Trading-Journale sind Friedhöfe aus Zahlen: Einstieg, Ausstieg, G/V. Es fühlt sich produktiv an, ändert aber nichts, denn das Problem waren nie die Zahlen — sondern die Entscheidung dahinter. Ein Journal, das funktioniert, hält die *Entscheidung* fest, nicht nur das Ergebnis.

## Notiere das Warum, nicht nur das Was

Schreibe zu jedem Trade eine Zeile: Was war das Setup, und was hast du gefühlt? „Level gesehen, gewartet, genommen — ruhig" ist ein anderer Trade als „Bewegung verpasst, spät rein — FOMO", auch wenn beide grün sind. Über einen Monat werden die Muster unübersehbar.

## Bewerte deine Disziplin, getrennt von der G/V

Ein Gewinn-Trade kann ein schlechter Trade sein (du hast deine Regeln gebrochen und Glück gehabt). Ein Verlust-Trade kann ein guter Trade sein (du hast deinen Plan befolgt, der Markt nicht). Bewerte jede Session nach dem *Prozess*, nicht dem Ergebnis. Das ist die eine Veränderung, die ein Journal zum Coach macht.

## Mach wöchentlich Bilanz, nicht nur täglich

Die tägliche Bilanz fängt Fehler; die wöchentliche fängt *Muster*. Frag dich einmal pro Woche: Welcher Tag, welches Paar, welche Stunde kostet mich Geld? Wann breche ich meine Regeln? Die meisten Trader entdecken, dass sie in einem Fenster profitabel sind und alles in einem anderen zurückgeben.

## Mach es reibungslos

Das beste Journal ist das, das du tatsächlich ausfüllst. Wenn das Erfassen eines Trades fünf Minuten dauert, hörst du auf. Beschränke es auf ein paar Taps — Paar, Emotion, Plan befolgt — und lass die Analyse automatisch laufen. Genau so ist TradeDiscipline gebaut: schnelles Erfassen, automatischer Disziplin-Score und wöchentliche Muster, die für dich sichtbar werden.`,
      },
      es: {
        title: "Cómo llevar un diario de trading que de verdad cambie tu comportamiento",
        excerpt:
          "Una lista de entradas y salidas no te hará mejor trader. Un diario que capture por qué operaste — y te lo ponga delante — sí.",
        body: `La mayoría de diarios de trading son cementerios de números: entrada, salida, P&L. Parece productivo pero no cambia nada, porque el problema nunca fueron los números — fue la decisión detrás. Un diario que funciona captura la *decisión*, no solo el resultado.

## Anota el porqué, no solo el qué

Para cada trade, escribe una línea: cuál era el setup y qué sentiste. "Vi el nivel, esperé, lo tomé — en calma" es un trade distinto de "me perdí el movimiento, entré tarde — FOMO", aunque ambos sean verdes. En un mes, los patrones se vuelven imposibles de ignorar.

## Puntúa tu disciplina, aparte del P&L

Un trade ganador puede ser un mal trade (rompiste tus reglas y tuviste suerte). Un trade perdedor puede ser un buen trade (seguiste tu plan, el mercado no cooperó). Evalúa cada sesión por el *proceso*, no por el resultado. Ese es el cambio que convierte un diario en un coach.

## Revisa cada semana, no solo cada día

La revisión diaria caza errores; la semanal caza *patrones*. Una vez por semana, pregúntate: ¿qué día, par u hora me cuesta dinero? ¿Cuándo rompo mis reglas? La mayoría de traders descubren que son rentables en una franja y lo devuelven todo en otra.

## Hazlo sin fricción

El mejor diario es el que de verdad rellenas. Si registrar un trade lleva cinco minutos, lo dejarás. Redúcelo a unos toques — par, emoción, ¿seguí mi plan? — y deja que el análisis ocurra solo. Así está hecho TradeDiscipline: registro rápido, puntuación de disciplina automática y patrones semanales mostrados para ti.`,
      },
    },
  },
  {
    slug: "beat-fomo-trading",
    date: "2026-06-27",
    readingMinutes: 4,
    cover: "psychology",
    content: {
      en: {
        title: "Beating FOMO: how to stop chasing the move",
        excerpt: "FOMO makes you buy the top and sell the bottom. Here's how to trade the setup instead of the feeling.",
        body: `FOMO — the fear of missing out — is the reason you jump into a move that already ran, right before it reverses. It feels like opportunity; it's usually the end of one.

## Why chasing loses

By the time a move is obvious enough to trigger FOMO, the good entry is gone. You're buying from the disciplined traders who entered earlier and are now taking profit. You get the worst price and the tightest stop.

## Three rules that kill FOMO

1. **If you missed it, you missed it.** There's always another setup. The market is not a train leaving forever.
2. **Only trade your plan.** If the entry doesn't match your written rules, it isn't your trade — it's someone else's, and you're late.
3. **Wait for the pullback.** Strong moves retrace. Let price come to your level instead of chasing it.

A journal that logs your *emotion* on each entry makes FOMO impossible to hide: over a month you'll see exactly how much those chased trades cost you. That's what TradeDiscipline surfaces automatically.`,
      },
      fr: {
        title: "Vaincre le FOMO : arrête de courir après le mouvement",
        excerpt: "Le FOMO te fait acheter le haut et vendre le bas. Voici comment trader le setup plutôt que l'émotion.",
        body: `Le FOMO — la peur de rater — c'est la raison pour laquelle tu sautes dans un mouvement déjà parti, juste avant qu'il ne se retourne. Ça ressemble à une opportunité ; c'est souvent la fin d'une.

## Pourquoi courir après fait perdre

Quand un mouvement est assez évident pour déclencher le FOMO, la bonne entrée est déjà passée. Tu achètes aux traders disciplinés entrés plus tôt et qui prennent maintenant leurs profits. Tu obtiens le pire prix et le stop le plus serré.

## Trois règles qui tuent le FOMO

1. **Si tu l'as raté, tu l'as raté.** Il y a toujours un autre setup. Le marché n'est pas un train qui part pour toujours.
2. **Ne trade que ton plan.** Si l'entrée ne colle pas à tes règles écrites, ce n'est pas ton trade — c'est celui d'un autre, et tu es en retard.
3. **Attends le pullback.** Les mouvements forts retracent. Laisse le prix venir à ton niveau au lieu de lui courir après.

Un journal qui note ton *émotion* à chaque entrée rend le FOMO impossible à cacher : en un mois, tu verras exactement combien ces trades te coûtent. C'est ce que TradeDiscipline fait ressortir automatiquement.`,
      },
      de: {
        title: "FOMO besiegen: hör auf, der Bewegung hinterherzujagen",
        excerpt: "FOMO lässt dich das Hoch kaufen und das Tief verkaufen. So tradest du das Setup statt das Gefühl.",
        body: `FOMO — die Angst, etwas zu verpassen — ist der Grund, warum du in eine bereits gelaufene Bewegung springst, kurz bevor sie dreht. Es fühlt sich nach Chance an; meist ist es das Ende einer.

## Warum Hinterherjagen verliert

Wenn eine Bewegung offensichtlich genug für FOMO ist, ist der gute Einstieg vorbei. Du kaufst von den disziplinierten Tradern, die früher eingestiegen sind und jetzt Gewinne mitnehmen. Du bekommst den schlechtesten Preis und den engsten Stop.

## Drei Regeln gegen FOMO

1. **Verpasst ist verpasst.** Es gibt immer ein nächstes Setup. Der Markt ist kein Zug, der für immer abfährt.
2. **Trade nur deinen Plan.** Passt der Einstieg nicht zu deinen Regeln, ist es nicht dein Trade — und du bist zu spät.
3. **Warte auf den Pullback.** Starke Bewegungen retracen. Lass den Preis zu deinem Level kommen.

Ein Journal, das deine *Emotion* bei jedem Einstieg festhält, macht FOMO unübersehbar: In einem Monat siehst du genau, was diese Trades kosten. Genau das zeigt TradeDiscipline automatisch.`,
      },
      es: {
        title: "Vencer el FOMO: deja de perseguir el movimiento",
        excerpt: "El FOMO te hace comprar el techo y vender el suelo. Así operas el setup en vez de la emoción.",
        body: `El FOMO —el miedo a quedarte fuera— es la razón por la que saltas a un movimiento que ya corrió, justo antes de que se gire. Parece una oportunidad; suele ser el final de una.

## Por qué perseguir hace perder

Cuando un movimiento es lo bastante obvio para disparar el FOMO, la buena entrada ya pasó. Le compras a los traders disciplinados que entraron antes y ahora toman beneficio. Consigues el peor precio y el stop más ajustado.

## Tres reglas que matan el FOMO

1. **Si lo perdiste, lo perdiste.** Siempre hay otro setup. El mercado no es un tren que se va para siempre.
2. **Opera solo tu plan.** Si la entrada no encaja con tus reglas escritas, no es tu trade — es de otro, y llegas tarde.
3. **Espera el pullback.** Los movimientos fuertes retroceden. Deja que el precio venga a tu nivel.

Un diario que registra tu *emoción* en cada entrada hace imposible ocultar el FOMO: en un mes verás cuánto te cuestan esos trades. Eso es lo que TradeDiscipline muestra automáticamente.`,
      },
    },
  },
  {
    slug: "stop-overtrading",
    date: "2026-06-26",
    readingMinutes: 4,
    cover: "routine",
    content: {
      en: {
        title: "How to stop overtrading",
        excerpt: "More trades rarely means more money. Overtrading is boredom and revenge in disguise — here's how to cap it.",
        body: `Overtrading is taking positions that aren't in your plan — out of boredom, impatience, or the urge to make back a loss. Each extra trade adds cost and risk without adding edge.

## The signs

You're overtrading when you take setups you'd normally skip, when you can't sit through a quiet market, or when your trade count spikes on red days. The market didn't offer more opportunities — you lowered your standards.

## The fix: a hard trade cap

Decide your maximum number of trades *before* the session, based on your data. Three quality setups beat ten mediocre ones. When you hit the cap, you're done — screen off. A rule you set in calm beats a decision made in the heat of the moment.

Tracking your trades-per-day next to your win rate usually reveals the truth: most traders are profitable on their first few trades and give it back on the extras. TradeDiscipline flags that pattern and can lock you out once you hit your daily limit.`,
      },
      fr: {
        title: "Comment arrêter le surtrading",
        excerpt: "Plus de trades ne veut presque jamais dire plus d'argent. Le surtrading, c'est de l'ennui et de la revanche déguisés.",
        body: `Le surtrading, c'est prendre des positions hors de ton plan — par ennui, impatience, ou l'envie de te refaire. Chaque trade en trop ajoute du coût et du risque sans ajouter d'edge.

## Les signes

Tu surtrades quand tu prends des setups que tu sauterais normalement, quand tu ne supportes pas un marché calme, ou quand ton nombre de trades explose les jours rouges. Le marché n'a pas offert plus d'opportunités — tu as baissé tes standards.

## La solution : une limite stricte

Décide ton nombre max de trades *avant* la séance, à partir de tes données. Trois bons setups battent dix médiocres. Une fois la limite atteinte, c'est fini — écran éteint. Une règle posée au calme bat une décision prise dans le feu de l'action.

Suivre ton nombre de trades par jour à côté de ton taux de réussite révèle souvent la vérité : la plupart des traders sont rentables sur leurs premiers trades et rendent tout sur les suivants. TradeDiscipline repère ce pattern et peut te bloquer une fois ta limite atteinte.`,
      },
      de: {
        title: "Wie du Overtrading stoppst",
        excerpt: "Mehr Trades bedeuten selten mehr Geld. Overtrading ist getarnte Langeweile und Rache.",
        body: `Overtrading heißt, Positionen einzugehen, die nicht in deinem Plan stehen — aus Langeweile, Ungeduld oder dem Drang, einen Verlust zurückzuholen. Jeder zusätzliche Trade bringt Kosten und Risiko ohne Edge.

## Die Anzeichen

Du übertradest, wenn du Setups nimmst, die du sonst auslässt, wenn du einen ruhigen Markt nicht aushältst, oder wenn deine Trade-Zahl an roten Tagen hochschnellt. Der Markt bot nicht mehr Chancen — du hast deine Standards gesenkt.

## Die Lösung: ein hartes Trade-Limit

Lege deine maximale Trade-Zahl *vor* der Session fest, basierend auf deinen Daten. Drei gute Setups schlagen zehn mittelmäßige. Am Limit ist Schluss — Bildschirm aus. Eine in Ruhe gesetzte Regel schlägt eine Entscheidung in der Hitze des Moments.

Deine Trades pro Tag neben der Trefferquote zu verfolgen zeigt oft die Wahrheit: Die meisten Trader sind bei den ersten Trades profitabel und geben es bei den zusätzlichen zurück. TradeDiscipline erkennt das Muster und kann dich am Tageslimit sperren.`,
      },
      es: {
        title: "Cómo dejar de sobreoperar",
        excerpt: "Más trades casi nunca es más dinero. Sobreoperar es aburrimiento y revancha disfrazados.",
        body: `Sobreoperar es tomar posiciones fuera de tu plan — por aburrimiento, impaciencia o las ganas de recuperar una pérdida. Cada trade extra añade coste y riesgo sin añadir edge.

## Las señales

Sobreoperas cuando tomas setups que normalmente saltarías, cuando no aguantas un mercado tranquilo, o cuando tu número de trades se dispara en días rojos. El mercado no ofreció más oportunidades — bajaste tus estándares.

## La solución: un límite estricto

Decide tu número máximo de trades *antes* de la sesión, según tus datos. Tres setups buenos ganan a diez mediocres. Al llegar al límite, terminaste — pantalla apagada. Una regla puesta en calma gana a una decisión en el calor del momento.

Seguir tus trades por día junto a tu winrate suele revelar la verdad: la mayoría son rentables en sus primeros trades y lo devuelven en los extras. TradeDiscipline detecta ese patrón y puede bloquearte al llegar a tu límite diario.`,
      },
    },
  },
  {
    slug: "risk-management-1-percent",
    date: "2026-06-25",
    readingMinutes: 5,
    cover: "risk",
    content: {
      en: {
        title: "Position sizing and the 1% rule",
        excerpt: "The single habit that keeps traders alive: risk a small, fixed fraction of your account per trade.",
        body: `Most accounts don't blow up because of bad analysis. They blow up because of one oversized trade. Position sizing is the fix, and it's the most important skill in trading.

## The 1% rule

Risk no more than 1% of your account on any single trade. On a €10,000 account, that's €100 of risk. Your position size is then derived from your stop distance — not the other way around.

## How to size a trade

1. Decide your entry and your stop loss.
2. Your risk in € = 1% of the account.
3. Position size = risk ÷ (distance to stop). A wider stop means a smaller position, same €100 risk.

This flips the usual mistake: instead of picking a lot size and hoping, you fix the loss first. A losing streak of ten trades costs you ~10%, survivable. At 5% per trade, the same streak is catastrophic.

A position-size calculator that starts from your account and stop takes the emotion out — it's built into TradeDiscipline's pre-trade flow.`,
      },
      fr: {
        title: "Le sizing de position et la règle des 1 %",
        excerpt: "La seule habitude qui garde les traders en vie : risquer une petite fraction fixe du compte par trade.",
        body: `La plupart des comptes ne sautent pas à cause d'une mauvaise analyse. Ils sautent à cause d'un seul trade surdimensionné. Le sizing de position est la solution, et c'est la compétence la plus importante du trading.

## La règle des 1 %

Ne risque jamais plus de 1 % de ton compte sur un seul trade. Sur un compte de 10 000 €, ça fait 100 € de risque. La taille de ta position se déduit ensuite de la distance à ton stop — pas l'inverse.

## Comment dimensionner un trade

1. Décide ton entrée et ton stop loss.
2. Ton risque en € = 1 % du compte.
3. Taille de position = risque ÷ (distance au stop). Un stop plus large = une position plus petite, même 100 € de risque.

Ça inverse l'erreur classique : au lieu de choisir un lot et d'espérer, tu fixes la perte d'abord. Une série de dix trades perdants te coûte ~10 %, survivable. À 5 % par trade, la même série est catastrophique.

Un calculateur de position qui part de ton compte et de ton stop enlève l'émotion — il est intégré au parcours pré-trade de TradeDiscipline.`,
      },
      de: {
        title: "Positionsgröße und die 1-%-Regel",
        excerpt: "Die eine Gewohnheit, die Trader am Leben hält: pro Trade nur einen kleinen, festen Bruchteil des Kontos riskieren.",
        body: `Die meisten Konten platzen nicht wegen schlechter Analyse. Sie platzen wegen eines einzigen zu großen Trades. Positionsgröße ist die Lösung — die wichtigste Fähigkeit im Trading.

## Die 1-%-Regel

Riskiere pro Trade höchstens 1 % deines Kontos. Bei 10.000 € sind das 100 € Risiko. Deine Positionsgröße ergibt sich dann aus deinem Stop-Abstand — nicht umgekehrt.

## So dimensionierst du einen Trade

1. Lege Einstieg und Stop-Loss fest.
2. Dein Risiko in € = 1 % des Kontos.
3. Positionsgröße = Risiko ÷ (Abstand zum Stop). Ein weiterer Stop = kleinere Position, gleiche 100 € Risiko.

Das dreht den üblichen Fehler um: Statt eine Lotgröße zu wählen und zu hoffen, legst du zuerst den Verlust fest. Eine Serie von zehn Verlusten kostet ~10 %, überlebbar. Bei 5 % pro Trade ist dieselbe Serie katastrophal.

Ein Positionsrechner, der von Konto und Stop ausgeht, nimmt die Emotion raus — er ist in den Pre-Trade-Ablauf von TradeDiscipline integriert.`,
      },
      es: {
        title: "El tamaño de posición y la regla del 1 %",
        excerpt: "El único hábito que mantiene vivos a los traders: arriesgar una fracción pequeña y fija de la cuenta por trade.",
        body: `La mayoría de cuentas no revientan por mal análisis. Revientan por un solo trade sobredimensionado. El tamaño de posición es la solución, y es la habilidad más importante del trading.

## La regla del 1 %

No arriesgues más del 1 % de tu cuenta en un solo trade. En una cuenta de 10.000 €, son 100 € de riesgo. Tu tamaño de posición se deriva luego de la distancia a tu stop — no al revés.

## Cómo dimensionar un trade

1. Decide tu entrada y tu stop loss.
2. Tu riesgo en € = 1 % de la cuenta.
3. Tamaño = riesgo ÷ (distancia al stop). Un stop más amplio = una posición más pequeña, mismos 100 € de riesgo.

Esto invierte el error habitual: en vez de elegir un lote y esperar, fijas la pérdida primero. Una racha de diez perdedores te cuesta ~10 %, sobrevivible. Al 5 % por trade, la misma racha es catastrófica.

Una calculadora de posición que parte de tu cuenta y tu stop quita la emoción — está integrada en el flujo previo al trade de TradeDiscipline.`,
      },
    },
  },
  {
    slug: "daily-loss-limit",
    date: "2026-06-24",
    readingMinutes: 4,
    cover: "discipline",
    content: {
      en: {
        title: "Why a daily loss limit saves accounts",
        excerpt: "One bad day can undo a month of good ones. A daily loss limit is the circuit breaker that stops the spiral.",
        body: `Every blown account has the same story: a normal red day that turned into a disaster because the trader kept going. A daily loss limit is the rule that ends the day before it ends you.

## Set the number before you trade

Decide, in the calm of the morning, the maximum you're willing to lose today — for example 3% of the account, or two losing trades. Write it down. When you hit it, you stop. No "one more trade to get it back."

## Why it works

A loss triggers the urge to trade bigger and faster, exactly when your judgment is worst. The limit removes the decision at the moment you're least able to make it well. You'll have bad days — the limit makes sure they stay small.

TradeDiscipline tracks your live daily loss against your limit and can put you into a "stop trading" state when you cross it, so the rule enforces itself instead of relying on willpower.`,
      },
      fr: {
        title: "Pourquoi une limite de perte journalière sauve les comptes",
        excerpt: "Une mauvaise journée peut annuler un mois de bonnes. La limite de perte journalière, c'est le coupe-circuit qui stoppe la spirale.",
        body: `Chaque compte cramé a la même histoire : une journée rouge normale devenue désastre parce que le trader a continué. Une limite de perte journalière, c'est la règle qui met fin à la journée avant qu'elle ne te mette fin.

## Fixe le chiffre avant de trader

Décide, au calme le matin, le maximum que tu es prêt à perdre aujourd'hui — par exemple 3 % du compte, ou deux trades perdants. Note-le. Une fois atteint, tu arrêtes. Pas de « encore un trade pour me refaire ».

## Pourquoi ça marche

Une perte déclenche l'envie de trader plus gros et plus vite, exactement quand ton jugement est au plus bas. La limite retire la décision au moment où tu es le moins capable de bien la prendre. Tu auras de mauvais jours — la limite les garde petits.

TradeDiscipline suit ta perte du jour en direct face à ta limite et peut te passer en mode « stop trading » quand tu la franchis, pour que la règle s'applique d'elle-même au lieu de reposer sur ta volonté.`,
      },
      de: {
        title: "Warum ein tägliches Verlustlimit Konten rettet",
        excerpt: "Ein schlechter Tag kann einen Monat guter Tage zunichtemachen. Das Tageslimit ist der Schutzschalter gegen die Spirale.",
        body: `Jedes gesprengte Konto hat dieselbe Geschichte: ein normaler roter Tag, der zur Katastrophe wurde, weil der Trader weitermachte. Ein tägliches Verlustlimit ist die Regel, die den Tag beendet, bevor er dich beendet.

## Lege die Zahl vor dem Traden fest

Entscheide morgens in Ruhe das Maximum, das du heute zu verlieren bereit bist — z. B. 3 % des Kontos oder zwei Verlust-Trades. Schreib es auf. Am Limit hörst du auf. Kein „noch ein Trade, um es zurückzuholen".

## Warum es funktioniert

Ein Verlust weckt den Drang, größer und schneller zu traden — genau dann, wenn dein Urteil am schlechtesten ist. Das Limit nimmt dir die Entscheidung ab, wenn du sie am wenigsten gut treffen kannst. Du wirst schlechte Tage haben — das Limit hält sie klein.

TradeDiscipline verfolgt deinen Tagesverlust live gegen dein Limit und kann dich in einen „Stopp"-Zustand versetzen, wenn du es überschreitest — die Regel setzt sich selbst durch.`,
      },
      es: {
        title: "Por qué un límite de pérdida diaria salva cuentas",
        excerpt: "Un mal día puede deshacer un mes de buenos. El límite de pérdida diaria es el cortacircuitos que detiene la espiral.",
        body: `Toda cuenta reventada tiene la misma historia: un día rojo normal que se volvió desastre porque el trader siguió. Un límite de pérdida diaria es la regla que termina el día antes de que el día te termine a ti.

## Fija el número antes de operar

Decide, en la calma de la mañana, el máximo que estás dispuesto a perder hoy — por ejemplo 3 % de la cuenta, o dos trades perdedores. Anótalo. Al alcanzarlo, paras. Nada de "un trade más para recuperar".

## Por qué funciona

Una pérdida dispara las ganas de operar más grande y más rápido, justo cuando tu juicio está peor. El límite quita la decisión en el momento en que menos puedes tomarla bien. Tendrás días malos — el límite los mantiene pequeños.

TradeDiscipline sigue tu pérdida del día en vivo frente a tu límite y puede ponerte en modo "stop trading" al cruzarlo, para que la regla se aplique sola en vez de depender de tu voluntad.`,
      },
    },
  },
  {
    slug: "trading-plan-you-follow",
    date: "2026-06-23",
    readingMinutes: 4,
    cover: "journal",
    content: {
      en: {
        title: "Build a trading plan you'll actually follow",
        excerpt: "A plan you ignore is worse than none. Make it short, specific and impossible to misread in the moment.",
        body: `Most trading plans fail not because they're wrong, but because they're vague. "Trade with the trend" isn't a plan — it's a wish. A real plan tells you exactly what to do when price is in front of you.

## Make every rule testable

Each rule should be answerable with yes or no in two seconds: "Is price at my level?", "Is the session London or NY?", "Is my risk ≤ 1%?" If a rule needs interpretation, you'll bend it under pressure.

## Keep it to one page

Entry conditions, risk per trade, max trades per day, daily loss limit, and when to stop. That's it. A plan you can't recite isn't a plan you'll follow.

## Confront yourself with it before every trade

The plan only works if you read it at the moment of decision. A pre-trade checklist that forces you to confirm each rule — the way TradeDiscipline does — turns the plan from a document into a habit.`,
      },
      fr: {
        title: "Construis un plan de trading que tu suivras vraiment",
        excerpt: "Un plan que tu ignores est pire que pas de plan. Fais-le court, précis et impossible à mal lire dans l'instant.",
        body: `La plupart des plans de trading échouent non parce qu'ils sont faux, mais parce qu'ils sont vagues. « Trader dans le sens de la tendance » n'est pas un plan — c'est un souhait. Un vrai plan te dit exactement quoi faire quand le prix est devant toi.

## Rends chaque règle vérifiable

Chaque règle doit se répondre par oui ou non en deux secondes : « Le prix est-il à mon niveau ? », « La séance est-elle Londres ou NY ? », « Mon risque est-il ≤ 1 % ? » Si une règle demande de l'interprétation, tu la tordras sous pression.

## Tiens sur une page

Conditions d'entrée, risque par trade, nombre max de trades par jour, limite de perte journalière, et quand s'arrêter. C'est tout. Un plan que tu ne peux pas réciter n'est pas un plan que tu suivras.

## Confronte-toi à lui avant chaque trade

Le plan ne marche que si tu le lis au moment de la décision. Une checklist pré-trade qui t'oblige à confirmer chaque règle — comme le fait TradeDiscipline — transforme le plan d'un document en une habitude.`,
      },
      de: {
        title: "Baue einen Trading-Plan, den du wirklich befolgst",
        excerpt: "Ein Plan, den du ignorierst, ist schlimmer als keiner. Mach ihn kurz, konkret und im Moment unmissverständlich.",
        body: `Die meisten Trading-Pläne scheitern nicht, weil sie falsch sind, sondern weil sie vage sind. „Mit dem Trend traden" ist kein Plan — es ist ein Wunsch. Ein echter Plan sagt dir genau, was zu tun ist, wenn der Preis vor dir ist.

## Mach jede Regel prüfbar

Jede Regel muss in zwei Sekunden mit Ja oder Nein beantwortbar sein: „Ist der Preis an meinem Level?", „Ist die Session London oder NY?", „Ist mein Risiko ≤ 1 %?" Braucht eine Regel Interpretation, biegst du sie unter Druck.

## Halte es auf einer Seite

Einstiegsbedingungen, Risiko pro Trade, max. Trades pro Tag, Tagesverlustlimit und wann Schluss ist. Das war's. Einen Plan, den du nicht aufsagen kannst, befolgst du nicht.

## Konfrontiere dich vor jedem Trade damit

Der Plan wirkt nur, wenn du ihn im Entscheidungsmoment liest. Eine Pre-Trade-Checkliste, die dich jede Regel bestätigen lässt — wie TradeDiscipline — macht aus dem Plan eine Gewohnheit.`,
      },
      es: {
        title: "Crea un plan de trading que de verdad sigas",
        excerpt: "Un plan que ignoras es peor que ninguno. Hazlo corto, específico e imposible de malinterpretar en el momento.",
        body: `La mayoría de planes de trading fallan no por estar equivocados, sino por ser vagos. "Operar con la tendencia" no es un plan — es un deseo. Un plan real te dice exactamente qué hacer cuando el precio está delante de ti.

## Haz cada regla verificable

Cada regla debe responderse con sí o no en dos segundos: "¿Está el precio en mi nivel?", "¿La sesión es Londres o NY?", "¿Mi riesgo es ≤ 1 %?" Si una regla necesita interpretación, la torcerás bajo presión.

## Que quepa en una página

Condiciones de entrada, riesgo por trade, máximo de trades al día, límite de pérdida diaria y cuándo parar. Eso es todo. Un plan que no puedes recitar no es un plan que seguirás.

## Confróntate con él antes de cada trade

El plan solo funciona si lo lees en el momento de decidir. Una checklist previa que te obliga a confirmar cada regla — como hace TradeDiscipline — convierte el plan de documento en hábito.`,
      },
    },
  },
  {
    slug: "surviving-losing-streaks",
    date: "2026-06-22",
    readingMinutes: 4,
    cover: "streak",
    content: {
      en: {
        title: "The psychology of surviving a losing streak",
        excerpt: "Losing streaks are normal and inevitable. Whether they end your account depends entirely on how you behave during them.",
        body: `Even a solid edge produces losing streaks. With a 50% win rate, a run of five or six losses is statistically routine. The danger isn't the streak — it's what it does to your behaviour.

## What a streak does to you

After several losses you start to doubt your system, size up to "catch up", or abandon your rules entirely. This is exactly backwards: a streak is when discipline matters most, not least.

## How to ride it out

1. **Cut size, not corners.** If anything, trade smaller until confidence returns. Never bigger.
2. **Judge process, not outcome.** If you followed your plan, it was a good trade even if it lost. Score that separately from P&L.
3. **Zoom out.** Ten trades is noise. Look at 50–100 to see whether your edge is actually broken or just variance.

Tracking a discipline score independent of profit lets you see that you're still doing the right things during a drawdown — the reassurance that keeps you from blowing up. That separation is core to how TradeDiscipline works.`,
      },
      fr: {
        title: "La psychologie pour survivre à une série de pertes",
        excerpt: "Les séries de pertes sont normales et inévitables. Qu'elles cramen ton compte dépend uniquement de ton comportement pendant.",
        body: `Même un bon edge produit des séries de pertes. Avec 50 % de réussite, une série de cinq ou six pertes est statistiquement banale. Le danger n'est pas la série — c'est ce qu'elle fait à ton comportement.

## Ce qu'une série te fait

Après plusieurs pertes, tu doutes de ton système, tu augmentes la taille pour « te rattraper », ou tu abandonnes tes règles. C'est exactement l'inverse à faire : une série, c'est quand la discipline compte le plus.

## Comment la traverser

1. **Réduis la taille, pas la rigueur.** Au besoin, trade plus petit jusqu'au retour de la confiance. Jamais plus gros.
2. **Juge le process, pas le résultat.** Si tu as suivi ton plan, c'était un bon trade même perdant. Note ça séparément du P&L.
3. **Prends du recul.** Dix trades, c'est du bruit. Regarde 50–100 pour voir si ton edge est cassé ou si c'est de la variance.

Suivre un score de discipline indépendant du profit te montre que tu fais toujours les bonnes choses pendant un drawdown — le réconfort qui t'évite de sauter. Cette séparation est au cœur de TradeDiscipline.`,
      },
      de: {
        title: "Die Psychologie, eine Verlustserie zu überstehen",
        excerpt: "Verlustserien sind normal und unvermeidlich. Ob sie dein Konto beenden, hängt allein von deinem Verhalten ab.",
        body: `Selbst ein solider Edge produziert Verlustserien. Bei 50 % Trefferquote ist eine Serie von fünf oder sechs Verlusten statistisch Routine. Die Gefahr ist nicht die Serie — sondern was sie mit deinem Verhalten macht.

## Was eine Serie mit dir macht

Nach mehreren Verlusten zweifelst du an deinem System, erhöhst die Größe zum „Aufholen" oder wirfst die Regeln über Bord. Genau falsch herum: In einer Serie zählt Disziplin am meisten.

## So stehst du sie durch

1. **Größe kürzen, nicht Standards.** Trade eher kleiner, bis das Vertrauen zurückkehrt. Nie größer.
2. **Prozess bewerten, nicht Ergebnis.** Wenn du deinem Plan gefolgt bist, war es ein guter Trade — auch als Verlust. Bewerte das getrennt von der G/V.
3. **Zoom raus.** Zehn Trades sind Rauschen. Schau auf 50–100, ob dein Edge kaputt ist oder nur Varianz.

Ein Disziplin-Score unabhängig vom Gewinn zeigt dir, dass du im Drawdown weiter das Richtige tust — die Beruhigung, die dich vor dem Sprengen bewahrt. Diese Trennung ist der Kern von TradeDiscipline.`,
      },
      es: {
        title: "La psicología para sobrevivir a una racha perdedora",
        excerpt: "Las rachas perdedoras son normales e inevitables. Que revienten tu cuenta depende solo de cómo te comportes durante ellas.",
        body: `Hasta un edge sólido produce rachas perdedoras. Con un 50 % de aciertos, una racha de cinco o seis pérdidas es estadísticamente rutina. El peligro no es la racha — es lo que le hace a tu comportamiento.

## Lo que una racha te hace

Tras varias pérdidas dudas de tu sistema, subes el tamaño para "recuperar" o abandonas tus reglas. Es justo al revés: en una racha la disciplina importa más, no menos.

## Cómo aguantarla

1. **Recorta el tamaño, no el rigor.** Si acaso, opera más pequeño hasta que vuelva la confianza. Nunca más grande.
2. **Juzga el proceso, no el resultado.** Si seguiste tu plan, fue un buen trade aunque perdiera. Puntúalo aparte del P&L.
3. **Aléjate.** Diez trades son ruido. Mira 50–100 para ver si tu edge está roto o es varianza.

Seguir una puntuación de disciplina independiente del beneficio te muestra que sigues haciendo lo correcto en un drawdown — el alivio que evita que revientes. Esa separación es el núcleo de TradeDiscipline.`,
      },
    },
  },
  {
    slug: "pre-trade-checklist",
    date: "2026-06-21",
    readingMinutes: 3,
    cover: "discipline",
    content: {
      en: {
        title: "The pre-trade checklist that stops bad trades",
        excerpt: "Pilots use checklists because memory fails under pressure. Your trading is no different.",
        body: `The moment before entry is when discipline breaks. You see the move, adrenaline rises, and rules get "adjusted." A checklist is a mechanical gate that the impulse has to pass through first.

## What belongs on it

Keep it to 5–8 yes/no items specific to your strategy, for example:

- Price is at a planned level (not chased)
- Session/time window is valid
- Risk is ≤ 1% of the account
- Stop and target are set before entry
- I'm calm, not revenge-trading

## Why it works

A checklist externalises your judgment so it doesn't depend on your emotional state. If any box is unchecked, there's no trade — the decision is made in advance, in calm. Over time the good habits become automatic.

TradeDiscipline builds your checklist from your own strategy and makes you confirm it before each session, so the gate is always there when you need it most.`,
      },
      fr: {
        title: "La checklist pré-trade qui stoppe les mauvais trades",
        excerpt: "Les pilotes utilisent des checklists parce que la mémoire flanche sous pression. Ton trading, c'est pareil.",
        body: `L'instant avant l'entrée, c'est quand la discipline casse. Tu vois le mouvement, l'adrénaline monte, et les règles s'« ajustent ». Une checklist est une barrière mécanique que l'impulsion doit franchir d'abord.

## Ce qu'elle contient

Garde 5 à 8 items oui/non propres à ta stratégie, par exemple :

- Le prix est à un niveau planifié (pas couru après)
- La séance / fenêtre horaire est valide
- Le risque est ≤ 1 % du compte
- Stop et objectif posés avant l'entrée
- Je suis calme, pas en revenge trading

## Pourquoi ça marche

Une checklist externalise ton jugement pour qu'il ne dépende pas de ton état émotionnel. Si une case n'est pas cochée, pas de trade — la décision est prise à l'avance, au calme. Avec le temps, les bonnes habitudes deviennent automatiques.

TradeDiscipline construit ta checklist à partir de ta propre stratégie et te la fait confirmer avant chaque séance, pour que la barrière soit toujours là quand tu en as le plus besoin.`,
      },
      de: {
        title: "Die Pre-Trade-Checkliste, die schlechte Trades stoppt",
        excerpt: "Piloten nutzen Checklisten, weil das Gedächtnis unter Druck versagt. Beim Traden ist es nicht anders.",
        body: `Der Moment vor dem Einstieg ist, wenn Disziplin bricht. Du siehst die Bewegung, das Adrenalin steigt, und Regeln werden „angepasst". Eine Checkliste ist ein mechanisches Tor, das der Impuls zuerst passieren muss.

## Was hineingehört

Halte 5–8 Ja/Nein-Punkte, spezifisch für deine Strategie, z. B.:

- Preis an einem geplanten Level (nicht hinterhergejagt)
- Session/Zeitfenster gültig
- Risiko ≤ 1 % des Kontos
- Stop und Ziel vor dem Einstieg gesetzt
- Ich bin ruhig, kein Revenge-Trading

## Warum es funktioniert

Eine Checkliste externalisiert dein Urteil, sodass es nicht von deinem Gefühlszustand abhängt. Ist ein Kästchen leer, gibt es keinen Trade — die Entscheidung fällt vorab, in Ruhe. Mit der Zeit werden die guten Gewohnheiten automatisch.

TradeDiscipline baut deine Checkliste aus deiner eigenen Strategie und lässt sie dich vor jeder Session bestätigen — das Tor ist immer da, wenn du es am meisten brauchst.`,
      },
      es: {
        title: "La checklist previa que frena los malos trades",
        excerpt: "Los pilotos usan checklists porque la memoria falla bajo presión. Tu trading no es diferente.",
        body: `El momento antes de entrar es cuando la disciplina se rompe. Ves el movimiento, sube la adrenalina, y las reglas se "ajustan". Una checklist es una puerta mecánica que el impulso debe pasar primero.

## Qué incluir

Mantén 5–8 ítems de sí/no específicos de tu estrategia, por ejemplo:

- El precio está en un nivel planificado (no perseguido)
- La sesión / ventana horaria es válida
- El riesgo es ≤ 1 % de la cuenta
- Stop y objetivo puestos antes de entrar
- Estoy en calma, no en revenge trading

## Por qué funciona

Una checklist externaliza tu juicio para que no dependa de tu estado emocional. Si una casilla está sin marcar, no hay trade — la decisión se toma de antemano, en calma. Con el tiempo, los buenos hábitos se vuelven automáticos.

TradeDiscipline construye tu checklist a partir de tu propia estrategia y te la hace confirmar antes de cada sesión, para que la puerta esté siempre cuando más la necesitas.`,
      },
    },
  },
  {
    slug: "never-move-your-stop",
    date: "2026-06-20",
    readingMinutes: 3,
    cover: "risk",
    content: {
      en: {
        title: "Never move your stop loss (except one way)",
        excerpt: "Widening a stop to avoid a loss is how small losses become account-ending ones.",
        body: `Your stop loss is a contract you sign with yourself at entry, when you're calm. Moving it wider mid-trade breaks that contract at the exact moment you're least objective.

## Why widening is fatal

When price approaches your stop, hope kicks in: "it'll come back." So you drag the stop further and risk more than you planned. Sometimes it works — which is worse, because it trains the habit. Eventually one runaway loss wipes out weeks of gains.

## The only acceptable move

You may move a stop **in your favour** — to breakeven or to lock in profit as the trade works. Never against you. If the trade needs a wider stop than planned, the setup was wrong; take the loss and move on.

## Pre-commit to make it easy

Set your stop before you enter and treat it as untouchable. A journal that records whether you respected your stop turns this into a measurable habit — one of the discipline signals TradeDiscipline tracks.`,
      },
      fr: {
        title: "Ne déplace jamais ton stop loss (sauf dans un sens)",
        excerpt: "Élargir un stop pour éviter une perte, c'est comme ça que les petites pertes deviennent fatales.",
        body: `Ton stop loss est un contrat que tu signes avec toi-même à l'entrée, au calme. Le déplacer plus loin en cours de trade brise ce contrat au moment précis où tu es le moins objectif.

## Pourquoi l'élargir est fatal

Quand le prix approche ton stop, l'espoir arrive : « ça va revenir ». Alors tu recules le stop et tu risques plus que prévu. Parfois ça marche — c'est pire, car ça ancre l'habitude. Un jour, une perte incontrôlée efface des semaines de gains.

## Le seul déplacement acceptable

Tu peux déplacer un stop **en ta faveur** — au point mort ou pour verrouiller du profit quand le trade avance. Jamais contre toi. Si le trade a besoin d'un stop plus large que prévu, le setup était mauvais ; prends la perte et passe à autre chose.

## Pré-engage-toi pour que ce soit facile

Fixe ton stop avant d'entrer et considère-le comme intouchable. Un journal qui note si tu as respecté ton stop en fait une habitude mesurable — l'un des signaux de discipline suivis par TradeDiscipline.`,
      },
      de: {
        title: "Verschiebe nie deinen Stop-Loss (außer in eine Richtung)",
        excerpt: "Einen Stop zu verbreitern, um einen Verlust zu vermeiden, macht aus kleinen Verlusten kontotötende.",
        body: `Dein Stop-Loss ist ein Vertrag, den du beim Einstieg mit dir selbst schließt — in Ruhe. Ihn mitten im Trade zu verbreitern bricht diesen Vertrag genau dann, wenn du am wenigsten objektiv bist.

## Warum Verbreitern tödlich ist

Nähert sich der Preis deinem Stop, kommt die Hoffnung: „Es kommt zurück." Also ziehst du den Stop weiter und riskierst mehr als geplant. Manchmal klappt es — das ist schlimmer, weil es die Gewohnheit festigt. Irgendwann löscht ein außer Kontrolle geratener Verlust Wochen an Gewinnen aus.

## Die einzige akzeptable Verschiebung

Du darfst einen Stop **zu deinen Gunsten** verschieben — auf Break-even oder um Gewinn zu sichern. Nie gegen dich. Braucht der Trade einen weiteren Stop als geplant, war das Setup falsch; nimm den Verlust und weiter.

## Verpflichte dich vorab

Setze deinen Stop vor dem Einstieg und behandle ihn als unantastbar. Ein Journal, das festhält, ob du deinen Stop respektiert hast, macht daraus eine messbare Gewohnheit — eines der Disziplinsignale, die TradeDiscipline verfolgt.`,
      },
      es: {
        title: "Nunca muevas tu stop loss (salvo en un sentido)",
        excerpt: "Ampliar un stop para evitar una pérdida es cómo las pérdidas pequeñas se vuelven fatales.",
        body: `Tu stop loss es un contrato que firmas contigo mismo al entrar, en calma. Moverlo más lejos a mitad del trade rompe ese contrato justo cuando menos objetivo eres.

## Por qué ampliarlo es fatal

Cuando el precio se acerca a tu stop, llega la esperanza: "volverá". Así que alejas el stop y arriesgas más de lo planeado. A veces funciona — lo cual es peor, porque fija el hábito. Al final una pérdida descontrolada borra semanas de ganancias.

## El único movimiento aceptable

Puedes mover un stop **a tu favor** — a break-even o para asegurar beneficio cuando el trade avanza. Nunca en tu contra. Si el trade necesita un stop más amplio del previsto, el setup era malo; asume la pérdida y sigue.

## Comprométete de antemano

Fija tu stop antes de entrar y trátalo como intocable. Un diario que registra si respetaste tu stop lo convierte en un hábito medible — una de las señales de disciplina que sigue TradeDiscipline.`,
      },
    },
  },
  {
    slug: "daily-trading-routine",
    date: "2026-06-19",
    readingMinutes: 4,
    cover: "routine",
    content: {
      en: {
        title: "A daily trading routine that protects your edge",
        excerpt: "Consistency comes from structure, not motivation. A repeatable routine removes the decisions that trip you up.",
        body: `Professional traders don't rely on feeling ready — they run a routine. Structure is what keeps performance steady when your mood isn't.

## Before the session

Check the economic calendar for high-impact news, review your plan and levels, and log your emotional state. If you're tired, angry or distracted, that's data — trade smaller or not at all.

## During the session

Run your pre-trade checklist on every entry. Track your trade count and your loss against your daily limit. When you hit either cap, you stop — no exceptions.

## After the session

Journal each trade: setup, emotion, and whether you followed your plan. This two-minute habit is where improvement actually happens; without it, you repeat the same mistakes blind.

TradeDiscipline wraps this into one flow — pre-trade checklist, live guards, and a session debrief — so the routine runs itself instead of relying on willpower.`,
      },
      fr: {
        title: "Une routine de trading quotidienne qui protège ton edge",
        excerpt: "La régularité vient de la structure, pas de la motivation. Une routine répétable enlève les décisions qui te font trébucher.",
        body: `Les traders pros ne comptent pas sur le fait de se « sentir prêts » — ils suivent une routine. La structure, c'est ce qui garde la performance stable quand ton humeur ne l'est pas.

## Avant la séance

Vérifie le calendrier éco pour les news à fort impact, revois ton plan et tes niveaux, et note ton état émotionnel. Si tu es fatigué, énervé ou distrait, c'est une donnée — trade plus petit ou pas du tout.

## Pendant la séance

Passe ta checklist pré-trade à chaque entrée. Suis ton nombre de trades et ta perte face à ta limite journalière. Une fois une limite atteinte, tu arrêtes — sans exception.

## Après la séance

Journalise chaque trade : setup, émotion, et si tu as suivi ton plan. Cette habitude de deux minutes, c'est là que se fait vraiment le progrès ; sans elle, tu répètes les mêmes erreurs à l'aveugle.

TradeDiscipline réunit tout ça en un flux — checklist pré-trade, gardes en direct et debrief de séance — pour que la routine tourne d'elle-même au lieu de reposer sur ta volonté.`,
      },
      de: {
        title: "Eine tägliche Trading-Routine, die deinen Edge schützt",
        excerpt: "Beständigkeit kommt aus Struktur, nicht Motivation. Eine wiederholbare Routine entfernt die Entscheidungen, die dich stolpern lassen.",
        body: `Profi-Trader verlassen sich nicht darauf, sich bereit zu fühlen — sie folgen einer Routine. Struktur hält die Leistung stabil, wenn deine Stimmung es nicht ist.

## Vor der Session

Prüfe den Wirtschaftskalender auf wichtige News, gehe Plan und Levels durch und halte deinen Gefühlszustand fest. Bist du müde, wütend oder abgelenkt, ist das ein Datenpunkt — trade kleiner oder gar nicht.

## Während der Session

Führe bei jedem Einstieg deine Pre-Trade-Checkliste aus. Verfolge Trade-Zahl und Verlust gegen dein Tageslimit. Am Limit hörst du auf — ausnahmslos.

## Nach der Session

Journalisiere jeden Trade: Setup, Emotion und ob du deinem Plan gefolgt bist. Diese Zwei-Minuten-Gewohnheit ist, wo Fortschritt tatsächlich passiert; ohne sie wiederholst du blind dieselben Fehler.

TradeDiscipline bündelt das in einem Ablauf — Pre-Trade-Checkliste, Live-Guards und Session-Debrief — damit die Routine sich selbst trägt.`,
      },
      es: {
        title: "Una rutina de trading diaria que protege tu edge",
        excerpt: "La consistencia viene de la estructura, no de la motivación. Una rutina repetible quita las decisiones que te hacen tropezar.",
        body: `Los traders profesionales no dependen de sentirse listos — siguen una rutina. La estructura mantiene el rendimiento estable cuando tu ánimo no lo está.

## Antes de la sesión

Revisa el calendario económico por noticias de alto impacto, repasa tu plan y niveles, y registra tu estado emocional. Si estás cansado, enfadado o distraído, es un dato — opera más pequeño o nada.

## Durante la sesión

Ejecuta tu checklist previa en cada entrada. Sigue tu número de trades y tu pérdida frente a tu límite diario. Al llegar a cualquiera, paras — sin excepciones.

## Después de la sesión

Registra cada trade: setup, emoción y si seguiste tu plan. Ese hábito de dos minutos es donde ocurre la mejora; sin él, repites los mismos errores a ciegas.

TradeDiscipline reúne esto en un flujo — checklist previa, guardas en vivo y debrief de sesión — para que la rutina se sostenga sola.`,
      },
    },
  },
  {
    slug: "win-rate-vs-risk-reward",
    date: "2026-06-18",
    readingMinutes: 4,
    cover: "target",
    content: {
      en: {
        title: "Win rate isn't everything: the R:R that beats it",
        excerpt: "A 40% win rate can crush a 70% one. What matters is win rate and reward-to-risk together.",
        body: `Traders obsess over win rate, but a high win rate can still lose money — and a low one can print. The truth is in the combination of win rate and reward-to-risk (R:R).

## The math that surprises people

With a 1:2 reward-to-risk, you only need to win ~34% of the time to break even. Win 45% at 1:2 and you're clearly profitable. Meanwhile, a 70% win rate at 1:0.5 (cutting winners early) barely breaks even and dies from costs.

## Why traders sabotage their R:R

The urge to "lock in" a small profit and the pain of giving back gains make you close winners too soon and let losers run — the exact opposite of what math rewards. High win rate feels good; it isn't the goal.

## Track average win vs average loss

If your average win isn't clearly bigger than your average loss, your R:R is broken, whatever your win rate. TradeDiscipline surfaces both so you can see if you're cutting winners short — the most common hidden leak.`,
      },
      fr: {
        title: "Le taux de réussite n'est pas tout : le R:R qui le bat",
        excerpt: "Un taux de 40 % peut écraser un 70 %. Ce qui compte, c'est le taux de réussite ET le ratio gain/risque ensemble.",
        body: `Les traders sont obsédés par le taux de réussite, mais un taux élevé peut quand même perdre de l'argent — et un faible peut cartonner. La vérité est dans la combinaison taux de réussite + ratio gain/risque (R:R).

## Le calcul qui surprend

Avec un R:R de 1:2, il suffit de gagner ~34 % du temps pour être à l'équilibre. Gagne 45 % à 1:2 et tu es clairement rentable. À l'inverse, 70 % de réussite à 1:0,5 (couper les gains trop tôt) atteint à peine l'équilibre et meurt des frais.

## Pourquoi les traders sabotent leur R:R

L'envie de « sécuriser » un petit gain et la douleur de rendre des profits te font fermer les gagnants trop tôt et laisser courir les perdants — l'exact inverse de ce que le calcul récompense. Un taux élevé fait du bien ; ce n'est pas l'objectif.

## Suis gain moyen vs perte moyenne

Si ton gain moyen n'est pas nettement plus grand que ta perte moyenne, ton R:R est cassé, quel que soit ton taux de réussite. TradeDiscipline montre les deux pour voir si tu coupes tes gains trop tôt — la fuite cachée la plus fréquente.`,
      },
      de: {
        title: "Trefferquote ist nicht alles: das CRV, das sie schlägt",
        excerpt: "Eine 40-%-Trefferquote kann eine 70-%-schlagen. Es zählt Trefferquote UND Chance-Risiko-Verhältnis zusammen.",
        body: `Trader fixieren sich auf die Trefferquote, aber eine hohe Quote kann trotzdem verlieren — und eine niedrige drucken. Die Wahrheit liegt in der Kombination aus Trefferquote und Chance-Risiko-Verhältnis (CRV).

## Die Mathematik, die überrascht

Bei einem CRV von 1:2 musst du nur ~34 % gewinnen, um break-even zu sein. Gewinnst du 45 % bei 1:2, bist du klar profitabel. Dagegen erreicht 70 % Trefferquote bei 1:0,5 (Gewinner zu früh schneiden) kaum break-even und stirbt an Kosten.

## Warum Trader ihr CRV sabotieren

Der Drang, kleinen Gewinn „zu sichern", und der Schmerz, Gewinne zurückzugeben, lassen dich Gewinner zu früh schließen und Verlierer laufen — genau das Gegenteil von dem, was die Mathematik belohnt. Hohe Trefferquote fühlt sich gut an; sie ist nicht das Ziel.

## Verfolge Durchschnittsgewinn vs. -verlust

Ist dein Durchschnittsgewinn nicht klar größer als dein Durchschnittsverlust, ist dein CRV kaputt — egal wie hoch die Quote. TradeDiscipline zeigt beides, damit du siehst, ob du Gewinner zu kurz schneidest.`,
      },
      es: {
        title: "El winrate no lo es todo: el R:R que lo supera",
        excerpt: "Un winrate del 40 % puede aplastar a uno del 70 %. Lo que importa es winrate y ratio beneficio-riesgo juntos.",
        body: `Los traders se obsesionan con el winrate, pero un winrate alto puede perder dinero — y uno bajo puede imprimir. La verdad está en la combinación de winrate y ratio beneficio-riesgo (R:R).

## La matemática que sorprende

Con un R:R de 1:2, solo necesitas ganar ~34 % de las veces para estar en equilibrio. Gana 45 % a 1:2 y eres claramente rentable. En cambio, un 70 % a 1:0,5 (cortar ganadores pronto) apenas equilibra y muere por costes.

## Por qué los traders sabotean su R:R

Las ganas de "asegurar" un beneficio pequeño y el dolor de devolver ganancias te hacen cerrar ganadores demasiado pronto y dejar correr perdedores — lo contrario de lo que premia la matemática. Un winrate alto sienta bien; no es el objetivo.

## Sigue ganancia media vs pérdida media

Si tu ganancia media no es claramente mayor que tu pérdida media, tu R:R está roto, sea cual sea tu winrate. TradeDiscipline muestra ambos para ver si cortas ganadores demasiado pronto — la fuga oculta más común.`,
      },
    },
  },
  {
    slug: "how-to-choose-prop-firm",
    date: "2026-06-17",
    readingMinutes: 5,
    cover: "prop",
    content: {
      en: {
        title: "How to choose a prop firm (without getting burned)",
        excerpt: "The cheapest challenge isn't the best. Read the rules that decide whether you can actually get paid.",
        body: `Prop firms sell the dream of trading big capital, but the fine print decides whether you keep it. Before you pay for a challenge, read past the marketing.

## The rules that actually matter

- **Drawdown type:** static (from starting balance) is far more forgiving than trailing (from your equity peak). Trailing can fail you after you're already in profit.
- **Daily loss limit:** how it's measured (balance vs equity, intraday) changes everything.
- **Payout terms:** minimum trading days, profit split, how often you can withdraw, and whether they actually pay on time (check independent reviews).
- **Consistency rules:** some firms void accounts if one day is "too" profitable.

## Match the firm to your style

A scalper who trades news needs different rules than a swing trader. A tight trailing drawdown will strangle a strategy that needs room to breathe.

Once you pick a firm, model its exact rules so you can see your live distance to each limit. TradeDiscipline lets you set profit target, daily loss and drawdown (static or trailing) per account — and 1-click templates for common firms get you started.`,
      },
      fr: {
        title: "Comment choisir une prop firm (sans te faire avoir)",
        excerpt: "Le challenge le moins cher n'est pas le meilleur. Lis les règles qui décident si tu pourras vraiment être payé.",
        body: `Les prop firms vendent le rêve de trader gros, mais les petites lignes décident si tu le gardes. Avant de payer un challenge, lis au-delà du marketing.

## Les règles qui comptent vraiment

- **Type de drawdown :** statique (depuis le solde de départ) est bien plus indulgent que trailing (depuis ton pic d'équité). Le trailing peut te recaler alors que tu es déjà en profit.
- **Limite de perte journalière :** sa mesure (solde vs équité, intraday) change tout.
- **Conditions de paiement :** jours de trading minimum, partage des profits, fréquence de retrait, et s'ils paient vraiment à temps (vérifie des avis indépendants).
- **Règles de consistance :** certaines firmes annulent le compte si une journée est « trop » rentable.

## Adapte la firme à ton style

Un scalpeur sur news a besoin de règles différentes d'un swing trader. Un drawdown trailing serré étouffera une stratégie qui a besoin d'air.

Une fois la firme choisie, modélise ses règles exactes pour voir ta distance en direct à chaque limite. TradeDiscipline permet de régler objectif, perte journalière et drawdown (statique ou trailing) par compte — et des templates 1-clic des firmes courantes te font démarrer.`,
      },
      de: {
        title: "Wie du eine Prop-Firma wählst (ohne dich zu verbrennen)",
        excerpt: "Die billigste Challenge ist nicht die beste. Lies die Regeln, die entscheiden, ob du tatsächlich bezahlt wirst.",
        body: `Prop-Firmen verkaufen den Traum, großes Kapital zu traden, aber das Kleingedruckte entscheidet, ob du es behältst. Bevor du für eine Challenge zahlst, lies über das Marketing hinaus.

## Die Regeln, die wirklich zählen

- **Drawdown-Typ:** statisch (vom Startkapital) ist weit gnädiger als trailing (vom Equity-Hoch). Trailing kann dich scheitern lassen, wenn du schon im Gewinn bist.
- **Tägliches Verlustlimit:** wie es gemessen wird (Balance vs. Equity, intraday) ändert alles.
- **Auszahlungsbedingungen:** Mindesthandelstage, Profit-Split, Auszahlungsfrequenz und ob sie pünktlich zahlen (prüfe unabhängige Bewertungen).
- **Konsistenzregeln:** manche Firmen annullieren Konten, wenn ein Tag „zu" profitabel ist.

## Passe die Firma zu deinem Stil

Ein News-Scalper braucht andere Regeln als ein Swing-Trader. Ein enger Trailing-Drawdown erdrosselt eine Strategie, die Luft braucht.

Wenn du eine Firma gewählt hast, modelliere ihre exakten Regeln, um deine Live-Distanz zu jedem Limit zu sehen. TradeDiscipline erlaubt Zielgewinn, Tagesverlust und Drawdown (statisch oder trailing) pro Konto — und 1-Klick-Vorlagen gängiger Firmen bringen dich in Gang.`,
      },
      es: {
        title: "Cómo elegir una prop firm (sin quemarte)",
        excerpt: "El challenge más barato no es el mejor. Lee las reglas que deciden si de verdad podrás cobrar.",
        body: `Las prop firms venden el sueño de operar gran capital, pero la letra pequeña decide si lo conservas. Antes de pagar un challenge, lee más allá del marketing.

## Las reglas que de verdad importan

- **Tipo de drawdown:** estático (desde el saldo inicial) es mucho más indulgente que trailing (desde tu pico de equity). El trailing puede suspenderte cuando ya estás en beneficio.
- **Límite de pérdida diaria:** cómo se mide (saldo vs equity, intradía) lo cambia todo.
- **Condiciones de pago:** días mínimos, reparto de beneficios, frecuencia de retiro, y si pagan a tiempo (mira reseñas independientes).
- **Reglas de consistencia:** algunas firmas anulan cuentas si un día es "demasiado" rentable.

## Ajusta la firma a tu estilo

Un scalper de noticias necesita reglas distintas a un swing trader. Un drawdown trailing ajustado ahogará una estrategia que necesita aire.

Una vez elegida la firma, modela sus reglas exactas para ver tu distancia en vivo a cada límite. TradeDiscipline permite fijar objetivo, pérdida diaria y drawdown (estático o trailing) por cuenta — y plantillas de 1 clic de firmas comunes te ponen en marcha.`,
      },
    },
  },
  {
    slug: "bounce-back-after-big-loss",
    date: "2026-06-16",
    readingMinutes: 4,
    cover: "discipline",
    content: {
      en: {
        title: "How to bounce back after a big loss",
        excerpt: "The trade after a big loss is the most dangerous of your career. Here's how to not make it worse.",
        body: `A big loss hurts twice: the money, and the urge to immediately win it back. That urge is what turns a bad trade into a bad month. The goal after a big loss isn't to recover fast — it's to not dig deeper.

## Step away first

Close the platform for the rest of the session, or at least take a hard break. Stress hormones make you reckless; time is the only thing that lowers them. Nothing good happens in the ten minutes after a big loss.

## Shrink before you scale

When you return, trade the smallest size you allow. Rebuild confidence with clean, by-the-book trades before thinking about size. Trying to "make it back" in one trade is exactly how the loss compounds.

## Review what actually happened

Was the loss bad luck (you followed your plan) or bad discipline (you broke it)? Be honest — the fix is completely different. Journaling the trade with your emotion attached forces that honesty, and over time it's how one big loss becomes your last. That reflection is built into TradeDiscipline's session debrief.`,
      },
      fr: {
        title: "Comment rebondir après une grosse perte",
        excerpt: "Le trade après une grosse perte est le plus dangereux de ta carrière. Voici comment ne pas empirer les choses.",
        body: `Une grosse perte fait mal deux fois : l'argent, et l'envie de te refaire immédiatement. Cette envie transforme un mauvais trade en mauvais mois. Le but après une grosse perte n'est pas de récupérer vite — c'est de ne pas creuser plus.

## Éloigne-toi d'abord

Ferme la plateforme pour le reste de la séance, ou au moins fais une vraie pause. Les hormones de stress te rendent imprudent ; seul le temps les fait baisser. Rien de bon n'arrive dans les dix minutes après une grosse perte.

## Réduis avant d'augmenter

À ton retour, trade la plus petite taille autorisée. Reconstruis la confiance avec des trades propres et carrés avant de penser à la taille. Vouloir « te refaire » en un trade, c'est exactement comme ça que la perte s'aggrave.

## Analyse ce qui s'est vraiment passé

La perte était-elle de la malchance (tu as suivi ton plan) ou de l'indiscipline (tu l'as cassé) ? Sois honnête — la correction est totalement différente. Journaliser le trade avec ton émotion force cette honnêteté, et avec le temps, c'est comme ça qu'une grosse perte devient ta dernière. Cette réflexion est intégrée au debrief de séance de TradeDiscipline.`,
      },
      de: {
        title: "Wie du dich nach einem großen Verlust erholst",
        excerpt: "Der Trade nach einem großen Verlust ist der gefährlichste deiner Karriere. So machst du ihn nicht schlimmer.",
        body: `Ein großer Verlust schmerzt doppelt: das Geld und der Drang, es sofort zurückzuholen. Dieser Drang macht aus einem schlechten Trade einen schlechten Monat. Das Ziel nach einem großen Verlust ist nicht, schnell zurückzukommen — sondern nicht tiefer zu graben.

## Zuerst weggehen

Schließe die Plattform für den Rest der Session oder mach zumindest eine harte Pause. Stresshormone machen dich leichtsinnig; nur Zeit senkt sie. In den zehn Minuten nach einem großen Verlust passiert nichts Gutes.

## Verkleinern, bevor du vergrößerst

Wenn du zurückkommst, trade die kleinste erlaubte Größe. Bau Vertrauen mit sauberen Trades nach Buch auf, bevor du an Größe denkst. Es „in einem Trade zurückzuholen" ist genau, wie der Verlust sich potenziert.

## Prüfe, was wirklich passierte

War der Verlust Pech (du folgtest deinem Plan) oder Undiszipliniertheit (du brachst ihn)? Sei ehrlich — die Lösung ist völlig anders. Den Trade mit deiner Emotion zu journalisieren erzwingt diese Ehrlichkeit — so wird aus einem großen Verlust dein letzter. Diese Reflexion steckt im Session-Debrief von TradeDiscipline.`,
      },
      es: {
        title: "Cómo recuperarte tras una gran pérdida",
        excerpt: "El trade tras una gran pérdida es el más peligroso de tu carrera. Así no lo empeoras.",
        body: `Una gran pérdida duele dos veces: el dinero, y las ganas de recuperarlo de inmediato. Esas ganas convierten un mal trade en un mal mes. El objetivo tras una gran pérdida no es recuperar rápido — es no cavar más hondo.

## Aléjate primero

Cierra la plataforma el resto de la sesión, o al menos toma un descanso real. Las hormonas del estrés te vuelven imprudente; solo el tiempo las baja. Nada bueno ocurre en los diez minutos tras una gran pérdida.

## Reduce antes de escalar

Al volver, opera el tamaño más pequeño que permitas. Reconstruye la confianza con trades limpios y de manual antes de pensar en tamaño. Querer "recuperarlo" en un trade es justo cómo se agrava la pérdida.

## Revisa qué pasó de verdad

¿La pérdida fue mala suerte (seguiste tu plan) o indisciplina (lo rompiste)? Sé honesto — la solución es totalmente distinta. Registrar el trade con tu emoción fuerza esa honestidad, y con el tiempo así una gran pérdida se vuelve la última. Esa reflexión está integrada en el debrief de sesión de TradeDiscipline.`,
      },
    },
  },
  {
    slug: "trailing-vs-static-drawdown",
    date: "2026-06-15",
    readingMinutes: 4,
    cover: "risk",
    content: {
      en: {
        title: "Trailing vs static drawdown, explained simply",
        excerpt: "The same 10% drawdown rule can be easy or brutal depending on one word: trailing.",
        body: `Drawdown is the maximum your account is allowed to fall before the challenge fails. But *from where* it's measured changes everything — and it's the rule that catches most traders off guard.

## Static drawdown

Measured from your **starting balance**. On a €10,000 account with 10% max, you fail if the balance drops below €9,000 — always. As you profit, your buffer grows and the floor stays put. This is the forgiving version.

## Trailing drawdown

Measured from your **highest balance reached (equity peak)**. The floor follows you up. If you're up to €11,000, a 10% trailing drawdown puts your fail line at €9,900 — you can now fail while still in profit versus your start. Many traders pass the hard part, relax, and get knocked out by a trailing floor they forgot was rising.

## What to do about it

Know which type your firm uses before you trade a single lot, and watch your distance to the floor live. TradeDiscipline models both — set the toggle and the app shows your real drawdown headroom at every moment.`,
      },
      fr: {
        title: "Drawdown trailing vs statique, expliqué simplement",
        excerpt: "La même règle de drawdown à 10 % peut être facile ou brutale selon un mot : trailing.",
        body: `Le drawdown, c'est la baisse maximale autorisée avant l'échec du challenge. Mais *depuis où* on le mesure change tout — et c'est la règle qui piège le plus de traders.

## Drawdown statique

Mesuré depuis ton **solde de départ**. Sur un compte de 10 000 € avec 10 % max, tu échoues si le solde passe sous 9 000 € — toujours. Quand tu gagnes, ton matelas grandit et le plancher reste fixe. C'est la version indulgente.

## Drawdown trailing

Mesuré depuis ton **solde le plus haut atteint (pic d'équité)**. Le plancher te suit vers le haut. Si tu es à 11 000 €, un drawdown trailing de 10 % place ta ligne d'échec à 9 900 € — tu peux désormais échouer alors que tu es encore en profit par rapport au départ. Beaucoup passent la partie dure, se détendent, et se font sortir par un plancher trailing qu'ils avaient oublié qu'il montait.

## Quoi faire

Sache quel type ta firme utilise avant de trader le moindre lot, et surveille ta distance au plancher en direct. TradeDiscipline modélise les deux — active l'option et l'app affiche ta marge de drawdown réelle à chaque instant.`,
      },
      de: {
        title: "Trailing- vs. statischer Drawdown, einfach erklärt",
        excerpt: "Dieselbe 10-%-Drawdown-Regel kann leicht oder brutal sein — je nach einem Wort: trailing.",
        body: `Drawdown ist der maximale Fall, den dein Konto vor dem Scheitern der Challenge haben darf. Aber *von wo* er gemessen wird, ändert alles — und es ist die Regel, die die meisten Trader kalt erwischt.

## Statischer Drawdown

Gemessen vom **Startkapital**. Bei 10.000 € mit 10 % max scheiterst du, wenn die Balance unter 9.000 € fällt — immer. Mit Gewinn wächst dein Puffer, der Boden bleibt. Die gnädige Version.

## Trailing-Drawdown

Gemessen vom **höchsten erreichten Stand (Equity-Hoch)**. Der Boden folgt dir nach oben. Bist du bei 11.000 €, liegt deine Scheiter-Linie bei 10 % Trailing bei 9.900 € — du kannst nun scheitern, obwohl du gegenüber dem Start im Plus bist. Viele bestehen den harten Teil, entspannen und werden von einem steigenden Trailing-Boden ausgeknockt.

## Was tun

Wisse vor dem ersten Lot, welchen Typ deine Firma nutzt, und beobachte deine Distanz zum Boden live. TradeDiscipline modelliert beide — setze den Schalter, und die App zeigt jederzeit deinen echten Drawdown-Spielraum.`,
      },
      es: {
        title: "Drawdown trailing vs estático, explicado fácil",
        excerpt: "La misma regla de drawdown del 10 % puede ser fácil o brutal según una palabra: trailing.",
        body: `El drawdown es la caída máxima permitida antes de que falle el challenge. Pero *desde dónde* se mide lo cambia todo — y es la regla que pilla desprevenidos a más traders.

## Drawdown estático

Medido desde tu **saldo inicial**. En una cuenta de 10.000 € con 10 % máx, fallas si el saldo baja de 9.000 € — siempre. Al ganar, tu colchón crece y el suelo se queda fijo. La versión indulgente.

## Drawdown trailing

Medido desde tu **saldo más alto alcanzado (pico de equity)**. El suelo te sigue hacia arriba. Si estás en 11.000 €, un drawdown trailing del 10 % pone tu línea de fallo en 9.900 € — ahora puedes fallar estando aún en beneficio respecto al inicio. Muchos pasan la parte dura, se relajan y quedan fuera por un suelo trailing que olvidaron que subía.

## Qué hacer

Sabe qué tipo usa tu firma antes de operar un solo lote, y vigila tu distancia al suelo en vivo. TradeDiscipline modela ambos — activa el interruptor y la app muestra tu margen de drawdown real en cada momento.`,
      },
    },
  },
  {
    slug: "what-is-a-discipline-score",
    date: "2026-06-14",
    readingMinutes: 3,
    cover: "discipline",
    content: {
      en: {
        title: "What is a discipline score — and why track it?",
        excerpt: "Profit tells you what happened. A discipline score tells you whether it will keep happening.",
        body: `P&L is a lagging, noisy signal: you can make money breaking every rule and lose money following them all. A discipline score measures the thing you actually control — your process — so you can improve it directly.

## What it measures

A discipline score rates each session on behaviour, not outcome: did you follow your plan, respect your risk, avoid impulsive trades, complete your checklist? A green day where you broke your rules should score low; a red day where you did everything right should score high.

## Why it beats chasing profit

Process leads results. If your discipline score is consistently high, profit follows over a large enough sample. If it's low, any profit is luck that will reverse. Tracking it turns "trade better" from a vague wish into a number you can move.

TradeDiscipline computes a discipline score from your checklist, your risk behaviour and your emotional tags — separate from P&L — so you always know whether you're building a durable edge or just running hot.`,
      },
      fr: {
        title: "C'est quoi un score de discipline — et pourquoi le suivre ?",
        excerpt: "Le profit dit ce qui s'est passé. Un score de discipline dit si ça va continuer.",
        body: `Le P&L est un signal retardé et bruité : tu peux gagner en cassant toutes les règles et perdre en les suivant toutes. Un score de discipline mesure ce que tu contrôles vraiment — ton process — pour l'améliorer directement.

## Ce qu'il mesure

Un score de discipline note chaque séance sur le comportement, pas le résultat : as-tu suivi ton plan, respecté ton risque, évité les trades impulsifs, complété ta checklist ? Une journée verte où tu as cassé tes règles doit scorer bas ; une journée rouge où tu as tout bien fait doit scorer haut.

## Pourquoi c'est mieux que courir après le profit

Le process précède les résultats. Si ton score de discipline est constamment haut, le profit suit sur un échantillon assez grand. S'il est bas, tout profit est de la chance qui se retournera. Le suivre transforme « mieux trader » d'un vœu flou en un chiffre que tu peux faire bouger.

TradeDiscipline calcule un score de discipline à partir de ta checklist, de ton comportement de risque et de tes tags émotionnels — séparé du P&L — pour que tu saches toujours si tu construis un edge durable ou si tu es juste en réussite passagère.`,
      },
      de: {
        title: "Was ist ein Disziplin-Score — und warum ihn verfolgen?",
        excerpt: "Der Gewinn sagt, was passiert ist. Ein Disziplin-Score sagt, ob es weiter passieren wird.",
        body: `Die G/V ist ein nachlaufendes, verrauschtes Signal: Du kannst Geld verdienen, indem du jede Regel brichst, und verlieren, indem du alle befolgst. Ein Disziplin-Score misst, was du wirklich kontrollierst — deinen Prozess — damit du ihn direkt verbesserst.

## Was er misst

Ein Disziplin-Score bewertet jede Session nach Verhalten, nicht Ergebnis: Bist du deinem Plan gefolgt, hast du dein Risiko respektiert, impulsive Trades vermieden, deine Checkliste erledigt? Ein grüner Tag mit Regelbruch sollte niedrig scoren; ein roter Tag mit allem richtig hoch.

## Warum das besser ist als Gewinnjagd

Prozess führt zu Ergebnissen. Ist dein Disziplin-Score konstant hoch, folgt der Gewinn über eine ausreichende Stichprobe. Ist er niedrig, ist jeder Gewinn Glück, das dreht. Ihn zu verfolgen macht aus „besser traden" statt eines vagen Wunsches eine Zahl, die du bewegen kannst.

TradeDiscipline berechnet einen Disziplin-Score aus Checkliste, Risikoverhalten und Emotions-Tags — getrennt von der G/V — damit du immer weißt, ob du einen dauerhaften Edge baust oder nur heiß läufst.`,
      },
      es: {
        title: "¿Qué es una puntuación de disciplina — y por qué seguirla?",
        excerpt: "El beneficio dice qué pasó. Una puntuación de disciplina dice si seguirá pasando.",
        body: `El P&L es una señal rezagada y ruidosa: puedes ganar rompiendo todas las reglas y perder siguiéndolas todas. Una puntuación de disciplina mide lo que de verdad controlas — tu proceso — para mejorarlo directamente.

## Qué mide

Una puntuación de disciplina califica cada sesión por comportamiento, no resultado: ¿seguiste tu plan, respetaste tu riesgo, evitaste trades impulsivos, completaste tu checklist? Un día verde donde rompiste tus reglas debe puntuar bajo; un día rojo donde hiciste todo bien debe puntuar alto.

## Por qué supera a perseguir el beneficio

El proceso lleva a resultados. Si tu puntuación de disciplina es siempre alta, el beneficio sigue en una muestra suficiente. Si es baja, cualquier beneficio es suerte que se revertirá. Seguirla convierte "operar mejor" de un deseo vago en un número que puedes mover.

TradeDiscipline calcula una puntuación de disciplina a partir de tu checklist, tu comportamiento de riesgo y tus etiquetas emocionales — aparte del P&L — para que siempre sepas si construyes un edge duradero o solo estás en racha.`,
      },
    },
  },
  {
    slug: "consistency-over-big-wins",
    date: "2026-06-13",
    readingMinutes: 3,
    cover: "trend",
    content: {
      en: {
        title: "Why consistency beats big wins",
        excerpt: "One huge trade feels great and teaches you nothing repeatable. Steady, boring gains are the real edge.",
        body: `The trades you brag about — the huge, lucky wins — are usually the worst thing for your account. They reward the exact behaviour (oversizing, holding through your plan) that eventually blows you up.

## Big wins hide bad habits

A trader who risks 10% and triples the account in a month looks like a genius until the same risk halves it in a week. Outsized results come from outsized risk, and outsized risk is a countdown, not an edge.

## Boring is the goal

Small, repeatable gains from a consistent process compound quietly and survive. Prop firms know this — many now have "consistency rules" that penalise one-day-wonders precisely because they signal gambling, not skill.

## Measure consistency, not highlights

Track your discipline score and your equity curve's smoothness, not your best day. A steady upward line with small drawdowns is worth more than a jagged one with a spike. TradeDiscipline surfaces both so you can chase the right thing.`,
      },
      fr: {
        title: "Pourquoi la régularité bat les gros gains",
        excerpt: "Un trade énorme fait plaisir et n'apprend rien de reproductible. Les gains réguliers et ennuyeux sont le vrai edge.",
        body: `Les trades dont tu te vantes — les gros gains chanceux — sont souvent le pire pour ton compte. Ils récompensent le comportement même (surdimensionner, tenir hors plan) qui finit par te cramer.

## Les gros gains cachent de mauvaises habitudes

Un trader qui risque 10 % et triple son compte en un mois passe pour un génie jusqu'à ce que le même risque le divise par deux en une semaine. Les résultats démesurés viennent d'un risque démesuré, et le risque démesuré est un compte à rebours, pas un edge.

## Ennuyeux, c'est l'objectif

De petits gains reproductibles issus d'un process régulier composent tranquillement et survivent. Les prop firms le savent — beaucoup ont désormais des « règles de consistance » qui pénalisent les coups d'un jour, justement parce qu'ils signalent du jeu, pas de la compétence.

## Mesure la régularité, pas les temps forts

Suis ton score de discipline et la régularité de ta courbe d'équité, pas ton meilleur jour. Une ligne montante régulière avec petits drawdowns vaut plus qu'une ligne en dents de scie avec un pic. TradeDiscipline montre les deux pour que tu vises la bonne chose.`,
      },
      de: {
        title: "Warum Beständigkeit große Gewinne schlägt",
        excerpt: "Ein riesiger Trade fühlt sich toll an und lehrt nichts Wiederholbares. Ruhige, langweilige Gewinne sind der echte Edge.",
        body: `Die Trades, mit denen du prahlst — die riesigen Glücksgewinne — sind meist das Schlimmste für dein Konto. Sie belohnen genau das Verhalten (zu groß, gegen den Plan halten), das dich am Ende sprengt.

## Große Gewinne verstecken schlechte Gewohnheiten

Ein Trader, der 10 % riskiert und sein Konto in einem Monat verdreifacht, wirkt genial — bis dasselbe Risiko es in einer Woche halbiert. Übergroße Ergebnisse kommen von übergroßem Risiko, und das ist ein Countdown, kein Edge.

## Langweilig ist das Ziel

Kleine, wiederholbare Gewinne aus einem beständigen Prozess wachsen leise und überleben. Prop-Firmen wissen das — viele haben nun „Konsistenzregeln", die Eintagsfliegen bestrafen, gerade weil sie Zocken statt Können signalisieren.

## Miss Beständigkeit, nicht Highlights

Verfolge deinen Disziplin-Score und die Glätte deiner Equity-Kurve, nicht deinen besten Tag. Eine stetig steigende Linie mit kleinen Drawdowns ist mehr wert als eine zackige mit Spitze. TradeDiscipline zeigt beides.`,
      },
      es: {
        title: "Por qué la consistencia supera a los grandes golpes",
        excerpt: "Un trade enorme sienta genial y no enseña nada repetible. Las ganancias estables y aburridas son el verdadero edge.",
        body: `Los trades de los que presumes — los grandes golpes de suerte — suelen ser lo peor para tu cuenta. Premian justo el comportamiento (sobredimensionar, aguantar fuera del plan) que al final te revienta.

## Los grandes golpes esconden malos hábitos

Un trader que arriesga 10 % y triplica la cuenta en un mes parece un genio hasta que el mismo riesgo la reduce a la mitad en una semana. Los resultados desmesurados vienen de un riesgo desmesurado, y eso es una cuenta atrás, no un edge.

## Aburrido es el objetivo

Ganancias pequeñas y repetibles de un proceso consistente componen en silencio y sobreviven. Las prop firms lo saben — muchas tienen ya "reglas de consistencia" que penalizan los golpes de un día, precisamente porque señalan juego, no habilidad.

## Mide la consistencia, no los momentos estelares

Sigue tu puntuación de disciplina y la suavidad de tu curva de equity, no tu mejor día. Una línea ascendente estable con pequeños drawdowns vale más que una dentada con un pico. TradeDiscipline muestra ambas.`,
      },
    },
  },
  {
    slug: "spot-emotional-trading",
    date: "2026-06-12",
    readingMinutes: 3,
    cover: "psychology",
    content: {
      en: {
        title: "How to spot emotional trading before it costs you",
        excerpt: "You can't stop what you can't see. Learn the tells that you've switched from trading to reacting.",
        body: `Emotional trading rarely announces itself. It feels like conviction in the moment and only looks like a mistake afterward. The skill is catching it live — before the click.

## The physical tells

Racing heart, gripping the mouse, leaning toward the screen, holding your breath. Your body reacts before your mind admits it. When you notice these, pause: they mean you're reacting, not deciding.

## The behavioural tells

You're about to take a setup that isn't in your plan. You're sizing up after a loss. You're checking the P&L every few seconds. You're arguing with the chart. Any of these is a stop sign.

## The fix: name it and wait

Say out loud what you're feeling — "this is FOMO," "this is revenge." Naming an emotion reduces its grip. Then enforce a short cooldown before any action.

Logging your emotional state at each session — and tagging trades with the feeling behind them — makes the invisible visible. Over weeks, TradeDiscipline shows you exactly which emotions cost you the most money.`,
      },
      fr: {
        title: "Repérer le trading émotionnel avant qu'il ne te coûte",
        excerpt: "Tu ne peux pas arrêter ce que tu ne vois pas. Apprends les signes que tu es passé du trading à la réaction.",
        body: `Le trading émotionnel s'annonce rarement. Sur le moment, ça ressemble à de la conviction, et ça n'a l'air d'une erreur qu'après. Le savoir-faire, c'est de l'attraper en direct — avant le clic.

## Les signes physiques

Cœur qui s'emballe, main crispée sur la souris, buste penché vers l'écran, respiration bloquée. Ton corps réagit avant que ton esprit ne l'admette. Quand tu remarques ça, fais une pause : tu réagis, tu ne décides pas.

## Les signes comportementaux

Tu es sur le point de prendre un setup hors plan. Tu augmentes la taille après une perte. Tu regardes le P&L toutes les deux secondes. Tu discutes avec le graphique. Chacun est un panneau stop.

## La solution : nomme et attends

Dis à voix haute ce que tu ressens — « c'est du FOMO », « c'est de la revanche ». Nommer une émotion réduit son emprise. Puis impose un court temps de pause avant toute action.

Noter ton état émotionnel à chaque séance — et taguer les trades avec le ressenti derrière — rend l'invisible visible. Sur plusieurs semaines, TradeDiscipline te montre exactement quelles émotions te coûtent le plus.`,
      },
      de: {
        title: "Emotionales Traden erkennen, bevor es dich kostet",
        excerpt: "Du kannst nicht stoppen, was du nicht siehst. Lerne die Zeichen, dass du vom Traden ins Reagieren gewechselt bist.",
        body: `Emotionales Traden kündigt sich selten an. Im Moment fühlt es sich wie Überzeugung an und sieht erst danach wie ein Fehler aus. Die Kunst ist, es live zu fangen — vor dem Klick.

## Die körperlichen Zeichen

Rasendes Herz, verkrampfte Maushand, zum Bildschirm gelehnt, angehaltener Atem. Dein Körper reagiert, bevor dein Kopf es zugibt. Bemerkst du das, pausiere: Du reagierst, du entscheidest nicht.

## Die verhaltensbezogenen Zeichen

Du willst ein Setup außerhalb deines Plans nehmen. Du erhöhst nach einem Verlust. Du checkst die G/V alle paar Sekunden. Du diskutierst mit dem Chart. Jedes ist ein Stoppschild.

## Die Lösung: benennen und warten

Sprich aus, was du fühlst — „das ist FOMO", „das ist Rache". Eine Emotion zu benennen mindert ihren Griff. Dann erzwinge eine kurze Abkühlung vor jeder Handlung.

Deinen Gefühlszustand pro Session festzuhalten — und Trades mit dem Gefühl dahinter zu taggen — macht das Unsichtbare sichtbar. Über Wochen zeigt dir TradeDiscipline genau, welche Emotionen am meisten kosten.`,
      },
      es: {
        title: "Cómo detectar el trading emocional antes de que te cueste",
        excerpt: "No puedes frenar lo que no ves. Aprende las señales de que pasaste de operar a reaccionar.",
        body: `El trading emocional rara vez se anuncia. En el momento parece convicción y solo después parece un error. La habilidad es cazarlo en vivo — antes del clic.

## Las señales físicas

Corazón acelerado, mano tensa en el ratón, cuerpo inclinado a la pantalla, respiración contenida. Tu cuerpo reacciona antes de que tu mente lo admita. Cuando lo notes, pausa: estás reaccionando, no decidiendo.

## Las señales de comportamiento

Estás por tomar un setup fuera del plan. Subes el tamaño tras una pérdida. Miras el P&L cada dos segundos. Discutes con el gráfico. Cualquiera es una señal de stop.

## La solución: nómbralo y espera

Di en voz alta lo que sientes — "esto es FOMO", "esto es revancha". Nombrar una emoción reduce su control. Luego impón un breve enfriamiento antes de cualquier acción.

Registrar tu estado emocional en cada sesión — y etiquetar trades con el sentimiento detrás — hace visible lo invisible. En semanas, TradeDiscipline te muestra qué emociones te cuestan más dinero.`,
      },
    },
  },
  {
    slug: "trading-journal-mistakes",
    date: "2026-06-11",
    readingMinutes: 3,
    cover: "journal",
    content: {
      en: {
        title: "5 trading journal mistakes that waste your time",
        excerpt: "A journal you fill in wrong is busywork. Avoid these five traps and it becomes your best coach.",
        body: `Keeping a journal is good advice repeated so often that most people do it badly. Here are the five mistakes that turn a journal into wasted effort.

## 1. Logging only numbers

Entry, exit, P&L — and nothing about *why*. Without the setup and your emotional state, you can't find patterns. Log the decision, not just the result.

## 2. Only journaling losses

Your winning trades hide bad habits too (a lucky win on a broken rule). Review greens with the same honesty as reds.

## 3. Never reviewing it

Writing without reading is a diary, not a tool. Weekly review is where the patterns show up.

## 4. Being vague

"Bad discipline today" helps no one. Be specific: "took 3 trades outside plan after the first loss."

## 5. Making it too slow

If logging takes five minutes, you'll quit. Keep it to a few taps.

TradeDiscipline fixes all five by design: quick emotional check-ins, automatic discipline scoring, and weekly patterns surfaced for you — so the journal actually changes your behaviour.`,
      },
      fr: {
        title: "5 erreurs de journal de trading qui te font perdre ton temps",
        excerpt: "Un journal mal rempli, c'est de l'occupation. Évite ces cinq pièges et il devient ton meilleur coach.",
        body: `Tenir un journal est un conseil si répété que la plupart le font mal. Voici les cinq erreurs qui transforment un journal en effort gâché.

## 1. Ne noter que des chiffres

Entrée, sortie, P&L — et rien sur le *pourquoi*. Sans le setup et ton état émotionnel, impossible de trouver des patterns. Note la décision, pas juste le résultat.

## 2. Ne journaliser que les pertes

Tes trades gagnants cachent aussi de mauvaises habitudes (un gain chanceux sur une règle cassée). Analyse les verts avec la même honnêteté que les rouges.

## 3. Ne jamais le relire

Écrire sans relire, c'est un journal intime, pas un outil. Le bilan hebdo, c'est là que les patterns apparaissent.

## 4. Rester vague

« Mauvaise discipline aujourd'hui » n'aide personne. Sois précis : « 3 trades hors plan après la première perte ».

## 5. Le rendre trop lent

Si noter prend cinq minutes, tu abandonneras. Réduis à quelques clics.

TradeDiscipline corrige les cinq par conception : check-ins émotionnels rapides, score de discipline automatique, et patterns hebdo remontés — pour que le journal change vraiment ton comportement.`,
      },
      de: {
        title: "5 Trading-Journal-Fehler, die deine Zeit verschwenden",
        excerpt: "Ein falsch geführtes Journal ist Beschäftigungstherapie. Vermeide diese fünf Fallen, und es wird dein bester Coach.",
        body: `Ein Journal zu führen ist ein so oft wiederholter Rat, dass die meisten es schlecht tun. Hier die fünf Fehler, die ein Journal zu verschwendeter Mühe machen.

## 1. Nur Zahlen erfassen

Einstieg, Ausstieg, G/V — und nichts zum *Warum*. Ohne Setup und Gefühlszustand findest du keine Muster. Erfasse die Entscheidung, nicht nur das Ergebnis.

## 2. Nur Verluste journalisieren

Deine Gewinner verstecken auch schlechte Gewohnheiten (ein Glücksgewinn auf gebrochener Regel). Prüfe Grüne so ehrlich wie Rote.

## 3. Es nie durchsehen

Schreiben ohne Lesen ist ein Tagebuch, kein Werkzeug. Die Wochenbilanz zeigt die Muster.

## 4. Vage sein

„Heute schlechte Disziplin" hilft niemandem. Sei konkret: „3 Trades außerhalb des Plans nach dem ersten Verlust."

## 5. Zu langsam machen

Dauert das Erfassen fünf Minuten, hörst du auf. Auf ein paar Taps beschränken.

TradeDiscipline behebt alle fünf per Design: schnelle Emotions-Check-ins, automatischer Disziplin-Score und wöchentliche Muster — damit das Journal dein Verhalten wirklich ändert.`,
      },
      es: {
        title: "5 errores de diario de trading que te hacen perder el tiempo",
        excerpt: "Un diario mal llevado es entretenerse. Evita estas cinco trampas y se vuelve tu mejor coach.",
        body: `Llevar un diario es un consejo tan repetido que la mayoría lo hace mal. Aquí los cinco errores que convierten un diario en esfuerzo perdido.

## 1. Anotar solo números

Entrada, salida, P&L — y nada del *porqué*. Sin el setup y tu estado emocional, no puedes hallar patrones. Anota la decisión, no solo el resultado.

## 2. Registrar solo las pérdidas

Tus trades ganadores también esconden malos hábitos (un golpe de suerte con una regla rota). Revisa los verdes con la misma honestidad que los rojos.

## 3. No releerlo nunca

Escribir sin leer es un diario íntimo, no una herramienta. La revisión semanal es donde aparecen los patrones.

## 4. Ser vago

"Mala disciplina hoy" no ayuda a nadie. Sé específico: "3 trades fuera del plan tras la primera pérdida".

## 5. Hacerlo demasiado lento

Si registrar lleva cinco minutos, lo dejarás. Redúcelo a unos toques.

TradeDiscipline corrige los cinco por diseño: check-ins emocionales rápidos, puntuación de disciplina automática y patrones semanales — para que el diario cambie de verdad tu comportamiento.`,
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
