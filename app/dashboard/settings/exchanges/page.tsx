"use client";

import { useEffect, useState } from "react";

interface Connection {
  id: string;
  exchange: string;
  label: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

type ToastType = "success" | "error" | "warning";

const EXCHANGES = [{ value: "binance", label: "Binance" }];

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  active: { text: "Connecté", className: "bg-profit/10 text-profit border-profit/30" },
  error: { text: "Erreur", className: "bg-loss/10 text-loss border-loss/30" },
  disabled: { text: "Désactivé", className: "bg-muted/10 text-muted border-border" },
};

export default function ExchangeSettingsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: ToastType; text: string } | null>(null);

  const [exchange, setExchange] = useState("binance");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [syncingId, setSyncingId] = useState<string | null>(null);

  function showToast(type: ToastType, text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  async function fetchConnections() {
    const res = await fetch("/api/exchanges");
    if (res.ok) {
      const data = await res.json();
      setConnections(data.connections);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchConnections();
  }, []);

  async function handleSubmit() {
    if (!label.trim() || !apiKey.trim() || !apiSecret.trim()) {
      showToast("error", "Tous les champs sont requis.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/exchanges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exchange, label: label.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      showToast("error", data.error || "Erreur lors de la connexion.");
      return;
    }

    if (data.warning) {
      showToast("warning", data.warning);
    } else {
      showToast("success", "Compte connecté avec succès.");
    }

    setLabel("");
    setApiKey("");
    setApiSecret("");
    fetchConnections();
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/exchanges/${id}/sync`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        showToast("error", data.error || "Erreur lors de la synchronisation.");
        return;
      }

      const parts: string[] = [];
      if (data.inserted > 0) {
        parts.push(`${data.inserted} nouveau${data.inserted > 1 ? "x" : ""} trade${data.inserted > 1 ? "s" : ""} ajouté${data.inserted > 1 ? "s" : ""}`);
      }
      if (data.synced > 0 && data.inserted === 0) {
        parts.push("aucun nouveau trade");
      }
      if (data.open > 0) {
        parts.push(`${data.open} position${data.open > 1 ? "s" : ""} ouverte${data.open > 1 ? "s" : ""} en cours`);
      }
      if (data.synced === 0 && data.open === 0) {
        parts.push("aucun trade trouvé sur les 30 derniers jours");
      }

      const msg = data.synced > 0
        ? `${data.synced} trade${data.synced > 1 ? "s" : ""} synchronisé${data.synced > 1 ? "s" : ""} (${parts.join(", ")}).`
        : parts.join(", ").replace(/^./, (c) => c.toUpperCase()) + ".";

      showToast("success", msg);
      fetchConnections();
    } catch {
      showToast("error", "Impossible de contacter le serveur.");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/exchanges/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteId(null);

    if (res.ok) {
      showToast("success", "Connexion supprimée.");
      fetchConnections();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", (data as { error?: string }).error || "Erreur lors de la suppression.");
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-[70] px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm break-words ${
            toast.type === "success"
              ? "bg-profit/10 border border-profit/30 text-profit"
              : toast.type === "warning"
                ? "bg-warning/10 border border-warning/30 text-warning"
                : "bg-loss/10 border border-loss/30 text-loss"
          }`}
        >
          {toast.text}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Connexions Exchange</h1>
        <p className="text-muted mt-1">
          Connecte tes comptes exchange pour synchroniser automatiquement tes trades.
        </p>
      </div>

      {/* Liste des connexions */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Comptes connectés</h2>
          <p className="text-muted text-xs mt-0.5">
            La synchronisation couvre les trades Binance Futures USD-M des 30 derniers jours.
          </p>
        </div>

        {connections.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <p className="text-muted text-sm">Aucun compte connecté pour le moment.</p>
          </div>
        ) : (
          connections.map((conn) => {
            const status = STATUS_LABELS[conn.status] || STATUS_LABELS.disabled;
            return (
              <div
                key={conn.id}
                className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium capitalize">{conn.exchange}</span>
                    <span className="text-muted">·</span>
                    <span className="text-foreground text-sm truncate">{conn.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${status.className}`}>
                      {status.text}
                    </span>
                    <span>Dernière sync : {formatDate(conn.last_synced_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncingId === conn.id}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      syncingId === conn.id
                        ? "border-border bg-surface text-muted opacity-50 cursor-not-allowed"
                        : "border-accent/20 bg-accent/5 text-accent hover:bg-accent/10"
                    }`}
                  >
                    {syncingId === conn.id ? "..." : "Synchroniser"}
                  </button>
                  <button
                    onClick={() => setDeleteId(conn.id)}
                    className="px-3 py-1.5 rounded-lg border border-loss/20 bg-loss/5 text-loss text-xs hover:bg-loss/10 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Formulaire d'ajout */}
      <section className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">Ajouter un compte</h2>
        <p className="text-muted text-sm mb-4">
          Crée une clé API en <span className="text-foreground font-medium">lecture seule</span> depuis
          ton exchange (Binance → Gestion API → Créer une clé → décocher « Enable Trading »).
          Ne partage jamais une clé avec les permissions de trading.
        </p>

        <div className="space-y-4">
          {/* Exchange */}
          <div>
            <label className="block text-sm text-muted mb-1">Exchange</label>
            <select
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            >
              {EXCHANGES.map((ex) => (
                <option key={ex.value} value={ex.value}>{ex.label}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm text-muted mb-1">Nom du compte</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='ex. "Perso", "Challenge FTMO"'
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-[#666] placeholder:italic text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm text-muted mb-1">Clé API</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Colle ta clé API ici"
              autoComplete="off"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-[#666] placeholder:italic text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
            />
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-sm text-muted mb-1">Secret API</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Colle ton secret ici"
              autoComplete="off"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-[#666] placeholder:italic text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting || !label.trim() || !apiKey.trim() || !apiSecret.trim()}
              className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                !submitting && label.trim() && apiKey.trim() && apiSecret.trim()
                  ? "bg-accent text-white hover:bg-blue-600"
                  : "bg-surface border border-border text-muted opacity-50 cursor-not-allowed"
              }`}
            >
              {submitting ? "..." : "Connecter le compte"}
            </button>
          </div>
        </div>
      </section>

      {/* Modal de confirmation de suppression */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Supprimer la connexion ?</h3>
            <p className="text-sm text-muted">
              Les trades déjà synchronisés resteront dans ton journal, mais aucune future
              synchronisation ne sera effectuée pour ce compte.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg border border-border bg-surface text-foreground text-sm hover:bg-border transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-loss text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
