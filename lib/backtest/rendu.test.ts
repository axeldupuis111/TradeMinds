import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import de from "../i18n/de";
import en from "../i18n/en";
import es from "../i18n/es";
import fr from "../i18n/fr";
import { socleDePlan } from "./compilation";
import { verifierLePlan } from "./coherence-plan";
import { clePourLeConstat, verifierCondamnation } from "./condamnation";
import { evaluerCompletude } from "./completude";
import { confronterAuMarche, mesurerLeMarche } from "./caractere-marche";
import { dimensionsDeRecherche } from "./dimensions";
import { coutsPourInstrument, instrumentParCode, INSTRUMENTS } from "./instruments";
import { comparerPlans, DESCRIPTEURS } from "./modifications";
import {
  gesteDeLaModification,
  nommerUnChamp,
  nommerUneValeur,
  phraseDuPlan,
  provenanceDeLaModification,
  sansCodeInterne,
} from "./phrases";
import { METHODES } from "./methodes";
import { composerPlanComplet } from "./plan-complet";
import { confronterAuProfil, lireLeProfil, type TradeReel } from "./profil";
import { concentration } from "./robustesse";
import { synthetiser } from "./synthese";
import type { PlanExecution, SerieM1, TradeSimule } from "./types";
import type { Statistiques } from "./verdict";

/**
 * TOUT CE QUE CETTE PAGE PEUT ÉCRIRE, RENDU ET RELU.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ DIX SESSIONS DE PILOTAGE, QUARANTE-SEPT DÉFAUTS, ZÉRO TROUVÉ PAR LES
 * TESTS. Axel ouvrait une preview, je conduisais une heure, je trouvais deux ou
 * trois phrases fausses, je les corrigeais, et la fois suivante j'en trouvais
 * trois autres. Sa remarque : « on a créé énormément de previews et à chaque
 * fois tu découvres des problèmes ». Elle est juste, et le problème n'est pas le
 * nombre de défauts : c'est que la seule façon de les voir était de les LIRE.
 *
 * Les 2 100 tests vérifiaient des NOMBRES. Aucun ne regardait la PHRASE qui les
 * porte. Or presque tous les défauts trouvés à l'écran étaient dans la phrase :
 *
 *   « trendline → range_horaire »            un code interne affiché tel quel
 *   « biais_moyenne (80) »                   idem
 *   « doit dominer non défini bougies »      un marqueur d'absence dans un compte
 *   « 1 essais » « 7.05 bougie » « 1 ans »   un pluriel appliqué à un
 *   « intervalle [-0.000 ; 0.082] »          un zéro négatif
 *   « 2 trades par jour, 2 les jours… »      un contraste sans contraste
 *   « Réglé par toi, à la main »             une provenance inventée
 *
 * ── CE QUE FAIT CE FICHIER ──────────────────────────────────────────────────
 *
 * Il fabrique une matrice de plans et de suites de trades qui couvre toutes les
 * natures de blocs, tous les motifs de sortie et les cas limites, fait tourner
 * TOUS les producteurs de texte de l'onglet, compose exactement la clé que le
 * composant composerait, et relit la phrase obtenue DANS LES QUATRE LANGUES.
 *
 * ⚠️ IL NE VÉRIFIE AUCUN CHIFFRE. Les autres tests font ça très bien. Celui-ci
 * ne regarde que ce qui s'affiche, et il échoue si une phrase contient quelque
 * chose qu'aucun être humain ne devrait lire.
 */

const NAS = instrumentParCode("NAS100")!;

// ─── Ce qu'aucune phrase ne doit contenir ──────────────────────────────────

