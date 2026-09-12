import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAccountBalance } from "./challenge-balance";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN COMPTE N'A QU'UN SOLDE, ET IL SE RÉSOUT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE CALCULATEUR DE POSITION DIMENSIONNAIT LE RISQUE SUR UN SOLDE
 * RECONSTITUÉ. Il repartait du capital nominal saisi à la main et y ajoutait la
 * somme des trades connus : exactement la méthode que `resolveAccountBalance`
 * existe pour remplacer, parce qu'elle ne voit ni les dépôts, ni les retraits,
 * ni une erreur de saisie du capital initial. Le drawdown total restant, donc
 * la taille de position proposée, en héritait.
 *
 * ⚠️ ET LE TABLEAU DE BORD LISAIT LA COLONNE `balance` TELLE QUELLE, qui est un
 * CACHE : seuls l'instantané du broker et la page Comptes la réécrivent. Pour
 * un compte alimenté par import CSV, elle restait figée sur la dernière visite
 * de la page Comptes, pendant que la garde de challenge rendue par le MÊME
 * layout résolvait, elle, le vrai solde.
 *
 * ⚠️ Les deux commentaires qui énonçaient la règle existaient déjà : celui de
 * `ChallengeGuardian` (« même résolveur que l'onglet Comptes : sans ça […] deux
 * chiffres différents, dont celui qui déclenche l'alerte d'arrêt ») et celui du
 * contexte de compte actif (« même jeu de champs que ChallengeGuardian », alors
 * qu'il ne transportait pas l'instantané du broker). La règle était écrite,
 * appliquée à une partie seulement de ce qu'elle vise.
 */
describe("le solde d'un compte", () => {
  /**
   * ⚠️ LE CAS QUI SÉPARE LES DEUX MÉTHODES : un dépôt. Le broker annonce un
   * solde que la reconstitution ne peut pas retrouver, puisqu'aucun trade ne
   * l'explique.
   */
  it("suit le broker, jamais la reconstitution, dès qu'un instantané existe", () => {
    const compte = {
      account_size: 10_000,
      synced_balance: 12_500, // 10 000 + 500 de trades + 2 000 déposés
      synced_equity: 12_500,
      synced_open_positions: 0,
      synced_at: new Date().toISOString(),
    };
    const r = resolveAccountBalance(compte, 500);
    expect(r.balance, "le dépôt disparaît du solde").toBe(12_500);
    expect(r.fromBroker).toBe(true);
    // La reconstitution, elle, aurait dit 10 500 : 2 000 € d'écart sur le
    // chiffre qui décide du drawdown restant.
    expect(compte.account_size + 500).toBe(10_500);
  });

  /** Sans instantané, on retombe sur la reconstitution, et on le dit. */
  it("le dit quand il n'a que la reconstitution", () => {
    const r = resolveAccountBalance({ account_size: 10_000 }, 500);
    expect(r.balance).toBe(10_500);
    expect(r.fromBroker).toBe(false);
    expect(r.curveOffset, "aucun calage à appliquer sans solde réel").toBe(0);
  });

  /**
   * ⚠️⚠️ ET AUCUN ÉCRAN NE RECALCULE DANS SON COIN. Le balayage cherche la
   * lecture d'un champ `balance` sur un objet qui ressemble à un compte, dans
   * un fichier qui n'appelle pas le résolveur.
   */
  it("n'est plus lu tel quel dans un écran qui ne résout pas", () => {
    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const c = join(d, f);
        if (statSync(c).isDirectory()) fichiers(c, out);
        else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
      }
      return out;
    }

    /** `compte.balance` où le porteur a un nom de compte. */
    const LECTURE =
      /\b(account|challenge|compte|ac|displayAccount|selectedAccount)\b[!?]?\.balance\b/g;

    expect(
      LECTURE.test("const b = account.balance;"),
      "le motif ne reconnaît pas la faute qu'il cherche",
    ).toBe(true);

    const fautes: string[] = [];
    let vues = 0;
    for (const racine of ["app", "components"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        const relatif = chemin.replace(process.cwd() + "\\", "").replace(/\\/g, "/");
        // L'admin est le tableau de bord d'Axel : il y lit des lignes de base,
        // pas le solde d'un compte qu'il trade.
        if (relatif.includes("dashboard/admin")) continue;
        const src = sansCommentaires(readFileSync(chemin, "utf8"));
        const resout = /resolveAccountBalance/.test(src);
        LECTURE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LECTURE.exec(src)) !== null) {
          vues++;
          if (resout) continue;
          const ligne = src.slice(0, m.index).split("\n").length;
          fautes.push(`${relatif}:${ligne} (${m[0]})`);
        }
      }
    }

    // ⚠️ Un garde qui ne trouve rien ne protège rien.
    expect(vues, "aucune lecture de solde : le motif ne correspond plus").toBeGreaterThan(2);
    expect(
      fautes,
      "soldes lus sans passer par le résolveur : " + fautes.join(", "),
    ).toEqual([]);
  });
});
