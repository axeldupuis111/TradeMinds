import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE PANNE D'ENVOI RESSEMBLE À « PERSONNE À PRÉVENIR ».
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * Les trois crons d'e-mails (rappel quotidien, bilan hebdomadaire,
 * réactivation) attrapaient chaque échec dans un `try/catch` par utilisateur
 * qui ne faisait qu'un `console.error`. Si Resend tombe (clé révoquée, quota
 * atteint, domaine suspendu), la boucle échoue pour TOUT LE MONDE, le cron
 * répond 200 avec « sent: 0 »… ce qui est exactement ce qu'il répond quand il
 * n'avait personne à prévenir ce jour-là. Les deux sont indiscernables, et les
 * logs Vercel ne sont gardés que quatorze jours.
 *
 * ⚠️ C'est la forme du silence que ce dépôt a déjà payé avec le cron macro,
 * tombé plusieurs jours sans que rien ne le dise. `lib/cron-alert` a été écrit
 * pour ça, et ces trois crons l'utilisaient déjà pour leurs LECTURES, pas pour
 * leurs envois : la règle était appliquée à une moitié du fichier.
 *
 * ── LE SEUIL ────────────────────────────────────────────────────────────────
 *
 * ⚠️ ON N'ALERTE QUE SI AUCUN ENVOI N'EST PASSÉ. Un échec isolé est normal
 * (adresse morte, boîte pleine) et alerter dessus apprendrait à ignorer
 * l'alerte, ce qui coûterait plus cher que le défaut. Zéro réussite sur N
 * tentatives ne s'explique, lui, que par une panne. Le compte d'échecs remonte
 * de toute façon dans la réponse du cron.
 */
describe("les crons d'e-mails", () => {
  const CRONS = [
    { fichier: "app/api/send-reminders/route.ts", nom: "send-reminders" },
    { fichier: "app/api/weekly-report/route.ts", nom: "weekly-report" },
    { fichier: "app/api/reactivation/route.ts", nom: "reactivation" },
  ] as const;

  for (const { fichier, nom } of CRONS) {
    const src = sansCommentaires(readFileSync(join(process.cwd(), fichier), "utf8"));

    it(`${nom} compte ses échecs d'envoi`, () => {
      expect(
        src,
        "les échecs d'envoi ne sont plus comptés : une panne Resend repassera " +
          "pour « aucun destinataire »",
      ).toContain("echecs++");
    });

    it(`${nom} alerte quand aucun envoi n'est passé`, () => {
      expect(
        src,
        "le cron ne crie plus quand tous ses envois échouent",
      ).toMatch(/alertEnvoisEchoues\(/);
    });

    it(`${nom} remonte le compte d'échecs dans sa réponse`, () => {
      /**
       * ⚠️ Sous le seuil d'alerte, le chiffre doit rester LISIBLE quelque part :
       * c'est la seule trace d'une dégradation progressive (un domaine qui
       * commence à être filtré ne casse pas d'un coup).
       */
      expect(
        src,
        "la réponse du cron ne dit plus combien d'envois ont échoué",
      ).toMatch(/\{\s*[^}]*\bechecs\b[^}]*\}/);
    });
  }
});

/**
 * ⚠️⚠️ CE BLOC A ÉTÉ RÉÉCRIT PARCE QUE SA PREMIÈRE VERSION ÉTAIT INTERMITTENTE,
 * ET QUE C'EST PIRE QU'UN TEST ROUGE.
 *
 * Elle appelait `alertEnvoisEchoues` pour de vrai et se contentait de vérifier
 * qu'aucun appel ne LEVAIT. Deux défauts :
 *
 *   - elle ne vérifiait pas la règle. « Ça ne plante pas » est vrai que la
 *     fonction alerte, se taise, ou ne fasse rien du tout ;
 *   - elle dépendait de l'AMBIANCE. `sendAdminAlert` ne s'abstient que faute de
 *     `RESEND_API_KEY` et de destinataire. Vitest partage `process.env` entre
 *     les fichiers d'un même worker : le jour où l'un d'eux pose ces variables,
 *     ce test part sur le RÉSEAU, devient lent, et peut envoyer un vrai e-mail
 *     depuis la suite de tests.
 *
 * Elle est passée en isolation et a échoué une fois dans la suite complète, ce
 * qui est exactement la signature de ce genre de dépendance.
 *
 * Ici, l'envoi est doublé : le réseau est hors d'atteinte par construction, et
 * on vérifie CE QUI EST DÉCIDÉ, pas seulement que rien n'explose.
 */
