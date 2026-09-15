import fs from "node:fs";
import path from "node:path";

/**
 * Recensement de TOUT ce que le produit écrit sur l'appareil d'un visiteur.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE
 *
 * La section 10 de la politique de confidentialité a affirmé pendant des mois
 * « uniquement des cookies strictement nécessaires (session d'authentification) »
 * alors que le site écrivait aussi la langue, le thème, une quinzaine de
 * préférences d'affichage et la source d'arrivée marketing. Personne n'avait
 * menti : la phrase était vraie le jour où elle a été écrite, et le code a
 * continué d'avancer sans elle. C'est exactement la forme de défaut que ce
 * dépôt connaît le mieux, une règle écrite puis appliquée à une partie
 * seulement de ce qu'elle vise.
 *
 * ⚠️ POURQUOI ON RECENSE LES SITES D'ÉCRITURE, PAS LES NOMS DE CLÉS
 *
 * Un garde qui chercherait les noms de clés mentirait, et on le sait déjà ici :
 * les clés sont composées (`session_paused_${id}`), passées par constante
 * (`LS_KEY`), fabriquées par une fonction (`lsKey(dismissKey)`) ou entièrement
 * décidées par l'appelant (`usePersistentState(key)`). Une regex qui ne
 * connaîtrait qu'une de ces formes protégerait un quart du produit tout en
 * affichant du vert.
 *
 * On recense donc les ENDROITS où le code écrit, repérés par fichier + texte de
 * l'expression de clé. Cette empreinte survit à un déplacement de lignes et
 * change dès qu'on ajoute, retire ou renomme une écriture. Le test voisin
 * échoue alors, et la question posée au développeur est la bonne : cette
 * nouvelle information déposée chez le visiteur, elle relève de quelle
 * catégorie déclarée, ou faut-il ne pas l'écrire du tout ?
 */

/** Catégories déclarées en section 10 de la politique de confidentialité. */
export type CategorieStockage =
  /** Strictement nécessaire : session de connexion, état anti-CSRF du broker. */
  | "auth"
  /** Préférence d'affichage : langue choisie. */
  | "langue"
  /** Préférence d'affichage : thème clair ou sombre. */
  | "theme"
  /** Confort d'usage : filtres, sélections, cartes repliées, reprise de session. */
  | "confort"
  /** Provenance marketing, conservée 30 jours pour rémunérer un partenaire. */
  | "attribution";

/** Racines parcourues. `middleware.ts` est un fichier, pas un dossier. */
const RACINES = ["app", "components", "lib", "middleware.ts"];

/** Un test, un banc d'essai et ce fichier-ci parlent d'écritures sans en faire. */
const IGNORES = /\.(test|eval)\.tsx?$|[\\/]stockage-navigateur\.ts$/;

function fichiersSources(racineDepot: string): string[] {
  const trouves: string[] = [];
  const visiter = (absolu: string) => {
    const infos = fs.statSync(absolu);
    if (infos.isFile()) {
      if (/\.tsx?$/.test(absolu) && !IGNORES.test(absolu)) trouves.push(absolu);
      return;
    }
    for (const entree of fs.readdirSync(absolu)) {
      if (entree === "node_modules" || entree.startsWith(".")) continue;
      visiter(path.join(absolu, entree));
    }
  };
  for (const racine of RACINES) {
    const absolu = path.join(racineDepot, racine);
    if (fs.existsSync(absolu)) visiter(absolu);
  }
  return trouves;
}

/**
 * Premier argument d'un appel, à partir de l'indice suivant la parenthèse
 * ouvrante. On avance en respectant les imbrications et les chaînes (guillemets
 * simples, doubles, gabarits) pour s'arrêter sur la virgule de PREMIER niveau.
 *
 * ⚠️ Ne jamais remplacer ça par « couper au premier caractère rencontré » : une
 * clé de gabarit contient des virgules et des parenthèses, et une frontière
 * approximative découpe au mauvais endroit sans rien signaler.
 */
