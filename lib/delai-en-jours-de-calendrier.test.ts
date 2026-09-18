import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { joursEntreCles, localDateKey } from "./timezone";

/**
 * DEUX ANNONCES DU MÊME JOUR ANNONCENT LE MÊME DÉLAI.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ « DANS 1 J » ET « DANS 2 J » SOUS LE MÊME TITRE DE JOUR. Relevé le
 * 2026-09-16 à 23 h sur le calendrier économique, sous « VENDREDI 18
 * SEPTEMBRE » :
 *
 *   01:30  AUD  Discours de RBA Gov Bullock          dans 1 j
 *   04:30  JPY  BOJ · Décision de taux directeur     dans 1 j
 *   07:30  JPY  Conférence de presse banque centrale dans 1 j
 *   08:00  GBP  Ventes au détail · mensuel           dans 1 j
 *   12:30  EUR  Discours de ECB President Lagarde    dans 2 j
 *
 * ── LA CAUSE ────────────────────────────────────────────────────────────────
 *
 * La page divisait le temps ÉCOULÉ par vingt-quatre heures et arrondissait :
 * 26 h donnait 1, 37 h donnait 2. Les deux annonces tombent pourtant le même
 * jour, et le titre du jour est écrit juste au-dessus.
 *
 * ⚠️ LE DÉLAI DOIT CONFIRMER LE TITRE, PAS LE CONTREDIRE. Le lecteur compte en
 * jours du calendrier ; une tranche de vingt-quatre heures depuis « maintenant »
 * n'est pas une unité qu'il a sous les yeux.
 */
describe("le délai du calendrier économique se compte en jours calendaires", () => {
  it("deux moments du même jour donnent le même nombre de jours", () => {
    // Mercredi 23 h, heure de Paris.
    const maintenant = new Date("2026-09-16T21:00:00Z");
    const tz = "Europe/Paris";
    const aujourdhui = localDateKey(tz, maintenant);

    const tot = new Date("2026-09-17T23:30:00Z"); // vendredi 01:30 à Paris
    const tard = new Date("2026-09-18T10:30:00Z"); // vendredi 12:30 à Paris

    expect(localDateKey(tz, tot), "les deux doivent tomber le même jour local").toBe(
      localDateKey(tz, tard),
    );
    const a = joursEntreCles(aujourdhui, localDateKey(tz, tot));
    const b = joursEntreCles(aujourdhui, localDateKey(tz, tard));
    expect(a).toBe(b);
    expect(a, "mercredi → vendredi, ce sont deux jours").toBe(2);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    // L'ancien calcul : temps écoulé / 24 h, arrondi.
    const maintenant = new Date("2026-09-16T21:00:00Z").getTime();
    const ancien = (iso: string) =>
      Math.round((new Date(iso).getTime() - maintenant) / 60000 / (60 * 24));
    expect(ancien("2026-09-17T23:30:00Z")).toBe(1);
    expect(ancien("2026-09-18T10:30:00Z")).toBe(2);
    // Deux réponses pour un seul jour : c'est exactement ce qu'on a corrigé.
    expect(ancien("2026-09-17T23:30:00Z")).not.toBe(ancien("2026-09-18T10:30:00Z"));
  });

  it("demain vaut un jour, aujourd'hui zéro, et l'ordre est signé", () => {
    expect(joursEntreCles("2026-09-16", "2026-09-17")).toBe(1);
    expect(joursEntreCles("2026-09-16", "2026-09-16")).toBe(0);
    expect(joursEntreCles("2026-09-17", "2026-09-16")).toBe(-1);
  });

  /**
   * ⚠️ LE CHANGEMENT D'HEURE NE DOIT PAS FAIRE SAUTER UN JOUR : une journée
   * dure 23 ou 25 heures deux fois par an, et c'est précisément ce qu'une
   * division par vingt-quatre heures rate.
   */
  it("un jour de changement d'heure reste un jour", () => {
    // Nuit du 25 au 26 octobre 2026 en Europe : la journée dure 25 h.
    expect(joursEntreCles("2026-10-25", "2026-10-26")).toBe(1);
    // Nuit du 28 au 29 mars 2026 : elle dure 23 h.
    expect(joursEntreCles("2026-03-28", "2026-03-29")).toBe(1);
  });

  it("franchit les mois et les années", () => {
    expect(joursEntreCles("2026-09-30", "2026-10-01")).toBe(1);
    expect(joursEntreCles("2026-12-31", "2027-01-01")).toBe(1);
    expect(joursEntreCles("2026-02-28", "2026-03-01")).toBe(1); // 2026 n'est pas bissextile
  });

  /**
   * ⚠️ ET LA PAGE S'EN SERT VRAIMENT. Un calcul juste que l'écran n'appelle pas
   * ne corrige rien : c'est la moitié de défaut que ce dépôt collectionne.
   */
  /**
   * ⚠️ CE TEST VISAIT `joursEntreCles(` AVEC SA PARENTHÈSE, donc l'APPEL, donc
   * une mise en œuvre précise. Le jour où le calcul a rejoint le module partagé
   * du calendrier — la page le lui FOURNIT désormais (`joursEntre:
   * joursEntreCles`) au lieu de l'appeler — il est tombé sur du code correct.
   * C'est le quatrième garde de la journée à épingler la mise en œuvre plutôt
   * que l'intention. On vérifie maintenant que les DEUX surfaces fournissent
   * bien ce calcul, et que la division du temps écoulé n'est revenue nulle part.
   */
  it("les deux surfaces du calendrier comptent en jours calendaires", () => {
    for (const f of [
      "app/dashboard/calendar/page.tsx",
      "components/session/EconomicCalendarCard.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, `${f} ne compte plus en jours de calendrier`).toContain("joursEntreCles");
    }
    const partage = readFileSync(join(process.cwd(), "lib/economic-calendar.ts"), "utf8");
    expect(partage, "la division du temps écoulé est revenue").not.toMatch(
      /cal_in_days[^]{0,120}Math\.round\(mins/,
    );
  });
});
