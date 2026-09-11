import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN E-MAIL NE PORTE PAS UNE DEVISE QU'IL N'A PAS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `resolveUserCurrency` NE REGARDE QUE LES COMPTES ACTIFS, et répond
 * « euro » dès qu'ils n'en partagent pas une. Les deux e-mails qui annoncent un
 * montant portent pourtant sur des TRADES : le bilan hebdomadaire sur ceux de
 * la semaine, l'e-mail de relance sur le P&L CUMULÉ de toute la vie du compte,
 * qui traverse par définition les comptes clôturés. Ils affichaient donc une
 * somme d'euros et de dollars sous un seul symbole, avec assurance.
 *
 * ⚠️ C'EST EXACTEMENT L'ERREUR MESURÉE SUR ANALYTICS le même jour : la fonction
 * faisait bien son travail, on lui posait la question sur le mauvais ensemble.
 *
 * ⚠️ ET UN E-MAIL EST UNE SURFACE SANS RECOURS : il part, il reste dans la
 * boîte, et son sujet contient le chiffre. Rien à côté ne permet de le
 * recouper, comme pour les PDF et la carte sociale du profil public.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * La devise se déduit des TRADES que l'envoi résume. Quand ils en mêlent
 * plusieurs, le total se ventile : ce sont les mêmes montants, écrits
 * séparément, donc rien de nouveau à traduire dans les quatre langues.
 */
describe("les montants des e-mails", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  /** Les deux routes qui écrivent un montant à un humain. */
  const ENVOIS = ["app/api/weekly-report/route.ts", "app/api/reactivation/route.ts"];

  it("sont bien écrits par ces routes-là, sinon ce test ne prouve rien", () => {
    for (const chemin of ENVOIS) {
      expect(lire(chemin), `${chemin} n'écrit plus de montant`).toContain('style: "currency"');
    }
  });

  it("se déduisent des trades, pas des seuls comptes actifs", () => {
    for (const chemin of ENVOIS) {
      const src = lire(chemin);
      expect(src, `${chemin} ne lit pas la devise de tous les comptes`).toContain(
        "resolveAccountCurrencies(supabase, user.id as string)",
      );
      expect(src, `${chemin} ne ventile pas`).toContain("sumByCurrency(");
      expect(src, `${chemin} ne lit pas le compte de chaque trade`).toMatch(/challenge_id/);
    }
  });

  /**
   * ⚠️ LE SUJET ET LA NOTIFICATION AUSSI. Corriger le corps de l'e-mail et
   * laisser le montant faux dans la ligne d'objet, c'est ne rien corriger :
   * c'est la seule partie que tout le monde lit.
   */
  it("le bilan hebdomadaire écrit le même total partout", () => {
    const src = lire("app/api/weekly-report/route.ts");
    expect(src).toContain("subject: copy.subject(totalLisible, stats.count),");
    expect(src, "le pré-en-tête garde l'ancien total").toContain("preheader: `${totalLisible}");
    expect(src, "la notification push garde l'ancien total").toContain("body: `${totalLisible}");
    // ⚠️ Motif tolérant au CRLF : une chaîne multiligne écrite avec `\n` ne
    // correspond à rien dans un fichier que git a rendu en CRLF.
    expect(src, "le grand chiffre du corps garde l'ancien total").toMatch(
      /\$\{totalLisible\}\r?\n\s*<\/div>/,
    );
  });

  /**
   * ⚠️ ET LE MEILLEUR TRADE PORTE SA PROPRE DEVISE. Ce sont deux lignes, pas
   * deux termes d'une somme : leur coller la devise du total serait refaire le
   * défaut une ligne plus bas.
   */
  it("le meilleur et le pire trade portent leur devise", () => {
    const src = lire("app/api/weekly-report/route.ts");
    expect(src).toContain("fmtMeilleur.signedMoney(stats.best.pnl)");
    expect(src).toContain("fmtPire.signedMoney(stats.worst.pnl)");
    expect(src).toContain("tradeCurrency(stats.best?.challengeId, carteDesDevises,");
  });
});
