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
  {
    slug: "prop-firm-discipline",
    date: "2026-06-29",
    readingMinutes: 5,
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