/**
 * ⚠️ UN IDENTIFIANT INTERNE À L'ÉCRAN EST UN BUG, PAS UN DÉTAIL. Aucune des
 * quatre langues n'écrit `mot_mot` ni `motMot` dans une phrase : ces deux
 * motifs ne peuvent venir que d'un code rendu tel quel.
 *
 * ⚠️⚠️ LE CAMELCASE MANQUAIT, ET IL ÉTAIT À L'ÉCRAN. La carte des
 * interprétations affichait « uniteDeTemps : La fiche dit H1/H4… » et
 * « sortiesAuxiliaires : … » en tête des phrases où l'IA annonce ce qu'elle a
 * décidé à la place du trader. Le premier garde ne cherchait que le tiret bas.
 */
const CODE_BRUT = /\b[a-z][a-z0-9]*(_[a-z0-9]+)+\b|\b[a-z]+[A-Z][a-zA-Z]*\b/;

/** Ce qu'une valeur mal formée laisse derrière elle. */
const VALEUR_SALE = /NaN|undefined|\bnull\b|Infinity|\[object |-0\.0+\b/;

/** Un remplacement oublié. */
const TROU = /\{[a-zA-Z]+\}/;

const LANGUES: Record<string, Record<string, string>> = {
  fr: fr as Record<string, string>,
  en: en as Record<string, string>,
  es: es as Record<string, string>,
  de: de as Record<string, string>,
};

/** Le `tr()` de la page, à l'identique. */
function rendre(
  langue: Record<string, string>,
  cle: string,
  valeurs?: Record<string, string | number>,
): string {
  let sortie = langue[cle];
  if (sortie === undefined) return `!!MANQUANTE:${cle}`;
  for (const [nom, valeur] of Object.entries(valeurs ?? {})) {
    sortie = sortie.split(`{${nom}}`).join(String(valeur));
  }
  return sortie;
}

interface AVerifier {
  cle: string;
  valeurs?: Record<string, string | number>;
  /** D'où ça vient, pour que l'échec dise quoi aller regarder. */
  origine: string;
}

const recolte: AVerifier[] = [];
const ajouter = (origine: string, cle: string, valeurs?: Record<string, string | number>) =>
  recolte.push({ cle, valeurs, origine });

// ─── La matrice ────────────────────────────────────────────────────────────

function plan(p: Partial<PlanExecution> = {}): PlanExecution {
  return {
    ...socleDePlan(NAS.code, "Europe/Paris"),
    uniteDeTemps: 5,
    contexte: { fuseau: "Europe/Paris", debut: "08:00", fin: "17:00", jours: [1, 2, 3, 4, 5] },
    niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    stop: { type: "dernier_pivot", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
    ...p,
  };
}

/**
 * Un plan par nature de bloc, plus les combinaisons qui ont déjà cassé.
 *
 * ⚠️ LES NATURES SONT LE CŒUR DU SUJET : c'est en changeant de type de niveau
 * que « trendline → range_horaire » est apparu, et en changeant de type de stop
 * que « doit dominer non défini bougies » est apparu.
 */
const NIVEAUX: PlanExecution["niveau"][] = [
  { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
  { type: "liquidite_swing", pivots: 8 },
  { type: "range_horaire", debut: "09:30", fin: "11:30" },
  { type: "extremes_n_bougies", n: 20 },
  { type: "extremes_veille" },
  { type: "order_block", impulsionMinTicks: 5000 },
  { type: "breaker", impulsionMinTicks: 5000 },
  { type: "fvg_zone", tailleMinTicks: 2000 },
  { type: "ote_fibonacci", pivots: 10, retraceMinPct: 62, retraceMaxPct: 79 },
  { type: "moyenne_mobile", periode: 50 },
  { type: "vwap_session" },
  { type: "bollinger", periode: 20, ecarts: 2 },
];

const STOPS: PlanExecution["stop"][] = [
  { type: "dernier_pivot", bufferTicks: 200, pivots: 5 },
  { type: "dernier_pivot", bufferTicks: 200 },
  { type: "extreme_balayage", bufferTicks: 100 },
  { type: "structurel", bufferTicks: 100 },
  { type: "niveau_oppose", bufferTicks: 100 },
  { type: "atr", periode: 14, multipleDixiemes: 15 },
  { type: "fixe", ticks: 4000 },
];

const DECLENCHEURS: PlanExecution["declencheur"][] = [
  { type: "cassure", mode: "cloture" },
  { type: "cassure", mode: "meche" },
  { type: "retest_apres_cassure", delaiMaxBarres: 10, toleranceTicks: 500 },
  { type: "balayage_retour" },
  { type: "balayage_puis_fvg", delaiReaction: 5, delaiRetest: 8 },
  { type: "fvg_puis_retest", delaiMaxBarres: 8 },
  { type: "entree_dans_zone", delaiMaxBarres: 6 },
];

const CONFIRMATIONS: PlanExecution["confirmations"][] = [
  [],
  [{ type: "biais_moyenne", periode: 80 }],
  [
    { type: "rsi", periode: 14, seuil: 55, mode: "momentum" },
    { type: "macd", rapide: 12, lente: 26, signal: 9 },
    { type: "bougie_reaction" },
  ],
  [
    { type: "stochastique", periode: 14, seuil: 80, mode: "momentum" },
    { type: "divergence", periode: 14, pivots: 5 },
    { type: "amplitude_min", ticks: 4500 },
  ],
];

const GESTIONS: PlanExecution["gestion"][] = [
  {},
  { risqueParTradePct: 1 },
  { risqueParTradePct: 5, maxPertesConsecutives: 3, maxTradesParJour: 10, maxPerteJournaliereR: 3 },
];

/** Une suite de trades, avec le motif de sortie qu'on veut couvrir. */
function trades(
  rs: number[],
  motifs: TradeSimule["motif"][] = ["objectif"],
  memeJour = false,
): TradeSimule[] {
  return rs.map((r, i) => {
    const ms = Date.UTC(2024, 0, 1) + (memeJour ? 0 : i * 86_400_000);
    return {
      signalMs: ms,
      niveauSignal: 21_000_000,
      entreeMs: ms,
      sortieMs: ms + 3_600_000,
      sens: (i % 2 === 0 ? "long" : "short") as TradeSimule["sens"],
      entreeTicks: 21_000_000,
      sortieTicks: 21_000_000 + Math.round(r * 1000),
      risqueTicks: 40_000 + (i % 7) * 5_000,
      r,
      rBrut: r + 0.02,
      motif: motifs[i % motifs.length],
      collisionMemeBarre: i % 23 === 0,
    };
  });
}

const SUITES: { nom: string; trades: TradeSimule[] }[] = [
  { nom: "mélange ordinaire", trades: trades(Array.from({ length: 300 }, (_, i) => (i % 3 === 0 ? 1.98 : -1.02)), ["objectif", "stop", "fin_de_session"]) },
  { nom: "tout à l'objectif", trades: trades(Array.from({ length: 150 }, () => 1.98), ["objectif"]) },
  { nom: "tout au stop", trades: trades(Array.from({ length: 150 }, () => -1.02), ["stop"]) },
  { nom: "jamais l'objectif", trades: trades(Array.from({ length: 200 }, (_, i) => (i % 2 ? 0.4 : -1.02)), ["fin_de_session", "stop"]) },
  { nom: "quelques trades", trades: trades([1.98, -1.02, 0.5], ["objectif", "stop", "fin_de_session"]) },
  { nom: "un seul trade", trades: trades([1.98], ["objectif"]) },
  { nom: "aucun trade", trades: [] },
  { nom: "tous le même jour", trades: trades(Array.from({ length: 60 }, (_, i) => (i % 4 === 0 ? 1.98 : -1.02)), ["objectif", "stop"], true) },
];

const stats = (p: Partial<Statistiques> = {}): Statistiques => ({
  nbTrades: 300,
  tauxReussite: 0.39,
  esperanceR: -0.037,
  borneBasse: -0.141,
  borneHaute: 0.067,
  totalR: -11,
  profitFactor: 0.95,
  drawdownMaxR: 18,
  gainMoyenR: 1.29,
  perteMoyenneR: 0.89,
  partHorsCible: 0.31,
  ...p,
});

// ─── Les producteurs ───────────────────────────────────────────────────────

// 1. Ce qu'on peut affirmer sans rien prédire.
for (const gestion of GESTIONS) {
  for (const stop of STOPS) {
    for (const mesure of [undefined, 0.029]) {
      const p = plan({ gestion, stop });
      for (const c of verifierCondamnation({
        plan: p,
        couts: p.couts,
        risqueMoyenTicks: 117_270,
        amplitudeBougieTicks: 13_840,
        tradesParAn: 506,
        coutParTradeMesureR: mesure,
        gainMoyenR: mesure ? 1.29 : undefined,
        perteMoyenneR: mesure ? 0.89 : undefined,
        partHorsCible: mesure ? 0.31 : undefined,
        tauxReussiteObserve: mesure ? 0.391 : undefined,
      })) {
        ajouter("condamnation", clePourLeConstat(c), c.valeurs);
        ajouter("condamnation", `bt_cond_${c.code}_titre`);
        ajouter("condamnation", `bt_grav_${c.gravite}`);
      }
    }
  }
}
// Le stop court, qui a sa propre rédaction au singulier.
for (const c of verifierCondamnation({
  plan: plan(),
  couts: plan().couts,
  risqueMoyenTicks: 12_000,
  amplitudeBougieTicks: 13_840,
})) {
  ajouter("condamnation stop court", clePourLeConstat(c), c.valeurs);
}

// 2. Ce que tu as changé par rapport à ta fiche.
const modifications: import("./modifications").Modification[] = [];
const ORIGINES = [
  {},
  { pose: "base" as const, label: "Suivi de tendance" },
  { pose: "journal" as const },
  { pose: "version" as const, label: "01/09/2026" },
  { levier: "pivots", objectif: "plus_de_trades" as const },
];
for (const niveau of NIVEAUX) {
  for (const stop of STOPS) {
    for (const o of ORIGINES) {
      const avant = plan();
      const apres = plan({ niveau, stop, instrument: "XAUUSD", uniteDeTemps: 15 });
      const origines = Object.fromEntries(DESCRIPTEURS.map((d) => [d.cle, o]));
      modifications.push(
        ...comparerPlans(avant, apres, NAS, origines, undefined, (cle, v) =>
          nommerUneValeur(cle, v, (k) => rendre(fr as Record<string, string>, k)),
        ),
      );
    }
  }
}
for (const declencheur of DECLENCHEURS) {
  for (const confirmations of CONFIRMATIONS) {
    modifications.push(
      ...comparerPlans(plan(), plan({ declencheur, confirmations }), NAS, {}, undefined, (cle, v) =>
        nommerUneValeur(cle, v, (k) => rendre(fr as Record<string, string>, k)),
      ),
    );
  }
}

const lignesDuPlan: (readonly [string, import("./plan-complet").LigneDuPlan])[] = [];
// 3. Ton plan, de A à Z.
for (const gestion of GESTIONS) {
  for (const suite of SUITES) {
    lignesDuPlan.push(
      ...composerPlanComplet(plan({ gestion }), suite.trades, NAS).lignes.map(
        (l) => [`plan complet (${suite.nom})`, l] as const,
      ),
    );
  }
}

// 4. Ce qui est établi, et ce qui ne l'est pas.
const lectureBidon = (verdict: "insuffisant" | "negatif" | "non_concluant" | "positif") => ({
  verdict,
  stats: stats({ esperanceR: verdict === "positif" ? 0.2 : -0.05 }),
});
for (const v of ["insuffisant", "negatif", "non_concluant", "positif"] as const) {
  for (const tentatives of [1, 2, 45]) {
    for (const explorees of [0, 32]) {
      const s = synthetiser({
        lecture: lectureBidon("non_concluant") as never,
        horsPeriode: { lecture: lectureBidon(v) } as never,
        concentration: concentration(SUITES[0].trades),
        stabilite: [],
        constats: [],
        tentatives,
        combinaisonsExplorees: explorees,
      } as never);
      for (const p of s.piliers) {
        ajouter("synthèse", `bt_syn_${p.code}`);
        ajouter("synthèse", `bt_syn_${p.etat}`);
        ajouter("synthèse", `bt_syn_${p.code}_${p.variante ?? p.etat}`, p.valeurs);
      }
    }
  }
}

// 5. Ce que ta stratégie dit, et ce qu'elle a vraiment fait.
const audit = {
  esperanceBruteR: -0.008,
  esperanceNetteR: -0.037,
  coutParTradeR: 0.029,
  risqueMoyenTicks: 117_270,
  coutBreakEvenTicks: null,
  aucunAvantageAvantCouts: true,
  coutApplique: 2300,
  edgeDetruitParLesCouts: false,
};
for (const gestion of GESTIONS) {
  for (const suite of SUITES) {
    for (const s of [undefined, stats(), stats({ tauxReussite: 0.2 })]) {
      for (const c of verifierLePlan(
        plan({ gestion }),
        audit as never,
        suite.trades,
        NAS,
        { risk_reward: 2, max_trades_per_day: 10, pairs: ["NAS100"] },
        s,
      )) {
        ajouter(`cohérence (${suite.nom})`, `bt_coh_${c.code}`, c.valeurs);
        ajouter("cohérence", `bt_coh_${c.gravite}`);
      }
    }
  }
}

// 6. Ta stratégie écrite, et toi.
const reels: TradeReel[] = Array.from({ length: 80 }, (_, i) => ({
  pair: i % 10 === 0 ? "NAS100" : "XAUUSD",
  ouvertureMs: Date.UTC(2025, 0, 1 + i, 9 + (i % 6), 0),
  pnlNet: i % 3 === 0 ? 120 : -40 * (i === 7 ? 9 : 1),
}));
for (const n of [10, 80]) {
  const profil = lireLeProfil(reels.slice(0, n), "Europe/Paris");
  for (const c of confronterAuProfil(plan(), profil, NAS)) {
    ajouter("profil", `bt_prof_${c.code}`, c.valeurs);
  }
}

// 7. Ce que vaut ce marché, avant toute stratégie.
function serie(n: number, amplitude: number, tendance: number): SerieM1 {
  const t = new Float64Array(n);
  const o = new Int32Array(n);
  const h = new Int32Array(n);
  const l = new Int32Array(n);
  const c = new Int32Array(n);
  let x = 7;
  let prix = 21_000_000;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    prix += Math.round((x / 0x7fffffff - 0.5) * amplitude) + tendance;
    t[i] = Date.UTC(2024, 0, 1, 0, 0) + i * 60_000;
    o[i] = prix;
    h[i] = prix + amplitude;
    l[i] = prix - amplitude;
    c[i] = prix;
  }
  return { instrument: "NAS100", tailleTick: 0.001, t, o, h, l, c };
}
for (const [amp, tend] of [
  [3000, 0],
  [500, 200],
  [8000, -5],
]) {
  const caractere = mesurerLeMarche(serie(40_000, amp, tend), 5, coutsPourInstrument(NAS));
  for (const m of METHODES) {
    for (const a of confronterAuMarche(m.besoinsMarche, caractere)) {
      ajouter(`caractère (${m.code})`, `bt_car_${a.besoin}_${a.code}`, {
        ...a.valeurs,
        methode: rendre(fr as Record<string, string>, `bt_meth_${m.code}`),
        marche: NAS.nom,
      });
    }
  }
}

// 8. Ton plan, de A à Z : les treize questions.
for (const reponses of [{}, { marche: "Nasdaq", stop: "derrière le pivot" }]) {
  for (const l of evaluerCompletude({
    plan: plan(),
    reponses,
    ficheTexte: "Je trade le Nasdaq en cassure de trendline, stop derrière le dernier sommet.",
  } as never).lignes) {
    ajouter("complétude", `bt_q_${l.code}`);
    ajouter("complétude", `bt_q_${l.code}_aide`);
    ajouter("complétude", `bt_q_etat_${l.etat}`);
    ajouter("complétude", `bt_q_source_${l.source}`);
  }
}

// 9. Les catalogues, qui n'ont pas de valeurs mais peuvent manquer.
for (const m of METHODES) {
  ajouter("méthodes", `bt_meth_${m.code}`);
  ajouter("méthodes", `bt_meth_${m.code}_quoi`);
  ajouter("méthodes", `bt_fam_${m.famille}`);
  ajouter("méthodes", `bt_meca_${m.mecanisation}`);
  for (const b of m.besoins) ajouter("méthodes", `bt_besoin_${b}`);
  for (const r of m.regimes) ajouter("méthodes", `bt_regime_${r}`);
  for (const x of m.tueurs) ajouter("méthodes", `bt_tueur_${x}`);
}
for (const i of INSTRUMENTS) ajouter("instruments", `bt_cat_${i.categorie}`);
/**
 * ⚠️ LA LISTE VIENT DE `types.ts`, PAS DE MA MÉMOIRE. En la tapant à la main
 * j'avais inventé deux motifs qui n'existent pas, et le test avait signalé deux
 * clés manquantes qui n'auraient jamais dû être demandées. Un garde alimenté à
 * la main garde ce que son auteur a bien voulu se rappeler.
 */
const MOTIFS = (
  readFileSync(join(process.cwd(), "lib/backtest/types.ts"), "utf8")
    .split("export type MotifSortie =")[1]
    .split(";")[0]
    .match(/"([a-z_]+)"/g) ?? []
).map((x) => x.replace(/"/g, ""));
for (const motif of MOTIFS) ajouter("motifs", `bt_motif_${motif}`);
for (const v of ["insuffisant", "negatif", "non_concluant", "positif"]) {
  ajouter("verdicts", `bt_verdict_${v}`);
}

// 10. Les listes fermées, lues dans la source plutôt que recopiées.
//
// ⚠️ UN GARDE ALIMENTÉ À LA MAIN GARDE CE QUE SON AUTEUR A BIEN VOULU SE
// RAPPELER. En tapant les motifs de sortie de mémoire, j'en avais inventé deux
// qui n'existent pas, et oublié ceux qui existent.
function unionDe(fichier: string, nom: string): string[] {
  const source = readFileSync(join(process.cwd(), fichier), "utf8");
  const apres = source.split(`export type ${nom} =`)[1];
  if (!apres) return [];
  return (apres.split(";")[0].match(/"([a-z_0-9]+)"/g) ?? []).map((x) => x.replace(/"/g, ""));
}

for (const e of unionDe("lib/backtest/confluences.ts", "EffetDuFiltre")) {
  ajouter("confluences", `bt_conf_effet_${e}`, { part: 14, avec: "-0.05", sans: "+0.01" });
}
for (const f of unionDe("lib/backtest/robustesse.ts", "FormeDeStabilite")) {
  ajouter("robustesse", `bt_rob_forme_${f}`);
}
for (const f of unionDe("lib/backtest/robustesse.ts", "FormeDeRepartition")) {
  ajouter("robustesse", `bt_rob_forme_repartition_${f}`, { mois: "2025-03", part: 42 });
}
for (const v of unionDe("lib/backtest/verdict.ts", "CodeVerdict")) {
  ajouter("verdicts", `bt_verdict_${v}`);
}
for (const g of ["condamne", "lourd", "informatif"]) ajouter("gravités", `bt_grav_${g}`);
for (const g of unionDe("lib/backtest/coherence-plan.ts", "Gravite")) {
  ajouter("gravités", `bt_coh_${g}`);
}
for (const e of ["etabli", "pas_etabli", "pas_regarde"]) ajouter("piliers", `bt_syn_${e}`);
// ⚠️ Les dimensions viennent du catalogue lui-même : en les tapant de mémoire
// j'avais écrit « heures » là où le code dit « seance ».
for (const d of dimensionsDeRecherche(NAS)) {
  ajouter("exploration", `bt_exp_dim_${d.cle}`);
}

// 11. Ce que l'IA a traduit, et pourquoi.
//
// ⚠️⚠️ LA CARTE LA PLUS IMPORTANTE DE LA PAGE, et la dernière à avoir gardé
// des identifiants internes : c'est là que l'IA annonce ce qu'elle a décidé À LA
// PLACE du trader, et où il doit pouvoir répondre « ce n'est pas ça ».
const CHAMPS = [
  "uniteDeTemps",
  "sens",
  "contexte",
  "niveau",
  "declencheur",
  "confirmations",
  "entree",
  "stop",
  "objectif",
  "sortiesAuxiliaires",
  "gestion",
];

/**
 * Des justifications telles que le modèle les écrit, codes internes compris.
 *
 * ⚠️ CELLE DU MILIEU EST COPIÉE MOT POUR MOT DE L'ÉCRAN. C'est elle qui a fait
 * découvrir que le modèle nomme nos blocs avec nos identifiants, parce que ce
 * sont ceux qu'on lui donne dans le prompt.
 */
const JUSTIFICATIONS = [
  "Le trader place le stop derrière le dernier sommet : c'est dernier_pivot avec buffer.",
  "La fiche dit « cassure de trendline » : traduit en cassure sur un niveau trendline, mode cloture.",
  "Traduit en biais_moyenne sur 240 bougies, ce qui approche la lecture H4 du trader.",
  "Aucune règle écrite : on garde multiple_r à 2, et les_deux comme sens autorisés.",
  "Séances london et new_york fusionnées ; entree_dans_zone n'aurait rien donné ici.",
];

// ─── Les vérifications ─────────────────────────────────────────────────────

/** Une clé identique rendue avec les mêmes valeurs ne se teste qu'une fois. */
const uniques = new Map<string, AVerifier>();
for (const a of recolte) uniques.set(`${a.cle}|${JSON.stringify(a.valeurs ?? {})}`, a);
const aTester = Array.from(uniques.values());

/**
 * Les phrases déjà composées, une par langue.
 *
 * ⚠️ ON PASSE PAR LES VRAIES FONCTIONS DE COMPOSITION (`phrases.ts`), pas par
 * une imitation. Une imitation aurait produit des faux positifs (le composant
 * nommait déjà ces valeurs) et surtout des faux négatifs, ce qui est pire : le
 * test aurait certifié une phrase que personne n'affiche.
 */
function phrasesComposees(langue: Record<string, string>): { texte: string; origine: string }[] {
  const t = (cle: string, valeurs?: Record<string, string | number>) =>
    rendre(langue, cle, valeurs);
  const out: { texte: string; origine: string }[] = [];
  for (const m of modifications) {
    out.push({ texte: t(`bt_modif_${m.cle}`), origine: `nom du réglage ${m.cle}` });
    out.push({ texte: gesteDeLaModification(m, t), origine: `geste de ${m.cle}` });
    out.push({ texte: provenanceDeLaModification(m, t), origine: `provenance de ${m.cle}` });
    out.push({ texte: `${m.avant} → ${m.apres}`, origine: `valeurs de ${m.cle}` });
  }
  for (const [origine, l] of lignesDuPlan) {
    out.push({ texte: phraseDuPlan(l, t), origine: `${origine} · ${l.cle}` });
  }
  for (const champ of CHAMPS) {
    out.push({ texte: nommerUnChamp(champ, t), origine: `champ ${champ}` });
  }
  for (const j of JUSTIFICATIONS) {
    out.push({ texte: sansCodeInterne(j, t), origine: "justification de l'IA" });
  }
  return out;
}

describe("tout ce que l'onglet peut écrire", () => {
  it("produit de quoi tester quelque chose", () => {
    // Un garde sur le garde : si la matrice cesse de produire, les tests
    // ci-dessous passeraient en ne vérifiant rien du tout.
    expect(aTester.length).toBeGreaterThan(200);
    expect(modifications.length).toBeGreaterThan(50);
    expect(lignesDuPlan.length).toBeGreaterThan(50);
  });

  for (const [nom, langue] of Object.entries(LANGUES)) {
    describe(nom, () => {
      it("n'a aucune clé manquante", () => {
        const manquantes = aTester
          .filter((a) => langue[a.cle] === undefined)
          .map((a) => `${a.cle} (${a.origine})`);
        expect(Array.from(new Set(manquantes))).toEqual([]);
      });

      /**
       * ⚠️ « doit dominer non défini bougies » était un trou d'un autre genre :
       * la valeur était là, mais elle n'avait pas de sens. Ici on n'attrape que
       * le trou franc, celui qui laisse « {apres} » à l'écran.
       */
      it("ne laisse aucun remplacement en attente", () => {
        const trous = aTester
          .filter((a) => langue[a.cle] !== undefined && TROU.test(rendre(langue, a.cle, a.valeurs)))
          .map((a) => `${a.cle} → ${rendre(langue, a.cle, a.valeurs)} (${a.origine})`);
        expect(Array.from(new Set(trous))).toEqual([]);
      });

      /**
       * ⚠️⚠️ LE DÉFAUT LE PLUS FRÉQUENT DE TOUS. « trendline → range_horaire »,
       * « biais_moyenne (80) », « ote_fibonacci » : un identifiant interne
       * affiché tel quel, dans une carte dont le rôle est d'expliquer.
       */
      it("n'affiche jamais un identifiant interne", () => {
        const codes = aTester
          .filter((a) => {
            if (langue[a.cle] === undefined) return false;
            const rendu = rendre(langue, a.cle, a.valeurs);
            // Le gabarit lui-même peut contenir un mot souligné dans une URL ou
            // un exemple : on ne signale que ce qu'une VALEUR a introduit.
            return CODE_BRUT.test(rendu) && !CODE_BRUT.test(langue[a.cle]);
          })
          .map((a) => `${a.cle} → ${rendre(langue, a.cle, a.valeurs)} (${a.origine})`);
        expect(Array.from(new Set(codes))).toEqual([]);
      });

      /**
       * ⚠️ « intervalle [-0.000 ; 0.082] », « NaN bougies », « undefined R ».
       * Une valeur mal formée passe tous les tests de calcul et se voit tout de
       * suite à l'écran.
       */
      /**
       * ⚠️⚠️ LES PHRASES COMPOSÉES SONT CELLES OÙ TOUS LES DÉFAUTS ÉTAIENT.
       * « trendline → range_horaire », « Ta cible : multiple_r », « doit dominer
       * non défini bougies », « Réglé par toi, à la main ».
       */
      it("compose des phrases sans identifiant interne ni trou", () => {
        const fautes = phrasesComposees(langue)
          .filter(
            (p) =>
              CODE_BRUT.test(p.texte) ||
              TROU.test(p.texte) ||
              VALEUR_SALE.test(p.texte) ||
              p.texte.startsWith("!!MANQUANTE"),
          )
          .map((p) => `${p.origine} → ${p.texte}`);
        expect(Array.from(new Set(fautes))).toEqual([]);
      });

      it("n'affiche aucune valeur mal formée", () => {
        const sales = aTester
          .filter((a) => {
            if (langue[a.cle] === undefined) return false;
            const rendu = rendre(langue, a.cle, a.valeurs);
            return VALEUR_SALE.test(rendu) && !VALEUR_SALE.test(langue[a.cle]);
          })
          .map((a) => `${a.cle} → ${rendre(langue, a.cle, a.valeurs)} (${a.origine})`);
        expect(Array.from(new Set(sales))).toEqual([]);
      });
    });
  }
});
