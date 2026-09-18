import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAN_FEATURES } from "./plan-features";

/**
 * L'ÉCRAN TIENT CE QUE LA TABLE DES TARIFS PROMET.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA TABLE DONNAIT LE PROFIL PUBLIC AU PLAN GRATUIT, L'ÉCRAN LE REFUSAIT.
 * `plan_feat_public_profile` est passé à `free: true` le 2026-09-16, avec la
 * décision écrite dans `lib/plan-features` : le verrou ne rapportait rien (les
 * seuls profils publics existants appartenaient à des comptes premium), la page
 * est une surface d'ACQUISITION qui se termine par un appel à l'inscription, et
 * elle n'affiche aucun montant. Le commentaire dit même pourquoi la ligne
 * change : « pour que le tableau de tarifs, la landing et le compteur disent
 * enfin la même chose que le code ».
 *
 * ⚠️ LA MATRICE A ÉTÉ CHANGÉE, PAS L'ÉCRAN. Les Réglages gardaient
 * `canShare = plan === "plus" || plan === "premium"` et servaient une
 * invitation à payer. Un inscrit gratuit lisait « Profil public ✓ » sur la page
 * de tarifs et trouvait un mur. Le correctif n'avait été appliqué qu'à la
 * promesse.
 *
 * ⚠️ ET ÇA EN CACHAIT UN AUTRE : sans ce champ, un gratuit ne peut pas se
 * choisir de pseudo — or le pseudo commande aussi le CLASSEMENT, annoncé
 * gratuit depuis toujours (`plan_feat_leaderboard`, `free: true`). Mesuré en
 * base le 2026-09-18 : un compte inscrit au classement n'a pas de pseudo et n'y
 * apparaît donc jamais.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

describe("le profil public", () => {
  it("est annoncé gratuit dans la table", () => {
    const ligne = PLAN_FEATURES.find((f) => f.key === "plan_feat_public_profile");
    expect(ligne, "la ligne a disparu de la table des tarifs").toBeTruthy();
    expect(ligne!.free, "la table ne le donne plus au plan gratuit").toBe(true);
  });

  /** ⚠️⚠️ ET L'ÉCRAN NE LE REFUSE PLUS. */
  it("n'est plus verrouillé dans les Réglages", () => {
    const src = lire("app/dashboard/settings/page.tsx");
    expect(
      src,
      "les Réglages verrouillent encore le profil public derrière un plan payant, " +
        "alors que la page de tarifs le promet au gratuit",
    ).not.toContain('const canShare = plan === "plus" || plan === "premium"');
    // Le champ de pseudo est bien rendu, sans condition de plan.
    expect(src).toContain('id="settings-settings-username"');
  });

  /**
   * ⚠️ ET LE CLASSEMENT, LUI AUSSI GRATUIT, DÉPEND DE CE MÊME PSEUDO : les deux
   * promesses tombaient ensemble.
   */
  it("laisse le classement tenir sa propre promesse", () => {
    const ligne = PLAN_FEATURES.find((f) => f.key === "plan_feat_leaderboard");
    expect(ligne!.free, "le classement n'est plus annoncé gratuit").toBe(true);
  });
});

describe("l'invitation à choisir un pseudo", () => {
  /**
   * ⚠️⚠️ ELLE N'AGISSAIT PAS. « Il te faut un pseudo — en choisir un » pointait
   * sur `href="#"` : un lien qui remonte en haut de page et ne fait rien.
   */
  it("mène au champ, pas nulle part", () => {
    const src = lire("components/settings/LeaderboardOptInCard.tsx");
    expect(src, "l'appel à l'action est resté un lien mort").not.toContain('<a href="#"');
    expect(src, "l'ancre ne vise pas le champ de pseudo").toContain(
      'href="#settings-settings-username"',
    );
  });

  /** ⚠️ Et la cible existe vraiment : une ancre vers rien est un lien mort. */
  it("vise une ancre qui existe", () => {
    expect(lire("app/dashboard/settings/page.tsx")).toContain('id="settings-settings-username"');
  });
});
