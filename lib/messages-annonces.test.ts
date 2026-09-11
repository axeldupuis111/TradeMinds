import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN MESSAGE QUI APPARAÎT TOUT SEUL DOIT ÊTRE ANNONCÉ.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ VINGT-QUATRE MESSAGES D'ERREUR ET LES DEUX BANDEAUX DE CONFIRMATION
 * PASSAIENT EN SILENCE. Une lecture d'écran n'annonce que ce qui reçoit le
 * focus ou ce qui vit dans une région déclarée vivante : un texte qui apparaît
 * ailleurs sur la page, elle ne le voit pas.
 *
 * ⚠️ ET C'EST EXACTEMENT CE QUE JE VENAIS D'AJOUTER. Plus tôt dans cette même
 * passe, j'ai fait dire à six écrans « Non enregistré. Réessaie. » au lieu de
 * mentir sur une écriture ratée. Sans région vivante, ces messages-là restaient
 * muets pour qui ne regarde pas l'écran : la moitié du travail.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une erreur s'annonce TOUT DE SUITE (`alert`, `assertive`) : elle interrompt,
 * parce qu'elle dit que l'action n'a pas eu lieu. Une réussite attend une pause
 * dans la lecture (`status`, `polite`) : elle informe sans couper la parole.
 */
describe("les messages qui surgissent sont annoncés", () => {
  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  function finDeBalise(src: string, depart: number): number {
    let prof = 0;
    let guillemet: string | null = null;
    for (let j = depart; j < src.length; j++) {
      const c = src[j];
      if (guillemet) {
        if (c === guillemet && src[j - 1] !== "\\") guillemet = null;
      } else if (c === '"' || c === "'" || c === "`") guillemet = c;
      else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0) return j;
    }
    return -1;
  }

  const tous = () => [...fichiers("app"), ...fichiers("components")];
  const court = (c: string) => c.split(/[\\/]/).slice(-2).join("/");

  /**
   * ⚠️ LE MOTIF VISE CE QUI EST RENDU PAR UNE ERREUR, et rien d'autre :
   * `{error && <p>…}`. C'est la forme exacte des messages qui surgissent après
   * une action ratée. Un texte d'erreur toujours présent, lui, se lit dans le
   * flux normal de la page et n'a pas besoin d'être crié.
   */
  it("chaque message rendu par une erreur est une alerte", () => {
    const fautes: string[] = [];
    let vus = 0;
    for (const chemin of tous()) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const m of Array.from(source.matchAll(/\{\s*(\w*(?:[eE]rror|[eE]rreur))\s*&&/g))) {
        const b = /<(p|div|span)\b/.exec(source.slice(m.index! + m[0].length, m.index! + m[0].length + 200));
        if (!b) continue;
        const debut = m.index! + m[0].length + b.index!;
        const fin = finDeBalise(source, debut);
        if (fin < 0) continue;
        vus++;
        const balise = source.slice(debut, fin + 1);
        if (/role=|aria-live/.test(balise)) continue;
        fautes.push(`${court(chemin)}:${source.slice(0, debut).split(SAUT).length} (${m[1]})`);
      }
    }
    expect(vus, "aucun message d'erreur trouvé : le motif ne cherche rien").toBeGreaterThan(15);
    expect(fautes, "erreurs muettes pour une lecture d'écran : " + fautes.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET LES DEUX BANDEAUX DE CONFIRMATION, qui ne passent pas par le motif
   * ci-dessus : ce sont eux qui disent « Paramètres sauvegardés ✓ », et surtout
   * « Non enregistré. Réessaie. ».
   */
  it("les bandeaux de confirmation distinguent l'erreur de la réussite", () => {
    for (const chemin of ["app/dashboard/settings/page.tsx", "app/dashboard/strategy/page.tsx"]) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(source, chemin).toContain('role={toast.type === "error" ? "alert" : "status"}');
      expect(source, chemin).toContain('aria-live={toast.type === "error" ? "assertive" : "polite"}');
    }
  });
});