function premierArgument(source: string, debut: number): string {
  let profondeur = 0;
  let delimiteur: string | null = null;
  for (let i = debut; i < source.length; i++) {
    const c = source[i];
    if (delimiteur) {
      if (c === "\\") i++;
      else if (c === delimiteur) delimiteur = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      delimiteur = c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") profondeur++;
    else if (c === "]" || c === "}") profondeur--;
    else if (c === ")") {
      if (profondeur === 0) return source.slice(debut, i);
      profondeur--;
    } else if (c === "," && profondeur === 0) return source.slice(debut, i);
  }
  return source.slice(debut);
}

/** Une écriture repérée dans le code. */
export interface EcritureStockage {
  /** Chemin relatif au dépôt, séparateurs normalisés en « / ». */
  fichier: string;
  /** « localStorage », « sessionStorage » ou « cookie ». */
  support: string;
  /** Texte de l'expression de clé, espaces normalisés. */
  cle: string;
  /** Empreinte stable utilisée comme clé d'inventaire. */
  empreinte: string;
}

const MOTIFS: Array<{ regex: RegExp; support?: string }> = [
  { regex: /(?:window\.)?(localStorage|sessionStorage)\.setItem\(/g },
  { regex: /\.cookies\.set\(/g, support: "cookie" },
];

/** Parcourt les sources et rend toutes les écritures sur l'appareil du visiteur. */
export function recenserEcritures(racineDepot: string): EcritureStockage[] {
  const ecritures: EcritureStockage[] = [];
  for (const absolu of fichiersSources(racineDepot)) {
    const source = fs.readFileSync(absolu, "utf8");
    const fichier = path.relative(racineDepot, absolu).split(path.sep).join("/");
    const ajouter = (support: string, cle: string) => {
      const propre = cle.trim().replace(/\s+/g, " ");
      ecritures.push({
        fichier,
        support,
        cle: propre,
        empreinte: `${fichier} :: ${support} :: ${propre}`,
      });
    };
    for (const { regex, support } of MOTIFS) {
      regex.lastIndex = 0;
      let trouve: RegExpExecArray | null;
      while ((trouve = regex.exec(source)) !== null) {
        ajouter(support ?? trouve[1], premierArgument(source, regex.lastIndex));
      }
    }
    // `document.cookie = ...` n'est pas un appel : pas d'argument à extraire,
    // donc on ne garde rien de la correspondance, seulement le fait qu'elle existe.
    const affectation = /document\.cookie\s*=/g;
    while (affectation.exec(source) !== null) ajouter("cookie", "document.cookie");
  }
  return ecritures.sort((a, b) => a.empreinte.localeCompare(b.empreinte));
}

/**
 * Inventaire figé : chaque écriture connue et la catégorie déclarée dont elle
 * relève. Ajouter une entrée ici est un acte DÉLIBÉRÉ : cela revient à dire que
 * la section 10 couvre déjà cette information, ou qu'on vient de l'y ajouter.
 */
export const INVENTAIRE: Record<string, CategorieStockage> = {
  // ── Strictement nécessaire ────────────────────────────────────────────────
  "middleware.ts :: cookie :: name": "auth",
  "app/api/broker/tradovate/oauth/start/route.ts :: cookie :: OAUTH_STATE_COOKIE": "auth",

  // ── Préférence de langue ──────────────────────────────────────────────────
  "middleware.ts :: cookie :: COOKIE_NAME": "langue",
  "lib/LanguageContext.tsx :: cookie :: document.cookie": "langue",
  "lib/LanguageContext.tsx :: localStorage :: STORAGE_KEY": "langue",

  // ── Préférence de thème ───────────────────────────────────────────────────
  'lib/ThemeContext.tsx :: localStorage :: "tm-theme"': "theme",

  // ── Confort d'usage ───────────────────────────────────────────────────────
  "lib/AlertsContext.tsx :: localStorage :: lsKey(dismissKey)": "confort",
  "lib/ActiveAccountContext.tsx :: localStorage :: LS_KEY": "confort",
  "lib/hooks/usePersistentState.ts :: localStorage :: key": "confort",
  "lib/backtest/tentatives.ts :: localStorage :: PREFIXE + strategieId": "confort",
  "components/trades/TradeList.tsx :: localStorage :: PAGE_SIZE_KEY": "confort",
  "components/trades/TradeList.tsx :: localStorage :: FILTERS_OPEN_KEY": "confort",
  "components/dashboard/AlertCenter.tsx :: sessionStorage :: cle": "confort",
  "components/dashboard/OnboardingChecklist.tsx :: localStorage :: SEEN_INCOMPLETE_KEY": "confort",
  "components/dashboard/OnboardingChecklist.tsx :: localStorage :: CELEBRATED_KEY": "confort",
  "components/dashboard/OnboardingChecklist.tsx :: localStorage :: COLLAPSED_KEY": "confort",
  "components/FoundingNotif.tsx :: sessionStorage :: DISMISS_KEY": "confort",
  "app/dashboard/layout.tsx :: localStorage :: todayKey": "confort",
  'app/dashboard/goals/page.tsx :: localStorage :: "goals_met_snapshot"': "confort",
  'app/dashboard/settings/page.tsx :: localStorage :: "session_reminder_disabled"': "confort",
  'app/dashboard/upgrade/page.tsx :: sessionStorage :: "td_pending_plan"': "confort",
  "app/dashboard/session/page.tsx :: localStorage :: `session_paused_${activeSession.id}`": "confort",
  "app/dashboard/session/page.tsx :: localStorage :: `session_debrief_${endedSessionId}`": "confort",

  // ── Provenance marketing ──────────────────────────────────────────────────
  //
  // ⚠️ SEULE ENTRÉE QUI NE SOIT PAS EXEMPTÉE DE CONSENTEMENT. L'article 82 de la
  // loi Informatique et Libertés vise toute inscription sur le terminal, pas
  // seulement les cookies : le stockage local en fait partie. Mémoriser la
  // source d'arrivée pendant 30 jours pour rémunérer un partenaire n'est pas
  // « strictement nécessaire au service demandé par le visiteur ».
  // La section 10 la décrit désormais honnêtement, ce qui ne tient pas lieu de
  // base légale. Toute NOUVELLE écriture de cette nature se déclare ici, et
  // pose la même question ouverte.
  "components/AttributionCapture.tsx :: localStorage :: ATTRIBUTION_KEY": "attribution",
  "components/dashboard/SignupAttribution.tsx :: localStorage :: SENT_KEY": "attribution",
};

/**
 * Formule attestant qu'une catégorie est bien décrite en section 10, par langue.
 * Traduire la section sans traduire ces repères casse le test : c'est voulu,
 * une traduction qui perd une catégorie est une traduction qui ment.
 */
export const REPERES_SECTION_10: Record<string, Record<CategorieStockage, string>> = {
  fr: {
    auth: "Session d'authentification",
    langue: "Langue d'affichage",
    theme: "Thème clair ou sombre",
    confort: "Confort d'usage",
    attribution: "Source d'arrivée",
  },
  en: {
    auth: "Authentication session",
    langue: "Display language",
    theme: "Light or dark theme",
    confort: "In-app convenience",
    attribution: "Referral source",
  },
  es: {
    auth: "Sesión de autenticación",
    langue: "Idioma de visualización",
    theme: "Tema claro u oscuro",
    confort: "Comodidad de uso",
    attribution: "Origen de llegada",
  },
  de: {
    auth: "Authentifizierungssitzung",
    langue: "Anzeigesprache",
    theme: "Helles oder dunkles Design",
    confort: "Bedienkomfort",
    attribution: "Herkunft des Besuchs",
  },
};
