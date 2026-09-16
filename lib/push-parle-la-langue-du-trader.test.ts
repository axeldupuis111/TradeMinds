import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE NOTIFICATION PUSH PARLE LA LANGUE DE CELUI QUI LA REÇOIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA NOTIFICATION DE BIENVENUE ÉTAIT EN FRANÇAIS POUR TOUT LE MONDE.
 * « Notifications activées 🎉 », écrite en dur dans `/api/push/subscribe`.
 * C'est la TOUTE PREMIÈRE notification qu'un utilisateur reçoit, et la seule
 * preuve qu'il obtient que l'activation a marché. Dix-sept des vingt et un
 * inscrits sont anglophones.
 *
 * ⚠️ ET LES SEPT AUTRES ENVOIS TRADUISAIENT DÉJÀ : rappel de séance,
 * garde-série, calendrier économique, bilan hebdomadaire, perte du jour,
 * drawdown, alerte de tilt. Tous passent par une table par langue. Celui-ci
 * était le seul à ne pas le faire, et c'est le premier de tous.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Aucun `sendPushToUser` ne reçoit un titre ou un corps écrit à la main dans
 * l'appel. Le texte vient d'une table indexée par la langue du destinataire.
 */
describe("les notifications push", () => {
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

  /** Les appels d'envoi, avec leur objet d'options. */
  function appels(): { fichier: string; bloc: string }[] {
    const trouves: { fichier: string; bloc: string }[] = [];
    for (const chemin of [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "lib"))]) {
      const src = readFileSync(chemin, "utf8");
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      let i = src.indexOf("sendPushToUser(");
      while (i !== -1) {
        // ⚠️ La frontière est l'accolade fermante de l'objet d'options, pas une
        // distance : un appel peut tenir sur une ligne ou sur six.
        const ouvre = src.indexOf("{", i);
        const ferme = src.indexOf("}", ouvre);
        if (ouvre !== -1 && ferme !== -1) trouves.push({ fichier: nom, bloc: src.slice(ouvre, ferme) });
        i = src.indexOf("sendPushToUser(", i + 1);
      }
    }
    return trouves;
  }

  it("trouve bien des envois, sinon ce test ne prouve rien", () => {
    expect(appels().length, "plus aucun envoi push : le balayage est cassé").toBeGreaterThanOrEqual(7);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    const fautif = '{\n  title: "TradeDiscipline",\n  body: "Notifications activées 🎉",';
    expect(/body:\s*"[^"]{3,}"/.test(fautif)).toBe(true);
    const correct = '{\n  title: "TradeDiscipline",\n  body: BIENVENUE[lang],';
    expect(/body:\s*"[^"]{3,}"/.test(correct)).toBe(false);
  });

  /**
   * ⚠️ LE TITRE « TradeDiscipline » EST LE SEUL LITTÉRAL ADMIS, et pour une
   * raison : c'est un nom propre, il ne se traduit pas. Tout le reste doit
   * venir d'une table.
   */
  it("aucun envoi ne porte un texte écrit à la main", () => {
    const fautes: string[] = [];
    for (const { fichier, bloc } of appels()) {
      for (const champ of ["title", "body"] as const) {
        const m = new RegExp(`${champ}:\\s*"([^"]{3,})"`).exec(bloc);
        if (!m) continue;
        if (m[1] === "TradeDiscipline") continue;
        fautes.push(`${fichier} : ${champ}: "${m[1].slice(0, 50)}"`);
      }
    }
    expect(
      fautes,
      "textes de notification écrits en dur : ils partent dans la langue de " +
        "l'auteur, pas dans celle du lecteur :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  it("la bienvenue existe dans les quatre langues, et diffère", () => {
    const src = readFileSync(join(RACINE, "app/api/push/subscribe/route.ts"), "utf8");
    for (const langue of ["fr", "en", "de", "es"]) {
      expect(src, `bienvenue manquante en ${langue}`).toMatch(
        new RegExp(`${langue}:\\s*"[^"]{8,}"`),
      );
    }
    // Quatre lignes recopiées passeraient le test ci-dessus sans rien traduire.
    const valeurs = Array.from(src.matchAll(/^\s+(?:fr|en|de|es):\s*"([^"]+)"/gm)).map((m) => m[1]);
    expect(new Set(valeurs).size, "les quatre langues disent la même chose").toBeGreaterThanOrEqual(4);
  });

  /**
   * ⚠️⚠️ ET LA DÉSINSCRIPTION VÉRIFIE SON ÉCRITURE. Le client Supabase ne jette
   * pas : la route répondait `{ ok: true }` quoi qu'il arrive, donc l'écran
   * affichait « désactivées » pendant que les rappels continuaient d'arriver.
   */
  it("la désinscription ne ment pas sur son résultat", () => {
    const src = readFileSync(join(RACINE, "app/api/push/subscribe/route.ts"), "utf8");
    expect(src, "la suppression ne lit plus son erreur").toContain(
      "const { error: deleteError } = await supabase",
    );
    expect(src, "un échec de suppression répond encore ok").toMatch(
      /if \(deleteError\)[^]{0,200}status: 500/,
    );
  });
});
