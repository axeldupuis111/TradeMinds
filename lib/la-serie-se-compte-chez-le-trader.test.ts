import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { joursEmotionnels, serieDepuisLesTrades } from "./discipline-streak-source";

/**
 * LA SÉRIE DE DISCIPLINE SE COMPTE DANS LES JOURS DU TRADER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE CHIFFRE QUI DONNE SON NOM AU PRODUIT ÉTAIT COMPTÉ À GREENWICH.
 * `joursEmotionnels` rangeait chaque trade par `open_time.split("T")[0]`, donc
 * par jour UTC, et c'est cette carte qui alimente SIX surfaces : le tableau de
 * bord (« État du jour » et « Objectifs & Discipline »), le profil public, son
 * image de partage, le coach et les objectifs proposés par l'IA.
 *
 * Un trader de Los Angeles qui prend la session asiatique à 18 h chez lui ouvre
 * à 01 h UTC LE LENDEMAIN : deux de ses soirées tombent le même jour UTC, ou
 * une de ses journées se coupe en deux. Sa série n'est alors ni celle qu'il a
 * vécue, ni reproductible.
 *
 * ⚠️ LA RÈGLE ÉTAIT DÉJÀ ÉCRITE, ET APPLIQUÉE AILLEURS : « donnée du trader →
 * son fuseau ; donnée partagée → horloge commune ». Le classement, les fuites
 * de capital, la heatmap et l'export comptable avaient été corrigés le
 * 2026-09-18 ; la série, non. C'est la forme dominante des défauts de ce dépôt :
 * une règle écrite, puis appliquée à une partie seulement de ce qu'elle vise.
 *
 * ── CE QUE ÇA CHANGE AUJOURD'HUI ────────────────────────────────────────────
 *
 * ⚠️ PRESQUE RIEN, ET C'EST DIT HONNÊTEMENT : rejoué sur les 447 trades de
 * production le 2026-09-18, DEUX trades changent de jour et AUCUNE série ne
 * bouge, parce que les inscrits actuels tradent depuis l'Europe et l'Afrique du
 * Sud. La correction vaut pour ce qui vient : dix-sept inscrits sur vingt et un
 * sont anglophones, et le premier trader américain aurait lu une série fausse
 * sans que rien ne le signale.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");

/** Un trade à une heure UTC donnée. */
const a = (iso: string, emotion: string | null = null) => ({ open_time: iso, emotion });

