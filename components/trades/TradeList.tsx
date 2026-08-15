"use client";

import { buildCurrencyMap, money, tradeCurrency } from "@/lib/account-currency";
import { getEmotionDisplay } from "@/lib/emotions";
import type { ChecklistItem } from "@/lib/hooks/useStrategyTags";
import { detectKillzone } from "@/lib/ict-constants";
import {
  KILLZONE_LABELS,
} from "@/lib/strategy/derive";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows, chunk, ID_CHUNK } from "@/lib/supabase-paginate";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Camera, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useMemo, useEffect, useRef, useState } from "react";
import TradeDetailPanel, { type TradeDetail } from "./TradeDetailPanel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationCompact(openTime: string, closeTime: string): string {
  const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
  const minutes = ms / 60000;
  if (minutes < 1) return "<1min";
  if (minutes < 60) return `${Math.round(minutes)}min`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  }
  const days = Math.floor(minutes / (24 * 60));
  return `${days}j`;
}

// ─── Mini composants inline ───────────────────────────────────────────────────

function ConformityRing({ score, total }: { score: number; total: number }) {
  if (total === 0) return <span className="text-muted">—</span>;
  const radius = 6;
  const circ = 2 * Math.PI * radius;
  const filled = total > 0 ? (score / total) * circ : 0;
  const isComplete = score === total;
  return (
    <div className="flex items-center gap-1.5">
      <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
        <circle cx="8" cy="8" r={radius} fill="none" strokeWidth="2" className="stroke-border" />
        <circle
          cx="8" cy="8" r={radius}
          fill="none" strokeWidth="2"
          stroke="var(--color-accent)"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
          opacity={score === 0 ? 0 : 1}
        />
      </svg>
      <span className={`text-xs font-mono ${isComplete ? "text-accent" : "text-muted"}`}>
        {score}/{total}
      </span>
    </div>
  );
}

const KILLZONE_STYLES: Record<string, string> = {
  asia:        "bg-violet-500/10 text-violet-400 border-violet-500/20",
  london_open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ny_am:       "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ny_pm:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  off_session: "bg-muted/10 text-muted border-border",
};

