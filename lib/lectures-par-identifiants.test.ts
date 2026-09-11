import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE LISTE D'IDENTIFIANTS NE TIENT PAS DANS UNE URL.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `chunk` EXISTAIT, AVEC LE BON COMMENTAIRE, ET NE SERVAIT QU'AUX
 * ÉCRITURES. Il dit lui-même « sert aux écritures par identifiants » : la
 * suppression en lot de trades découpait bien sa liste, et AUCUNE lecture ne le
 * faisait. Or un `?id=in.(…)` voyage dans la même URL avec la même limite : un
 * UUID pèse 37 caractères, donc deux cents identifiants suffisent à la dépasser,
 * et la requête échoue D'UN BLOC.
 *
 * ⚠️ ET ÇA TOUCHAIT EXACTEMENT CE QUE LE PRODUIT VEUT FAIRE GRANDIR : le
 * classement de tous les inscrits, les membres d'une communauté de partenaire
 * (conçue pour « des centaines de collaborateurs »), les cinq crons qui écrivent
 * à tout le monde, et la page de statistiques d'un collaborateur qui réussit.
 *
 * ⚠️ LES DEUX PLAFONDS SE CUMULENT, avec des pannes de natures opposées : trop
 * d'identifiants fait échouer la requête, trop de lignes la fait réussir
 * TRONQUÉE. En corriger un seul déplace la panne.
 *
 * ── LA PORTÉE, ET POURQUOI ELLE EST NOMMÉE ──────────────────────────────────
 *
 * ⚠️ ON NE VISE PAS TOUS LES `.in(...)` DU DÉPÔT. Le coach passe des listes que
 * le modèle a écrites (quelques trades nommés à la main), le fil d'activité du
 * classement lit huit lignes : exiger un découpage là ferait un garde qu'on
 * apprend à contourner. La règle porte sur les lectures dont la liste GRANDIT
 * avec le nombre d'inscrits, et elles sont nommées ici.
 */
describe("les lectures filtrées par une liste qui grandit", () => {
  const PORTEE = [
    "app/api/community/route.ts",
    "app/api/leaderboard/route.ts",
    "app/api/send-reminders/route.ts",
    "app/api/weekly-report/route.ts",
    "app/api/streak-guard/route.ts",
    "app/api/economic-calendar/notify/route.ts",
    "app/api/partner/stats/[token]/route.ts",
  ];

  /**
   * La tranche déjà découpée. Une lecture qui filtre sur ELLE est, par
   * construction, sous la limite d'URL.
   *
   * ⚠️ LE MOTIF VISE TOUTES LES LISTES NOMMÉES, pas seulement celles qu'on sait
   * grandes : un garde qui ne cherche que le défaut connu n'a plus rien à
   * compter le jour où il est réparé, et ne peut donc plus prouver qu'il
   * regarde encore quelque chose.
   */
  const DEJA_DECOUPEE = "lot";

  /**
   * ⚠️ UNE DISPENSE S'ÉCRIT, ELLE NE SE DEVINE PAS. Certaines listes sont
   * bornées par construction quelques lignes plus haut (un `.limit(8)`), et
   * exiger un découpage là ajouterait de la machinerie que personne ne saurait
   * relire. On demande alors de le DIRE, juste au-dessus.
   */
  const DISPENSE = "LISTE BORNÉE";

  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  function requetes(source: string) {
    const brutes = source.split(SAUT);
    const lignes = sansCommentaires(source).split(SAUT);
    const out: { ligne: number; liste: string; amont: string }[] = [];
    const motif = /\.in\(\s*["'`]\w+["'`]\s*,\s*([A-Za-z_$][\w$]*)\b/;
    for (let i = 0; i < lignes.length; i++) {
      const m = motif.exec(lignes[i]);
      if (!m) continue;
      out.push({
        ligne: i + 1,
        liste: m[1],
        // ⚠️ La dispense se lit dans les COMMENTAIRES, donc dans la source
        // brute : le motif, lui, travaille sur la source blanchie.
        amont: brutes.slice(Math.max(0, i - 6), i).join(" "),
      });
    }
    return out;
  }

  it("balaie bien des requêtes, sinon ce test ne prouve rien", () => {
    const n = PORTEE.reduce(
      (acc, c) => acc + requetes(readFileSync(join(process.cwd(), c), "utf8")).length,
      0,
    );
    expect(n).toBeGreaterThan(5);
  });

  it("aucune n'envoie toute la liste d'un bloc dans l'URL", () => {
    const fautes: string[] = [];
    for (const chemin of PORTEE) {
      for (const { ligne, liste, amont } of requetes(readFileSync(join(process.cwd(), chemin), "utf8"))) {
        if (liste === DEJA_DECOUPEE) continue;
        // Une constante de module est une liste figée, pas une liste qui grandit.
        if (/^[A-Z][A-Z0-9_]*$/.test(liste)) continue;
        if (amont.includes(DISPENSE)) continue;
        /**
         * ⚠️ ON EXIGE LA TRANCHE, PAS LA MENTION. La première version acceptait
         * qu'un `fetchAllByIds` figure dans les parages, et elle a laissé passer
         * un `.in("id", userIds)` écrit À L'INTÉRIEUR de son propre rappel : la
         * liste entière repartait dans l'URL, sous le nom d'une fonction qui
         * prétendait la découper. Un garde qui se contente d'un nom ne garde
         * rien.
         */
        fautes.push(`${chemin.split("/").slice(-2).join("/")}:${ligne} (${liste})`);
      }
    }
    expect(
      fautes,
      "listes d'identifiants envoyées d'un bloc dans l'URL : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : la taille de tranche doit rester sous la limite
   * d'URL, sinon découper ne sert à rien. Le calcul est celui du module.
   */
  it("la tranche reste sous la taille d'URL acceptée", async () => {
    const { ID_CHUNK } = await import("./supabase-paginate");
    expect(ID_CHUNK * 37).toBeLessThan(8000);
  });
});
