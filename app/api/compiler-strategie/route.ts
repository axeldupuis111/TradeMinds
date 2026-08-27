import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, rateLimitAi } from "@/lib/api-auth";
import { isLowCreditError, alertLowCreditsOnce } from "@/lib/ai-credit-alert";
import { logAiCost } from "@/lib/ai-cost-log";
import { compilerDepuisModele } from "@/lib/backtest/compilation";
import { instrumentParCode, INSTRUMENTS } from "@/lib/backtest/instruments";

/**
 * LA FICHE DEVIENT UN PLAN EXÉCUTABLE, OU ELLE DIT POURQUOI ELLE N'A PAS PU.
 *
 * On a longtemps refusé le backtest parce qu'une fiche écrite en français
 * (« j'attends un retest du FVG après le balayage ») n'est pas mécanisable sans
 * inventer la moitié des seuils. Cette route existe parce qu'on a trouvé
 * comment : le modèle ne rédige pas du code, il CHOISIT dans un catalogue fermé
 * de blocs et remplit leurs paramètres. Ce qu'il ne sait pas traduire, il le
 * DÉCLARE au lieu de le deviner.
 *
 * ⚠️ SA SORTIE N'EST PAS CRUE SUR PAROLE. `compilerDepuisModele` valide chaque
 * bloc et chaque paramètre contre le catalogue, et rejette tout le reste. Un
 * bloc mal formé ne planterait pas : il produirait un backtest crédible portant
 * sur une stratégie que personne n'a écrite. C'est le pire des deux mondes, et
 * c'est exactement ce que la validation empêche.
 *
 * ⚠️ CETTE ROUTE NE REMPLIT JAMAIS UN TROU. Une fiche sans stop rend un plan
 * sans stop, et l'interface réclame au trader de trancher. Le modèle a
 * l'interdiction explicite de proposer un objectif que la fiche ne mentionne
 * pas : un « 2R » inventé donnerait un chiffre, et ce chiffre serait faux au
 * sens le plus grave, celui où personne ne peut s'en apercevoir.
 *
 * ⚠️ HAIKU. Le travail est de la mise en correspondance entre des phrases et un
 * catalogue de vingt entrées, pas du raisonnement de marché. Aucun nombre de
 * performance n'est produit ici.
 */

export const dynamic = "force-dynamic";

/** Julie compile sa fiche 1 à 2 fois. Généreux parce que ça touche le parcours d'entrée. */
const LIMITE_JOUR = 10;

const MODELE = "claude-haiku-4-5-20251001";

interface CorpsRequete {
  /** Texte libre de la fiche, tel que le trader l'a écrit. */
  raw_text?: string;
  /** Champs déjà extraits par /api/parse-strategy, s'ils existent. */
  regles?: {
    pairs?: string[] | null;
    sessions?: string[] | null;
    risk_reward?: number | null;
    max_sl_pips?: number | null;
    max_trades_per_day?: number | null;
    max_consecutive_losses?: number | null;
    risk_per_trade_pct?: number | null;
    setup_rules?: string[] | null;
  };
  /** Instrument choisi dans la liste, ou déduit de `pairs`. */
  instrument?: string;
  fuseau?: string;
}

