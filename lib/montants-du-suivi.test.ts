import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * SUR UN MÊME ÉCRAN, UN MONTANT S'ÉCRIT D'UNE SEULE FAÇON.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA PAGE DE SUIVI DE COMPTE AFFICHAIT LE MÊME PROFIT DEUX FOIS, ARRONDI
 * DIFFÉREMMENT. Relevé sur le compte réel : « Profit target 8 967€ / 4 000€ »
 * dans la barre de progression, et « P&L total +8 966,50€ » dix lignes plus
 * bas. C'est le même nombre, à cinquante centimes près.
 *
 * ⚠️⚠️ ET LES CHIFFRES NE TOMBAIENT PLUS JUSTE. La carte Balance affichait
 * « 58 967€ » pour un compte de 50 000 € et un profit de 8 966,50 € : posée à
 * côté, l'addition du lecteur donne 58 966,50. Un écran dont les nombres ne se
 * recollent pas fait douter de tous les autres, sur la page qui sert
 * précisément à vérifier qu'on ne franchit pas une limite.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Tout montant MESURÉ de cette page s'écrit au centime.
 *
 * ⚠️ LA TAILLE NOMINALE DU COMPTE FAIT EXCEPTION, et pour une raison qui
 * tient : ce n'est pas une mesure mais une SAISIE, un nombre rond que le
 * trader a tapé lui-même (50 000). Lui coller des centimes n'ajouterait aucune
 * précision, seulement du bruit dans un titre.
 *
 * ⚠️ ET LA RÈGLE NE VAUT PAS POUR TOUT LE PRODUIT : les graduations d'un axe
 * de graphique, ou un montant volontairement arrondi avant d'être écrit, ont
 * de bonnes raisons de rester ronds. Ce test tient l'écran où la divergence a
 * été VUE, il ne généralise pas une convention qui n'existe pas.
 */
describe("les montants du suivi de compte s'écrivent au centime", () => {
  const source = () =>
    sansCommentaires(readFileSync(join(process.cwd(), "app/dashboard/challenge/page.tsx"), "utf8"));

  /**
   * L'appel complet, parenthèses comptées.
   *
   * ⚠️ PAS « JUSQU'À LA PREMIÈRE PARENTHÈSE FERMANTE » : ma première version
   * s'arrêtait au milieu de `money(pnl, accountCurrency(c), { digits: 2 })` et
   * accusait trois appels parfaitement corrects. Un argument imbriqué n'est
   * pas une fin d'appel.
   */
  function appelComplet(src: string, depart: number): string {
    let prof = 0;
    for (let i = depart; i < src.length; i++) {
      if (src[i] === "(") prof++;
      else if (src[i] === ")") {
        prof--;
        if (prof === 0) return src.slice(depart, i + 1);
      }
    }
    return src.slice(depart, depart + 120);
  }

  it("aucun montant mesuré n'est arrondi à l'unité", () => {
    const fautes: string[] = [];
    const src = source();
    for (const m of Array.from(src.matchAll(/money\(/g))) {
      const appel = appelComplet(src, m.index! + "money".length);
      // La taille nominale du compte : une saisie, pas une mesure.
      if (/account_size/.test(appel)) continue;
      if (/digits:\s*2/.test(appel)) continue;
      fautes.push(`ligne ${src.slice(0, m.index!).split(/\r?\n/).length} : ${appel.replace(/\s+/g, " ").slice(0, 70)}`);
    }
    expect(fautes, "montants arrondis à l'unité : " + fautes.join(" | ")).toEqual([]);
  });

  /** ⚠️ Et la sonde trouve bien quelque chose : sans ça, elle dirait oui à tout. */
  it("la sonde voit les montants de la page", () => {
    const src = source();
    const n = Array.from(src.matchAll(/money\(/g)).length;
    expect(n, "aucun montant trouvé sur la page de suivi").toBeGreaterThan(10);
  });

  /**
   * ⚠️ ET LES DEUX FAÇONS D'ANNONCER LE PROFIT RESTENT ACCROCHÉES : la barre
   * de progression et la carte P&L. C'est ce couple précis qui divergeait.
   */
  it("la barre de progression et la carte P&L s'écrivent pareil", () => {
    const src = source();
    expect(src).toContain("{money(value, currency, { digits: 2 })} / {money(max, currency, { digits: 2 })}");
    expect(src).toContain("{money(currentPnl, cur, { digits: 2, signed: true })}");
  });
});
