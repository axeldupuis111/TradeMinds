import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Toute route qui dépense des tokens doit vérifier le plan CÔTÉ SERVEUR.
 *
 * `daily-summary` ne le faisait pas : la matrice des plans l'annonçait « Plus
 * et Premium », mais le seul verrou vivait dans CsvImport, qui n'appelait la
 * route que pour un plan payant. Un compte gratuit appelant la route
 * directement obtenait une fonctionnalité payante. Toutes les autres routes IA
 * contrôlaient bien, celle-ci était l'exception — et rien ne le signalait.
 *
 * Ce test ferme la porte : ajouter une route qui appelle Anthropic sans
 * contrôle de plan le fait échouer.
 */

const RACINE = join(process.cwd(), "app", "api");

/**
 * Routes IA sans contrôle de plan, avec la raison ET le garde-fou qui le
 * remplace. Une exception sans raison écrite redevient un oubli en six mois.
 */
const OUVERTES_JUSTIFIEES: Record<string, { raison: string; garde: RegExp }> = {
  "community/interpret": {
    raison:
      "gardée par la PROPRIÉTÉ de la communauté (owner_id, 403 sinon), pas par le plan : " +
      "un partenaire rédige un défi pour ses membres, quel que soit son plan.",
    garde: /owner_id|not_owner/,
  },
  "macro-analysis/generate": {
    raison:
      "cron, pas une route utilisateur : elle génère l'analyse du jour une fois pour tout le " +
      "monde. C'est la LECTURE (macro-analysis/route.ts) qui est réservée au Premium.",
    garde: /CRON_SECRET/,
  },
  "economic-calendar/explain": {
    raison:
      "le calendrier économique est annoncé gratuit pour TOUS les plans dans la matrice " +
      "(plan_feat_eco_calendar), donc l'explication qui va avec l'est aussi. Bornée par " +
      "rateLimitAi et par FEATURE_MONTHLY_CEILING.",
    garde: /rateLimitAi/,
  },
};

function routes(dir: string, prefixe = ""): { nom: string; source: string }[] {
  const out: { nom: string; source: string }[] = [];
  for (const entree of readdirSync(dir)) {
    const chemin = join(dir, entree);
    if (statSync(chemin).isDirectory()) {
      out.push(...routes(chemin, prefixe ? `${prefixe}/${entree}` : entree));
    } else if (entree === "route.ts") {
      out.push({ nom: prefixe, source: readFileSync(chemin, "utf8") });
    }
  }
  return out;
}

/** Appelle-t-elle réellement le modèle ? */
const depenseDesTokens = (s: string) =>
  /from ["']@anthropic-ai\/sdk["']/.test(s) || /new Anthropic\(/.test(s);

/** Un contrôle de plan, sous l'une de ses formes admises. */
const controleLePlan = (s: string) =>
  /plan\s*(===|!==)\s*["'](free|plus|premium)["']/.test(s) ||
  /consumeQuota\s*\(/.test(s) ||
  /PLAN_LIMITS/.test(s);

describe("gating serveur des routes qui dépensent des tokens", () => {
  const ia = routes(RACINE).filter((r) => depenseDesTokens(r.source));

  it("trouve bien les routes IA (garde-fou du test lui-même)", () => {
    // Si un refactor casse la détection, le test passerait à vide sans rien
    // vérifier. On exige donc d'en trouver un nombre plausible.
    expect(ia.length).toBeGreaterThanOrEqual(8);
  });

  it.each(ia.map((r) => r.nom))("%s vérifie le plan côté serveur", (nom) => {
    const route = ia.find((r) => r.nom === nom)!;
    const exception = OUVERTES_JUSTIFIEES[nom];
    if (exception) {
      // Ouverture assumée : on vérifie que le garde-fou ANNONCÉ est bien là.
      // Sans ça, l'exception couvrirait aussi le jour où il disparaît.
      expect(route.source, `${nom} : ${exception.raison}`).toMatch(exception.garde);
      return;
    }
    expect(
      controleLePlan(route.source),
      `${nom} appelle le modèle sans contrôle de plan. Soit tu ajoutes le garde, ` +
        `soit tu documentes l'ouverture dans OUVERTES_JUSTIFIEES avec sa raison.`,
    ).toBe(true);
  });

  it("les routes ouvertes sont toutes justifiées explicitement", () => {
    // Une exception sans raison écrite redevient un oubli au bout de six mois.
    for (const [nom, { raison }] of Object.entries(OUVERTES_JUSTIFIEES)) {
      expect(raison.length, `${nom} : justification trop courte`).toBeGreaterThan(40);
      // Une exception qui ne correspond plus à aucune route est du bruit qui
      // finira par couvrir une vraie route du même nom.
      expect(ia.some((r) => r.nom === nom), `${nom} n'est plus une route IA`).toBe(true);
    }
  });
});
