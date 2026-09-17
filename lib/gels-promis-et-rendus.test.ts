import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeCoachTool, COACH_TOOLS } from "./coach-tools";
import { etatDesGels, jourAGeler } from "./gels-de-serie";

/**
 * UN OUTIL TIENT CE QUE SA DESCRIPTION PROMET.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `get_leaderboard_standing` ANNONÇAIT AU MODÈLE, À CHAQUE MESSAGE :
 * « Classement, badges et gels de série du trader. Répond à [...] "il me reste
 * des gels" ». Son résultat ne portait ni quota, ni consommation, ni reste. Le
 * coach n'avait donc qu'un seul moyen de répondre à la question qu'on lui
 * disait de prendre : inventer.
 *
 * ⚠️ RÉPARATION INCOMPLÈTE, PAS OUBLI D'ORIGINE. L'outil lisait
 * `profiles.streak_freezes_used`, une colonne qui n'a jamais existé ; on a
 * retiré la lecture morte sans remettre le chiffre vivant, et la promesse est
 * restée dans la description. C'est la forme dominante des défauts de ce
 * dépôt : une règle écrite, appliquée à une partie seulement de ce qu'elle
 * vise.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le reste de gels a UNE formule (`lib/gels-de-serie.ts`), et les deux surfaces
 * qui l'annoncent la lisent. Elle vivait dans un composant client, hors de
 * portée du serveur : c'est exactement comme ça que naissent deux chiffres pour
 * le même fait.
 */

const RACINE = process.cwd();
const USER = "11111111-1111-4111-8111-111111111111";

function gel(day: string, created_at: string) {
  return { day, created_at };
}

describe("le reste de gels", () => {
  it("part du quota de base quand rien n'a été dépensé", () => {
    const e = etatDesGels([], [], [], "2026-09");
    expect(e.quota).toBe(2);
    expect(e.restants).toBe(2);
    expect(e.utilises).toBe(0);
  });

  it("décompte les gels du mois, et seulement ceux-là", () => {
    const gels = [gel("2026-08-03", "2026-08-03T10:00:00Z"), gel("2026-09-02", "2026-09-02T10:00:00Z")];
    expect(etatDesGels(gels, [], [], "2026-09").utilises).toBe(1);
    expect(etatDesGels(gels, [], [], "2026-09").restants).toBe(1);
    expect(etatDesGels(gels, [], [], "2026-08").utilises).toBe(1);
  });

  /**
   * ⚠️ LE MOIS EST CELUI DU TRADER. Passé en UTC, le quota d'un trader à Sydney
   * changeait de mois dix heures trop tard : le 1er au matin il comptait encore
   * les gels du mois précédent. Le mois arrive donc en paramètre, calculé par
   * l'appelant dans le fuseau du trader.
   */
  it("ne connaît pas d'autre mois que celui qu'on lui donne", () => {
    const gels = [gel("2026-09-30", "2026-09-30T23:30:00Z")];
    expect(etatDesGels(gels, [], [], "2026-09").utilises).toBe(1);
    expect(etatDesGels(gels, [], [], "2026-10").utilises).toBe(0);
  });

  it("ajoute les gels permanents gagnés par les badges", () => {
    const sans = etatDesGels([], [], [], "2026-09").quota;
    const avec = etatDesGels([], ["streak_7", "regular", "marathon", "discipline_gold"], [], "2026-09").quota;
    expect(avec, "les badges n'offrent plus aucun gel : la récompense est vide").toBeGreaterThan(sans);
  });

  it("ajoute les défis réussis DU MOIS, plafonnés", () => {
    const defis = (n: number, mois: string) =>
      Array.from({ length: n }, () => ({ awarded_at: `${mois}-05T10:00:00Z` }));
    expect(etatDesGels([], [], defis(3, "2026-09"), "2026-09").quota).toBe(5);
    expect(
      etatDesGels([], [], defis(12, "2026-09"), "2026-09").quota,
      "une grosse semaine rend la série incassable : le plafond a sauté",
    ).toBe(6);
    expect(etatDesGels([], [], defis(3, "2026-08"), "2026-09").quota).toBe(2);
  });

  it("ne descend jamais sous zéro", () => {
    const gels = Array.from({ length: 9 }, (_, i) => gel(`2026-09-0${i + 1}`, `2026-09-0${i + 1}T10:00:00Z`));
    expect(etatDesGels(gels, [], [], "2026-09").restants).toBe(0);
  });
});

describe("le jour qu'un gel réparerait", () => {
  const MAINTENANT = new Date("2026-09-17T12:00:00Z").getTime();

  it("est le plus récent jour fautif", () => {
    const jours = new Map([
      ["2026-09-08", true],
      ["2026-09-10", false],
      ["2026-09-12", true],
    ]);
    expect(jourAGeler(jours, new Set(), MAINTENANT)).toBe("2026-09-12");
  });

  it("saute un jour déjà gelé", () => {
    const jours = new Map([
      ["2026-09-08", true],
      ["2026-09-12", true],
    ]);
    expect(jourAGeler(jours, new Set(["2026-09-12"]), MAINTENANT)).toBe("2026-09-08");
  });

  it("ne propose rien de trop vieux pour valoir la peine", () => {
    const jours = new Map([["2026-06-01", true]]);
    expect(jourAGeler(jours, new Set(), MAINTENANT)).toBeNull();
  });

  it("ne propose rien quand rien n'est fautif", () => {
    expect(jourAGeler(new Map([["2026-09-12", false]]), new Set(), MAINTENANT)).toBeNull();
  });
});

