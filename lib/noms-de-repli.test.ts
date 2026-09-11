import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "./i18n/fr";

/**
 * CE QU'ON AFFICHE À LA PLACE D'UN NOM MANQUANT EST UN NOM, PAS UNE CONSIGNE.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR « MES STRATÉGIES », UNE STRATÉGIE SANS NOM S'AFFICHAIT
 * « Sélectionner une stratégie ». Trois stratégies en base, deux qui portaient
 * leur nom, et la troisième déguisée en invite. Le trader clique sur ce qu'il
 * prend pour une consigne et ouvre une de ses propres méthodes — 2 284
 * caractères de sa stratégie réelle — sans jamais pouvoir la reconnaître, la
 * renommer ni la supprimer, puisqu'elle ne se présente pas comme une stratégie.
 *
 * ⚠️ L'ONGLET BACKTEST FAISAIT DÉJÀ CORRECTEMENT (« Sans nom »). Une seule des
 * deux pages était fautive, et c'est celle qui POSSÈDE les stratégies.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout repli de la forme `x.name || t("clé")` doit désigner un objet, pas
 * demander une action.
 */
describe("les noms de repli sont des noms", () => {
  const dico = fr as Record<string, string>;

  function fichiers(dossier: string, out: string[] = []): string[] {
    for (const f of readdirSync(dossier)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(dossier, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  const REPLI = /\.name\s*\|\|\s*(?:t|tr)\(\s*"([a-z0-9_]+)"\s*\)/g;

  const trouves = (() => {
    const out: { fichier: string; cle: string }[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const source = readFileSync(chemin, "utf8");
      REPLI.lastIndex = 0;
      let m;
      while ((m = REPLI.exec(source))) {
        out.push({ fichier: chemin.split(/[\\/]/).slice(-2).join("/"), cle: m[1] });
      }
    }
    return out;
  })();

  it("il y a bien des replis à contrôler, sinon ce test ne prouve rien", () => {
    expect(trouves.length).toBeGreaterThan(2);
  });

  /**
   * ⚠️ ON REFUSE LES VERBES D'INSTRUCTION, pas une liste de clés. Le jour où
   * quelqu'un replie sur « Ajouter une stratégie » ou « Choisir un compte », le
   * défaut est le même et la liste d'exemples ne l'attraperait pas.
   */
  const INSTRUCTION =
    /^(s[ée]lectionn|choisi|choose|select|ajoute|add|cr[ée]e|create|clique|click|entrer|enter)/i;

  it("aucun repli n'affiche une consigne à la place d'un nom", () => {
    const fautes: string[] = [];
    for (const { fichier, cle } of trouves) {
      const texte = dico[cle];
      if (typeof texte !== "string") {
        fautes.push(`${fichier} : ${cle} n'existe pas en français`);
        continue;
      }
      if (INSTRUCTION.test(texte.trim())) {
        fautes.push(`${fichier} : ${cle} = « ${texte} » demande une action`);
      }
      // Un nom de repli est court : une phrase entière n'est pas un nom.
      if (texte.length > 30) fautes.push(`${fichier} : ${cle} = « ${texte} » est une phrase`);
    }
    expect(fautes, fautes.join(" | ")).toEqual([]);
  });
});
