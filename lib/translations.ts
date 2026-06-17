export type Lang = "fr" | "en" | "de" | "es";

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "de", label: "DE", flag: "🇩🇪" },
  { code: "es", label: "ES", flag: "🇪🇸" },
];

import en from "./i18n/en";

/**
 * Per-locale translation maps are code-split into lib/i18n/<lang>.ts so the
 * client only loads the active language's chunk (instead of all four, ~139 KB
 * gzipped). English is bundled synchronously — it is the SSR/first-paint locale
 * and the fallback — while fr/de/es load on demand via dynamic import.
 */
export type Dict = Record<string, string>;

/** English dictionary, always available synchronously (SSR + fallback). */
export const enDict: Dict = en;

const LOADERS: Record<Lang, () => Promise<Dict>> = {
  en: () => Promise.resolve(en),
  fr: () => import("./i18n/fr").then((m) => m.default),
  de: () => import("./i18n/de").then((m) => m.default),
  es: () => import("./i18n/es").then((m) => m.default),
};

/** Dynamically load a locale's dictionary (resolves immediately for "en"). */
export function loadDict(lang: Lang): Promise<Dict> {
  return (LOADERS[lang] ?? LOADERS.en)();
}

export const stopQuotes: Record<Lang, { text: string; author: string }[]> = {
  fr: [
    { text: "L'objectif d'un trader qui réussit est de faire les meilleurs trades. L'argent passe au second plan.", author: "Alexander Elder" },
    { text: "Le marché peut rester irrationnel plus longtemps que vous ne pouvez rester solvable.", author: "John Maynard Keynes" },
    { text: "Le risque vient du fait de ne pas savoir ce que l'on fait.", author: "Warren Buffett" },
    { text: "J'ai deux règles fondamentales pour gagner, en trading comme dans la vie : 1. Si tu ne paries pas, tu ne peux pas gagner. 2. Si tu perds tous tes jetons, tu ne peux plus parier.", author: "Larry Hite" },
    { text: "Chaque trader a ses forces et ses faiblesses. Certains savent garder leurs gagnants, mais conservent leurs perdants un peu trop longtemps.", author: "Michael Marcus" },
    { text: "Ce qui distingue les traders gagnants, ce n'est pas leur connaissance des marchés, mais le contrôle de leurs émotions.", author: "Mark Douglas" },
    { text: "Ne te concentre pas sur l'argent à gagner ; concentre-toi sur la protection de ce que tu as déjà.", author: "Paul Tudor Jones" },
    { text: "Les ingrédients d'un bon trading sont : (1) couper ses pertes, (2) couper ses pertes, et (3) couper ses pertes.", author: "Ed Seykota" },
    { text: "Une perte ne me dérange jamais une fois encaissée. Je l'oublie pendant la nuit. Mais avoir tort et ne pas couper sa perte — c'est ça qui fait des dégâts.", author: "Jesse Livermore" },
  ],
  en: [
    { text: "The goal of a successful trader is to make the best trades. Money is secondary.", author: "Alexander Elder" },
    { text: "The market can stay irrational longer than you can stay solvent.", author: "John Maynard Keynes" },
    { text: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
    { text: "I have two basic rules about winning in trading as well as in life: 1. If you don't bet, you can't win. 2. If you lose all your chips, you can't bet.", author: "Larry Hite" },
    { text: "Every trader has strengths and weaknesses. Some are good holders of winners, but may hold their losers a little too long.", author: "Michael Marcus" },
    { text: "Winning traders are not separated by their knowledge of the markets, but by the control of their emotions.", author: "Mark Douglas" },
    { text: "Don't focus on making money; focus on protecting what you have.", author: "Paul Tudor Jones" },
    { text: "The elements of good trading are: (1) cutting losses, (2) cutting losses, and (3) cutting losses.", author: "Ed Seykota" },
    { text: "A loss never bothers me after I take it. I forget it overnight. But being wrong and not taking the loss — that is what does damage.", author: "Jesse Livermore" },
  ],
  de: [
    { text: "Das Ziel eines erfolgreichen Traders ist es, die besten Trades zu machen. Geld ist zweitrangig.", author: "Alexander Elder" },
    { text: "Der Markt kann länger irrational bleiben, als du solvent bleiben kannst.", author: "John Maynard Keynes" },
    { text: "Risiko entsteht daraus, dass man nicht weiß, was man tut.", author: "Warren Buffett" },
    { text: "Ich habe zwei Grundregeln, um beim Trading wie im Leben zu gewinnen: 1. Wenn du nicht setzt, kannst du nicht gewinnen. 2. Wenn du all deine Chips verlierst, kannst du nicht mehr setzen.", author: "Larry Hite" },
    { text: "Jeder Trader hat Stärken und Schwächen. Manche halten ihre Gewinner gut, behalten ihre Verlierer aber ein wenig zu lange.", author: "Michael Marcus" },
    { text: "Was erfolgreiche Trader unterscheidet, ist nicht ihr Wissen über die Märkte, sondern die Kontrolle ihrer Emotionen.", author: "Mark Douglas" },
    { text: "Konzentriere dich nicht darauf, Geld zu verdienen — konzentriere dich darauf, das zu schützen, was du hast.", author: "Paul Tudor Jones" },
    { text: "Die Elemente guten Tradings sind: (1) Verluste begrenzen, (2) Verluste begrenzen und (3) Verluste begrenzen.", author: "Ed Seykota" },
    { text: "Ein Verlust stört mich nie, sobald ich ihn akzeptiert habe. Ich vergesse ihn über Nacht. Aber falsch zu liegen und den Verlust nicht zu realisieren — das richtet den Schaden an.", author: "Jesse Livermore" },
  ],
  es: [
    { text: "El objetivo de un trader exitoso es hacer las mejores operaciones. El dinero es secundario.", author: "Alexander Elder" },
    { text: "El mercado puede mantenerse irracional más tiempo del que tú puedes mantenerte solvente.", author: "John Maynard Keynes" },
    { text: "El riesgo viene de no saber lo que estás haciendo.", author: "Warren Buffett" },
    { text: "Tengo dos reglas básicas para ganar, tanto en el trading como en la vida: 1. Si no apuestas, no puedes ganar. 2. Si pierdes todas tus fichas, no puedes apostar.", author: "Larry Hite" },
    { text: "Cada trader tiene sus fortalezas y debilidades. Algunos saben mantener sus ganadores, pero conservan sus perdedores un poco demasiado tiempo.", author: "Michael Marcus" },
    { text: "Lo que distingue a los traders ganadores no es su conocimiento de los mercados, sino el control de sus emociones.", author: "Mark Douglas" },
    { text: "No te enfoques en ganar dinero; enfócate en proteger lo que ya tienes.", author: "Paul Tudor Jones" },
    { text: "Los ingredientes de un buen trading son: (1) cortar las pérdidas, (2) cortar las pérdidas, y (3) cortar las pérdidas.", author: "Ed Seykota" },
    { text: "Una pérdida nunca me molesta una vez asumida. La olvido durante la noche. Pero equivocarse y no cortar la pérdida — eso es lo que causa el daño.", author: "Jesse Livermore" },
  ],
};

/** Rotating motivational quote on the session screen (picked by weekday). */
export const dailyQuotes: Record<Lang, string[]> = {
  fr: [
    "Le meilleur trade est souvent celui que tu ne prends pas.",
    "La discipline bat le talent quand le talent manque de discipline.",
    "Un trader rentable ne cherche pas à avoir raison, il cherche à perdre peu.",
    "La patience est la compétence la plus sous-estimée en trading.",
    "Protège ton capital d'abord. Les profits viennent d'eux-mêmes.",
    "Respecter son plan, c'est respecter son futur.",
    "Le marché est là chaque jour. Ta discipline, elle, se construit maintenant.",
  ],
  en: [
    "The best trade is often the one you don't take.",
    "Discipline beats talent when talent lacks discipline.",
    "A profitable trader doesn't try to be right — they try to lose little.",
    "Patience is the most underrated skill in trading.",
    "Protect your capital first. Profits follow on their own.",
    "Respecting your plan is respecting your future.",
    "The market is here every day. Your discipline is built now.",
  ],
  de: [
    "Der beste Trade ist oft der, den du nicht machst.",
    "Disziplin schlägt Talent, wenn dem Talent die Disziplin fehlt.",
    "Ein profitabler Trader will nicht recht haben — er will wenig verlieren.",
    "Geduld ist die am meisten unterschätzte Fähigkeit im Trading.",
    "Schütze zuerst dein Kapital. Die Gewinne kommen von selbst.",
    "Seinen Plan zu respektieren heißt, seine Zukunft zu respektieren.",
    "Der Markt ist jeden Tag da. Deine Disziplin baust du jetzt auf.",
  ],
  es: [
    "El mejor trade suele ser el que no tomas.",
    "La disciplina vence al talento cuando al talento le falta disciplina.",
    "Un trader rentable no busca tener razón, busca perder poco.",
    "La paciencia es la habilidad más subestimada en el trading.",
    "Protege tu capital primero. Los beneficios vienen solos.",
    "Respetar tu plan es respetar tu futuro.",
    "El mercado está cada día. Tu disciplina se construye ahora.",
  ],
};
