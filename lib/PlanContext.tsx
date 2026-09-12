"use client";

import { createClient } from "@/lib/supabase/client";
import { browserTimezone, normalizeTimezone, quotaResetKey } from "@/lib/timezone";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * ⚠️⚠️ LES CLÉS DE QUOTA DOIVENT ÊTRE CELLES DU SERVEUR, À LA LETTRE.
 * `daily_ai_reset` n'est pas un affichage : le client l'ÉCRIT et le serveur la
 * COMPARE à sa propre clé (`lib/api-auth` → `getQuotaFromProfile`). Quand les
 * deux ne se ressemblent pas, le serveur conclut « nouveau jour » et remet le
 * compteur à zéro : le quota d'analyse, qui coûte de l'argent à chaque appel,
 * repartait à neuf.
 *
 * ⚠️ L'ANCIEN `getWeekStart` MÉLANGEAIT DEUX HORLOGES EN QUATRE LIGNES :
 * `getDay()`/`setDate()` lisent l'heure LOCALE, `toISOString()` rend la date
 * UTC. Pour un trader à Paris un lundi à 00 h 30, il rendait donc le DIMANCHE
 * précédent, c'est-à-dire une clé que le serveur, qui rend toujours un lundi,
 * ne pouvait reconnaître aucun jour de l'année.
 */
function clesDuQuota(fuseau: string, plan: PlanType): string {
  return quotaResetKey(PLAN_LIMITS.analyze[plan].resetMode, fuseau);
}

export type PlanType = "free" | "plus" | "premium";

export type SubscriptionStatus = "active" | "past_due" | "canceling" | "trialing" | null;

interface PlanContextValue {
  plan: PlanType;
  loading: boolean;
  canUseStrategy: boolean;
  canUseAI: boolean;
  canImportCSV: boolean;
  aiRemaining: number | null; // null = unlimited
  maxAccounts: number | null; // null = unlimited
  maxStrategies: number | null; // null = unlimited
  subscriptionStatus: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  /**
   * Le compte visite l'app en mode démonstration. Sert à servir les fixtures
   * (analyse IA, macro, coach) sans appel au modèle ni quota consommé, et à
   * afficher les bandeaux « données fictives ». Lu ici parce que le profil est
   * déjà chargé : pas de requête supplémentaire.
   */
  demoMode: boolean;
  incrementAIUsage: () => Promise<void>;
  refreshPlan: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue>({
  plan: "free",
  loading: true,
  canUseStrategy: false,
  canUseAI: false,
  canImportCSV: false,
  aiRemaining: 0,
  maxAccounts: 1,
  maxStrategies: 1,
  subscriptionStatus: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  demoMode: false,
  incrementAIUsage: async () => {},
  refreshPlan: async () => {},
});

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [plan, setPlan] = useState<PlanType>("free");
  const [loading, setLoading] = useState(true);
  const [dailyAiCount, setDailyAiCount] = useState(0);
  const [dailyAiReset, setDailyAiReset] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<Date | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  /**
   * Le fuseau du PROFIL, celui que lit le serveur. Le navigateur ne sert que de
   * repli tant que le profil n'est pas chargé : un trader peut avoir choisi
   * dans Réglages un fuseau autre que celui de sa machine, et c'est son choix
   * qui fait foi des deux côtés.
   */
  const [fuseau, setFuseau] = useState<string>(normalizeTimezone(null));

  /** La lecture elle-même. Elle a le droit d'échouer ; c'est son appelant qui range. */
  const chargerLePlan = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Ordre de deploiement indifferent : on tente la colonne demo_mode, et on
    // se rabat sur le select historique si la migration 20260730_demo_mode.sql
    // n'est pas encore passee. Sans ce repli, un select en echec ferait lire
    // « free » a un abonne payant (la colonne inconnue renvoie une erreur, pas
    // une valeur nulle) — regression bien plus grave que l'absence du mode demo.
    const BASE_COLS = "plan, plan_expires_at, daily_ai_count, daily_ai_reset, email, timezone";
    let { data, error: profileError } = await supabase
      .from("profiles")
      .select(`${BASE_COLS}, demo_mode`)
      .eq("id", user.id)
      .single();
    if (profileError && /demo_mode/.test(profileError.message)) {
      ({ data, error: profileError } = await supabase
        .from("profiles")
        .select(BASE_COLS)
        .eq("id", user.id)
        .single());
    }

