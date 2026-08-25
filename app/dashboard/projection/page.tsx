"use client";

/**
 * PROJECTION DE STRATÉGIE — « est-ce que je vais droit dans le mur ? »
 *
 * Née d'une demande d'utilisateur : « un onglet pour tester ma stratégie sur 2,
 * 5, 15 ans et savoir si elle est rentable à la longue ». Ce n'est PAS un
 * backtest, et ce choix est le cœur de la page : voir l'en-tête de
 * `lib/projection.ts` pour le raisonnement complet.
 *
 * En deux phrases : on ne peut pas exécuter mécaniquement une stratégie écrite
 * en français sans en inventer la moitié, donc on ne simule pas le marché. On
 * rééchantillonne le JOURNAL RÉEL du trader pour projeter l'edge qu'il a déjà
 * démontré, et on rend une distribution avec son incertitude, jamais un chiffre
 * seul.
 *
 * ⚠️ TOUT SE CALCULE DANS LE NAVIGATEUR. Cinq mille chemins sur quelques
 * centaines de trades prennent quelques dizaines de millisecondes en JS. Le
 * faire côté serveur coûterait du temps de fonction pour un bénéfice nul, et
 * ajouterait une route à borner. Il n'y a donc aucun appel réseau ici en dehors
 * de la lecture des trades.
 *
 * ⚠️ L'INTERFACE N'A PAS LE DROIT D'ÊTRE PLUS AFFIRMATIVE QUE LE MOTEUR. Sous
 * le seuil de trades, le moteur ne simule rien et ne rend aucun chiffre : la
 * page affiche ce qui manque. Au-dessus, l'espérance ne s'affiche JAMAIS sans
 * son intervalle. Un onglet qui dirait « +12 € par trade » à quelqu'un dont
 * l'intervalle va de -8 à +32 serait une machine à rassurer les perdants, ce
 * qui est exactement l'inverse de ce que vend TradeDiscipline.
 */

