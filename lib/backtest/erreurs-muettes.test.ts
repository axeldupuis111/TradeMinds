import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AUCUNE ERREUR N'EST LUE PUIS JETÉE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ VU DANS `choisirLaMethode` : le trader déclare sa méthode, l'écriture
 * part vers sa fiche, elle échoue, et le code fait `if (error) return;`. Le
 * choix reste affiché, la fiche ne l'a pas reçu, et au chargement suivant il a
 * disparu sans que rien n'ait jamais dit pourquoi.
 *
 * ⚠️ LE CLIENT SUPABASE NE JETTE PAS. C'est écrit noir sur blanc ailleurs dans
 * ce dépôt, et ça a déjà coûté seize annulations qui rendaient `{ ok: true }`
 * sans rien restaurer. Une erreur lue et non montrée est pire qu'une erreur
 * ignorée : quelqu'un l'a vue passer et a décidé de se taire.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un `if (error…)` peut sortir, mais pas sans laisser de trace : il pose un
 * état, il jette, ou il dit pourquoi il se tait, par écrit, sur place.
 */
describe("les erreurs ne se perdent pas en silence", () => {
  const DOSSIERS = ["app/dashboard/backtest", "components/backtest", "lib/backtest"];
  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  function fichiers(): { nom: string; lignes: string[] }[] {
    const out: { nom: string; lignes: string[] }[] = [];
    for (const d of DOSSIERS) {
      for (const f of readdirSync(join(process.cwd(), d))) {
        if (!/\.tsx?$/.test(f) || f.includes(".test.")) continue;
        out.push({ nom: f, lignes: readFileSync(join(process.cwd(), d, f), "utf8").split(SAUT) });
      }
    }
    return out;
  }

  it("lit bien les fichiers de l'onglet, sinon ce test ne prouve rien", () => {
    expect(fichiers().length).toBeGreaterThan(15);
  });

  it("aucun « if (error) return » ne se tait sans raison écrite", () => {
    const fautes: string[] = [];
    for (const { nom, lignes } of fichiers()) {
      lignes.forEach((ligne, i) => {
        /**
         * ⚠️ LES COMMENTAIRES PARLENT DE CE DÉFAUT, en citant le code fautif.
         * Les lire comme du code ferait accuser précisément la page qui
         * l'explique, et c'est arrivé au premier essai de ce garde.
         */
        const nu = ligne.trim();
        if (nu.startsWith("*") || nu.startsWith("//") || nu.startsWith("/*")) return;
        if (!/\bif\s*\(\s*(!?\w*[Ee]rror\b|error\b)/.test(ligne)) return;
        /**
         * Ce que fait la sortie, ET RIEN DE PLUS.
         *
         * ⚠️⚠️ MA PREMIÈRE VERSION LISAIT QUATRE LIGNES D'UN COUP, donc débordait
         * sur le chemin du SUCCÈS, qui pose évidemment des états. J'ai remis
         * exprès le défaut d'origine : le garde n'a pas bronché. On s'arrête
         * donc à la ligne quand elle se referme seule, et à l'accolade sinon.
         */
        const bloc = /\)\s*(return|continue)\b/.test(ligne)
          ? ligne
          : (() => {
              const fin = lignes.slice(i, i + 8).findIndex((l, k) => k > 0 && /^\s*\}/.test(l));
              return lignes.slice(i, i + (fin === -1 ? 4 : fin)).join(" ");
            })();
        const sort = /\breturn\b|\bcontinue\b/.test(bloc);
        if (!sort) return;
        /**
         * ⚠️ TROIS FAÇONS ACCEPTABLES DE SE TAIRE : poser un état que l'écran
         * lit, jeter, ou l'écrire. Rien d'autre.
         */
        const parle =
          /\bset[A-Z]\w*\(/.test(bloc) ||
          /\bthrow\b/.test(bloc) ||
          // ⚠️ Rendre l'erreur à l'appelant, c'est la transmettre, pas la taire.
          /return\s*\{[^}]*\berror\b/.test(bloc) ||
          /return\s*\{[^}]*ok:\s*false/.test(bloc) ||
          /silence-assum[ée]/.test(lignes.slice(Math.max(0, i - 8), i + 2).join(" "));
        if (!parle) fautes.push(`${nom}:${i + 1} ${ligne.trim().slice(0, 80)}`);
      });
    }
    expect(
      fautes,
      "erreurs lues puis jetées (pose un état, jette, ou écris « silence-assumé » avec la raison) : " +
        fautes.join(" | "),
    ).toEqual([]);
  });
});
