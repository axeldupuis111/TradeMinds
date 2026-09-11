import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE COMMANDE SANS TEXTE VISIBLE PORTE UN NOM QUAND MÊME.
 *
 * ── LE DÉFAUT, MESURÉ DANS LE NAVIGATEUR ────────────────────────────────────
 *
 * ⚠️⚠️ SUR « MES TRADES » : CINQUANTE ET UNE CASES À COCHER IDENTIQUES, toutes
 * annoncées « case à cocher », sans jamais dire de quel trade. Dont celle de
 * l'en-tête, qui en sélectionne cinquante d'un coup.
 *
 * ⚠️ SUR LE SUIVI DE COMPTE : un `role="switch"` avec son `aria-checked`, et
 * aucun nom. « Interrupteur, non coché » — de quoi ? Le mot « Drawdown
 * trailing » était juste à côté, sans rien qui les relie.
 *
 * ⚠️ ET DANS LES PARAMÈTRES : la liste des fuseaux horaires, dont le titre est
 * un `<h2>` (qui ne nomme rien), et les trois champs du jeton de
 * synchronisation.
 *
 * ⚠️ CES DÉFAUTS N'ONT PAS ÉTÉ TROUVÉS PAR LECTURE DU CODE mais en interrogeant
 * le DOM rendu : une case dans une boucle, un interrupteur qui est un
 * `<button>`, un `<select>` sous un titre — trois formes qu'aucun motif
 * statique simple ne rapproche.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * Les formes SANS texte visible par construction : la case à cocher,
 * l'interrupteur, et le champ en lecture seule qu'on donne à copier. Pour
 * elles, le nom ne peut venir que d'une étiquette liée ou d'un `aria-label`.
 */
