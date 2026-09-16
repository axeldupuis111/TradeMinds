import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  entetesDeDesinscription,
  jetonDeDesinscription,
  lienDeDesinscription,
  utilisateurDuJeton,
} from "@/lib/desinscription";

/**
 * SE DÉSINSCRIRE DOIT ÊTRE UN LIEN, PAS UNE CONSIGNE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ AUCUN DES TROIS ENVOIS RÉCURRENTS NE PORTAIT D'EN-TÊTE DE DÉSINSCRIPTION.
 * Relevé le 2026-09-16 en RENDANT les e-mails plutôt qu'en lisant leur code :
 * rappel quotidien, rapport hebdomadaire et message de reprise partaient tous
 * les trois sans `List-Unsubscribe`, et leur pied de page se contentait de
 * « tu peux désactiver ce rappel dans Réglages → Notifications ». C'est une
 * instruction, et elle suppose que le lecteur se reconnecte.
 *
 * ⚠️ DEPUIS FÉVRIER 2024, Gmail et Yahoo attendent des expéditeurs en nombre
 * `List-Unsubscribe` ET `List-Unsubscribe-Post`. Sans eux, le seul geste qui
 * reste au lecteur agacé est « signaler comme spam ». Et ça compte ici en
 * particulier : le domaine vient de passer en `DMARC p=quarantine`, où une
 * réputation dégradée ne relègue plus les messages en « promotions », elle les
 * fait disparaître.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * 1. Tout envoi RÉCURRENT porte les deux en-têtes.
 * 2. Le pied de page porte le lien, dans la langue du lecteur.
 * 3. Le GET n'écrit rien (les antivirus de messagerie visitent les URL).
 * 4. Le jeton ne se forge pas.
 */

const RACINE = process.cwd();
const RECURRENTS = [
  "app/api/send-reminders/route.ts",
  "app/api/weekly-report/route.ts",
  "app/api/reactivation/route.ts",
];

function lire(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8");
}

/**
 * Le corps d'une fonction, délimité par ses ACCOLADES et non par un nombre de
 * caractères.
 *
 * ⚠️ Une fenêtre en caractères n'est jamais une frontière : trois gardes de ce
 * dépôt ont déjà menti pour cette raison, en voyant la protection du voisin.
 */
function corpsDeFonction(src: string, entete: string): string {
  const i = src.indexOf(entete);
  if (i === -1) return "";
  const ouvre = src.indexOf("{", i);
  let niveau = 0;
  for (let j = ouvre; j < src.length; j++) {
    if (src[j] === "{") niveau++;
    else if (src[j] === "}") {
      niveau--;
      if (niveau === 0) return src.slice(ouvre, j + 1);
    }
  }
  return src.slice(ouvre);
}

