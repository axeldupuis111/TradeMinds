import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE SÉANCE « EN COURS » EST UNE SÉANCE D'AUJOURD'HUI.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE SÉANCE OUVERTE DEPUIS QUATRE-VINGT-DIX-SEPT JOURS. Relevé le
 * 2026-09-16 : 88 séances en base, 7 encore marquées `active = true`, ouvertes
 * depuis 6,7 / 12,1 / 13,3 / 45,6 / 46,6 / 51,4 et 97,5 jours. Treize personnes
 * seulement ont déjà lancé une séance : plus de la moitié en traînaient une.
 *
 * ── CE QUE CHAQUE LECTEUR NON BORNÉ EN FAISAIT ──────────────────────────────
 *
 * ⚠️⚠️ LE BANDEAU « prépare ta séance » S'ÉTEIGNAIT DÉFINITIVEMENT. Il ne
 * s'affiche que s'il n'y a NI séance du jour NI séance active, et la seconde
 * lecture n'avait pas de date. Le trader n'était donc plus jamais relancé, donc
 * ne retournait pas sur la page des séances, seul endroit où le ménage tournait :
 * le défaut se réparait uniquement chez ceux qui n'en souffraient pas.
 *
 * ⚠️⚠️ LE COACH REFUSAIT D'OUVRIR UNE SÉANCE. `start_session` répondait « une
 * session est déjà ouverte », c'est-à-dire bloquait l'action centrale du
 * produit, pour toujours. `session_debrief` aurait rédigé le bilan d'une séance
 * de trois mois, et `log_emotional_check` y accrochait le ressenti du jour.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute lecture de `sessions` filtrée sur `active = true` porte une borne de
 * date. Un drapeau qu'on pose à la main et qu'on retire à la main finit
 * toujours par rester posé : ce n'est pas une exception, c'est le cas normal.
 *
 * ⚠️ ET LE MÉNAGE NE VIT PLUS SUR UNE SEULE PAGE. Il tourne depuis la mise en
 * page du tableau de bord, donc derrière n'importe quelle page du produit, et
 * depuis les outils de séance du coach.
 */
describe("une séance « en cours » est bornée à la journée", () => {
  const RACINE = process.cwd();

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = () => [
    ...fichiers(join(RACINE, "app")),
    ...fichiers(join(RACINE, "components")),
    ...fichiers(join(RACINE, "lib")),
  ];

  /**
   * Une requête Supabase s'écrit sur plusieurs lignes : on découpe le fichier
   * sur `.from(` et on regarde le morceau qui suit, jusqu'au prochain `.from(`.
   *
   * ⚠️ PAS DE FENÊTRE EN NOMBRE DE CARACTÈRES : trois gardes de ce dépôt ont
   * déjà menti pour ça. `.from(` est une vraie frontière, une distance non.
   */
  function requetesSurSessions(src: string): string[] {
    return src
      .split(/\.from\(/)
      .slice(1)
      .filter((bloc) => /^\s*["'`]sessions["'`]/.test(bloc));
  }

  it("balaie bien des fichiers, sinon ce test ne prouve rien", () => {
    expect(tous().length).toBeGreaterThan(50);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    const fautif = `
      const x = await supabase.from("sessions").select("id")
        .eq("user_id", user.id).eq("active", true).limit(1).maybeSingle();
    `;
    const blocs = requetesSurSessions(fautif);
    expect(blocs.length, "la requête n'est plus reconnue").toBe(1);
    expect(/eq\(\s*["'`]active["'`],\s*true\s*\)/.test(blocs[0])).toBe(true);
    expect(/gte\(\s*["'`]created_at["'`]/.test(blocs[0])).toBe(false);
  });

  it("trouve bien des lectures de séances actives", () => {
    let n = 0;
    for (const chemin of tous()) {
      for (const bloc of requetesSurSessions(readFileSync(chemin, "utf8"))) {
        if (/eq\(\s*["'`]active["'`],\s*true\s*\)/.test(bloc)) n++;
      }
    }
    expect(n, "plus aucune lecture de séance active : le balayage est cassé").toBeGreaterThan(4);
  });

  it("aucune lecture de séance active n'est sans date", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      const src = readFileSync(chemin, "utf8");
      for (const bloc of requetesSurSessions(src)) {
        if (!/eq\(\s*["'`]active["'`],\s*true\s*\)/.test(bloc)) continue;
        // L'ÉCRITURE du ménage, elle, vise justement les séances d'AVANT ce jour.
        if (/\.update\(/.test(bloc.slice(0, bloc.indexOf(".eq(")))) continue;
        if (/lt\(\s*["'`]created_at["'`]/.test(bloc)) continue;
        if (/gte\(\s*["'`]created_at["'`]/.test(bloc)) continue;
        fautes.push(`${nom} : ${bloc.slice(0, 120).replace(/\s+/g, " ")}`);
      }
    }
    expect(
      fautes,
      "lectures de « séance en cours » sans borne de date — une séance oubliée " +
        "des jours d'avant y passe pour la séance du jour :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE MÉNAGE EST APPELÉ D'AILLEURS QUE DE LA PAGE DES SÉANCES, sinon la
   * boucle se referme : plus de relance, donc pas de visite, donc pas de ménage.
   */
  it("le ménage tourne derrière toutes les pages, pas seulement celle des séances", () => {
    const appelants = tous().filter((c) =>
      /fermerLesSeancesOubliees\s*\(/.test(readFileSync(c, "utf8")),
    );
    const noms = appelants.map((c) => c.split(/[\\/]/).slice(-2).join("/"));
    expect(noms, "la mise en page du tableau de bord ne fait plus le ménage").toContain(
      "dashboard/layout.tsx",
    );
    expect(noms, "le coach ne fait plus le ménage avant d'ouvrir une séance").toContain(
      "lib/coach-tools.ts",
    );
    expect(noms.length, "le ménage n'est plus partagé").toBeGreaterThanOrEqual(3);
  });

  it("le ménage ne ferme que les séances des jours précédents", () => {
    const src = readFileSync(join(RACINE, "lib/sessions-oubliees.ts"), "utf8");
    expect(src, "le ménage ne vise plus une date").toContain('.lt("created_at", debutDuJour)');
    expect(src, "le ménage fermerait la séance du jour").not.toMatch(
      /\.lte\(\s*["'`]created_at["'`]/,
    );
    expect(src, "le ménage ne se limite plus à un utilisateur").toContain('.eq("user_id", userId)');
  });
});
