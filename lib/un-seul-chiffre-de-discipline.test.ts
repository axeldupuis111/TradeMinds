import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LA SÉRIE DE DISCIPLINE N'A QU'UN SEUL CALCUL, ET LE SCORE N'A QU'UN SEUL NOM.
 *
 * ── LE DÉFAUT, VU SUR LE PROFIL PUBLIC ──────────────────────────────────────
 *
 * ⚠️⚠️ « 0 JOUR DE DISCIPLINE » SUR LA PAGE QUE LE TRADER PARTAGE, pendant que
 * son tableau de bord en affichait 75. Le même compte, le même jour. Le profil
 * comptait ses propres « bilans de séance sans violation » et s'arrêtait au
 * premier bilan fautif : c'est le TROISIÈME calcul de la même chose, et
 * `lib/discipline-streak-source.ts` avait été écrit exactement pour clore ce
 * défaut — entre deux cartes du tableau de bord. Ce troisième-là, sur la page
 * la plus visible de toutes, n'avait jamais été rapproché.
 *
 * ⚠️⚠️ ET LE SCORE PORTAIT LE MÊME NOM POUR DEUX MESURES : « Discipline 62/100 »
 * sur le profil (la MOYENNE de tous les bilans) contre « Score de discipline
 * 74/100 » sur le tableau de bord (le DERNIER bilan). Aucune des deux n'est
 * fausse ; c'est le nom commun qui ment. Le profil dit maintenant « Discipline
 * moyenne ».
 */
describe("un seul chiffre de discipline", () => {
  const lire = (c: string) => sansCommentaires(readFileSync(join(process.cwd(), c), "utf8"));

  /**
   * ⚠️ ET LA SURFACE PUBLIQUE ÉCARTE LES TRADES DE DÉMONSTRATION. Le profil
   * affiche déjà un nombre de trades hors démo : une série gonflée par des
   * trades fictifs y serait un chiffre faux montré à des inconnus. Dans le
   * produit, à l'inverse, une démo sans série ne montrerait pas ce qu'elle est
   * censée montrer — d'où l'option, et pas deux calculs.
   */
  it("le profil et sa carte sociale comptent hors démonstration", () => {
    for (const chemin of [
      "app/profile/[username]/page.tsx",
      "app/profile/[username]/opengraph-image.tsx",
    ]) {
      expect(lire(chemin), chemin).toMatch(/chargerLaSerieDeDiscipline\([^)]*sansDemo: true/);
    }
    // ⚠️ Et le tableau de bord, lui, ne passe pas l'option.
    const jour = lire("components/dashboard/DayState.tsx");
    expect(jour).toMatch(/chargerLaSerieDeDiscipline\(supabase, user\.id\)/);
  });

  it("le profil public ne compte plus sa propre série", () => {
    const vue = lire("components/profile/PublicProfileView.tsx");
    expect(vue, "la vue recompte une série").not.toMatch(/let streak = 0;/);
    expect(vue, "la série doit arriver toute faite").toMatch(/serie: number;/);
    const page = lire("app/profile/[username]/page.tsx");
    expect(page).toMatch(/chargerLaSerieDeDiscipline\(supabase, userId/);
  });

  /**
   * ⚠️ ET PERSONNE D'AUTRE NE LA RECALCULE : le motif cherche la forme exacte
   * du calcul maison (parcourir des bilans en comptant ceux sans violation).
   * Les trois endroits qui affichent la série passent par le module partagé.
   */
  it("aucune vue ne recompte une série à partir des bilans", () => {
    const suspects = [
      "components/profile/PublicProfileView.tsx",
      "components/dashboard/DayState.tsx",
      "components/dashboard/GoalsStreaks.tsx",
    ];
    for (const chemin of suspects) {
      const src = lire(chemin);
      expect(src, `${chemin} recompte une série`).not.toMatch(
        /violations(\?\.)?\.length === 0\)\s*streak\+\+/,
      );
    }
  });

  /**
   * ⚠️ LE NOM DIT CE QUE LE CHIFFRE EST : « Discipline moyenne » sur le profil,
   * parce que c'est une moyenne de bilans ; « Score de discipline » sur le
   * tableau de bord, parce que c'est le dernier. Deux noms, deux mesures, plus
   * de contradiction.
   */
  it("le profil nomme sa moyenne comme une moyenne", () => {
    for (const [langue, attendu] of Object.entries({
      fr: "moyenne",
      en: "verage",
      es: "media",
      de: "urchschnittliche",
    })) {
      const dico = readFileSync(join(process.cwd(), "lib", "i18n", `${langue}.ts`), "utf8");
      const ligne = new RegExp('"pubprofile_discipline":\\s*"([^"]*)"').exec(dico);
      expect(ligne?.[1], `${langue} : ${ligne?.[1]}`).toContain(attendu);
    }
  });
});
