import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MARQUE, TITRES, titreDeLaPage } from "./titres-de-page";

/**
 * LE TITRE EST LA PREMIÈRE CHOSE QU'ON ANNONCE EN ARRIVANT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LES VINGT PAGES DU TABLEAU DE BORD S'APPELAIENT TOUTES
 * « TradeDiscipline ». Le titre venait de la racine, et aucune page ne le
 * reprenait : une lecture d'écran annonce le titre à chaque arrivée et ne
 * disait jamais où l'on était. Dans l'historique, dans les favoris, et dans
 * une barre de vingt onglets, c'était le même mot vingt fois.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ LA CARTE EST CONFRONTÉE À L'ARBORESCENCE, pas relue. C'est là toute la
 * différence : une page ajoutée demain fait échouer la suite au lieu
 * d'hériter en silence du nom générique. Une carte qu'on se contente de
 * maintenir à la main est exactement le défaut qu'on vient de réparer.
 */
describe("chaque page du tableau de bord porte son nom", () => {
  const LANGUES = ["fr", "en", "es", "de"];

  function routes(): string[] {
    const base = join(process.cwd(), "app", "dashboard");
    const out: string[] = [];
    const marcher = (d: string, chemin: string) => {
      for (const f of readdirSync(d)) {
        const c = join(d, f);
        if (statSync(c).isDirectory()) {
          // Un segment dynamique n'a pas de titre fixe.
          if (f.startsWith("[") || f.startsWith("(")) continue;
          marcher(c, chemin + "/" + f);
        } else if (f === "page.tsx") {
          /**
           * ⚠️ UNE PAGE QUI NE FAIT QUE REDIRIGER N'A PAS DE TITRE À PORTER :
           * elle n'est jamais affichée. `/dashboard/accounts` est dans ce cas
           * depuis que la gestion des comptes a rejoint le challenge.
           */
          const source = readFileSync(c, "utf8");
          if (/^\s*redirect\(/m.test(source) && source.split(/\r?\n/).length < 20) continue;
          out.push(chemin);
        }
      }
    };
    marcher(base, "/dashboard");
    return out;
  }

  it("la sonde trouve bien les pages", () => {
    const r = routes();
    expect(r.length, "aucune page trouvée : la sonde ne cherche rien").toBeGreaterThan(15);
    expect(r).toContain("/dashboard");
    expect(r).toContain("/dashboard/trades");
  });

  it("aucune page n'est laissée sans nom", () => {
    const manquantes = routes().filter((r) => !TITRES[r]);
    expect(manquantes, "pages sans titre : " + manquantes.join(", ")).toEqual([]);
  });

  /** ⚠️ Et l'inverse : un titre pour une page qui n'existe plus ment aussi. */
  it("aucun nom ne désigne une page disparue", () => {
    const vraies = new Set(routes());
    const orphelins = Object.keys(TITRES).filter((r) => !vraies.has(r));
    expect(orphelins, "titres sans page : " + orphelins.join(", ")).toEqual([]);
  });

  /**
   * ⚠️ ET LA CLÉ EXISTE DANS LES QUATRE LANGUES. Une clé absente s'affiche
   * telle quelle : le titre de l'onglet deviendrait « sidebar_trades ».
   */
  it("chaque clé de titre est traduite dans les quatre langues", () => {
    const fautes: string[] = [];
    for (const langue of LANGUES) {
      const dict = readFileSync(join(process.cwd(), "lib", "i18n", langue + ".ts"), "utf8");
      for (const [route, nom] of Object.entries(TITRES)) {
        if (!("cle" in nom)) continue;
        if (!new RegExp('"' + nom.cle + '"\\s*:').test(dict)) {
          fautes.push(`${langue} : ${nom.cle} (${route})`);
        }
      }
    }
    expect(fautes, "clés de titre absentes : " + fautes.join(", ")).toEqual([]);
  });

  it("le titre nomme la page avant la marque", () => {
    expect(titreDeLaPage("/dashboard/trades", () => "Trades")).toBe("Trades · " + MARQUE);
    expect(titreDeLaPage("/dashboard/admin", () => "")).toBe("Admin · " + MARQUE);
    // Une barre finale ne doit pas changer la page qu'on nomme.
    expect(titreDeLaPage("/dashboard/trades/", () => "Trades")).toBe("Trades · " + MARQUE);
    // Un chemin inconnu rend la marque seule plutôt qu'un nom inventé.
    expect(titreDeLaPage("/dashboard/inconnu", () => "")).toBe(MARQUE);
  });

  /**
   * ⚠️ ET LE POSEUR EST BRANCHÉ. Sans cette vérification, la carte, les
   * traductions et le calcul du titre pourraient tous être justes pendant que
   * le document continue de s'appeler « TradeDiscipline » : c'est la
   * différence entre « le code existe » et « il tourne ».
   */
  it("le poseur de titre est monté dans la mise en page du tableau de bord", () => {
    const layout = readFileSync(join(process.cwd(), "app", "dashboard", "layout.tsx"), "utf8");
    expect(layout).toContain("<TitreDePage />");
    const poseur = readFileSync(join(process.cwd(), "components", "dashboard", "TitreDePage.tsx"), "utf8");
    expect(poseur).toContain("document.title = titreDeLaPage(");
  });
});
