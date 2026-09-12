import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "./plan-limits";
import { sansCommentaires } from "./sans-commentaires";
import {
  localDateKey,
  quotaResetKey,
  startOfBrowserDayIso,
  startOfLocalDayUtc,
  weekStartLocalKey,
} from "./timezone";

/**
 * IL N'Y A QU'UN SEUL MINUIT, ET C'EST CELUI DU TRADER.
 *
 * ── LE DÉFAUT, MESURÉ ───────────────────────────────────────────────────────
 *
 * ⚠️⚠️ DEUX « AUJOURD'HUI » COEXISTAIENT SUR LE MÊME ÉCRAN. Le tableau de bord
 * est un composant SERVEUR : `new Date()` y donne l'heure de Vercel, donc UTC.
 * « Aujourd'hui », « cette semaine » et « ce mois » se coupaient à minuit UTC,
 * pendant que la carte « État du jour » rendue quinze pixels plus bas, la garde
 * d'arrêt et le calculateur de position se coupaient à minuit LOCAL.
 *
 * ⚠️ CE N'ÉTAIT PAS THÉORIQUE : relevé en base, deux trades du journal réel
 * tombent déjà entre les deux minuits (00 h 52 à Paris, 00 h 42 à Johannesburg),
 * et les profils couvrent 22 fuseaux, de Chicago à Sydney. À Sydney la fenêtre
 * fait dix heures : la séance ouverte à 9 h se refermait toute seule vers 11 h,
 * et le bandeau réclamait une séance déjà faite.
 *
 * ⚠️⚠️ ET LA CLÉ DE QUOTA N'EST PAS UN AFFICHAGE. Le navigateur ÉCRIT
 * `daily_ai_reset` / `daily_chat_reset` ; le serveur COMPARE la colonne à la clé
 * qu'il recalcule dans le fuseau du trader. Une clé UTC écrite par le client
 * n'était donc jamais reconnue entre les deux minuits, et le serveur repartait
 * de zéro : le quota d'analyse, facturé à chaque appel, se rechargeait seul.
 */
describe("un seul minuit", () => {
  const FUSEAUX = ["Europe/Paris", "America/Chicago", "Australia/Sydney", "Asia/Calcutta", "UTC"];

  /**
   * ⚠️ LE TEST QUI COMPTE : la clé du CLIENT et celle du SERVEUR sortent
   * maintenant de la même fonction, donc elles ne peuvent plus diverger. On
   * vérifie que la fonction existe, qu'elle suit le mode déclaré par le plan, et
   * qu'elle ne dépend que du fuseau.
   */
  it("dérive la clé de quota du plan et du fuseau, pas de l'appelant", () => {
    for (const fuseau of FUSEAUX) {
      for (const plan of ["free", "plus", "premium"] as const) {
        const mode = PLAN_LIMITS.analyze[plan].resetMode;
        const attendue = mode === "week" ? weekStartLocalKey(fuseau) : localDateKey(fuseau);
        expect(quotaResetKey(mode, fuseau), `clé du plan ${plan} en ${fuseau}`).toBe(attendue);
        expect(quotaResetKey(mode, fuseau)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  /**
   * ⚠️ UNE CLÉ HEBDOMADAIRE EST TOUJOURS UN LUNDI. L'ancienne version côté
   * client mélangeait deux horloges (`getDay()` local, `toISOString()` UTC) et
   * pouvait rendre le DIMANCHE précédent : une clé que le serveur, qui rend
   * toujours un lundi, ne pouvait reconnaître aucun jour de l'année.
   */
  it("pose la semaine sur un lundi dans tous les fuseaux", () => {
    for (const fuseau of FUSEAUX) {
      const cle = quotaResetKey("week", fuseau);
      const jour = new Date(`${cle}T12:00:00Z`).getUTCDay();
      expect(jour, `${cle} n'est pas un lundi en ${fuseau}`).toBe(1);
    }
  });

  /**
   * ⚠️ LE CAS SYDNEY, ÉCRIT EN TOUTES LETTRES. Un trader à Sydney le 12 à 9 h
   * du matin : il est encore le 11 à Greenwich. Sa journée, ses quotas et sa
   * séance doivent tous dire « le 12 ».
   */
  it("donne au trader de Sydney sa propre journée", () => {
    const neufHeuresASydney = new Date("2026-09-11T23:00:00Z");
    expect(neufHeuresASydney.toISOString().slice(0, 10), "l'ancien calcul").toBe("2026-09-11");
    expect(localDateKey("Australia/Sydney", neufHeuresASydney)).toBe("2026-09-12");
    expect(startOfLocalDayUtc("Australia/Sydney", neufHeuresASydney).toISOString()).toBe(
      "2026-09-11T14:00:00.000Z",
    );
  });

  /** L'aide client existe et rend bien un instant, pas une date nue. */
  it("borne une requête avec un instant, pas avec une date", () => {
    expect(startOfBrowserDayIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  /**
   * ⚠️⚠️ ET LA RÈGLE NE PEUT PLUS ÊTRE APPLIQUÉE À MOITIÉ. Le balayage vise la
   * forme exacte du défaut : une variable de FRONTIÈRE DE JOUR nourrie par
   * l'horloge UTC. Il laisse tranquilles les noms de fichiers d'export et les
   * dates de PDF, où la convention n'a aucune conséquence.
   */
  it("ne laisse plus une frontière de jour se calculer en UTC", () => {
    const MAUVAIS = /\b(?:const|let)\s+(today|todayKey|todayStart|dayStart|monday|weekStart|monthStart|resetKey|sevenDaysAgoStr)\b[^;\n]*new Date\([^;]*\.toISOString\(\)\s*\.\s*(?:split\(\s*["'`]T["'`]\s*\)\s*\[0\]|slice\(\s*0\s*,\s*10\s*\))/;

    // Le motif doit reconnaître la faute quand on la lui montre, sinon il ne
    // protège rien : trois gardes de ce dépôt ont déjà menti faute de ça.
    expect(MAUVAIS.test('const today = new Date().toISOString().split("T")[0];')).toBe(true);
    expect(MAUVAIS.test("const monthStart = new Date().toISOString().slice(0, 10);")).toBe(true);
    expect(MAUVAIS.test("const today = startOfBrowserDayIso();")).toBe(false);
    expect(
      MAUVAIS.test('a.download = `trades_${new Date().toISOString().split("T")[0]}.csv`;'),
      "un nom de fichier n'est pas une frontière de jour",
    ).toBe(false);

    function fichiers(d: string, out: string[] = []): string[] {
      for (const f of readdirSync(d)) {
        if (f === "node_modules" || f === ".next") continue;
        const c = join(d, f);
        if (statSync(c).isDirectory()) fichiers(c, out);
        else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
      }
      return out;
    }

    const fautes: string[] = [];
    for (const racine of ["app", "components", "lib"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        const src = sansCommentaires(readFileSync(chemin, "utf8"));
        for (const ligne of src.split("\n")) {
          if (MAUVAIS.test(ligne)) {
            fautes.push(chemin.split(/[\\/]/).slice(-2).join("/") + " : " + ligne.trim());
          }
        }
      }
    }
    expect(
      fautes,
      "frontières de jour calculées sur l'horloge de Greenwich : " + fautes.join(" | "),
    ).toEqual([]);
  });
});
