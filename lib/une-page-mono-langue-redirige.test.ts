import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE PAGE MONO-LANGUE PRÉFIXÉE D'UNE LOCALE REDIRIGE, ELLE NE RÉPOND PAS 404.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SIX ADRESSES PUBLIQUES RÉPONDAIENT 404 EN PRODUCTION. Mesuré le
 * 2026-09-18 en appelant les douze pages publiques dans les quatre langues :
 * `/fr/legal/cgv`, `/de/legal/cgv`, `/es/legal/cgv` et les trois
 * `/{fr,de,es}/partner/join` rendaient 404, pendant que leurs voisines
 * immédiates — `/fr/legal/terms`, `/fr/legal/privacy`, `/fr/mentions-legales` —
 * redirigeaient correctement en 301.
 *
 * La règle était écrite, sous la forme d'une LISTE DE CHEMINS EXACTS de trois
 * entrées. Les CGV, quatrième page légale, n'y avaient jamais été ajoutées, et
 * les pages partenaires non plus.
 *
 * ⚠️ CE QUE ÇA COÛTE : les CGV sont les conditions de VENTE, celles qu'on lit
 * avant de payer. Et `/partner/join` est la page d'inscription des apporteurs,
 * celle qu'un commercial partage sur le terrain — le produit met des centaines
 * de collaborateurs dessus.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * On compare des PRÉFIXES, pas des chemins exacts : une liste d'adresses
 * exactes est précisément ce qui a laissé passer les CGV, et elle laisserait
 * passer la prochaine page légale.
 */

const RACINE = process.cwd();
const middleware = () => readFileSync(join(RACINE, "middleware.ts"), "utf8");

/** Les chemins de page sous un dossier donné, « /legal/cgv » et compagnie. */
function cheminsDePage(base: string): string[] {
  const out: string[] = [];
  const parcourir = (dir: string, chemin: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (!statSync(p).isDirectory()) continue;
      if (["api", "dashboard", "[locale]"].includes(e)) continue;
      const suite = `${chemin}/${e}`;
      if (readdirSync(p).includes("page.tsx")) out.push(suite);
      parcourir(p, suite);
    }
  };
  parcourir(base, "");
  return out;
}

/**
 * Les pages MONO-LANGUE : celles qui existent à la racine et PAS sous
 * `app/[locale]`.
 *
 * ⚠️ La définition se lit sur le disque, elle ne se recopie pas : une liste
 * écrite à la main est précisément ce qui a laissé les CGV répondre 404.
 */
function pagesMonoLangue(): string[] {
  const racine = cheminsDePage(join(RACINE, "app"));
  const localisees = new Set(cheminsDePage(join(RACINE, "app", "[locale]")));
  return racine.filter((p) => !localisees.has(p));
}

describe("les pages mono-langue", () => {
  /**
   * ⚠️ CE TEST PART DU DISQUE, PAS D'UNE LISTE QUE J'AURAIS RECOPIÉE. Une liste
   * écrite à la main est exactement ce qui a produit le défaut.
   */
  it("sont toutes couvertes par un préfixe de redirection", () => {
    const src = middleware();
    const i = src.indexOf("const prefixesMonoLangue");
    expect(i, "la liste des préfixes mono-langue a disparu").toBeGreaterThan(0);
    const prefixes = Array.from(
      src.slice(i, src.indexOf("]", i)).matchAll(/"([^"]+)"/g),
      (m) => m[1],
    );
    expect(prefixes.length, "aucun préfixe lu : le garde ne protège rien").toBeGreaterThan(0);

    /**
     * ⚠️ DEUX FAMILLES SONT ÉCARTÉES, ET LE MIDDLEWARE S'EN OCCUPE AILLEURS :
     * `/profile/<pseudo>` (surface publique d'acquisition, hors routage de
     * locale) et `/auth/...` (retours de lien signés, jamais partagés avec un
     * préfixe). Tout le reste doit être couvert.
     */
    const aCouvrir = pagesMonoLangue().filter(
      (p) => !p.startsWith("/profile") && !p.startsWith("/auth"),
    );
    expect(aCouvrir.length, "plus aucune page mono-langue : le garde ne protège rien").toBeGreaterThan(0);
    const orphelines = aCouvrir.filter((p) => !prefixes.some((pre) => p.startsWith(pre)));
    expect(
      orphelines,
      "ces pages répondront 404 sous /fr, /de et /es au lieu de rediriger : " +
        orphelines.join(", "),
    ).toEqual([]);
  });

  /** ⚠️⚠️ LES DEUX QUI MANQUAIENT, NOMMÉES. */
  it("couvrent les CGV et les pages partenaires", () => {
    const src = middleware();
    const i = src.indexOf("const prefixesMonoLangue");
    const liste = src.slice(i, src.indexOf("]", i));
    expect(liste, "/fr/legal/cgv répondra 404, comme avant").toContain('"/legal/"');
    expect(liste, "/fr/partner/join répondra 404, comme avant").toContain('"/partner/"');
  });

  /**
   * ⚠️⚠️ ET LA CHAÎNE DE REQUÊTE SURVIT À LA REDIRECTION. Un lien d'apporteur
   * porte son code (`/partner/join?code=XANALYSE`) et `new URL(chemin, base)`
   * le laisse tomber : la redirection aurait effacé l'attribution, donc la
   * commission. Un code d'apporteur est une ligne en base, rien ne le retrouve
   * après coup.
   */
  it("conservent la chaîne de requête", () => {
    const src = middleware();
    const i = src.indexOf("const prefixesMonoLangue");
    const bloc = src.slice(i, i + 900);
    expect(
      bloc,
      "le code d'apporteur est perdu à la redirection : la commission avec",
    ).toContain("request.nextUrl.search");
  });

  /** ⚠️ Et la redirection reste permanente : c'est un dédoublonnage d'URL. */
  it("redirigent en 301", () => {
    const src = middleware();
    const i = src.indexOf("const prefixesMonoLangue");
    expect(src.slice(i, i + 900)).toContain("301");
  });
});
