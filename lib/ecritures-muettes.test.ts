import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE ÉCRITURE QUI RATE NE PASSE PAS POUR UNE RÉUSSITE.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ DANS LES PARAMÈTRES, LA CASE « rappel de séance par e-mail » AFFICHAIT
 * « Paramètres sauvegardés ✓ » SANS RIEN VÉRIFIER. Le client Supabase ne jette
 * pas : la coche restait en place, le message de succès s'affichait, et le
 * réglage revenait à l'ancien au rechargement suivant.
 *
 * ⚠️ QUATRE AUTRES DU MÊME GENRE, TOUS SUR UN GESTE DU TRADER :
 *
 *   - l'inscription au CLASSEMENT, c'est-à-dire un réglage de vie privée ;
 *   - les notifications push, où l'interrupteur restait « activé » pendant que
 *     le profil disait « désactivé » ;
 *   - le point émotionnel de séance, la donnée même que cet écran recueille ;
 *   - « effacer l'historique du coach », qui vidait l'écran sans vérifier la
 *     base : les échanges revenaient tous au rechargement.
 *
 * ⚠️ ET LA SUPPRESSION D'UN TRADE À L'UNITÉ, alors que la suppression EN LOT,
 * douze lignes plus bas dans le même fichier, lisait déjà son erreur et le
 * disait. La règle était écrite, pas appliquée à côté.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Sur les écrans que le trader manipule, une écriture lit son `error`, ou dit
 * PAR ÉCRIT pourquoi elle peut s'en passer. Les deux sont acceptables ; le
 * silence, non.
 */
