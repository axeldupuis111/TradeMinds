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
    /**
     * ⚠️ ELLE ARRIVE TOUTE FAITE, ET ELLE PEUT ARRIVER ABSENTE. Le calcul
     * partage rend `complet: false` quand la lecture echoue, et la vue doit
     * pouvoir le dire au lieu d'afficher zero : « 0 jour de discipline »
     * sur la page que le trader PARTAGE est precisement le defaut que ce
     * fichier protege, atteint par une autre porte.
     */
    expect(vue, "la série doit arriver toute faite").toMatch(/serie: number \| null;/);
    expect(vue, "la vue affiche zéro quand elle ne sait pas").toContain("serie === null");
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

  /**
   * ── LA QUATRIÈME SURFACE ────────────────────────────────────────────────────
   *
   * ⚠️⚠️ LE CLASSEMENT DISAIT « Discipline 0 » ET « 🔥 0 Série » le jour où le
   * tableau de bord affichait 74 et 75. Le même compte, à un clic d'écart. Ses
   * chiffres ne sont pourtant pas faux : ce sont ceux de la FENÊTRE de
   * classement (moyenne des bilans sur trente jours, plus longue suite de jours
   * à 70+ dans cette fenêtre), et ce compte n'a plus de bilan depuis cinq
   * semaines. C'est encore le NOM qui mentait, exactement comme sur le profil,
   * et la correction du profil n'avait pas été portée ici : trois surfaces
   * réconciliées sur quatre.
   *
   * ⚠️ ON NE TOUCHE PAS AU CALCUL. Un classement se joue sur une période, sinon
   * il compare des anciennetés ; c'est le libellé qui doit le dire.
   */
  it("le classement nomme ses chiffres comme des chiffres de période", () => {
    const attendu: Record<string, [string, string]> = {
      // [ce que le score doit contenir, ce que la série doit contenir]
      fr: ["moyenne", "Meilleure"],
      en: ["verage", "Best"],
      es: ["media", "Mejor"],
      de: ["urchschnittliche", "Beste"],
    };
    for (const [langue, [moyenne, meilleure]] of Object.entries(attendu)) {
      const dico = readFileSync(join(process.cwd(), "lib", "i18n", `${langue}.ts`), "utf8");
      const score = /"leaderboard_stat_score":\s*"([^"]*)"/.exec(dico)?.[1];
      const serie = /"leaderboard_stat_streak":\s*"([^"]*)"/.exec(dico)?.[1];
      expect(score, `${langue} : le score du classement s'appelle « ${score} »`).toContain(moyenne);
      expect(serie, `${langue} : la série du classement s'appelle « ${serie} »`).toContain(meilleure);
    }
  });

  /**
   * ⚠️ ET SURTOUT : IL NE PORTE PAS LE MÊME NOM QUE LE TABLEAU DE BORD. C'est la
   * règle, pas la formulation : deux mesures différentes ne partagent pas un
   * libellé, quelle que soit la langue.
   */
  it("aucun libellé n'est partagé entre deux mesures différentes", () => {
    for (const langue of ["fr", "en", "es", "de"]) {
      const dico = readFileSync(join(process.cwd(), "lib", "i18n", `${langue}.ts`), "utf8");
      /**
       * ⚠️ ET SI LA CLÉ EST INTROUVABLE, ON ÉCHOUE. Un repli sur le nom de la
       * clé ferait passer ce test sans rien comparer : deux noms de clés sont
       * toujours différents.
       */
      const lire = (cle: string) => {
        const trouve = new RegExp(`"${cle}":\\s*"([^"]*)"`).exec(dico)?.[1];
        expect(trouve, `${langue} : clé ${cle} introuvable`).toBeTruthy();
        return trouve!;
      };
      const tableauDeBord = lire("dash_discipline");
      for (const cle of ["leaderboard_stat_score", "pubprofile_discipline"]) {
        expect(
          lire(cle).toLowerCase(),
          `${langue} : « ${lire(cle)} » est aussi le nom du chiffre du tableau de bord`,
        ).not.toBe(tableauDeBord.toLowerCase());
      }
    }
  });

  /**
   * ── UNE SÉANCE N'EST PAS UN BILAN ───────────────────────────────────────────
   *
   * ⚠️⚠️ LE CLASSEMENT COMPTAIT DES BILANS ET LES APPELAIT « SÉANCES ». Le
   * produit a deux tables distinctes et deux gestes distincts : `sessions`, le
   * rituel d'avant-marché (émotion, checklist, règles affichées), et
   * `session_reviews`, les analyses IA. Mesuré sur le compte réel : 38 séances,
   * 24 bilans. Le classement lit `session_reviews` et affichait « Séances
   * comptées », pendant que le profil public appelle exactement la même chose
   * « Bilans passés ».
   *
   * ⚠️ TERMINER UNE SÉANCE N'ÉCRIT AUCUN BILAN, vérifié en le faisant : la
   * séance se ferme, son débrief est stocké, et `session_reviews` ne bouge pas.
   * Les deux chiffres ne peuvent donc jamais coïncider, et les confondre fait
   * dire au classement « 0 séance » à quelqu'un qui en a trente-huit.
   */
  it("le classement ne confond pas une séance avec un bilan", () => {
    for (const langue of ["fr", "en", "es", "de"]) {
      const dico = readFileSync(join(process.cwd(), "lib", "i18n", `${langue}.ts`), "utf8");
      const lire2 = (cle: string) => {
        const v = new RegExp(`"${cle}":\\s*"([^"]*)"`).exec(dico)?.[1];
        expect(v, `${langue} : clé ${cle} introuvable`).toBeTruthy();
        return v!;
      };
      expect(
        /s.ance|session|sesi.n/i.test(lire2("leaderboard_stat_sessions")),
        `${langue} : le classement appelle « ${lire2("leaderboard_stat_sessions")} » ce qui est un compte de bilans`,
      ).toBe(false);
    }
  });

  /**
   * ⚠️⚠️ `complet` EXISTAIT ET PERSONNE NE LE LISAIT. Le calcul partagé rend
   * `{ current: 0, complet: false }` quand la lecture échoue, et les quatre
   * appelants ne prenaient que `current` : une lecture ratée affichait donc
   * « 0 jour de discipline », c'est-à-dire EXACTEMENT le défaut pour lequel ce
   * calcul partagé a été écrit, atteint par une autre porte.
   *
   * ⚠️ Un champ que personne ne lit n'est pas une protection, c'est une
   * intention. Ce test le rend obligatoire.
   */
  it("les quatre lecteurs distinguent « zéro » de « je n'ai pas pu lire »", () => {
    for (const chemin of [
      "components/DayStatus.tsx",
      "components/dashboard/DayState.tsx",
      "app/profile/[username]/page.tsx",
    ]) {
      const src = lire(chemin);
      expect(src, `${chemin} ignore encore \`complet\``).toContain("serie.complet");
    }
    // Et chaque écran a de quoi rendre l'absence.
    expect(lire("components/DayStatus.tsx")).toContain('streak === null ? "—"');
    expect(lire("components/dashboard/DayState.tsx")).toContain('streak === null ? "—"');
    expect(lire("components/profile/PublicProfileView.tsx")).toContain('serie === null ? "—"');
  });

  /**
   * ⚠️⚠️ ET LES TROIS AUTRES CHIFFRES DE CETTE PAGE. Réparer la série et laisser
   * « 0 trade, 0 % de réussite » une ligne au-dessus, c'est corriger une moitié
   * du défaut et garder l'autre, sur la même surface : celle que le trader
   * partage, la seule qu'un lecteur ne peut pas recouper.
   */
  it("le profil public n'annonce aucun chiffre qu'il n'a pas pu lire", () => {
    const page = lire("app/profile/[username]/page.tsx");
    expect(page, "le null de fetchAllRows n'est plus regardé").toContain(
      "const tradesComplets = tradeRows !== null;",
    );
    expect(page, "l'erreur des bilans est jetée").toContain("error: erreurBilans");
    expect(page, "l'erreur du compteur de séances est jetée").toContain("error: erreurSeances");

    const vue = lire("components/profile/PublicProfileView.tsx");
    for (const marqueur of ["tradesComplets ? stats.count", "tradesComplets ? pourcent", "sessionCount === null", "disciplineComplete ?"]) {
      expect(vue, `la vue affiche encore un chiffre inventé : ${marqueur}`).toContain(marqueur);
    }
  });
});