import { KpiCardPremium } from "@/components/dashboard/KpiCardPremium";
import { Card, CardTitle } from "@/components/ui/Card";
import StaggerContainer, { StaggerItem } from "@/components/animations/StaggerContainer";
import { useActiveAccount } from "@/lib/ActiveAccountContext";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import { DEFAULT_CURRENCY, money } from "@/lib/account-currency";
import { cn } from "@/lib/cn";
import {
  MIN_TRADES,
  ecartTypePnl,
  courbePourGraphique,
  projeter,
  tradesPourConclure,
  type Projection,
  type ProjectionTrade,
} from "@/lib/projection";
import { analyserSegments, type AnalyseSegments, type Segment, type TradeSegmente } from "@/lib/projection-segments";
import { mesurerAdherence, type Adherence } from "@/lib/strategy-adherence";
import { verifierCoherence, type Coherence, type RegleStrategie } from "@/lib/strategy-coherence";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { AlertTriangle, CheckCircle2, HelpCircle, Lock, Sparkles, Target, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "@/lib/useChartColors";

/** Horizons proposés. Quinze ans parce que c'est ce que l'utilisateur demandait. */
const HORIZONS = [1, 2, 5, 10, 15] as const;

/** Capital de repli quand aucun solde n'est connu, pour que la ruine ait un sens. */
const CAPITAL_DEFAUT = 10_000;

/**
 * Perte, en % du capital, considérée comme une ruine à défaut de mieux.
 *
 * Convention assumée, employée UNIQUEMENT quand le compte ne porte pas de limite
 * propre. Dès qu'il en a une, c'est la sienne qui s'applique : elle, au moins,
 * décrit quelque chose de réel pour lui.
 */
const SEUIL_RUINE_DEFAUT = 30;

interface TradeRow {
  open_time: string;
  pnl: number;
  commission: number | null;
  swap: number | null;
  strategy_id: string | null;
  // Dimensions de regroupement : elles servent à dire OÙ l'argent part, pas
  // seulement combien. Sans elles, l'onglet annonce un mur sans indiquer le mur.
  pair: string | null;
  direction: string | null;
  emotion: string | null;
  ict_setup: string | null;
}

interface StrategieRow extends RegleStrategie {
  id: string;
  name: string | null;
}

/** Colonnes de règles lues pour le vérificateur de cohérence. */
const COLONNES_STRATEGIE =
  "id, name, pairs, sessions, risk_reward, max_sl_pips, max_trades_per_day, max_consecutive_losses, max_session_minutes, risk_per_trade_pct";

export default function ProjectionPage() {
  const { t, lang } = useLanguage();
  const { plan } = usePlan();
  const { selectedAccount } = useActiveAccount();
  const c = useChartColors();
  const supabase = createClient();

  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [strategies, setStrategies] = useState<StrategieRow[]>([]);
  const [chargement, setChargement] = useState(true);
  const [strategieId, setStrategieId] = useState<string>("all");
  const [annees, setAnnees] = useState<number>(2);

  /**
   * Verdict rédigé par le coach. `null` tant qu'il n'a pas été demandé : la
   * page est entièrement utilisable sans lui, et c'est voulu. L'IA commente des
   * chiffres qu'elle n'a pas produits.
   */
  const [avis, setAvis] = useState<{ titre: string; lecture: string; leviers: string[] } | null>(null);
  const [avisEnCours, setAvisEnCours] = useState(false);
  const [avisErreur, setAvisErreur] = useState<string | null>(null);

  const estPremium = plan === "premium";

  useEffect(() => {
    if (!estPremium) {
      setChargement(false);
      return;
    }
    let annule = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!annule) setChargement(false);
        return;
      }
      const [lignes, { data: strats }] = await Promise.all([
        // ⚠️ TRI SUR `id`, PAS SUR `open_time` : la pagination de PostgREST
        // exige une colonne UNIQUE, sinon deux pages se recouvrent ou sautent
        // des lignes. On remet l'ordre chronologique en mémoire juste après, et
        // il compte : le rééchantillonnage par blocs tire des trades CONSÉCUTIFS,
        // donc un ordre faux détruirait exactement les séries qu'on cherche à
        // conserver.
        fetchAllRows<TradeRow>((from, to) =>
          supabase
            .from("trades")
            .select("open_time, pnl, commission, swap, strategy_id, pair, direction, emotion, ict_setup")
            .eq("user_id", user.id)
            .eq("status", "closed")
            .order("id", { ascending: true })
            .range(from, to),
        ),
        supabase.from("strategies").select(COLONNES_STRATEGIE).eq("user_id", user.id),
      ]);
      if (annule) return;
      const chronologiques = (lignes ?? []).slice().sort(
        (a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime(),
      );
      setTrades(chronologiques);
      setStrategies((strats as StrategieRow[]) ?? []);
      setChargement(false);
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estPremium]);

  const devise = selectedAccount?.synced_currency || selectedAccount?.currency || DEFAULT_CURRENCY;
  const capital = Number(selectedAccount?.account_size) > 0 ? Number(selectedAccount?.account_size) : CAPITAL_DEFAUT;

  /**
   * Le seuil de ruine vient du COMPTE quand il en a un.
   *
   * ⚠️ C'ÉTAIT UN DÉFAUT, PAS UN RÉGLAGE. Le risque de ruine était calculé
   * contre une perte de 30 % du capital, un chiffre posé arbitrairement. Pour un
   * trader en challenge disqualifié à -10 %, ce pourcentage ne décrit rien : il
   * est éliminé bien avant, et l'onglet lui annonçait un risque rassurant sur un
   * seuil qu'il n'atteindra jamais. On prend donc la limite RÉELLE de son
   * compte, et on lui dit laquelle des deux on a utilisée.
   */
  const ddCompte = Number(selectedAccount?.max_total_dd_pct);
  const seuilRuinePct = ddCompte > 0 ? ddCompte : SEUIL_RUINE_DEFAUT;
  const seuilVientDuCompte = ddCompte > 0;

  /**
   * Trades par stratégie, pour que le sélecteur soit lisible.
   *
   * ⚠️ Sans ce compte, le menu n'affichait que des noms, et le trader ne pouvait
   * pas savoir laquelle de ses fiches a de quoi être projetée. Il en choisissait
   * une au hasard, tombait sur « il te manque 80 trades », et concluait que
   * l'onglet ne marche pas.
   */
  const tradesParStrategie = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trades) {
      if (t.strategy_id) m.set(t.strategy_id, (m.get(t.strategy_id) ?? 0) + 1);
    }
    return m;
  }, [trades]);

  const strategieCourante = strategieId === "all" ? null : strategies.find((x) => x.id === strategieId) ?? null;

  /** Nom lisible d'une fiche, jamais un identifiant technique. */
  const nomStrategie = (x: StrategieRow) => x.name?.trim() || t("proj_scope_unnamed");

  /**
   * Cohérence de la fiche sélectionnée, confrontée aux limites du compte actif.
   *
   * ⚠️ Ne s'affiche QUE pour une stratégie précise. Sur « tout le journal » il
   * n'y a pas de fiche à vérifier, et mélanger les règles de plusieurs
   * stratégies produirait des contradictions qui n'existent chez personne.
   */
  const coherence: Coherence | null = useMemo(() => {
    if (!strategieCourante) return null;
    return verifierCoherence(strategieCourante, {
      max_daily_dd_pct: selectedAccount?.max_daily_dd_pct ?? null,
      max_total_dd_pct: selectedAccount?.max_total_dd_pct ?? null,
    });
  }, [strategieCourante, selectedAccount]);

  /**
   * Écart entre les règles écrites et ce qui a été fait.
   *
   * ⚠️ Comme la cohérence, uniquement pour une stratégie précise : sur « tout le
   * journal » il n'y a pas UNE fiche dont on pourrait mesurer le respect.
   */
  const adherence: Adherence | null = useMemo(() => {
    if (!strategieCourante) return null;
    const siens = trades.filter((x) => x.strategy_id === strategieCourante.id);
    return mesurerAdherence(
      siens.map((x) => ({ open_time: x.open_time, netPnl: x.pnl + (x.commission ?? 0) + (x.swap ?? 0) })),
      strategieCourante,
      capital,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  }, [strategieCourante, trades, capital]);

  /** Trades du périmètre choisi, réduits à ce dont le moteur a besoin. */
  const perimetre: ProjectionTrade[] = useMemo(() => {
    const retenus = strategieId === "all" ? trades : trades.filter((x) => x.strategy_id === strategieId);
    return retenus.map((x) => ({
      open_time: x.open_time,
      netPnl: x.pnl + (x.commission ?? 0) + (x.swap ?? 0),
    }));
  }, [trades, strategieId]);

  /** Le périmètre, mais en gardant les dimensions de regroupement. */
  const segmentables: TradeSegmente[] = useMemo(() => {
    const retenus = strategieId === "all" ? trades : trades.filter((x) => x.strategy_id === strategieId);
    return retenus.map((x) => ({
      open_time: x.open_time,
      netPnl: x.pnl + (x.commission ?? 0) + (x.swap ?? 0),
      pair: x.pair,
      direction: x.direction,
      emotion: x.emotion,
      ict_setup: x.ict_setup,
    }));
  }, [trades, strategieId]);

  const optionsProjection = useMemo(
    () => ({ annees, capitalDepart: capital, seuilRuine: seuilRuinePct / 100 }),
    [annees, capital, seuilRuinePct],
  );

  const projection: Projection = useMemo(
    () => projeter(perimetre, optionsProjection),
    [perimetre, optionsProjection],
  );

  /**
   * Où l'argent part, et ce que ça donnerait sans.
   *
   * ⚠️ Deux projections tournent donc au lieu d'une. C'est assumé : le calcul
   * complet prend quelques dizaines de millisecondes dans le navigateur, et
   * c'est la seule partie de la page qui répond à « je fais quoi lundi ».
   */
  const segments = useMemo(
    () => analyserSegments(segmentables, optionsProjection, Intl.DateTimeFormat().resolvedOptions().timeZone),
    [segmentables, optionsProjection],
  );

  // ⚠️ L'AVIS TOMBE DÈS QUE LES CHIFFRES CHANGENT. Changer de stratégie ou
  // d'horizon reconstruit toute la projection : laisser le texte précédent à
  // l'écran ferait commenter des chiffres qui ne sont plus affichés, et c'est
  // exactement le genre d'incohérence dont un trader conclut que l'outil ment.
  useEffect(() => {
    setAvis(null);
    setAvisErreur(null);
  }, [strategieId, annees]);

  async function demanderAvis() {
    setAvisEnCours(true);
    setAvisErreur(null);
    try {
      const rep = await fetch("/api/projection-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          verdict: projection.verdict,
          trades: projection.trades,
          // ⚠️ LES MONTANTS PARTENT DÉJÀ FORMATÉS, EXACTEMENT COMME AFFICHÉS.
          //
          // La première version envoyait les nombres bruts. Le coach a alors
          // écrit « -79.26 USD » et « -13785.08 USD » pendant que la page
          // affichait « -79$ » et « -13 785$ » : des chiffres qui ne se
          // ressemblent pas, à trois centimètres l'un de l'autre. Le modèle
          // était pourtant fidèle à ce qu'on lui avait donné, c'est nous qui lui
          // donnions autre chose que ce que le trader lit.
          //
          // En envoyant les chaînes d'affichage, la divergence devient
          // impossible : il ne peut citer que ce qui est à l'écran.
          esperance: eur(projection.esperance, true),
          intervalle: `${eur(projection.esperanceBasse, true)} … ${eur(projection.esperanceHaute, true)}`,
          median: eur(projection.median, true),
          drawdownMedian: eur(projection.drawdownMedian),
          drawdownPire: eur(projection.drawdownPire),
          risqueDeRuine: Math.round(projection.risqueDeRuine * 100),
          partGagnante: Math.round(projection.partGagnante * 100),
          tradesParAn: Math.round(projection.tradesParAn),
          annees,
          strategie: strategieId === "all" ? null : (strategies.find((x) => x.id === strategieId)?.name ?? null),
        }),
      });
      // ⚠️ LE 429 SE TRAITE ICI, EXPLICITEMENT. `rateLimitAi` rend un message
      // ANGLAIS non traduit : l'afficher brut donnerait « Daily limit reached »
      // à un trader allemand. Et les deux plafonds ne disent pas la même chose,
      // d'où le `scope` : un mur quotidien se rouvre demain, pas le mensuel.
      if (rep.status === 429) {
        const corps = await rep.json().catch(() => ({}));
        setAvisErreur(corps?.scope === "month" ? t("proj_ai_quota_month") : t("proj_ai_quota_day"));
        return;
      }
      const donnees = await rep.json();
      if (donnees?.verdict?.titre) {
        setAvis({
          titre: donnees.verdict.titre,
          lecture: donnees.verdict.lecture,
          leviers: Array.isArray(donnees.verdict.leviers) ? donnees.verdict.leviers : [],
        });
      } else {
        setAvisErreur(t("proj_ai_error"));
      }
    } catch {
      setAvisErreur(t("proj_ai_error"));
    } finally {
      setAvisEnCours(false);
    }
  }

  /**
   * Combien de trades au total avant qu'un verdict soit possible, si l'edge
   * observé se confirme. C'est le chiffre qui transforme « on ne sait pas » en
   * « il t'en manque 87 », et c'est le plus utile de la page pour un débutant.
   */
  const objectifTrades = useMemo(() => {
    if (perimetre.length < 2) return null;
    return tradesPourConclure(projection.esperance, ecartTypePnl(perimetre));
  }, [perimetre, projection.esperance]);

  const eur = (v: number, signed = false) => money(v, devise, { signed });

  // ── Mur d'upgrade ─────────────────────────────────────────────────────────
  if (!estPremium) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <Card className="text-center p-8">
          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-gold" strokeWidth={1.75} />
          </div>
          <CardTitle>{t("proj_locked_title")}</CardTitle>
          <p className="text-sm text-foreground-muted mt-3 mb-6">{t("proj_locked_body")}</p>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-medium"
          >
            {t("proj_locked_cta")}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-semibold">{t("proj_title")}</h1>
        <p className="text-sm text-foreground-muted mt-1">{t("proj_subtitle")}</p>
        {/* ⚠️ LE PÉRIMÈTRE EST RAPPELÉ ICI, PAS SEULEMENT DANS LE MENU. Le menu
            se trouve en haut, les chiffres beaucoup plus bas : en défilant, on
            ne sait plus de quelle stratégie on lit le verdict. Un onglet qui
            affiche un risque de ruine sans dire à quoi il se rapporte est
            ambigu au pire endroit possible. */}
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-xs">
          <Target className="w-3.5 h-3.5 text-accent" strokeWidth={1.75} />
          <span className="font-medium">
            {strategieCourante ? nomStrategie(strategieCourante) : t("proj_scope_all")}
          </span>
          <span className="text-foreground-muted">
            {t("proj_scope_trades").replace("{n}", String(perimetre.length))}
          </span>
        </div>
      </header>

      {/* ── Périmètre et horizon ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-foreground-muted">{t("proj_scope_label")}</span>
          <select
            value={strategieId}
            onChange={(e) => setStrategieId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-sm"
          >
            <option value="all">{t("proj_scope_all")}</option>
            {strategies.map((x) => (
              <option key={x.id} value={x.id}>
                {`${nomStrategie(x)} (${tradesParStrategie.get(x.id) ?? 0})`}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-foreground-muted">{t("proj_horizon_label")}</span>
          <div className="flex gap-1">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setAnnees(h)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm border transition-colors",
                  annees === h
                    ? "bg-accent text-on-accent border-accent"
                    : "bg-surface border-border text-foreground-muted hover:text-foreground",
                )}
              >
                {h === 1 ? t("proj_year_one") : t("proj_years").replace("{n}", String(h))}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ⚠️ LA COHÉRENCE PASSE AVANT LA PROJECTION, ET CE N'EST PAS UN CHOIX
          ESTHÉTIQUE. Projeter une stratégie qui se contredit avec le compte
          reviendrait à chiffrer un avenir que le trader ne peut pas vivre : il
          sera disqualifié avant. Ce qui empêche d'appliquer la méthode se lit
          donc d'abord, ce qu'elle donnerait ensuite. */}
      {coherence && <EncartCoherence coherence={coherence} t={t} />}
      {adherence && <EncartAdherence adherence={adherence} eur={eur} t={t} />}

      {chargement ? (
        <Card className="p-8 text-center text-sm text-foreground-muted">…</Card>
      ) : projection.verdict === "insuffisant" ? (
        <EncartInsuffisant
          projection={projection}
          objectifTrades={objectifTrades}
          t={t}
        />
      ) : (
        <StaggerContainer className="space-y-6">
          <StaggerItem>
            <EncartVerdict projection={projection} eur={eur} t={t} />
          </StaggerItem>

          <StaggerItem>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                titre={t("proj_ruin")}
                valeur={`${Math.round(projection.risqueDeRuine * 100)} %`}
                aide={t(seuilVientDuCompte ? "proj_ruin_help_account" : "proj_ruin_help").replace(
                  "{pct}",
                  String(seuilRuinePct),
                )}
                ton={projection.risqueDeRuine > 0.2 ? "loss" : "neutre"}
              />
              <Kpi
                titre={t("proj_median")}
                valeur={eur(projection.median, true)}
                aide={t("proj_median_help")}
                ton={projection.median >= 0 ? "profit" : "loss"}
              />
              <Kpi
                titre={t("proj_dd_median")}
                valeur={eur(projection.drawdownMedian)}
                aide={t("proj_dd_worst") + " : " + eur(projection.drawdownPire)}
                ton="loss"
              />
              <Kpi
                titre={t("proj_winning_share")}
                valeur={`${Math.round(projection.partGagnante * 100)} %`}
                aide={t("proj_winning_share_help")}
                ton={projection.partGagnante >= 0.5 ? "profit" : "loss"}
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <KpiCardPremium layout="full" accentColor="cyan" intensity="hero">
              <div className="mb-4">
                <CardTitle>{t("proj_chart_title")}</CardTitle>
                <p className="text-xs text-foreground-muted mt-1">{t("proj_chart_help")}</p>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                  data={courbePourGraphique(projection.courbe)}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} strokeOpacity={0.5} />
                  <XAxis
                    dataKey="mois"
                    tick={{ fill: c.axis, fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: c.axisLine }}
                    tickFormatter={(v: unknown) => t("proj_months").replace("{n}", String(v))}
                    // ⚠️ Sans intervalle, un horizon de 15 ans rend 180
                    // étiquettes de mois superposées. On en garde une douzaine
                    // quelle que soit la durée.
                    interval={Math.max(0, Math.ceil(projection.courbe.length / 12) - 1)}
                  />
                  <YAxis
                    tick={{ fill: c.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: c.axisLine }}
                    tickFormatter={(v: unknown) => (typeof v === "number" ? eur(v) : String(v))}
                    width={90}
                  />
                  <ReferenceLine y={0} stroke={c.grid} strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{
                      background: "rgb(var(--surface))",
                      border: "1px solid rgb(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: unknown, nom: unknown) =>
                      nom === "median" && typeof v === "number" ? [eur(v, true), t("proj_median")] : []
                    }
                    labelFormatter={(v: unknown) => t("proj_months").replace("{n}", String(v))}
                  />
                  <Area
                    dataKey="bande90"
                    stroke="none"
                    fill={c.accent || "rgb(var(--accent))"}
                    fillOpacity={0.08}
                    isAnimationActive={false}
                  />
                  <Area
                    dataKey="bande50"
                    stroke="none"
                    fill={c.accent || "rgb(var(--accent))"}
                    fillOpacity={0.18}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="median"
                    stroke={c.accent || "rgb(var(--accent))"}
                    dot={false}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </KpiCardPremium>
          </StaggerItem>

          <StaggerItem>
            <EncartSegments
              segments={segments}
              projection={projection}
              eur={eur}
              t={t}
            />
          </StaggerItem>

          <StaggerItem>
            <EncartAvisCoach
              avis={avis}
              enCours={avisEnCours}
              erreur={avisErreur}
              onDemander={demanderAvis}
              t={t}
            />
          </StaggerItem>

          <StaggerItem>
            <EncartLimites t={t} />
          </StaggerItem>
        </StaggerContainer>
      )}
    </div>
  );
}

