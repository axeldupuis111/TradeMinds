import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ON N'ANNONCE PAS LA RÉUSSITE D'UNE ÉCRITURE DONT ON IGNORE LE SORT.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « OBJECTIF AJOUTÉ » S'AFFICHAIT PAR-DESSUS « NON ENREGISTRÉ. RÉESSAIE. »
 * Sur la page Objectifs, `createCustom` faisait tout ce qu'il fallait : elle
 * lisait son `error`, elle le disait. Puis son appelant, deux lignes plus bas,
 * annonçait le succès sans lui demander son avis, effaçait le champ et fermait
 * la modale. Le trader lisait « objectif ajouté », perdait sa phrase, et ne
 * trouvait l'objectif nulle part.
 *
 * ⚠️ MESURÉ EN PRODUCTION, en faisant échouer depuis le navigateur toute
 * écriture REST : la bannière verte s'affiche, la liste ne bouge pas.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une fonction qui sait dire « ça a raté » doit pouvoir être CRUE par qui
 * l'appelle : son verdict se recueille (`const ok = await f()`, `if (await
 * f())`), ou bien l'appelant se tait. Lire son erreur ne sert à rien si le
 * message de réussite passe par-dessus.
 */
describe("la réussite n'est pas annoncée par-dessus un échec", () => {
  /**
   * ⚠️ TOUT `app` ET TOUT `components`, et pas une liste de dossiers. La règle
   * ne parle pas d'un écran en particulier, elle parle d'une façon d'écrire :
   * la restreindre à sept dossiers, c'est refaire exactement le défaut qu'elle
   * décrit, une règle posée puis appliquée à une partie de ce qu'elle vise.
   */
  const PORTEE = ["app", "components"];

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /**
   * Le corps d'une fonction, accolades équilibrées.
   *
   * ⚠️ PAS UNE FENÊTRE DE N CARACTÈRES : trois gardes ont déjà menti pour
   * ça. Une fonction longue se ferait couper en deux et la moitié de son
   * contenu serait attribuée à la suivante.
   */
  function corps(src: string, iAccolade: number): string {
    let p = 0;
    for (let k = iAccolade; k < src.length; k++) {
      if (src[k] === "{") p++;
      else if (src[k] === "}") {
        p--;
        if (p === 0) return src.slice(iAccolade, k + 1);
      }
    }
    return src.slice(iAccolade);
  }

  /** « Je dis que ça a raté. » */
  const DIT_ECHEC =
    /set\w*(?:Notice|Erreur|Error|Toast|Message|Feedback)\s*\(\s*(?:["'`](?:echec|error|fail)|\{\s*type:\s*["']error)/i;
  /** « Je dis que ça a marché. » */
  const DIT_REUSSITE =
    /set\w*(?:Notice|Toast|Message|Feedback|Succes|Success)\s*\(\s*(?:["'`](?!echec|error|fail)\w|\{\s*type:\s*["'](?:success|ok|info))/i;

  function balayer() {
    const fautes: string[] = [];
    let parlantesVues = 0;
    for (const d of PORTEE) {
      for (const chemin of fichiers(join(process.cwd(), d))) {
        const src = readFileSync(chemin, "utf8");
        const nom = chemin.split(/[\/]/).slice(-2).join("/");

        // 1. Les fonctions locales qui savent dire « ça a raté ».
        const parlantes = new Set<string>();
        for (const m of Array.from(src.matchAll(/(?:async\s+function|function)\s+(\w+)\s*\(/g))) {
          const i = src.indexOf("{", m.index! + m[0].length);
          if (i < 0) continue;
          if (DIT_ECHEC.test(corps(src, i))) parlantes.add(m[1]);
        }
        // ⚠️ ET LES FONCTIONS FLÉCHÉES : `const enregistrer = async () => {`.
        // Ne connaître qu'une syntaxe protège la moitié du produit.
        for (const m of Array.from(
          src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]*)?=>\s*\{/g),
        )) {
          const i = src.indexOf("{", m.index! + m[0].length - 1);
          if (i < 0) continue;
          if (DIT_ECHEC.test(corps(src, i))) parlantes.add(m[1]);
        }
        parlantesVues += parlantes.size;

        // 2. Les appels qui jettent le verdict et annoncent quand même.
        for (const nomFn of Array.from(parlantes)) {
          // ⚠️ Double barre oblique inverse : dans un litteral JS, `\\s` est necessaire
          // pour obtenir un `\s` dans le motif ; une seule donne la lettre « s ».
          const appel = new RegExp("(^|[^.\\w])await\\s+" + nomFn + "\\s*\\(", "g");
          for (const m of Array.from(src.matchAll(appel))) {
            const avant = src.slice(Math.max(0, m.index! - 60), m.index! + m[1].length);
            // Le verdict est-il recueilli ? `const ok = await f(` / `if (await f(`
            if (/[=:]\s*$/.test(avant)) continue;
            if (/\bif\s*\(\s*!?\s*$/.test(avant)) continue;
            const suite = src.slice(m.index!, m.index! + 400);
            const dit = DIT_REUSSITE.exec(suite);
            if (!dit) continue;
            const ligne = src.slice(0, m.index!).split(/\r?\n/).length;
            fautes.push(`${nom}:${ligne} await ${nomFn}(…) puis ${dit[0].trim()}`);
          }
        }
      }
    }
    return { fautes, parlantesVues };
  }

  it("le balayage trouve bien des fonctions qui savent dire l'échec", () => {
    /**
     * ⚠️ SANS CE COMPTE, LE TEST SERAIT VERT POUR LA PIRE RAISON : si plus
     * aucune fonction ne lisait son erreur, il n'y aurait plus rien à
     * contredire et le fichier passerait en silence.
     */
    expect(balayer().parlantesVues).toBeGreaterThan(10);
  });

  it("aucun appelant n'annonce un succès qu'il n'a pas vérifié", () => {
    const { fautes } = balayer();
    expect(
      fautes,
      "réussites annoncées sans avoir lu le verdict : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LA PAGE RÉPARÉE RECUEILLE BIEN LES DEUX VERDICTS. Le balayage
   * ci-dessus ne verrait plus rien si l'on retirait les messages de réussite :
   * il faut donc nommer ce qui a été corrigé.
   */
  it("la création d'objectif ne se félicite que si elle a écrit", () => {
    const src = readFileSync(join(process.cwd(), "app/dashboard/goals/page.tsx"), "utf8");
    expect(src).toContain("ecrit = await addMetricGoal(");
    expect(src).toContain("ecrit = await createCustom(");
    expect(src).toContain("if (ecrit) setNotice(");
    // Rien n'est écrit, donc le champ du trader n'est pas effacé.
    expect(src).toContain("if (!ecrit) return;");
  });
});
