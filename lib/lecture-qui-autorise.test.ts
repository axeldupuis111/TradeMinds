import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE LECTURE QUI AUTORISE UNE ÉCRITURE DOIT L'INTERDIRE QUAND ELLE ÉCHOUE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE WEBHOOK STRIPE FAISAIT RENTRER UN MEMBRE EXCLU. Son commentaire dit
 * exactement ce que le test protège : « un membre retiré par l'animateur reste
 * dehors : sans ce test, son prochain paiement le ferait rentrer par la
 * fenêtre ». Or le test jetait son `error` : une lecture refusée rend
 * `blocked = null`, c'est-à-dire « il n'est pas bloqué », et le membre exclu
 * rentrait quand même. La règle était écrite, et son mode de panne la défaisait.
 *
 * ⚠️ LA MÊME FORME AILLEURS : l'unicité d'un pseudo (une lecture ratée disait
 * « libre »), le premier rattachement à une communauté, et la déduplication de
 * l'import CSV, qui faisait re-importer un journal entier.
 *
 * ── LA DISTINCTION QUI REND LA RÈGLE MÉCANIQUE ──────────────────────────────
 *
 * ⚠️⚠️ LE SENS DU TEST DIT TOUT. `if (x) return` veut dire « il existe déjà, on
 * s'arrête » : une lecture ratée rend `x` absent, donc ON PASSE, et l'écriture
 * a lieu alors qu'elle ne le devait pas. Le sens inverse, `if (!x) return`, se
 * ferme tout seul quand la lecture rate : il n'a rien à prouver.
 *
 * On ne vise donc que les portes qui S'OUVRENT sur un échec.
 */
describe("les lectures qui gardent une écriture", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /** L'instruction : la chaîne d'appels, jamais une fenêtre de N lignes. */
  function instruction(lignes: string[], i: number): string {
    let bloc = lignes[i].trim() + " ";
    for (let j = i + 1; j < lignes.length; j++) {
      const suite = lignes[j].trim();
      if (!suite.startsWith(".")) break;
      bloc += suite + " ";
    }
    return bloc;
  }

  /** Le corps de la fonction qui contient cet index, accolades remontées. */
  function fonctionEnglobante(src: string, depart: number): string | null {
    let prof = 0;
    for (let j = depart; j >= 0; j--) {
      const c = src[j];
      if (c === "}") prof++;
      else if (c === "{") {
        if (prof > 0) { prof--; continue; }
        if (!/(?:=>|\))\s*$/.test(src.slice(Math.max(0, j - 140), j))) continue;
        let p = 0;
        for (let k = j; k < src.length; k++) {
          if (src[k] === "{") p++;
          else if (src[k] === "}") {
            p--;
            if (p === 0) return src.slice(j, k + 1);
          }
        }
        return src.slice(j);
      }
    }
    return null;
  }

  function balayer() {
    const fautes: string[] = [];
    let portes = 0;
    for (const racine of ["app", "components"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        const src = readFileSync(chemin, "utf8");
        const lignes = src.split(/\r?\n/);
        const nom = chemin.split(/[\\/]/).slice(-2).join("/");

        for (let i = 0; i < lignes.length; i++) {
          /**
           * ⚠️ ON RECONNAIT LES DEUX ORTHOGRAPHES, et le compteur en depend :
           * s'il ne comptait que celles qui jettent leur `error`, il tomberait
           * a zero au fur et a mesure des corrections et ce test finirait vert
           * en ne regardant plus rien.
           */
          const m = /^\s*const\s*\{\s*data:\s*(\w+)\s*(?:,\s*error:\s*\w+\s*)?\}\s*=\s*await\s/.exec(
            lignes[i],
          );
          if (!m) continue;
          const litSonErreur = /error:/.test(lignes[i]);
          const bloc = instruction(lignes, i);
          if (!/\.select\(/.test(bloc)) continue;
          if (/\.(insert|update|upsert|delete)\(/.test(bloc)) continue;
          const variable = m[1];

          const index = lignes.slice(0, i).join("\n").length;
          const corps = fonctionEnglobante(src, index);
          if (!corps) continue;

          // La porte s'ouvre-t-elle sur un échec ? (`if (x) return`)
          const ouvre = new RegExp(
            "if\\s*\\(\\s*" + variable + "\\b[^)]*\\)\\s*(?:\\{[^}]*)?(?:return|throw)",
          ).test(corps);
          if (!ouvre) continue;
          // Et une écriture suit-elle dans la même fonction ?
          if (!/\.(insert|update|upsert|delete)\(/.test(corps)) continue;

          portes++;
          if (litSonErreur) continue;
          /**
           * ⚠️ UNE RAISON ÉCRITE SUFFIT, comme pour les écritures muettes :
           * certaines de ces lectures ne gardent rien du tout (un cache, un
           * enrichissement de contexte). Exiger un `error` partout ferait
           * ajouter des vérifications creuses.
           */
          const amont = lignes.slice(Math.max(0, i - 8), i).join(" ");
          if (/VOLONTAIREMENT IGNOR/.test(amont)) continue;
          fautes.push(`${nom}:${i + 1} (${variable})`);
        }
      }
    }
    return { fautes, portes };
  }

  it("balaie bien des portes, sinon ce test ne prouve rien", () => {
    expect(balayer().portes, "plus aucune porte : le motif ne cherche rien").toBeGreaterThan(4);
  });

  it("aucune porte ne s'ouvre toute seule quand la lecture rate", () => {
    const { fautes } = balayer();
    expect(
      fautes,
      "lectures dont l'échec autorise l'écriture qu'elles devaient interdire : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LES TROIS PORTES RÉPARÉES SONT NOMMÉES. Le balayage ci-dessus ne les
   * verrait plus si l'on retirait la garde ET le test : il faut donc dire ce
   * qu'elles font.
   */
  it("les portes réparées refusent d'écrire quand elles n'ont pas pu lire", () => {
    const webhook = readFileSync(join(process.cwd(), "app/api/stripe/webhook/route.ts"), "utf8");
    expect(webhook, "la liste des exclus n'est plus vérifiée").toContain("erreurBlocage");
    expect(webhook).toContain("rattachement abandonne");

    const communaute = readFileSync(join(process.cwd(), "app/api/community/route.ts"), "utf8");
    expect(communaute, "l'appartenance n'est plus vérifiée").toContain("erreurAppartenance");

    const reglages = readFileSync(join(process.cwd(), "app/dashboard/settings/page.tsx"), "utf8");
    expect(reglages, "l'unicité du pseudo n'est plus vérifiée").toContain("erreurUnicite");
    expect(reglages).toContain('t("settings_username_uncheckable")');
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : l'exemption doit rester rare et écrite. Si elle se
   * répandait, ce test ne dirait plus rien.
   */
  it("les fermetures volontaires restent comptées", () => {
    let n = 0;
    for (const racine of ["app", "components"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        n += (readFileSync(chemin, "utf8").match(/FERMETURE VOLONTAIRE/g) || []).length;
      }
    }
    expect(n, "aucune fermeture volontaire : le motif ne correspond plus").toBeGreaterThan(0);
    expect(n, "trop d'exemptions : la règle ne veut plus rien dire").toBeLessThan(5);
  });
});