describe("la désinscription des e-mails récurrents", () => {
  // ── 1. Les en-têtes partent avec chaque envoi récurrent ───────────────────

  it("trouve bien trois envois récurrents, sinon ce test ne prouve rien", () => {
    for (const chemin of RECURRENTS) {
      expect(lire(chemin), `${chemin} n'envoie plus rien`).toContain("emails.send(");
    }
  });

  it("chaque envoi récurrent porte les en-têtes de désinscription", () => {
    const fautes: string[] = [];
    for (const chemin of RECURRENTS) {
      const bloc = corpsDeFonction(lire(chemin), "emails.send(");
      if (!bloc.includes("headers: entetesDeDesinscription(")) fautes.push(chemin);
    }
    expect(
      fautes,
      "envois sans List-Unsubscribe : le seul geste qui reste au lecteur est " +
        "« signaler comme spam » :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    // ⚠️ Preuve par mutation : le test ci-dessus doit ÉCHOUER sur l'ancien code.
    const avant = `{
        from: FROM,
        to: user.email,
        subject: copy.subject,
        html: buildEmailHtml(copy, lang),
      }`;
    expect(avant.includes("headers: entetesDeDesinscription(")).toBe(false);
    const apres = avant.replace("      }", "        headers: entetesDeDesinscription(id),\n      }");
    expect(apres.includes("headers: entetesDeDesinscription(")).toBe(true);
  });

  it("chaque pied de page porte le lien, dans la langue du lecteur", () => {
    const fautes: string[] = [];
    for (const chemin of RECURRENTS) {
      const src = lire(chemin);
      if (!src.includes("...ligneDeDesinscription(userId, lang)")) fautes.push(`${chemin} : pied de page`);
      if (!src.includes("lienDeDesinscription(userId, lang)")) fautes.push(`${chemin} : langue du lien`);
      // Quatre libellés distincts, sinon « traduit » veut dire recopié.
      const libelles = Array.from(
        src.matchAll(/^\s+(?:fr|en|de|es):\s*"([^"]{8,})",\s*$/gm),
      ).map((m) => m[1]);
      const uniques = new Set(libelles);
      if (uniques.size < 4) fautes.push(`${chemin} : moins de quatre libellés distincts`);
    }
    expect(fautes, fautes.join("\n  ")).toEqual([]);
  });

  // ── 2. Le GET n'écrit pas ─────────────────────────────────────────────────

  /**
   * ⚠️⚠️ CELUI-CI EST LE PLUS IMPORTANT. Les antivirus de messagerie et les
   * aperçus de lien VISITENT les URL d'un e-mail avant que le lecteur ne
   * clique. Un GET destructeur désinscrirait des gens qui n'ont rien demandé,
   * et la panne serait muette : ils cesseraient simplement de recevoir.
   */
  it("le GET de /api/unsubscribe n'écrit rien", () => {
    const src = lire("app/api/unsubscribe/route.ts");
    const get = corpsDeFonction(src, "export async function GET(");
    expect(get.length, "corps du GET introuvable : le garde est cassé").toBeGreaterThan(100);
    for (const ecriture of [".update(", ".delete(", ".insert(", ".upsert(", ".rpc("]) {
      expect(get, `le GET appelle ${ecriture} : un scanner d'e-mails désinscrira des lecteurs qui n'ont rien demandé`).not.toContain(ecriture);
    }
    // Et le POST, lui, écrit VRAIMENT : sans ça le lien ne ferait rien du tout.
    const post = corpsDeFonction(src, "export async function POST(");
    expect(post).toContain('.update({ email_notif_session: false })');
    expect(post, "l'écriture n'est pas vérifiée : elle mentirait en silence").toContain(
      "const { error } = await client()",
    );
  });

  it("la colonne coupée est bien celle que les trois envois interrogent", () => {
    // Sinon la page promet d'arrêter des e-mails qui continueront d'arriver.
    for (const chemin of RECURRENTS) {
      expect(lire(chemin), `${chemin} ne filtre pas sur email_notif_session`).toContain(
        '.eq("email_notif_session", true)',
      );
    }
  });

  /**
   * ⚠️⚠️ LE LIEN DOIT ATTEINDRE SA ROUTE. `estPrivee` du middleware répond
   * « privée » pour TOUT ce qui commence par `/api` : sans exception déclarée,
   * le lien renvoie vers `/login` et la route n'est jamais exécutée. Et le POST
   * « un clic » de Gmail suit la redirection, reçoit 200, et le fournisseur
   * croit la demande honorée pendant que les e-mails continuent de partir.
   * Trouvé avant déploiement, en relisant le middleware plutôt que la route.
   */
  it("le middleware laisse passer la désinscription sans session", () => {
    const src = lire("middleware.ts");
    expect(src, "estPrivee ne considère plus tout /api comme privé : ce test doit être revu").toMatch(
      /function estPrivee[\s\S]{0,200}startsWith\("\/api"\)/,
    );
    const liste = corpsDeFonction(src, "function isPublicPath(");
    expect(liste, "/api/unsubscribe n'est pas déclaré public : le lien mène à /login").toContain(
      'p.startsWith("/api/unsubscribe")',
    );
  });

  it("la page de confirmation parle quatre langues et se replie sur l'anglais", () => {
    const src = lire("app/api/unsubscribe/route.ts");
    for (const langue of ["fr", "en", "de", "es"]) {
      expect(src, `page manquante en ${langue}`).toMatch(new RegExp(`^  ${langue}: \\{`, "m"));
    }
    // ⚠️ Le repli est l'anglais : dix-sept des vingt et un inscrits le sont.
    expect(src).toMatch(/l === "en" \? l : "en"/);
  });

  // ── 3. Le jeton ───────────────────────────────────────────────────────────

  const ORIGINE = { ...process.env };
  beforeEach(() => {
    process.env.UNSUBSCRIBE_SECRET = "un-secret-de-test-assez-long-pour-passer";
  });
  afterEach(() => {
    process.env = { ...ORIGINE };
  });

  it("un jeton valide désigne son porteur, et lui seul", () => {
    const jeton = jetonDeDesinscription("utilisateur-a")!;
    expect(utilisateurDuJeton(jeton)).toBe("utilisateur-a");
    // La signature est liée à l'identifiant : on ne recolle pas deux moitiés.
    const autre = jetonDeDesinscription("utilisateur-b")!;
    const forge = `utilisateur-a.${autre.split(".")[1]}`;
    expect(utilisateurDuJeton(forge), "un jeton se recolle depuis un autre compte").toBeNull();
  });

  it("un jeton tronqué, vide ou sans signature est refusé", () => {
    const jeton = jetonDeDesinscription("utilisateur-a")!;
    for (const mauvais of [null, "", "utilisateur-a", "utilisateur-a.", jeton.slice(0, -1), jeton + "x"]) {
      expect(utilisateurDuJeton(mauvais), `accepté : ${String(mauvais)}`).toBeNull();
    }
  });

  it("changer de secret invalide les jetons déjà émis", () => {
    const jeton = jetonDeDesinscription("utilisateur-a")!;
    process.env.UNSUBSCRIBE_SECRET = "un-autre-secret-tout-aussi-long-que-le-premier";
    expect(utilisateurDuJeton(jeton)).toBeNull();
  });

  it("les deux en-têtes attendus par Gmail partent ensemble", () => {
    const h = entetesDeDesinscription("utilisateur-a")!;
    expect(h["List-Unsubscribe"]).toMatch(/^<https:\/\/tradediscipline\.app\/api\/unsubscribe\?t=/);
    // ⚠️ `List-Unsubscribe-Post` n'a de sens QUE par paire avec l'URL https :
    // c'est lui qui promet au fournisseur que le POST suffit.
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  /**
   * ⚠️⚠️ « PAS DE SECRET, PAS D'EN-TÊTE » EST UN MODE DE PANNE MUET, et il n'est
   * pas vérifiable depuis ici : `vercel env pull` ne rend pas la valeur des
   * variables chiffrées, donc la longueur de `CRON_SECRET` en production est
   * inconnue. La clé dérivée de la clé de service est le maillon qui garantit
   * qu'un déploiement ne repart pas silencieusement sans en-tête.
   */
  it("sans secret explicite, la clé est dérivée de la clé de service", () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.CRON_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.charge.signature";
    const jeton = jetonDeDesinscription("utilisateur-a");
    expect(jeton, "aucun en-tête ne partirait en production").not.toBeNull();
    expect(utilisateurDuJeton(jeton)).toBe("utilisateur-a");
    expect(entetesDeDesinscription("utilisateur-a")).toBeDefined();
  });

  it("aucune clé du tout : on n'émet pas de lien mort", () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(jetonDeDesinscription("utilisateur-a")).toBeNull();
    expect(entetesDeDesinscription("utilisateur-a")).toBeUndefined();
    expect(lienDeDesinscription("utilisateur-a", "fr")).toBeNull();
  });

  it("un secret trop court ne sert pas de clé", () => {
    process.env.UNSUBSCRIBE_SECRET = "court";
    delete process.env.CRON_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(jetonDeDesinscription("utilisateur-a")).toBeNull();
  });

  it("le lien humain emporte la langue du lecteur", () => {
    expect(lienDeDesinscription("utilisateur-a", "de")).toContain("&l=de");
    expect(lienDeDesinscription("utilisateur-a")).not.toContain("&l=");
  });
});
