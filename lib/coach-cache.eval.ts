import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildCoachSystemBlocks, buildCoachSystemPrompt, type CoachPromptParams } from "./coach-system-prompt";
import { coachToolsForPlan } from "./coach-tools";
import { differerCatalogue } from "./coach-tool-search";

/**
 * LA COUPE EN TROIS, PROUVÉE CONTRE LA VRAIE API.
 *
 * Tout le reste du dossier repose sur une affirmation invérifiable en local :
 * « le bloc invariant reste chaud quand les données du trader changent ». Elle
 * est raisonnable, elle est conforme à la documentation, et elle vaut trois à
 * cinq euros par abonné Premium. Ce sont exactement les affirmations qu'il faut
 * mesurer plutôt que croire : le 2026-08-14, un préfixe supposé de 14 297
 * tokens en valait 20 690 sur l'autre modèle, et l'écart valait 2,25 €.
 *
 * Ce banc envoie donc le VRAI bloc système en trois morceaux, deux fois de
 * suite, avec des statistiques DIFFÉRENTES au second passage (c'est ce que fait
 * un trader qui clôture un trade puis interroge son coach). Il lit ensuite ce
 * que l'API rapporte réellement :
 *
 *   · `cache_creation_input_tokens` : ce qui a été (ré)écrit ;
 *   · `cache_read_input_tokens`     : ce qui a été relu à 0,1×.
 *
 * Avant la coupe, le second appel réécrivait TOUT. S'il réécrit encore tout, la
 * coupe ne sert à rien et le modèle économique ment.
 *
 * Lancé par `npm run eval:coach`. Coût : deux appels courts.
 */

const CLE = (() => {
  try {
    for (const ligne of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*(CLAUDE_API_KEY|ANTHROPIC_API_KEY)\s*=\s*(.+)$/.exec(ligne);
      if (m) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* on retombe sur l'environnement */
  }
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
})();

const MODELE = "claude-sonnet-5";

const TRADER: CoachPromptParams = {
  langName: "français",
  methodGlossaries: "DÉFINITIONS DE RÉFÉRENCE : FVG, OB, BSL, SSL.",
  strategyBlock: "Stratégie ICT liquidité XAUUSD. RR 2, SL max 100 pips, risque 2 %.",
  statsBlock: "48 trades clôturés sur 30 jours. Réussite 41 %. Gain moyen +58 €.",
  memoryBlock: "Engagement du 1er août : pas plus de 3 trades par jour.",
  statsTradeLimit: 300,
  todayKey: "2026-08-24",
  yesterdayKey: "2026-08-23",
  todayLabel: "lundi 24 août 2026",
  timezone: "Europe/Paris",
};

/**
 * Le MÊME trader, un trade plus tard : seul le bloc contextuel bouge.
 *
 * ⚠️ LES CHIFFRES SONT UNIQUES À CHAQUE PASSAGE, ET C'EST ESSENTIEL. Avec des
 * statistiques figées, le second passage du banc trouvait l'entrée de cache
 * laissée par le premier et annonçait une économie de 95 %, dont une bonne part
 * n'était que le banc se relisant lui-même. Pire : la disposition mesurée en
 * second héritait d'un cache que la première n'avait pas eu, ce qui compare un
 * cache chaud à un cache froid et fait passer la coupe pour meilleure qu'elle
 * n'est.
 *
 * Un trade que personne n'a jamais vu, c'est exactement la situation réelle :
 * le trader vient de le clôturer.
 */
const TRADER_APRES_UN_TRADE: CoachPromptParams = {
  ...TRADER,
  statsBlock: `${49 + (Date.now() % 97)} trades clôturés sur 30 jours. Réussite 42 %. Gain moyen +${61 + (Date.now() % 13)} €.`,
};

/** Le bloc système tel que la route l'envoie : trois morceaux, deux marqueurs. */
function systemeProduction(p: CoachPromptParams): Anthropic.TextBlockParam[] {
  const b = buildCoachSystemBlocks(p);
  const TTL = { type: "ephemeral", ttl: "1h" } as const;
  return [
    { type: "text", text: b.statique, cache_control: TTL },
    { type: "text", text: b.contextuel },
    { type: "text", text: b.rappelFinal, cache_control: TTL },
  ] as Anthropic.TextBlockParam[];
}

interface Usage {
  /** Tokens écrits en cache, facturés 2× l'entrée. */
  ecrit: number;
  /** Tokens relus depuis le cache, facturés 0,1×. */
  relu: number;
  /** Tokens d'entrée ordinaires, plein tarif. */
  brut: number;
}

/**
 * L'ANCIENNE disposition : le prompt d'un seul tenant, un seul marqueur. C'est
 * le témoin de l'expérience, et sans lui le test ne prouve rien : un cache qui
 * fonctionne bien n'a d'intérêt que comparé à celui qu'il remplace.
 */
function systemeAncienneDisposition(p: CoachPromptParams): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: buildCoachSystemPrompt(p),
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ] as Anthropic.TextBlockParam[];
}

