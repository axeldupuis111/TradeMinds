import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FUSEAU_DES_KILLZONES,
  ICT_KILLZONES,
  KILLZONE_WINDOWS,
  detectKillzone,
  nomDeKillzone,
} from "./ict-constants";
import { SESSIONS } from "./sessions-de-marche";

/**
 * UNE PLAGE HORAIRE SE MONTRE AVEC SON FUSEAU, ET SON LIBELLÉ NE PEUT PAS
 * CONTREDIRE CE QUE LE CODE CALCULE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « LONDON OPEN (08H-12H) », SANS DIRE 08 H OÙ. Le trader lit sa propre
 * montre : un inscrit de New York étiquetait donc ses trades à la main d'après
 * une grille décalée de six heures, et le produit le contredisait sans jamais
 * dire pourquoi. Dix-sept inscrits sur vingt et un sont anglophones.
 *
 * ⚠️ LA LEÇON ÉTAIT DÉJÀ TIRÉE À CÔTÉ : `lib/sessions-de-marche.ts` écrit
 * « London (08:00–12:00 UTC) » et explique en commentaire pourquoi le fuseau
 * fait partie du libellé. Une règle écrite, appliquée à une surface sur deux.
 *
 * ⚠️⚠️ ET « HORS SESSION » DISAIT UNE CHOSE FAUSSE. Une killzone est un créneau
 * étroit ; une session de marché est la journée entière. Mesuré sur la
 * production le 2026-09-18 : VINGT-QUATRE trades portaient « hors session »
 * pendant que la règle de discipline, qui lit `SESSIONS`, les voyait DANS la
 * session de Londres. Deux verdicts contraires sur le même trade, sur le même
 * écran, tous les deux justes : c'est le mot qui mentait.
 *
 * ── CE QUI N'A PAS ÉTÉ CHANGÉ, ET POURQUOI ──────────────────────────────────
 *
 * ✅ L'ANCRE RESTE PARIS. Rejoué sur les 447 trades de production : l'ancre UTC
 * ré-étiquette 216 trades, l'ancre Londres 139 — et aucune des trois n'est
 * « la bonne », les fenêtres du produit étant quatre blocs de quatre heures là
 * où ICT découpe des créneaux étroits en heure de New York. Ré-étiqueter des
 * trades déjà relus par leur auteur pour une grille qui reste approximative
 * n'est pas une correction.
 */

describe("le libellé d'une killzone", () => {
  it("dit toujours dans quel fuseau ses heures sont écrites", () => {
    const ville = FUSEAU_DES_KILLZONES.split("/")[1];
    for (const { value, label } of ICT_KILLZONES) {
      if (value === "off_session") continue;
      for (const langue of ["fr", "en", "de", "es"] as const) {
        expect(
          label[langue],
          `${value} en ${langue} montre des heures sans dire de quelle horloge`,
        ).toContain(ville);
      }
    }
  });

  /**
   * ⚠️⚠️ LE LIBELLÉ EST CONSTRUIT À PARTIR DE LA FENÊTRE, donc il ne peut plus
   * la contredire. Ce test le vérifie sur la valeur affichée, pas sur le code
   * qui la fabrique : une future recopie à la main tomberait ici.
   */
  it("montre exactement les bornes que le code emploie", () => {
    for (const [nom, [debut, fin]] of Object.entries(KILLZONE_WINDOWS)) {
      const entree = ICT_KILLZONES.find((k) => k.value === nom);
      expect(entree, `${nom} a disparu du menu`).toBeTruthy();
      const h = (n: number) => `${String(n).padStart(2, "0")}:00`;
      expect(entree!.label.fr, `${nom} annonce une plage que le code ne calcule pas`).toContain(
        `${h(debut)}–${h(fin)}`,
      );
    }
  });

  /**
   * ⚠️ ET « HORS KILLZONE » NE PARLE PLUS DE SESSION. Le mot « session » dans
   * ce libellé est précisément ce qui contredisait la règle de discipline.
   */
  it("ne promet plus au trader qu'il était hors du marché", () => {
    const off = ICT_KILLZONES.find((k) => k.value === "off_session")!;
    expect(off.label.fr.toLowerCase(), "« hors session » est revenu").not.toContain("session");
    expect(off.label.en.toLowerCase()).not.toContain("off session");
    expect(off.label.fr.toLowerCase()).toContain("killzone");
  });
});

