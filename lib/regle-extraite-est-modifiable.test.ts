import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * UNE RÈGLE EXTRAITE EST UNE RÈGLE MODIFIABLE, ET UNE RÈGLE ENREGISTRÉE.
 *
 * ── LE DÉFAUT, MESURÉ ───────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `max_daily_loss` ÉTAIT EXTRAITE, UTILISÉE, ET INTROUVABLE. Le bloc de la
 * page Stratégie s'intitule « Règles extraites (modifiable) » et cette
 * règle-là n'y figurait pas, alors que :
 *
 *   - `/api/parse-strategy` la demande explicitement au modèle ;
 *   - la page Session l'affiche (« Perte max journalière : 5 % ») ;
 *   - `/api/analyze` en tire la violation `violation_max_daily_loss`, dans
 *     l'analyse que le trader PAIE.
 *
 * Relevé le 2026-09-16 sur les quatre stratégies d'un compte : une seule
 * portait une valeur (5 %), extraite un jour par le modèle et impossible à
 * corriger depuis ; les trois autres valaient `null`, donc leur violation ne
 * pouvait jamais se déclencher.
 *
 * ⚠️ ET LA RÉANALYSE NE LA RAFRAÎCHISSAIT PAS. Le payload d'enregistrement
 * listait huit champs sur neuf : relancer l'analyse mettait tout à jour SAUF
 * celui-là. La valeur restait figée sur la toute première extraction.
 *
 * ⚠️ CE QUI A SAUVÉ LES DONNÉES : `.update()` avec un objet PARTIEL laisse les
 * colonnes absentes intactes. Un `upsert` d'une ligne complète aurait effacé la
 * valeur au premier enregistrement manuel.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout champ chiffré que le modèle est chargé d'extraire doit se retrouver
 * DANS LE FORMULAIRE et DANS L'ENREGISTREMENT. Sinon le produit se sert d'une
 * valeur que le trader ne peut ni voir, ni corriger, ni rafraîchir.
 */
describe("les règles extraites de la stratégie", () => {
  const RACINE = process.cwd();
  const page = () => readFileSync(join(RACINE, "app/dashboard/strategy/page.tsx"), "utf8");
  const routeParse = () => readFileSync(join(RACINE, "app/api/parse-strategy/route.ts"), "utf8");

  /**
   * Les champs chiffrés que le prompt d'extraction réclame.
   *
   * ⚠️ LA LISTE VIENT DU PROMPT, PAS D'UNE INTUITION : on lit ce que la route
   * demande vraiment au modèle, pour que l'ajout d'un champ là-bas fasse
   * échouer ici tant qu'il n'est pas branché à l'écran.
   */
  function champsDemandesAuModele(): string[] {
    const src = routeParse();
    const champs = new Set<string>();
    for (const m of Array.from(src.matchAll(/"(max_[a-z_]+|risk_[a-z_]+)"\s*:\s*number/g))) {
      champs.add(m[1]);
    }
    return Array.from(champs).sort();
  }

  it("le prompt d'extraction réclame bien des champs chiffrés", () => {
    const champs = champsDemandesAuModele();
    expect(champs.length, "plus aucun champ chiffré n'est demandé : le balayage est cassé").toBeGreaterThan(4);
    expect(champs, "le champ du défaut d'origine n'est plus demandé").toContain("max_daily_loss");
  });

  it("chaque règle chiffrée demandée au modèle est éditable à l'écran", () => {
    const src = page();
    const manquants = champsDemandesAuModele().filter(
      (champ) => !new RegExp(`updateParsedField\\("${champ}"`).test(src),
    );
    expect(
      manquants,
      "règles extraites par le modèle mais absentes du formulaire « Règles extraites (modifiable) » : " +
        manquants.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ÊTRE À L'ÉCRAN NE SUFFIT PAS : c'est le payload qui décide de ce qui est
   * écrit. Le défaut d'origine tenait précisément à un champ présent partout
   * sauf là.
   */
  it("chaque règle chiffrée demandée au modèle est enregistrée", () => {
    const src = page();
    const debut = src.indexOf("const payload = {");
    expect(debut, "le payload d'enregistrement a changé de forme").toBeGreaterThan(-1);
    const payload = src.slice(debut, src.indexOf("};", debut));
    const manquants = champsDemandesAuModele().filter(
      (champ) => !payload.includes(`${champ}: parsed.${champ}`),
    );
    expect(
      manquants,
      "règles extraites que l'enregistrement n'écrit pas — relancer l'analyse ne les " +
        "rafraîchira jamais : " + manquants.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET L'ENREGISTREMENT RESTE PARTIEL. Passer à un objet complet (ou à un
   * `upsert`) effacerait toute colonne oubliée, ce qui transformerait ce défaut
   * d'affichage en perte de données.
   */
  it("l'enregistrement met à jour sans écraser les colonnes absentes", () => {
    expect(page()).toContain('.from("strategies").update(payload).eq("id", existingId)');
  });

  it("le nouveau champ porte un libellé dans les quatre langues", () => {
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const d = dico as Record<string, string>;
      expect(d["strategy_max_daily_loss"], `libellé manquant en ${nom}`).toBeTruthy();
      expect(d["strategy_max_daily_loss_tooltip"], `infobulle manquante en ${nom}`).toBeTruthy();
      expect(d["strategy_max_daily_loss_tooltip"].length).toBeGreaterThan(30);
    }
  });
});
