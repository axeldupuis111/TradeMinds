import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { challengesForWeek, previousWeekKey, weekDayKeys } from "./community-challenges";
import { SEMAINES_RATTRAPEES, cloturerLesSemaines, semainesARattraper } from "./cloture-des-defis";

/**
 * UNE SEMAINE QUE PERSONNE N'OUVRE DOIT QUAND MÊME ÊTRE CLÔTURÉE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA CLÔTURE NE REGARDAIT QUE LA SEMAINE IMMÉDIATEMENT PRÉCÉDENTE. Elle se
 * déclenche au chargement de la page des défis : si personne ne l'ouvrait
 * pendant la semaine N+1, la semaine N restait ouverte, et plus rien ne
 * revenait jamais la fermer. Le gel promis à qui avait terminé son défi
 * n'était jamais crédité, et il n'en restait aucune trace.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : cinq semaines closes (W28, W30, W31, W32,
 * W37) contre CINQ MANQUANTES (W29, W33, W34, W35, W36), pendant que les plans
 * hebdomadaires couvrent W32 à W37 sans interruption.
 *
 * ⚠️ C'EST LA FORME HABITUELLE DES DÉFAUTS DE CE DÉPÔT : une règle écrite
 * (« la semaine passée se clôture toute seule ») appliquée à une partie
 * seulement de ce qu'elle vise (la semaine passée, et seulement si quelqu'un
 * passe). Voir la fiche `une-regle-appliquee-a-moitie`.
 */

const RACINE = process.cwd();

// ── La fenêtre de rattrapage ────────────────────────────────────────────────

describe("les semaines à rattraper", () => {
  /** ⚠️⚠️ LE CŒUR DU DÉFAUT : trois semaines sautées restent trois semaines dues. */
  it("rend toutes les semaines non closes, pas seulement la dernière", () => {
    const a = semainesARattraper("2026-W37", ["2026-W32", "2026-W37"], 8);
    expect(a, "les semaines creuses ont été oubliées").toContain("2026-W36");
    expect(a).toContain("2026-W35");
    expect(a).toContain("2026-W33");
    expect(a, "une semaine déjà close est reclôturée").not.toContain("2026-W32");
    expect(a, "une semaine déjà close est reclôturée").not.toContain("2026-W37");
  });

  /** ⚠️ DE LA PLUS ANCIENNE À LA PLUS RÉCENTE : une clôture lit la semaine d'avant. */
  it("les rend de la plus ancienne à la plus récente", () => {
    const a = semainesARattraper("2026-W37", [], 4);
    expect(a).toEqual(["2026-W34", "2026-W35", "2026-W36", "2026-W37"]);
  });

  /** ⚠️ ET LA FENÊTRE EST BORNÉE : jamais toute l'histoire du produit. */
  it("ne remonte pas au-delà de la fenêtre", () => {
    expect(semainesARattraper("2026-W37", [], SEMAINES_RATTRAPEES)).toHaveLength(SEMAINES_RATTRAPEES);
    expect(semainesARattraper("2026-W37", [], 3)).toHaveLength(3);
  });
});

// ── La clôture elle-même ────────────────────────────────────────────────────

interface Faux {
  client: SupabaseClient;
  lues: string[];
  marquees: string[];
  awards: { week_key: string }[];
}

/**
 * Client simulé. `inscrits` donne les participations par semaine, `closes` les
 * marqueurs déjà posés, `echecAwards` fait échouer l'écriture des récompenses.
 */
function faux(opts: {
  closes?: string[];
  inscrits?: Record<string, { user_id: string; challenge_key: string }[]>;
  reviews?: { user_id: string; discipline_score: number; created_at: string }[];
  trades?: { user_id: string; emotion: string | null; open_time: string }[];
  echecAwards?: boolean;
  echecMarqueur?: string;
}): Faux {
  const lues: string[] = [];
  const marquees: string[] = [];
  const awards: { week_key: string }[] = [];

  const table = (nom: string) => {
    lues.push(nom);
    let semaine = "";
    const b: Record<string, unknown> = {};
    const donnees = (): { data: unknown; error: unknown } => {
      if (nom === "challenge_week_closures") {
        return { data: (opts.closes ?? []).map((w) => ({ week_key: w })), error: null };
      }
      if (nom === "challenge_participations") {
        return { data: (opts.inscrits ?? {})[semaine] ?? [], error: null };
      }
      if (nom === "profiles") return { data: [{ id: "u1", timezone: "UTC" }], error: null };
      if (nom === "trades") return { data: opts.trades ?? [], error: null };
      if (nom === "session_reviews") return { data: opts.reviews ?? [], error: null };
      return { data: [], error: null };
    };
    for (const m of ["select", "in", "gte", "lte", "order", "neq", "is"]) b[m] = () => b;
    b.eq = (col: string, val: string) => {
      if (col === "week_key") semaine = val;
      return b;
    };
    b.upsert = (payload: unknown) => {
      if (nom === "challenge_awards") {
        if (opts.echecAwards) return Promise.resolve({ error: { message: "refusé" } });
        awards.push(...(payload as { week_key: string }[]));
        return Promise.resolve({ error: null });
      }
      const w = (payload as { week_key: string }).week_key;
      if (opts.echecMarqueur === w) return Promise.resolve({ error: { message: "refusé" } });
      marquees.push(w);
      return Promise.resolve({ error: null });
    };
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(donnees()).then(resolve);
    return b;
  };

  return { client: { from: (t: string) => table(t) } as never, lues, marquees, awards };
}

