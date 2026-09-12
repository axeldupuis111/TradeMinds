import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LE `null` D'UNE LECTURE PAGINÉE SE REGARDE, ET SUR LE BON NOM.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * `fetchAllRows` rend `null` dès qu'une page échoue. Un appelant qui écrit
 * `?? []` transforme « je n'ai pas tout » en « il n'y a rien ». Mesuré en
 * production en faisant échouer les lectures depuis le navigateur, sur un
 * compte de 85 trades :
 *
 *   - la carte de série affichait « 0 jour de discipline » et perdait le record ;
 *   - deux crons répondaient « aucun abonné » puis 200, sans avoir notifié
 *     personne : une panne qui prive TOUS les traders de leur rappel, et que
 *     rien ne signalait ;
 *   - la carte sociale du profil public publiait « 0 trade, 0 % de réussite »
 *     à des inconnus, sur la seule surface qu'un lecteur ne peut pas recouper.
 *
 * ── POURQUOI CE GARDE-CI EXISTE EN PLUS DE `lectures-bornees` ───────────────
 *
 * ⚠️⚠️ MA PREMIÈRE VERSION MENTAIT. Elle demandait « ce FICHIER teste-t-il un
 * `null` quelque part ? ». Vérifiée par mutation, elle est restée VERTE après
 * réintroduction du défaut dans `GoalsStreaks.tsx` : le fichier contenait
 * d'autres `if (!x)`, sans rapport. Un garde doit se lier au NOM de la variable
 * qui reçoit la lecture, sinon il mesure la densité de points d'exclamation.
 */
