import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleDeSaison, debutDeSaison, finDeSaison, joursRestantsDeSaison, moisDeSaison } from "./saison";

/**
 * LA SAISON S'ÉCRIT ET SE CALCULE SUR LA MÊME HORLOGE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TITRE ANNONÇAIT UN MOIS, LE CLASSEMENT EN COMPTAIT UN AUTRE. Le
 * serveur ouvre la saison au 1er du mois UTC (il le faut : un classement
 * partagé ne peut pas commencer à une heure différente pour chaque lecteur),
 * pendant que la page composait « Saison de {mois} » et « {n} j restants » avec
 * l'horloge du navigateur.
 *
 * Le 31 août à 21 h à New York, il est déjà le 1er septembre en UTC : la page
 * disait « Saison d'août » au-dessus du classement de septembre, déjà remis à
 * zéro. Le 1er septembre à 8 h à Tokyo, l'inverse. Dix-sept des vingt-et-un
 * inscrits du produit sont anglophones, presque aucun n'est en UTC.
 *
 * ⚠️ ET « 0 J RESTANTS » ÉTAIT FAUX MÊME EN UTC : le dernier jour du mois,
 * `dernierJour - jourCourant` rend zéro alors que la journée se joue encore.
 */

const RACINE = process.cwd();

describe("la saison du classement", () => {
  /** ⚠️⚠️ LE CAS QUI FAISAIT MENTIR LE TITRE : 31 août 21 h à New York. */
  it("nomme le mois de la fenêtre, pas celui du navigateur", () => {
    const newYorkLe31AoutA21h = Date.parse("2026-09-01T01:00:00Z");
    expect(moisDeSaison("en-US", newYorkLe31AoutA21h)).toBe("September");
    expect(moisDeSaison("fr-FR", newYorkLe31AoutA21h)).toBe("septembre");
    expect(cleDeSaison(newYorkLe31AoutA21h)).toBe("2026-09");
  });

  /** ⚠️ Et l'autre bord : 1er septembre 8 h à Tokyo, encore août en UTC. */
  it("garde le mois en cours quand le navigateur est déjà au suivant", () => {
    const tokyoLe1erA8h = Date.parse("2026-08-31T23:00:00Z");
    expect(moisDeSaison("en-US", tokyoLe1erA8h)).toBe("August");
    expect(cleDeSaison(tokyoLe1erA8h)).toBe("2026-08");
  });

  /**
   * ⚠️⚠️ CE GARDE-LÀ NE PEUT PAS ÊTRE SEULEMENT UN TEST DE COMPORTEMENT. Les
   * deux cas ci-dessus ne distinguent la bonne version de la mauvaise que sur
   * une machine décalée : sur une machine en UTC, relire l'instant dans le
   * fuseau local rend exactement le même mois, et le test passerait au vert sur
   * du code cassé. Or nos tests tournent en UTC sur Vercel et en Europe/Berlin
   * ici : le passage vert de l'un ne prouve rien pour l'autre. L'ancre est donc
   * aussi épinglée dans la source.
   */
  it("formate le mois en UTC, explicitement", () => {
    const src = readFileSync(join(RACINE, "lib/saison.ts"), "utf8");
    const i = src.indexOf("export function moisDeSaison");
    expect(i, "la fonction a changé de nom").toBeGreaterThan(0);
    const corps = src.slice(i, src.indexOf("}", i));
    expect(corps, "le mois se relit dans le fuseau de la machine").toContain('timeZone: "UTC"');
  });

  it("borne la saison au mois calendaire UTC", () => {
    const t = Date.parse("2026-09-18T10:00:00Z");
    expect(debutDeSaison(t).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(finDeSaison(t).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("passe l'année sans se tromper de mois", () => {
    const t = Date.parse("2026-12-20T10:00:00Z");
    expect(finDeSaison(t).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  /**
   * ⚠️ LE DERNIER JOUR COMPTE POUR UN. Il reste une séance à jouer : afficher
   * zéro pendant vingt-quatre heures dit au trader que c'est déjà fini.
   */
  it("ne dit jamais zéro tant que la saison court", () => {
    expect(joursRestantsDeSaison(Date.parse("2026-09-30T23:00:00Z"))).toBe(1);
    expect(joursRestantsDeSaison(Date.parse("2026-09-30T00:00:00Z"))).toBe(1);
    expect(joursRestantsDeSaison(Date.parse("2026-09-29T12:00:00Z"))).toBe(2);
    expect(joursRestantsDeSaison(Date.parse("2026-09-01T00:00:00Z"))).toBe(30);
  });

  /**
   * ⚠️ À L'INSTANT DU BASCULEMENT, C'EST DÉJÀ LA SAISON SUIVANTE QUI SE COMPTE,
   * en entier. Le compteur ne passe jamais par zéro : il n'y a pas d'instant
   * où le classement n'appartient à aucune saison.
   */
  it("repart plein à la remise à zéro", () => {
    const bascule = Date.parse("2026-10-01T00:00:00Z");
    expect(cleDeSaison(bascule)).toBe("2026-10");
    expect(joursRestantsDeSaison(bascule)).toBe(31);
  });
});

describe("les deux côtés du classement", () => {
  const nu = (f: string) =>
    readFileSync(join(RACINE, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  /**
   * ⚠️ UNE SEULE DÉFINITION DE LA BORNE. Le serveur et la page la calculaient
   * chacun de leur côté : c'est ce qui leur permettait de ne pas être d'accord.
   */
  it("la fenêtre du serveur vient du module", () => {
    const src = nu("app/api/leaderboard/route.ts");
    expect(src, "le serveur recalcule la borne de saison dans son coin").not.toContain(
      "Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)",
    );
    expect(src).toContain("debutDeSaison(");
  });

  it("le titre et le compte à rebours de la page viennent du module", () => {
    const src = nu("app/dashboard/leaderboard/page.tsx");
    expect(src, "la page relit l'horloge du navigateur pour nommer la saison").not.toContain(
      'lang === "fr" ? "fr-FR"',
    );
    expect(src).toContain("moisDeSaison(lang)");
    expect(src).toContain("joursRestantsDeSaison()");
  });
});
