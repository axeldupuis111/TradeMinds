import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * LE CLIENT INSTALLÉ ET LE SERVEUR PARLENT-ILS ENCORE LA MÊME LANGUE ?
 *
 * `clients-contract.test.ts` vérifie déjà que des charges utiles réalistes sont
 * acceptées. Mais ces charges sont **transcrites à la main** depuis les
 * fichiers distribués : si quelqu'un renomme un champ dans
 * `public/TradeDiscipline_NinjaTrader.cs`, la transcription reste juste et le
 * test reste vert pendant que la synchro réelle casse.
 *
 * Ce fichier ferme ce trou en lisant les VRAIS fichiers livrés au trader et en
 * comparant les noms de champs qu'ils émettent. Aucun des deux n'est compilable
 * ici (C#), donc c'est le seul garde-fou mécanique possible.
 *
 * ⚠️ Pourquoi ça compte maintenant : un partenaire conditionne sa signature au
 * fait que les connexions Tradovate et NinjaTrader fonctionnent. Le rail
 * NinjaTrader n'a jamais été testé de bout en bout avec une vraie installation,
 * et une divergence de nom de champ est exactement le genre de défaut qui ne se
 * verrait qu'à ce moment-là, chez lui.
 */

const CLIENTS = ["TradeDiscipline_NinjaTrader.cs", "TradeDiscipline_cTrader.cs"] as const;

/** Noms de champs JSON émis par un client, extraits de ses littéraux `\"nom\":`. */
function champsEmis(fichier: string): Set<string> {
  const src = readFileSync(join(process.cwd(), "public", fichier), "utf8");
  const noms = new Set<string>();
  let m: RegExpExecArray | null;
  const re = /\\"([a-z_]+)\\":/g;
  while ((m = re.exec(src)) !== null) noms.add(m[1]);
  return noms;
}

/**
 * Ce que le rail lit réellement. Écrit à la main VOLONTAIREMENT : c'est la
 * liste de référence, et toute modification ici doit être un choix conscient,
 * pas un effet de bord d'une expression régulière trop permissive.
 */
const ATTENDU_TRADE = [
  "ticket", "symbol", "direction", "volume",
  "open_time", "close_time", "open_price", "close_price",
  "profit", "commission", "swap", "sl", "tp",
] as const;

const ATTENDU_COMPTE = [
  "account", "balance", "equity", "open_positions", "currency", "source",
] as const;

/** Enveloppe : ce qui porte l'authentification et le contenu. */
const ATTENDU_ENVELOPPE = ["token", "trade", "account"] as const;

describe("les clients installés émettent ce que le rail attend", () => {
  for (const fichier of CLIENTS) {
    it(`${fichier} : aucun champ attendu ne manque`, () => {
      const emis = champsEmis(fichier);
      // Garde-fou du garde-fou : une regex qui ne matche rien rendrait ce test
      // vert sans rien vérifier, ce qui est pire que pas de test du tout.
      expect(emis.size, `aucun champ extrait de ${fichier} : le format a changé`).toBeGreaterThan(10);

      const manquants = [...ATTENDU_TRADE, ...ATTENDU_COMPTE, ...ATTENDU_ENVELOPPE].filter(
        (c) => !emis.has(c),
      );
      expect(
        manquants,
        `${fichier} n'émet plus : ${manquants.join(", ")}. Le rail ne lira pas ces valeurs, ` +
          `et la synchro échouera SANS ERREUR VISIBLE côté trader.`,
      ).toEqual([]);
    });

    it(`${fichier} : n'émet aucun champ que le rail ignore`, () => {
      // L'inverse compte autant : un champ ajouté côté client et jamais lu côté
      // serveur est du travail perdu, et souvent le signe qu'on a implémenté la
      // moitié d'une fonctionnalité.
      const connus = new Set<string>([...ATTENDU_TRADE, ...ATTENDU_COMPTE, ...ATTENDU_ENVELOPPE]);
      const inconnus = Array.from(champsEmis(fichier)).filter((c) => !connus.has(c));
      expect(
        inconnus,
        `${fichier} émet des champs que le rail ne lit pas : ${inconnus.join(", ")}`,
      ).toEqual([]);
    });
  }

  it("les deux clients émettent exactement le même contrat", () => {
    // Le rail est unique : cTrader et NinjaTrader postent sur le même endpoint.
    // Une divergence entre les deux signifie qu'un des deux rails est cassé, et
    // c'est toujours celui qu'on teste le moins qui l'est.
    const [ninja, ctrader] = CLIENTS.map(champsEmis);
    expect(Array.from(ninja).sort()).toEqual(Array.from(ctrader).sort());
  });
});
