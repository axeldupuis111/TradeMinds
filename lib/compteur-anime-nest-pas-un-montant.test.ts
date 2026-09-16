import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * UN COMPTEUR ANIMÉ QUI RECOLLE UN SYMBOLE DE DEVISE CONTOURNE LE GARDE.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ « P&L NET DU MOIS : -6 703 € », LE CHIFFRE LE PLUS VISIBLE DU BILAN
 * MENSUEL, ÉTAIT LA SOMME D'EUROS ET DE DOLLARS. Relevé le 2026-09-16 sur le
 * mois d'août :
 *
 *   à l'écran   -6 703 €
 *   en base     -6 253,28 €  ET  -449,36 $
 *   (-6 253,28 + -449,36 = -6 702,64, arrondi à -6 703, affiché en euros)
 *
 * ── POURQUOI LE GARDE EXISTANT NE POUVAIT PAS LE VOIR ───────────────────────
 *
 * ⚠️ LE GARDE ÉTAIT LÀ, ET CETTE CARTE PASSAIT À CÔTÉ. Tout le reste de la page
 * formate par `fmtMoney`, qui rend un TIRET quand la devise est vide, et
 * l'en-tête du fichier dit pourquoi : « une liste de trente-quatre gardes à
 * tenir à jour est exactement ce qui produit ce genre de défaut ».
 *
 * Trois cartes recollaient pourtant le symbole elles-mêmes, par
 * `suffix={currencySymbol(displayCurrency)}` autour d'un `<CountUp>`. Or
 * `currencySymbol("")` RETOMBE SUR L'EURO : la sentinelle « devises mêlées »,
 * qui vaut la chaîne vide, était avalée par le formateur de symbole.
 *
 * ⚠️⚠️ UNE SENTINELLE QUE LE FORMATEUR AVALE N'EST PAS UNE SENTINELLE. C'est la
 * forme générale de ce défaut, et elle vaut au-delà des devises.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un montant ne se compose pas à la main à côté d'un compteur animé. Il passe
 * par le formateur de la page, qui seul connaît le cas « je ne peux pas
 * nommer ce montant ».
 */