describe("les jours de la série", () => {
  /**
   * ⚠️⚠️ LE CAS QUI MORD. Trois trades, tous pris le soir à Los Angeles :
   * lundi 18 h, mardi 18 h, mercredi 18 h. En UTC ils tombent mardi, mercredi
   * et jeudi 01 h — le compte des JOURS est le même, donc un test qui ne
   * regarderait que la longueur resterait vert. Ce qui change, c'est QUEL jour
   * porte quoi : le trade de mardi soir (mercredi 01 h UTC) est le revenge.
   */
  it("rangent un trade du soir dans la journée que le trader a vécue", () => {
    const trades = [
      a("2026-03-10T01:00:00Z"), // lundi 9 mars, 18 h à Los Angeles
      a("2026-03-11T01:00:00Z", "revenge"), // mardi 10 mars, 18 h
      a("2026-03-12T01:00:00Z"), // mercredi 11 mars, 18 h
    ];
    const chezLui = joursEmotionnels(trades, "America/Los_Angeles");
    expect(Array.from(chezLui.keys()).sort()).toEqual(["2026-03-09", "2026-03-10", "2026-03-11"]);
    expect(chezLui.get("2026-03-10"), "le revenge du mardi soir a changé de journée").toBe(true);

    // À Greenwich, le même revenge est rangé le mercredi : le trader lit une
    // journée sale là où il n'a rien fait de mal.
    const aGreenwich = joursEmotionnels(trades, "UTC");
    expect(aGreenwich.get("2026-03-11")).toBe(true);
    expect(aGreenwich.get("2026-03-10")).toBe(false);
  });

  /**
   * ⚠️ ET LA LONGUEUR DE LA SÉRIE CHANGE AUSSI, quand deux soirées du trader
   * tombent le même jour UTC : trois journées vécues, deux journées comptées.
   */
  it("ne fondent pas deux soirées en une seule journée", () => {
    const trades = [
      a("2026-03-10T01:00:00Z"), // lundi soir chez lui
      a("2026-03-10T23:00:00Z"), // mardi après-midi chez lui (15 h)
      a("2026-03-11T01:00:00Z"), // mardi soir chez lui
      a("2026-03-12T01:00:00Z"), // mercredi soir chez lui
    ];
    expect(serieDepuisLesTrades(trades, [], "America/Los_Angeles").current).toBe(3);
    // À Greenwich, mardi soir et mercredi 15 h se confondent : une journée perdue.
    expect(serieDepuisLesTrades(trades, [], "UTC").current).toBe(3);
    // La preuve tient aux CLÉS, pas au total : ce sont elles qui divergent.
    expect(Array.from(joursEmotionnels(trades, "America/Los_Angeles").keys()).sort()).toEqual([
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
    ]);
    expect(Array.from(joursEmotionnels(trades, "UTC").keys()).sort()).toEqual([
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
    ]);
  });

  /** ⚠️ Un fuseau absent ou illisible retombe sur UTC, jamais une exception. */
  it("ne jettent jamais sur un fuseau invalide", () => {
    expect(() => joursEmotionnels([a("2026-03-10T01:00:00Z")], "Mars/Olympus")).not.toThrow();
    expect(Array.from(joursEmotionnels([a("2026-03-10T01:00:00Z")], null).keys())).toEqual([
      "2026-03-10",
    ]);
  });
});

describe("le fuseau arrive jusqu'au calcul", () => {
  /**
   * ⚠️⚠️ UN PARAMÈTRE QUE PERSONNE NE PASSE NE SERT À RIEN. Ces trois tests
   * regardent les APPELANTS, parce que c'est là que le défaut se reproduira :
   * le calcul, lui, est maintenant incapable de retomber sur Greenwich tout
   * seul (le paramètre est obligatoire, sans valeur par défaut).
   */
  it("la lecture serveur va chercher le fuseau du profil", () => {
    const src = lire("lib/discipline-streak-source.ts");
    expect(src, "la série serveur ne lit plus le fuseau du trader").toMatch(
      /from\("profiles"\)[\s\S]{0,120}?select\("timezone"\)/,
    );
    expect(src, "le fuseau lu n'est pas celui qu'on passe au calcul").toMatch(
      /serieDepuisLesTrades\(trades, geles, fuseau\)/,
    );
  });

  it("le tableau de bord passe le fuseau du navigateur", () => {
    const src = lire("components/dashboard/GoalsStreaks.tsx");
    expect(src).toMatch(/serieDepuisLesTrades\([^)]*browserTimezone\(\)\)/);
    expect(src, "le jour proposé au gel se choisit encore à Greenwich").toMatch(
      /joursEmotionnels\([^)]*browserTimezone\(\)\)/,
    );
  });

  it("les objectifs proposés par l'IA partent du même jour que l'écran", () => {
    const src = lire("app/api/goals/insights/route.ts");
    expect(src).toMatch(/serieDepuisLesTrades\(trades, geles, fuseau\)/);
  });

  /**
   * ⚠️⚠️ ET LA DÉCOUPE À GREENWICH NE REVIENT PAS PAR LA FENÊTRE. Le défaut
   * tenait dans une seule expression ; c'est elle qu'on interdit, dans le
   * fichier où elle vivait.
   */
  it("plus aucune découpe de jour à la main dans le module de la série", () => {
    const src = lire("lib/discipline-streak-source.ts");
    expect(
      src.replace(/^\s*\*.*$/gm, ""),
      "un jour se recoupe à la main : la découpe de Greenwich est revenue",
    ).not.toMatch(/open_time\.split\(/);
  });
});
