import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  besoinsNonCouverts,
  diagnostiquerMethode,
  METHODES,
  methodeParCode,
  type Methode,
} from "./methodes";
import { instrumentParCode } from "./instruments";
import fr from "../i18n/fr";

const NAS = instrumentParCode("NAS100")!;
const EUR = instrumentParCode("EURUSD")!;
const connues = fr as Record<string, string>;

const contexte = (debut = "08:00", fin = "17:00") => ({
  contexte: { fuseau: "Europe/Paris", debut, fin, jours: [] as never[] },
});

describe("le référentiel des méthodes", () => {
  it("n'a pas deux fois le même code", () => {
    const codes = METHODES.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  /**
   * ⚠️ UN CODE TECHNIQUE À L'ÉCRAN EST UN BUG. « orderflow_absorption » ne dit
   * rien à personne, et c'est le nom d'une méthode que le trader a choisie.
   */
  it.each(METHODES.map((m) => m.code))("« %s » a son nom et sa description", (code) => {
    expect(connues[`bt_meth_${code}`], `bt_meth_${code} manquante`).toBeTruthy();
    expect(connues[`bt_meth_${code}_quoi`], `bt_meth_${code}_quoi manquante`).toBeTruthy();
  });

  it("chaque tueur déclaré a sa rédaction", () => {
    for (const m of METHODES) {
      for (const t of m.tueurs) {
        expect(connues[`bt_tueur_${t}`], `bt_tueur_${t} manquante (${m.code})`).toBeTruthy();
      }
    }
  });

  it("chaque partie non reproduite a sa rédaction", () => {
    for (const m of METHODES) {
      for (const n of m.squelette?.nonReproduit ?? []) {
        expect(connues[`bt_nonrep_${n}`], `bt_nonrep_${n} manquante (${m.code})`).toBeTruthy();
      }
    }
  });

  /**
   * ⚠️⚠️ LA COHÉRENCE QUI COMPTE : une méthode déclarée « complète » ne doit rien
   * réclamer que nous n'ayons pas, sinon l'outil rendrait un chiffre en croyant
   * mesurer sa méthode. Et une méthode qui réclame le carnet ne peut pas être
   * déclarée complète, quelle que soit l'envie qu'on en ait.
   */
  it("une méthode complète ne réclame que ce que nous avons", () => {
    for (const m of METHODES) {
      if (m.mecanisation === "complete") {
        expect(besoinsNonCouverts(m), m.code).toEqual([]);
      }
    }
  });

  it("une méthode partielle ou complète sait par quoi l'approcher", () => {
    for (const m of METHODES) {
      if (m.mecanisation !== "aucune") {
        expect(m.squelette?.niveau ?? m.squelette?.declencheur, m.code).toBeTruthy();
      }
    }
  });

  it("une méthode partielle déclare ce qu'elle ne reproduit pas", () => {
    for (const m of METHODES.filter((x) => x.mecanisation === "partielle")) {
      expect(m.squelette?.nonReproduit.length, m.code).toBeGreaterThan(0);
    }
  });

  it("une méthode complète ne laisse rien de non reproduit", () => {
    for (const m of METHODES.filter((x) => x.mecanisation === "complete")) {
      expect(m.squelette?.nonReproduit, m.code).toEqual([]);
    }
  });

  /**
   * ⚠️ Les types de blocs cités doivent exister dans le catalogue, sinon le
   * squelette fabriquerait un plan que le moteur ne sait pas exécuter.
   */
  it("les blocs cités existent dans le catalogue", () => {
    const TYPES = readFileSync(join(process.cwd(), "lib/backtest/types.ts"), "utf8");
    for (const m of METHODES) {
      if (m.squelette?.niveau) {
        expect(TYPES.includes(`"${m.squelette.niveau}"`), `${m.code}/${m.squelette.niveau}`).toBe(
          true,
        );
      }
      if (m.squelette?.declencheur) {
        expect(TYPES.includes(`"${m.squelette.declencheur}"`), m.code).toBe(true);
      }
    }
  });

  it("retrouve une méthode par son code", () => {
    expect(methodeParCode("orderflow_absorption")?.famille).toBe("flux");
    expect(methodeParCode("rien_du_tout")).toBeUndefined();
  });
});

describe("ce que nos données ne couvrent pas", () => {
  it("l'orderflow réclame le volume réel et le delta", () => {
    const m = methodeParCode("orderflow_absorption")!;
    expect(besoinsNonCouverts(m)).toEqual(["volume_reel", "delta"]);
  });

  it("une méthode de structure ne réclame rien de plus que l'OHLC", () => {
    expect(besoinsNonCouverts(methodeParCode("trendline")!)).toEqual([]);
  });
});

describe("le diagnostic d'une méthode, sans lire une seule bougie", () => {
  /**
   * ⚠️⚠️ LE CONSTAT QUI PEUT ÊTRE TOUTE L'EXPLICATION D'UN TRADER. Le volume
   * affiché par un courtier de CFD est celui de ses clients, pas celui du
   * marché : une méthode de flux jouée là-dessus lit une autre grandeur.
   */
  it("dit qu'un volume de CFD n'est pas un volume de marché", () => {
    const c = diagnostiquerMethode(methodeParCode("volume_profile")!, NAS, contexte());
    expect(c.map((x) => x.code)).toContain("volume_du_courtier");
  });

  it("dit quand le marché testé n'est pas de ceux où la méthode vit", () => {
    const c = diagnostiquerMethode(methodeParCode("orderflow_absorption")!, EUR, contexte());
    expect(c.map((x) => x.code)).toContain("marche_hors_methode");
  });

  it("dit quand la plage horaire rate la séance de la méthode", () => {
    const c = diagnostiquerMethode(
      methodeParCode("ict_silver_bullet")!,
      NAS,
      contexte("01:00", "05:00"),
    );
    expect(c.map((x) => x.code)).toContain("hors_seance");
  });

  it("ne reproche pas la séance quand les plages se recoupent", () => {
    const c = diagnostiquerMethode(
      methodeParCode("ict_silver_bullet")!,
      NAS,
      contexte("09:00", "12:00"),
    );
    expect(c.map((x) => x.code)).not.toContain("hors_seance");
  });

  it("ne reproche rien à une méthode de structure sur son marché", () => {
    expect(diagnostiquerMethode(methodeParCode("trendline")!, NAS, contexte())).toEqual([]);
  });

  it("chaque code de constat a sa rédaction", () => {
    const codes = new Set<string>();
    for (const m of METHODES) {
      for (const i of [NAS, EUR]) {
        for (const c of diagnostiquerMethode(m, i, contexte("01:00", "05:00"))) codes.add(c.code);
      }
    }
    expect(codes.size).toBeGreaterThan(3);
    for (const c of Array.from(codes)) {
      expect(connues[`bt_dmeth_${c}`], `bt_dmeth_${c} manquante`).toBeTruthy();
    }
  });
});

describe("les familles et les régimes", () => {
  it("chaque famille a son nom", () => {
    for (const f of Array.from(new Set(METHODES.map((m) => m.famille)))) {
      expect(connues[`bt_fam_${f}`], `bt_fam_${f} manquante`).toBeTruthy();
    }
  });

  it("chaque régime a son nom", () => {
    for (const r of Array.from(new Set(METHODES.flatMap((m) => m.regimes)))) {
      expect(connues[`bt_regime_${r}`], `bt_regime_${r} manquante`).toBeTruthy();
    }
  });

  it("chaque besoin de données a son nom", () => {
    for (const b of Array.from(new Set(METHODES.flatMap((m: Methode) => m.besoins)))) {
      expect(connues[`bt_besoin_${b}`], `bt_besoin_${b} manquante`).toBeTruthy();
    }
  });

  it("chaque niveau de mécanisation a sa rédaction", () => {
    for (const m of Array.from(new Set(METHODES.map((x) => x.mecanisation)))) {
      expect(connues[`bt_meca_${m}`], `bt_meca_${m} manquante`).toBeTruthy();
    }
  });
});