describe("les commandes sans texte portent un nom", () => {
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

  /** L'index du `>` qui ferme une balise, accolades et guillemets comptés. */
  function finDeBalise(src: string, depart: number): number {
    let prof = 0;
    let guillemet: string | null = null;
    for (let j = depart; j < src.length; j++) {
      const c = src[j];
      if (guillemet) {
        if (c === guillemet && src[j - 1] !== "\\") guillemet = null;
      } else if (c === '"' || c === "'" || c === "`") guillemet = c;
      else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0) return j;
    }
    return -1;
  }

  /**
   * Les balises à juger, et ce qui les identifie.
   *
   * ⚠️ ON NE PREND QUE LES FORMES MUETTES PAR NATURE. Un bouton avec du texte
   * se nomme tout seul ; c'est `boutons-nommes.test.ts` qui juge ceux qui n'ont
   * qu'une icône.
   */
  function muettes(source: string): { ligne: number; quoi: string }[] {
    const out: { ligne: number; quoi: string }[] = [];
    const marques: [RegExp, string][] = [
      [/<input\b/g, "champ"],
      [/<select\b/g, "liste"],
      [/<textarea\b/g, "zone"],
      [/<button\b/g, "switch"],
    ];
    for (const [motif, sorte] of marques) {
      for (const m of Array.from(source.matchAll(motif))) {
        const fin = finDeBalise(source, m.index!);
        if (fin < 0) continue;
        const balise = source.slice(m.index!, fin + 1);
        if (sorte === "switch" && !/role="switch"/.test(balise)) continue;
        /**
         * ⚠️ UN CHAMP CACHÉ N'A PERSONNE À QUI PARLER. Et un texte d'exemple
         * (`placeholder`) N'EST PAS UN NOM : il disparaît dès qu'on tape, et
         * certaines lectures d'écran ne l'annoncent pas du tout. Il ne figure
         * donc pas dans ce qui dispense.
         */
        if (/type="hidden"/.test(balise)) continue;
        /**
         * ⚠️ UN CHAMP MASQUÉ PAR `hidden` N'EST PAS DANS L'ORDRE DE TABULATION :
         * l'import CSV garde un `<input type="file">` en `display:none`, qu'un
         * bouton nommé déclenche à sa place. Le nommer ne servirait personne.
         * ⚠️ À NE PAS CONFONDRE AVEC `sr-only`, qui reste focusable, et que ce
         * garde juge donc normalement.
         */
        if (/className="[^"]*\bhidden\b/.test(balise)) continue;
        /**
         * ⚠️ UN CHAMP RENDU DANS `<Champ>` EST DÉJÀ DANS UNE ÉTIQUETTE.
         * `components/backtest/Controles.tsx` expose ce composant, qui rend
         * `<label>…{children}</label>` : le test le vérifie plus bas, pour que
         * cette dispense reste adossée à un fait et non à une habitude.
         */
        const avantChamp = source.slice(0, m.index!);
        if (avantChamp.lastIndexOf("<Champ") > avantChamp.lastIndexOf("</Champ>")) continue;
        if (/aria-label|aria-labelledby/.test(balise)) continue;
        /**
         * Enveloppée dans un `<label>` : le texte du label la nomme.
         *
         * ⚠️ ON REMONTE JUSQU'À LA BALISE LA PLUS PROCHE, on ne compte pas dans
         * une fenêtre : ma première version comptait les `<label` et les
         * `</label>` des trois cents caractères précédents, et un label FERMÉ
         * juste avant annulait le label OUVERT juste après. Elle déclarait
         * muette une case parfaitement enveloppée, dans les paramètres.
         */
        const avant = source.slice(0, m.index!);
        const ouvre = avant.lastIndexOf("<label");
        const ferme = avant.lastIndexOf("</label>");
        if (ouvre > ferme) continue;
        /**
         * Une étiquette liée par `htmlFor` nomme aussi, OÙ QU'ELLE SOIT : sur
         * la checklist de séance elle vient APRÈS la case, ce qu'aucune lecture
         * « de l'étiquette vers son champ » ne voit.
         *
         * ⚠️ ON EXIGE LE COUPLE, PAS SEULEMENT UN `id`. Un identifiant que
         * personne ne désigne ne nomme rien ; l'accepter serait offrir une
         * échappatoire d'un seul attribut.
         */
        const identifiant = /\bid=("[^"]*"|\{[^}]*\})/.exec(balise);
        if (identifiant && source.includes("htmlFor=" + identifiant[1])) continue;
        out.push({ ligne: source.slice(0, m.index!).split(SAUT).length, quoi: sorte });
      }
    }
    return out;
  }

  it("la sonde distingue une commande nommée d'une commande muette", () => {
    expect(muettes(`<input type="checkbox" checked={x} />`)).toHaveLength(1);
    expect(muettes(`<input type="checkbox" aria-label="Tout" />`)).toHaveLength(0);
    expect(muettes(`<label>Actif<input type="checkbox" /></label>`)).toHaveLength(0);
    // Un id que personne ne designe ne nomme rien.
    expect(muettes(`<input type="checkbox" id="a" />`)).toHaveLength(1);
    expect(
      muettes(`<input type="checkbox" id="a" />
<label htmlFor="a">Actif</label>`),
    ).toHaveLength(0);
    expect(muettes(`<button role="switch" aria-checked={v} onClick={() => f(1 > 0)} />`)).toHaveLength(1);
    expect(muettes(`<button role="switch" aria-label="Trailing" />`)).toHaveLength(0);
    // Un bouton ordinaire n'est pas jugé ici.
    expect(muettes(`<button onClick={f}>Enregistrer</button>`)).toHaveLength(0);
  });

  /**
   * ⚠️ LA DISPENSE DE `<Champ>` REPOSE SUR UN FAIT, PAS SUR UNE HABITUDE : ce
   * composant doit vraiment envelopper ce qu'on lui donne dans une étiquette.
   * Le jour où il cesse de le faire, cette dispense devient un trou, et c'est
   * ce test qui le dira.
   */
  it("le composant Champ enveloppe bien ses enfants dans une étiquette", () => {
    const source = readFileSync(join(process.cwd(), "components/backtest/Controles.tsx"), "utf8");
    const i = source.indexOf("<label");
    expect(i, "Controles.tsx ne rend plus d'étiquette").toBeGreaterThan(0);
    expect(source.slice(i, source.indexOf("</label>", i))).toContain("{children}");
  });

  it("aucune commande n'est laissée sans nom", () => {
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const source = sansCommentaires(readFileSync(chemin, "utf8"));
      /**
       * ⚠️ UN FICHIER QUI DÉFINIT UNE ÉTIQUETTE ENVELOPPANTE EST HORS PORTÉE.
       * `components/backtest/Controles.tsx` expose un `Champ` qui rend
       * `<label>…{children}</label>` : ses `<select>` nus sont bel et bien
       * dans un label à l'exécution, mais aucune lecture statique ne peut le
       * savoir, puisque l'assemblage se fait chez l'appelant.
       */
      if (/<label[\s\S]{0,400}\{children\}/.test(source)) continue;
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      for (const { ligne, quoi } of muettes(source)) {
        fautes.push(`${nom}:${ligne} (${quoi})`);
      }
    }
    expect(fautes, "commandes muettes : " + fautes.join(", ")).toEqual([]);
  });
});
