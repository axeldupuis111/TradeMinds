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

/**
 * Le quota du jour.
 *
 * ⚠️ IL SE MESURE EN SÉANCES DE TRAVAIL, PAS EN JOURNÉES MOYENNES. Personne ne
 * répartit ses compilations sur le mois : on ouvre l'onglet un dimanche, on
 * réécrit sa fiche six fois de suite, et on n'y revient pas de la semaine. Un
 * quota journalier calé sur une moyenne mensuelle coupe donc exactement au
 * moment où l'outil sert, et jamais le reste du temps.
 */
const LIMITE_JOUR = 20;

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
        Sert aussi pour les RANGES DE SESSION : range asiatique 00:00-06:00, session de Londres 08:00-11:00.
  {"type":"extremes_n_bougies","n":<2-500>}                    plus haut/bas des N dernieres bougies M1
  {"type":"extremes_veille"}                                   plus haut/bas de la veille
  {"type":"liquidite_swing","pivots":<2-500>}                  BSL/SSL : anciens sommets et creux pivots
  {"type":"trendline","pivots":<2-500>,"touchesMin":<3-20>,"tolerance":<en POINTS de prix>}
        TRENDLINE : une droite sur laquelle le prix REBONDIT au moins "touchesMin" fois (3 par defaut) sans
        jamais cloturer de l'autre cote. Elle peut monter, descendre ou etre horizontale : AUCUN sens n'est
        impose. Si une bougie cloture au travers avant la derniere touche, la droite est morte et ne compte plus.
        A choisir des que le trader parle de trendline, de ligne de tendance ou de droite : casser une oblique et
        casser un plus-haut horizontal sont deux evenements DIFFERENTS.
        ⚠️ Ne descends JAMAIS "touchesMin" sous 3 : par deux points il passe toujours une droite.
  {"type":"moyenne_mobile","periode":<2-1000>}                 moyenne mobile simple, en bougies de l'unite choisie
  {"type":"vwap_session"}                                      VWAP de seance (approxime : on n'a pas le volume)
  {"type":"bollinger","periode":<5-1000>,"ecarts":<0.5-5>}     bandes de Bollinger : haute et basse
  {"type":"order_block","impulsionMin":<en POINTS>}            ORDER BLOCK : derniere bougie opposee avant l'impulsion.
        Zone de demande sous le prix (achat) ou d'offre au-dessus (vente). A employer avec "entree_dans_zone".
  {"type":"breaker","impulsionMin":<en POINTS>}                BREAKER : un order block que le prix a TRAVERSE.
        ⚠️ Il change de camp : une ancienne demande devient une offre. Ne pas confondre avec order_block, le sens
        du trade s'inverse.
  {"type":"fvg_zone","tailleMin":<en POINTS>}                  le desequilibre a trois bougies pris comme ZONE d'entree
        (et non comme simple condition). C'est l'usage le plus courant chez les traders ICT : ils attendent le
        retour DANS la boite. A employer avec "entree_dans_zone".
  {"type":"ote_fibonacci","pivots":<1-500>,"retraceMin":<1-99>,"retraceMax":<1-99>}
        LA ZONE DE RETRACEMENT du dernier mouvement, appelee OTE chez les traders ICT et "zone de Fibonacci"
        ailleurs. On garde la tranche comprise entre deux POURCENTAGES du dernier segment. Valeurs usuelles :
        62 et 79 (l'OTE), ou 50 et 62 pour un retracement classique. Ecris des ENTIERS.
        A employer avec "entree_dans_zone".

DECLENCHEUR (un seul, obligatoire)
  {"type":"cassure","mode":"cloture"|"meche"}
  {"type":"balayage_retour"}                                   balayage du niveau puis recloture de l'autre cote
  {"type":"retest_apres_cassure","delaiMaxBarres":<1-500>,"tolerance":<en POINTS de prix>}
  {"type":"fvg_puis_retest","delaiMaxBarres":<1-500>}          CONTINUATION : cassure avec FVG, puis retest du FVG
  {"type":"balayage_puis_fvg","delaiReaction":<1-500>,"delaiRetest":<1-500>}
        RETOURNEMENT : prise de liquidite, puis impulsion inverse laissant un FVG, puis retour dans ce FVG.
        Invalide si le prix redepasse l'extreme du balayage.
  {"type":"entree_dans_zone","delaiMaxBarres":<1-1000>}        le prix REVIENT dans la zone, on entre dans son sens.
        C'est l'entree classique sur order block, breaker, FVG ou retracement : on ne casse rien, on attend le
        retour dans la boite. N'a de sens qu'avec un niveau qui est une ZONE.

CONFIRMATIONS (0 a 3, facultatif)
  {"type":"bougie_reaction"}                                   la bougie de signal cloture dans le sens du trade
  {"type":"biais_moyenne","periode":<2-1000>}                  entrer seulement dans le sens de la moyenne mobile
  {"type":"amplitude_min","amplitude":<en POINTS de prix>}
  {"type":"rsi","periode":<2-1000>,"seuil":<50-95>,"mode":"momentum"|"exces"}
        ⚠️ LES DEUX MODES SONT OPPOSES. "momentum" : on n'achete que si le RSI depasse le seuil, donc dans le sens
        de la force. "exces" : on n'achete que s'il est SOUS le seuil symetrique, donc en survente. Se tromper de
        mode inverse le filtre, et un filtre inverse ne se voit dans aucun chiffre.
  {"type":"macd","rapide":<2-500>,"lente":<3-1000>,"signal":<1-500>}
        On n'achete que si la ligne MACD est au-dessus de sa ligne de signal, on ne vend que si elle est
        dessous. Reglage habituel : 12, 26, 9. "rapide" doit rester INFERIEUR a "lente".
  {"type":"stochastique","periode":<2-1000>,"seuil":<50-95>,"mode":"momentum"|"exces"}
        ⚠️ MEMES DEUX MODES OPPOSES que le RSI, meme piege. Relis l'avertissement ci-dessus.
  {"type":"divergence","periode":<2-1000>,"pivots":<1-500>}
        DIVERGENCE prix / RSI sur les deux derniers pivots : en achat, le prix fait un creux plus bas
        pendant que le RSI en fait un plus haut. En vente, l'inverse. Ne l'emploie QUE si le trader parle
        explicitement de divergence : c'est un filtre tres selectif, et l'ajouter sans qu'il l'ait demande
        supprimerait la plupart de ses trades.

ENTREE (une seule, obligatoire)
  {"type":"open_bougie_suivante"}
  {"type":"limite_au_niveau","valableNBarres":<1-500>}

STOP (un seul) — NE PAS PROPOSER SI LA FICHE N'EN PARLE PAS
  {"type":"structurel","buffer":<en POINTS>}                   extreme de la bougie de signal
  {"type":"fixe","distance":<en POINTS>}
  {"type":"niveau_oppose","buffer":<en POINTS>}
  {"type":"extreme_balayage","buffer":<en POINTS>}             au-dela de l'extreme du balayage (avec balayage_puis_fvg)
  {"type":"dernier_pivot","buffer":<en POINTS>,"pivots":<1-500, facultatif>}
        C'est le « stop derriere le dernier sommet » des traders de trendline. BEAUCOUP plus large qu'un stop sur
        la bougie de signal : ne pas confondre les deux, l'ecart va de un a dix sur la taille du risque.
        "pivots" est facultatif : sans lui, on reprend la definition de sommet du bloc de niveau.
  {"type":"atr","periode":<2-1000>,"multiple":<0.1-20>}
        Stop a N fois l'ATR, la formulation habituelle des traders systematiques ("stop a 1,5 ATR").
        Ici, et SEULEMENT ici, un nombre a virgule est attendu.

OBJECTIF (un seul) — NE PAS PROPOSER SI LA FICHE N'EN PARLE PAS
  {"type":"multiple_r","r":<0.1-20>}
  {"type":"niveau_oppose"}

SORTIES AUXILIAIRES (facultatif)
  {"breakEvenApresR":<0-20>,"finDeSession":"HH:MM","apresNBarres":<1+>}

GESTION (facultatif)
  {"risqueParTradePct":<0.01-100>,"maxTradesParJour":<1-100>,"maxPertesConsecutives":<1-50>,"maxPerteJournaliereR":<0-100>}
  "risqueParTradePct" = part du capital risquee par trade, en pourcent. Reprends-la de la fiche ou des champs deja
  renseignes. Si les deux existent et se contredisent, prends celle de la FICHE et signale le conflit dans "deduites".

UNITE DE TEMPS (obligatoire) — "uniteDeTemps": 1, 3, 5, 15, 30, 60 ou 240 (minutes)
  Celle du GRAPHIQUE que le trader regarde pour ses entrees, pas celle de son analyse de contexte. S'il analyse
  en H4 mais entre sur un graphique M3, c'est 3. Si la fiche ne le dit pas, mets 5 et signale-le dans "deduites".

CONTEXTE (obligatoire) — NE PAS INVENTER D'HORAIRES SI LA FICHE N'EN DONNE PAS
  {"fuseau":"<IANA>","debut":"HH:MM","fin":"HH:MM","jours":[1,2,3,4,5]}`;

/**
 * LE PREFIXE INVARIANT, IDENTIQUE POUR TOUS LES TRADERS ET TOUS LES APPELS.
 *
 * ⚠️⚠️ MESURE DU 2026-09-03 : le prompt complet pese 4 987 tokens, dont 4 700
 * dans ce bloc-ci. Autrement dit, 94 % de ce qu'on payait a chaque traduction
 * etait exactement le meme texte que la fois d'avant, et que chez le voisin.
 * Le modele de marge, lui, supposait 3 000 tokens : devines, jamais comptes.
 *
 * ⚠️ IL DOIT RESTER IDENTIQUE AU CARACTERE PRES. Un point de cache ne se
 * declenche que sur un prefixe exactement egal : y glisser la moindre valeur
 * variable (l'instrument, l'heure, le nom du trader) le ferait manquer a tous
 * les coups, et couterait 1,25x au lieu de 0,1x. C'est pour ca que l'echelle
 * de l'instrument est passee dans le message et non ici.
 *
 * ⚠️ LA FICHE ARRIVE APRES, ET C'EST L'ORDRE QUI COMPTE. Un prefixe ne se
 * cache que s'il est au DEBUT : mettre la fiche en tete, comme c'etait le cas,
 * rendait le cache impossible quoi qu'on fasse.
 */
const SYSTEME = `Tu traduis la fiche de strategie d'un trader en un PLAN MECANIQUE, en choisissant uniquement dans le catalogue ci-dessous.

CATALOGUE FERME (aucun autre type n'existe)
${CATALOGUE}

REGLES ABSOLUES
1. N'INVENTE AUCUN BLOC. Si une phrase ne correspond a rien du catalogue, mets-la dans "nonTraduites". Ne la rapproche pas du bloc le plus proche.
2. NE COMBLE AUCUN TROU. Si la fiche ne dit pas ou se place le stop, OMETS "stop" et mets "stop" dans "absents". Idem pour l'objectif, la seance, le risque. Un objectif de 2R que le trader n'a jamais ecrit produirait un resultat chiffre portant sur une strategie qui n'est pas la sienne.
3. UNE DEDUCTION SE DECLARE. Si la fiche parle d'invalidation sans placer le stop et que tu proposes quand meme extreme_balayage, mets-le dans "deduites" avec le motif. Une deduction n'est pas une regle du trader.
4. DISTINGUE UN ADJECTIF FLOU D'UN FILTRE EXPLICITE. C'est la regle la plus delicate, lis-la en entier.
   - Un JUGEMENT DE QUALITE sans seuil ("une reaction claire", "un retracement propre", "un contexte favorable", "une bougie forte") va dans "nonTraduites". Ne l'approche jamais par amplitude_min ou par une periode de moyenne : tu inventerais le seuil que le trader n'a pas ecrit.
   - Un FILTRE EXPLICITE, meme exprime en mots, SE MECANISE et se DECLARE dans "deduites". "Je ne prends que dans le sens de la tendance H1" est une regle nette : c'est biais_moyenne, et sa periode se compte en BOUGIES DE "uniteDeTemps" : prends 20 a 50 bougies DE L'UNITE DE TENDANCE, converties. Exemple : tendance H1 lue sur un plan en M15, c'est 20 x (60/15) = 80. ⚠️ N'ECRIS JAMAIS 60 POUR H1 : sur un plan en M15, une periode de 4 (une heure de donnees) ne peut JAMAIS contredire une cassure, et sur quatre ans de Nasdaq elle garde 100 % des trades. Un filtre qui n'ecarte rien equivaut a pas de filtre, sans que rien ne le dise. Ecris dans "deduites" la periode reellement posee ET l'unite de tendance qu'elle approche, et tu ecris dans "deduites" que la moyenne mobile approche la lecture de tendance du trader. Le mettre dans "nonTraduites" ferait tester une strategie SANS son filtre directionnel, c'est-a-dire des entrees dans les deux sens que le trader ne prend jamais. C'est la faute la plus couteuse possible ici : elle double le nombre de trades et change le resultat du tout au tout.
   - Quand un filtre explicite ne peut PAS etre mecanise faute de bloc adapte, alors seulement il va dans "nonTraduites".
5. ⚠️ "pivots", "delaiReaction", "delaiRetest", "n", "periode" se comptent en BOUGIES DE "uniteDeTemps", PAS EN MINUTES. C'est la faute la plus couteuse du formulaire : en uniteDeTemps 60 (H1), "pivots": 240 veut dire 240 HEURES de chaque cote, soit dix jours, et plus aucun pivot n'existe jamais. Un pivot utile compte 3 a 10 bougies de chaque cote, quelle que soit l'unite. Ne convertis JAMAIS une duree en minutes ici.
5b. ⚠⚠ TOUTES LES DISTANCES S'ECRIVENT EN POINTS DE PRIX, JAMAIS EN TICKS. "tolerance", "buffer", "distance", "amplitude" se lisent comme sur le graphique du trader. C'est la faute la plus insidieuse du formulaire, parce qu'elle ne plante pas : elle rend zero trade sur quatre ans. Vu en vrai sur le Nasdaq, ou le tick vaut 0,001 point : le modele avait ecrit 5 en pensant a une valeur raisonnable, ce qui faisait CINQ MILLIEMES de point sur un indice qui bouge de cent points par heure. Aucune droite n'a jamais ete touchee.
   Pour te reperer, l'ordre de grandeur de l'instrument teste t'est donne AVEC LA FICHE : appuie-toi dessus.
   Pour la tolerance d'alignement d'une TRENDLINE, vise environ UN MILLIEME DU PRIX de l'instrument (15 points sur un indice a 15 000, 2 dollars sur l'or a 2 000). Un trait trace a la main a une epaisseur : elle se mesure sur le prix, pas sur le spread, qui n'a rien a voir avec la precision de la main. Mesure sur quatre ans de Nasdaq : la tolerance qui confirme le plus de droites est de cet ordre.
5c. ⚠️ "tolerance" NE DOIT JAMAIS VALOIR 0 sur une trendline : a zero, un creux devrait tomber exactement sur la droite, ce qui n'arrive jamais.
6. SI LE TRADER NE PREND QU'UN SEUL SENS, mets "sens" a "long" ou "short". S'il suit la tendance dans les deux sens, laisse "les_deux" ET pose le filtre de tendance.
6b. CHOISIR LE BON BLOC DE ZONE. Si le trader dit qu'il attend le RETOUR du prix dans un order block, un breaker
   ou un FVG, prends le niveau correspondant AVEC "entree_dans_zone". Si au contraire il attend une CASSURE d'un
   niveau, prends "cassure". Un retour dans une zone et une cassure de niveau sont deux evenements opposes : les
   confondre fait entrer a contresens.
7. DANS "traduites" ET DANS "deduites", le champ "bloc"/"champ" ne prend QUE l'un de ces noms, seul et sans suffixe : contexte, niveau, declencheur, confirmations, entree, stop, objectif, sortiesAuxiliaires, gestion, sens, uniteDeTemps.
   ⚠️ N'ECRIS JAMAIS « niveau - pivots » ni « stop - buffer ». Le nom du bloc sert a SURLIGNER le reglage a corriger dans l'interface : un nom compose empeche l'interface de le retrouver, et le trader lit alors qu'un bloc est entoure en rouge alors que rien ne l'est. Precise le sous-parametre dans le texte de "pourquoi", pas dans le nom.

Reponds STRICTEMENT en JSON, sans texte autour :
{"uniteDeTemps":<1|3|5|15|30|60|240>,"sens":"long"|"short"|"les_deux","contexte":{...},"niveau":{...},"declencheur":{...},"confirmations":[...],"entree":{...},"stop":{...} ou omis,"objectif":{...} ou omis,"sortiesAuxiliaires":{...},"gestion":{...},"traduites":[{"phrase":"citation courte de la fiche","bloc":"declencheur"}],"nonTraduites":["phrase non mecanisable"],"deduites":[{"champ":"stop","pourquoi":"..."}],"absents":["stop","objectif","risque","seance","unite_de_temps"]}`;


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

  const echelle = instrumentParCode(instrument)!;
  const r = corps.regles ?? {};
  const dejaExtrait = [
    r.risk_reward != null ? `objectif annonce : ${r.risk_reward}R` : null,
    r.max_sl_pips != null ? `stop maximum annonce : ${r.max_sl_pips} pips` : null,
    r.max_trades_per_day != null ? `maximum ${r.max_trades_per_day} trades par jour` : null,
    r.max_consecutive_losses != null ? `arret apres ${r.max_consecutive_losses} pertes d'affilee` : null,
    r.risk_per_trade_pct != null ? `risque par trade declare au profil : ${r.risk_per_trade_pct} %` : null,
    r.sessions?.length ? `seances declarees : ${r.sessions.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const message = `FICHE DU TRADER
"""
${fiche}
"""
${dejaExtrait ? `\nCHAMPS DEJA RENSEIGNES DANS SON PROFIL\n${dejaExtrait}\n` : ""}
Instrument teste : ${instrument}. Fuseau du trader : ${corps.fuseau ?? "Europe/Paris"}.
ECHELLE DE CET INSTRUMENT, pour que tes distances aient un sens : le spread typique vaut ${echelle.spread} points et le glissement ${echelle.glissement} point(s). Une distance utile se compte en MULTIPLES de ces valeurs, jamais en fractions.`;

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODELE,
      max_tokens: 2000,
      /**
       * ⚠️⚠️ LE PREFIXE EST MIS EN CACHE, ET C'EST CE QUI REND LE PLAFOND
       * TENABLE. Mesure du 2026-09-03 : sur 4 987 tokens d'entree, 4 700 sont
       * ce bloc, identique pour tous les traders et tous les appels. On les
       * repayait plein tarif a chaque traduction.
       *
       * ⚠️ TTL DE CINQ MINUTES, PAS UNE HEURE, et c'est un calcul et non une
       * habitude. L'ecriture coute 1,25x l'entree en cinq minutes contre 2x en
       * une heure. Avec une douzaine d'abonnes, une fenetre d'une heure ne
       * serait presque jamais reutilisee par quelqu'un d'autre : on paierait le
       * double a chaque fois pour un cache que personne ne relit. En cinq
       * minutes, c'est le MEME trader qui relit, celui qui reecrit sa fiche et
       * recompile, c'est-a-dire exactement le parcours de cet onglet.
       *
       * Le seuil de rentabilite se calcule : au-dessus de 22 % de relectures,
       * le cache est gagnant. Un trader qui compile deux fois de suite est
       * deja a 50 %.
       */
      system: [{ type: "text", text: SYSTEME, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: message }],
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
    const compile = compilerDepuisModele(json, instrument, echelle.tailleTick);
    return NextResponse.json(compile);
  } catch (err) {
    if (isLowCreditError(err)) await alertLowCreditsOnce();
    console.error("[compiler-strategie] echec:", err);
    return NextResponse.json({ plan: null, reason: "error" });
  }
}
