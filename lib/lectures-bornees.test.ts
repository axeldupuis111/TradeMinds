import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AUCUNE LECTURE QUI AGRÈGE UN COMPTE ENTIER N'EST LAISSÉE SANS BORNE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ POSTGREST REND MILLE LIGNES ET S'ARRÊTE LÀ, AVEC UN STATUT 200. Pas
 * d'erreur, pas de signal : le code part dans sa branche succès avec des
 * données amputées. `lib/supabase-paginate.ts` documente la mesure depuis des
 * semaines, et la règle « tout ce qui agrège passe par fetchAllRows » était
 * écrite. Trois endroits ne l'appliquaient pas, et pas les moins graves :
 *
 *   - le GARDE DE COMPTE, celui qui dit « arrête-toi » ;
 *   - le CALCULATEUR DE POSITION, celui qui dit combien risquer ;
 *   - la page Comptes, qui ÉCRIT le solde reconstitué dans la base.
 *
 * Plus l'export PDF du coach, et le statut de challenge qu'il annonce.
 *
 * ⚠️ ET LA TAILLE DU JOURNAL D'AXEL (157 trades) MET CES TROIS DÉFAUTS HORS DE
 * PORTÉE : rien ne se serait vu avant qu'un abonné dépasse mille trades, à un
 * endroit où le chiffre décide d'un risque.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ IL NE JUGE PAS TOUTES LES LECTURES. Une requête bornée par un jour, une
 * semaine ou une liste d'identifiants ne peut pas déborder, et l'exiger
 * partout ferait un garde qu'on apprend à contourner. La règle porte sur les
 * lectures de `trades` filtrées par COMPTE et sans borne de date : ce sont
 * exactement celles qui grandissent avec l'ancienneté d'un abonné.
 */
describe("les lectures qui agrègent un compte sont paginées", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  /**
   * Recolle une requête écrite sur plusieurs lignes.
   *
   * ⚠️ FENÊTRE FIXE, SANS ARRÊT ANTICIPÉ. La première version coupait à la
   * première ligne finie par une parenthèse : elle s'arrêtait donc à
   * `.eq("user_id", user.id)` et déclarait « sans borne » une requête dont le
   * `.gte("open_time", …)` était deux lignes plus bas. Un garde qui coupe trop
   * tôt accuse à faux, et on apprend à l'ignorer.
   */
  function requetes(source: string): { ligne: number; texte: string }[] {
    const lignes = source.split(SAUT);
    const out: { ligne: number; texte: string }[] = [];
    for (let i = 0; i < lignes.length; i++) {
      if (!/\.from\(["'`]trades["'`]\)/.test(lignes[i])) continue;
      const texte = lignes
        .slice(i, Math.min(i + 14, lignes.length))
        .map((l) => l.trim())
        .join(" ");
      out.push({ ligne: i + 1, texte });
    }
    return out;
  }

  it("aucune lecture des trades d'un compte n'est laissée sans borne", () => {
    const tous = [...fichiers("app"), ...fichiers("components"), ...fichiers("lib")];
    expect(tous.length).toBeGreaterThan(80);

    const fautes: string[] = [];
    let vues = 0;
    for (const chemin of tous) {
      const nom = chemin.split(/[\\/]/).join("/");
      for (const { ligne, texte } of requetes(readFileSync(chemin, "utf8"))) {
        // Une écriture, un comptage ou une ligne unique ne débordent pas.
        if (/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.single\(|\.maybeSingle\(|count:\s*["']exact/.test(texte)) continue;
        // ⚠️ FILTRÉE PAR COMPTE, pas simplement « qui sélectionne la colonne » :
        // c'est le filtre qui décrit un ensemble qui grandit sans fin. Une
        // requête qui lit `challenge_id` parmi d'autres colonnes, elle, est
        // bornée par ce qui la filtre vraiment.
        if (!/\.(eq|is)\(\s*["'`]challenge_id["'`]/.test(texte)) continue;
        vues++;
        // Bornée dans le temps, ou paginée, ou explicitement limitée.
        if (/\.gte\(\s*["'`]open_time|\.lt\(\s*["'`]open_time|\.limit\(|\.range\(/.test(texte)) continue;
        fautes.push(`${nom}:${ligne}`);
      }
    }
    expect(vues, "aucune lecture par compte trouvée : le motif ne cherche rien").toBeGreaterThan(4);
    expect(
      fautes,
      "lectures d'un compte entier sans pagination (voir lib/trades-du-compte.ts) : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LES TROIS ENDROITS RÉPARÉS PASSENT BIEN PAR LE LECTEUR PARTAGÉ. Sans
   * ça, chacun pourrait repaginer à sa façon, et c'est de là que viennent les
   * divergences.
   */
  it("le garde, le calculateur et la page Comptes lisent par le même chemin", () => {
    for (const chemin of [
      "components/dashboard/ChallengeGuardian.tsx",
      "components/session/PositionSizer.tsx",
      "app/dashboard/challenge/page.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(source, chemin).toContain("lireTousLesTradesDuCompte");
    }
  });

  /**
   * ⚠️ UNE LECTURE INCOMPLÈTE NE DOIT PAS SE TAIRE. `fetchAllRows` rend `null`
   * quand une page échoue ; un appelant qui écrirait `?? []` transformerait
   * « je n'ai pas tout » en « il n'y a rien », ce qui est précisément le défaut
   * qu'on répare.
   */
  /**
   * ⚠️⚠️ CE GARDE-CI A ÉTÉ RETIRÉ, ET C'EST VOULU. Il demandait « ce FICHIER
   * teste-t-il un `null` quelque part ? », ce qui est une question sans
   * rapport : vérifié par mutation, il restait VERT après réintroduction du
   * défaut, parce que le fichier contenait d'autres `if (!x)`.
   *
   * Le vrai garde est dans `lib/lecture-paginee-nommee.test.ts` : il apparie
   * le résultat paginé à SON nom, position par position dans le
   * `Promise.all`, et il tombe quand on remet le défaut.
   */
  it("délègue la vérification du null au garde lié au nom", () => {
    const garde = readFileSync(join(process.cwd(), "lib/lecture-paginee-nommee.test.ts"), "utf8");
    expect(garde, "le garde lié au nom a disparu").toContain("chaque résultat paginé est testé sur SON nom");
  });
});