describe("les lectures paginées, nom par nom", () => {
  const PAGINE = /\b(?:fetchAllRows|lireParIdentifiants|lireTousLesTradesDuCompte)\s*[<(]/;

  /**
   * ⚠️ `fetchAllByIds` N'EST PAS DANS LA LISTE, et c'est écrit : il LÈVE quand
   * la lecture est incomplète (`if (rows === null) throw`). L'appelant n'a donc
   * rien à tester — la panne remonte toute seule.
   */
  const LEVE = ["fetchAllByIds"];

  const DEFINITIONS = ["lib/supabase-paginate.ts", "lib/trades-du-compte.ts"];

  /**
   * ⚠️ UNE ENVELOPPE LOCALE QUI LÈVE EST UNE FAÇON VALIDE DE TRAITER LE `null`.
   * `app/api/community/route.ts` en définit une, avec sa raison écrite : ses dix
   * lectures se font par paires dans des `Promise.all`, et une exception remonte
   * au `try` de la route, qui répond 500. Le garde reconnaît ce cas par la FORME
   * (une fonction du même nom, dont le corps teste `null` et lève), pas par le
   * nom du fichier : une exemption par nom de fichier survit à sa raison.
   */
  function enveloppeQuiLeve(src: string, nom: string): boolean {
    const debut = new RegExp(`(?:async\\s+)?function\\s+${nom}\\b`).exec(src);
    if (!debut) return false;
    /**
     * ⚠️ ON CHERCHE L'ACCOLADE DU CORPS, PAS LA PREMIÈRE VENUE. Ma version
     * précédente prenait `src.indexOf("{")` après le nom : elle tombait sur
     * l'accolade d'un TYPE de paramètre (`build: () => { range: … }`) et lisait
     * donc un corps qui ne contenait aucun `throw`. L'exemption ne se
     * déclenchait jamais, et le garde accusait un fichier correct.
     */
    const parenthese = src.indexOf("(", debut.index + debut[0].length);
    if (parenthese < 0) return false;
    const accolade = src.indexOf("{", bloc(src, parenthese).fin);
    if (accolade < 0) return false;
    const corps = bloc(src, accolade).contenu;
    return /null/.test(corps) && /\bthrow\b/.test(corps);
  }

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  /** Découpe une liste au PREMIER niveau de délimiteurs, jamais sur une fenêtre. */
  function auPremierNiveau(texte: string): string[] {
    const morceaux: string[] = [];
    let prof = 0;
    let debut = 0;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if ("([{".includes(c)) prof++;
      else if (")]}".includes(c)) prof--;
      else if (c === "," && prof === 0) {
        morceaux.push(texte.slice(debut, i));
        debut = i + 1;
      }
    }
    morceaux.push(texte.slice(debut));
    return morceaux;
  }

  /** Le contenu entre le délimiteur ouvrant en `depart` et son pendant. */
  function bloc(src: string, depart: number): { contenu: string; fin: number } {
    const ouvrant = src[depart];
    const fermant = { "(": ")", "[": "]", "{": "}" }[ouvrant] ?? ")";
    let prof = 0;
    for (let i = depart; i < src.length; i++) {
      if (src[i] === ouvrant) prof++;
      else if (src[i] === fermant) {
        prof--;
        if (prof === 0) return { contenu: src.slice(depart + 1, i), fin: i };
      }
    }
    return { contenu: "", fin: depart };
  }

  /** Les noms de variables qui reçoivent une lecture paginée. */
  function nomsPagines(src: string): Set<string> {
    const noms = new Set<string>();

    // a) `const X = await fetchAllRows(…)`
    const DIRECT =
      /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*await\s+(?:fetchAllRows|lireParIdentifiants|lireTousLesTradesDuCompte)\s*[<(]/g;
    DIRECT.lastIndex = 0;
    let direct: RegExpExecArray | null;
    while ((direct = DIRECT.exec(src)) !== null) noms.add(direct[1]);

    // b) `const [A, B, C] = await Promise.all([ … ])`, apparié PAR POSITION.
    const TABLEAU = /\b(?:const|let)\s*\[/g;
    TABLEAU.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TABLEAU.exec(src)) !== null) {
      const crochet = src.indexOf("[", m.index);
      const gauche = bloc(src, crochet);
      if (!/^\s*=\s*await\s+Promise\.all\s*\(/.test(src.slice(gauche.fin + 1, gauche.fin + 40))) {
        continue;
      }
      const argument = bloc(src, src.indexOf("(", gauche.fin));
      const tableau = argument.contenu.indexOf("[");
      if (tableau < 0) continue;
      const elements = auPremierNiveau(bloc(argument.contenu, tableau).contenu);
      const cibles = auPremierNiveau(gauche.contenu);
      elements.forEach((element, i) => {
        if (!PAGINE.test(element)) return;
        const cible = (cibles[i] ?? "").trim();
        const simple = /^([A-Za-z_$][\w$]*)$/.exec(cible);
        if (simple) {
          noms.add(simple[1]);
          return;
        }
        /**
         * ⚠️ LA CIBLE PEUT ÊTRE `{ data: nom }`. Plusieurs appels enveloppent la
         * lecture paginée dans `.then((data) => ({ data }))` pour la déstructurer
         * comme les autres lignes du `Promise.all`. Ma première version n'acceptait
         * qu'un identifiant nu : vérifiée par mutation, elle est restée VERTE
         * après réintroduction du défaut dans `GoalsStreaks.tsx`, qui utilise
         * exactement cette forme.
         */
        const enveloppe = /^\{\s*data\s*(?::\s*([A-Za-z_$][\w$]*))?\s*\}$/.exec(cible);
        if (enveloppe) noms.add(enveloppe[1] ?? "data");
      });
    }

    return noms;
  }

  it("apparie bien les noms et les positions, sinon ce test ne prouve rien", () => {
    const exemple =
      "const [a, { data: b }, journal] = await Promise.all([\n" +
      "  supabase.from('x').select('y'),\n" +
      "  supabase.from('z').select('w'),\n" +
      "  fetchAllRows<Ligne>((d, f) => supabase.from('trades').select('*').range(d, f)),\n" +
      "]);";
    expect(Array.from(nomsPagines(exemple))).toEqual(["journal"]);

    const direct = "const lignes = await fetchAllRows<T>((d, f) => q.range(d, f));";
    expect(Array.from(nomsPagines(direct))).toEqual(["lignes"]);
  });

  it("chaque résultat paginé est testé sur SON nom", () => {
    const fautes: string[] = [];
    let resultats = 0;

    for (const racine of ["app", "components", "lib"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        const relatif = chemin.replace(process.cwd() + "\\", "").replace(/\\/g, "/");
        if (DEFINITIONS.includes(relatif)) continue;
        /**
         * ⚠⚠ LES COMMENTAIRES SE RETIRENT AVANT TOUT DECOUPAGE. Une virgule
         * dans une phrase de commentaire compte comme un separateur d element
         * de tableau : l appariement par POSITION se decalait, et le garde
         * accusait la mauvaise variable. Verifie sur GoalsStreaks, ou deux
         * commentaires ajoutaient deux elements fantomes.
         */
        const src = sansCommentaires(readFileSync(chemin, "utf8"));
        if (!PAGINE.test(src)) continue;
        if (
          ["fetchAllRows", "lireParIdentifiants", "lireTousLesTradesDuCompte"].some((n) =>
            enveloppeQuiLeve(src, n),
          )
        ) {
          continue;
        }

        for (const nom of Array.from(nomsPagines(src))) {
          resultats++;
          const teste = new RegExp(
            `\\b${nom}\\s*===\\s*null|\\b${nom}\\s*!==\\s*null|!\\s*${nom}\\b`,
          ).test(src);
          if (!teste) fautes.push(`${relatif} : ${nom}`);
        }
      }
    }

    // ⚠️ Un garde qui ne trouve rien ne protège rien.
    expect(resultats, "aucun résultat paginé nommé : le motif ne correspond plus").toBeGreaterThan(
      20,
    );
    expect(
      fautes,
      "résultats de lecture paginée dont le `null` n'est jamais testé : " + fautes.join(", "),
    ).toEqual([]);
    expect(LEVE.length, "la note sur fetchAllByIds a disparu").toBe(1);
  });
});
