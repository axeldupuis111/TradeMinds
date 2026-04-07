"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const SESSION_LABELS: Record<string, string> = {
  london: "London (08:00–12:00 UTC)",
  new_york: "New York (13:00–17:00 UTC)",
  asian: "Asian (00:00–06:00 UTC)",
  london_ny_overlap: "London-NY Overlap (13:00–16:00 UTC)",
};

const inputClass =
  "w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent";

interface ParsedRules {
  pairs: string[];
  sessions: string[];
  risk_reward: number | null;
  max_sl_pips: number | null;
  max_daily_loss: number | null;
  max_trades_per_day: number | null;
  max_consecutive_losses: number | null;
  setup_rules: string[];
}

export default function StrategyPage() {
  const supabase = createClient();

  const [rawText, setRawText] = useState("");
  const [name, setName] = useState("");
  const [parsed, setParsed] = useState<ParsedRules | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadStrategy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadStrategy() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("strategies")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setExistingId(data.id);
      setName(data.name || "");
      setRawText(data.raw_text || "");
      setParsed({
        pairs: data.pairs || [],
        sessions: data.sessions || [],
        risk_reward: data.risk_reward,
        max_sl_pips: data.max_sl_pips,
        max_daily_loss: data.max_daily_loss,
        max_trades_per_day: data.max_trades_per_day,
        max_consecutive_losses: data.max_consecutive_losses,
        setup_rules: data.setup_rules || [],
      });
    }
    setLoading(false);
  }

  async function handleAnalyze() {
    if (!rawText.trim()) {
      setMessage({ type: "error", text: "Écris ta stratégie d'abord." });
      return;
    }

    setMessage(null);
    setAnalyzing(true);

    try {
      const res = await fetch("/api/parse-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur.");

      setParsed(data);
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!parsed) return;
    setMessage(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ type: "error", text: "Non connecté." });
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      name,
      raw_text: rawText,
      pairs: parsed.pairs,
      sessions: parsed.sessions,
      risk_reward: parsed.risk_reward,
      max_sl_pips: parsed.max_sl_pips,
      max_daily_loss: parsed.max_daily_loss,
      max_trades_per_day: parsed.max_trades_per_day,
      max_consecutive_losses: parsed.max_consecutive_losses,
      setup_rules: parsed.setup_rules,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase
        .from("strategies")
        .update(payload)
        .eq("id", existingId));
    } else {
      const res = await supabase
        .from("strategies")
        .insert(payload)
        .select("id")
        .single();
      error = res.error;
      if (res.data) setExistingId(res.data.id);
    }

    setSaving(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Stratégie sauvegardée avec succès." });
    }
  }

  // Editable helpers
  function updateParsedField<K extends keyof ParsedRules>(
    field: K,
    value: ParsedRules[K]
  ) {
    if (!parsed) return;
    setParsed({ ...parsed, [field]: value });
  }

  function removePair(pair: string) {
    if (!parsed) return;
    setParsed({ ...parsed, pairs: parsed.pairs.filter((p) => p !== pair) });
  }

  function toggleSession(id: string) {
    if (!parsed) return;
    const sessions = parsed.sessions.includes(id)
      ? parsed.sessions.filter((s) => s !== id)
      : [...parsed.sessions, id];
    setParsed({ ...parsed, sessions });
  }

  function updateRule(index: number, value: string) {
    if (!parsed) return;
    const rules = [...parsed.setup_rules];
    rules[index] = value;
    setParsed({ ...parsed, setup_rules: rules });
  }

  function removeRule(index: number) {
    if (!parsed) return;
    setParsed({
      ...parsed,
      setup_rules: parsed.setup_rules.filter((_, i) => i !== index),
    });
  }

  function addRule() {
    if (!parsed) return;
    setParsed({ ...parsed, setup_rules: [...parsed.setup_rules, ""] });
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ma Stratégie</h1>
        <p className="text-muted mt-2 text-sm">Décris ta stratégie en langage naturel</p>
        <div className="mt-6 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="skeleton h-4 w-40 mb-4" />
            <div className="skeleton h-32 w-full rounded-xl" />
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Ma Stratégie</h1>
      <p className="text-muted mt-1">
        Décris ta stratégie et l&apos;IA extraira tes règles automatiquement.
      </p>

      {/* Strategy name */}
      <div className="mt-6">
        <label className="block text-sm text-muted mb-1">
          Nom de la stratégie
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ICT Gold Scalping"
          className={inputClass}
        />
      </div>

      {/* Raw text input */}
      <div className="mt-4">
        <label className="block text-sm text-muted mb-1">
          Décris ta stratégie en langage naturel
        </label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={10}
          className={`${inputClass} min-h-[200px] resize-y`}
          placeholder={`Décris ta stratégie de trading ici en langage naturel. Par exemple :\n\nJe trade le gold (XAUUSD) pendant les sessions London et New York. J'utilise la méthodologie ICT. J'attends un sweep de liquidité (BSL ou SSL) sur le M15, puis je cherche un Order Block ou un FVG sur le M5 pour entrer. Mon RR minimum est de 1:2. Je ne risque jamais plus de 1% par trade et maximum 3 trades par jour. Je ne trade pas les vendredis et pendant les annonces économiques majeures.`}
        />
      </div>

      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || !rawText.trim()}
        className="mt-4 px-6 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {analyzing && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {analyzing ? "Analyse en cours…" : "Analyser ma stratégie avec l'IA"}
      </button>

      {/* Parsed rules */}
      {parsed && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-profit"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">
              Règles extraites
            </h2>
            <span className="text-muted text-sm">— modifiable</span>
          </div>

          {/* Pairs */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">
              Paires tradées
            </label>
            <div className="flex flex-wrap gap-2">
              {parsed.pairs.map((pair) => (
                <span
                  key={pair}
                  className="px-3 py-1 rounded-full text-sm bg-accent/20 border border-accent text-accent flex items-center gap-1"
                >
                  {pair}
                  <button
                    onClick={() => removePair(pair)}
                    className="ml-1 hover:text-loss transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
              {parsed.pairs.length === 0 && (
                <span className="text-muted text-sm">Toutes les paires</span>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">
              Sessions autorisées
            </label>
            <div className="space-y-2">
              {Object.entries(SESSION_LABELS).map(([id, label]) => (
                <label key={id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parsed.sessions.includes(id)}
                    onChange={() => toggleSession(id)}
                    className="w-4 h-4 rounded border-[#2a2a2a] bg-[#1a1a1a] text-accent focus:ring-accent focus:ring-offset-0"
                  />
                  <span className="text-foreground text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Risk management */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-3">
              Risk Management
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">RR min</label>
                <input
                  type="number"
                  step="0.1"
                  value={parsed.risk_reward ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "risk_reward",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder="—"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  SL max (pips)
                </label>
                <input
                  type="number"
                  value={parsed.max_sl_pips ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_sl_pips",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder="—"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  Perte max/jour (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={parsed.max_daily_loss ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_daily_loss",
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder="—"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  Trades max/jour
                </label>
                <input
                  type="number"
                  value={parsed.max_trades_per_day ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_trades_per_day",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  placeholder="—"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  Pertes consec. max
                </label>
                <input
                  type="number"
                  value={parsed.max_consecutive_losses ?? ""}
                  onChange={(e) =>
                    updateParsedField(
                      "max_consecutive_losses",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  placeholder="—"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Setup rules */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="block text-sm text-muted mb-2">
              Règles de setup
            </label>
            <div className="space-y-2">
              {parsed.setup_rules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={rule}
                    onChange={(e) => updateRule(i, e.target.value)}
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    onClick={() => removeRule(i)}
                    className="px-3 py-2 text-muted hover:text-loss transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRule}
              className="mt-2 text-sm text-accent hover:text-blue-400 transition-colors"
            >
              + Ajouter une règle
            </button>
          </div>

          {/* Save */}
          <div className="mb-8">
            {message && (
              <p
                className={`text-sm mb-3 ${
                  message.type === "success" ? "text-profit" : "text-loss"
                }`}
              >
                {message.text}
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 bg-profit text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Sauvegarde…" : "Valider et sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {/* Show message if no parsed yet */}
      {!parsed && message && (
        <p
          className={`text-sm mt-4 ${
            message.type === "success" ? "text-profit" : "text-loss"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
