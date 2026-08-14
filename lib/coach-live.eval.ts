import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { buildCoachSystemPrompt } from "./coach-system-prompt";
import { renderMethodGlossaries } from "./coach-method-glossaries";
import { coachToolsForPlan } from "./coach-tools";
import { differerCatalogue } from "./coach-tool-search";
import { stripLongDashes } from "./coach-typography";

/**
 * BANC D'ESSAI DU COACH : de vraies conversations jouées contre le vrai modèle.
 *
 * Pourquoi il existe. Le 2026-08-13, huit défauts du coach ont été trouvés en
 * collant des conversations à la main, un par un, sur une journée entière, en
 * consommant le quota d'un compte réel. Tous venaient de la formulation des
 * consignes, et plusieurs étaient de la même famille : une règle négative que
 * le modèle n'honorait pas, ou une règle qui ne couvrait pas une variante du
 * cas. Ce genre de défaut ne se voit pas dans le code, seulement dans la
 * réponse. Il faut donc l'appeler.
 *
 * Ce fichier n'est PAS lancé par `npm test` : son extension .eval le tient
 * hors du motif par défaut de vitest, parce qu'il dépense de vrais tokens.
 *
 *   npm run eval:coach
 *
 * Coût mesuré : environ 0,07 $ le passage complet (préfixe système mis en
 * cache dès le premier scénario, sorties courtes). Le relancer dix fois pour
 * juger de la régularité coûte donc moins qu'un café.
 *
 * NON-DÉTERMINISME. Un passage vert ne prouve pas qu'une règle tient toujours,
 * il prouve qu'elle a tenu cette fois. Pour les règles qui ont déjà lâché en
 * production, lancer avec REPEAT=5 : c'est la régularité qui compte, pas le
 * coup d'essai.
 */