const envois: { subject: string }[] = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: (o: { subject: string }) => {
        envois.push({ subject: o.subject });
        return Promise.resolve({ error: null });
      },
    };
  },
}));

describe("le seuil d'alerte des envois", () => {
  const AVANT = { cle: process.env.RESEND_API_KEY, dest: process.env.ADMIN_ALERT_EMAIL };

  beforeEach(() => {
    envois.length = 0;
    // ⚠️ Posées ICI et retirées après : les laisser fuiterait dans les autres
    // fichiers du même worker, c'est-à-dire le défaut qu'on vient de corriger.
    process.env.RESEND_API_KEY = "cle-de-test";
    process.env.ADMIN_ALERT_EMAIL = "destinataire@test.invalid";
  });

  afterEach(() => {
    if (AVANT.cle === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = AVANT.cle;
    if (AVANT.dest === undefined) delete process.env.ADMIN_ALERT_EMAIL;
    else process.env.ADMIN_ALERT_EMAIL = AVANT.dest;
  });

  it("se tait quand aucun envoi n'a échoué", async () => {
    const { alertEnvoisEchoues } = await import("./cron-alert");
    await alertEnvoisEchoues("test", 0, 10);
    expect(envois).toEqual([]);
  });

  it("se tait sur un échec isolé, qui est normal", async () => {
    /**
     * ⚠️ Une adresse morte ou une boîte pleine arrive. Alerter dessus
     * apprendrait à ignorer l'alerte, ce qui coûte plus cher que le défaut
     * qu'elle signale.
     */
    const { alertEnvoisEchoues } = await import("./cron-alert");
    await alertEnvoisEchoues("test", 1, 10);
    await alertEnvoisEchoues("test", 9, 10);
    expect(envois).toEqual([]);
  });

  it("crie quand AUCUN envoi n'est passé", async () => {
    const { alertEnvoisEchoues } = await import("./cron-alert");
    await alertEnvoisEchoues("send-reminders", 10, 10);
    expect(envois.length, "zéro réussite sur dix tentatives n'a pas alerté").toBe(1);
    expect(envois[0].subject).toContain("send-reminders");
  });

  it("ne touche jamais au réseau, même sans clé configurée", async () => {
    // Le cas réel des tests : rien n'est configuré, donc rien ne part.
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_ALERT_EMAIL;
    const { alertEnvoisEchoues } = await import("./cron-alert");
    await alertEnvoisEchoues("test", 10, 10);
    expect(envois).toEqual([]);
  });

  it("le seuil est écrit comme « tous les envois », pas comme un nombre choisi", () => {
    /**
     * ⚠️⚠️ UN SEUIL ARBITRAIRE EST SA PROPRE DETTE. « alerter au-delà de 5
     * échecs » ou « au-delà de 50 % » demande de justifier 5 et 50, et se
     * retrouve faux dès que la base d'utilisateurs change d'ordre de grandeur.
     * « aucun envoi n'est passé » ne dépend d'aucune taille.
     */
    const src = sansCommentaires(
      readFileSync(join(process.cwd(), "lib/cron-alert.ts"), "utf8"),
    );
    const corps = src.slice(src.indexOf("export async function alertEnvoisEchoues"));
    expect(corps.slice(0, 400), "un seuil chiffré est apparu").not.toMatch(
      /[><]=?\s*(?:0\.\d+|[2-9]\d*)/,
    );
  });
});
