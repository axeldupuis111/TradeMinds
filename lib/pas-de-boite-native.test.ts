import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LE PRODUIT RÉPOND DANS SA PROPRE LANGUE VISUELLE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SIX MESSAGES PASSAIENT PAR `alert()`, la boîte NATIVE du navigateur, dont
 * TROIS sur l'export PDF, une fonctionnalité payante : « pas de données »,
 * « devises mêlées », « échec de génération ». Un `alert()` bloque l'onglet
 * entier, s'affiche sans aucun style sous un en-tête « tradediscipline.app
 * indique », ne suit ni le thème ni la typographie du produit, et ressemble
 * davantage à une panne qu'à une réponse.
 *
 * ⚠️ TROUVÉ EN PILOTANT : le clic sur « Exporter PDF » a gelé l'onglet plus de
 * deux minutes. L'export refusait correctement (la vue mêlait deux devises),
 * mais il le disait par une boîte modale que rien ne pouvait fermer.
 *
 * ⚠️ ET LA MAISON AVAIT DÉJÀ SA FORME, RECOPIÉE DEUX FOIS : un bandeau en haut
 * à droite, avec le bon rôle ARIA, défini séparément dans la page Réglages et
 * dans la page Stratégie. Trois façons de répondre à un geste dans le même
 * produit, dont une qui bloque le navigateur. Le composant vit maintenant dans
 * `components/ui/Toast.tsx`.
 *
 * ── CE QUE CE TEST N'INTERDIT PAS ───────────────────────────────────────────
 *
 * ⚠️ `confirm()` RESTE, ET C'EST DÉLIBÉRÉ. Ce n'est pas un message, c'est une
 * PORTE : supprimer des trades, quitter une fiche non enregistrée, vider
 * l'historique du coach. Un blocage y est un service, pas une gêne, et le
 * remplacer demande une vraie fenêtre modale avec gestion du focus pour chacun
 * des six appels. Le faire à moitié créerait exactement l'incohérence que ce
 * test corrige. À reprendre en une fois, ou pas du tout.
 */
describe("aucune boîte de dialogue native pour un message", () => {
  const RACINE = process.cwd();
  const DOSSIERS = ["app", "components"];

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = () => DOSSIERS.flatMap((d) => fichiers(join(RACINE, d)));

  it("balaie bien des fichiers, sinon ce test ne prouve rien", () => {
    expect(tous().length).toBeGreaterThan(50);
  });

  it("personne n'appelle alert()", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      /**
       * ⚠️ SANS LES COMMENTAIRES : ce fichier-ci et les trois endroits réparés
       * expliquent le défaut en citant `alert()`. Un garde qui lirait les
       * commentaires s'accuserait lui-même.
       */
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      src.split(/\r?\n/).forEach((ligne, i) => {
        // `.alert(` exclut un objet qui aurait une méthode de ce nom.
        if (!/(^|[^.\w])alert\s*\(/.test(ligne)) return;
        fautes.push(`${nom}:${i + 1}`);
      });
    }
    expect(
      fautes,
      "boîtes natives : passer par `useToast()` + `<Toast />` (components/ui/Toast) — " +
        fautes.join(", "),
    ).toEqual([]);
  });

  it("le bandeau partagé distingue bien l'erreur de la réussite", () => {
    const src = readFileSync(join(RACINE, "components/ui/Toast.tsx"), "utf8");
    // Une erreur interrompt la lecture, une réussite attend une pause.
    expect(src).toContain('role={toast.type === "error" ? "alert" : "status"}');
    expect(src).toContain('aria-live={toast.type === "error" ? "assertive" : "polite"}');
    // Et une erreur reste affichée plus longtemps qu'un « Enregistré ».
    expect(src).toMatch(/success:\s*3000,\s*error:\s*6000/);
  });
});