// ── Sous-composants ─────────────────────────────────────────────────────────

type Traduire = (k: string) => string;

/**
 * Ce qui s'affiche quand on n'a pas de quoi conclure.
 *
 * ⚠️ C'EST L'ÉCRAN LE PLUS IMPORTANT DE LA PAGE, parce que c'est celui que
 * verra la majorité des traders. Il ne doit contenir AUCUN chiffre de
 * projection, et il doit répondre à la seule question qui reste : combien de
 * trades, et dans combien de temps.
 */
function EncartInsuffisant({
  projection,
  objectifTrades,
  t,
}: {
  projection: Projection;
  objectifTrades: number | null;
  t: Traduire;
}) {
  const mois =
    projection.tradesParAn > 0
      ? Math.ceil((projection.tradesManquants / projection.tradesParAn) * 12)
      : null;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-foreground-muted mt-0.5 shrink-0" strokeWidth={1.75} />
        <div className="space-y-3">
          <CardTitle>{t("proj_insufficient_title")}</CardTitle>
          {projection.trades === 0 ? (
            <p className="text-sm text-foreground-muted">{t("proj_insufficient_none")}</p>
          ) : (
            <>
              <p className="text-sm text-foreground-muted">
                {t("proj_insufficient_body").replace("{n}", String(projection.tradesManquants))}
              </p>
              {mois !== null && (
                <p className="text-sm text-foreground-muted">
                  {t("proj_insufficient_eta").replace("{n}", String(mois))}
                </p>
              )}
              {/* L'espérance observée oriente la suite, mais sans jamais être
                  présentée comme un résultat : c'est un échantillon trop court,
                  et le dire est tout l'intérêt de cet écran. */}
              {objectifTrades === null ? (
                <p className="text-sm text-loss">{t("proj_missing_negative")}</p>
              ) : (
                <p className="text-sm text-foreground-muted">
                  {t("proj_missing_needed").replace(
                    "{n}",
                    String(Math.max(objectifTrades, MIN_TRADES)),
                  )}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Le verdict, avec l'intervalle systématiquement collé à l'espérance. */
function EncartVerdict({
  projection,
  eur,
  t,
}: {
  projection: Projection;
  eur: (v: number, signed?: boolean) => string;
  t: Traduire;
}) {
  const styles = {
    rentable: { icone: CheckCircle2, couleur: "text-profit", fond: "bg-profit/10" },
    perdante: { icone: TrendingDown, couleur: "text-loss", fond: "bg-loss/10" },
    indetermine: { icone: HelpCircle, couleur: "text-foreground-muted", fond: "bg-surface" },
    insuffisant: { icone: HelpCircle, couleur: "text-foreground-muted", fond: "bg-surface" },
  } as const;
  const s = styles[projection.verdict];
  const Icone = s.icone;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", s.fond)}>
          <Icone className={cn("w-5 h-5", s.couleur)} strokeWidth={1.75} />
        </div>
        <div className="space-y-3 min-w-0">
          <CardTitle>{t(`proj_verdict_${projection.verdict}_title`)}</CardTitle>
          <p className="text-sm text-foreground-muted">{t(`proj_verdict_${projection.verdict}_body`)}</p>
          <div className="pt-2">
            <div className="text-xs text-foreground-muted">{t("proj_expectancy")}</div>
            <div className={cn("text-2xl font-semibold", s.couleur)}>{eur(projection.esperance, true)}</div>
            {/* ⚠️ JAMAIS L'UN SANS L'AUTRE. L'intervalle n'est pas un détail de
                second plan : c'est lui qui dit si le chiffre au-dessus veut
                dire quelque chose. */}
            <div className="text-xs text-foreground-muted mt-1">
              {t("proj_expectancy_range")
                .replace("{low}", eur(projection.esperanceBasse, true))
                .replace("{high}", eur(projection.esperanceHaute, true))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Kpi({
  titre,
  valeur,
  aide,
  ton,
}: {
  titre: string;
  valeur: string;
  aide: string;
  ton: "profit" | "loss" | "neutre";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-foreground-muted">{titre}</div>
      <div
        className={cn(
          "text-xl font-semibold mt-1",
          ton === "profit" && "text-profit",
          ton === "loss" && "text-loss",
        )}
      >
        {valeur}
      </div>
      <div className="text-xs text-foreground-muted mt-2 leading-snug">{aide}</div>
    </Card>
  );
}

/**
 * Ce que la fiche du trader dit d'elle-même, confrontée à son compte.
 *
 * ⚠️ AUCUN CONSTAT N'EST UN AVIS. Chacun est une multiplication que le trader
 * peut refaire sur un coin de table, à partir de règles qu'il a lui-même
 * écrites. C'est la frontière que `strategy-coherence.ts` tient, et l'interface
 * n'a pas le droit de la franchir en ajoutant « bonne » ou « mauvaise » autour.
 */
function EncartCoherence({ coherence, t }: { coherence: Coherence; t: Traduire }) {
  const STYLES = {
    bloquant: { icone: AlertTriangle, couleur: "text-loss", fond: "bg-loss/10" },
    serieux: { icone: HelpCircle, couleur: "text-gold", fond: "bg-gold/10" },
    incomplet: { icone: Target, couleur: "text-foreground-muted", fond: "bg-surface" },
  } as const;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <CardTitle>{t("coh_title")}</CardTitle>
          <p className="text-xs text-foreground-muted mt-1 max-w-3xl">{t("coh_subtitle")}</p>
        </div>
        <div className="text-xs text-foreground-muted shrink-0 whitespace-nowrap">
          {t("coh_completude")
            .replace("{n}", String(coherence.completude))
            .replace("{total}", String(coherence.completudeTotal))}
        </div>
      </div>

      {coherence.constats.length === 0 ? (
        <p className="text-sm text-profit">{t("coh_none")}</p>
      ) : (
        <ul className="space-y-3">
          {coherence.constats.map((c) => {
            const st = STYLES[c.gravite];
            const Icone = st.icone;
            // La copie vit dans i18n et porte des {jetons} ; le module de
            // cohérence ne rend que des nombres. On les substitue ici.
            let texte = t(c.code);
            for (const [cle, valeur] of Object.entries(c.valeurs)) {
              texte = texte.replaceAll(`{${cle}}`, String(valeur));
            }
            return (
              <li key={c.code} className="flex items-start gap-3">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", st.fond)}>
                  <Icone className={cn("w-3.5 h-3.5", st.couleur)} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className={cn("text-xs font-medium mb-0.5", st.couleur)}>
                    {t(`coh_grav_${c.gravite}`)}
                  </div>
                  <p className="text-sm text-foreground-muted leading-relaxed">{texte}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * L'écart entre ce que le trader a écrit et ce qu'il a fait.
 *
 * ⚠️ ON COMPTE, ON NE SERMONNE PAS. « 4 jours sur 30 » se vérifie et se retient ;
 * « tu manques de discipline » se discute et s'oublie. C'est aussi pour ça que
 * les règles TENUES s'affichent, et pas seulement les écarts : un trader qui ne
 * voit que ses fautes cesse de regarder.
 */
function EncartAdherence({
  adherence,
  eur,
  t,
}: {
  adherence: Adherence;
  eur: (v: number, signed?: boolean) => string;
  t: Traduire;
}) {
  /** Les règles dont les valeurs sont des MONTANTS et non des comptes. */
  const EN_ARGENT = new Set(["adh_risque"]);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <CardTitle>{t("adh_title")}</CardTitle>
          <p className="text-xs text-foreground-muted mt-1 max-w-3xl">{t("adh_subtitle")}</p>
        </div>
        {adherence.taux !== null && (
          <div className="text-right shrink-0">
            <div className="text-xs text-foreground-muted">{t("adh_taux")}</div>
            <div
              className={cn(
                "text-2xl font-semibold",
                adherence.taux >= 0.9 ? "text-profit" : adherence.taux >= 0.7 ? "text-gold" : "text-loss",
              )}
            >
              {Math.round(adherence.taux * 100)} %
            </div>
          </div>
        )}
      </div>

      {adherence.regles.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("adh_none")}</p>
      ) : (
        <ul className="space-y-3">
          {adherence.regles.map((r) => {
            const tenu = r.ecarts === 0;
            const argent = EN_ARGENT.has(r.code);
            const fmt = (v: number) => (argent ? eur(v) : String(v));
            let texte = t(tenu ? `${r.code}_ok` : r.code);
            texte = texte
              .replaceAll("{declare}", fmt(r.declare))
              .replaceAll("{ecarts}", String(r.ecarts))
              .replaceAll("{occasions}", String(r.occasions))
              .replaceAll("{pire}", fmt(r.pire));
            return (
              <li key={r.code} className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    tenu ? "bg-profit/10" : "bg-loss/10",
                  )}
                >
                  {tenu ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-profit" strokeWidth={2} />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-loss" strokeWidth={2} />
                  )}
                </div>
                <p className="text-sm text-foreground-muted leading-relaxed">{texte}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * Où l'argent part, et ce que ça donnerait sans.
 *
 * ⚠️ L'AVERTISSEMENT N'EST PAS UNE FORMALITÉ, C'EST LA MOITIÉ DE LA CARTE. Le
 * segment a été choisi APRÈS avoir vu les résultats : chercher le pire parmi
 * des dizaines en trouve toujours un, y compris dans du bruit. Sans cette
 * phrase, la carte fabrique des règles qui ne survivront pas au mois suivant,
 * et le trader nous croira parce que le chiffre est juste. Il l'est : c'est son
 * INTERPRÉTATION qui est piégeuse.
 */
function EncartSegments({
  segments,
  projection,
  eur,
  t,
}: {
  segments: AnalyseSegments;
  projection: Projection;
  eur: (v: number, signed?: boolean) => string;
  t: Traduire;
}) {
  const nommer = (s: Segment) => `${t(`seg_dim_${s.dimension}`)} ${s.cle}`;

  return (
    <Card className="p-6">
      <div className="mb-4">
        <CardTitle>{t("seg_title")}</CardTitle>
        <p className="text-xs text-foreground-muted mt-1 max-w-3xl">{t("seg_subtitle")}</p>
      </div>

      {segments.couteux.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("seg_none")}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {segments.couteux.map((s) => (
              <li key={`${s.dimension}:${s.cle}`} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-loss/10 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-3.5 h-3.5 text-loss" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{nommer(s)}</div>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {t("seg_cost")
                      .replace("{n}", String(s.trades))
                      .replace("{cout}", eur(s.netPnl, true))
                      .replace("{esperance}", eur(s.esperance, true))}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {segments.contrefactuel && (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="text-sm font-medium mb-2">
                {t("seg_counterfactual_title").replace("{segment}", nommer(segments.contrefactuel.segment))}
              </div>
              <p className="text-sm text-foreground-muted">
                {t("seg_counterfactual_expectancy")
                  .replace("{avant}", eur(projection.esperance, true))
                  .replace("{apres}", eur(segments.contrefactuel.projection.esperance, true))}
              </p>
              <p className="text-sm text-foreground-muted mt-1">
                {t("seg_counterfactual_ruin")
                  .replace("{avant}", String(Math.round(projection.risqueDeRuine * 100)))
                  .replace("{apres}", String(Math.round(segments.contrefactuel.projection.risqueDeRuine * 100)))}
              </p>
            </div>
          )}

          <div className="mt-5 flex items-start gap-3 p-3 rounded-lg bg-gold/5 border border-gold/20">
            <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-foreground-muted leading-relaxed">{t("seg_warning")}</p>
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * Le verdict rédigé par le coach.
 *
 * ⚠️ IL ARRIVE APRÈS LES CHIFFRES, ET SUR DEMANDE. Deux raisons, et aucune
 * n'est esthétique. D'abord la page doit rester entièrement utilisable sans
 * IA : les chiffres sont calculés dans le navigateur, ils ne dépendent ni d'un
 * quota ni d'une clé API. Ensuite, un texte généré à chaque ouverture
 * consommerait le plafond mensuel du trader pour une projection qu'il n'a
 * peut-être fait que survoler.
 */
function EncartAvisCoach({
  avis,
  enCours,
  erreur,
  onDemander,
  t,
}: {
  avis: { titre: string; lecture: string; leviers: string[] } | null;
  enCours: boolean;
  erreur: string | null;
  onDemander: () => void;
  t: Traduire;
}) {
  if (!avis) {
    return (
      <Card className="p-5">
        <button
          type="button"
          onClick={onDemander}
          disabled={enCours}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium disabled:opacity-60"
        >
          <Sparkles className="w-4 h-4" strokeWidth={1.75} />
          {enCours ? t("proj_ai_loading") : t("proj_ai_cta")}
        </button>
        {erreur && <p className="text-xs text-foreground-muted mt-3">{erreur}</p>}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-accent mt-0.5 shrink-0" strokeWidth={1.75} />
        <div className="space-y-3 min-w-0">
          <CardTitle>{avis.titre}</CardTitle>
          <p className="text-sm text-foreground-muted leading-relaxed">{avis.lecture}</p>
          {avis.leviers.length > 0 && (
            <div className="pt-1">
              <div className="text-xs font-medium mb-2">{t("proj_ai_levers")}</div>
              <ul className="space-y-1.5">
                {avis.leviers.map((l, i) => (
                  <li key={i} className="text-sm text-foreground-muted flex gap-2">
                    <span className="text-accent shrink-0">·</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Les limites de la méthode, affichées SUR la page et non repliées.
 *
 * ⚠️ Ce bloc n'est pas décoratif et ne se déplace pas derrière un « en savoir
 * plus ». Toute la page décrit une performance HYPOTHÉTIQUE calculée sur un
 * passé qui ne se reproduira pas, et le trader doit le lire au même endroit que
 * les chiffres, pas ailleurs.
 */
function EncartLimites({ t }: { t: Traduire }) {
  return (
    <Card className="p-5 border-border">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-foreground-muted mt-0.5 shrink-0" strokeWidth={1.75} />
        <div>
          <div className="text-sm font-medium">{t("proj_caveat_title")}</div>
          <p className="text-xs text-foreground-muted mt-2 leading-relaxed">{t("proj_caveat_body")}</p>
        </div>
      </div>
    </Card>
  );
}
