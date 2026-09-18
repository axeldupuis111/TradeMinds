import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMechanicalViolations, type SelectionStrategy, type SelectionTrade } from "./analysis-selection";
import { rattacherLesTrades } from "./rattachement-de-methode";

/**
 * UN TRADE PORTE LA MÉTHODE QUI L'A PRODUIT, ET C'EST ELLE QUI LE JUGE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `trades.strategy_id` EXISTE DEPUIS TOUJOURS ET N'EST QUASI JAMAIS REMPLI.
 * Mesuré en base le 2026-09-18 : ZÉRO trade rattaché sur les 157 d'un abonné
 * premium qui a trois fiches, 74 % chez le deuxième trader multi-fiches. Et
 * quand il l'est, c'est avec la fiche que la page avait choisie d'office — la
 * plus ancienne — jamais avec la méthode réellement suivie.
 *
 * ⚠️ CE QUE ÇA COÛTAIT : aucune règle de fiche n'était attribuable à un trade.
 * Les six surfaces qui jugent ont donc dû se rabattre sur l'UNION des fiches
 * (lib/regles-du-trader), c'est-à-dire sur le refus d'accuser. C'est honnête,
 * et c'est grossier : un trader qui respecte sa méthode swing et massacre sa
 * méthode scalping obtenait le même verdict que celui qui fait l'inverse.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Précision là où on sait, silence là où on ne sait pas. Un trade rattaché est
 * jugé sur SA fiche ; un trade sans rattachement garde l'union.
 *
 * Et le rattachement se fait en lot, sur la sélection que la liste des trades
 * offre déjà — celle qui sert à supprimer en masse.
 */

const RACINE = process.cwd();

const FICHE_OR: SelectionStrategy = {
  pairs: ["XAUUSD"],
  sessions: [],
  risk_reward: null,
  max_sl_pips: null,
  max_trades_per_day: null,
  max_consecutive_losses: null,
  max_daily_loss: null,
};

function trade(pair: string, strategy_id?: string | null, heureUtc = 10): SelectionTrade {
  return {
    open_time: `2026-09-15T${String(heureUtc).padStart(2, "0")}:00:00Z`,
    close_time: `2026-09-15T${String(heureUtc + 1).padStart(2, "0")}:00:00Z`,
    pair,
    direction: "long",
    entry_price: 4000,
    exit_price: 4010,
    lot_size: 1,
    sl: 3990,
    tp: 4020,
    pnl: 10,
    commission: 0,
    swap: 0,
    strategy_id,
  } as SelectionTrade;
}

describe("le jugement d'un trade rattaché", () => {
  const FICHE_NAS = { id: "nas", pairs: ["NAS100"], sessions: [] };

  /**
   * ⚠️⚠️ SANS RATTACHEMENT, ON NE PEUT QUE SE TAIRE : le trade pourrait relever
   * de n'importe laquelle de ses méthodes. C'est le comportement posé ce matin.
   */
  it("reste jugé sur l'union quand le trade n'est rattaché à rien", () => {
    const v = computeMechanicalViolations([trade("NAS100", null)], FICHE_OR, null, [FICHE_NAS]);
    expect(v.map((x) => x.type)).not.toContain("wrong_pair");
  });

  /**
   * ⚠️⚠️ AVEC RATTACHEMENT, ON SAIT : un trade rattaché à la méthode « or » et
   * pris sur le NAS100 enfreint bien SA méthode, et l'union ne doit plus
   * l'absoudre.
   */
  it("est jugé sur sa propre fiche quand il est rattaché", () => {
    const v = computeMechanicalViolations([trade("NAS100", "or")], { ...FICHE_OR, id: "or" } as never, null, [
      FICHE_NAS,
    ]);
    expect(
      v.map((x) => x.type),
      "un trade rattaché à la méthode « or » et pris sur le NAS100 passe encore",
    ).toContain("wrong_pair");
  });

  /** ⚠️ Et un trade rattaché à la méthode qui l'autorise reste innocent. */
  it("n'est pas fautif quand sa propre fiche l'autorise", () => {
    const v = computeMechanicalViolations([trade("NAS100", "nas")], { ...FICHE_OR, id: "or" } as never, null, [
      FICHE_NAS,
    ]);
    expect(v.map((x) => x.type)).not.toContain("wrong_pair");
  });

  /** ⚠️ Un identifiant inconnu (fiche supprimée) retombe sur l'union. */
  it("retombe sur l'union quand la fiche citée n'existe plus", () => {
    const v = computeMechanicalViolations([trade("NAS100", "fiche-effacee")], { ...FICHE_OR, id: "or" } as never, null, [
      FICHE_NAS,
    ]);
    expect(v.map((x) => x.type)).not.toContain("wrong_pair");
  });

  /** ⚠️ Les horaires suivent la même règle que les instruments. */
  it("juge l'horaire sur la fiche du trade", () => {
    const orLondres = { ...FICHE_OR, id: "or", sessions: ["london"] } as never;
    const nasNewYork = { id: "nas", pairs: ["NAS100"], sessions: ["new_york"] };
    // 14 h UTC : dans New York, hors de Londres.
    const v = computeMechanicalViolations([trade("XAUUSD", "or", 14)], orLondres, null, [nasNewYork]);
    expect(
      v.map((x) => x.type),
      "un trade rattaché à la méthode de Londres et pris à 14 h passe encore",
    ).toContain("wrong_session");
  });
});

