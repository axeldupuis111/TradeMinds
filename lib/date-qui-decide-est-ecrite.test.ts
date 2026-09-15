import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE DATE QUI DÉCIDE D'UN ACCÈS EST ÉCRITE QUELQUE PART.
 *
 * ── LE DÉFAUT, MESURÉ EN BASE ───────────────────────────────────────────────
 *
 * ⚠️⚠️ `profiles.plan_expires_at` ÉTAIT LU PAR TROIS PORTIERS ET ÉCRIT PAR
 * PERSONNE. Relevé le 2026-09-16 :
 *
 *   - `lib/PlanContext.tsx` rétrograde en `free` si la date est passée ;
 *   - `lib/api-auth.ts` fait de même pour chaque route d'API ;
 *   - `/api/leaderboard` refuse le classement à un plan expiré ;
 *   - et la colonne valait `null` pour les 51 comptes de la base, parce
 *     qu'aucune ligne de code ne l'écrivait jamais.
 *
 * Le filet de sécurité existait à la lecture et pas à l'écriture. Trois
 * relectures du code auraient conclu « l'expiration est gérée » ; la base
 * disait le contraire.
 *
 * ⚠️ CE QU'IL RATTRAPE : Stripe réessaie un webhook trois jours puis abandonne.
 * Si `customer.subscription.deleted` se perd, le compte garde un plan payant
 * POUR TOUJOURS, et le code s'en méfiait déjà noir sur blanc : « la résiliation
 * n'atterrit pas et le compte garde un plan payant ».
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute colonne comparée à `new Date()` pour décider d'un droit est écrite par
 * au moins un `.update()` / `.upsert()` du dépôt. Une colonne lue et jamais
 * écrite n'est pas une sécurité : c'est une sécurité imaginaire, ce qui est
 * strictement pire, parce qu'elle dispense d'en écrire une vraie.
 */
describe("une date qui décide d'un accès est écrite quelque part", () => {
  const RACINE = process.cwd();

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const c = join(d, f);
      if (statSync(c).isDirectory()) fichiers(c, out);
      else if (/\.tsx?$/.test(c) && !c.includes(".test.")) out.push(c);
    }
    return out;
  }

  const tous = () => [
    ...fichiers(join(RACINE, "app")),
    ...fichiers(join(RACINE, "components")),
    ...fichiers(join(RACINE, "lib")),
  ];

  /**
   * « la valeur X est-elle dépassée ? », sous ses deux formes courantes.
   * On capture le DERNIER identifiant de l'expression : `profile.plan_expires_at`
   * donne `plan_expires_at`, qui est le nom de la colonne.
   */
  const COMPARAISON = /new Date\(([^()]{1,80}?)\)\s*<\s*new Date\(\)/g;

  function colonnesLues(): Map<string, string[]> {
    const trouvees = new Map<string, string[]>();
    for (const chemin of tous()) {
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      const src = readFileSync(chemin, "utf8");
      for (const m of Array.from(src.matchAll(COMPARAISON))) {
        const dernier = Array.from(m[1].matchAll(/[a-z][a-z0-9_]{3,}/g)).pop();
        if (!dernier) continue;
        const col = dernier[0];
        // Une variable locale n'est pas une colonne : on ne retient que les
        // noms en serpent, qui sont la convention des colonnes de cette base.
        if (!col.includes("_")) continue;
        const liste = trouvees.get(col) ?? [];
        if (!liste.includes(nom)) liste.push(nom);
        trouvees.set(col, liste);
      }
    }
    return trouvees;
  }

  it("reconnaît la lecture quand on la lui montre", () => {
    const exemple = "if (profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {";
    const m = Array.from(exemple.matchAll(COMPARAISON));
    expect(m.length, "la comparaison de garde n'est plus reconnue").toBe(1);
    expect(Array.from(m[0][1].matchAll(/[a-z][a-z0-9_]{3,}/g)).pop()![0]).toBe("plan_expires_at");
  });

  it("trouve bien des dates de garde, sinon ce test ne prouve rien", () => {
    const lues = colonnesLues();
    expect(lues.size, "plus aucune date ne décide d'un accès : le balayage est cassé").toBeGreaterThan(0);
    expect(Array.from(lues.keys()), "la colonne connue n'est plus vue").toContain("plan_expires_at");
  });

  it("chaque date de garde est écrite quelque part", () => {
    const ecritures = tous()
      .map((c) => readFileSync(c, "utf8"))
      .join("\n");
    const orphelines: string[] = [];
    for (const [col, ou] of Array.from(colonnesLues())) {
      // Une écriture, c'est la colonne posée dans un objet passé à Supabase.
      const ecrite = new RegExp(`${col}\\s*:`).test(ecritures.replace(/\.select\([^)]*\)/g, ""));
      if (!ecrite) orphelines.push(`${col} (lue par ${ou.join(", ")})`);
    }
    expect(
      orphelines,
      "colonnes lues comme des dates d'expiration et jamais écrites — " +
        "soit on les écrit, soit on retire les lectures qui font croire à une sécurité :\n  " +
        orphelines.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LE CAS NOMMÉ, parce que le balayage ci-dessus se contenterait d'un
   * `plan_expires_at:` posé n'importe où. Les endroits comptent :
   *
   *   - le webhook la POSE quand le client demande l'arrêt, et la REMET à `null`
   *     sinon (reprise d'abonnement) ;
   *   - la résiliation encaissée et le remboursement la remettent à `null` en
   *     même temps qu'ils rétrogradent ;
   *   - l'octroi manuel la remet à `null`, sinon un cadeau expirerait à la date
   *     d'une résiliation Stripe qu'il vient justement de remplacer.
   */
  it("le webhook ne la pose que sur une résiliation demandée", () => {
    const src = readFileSync(join(RACINE, "app/api/stripe/webhook/route.ts"), "utf8");
    expect(src, "la date ne vient plus de la résiliation demandée").toContain(
      "const finDAcces = isCancelingAtPeriodEnd ? subscriptionData.current_period_end : null",
    );
    expect(src, "elle n'est pas écrite sur le profil").toContain(
      ".update({ plan_expires_at: finDAcces })",
    );
    /**
     * ⚠️ POSER `current_period_end` SANS CONDITION SERAIT UNE BOMBE : le jour où
     * un webhook de RENOUVELLEMENT se perdrait, on couperait l'accès d'un client
     * qui paie. Le garde interdit donc explicitement cette forme.
     */
    expect(
      /plan_expires_at:\s*subscriptionData\.current_period_end/.test(src),
      "la date de fin est posée sur une période ordinaire : un renouvellement perdu couperait un client qui paie",
    ).toBe(false);

    expect(src, "la résiliation encaissée ne nettoie pas la date").toContain(
      "{ plan: 'free', plan_expires_at: null }",
    );
    expect(
      (src.match(/plan: 'free', plan_expires_at: null/g) ?? []).length,
      "un des deux retraits d'accès (résiliation, remboursement) ne nettoie plus la date",
    ).toBeGreaterThanOrEqual(2);
  });

  it("l'octroi manuel d'un plan efface la date de fin", () => {
    const src = readFileSync(join(RACINE, "app/api/admin/update-plan/route.ts"), "utf8");
    expect(src, "un plan donné à la main peut encore expirer tout seul").toContain(
      "plan_expires_at: null",
    );
  });
});
