import { describe, it, expect } from "vitest";
import { dedupeKey, splitAlreadyImported } from "./dedupe-import";

const t = (over: Partial<{ open_time: string; pair: string; direction: string; lot_size: number }> = {}) => ({
  open_time: "2026-07-27T10:39:43.000Z",
  pair: "XAUUSD",
  direction: "short",
  lot_size: 1,
  ...over,
});

describe("splitAlreadyImported", () => {
  it("importe tout quand la base est vide", () => {
    const { toImport, skipped } = splitAlreadyImported([t(), t(), t()], []);
    expect(toImport).toHaveLength(3);
    expect(skipped).toBe(0);
  });

  it("garde les trois positions identiques quand une seule est déjà en base", () => {
    // Le bug historique : la présence d'une ligne masquait les trois.
    const { toImport, skipped } = splitAlreadyImported([t(), t(), t()], [t()]);
    expect(toImport).toHaveLength(2);
    expect(skipped).toBe(1);
  });

  it("n'importe rien quand les trois sont déjà en base (ré-import du même CSV)", () => {
    const { toImport, skipped } = splitAlreadyImported([t(), t(), t()], [t(), t(), t()]);
    expect(toImport).toHaveLength(0);
    expect(skipped).toBe(3);
  });

  it("ne confond pas des trades qui diffèrent par le lot, le sens ou l'heure", () => {
    const existing = [t()];
    const preview = [
      t(),
      t({ lot_size: 2 }),
      t({ direction: "long" }),
      t({ open_time: "2026-07-27T10:39:44.000Z" }),
    ];
    const { toImport, skipped } = splitAlreadyImported(preview, existing);
    expect(toImport).toHaveLength(3);
    expect(skipped).toBe(1);
  });
});

/**
 * LE MÊME INSTANT, ÉCRIT DE DEUX FAÇONS.
 *
 * ── LE DÉFAUT, MESURÉ EN RÉIMPORTANT LE MÊME FICHIER ────────────────────────
 *
 * ⚠️⚠️ LA CLÉ COMPARAIT DEUX CHAÎNES VENUES DE DEUX SOURCES. Le CSV donne
 * « 2026-09-10 09:15:00 », la base rend « 2026-09-10T09:15:00+00:00 » : jamais
 * la même clé, donc jamais de doublon détecté. Réimporter le fichier qu'on
 * venait d'importer créait trois trades de plus, en silence, alors que le
 * produit a la phrase toute prête (« Tous les trades existent déjà »).
 *
 * ⚠️ LE DÉDOUBLONNAGE EXISTAIT POURTANT, bien écrit et testé : ses tests
 * comparaient des horodatages déjà identiques, c'est-à-dire jamais le cas réel.
 */
describe("un instant s'écrit de plusieurs façons", () => {
  const csv = { open_time: "2026-09-10 09:15:00", pair: "EURUSD", direction: "long", lot_size: 0.1 };
  const base = { open_time: "2026-09-10T09:15:00+00:00", pair: "EURUSD", direction: "long", lot_size: 0.1 };

  it("reconnaît le même trade écrit par le CSV et par la base", () => {
    expect(dedupeKey(csv)).toBe(dedupeKey(base));
  });

  it("ne réimporte pas un fichier déjà importé", () => {
    const { toImport, skipped } = splitAlreadyImported([csv], [base]);
    expect(toImport).toEqual([]);
    expect(skipped).toBe(1);
  });

  /**
   * ⚠️ L'HEURE SANS FUSEAU SE LIT EN UTC, comme Postgres le fait de l'autre
   * côté. Lue dans le fuseau de la machine, la clé se décalerait d'une ou deux
   * heures selon la saison, et le dédoublonnage redeviendrait aveugle en été.
   */
  it("lit un horodatage sans fuseau en UTC", () => {
    expect(dedupeKey({ ...csv, open_time: "2026-09-10 09:15:00" })).toBe(
      dedupeKey({ ...csv, open_time: "2026-09-10T09:15:00Z" }),
    );
  });

  it("normalise aussi le volume et la casse", () => {
    expect(dedupeKey({ ...csv, lot_size: 0.1 })).toBe(
      dedupeKey({ ...csv, lot_size: "0.10" as unknown as number, pair: "eurusd", direction: "LONG" }),
    );
  });

  /** ⚠️ Et deux trades vraiment distincts restent distincts. */
  it("ne confond pas deux instants différents", () => {
    expect(dedupeKey(csv)).not.toBe(dedupeKey({ ...csv, open_time: "2026-09-10 09:15:01" }));
  });
});
