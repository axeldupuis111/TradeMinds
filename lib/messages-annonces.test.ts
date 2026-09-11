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
      /**
       * ⚠️⚠️ LE MOTIF NE CONNAISSAIT QU'UNE ORTHOGRAPHE. Il attrapait
       * `{error && <p>}` et laissait passer `{fieldErrors.sl && <p>}` : quinze
       * messages, dans les TROIS formulaires où l'on saisit un trade, tous
       * muets. Trouvé en cliquant « Sauvegarder » sans stop loss : le formulaire
       * refuse, l'écrit à côté du champ, et une lecture d'écran n'annonce rien
       * du tout. Le bouton a l'air de ne rien faire.
       *
       * ⚠️ C'est le même défaut que celui décrit en tête de ce fichier, et le
       * garde écrit pour lui ne couvrait que la moitié des façons de l'écrire.
       */
      for (const m of Array.from(
        source.matchAll(/\{\s*(\w*(?:[eE]rror|[eE]rreur)s?(?:\.\w+)?)\s*&&/g),
      )) {
        /**
         * ⚠️ ET LA BALISE DOIT SUIVRE IMMÉDIATEMENT. Sans ça, le motif attrape
         * une interpolation de chaîne et va chercher la première balise trente
         * lignes plus loin : il accuse alors un élément qui n'a rien à voir.
         */
        const suite = source.slice(m.index! + m[0].length, m.index! + m[0].length + 200);
        if (!/^\s*\(?\s*</.test(suite)) continue;
        const b = /<(p|div|span)\b/.exec(suite);
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

  /**
   * ── LA TROISIÈME ORTHOGRAPHE ────────────────────────────────────────────────
   *
   * ⚠️⚠️ UN MESSAGE NE S'APPELLE PAS TOUJOURS « error ». Trouvé en réimportant
   * un CSV : « Tous les trades existent déjà. Aucun doublon importé. » s'affiche
   * dans un `<p>` nu, parce que la variable s'appelle `message`. Dix messages
   * dans ce cas, dont les DEUX de l'écran de connexion — celui où l'échec est
   * le plus probable et où l'utilisateur n'a encore rien d'autre à lire.
   *
   * ⚠️ C'est la troisième fois que ce garde est élargi : `error`, puis
   * `fieldErrors.champ`, maintenant `message` / `notice` / `toast`. La leçon
   * n'est pas « il manquait un motif », c'est qu'un garde qui reconnaît les
   * défauts À LEUR NOM DE VARIABLE protège la moitié du produit.
   */
  it("les messages qui ne s'appellent pas « erreur » sont annoncés aussi", () => {
    const NOMS = "message|notice|toast|feedback|statut|avertissement";
    const fautes: string[] = [];
    let vus = 0;
    for (const chemin of tous()) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      // ⚠️ Double barre oblique inverse : dans un gabarit, `\s` vaut « s ».
      const motif = new RegExp(`\\{\\s*(\\w*(?:${NOMS})\\w*)(?:\\.\\w+)?\\s*&&`, "gi");
      for (const m of Array.from(source.matchAll(motif))) {
        const suite = source.slice(m.index! + m[0].length, m.index! + m[0].length + 200);
        if (!/^\s*\(?\s*</.test(suite)) continue;
        const b = /<(p|div|span)\b/.exec(suite);
        if (!b) continue;
        const debut = m.index! + m[0].length + b.index!;
        const fin = finDeBalise(source, debut);
        if (fin < 0) continue;
        vus++;
        if (/role=|aria-live/.test(source.slice(debut, fin + 1))) continue;
        fautes.push(`${court(chemin)}:${source.slice(0, debut).split(SAUT).length} (${m[1]})`);
      }
    }
    expect(vus, "aucun message trouvé : le motif ne cherche rien").toBeGreaterThan(5);
    expect(fautes, "messages muets pour une lecture d'écran : " + fautes.join(", ")).toEqual([]);
  });
});
