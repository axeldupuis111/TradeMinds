import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fermerLesSeancesOubliees } from "./sessions-oubliees";

/**
 * UNE ÉCRITURE CONDITIONNELLE DIT CE QU'ELLE A TOUCHÉ.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « CE TRADE EST CLÔTURÉ » ALORS QUE RIEN N'AVAIT BOUGÉ. La modale de
 * clôture protège son écriture par `.eq("status", "open")` : c'est juste, mais
 * une mise à jour qui ne touche AUCUNE ligne n'est pas une erreur pour
 * PostgREST. `error` restait nul, la modale se fermait, et le trade restait
 * ouvert. Le cas arrive pour de vrai : un deuxième onglet, ou la
 * synchronisation du courtier qui a clôturé la position entre-temps.
 *
 * ⚠️ ET UN NOMBRE PUBLIÉ QUI N'EST PAS MESURÉ. Le cron des rappels annonçait
 * `nettoyees` en comptant les UTILISATEURS EXAMINÉS : un ménage qui ne ferme
 * rien rendait le même chiffre qu'un ménage qui ferme douze séances.
 *
 * ⚠️ LA RÈGLE EXISTAIT DÉJÀ, ÉCRITE : « le client Supabase ne jette pas, toute
 * écriture non vérifiée ment » (lib/supabase-silent-errors). Elle était
 * appliquée aux erreurs, pas au NOMBRE DE LIGNES.
 */

const RACINE = process.cwd();

/** Client simulé : rend les lignes que la mise à jour prétend avoir touchées. */
function client(lignes: unknown[] | null) {
  const b: Record<string, unknown> = {};
  for (const m of ["update", "eq", "lt", "gte", "in", "is"]) b[m] = () => b;
  b.select = () => Promise.resolve({ data: lignes, error: null });
  return { from: vi.fn(() => b) } as unknown as SupabaseClient;
}

describe("le ménage des séances oubliées", () => {
  it("rend le nombre de séances réellement fermées", async () => {
    const n = await fermerLesSeancesOubliees(client([{ id: "a" }, { id: "b" }]), "u", "2026-09-18T00:00:00Z");
    expect(n).toBe(2);
  });

  it("rend zéro quand il n'y avait rien à fermer", async () => {
    expect(await fermerLesSeancesOubliees(client([]), "u", "2026-09-18T00:00:00Z")).toBe(0);
  });

  /** ⚠️ Un échec reste sans conséquence : le ménage se refait tout seul. */
  it("rend zéro sans se plaindre quand la lecture échoue", async () => {
    expect(await fermerLesSeancesOubliees(client(null), "u", "2026-09-18T00:00:00Z")).toBe(0);
  });
});

describe("la clôture manuelle d'un trade", () => {
  const src = readFileSync(join(RACINE, "components/trades/CloseTradeModal.tsx"), "utf8");

  it("lit ce que sa mise à jour a touché", () => {
    /**
     * ⚠️ L'ANCRE EST LA MISE À JOUR, PAS LE FILTRE. `.eq("status", "open")`
     * apparaît DEUX fois dans ce fichier : d'abord sur la LECTURE qui charge le
     * trade, ensuite sur l'écriture. La première version de ce garde a trouvé
     * la lecture et cherché un `.select()` derrière elle. Ce dépôt a déjà payé
     * ce piège quatre fois : une occurrence n'est pas la bonne par défaut.
     */
    const i = src.indexOf(".update(");
    expect(i, "la modale n'écrit plus rien").toBeGreaterThan(-1);
    const bloc = src.slice(i, src.indexOf(";", i));
    expect(bloc, "le garde-fou sur l'état du trade a disparu").toContain('.eq("status", "open")');
    expect(
      bloc,
      "la mise à jour ne dit pas si elle a trouvé une ligne : l'écran annoncera " +
        "une clôture qui n'a pas eu lieu",
    ).toContain(".select(");
  });

  it("dit au trader que le trade n'était plus ouvert", () => {
    expect(src, "aucun message pour une clôture sans effet").toContain("close_trade_err_not_open");
    for (const langue of ["fr", "en", "de", "es"]) {
      const dict = readFileSync(join(RACINE, `lib/i18n/${langue}.ts`), "utf8");
      expect(dict, `message absent en ${langue}`).toContain('"close_trade_err_not_open"');
    }
  });

  /**
   * ⚠️ ET LA RÈGLE « LA CLÔTURE SUIT L'OUVERTURE » ÉTAIT DÉJÀ ICI, avec son
   * propre message, pendant que le formulaire de SAISIE l'ignorait. Une règle
   * écrite, appliquée à une porte sur deux : elle l'est maintenant aux deux.
   */
  it("refuse toujours une clôture antérieure à l'ouverture", () => {
    expect(src).toContain("close_trade_err_time_before_open");
  });
});