    let effectivePlan: PlanType = "free";
    if (data) {
      /**
       * ⚠️⚠️ ON N'ÉCRIT QUE SI C'EST DIFFÉRENT. Cette ligne réécrivait le même
       * e-mail À CHAQUE CHARGEMENT DE PAGE : relevé sur le réseau, trois PATCH
       * sur `profiles` pour une seule arrivée sur « Mes trades », dont deux qui
       * remettaient la valeur déjà en place. Une écriture qui ne change rien
       * n'est pas gratuite : elle réveille la ligne, ses déclencheurs et ses
       * abonnements temps réel, pour chaque page vue de chaque abonné.
       */
      if (user.email && data.email !== user.email) {
        await supabase.from("profiles").update({ email: user.email }).eq("id", user.id);
      }
      // Check expiration
      effectivePlan = (data.plan as PlanType) || "free";
      if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) {
        effectivePlan = "free";
      }
      setPlan(effectivePlan);
      // Fail-open : si la migration 20260730_demo_mode.sql n'est pas appliquee,
      // la colonne est absente du retour et le mode demo reste simplement off.
      setDemoMode(!!(data as Record<string, unknown>).demo_mode);

      const zone = normalizeTimezone(
        ((data as Record<string, unknown>).timezone as string | null) ?? browserTimezone(),
      );
      setFuseau(zone);
      // Free plan tracks weekly usage; plus/premium tracks daily
      const resetKey = clesDuQuota(zone, effectivePlan);
      if (data.daily_ai_reset !== resetKey) {
        setDailyAiCount(0);
        setDailyAiReset(resetKey);
      } else {
        setDailyAiCount(data.daily_ai_count || 0);
        setDailyAiReset(data.daily_ai_reset);
      }
    } else if (profileError?.code === "PGRST116") {
      // 0 ligne confirmé (PGRST116) — le profil n'existe vraiment pas : on le
      // crée en free. IMPORTANT : insert, jamais upsert — un échec transitoire
      // du select (réseau, refresh token) passait ici et l'upsert ÉCRASAIT le
      // plan réel du profil avec "free" (downgrade silencieux de payants).
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        plan: "free",
        daily_ai_count: 0,
      });
      setPlan("free");
      setDailyAiCount(0);
    } else {
      // Échec transitoire du select : ne rien écrire, ne pas downgrader
      // l'état local — on garde le plan déjà chargé et on retentera au
      // prochain loadPlan (auth event / refresh).
    }

    // Fetch active subscription for billing banners
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, cancel_at_period_end, current_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Cohérence profil/abonnement : un profil FREE avec une souscription
    // « active/canceling » est une ligne obsolète (souscriptions de l'ère
    // Stripe test, ou plan piloté manuellement via Supabase) — on l'ignore
    // pour ne jamais afficher « ton abonnement se termine le … » à un free.
    // Exception : past_due reste visible (paiement à régulariser).
    const subIsStale = !!sub && effectivePlan === "free" && sub.status !== "past_due";

    if (sub && !subIsStale) {
      setCancelAtPeriodEnd(sub.cancel_at_period_end ?? false);
      setCurrentPeriodEnd(
        sub.current_period_end ? new Date(sub.current_period_end) : null
      );
      if (sub.status === "past_due") {
        setSubscriptionStatus("past_due");
      } else if (sub.cancel_at_period_end) {
        setSubscriptionStatus("canceling");
      } else if (sub.status === "active") {
        setSubscriptionStatus("active");
      } else if (sub.status === "trialing") {
        setSubscriptionStatus("trialing");
      } else {
        setSubscriptionStatus(null);
      }
    } else {
      setSubscriptionStatus(null);
      setCancelAtPeriodEnd(false);
      setCurrentPeriodEnd(null);
    }

  }, [supabase]);

  /**
   * LE CHARGEMENT SE TERMINE, MÊME QUAND LE RÉSEAU NON.
   *
   * ⚠️⚠️ `getUser()` REJETTE POUR DE VRAI, ET SOUVENT. Relevé dans la console
   * d'une session ordinaire : quatorze « TypeError: Failed to fetch » sur
   * `_getUser` et `_refreshAccessToken`, étalés sur la journée, à chaque fois
   * que la machine se réveille. Cette lecture n'avait aucune garde : une seule
   * de ces rejections laissait `loading` à `true` POUR TOUJOURS.
   *
   * ⚠️ ET LES DEUX SYMPTÔMES ONT LA MÊME CAUSE. Les pages gardées par le plan
   * lisent `plan`, qui vaut « free » au départ : un abonné restait devant le
   * mur payant jusqu'au rechargement. Et depuis que la page de backtest attend
   * le chargement pour ne plus mentir, une rejection la figerait sur son écran
   * d'attente. C'est ici qu'il faut traiter ça, pas dans chaque page.
   *
   * ⚠️ ON N'INVENTE PAS DE PLAN EN CAS D'ÉCHEC : on garde celui qu'on avait, et
   * on arrête d'attendre. Promouvoir quelqu'un par accident ouvrirait des
   * fonctionnalités payantes sur une panne réseau ; le rétrograder afficherait
   * un mur payant à un abonné.
   */
  const loadPlan = useCallback(async () => {
    try {
      await chargerLePlan();
    } finally {
      setLoading(false);
    }
  }, [chargerLePlan]);

  useEffect(() => {
    loadPlan();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadPlan();
      } else if (event === "SIGNED_OUT") {
        setPlan("free");
        setDailyAiCount(0);
        setDailyAiReset(null);
        setSubscriptionStatus(null);
        setCancelAtPeriodEnd(false);
        setCurrentPeriodEnd(null);
        setDemoMode(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  const incrementAIUsage = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const resetKey = clesDuQuota(fuseau, plan);
    const newCount = dailyAiReset === resetKey ? dailyAiCount + 1 : 1;

    await supabase
      .from("profiles")
      .update({ daily_ai_count: newCount, daily_ai_reset: resetKey })
      .eq("id", user.id);

    setDailyAiCount(newCount);
    setDailyAiReset(resetKey);
  }, [supabase, dailyAiCount, dailyAiReset, plan, fuseau]);

  // Derived permissions.
  // Depuis 2026-07 : la boucle cœur (stratégie + analyse IA) est ouverte à tous
  // les plans — le free a 1 analyse « découverte » à vie (gate serveur dans
  // /api/analyze, marqueur session_reviews) et maxStrategies (1 stratégie).
  const canUseStrategy = true;
  const canUseAI = true;

  const effectiveResetKey = clesDuQuota(fuseau, plan);
  const effectiveCount = dailyAiReset === effectiveResetKey ? dailyAiCount : 0;

  const aiLimit = PLAN_LIMITS.analyze[plan].limit;
  const aiRemaining = Math.max(0, aiLimit - effectiveCount);

  // Free users can import CSV (1/day limit enforced in CsvImport component)
  const canImportCSV = true;
  const maxAccounts = plan === "free" ? 1 : null;
  const maxStrategies = plan === "free" ? 1 : null;

  return (
    <PlanContext.Provider
      value={{
        plan,
        loading,
        canUseStrategy,
        canUseAI,
        canImportCSV,
        aiRemaining,
        maxAccounts,
        maxStrategies,
        subscriptionStatus,
        cancelAtPeriodEnd,
        currentPeriodEnd,
        demoMode,
        incrementAIUsage,
        refreshPlan: loadPlan,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
