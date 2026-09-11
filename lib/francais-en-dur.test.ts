import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AUCUN ÉCRAN DU PRODUIT N'ÉCRIT SA PROSE EN FRANÇAIS EN DUR.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LA SAISIE RAPIDE D'UN TRADE, EN PLEINE SÉANCE :
 * « Pourquoi tu prends ce trade ? » — écrit en dur, dans un produit traduit en
 * quatre langues. Et le « (optionnel) » juste à côté, lui, passait bien par le
 * dictionnaire : la phrase et sa parenthèse, sur la même ligne, l'une traduite
 * et l'autre non.
 *
 * ⚠️ LE GARDE EXISTANT NE POUVAIT PAS LE VOIR : `pas-de-texte-en-dur.test.ts`
 * cherche de la prose ANGLAISE, sur douze vues PUBLIQUES. Le symétrique n'avait
 * jamais été écrit.
 *
 * ⚠️⚠️ ET MA PREMIÈRE SONDE NE LE VOYAIT PAS NON PLUS : elle lisait ligne par
 * ligne, alors que le `>` ouvrant était sur la ligne d'avant. Une sonde qui
 * découpe par lignes rate tout ce qu'un formateur automatique a mis à la ligne.
 * Ici on recolle le fichier avant de chercher.
 *
 * ── LES EXCEPTIONS, TOUTES ÉCRITES ──────────────────────────────────────────
 *
 * Trois vues assument le français, et chacune le dit dans son en-tête. Ce test
 * exige justement cette déclaration : une exception sans raison lisible
 * redevient un oubli.
 */
describe("le produit ne parle pas français en dur", () => {
  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next" || f === "i18n") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /**
   * Les écrans qui assument le français, et pourquoi.
   *
   * ⚠️ CHACUN DOIT LE DIRE DANS SON PROPRE FICHIER : le test vérifie plus bas
   * que la raison y est écrite. Une liste tenue ici seule serait un
   * interrupteur ; adossée à une phrase dans le fichier, c'est une décision.
   */
  const ASSUMENT_LE_FRANCAIS = [
    // Page qu'Axel est seul à voir.
    "app/dashboard/admin/page.tsx",
    // Démo interne, renvoie notFound() en production.
    "app/dashboard/design-system/page.tsx",
    // Collaborateurs d'une société française, atteignable par code seulement.
    "components/pages/PartnerJoinPage.tsx",
    "components/pages/PartnerStatsPage.tsx",
  ];

  /** Un mot outil français, ou un accent : ce qui trahit de la prose. */
  const MOTS =
    /(?:^|\s)(?:le|la|les|des|une|un|du|de|tes|ton|ta|vos|votre|ce|cette|pour|avec|sans|dans|sur|par|plus|moins|est|sont|tu|qui|que|quand|pas|au|aux|en|ne|se|si)\s/i;
  const ACCENT = /[àâäéèêëîïôöùûüçÀÂÉÈÊËÎÏÔÖÙÛÜÇ]/;

  /**
   * Le fichier sans ses commentaires : ils parlent français, c'est voulu.
   *
   * ⚠️⚠️ ET LES COMMENTAIRES JSX MULTILIGNES COMPTENT AUTANT QUE LES AUTRES.
   * Ma première version ne fermait le bloc que pour `/*`, pas pour `{/*` : les
   * lignes de suite d'un commentaire JSX restaient dans le texte, et leur `}`
   * final coupait la recherche. Résultat : le commentaire que je venais
   * d'écrire AU-DESSUS de la phrase fautive cachait cette phrase au garde. J'ai
   * remis le défaut pour m'en assurer, il n'a pas bronché.
   */
  function sansCommentaires(source: string): string {
    let dans = false;
    return source
      .split(SAUT)
      .map((l) => {
        const nu = l.trim();
        if (dans) {
          if (nu.includes("*/")) dans = false;
          return "";
        }
        if (nu.startsWith("/*") || nu.startsWith("{/*")) {
          if (!nu.includes("*/")) dans = true;
          return "";
        }
        if (nu.startsWith("*") || nu.startsWith("//")) return "";
        return l;
      })
      .join("\n");
  }

  function proseFrancaise(source: string): { ligne: number; texte: string }[] {
    const joint = sansCommentaires(source);
    const out: { ligne: number; texte: string }[] = [];
    for (const m of Array.from(joint.matchAll(/>([^<>{}]{10,200})</g))) {
      const texte = m[1].replace(/\s+/g, " ").trim();
      if (texte.length < 10) continue;
      if (!/[A-Za-zÀ-ÿ]{3}/.test(texte)) continue;
      if (!(ACCENT.test(texte) || MOTS.test(" " + texte + " "))) continue;
      out.push({ ligne: joint.slice(0, m.index).split("\n").length, texte });
    }
    return out;
  }

  it("la sonde reconnaît bien de la prose française mise à la ligne", () => {
    const exemple = [
      `<label className="block text-xs">`,
      `  Pourquoi tu prends ce trade ? <span>(optionnel)</span>`,
      `</label>`,
    ].join("\n");
    expect(proseFrancaise(exemple).map((x) => x.texte)).toContain(
      "Pourquoi tu prends ce trade ?",
    );
    // Du vocabulaire de trading n'est pas de la prose.
    expect(proseFrancaise(`<p>\n  Winrate\n</p>`)).toEqual([]);
    // Et un commentaire français ne compte pas.
    expect(proseFrancaise(`{/* Pourquoi tu prends ce trade ? vraiment */}`)).toEqual([]);
    /**
     * ⚠️ NI SUR PLUSIEURS LIGNES, ET SURTOUT : un commentaire JSX placé entre la
     * balise et le texte ne doit pas CACHER ce texte. C'est exactement ce qui
     * s'est passé, avec le commentaire que je venais d'écrire.
     */
    const avecCommentaire = [
      `<label className="block text-xs">`,
      `  {/* ⚠️ Cette question était écrite en français, en dur, dans un`,
      `      produit traduit en quatre langues. */}`,
      `  Pourquoi tu prends ce trade ? <span>(optionnel)</span>`,
      `</label>`,
    ].join("\n");
    expect(proseFrancaise(avecCommentaire).map((x) => x.texte)).toContain(
      "Pourquoi tu prends ce trade ?",
    );
  });

  it("aucune vue traduite n'écrit une phrase française en dur", () => {
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).join("/");
      if (ASSUMENT_LE_FRANCAIS.some((a) => nom.endsWith(a))) continue;
      for (const { ligne, texte } of proseFrancaise(readFileSync(chemin, "utf8"))) {
        fautes.push(`${nom.split("/").slice(-2).join("/")}:${ligne} « ${texte.slice(0, 60)} »`);
      }
    }
    expect(fautes, "phrases françaises en dur : " + fautes.join(" | ")).toEqual([]);
  });

  /**
   * ⚠️ ET CHAQUE EXCEPTION PORTE SA RAISON DANS SON FICHIER. Sans ça, la liste
   * ci-dessus deviendrait l'endroit où l'on range ce qu'on ne veut pas traduire.
   */
  it("chaque écran qui assume le français dit pourquoi, chez lui", () => {
    const sansRaison: string[] = [];
    for (const chemin of ASSUMENT_LE_FRANCAIS) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      // Une raison : un commentaire qui parle de français, de traduction, ou du
      // public restreint de la page.
      if (!/FRANÇAIS|français|traduit|quatre langues|notFound|admin/i.test(source)) {
        sansRaison.push(chemin);
      }
    }
    expect(sansRaison, "exceptions sans raison écrite : " + sansRaison.join(", ")).toEqual([]);
  });
});
