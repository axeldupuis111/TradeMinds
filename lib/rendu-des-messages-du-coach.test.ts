import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN MESSAGE DU COACH SE REND D'UNE SEULE FAÇON.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE DOCK DU COACH AFFICHAIT SES ASTÉRISQUES. Mesuré le 2026-09-15, dock
 * ouvert sur le tableau de bord : « **Côté Livre Sterling (GBP)** - Aujourd'hui
 * 15 septembre, 8h00 (Paris) : Claimant Count Change… ». Huit `**` dans la
 * bulle, zéro `<strong>` dans le DOM. Le panneau de la page Analyse IA rendait
 * la MÊME conversation en markdown propre.
 *
 * ⚠️ ET C'EST LA SURFACE PRINCIPALE QUI ÉTAIT LA PLUS ABÎMÉE : le dock vit sur
 * toutes les pages, le panneau de l'analyse est un écran qu'on visite.
 *
 * ⚠️ LA LOGIQUE DE CONVERSATION ÉTAIT DÉJÀ PARTAGÉE (`useCoachChat`), le RENDU
 * ne l'était pas. Le partage du rendu est la correction ; ce test empêche la
 * troisième copie.
 */
describe("le rendu d'un message du coach", () => {
  const racine = process.cwd();
  const lire = (c: string) => readFileSync(join(racine, c), "utf8");

  it("passe par le composant partagé, dans le dock comme dans la page", () => {
    for (const chemin of [
      "components/coach/CoachDock.tsx",
      "app/dashboard/analysis/page.tsx",
    ]) {
      expect(lire(chemin), `${chemin} rend le message autrement`).toContain(
        "<ContenuDuMessage role={msg.role} content={msg.content} />",
      );
    }
  });

  it("le composant partagé rend bien du markdown pour le coach, et pas pour le trader", () => {
    const src = lire("components/coach/ContenuDuMessage.tsx");
    expect(src).toContain("<ReactMarkdown>{content}</ReactMarkdown>");
    expect(
      src,
      "le message du trader passerait au rendu markdown : ses astérisques et ses tirets seraient transformés",
    ).toContain('if (role !== "assistant") return <p className="whitespace-pre-wrap">{content}</p>;');
  });

  /**
   * ⚠️ PERSONNE D'AUTRE N'IMPORTE LE RENDU MARKDOWN POUR UNE CONVERSATION. Le
   * blog a le sien, légitimement : il rend des articles, pas des messages.
   */
  it("aucune quatrième copie du rendu de conversation", () => {
    const fichiers: string[] = [];
    const marcher = (d: string) => {
      for (const e of readdirSync(d)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(d, e);
        if (statSync(p).isDirectory()) marcher(p);
        else if (/\.tsx$/.test(p) && !p.includes(".test.")) fichiers.push(p);
      }
    };
    marcher(join(racine, "app"));
    marcher(join(racine, "components"));

    const importeurs = fichiers
      .filter((f) => /from "react-markdown"/.test(readFileSync(f, "utf8")))
      .map((f) => f.split(/[\\/]/).slice(-2).join("/"))
      .sort();

    expect(importeurs).toEqual(["blog/BlogPostView.tsx", "coach/ContenuDuMessage.tsx"]);
  });
});
