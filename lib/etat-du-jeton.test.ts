import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { etatDuJeton } from "./etat-du-jeton";
import { sansCommentaires } from "./sans-commentaires";

/**
 * ON NE PROPOSE PAS DE RÉGÉNÉRER UN JETON QU'ON N'A PAS PU LIRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ CE N'EST PAS UN MESSAGE FAUX, C'EST UNE SYNCHRO CASSÉE. La page Réglages
 * lisait `/api/mt/token` sans regarder `res.ok`, dans un `try` au `catch` muet.
 * À la moindre panne, le jeton restait `null` et l'écran affichait
 * « Générer un jeton », exactement comme pour quelqu'un qui n'en a jamais eu.
 *
 * Le jeton est recopié EN DUR dans l'EA MetaTrader, le cBot cTrader, l'add-on
 * NinjaTrader et l'alerte TradingView, tous installés sur la machine du trader.
 * En régénérer un invalide l'ancien : ses trades cessent d'arriver, sans
 * message et sans erreur.
 *
 * ⚠️ Et la consigne était répétée QUATRE FOIS à partir du même `null` : la
 * section MetaTrader, les cartes cTrader et NinjaTrader via `SyncTokenField`,
 * et la carte TradingView.
 */
describe("l'état du jeton de synchro", () => {
  it("distingue trois états, pas deux", () => {
    expect(etatDuJeton("mt_abc")).toBe("present");
    expect(etatDuJeton(null)).toBe("absent");
    expect(etatDuJeton(undefined)).toBe("absent");
    expect(etatDuJeton(null, true)).toBe("lecture-ratee");
  });

  /**
   * ⚠️⚠️ LE CAS QUI COÛTAIT LA SYNCHRO : la lecture échoue, donc le jeton
   * arrive à `null` alors qu'il en existe peut-être un. « Je n'ai pas pu lire »
   * doit gagner, sinon l'écran propose une action destructrice.
   */
  it("fait passer l'échec de lecture avant l'absence", () => {
    expect(etatDuJeton(null, true)).toBe("lecture-ratee");
    // Et même si un jeton avait été lu avant la panne, on ne l'affirme plus.
    expect(etatDuJeton("mt_abc", true)).toBe("lecture-ratee");
  });

  /**
   * ⚠️ ET LES QUATRE SURFACES PASSENT PAR LÀ. Un composant qui déciderait
   * lui-même à partir d'un `!token` retomberait exactement dans le défaut :
   * c'est la forme que ce dépôt répare le plus souvent, une règle écrite puis
   * appliquée à une partie seulement de ce qu'elle vise.
   */
  it("est la seule décision, sur toutes les surfaces du jeton", () => {
    const surfaces = [
      ["components", "settings", "SyncTokenField.tsx"],
      ["components", "settings", "TradingViewCard.tsx"],
    ];
    for (const chemin of surfaces) {
      const src = sansCommentaires(readFileSync(join(process.cwd(), ...chemin), "utf8"));
      const nom = chemin.slice(-1)[0];
      expect(src, `${nom} ne passe pas par etatDuJeton`).toMatch(/etatDuJeton\(/);
      expect(src, `${nom} ignore l'échec de lecture`).toMatch(/lectureRatee/);
    }

    // La page qui lit : elle doit distinguer l'échec, et ne pas le confondre
    // avec « pas de jeton ».
    const reglages = sansCommentaires(
      readFileSync(join(process.cwd(), "app", "dashboard", "settings", "page.tsx"), "utf8"),
    );
    /**
     * ⚠️ ON DÉCOUPE LE CORPS DE LA FONCTION EN COMPTANT LES ACCOLADES, pas en
     * regardant « les 200 caractères qui suivent » : une fenêtre en nombre de
     * caractères n'est pas une frontière, et trois gardes de ce dépôt ont déjà
     * menti pour cette raison exacte.
     */
    const debut = reglages.indexOf("async function fetchMtToken()");
    expect(debut, "fetchMtToken a disparu").toBeGreaterThan(-1);
    let prof = 0;
    let i = reglages.indexOf("{", debut);
    const ouverture = i;
    for (; i < reglages.length; i++) {
      if (reglages[i] === "{") prof++;
      else if (reglages[i] === "}" && --prof === 0) break;
    }
    const corps = reglages.slice(ouverture, i);
    expect(corps, "la lecture du jeton ne regarde pas le statut HTTP").toMatch(/res\.ok/);
    expect(corps, "l'échec du jeton n'est pas retenu").toMatch(/setMtLectureRatee\(true\)/);
    expect(reglages, "l'échec n'est pas dit au trader").toMatch(/mtLectureRatee \?/);
  });
});
