"use client";

/**
 * CommandPalette — palette de commandes globale (Ctrl+K / ⌘K).
 *
 * - Navigation instantanée vers toutes les pages du dashboard
 * - Actions rapides : thème, langue, déconnexion
 * - Recherche fuzzy (sous-séquence) sur label + mots-clés
 * - Ouverture : Ctrl+K / ⌘K, ou événement custom "tm:open-cmdk" (bouton Header)
 */

import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/lib/ThemeContext";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES, type Lang } from "@/lib/translations";
import {
  BarChart3,
  Globe,
  type LucideIcon,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  Play,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const OPEN_CMDK_EVENT = "tm:open-cmdk";

interface Command {
  id: string;
  label: string;
  group: "nav" | "actions" | "lang";
  icon: LucideIcon;
  keywords: string;
  action: () => void;
}

/** Match par sous-séquence : "ana" matche "Analyse IA", "stg" matche "Stratégie". */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 1;
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 50;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 10 : 0;
}

export default function CommandPalette() {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // ── Raccourci global Ctrl+K / ⌘K + événement custom ────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_CMDK_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_CMDK_EVENT, onOpenEvent);
    };
  }, []);

  // Focus l'input à l'ouverture
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // ── Commandes ──────────────────────────────────────────────────────────────
  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const supabase = createClient();

    const navs: Command[] = [
      { id: "nav-dashboard", label: t("sidebar_dashboard"), group: "nav", icon: LayoutDashboard, keywords: "dashboard home accueil tableau", action: go("/dashboard") },
      { id: "nav-session",   label: t("sidebar_session"),   group: "nav", icon: Play,            keywords: "session trading live start", action: go("/dashboard/session") },
      { id: "nav-trades",    label: t("sidebar_trades"),    group: "nav", icon: ListChecks,      keywords: "trades journal import history historique", action: go("/dashboard/trades") },
      { id: "nav-challenge", label: t("sidebar_challenge"), group: "nav", icon: Wallet,          keywords: "challenge compte account prop firm suivi", action: go("/dashboard/challenge") },
      { id: "nav-strategy",  label: t("sidebar_strategy"),  group: "nav", icon: Target,          keywords: "strategie strategy plan regles rules", action: go("/dashboard/strategy") },
      { id: "nav-analysis",  label: t("sidebar_analysis"),  group: "nav", icon: Sparkles,        keywords: "analyse ia ai coach analysis", action: go("/dashboard/analysis") },
      { id: "nav-analytics", label: t("sidebar_analytics"), group: "nav", icon: BarChart3,       keywords: "analytics stats statistiques graphiques charts", action: go("/dashboard/analytics") },
      { id: "nav-settings",  label: t("sidebar_settings"),  group: "nav", icon: Settings,        keywords: "settings reglages parametres profil", action: go("/dashboard/settings") },
      { id: "nav-upgrade",   label: t("sidebar_upgrade"),   group: "nav", icon: Zap,             keywords: "upgrade premium plus plan abonnement subscription", action: go("/dashboard/upgrade") },
    ];

    const actions: Command[] = [
      {
        id: "action-theme",
        label: theme === "dark" ? t("cmdk_action_light") : t("cmdk_action_dark"),
        group: "actions",
        icon: theme === "dark" ? Sun : Moon,
        keywords: "theme dark light mode sombre clair",
        action: toggleTheme,
      },
      {
        id: "action-signout",
        label: t("header_signout"),
        group: "actions",
        icon: LogOut,
        keywords: "logout signout deconnexion quitter exit",
        action: async () => {
          await supabase.auth.signOut();
          router.push("/login");
          router.refresh();
        },
      },
    ];

    const langs: Command[] = LANGUAGES.filter((l) => l.code !== lang).map((l) => ({
      id: `lang-${l.code}`,
      label: `${l.flag} ${{ fr: "Français", en: "English", de: "Deutsch", es: "Español" }[l.code]}`,
      group: "lang" as const,
      icon: Globe,
      keywords: `langue language ${l.code} ${l.label}`,
      action: () => setLang(l.code as Lang),
    }));

    return [...navs, ...actions, ...langs];
  }, [t, theme, toggleTheme, router, lang, setLang]);

  // ── Filtrage ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return commands;
    return commands
      .map((c) => ({ c, score: Math.max(fuzzyScore(q, c.label), fuzzyScore(q, c.keywords) / 2) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ c }) => c);
  }, [commands, query]);

  // Reset l'index actif quand le filtre change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll l'item actif dans la vue
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function runCommand(cmd: Command) {
    close();
    cmd.action();
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) runCommand(cmd);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  const GROUP_LABELS: Record<Command["group"], string> = {
    nav: t("cmdk_group_nav"),
    actions: t("cmdk_group_actions"),
    lang: t("cmdk_group_lang"),
  };

  // Groupes dans l'ordre, en préservant l'ordre du filtre
  const groups: { key: Command["group"]; items: { cmd: Command; index: number }[] }[] = [];
  filtered.forEach((cmd, index) => {
    const last = groups[groups.length - 1];
    if (last && last.key === cmd.group) {
      last.items.push({ cmd, index });
    } else {
      groups.push({ key: cmd.group, items: [{ cmd, index }] });
    }
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("cmdk_placeholder")}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-safe:animate-[cmdk-fade_120ms_ease-out]"
        onClick={close}
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden motion-safe:animate-[cmdk-pop_140ms_ease-out]"
        style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,.6), 0 0 60px -30px rgb(var(--accent) / .35)" }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-foreground-muted shrink-0" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t("cmdk_placeholder")}
            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
            aria-label={t("cmdk_placeholder")}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-surface text-[10px] font-medium text-foreground-muted">
            ESC
          </kbd>
        </div>

        {/* Résultats */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground-muted text-center">{t("cmdk_no_results")}</p>
          ) : (
            groups.map((group) => (
              <div key={group.key + group.items[0].index}>
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground-muted/60">
                  {GROUP_LABELS[group.key]}
                </p>
                {group.items.map(({ cmd, index }) => {
                  const Icon = cmd.icon;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-index={index}
                      onClick={() => runCommand(cmd)}
                      onMouseMove={() => setActiveIndex(index)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-accent/10 text-foreground"
                          : "text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors ${
                          active ? "bg-accent/15 text-accent" : "bg-surface text-foreground-muted"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </span>
                      <span className="flex-1 text-left truncate">{cmd.label}</span>
                      {active && (
                        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-surface text-[10px] font-medium text-foreground-muted">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-surface/40">
          <span className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
            <kbd className="px-1 py-0.5 rounded border border-border bg-surface font-medium">↑↓</kbd>
            {t("cmdk_hint_navigate")}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
            <kbd className="px-1 py-0.5 rounded border border-border bg-surface font-medium">↵</kbd>
            {t("cmdk_hint_select")}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
            <kbd className="px-1 py-0.5 rounded border border-border bg-surface font-medium">esc</kbd>
            {t("cmdk_hint_close")}
          </span>
        </div>
      </div>
    </div>
  );
}
