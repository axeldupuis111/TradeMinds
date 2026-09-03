"use client";

/**
 * BACKTEST DE STRATÉGIE — rejouer ses règles sur des bougies M1 réelles.
 *
 * ── CE QUI A CHANGÉ DEPUIS LE REFUS ─────────────────────────────────────────
 *
 * On a longtemps refusé cette page, et le raisonnement est dans l'en-tête de
 * `lib/projection.ts` : une fiche écrite en français n'est pas mécanisable sans
 * inventer la moitié des seuils. Ce qui était faux, c'était la conclusion, pas
 * le constat. On ne mécanise pas le texte : on offre un CATALOGUE FERMÉ de blocs
 * paramétrés, le compilateur y choisit, et il DÉCLARE ce qu'il n'a pas su
 * traduire. Le danger n'a jamais été de mécaniser, c'était de mécaniser en
 * silence.
 *
 * ⚠️ TOUT TOURNE DANS LE NAVIGATEUR, comme la projection. Les bougies viennent
 * d'un bucket public, le moteur tourne dans un Web Worker. Un backtest ne coûte
 * ni temps de fonction, ni appel IA, quel que soit le nombre de rejeux. Seule la
 * compilation de la fiche passe par le serveur, une fois.
 *
 * ⚠️ L'ÉCRAN N'EST JAMAIS PLUS AFFIRMATIF QUE LE MOTEUR. Sous 100 trades, aucun
 * chiffre de performance n'existe. Au-dessus, l'espérance ne s'affiche jamais
 * sans son intervalle, et « positif » exige que zéro soit hors de l'intervalle.
 *
 * ⚠️ L'AVERTISSEMENT DE PERFORMANCE HYPOTHÉTIQUE EST DU TEXTE VISIBLE, en haut,
 * jamais un lien ni un repli. C'est la règle apprise sur le dossier NinjaTrader,
 * et elle ne se négocie pas.
 */

import { Card, CardTitle } from "@/components/ui/Card";
import StaggerContainer, { StaggerItem } from "@/components/animations/StaggerContainer";
import { EditeurPlan } from "@/components/backtest/EditeurPlan";
import { Resultat } from "@/components/backtest/Resultat";
import { Inspection } from "@/components/backtest/Inspection";
import { Propositions } from "@/components/backtest/Propositions";
import { Modifications } from "@/components/backtest/Modifications";
import { Enregistrer, type EtatControle } from "@/components/backtest/Enregistrer";
import { Versions } from "@/components/backtest/Versions";
import { Robustesse } from "@/components/backtest/Robustesse";
import { ProjectionCarte } from "@/components/backtest/ProjectionCarte";
import { Analyse } from "@/components/backtest/Analyse";
import { Marches } from "@/components/backtest/Marches";
import { Trouver } from "@/components/backtest/Trouver";
import { Methode } from "@/components/backtest/Methode";
import { Completude } from "@/components/backtest/Completude";
import { Condamnation } from "@/components/backtest/Condamnation";
import { Profil } from "@/components/backtest/Profil";
import { Depart } from "@/components/backtest/Depart";
import { CaractereDuMarche } from "@/components/backtest/CaractereDuMarche";
import { Champ, Liste } from "@/components/backtest/Controles";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import {
  INSTRUMENTS,
  categoriesOrdonnees,
  coutsPourInstrument,
  instrumentParCode,
  type Instrument,
} from "@/lib/backtest/instruments";
import { graviteDuChamp, socleDePlan, type Couverture } from "@/lib/backtest/compilation";
import { moisEntre } from "@/lib/backtest/chargement";
import {
  annulerModification,
  CLES_PAR_LEVIER,
  comparerPlans,
  demandeUnControle,
  DESCRIPTEURS,
  empreintePlan,
  toutAnnuler,
  type Origine,
} from "@/lib/backtest/modifications";
import {
  fenetreDeTestSuggeree,
  MOIS_MIN_CONTROLE,
  periodeIntacte,
} from "@/lib/backtest/hors-periode";
import {
  composerBloc,
  ecrireDansLaFiche,
  repartirDansLaFiche,
  sansLeBlocDeBacktest,
} from "@/lib/backtest/fiche-reglages";
import {
  composerBlocPlan,
  ecrireLePlanDansLaFiche,
  lireBlocPlan,
  sansLeBlocDePlan,
} from "@/lib/backtest/fiche-plan";
import { methodeParCode } from "@/lib/backtest/methodes";
import { composerDepart, departsPossibles, type Depart as UnDepart } from "@/lib/backtest/depart";
import { CODES_QUESTIONS, evaluerCompletude } from "@/lib/backtest/completude";
import { verifierCondamnation } from "@/lib/backtest/condamnation";
import { confronterAuProfil, lireLeProfil, type TradeReel } from "@/lib/backtest/profil";
import { enregistrerVersion } from "@/lib/backtest/enregistrement";
import { nomDuFichier, tradesEnCsv } from "@/lib/backtest/export-csv";
import { compterUnEssai, lireTentatives } from "@/lib/backtest/tentatives";
import { synthetiser } from "@/lib/backtest/synthese";
import {
  listerVersions,
  supprimerVersion,
  type VersionArchivee,
} from "@/lib/backtest/versions";
import type { PlanExecution } from "@/lib/backtest/types";
import type { LectureBacktest } from "@/lib/backtest/verdict";
import type { Apercu, DemandeBacktest, ReponseBacktest } from "./worker";
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2, Lock, Play, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Période couverte par les données publiées. */
const PERIODE_MIN = "2022-01";
const PERIODE_MAX = "2025-12";
/**
 * Période ouverte au départ.
 *
 * ⚠️ Volontairement PLUS COURTE que ce qui est disponible. Quatre ans de bougies
 * font une trentaine de mégaoctets à télécharger : ouvrir la page sur la
 * fenêtre maximale ferait payer cette attente à quelqu'un qui voulait juste
 * essayer. Le sélecteur, lui, propose tout, et laisser 2022-2023 de côté au
 * premier essai a un autre mérite : ça garde une période intacte pour vérifier
 * ensuite un réglage trouvé sur celle-ci.
 */
const DEBUT_PAR_DEFAUT = "2025-01";

interface StrategieRow {
  id: string;
  name: string | null;
  raw_text: string | null;
  pairs: string[] | null;
  sessions: string[] | null;
  risk_reward: number | null;
  max_sl_pips: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
  risk_per_trade_pct: number | null;
  setup_rules: string[] | null;
}

type Etat =
  | { phase: "repos" }
  | {
      phase: "telechargement";
      faits: number;
      total: number;
      /** Le marché en cours, quand plusieurs se téléchargent à la suite. */
      etape?: import("./worker").EtapeMarche;
    }
  | { phase: "calcul" }
  | { phase: "erreur"; message: string };

/**
 * Le nom du filtre tel qu'il est écrit dans l'éditeur.
 *
 * ⚠️ Jamais le nom technique brut : « biais_moyenne » ne dit rien au trader, et
 * il doit pouvoir faire le lien avec l'interrupteur qu'il vient de cocher.
 */
function nomDuFiltre(type: string, t: (c: string) => string): string {
  const cles: Record<string, string> = {
    bougie_reaction: "bt_conf_reaction",
    biais_moyenne: "bt_conf_moyenne",
    amplitude_min: "bt_conf_amplitude",
    rsi: "bt_conf_rsi",
    macd: "bt_conf_macd",
    stochastique: "bt_conf_stochastique",
    divergence: "bt_conf_divergence",
  };
  return cles[type] ? t(cles[type]) : type;
}