async function appeler(
  p: CoachPromptParams,
  disposition: (q: CoachPromptParams) => Anthropic.TextBlockParam[] = systemeProduction,
): Promise<Usage> {
  const client = new Anthropic({ apiKey: CLE });
  const rep = await client.messages.create({
    model: MODELE,
    max_tokens: 16,
    system: disposition(p),
    tools: differerCatalogue(coachToolsForPlan("premium")),
    messages: [{ role: "user", content: "Réponds juste : ok." }],
  });
  const u = rep.usage as unknown as {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    input_tokens?: number;
  };
  return {
    ecrit: u.cache_creation_input_tokens ?? 0,
    relu: u.cache_read_input_tokens ?? 0,
    brut: u.input_tokens ?? 0,
  };
}

describe("la coupe du préfixe tient face à la vraie API", () => {
  it("un trade de plus ne fait plus sauter tout le préfixe", async () => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");

    // ── L'EXPÉRIENCE, ET SON TÉMOIN ──────────────────────────────────────────
    //
    // On rejoue DEUX FOIS la même scène (un trader interroge son coach, clôture
    // un trade, puis le réinterroge) : une fois avec l'ancienne disposition d'un
    // seul bloc, une fois avec la coupe en trois. Seule la comparaison prouve
    // quelque chose. Un cache qui marche ne dit rien s'il marchait déjà.
    //
    // Chaque disposition est chauffée avec les MÊMES données avant d'être
    // mesurée : on compare deux caches tièdes, pas un tiède et un froid. Et les
    // statistiques du « trade de plus » sont uniques à chaque passage, sans quoi
    // la seconde disposition mesurée hériterait du cache laissé par le passage
    // précédent et paraîtrait meilleure qu'elle n'est.
    await appeler(TRADER, systemeAncienneDisposition);
    const ancienne = await appeler(TRADER_APRES_UN_TRADE, systemeAncienneDisposition);

    await appeler(TRADER, systemeProduction);
    const nouvelle = await appeler(TRADER_APRES_UN_TRADE, systemeProduction);

    const cout = (u: Usage) => u.ecrit * 2 + u.relu * 0.1 + u.brut;
    const releve = [
      "── UN TRADE DE PLUS, PUIS UNE QUESTION AU COACH (Sonnet 5, vraie API) ──",
      "",
      `  ANCIENNE disposition (1 bloc)  : ${ancienne.ecrit} écrits, ${ancienne.relu} relus, ${ancienne.brut} bruts`,
      `  NOUVELLE disposition (3 blocs) : ${nouvelle.ecrit} écrits, ${nouvelle.relu} relus, ${nouvelle.brut} bruts`,
      "",
      `  Coût en tokens d'entrée équivalents (écrit ×2, relu ×0,1, brut ×1) :`,
      `    ancienne : ${Math.round(cout(ancienne))}`,
      `    nouvelle : ${Math.round(cout(nouvelle))}`,
      `    soit ${(100 - (cout(nouvelle) / cout(ancienne)) * 100).toFixed(0)} % de moins sur ce message`,
    ].join(String.fromCharCode(10));
    console.log(releve);
    // ⚠️ ET SUR DISQUE. Vitest n'affiche les `console.log` que des tests qui
    // ÉCHOUENT : ce relevé, qui est toute la valeur du test, était invisible
    // exactement quand il disait « ça marche ». Même piège que dans
    // `coach-live.eval.ts`, deux fois le même jour.
    try {
      writeFileSync("coach-cache-mesures.txt", releve);
    } catch {
      /* relevé indisponible : pas une raison de faire échouer le banc */
    }

    // ⚠️ LA PROPRIÉTÉ QUI VAUT L'ARGENT. Avec l'ancienne disposition, changer
    // les statistiques invalidait le préfixe ENTIER : rien à relire. Avec la
    // coupe, le bloc invariant reste chaud et se relit à 0,1×.
    expect(
      nouvelle.relu,
      `la coupe ne relit que ${nouvelle.relu} tokens : le bloc invariant n'a pas survécu au changement`,
    ).toBeGreaterThan(ancienne.relu);

    // Et l'économie doit être franche, pas symbolique.
    expect(
      cout(nouvelle),
      `${Math.round(cout(nouvelle))} tokens équivalents contre ${Math.round(cout(ancienne))} : la coupe ne rend presque rien`,
    ).toBeLessThan(cout(ancienne) * 0.8);
  }, 180_000);
});