describe("les écritures d'un geste du trader ne se taisent pas", () => {
  /**
   * ⚠️ ON NE VISE PAS TOUT LE DÉPÔT. Les crons, les webhooks et la télémétrie
   * écrivent sans que personne ne regarde, et c'est normal : un ménage raté se
   * refait tout seul la fois d'après. La règle porte sur ce qui suit un CLIC,
   * là où l'écran affirme quelque chose au trader.
   */
  const PORTEE = [
    "app/dashboard",
    "components/settings",
    "components/session",
    "components/trades",
    "components/profile",
    /**
     * ⚠️ AJOUTÉS APRÈS COUP, ET C'EST LE MÊME OUBLI QUE LA RÈGLE DÉCRIT : ces
     * deux dossiers sont pleins de gestes du trader (rejoindre un défi, retirer
     * un membre), ils n'étaient simplement pas dans la liste.
     */
    "components/community",
    "components/dashboard",
  ];

  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /** L'appel complet à partir de l'index de `fetch`, parenthèses équilibrées. */
  function appelComplet(source: string, depart: number): string {
    let prof = 0;
    for (let j = source.indexOf("(", depart); j < source.length; j++) {
      if (source[j] === "(") prof++;
      else if (source[j] === ")") {
        prof--;
        if (prof === 0) return source.slice(depart, j + 1);
      }
    }
    return source.slice(depart, depart + 600);
  }

  /**
   * Le corps de la FONCTION qui contient l'index donné.
   *
   * ⚠️ ON REMONTE LES ACCOLADES, ON NE COMPTE PAS LES CARACTÈRES : une fenêtre
   * de taille fixe coupe au milieu d'une fonction longue et déclare fautif ce
   * qui vérifie trente lignes plus bas.
   */
  function fonctionEnglobante(source: string, depart: number): string | null {
    let prof = 0;
    for (let j = depart; j >= 0; j--) {
      const c = source[j];
      if (c === "}") prof++;
      else if (c === "{") {
        if (prof > 0) { prof--; continue; }
        // Un `{` non fermé : début d'un bloc. Une fonction si `) {` ou `=> {`.
        if (!/(?:=>|\))\s*$/.test(source.slice(Math.max(0, j - 140), j))) continue;
        let p = 0;
        for (let k = j; k < source.length; k++) {
          if (source[k] === "{") p++;
          else if (source[k] === "}") {
            p--;
            if (p === 0) return source.slice(j, k + 1);
          }
        }
        return source.slice(j);
      }
    }
    return null;
  }

  /**
   * L'INSTRUCTION ENTIÈRE : LA CHAÎNE D'APPELS, PAS UNE FENÊTRE DE N LIGNES.
   *
   * ⚠️⚠️ UNE FENÊTRE N'EST PAS UNE FRONTIÈRE, et c'est la QUATRIÈME fois que ce
   * dépôt le paie. Les deux balayages ci-dessous s'arrêtaient au point-virgule,
   * faute de quoi ils lisaient douze lignes : dans un fichier SANS
   * point-virgule (le webhook Stripe), une LECTURE se voyait attribuer le
   * `.insert(` de l'instruction suivante et passait pour une écriture muette.
   *
   * Une chaîne `supabase.from(…).select(…).eq(…)` se reconnaît toute seule :
   * elle continue tant que la ligne suivante commence par un point.
   */
  function instruction(lignes: string[], i: number): string {
    let bloc = lignes[i].trim() + " ";
    for (let j = i + 1; j < lignes.length; j++) {
      const suite = lignes[j].trim();
      if (!suite.startsWith(".")) break;
      bloc += suite + " ";
    }
    return bloc;
  }

  it("balaie bien des fichiers, sinon ce test ne prouve rien", () => {
    const tous = PORTEE.flatMap((d) => fichiers(join(process.cwd(), d)));
    expect(tous.length).toBeGreaterThan(20);
  });

  it("aucune écriture jetée sans raison écrite", () => {
    const fautes: string[] = [];
    for (const d of PORTEE) {
      for (const chemin of fichiers(join(process.cwd(), d))) {
        const nom = chemin.split(/[\\/]/).slice(-2).join("/");
        const lignes = readFileSync(chemin, "utf8").split(SAUT);
        lignes.forEach((ligne, i) => {
          // Une instruction qui COMMENCE par `await …from(` : donc dont le
          // résultat n'est affecté à rien.
          if (!/^\s*await\s+\w+\s*$|^\s*await\s+\w+\.from\(/.test(ligne)) return;
          const bloc = instruction(lignes, i);
          if (!/\.(insert|update|upsert|delete)\(/.test(bloc)) return;
          // `.select()` rend les lignes touchées : l'appelant les lit forcément.
          if (/\.select\(/.test(bloc)) return;
          /**
           * ⚠️ UNE RAISON ÉCRITE SUFFIT, et c'est volontaire : certaines
           * écritures sont vraiment sans conséquence (une copie recalculée à
           * chaque chargement, un ménage refait à l'ouverture). Exiger un
           * `error` partout ferait ajouter des vérifications creuses, qu'on
           * apprendrait à écrire sans les lire.
           */
          const amont = lignes.slice(Math.max(0, i - 8), i).join(" ");
          if (/VOLONTAIREMENT IGNORÉ/.test(amont)) return;
          fautes.push(`${nom}:${i + 1} ${bloc.slice(0, 80).trim()}`);
        });
      }
    }
    expect(
      fautes,
      "écritures dont personne ne lit l'échec : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ── LA MÊME RÈGLE, L'AUTRE MOITIÉ DU PRODUIT ────────────────────────────────
   *
   * ⚠️⚠️ TOUT CE QUI PRÉCÈDE NE REGARDE QUE `supabase.from(…)`. Or la moitié des
   * gestes du trader ne passe pas par la base directement : ils POSTent sur une
   * route de l'app. Sept d'entre eux jetaient la réponse :
   *
   *   - mettre une connexion broker EN PAUSE, et la SUPPRIMER, dans un fichier
   *     où `runSync` et `saveCommission` lisaient déjà `res.ok` dix lignes plus
   *     haut ;
   *   - COUPER les notifications push, quand les activer vérifiait déjà ;
   *   - RETIRER un membre de sa communauté, quand en ajouter un vérifiait déjà ;
   *   - QUITTER une communauté, SUPPRIMER un défi, REJOINDRE un défi ;
   *   - GÉNÉRER le bilan du mois, où un quota épuisé (429) remettait simplement
   *     le bouton « Générer » à l'écran, et où chaque nouveau clic coûtait un
   *     appel de plus.
   *
   * ⚠️ LA FORME DU DÉFAUT EST TOUJOURS LA MÊME : la règle était écrite, et même
   * appliquée dans le fichier d'à côté, parfois dans la fonction d'à côté.
   */
  it("aucune écriture par fetch ne se tait", () => {
    const fautes: string[] = [];
    let vues = 0;
    for (const d of PORTEE) {
      for (const chemin of fichiers(join(process.cwd(), d))) {
        const source = readFileSync(chemin, "utf8");
        const nom = chemin.split(/[\\/]/).slice(-2).join("/");
        let i = -1;
        while ((i = source.indexOf("fetch(", i + 1)) !== -1) {
          // `prefetch(`, `refetch(` et autres : on ne vise que l'appel global.
          if (/[A-Za-z0-9_$]/.test(source[i - 1] ?? "")) continue;
          const appel = appelComplet(source, i);
          if (!/method:\s*["'](?:POST|PUT|PATCH|DELETE)/.test(appel)) continue;
          vues++;
          const ligne = source.slice(0, i).split(SAUT).length;
          const ou = `${nom}:${ligne}`;
          const amont = source.slice(Math.max(0, i - 400), i);
          if (/VOLONTAIREMENT IGNORÉ/.test(amont)) continue;

          const suite = source.slice(i + appel.length, i + appel.length + 900);
          const variable = /(?:const|let)\s+(\w+)\s*=\s*await\s*$/.exec(amont);

          if (variable) {
            const corps = fonctionEnglobante(source, i) ?? "";
            const lu = new RegExp(`\\b${variable[1]}\\.(?:ok|status)\\b`).test(corps);
            if (!lu) fautes.push(`${ou} (${variable[1]}.ok jamais lu)`);
            continue;
          }
          // Chaîne de promesses : elle doit au moins rattraper son échec.
          if (/^\s*\.(?:then|catch)\b/.test(suite)) {
            if (!/\.catch\s*\(/.test(suite)) fautes.push(`${ou} (chaîne sans .catch)`);
            continue;
          }
          fautes.push(`${ou} (réponse jetée)`);
        }
      }
    }
    expect(vues, "plus aucune écriture par fetch : le motif ne correspond plus").toBeGreaterThan(10);
    expect(
      fautes,
      "écritures par fetch dont personne ne lit l'échec : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : la formule d'exemption doit être VISIBLE et rare.
   * Si elle se répandait, ce test ne dirait plus rien ; si elle disparaissait,
   * c'est qu'on l'a remplacée par du silence.
   */
  it("les exemptions restent comptées et écrites", () => {
    let n = 0;
    for (const d of PORTEE) {
      for (const chemin of fichiers(join(process.cwd(), d))) {
        n += (readFileSync(chemin, "utf8").match(/VOLONTAIREMENT IGNORÉ/g) || []).length;
      }
    }
    expect(n, "aucune exemption : le motif ne correspond plus à rien").toBeGreaterThan(0);
    expect(n, "trop d'exemptions : la règle ne veut plus rien dire").toBeLessThan(8);
  });

  /**
   * ⚠️ ET LES CINQ ÉCRANS RÉPARÉS LISENT BIEN LEUR ERREUR. Le balayage ci-dessus
   * ne voit pas une écriture affectée à une variable : il faut donc nommer ceux
   * qui ont été corrigés, sinon on pourrait y remettre `if (user) { await … }`
   * sans que rien ne bronche.
   */
  it("les écrans réparés reprennent leur état quand l'écriture échoue", () => {
    const attendus: [string, RegExp][] = [
      ["app/dashboard/settings/page.tsx", /setEmailNotifSession\(!enabled\)/],
      ["components/settings/LeaderboardOptInCard.tsx", /if \(error\) \{\s*setErreur\(true\)/],
      ["components/settings/PushNotificationsCard.tsx", /setPrefs\(\(p\) => \(\{ \.\.\.p, \[key\]: !value \}\)\)/],
      ["components/session/EmotionalCheck.tsx", /setSelected\(null\)/],
      ["components/trades/TradeList.tsx", /trades_delete_one_failed/],
      /** ⚠️ La séance : démarrage muet, et clôture qui vidait l'écran sans vérifier. */
      ["app/dashboard/session/page.tsx", /session_start_failed/],
      ["app/dashboard/session/page.tsx", /session_end_failed/],
    ];
    for (const [chemin, motif] of attendus) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(motif.test(source), `${chemin} ne reprend plus son état`).toBe(true);
    }
  });

  /**
   * ── LA TROISIÈME FAÇON DE SE TAIRE ──────────────────────────────────────────
   *
   * ⚠️⚠️ NE PRENDRE QUE `data` EST AUSSI MUET QUE NE RIEN PRENDRE. Le premier
   * balayage cherche une instruction qui COMMENCE par `await`, donc dont le
   * résultat n'est affecté à rien. Il laissait passer
   * `const { data: inserted } = await supabase.from("sessions").insert(…)` :
   * l'`error` n'y est pas ignorée, elle n'est même pas nommée.
   *
   * ⚠️ TROUVÉ EN PRODUCTION, en faisant échouer depuis le navigateur toute
   * écriture REST : le trader coche sa checklist, choisit son état émotionnel,
   * clique « Démarrer la session », et RIEN ne se passe. Pas de séance, pas de
   * message, pas même une erreur en console. Les trois autres gestes éprouvés le
   * même jour (un réglage, la création d'un trade, sa suppression) disaient tous
   * la vérité : c'est la moitié manquante de la même règle.
   */
  it("une écriture dont on ne prend que `data` est muette aussi", () => {
    const fautes: string[] = [];
    let vues = 0;
    for (const d of PORTEE) {
      for (const chemin of fichiers(join(process.cwd(), d))) {
        const nom = chemin.split(/[\/]/).slice(-2).join("/");
        const lignes = readFileSync(chemin, "utf8").split(SAUT);
        lignes.forEach((ligne, i) => {
          const m = /^\s*const\s*\{([^}]*)\}\s*=\s*await\s/.exec(ligne);
          if (!m) return;
          const bloc = instruction(lignes, i);
          if (!/\.(insert|update|upsert|delete)\(/.test(bloc)) return;
          vues++;
          if (/(?:^|[^A-Za-z0-9_$])error/.test(m[1])) return;
          const amont = lignes.slice(Math.max(0, i - 8), i).join(" ");
          if (/VOLONTAIREMENT IGNORÉ/.test(amont)) return;
          fautes.push(`${nom}:${i + 1} ${bloc.slice(0, 80).trim()}`);
        });
      }
    }
    expect(vues, "aucune écriture destructurée : le motif ne cherche rien").toBeGreaterThan(0);
    expect(
      fautes,
      "écritures dont l'`error` n'est même pas nommée : " + fautes.join(" | "),
    ).toEqual([]);
  });
});