describe("la contradiction entre l'étiquette et la règle", () => {
  /**
   * ⚠️⚠️ LE CAS RÉEL, REPRIS DE LA PRODUCTION : 2026-03-09 à 11 h 08 UTC. La
   * règle de discipline le voit dans la session de Londres (08-12 UTC) ; son
   * étiquette de killzone dit « off ». Les deux restent vrais — ce test fige
   * qu'ils ne se contredisent plus EN MOTS.
   */
  it("un trade peut être dans une session sans être dans une killzone", () => {
    const trade = "2026-03-09T11:08:37Z";
    const h = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", hour12: false }).format(
        new Date(trade),
      ),
    );
    const dansLondres = h >= SESSIONS.london.debut && h < SESSIONS.london.fin;
    expect(dansLondres, "le cas de production a changé de nature").toBe(true);
    expect(detectKillzone(trade)).toBe("off_session");

    const off = ICT_KILLZONES.find((k) => k.value === "off_session")!;
    // Le libellé ne dit plus « hors session » à un trade qui est dans une session.
    expect(off.label.fr.toLowerCase()).not.toContain("hors session");
  });
});

describe("l'ancre des killzones", () => {
  /**
   * ⚠️ LA DÉCISION EST FIGÉE ICI. La changer ré-étiquette entre 139 et 216
   * trades de production : que ce test tombe est le rappel que ce n'est pas
   * une correction anodine, et que la mesure est écrite dans `ict-constants`.
   */
  it("reste Paris, décision mesurée du 2026-09-18", () => {
    expect(FUSEAU_DES_KILLZONES).toBe("Europe/Paris");
  });

  /** ⚠️ L'heure d'été n'est plus écrite en dur : c'est le défaut du 2026-09-17. */
  it("suit l'heure d'été réelle", () => {
    // 26 mars, heure d'hiver à Paris (UTC+1) : 10 h 53 UTC = 11 h 53 à Paris.
    expect(detectKillzone("2026-03-26T10:53:00Z")).toBe("london_open");
    // 26 juin, heure d'été (UTC+2) : 10 h 53 UTC = 12 h 53 à Paris.
    expect(detectKillzone("2026-06-26T10:53:00Z")).toBe("off_session");
  });

  /** ⚠️ `london_close` reste proposé mais jamais deviné : sa fenêtre est dans ny_pm. */
  it("ne devine jamais une fenêtre incluse dans une autre", () => {
    expect(KILLZONE_WINDOWS.london_close).toBeUndefined();
    expect(ICT_KILLZONES.some((k) => k.value === "london_close")).toBe(true);
    // 16 h 30 à Paris tombe dans les deux : le code choisit celle qui décide.
    expect(detectKillzone("2026-06-26T14:30:00Z")).toBe("ny_pm");
  });
});

describe("le nom court d une killzone", () => {
  /**
   * ⚠️⚠️ MON PROPRE CORRECTIF N AVAIT TOUCHÉ QU UNE TABLE SUR DEUX. Le soir du
   * 2026-09-18, `ICT_KILLZONES` est passé à « Hors killzone » — parce que
   * « Hors session » contredisait la règle de discipline sur vingt-quatre
   * trades — pendant que TROIS écrans continuaient d afficher « Hors session » :
   * la pastille de la liste des trades, le bloc de performance par timing et le
   * tiroir de détail d un trade. Ils lisaient une autre table.
   */
  it("dit « hors killzone » partout, pas seulement dans le menu", () => {
    for (const langue of ["fr", "en", "de", "es"] as const) {
      const court = nomDeKillzone("off_session", langue);
      expect(court.toLowerCase(), `« ${court} » parle encore de session en ${langue}`).not.toMatch(
        /session|sitzung|sesión/,
      );
      expect(court.toLowerCase()).toContain("killzone");
    }
  });

  /** ⚠️ Le nom court est le libellé long SANS ses heures : une seule source. */
  it("est le libellé long débarrassé de ses heures", () => {
    for (const { value, label } of ICT_KILLZONES) {
      for (const langue of ["fr", "en", "de", "es"] as const) {
        expect(label[langue], `${value} en ${langue}`).toContain(nomDeKillzone(value, langue));
      }
    }
  });

  /**
   * ⚠️⚠️ ET `london_close` A UN NOM. L ancienne table l ignorait alors que le
   * formulaire de saisie manuelle le PROPOSE : un trader qui le choisissait
   * lisait « london_close » dans sa liste, une valeur brute à l écran.
   */
  it("nomme toutes les valeurs que le formulaire propose", () => {
    for (const { value } of ICT_KILLZONES) {
      const court = nomDeKillzone(value, "fr");
      expect(court, `${value} s affiche tel quel`).not.toBe(value);
    }
  });

  /** ⚠️ Et la table morte ne revient pas. */
  it("plus aucune autre table de libellés de killzone", () => {
    const derive = readFileSync(join(process.cwd(), "lib/strategy/derive.ts"), "utf8");
    expect(derive, "KILLZONE_LABELS est revenu").not.toMatch(/export const KILLZONE_LABELS/);
    expect(derive, "killzoneLabel est revenu").not.toMatch(/export function killzoneLabel/);
  });
});