function KillzonePill({ kz }: { kz: string }) {
  const { t } = useLanguage();
  const label = KILLZONE_LABELS[kz] ? t(`da_kz_${kz}`) : kz;
  const style = KILLZONE_STYLES[kz] ?? "bg-muted/10 text-muted border-border";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs border whitespace-nowrap ${style}`}>
      {label}
    </span>
  );
}

function EmotionTag({
  emotion,
  checklist,
}: {
  emotion: string | null;
  checklist: Record<string, boolean> | null;
}) {
  if (emotion) {
    const display = getEmotionDisplay(emotion);
    if (!display) return <span className="text-muted">—</span>;
    return (
      <span className="text-xs flex items-center gap-1 whitespace-nowrap">
        <span>{display.emoji}</span>
        <span className="text-foreground">{display.label}</span>
      </span>
    );
  }

  const hasChecklist = checklist && Object.values(checklist).some(Boolean);
  if (!hasChecklist) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 whitespace-nowrap">
        <AlertCircle className="w-3 h-3 shrink-0" />
        À annoter
      </span>
    );
  }

  return <span className="text-muted">—</span>;
}

type SortColumn = "date" | "pair" | "direction" | "pnl" | "emotion" | "discipline" | "killzone";
type SortState = { column: SortColumn | null; direction: "asc" | "desc" };

const COLUMN_TO_DB: Record<SortColumn, string> = {
  date:       "open_time",
  pair:       "pair",
  direction:  "direction",
  pnl:        "pnl",
  emotion:    "emotion",
  discipline: "ict_confluence_score",
  killzone:   "ict_killzone",
};

function SortableTh({
  column,
  label,
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sort: SortState;
  onSort: (col: SortColumn) => void;
}) {
  const isActive = sort.column === column;
  const Icon = !isActive ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-2">
      <button
        onClick={() => onSort(column)}
        className="group inline-flex items-center gap-1 cursor-pointer select-none font-medium hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        <Icon
          className={`w-3 h-3 transition-opacity ${
            isActive ? "text-accent opacity-100" : "text-muted opacity-0 group-hover:opacity-100"
          }`}
        />
      </button>
    </th>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trade {
  id: string;
  open_time: string;
  close_time: string;
  pair: string;
  direction: "long" | "short";
  lot_size: number;
  entry_price: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  sl_initial: number | null;
  tp_initial: number | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  tags: string[];
  emotion: string | null;
  setup_quality: number | null;
  notes: string | null;
  screenshot_path: string | null;
  challenge_id: string | null;
  prop_challenges?: { firm: string; account_number: string | null } | null;
  ict_checklist?: Record<string, boolean> | null;
  ict_killzone?: string | null;
  ict_setup?: string | null;
  ict_confluence_score?: number | null;
  strategy_id?: string | null;
}

interface Filters {
  pair: string;
  direction: string;
  result: string;
  dateFrom: string;
  dateTo: string;
  /** id du compte, "" = tous, NO_ACCOUNT = trades rattachés à aucun compte. */
  account: string;
}

/** Sentinelle : les trades sans compte (import CSV non affecté, saisie manuelle). */
const NO_ACCOUNT = "__none__";

/**
 * Largeur à partir de laquelle les six filtres tiennent sur UNE ligne, à côté
 * de la barre latérale de 240 px : 6 champs (170 + 140 + 120 + 120 + 130 + 130),
 * leurs 5 espaces, les boutons Réinitialiser et Exporter, plus les marges, soit
 * ~1 100 px de contenu. En dessous, la rangée passe sur deux lignes et la barre
 * collante mange 150 px de hauteur en permanence : sur un 14 pouces (1 280 px de
 * large, ~700 px de haut) c'est un cinquième de l'écran, occupé en permanence
 * par des filtres dont on ne se sert pas à chaque instant.
 *
 * D'où le repli par défaut en dessous du seuil, et le déploiement au-dessus. Le
 * seuil n'est pas un point de rupture Tailwind : `xl` (1 280 px) tomberait pile
 * sur la largeur des portables 14 pouces, ceux-la memes qu'on veut replier.
 */
const FILTERS_WIDE_PX = 1340;
/**
 * Écrit en toutes lettres, et pas construit depuis FILTERS_WIDE_PX : Tailwind
 * cherche des chaînes littérales dans les sources, une classe assemblée à
 * l'exécution ne serait jamais générée. Les deux doivent rester d'accord.
 */
const FILTERS_DEFAULT_CLASS = "hidden min-[1340px]:block";
const FILTERS_OPEN_KEY = "td.trades.filtersOpen";

function isWideViewport(): boolean {
  return window.matchMedia(`(min-width: ${FILTERS_WIDE_PX}px)`).matches;
}

interface AccountOption {
  id: string;
  firm: string;
  account_number: string | null;
  status: "active" | "passed" | "failed";
  currency: string | null;
  synced_currency: string | null;
}

interface Props {
  refreshKey: number;
  onTradeUpdated?: () => void;
}

/**
 * Choix de taille de page. 50 par défaut : 20 tenait de l'époque où un compte
 * synchronisé n'existait pas et où on saisissait ses trades à la main. Un EA
 * branché produit des centaines de lignes, et 20 par page transforme le moindre
 * parcours en clics de pagination.
 */
const PAGE_SIZES = [20, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_KEY = "td.trades.pageSize";

/** Colonnes lues pour l'export CSV, dans l'ordre où elles y apparaissent. */
interface CsvRow {
  id: string;
  open_time: string | null;
  close_time: string | null;
  pair: string;
  direction: string;
  lot_size: number | null;
  entry_price: number | null;
  exit_price: number | null;
  sl: number | null;
  tp: number | null;
  pnl: number | null;
  commission: number | null;
  swap: number | null;
  emotion: string | null;
  tags: string[] | null;
  notes: string | null;
}

function normalizeDirection(dir: string): "long" | "short" {
  const d = dir.toLowerCase();
  if (d === "long" || d === "buy") return "long";
  return "short";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TradeList({ refreshKey, onTradeUpdated }: Props) {
  const { t } = useLanguage();
  const supabase = createClient();
  const [checklistMap, setChecklistMap] = useState<Record<string, ChecklistItem[]>>({});

  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /**
   * true = « tous les trades correspondant aux filtres », pas seulement ceux de
   * la page affichée. Les identifiants ne sont PAS chargés d'avance : garder
   * 300 ids en mémoire pour, peut-être, ne rien en faire est inutile. Ils sont
   * relus au moment de la suppression, donc toujours à jour.
   */
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [selectedTrade, setSelectedTrade] = useState<TradeDetail | null>(null);
  const [allPairs, setAllPairs] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({
    pair: "",
    direction: "",
    result: "",
    dateFrom: "",
    dateTo: "",
    account: "",
  });
  const [globalStats, setGlobalStats] = useState({
    count: 0,
    wins: 0,
    totalPnl: 0,
    best: 0,
    worst: 0,
  });
  const [sort, setSort] = useState<SortState>({ column: null, direction: "desc" });

  /**
   * Barre de filtres : ouverte, fermée, ou `null` = « aucun choix explicite »,
   * et c'est alors le CSS qui tranche (voir FILTERS_DEFAULT_CLASS).
   *
   * Ce `null` n'est pas de la coquetterie. Décider en JS au premier rendu
   * imposerait de lire la largeur de la fenêtre, donc un écart entre le rendu
   * serveur et le rendu client. Tant que l'utilisateur n'a rien décidé, la
   * valeur est identique des deux côtés et le point de bascule vit dans une
   * media query.
   */
  const [filtersOpen, setFiltersOpen] = useState<boolean | null>(null);

  /**
   * Ce que le CSS affiche quand l'utilisateur n'a rien décidé. Ne pilote AUCUN
   * affichage (la media query s'en charge) : sert uniquement à annoncer un
   * `aria-expanded` juste, qu'un lecteur d'écran ne peut pas déduire du CSS.
   */
  const [wideDefault, setWideDefault] = useState(false);

  // Un choix explicite se garde d'une visite à l'autre : sinon, sur un écran où
  // le repli est le défaut, il faudrait rouvrir les filtres à chaque passage.
  useEffect(() => {
    setWideDefault(isWideViewport());
    const stored = window.localStorage.getItem(FILTERS_OPEN_KEY);
    if (stored === "1") setFiltersOpen(true);
    else if (stored === "0") setFiltersOpen(false);

    // Lu ici et pas dans le useState : `window` n'existe pas au rendu serveur.
    const storedSize = Number(window.localStorage.getItem(PAGE_SIZE_KEY));
    if ((PAGE_SIZES as readonly number[]).includes(storedSize)) setPageSize(storedSize);
  }, []);

  function changePageSize(size: number) {
    window.localStorage.setItem(PAGE_SIZE_KEY, String(size));
    setPageSize(size);
    setPage(0); // la page 7 d'un découpage par 20 n'existe pas dans un par 200
  }

  function toggleFilters() {
    setFiltersOpen((current) => {
      // Premier clic sans choix stocké : on part de ce que le CSS affiche, donc
      // le clic referme sur grand écran et ouvre sur petit.
      const next = current === null ? !isWideViewport() : !current;
      window.localStorage.setItem(FILTERS_OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }

  // TOUS les comptes, y compris réussis et ratés : l'historique des trades ne
  // s'arrête pas quand un challenge se termine. Le contexte de compte actif ne
  // convient pas ici, il filtre sur status = 'active', ce qui ferait disparaître
  // du filtre les challenges clos et rendrait leurs trades en euros par défaut.
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const currencyMap = useMemo(() => buildCurrencyMap(accounts), [accounts]);

  useEffect(() => {
    async function loadAccounts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("prop_challenges")
        .select("id, firm, account_number, status, currency, synced_currency")
        .eq("user_id", user.id)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      setAccounts((data || []) as AccountOption[]);
    }
    loadAccounts();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAllPairs();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(0);
  }, [filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Changer de filtre change l'ensemble visé : une sélection « tous les trades
  // correspondant aux filtres » survivant à ce changement porterait sur autre
  // chose que ce que l'utilisateur a sous les yeux, et supprimerait à l'aveugle.
  useEffect(() => {
    setSelectAllMatching(false);
    setSelectedIds(new Set());
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTrades();
    loadGlobalStats();
  }, [page, pageSize, refreshKey, filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, refreshKey]);

  // Les trades arrivent en tache de fond (EA MetaTrader, cron broker) : sans
  // abonnement, la liste restait le cliche pris au montage et il fallait
  // changer d'onglet pour la voir bouger.
  //
  // La ref garde un rechargement toujours a jour, pour que l'abonnement (monte
  // une seule fois) ne rappelle jamais une version perimee des filtres, du tri
  // ou de la page courante.
  const reloadRef = useRef<() => void>(() => {});
  useEffect(() => {
    reloadRef.current = () => {
      loadTrades();
      loadGlobalStats();
      loadAllPairs();
    };
  });

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Une synchro insere 90 jours d'historique d'un coup, donc une salve
    // d'evenements : sans ce delai, chaque ligne declencherait sa propre
    // requete. On attend que la salve retombe avant de recharger une fois.
    let burst: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      channel = supabase
        .channel(`trade_list_${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${user.id}` },
          () => {
            if (burst) clearTimeout(burst);
            burst = setTimeout(() => {
              if (active) reloadRef.current();
            }, 500);
          },
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (burst) clearTimeout(burst);
      if (channel) supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filet de securite independant du temps reel : le parcours typique est
  // d'aller cloturer un trade dans MetaTrader puis de revenir sur l'onglet.
  // Ce rechargement au retour marche meme si la replication temps reel n'est
  // pas activee sur la table.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") reloadRef.current();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  async function loadAllPairs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Lecture paginée : au-delà de 1 000 trades, une lecture non bornée ne
    // verrait que les 1 000 premiers, et une paire tradée seulement plus tard
    // manquerait à la liste déroulante — un filtre qu'on ne peut pas choisir.
    const data = await fetchAllRows<{ pair: string }>((from, to) =>
      supabase
        .from("trades")
        .select("pair")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (data) {
      setAllPairs(Array.from(new Set(data.map((r) => r.pair))).sort());
    }
  }

  /**
   * Les cinq filtres exprimables en SQL, posés au même endroit pour les trois
   * requêtes qui doivent voir le même ensemble : la liste, l'export CSV et la
   * suppression en masse. Une copie de plus, et le jour où l'une dérive, c'est
   * la suppression qui emporte des trades que l'utilisateur ne voyait pas.
   *
   * `filters.result` n'en fait pas partie : gagnant/perdant se calcule sur
   * pnl + commission + swap, donc il s'applique en JS, après la requête.
   */
  function applySqlFilters<Q>(query: Q): Q {
    // Le type de retour reste celui du constructeur reçu, donc les appelants ne
    // perdent rien. Le `any` interne est le prix d'un helper qui accepte trois
    // `select()` de formes différentes : décrire la contrainte proprement
    // (`Q extends Filterable<Q>`) fait exploser l'inférence de PostgREST
    // (TS2589, « type instantiation is excessively deep »).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = query as any;
    if (filters.pair) q = q.eq("pair", filters.pair);
    if (filters.direction) q = q.eq("direction", filters.direction);
    if (filters.dateFrom) q = q.gte("open_time", filters.dateFrom);
    if (filters.dateTo) q = q.lte("open_time", filters.dateTo + "T23:59:59");
    if (filters.account === NO_ACCOUNT) q = q.is("challenge_id", null);
    else if (filters.account) q = q.eq("challenge_id", filters.account);
    return q as Q;
  }

  async function loadTrades() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = applySqlFilters(
      supabase
        .from("trades")
        .select("*, tags, emotion, setup_quality, notes, screenshot_path, prop_challenges(firm, account_number)", { count: "exact" })
        .eq("user_id", user.id)
        .eq("status", "closed"),
    );

    if (sort.column === null) {
      query = query.order("open_time", { ascending: false }).order("id", { ascending: false });
    } else {
      query = query
        .order(COLUMN_TO_DB[sort.column], { ascending: sort.direction === "asc", nullsFirst: sort.direction === "desc" })
        .order("id", { ascending: false });
    }

    const { data, count } = await query.range(from, to);

    // Aucun dédoublonnage d'affichage ici : ouvrir trois positions identiques
    // à la même seconde (même paire, même prix) est un scénario de trading
    // courant, et masquer les copies faisait disparaître des trades réels tout
    // en les gardant dans les stats. Les vrais doublons de synchro sont déjà
    // impossibles : index unique (user_id, source, external_id) en base.
    let rows = (data || []) as Trade[];

    if (filters.result === "win") {
      rows = rows.filter((tr) => tr.pnl + (tr.commission || 0) + (tr.swap || 0) > 0);
    } else if (filters.result === "loss") {
      rows = rows.filter((tr) => tr.pnl + (tr.commission || 0) + (tr.swap || 0) <= 0);
    }

    setTrades(rows);
    setTotal(count || 0);
    setLoading(false);

    // Load checklist items for each distinct strategy in this page
    const uniqueStrategyIds = Array.from(new Set(rows.map((r) => r.strategy_id).filter((id): id is string => !!id)));
    if (uniqueStrategyIds.length > 0) {
      const { data: tagData } = await supabase
        .from("strategy_tags")
        .select("strategy_id, value, label_fr, label_en, label_de, label_es")
        .in("strategy_id", uniqueStrategyIds)
        .eq("tag_type", "checklist")
        .order("sort_order");
      const map: Record<string, ChecklistItem[]> = {};
      for (const tag of tagData || []) {
        (map[tag.strategy_id] ??= []).push({
          key: tag.value,
          label: { fr: tag.label_fr, en: tag.label_en, de: tag.label_de, es: tag.label_es },
        });
      }
      setChecklistMap(map);
    } else {
      setChecklistMap({});
    }
  }

  async function loadGlobalStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Les stats du bandeau suivent le filtre de compte : sinon le total annoncé
    // contredirait la liste affichée juste en dessous.
    //
    // Lecture paginée : ce bandeau annonce « 336 trades · WR 46.9 % · P&L
    // -6 619,77 € », des chiffres sur lesquels l'utilisateur juge son trading.
    // Au-delà de 1 000 trades, une lecture non bornée les aurait calculés sur
    // les 1 000 premiers en les présentant comme le total (voir fetchAllRows).
    const data = await fetchAllRows<{
      pnl: number | null; commission: number | null; swap: number | null;
    }>((from, to) => {
      let q = supabase
        .from("trades")
        .select("pnl, commission, swap, challenge_id")
        .eq("user_id", user.id)
        .eq("status", "closed")
        .order("id", { ascending: true });
      if (filters.account === NO_ACCOUNT) q = q.is("challenge_id", null);
      else if (filters.account) q = q.eq("challenge_id", filters.account);
      return q.range(from, to);
    });

    // Échec de lecture : on garde les chiffres précédents plutôt que d'en
    // afficher de faux. La liste, elle, signalera son propre échec.
    if (data === null) return;

    if (data.length === 0) {
      setGlobalStats({ count: 0, wins: 0, totalPnl: 0, best: 0, worst: 0 });
      return;
    }

    const netPnls = data.map((tr) => (tr.pnl ?? 0) + (tr.commission ?? 0) + (tr.swap ?? 0));
    setGlobalStats({
      count: netPnls.length,
      wins: netPnls.filter((p) => p > 0).length,
      totalPnl: netPnls.reduce((a, b) => a + b, 0),
      best: Math.max(...netPnls),
      worst: Math.min(...netPnls),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm(t("trades_confirm_delete"))) return;
    setDeletingId(id);

    const trade = trades.find((tr) => tr.id === id);
    if (trade?.screenshot_path) {
      await supabase.storage.from("trade-screenshots").remove([trade.screenshot_path]);
    }

    await supabase.from("trades").delete().eq("id", id);
    setDeletingId(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    loadTrades();
    loadGlobalStats();
  }

  /** Le filtre gagnant/perdant, qui ne s'exprime pas en SQL (voir applySqlFilters). */
  function keepByResult<T extends { pnl: number | null; commission: number | null; swap: number | null }>(
    rows: T[],
  ): T[] {
    if (filters.result !== "win" && filters.result !== "loss") return rows;
    const net = (r: T) => (r.pnl ?? 0) + (r.commission ?? 0) + (r.swap ?? 0);
    return filters.result === "win" ? rows.filter((r) => net(r) > 0) : rows.filter((r) => net(r) <= 0);
  }

  /**
   * Tous les trades correspondant aux filtres, id et capture d'écran.
   * Renvoie null si une requête échoue : mieux vaut ne rien supprimer que d'en
   * supprimer une partie en annonçant que tout est fait.
   */
  async function fetchMatchingRows(
    userId: string,
  ): Promise<{ id: string; screenshot_path: string | null }[] | null> {
    const rows = await fetchAllRows<{
      id: string; screenshot_path: string | null;
      pnl: number | null; commission: number | null; swap: number | null;
    }>((from, to) =>
      applySqlFilters(
        supabase
          .from("trades")
          .select("id, screenshot_path, pnl, commission, swap")
          .eq("user_id", userId)
          .eq("status", "closed")
          // Tri sur `id`, unique et stable : voir fetchAllRows.
          .order("id", { ascending: true }),
      ).range(from, to),
    );

    if (rows === null) return null;
    return keepByResult(rows).map(({ id, screenshot_path }) => ({ id, screenshot_path }));
  }

  /** Chemins des captures d'un lot d'ids, pour ne pas laisser de fichiers orphelins. */
  async function fetchScreenshotPaths(ids: string[]): Promise<string[]> {
    const paths: string[] = [];
    for (const part of chunk(ids, ID_CHUNK)) {
      const { data } = await supabase
        .from("trades")
        .select("screenshot_path")
        .in("id", part)
        .not("screenshot_path", "is", null);
      for (const row of data ?? []) paths.push(row.screenshot_path as string);
    }
    return paths;
  }

  async function handleBulkDelete() {
    const count = selectAllMatching ? total : selectedIds.size;
    if (count === 0) return;
    if (!confirm(t("trades_confirm_delete_mass").replace("{count}", String(count)))) return;

    setBulkDeleting(true);
    setBulkError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBulkDeleting(false); return; }

    // Les ids sont relus MAINTENANT, pas au moment du clic sur « tout
    // sélectionner » : ils reflètent donc l'état réel au moment où on supprime.
    let ids: string[];
    let paths: string[];
    if (selectAllMatching) {
      const rows = await fetchMatchingRows(user.id);
      if (rows === null) {
        setBulkError(t("trades_delete_failed"));
        setBulkDeleting(false);
        return;
      }
      ids = rows.map((r) => r.id);
      paths = rows.filter((r) => r.screenshot_path).map((r) => r.screenshot_path as string);
    } else {
      ids = Array.from(selectedIds);
      // Relu en base plutôt que pris dans `trades` : une sélection peut s'être
      // faite sur plusieurs pages, et `trades` ne contient que la page en cours.
      paths = await fetchScreenshotPaths(ids);
    }

    if (paths.length > 0) {
      for (const part of chunk(paths, ID_CHUNK)) {
        await supabase.storage.from("trade-screenshots").remove(part);
      }
    }

    let deleted = 0;
    for (const part of chunk(ids, ID_CHUNK)) {
      const { data, error } = await supabase.from("trades").delete().in("id", part).select("id");
      if (error) {
        // Les tranches déjà passées sont bel et bien supprimées : on le dit
        // plutôt que de laisser croire à un échec total ou à une réussite.
        setBulkError(
          t("trades_delete_partial")
            .replace("{done}", String(deleted))
            .replace("{total}", String(ids.length)),
        );
        break;
      }
      deleted += data?.length ?? 0;
    }

    setBulkDeleting(false);
    setSelectedIds(new Set());
    setSelectAllMatching(false);
    setPage(0); // la page courante n'existe peut-être plus après coup
    loadTrades();
    loadGlobalStats();
  }

  function toggleSelect(id: string) {
    // Décocher une ligne alors que « tous les trades des filtres » est actif
    // fait sortir du mode : la sélection redevient explicite, celle de la page
    // affichée moins cette ligne. Sans ça, la case décochée resterait cochée à
    // l'écran, et la suppression emporterait quand même la ligne.
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedIds(new Set(trades.filter((tr) => tr.id !== id).map((tr) => tr.id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectAllMatching || trades.every((tr) => selectedIds.has(tr.id))) {
      setSelectedIds(new Set());
      setSelectAllMatching(false);
    } else {
      setSelectedIds(new Set(trades.map((tr) => tr.id)));
    }
  }

  function resetFilters() {
    setFilters({ pair: "", direction: "", result: "", dateFrom: "", dateTo: "", account: "" });
  }

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function handleSortClick(column: SortColumn) {
    if (sort.column !== column) {
      setSort({ column, direction: "asc" });
    } else if (sort.direction === "asc") {
      setSort({ column, direction: "desc" });
    } else {
      setSort({ column: null, direction: "desc" });
    }
  }

  async function exportCSV() {
    setExporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setExporting(false); return; }

    // Lecture paginée. Un export tronqué est le pire des cas : le fichier a
    // l'air complet, il porte le bon nom, et il manque des trades. Le tri
    // d'affichage (open_time) n'est pas unique, donc les pages sont lues dans
    // l'ordre stable de `id` puis remises en ordre chronologique ici.
    const data = await fetchAllRows<CsvRow>((from, to) =>
      applySqlFilters(
        supabase
          .from("trades")
          .select("id, open_time, close_time, pair, direction, lot_size, entry_price, exit_price, sl, tp, pnl, commission, swap, emotion, tags, notes")
          .eq("user_id", user.id)
          .eq("status", "closed")
          .order("id", { ascending: true }),
      ).range(from, to),
    );

    if (data === null) {
      setExportError(t("trades_export_failed"));
      setExporting(false);
      return;
    }
    if (data.length === 0) { setExporting(false); return; }

    setExportError(null);
    const rows = keepByResult(data).sort(
      (a, b) => new Date(b.open_time ?? 0).getTime() - new Date(a.open_time ?? 0).getTime(),
    );

    const headers = ["Date", "Pair", "Direction", "Lot", "Entry", "Exit", "SL", "TP", "PnL", "Commission", "Swap", "Net PnL", "Emotion", "Tags", "Notes"];
    const csvRows = rows.map((tr) => {
      const net = (tr.pnl ?? 0) + (tr.commission ?? 0) + (tr.swap ?? 0);
      return [
        tr.open_time ? new Date(tr.open_time).toISOString().split("T")[0] : "",
        tr.pair, tr.direction, tr.lot_size, tr.entry_price, tr.exit_price,
        tr.sl ?? "", tr.tp ?? "", tr.pnl, tr.commission ?? 0, tr.swap ?? 0,
        net.toFixed(2), tr.emotion ?? "",
        Array.isArray(tr.tags) ? tr.tags.join("; ") : "",
        (tr.notes ?? "").replace(/"/g, '""'),
      ].map((v) => `"${v}"`).join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  // ─── Top 3 glow (page courante uniquement) ───────────────────────────────────

  const { top3GainIds, top3LossIds } = useMemo(() => {
    const withNet = trades.map((tr) => ({ id: tr.id, net: tr.pnl + (tr.commission || 0) + (tr.swap || 0) }));
    const sorted = [...withNet].sort((a, b) => b.net - a.net);
    const top3GainIds = new Set(sorted.slice(0, 3).filter((x) => x.net > 0).map((x) => x.id));
    const top3LossIds = new Set([...withNet].sort((a, b) => a.net - b.net).slice(0, 3).filter((x) => x.net < 0).map((x) => x.id));
    return { top3GainIds, top3LossIds };
  }, [trades]);

  const hasActiveFilters = filters.pair || filters.direction || filters.result || filters.dateFrom || filters.dateTo || filters.account;
  const activeFilterCount = [filters.pair, filters.direction, filters.result, filters.dateFrom, filters.dateTo, filters.account].filter(Boolean).length;
  // En mode « tous les trades des filtres », les lignes de TOUTE page affichée
  // sont concernées, y compris celles qu'on n'a jamais cochées à la main : les
  // cases doivent le montrer, sinon la page 2 s'afficherait vierge alors que la
  // suppression emporterait ses lignes.
  const isChecked = (id: string) => selectAllMatching || selectedIds.has(id);
  const allSelected =
    trades.length > 0 && (selectAllMatching || trades.every((tr) => selectedIds.has(tr.id)));
  const someSelected = selectAllMatching || selectedIds.size > 0;
  const { count: statsCount } = globalStats;
  const totalPages = Math.ceil(total / pageSize);

  // ── Panel navigation ──────────────────────────────────────────────────────────
  const selectedIndex = selectedTrade ? trades.findIndex((tr) => tr.id === selectedTrade.id) : -1;
  const hasPanelPrev = selectedIndex > 0;
  const hasPanelNext = selectedIndex >= 0 && selectedIndex < trades.length - 1;
  function handlePanelPrev() {
    if (selectedIndex > 0) setSelectedTrade(trades[selectedIndex - 1] as TradeDetail);
  }
  function handlePanelNext() {
    if (selectedIndex >= 0 && selectedIndex < trades.length - 1)
      setSelectedTrade(trades[selectedIndex + 1] as TradeDetail);
  }

  return (
    <section>
      {/* Filter bar — sticky */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border rounded-lg mb-4">
        {/* p-3 des quatre côtés : replié, la barre se réduit à cette ligne, et
            un pb-1 la collerait à sa bordure. Le panneau reprend en pt-0. */}
        <div className="flex items-center justify-between gap-2 p-3">
          <p className="text-[11px] text-muted">
            {hasActiveFilters
              ? t("trades_filtered_by").replace("{count}", String(total))
              : t("trades_all_accounts").replace("{count}", String(statsCount))}
          </p>
          {/* Repli disponible à TOUTE largeur : un 14 pouces a autant besoin de
              récupérer ces 150 px qu'un téléphone, et un grand écran peut
              vouloir replier une barre dont il ne se sert pas. */}
          <button
            onClick={toggleFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-surface text-xs text-foreground"
            aria-expanded={filtersOpen ?? wideDefault}
            aria-controls="trades-filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {t("trades_filters_toggle")}
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-on-accent text-[10px] font-semibold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""} ${
                filtersOpen === null ? "min-[1340px]:rotate-180" : ""
              }`}
            />
          </button>
        </div>
        <div
          id="trades-filters"
          className={`px-3 pb-3 ${
            filtersOpen === null ? FILTERS_DEFAULT_CLASS : filtersOpen ? "block" : "hidden"
          }`}
        >
          <div className="flex flex-wrap gap-3 items-end">
            {/* Compte : premier filtre, parce qu'un trade appartient d'abord à
                un compte, et que chaque compte peut avoir sa propre devise. */}
            {accounts.length > 0 && (
              <div className="flex flex-col gap-1 min-w-[170px]">
                <label className="text-xs text-muted">{t("trades_filter_label_account")}</label>
                <select
                  value={filters.account}
                  onChange={(e) => setFilters((f) => ({ ...f, account: e.target.value }))}
                  className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">{t("trades_filter_all_accounts")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firm}
                      {a.account_number ? ` · ${a.account_number}` : ""}
                      {a.status !== "active"
                        ? ` (${a.status === "passed" ? t("challenge_status_passed") : t("challenge_status_failed")})`
                        : ""}
                    </option>
                  ))}
                  <option value={NO_ACCOUNT}>{t("trades_filter_no_account")}</option>
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs text-muted">{t("trades_filter_label_pair")}</label>
              <select
                value={filters.pair}
                onChange={(e) => setFilters((f) => ({ ...f, pair: e.target.value }))}
                className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                <option value="">{t("trades_filter_all_pairs")}</option>
                {allPairs.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-xs text-muted">{t("trades_filter_label_dir")}</label>
              <select
                value={filters.direction}
                onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
                className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                <option value="">{t("trades_filter_all")}</option>
                <option value="long">LONG</option>
                <option value="short">SHORT</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-xs text-muted">{t("trades_filter_label_result")}</label>
              <select
                value={filters.result}
                onChange={(e) => setFilters((f) => ({ ...f, result: e.target.value }))}
                className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                <option value="">{t("trades_filter_all")}</option>
                <option value="win">{t("trades_filter_winners")}</option>
                <option value="loss">{t("trades_filter_losers")}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs text-muted">{t("trades_filter_date_from")}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs text-muted">{t("trades_filter_date_to")}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 text-sm text-muted border border-border rounded-lg hover:text-foreground hover:bg-surface transition-colors self-end"
              >
                {t("trades_filter_reset")}
              </button>
            )}

            <button
              onClick={exportCSV}
              disabled={exporting}
              className="px-3 py-1.5 text-sm text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors self-end ml-auto disabled:opacity-50"
            >
              {exporting ? "..." : t("trades_export_csv")}
            </button>
          </div>
          {/* L'échec s'affiche sous le bouton : un fichier qui ne se télécharge
              pas et ne dit rien ressemble à un bouton mort. */}
          {exportError && <p className="text-sm text-loss mt-2">{exportError}</p>}
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-3 p-3 bg-surface border border-border rounded-lg">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-foreground font-medium">
              {selectAllMatching ? total : selectedIds.size} {t("trades_selected")}
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-3 py-1.5 text-sm bg-loss/10 text-loss border border-loss/30 rounded-lg font-medium hover:bg-loss/20 transition-colors disabled:opacity-50"
            >
              {bulkDeleting ? "..." : t("trades_delete_selection")}
            </button>
            <button
              onClick={() => { setSelectedIds(new Set()); setSelectAllMatching(false); }}
              className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              {t("trades_deselect_all")}
            </button>
          </div>

          {/* Sortie de la page courante : sans ça, vider 300 trades demande de
              cocher, supprimer, changer de page, recommencer quinze fois. */}
          {allSelected && total > trades.length && (
            <p className="text-sm text-muted mt-2 pt-2 border-t border-border">
              {selectAllMatching ? (
                <>
                  {t("trades_select_all_matching_done").replace("{count}", String(total))}{" "}
                  <button
                    onClick={() => setSelectAllMatching(false)}
                    className="text-accent hover:underline font-medium"
                  >
                    {t("trades_select_page_only").replace("{count}", String(trades.length))}
                  </button>
                </>
              ) : (
                <>
                  {t("trades_select_page_done").replace("{count}", String(trades.length))}{" "}
                  <button
                    onClick={() => setSelectAllMatching(true)}
                    className="text-accent hover:underline font-medium"
                  >
                    {t("trades_select_all_matching").replace("{count}", String(total))}
                  </button>
                </>
              )}
            </p>
          )}

          {bulkError && <p className="text-sm text-loss mt-2">{bulkError}</p>}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface text-muted text-left">
                <th className="px-3 py-2 w-8"><div className="skeleton h-4 w-4 rounded" /></th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">{t("trades_col_pair")}</th>
                <th className="px-3 py-2 font-medium">Dir.</th>
                <th className="px-3 py-2 font-medium">P&amp;L</th>
                <th className="px-3 py-2 font-medium">{t("ict_emotion")}</th>
                <th className="px-3 py-2 font-medium">Discipline</th>
                <th className="px-3 py-2 font-medium">Killzone</th>
                <th className="px-3 py-2 font-medium text-muted">{t("trades_col_duration")}</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-surface"}>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-4 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-24 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-16 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-12 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-16 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-20 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-12 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-20 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-12 rounded" /></td>
                  <td className="px-3 py-2"><div className="skeleton h-4 w-4 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : trades.length === 0 ? (
        <p className="text-muted py-4">{t("trades_empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface text-muted text-left">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="accent-accent w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <SortableTh column="date"       label="Date"       sort={sort} onSort={handleSortClick} />
                  <SortableTh column="pair"       label={t("trades_col_pair")} sort={sort} onSort={handleSortClick} />
                  <SortableTh column="direction"  label="Dir."       sort={sort} onSort={handleSortClick} />
                  <SortableTh column="pnl"        label="P&L"        sort={sort} onSort={handleSortClick} />
                  <SortableTh column="emotion"    label={t("ict_emotion")} sort={sort} onSort={handleSortClick} />
                  <SortableTh column="discipline" label="Discipline" sort={sort} onSort={handleSortClick} />
                  <SortableTh column="killzone"   label="Killzone"   sort={sort} onSort={handleSortClick} />
                  <th className="px-3 py-2 font-medium text-muted">{t("trades_col_duration")}</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((tr, i) => {
                  const dir = normalizeDirection(tr.direction);
                  const net = tr.pnl + (tr.commission || 0) + (tr.swap || 0);
                  const isTopGain = top3GainIds.has(tr.id);
                  const isTopLoss = top3LossIds.has(tr.id);

                  const kzValue = tr.ict_killzone ?? detectKillzone(tr.open_time);
                  const tradeChecklistItems = tr.strategy_id ? (checklistMap[tr.strategy_id] ?? null) : null;
                  const checklistTotal = tradeChecklistItems?.length ?? 0;
                  const checklistScore = tradeChecklistItems
                    ? tradeChecklistItems.filter((item) => tr.ict_checklist?.[item.key]).length
                    : 0;

                  const dateObj = tr.open_time ? new Date(tr.open_time) : null;
                  const dateStr = dateObj
                    ? `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")} · ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`
                    : "—";

                  const duration =
                    tr.open_time && tr.close_time
                      ? formatDurationCompact(tr.open_time, tr.close_time)
                      : "—";

                  return (
                    <tr
                      key={tr.id}
                      onClick={() => setSelectedTrade(tr as TradeDetail)}
                      className={`group cursor-pointer hover:bg-accent/5 transition-colors ${i % 2 === 0 ? "bg-card" : "bg-surface"} ${isChecked(tr.id) ? "!bg-accent/5" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked(tr.id)}
                          onChange={() => toggleSelect(tr.id)}
                          className="accent-accent w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Date + Heure */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-mono text-xs text-muted">{dateStr}</span>
                      </td>

                      {/* Paire */}
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-mono text-sm font-semibold text-foreground">{tr.pair}</span>
                          {/* Indicateur de capture jointe. Il portait aussi
                              une note A-D venue de l'analyse visuelle IA,
                              retirée le 2026-08-14 : le libellé annonçait donc
                              « Analyse visuelle IA » aux lecteurs d'écran pour
                              ce qui n'est plus qu'un trombone. */}
                          {tr.screenshot_path ? (
                            <Camera className="w-3.5 h-3.5 text-muted/60 shrink-0" aria-label={t("trade_screenshot")} />
                          ) : null}
                        </span>
                      </td>

                      {/* Direction */}
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${dir === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                          {dir === "long" ? "LONG" : "SHORT"}
                        </span>
                      </td>

                      {/* P&L avec glow top 3 */}
                      <td className={`px-3 py-2 ${isTopGain ? "bg-gradient-to-r from-profit/10 to-transparent" : isTopLoss ? "bg-gradient-to-r from-loss/10 to-transparent" : ""}`}>
                        <span className={`font-mono font-semibold text-sm ${net >= 0 ? "text-profit" : "text-loss"}`}>
                          {money(net, tradeCurrency(tr.challenge_id, currencyMap), { digits: 2, signed: true })}
                        </span>
                      </td>

                      {/* Émotion */}
                      <td className="px-3 py-2">
                        <EmotionTag emotion={tr.emotion} checklist={tr.ict_checklist ?? null} />
                      </td>

                      {/* Discipline */}
                      <td className="px-3 py-2">
                        {tr.ict_checklist != null ? (
                          <ConformityRing score={checklistScore} total={checklistTotal} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Killzone */}
                      <td className="px-3 py-2">
                        <KillzonePill kz={kzValue} />
                      </td>

                      {/* Durée */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-mono text-xs text-muted">{duration}</span>
                      </td>

                      {/* Supprimer — hover only */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(tr.id)}
                          disabled={deletingId === tr.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-loss disabled:opacity-50"
                          title={t("trades_delete")}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination. Affichée dès qu'il y a un trade, et pas seulement à
              partir de deux pages : le choix du nombre de lignes vit ici, et il
              doit rester atteignable pour revenir en arrière. */}
          {total > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
              <p className="text-sm text-muted">
                {totalPages > 1 && `${t("trades_page")} ${page + 1} / ${totalPages} · `}
                {total} trades
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted" htmlFor="trades-page-size">
                  {t("trades_per_page")}
                </label>
                <select
                  id="trades-page-size"
                  value={pageSize}
                  onChange={(e) => changePageSize(Number(e.target.value))}
                  className="bg-surface border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:border-accent"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                {totalPages > 1 && (
                  <>
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 text-sm bg-surface border border-border rounded-lg text-foreground disabled:opacity-30 hover:bg-border transition-colors"
                    >
                      {t("trades_prev")}
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-sm bg-surface border border-border rounded-lg text-foreground disabled:opacity-30 hover:bg-border transition-colors"
                    >
                      {t("trades_next")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {selectedTrade && (
        <TradeDetailPanel
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onSaved={() => { loadTrades(); loadGlobalStats(); onTradeUpdated?.(); }}
          onPrev={handlePanelPrev}
          onNext={handlePanelNext}
          hasPrev={hasPanelPrev}
          hasNext={hasPanelNext}
          navIndex={selectedIndex >= 0 ? selectedIndex : undefined}
          navTotal={trades.length}
        />
      )}
    </section>
  );
}