describe("le rattachement en lot", () => {
  /** Client simulé : rend les lignes que la mise à jour prétend avoir touchées. */
  function client(parAppel: (unknown[] | null)[]) {
    let appel = 0;
    const b: Record<string, unknown> = {};
    for (const m of ["update", "in"]) b[m] = () => b;
    b.select = () => {
      const lignes = parAppel[Math.min(appel++, parAppel.length - 1)];
      return Promise.resolve(
        lignes === null ? { data: null, error: { message: "refusé" } } : { data: lignes, error: null },
      );
    };
    return { from: vi.fn(() => b) } as unknown as SupabaseClient;
  }

  it("ne fait rien sur une sélection vide", async () => {
    const r = await rattacherLesTrades(client([[]]), [], "s1");
    expect(r).toEqual({ rattaches: 0, demandes: 0, erreur: null });
  });

  /**
   * ⚠️⚠️ LE NOMBRE ANNONCÉ EST CELUI QUE LA BASE A TOUCHÉ. Une mise à jour qui
   * ne trouve aucune ligne n'est PAS une erreur pour PostgREST : ce dépôt a
   * déjà affiché seize fois « c'est fait » sur une écriture sans effet.
   */
  it("compte ce que la base a réellement touché", async () => {
    const r = await rattacherLesTrades(client([[{ id: "a" }, { id: "b" }]]), ["a", "b", "c"], "s1");
    expect(r.rattaches, "le compte annoncé est celui qu'on a demandé, pas celui qui est passé").toBe(2);
    expect(r.demandes).toBe(3);
  });

  /** ⚠️ Une tranche qui échoue n'annule pas les précédentes : on le dit. */
  it("rend le compte exact quand une tranche échoue", async () => {
    const cent = Array.from({ length: 100 }, (_, i) => ({ id: `t${i}` }));
    const ids = Array.from({ length: 150 }, (_, i) => `t${i}`);
    const r = await rattacherLesTrades(client([cent, null]), ids, "s1");
    expect(r.rattaches).toBe(100);
    expect(r.demandes).toBe(150);
    expect(r.erreur).toBe("refusé");
  });

  /** ⚠️ Et détacher est un rattachement à personne, pas une autre fonction. */
  it("détache avec le même chemin", async () => {
    const r = await rattacherLesTrades(client([[{ id: "a" }]]), ["a"], null);
    expect(r.rattaches).toBe(1);
    expect(r.erreur).toBeNull();
  });
});

describe("les écrans du rattachement", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const nu = (f: string) =>
    readFileSync(join(RACINE, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("la liste des trades sait rattacher une sélection", () => {
    const src = nu("components/trades/TradeList.tsx");
    expect(src, "la liste ne sait pas rattacher").toContain("rattacherLesTrades(");
    expect(src, "aucune commande de rattachement dans la barre de sélection").toContain(
      "trades_attach_action",
    );
  });

  /** ⚠️ La méthode qui estampille les NOUVEAUX trades doit se choisir. */
  it("la page des trades laisse choisir la méthode", () => {
    const src = nu("app/dashboard/trades/page.tsx");
    expect(src, "la page ne garde plus la liste des fiches").toContain("setStrategies(");
    expect(src, "le sélecteur de méthode a disparu").toContain('aria-label={t("strategy_select")}');
  });

  /** ⚠️ Et la méthode voyage avec le trade jusqu'au moteur de règles. */
  it("l'analyse envoie la méthode de chaque trade", () => {
    expect(nu("app/dashboard/analysis/page.tsx"), "strategy_id n'est plus lu").toContain(
      "vision_review, strategy_id",
    );
  });

  /**
   * ⚠️⚠️ « 1 TRADES SÉLECTIONNÉS », relevé à l'écran en production en
   * vérifiant la barre de rattachement. Le nombre était collé devant un libellé
   * figé au pluriel, alors que le produit a une syntaxe d'accord employée
   * partout ailleurs (`{n|singulier|pluriel}`, voir lib/remplir).
   */
  it("le compteur de sélection s'accorde", () => {
    for (const langue of ["fr", "en", "de", "es"]) {
      const dict = readFileSync(join(RACINE, `lib/i18n/${langue}.ts`), "utf8");
      const ligne = dict.split("\n").find((l) => l.includes('"trades_selected"')) ?? "";
      expect(ligne, `« 1 trades sélectionnés » en ${langue}`).toContain("{n|");
    }
    expect(nu("components/trades/TradeList.tsx"), "le nombre est encore collé devant le libellé").toContain(
      't("trades_selected", { n:',
    );
  });

  it("les messages existent dans les quatre langues", () => {
    for (const langue of ["fr", "en", "de", "es"]) {
      const dict = readFileSync(join(RACINE, `lib/i18n/${langue}.ts`), "utf8");
      for (const cle of [
        "trades_attach_label",
        "trades_attach_choose",
        "trades_attach_action",
        "trades_attach_done",
        "trades_attach_partial",
        "trades_attach_failed",
      ]) {
        expect(dict, `${cle} absent en ${langue}`).toContain(`"${cle}"`);
      }
    }
  });
});