export default function BacktestPage() {
  const { t } = useLanguage();
  const { plan: abonnement } = usePlan();
  const supabase = createClient();
  const estPremium = abonnement === "premium";

  /**
   * `t()` de l'application ne rend qu'une chaine ; l'interpolation se fait par
   * `.replace("{n}", …)` partout ailleurs. On l'enveloppe une fois ici plutot
   * que de chainer trente remplacements dans les composants, ou l'oubli d'un
   * seul laisserait un « {n} » brut a l'ecran.
   */
  const tr = useCallback(
    (cle: string, valeurs?: Record<string, string | number>) => {
      let sortie = t(cle);
      if (valeurs) {
        for (const [nom, valeur] of Object.entries(valeurs)) {
          sortie = sortie.split(`{${nom}}`).join(String(valeur));
        }
      }
      return sortie;
    },
    [t],
  );

  const fuseau = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
    [],
  );

  const [strategies, setStrategies] = useState<StrategieRow[]>([]);
  const [strategieId, setStrategieId] = useState<string>("");
  const [code, setCode] = useState<string>("XAUUSD");
  const [de, setDe] = useState<string>(DEBUT_PAR_DEFAUT);
  const [a, setA] = useState<string>(PERIODE_MAX);

  const instrument: Instrument = instrumentParCode(code) ?? INSTRUMENTS[0];

  const [plan, setPlan] = useState<PlanExecution>(() => ({
    ...socleDePlan("XAUUSD", "Europe/Paris"),
    stop: { type: "extreme_balayage", bufferTicks: 1 },
    objectif: { type: "multiple_r", r: 2 },
    couts: coutsPourInstrument(INSTRUMENTS.find((i) => i.code === "XAUUSD")!),
  }));

  /**
   * LE PLAN TEL QUE LA FICHE LE DÉCRIT, gardé intact pendant que l'autre dérive.
   *
   * ⚠️ SANS LUI, IL N'Y A PAS DE « CE QUE J'AI CHANGÉ ». Un trader nous a écrit
   * avoir accepté une proposition « sans trop savoir ce qu'il a changé » : la
   * page n'avait effectivement aucun point de comparaison, elle n'écrasait
   * qu'un état par un autre. Tout se compare à celui-ci, et jamais à l'état
   * précédent : trois allers-retours sur le même réglage doivent laisser une
   * carte vide, pas six lignes.
   */
  const [planFiche, setPlanFiche] = useState<PlanExecution | null>(null);
  /**
   * Au nom de quel objectif chaque réglage a été changé, quand il vient d'un
   * bouton. ⚠️ Enregistré AU MOMENT DU CLIC : après coup, plus rien ne permet
   * de distinguer un réglage proposé d'un réglage posé à la main.
   */
  const [origines, setOrigines] = useState<Record<string, Origine>>({});

  const [couverture, setCouverture] = useState<Couverture | null>(null);
  /**
   * Interpretations que le trader a marquees « ce n'est pas ca ».
   *
   * ⚠️ Contester ne corrige RIEN tout seul, et c'est volontaire : deviner une
   * seconde fois ce qu'il voulait dire repeterait exactement l'erreur d'origine.
   * Le refus entoure de rouge le bloc concerne dans l'editeur, et c'est lui qui
   * tranche.
   */
  const [contestes, setContestes] = useState<Set<string>>(new Set());
  const [compilation, setCompilation] = useState<"repos" | "encours" | "erreur">("repos");
  const [compilationMsg, setCompilationMsg] = useState<string | null>(null);

  /**
   * LA MÉTHODE DÉCLARÉE ET LES RÉPONSES DU TRADER.
   *
   * ⚠️⚠️ C'EST LA MOITIÉ DE LA PAGE QUI NE DÉPEND D'AUCUN BACKTEST, et c'est
   * celle qui sert au plus grand nombre. Un trader d'orderflow ne verra jamais
   * un chiffre sur sa méthode ; il a exactement les mêmes treize trous à combler
   * qu'un autre, et le même écart entre ce qu'il a écrit et ce qu'il fait.
   */
  const [methodeCode, setMethodeCode] = useState<string>("");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [etatReponses, setEtatReponses] = useState<"repos" | "encours" | "fait" | "erreur">("repos");
  /** Son journal réel, pour confronter ce qu'il a écrit à ce qu'il fait. */
  const [tradesReels, setTradesReels] = useState<TradeReel[] | null>(null);

  const [etat, setEtat] = useState<Etat>({ phase: "repos" });
  const [resultat, setResultat] = useState<{
    lecture: LectureBacktest;
    trades: import("@/lib/backtest/types").TradeSimule[];
    audit: import("@/lib/backtest/types").AuditExecution;
    moisManquants: string[];
    ms: number;
    apercus: Apercu[];
    suggestions: import("@/lib/backtest/suggestions").Suggestion[];
    propositions?: import("@/lib/backtest/propositions").Proposition[];
    concentration: import("@/lib/backtest/robustesse").Concentration | null;
    stabilite?: import("@/lib/backtest/stabilite").Stabilite[];
    projection: import("@/lib/backtest/projection-backtest").ProjectionDuBacktest | null;
    constats: import("@/lib/backtest/coherence-plan").Constat[];
    confluences?: import("@/lib/backtest/confluences").Confluence[];
    marches?: import("@/lib/backtest/marches").ResultatMarche[];
    exploration?: import("./worker").ReponseExploration;
    /** Ne dépend d'aucune stratégie : sert à dire si un stop est dans le bruit. */
    amplitudeBougieTicks?: number;
    /** Le caractère du marché : directionnel ou non, séance marquée ou non. */
    caractere?: import("@/lib/backtest/caractere-marche").CaractereMarche;
    controle?: { de: string; a: string; lecture: LectureBacktest };
    /** Plan, période et instrument sur lesquels ce résultat a été calculé. */
    empreinte: string;
  } | null>(null);

  /**
   * Le plan, la période et l'instrument du résultat affiché.
   *
   * ⚠️ Une ref et pas un état : elle sert à décider, dans le corps de `lancer`,
   * s'il faut effacer le résultat. Un état ne serait pas encore à jour au
   * moment où on en a besoin.
   */
  const empreinteDuResultat = useRef<string | null>(null);

  /**
   * ⚠️ Compteur de rejeux. C'est le garde-fou le plus important de la page et
   * presque aucun outil ne l'affiche : chercher parmi vingt jeux de paramètres
   * celui qui sort le mieux en trouve TOUJOURS un, même dans du bruit pur.
   */
  const [tentatives, setTentatives] = useState(0);
  /** Date du premier essai sur cette stratégie, pour dire « depuis le … ». */
  const [tentativesDepuis, setTentativesDepuis] = useState<string | null>(null);

  /**
   * ⚠️ RELU À CHAQUE CHANGEMENT DE STRATÉGIE, pas seulement au montage. Le
   * compteur vivait dans le seul état de React : un rechargement d'onglet le
   * remettait à zéro et l'alerte de sur-apprentissage ne se déclenchait plus
   * jamais pour quelqu'un qui travaille sa méthode sur plusieurs soirées.
   */
  useEffect(() => {
    if (!strategieId) {
      setTentatives(0);
      setTentativesDepuis(null);
      return;
    }
    const lu = lireTentatives(strategieId);
    setTentatives(lu.n);
    setTentativesDepuis(lu.n > 0 ? lu.depuis : null);
  }, [strategieId]);

  /**
   * LA MÉTHODE ET LES RÉPONSES, RELUES DANS SA FICHE.
   *
   * ⚠️ Elles vivent dans `raw_text`, dans un bloc à part : ses réponses aux
   * treize questions SONT sa stratégie, au même titre que « je risque 1 % par
   * trade » qui y est déjà. Les ranger ailleurs créerait une deuxième fiche que
   * le coach ne lirait pas.
   */
  useEffect(() => {
    const strat = strategies.find((x) => x.id === strategieId);
    const lu = lireBlocPlan(strat?.raw_text ?? "");
    setMethodeCode(lu.methode ?? "");
    setReponses(lu.reponses);
    setEtatReponses("repos");
  }, [strategieId, strategies]);

  /**
   * SON JOURNAL RÉEL.
   *
   * ⚠️⚠️ LE BRANCHEMENT QUI MANQUAIT. Ses heures, ses instruments, son rythme
   * sont dans l'application depuis toujours, et cet onglet mesurait des bougies
   * sans jamais regarder l'homme qui allait les trader.
   *
   * ⚠️ Le client Supabase NE JETTE PAS : un `data` nul est un échec silencieux,
   * pas un journal vide. On garde `null` pour ne rien afficher plutôt que
   * d'annoncer « zéro trade » à quelqu'un qui en a trois cents.
   */
  useEffect(() => {
    if (!estPremium) return;
    let annule = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("trades")
        .select("open_time, pnl, commission, swap, pair")
        .eq("user_id", user.id)
        .not("open_time", "is", null)
        .order("open_time", { ascending: false })
        .limit(500);
      if (annule || !data) return;
      setTradesReels(
        data.map((t) => ({
          ouvertureMs: new Date(t.open_time as string).getTime(),
          // ⚠️ Net de frais, comme partout ailleurs : une perte brute et une
          // perte nette ne se ressemblent pas, et c'est la dispersion des
          // pertes qu'on mesure.
          pnlNet: (t.pnl ?? 0) + (t.commission ?? 0) + (t.swap ?? 0),
          pair: t.pair,
        })),
      );
    })();
    return () => {
      annule = true;
    };
  }, [estPremium, supabase]);


  /**
   * Le trader a-t-il regardé les trades et reconnu sa méthode ?
   *
   * ⚠️ REMIS À FAUX À CHAQUE LANCEMENT. Un plan modifié est une autre stratégie,
   * et une confirmation qui survivrait au changement ne confirmerait plus rien.
   */
  const [verifie, setVerifie] = useState(false);

  const [sauvegarde, setSauvegarde] = useState<"repos" | "encours" | "ok" | "erreur">("repos");

  /**
   * LES VERSIONS DÉJÀ ENREGISTRÉES POUR CETTE STRATÉGIE.
   *
   * ⚠️ `erreur` EST DISTINCT DE « LISTE VIDE », et la distinction n'est pas
   * cosmétique : afficher « aucune version » à quelqu'un qui en a douze lui
   * ferait croire son travail perdu. Le client Supabase ne jette pas, donc rien
   * ne signalerait l'échec si on ne le portait pas explicitement.
   */
  const [versions, setVersions] = useState<VersionArchivee[]>([]);
  const [versionsErreur, setVersionsErreur] = useState(false);
  const [versionsChargement, setVersionsChargement] = useState(false);
  /** Les deux versions cochées pour la comparaison, dans l'ordre du clic. */
  const [comparees, setComparees] = useState<string[]>([]);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  // Le fuseau réel du navigateur remplace le repli une fois monté.
  useEffect(() => {
    setPlan((p) => ({ ...p, contexte: { ...p.contexte, fuseau } }));
  }, [fuseau]);

  useEffect(() => {
    if (!estPremium) return;
    let annule = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("strategies")
        .select(
          "id, name, raw_text, pairs, sessions, risk_reward, max_sl_pips, max_trades_per_day, max_consecutive_losses, risk_per_trade_pct, setup_rules",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      // ⚠️ Le client Supabase NE JETTE PAS : un `data` nul est un échec
      // silencieux, pas une absence de stratégie. On distingue les deux.
      if (!annule && data) setStrategies(data as StrategieRow[]);
    })();
    return () => {
      annule = true;
    };
  }, [estPremium, supabase]);

  /** Change d'instrument : les coûts par défaut suivent, jamais l'inverse. */
  const changerInstrument = useCallback((nouveau: string) => {
    const inst = instrumentParCode(nouveau);
    if (!inst) return;
    setCode(inst.code);
    setPlan((p) => ({ ...p, instrument: inst.code, couts: coutsPourInstrument(inst) }));
    setResultat(null);
  }, []);

  const compiler = useCallback(async () => {
    const strat = strategies.find((s) => s.id === strategieId);
    if (!strat?.raw_text) return;
    setCompilation("encours");
    setCompilationMsg(null);
    try {
      const rep = await fetch("/api/compiler-strategie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // ⚠️⚠️ ON RETIRE CE QUE CET OUTIL A LUI-MÊME ÉCRIT DANS LA FICHE.
          // Vu en vrai : après un enregistrement, le modèle a relu notre bloc
          // et a listé « Largeur du pivot : 10 → 5 » parmi les CINQ RÈGLES de
          // la stratégie du trader, à côté de « je risque 5 % par trade ».
          // L'outil écrivait sa sortie dans la fiche puis la relisait comme si
          // le trader l'avait écrite : à chaque enregistrement, la fiche
          // dérivait un peu plus loin de ce qu'il avait voulu dire.
          // ⚠️⚠️ LES DEUX BLOCS QUE CET OUTIL ÉCRIT SONT RETIRÉS AVANT LA
          // COMPILATION. Le premier avait déjà produit une boucle : le modèle
          // relisait « Largeur du pivot : 10 → 5 » et le listait parmi les cinq
          // règles de la stratégie. Le second porte les réponses du trader, donc
          // sa prose, mais dans NOTRE mise en forme : on ne la lui redonne pas à
          // lire comme si c'était sa fiche.
          raw_text: sansLeBlocDePlan(sansLeBlocDeBacktest(strat.raw_text)),
          instrument: code,
          fuseau,
          regles: {
            pairs: strat.pairs,
            sessions: strat.sessions,
            risk_reward: strat.risk_reward,
            max_sl_pips: strat.max_sl_pips,
            max_trades_per_day: strat.max_trades_per_day,
            max_consecutive_losses: strat.max_consecutive_losses,
            risk_per_trade_pct: strat.risk_per_trade_pct,
            setup_rules: strat.setup_rules,
          },
        }),
      });
      const json = (await rep.json()) as {
        plan?: Partial<PlanExecution>;
        couverture?: Couverture;
        reason?: string;
        /** Rendu par le limiteur : "day" ou "month". */
        scope?: string;
      };

      /**
       * ⚠️⚠️ UN QUOTA ÉPUISÉ N'EST PAS UNE PANNE, ET LE DIRE AINSI FAIT PERDRE
       * DU TEMPS AU TRADER. Vu à l'écran : le plafond mensuel était atteint,
       * l'outil répondait « la traduction a échoué, réessaie dans un instant »,
       * et il a réessayé trois fois. Réessayer ne pouvait pas marcher avant le
       * mois suivant, et chaque tentative consommait un quota journalier.
       *
       * ⚠️ ET SURTOUT : la traduction n'est pas obligatoire. Tout le reste de la
       * page fonctionne sans elle, y compris les treize questions et les frais.
       * Le message doit le dire, sinon un quota épuisé ferme un onglet entier.
       */
      if (rep.status === 429) {
        setCompilation("erreur");
        setCompilationMsg(tr(json.scope === "day" ? "bt_compil_quota_jour" : "bt_compil_quota_mois"));
        return;
      }

      if (!json.plan || !json.couverture) {
        setCompilation("erreur");
        setCompilationMsg(tr(`bt_compil_${json.reason ?? "error"}`));
        return;
      }
      // ⚠️ On FUSIONNE sur le socle sans jamais remplacer un bloc absent par un
      // bloc inventé : ce qui manque reste manquant, et la carte de couverture
      // le dit. Le socle ne fournit que ce que le compilateur ne décide pas
      // (l'instrument, les coûts).
      // ⚠️ ON CONSTRUIT LE PLAN AVANT DE LE POSER, au lieu de le calculer dans
      // le `setPlan`. Il faut le MÊME objet dans deux états : celui qu'on va
      // faire dériver, et celui, intact, auquel tout se comparera. Le calculer
      // deux fois ouvrirait la porte à deux références qui divergent dès le
      // premier clic, et la carte des modifications afficherait des écarts
      // fantômes.
      const compile: PlanExecution = {
        ...plan,
        ...json.plan,
        instrument: code,
        couts: plan.couts,
        stop: json.plan.stop ?? plan.stop,
        objectif: json.plan.objectif ?? plan.objectif,
        contexte: json.plan.contexte ?? plan.contexte,
      };
      // ⚠️ UNE TOLÉRANCE DE TOUCHE À ZÉRO EST UNE IMPASSE MUETTE. Le modèle a
      // consigne de la remplir, mais s'il l'oublie, une droite ne peut plus
      // jamais être touchée une troisième fois : le backtest rend zéro trade sur
      // quatre ans sans que rien ne l'explique. On pose donc une valeur
      // utilisable, et on la DÉCLARE comme toute autre déduction, refusable
      // d'un clic comme les autres.
      const couvertureFinale = { ...json.couverture };
      const niveau = json.plan.niveau;
      // ⚠️ LE SEUIL EST LE SPREAD, PAS ZÉRO. Une tolérance d'alignement plus
      // petite que l'écart achat-vente ne distingue rien du bruit : elle donne
      // le même zéro trade qu'une tolérance nulle, en ayant l'air d'un réglage.
      const toleranceMini = Math.round(instrument.spread / instrument.tailleTick);
      if (niveau?.type === "trendline" && niveau.toleranceTicks < toleranceMini) {
        const parDefaut = Math.max(1, Math.round((instrument.spread * 2) / instrument.tailleTick));
        niveau.toleranceTicks = parDefaut;
        couvertureFinale.deduites = [
          {
            champ: "niveau",
            pourquoi: tr("bt_deduite_tolerance", {
              valeur: (parDefaut * instrument.tailleTick).toFixed(instrument.decimales),
            }),
          },
          ...couvertureFinale.deduites,
        ];
      }

      // ⚠️ POSÉ APRÈS LE RATTRAPAGE DE TOLÉRANCE, et pas avant. La correction
      // ci-dessus modifie `json.plan.niveau` sur place : appliquée après coup,
      // elle glisserait dans un objet déjà rangé dans l'état de React, et la
      // référence intacte porterait une valeur que la fiche n'a jamais dite.
      setPlan(compile);
      // La référence à laquelle tout se comparera. Une copie, pas le même
      // objet : le plan de travail va être remplacé clic après clic, celui-ci
      // ne doit jamais bouger.
      setPlanFiche(structuredClone(compile));
      setOrigines({});
      setSauvegarde("repos");

      setCouverture(couvertureFinale);
      setContestes(new Set());
      setCompilation("repos");
      setResultat(null);
    } catch {
      setCompilation("erreur");
      setCompilationMsg(tr("bt_compil_error"));
    }
  }, [strategies, strategieId, code, fuseau, instrument, plan, tr]);

  /**
   * UN SEUL LANCEMENT, DES MESURES QUI S'AJOUTENT.
   *
   * ⚠️⚠️ SEPT ENDROITS DE LA PAGE APPELAIENT CETTE FONCTION, chacun avec sa
   * combinaison de six arguments positionnels, et chacun repartait de
   * `setResultat(null)`. Mesurer les confluences effaçait les marchés, qui
   * effaçaient le voisinage des réglages : le trader cliquait, quelque chose
   * apparaissait, et ce qu'il avait mesuré avant disparaissait. Son verdict :
   * « je peux appuyer à plein d'endroits, au final je suis perdu ».
   *
   * Deux corrections, et la première est de fond :
   *
   * 1. **Les mesures s'ACCUMULENT** tant que le plan, la période et
   *    l'instrument n'ont pas bougé. Ce qui a déjà été mesuré reste affiché.
   * 2. **Des options nommées.** Six arguments positionnels dont quatre
   *    `undefined` sur chaque appel étaient le symptôme de la même dérive.
   */
  const lancer = useCallback((options: {
    propositions?: boolean;
    fenetre?: { de: string; a: string };
    stabilite?: import("@/lib/backtest/modifications").Modification[];
    confluences?: boolean;
    marches?: string[];
    exploration?: { confirmationDe: string; confirmationA: string };
    controle?: { de: string; a: string };
  } = {}) => {
    const {
      propositions: avecPropositions,
      fenetre,
      stabilite: avecStabilite,
      confluences: avecConfluences,
      marches: avecMarches,
      exploration: avecExploration,
      controle: avecControle,
    } = options;
    if (etat.phase === "telechargement" || etat.phase === "calcul") return;
    workerRef.current?.terminate();

    // ⚠️ LA PÉRIODE PASSE EN ARGUMENT, elle n'est pas relue dans l'état. Le
    // bouton qui raccourcit la fenêtre pose `de`/`a` et relance dans le même
    // geste : relire l'état ici rejouerait l'ANCIENNE période, React n'ayant pas
    // encore rendu. Le trader verrait le même résultat et croirait au bug.
    const depuis = fenetre?.de ?? de;
    const jusqua = fenetre?.a ?? a;

    const compte = compterUnEssai(strategieId);
    const prochaine = compte.n;
    setTentatives(prochaine);
    setTentativesDepuis(compte.depuis);

    // ⚠️ ON N'EFFACE QUE CE QUI NE CORRESPOND PLUS. Le résultat affiché décrit
    // le plan, la période et l'instrument sur lesquels il a été calculé : tant
    // que les trois sont inchangés, il reste juste, et l'effacer ferait
    // clignoter la page à chaque mesure.
    const empreinte = `${empreintePlan(plan)}|${depuis}|${jusqua}|${code}`;
    const memeContexte = empreinte === empreinteDuResultat.current;
    if (!memeContexte) {
      setResultat(null);
      setVerifie(false);
    }
    empreinteDuResultat.current = empreinte;
    setEtat({ phase: "telechargement", faits: 0, total: moisEntre(depuis, jusqua).length });

    const w = new Worker(new URL("./worker.ts", import.meta.url));
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<ReponseBacktest>) => {
      const r = e.data;
      if (r.type === "avancement") {
        setEtat({ phase: "telechargement", faits: r.faits, total: r.total, etape: r.etape });
      }
      else if (r.type === "calcul") setEtat({ phase: "calcul" });
      else if (r.type === "erreur") setEtat({ phase: "erreur", message: r.message });
      else {
        // ⚠️ CE QUI N'A PAS ÉTÉ RECALCULÉ EST CONSERVÉ. Le worker rend
        // `undefined` pour les mesures qu'on ne lui a pas demandées : les
        // écraser avec `undefined` ferait disparaître le travail précédent, ce
        // qui est exactement le défaut qu'on répare.
        setResultat((prec) => ({
          empreinte,
          lecture: r.lecture,
          trades: r.resultat.trades,
          audit: r.resultat.audit,
          moisManquants: r.moisManquants,
          ms: r.ms,
          apercus: r.apercus,
          suggestions: r.suggestions,
          concentration: r.concentration,
          projection: r.projection,
          constats: r.constats,
          amplitudeBougieTicks: r.amplitudeBougieTicks,
          caractere: r.caractere,
          propositions: r.propositions ?? (memeContexte ? prec?.propositions : undefined),
          stabilite: r.stabilite ?? (memeContexte ? prec?.stabilite : undefined),
          confluences: r.confluences ?? (memeContexte ? prec?.confluences : undefined),
          marches: r.marches ?? (memeContexte ? prec?.marches : undefined),
          exploration: r.exploration ?? (memeContexte ? prec?.exploration : undefined),
          controle: r.controle ?? (memeContexte ? prec?.controle : undefined),
        }));
        setEtat({ phase: "repos" });
      }
    };
    const demande: DemandeBacktest = {
      code,
      de: depuis,
      a: jusqua,
      plan,
      couts: plan.couts,
      tentatives: prochaine,
      propositions: avecPropositions,
      stabilite: avecStabilite,
      confluences: avecConfluences,
      marches: avecMarches,
      exploration: avecExploration,
      controle: avecControle,
      // ⚠️ La fiche voyage avec la demande : sans elle, impossible de dire
      // « ta fiche annonce trois trades par jour et ta méthode en produit
      // quinze », qui est le constat le plus utile de tout l'écran.
      fiche: (() => {
        const strat = strategies.find((x) => x.id === strategieId);
        return strat
          ? {
              pairs: strat.pairs,
              risk_reward: strat.risk_reward,
              max_trades_per_day: strat.max_trades_per_day,
            }
          : undefined;
      })(),
    };
    w.postMessage(demande);
  }, [etat.phase, strategieId, strategies, de, a, code, plan]);

  /**
   * Poser un plan venu d'un BOUTON, en retenant au nom de quoi.
   *
   * ⚠️ L'OBJECTIF SE NOTE ICI OU JAMAIS. Une fois le plan remplacé, plus rien
   * dans les données ne distingue un réglage proposé d'un réglage tapé à la
   * main, et c'est exactement l'information qui manquait au trader qui a écrit
   * ne pas savoir ce qu'il avait accepté.
   */
  const appliquerPropose = useCallback(
    (nouveau: PlanExecution, levier: string, objectif: Origine["objectif"]) => {
      setOrigines((o) => {
        const suite = { ...o };
        for (const cle of CLES_PAR_LEVIER[levier] ?? []) suite[cle] = { levier, objectif };
        return suite;
      });
      setPlan(nouveau);
      // Même règle qu'ailleurs : le chiffre affiché ne correspondrait plus au
      // plan visible, et un écart entre les deux est la pire chose qui puisse
      // arriver à cette page.
      setResultat(null);
    },
    [],
  );

  /**
   * Poser un plan modifié À LA MAIN dans l'éditeur.
   *
   * ⚠️ Ce qu'on retouche soi-même cesse d'être « proposé pour ». Sans cet
   * oubli, un réglage repris à la main garderait l'étiquette de la proposition
   * qui l'avait posé, et la carte attribuerait à l'outil un choix du trader.
   */
  const appliquerManuel = useCallback(
    (nouveau: PlanExecution) => {
      setOrigines((o) => {
        const suite = { ...o };
        for (const d of DESCRIPTEURS) {
          if (d.lire(plan) !== d.lire(nouveau)) delete suite[d.cle];
        }
        return suite;
      });
      setPlan(nouveau);
    },
    [plan],
  );

  const rafraichirVersions = useCallback(async () => {
    if (!strategieId) {
      setVersions([]);
      setVersionsErreur(false);
      return;
    }
    setVersionsChargement(true);
    const r = await listerVersions(supabase, strategieId);
    setVersionsChargement(false);
    if (r.ok) {
      setVersions(r.versions);
      setVersionsErreur(false);
    } else {
      // ⚠️ ON N'EFFACE PAS LA LISTE EN MÉMOIRE. Une lecture ratée ne veut pas
      // dire que les versions ont disparu ; les remplacer par du vide ferait
      // clignoter l'écran vers « tu n'as rien enregistré ».
      setVersionsErreur(true);
    }
  }, [supabase, strategieId]);

  useEffect(() => {
    void rafraichirVersions();
    setComparees([]);
  }, [rafraichirVersions]);

  /**
   * ⚠️ DEUX AU PLUS, ET LA PLUS ANCIENNE SORT. Une comparaison à trois n'existe
   * pas : l'intervalle de la différence se calcule entre DEUX mesures, et
   * empiler des colonnes transformerait l'écran en tableau de classement, qui
   * est exactement ce qu'on refuse ici.
   */
  const basculerComparaison = useCallback((id: string) => {
    setComparees((actuels) => {
      if (actuels.includes(id)) return actuels.filter((x) => x !== id);
      return [...actuels, id].slice(-2);
    });
  }, []);

  const supprimerUneVersion = useCallback(
    async (v: VersionArchivee) => {
      const r = await supprimerVersion(supabase, v.id);
      if (!r.ok) {
        setVersionsErreur(true);
        return;
      }
      setVersions((liste) => liste.filter((x) => x.id !== v.id));
      setComparees((actuels) => actuels.filter((x) => x !== v.id));
    },
    [supabase],
  );

  /**
   * Reprendre le plan d'une version.
   *
   * ⚠️ LA RÉFÉRENCE NE BOUGE PAS. `planFiche` reste ce que la fiche décrit :
   * reprendre un ancien essai doit faire réapparaître son écart avec la fiche,
   * pas le faire passer pour la nouvelle normale. On efface en revanche le
   * résultat et le contrôle, qui portaient sur un autre plan.
   */
  const reprendreVersion = useCallback((v: VersionArchivee) => {
    setPlan(v.plan);
    setCode(v.instrument);
    setDe(v.de);
    setA(v.a);
    setOrigines({});
    setResultat(null);
    setSauvegarde("repos");
  }, []);

  /**
   * Les marchés qu'on accepte de comparer au sien.
   *
   * ⚠️ MÊME CATÉGORIE, ET C'EST UNE CONDITION DE SENS. Transposer une méthode
   * d'indice vers une crypto passerait la règle d'échelle sans broncher et ne
   * voudrait rien dire : ce ne sont ni les mêmes heures d'ouverture, ni les
   * mêmes participants, ni la même façon de bouger. « Comparable » veut dire
   * quelque chose, sinon la mesure ne veut rien dire non plus.
   *
   * ⚠️ BORNÉ À CINQ, LE SIEN COMPRIS. Chaque marché de plus est une profondeur
   * de bougies à télécharger, et surtout une occasion de plus de trouver celui
   * qui sort bien par hasard.
   */
  const marchesComparables = useMemo(() => {
    const autres = INSTRUMENTS.filter(
      (i) => i.categorie === instrument.categorie && i.code !== instrument.code,
    ).map((i) => i.code);
    return [instrument.code, ...autres].slice(0, 5);
  }, [instrument]);

  /**
   * CE QUI SÉPARE LA COMBINAISON TROUVÉE DU PLAN MESURÉ EN HAUT DE PAGE.
   *
   * ⚠️⚠️ VU À L'ÉCRAN : la carte de cohérence affirmait « ta règle d'arrêt après
   * 3 pertes ne s'est jamais déclenchée » pendant que le plan trouvé, six cartes
   * plus bas, affirmait « elle se serait déclenchée 16 fois ». Les deux étaient
   * exacts, sur deux plans différents, et rien à l'écran ne disait qu'il y en
   * avait deux. Cette liste est ce qui manquait.
   */
  const ecartsDeLaRecherche = useMemo(
    () =>
      resultat?.exploration
        ? comparerPlans(
            plan,
            resultat.exploration.recherche.plan,
            instrument,
            {},
            tr("bt_modif_absent"),
          )
        : [],
    [resultat?.exploration, plan, instrument, tr],
  );

  /** L'écart avec la fiche, recalculé à chaque changement de plan. */
  const modifications = useMemo(
    () =>
      planFiche
        ? comparerPlans(planFiche, plan, instrument, origines, tr("bt_modif_absent"))
        : [],
    [planFiche, plan, instrument, origines, tr],
  );

  /**
   * La fenêtre intacte, et le contrôle qui la rejoue.
   *
   * ⚠️ CE REJEU N'INCRÉMENTE PAS LE COMPTEUR DE TENTATIVES, et la distinction
   * est de fond. Le compteur mesure combien de fois on a cherché un réglage qui
   * sorte mieux ; celui-ci ne cherche rien, il vérifie un plan déjà arrêté sur
   * des mois qui n'ont servi à rien. Le compter comme un essai découragerait la
   * seule chose qu'on veut encourager.
   */
  const fenetreIntacte = useMemo(
    () => periodeIntacte(de, a, PERIODE_MIN, PERIODE_MAX),
    [de, a],
  );

  /**
   * La fenêtre de test à proposer quand il n'en reste aucune d'intacte.
   *
   * ⚠️ SANS ELLE, LA RÈGLE EST UN MUR. Vu en vrai sur la preview : un trader
   * teste sur les quatre ans disponibles, il ne reste rien à contrôler, et le
   * bouton d'enregistrement ne se débloque plus jamais. Le garde-fou doit avoir
   * une porte, sinon il ne protège de rien : il empêche seulement de finir.
   */
  const periodeSuggeree = useMemo(() => fenetreDeTestSuggeree(PERIODE_MIN, PERIODE_MAX), []);

  /**
   * TOUTES LES MESURES LOURDES, EN UNE SEULE PASSE.
   *
   * ⚠️⚠️ ELLES AVAIENT CHACUNE LEUR BOUTON, ET CHACUNE EFFAÇAIT LES AUTRES.
   * Confluences, voisinage des réglages, autres marchés, contrôle hors période :
   * quatre boutons, quatre lancements, et à chaque fois le résultat des trois
   * autres disparaissait. C'est ce qui rendait la page impraticable, bien avant
   * le nombre de cartes.
   *
   * Elles partent maintenant ensemble, avec une seule barre de progression. Ça
   * dure plusieurs minutes, et c'est annoncé : mieux vaut une attente qu'on
   * comprend que quatre attentes qui se défont.
   */
  const analyserAFond = useCallback(() => {
    lancer({
      // ⚠️ Les propositions partent avec le reste : c'était le dernier bouton
      // isolé, donc la dernière façon d'effacer le travail des autres.
      propositions: true,
      confluences: true,
      stabilite: modifications,
      marches: marchesComparables,
      controle:
        fenetreIntacte && fenetreIntacte.mois >= MOIS_MIN_CONTROLE
          ? { de: fenetreIntacte.de, a: fenetreIntacte.a }
          : undefined,
    });
  }, [lancer, modifications, marchesComparables, fenetreIntacte]);


  const raccourcirEtRelancer = useCallback(
    (f: { de: string; a: string }) => {
      setDe(f.de);
      setA(f.a);
      // On relance dans la foulée, avec la nouvelle fenêtre passée en argument :
      // demander au trader de recliquer « Lancer » après lui avoir fait cliquer
      // ici serait une marche de plus sur un chemin déjà long.
      lancer({ fenetre: f });
    },
    [lancer],
  );

  /**
   * Le résultat affiché décrit-il encore le plan à l'écran ?
   *
   * ⚠️⚠️ UN SEUL DRAPEAU POUR TOUTE LA PAGE, et c'est la simplification qui
   * compte. Chaque carte gardait sa propre notion de « périmé », avec sa propre
   * empreinte : le contrôle pouvait être déclaré caduc pendant que le verdict
   * d'à côté, calculé sur le même plan, restait affiché comme valable. Une seule
   * comparaison, un seul message, en haut.
   */
  const resultatPerime =
    resultat != null &&
    resultat.empreinte !== `${empreintePlan(plan)}|${de}|${a}|${code}`;

  /**
   * DE QUOI ÉLARGIR LA PÉRIODE SANS QUITTER L'ÉCRAN.
   *
   * ⚠️⚠️ L'ÉCRAN NOMMAIT LA BONNE ACTION ET NE L'OFFRAIT PAS. Sous le seuil de
   * conclusion, le diagnostic dit « élargis la période avant de toucher aux
   * réglages : c'est le seul changement qui n'invente rien », et les seuls
   * boutons proposés en dessous étaient des changements de réglage. Le mouvement
   * recommandé demandait de remonter en haut de page et de deviner quoi changer.
   *
   * ⚠️ `null` quand elle couvre déjà tout : un bouton qui ne change rien est
   * pire qu'aucun bouton.
   */
  const periodePlusLarge = useMemo(() => {
    if (de === PERIODE_MIN && a === PERIODE_MAX) return null;
    return {
      de: PERIODE_MIN,
      a: PERIODE_MAX,
      mois: moisEntre(PERIODE_MIN, PERIODE_MAX).length,
      elargir: () => {
        setDe(PERIODE_MIN);
        setA(PERIODE_MAX);
        setResultat(null);
      },
    };
  }, [de, a]);

  /**
   * Le contrôle hors période, tel que la carte d'enregistrement l'attend.
   *
   * ⚠️ Il vient désormais du MÊME lancement que le résultat : il ne peut plus
   * décrire un autre plan que lui, et son état se déduit, il ne se stocke plus.
   */
  const controleAffiche: EtatControle = useMemo(() => {
    if (etat.phase !== "repos") return { phase: "encours" };
    const c = resultat?.controle;
    if (!c) return { phase: "repos" };
    return {
      phase: "fait",
      fenetre: { de: c.de, a: c.a, mois: moisEntre(c.de, c.a).length },
      lecture: c.lecture,
      valide: !resultatPerime,
    };
  }, [resultat, etat.phase, resultatPerime]);
  const controleValide = controleAffiche.phase === "fait" && controleAffiche.valide;

  const strategieCourante = strategies.find((s) => s.id === strategieId);

  /**
   * LA MOITIÉ DE LA PAGE QUI NE DÉPEND D'AUCUN BACKTEST.
   *
   * ⚠️⚠️ TOUT CE QUI SUIT SE CALCULE AVANT D'AVOIR LANCÉ QUOI QUE CE SOIT, et
   * c'est le point de la refonte. La complétude du plan, ce que les frais
   * exigent, l'écart avec son journal : trois réponses certaines pour un trader
   * dont la méthode ne sera peut-être jamais rejouable.
   */
  const methode = useMemo(() => methodeParCode(methodeCode), [methodeCode]);

  const completude = useMemo(
    () =>
      evaluerCompletude({
        plan: couverture ? plan : undefined,
        fiche: strategieCourante
          ? {
              pairs: strategieCourante.pairs,
              sessions: strategieCourante.sessions,
              riskReward: strategieCourante.risk_reward,
              maxSlPips: strategieCourante.max_sl_pips,
              maxTradesParJour: strategieCourante.max_trades_per_day,
              maxPertesConsecutives: strategieCourante.max_consecutive_losses,
              risqueParTradePct: strategieCourante.risk_per_trade_pct,
              reglesSetup: strategieCourante.setup_rules,
            }
          : undefined,
        reponses,
        methode,
      }),
    [couverture, plan, strategieCourante, reponses, methode],
  );

  /**
   * ⚠️ LE RISQUE MOYEN VIENT D'UN REJEU QUAND IL Y EN A EU UN, sinon du stop du
   * plan quand il est à distance fixe. Jamais d'une valeur devinée : les lignes
   * qui en dépendent disparaissent plutôt que d'être fausses.
   */
  const condamnations = useMemo(() => {
    const mois = moisEntre(de, a).length;
    const trades = resultat?.lecture.stats?.nbTrades;
    return verifierCondamnation({
      plan,
      couts: plan.couts,
      risqueMoyenTicks: resultat?.lecture.couts?.risqueMoyenTicks,
      // ⚠️ Le coût vraiment payé, quand il a été mesuré : il dépasse le coût
      // théorique de 40 % environ, parce qu'un coût fixe en points pèse plus
      // lourd sur les trades à stop serré.
      coutParTradeMesureR: resultat?.lecture.couts?.coutParTradeR,
      amplitudeBougieTicks: resultat?.amplitudeBougieTicks,
      tradesParAn: trades && mois > 0 ? (trades * 12) / mois : undefined,
    });
  }, [plan, resultat, de, a]);

  const profilLu = useMemo(
    () => (tradesReels ? lireLeProfil(tradesReels, fuseau) : null),
    [tradesReels, fuseau],
  );

  const constatsProfil = useMemo(
    () => (profilLu ? confronterAuProfil(plan, profilLu, instrument) : []),
    [profilLu, plan, instrument],
  );

  /**
   * SES HEURES RÉELLES, POUR MONTER DES BASES QU'IL POURRA SUIVRE.
   *
   * ⚠️ Proposer une méthode d'ouverture de Londres à quelqu'un qui n'allume son
   * écran qu'à 20 h, c'est proposer une méthode qu'il ne prendra jamais. On
   * garde la plage qui couvre le gros de ses trades, bornée à l'heure pleine.
   */
  const heuresReelles = useMemo(() => {
    if (!profilLu || profilLu.trades < 30) return undefined;
    const heures = profilLu.parHeure
      .map((n, h) => ({ n, h }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    if (heures.length === 0) return undefined;
    // Les heures qui portent 80 % de ses trades, prises de la plus chargée à la
    // moins chargée, puis refermées en une plage continue.
    const cible = profilLu.trades * 0.8;
    let cumul = 0;
    const gardees: number[] = [];
    for (const x of heures) {
      gardees.push(x.h);
      cumul += x.n;
      if (cumul >= cible) break;
    }
    const min = Math.min(...gardees);
    const max = Math.max(...gardees);
    return {
      debut: `${String(min).padStart(2, "0")}:00`,
      fin: `${String(Math.min(23, max + 1)).padStart(2, "0")}:00`,
    };
  }, [profilLu]);

  /**
   * LES BASES PROFESSIONNELLES COMPLÈTES QU'ON PEUT LUI PROPOSER.
   *
   * ⚠️⚠️ NÉES DE LA CRITIQUE LA PLUS DURE : « il dit que ma stratégie n'est pas
   * rentable, il ne trouve pas de moyen de l'améliorer, donc inutile d'utiliser
   * le backtest à part pour se démotiver ». La recherche partait toujours de SON
   * plan, et une descente par coordonnées qui part d'un mauvais point reste dans
   * le mauvais coin. Le référentiel, lui, contenait des méthodes complètes que
   * rien n'avait jamais essayées.
   */
  const departs = useMemo(
    () =>
      departsPossibles(instrument)
        .map((m) =>
          composerDepart(m, instrument, plan.couts, fuseau, {
            heures: heuresReelles,
            risqueParTradePct: plan.gestion.risqueParTradePct,
            maxTradesParJour: plan.gestion.maxTradesParJour,
            maxPertesConsecutives: plan.gestion.maxPertesConsecutives,
          }),
        )
        .filter((d): d is UnDepart => d != null),
    [instrument, plan.couts, plan.gestion, fuseau, heuresReelles],
  );

  /**
   * Essaie une base : elle remplace les réglages du test, et on relance.
   *
   * ⚠️ ELLE COMPTE COMME UN ESSAI, comme n'importe quel changement de plan. En
   * essayer huit et garder la meilleure serait le sur-apprentissage habituel,
   * simplement déplacé d'un cran.
   */
  const essayerUnDepart = useCallback(
    (d: UnDepart) => {
      setPlan(d.plan);
      setOrigines({});
      setResultat(null);
      setSauvegarde("repos");
      setMethodeCode(d.methode.code);
    },
    [],
  );

  /**
   * Bascule le test sur le marché qu'il trade vraiment.
   *
   * ⚠️⚠️ LE MOUVEMENT LE PLUS UTILE DE TOUT L'ÉCRAN, ET IL N'EXISTAIT PAS. La
   * carte disait « tu testes le Nasdaq mais 92 % de tes trades sont sur l'or »
   * depuis le début, sans jamais proposer de tester sur l'or.
   */
  const marcheReelTestable = useMemo(() => {
    const code = constatsProfil.find((c) => c.marcheACodeTester)?.marcheACodeTester;
    if (!code) return null;
    // Le journal écrit « XAUUSD.r » ou « GOLD » selon le courtier : on cherche
    // celui de nos instruments dont le code est contenu dans le sien.
    const trouve = INSTRUMENTS.find((i) => code.includes(i.code) || i.code.includes(code));
    return trouve ?? null;
  }, [constatsProfil]);

  /**
   * Enregistre ses réponses dans sa fiche.
   *
   * ⚠️ LE CLIENT SUPABASE NE JETTE PAS : un `update` sans `.select()` rend
   * `{ ok: true }` même quand aucune ligne n'a bougé. On exige la preuve.
   */
  const enregistrerLesReponses = useCallback(
    async (nouvelles: Record<string, string>) => {
      const strat = strategies.find((x) => x.id === strategieId);
      if (!strat) return;
      setEtatReponses("encours");

      const bloc = composerBlocPlan({
        titre: tr("bt_comp_entete", { date: new Date().toLocaleDateString() }),
        methode: methodeCode || undefined,
        reponses: nouvelles,
        intitules: Object.fromEntries(CODES_QUESTIONS.map((c) => [c, tr(`bt_q_${c}`)])),
      });
      const rawText = ecrireLePlanDansLaFiche(strat.raw_text ?? "", bloc);

      const { data, error } = await supabase
        .from("strategies")
        .update({ raw_text: rawText })
        .eq("id", strategieId)
        .select("id");

      if (error || !data || data.length === 0) {
        setEtatReponses("erreur");
        return;
      }
      setReponses(nouvelles);
      setStrategies((liste) =>
        liste.map((x) => (x.id === strategieId ? { ...x, raw_text: rawText } : x)),
      );
      setEtatReponses("fait");
    },
    [strategies, strategieId, methodeCode, supabase, tr],
  );

  /**
   * ⚠️ CHANGER DE MÉTHODE ÉCRIT AUSSI DANS LA FICHE, sinon le choix disparaît
   * au prochain chargement et le trader le refait à chaque visite.
   */
  const choisirLaMethode = useCallback(
    (nouveau: string) => {
      setMethodeCode(nouveau);
      const strat = strategies.find((x) => x.id === strategieId);
      if (!strat) return;
      const bloc = composerBlocPlan({
        titre: tr("bt_comp_entete", { date: new Date().toLocaleDateString() }),
        methode: nouveau || undefined,
        reponses,
        intitules: Object.fromEntries(CODES_QUESTIONS.map((c) => [c, tr(`bt_q_${c}`)])),
      });
      const rawText = ecrireLePlanDansLaFiche(strat.raw_text ?? "", bloc);
      void supabase
        .from("strategies")
        .update({ raw_text: rawText })
        .eq("id", strategieId)
        .select("id")
        .then(({ data, error }) => {
          if (error || !data || data.length === 0) return;
          setStrategies((liste) =>
            liste.map((x) => (x.id === strategieId ? { ...x, raw_text: rawText } : x)),
          );
        });
    },
    [strategies, strategieId, reponses, supabase, tr],
  );

  /**
   * L'ÉTAT DES LIEUX, assemblé à partir de tout ce qui a déjà été mesuré.
   *
   * ⚠️ AUCUN CALCUL DE PLUS. La synthèse ne relance rien : elle rassemble le
   * verdict, la décomposition dans le temps, le contrôle hors période, la forme
   * du réglage, le compteur d'essais et les constats de cohérence. C'est
   * volontaire : une synthèse qui aurait ses propres chiffres finirait par
   * contredire les cartes qu'elle résume.
   */
  const synthese = useMemo(
    () =>
      resultat
        ? synthetiser({
            lecture: resultat.lecture,
            concentration: resultat.concentration,
            stabilite: resultat.stabilite,
            horsPeriode:
              controleAffiche.phase === "fait" && controleAffiche.valide
                ? { lecture: controleAffiche.lecture }
                : null,
            constats: resultat.constats,
            tentatives,
            // ⚠️ Le balayage compte autant que les rejeux lancés à la main.
            combinaisonsExplorees: resultat.exploration?.recherche.essais,
          })
        : null,
    [resultat, controleAffiche, tentatives],
  );

  /** Le texte exact qui ira dans la fiche, montré avant d'écrire quoi que ce soit. */
  const blocFiche = useMemo(() => {
    if (modifications.length === 0 || !resultat) return "";
    return composerBloc({
      titre: tr("bt_sauver_entete", { date: new Date().toLocaleDateString() }),
      lignes: modifications.map(
        (m) =>
          `${tr(`bt_modif_${m.cle}`)} : ${m.avant} → ${m.apres}. ` +
          tr(`bt_geste_${m.cle}`, { avant: m.avant, apres: m.apres }),
      ),
      mesure: tr("bt_sauver_mesure", {
        instrument: instrument.nom,
        de,
        a,
        trades: resultat.trades.length,
      }),
      controle:
        controleValide && controleAffiche.phase === "fait"
          ? tr("bt_sauver_controle", {
              periode: `${controleAffiche.fenetre.de} → ${controleAffiche.fenetre.a}`,
            })
          : undefined,
      avertissement: tr("bt_modif_avertissement"),
    });
  }, [modifications, resultat, instrument, de, a, controleValide, controleAffiche, tr]);

  const repartition = useMemo(
    () =>
      repartirDansLaFiche(modifications, {
        risque_par_trade: plan.gestion.risqueParTradePct,
        pertes_daffilee: plan.gestion.maxPertesConsecutives,
        trades_par_jour: plan.gestion.maxTradesParJour,
        objectif_r: plan.objectif.type === "multiple_r" ? plan.objectif.r : null,
      }),
    [modifications, plan],
  );

  const enregistrer = useCallback(async () => {
    if (!strategieCourante || !resultat || !planFiche) return;
    // ⚠️ LE CONTRÔLE N'EST EXIGÉ QUE S'IL A UN SENS. Le refuser aussi quand rien
    // n'a bougé côté trades bloquait l'enregistrement d'un simple changement de
    // risque par trade, que le moteur ne lit même pas : le bouton s'affichait
    // actif et ne faisait rien. Un bouton muet est pire qu'un bouton gris.
    const controleFait = controleAffiche.phase === "fait" && controleAffiche.valide;
    if (demandeUnControle(modifications) && !controleFait) return;
    setSauvegarde("encours");

    const rawText = ecrireDansLaFiche(strategieCourante.raw_text ?? "", blocFiche);
    const stats = resultat.lecture.stats;
    const statsControle = controleAffiche.phase === "fait" ? controleAffiche.lecture.stats : undefined;

    const r = await enregistrerVersion(supabase, {
      strategieId: strategieCourante.id,
      instrument: code,
      de,
      a,
      plan,
      modifications,
      resume: {
        verdict: resultat.lecture.verdict,
        trades: resultat.trades.length,
        esperanceR: stats?.esperanceR ?? null,
        borneBasse: stats?.borneBasse ?? null,
        borneHaute: stats?.borneHaute ?? null,
        tentatives,
      },
      // ⚠️ `null` quand il n'a pas eu lieu, et l'archive le dira ainsi. Inscrire
      // un contrôle vide ferait passer pour vérifiée une version qui ne l'est pas.
      controle:
        controleAffiche.phase === "fait" && controleAffiche.valide
          ? {
              de: controleAffiche.fenetre.de,
              a: controleAffiche.fenetre.a,
              trades: statsControle?.nbTrades ?? 0,
              esperanceR: statsControle?.esperanceR ?? null,
              borneBasse: statsControle?.borneBasse ?? null,
              borneHaute: statsControle?.borneHaute ?? null,
              verdict: controleAffiche.lecture.verdict,
            }
          : null,
      rawText,
      colonnes: repartition.colonnes,
    });

    if (!r.ok) {
      setSauvegarde("erreur");
      return;
    }
    setSauvegarde("ok");
    // ⚠️ LA FICHE EN MÉMOIRE DOIT SUIVRE CELLE EN BASE. Sans ça, un second
    // enregistrement repartirait du texte d'avant et effacerait le premier.
    setStrategies((liste) =>
      liste.map((s) => (s.id === strategieCourante.id ? { ...s, raw_text: rawText } : s)),
    );
    // Ces réglages sont désormais ceux de la fiche : ils cessent d'être un
    // écart. La carte doit le dire, sinon le trader croit son enregistrement
    // sans effet et recommence.
    setPlanFiche(structuredClone(plan));
    setOrigines({});
    // La version vient d'être archivée : la liste doit la montrer tout de suite,
    // sinon le trader doute que l'enregistrement ait fait quelque chose.
    void rafraichirVersions();
  }, [
    rafraichirVersions,
    strategieCourante,
    resultat,
    planFiche,
    controleAffiche,
    blocFiche,
    supabase,
    code,
    de,
    a,
    plan,
    modifications,
    tentatives,
    repartition,
  ]);

  /**
   * Télécharge la liste complète des trades.
   *
   * ⚠️ CE N'EST PAS UN CONFORT. La page demande au trader de reconnaître sa
   * méthode dans une douzaine d'aperçus dessinés ; sur six cents trades, douze
   * ne sont qu'un échantillon. Qui veut vraiment vérifier doit pouvoir ouvrir la
   * liste entière et la confronter à ses propres captures.
   */
  const exporterCsv = useCallback(() => {
    if (!resultat) return;
    const csv = tradesEnCsv(
      resultat.trades,
      instrument,
      {
        date: tr("bt_csv_date"),
        sens: tr("bt_csv_sens"),
        entree: tr("bt_csv_entree"),
        sortie: tr("bt_csv_sortie"),
        stop: tr("bt_csv_stop"),
        risque: tr("bt_csv_risque"),
        r: tr("bt_csv_r"),
        rBrut: tr("bt_csv_rbrut"),
        motif: tr("bt_csv_motif"),
        collision: tr("bt_csv_collision"),
      },
      (motif) => tr(`bt_motif_${motif}`),
    );
    // ⚠️ `text/csv` et pas `application/octet-stream` : sur mobile, un type
    // générique fait proposer « ouvrir avec » au lieu d'enregistrer.
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomDuFichier(code, de, a);
    lien.click();
    // Sans révocation, l'objet reste en mémoire tant que l'onglet vit, et un
    // trader qui exporte dix fois garde dix fichiers en RAM.
    URL.revokeObjectURL(url);
  }, [resultat, instrument, code, de, a, tr]);

  if (!estPremium) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="text-center">
          <Lock className="mx-auto h-8 w-8 text-foreground-muted" />
          <h1 className="mt-3 text-xl font-semibold text-foreground">{tr("bt_titre")}</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-foreground-muted">{tr("cap_backtest")}</p>
          <Link
            href="/dashboard/upgrade"
            className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            {tr("upgrade_cta")}
          </Link>
        </Card>
      </div>
    );
  }

  const occupe = etat.phase === "telechargement" || etat.phase === "calcul";
  const moisDisponibles = moisEntre(PERIODE_MIN, PERIODE_MAX);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{tr("bt_titre")}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{tr("bt_sous_titre")}</p>
      </div>

      {/* ⚠️ TEXTE VISIBLE, PAS UN LIEN, PAS UN REPLI. Voir l'en-tête. */}
      <Card className="border-warning/40 bg-warning/[0.06]">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm leading-relaxed text-foreground">{tr("bt_avertissement")}</p>
        </div>
      </Card>

      <StaggerContainer className="space-y-5">
        {/* ── 1. Le périmètre ────────────────────────────────────────────── */}
        <StaggerItem>
          <Card>
            <CardTitle className="mb-4">{tr("bt_etape_perimetre")}</CardTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <Champ label={tr("bt_instrument")}>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  value={code}
                  onChange={(e) => changerInstrument(e.target.value)}
                >
                  {categoriesOrdonnees().map((cat) => (
                    <optgroup key={cat} label={tr(`bt_cat_${cat}`)}>
                      {INSTRUMENTS.filter((i) => i.categorie === cat).map((i) => (
                        <option key={i.code} value={i.code}>
                          {i.nom}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Champ>
              <Champ label={tr("bt_periode_de")}>
                <Liste
                  valeur={de}
                  onChange={(v) => {
                    setDe(v);
                    if (v > a) setA(v);
                    setResultat(null);
                  }}
                  options={moisDisponibles.map((m) => ({ valeur: m, label: m }))}
                />
              </Champ>
              <Champ label={tr("bt_periode_a")}>
                <Liste
                  valeur={a}
                  onChange={(v) => {
                    setA(v);
                    if (v < de) setDe(v);
                    setResultat(null);
                  }}
                  options={moisDisponibles.filter((m) => m >= de).map((m) => ({ valeur: m, label: m }))}
                />
              </Champ>
            </div>
            <p className="mt-3 text-xs text-foreground-muted">
              {tr("bt_donnees_source", { mois: moisEntre(de, a).length })}
            </p>
          </Card>
        </StaggerItem>

        {/* ── 2. Partir de sa fiche ──────────────────────────────────────── */}
        <StaggerItem>
          <Card>
            <CardTitle className="mb-1">{tr("bt_etape_fiche")}</CardTitle>
            <p className="mb-4 text-xs text-foreground-muted">{tr("bt_etape_fiche_aide")}</p>

            {strategies.length === 0 ? (
              <p className="text-sm text-foreground-muted">
                {tr("bt_aucune_strategie")}{" "}
                <Link href="/dashboard/strategy" className="text-accent underline">
                  {tr("bt_creer_strategie")}
                </Link>
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Champ label={tr("bt_ma_strategie")} className="flex-1">
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    value={strategieId}
                    onChange={(e) => setStrategieId(e.target.value)}
                  >
                    <option value="">{tr("bt_choisir")}</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id} disabled={!s.raw_text}>
                        {s.name || tr("bt_sans_nom")}
                        {s.raw_text ? "" : ` — ${tr("bt_sans_texte")}`}
                      </option>
                    ))}
                  </select>
                </Champ>
                <button
                  type="button"
                  onClick={compiler}
                  disabled={!strategieCourante?.raw_text || compilation === "encours"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {compilation === "encours" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {tr("bt_compiler")}
                </button>
              </div>
            )}

            {compilationMsg ? <p className="mt-3 text-sm text-loss">{compilationMsg}</p> : null}
            {couverture ? (
              <CarteCouverture
                couverture={couverture}
                plan={plan}
                contestes={contestes}
                onContester={(champ) =>
                  setContestes((prec) => {
                    const suite = new Set(prec);
                    if (suite.has(champ)) suite.delete(champ);
                    else suite.add(champ);
                    return suite;
                  })
                }
                t={tr}
              />
            ) : null}
          </Card>
        </StaggerItem>

        {/* ── 3. La méthode déclarée, et ce qu'elle exige pour exister ────
            ⚠️⚠️ AVANT TOUT CHIFFRE, ET SANS EN PRODUIRE UN SEUL. Un trader
            d'orderflow sur un CFD peut trouver ici toute son explication sans
            qu'une bougie ait été lue : le volume qu'il regarde est celui des
            clients de son courtier, pas celui du marché. */}
        <StaggerItem>
          <Methode
            code={methodeCode}
            instrument={instrument}
            plan={plan}
            onChoisir={choisirLaMethode}
            t={tr}
          />
        </StaggerItem>

        {/* ── 4. Le plan, de A à Z ────────────────────────────────────────
            ⚠️⚠️ LA SEULE CARTE DE LA PAGE QUI NE SE TROMPE JAMAIS. Toutes les
            autres rendent une estimation entourée d'un intervalle ; celle-ci
            constate qu'une ligne est écrite ou qu'elle ne l'est pas. Et elle
            fonctionne pour une méthode qu'on ne saura jamais rejouer. */}
        <StaggerItem>
          <Completude
            completude={completude}
            reponses={reponses}
            onEnregistrer={(r) => void enregistrerLesReponses(r)}
            peutEnregistrer={Boolean(strategieCourante)}
            etat={etatReponses}
            t={tr}
          />
        </StaggerItem>

        {/* ── 5. Les réglages du test, entièrement modifiables ───────────── */}
        <StaggerItem>
          <Card>
            <CardTitle className="mb-1">{tr("bt_etape_plan")}</CardTitle>
            <p className="mb-4 text-xs text-foreground-muted">{tr("bt_etape_plan_aide")}</p>
            <EditeurPlan
              plan={plan}
              instrument={instrument}
              onChange={appliquerManuel}
              contestes={contestes}
              t={tr}
            />
          </Card>
        </StaggerItem>

        {/* ── 3 bis. Ce qui s'écarte de la fiche ──────────────────────────
            ⚠️ JUSTE SOUS L'ÉDITEUR, et pas en bas de page. Un trader qui vient
            d'appliquer une proposition doit lire ce qu'elle a changé au moment
            où il regarde le réglage, pas trois cartes plus loin. La carte ne
            s'affiche qu'une fois une fiche compilée : sans référence, il n'y a
            rien à comparer, et un « aucun changement » sur un plan bricolé de
            zéro serait un mensonge par construction. */}
        {planFiche ? (
          <StaggerItem>
            <Modifications
              modifications={modifications}
              onAnnuler={(cle) => setPlan(annulerModification(cle, plan, planFiche))}
              onToutAnnuler={() => {
                setPlan(toutAnnuler(plan, planFiche));
                setOrigines({});
              }}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 5 bis. Ce qu'on peut affirmer sans rien lancer ──────────────
            ⚠️⚠️ CES DEUX CARTES SONT AU-DESSUS DU BOUTON, ET C'EST VOLONTAIRE.
            Elles ne demandent aucun backtest : cinq divisions sur ses coûts et
            son risque, et la comparaison de ce qu'il a écrit avec ce que son
            journal montre. Pour un trader dont la méthode n'est pas rejouable,
            c'est tout ce que cette page peut lui donner, et c'est déjà
            beaucoup. */}
        {condamnations.length > 0 ? (
          <StaggerItem>
            <Condamnation constats={condamnations} t={tr} />
          </StaggerItem>
        ) : null}

        {constatsProfil.length > 0 ? (
          <StaggerItem>
            <Profil
              constats={constatsProfil}
              marcheReel={marcheReelTestable}
              onTesterSurSonMarche={changerInstrument}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 5 bis bis. Ce que vaut ce marché, avant toute stratégie ──────
            ⚠️⚠️ « CERTAINES STRATÉGIES SONT ADAPTÉES À DES ACTIFS PRÉCIS »,
            répété plusieurs fois, et l'outil n'en faisait rien. Cette carte
            mesure des propriétés du MARCHÉ sur les bougies seules, sans qu'aucune
            stratégie n'entre dans le calcul, puis les confronte à ce que la
            méthode DÉCLARE exiger. Ce n'est pas chercher le marché qui sort le
            mieux : c'est vérifier qu'on apporte un marteau à un clou. */}
        {resultat?.caractere ? (
          <StaggerItem>
            <CaractereDuMarche
              caractere={resultat.caractere}
              instrument={instrument}
              uniteDeTemps={plan.uniteDeTemps ?? 1}
              methode={methode}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 5 ter. Partir d'une base qui tient debout ────────────────────
            ⚠️⚠️ LA RÉPONSE À « IL NE TROUVE PAS DE MOYEN DE L'AMÉLIORER ». La
            recherche part toujours de SON plan : une descente par coordonnées
            qui démarre d'un mauvais point reste dans le mauvais coin. Ces
            bases-là viennent du référentiel, montées sur son marché, ses heures
            et son risque. Elles ne promettent rien ; elles donnent un point de
            départ complet, ce que l'outil ne savait pas faire. */}
        <StaggerItem>
          <Depart departs={departs} enCours={occupe} onEssayer={essayerUnDepart} t={tr} />
        </StaggerItem>

        {/* ── 6. Lancer ──────────────────────────────────────────────────── */}
        <StaggerItem>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle>{tr("bt_etape_lancer")}</CardTitle>
                <p className="mt-1 text-xs text-foreground-muted">
                  {etat.phase === "telechargement"
                    ? tr("bt_telechargement", { faits: etat.faits, total: etat.total }) +
                      (etat.etape ? ` · ${tr("bt_telechargement_etape", { ...etat.etape })}` : "")
                    : etat.phase === "calcul"
                      ? tr("bt_calcul")
                      : tr("bt_lancer_aide")}
                </p>
              </div>
              <button
                type="button"
                // ⚠️ Pas `onClick={lancer}` : React passerait l'événement en
                // premier argument, et le clic demanderait les propositions
                // sans que personne ne l'ait voulu.
                onClick={() => lancer()}
                disabled={occupe}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {tr("bt_lancer")}
              </button>
            </div>
            {etat.phase === "telechargement" ? (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.round((etat.faits / Math.max(1, etat.total)) * 100)}%` }}
                />
              </div>
            ) : null}
            {etat.phase === "erreur" ? (
              <p className="mt-3 text-sm text-loss">{etat.message}</p>
            ) : null}
          </Card>
        </StaggerItem>

        {/* ── 5. Le résultat ─────────────────────────────────────────────── */}
        {resultat && resultat.apercus.length > 0 ? (
          <StaggerItem>
            <Inspection
              apercus={resultat.apercus}
              instrument={instrument}
              verifie={verifie}
              onVerifie={setVerifie}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {resultat?.propositions ? (
          <StaggerItem>
            <Propositions
              propositions={resultat.propositions}
              instrument={instrument}
              tradesActuels={resultat.trades.length}
              onAppliquer={(p) => appliquerPropose(p.plan, p.levier, p.objectif)}
              t={tr}
            />
          </StaggerItem>
        ) : null}

      {/* ── Ce que les filtres ont réellement écarté ────────────────────
            ⚠️ Placé JUSTE APRÈS les trades et AVANT le chiffre. Un filtre qui
            n'écarte rien équivaut à pas de filtre, et rien dans le rapport ne
            le montrerait : le résultat serait propre, il décrirait simplement
            une autre stratégie que celle décrite dans la fiche. */}
        {resultat && Object.keys(resultat.audit.refusesParFiltre).length > 0 ? (
          <StaggerItem>
            <Card className="p-4 sm:p-5">
              <p className="mb-2 text-sm font-medium text-foreground">{tr("bt_filtres_titre")}</p>
              <ul className="space-y-1 text-xs text-foreground-muted">
                {Object.entries(resultat.audit.refusesParFiltre).map(([type, n]) => (
                  <li key={type} className="tabular-nums">
                    {tr("bt_filtre_effet", {
                      nom: nomDuFiltre(type, tr),
                      n,
                      total: resultat.audit.signauxSoumisAuxFiltres,
                    })}
                  </li>
                ))}
              </ul>
              {/* ⚠️ PAS D'ALERTE SUR UN ÉCHANTILLON MINUSCULE. « 0 refus » sur
                  sept signaux ne dit rien du filtre : sur sept tirages, ne
                  jamais tomber du mauvais côté n'a rien d'étonnant. Crier au
                  filtre inerte là-dessus, ce serait conclure sur trop peu de
                  données, exactement ce que cette page refuse partout ailleurs. */}
              {Object.entries(resultat.audit.refusesParFiltre)
                .filter(([, n]) => n === 0 && resultat.audit.signauxSoumisAuxFiltres >= 30)
                .map(([type]) => (
                  <div
                    key={type}
                    className="mt-3 rounded-lg border border-warning/40 bg-warning/5 p-3"
                  >
                    <p className="text-xs font-medium text-warning">
                      {tr("bt_filtre_inerte_titre")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                      {tr("bt_filtre_inerte", { nom: nomDuFiltre(type, tr) })}
                    </p>
                  </div>
                ))}
            </Card>
          </StaggerItem>
        ) : null}

        {resultat ? (
          <StaggerItem>
            <Resultat
              lecture={resultat.lecture}
              trades={resultat.trades}
              audit={resultat.audit}
              instrument={instrument}
              periode={{ de, a }}
              moisManquants={resultat.moisManquants}
              tentatives={tentatives}
              tentativesDepuis={tentativesDepuis}
              ms={resultat.ms}
              verifie={verifie}
              contestes={contestes.size}
              suggestions={resultat.suggestions}
              periodePlusLarge={periodePlusLarge}
              // ⚠️ Une suggestion de réglage voisin ne cherche QUE de quoi
              // remplir l'échantillon : son objectif est donc « avoir plus de
              // trades », et il doit être consigné comme tel.
              onAppliquer={(sug) => appliquerPropose(sug.plan, sug.levier, "plus_de_trades")}
              risqueParTradePct={plan.gestion.risqueParTradePct}
              maxPertesConsecutives={plan.gestion.maxPertesConsecutives}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {resultatPerime ? (
          <StaggerItem>
            <Card className="border-warning/40 bg-warning/[0.06] p-4 sm:p-5">
              <p className="flex items-start gap-2 text-xs font-medium text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {tr("bt_perime_titre")}
              </p>
              <p className="mt-1.5 pl-6 text-xs leading-relaxed text-foreground-muted">
                {tr("bt_perime")}
              </p>
            </Card>
          </StaggerItem>
        ) : null}

        {/* ── 4 ter. Un seul endroit pour lancer ce qui est long ───────────
            ⚠️⚠️ C'EST LA CORRECTION QUI COMPTE. Sept boutons répartis sur sept
            cartes lançaient chacun un test, et chacun effaçait le résultat des
            six autres. Le trader cliquait, quelque chose apparaissait, et son
            travail précédent disparaissait : « je peux appuyer à plein
            d'endroits, au final je suis perdu ». Deux intentions, deux boutons,
            un seul endroit. Toutes les cartes au-dessous ne font qu'AFFICHER. */}
        {resultat ? (
          <StaggerItem>
            <Card className="p-4 sm:p-5">
              <h4 className="text-sm font-semibold text-foreground">{tr("bt_aller_titre")}</h4>
              <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                {tr("bt_aller_intro")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={occupe}
                  onClick={analyserAFond}
                  className="rounded-lg border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {occupe ? tr("bt_aller_encours") : tr("bt_aller_analyser")}
                </button>
                {fenetreIntacte && fenetreIntacte.mois >= MOIS_MIN_CONTROLE ? (
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={() =>
                      lancer({
                        exploration: {
                          confirmationDe: fenetreIntacte.de,
                          confirmationA: fenetreIntacte.a,
                        },
                      })
                    }
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
                  >
                    {occupe ? tr("bt_exp_encours") : tr("bt_exp_lancer")}
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
                {tr("bt_aller_analyser_aide")}
              </p>
            </Card>
          </StaggerItem>
        ) : null}

        {/* ── 4 quater. Ce que la recherche a trouvé ──────────────────────
            ⚠️ EN TÊTE DE TOUT CE QUI SUIT, ET C'EST LE POINT DE LA REFONTE. Le
            trader vient ici avec un seul objectif : trouver quelque chose qui
            tienne et repartir avec un plan à respecter. Les mesures qui suivent
            servent à comprendre pourquoi ; celle-ci répond à la question. */}
        {resultat ? (
          <StaggerItem>
            <Trouver
              exploration={resultat.exploration}
              ecarts={ecartsDeLaRecherche}
              fenetreDeConfirmation={
                fenetreIntacte && fenetreIntacte.mois >= MOIS_MIN_CONTROLE
                  ? { de: fenetreIntacte.de, a: fenetreIntacte.a }
                  : null
              }
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 5. L'analyse de la stratégie ────────────────────────────────
            ⚠️ AVANT LES CHIFFRES DE DÉTAIL, ET C'EST DÉLIBÉRÉ. Un trader nous a
            écrit qu'on lui montrait « des chiffres sans réellement changer sa
            stratégie ». Ce qui répond à sa question (est-ce viable, est-ce
            cohérent, mes confluences servent-elles) doit se lire AVANT la
            décomposition et l'export, pas trois cartes plus bas. */}
        {resultat && synthese ? (
          <StaggerItem>
            <Analyse
              synthese={synthese}
              constats={resultat.constats}
              confluences={resultat.confluences}
              nomDuFiltre={(type) => nomDuFiltre(type, tr)}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 5 ter. La même méthode ailleurs ─────────────────────────────
            ⚠️ Après l'analyse, parce que la question « est-ce que ça tient
            ailleurs » n'a de sens qu'une fois qu'on sait ce que « ça » vaut ici.
            Et avant l'export, parce que c'est une conclusion, pas un détail. */}
        {resultat ? (
          <StaggerItem>
            <Marches
              marches={resultat.marches}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 5 bis. La liste complète, pour la regarder ailleurs ─────────
            ⚠️ Les douze aperçus dessinés ne sont qu'un échantillon. Sur six
            cents trades, quelqu'un qui veut vraiment vérifier doit pouvoir
            ouvrir la liste entière dans son tableur. */}
        {resultat && resultat.trades.length > 0 ? (
          <StaggerItem>
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-foreground-muted">
                  {tr("bt_csv_aide")}
                </p>
                <button
                  type="button"
                  onClick={exporterCsv}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted hover:bg-surface hover:text-foreground"
                >
                  {tr("bt_csv_exporter", { n: resultat.trades.length })}
                </button>
              </div>
            </Card>
          </StaggerItem>
        ) : null}

        {/* ── 5 ter. D'où vient le résultat ───────────────────────────────
            ⚠️ JUSTE APRÈS L'INSPECTION VISUELLE ET AVANT LE VERDICT. Le trader
            doit lire « ton résultat vient d'un seul mois » AVANT le chiffre
            global, pas après : après, le chiffre est déjà installé et la nuance
            arrive trop tard pour changer sa lecture. */}
        {resultat?.concentration ? (
          <StaggerItem>
            <Robustesse
              concentration={resultat.concentration}
              stabilite={resultat.stabilite}
              instrument={instrument}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 5 quater. Le chemin, pas seulement l'espérance ──────────────
            ⚠️ Une espérance par trade ne dit rien du chemin, et c'est le chemin
            qui vide les comptes. Placée après la robustesse : savoir d'où vient
            le résultat passe avant de le prolonger. */}
        {resultat?.projection ? (
          <StaggerItem>
            <ProjectionCarte donnees={resultat.projection} t={tr} />
          </StaggerItem>
        ) : null}

        {/* ── 6 bis. L'historique des versions ────────────────────────────
            ⚠️ IL S'AFFICHE MÊME SANS RÉSULTAT COURANT, contrairement aux cartes
            au-dessus. Un trader qui rouvre la page trois jours plus tard doit
            retrouver ce qu'il avait mesuré avant d'avoir à relancer quoi que ce
            soit : une archive qui exige de refaire le travail pour être lue ne
            sert à rien. */}
        {strategieId ? (
          <StaggerItem>
            <Versions
              versions={versions}
              erreur={versionsErreur}
              chargement={versionsChargement}
              selection={comparees}
              onSelectionner={basculerComparaison}
              onRecharger={reprendreVersion}
              onSupprimer={supprimerUneVersion}
              t={tr}
            />
          </StaggerItem>
        ) : null}

        {/* ── 7. Contrôler ailleurs, puis enregistrer ──────────────────────
            ⚠️ EN DERNIER, ET APRÈS LE VERDICT. C'est le seul endroit de la page
            où un chiffre de backtest sort de l'écran pour entrer dans la façon
            de trader de quelqu'un. Il ne s'ouvre qu'une fois un résultat obtenu
            et une fiche compilée : sans référence, il n'y a rien à enregistrer,
            et sans résultat, il n'y a rien à contrôler. */}
        {resultat && planFiche ? (
          <StaggerItem>
            <Enregistrer
              fenetre={fenetreIntacte}
              periodeSuggeree={periodeSuggeree}
              controleRequis={demandeUnControle(modifications)}
              aDesModifications={modifications.length > 0}
              controle={controleAffiche}
              lectureActuelle={resultat.lecture}
              periode={{ de, a }}
              peutEnregistrer={modifications.length > 0}
              verifie={verifie}
              apercuFiche={blocFiche}
              champsRepris={repartition.repris}
              champsNonRepris={repartition.nonRepris}
              sauvegarde={sauvegarde}
              onRaccourcir={raccourcirEtRelancer}
              onEnregistrer={enregistrer}
              t={tr}
            />
          </StaggerItem>
        ) : null}
      </StaggerContainer>
    </div>
  );
}

/**
 * LA CARTE DE COUVERTURE, qui est le vrai produit de la compilation.
 *
 * ⚠️ Elle affiche autant ce qui A ÉTÉ traduit que ce qui NE L'A PAS ÉTÉ. Un
 * outil qui ne montrerait que la première liste laisserait croire que le chiffre
 * porte sur toute la méthode du trader, ce qui est faux dans presque tous les cas.
 */
/**
 * Ce trou de la fiche a-t-il ete comble dans le plan ?
 *
 * ⚠️ Repond sur ce que le TRADER a pose, pas sur ce que le socle fournit :
 * un stop present parce qu'on l'a mis par defaut n'est pas un stop qu'il a
 * choisi. Seuls les champs qu'il remplit lui-meme comptent ici.
 */
function estComble(champ: string, plan: PlanExecution): boolean {
  if (champ === "risque") return (plan.gestion.risqueParTradePct ?? 0) > 0;
  if (champ === "unite_de_temps") return (plan.uniteDeTemps ?? 1) > 1;
  return false;
}

function CarteCouverture({
  couverture,
  plan,
  contestes,
  onContester,
  t,
}: {
  couverture: Couverture;
  plan: PlanExecution;
  contestes: Set<string>;
  onContester: (champ: string) => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  // ⚠️ LE TRI PAR GRAVITÉ EST LE CŒUR DE CETTE CARTE, et il est né d'un échec
  // précis : deux interprétations fausses, sur le niveau et sur le stop, sont
  // passées inaperçues parce qu'elles voisinaient une note anodine sur le
  // fuseau horaire, dans le même paragraphe gris. Voir `graviteDuChamp`.
  const critiques = couverture.deduites.filter((d) => graviteDuChamp(d.champ) === "critique");
  const mineures = couverture.deduites.filter((d) => graviteDuChamp(d.champ) !== "critique");

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <h4 className="text-sm font-semibold text-foreground">{t("bt_couverture")}</h4>

      {/* ── Les interprétations qui touchent le cœur de la méthode ─────── */}
      {critiques.length > 0 ? (
        <div className="rounded-lg border border-warning/50 bg-warning/[0.07] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t(critiques.length === 1 ? "bt_deduites_critiques_1" : "bt_deduites_critiques", {
              n: critiques.length,
            })}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
            {t("bt_deduites_critiques_note")}
          </p>
          <ul className="mt-2.5 space-y-2">
            {critiques.map((d, i) => (
              <LigneInterpretation
                key={`c-${i}`}
                champ={d.champ}
                pourquoi={d.pourquoi}
                conteste={contestes.has(d.champ)}
                onContester={() => onContester(d.champ)}
                t={t}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {couverture.traduites.length > 0 ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-profit">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t(couverture.traduites.length === 1 ? "bt_traduites_1" : "bt_traduites", {
              n: couverture.traduites.length,
            })}
          </p>
          <ul className="space-y-1 pl-5 text-xs text-foreground-muted">
            {couverture.traduites.map((x, i) => (
              <li key={i}>
                « {x.phrase} » → <span className="font-mono text-foreground">{x.bloc}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {couverture.nonTraduites.length > 0 ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
            <HelpCircle className="h-3.5 w-3.5" />
            {t(
              couverture.nonTraduites.length === 1 ? "bt_non_traduites_1" : "bt_non_traduites",
              { n: couverture.nonTraduites.length },
            )}
          </p>
          <ul className="list-disc space-y-1 pl-8 text-xs text-foreground-muted">
            {couverture.nonTraduites.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <p className="mt-1.5 pl-5 text-[11px] text-foreground-muted/80">
            {t("bt_non_traduites_note")}
          </p>
        </div>
      ) : null}

      {mineures.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground-muted">{t("bt_deduites")}</p>
          <ul className="space-y-2">
            {mineures.map((d, i) => (
              <LigneInterpretation
                key={`m-${i}`}
                champ={d.champ}
                pourquoi={d.pourquoi}
                conteste={contestes.has(d.champ)}
                onContester={() => onContester(d.champ)}
                t={t}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {couverture.absents.length > 0 ? (
        <div className={cn("rounded-lg border border-loss/40 bg-loss/[0.06] p-3")}>
          <p className="text-xs font-medium text-loss">{t("bt_absents")}</p>
          <ul className="mt-1.5 space-y-1 pl-1 text-xs text-foreground">
            {couverture.absents.map((c) => {
              // ⚠️ LA LIGNE NE DISPARAIT PAS QUAND LE TRADER REMPLIT LE CHAMP,
              // elle se coche. Ce que ce bloc constate, c'est que sa FICHE ne
              // dit rien : la valeur qu'il pose ici ne rend pas sa fiche plus
              // complete, et il devrait aller l'y ecrire. La faire disparaitre
              // effacerait le seul rappel qui l'y pousse.
              const comble = estComble(c, plan);
              return (
                <li key={c} className="flex items-start gap-1.5">
                  {comble ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
                  ) : (
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
                  )}
                  <span className={comble ? "text-foreground-muted line-through" : undefined}>
                    {t(`bt_absent_${c}`)}
                  </span>
                  {comble ? (
                    <span className="text-[11px] text-profit">{t("bt_comble_dans_le_plan")}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] leading-snug text-foreground-muted">
            {t("bt_absents_note")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Une interprétation, avec le bouton qui permet de la refuser.
 *
 * ⚠️ REFUSER NE CORRIGE RIEN AUTOMATIQUEMENT, et c'est tout l'intérêt. Deviner
 * une seconde fois ce que le trader voulait dire répéterait exactement l'erreur
 * d'origine. Le refus entoure de rouge le bloc concerné dans l'éditeur juste en
 * dessous, et c'est lui qui tranche.
 */
function LigneInterpretation({
  champ,
  pourquoi,
  conteste,
  onContester,
  t,
}: {
  champ: string;
  pourquoi: string;
  conteste: boolean;
  onContester: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border p-2.5",
        conteste ? "border-loss/50 bg-loss/[0.06]" : "border-border/60 bg-background/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs text-foreground-muted">
          <span className="font-mono text-foreground">{champ}</span> : {pourquoi}
        </p>
        <button
          type="button"
          onClick={onContester}
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            conteste
              ? "border-loss/60 bg-loss/15 text-loss"
              : "border-border text-foreground-muted hover:border-loss/50 hover:text-loss",
          )}
        >
          {conteste ? (
            <span className="flex items-center gap-1">
              <X className="h-3 w-3" />
              {t("bt_conteste")}
            </span>
          ) : (
            t("bt_ce_nest_pas_ca")
          )}
        </button>
      </div>
      {conteste ? (
        <p className="mt-1.5 text-[11px] font-medium text-loss">{t("bt_corrige_le_bloc")}</p>
      ) : null}
    </li>
  );
}