describe("un compteur animé ne fabrique pas un montant", () => {
  const RACINE = process.cwd();

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = () => [...fichiers(join(RACINE, "app")), ...fichiers(join(RACINE, "components"))];

  /**
   * Un `<CountUp>` dont le suffixe est un symbole de devise.
   *
   * ⚠️⚠️ SURTOUT PAS `[^>]*` ENTRE LES DEUX, ET C'EST MA DEUXIÈME FOIS. Ma
   * première version s'écrivait `/<CountUp[^>]*suffix=\{[^}]*currencySymbol\(/`
   * et ne trouvait RIEN sur le code fautif : la balise contient
   * `stats.totalPnl >= 0`, et le `>` de `>=` ferme la classe. Le même piège
   * avait déjà arrêté un scanner de ce dépôt sur le `=>` d'un `onClick`.
   *
   * On teste donc trois présences sur la LIGNE, sans rien supposer de l'ordre
   * ni du contenu intermédiaire.
   */
  const COMPTEUR_ARGENT = {
    test: (ligne: string) =>
      ligne.includes("<CountUp") && ligne.includes("suffix={") && ligne.includes("currencySymbol("),
  };

  it("balaie bien des fichiers, sinon ce test ne prouve rien", () => {
    expect(tous().length).toBeGreaterThan(50);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    expect(
      COMPTEUR_ARGENT.test(
        '<CountUp end={stats.totalPnl} suffix={` ${currencySymbol(displayCurrency).trim()}`} />',
      ),
    ).toBe(true);
    expect(COMPTEUR_ARGENT.test("<CountUp end={stats.trades} duration={0.9} />")).toBe(false);
  });

  /**
   * L'expression JSX qui CONTIENT le compteur : on remonte jusqu'à l'accolade
   * ouvrante non refermée.
   *
   * ⚠️⚠️ PAS UNE FENÊTRE DE N LIGNES, ET J'AI FAILLI REFAIRE LA FAUTE. Ma
   * première version regardait les trois lignes au-dessus, et accusait
   * `components/dashboard/CapitalLeaks.tsx`, où le ternaire de protection ouvre
   * HUIT lignes plus haut : du code juste, dénoncé par un garde. Trois gardes
   * de ce dépôt ont déjà menti pour avoir pris une distance pour une frontière.
   * L'accolade, elle, est une vraie frontière.
   */
  function expressionEnglobante(src: string, position: number): string {
    let profondeur = 0;
    for (let i = position; i >= 0; i--) {
      const c = src[i];
      if (c === "}") profondeur++;
      else if (c === "{") {
        if (profondeur === 0) return src.slice(i, position);
        profondeur--;
      }
    }
    return src.slice(0, position);
  }

  /**
   * ⚠️ LA RÈGLE N'EST PAS « PAS DE COUNTUP SUR DE L'ARGENT » : l'animation d'un
   * montant est voulue, et elle est juste dès qu'une devise est connue. C'est le
   * cas « devise inconnue » qui doit être traité dans l'expression qui contient
   * le compteur, par un ternaire qui rend un tiret.
   */
  it("chaque montant animé est protégé par le cas « devises mêlées »", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      const src = readFileSync(chemin, "utf8");
      const lignes = src.split(/\r?\n/);
      /**
       * ⚠️⚠️ LA LONGUEUR DU SAUT DE LIGNE, ET C'EST LA TROISIÈME FOIS QUE CE
       * FICHIER ME PIÈGE. Ma version précédente avançait de `ligne.length + 1`,
       * ce qui est faux sur un fichier en CRLF : le décalage s'accumule d'un
       * caractère par ligne, et à la ligne six cents la position pointait
       * quinze lignes trop haut, en plein milieu d'un littéral de gabarit. Le
       * garde accusait alors du code juste. On mesure le séparateur.
       */
      const saut = src.includes("\r\n") ? 2 : 1;
      let offset = 0;
      lignes.forEach((ligne, i) => {
        const debutLigne = offset;
        offset += ligne.length + saut;
        if (!COMPTEUR_ARGENT.test(ligne)) return;
        const englobante = expressionEnglobante(src, debutLigne);
        if (/devisesMelangees|melangees\s*\?|melange\s*\?/.test(englobante)) return;
        fautes.push(`${nom}:${i + 1}  ${ligne.trim().slice(0, 90)}`);
      });
    }
    expect(
      fautes,
      "montants animés qui recollent un symbole sans traiter le cas « devises mêlées ». " +
        "`currencySymbol(\"\")` retombe sur l'euro, donc la sentinelle est avalée :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LA PAGE DIT POURQUOI. Une page entière de tirets sans explication est
   * pire qu'un chiffre faux : le trader en conclut que le produit n'a pas su
   * lire ses données.
   */
  it("le bilan mensuel explique ses tirets, dans les quatre langues", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/review/page.tsx"), "utf8");
    expect(src, "le bandeau d'explication a disparu").toContain('t("review_devises_melangees")');
    expect(src, "le bandeau ne s'annonce pas aux lecteurs d'écran").toMatch(
      /role="status"[^]{0,400}review_devises_melangees/,
    );
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const texte = (dico as Record<string, string>)["review_devises_melangees"];
      expect(texte, `review_devises_melangees manque en ${nom}`).toBeTruthy();
      expect(texte.length, `review_devises_melangees trop court en ${nom}`).toBeGreaterThan(60);
    }
  });

  /**
   * ⚠️ ET LE FORMATEUR DE LA PAGE REFUSE TOUJOURS DE NOMMER UN MONTANT SANS
   * DEVISE : c'est lui qui porte la règle, les cartes ne font que ne plus le
   * contourner.
   */
  it("le formateur du bilan rend un tiret quand la devise est inconnue", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/review/page.tsx"), "utf8");
    expect(src).toMatch(/function fmtMoney\(n: number, currency: string\) \{\s*\n\s*if \(!currency\) return/);
  });

  /**
   * ⚠️⚠️ CACHER LE NOMBRE ET GARDER LA CONCLUSION QU'IL SERVAIT À TIRER NE
   * CORRIGE RIEN. « Meilleur jour » et « Pire jour » affichaient un tiret à la
   * place du montant, faute de devise, ET la date du jour en question. Or ce
   * jour est DÉSIGNÉ en comparant des sommes journalières de devises
   * différentes : en août, le meilleur jour en dollars vaut +120,64 $ et le
   * meilleur jour en euros -1 478,45 €. La carte disparaît donc entièrement.
   */
  it("« meilleur jour » et « pire jour » disparaissent quand les devises se mêlent", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/review/page.tsx"), "utf8");
    for (const cle of ["review_best_day", "review_worst_day"]) {
      const i = src.indexOf(`t("${cle}")`);
      expect(i, `${cle} n'est plus affichée nulle part`).toBeGreaterThan(-1);
      // La condition vit sur la même ligne que le libellé.
      const debutLigne = src.lastIndexOf("\n", i) + 1;
      expect(
        src.slice(debutLigne, i),
        `${cle} s'affiche encore quand les devises se mêlent`,
      ).toContain("!devisesMelangees");
    }
  });
});