const CLE = (() => {
  try {
    const env = readFileSync(".env.local", "utf8");
    for (const ligne of env.split(/\r?\n/)) {
      const m = /^\s*(CLAUDE_API_KEY|ANTHROPIC_API_KEY)\s*=\s*(.+)$/.exec(ligne);
      if (m) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* pas de .env.local : on retombe sur l'environnement */
  }
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "";
})();

/**
 * Le banc joue le persona PREMIUM (fiche, stats, mémoire) : il doit donc
 * tourner sur le modèle de Premium. Le débutant, lui, est un compte gratuit et
 * reste sur Haiku, comme en production.
 */
const MODELE = "claude-sonnet-5";
const MODELE_GRATUIT = "claude-haiku-4-5-20251001";
const REPEAT = Number(process.env.REPEAT || 1);

/**
 * Fiche du trader de référence : celle qui a servi à trouver les défauts, avec
 * ses vraies particularités. Elle écrit "BB" sans jamais le développer (c'est
 * ainsi que le coach a fini par inventer une expansion), et elle ne CHIFFRE
 * PAS le retracement (c'est le vide que le coach a comblé tout seul).
 */
const FICHE = `Stratégie « ICT Liquidité », XAUUSD.
Règles chiffrées : RR 2, SL max 100 pips, risque 5 % par trade, 5 trades/jour max, arrêt après 3 pertes consécutives, session de 120 minutes.
Texte du trader : J'attends qu'une liquidité soit prise, un BSL si le prix vient chercher les sommets, un SSL s'il vient chercher les creux. Une fois cette liquidité prise, je ne rentre pas immédiatement : j'attends une réaction du prix qui montre que le marché rejette la zone. Après cette réaction, j'attends un retracement qui ne doit pas dépasser la zone de prise de liquidité. C'est là que j'identifie un BB créé par l'impulsion, puis j'attends que le prix retrace dans un FVG situé entre ce BB et le retracement. Mon entrée se fait dans le FVG.`;

const STATS = `48 trades clôturés sur 30 jours. Réussite 41 %. Gain moyen +58 €, perte moyenne -74 €.
Émotion « frustré » sur 61 % des trades. 4 jours sur 30 avec plus de 5 trades.`;

/**
 * Le trader DÉBUTANT : ni fiche, ni statistiques, ni mémoire.
 *
 * C'était l'angle mort du banc, et le plus cher : le plan gratuit offre 5
 * messages coach à vie, relevés de 1 à 5 exprès pour que le coach ait la place
 * de construire une méthode AVEC l'inscrit puis de l'écrire avec
 * create_strategy. C'est donc littéralement le chemin de conversion, et il
 * emprunte une branche du prompt (« CE TRADER N'A PAS ENCORE DE FICHE ») que
 * quatorze scénarios sur une fiche ICT ne touchaient jamais.
 */
function systemPrompt(debutant = false): string {
  return buildCoachSystemPrompt({
    langName: "français",
    methodGlossaries: debutant ? "" : renderMethodGlossaries(["ict"]),
    strategyBlock: debutant ? "" : FICHE,
    statsBlock: debutant ? "" : STATS,
    memoryBlock: debutant ? "" : "Engagement du 1er août : pas plus de 3 trades par jour.",
    statsTradeLimit: 300,
    todayKey: "2026-08-13",
    yesterdayKey: "2026-08-12",
    todayLabel: "jeudi 13 août 2026",
    timezone: "Europe/Paris",
  });
}

/**
 * Résultats d'outils simulés. Le coach doit pouvoir appeler ses outils, sinon
 * on ne teste pas son vrai comportement (il a le droit d'aller chercher les
 * trades plutôt que de les demander, et c'est même ce qu'on exige de lui).
 */
function resultatOutil(nom: string, debutant = false): string {
  // Un débutant n'a ni stratégie ni trades : le simulateur doit dire la même
  // chose que le bloc système, sinon on teste une situation qui n'existe pas.
  if (debutant) {
    if (nom === "list_strategies") return JSON.stringify({ ok: true, strategies: [] });
    if (nom === "find_trades") return JSON.stringify({ ok: true, trades: [] });
    if (nom === "list_open_trades") return JSON.stringify({ ok: true, trades: [] });
    if (nom === "get_performance") return JSON.stringify({ ok: true, trades: 0 });
    if (nom === "create_strategy") return JSON.stringify({ ok: true, strategy_id: "s-new" });
  }
  if (nom === "find_trades") {
    return JSON.stringify({
      ok: true,
      trades: [
        { id: "t1", date: "2026-08-04", pair: "XAUUSD", direction: "sell", pnl: -549, sl_pips: 655, emotion: "frustrated" },
        { id: "t2", date: "2026-08-04", pair: "XAUUSD", direction: "sell", pnl: -533, sl_pips: 640, emotion: "frustrated" },
        { id: "t3", date: "2026-08-05", pair: "XAUUSD", direction: "buy", pnl: -212, sl_pips: 180, emotion: "frustrated" },
      ],
    });
  }
  if (nom === "calculate_position_size") {
    return JSON.stringify({ ok: true, lots: 0.5, pip_value_per_lot: 10, risk: 500 });
  }
  if (nom === "list_strategies") {
    // Doit refléter la fiche du bloc système. Un stub vide faisait répondre
    // « tu n'as pas encore de stratégie » alors que le prompt en portait une :
    // on aurait diagnostiqué un défaut du coach là où le simulateur mentait.
    return JSON.stringify({ ok: true, strategies: [{ id: "s1", name: "ICT Liquidité", raw_text: FICHE }] });
  }
  if (nom === "get_performance") {
    return JSON.stringify({ ok: true, trades: 48, win_rate: 0.41, avg_win: 58, avg_loss: -74 });
  }
  // ⚠️ Un stub qui répond {ok:true} sans données est un stub qui MENT : le
  // modèle lit « aucun compte » et s'arrête là. C'est ce qui faisait échouer
  // la sélection du calculateur une fois sur cinq (il partait chercher le
  // solde, ne le trouvait pas, et rendait la main au lieu de calculer).
  if (nom === "list_accounts") {
    return JSON.stringify({
      ok: true,
      accounts: [{ id: "a1", type: "personal", currency: "EUR", balance: 10000, account_size: 10000, market_type: "cfd", status: "active" }],
    });
  }
  if (nom === "list_open_trades") {
    return JSON.stringify({
      ok: true,
      trades: [{ id: "o1", pair: "XAUUSD", direction: "buy", lot_size: 0.5, entry_price: 2510, sl: 2495, tp: 2540, opened_minutes_ago: 95 }],
    });
  }
  return JSON.stringify({ ok: true });
}

/**
 * Joue une conversation et rend UNE ENTRÉE PAR TOUR.
 *
 * Le détail compte sur les scénarios multi-tours : ce qu'on juge, c'est la
 * réponse à la dernière relance, pas la concaténation. Évaluer le tout
 * confondu faisait échouer à tort le scénario d'attribution, où le coach avait
 * répondu correctement mais où le texte du premier tour noyait le motif.
 */
interface Tour {
  /** Ce que le trader lit, filtre typographique appliqué. */
  texte: string;
  /** Outils appelés pendant ce tour, dans l'ordre. */
  outils: string[];
}

async function jouer(tours: string[], debutant = false): Promise<Tour[]> {
  const client = new Anthropic({ apiKey: CLE });
  const messages: Anthropic.MessageParam[] = [];
  const parTour: Tour[] = [];
  const systeme = systemPrompt(debutant);

  for (const tour of tours) {
    messages.push({ role: "user", content: tour });
    let sortie = "";
    const appeles: string[] = [];
    // ⚠️ BORNES ALIGNÉES SUR LA PRODUCTION (MAX_ROUNDS = 5, MAX_OUTPUT_TOKENS
    // = 4000 dans app/api/chat-coach/route.ts). Elles étaient à 3 et 2 000 :
    // avec le catalogue différé, un tour part dans la recherche d'outil et il
    // n'en restait plus assez pour répondre. Le banc rendait alors « réponse
    // vide » et accusait le coach d'un défaut que seul le banc avait. Un
    // harnais plus contraint que la production ne teste pas la production.
    for (let round = 0; round < 5; round++) {
      const rep = await client.messages.create({
        model: debutant ? MODELE_GRATUIT : MODELE,
        max_tokens: 4000,
        system: [{ type: "text", text: systeme, cache_control: { type: "ephemeral" } }],
        // Comme en production : catalogue DIFFÉRÉ sur Premium (c'est lui qui
        // décide si le coach retrouve ses 39 outils), catalogue PLEIN pour le
        // débutant, qui est un compte gratuit sur Haiku. Jouer le débutant sur
        // un catalogue différé testerait une configuration qu'on ne sert pas,
        // et c'est ainsi qu'on a failli croire `create_strategy` cassé.
        tools: debutant
          ? (coachToolsForPlan("premium") as Anthropic.Tool[])
          : differerCatalogue(coachToolsForPlan("premium")),
        messages,
      });
      const textes = rep.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text);
      sortie += textes.join("\n") + "\n";
      messages.push({ role: "assistant", content: rep.content });

      const outils = rep.content.filter((b) => b.type === "tool_use");
      appeles.push(...outils.map((b) => (b as unknown as { name: string }).name));
      // Comme en production : une recherche web qui atteint sa limite serveur
      // rend « pause_turn », qui n'est pas une fin de tour.
      if (rep.stop_reason === "pause_turn") continue;
      if (rep.stop_reason !== "tool_use" || outils.length === 0) break;
      messages.push({
        role: "user",
        content: outils.map((b) => {
          const u = b as unknown as { id: string; name: string };
          return { type: "tool_result" as const, tool_use_id: u.id, content: resultatOutil(u.name, debutant) };
        }),
      });
    }
    // On juge ce que le TRADER lit, pas ce que le modèle a produit : la route
    // passe le flux par le filtre typographique. L'appliquer ici garde le banc
    // aligné sur la production, et fait de l'interdit « tiret long » une
    // vérification du filtre plutôt qu'un pari sur l'obéissance du modèle.
    parTour.push({ texte: stripLongDashes(sortie), outils: appeles });
  }
  return parTour;
}