describe("la clôture des défis", () => {
  /** ⚠️⚠️ LE DÉFAUT MESURÉ EN BASE, REJOUÉ : quatre semaines creuses d'affilée. */
  it("clôture les semaines que personne n'avait ouvertes", async () => {
    const f = faux({ closes: ["2026-W32"] });
    const faites = await cloturerLesSemaines(f.client, "2026-W36", 5);
    expect(faites, "les semaines sautées restent ouvertes pour toujours").toEqual([
      "2026-W33",
      "2026-W34",
      "2026-W35",
      "2026-W36",
    ]);
    expect(f.marquees).toEqual(["2026-W33", "2026-W34", "2026-W35", "2026-W36"]);
  });

  /**
   * ⚠️ LE CAS COURANT NE COÛTE RIEN. Sans inscrit, la clôture ne lit ni les
   * profils, ni les trades, ni les bilans : c'est ce qui permet au rattrapage
   * de tenir dans le chemin critique de la page.
   */
  it("ne lit rien d'autre pour une semaine sans inscrit", async () => {
    const f = faux({});
    await cloturerLesSemaines(f.client, "2026-W36", 4);
    expect(f.lues, "une semaine vide déclenche une lecture de trades").not.toContain("trades");
    expect(f.lues).not.toContain("session_reviews");
    expect(f.marquees).toHaveLength(4);
  });

  /** Une semaine déjà close n'est pas rejouée. */
  it("ne reclôture pas une semaine déjà close", async () => {
    const f = faux({ closes: ["2026-W35", "2026-W36"] });
    await cloturerLesSemaines(f.client, "2026-W36", 2);
    expect(f.marquees).toEqual([]);
  });

  // Une semaine avec un inscrit sur le premier défi tiré, et de quoi faire
  // progresser n'importe laquelle des métriques du catalogue.
  const SEMAINE = "2026-W35";
  const defi = challengesForWeek(SEMAINE)[0];
  const jours = weekDayKeys(SEMAINE);
  const joursAvant = weekDayKeys(previousWeekKey(SEMAINE));
  const avecInscrit = {
    inscrits: { [SEMAINE]: [{ user_id: "u1", challenge_key: defi.key }] },
    reviews: [
      ...jours.map((j) => ({ user_id: "u1", discipline_score: 100, created_at: `${j}T06:00:00Z` })),
      ...joursAvant.map((j) => ({ user_id: "u1", discipline_score: 50, created_at: `${j}T06:00:00Z` })),
    ],
    trades: jours.map((j) => ({ user_id: "u1", emotion: "calm", open_time: `${j}T09:00:00Z` })),
  };

  it("écrit les récompenses d'une semaine rattrapée", async () => {
    const f = faux({ ...avecInscrit, closes: [] });
    await cloturerLesSemaines(f.client, SEMAINE, 1);
    expect(f.awards.length, "la semaine a été close sans distribuer ses récompenses").toBeGreaterThan(0);
    expect(f.awards[0].week_key).toBe(SEMAINE);
    expect(f.marquees).toEqual([SEMAINE]);
  });

  /**
   * ⚠️⚠️ LA RÈGLE DÉJÀ ÉCRITE DANS LA ROUTE, QUI DOIT SURVIVRE AU RATTRAPAGE :
   * le marqueur vient APRÈS les récompenses. Le poser quand même fermerait la
   * semaine à jamais avec zéro gel distribué, sans aucune trace.
   */
  it("ne marque pas close une semaine dont les récompenses ont été refusées", async () => {
    const f = faux({ ...avecInscrit, echecAwards: true });
    const faites = await cloturerLesSemaines(f.client, SEMAINE, 1);
    expect(f.marquees, "semaine close alors que personne n'a été récompensé").toEqual([]);
    expect(faites).toEqual([]);
  });

  /**
   * ⚠️ UN ÉCHEC ARRÊTE LE RATTRAPAGE. Sauter par-dessus clôturerait les
   * semaines suivantes pendant que la fautive reste ouverte, et la fenêtre
   * glissante finirait par ne plus la voir du tout : le défaut d'origine,
   * reconstitué par sa propre correction.
   */
  it("s'arrête à la première semaine qui échoue", async () => {
    const f = faux({ echecMarqueur: "2026-W34" });
    await cloturerLesSemaines(f.client, "2026-W36", 4);
    expect(f.marquees, "le rattrapage a enjambé une semaine restée ouverte").toEqual(["2026-W33"]);
  });
});

// ── Et la route délègue ─────────────────────────────────────────────────────

describe("la route des défis", () => {
  const src = readFileSync(join(RACINE, "app/api/community-challenges/route.ts"), "utf8");
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les tester ferait passer le garde
  // sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("ne clôture plus la seule semaine précédente", () => {
    expect(code, "la route a repris une clôture à elle").not.toContain("challenge_week_closures");
    expect(code).toContain("cloturerLesSemaines(admin, prevKey)");
  });
});
