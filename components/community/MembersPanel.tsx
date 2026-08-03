"use client";

/**
 * Liste des membres, réservée à l'animateur de la communauté.
 *
 * Sans elle, un partenaire pilotait sa communauté à l'aveugle : un compteur
 * (« 40 membres ») et les seuls pseudos que le classement d'un défi laissait
 * passer, c'est-à-dire uniquement ceux qui avaient déjà marqué un point.
 *
 * Le signal affiché est le nombre de JOURS actifs sur 30, pas le nombre de
 * séances : c'est de la régularité qu'un coach a besoin, et cela évite au
 * passage de transformer ce panneau en tableau de bord des performances de ses
 * membres, qui ne le regardent pas.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldOff, UserMinus, Users, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Member {
  id: string;
  name: string | null;
  joinedAt: string;
  source: string;
  isOwner: boolean;
  activeDays: number;
  lastSeenAt: string | null;
}
interface Blocked {
  id: string;
  name: string | null;
  blockedAt: string;
}

export default function MembersPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t, lang } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [activityDays, setActivityDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/community?view=members");
      const data = await res.json();
      setMembers(data.members ?? []);
      setBlocked(data.blocked ?? []);
      if (data.activityDays) setActivityDays(data.activityDays);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(action: "remove_member" | "unblock_member", userId: string) {
    setBusy(userId);
    try {
      await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      });
      await load();
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  function remove(m: Member) {
    const who = m.name ? `@${m.name}` : t("com_member_anon");
    if (!window.confirm(t("com_member_remove_confirm").replace("{who}", who))) return;
    void act("remove_member", m.id);
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-5 pt-4 pb-3 bg-card border-b border-border">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="w-4 h-4 text-accent" strokeWidth={1.75} />
            {t("com_members_title")}
            {!loading && <span className="text-muted font-normal">({members.length})</span>}
          </h3>
          <button onClick={onClose} aria-label={t("cmdk_hint_close")} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {loading ? (
            <div className="skeleton h-32 w-full rounded-lg" />
          ) : members.length === 0 ? (
            <p className="text-sm text-foreground-muted">{t("com_members_empty")}</p>
          ) : (
            <>
              <p className="text-[11px] text-muted">
                {t("com_members_activity_note").replace("{n}", String(activityDays))}
              </p>
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">
                        {m.name ? `@${m.name}` : <span className="text-muted italic">{t("com_member_anon")}</span>}
                        {m.isOwner && <span className="ml-2 text-[10px] text-gold">{t("com_owner_badge")}</span>}
                      </p>
                      <p className="text-[11px] text-muted">
                        {t(`com_source_${m.source}`)} · {t("com_member_joined").replace("{d}", fmtDate(m.joinedAt))}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${m.activeDays > 0 ? "text-foreground" : "text-muted"}`}>
                        {m.activeDays}<span className="text-muted font-normal">/{activityDays}</span>
                      </p>
                      <p className="text-[10px] text-muted">{t("com_member_active_days")}</p>
                    </div>
                    {!m.isOwner && (
                      <button
                        onClick={() => remove(m)}
                        disabled={busy === m.id}
                        aria-label={t("com_member_remove")}
                        title={t("com_member_remove")}
                        className="shrink-0 p-1.5 rounded-lg text-muted hover:text-loss hover:bg-loss/10 transition-colors disabled:opacity-40"
                      >
                        <UserMinus className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {blocked.length > 0 && (
            <div className="pt-2 border-t border-border">
              <h4 className="text-xs font-semibold text-foreground mb-1">{t("com_blocked_title")}</h4>
              <p className="text-[11px] text-muted mb-2">{t("com_blocked_note")}</p>
              <ul className="divide-y divide-border">
                {blocked.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">
                        {b.name ? `@${b.name}` : <span className="text-muted italic">{t("com_member_anon")}</span>}
                      </p>
                      <p className="text-[11px] text-muted">{t("com_blocked_on").replace("{d}", fmtDate(b.blockedAt))}</p>
                    </div>
                    <button
                      onClick={() => act("unblock_member", b.id)}
                      disabled={busy === b.id}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-40"
                    >
                      <ShieldOff className="w-3.5 h-3.5" strokeWidth={1.75} />{t("com_blocked_lift")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
