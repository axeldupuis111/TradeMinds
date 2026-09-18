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
import { langueCourante } from "@/lib/nombres";
import { createClient } from "@/lib/supabase/client";
import { loadTodayNews } from "@/lib/economic-calendar-client";
import { delaiRelatif, impactEmoji, styleDImpact, type EconomicEvent } from "@/lib/economic-calendar";
import { browserTimezone, joursEntreCles, localDateKey } from "@/lib/timezone";
import { displayEventTitle } from "@/lib/economic-event-labels";
import type { GlossaryLang } from "@/lib/economic-glossary";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * ⚠️ LES DEUX SURFACES DU CALENDRIER PARTAGENT CE CALCUL. Elles en portaient
 * chacune une copie, et l'une des deux avait DÉJÀ divergé : le correctif du
 * délai « en jours de calendrier » (2026-09-16) n'avait été appliqué qu'ici.
 */
const outilsDeDate = () => ({
  fuseau: browserTimezone(),
  cleDuJour: localDateKey,
  joursEntre: joursEntreCles,
});


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
          const time = new Date(ev.event_time).toLocaleTimeString(langueCourante(), {
            hour: "2-digit",
            minute: "2-digit",
          });
          const style = styleDImpact(ev.impact);
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
              <span className="text-sm text-foreground flex-1 min-w-0 truncate">{displayEventTitle(ev.title, lang as GlossaryLang)}</span>
              <span className="text-[11px] text-muted shrink-0 tabular-nums">{delaiRelatif(ev, t, outilsDeDate())}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
