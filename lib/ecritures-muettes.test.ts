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
          let bloc = "";
          for (let j = i; j < Math.min(i + 12, lignes.length); j++) {
            bloc += lignes[j].trim() + " ";
            if (/;\s*$/.test(lignes[j].trim())) break;
          }
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
    ];
    for (const [chemin, motif] of attendus) {
      const source = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(motif.test(source), `${chemin} ne reprend plus son état`).toBe(true);
    }
  });
});
