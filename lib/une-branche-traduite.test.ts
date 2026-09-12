import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN TERNAIRE NE TRADUIT PAS UNE BRANCHE SUR DEUX.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « VOIR CHECKLIST TECHNIQUE · ICT LIQUIDITÉ → », SUR UNE PAGE EN ANGLAIS.
 * Le lien de la page Séance appelait `t("session_ict_link")` quand aucune
 * stratégie n'existait, et écrivait la phrase EN FRANÇAIS, en dur, dès qu'il y
 * en avait une. La branche traduite était celle que presque personne ne voit ;
 * la branche codée en dur était le cas normal, puisqu'on ne démarre pas une
 * séance sans stratégie.
 *
 * ⚠️ C'est la forme que ce dépôt répare le plus souvent : la règle existait,
 * la clé existait dans les quatre langues, et elle n'était appelée que sur le
 * repli. Trouvé en servant le tableau de bord en anglais et en LISANT LE DOM,
 * pas le code : dans la source, les deux branches se ressemblent.
 *
 * ── CE QUE LE GARDE CHERCHE ─────────────────────────────────────────────────
 *
 * `condition ? A : B` où exactement une des deux branches appelle `t(` et
 * l'autre est une chaîne littérale porteuse de texte lisible.
 */
describe("les ternaires de traduction", () => {
  const RACINES = ["app", "components"];
  /** Écrans internes d'Axel et pages du réseau partenaire : français assumé. */
  const HORS_PERIMETRE = [
    "dashboard/admin",
    "design-system",
    "PartnerJoinPage",
    "PartnerStatsPage",
  ];

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  function sansCommentaires(src: string): string {
    return src
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^[ \t]*\/\/.*$/gm, " ");
  }

  /**
   * ⚠️ ON SUIT LES DÉLIMITEURS, ON NE PREND PAS UNE FENÊTRE DE N CARACTÈRES.
   * Trois gardes de ce dépôt ont menti pour avoir confondu une fenêtre avec une
   * frontière : 400 caractères débordent sur l'élément suivant.
   */
  function branches(src: string, indexDuPoint: number): [string, string] | null {
    let prof = 0;
    let i = indexDuPoint + 1;
    let coupure = -1;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "(" || c === "[" || c === "{") prof++;
      else if (c === ")" || c === "]" || c === "}") {
        prof--;
        if (prof < 0) break;
      } else if (prof === 0 && c === "?") return null; // ternaire imbriqué
      else if (prof === 0 && c === ":" && coupure === -1) coupure = i;
      else if (prof === 0 && (c === ";" || c === ",")) break;
    }
    if (coupure === -1) return null;
    return [src.slice(indexDuPoint + 1, coupure), src.slice(coupure + 1, i)];
  }

  /** Une chaîne littérale porteuse de texte LU, pas une classe CSS ni un chemin. */
  function litteralVisible(bout: string): string | null {
    const m = /^[\s\n]*[`"']([^`"']{4,})[`"'][\s\n]*$/.exec(
      bout.replace(/\$\{[^}]*\}/g, " "),
    );
    if (!m) return null;
    const texte = m[1];
    if (!/[a-zà-ÿ]{3}/i.test(texte)) return null;
    if (/^[a-z0-9:_\-/.\s]+$/.test(texte) && !/\s[a-z]{3,}\s/.test(texte)) return null;
    if (/^\/|^https?:|^#[0-9a-f]{3,}/i.test(texte)) return null;
    return texte;
  }

  it("reconnaît la faute quand on la lui montre", () => {
    const faux = 'x ? `Voir checklist technique · ${n} →` : t("session_ict_link")';
    const b = branches(faux, faux.indexOf("?"));
    expect(b, "le découpage échoue").not.toBeNull();
    const [a, z] = b!;
    expect(/\bt\(/.test(a)).toBe(false);
    expect(/\bt\(/.test(z)).toBe(true);
    expect(litteralVisible(a)).toContain("Voir checklist technique");
  });

  it("n'écrit pas de texte en dur dans la branche que l'on voit", () => {
    const fautes: string[] = [];
    let examines = 0;

    for (const racine of RACINES) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        const relatif = chemin.replace(process.cwd() + "\\", "").replace(/\\/g, "/");
        if (HORS_PERIMETRE.some((h) => relatif.includes(h))) continue;
        const src = sansCommentaires(readFileSync(chemin, "utf8"));

        for (let i = 0; i < src.length; i++) {
          if (src[i] !== "?") continue;
          if (src[i + 1] === "?" || src[i - 1] === "?" || src[i + 1] === ".") continue;
          const b = branches(src, i);
          if (!b) continue;
          const [a, z] = b;
          const aTrad = /\bt\(/.test(a);
          const zTrad = /\bt\(/.test(z);
          if (aTrad === zTrad) continue;
          examines++;
          const brute = litteralVisible(aTrad ? z : a);
          if (!brute) continue;
          const ligne = src.slice(0, i).split("\n").length;
          fautes.push(`${relatif}:${ligne} « ${brute.slice(0, 70)} »`);
        }
      }
    }

    // ⚠️ Un garde qui ne trouve rien ne protège rien : ce dépôt a déjà payé
    // plusieurs balayages qui parcouraient le vide sans le dire.
    expect(
      examines,
      "aucun ternaire à une seule branche traduite : le motif ne correspond plus",
    ).toBeGreaterThan(50);

    expect(
      fautes,
      "texte écrit en dur en face d'une branche traduite : " + fautes.join(" | "),
    ).toEqual([]);
  });
});
