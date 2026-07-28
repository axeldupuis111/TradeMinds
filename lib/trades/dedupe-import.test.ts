import { describe, it, expect } from "vitest";
import { splitAlreadyImported } from "./dedupe-import";

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