const CATALOGUE = `NIVEAU (un seul, obligatoire)
  {"type":"range_horaire","debut":"HH:MM","fin":"HH:MM"}      plage horaire de reference (ex: la bougie M5 d'ouverture)
  {"type":"extremes_n_bougies","n":<2-500>}                    plus haut/bas des N dernieres bougies M1
  {"type":"extremes_veille"}                                   plus haut/bas de la veille
  {"type":"liquidite_swing","pivots":<2-500>}                  BSL/SSL : anciens sommets et creux pivots
  {"type":"trendline","pivots":<2-500>,"touchesMin":<3-20>,"toleranceTicks":<0+>}
        TRENDLINE : une droite sur laquelle le prix REBONDIT au moins "touchesMin" fois (3 par defaut) sans
        jamais cloturer de l'autre cote. Elle peut monter, descendre ou etre horizontale : AUCUN sens n'est
        impose. Si une bougie cloture au travers avant la derniere touche, la droite est morte et ne compte plus.
        A choisir des que le trader parle de trendline, de ligne de tendance ou de droite : casser une oblique et
        casser un plus-haut horizontal sont deux evenements DIFFERENTS.
        ⚠️ Ne descends JAMAIS "touchesMin" sous 3 : par deux points il passe toujours une droite.

DECLENCHEUR (un seul, obligatoire)
  {"type":"cassure","mode":"cloture"|"meche"}
  {"type":"balayage_retour"}                                   balayage du niveau puis recloture de l'autre cote
  {"type":"retest_apres_cassure","delaiMaxBarres":<1-500>,"toleranceTicks":<0+>}
  {"type":"fvg_puis_retest","delaiMaxBarres":<1-500>}          CONTINUATION : cassure avec FVG, puis retest du FVG
  {"type":"balayage_puis_fvg","delaiReaction":<1-500>,"delaiRetest":<1-500>}
        RETOURNEMENT : prise de liquidite, puis impulsion inverse laissant un FVG, puis retour dans ce FVG.
        Invalide si le prix redepasse l'extreme du balayage.

CONFIRMATIONS (0 a 3, facultatif)
  {"type":"bougie_reaction"}                                   la bougie de signal cloture dans le sens du trade
  {"type":"biais_moyenne","periode":<2-1000>}                  entrer seulement dans le sens de la moyenne mobile
  {"type":"amplitude_min","ticks":<1+>}

ENTREE (une seule, obligatoire)
  {"type":"open_bougie_suivante"}
  {"type":"limite_au_niveau","valableNBarres":<1-500>}

STOP (un seul) — NE PAS PROPOSER SI LA FICHE N'EN PARLE PAS
  {"type":"structurel","bufferTicks":<0+>}                     extreme de la bougie de signal
  {"type":"fixe","ticks":<1+>}
  {"type":"niveau_oppose","bufferTicks":<0+>}
  {"type":"extreme_balayage","bufferTicks":<0+>}               au-dela de l'extreme du balayage (avec balayage_puis_fvg)
  {"type":"dernier_pivot","bufferTicks":<0+>}                  derriere le dernier sommet (vente) ou creux (achat)
        C'est le « stop derriere le dernier sommet » des traders de trendline. BEAUCOUP plus large qu'un stop sur
        la bougie de signal : ne pas confondre les deux, l'ecart va de un a dix sur la taille du risque.

OBJECTIF (un seul) — NE PAS PROPOSER SI LA FICHE N'EN PARLE PAS
  {"type":"multiple_r","r":<0.1-20>}
  {"type":"niveau_oppose"}

SORTIES AUXILIAIRES (facultatif)
  {"breakEvenApresR":<0-20>,"finDeSession":"HH:MM","apresNBarres":<1+>}

GESTION (facultatif)
  {"maxTradesParJour":<1-100>,"maxPertesConsecutives":<1-50>,"maxPerteJournaliereR":<0-100>}

UNITE DE TEMPS (obligatoire) — "uniteDeTemps": 1, 3, 5, 15, 30, 60 ou 240 (minutes)
  Celle du GRAPHIQUE que le trader regarde pour ses entrees, pas celle de son analyse de contexte. S'il analyse
  en H4 mais entre sur un graphique M3, c'est 3. Si la fiche ne le dit pas, mets 5 et signale-le dans "deduites".

CONTEXTE (obligatoire) — NE PAS INVENTER D'HORAIRES SI LA FICHE N'EN DONNE PAS
  {"fuseau":"<IANA>","debut":"HH:MM","fin":"HH:MM","jours":[1,2,3,4,5]}`;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.plan !== "premium") return NextResponse.json({ locked: true });

  const corps = (await req.json().catch(() => ({}))) as CorpsRequete;
  const fiche = (corps.raw_text ?? "").trim().slice(0, 8000);
  if (fiche.length < 40) {
    return NextResponse.json({ plan: null, reason: "fiche_trop_courte" });
  }

  const instrument =
    instrumentParCode(corps.instrument ?? "")?.code ??
    instrumentParCode(corps.regles?.pairs?.[0] ?? "")?.code ??
    null;
  if (!instrument) {
    return NextResponse.json({
      plan: null,
      reason: "instrument_inconnu",
      connus: INSTRUMENTS.map((i) => i.code),
    });
  }

  const limited = await rateLimitAi(auth.userId, "compiler-strategie", LIMITE_JOUR, auth.timezone);
  if (limited) return limited;

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ plan: null, reason: "no_api_key" });

  const r = corps.regles ?? {};
  const dejaExtrait = [
    r.risk_reward != null ? `objectif annonce : ${r.risk_reward}R` : null,
    r.max_sl_pips != null ? `stop maximum annonce : ${r.max_sl_pips} pips` : null,
    r.max_trades_per_day != null ? `maximum ${r.max_trades_per_day} trades par jour` : null,
    r.max_consecutive_losses != null ? `arret apres ${r.max_consecutive_losses} pertes d'affilee` : null,
    r.risk_per_trade_pct != null ? `risque par trade : ${r.risk_per_trade_pct} %` : null,
    r.sessions?.length ? `seances declarees : ${r.sessions.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `Tu traduis la fiche de strategie d'un trader en un PLAN MECANIQUE, en choisissant uniquement dans le catalogue ci-dessous.

FICHE DU TRADER
"""
${fiche}
"""
${dejaExtrait ? `\nCHAMPS DEJA RENSEIGNES DANS SON PROFIL\n${dejaExtrait}\n` : ""}
Instrument teste : ${instrument}. Fuseau du trader : ${corps.fuseau ?? "Europe/Paris"}. Les bougies sont en M1.

CATALOGUE FERME (aucun autre type n'existe)
${CATALOGUE}

REGLES ABSOLUES
1. N'INVENTE AUCUN BLOC. Si une phrase ne correspond a rien du catalogue, mets-la dans "nonTraduites". Ne la rapproche pas du bloc le plus proche.
2. NE COMBLE AUCUN TROU. Si la fiche ne dit pas ou se place le stop, OMETS "stop" et mets "stop" dans "absents". Idem pour l'objectif, la seance, le risque. Un objectif de 2R que le trader n'a jamais ecrit produirait un resultat chiffre portant sur une strategie qui n'est pas la sienne.
3. UNE DEDUCTION SE DECLARE. Si la fiche parle d'invalidation sans placer le stop et que tu proposes quand meme extreme_balayage, mets-le dans "deduites" avec le motif. Une deduction n'est pas une regle du trader.
4. DISTINGUE UN ADJECTIF FLOU D'UN FILTRE EXPLICITE. C'est la regle la plus delicate, lis-la en entier.
   - Un JUGEMENT DE QUALITE sans seuil ("une reaction claire", "un retracement propre", "un contexte favorable", "une bougie forte") va dans "nonTraduites". Ne l'approche jamais par amplitude_min ou par une periode de moyenne : tu inventerais le seuil que le trader n'a pas ecrit.
   - Un FILTRE EXPLICITE, meme exprime en mots, SE MECANISE et se DECLARE dans "deduites". "Je ne prends que dans le sens de la tendance H1" est une regle nette : c'est biais_moyenne avec periode 60 (H1) ou 240 (H4), et tu ecris dans "deduites" que la moyenne mobile approche la lecture de tendance du trader. Le mettre dans "nonTraduites" ferait tester une strategie SANS son filtre directionnel, c'est-a-dire des entrees dans les deux sens que le trader ne prend jamais. C'est la faute la plus couteuse possible ici : elle double le nombre de trades et change le resultat du tout au tout.
   - Quand un filtre explicite ne peut PAS etre mecanise faute de bloc adapte, alors seulement il va dans "nonTraduites".
5. ⚠️ "pivots", "delaiReaction", "delaiRetest", "n", "periode" se comptent en BOUGIES DE "uniteDeTemps", PAS EN MINUTES. C'est la faute la plus couteuse du formulaire : en uniteDeTemps 60 (H1), "pivots": 240 veut dire 240 HEURES de chaque cote, soit dix jours, et plus aucun pivot n'existe jamais. Un pivot utile compte 3 a 10 bougies de chaque cote, quelle que soit l'unite. Ne convertis JAMAIS une duree en minutes ici.
5b. ⚠️ "toleranceTicks" NE DOIT JAMAIS VALOIR 0 sur une trendline. A zero, un creux doit tomber exactement sur la droite au tick pres, ce qui n'arrive jamais : la troisieme touche ne se produit pas et le backtest rend zero trade sans explication. Compte environ un dixieme de l'amplitude d'une bougie de l'unite choisie.
6. SI LE TRADER NE PREND QU'UN SEUL SENS, mets "sens" a "long" ou "short". S'il suit la tendance dans les deux sens, laisse "les_deux" ET pose le filtre de tendance.
7. DANS "traduites" ET DANS "deduites", le champ "bloc"/"champ" ne prend QUE l'un de ces noms, seul et sans suffixe : contexte, niveau, declencheur, confirmations, entree, stop, objectif, sortiesAuxiliaires, gestion, sens, uniteDeTemps.
   ⚠️ N'ECRIS JAMAIS « niveau - pivots » ni « stop - bufferTicks ». Le nom du bloc sert a SURLIGNER le reglage a corriger dans l'interface : un nom compose empeche l'interface de le retrouver, et le trader lit alors qu'un bloc est entoure en rouge alors que rien ne l'est. Precise le sous-parametre dans le texte de "pourquoi", pas dans le nom.

Reponds STRICTEMENT en JSON, sans texte autour :
{"uniteDeTemps":<1|3|5|15|30|60|240>,"sens":"long"|"short"|"les_deux","contexte":{...},"niveau":{...},"declencheur":{...},"confirmations":[...],"entree":{...},"stop":{...} ou omis,"objectif":{...} ou omis,"sortiesAuxiliaires":{...},"gestion":{...},"traduites":[{"phrase":"citation courte de la fiche","bloc":"declencheur"}],"nonTraduites":["phrase non mecanisable"],"deduites":[{"champ":"stop","pourquoi":"..."}],"absents":["stop","objectif","risque","seance","unite_de_temps"]}`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODELE,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    logAiCost(createClient(), auth.userId, {
      route: "compiler-strategie",
      model: MODELE,
      plan: auth.plan,
      usage: msg.usage,
      extra: { instrument },
    });

    const brut = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const trouve = brut.match(/\{[\s\S]*\}/);
    if (!trouve) return NextResponse.json({ plan: null, reason: "parse_failed" });

    let json: unknown;
    try {
      json = JSON.parse(trouve[0]);
    } catch {
      return NextResponse.json({ plan: null, reason: "parse_failed" });
    }

    // ⚠️ C'est ICI que la promesse tient. Rien de ce que le modèle a écrit
    // n'entre dans le moteur sans être passé par le catalogue.
    const compile = compilerDepuisModele(json, instrument);
    return NextResponse.json(compile);
  } catch (err) {
    if (isLowCreditError(err)) await alertLowCreditsOnce();
    console.error("[compiler-strategie] echec:", err);
    return NextResponse.json({ plan: null, reason: "error" });
  }
}
