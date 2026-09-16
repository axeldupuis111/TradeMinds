import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE CORRECTION NE PEUT PAS DÉPENDRE DE LA VISITE DE CELUI QU'ELLE DOIT RAMENER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA CORRECTION DES SÉANCES FANTÔMES NE POUVAIT PAS ATTEINDRE CEUX QU'ELLE
 * VISAIT. Une séance restée `active` éteint le bandeau « n'oublie pas de
 * préparer ta séance », c'est-à-dire la seule invitation du produit à faire ce
 * qu'il vend. Le ménage posé le 2026-09-16 tournait au CHARGEMENT d'une page du
 * tableau de bord : il ne s'exécutait donc que pour les comptes qui reviennent,
 * alors que le tort de la séance fantôme est justement d'empêcher le retour.
 *
 * ⚠️ REMESURÉ LE 2026-09-17, UN JOUR APRÈS : six séances encore actives,
 * ouvertes depuis 7, 13, 46, 47, 52 et 98 jours. Le défaut se maintenait tout
 * seul, exactement comme décrit dans `lib/sessions-oubliees.ts`, et la
 * correction héritait de la même boucle.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le ménage tourne AUSSI côté serveur, pour tout le monde, tous les jours.
 */
describe("le ménage des séances oubliées", () => {
  const RACINE = process.cwd();
  const cron = () => readFileSync(join(RACINE, "app/api/send-reminders/route.ts"), "utf8");

  it("tourne dans un cron, et pas seulement au chargement d'une page", () => {
    const src = cron();
    expect(src, "le cron ne referme plus les séances oubliées").toContain(
      "fermerLesSeancesOubliees(supabase, user.id as string,",
    );
  });

  /**
   * ⚠️⚠️ POUR TOUT LE MONDE. La lecture filtrait sur `email_notif_session` :
   * un trader qui a coupé le rappel gardait sa séance fantôme, donc gardait son
   * bandeau éteint. Le ménage ne connaît pas d'opt-out, seul l'ENVOI en a un.
   */
  it("ne saute pas ceux qui ont coupé l'e-mail", () => {
    const src = cron();
    const i = src.indexOf('.from("profiles")');
    expect(i, "la lecture des profils a changé de forme").toBeGreaterThan(0);
    // Frontière : la fin de l'appel `fetchAllRows(...)`, parenthèses comptées.
    const debut = src.lastIndexOf("fetchAllRows", i);
    let prof = 0;
    let fin = debut;
    for (let j = src.indexOf("(", debut); j < src.length; j++) {
      if (src[j] === "(") prof++;
      else if (src[j] === ")") {
        prof--;
        if (prof === 0) {
          fin = j;
          break;
        }
      }
    }
    const lecture = src.slice(debut, fin);
    expect(
      lecture,
      "la lecture exclut encore les comptes qui ont coupé le rappel : leur " +
        "séance fantôme ne sera jamais refermée",
    ).not.toContain('.eq("email_notif_session", true)');

    // Et le filtre existe toujours, déplacé dans la boucle d'envoi.
    expect(
      src,
      "le filtre d'envoi a disparu : le rappel partirait à des gens qui l'ont coupé",
    ).toContain('if (user.email_notif_session !== true) continue;');
  });

  /**
   * ⚠️ TOUS LES JOURS, pas seulement en semaine. `isReminderDue` exclut le
   * week-end parce qu'un e-mail du samedi n'a pas de sens ; une séance ouverte
   * le vendredi, elle, ne doit pas traîner jusqu'au lundi.
   */
  it("ne dépend pas de la règle des jours ouvrés", () => {
    const src = cron();
    const i = src.indexOf("let nettoyees = 0;");
    expect(i, "la boucle de ménage a changé de nom").toBeGreaterThan(0);
    const boucle = src.slice(i, src.indexOf("}", src.indexOf("nettoyees++")));
    expect(boucle, "le ménage passe par la règle des jours ouvrés").not.toContain("isReminderDue");
    expect(boucle).toContain("localHour(tz) !== REMINDER_HOUR");
  });

  /** ⚠️ Et le ménage client reste là : les deux se complètent, aucun ne suffit. */
  it("le ménage au chargement n'a pas été retiré", () => {
    const layout = readFileSync(join(RACINE, "app/dashboard/layout.tsx"), "utf8");
    expect(layout).toContain("fermerLesSeancesOubliees(");
  });
});
