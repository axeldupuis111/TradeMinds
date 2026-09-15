import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * UN BILAN N'EST PAS UNE SÉANCE.
 *
 * ── LE DÉFAUT, MESURÉ ───────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « DÉMARRE TA PREMIÈRE SESSION DE TRADING » POUR UN BADGE QU'AUCUNE
 * SÉANCE NE DONNE. Le produit a DEUX objets distincts, et il appelait les deux
 * « session » :
 *
 *   - la table `sessions` : le rituel d'avant-marché de `/dashboard/session`,
 *     avec sa checklist, son émotion de départ, son démarrage et son arrêt.
 *     88 lignes en base le 2026-09-16 ;
 *   - la table `session_reviews` : le BILAN produit par l'onglet Analyse IA,
 *     seul objet qui porte un score de discipline. 32 lignes.
 *
 * Or le classement, les treize badges, les objectifs, les recommandations et
 * les défis hebdomadaires comptent TOUS des lignes de `session_reviews`, et
 * disaient tous « sessions ». Conséquences relevées à l'écran :
 *
 *   - « Pas encore classé : complète au moins 3 sessions sur la période » à
 *     quelqu'un qui en a préparé quatre-vingt-huit ;
 *   - « Démarre ta première session de trading » pour un badge qu'on obtient
 *     en lançant une analyse ;
 *   - « 3 sessions préparées avant 9 h » pour un défi qui compte des bilans
 *     enregistrés avant 9 h : préparer à 7 h et analyser le soir donnait zéro ;
 *   - « Il se remplit avec tes vraies sessions de préparation » sur le
 *     classement, qui ne les regarde jamais ;
 *   - un objectif recommandé « Sessions pré-trade : 18 ce mois » dont la
 *     progression se mesure en analyses, alors que le plan gratuit en donne UNE
 *     à vie : le produit proposait un objectif que son propre paywall interdit.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute phrase qui décrit ce que compte `session_reviews` nomme un BILAN, dans
 * le mot que le produit emploie déjà pour cet objet et dans les quatre langues.
 * Le vocabulaire n'est pas inventé ici : il vient de `leaderboard_stat_sessions`
 * (« Bilans comptés » / « Reviews counted » / « Gezählte Berichte » /
 * « Balances contados »), qui disait juste depuis le début.
 *
 * ⚠️ ET SI LA MÉTRIQUE CHANGE DE SOURCE, LE MOT DOIT CHANGER AUSSI : le dernier
 * test ci-dessous échoue si ces écrans se mettent à compter la table `sessions`,
 * pour qu'on revienne alors dire « séance ».
 */
describe("les écrans qui comptent des bilans disent « bilan »", () => {
  const DICOS = { fr: frDict, en: enDict, es: esDict, de: deDict } as Record<
    string,
    Record<string, string>
  >;

  /** Le mot que le produit emploie déjà pour une ligne de `session_reviews`. */
  const MOT = { fr: "bilan", en: "review", de: "bericht", es: "balance" } as Record<string, string>;

  /**
   * Les phrases qui décrivent la métrique. Toutes affichées sur le classement,
   * le mur de badges, les objectifs ou les défis, et toutes alimentées par
   * `session_reviews`.
   */
  const CLES = [
    "badge_first_session",
    "badge_first_session_hint",
    "badge_regular",
    "badge_regular_hint",
    "badge_discipline_gold_hint",
    "badge_marathon_hint",
    "badge_early_bird_hint",
    "badge_weekend_hint",
    "leaderboard_not_ranked",
    "leaderboard_demo_notice",
    "leaderboard_sessions",
    "goal_metric_sessions",
    "rec_reason_prep",
    "challenge_c_gold_avg_desc",
    "challenge_c_early_bird_desc",
    "challenge_c_score_climb_desc",
    "challenge_c_sessions_week_title",
    "challenge_c_sessions_week_desc",
  ];

  it("le vocabulaire de référence n'a pas bougé", () => {
    // Si ces trois-là changent de mot, c'est tout le reste qu'il faut réaligner.
    for (const [langue, dico] of Object.entries(DICOS)) {
      expect(
        dico["leaderboard_stat_sessions"].toLowerCase(),
        `le mot de référence a changé en ${langue}`,
      ).toContain(MOT[langue]);
    }
  });

  it("chaque phrase nomme un bilan, dans les quatre langues", () => {
    const fautes: string[] = [];
    for (const [langue, dico] of Object.entries(DICOS)) {
      for (const cle of CLES) {
        const texte = dico[cle];
        expect(texte, `${cle} manque en ${langue}`).toBeTruthy();
        if (!texte.toLowerCase().includes(MOT[langue])) {
          fautes.push(`${langue}/${cle} : « ${texte.slice(0, 80)} »`);
        }
      }
    }
    expect(
      fautes,
      "phrases qui décrivent un compte de bilans sans jamais nommer le bilan — " +
        "elles renvoient le lecteur vers la préparation de séance, qui ne compte pas :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    expect("Démarre ta première session de trading.".toLowerCase().includes("bilan")).toBe(false);
    expect("Lance ta première analyse IA : elle enregistre ton premier bilan de séance."
      .toLowerCase().includes("bilan")).toBe(true);
  });

  /**
   * ⚠️ LE SEUIL EST UN SEUL NOMBRE. L'écran en écrivait un à la main dans la
   * phrase pendant que la route gardait le sien, et le bouchage manuel
   * empêchait au passage tout accord de pluriel.
   */
  it("le seuil du classement n'est écrit qu'une fois", () => {
    const extras = readFileSync(join(process.cwd(), "lib/leaderboard-extras.ts"), "utf8");
    expect(extras).toContain("export const MIN_BILANS_POUR_CLASSEMENT = 3;");

    const route = readFileSync(join(process.cwd(), "app/api/leaderboard/route.ts"), "utf8");
    expect(route, "la route a repris son propre seuil").toContain(
      "const MIN_SESSIONS = MIN_BILANS_POUR_CLASSEMENT;",
    );

    const page = readFileSync(join(process.cwd(), "app/dashboard/leaderboard/page.tsx"), "utf8");
    expect(page, "l'écran ne passe plus par la traduction").toContain(
      't("leaderboard_not_ranked", { n: MIN_BILANS_POUR_CLASSEMENT })',
    );
  });

  /**
   * ⚠️ LA MÉTRIQUE N'A PAS CHANGÉ DE SOURCE. Ce test ne défend pas un mot, il
   * défend l'accord entre le mot et ce qui est compté : si ces écrans se
   * mettaient à lire la table `sessions`, c'est le vocabulaire ci-dessus qu'il
   * faudrait refaire, pas ce test qu'il faudrait supprimer.
   */
  it("ces écrans comptent toujours des lignes de session_reviews", () => {
    for (const chemin of [
      "app/api/leaderboard/route.ts",
      "app/api/goals/route.ts",
      "app/api/goals/recommend/route.ts",
      "app/api/community-challenges/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(src, `${chemin} ne lit plus session_reviews`).toContain('from("session_reviews")');
      expect(
        /\.from\(\s*["'`]sessions["'`]\s*\)/.test(src),
        `${chemin} s'est mis à lire la table sessions : le vocabulaire des écrans est à revoir`,
      ).toBe(false);
    }
  });
});
