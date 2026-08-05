"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { COMMUNITY_METRICS, MAX_CHALLENGE_DAYS, getMetricSpec } from "@/lib/community";
import { Check, Copy, Crown, Flame, Pencil, Plus, Trash2, Trophy, Users } from "lucide-react";
import CreateChallengeModal, { type EditableChallenge } from "@/components/community/CreateChallengeModal";
import MembersPanel from "@/components/community/MembersPanel";

/**
 * Ma communauté : le classement privé d'un partenaire (influenceur, coach) et
 * les défis qu'il crée pour ses membres. Un membre n'y voit QUE sa communauté ;
 * l'animateur y trouve en plus le bouton de création.
 *
 * Les défis privés ne donnent aucune récompense matérielle (ni gel, ni
 * certificat) : c'est assumé et annoncé en clair, voir /api/community.
 */

export interface BoardEntry { name: string; progress: number; rank: number; isMe: boolean }
export interface CommunityChallengeView {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  startsOn: string;
  endsOn: string;
  updatedAt: string | null;
  phase: "upcoming" | "live" | "ended";
  participants: number;
  finishers: number;
  myProgress: number;
  completed: boolean;
  leaderboard: BoardEntry[];
}
interface Payload {
  community: {
    slug: string;
    name: string;
    memberCount: number;
    isOwner: boolean;
    /** Code promo du partenaire, la seule porte d'entrée : au seul animateur. */
    promoCode: string | null;
    /** Non nul quand la communauté dépasse le plafond de membres classés. */
    rankedCap: number | null;
  } | null;
  today: string;
  challenges: CommunityChallengeView[];
}

