"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "axel.dupuis111@gmail.com";

const inputClass =
  "w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

interface ContactMessage {
  id: string;
  created_at: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
}

export default function AdminPage() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetEmail, setTargetEmail] = useState("");
  const [targetPlan, setTargetPlan] = useState<"free" | "plus">("plus");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [tab, setTab] = useState<"plans" | "messages" | "funnel" | "usernames" | "affiliation">("plans");
  // Modération des pseudos (libellés FR en dur, convention page interne)
  const [modUsername, setModUsername] = useState("");
  const [modNewUsername, setModNewUsername] = useState("");
  const [modMessage, setModMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [modUpdating, setModUpdating] = useState(false);
  // Funnel d'activation (page interne : libellés FR en dur, convention admin)
  const [funnel, setFunnel] = useState<{
    days: number; eventsTableMissing: boolean; signups: number;
    activated: number; analyzed: number; checkoutStarted: number; payingNow: number;
    tasterUsed: number; upgradeCtaUsers: number; upgradeCtaBySource: Record<string, number>;
    signupsBySource: Record<string, number>;
  } | null>(null);
  const [funnelDays, setFunnelDays] = useState<7 | 30>(30);
  const [funnelLoading, setFunnelLoading] = useState(false);
  // Affiliation influenceurs (page interne : libellés FR en dur, convention admin)
  const [affMonth, setAffMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [affData, setAffData] = useState<{
    month: string; commissionRate: number;
    codes: { code: string; subscriptions: number; activeSubscriptions: number; gross: number; eligible: number; commission: number }[];
    totals: { gross: number; eligible: number; commission: number };
  } | null>(null);
  const [affLoading, setAffLoading] = useState(false);
  const [affError, setAffError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email === ADMIN_EMAIL) {
      setAuthorized(true);
      loadMessages();
    }
    setLoading(false);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setContactMessages(data);
  }

  async function loadFunnel(days: 7 | 30) {
    setFunnelLoading(true);
    try {
      const res = await fetch(`/api/admin/funnel?days=${days}`);
      if (res.ok) setFunnel(await res.json());
    } catch {
      // silencieux — page interne
    } finally {
      setFunnelLoading(false);
    }
  }

  async function loadAffiliation(month: string) {
    setAffLoading(true);
    setAffError(null);
    try {
      const res = await fetch(`/api/admin/affiliation?month=${month}`);
      if (!res.ok) {
        setAffError("Erreur lors du chargement des données Stripe.");
        return;
      }
      setAffData(await res.json());
    } catch {
      setAffError("Erreur réseau");
    } finally {
      setAffLoading(false);
    }
  }

  function euros(cents: number): string {
    return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }

  async function markHandled(id: string) {
    await supabase.from("contact_messages").update({ status: "handled" }).eq("id", id);
    setContactMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: "handled" } : m));
  }

  async function handleUpdate() {
    const email = targetEmail.trim().toLowerCase();
    if (!email) {
      setMessage({ type: "error", text: t("admin_email_required") });
      return;
    }

    setUpdating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan: targetPlan }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || t("admin_user_not_found").replace("{email}", email) });
      } else {
        setMessage({ type: "success", text: data.message });
        setTargetEmail("");
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setUpdating(false);
    }
  }

  async function handleModerateUsername(action: "rename" | "clear") {
    const current = modUsername.trim();
    if (!current) {
      setModMessage({ type: "error", text: "Renseigne le pseudo actuel" });
      return;
    }
    if (action === "rename" && !modNewUsername.trim()) {
      setModMessage({ type: "error", text: "Renseigne le nouveau pseudo" });
      return;
    }
    if (action === "clear" && !window.confirm(`Retirer le pseudo « ${current} » ? L'utilisateur disparaîtra du classement et devra en choisir un nouveau.`)) {
      return;
    }

    setModUpdating(true);
    setModMessage(null);

    try {
      const res = await fetch("/api/admin/moderate-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: current, action, newUsername: modNewUsername.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModMessage({ type: "error", text: data.message || "Erreur" });
      } else {
        setModMessage({ type: "success", text: data.message });
        setModUsername("");
        setModNewUsername("");
      }
    } catch {
      setModMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setModUpdating(false);
    }
  }

  if (loading) {
    return <div className="skeleton h-8 w-48 rounded-lg" />;
  }

  if (!authorized) {
    return (
      <div className="text-center py-20">
        <p className="text-loss text-lg font-semibold">{t("admin_unauthorized")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">{t("admin_title")}</h1>
      <p className="text-muted mt-1">{t("admin_subtitle")}</p>

      {/* Tabs */}
      <div className="flex gap-1 mt-6 bg-surface rounded-lg p-1 border border-border">
        <button onClick={() => setTab("plans")} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "plans" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
          {t("admin_tab_plans")}
        </button>
        <button onClick={() => setTab("messages")} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "messages" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
          {t("admin_tab_messages")} {contactMessages.filter((m) => m.status === "new").length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-accent text-white text-xs rounded-full">{contactMessages.filter((m) => m.status === "new").length}</span>}
        </button>
        <button onClick={() => { setTab("funnel"); if (!funnel) loadFunnel(funnelDays); }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "funnel" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
          Funnel
        </button>
        <button onClick={() => setTab("usernames")} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "usernames" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
          Pseudos
        </button>
        <button onClick={() => { setTab("affiliation"); if (!affData) loadAffiliation(affMonth); }} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${tab === "affiliation" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
          Affiliation
        </button>
      </div>

      {tab === "plans" && (
        <div className="mt-6 bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">{t("admin_email")}</label>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="user@email.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">{t("admin_plan")}</label>
            <select
              value={targetPlan}
              onChange={(e) => setTargetPlan(e.target.value as "free" | "plus")}
              className={inputClass}
            >
              <option value="free">Free</option>
              <option value="plus">Plus</option>
            </select>
          </div>

          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-profit" : "text-loss"}`}>
              {message.text}
            </p>
          )}

          <button
            onClick={handleUpdate}
            disabled={updating}
            className="w-full py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {updating ? "..." : t("admin_update")}
          </button>
        </div>
      )}

      {tab === "usernames" && (
        <div className="mt-6 bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Modération des pseudos</h2>
            <p className="text-xs text-muted mt-1">
              Renomme ou retire un pseudo affiché publiquement (classement, défis, profil public).
              Un pseudo signalé par la modération est déjà masqué à l&apos;affichage, mais reste en base tant qu&apos;il n&apos;est pas traité ici.
            </p>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Pseudo actuel</label>
            <input
              type="text"
              value={modUsername}
              onChange={(e) => setModUsername(e.target.value)}
              placeholder="pseudo_a_moderer"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Nouveau pseudo (pour renommer)</label>
            <input
              type="text"
              value={modNewUsername}
              onChange={(e) => setModNewUsername(e.target.value)}
              placeholder="trader_1234"
              className={inputClass}
            />
          </div>

          {modMessage && (
            <p className={`text-sm ${modMessage.type === "success" ? "text-profit" : "text-loss"}`}>
              {modMessage.text}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => handleModerateUsername("rename")}
              disabled={modUpdating}
              className="flex-1 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {modUpdating ? "..." : "Renommer"}
            </button>
            <button
              onClick={() => handleModerateUsername("clear")}
              disabled={modUpdating}
              className="flex-1 py-2.5 bg-loss/10 border border-loss/30 text-loss rounded-lg font-medium hover:bg-loss/20 transition-colors disabled:opacity-50"
            >
              {modUpdating ? "..." : "Retirer le pseudo"}
            </button>
          </div>
        </div>
      )}

      {tab === "funnel" && (
        <div className="mt-6 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground">Funnel d&apos;activation</h2>
            <div className="flex gap-1">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { setFunnelDays(d); loadFunnel(d); }}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${funnelDays === d ? "bg-accent/10 border-accent/30 text-accent" : "border-border text-muted hover:text-foreground"}`}
                >
                  {d} j
                </button>
              ))}
            </div>
          </div>

          {funnelLoading && <p className="text-sm text-muted">Chargement…</p>}
          {funnel?.eventsTableMissing && (
            <p className="text-sm text-loss mb-3">⚠️ Table product_events absente — appliquer la migration 20260703_create_product_events.sql.</p>
          )}
          {funnel && !funnelLoading && (
            <div className="space-y-2">
              {[
                { label: "Inscrits", value: funnel.signups, base: null as number | null },
                { label: "Activés (import / démo / trade)", value: funnel.activated, base: funnel.signups },
                { label: "Analyse IA lancée", value: funnel.analyzed, base: funnel.activated },
                { label: "Checkout démarré", value: funnel.checkoutStarted, base: funnel.analyzed },
              ].map((step) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="text-sm text-muted flex-1">{step.label}</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{step.value}</span>
                  <span className="text-xs text-muted tabular-nums w-14 text-right">
                    {step.base != null && step.base > 0 ? `${Math.round((step.value / step.base) * 100)} %` : "—"}
                  </span>
                </div>
              ))}

              {/* Inscriptions attribuées (utm_source / ref — liens influenceurs) */}
              {Object.keys(funnel.signupsBySource ?? {}).length > 0 && (
                <div className="pl-4 space-y-1">
                  {Object.entries(funnel.signupsBySource)
                    .sort(([, a], [, b]) => b - a)
                    .map(([source, count]) => (
                      <div key={source} className="flex items-center gap-3">
                        <span className="text-xs text-muted/80 flex-1">via {source}</span>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{count}</span>
                        <span className="w-14" />
                      </div>
                    ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-3 mt-2 border-t border-border">
                <span className="text-sm text-muted flex-1">Payants actuellement (global)</span>
                <span className="text-sm font-bold text-profit tabular-nums">{funnel.payingNow}</span>
                <span className="w-14" />
              </div>

              {/* Échelle d'upgrade free→plus : quel déclencheur convertit ? */}
              <div className="pt-3 mt-2 border-t border-border space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Échelle d&apos;upgrade (free)</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted flex-1">Message coach découverte utilisé</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{funnel.tasterUsed ?? 0}</span>
                  <span className="w-14" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted flex-1">CTA upgrade cliqué (utilisateurs)</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{funnel.upgradeCtaUsers ?? 0}</span>
                  <span className="w-14" />
                </div>
                {Object.entries(funnel.upgradeCtaBySource ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center gap-3 pl-4">
                      <span className="text-xs text-muted/80 flex-1">
                        {{
                          countdown: "Compte à rebours (quota hebdo)",
                          teaser_coach: "Carte teaser — coach",
                          teaser_debrief: "Carte teaser — débrief",
                          teaser_weekly: "Carte teaser — plan hebdo",
                          taster_footer: "Après le message découverte",
                        }[source] ?? source}
                      </span>
                      <span className="text-xs font-semibold text-foreground tabular-nums">{count}</span>
                      <span className="w-14" />
                    </div>
                  ))}
              </div>
              <p className="text-xs text-muted pt-2">Fenêtre : {funnel.days} derniers jours. Les % sont la conversion vers l&apos;étape précédente.</p>
            </div>
          )}
        </div>
      )}

      {tab === "affiliation" && (
        <div className="mt-6 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5 gap-3">
            <h2 className="text-sm font-semibold text-foreground">Commissions influenceurs</h2>
            <input
              type="month"
              value={affMonth}
              onChange={(e) => { setAffMonth(e.target.value); if (e.target.value) loadAffiliation(e.target.value); }}
              className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label="Mois des commissions"
            />
          </div>

          {affLoading && <p className="text-sm text-muted">Chargement depuis Stripe…</p>}
          {affError && <p className="text-sm text-loss">{affError}</p>}

          {affData && !affLoading && !affError && (
            affData.codes.length === 0 ? (
              <p className="text-sm text-muted">
                Aucun abonnement attribué à un code promo pour l&apos;instant. Les abonnements
                souscrits avec un code apparaîtront ici automatiquement.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                        <th className="py-2 pr-3 font-semibold">Code</th>
                        <th className="py-2 pr-3 font-semibold text-right">Abonnés (actifs)</th>
                        <th className="py-2 pr-3 font-semibold text-right">Encaissé</th>
                        <th className="py-2 pr-3 font-semibold text-right">Assiette ≤ 12 mois</th>
                        <th className="py-2 font-semibold text-right">Commission {Math.round(affData.commissionRate * 100)} %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {affData.codes.map((c) => (
                        <tr key={c.code} className="border-b border-border/50">
                          <td className="py-2 pr-3 font-mono font-semibold text-foreground">{c.code}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-foreground">{c.subscriptions} ({c.activeSubscriptions})</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-foreground">{euros(c.gross)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-foreground">{euros(c.eligible)}</td>
                          <td className="py-2 text-right tabular-nums font-bold text-accent">{euros(c.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="py-2 pr-3 font-semibold text-muted">Total</td>
                        <td />
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold text-foreground">{euros(affData.totals.gross)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold text-foreground">{euros(affData.totals.eligible)}</td>
                        <td className="py-2 text-right tabular-nums font-bold text-accent">{euros(affData.totals.commission)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-muted">
                  Encaissé = factures payées du mois (remboursements exclus). Assiette = part encaissée dans
                  les 12 premiers mois de chaque abonnement, conformément au contrat. La commission se paie
                  sur facture de l&apos;influenceur, seuil 50 €.
                </p>
              </div>
            )
          )}
        </div>
      )}

      {tab === "messages" && (
        <div className="mt-6 space-y-3">
          {contactMessages.length === 0 ? (
            <p className="text-muted text-sm">{t("admin_no_messages")}</p>
          ) : (
            contactMessages.map((msg) => (
              <div key={msg.id} className={`bg-card border rounded-xl p-4 ${msg.status === "new" ? "border-accent/30" : "border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium text-sm">{msg.name}</span>
                    <span className="text-muted text-xs">{msg.email}</span>
                    {msg.status === "new" && <span className="px-1.5 py-0.5 bg-accent/10 text-accent text-xs rounded-full font-medium">{t("admin_msg_new")}</span>}
                  </div>
                  <span className="text-muted text-xs">{new Date(msg.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {msg.subject && <p className="text-foreground text-sm font-medium mb-1">{msg.subject}</p>}
                <p className="text-muted text-sm whitespace-pre-wrap">{msg.message}</p>
                {msg.status === "new" && (
                  <button onClick={() => markHandled(msg.id)} className="mt-3 px-3 py-1 bg-profit/10 border border-profit/20 text-profit rounded-lg text-xs font-medium hover:bg-profit/20 transition-colors">
                    {t("admin_msg_mark_handled")}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
