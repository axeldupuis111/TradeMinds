import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { destinataires } from "./audience-des-notifications";

/**
 * UN CANAL DE NOTIFICATION N'EST JAMAIS COMMANDÉ PAR LA PRÉFÉRENCE D'UN AUTRE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PUSH HEBDOMADAIRE PARTAIT DE LA LISTE DES ABONNÉS AUX E-MAILS. La
 * route du rapport hebdo lisait `profiles.email_notif_session = true` et
 * envoyait la notification dans la même boucle : refuser l'e-mail faisait
 * perdre le push, que le trader n'avait jamais refusé, et personne ne pouvait
 * choisir le push seul.
 *
 * ⚠️ MESURE DU 2026-09-17, EN PRODUCTION : CINQUANTE traders sur cinquante-deux
 * ont `email_notif_session = false` et `push_notif_weekly = true`. Le réglage
 * affiché activé dans leurs paramètres ne pouvait rien déclencher.
 *
 * ⚠️ LES TROIS AUTRES CRONS À PUSH PARTAIENT DÉJÀ DE `push_subscriptions`, et
 * l'un d'eux l'écrit noir sur blanc : « Indépendant des emails ».
 */

const RACINE = process.cwd();

const PROFILS = [
  { id: "a", email: "a@x.fr", preferencePush: true },
  { id: "b", email: "b@x.fr", preferencePush: true },
  { id: "c", email: "c@x.fr", preferencePush: false },
  { id: "d", email: null as string | null, preferencePush: undefined as boolean | undefined },
];

describe("le partage des publics", () => {
  it("donne le push à qui a refusé l'e-mail", () => {
    const [a] = destinataires([PROFILS[0]], [], ["a"]);
    expect(a.veutEmail).toBe(false);
    expect(
      a.veutPush,
      "le trader perd sa notification parce qu'il a refusé un AUTRE canal",
    ).toBe(true);
  });

  it("donne l'e-mail à qui n'a pas d'abonnement push", () => {
    const [b] = destinataires([PROFILS[1]], ["b"], []);
    expect(b.veutEmail).toBe(true);
    expect(b.veutPush).toBe(false);
  });

  it("respecte le refus explicite du push", () => {
    const [c] = destinataires([PROFILS[2]], ["c"], ["c"]);
    expect(c.veutEmail).toBe(true);
    expect(c.veutPush, "un refus explicite du push est ignoré").toBe(false);
  });

  /** ⚠️ Colonne absente (migration non appliquée) : on notifie, on ne prive pas. */
  it("traite une préférence absente comme un oui", () => {
    const [d] = destinataires([PROFILS[3]], [], ["d"]);
    expect(d.veutPush).toBe(true);
  });

  it("n'envoie pas d'e-mail sans adresse", () => {
    const [d] = destinataires([PROFILS[3]], ["d"], []);
    expect(d.veutEmail).toBe(false);
  });
});

describe("les crons qui notifient", () => {
  function routes(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      const c = join(d, f);
      if (statSync(c).isDirectory()) routes(c, out);
      else if (f === "route.ts") out.push(c);
    }
    return out;
  }

  /**
   * ⚠️ LA PREUVE EST DANS LA SOURCE DU PUBLIC. Une route qui envoie des
   * notifications et ne lit jamais `push_subscriptions` tire forcément sa liste
   * d'ailleurs, et « ailleurs » a déjà voulu dire « la préférence d'e-mail ».
   */
  it("tirent leur public des abonnements push", () => {
    const fautes: string[] = [];
    for (const chemin of routes(join(RACINE, "app/api"))) {
      const src = readFileSync(chemin, "utf8");
      if (!/sendPushToUser\(/.test(src)) continue;
      const nom = chemin.slice(RACINE.length + 1).replace(/\\/g, "/");
      // La route d'abonnement elle-même notifie celui qui vient de s'abonner.
      if (nom.includes("api/push/subscribe")) continue;
      if (!/from\("push_subscriptions"\)/.test(src)) {
        fautes.push(`${nom} : envoie des notifications sans lire push_subscriptions`);
      }
    }
    expect(
      fautes,
      "routes dont le public push vient d'ailleurs que des abonnements :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  it("trouve bien des routes qui notifient", () => {
    const n = routes(join(RACINE, "app/api")).filter((c) => /sendPushToUser\(/.test(readFileSync(c, "utf8"))).length;
    expect(n, "plus aucune route ne notifie : le balayage est cassé").toBeGreaterThanOrEqual(4);
  });
});
