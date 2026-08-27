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
  | { phase: "telechargement"; faits: number; total: number }
  | { phase: "calcul" }
  | { phase: "erreur"; message: string };

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

  const [etat, setEtat] = useState<Etat>({ phase: "repos" });
  const [resultat, setResultat] = useState<{
    lecture: LectureBacktest;
    trades: import("@/lib/backtest/types").TradeSimule[];
    audit: import("@/lib/backtest/types").AuditExecution;
    moisManquants: string[];
    ms: number;
    apercus: Apercu[];
    suggestions: import("@/lib/backtest/suggestions").Suggestion[];
  } | null>(null);

  /**
   * ⚠️ Compteur de rejeux. C'est le garde-fou le plus important de la page et
   * presque aucun outil ne l'affiche : chercher parmi vingt jeux de paramètres
   * celui qui sort le mieux en trouve TOUJOURS un, même dans du bruit pur.
   */
  const [tentatives, setTentatives] = useState(0);

  /**
   * Le trader a-t-il regardé les trades et reconnu sa méthode ?
   *
   * ⚠️ REMIS À FAUX À CHAQUE LANCEMENT. Un plan modifié est une autre stratégie,
   * et une confirmation qui survivrait au changement ne confirmerait plus rien.
   */
  const [verifie, setVerifie] = useState(false);

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
          raw_text: strat.raw_text,
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
      };
      if (!json.plan || !json.couverture) {
        setCompilation("erreur");
        setCompilationMsg(tr(`bt_compil_${json.reason ?? "error"}`));
        return;
      }
      // ⚠️ On FUSIONNE sur le socle sans jamais remplacer un bloc absent par un
      // bloc inventé : ce qui manque reste manquant, et la carte de couverture
      // le dit. Le socle ne fournit que ce que le compilateur ne décide pas
      // (l'instrument, les coûts).
      setPlan((p) => ({
        ...p,
        ...json.plan,
        instrument: code,
        couts: p.couts,
        stop: json.plan!.stop ?? p.stop,
        objectif: json.plan!.objectif ?? p.objectif,
        contexte: json.plan!.contexte ?? p.contexte,
      }));
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

      setCouverture(couvertureFinale);
      setContestes(new Set());
      setCompilation("repos");
      setResultat(null);
    } catch {
      setCompilation("erreur");
      setCompilationMsg(tr("bt_compil_error"));
    }
  }, [strategies, strategieId, code, fuseau, instrument, tr]);

  const lancer = useCallback(() => {
    if (etat.phase === "telechargement" || etat.phase === "calcul") return;
    workerRef.current?.terminate();

    const prochaine = tentatives + 1;
    setTentatives(prochaine);
    setResultat(null);
    setVerifie(false);
    setEtat({ phase: "telechargement", faits: 0, total: moisEntre(de, a).length });

    const w = new Worker(new URL("./worker.ts", import.meta.url));
    workerRef.current = w;
    w.onmessage = (e: MessageEvent<ReponseBacktest>) => {
      const r = e.data;
      if (r.type === "avancement") setEtat({ phase: "telechargement", faits: r.faits, total: r.total });
      else if (r.type === "calcul") setEtat({ phase: "calcul" });
      else if (r.type === "erreur") setEtat({ phase: "erreur", message: r.message });
      else {
        setResultat({
          lecture: r.lecture,
          trades: r.resultat.trades,
          audit: r.resultat.audit,
          moisManquants: r.moisManquants,
          ms: r.ms,
          apercus: r.apercus,
          suggestions: r.suggestions,
        });
        setEtat({ phase: "repos" });
      }
    };
    const demande: DemandeBacktest = { code, de, a, plan, couts: plan.couts, tentatives: prochaine };
    w.postMessage(demande);
  }, [etat.phase, tentatives, de, a, code, plan]);

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

  const strategieChoisie = strategies.find((s) => s.id === strategieId);
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
                  disabled={!strategieChoisie?.raw_text || compilation === "encours"}
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

        {/* ── 3. Le plan, entièrement modifiable ─────────────────────────── */}
        <StaggerItem>
          <Card>
            <CardTitle className="mb-1">{tr("bt_etape_plan")}</CardTitle>
            <p className="mb-4 text-xs text-foreground-muted">{tr("bt_etape_plan_aide")}</p>
            <EditeurPlan plan={plan} instrument={instrument} onChange={setPlan} contestes={contestes} t={tr} />
          </Card>
        </StaggerItem>

        {/* ── 4. Lancer ──────────────────────────────────────────────────── */}
        <StaggerItem>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle>{tr("bt_etape_lancer")}</CardTitle>
                <p className="mt-1 text-xs text-foreground-muted">
                  {etat.phase === "telechargement"
                    ? tr("bt_telechargement", { faits: etat.faits, total: etat.total })
                    : etat.phase === "calcul"
                      ? tr("bt_calcul")
                      : tr("bt_lancer_aide")}
                </p>
              </div>
              <button
                type="button"
                onClick={lancer}
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
              ms={resultat.ms}
              verifie={verifie}
              contestes={contestes.size}
              suggestions={resultat.suggestions}
              onAppliquer={(p) => {
                // On applique et on efface le resultat : le chiffre affiche ne
                // correspondrait plus au plan visible, et un ecart entre les
                // deux est la pire chose qui puisse arriver a cette page.
                setPlan(p);
                setResultat(null);
              }}
              risqueParTradePct={plan.gestion.risqueParTradePct}
              maxPertesConsecutives={plan.gestion.maxPertesConsecutives}
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
            {t("bt_deduites_critiques", { n: critiques.length })}
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
            {t("bt_traduites", { n: couverture.traduites.length })}
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
            {t("bt_non_traduites", { n: couverture.nonTraduites.length })}
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

