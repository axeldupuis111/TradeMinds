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
import { impactEmoji, minutesUntil, type EconomicEvent, type Impact } from "@/lib/economic-calendar";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

/** Yellow / orange / red styling by importance (low / medium / high). */
function impactStyle(impact: Impact): { row: string; badge: string } {
  switch (impact) {
    case "high":   return { row: "border-red-500/30 bg-red-500/5",       badge: "bg-red-500/15 text-red-500" };
    case "medium": return { row: "border-orange-500/30 bg-orange-500/5", badge: "bg-orange-500/15 text-orange-500" };
    default:       return { row: "border-yellow-500/25 bg-yellow-500/5", badge: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-500" };
  }
}

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
    // Full agenda (low → high), colour-coded by importance on the card.
    loadTodayNews(supabase, "low").then(({ events }) => {
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
          const style = impactStyle(ev.impact);
          return (
            <li
              key={`${ev.event_time}-${ev.currency}-${i}`}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${style.row}`}
            >
              <span className="text-sm shrink-0" aria-hidden>{impactEmoji(ev.impact)}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground shrink-0 w-12">{time}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>
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
