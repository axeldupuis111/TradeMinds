import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN BOUTON QUI N'EST QU'UNE ICÔNE PORTE QUAND MÊME UN NOM.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ CINQ BOUTONS N'ÉTAIENT QU'UN `<svg>`, SANS AUCUN NOM. Pour une lecture
 * d'écran, ils s'annoncent « bouton », point. Dont celui qui ENVOIE la question
 * au coach, et les deux flèches qui changent de mois dans le calendrier de
 * trading : trois gestes qu'on ne peut pas deviner.
 *
 * ⚠️ L'AUDIT D'ACCESSIBILITÉ DE JUIN LES DÉCLARAIT « COMPLET ». Il l'était à la
 * date où il a été fait ; les écrans arrivés depuis ne l'étaient pas, et rien
 * ne le disait. C'est la différence entre une vérification et un garde.
 *
 * ── CE QUE CE TEST TIENT, ET CE QU'IL NE TIENT PAS ──────────────────────────
 *
 * ⚠️ IL NE JUGE QUE LES BOUTONS PUREMENT ICÔNE : contenu réduit à des `<svg>`
 * ou à des composants d'icône auto-fermants, rien d'autre. Un bouton qui porte
 * du texte se nomme tout seul. Cette précision est ce qui rend le garde
 * utilisable : une version plus large sortait 242 résultats dont l'écrasante
 * majorité étaient faux, et un garde qui accuse à faux deux cents fois ne sera
 * plus jamais lu.
 */
describe("les boutons icône ont un nom", () => {
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

  /**
   * L'index du `>` qui ferme une balise ouvrante.
   *
   * ⚠️ ON COMPTE LES ACCOLADES ET LES GUILLEMETS : `onClick={() => x}` contient
   * un `>`, et s'arrêter au premier couperait la balise en plein milieu. C'est
   * la première erreur que j'ai faite, et elle produit des résultats qui ont
   * l'air plausibles.
   */
  function finDeBalise(src: string, depart: number): number {
    let prof = 0;
    let guillemet: string | null = null;
    for (let j = depart; j < src.length; j++) {
      const c = src[j];
      if (guillemet) {
        if (c === guillemet && src[j - 1] !== "\\") guillemet = null;
      } else if (c === '"' || c === "'" || c === "`") {
        guillemet = c;
      } else if (c === "{") {
        prof++;
      } else if (c === "}") {
        prof--;
      } else if (c === ">" && prof === 0) {
        return j;
      }
    }
    return -1;
  }

  /**
   * Un `<svg>…</svg>`, un composant d'icône auto-fermant (`<X … />`), ou une
   * forme purement décorative.
   *
   * ⚠️⚠️ LA TROISIÈME A ÉTÉ AJOUTÉE APRÈS COUP : la bascule mensuel/annuel de
   * la page Abonnement ne contient qu'un `<div>` rond, le bouton de
   * l'interrupteur. Ni texte, ni icône : le garde ne la voyait pas, et une
   * lecture d'écran annonçait « bouton », sans dire qu'on choisit une
   * périodicité ni laquelle est choisie. Un élément vide est aussi muet qu'une
   * icône, et pour la même raison.
   */
  const SVG = /<svg\b[\s\S]*?<\/svg>/g;
  const ICONE = /<[A-Z][A-Za-z0-9]*\b[^<>]*\/>/g;
  const DECOR = /<(div|span)\b[^<>]*\/>|<(div|span)\b[^<>]*>\s*<\/\2>/g;

  function boutonsSansNom(source: string): number[] {
    const lignes: number[] = [];
    for (const m of Array.from(source.matchAll(/<button\b/g))) {
      const debut = m.index!;
      const ouvrante = finDeBalise(source, debut);
      if (ouvrante < 0 || source[ouvrante - 1] === "/") continue;
      const fin = source.indexOf("</button>", ouvrante);
      if (fin < 0) continue;
      const interne = source.slice(ouvrante + 1, fin);
      if (interne.length > 1200) continue;
      // Ce qui reste une fois les icônes retirées : vide = bouton icône seule.
      if (interne.replace(SVG, " ").replace(ICONE, " ").replace(DECOR, " ").trim()) continue;
      if (/aria-label|aria-labelledby|title=/.test(source.slice(debut, ouvrante + 1))) continue;
      if (interne.includes("sr-only")) continue;
      lignes.push(source.slice(0, debut).split(SAUT).length);
    }
    return lignes;
  }

  it("la sonde distingue un bouton icône d'un bouton avec texte", () => {
    const iconeSeule = `<button onClick={() => f(1 > 0)}><svg><path d="M1 1" /></svg></button>`;
    expect(boutonsSansNom(iconeSeule)).toHaveLength(1);
    // ⚠️ Le `>` de la flèche ne doit pas couper la balise : garde sur le garde.
    expect(boutonsSansNom(`<button onClick={() => x}>{t("k")}</button>`)).toHaveLength(0);
    expect(boutonsSansNom(`<button aria-label="Fermer"><X /></button>`)).toHaveLength(0);
    expect(boutonsSansNom(`<button><X /><span className="sr-only">Fermer</span></button>`)).toHaveLength(0);
    // Un interrupteur qui ne contient qu'un rond est aussi muet qu'une icone.
    expect(boutonsSansNom(`<button onClick={f}><div className="absolute" /></button>`)).toHaveLength(1);
  });

  it("aucun bouton purement icône n'est laissé sans nom", () => {
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      for (const ligne of boutonsSansNom(sansCommentaires(readFileSync(chemin, "utf8")))) {
        fautes.push(`${nom}:${ligne}`);
      }
    }
    expect(
      fautes,
      "boutons icône sans aria-label : " + fautes.join(", "),
    ).toEqual([]);
  });
});
