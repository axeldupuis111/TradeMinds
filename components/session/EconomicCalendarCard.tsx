"use client";

/**
 * EconomicCalendarCard — session-prep agenda of today's macro announcements
 * on the trader's currencies. Purely disciplinary: it says "don't trade
 * around these hours", it is not a live news feed.
 *
 * Reads the shared economic_events cache via loadTodayNews(); silently
 * renders nothing useful (an empty-state) when there's no relevant event
 * or the migration isn't applied yet.
 */

import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { loadTodayNews } from "@/lib/economic-calendar-client";
import { minutesUntil, type EconomicEvent } from "@/lib/economic-calendar";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

function relativeLabel(ev: EconomicEvent, t: (k: string) => string): string {
  const mins = minutesUntil(ev.event_time);
  if (mins < -5) return t("news_passed");
  if (Math.abs(mins) <= 5) return t("news_now");
  if (mins < 60) return t("news_in_minutes").replace("{n}", String(mins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return t("news_in_hours").replace("{h}", String(h)).replace("{m}", String(m).padStart(2, "0"));
}

export default function EconomicCalendarCard() {
  const { t, lang } = useLanguage();
  const supabase = createClient();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // "medium" bar here for a slightly fuller agenda than the guard.
    loadTodayNews(supabase, "medium").then(({ events }) => {
      if (alive) { setEvents(events); setLoading(false); }
    });
    return () => { alive = false; };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing relevant today → stay out of the way entirely.
  if (loading || events.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-5 h-5 text-warning shrink-0" strokeWidth={1.75} />
        <h2 className="text-lg font-semibold text-foreground">{t("news_card_title")}</h2>
      </div>
      <p className="text-muted text-sm mb-4">{t("news_card_subtitle")}</p>

      <ul className="space-y-1.5">
        {events.map((ev, i) => {
          const time = new Date(ev.event_time).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          });
          const high = ev.impact === "high";
          return (
            <li
              key={`${ev.event_time}-${ev.currency}-${i}`}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                high ? "border-loss/30 bg-loss/5" : "border-border bg-background"
              }`}
            >
              <span className="text-sm font-semibold tabular-nums text-foreground shrink-0 w-12">{time}</span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                  high ? "bg-loss/15 text-loss" : "bg-warning/15 text-warning"
                }`}
              >
                {ev.currency}
              </span>
              <span className="text-sm text-foreground flex-1 min-w-0 truncate">{ev.title}</span>
              <span className="text-[11px] text-muted shrink-0 tabular-nums">{relativeLabel(ev, t)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