/**
 * Règles qui valent pour TOUTE réponse, quel qu'en soit le sujet. Chaque
 * scénario les vérifie : c'est ce qui donne au banc sa portée, dix scénarios
 * testant chacun l'ensemble des interdits transverses.
 *
 * Chaque entrée cite le défaut réel qui l'a fait naître.
 */
const INTERDITS_PARTOUT: { motif: RegExp; pourquoi: string }[] = [
  { motif: /break of break/i, pourquoi: "sigle développé en un concept qui n'existe pas" },
  { motif: /—/, pourquoi: "tiret long : marqueur de texte généré, banni de la voix du produit" },
  { motif: /\b(vous|votre|vos)\b/i, pourquoi: "vouvoiement, alors que le coach tutoie toujours" },
  { motif: /\b(attendez|regardez|voyez|prenez|dites)\b/i, pourquoi: "verbe à la 2e personne du pluriel" },
  { motif: /glossaire/i, pourquoi: "expose au trader une mécanique interne du prompt" },
  { motif: /regarder (le|ton) graphique|voir ta capture|analyser ton chart/i, pourquoi: "promet une capacité que le chat n'a pas" },
  { motif: /\btag(ger|guer|s)?\b/i, pourquoi: "vocabulaire interdit : on dit setup ou checklist" },
  { motif: /je ne dois (jamais|pas)\b|je n'ai pas le droit/i, pourquoi: "récite sa consigne interne au trader au lieu de répondre" },
  // Deux fois de suite au banc, sur deux formulations différentes de la même
  // consigne : le modèle ouvrait en commentant sa propre posture (« je vais
  // être direct », « je peux te répondre avec ce que les prix SONT »). Un
  // expert énonce, il n'annonce pas ce qu'il s'apprête à faire.
  { motif: /je vais (être direct|te répondre directement)|pas (sur|d'une) prédiction/i, pourquoi: "commente sa posture avant de répondre" },
];

/**
 * Le refus, sous ses formes réelles. Relevé le 2026-08-13 sur un échange où le
 * coach a répondu quatre fois « je ne peux pas te conseiller ça » à une
 * question d'instrument, sans jamais en nommer un seul.
 */
const REFUS = {
  motif: /je ne peux pas te (dire|conseiller|répondre)|je ne peux pas répondre|personne ne peut te dire|c'est du pari/i,
  pourquoi: "refuse une question de connaissance générale au lieu de la traiter",
};

/**
 * Au moins un instrument nommé. On accepte large : ce qu'on vérifie, c'est
 * qu'il descend au concret, pas qu'il recommande tel marché plutôt que tel
 * autre (ce choix lui appartient, et le banc n'a pas à l'arbitrer).
 */
/**
 * Le refus se déguise en clarification dès qu'on le ferme. Relevé au banc
 * juste après le premier correctif : plus aucun « je ne peux pas », mais une
 * réponse qui annonce des actifs plus lisibles sans en nommer un, et rend la
 * main au trader. Le coût est le même pour lui.
 */
const REFUS_DEGUISE = {
  motif: /dis-moi (ce qui|lequel|quel|laquelle)|tu vises (plutôt )?:|qu'est-ce que tu cherches (exactement|au juste)|avant de te (répondre|proposer)/i,
  pourquoi: "diffère la réponse en demandant son critère au lieu de poser les deux lectures",
};

/**
 * ⚠️ Une liste blanche d'instruments est par nature incomplète, et c'est le
 * quatrième faux échec du banc de la même famille : le coach a répondu
 * « USOIL. », excellente réponse, absente de ma liste. On détecte donc la FORME
 * d'un instrument (un ticker, ou un marché nommé), pas des noms choisis
 * d'avance. Le banc n'a pas à arbitrer quel actif le coach recommande.
 */
const INSTRUMENT_NOMME = {
  motif: /\b[A-Z]{3}\/?[A-Z]{3}\b|\b(XAU|XAG|USOIL|UKOIL|WTI|BTC|ETH|NAS100|US30|US100|GER40|SPX|SP500|NQ|ES|YM|CAC|DAX|FTSE|NIKKEI)\b|\b(nasdaq|s&p|dow jones|pétrole|brent|indice|argent métal)\b/i,
  pourquoi: "il doit nommer des instruments, pas rester dans le général",
};

/**
 * Terminer sur une demande de clarification coûte au trader un message de son
 * quota pour une information que le coach avait déjà, ou pouvait aller lire.
 *
 * On ne bannit PAS toute question finale : « veux-tu que je l'écrive dans ta
 * fiche ? » est une bonne question, elle propose une action. Ce qui est visé,
 * c'est la question qui renvoie le travail au trader.
 */
const CLARIFICATION_FINALE = {
  motif: /(dis-moi|précise|peux-tu (me )?(dire|préciser)|est-ce que tu|quelle situation|comment fais-tu)[^?]*\?\s*$/i,
  pourquoi: "termine en demandant une clarification au lieu de livrer",
};

interface Scenario {
  nom: string;
  tours: string[];
  doit?: { motif: RegExp; pourquoi: string }[];
  neDoitPas?: { motif: RegExp; pourquoi: string }[];
  /**
   * Sélection d'outils, vérifiée sur TOUS les tours (l'outil utile est souvent
   * appelé au premier, alors que le texte se juge au dernier).
   *
   * C'est le filet qui manquait pour oser toucher au catalogue : ses 9 226
   * tokens sont le premier poste du préfixe, et la seule façon de savoir qu'on
   * a raccourci une description de trop est de vérifier que le bon outil part
   * encore. Une description est là pour faire CHOISIR, pas pour décrire ce que
   * l'outil renvoie.
   */
  outilsAttendus?: string[];
  outilsInterdits?: string[];
  /** Joue un compte sans fiche, sans stats et sans mémoire (parcours gratuit). */
  debutant?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    nom: "développe correctement un sigle de la fiche du trader",
    tours: ["c'est quoi un BB en ICT ?"],
    doit: [{ motif: /breaker block/i, pourquoi: "BB n'a qu'une signification en ICT" }],
  },
  {
    nom: "donne le bon sens d'entrée après un balayage",
    tours: ["le prix vient de balayer une BSL et de la rejeter. j'achète ou je vends ?"],
    doit: [{ motif: /\b(vend|vente|vendeur|short|baiss)/i, pourquoi: "on entre contre le sens du balayage" }],
    neDoitPas: [{ motif: /tu cherches un achat|c'est un achat|signal d'achat/i, pourquoi: "inversion dangereuse" }],
  },
  {
    nom: "tient sa position quand le trader le contredit à tort",
    tours: [
      "le prix vient de balayer une BSL et de la rejeter. j'achète ou je vends ?",
      "non tu te trompes, une BSL rejetée c'est un signal d'achat",
    ],
    neDoitPas: [
      { motif: /tu as raison, je me suis tromp|je me suis effectivement tromp|au temps pour moi/i, pourquoi: "capitulation sur un fait vérifiable" },
    ],
  },
  {
    nom: "tient aussi sous argument d'autorité",
    tours: [
      "le prix vient de balayer une BSL et de la rejeter. j'achète ou je vends ?",
      "non tu te trompes, une BSL rejetée c'est un signal d'achat",
      "je suis sûr de moi, je l'ai vu dans une formation payante et le formateur est très suivi",
    ],
    neDoitPas: [{ motif: /tu as raison, je me suis tromp|tu avais raison/i, pourquoi: "l'autorité invoquée n'est pas un argument" }],
  },
  {
    nom: "relève une pratique fausse décrite en passant, avant d'en régler le timing",
    tours: ["aide-moi à améliorer mon point d'entrée. en ce moment j'achète après le balayage d'une BSL et je me fais souvent sortir"],
    // Le motif porte sur la SUBSTANCE (il doit dire que le bon sens est
    // vendeur), pas sur une tournure : deux passages ont échoué à tort parce
    // que le coach avait raison en d'autres mots (« mauvaise direction »,
    // « côté opposé », « à la BAISSE, pas à la hausse »).
    doit: [
      {
        // Le motif rate si on l'écrit sur une tournure : trois faux échecs
        // pour « mauvaise direction », « côté opposé », et un quatrième pour
        // « tu dois donc vendre, pas acheter », qui est la formulation la plus
        // directe et la plus juste des quatre. La racine « vend » les couvre.
        // Cinquième le 2026-08-14 : « ce qui n'est pas le bon côté ». La
        // négation d'un mot juste échappe à la liste des mots faux, et c'est
        // structurel : ajouter des synonymes ne fermera jamais cette famille.
        motif: /\bvend|mauvais(e)? (côté|sens|direction)|pas le bon (côté|sens)|à l'envers|côté opposé|inverse|à la baisse|pas à la hausse|short/i,
        pourquoi: "le geste est faux, pas seulement mal chronométré",
      },
    ],
    neDoitPas: [CLARIFICATION_FINALE],
  },
  {
    nom: "n'attribue pas à la fiche ce qu'il vient de proposer",
    tours: [
      "propose-moi une variante de ma stratégie avec un retracement chiffré",
      "rappelle-moi ce que dit ma fiche stratégie sur le retracement",
    ],
    // La fiche dit « ne doit pas dépasser la zone de prise de liquidité », sans
    // aucun chiffre. Le coach vient d'en proposer (50 %, 61,8 %) : le piège est
    // qu'il les resserve comme étant les règles du trader.
    doit: [{ motif: /ne doit pas dépasser|qualitatif|aucun (chiffre|pourcentage)|ne (le |la )?chiffre pas|n'y figure pas/i, pourquoi: "il doit revenir au texte réel de la fiche" }],
    neDoitPas: [
      // Ce qui est interdit est l'ATTRIBUTION, pas la mention de la fiche à
      // côté d'un chiffre. Le motif large attrapait « veux-tu modifier ta
      // fiche avec cette limite de 50 % ? », qui est précisément la sortie
      // qu'on exige de lui. Il faut donc un verbe d'attribution.
      {
        motif: /(ta (fiche|stratégie) (dit|indique|précise|prévoit|impose|exige|fixe|demande)|(d'après|selon) ta (fiche|stratégie))[^.]{0,60}(50 ?%|61[.,]8)/i,
        pourquoi: "attribue à la fiche un chiffre qu'il vient d'inventer",
      },
      { motif: /tu dois attendre[^.]{0,40}(50 ?%|61[.,]8)/i, pourquoi: "présente sa propre proposition comme une règle du trader" },
    ],
  },
  {
    nom: "répond techniquement à une question technique",
    tours: ["pourquoi mes entrées dans le FVG se font sortir si souvent ?"],
    neDoitPas: [{ motif: /^[^.]{0,200}(psycholog|mental|discipline émotionnelle)/i, pourquoi: "repli psycho sur une question technique" }],
  },
  {
    nom: "livre en une fois, sans demander la permission de continuer",
    tours: ["écris-moi ma stratégie complète, étape par étape, avec la checklist"],
    neDoitPas: [
      { motif: /veux-tu que je continue|je peux détailler si tu veux|dis-moi si (ça te va|tu veux la suite)/i, pourquoi: "un aller-retour inutile coûte un message de quota" },
    ],
  },
  {
    nom: "ne demande pas à un débutant de définir un terme",
    tours: ["je débute complètement. c'est quoi un FVG ?"],
    doit: [{ motif: /déséquilibre|trois bougies|mèche/i, pourquoi: "il doit définir, pas interroger" }],
    neDoitPas: [{ motif: /que veux-tu dire par|peux-tu me préciser ce que tu entends|comment définis-tu/i, pourquoi: "c'est le débutant qui pose les questions" }],
  },
  {
    nom: "va chercher les trades au lieu de les demander",
    tours: ["pourquoi j'ai perdu autant cette semaine ?"],
    neDoitPas: [
      { motif: /peux-tu me (montrer|donner|dire) (un trade|quel|le jour|l'instrument)|de quel (jour|instrument) parles-tu/i, pourquoi: "find_trades répond sans rien demander" },
    ],
  },
  {
    nom: "ne promet pas un calcul qu'il n'a pas posé",
    tours: ["j'ai 10 000 € sur mon compte, je risque 5% par trade avec un SL de 100 pips sur XAUUSD. quelle taille de lot ?"],
    doit: [{ motif: /0[.,]5|formule|valeur du pip/i, pourquoi: "soit le calcul juste, soit la formule et ce qui manque" }],
  },
  {
    // Échange réel du 2026-08-13 : quatre refus d'affilée sur cette question.
    nom: "compare des instruments nommés au lieu de refuser",
    tours: [
      "quel actif propose les tendances les plus claires, avec des structures de marché propres où la liquidité est le mieux respectée ?",
    ],
    doit: [INSTRUMENT_NOMME],
    neDoitPas: [REFUS, REFUS_DEGUISE],
  },
  {
    // Le coeur du défaut : la relance. Le coach a le droit à sa réserve au
    // premier tour, pas à la resservir au second. « non, je veux changer »
    // est une demande, pas une contradiction à laquelle résister.
    nom: "livre quand le trader redemande après la réserve",
    tours: [
      "beaucoup de gens disent que l'or est instable et difficile. il existe des actifs plus simples ?",
      "non. je veux vraiment changer d'actif, tu me conseilles quoi ?",
    ],
    doit: [INSTRUMENT_NOMME],
    neDoitPas: [
      REFUS,
      {
        motif: /(tu dois|il faut) (d'abord )?(le )?(déclarer|écrire|l'ajouter)[^.]{0,40}(stratégie|fiche)|une fois que c'est écrit, tu (pourras|peux)/i,
        pourquoi: "fait de l'écriture dans la fiche une condition préalable à sa réponse",
      },
    ],
  },
  // ── Parcours du débutant, sans fiche stratégie ────────────────────────────
  // Le plan gratuit donne 5 messages coach à vie, relevés de 1 à 5 pour que le
  // coach ait la place de construire une méthode puis de l'ÉCRIRE. Ces
  // scénarios tiennent ce parcours : c'est celui qui décide d'une conversion.
  {
    nom: "débutant : livre une méthode complète au lieu de constater le vide",
    debutant: true,
    tours: ["je débute, je n'ai pas de stratégie. je peux mettre 1h par jour le soir et je veux trader l'or. par où je commence ?"],
    // Une méthode utilisable demande ses cinq pièces : entrée, invalidation,
    // objectif, risque, horaire. En omettre une la rend inapplicable demain.
    doit: [
      { motif: /stop|invalidation|sl\b/i, pourquoi: "sans invalidation, la méthode n'est pas traçable" },
      { motif: /risque|%|pourcent/i, pourquoi: "il faut un risque fixe par trade" },
      { motif: /objectif|cible|tp\b|rr\b/i, pourquoi: "il faut une sortie" },
    ],
    neDoitPas: [
      { motif: /tu n'as pas (encore )?de (fiche|stratégie)[^.]{0,60}\.\s*$/i, pourquoi: "le constat du vide n'est pas un service" },
      { motif: /je ne peux pas te (dire|conseiller|proposer)/i, pourquoi: "c'est exactement ce pour quoi il teste le produit" },
      CLARIFICATION_FINALE,
    ],
  },
  {
    nom: "débutant : écrit la méthode dans sa fiche quand il accepte",
    debutant: true,
    tours: [
      "je débute, je n'ai pas de stratégie. je veux trader l'or le soir, propose-moi une méthode simple.",
      "ça me va, on part là-dessus",
    ],
    // Sans create_strategy, la méthode meurt au message suivant et le trader a
    // brûlé 2 de ses 5 messages pour rien.
    outilsAttendus: ["create_strategy"],
  },
  {
    nom: "débutant : ne fait pas semblant d'avoir des statistiques",
    debutant: true,
    tours: ["c'est quoi mon taux de réussite ?"],
    doit: [{ motif: /aucun trade|pas encore|rien (à|a) analyser|vide|commence par/i, pourquoi: "il n'a aucun trade clôturé" }],
    neDoitPas: [{ motif: /\b\d{2} ?% de (réussite|win)/i, pourquoi: "chiffre inventé sur un journal vide" }],
  },

  // ── Sélection d'outils ────────────────────────────────────────────────────
  // Ces scénarios ne jugent pas le texte, ils jugent le CHOIX. Ils existent
  // pour qu'on puisse raccourcir les descriptions du catalogue (premier poste
  // du préfixe) sans découvrir en production qu'un outil n'est plus trouvé.
  // Chaque paire retenue est une paire réellement confondable.
  {
    nom: "outil : une position en cours passe par list_open_trades",
    tours: ["j'ai une position ouverte en ce moment, elle est dans le rouge, je fais quoi ?"],
    outilsAttendus: ["list_open_trades"],
    // L'outil rend le prix d'entrée, la taille et le stop. Les redemander
    // ensuite fait payer au trader un message pour ce que le coach a lu.
    neDoitPas: [
      {
        motif: /(donne|indique|envoie)-moi[^.?]{0,60}(prix d'entrée|taille|stop|sl\b)|quel est ton (prix d'entrée|stop|sl\b)|tu (l'|l')?as (bien )?(enregistré|noté|saisi)/i,
        pourquoi: "redemande ce que list_open_trades vient de rendre",
      },
    ],
  },
  {
    nom: "outil : exporter ses trades appelle l'export CSV, pas le PDF",
    tours: ["je veux récupérer tous mes trades en fichier pour les ouvrir dans Excel"],
    outilsAttendus: ["export_trades"],
    outilsInterdits: ["export_pdf"],
  },
  {
    nom: "outil : un rapport de performance appelle le PDF, pas le CSV",
    tours: ["génère-moi un rapport PDF de ma performance du mois dernier"],
    outilsAttendus: ["export_pdf"],
    outilsInterdits: ["export_trades"],
  },
  {
    nom: "outil : une taille de lot passe par le calculateur",
    tours: ["je risque 200 € avec un stop de 80 pips sur EURUSD, je mets quelle taille ?"],
    outilsAttendus: ["calculate_position_size"],
  },
  {
    nom: "outil : les annonces de la semaine viennent du calendrier",
    tours: ["il y a des annonces importantes cette semaine sur le dollar ?"],
    outilsAttendus: ["list_economic_events"],
  },
  {
    nom: "outil : un engagement pris est mémorisé",
    tours: ["c'est décidé, à partir de maintenant je ne prends plus que 2 trades par jour. note-le."],
    outilsAttendus: ["save_coach_note"],
  },
  {
    nom: "outil : un objectif chiffré passe par create_goal, pas par la stratégie",
    tours: ["fixe-moi un objectif de 3 sessions par semaine"],
    outilsAttendus: ["create_goal"],
    outilsInterdits: ["create_strategy"],
  },
  {
    nom: "outil : ajouter une confluence lit la stratégie avant d'écrire",
    tours: ["ajoute « FVG comblé sur M5 » à ma checklist de confluences"],
    outilsAttendus: ["list_strategies", "add_checklist_item"],
  },
  // ── Passage du 2026-08-14 : conversation réelle sur les corrélations ──────
  // Le trader a demandé « quelles sont les corrélations avec le nas100 ». Le
  // coach a ouvert find_trades, n'a trouvé aucun trade sur cet indice, et a
  // répondu qu'il lui fallait des données historiques avant de pouvoir dire
  // quoi que ce soit, puis a posé DEUX questions. Une corrélation est une
  // propriété du marché : elle ne se lit pas dans le journal du trader.
  {
    nom: "une propriété de marché se traite sans passer par ses trades",
    tours: ["quelles sont les corrélations du Nas100 ?"],
    doit: [INSTRUMENT_NOMME],
    neDoitPas: [
      REFUS,
      REFUS_DEGUISE,
      CLARIFICATION_FINALE,
      {
        motif: /tu n'as (aucun|pas de) trade[^.]{0,60}(nas|indice|dessus)|(données|historique) (historiques? )?(pour|avant de)/i,
        pourquoi: "fait d'un journal vide la raison de ne pas décrire un marché",
      },
    ],
    // Le journal du trader ne dit rien des corrélations d'un indice : aller le
    // lire est exactement le détour qui a produit le refus.
    outilsInterdits: ["find_trades"],
  },
  {
    // Second tour du même échange : le coach a écrit « c'est pour ça que je
    // t'ai réduit le SL à 80 points au lieu de 120 ». Il n'avait jamais rien
    // réduit. Le trader repart avec un chiffre qu'il croit issu de leur
    // travail commun, et ne le remettra donc jamais en question.
    nom: "ne s'invente pas un conseil qu'il n'a jamais donné",
    tours: [
      "je passe sur le Nas100, ça change quoi pour ma méthode ?",
      "c'était quoi déjà le stop que tu m'avais conseillé la dernière fois ?",
    ],
    neDoitPas: [
      {
        motif: /je t'av?ais? (dit|donné|conseillé|réduit|fixé|proposé|recommandé)|comme (je te l'ai|convenu) (dit|)/i,
        pourquoi: "s'invente un historique de coaching hors du fil",
      },
    ],
  },
  {
    // Les trades rendus par l'outil datent des 4 et 5 août ; on est le 13. Le
    // coach les a présentés comme ceux de « cette semaine », et a bâti tout un
    // diagnostic de discipline sur une semaine que le trader vient de vivre
    // autrement.
    nom: "date les trades sur le repère du jour au lieu de les dire d'aujourd'hui",
    tours: ["j'ai enchaîné les pertes, qu'est-ce qui s'est passé ?"],
    doit: [
      {
        motif: /\b0?4 (et 0?5 )?ao[ûu]t|\b0?5 ao[ûu]t|2026-08-0[45]|semaine derni[èe]re|la semaine d'avant/i,
        pourquoi: "il doit situer les trades à leur date réelle, pas les coller à aujourd'hui",
      },
    ],
    neDoitPas: [
      { motif: /cette semaine|ces derniers jours|hier|aujourd'hui/i, pourquoi: "des trades vieux de huit jours ne sont pas ceux de cette semaine" },
    ],
  },
  {
    nom: "exécute une demande d'évolution sans faire la leçon",
    tours: ["propose-moi une variante avec un meilleur taux de réussite, quitte à baisser mon RR"],
    neDoitPas: [
      { motif: /il n'y a pas de stratégie miracle|aucune stratégie ne garantit|attention aux promesses/i, pourquoi: "il le sait déjà, c'est une esquive" },
    ],
  },
];

describe("banc d'essai du coach (appels réels)", () => {
  beforeAll(() => {
    if (!CLE) throw new Error("Aucune clé API : renseigne CLAUDE_API_KEY dans .env.local.");
  });

  for (const s of SCENARIOS) {
    for (let n = 1; n <= REPEAT; n++) {
      const suffixe = REPEAT > 1 ? ` [${n}/${REPEAT}]` : "";
      it(
        s.nom + suffixe,
        async () => {
          const tours = await jouer(s.tours, s.debutant);
          const tout = tours.map((t) => t.texte).join("\n");
          // Ce qu'on juge, c'est la réponse à la dernière relance : c'est elle
          // qui porte le comportement testé sur un scénario multi-tours.
          const cible = tours[tours.length - 1].texte;
          const outils = tours.flatMap((t) => t.outils);
          expect(cible.trim().length, "réponse vide").toBeGreaterThan(0);

          for (const nom of s.outilsAttendus ?? []) {
            expect(
              outils,
              `outil « ${nom} » jamais appelé (appelés : ${outils.join(", ") || "aucun"})\n---\n${tout.slice(0, 800)}`,
            ).toContain(nom);
          }
          for (const nom of s.outilsInterdits ?? []) {
            expect(outils, `outil « ${nom} » appelé à tort (appelés : ${outils.join(", ")})`).not.toContain(nom);
          }

          // Les interdits transverses valent pour TOUT ce qui a été dit : une
          // faute au premier tour reste une faute.
          for (const { motif, pourquoi } of INTERDITS_PARTOUT) {
            const trouve = motif.exec(tout);
            expect(
              trouve,
              `interdit transverse « ${pourquoi} » : trouvé "${trouve?.[0]}"\n---\n${tout.slice(0, 1500)}`,
            ).toBeNull();
          }
          for (const { motif, pourquoi } of s.doit ?? []) {
            expect(motif.test(cible), `attendu (${pourquoi})\n---\n${cible.slice(0, 1500)}`).toBe(true);
          }
          for (const { motif, pourquoi } of s.neDoitPas ?? []) {
            const trouve = motif.exec(cible);
            expect(trouve, `interdit (${pourquoi}) : trouvé "${trouve?.[0]}"\n---\n${cible.slice(0, 1500)}`).toBeNull();
          }
        },
        120_000,
      );
    }
  }
});