/** Client simulé choisissant sa réponse d'après la TABLE interrogée. */
function client(reponses: Record<string, unknown[]>): SupabaseClient {
  const construire = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "range", "maybeSingle", "is", "in"]) {
      b[m] = () => b;
    }
    b.then = (resolve: (v: unknown) => unknown) => {
      const prete = reponses[table];
      if (prete === undefined) throw new Error(`Table « ${table} » interrogée sans réponse préparée.`);
      return resolve({ data: table === "profiles" ? prete[0] : prete, error: null });
    };
    return b;
  };
  return { from: vi.fn((t: string) => construire(t)) } as unknown as SupabaseClient;
}

describe("get_leaderboard_standing", () => {
  const BASE = {
    profiles: [{ username: "axel", plan: "plus" }],
    badge_awards: [],
    trades: [],
    streak_freezes: [],
    challenge_awards: [],
  } as Record<string, unknown[]>;

  it("rend le reste de gels que sa description promet", async () => {
    const r = await executeCoachTool(
      client({ ...BASE, streak_freezes: [gel("2026-09-02", "2026-09-02T10:00:00Z")] }),
      USER,
      "get_leaderboard_standing",
      {},
      "Europe/Paris",
    );
    const res = r.result as Record<string, unknown>;
    expect(res.gels_quota_du_mois, "le quota du mois n'est plus annoncé").toBe(2);
    expect(typeof res.gels_restants, "le coach ne peut toujours pas répondre « il me reste des gels »").toBe("number");
    expect(typeof res.gels_utilises_ce_mois).toBe("number");
  });

  /**
   * ⚠️ LE CHIFFRE VIENT DES GELS LUS, pas d'une constante. Sans ce test, rendre
   * `gels_restants: 2` en dur passerait au vert au-dessus.
   */
  it("le reste baisse quand le trader dépense un gel", async () => {
    const mois = new Date().toISOString().slice(0, 7);
    const vide = await executeCoachTool(client(BASE), USER, "get_leaderboard_standing", {}, "UTC");
    const apres = await executeCoachTool(
      client({ ...BASE, streak_freezes: [gel(`${mois}-02`, `${mois}-02T10:00:00Z`)] }),
      USER,
      "get_leaderboard_standing",
      {},
      "UTC",
    );
    expect((apres.result as { gels_restants: number }).gels_restants).toBe(
      (vide.result as { gels_restants: number }).gels_restants - 1,
    );
  });

  /**
   * ⚠️⚠️ CE QUE LA DESCRIPTION PROMET, LE RÉSULTAT LE PORTE. C'est le garde qui
   * aurait trouvé ce défaut : la description nomme trois sujets, le résultat
   * n'en servait que deux. On vérifie les trois, sur un appel réel.
   */
  it("chaque sujet annoncé dans la description a sa réponse dans le résultat", async () => {
    const outil = COACH_TOOLS.find((o) => o.name === "get_leaderboard_standing");
    expect(outil, "l'outil a disparu du catalogue").toBeTruthy();
    const description = outil!.description.toLowerCase();

    const r = await executeCoachTool(client(BASE), USER, "get_leaderboard_standing", {}, "UTC");
    const cles = Object.keys(r.result as Record<string, unknown>).join(" ");

    const promesses: [string, RegExp][] = [
      ["gels", /gels_/],
      ["badges", /badge/],
      ["classement", /listed|username|note/],
    ];
    const trahies = promesses
      .filter(([mot]) => description.includes(mot))
      .filter(([, cle]) => !cle.test(cles))
      .map(([mot]) => mot);
    expect(
      trahies,
      "sujets annoncés au modèle et absents du résultat : il ne peut y répondre " +
        "qu'en inventant :\n  " + trahies.join("\n  "),
    ).toEqual([]);
  });
});

describe("la formule du reste de gels", () => {
  /**
   * ⚠️ UNE SEULE. L'écran et le coach doivent annoncer le même reste ; deux
   * additions écrites séparément, c'est le défaut que ce dépôt a déjà payé sur
   * la série de discipline elle-même.
   */
  it("n'est pas réécrite dans le composant de l'écran", () => {
    const src = readFileSync(join(RACINE, "components/dashboard/GoalsStreaks.tsx"), "utf8");
    expect(src, "l'écran ne lit plus la formule partagée").toContain("etatDesGels(");
    for (const morceau of ["freezeBonusFor(", "challengeFreezeBonus("]) {
      expect(src, `l'addition des gels est de nouveau recopiée ici (${morceau})`).not.toContain(morceau);
    }
  });
});