const RANK_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const PHASE_CLASS: Record<string, string> = {
  live: "bg-profit/10 text-profit border-profit/30",
  upcoming: "bg-surface text-muted border-border",
  ended: "bg-surface text-muted border-border",
};

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export default function CommunityPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EditableChallenge | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/community");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function leave() {
    if (!window.confirm(t("com_leave_confirm"))) return;
    await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave" }),
    });
    await load();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : le code reste lisible à l'écran.
    }
  }

  async function removeChallenge(id: string) {
    if (!window.confirm(t("com_delete_confirm"))) return;
    await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_challenge", id }),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="skeleton h-20 w-full rounded-xl" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    );
  }

  // ── Pas (encore) de communauté ─────────────────────────────────────────────
  if (!data?.community) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-accent" strokeWidth={1.75} />
            <h1 className="text-lg font-bold text-foreground">{t("com_none_title")}</h1>
          </div>
          <p className="text-sm text-foreground-muted">{t("com_none_desc")}</p>
          <p className="mt-3 text-xs text-muted">{t("com_none_hint")}</p>
        </div>
      </div>
    );
  }

  const { community, challenges, today } = data;
  const live = challenges.filter((c) => c.phase === "live");
  const upcoming = challenges.filter((c) => c.phase === "upcoming");
  const ended = challenges.filter((c) => c.phase === "ended");
  const ordered = [...live, ...upcoming, ...ended];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* En-tête de la communauté */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" strokeWidth={1.75} />
              <h1 className="text-lg font-bold text-foreground">{community.name}</h1>
              {community.isOwner && (
                <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
                  <Crown className="w-3 h-3" strokeWidth={2} />{t("com_owner_badge")}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {t("com_members").replace("{n}", String(community.memberCount))}
            </p>
          </div>
          {community.isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMembers(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-surface transition-colors"
              >
                <Users className="w-4 h-4" strokeWidth={2} />{t("com_manage_members")}
              </button>
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={2.25} />{t("com_create")}
              </button>
            </div>
          )}
        </div>
        {/* Le code promo de l'animateur, sous ses yeux : c'est la seule chose
            qu'il ait à diffuser, il donne la remise ET l'entrée ici. */}
        {community.isOwner && community.promoCode && (
          <div className="mt-4 rounded-lg border border-border bg-surface p-3">
            <p className="text-[11px] text-muted mb-2">{t("com_code_title")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="px-3 py-1.5 rounded-md bg-card border border-border font-mono text-base font-bold tracking-[0.2em] text-foreground">
                {community.promoCode}
              </code>
              <button
                onClick={() => copyCode(community.promoCode!)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground-muted hover:text-foreground hover:bg-card transition-colors"
              >
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-profit" strokeWidth={2} />{t("com_code_copied")}</>
                  : <><Copy className="w-3.5 h-3.5" strokeWidth={1.75} />{t("com_code_copy")}</>}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted">{t("com_code_note")}</p>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted">{t("com_rules_note")}</p>
        {community.isOwner && community.rankedCap !== null && (
          <p className="mt-1 text-[11px] text-muted">
            {t("com_ranked_cap").replace("{n}", String(community.rankedCap))}
          </p>
        )}
      </div>

      {/* Défis */}
      {ordered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Trophy className="w-6 h-6 text-muted mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm text-foreground-muted">
            {community.isOwner ? t("com_no_challenges_owner") : t("com_no_challenges")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ordered.map((c) => {
            const spec = getMetricSpec(c.metric);
            const pct = Math.min(100, Math.round((c.myProgress / c.target) * 100));
            const remaining = daysBetween(today, c.endsOn);
            return (
              <div key={c.id} className={`rounded-xl border bg-card p-5 ${c.completed ? "border-profit/40" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground">{c.title}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PHASE_CLASS[c.phase]}`}>
                        {t(`com_phase_${c.phase}`)}
                      </span>
                    </div>
                    {c.description && <p className="mt-1 text-xs text-foreground-muted">{c.description}</p>}
                    <p className="mt-1 text-[11px] text-muted">
                      {spec ? t(spec.hintKey) : c.metric}
                      {c.phase === "live" && ` · ${t("com_days_left").replace("{n}", String(Math.max(0, remaining)))}`}
                      {c.phase === "upcoming" && ` · ${t("com_starts_on").replace("{d}", c.startsOn)}`}
                      {/* Une cible corrigée en cours de route ne doit pas passer
                          inaperçue auprès de ceux qui courent déjà. */}
                      {c.updatedAt && ` · ${t("com_edited")}`}
                    </p>
                  </div>
                  {community.isOwner && (
                    <div className="shrink-0 flex items-center gap-1">
                      {c.phase !== "ended" && (
                        <button
                          onClick={() => { setEditing({ ...c, phase: c.phase }); setShowForm(true); }}
                          aria-label={t("com_edit")}
                          title={t("com_edit")}
                          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      )}
                      <button
                        onClick={() => removeChallenge(c.id)}
                        aria-label={t("com_delete")}
                        title={t("com_delete")}
                        className="p-1.5 rounded-lg text-muted hover:text-loss hover:bg-loss/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Ma progression */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted">{t("com_my_progress")}</span>
                    <span className={c.completed ? "text-profit font-semibold" : "text-foreground"}>
                      {c.myProgress}/{c.target} {c.completed ? "🎉" : ""}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${c.completed ? "bg-profit" : "bg-accent"}`}
                      style={{ width: `${Math.max(3, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Classement de la communauté */}
                <div className="mt-4">
                  <div className="flex items-center gap-3 text-[11px] text-muted mb-2">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />{t("com_participants").replace("{n}", String(c.participants))}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />{t("com_finishers").replace("{n}", String(c.finishers))}
                    </span>
                  </div>
                  {c.leaderboard.length > 0 ? (
                    <ol className="space-y-1">
                      {c.leaderboard.map((e, i) => (
                        <li
                          key={`${e.name}-${i}`}
                          className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${e.isMe ? "bg-accent/10 text-accent font-semibold" : "text-foreground-muted"}`}
                        >
                          <span className="w-5 text-center text-[10px] text-muted">
                            {RANK_EMOJI[e.rank] ?? `#${e.rank}`}
                          </span>
                          <span className="flex-1 truncate">{e.isMe ? t("com_you") : `@${e.name}`}</span>
                          <span className="flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-400" />{e.progress}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted">{t("com_be_first")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!community.isOwner && (
        <button onClick={leave} className="text-xs text-muted hover:text-loss transition-colors">
          {t("com_leave")}
        </button>
      )}

      {showForm && (
        <CreateChallengeModal
          today={today}
          maxDays={MAX_CHALLENGE_DAYS}
          metrics={COMMUNITY_METRICS}
          challenge={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onCreated={async () => { setShowForm(false); setEditing(null); await load(); }}
        />
      )}

      {showMembers && (
        <MembersPanel onClose={() => setShowMembers(false)} onChanged={load} />
      )}
    </div>
  );
}
