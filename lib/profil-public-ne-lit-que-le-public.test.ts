import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LE PROFIL PUBLIC EXPOSAIT LE JETON DE SYNCHRONISATION.
 *
 * ── CE QUI ÉTAIT LISIBLE PAR N'IMPORTE QUI ──────────────────────────────────
 *
 * La clé `anon` est publiée dans le bundle de chaque page : tout le monde l'a.
 * La politique RLS de `profiles` laisse lire les lignes `public_profile = true`,
 * ce dont la page /profile/[username] a besoin. Mais RLS filtre les LIGNES,
 * jamais les COLONNES : ces lignes étaient lisibles EN ENTIER.
 *
 * Mesuré le 2026-09-15 sur la production, sans aucun compte : 4 profils,
 * 31 colonnes, dont `email`, `stripe_customer_id`, `coach_memory` et surtout
 * `mt_sync_token`.
 *
 * ⚠️⚠️ `mt_sync_token` N'EST PAS UNE DONNÉE, C'EST UNE CLÉ D'ÉCRITURE.
 * `/api/sync/push` et `/api/sync/tradingview` n'authentifient QUE par elle :
 * son porteur peut écrire des trades dans le journal de ces comptes et y
 * pousser des soldes, donc fausser le gardien de challenge.
 *
 * La correction vit dans `migrations/20260915_anon_column_grants.sql` :
 * PostgreSQL sait restreindre par COLONNE, ce que RLS ne sait pas faire.
 *
 * ── CE QUE CE FICHIER TIENT ─────────────────────────────────────────────────
 *
 * ⚠️ Une migration de privilèges et le code qui lit la base sont DEUX MOITIÉS
 * d'une même règle. Le jour où quelqu'un ajoute une colonne au `select` de la
 * page publique, deux choses peuvent arriver, et les deux sont silencieuses :
 * soit la page casse en production pour les visiteurs anonymes seulement, soit
 * on ré-accorde la colonne sans y penser. Ce test fait échouer la première.
 */
describe("la page de profil public", () => {
  const page = sansCommentaires(
    readFileSync(join(process.cwd(), "app/profile/[username]/page.tsx"), "utf8"),
  );
  const migration = readFileSync(
    join(process.cwd(), "migrations/20260915_anon_column_grants.sql"),
    "utf8",
  );

  /** Les colonnes accordées à `anon` pour une table, d'après la migration. */
  function accordees(table: string): Set<string> {
    const motif = new RegExp(
      "GRANT SELECT \\(([^)]*)\\) ON public\\." + table + " TO anon",
      "i",
    );
    const m = motif.exec(migration);
    expect(m, `la migration n'accorde plus rien sur ${table}`).not.toBeNull();
    return new Set(
      (m as RegExpExecArray)[1]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    );
  }

  /** Les colonnes que la page demande sur une table. */
  function demandees(table: string): Set<string> {
    const out = new Set<string>();
    const MOTIF = new RegExp('from\\("' + table + '"\\)([\\s\\S]{0,400}?)(?=from\\(|$)', "g");
    let bloc: RegExpExecArray | null;
    while ((bloc = MOTIF.exec(page)) !== null) {
      const texte = bloc[1];
      // ⚠️ `for…of matchAll` n'est pas permis par la cible TypeScript du dépôt.
      const SELECT = /\.select\(\s*"([^"]*)"/g;
      let s: RegExpExecArray | null;
      while ((s = SELECT.exec(texte)) !== null) {
        for (const c of s[1].split(",")) {
          const nom = c.trim();
          if (nom && nom !== "*") out.add(nom);
        }
      }
      // Colonnes utilisées comme FILTRE ou comme TRI : PostgREST exige aussi
      // le droit de lecture dessus.
      const FILTRE = /\.(?:eq|neq|gt|gte|lt|lte|in|not|ilike|order)\(\s*"([a-z_]+)"/g;
      let fm: RegExpExecArray | null;
      while ((fm = FILTRE.exec(texte)) !== null) out.add(fm[1]);
    }
    return out;
  }

  it("le garde lit bien quelque chose des deux côtés", () => {
    // ⚠️ Garde-fou du garde-fou : un motif qui ne trouve rien rendrait la
    // comparaison vide, donc verte, et ne protégerait plus personne.
    expect(accordees("profiles").size, "aucune colonne accordée trouvée").toBeGreaterThan(3);
    expect(demandees("profiles").size, "aucune colonne demandée trouvée").toBeGreaterThan(2);
    expect(demandees("trades").size, "aucune colonne de trades trouvée").toBeGreaterThan(3);
  });

  for (const table of ["profiles", "trades", "session_reviews"]) {
    it(`ne demande sur ${table} que des colonnes accordées à un visiteur anonyme`, () => {
      const permises = accordees(table);
      const manquantes = Array.from(demandees(table)).filter((c) => !permises.has(c));
      expect(
        manquantes,
        `la page publique lit des colonnes que la migration n'accorde pas à « anon » : ` +
          `${manquantes.join(", ")}. Soit la page casse pour les visiteurs non connectés, ` +
          `soit quelqu'un s'apprête à ré-exposer une colonne. Les deux se décident, ` +
          `pas par accident.`,
      ).toEqual([]);
    });
  }

  it("la migration n'accorde aucune colonne sensible", () => {
    /**
     * ⚠️ L'autre sens : que personne ne « répare » un jour un select cassé en
     * ré-accordant la colonne. `mt_sync_token` en tête, parce que c'est une
     * clé d'écriture et non une donnée.
     */
    const SENSIBLES = ["mt_sync_token", "email", "stripe_customer_id", "coach_memory", "notes"];
    for (const table of ["profiles", "trades", "session_reviews"]) {
      const permises = accordees(table);
      const fuites = SENSIBLES.filter((c) => permises.has(c));
      expect(fuites, `${table} accorde des colonnes sensibles à anon : ${fuites.join(", ")}`).toEqual([]);
    }
  });

  it("garde le filtre anti-démonstration lisible", () => {
    /**
     * ⚠️⚠️ SUBTIL, ET COÛTEUX. La page retombe sur une lecture SANS le filtre
     * quand l'erreur mentionne « is_demo » (repli prévu pour une base non
     * migrée). Un refus de PERMISSION porterait ce mot dans son message : les
     * trades de démonstration entreraient alors dans les chiffres montrés à
     * des inconnus, ce que la page interdit par ailleurs.
     */
    expect(
      accordees("trades").has("is_demo"),
      "is_demo n'est plus accordée : un refus de permission déclenchera le repli " +
        "de la page, qui relit SANS le filtre, et les trades de démo entreront " +
        "dans les statistiques publiques",
    ).toBe(true);
  });
});
