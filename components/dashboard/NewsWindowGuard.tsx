"use client";

/**
 * NewsWindowGuard — detector only (rendering via AlertCenter).
 *
 * Loads today's high-impact macro events on the trader's currencies and,
 * every minute, checks whether *now* sits inside an announcement's danger
 * window (±NEWS_WINDOW_MINUTES). If so it pushes a single warning alert
 * "you're in a news window — hold off". Disciplinary nudge, never a block.
 *
 * Stays inert when no relevant event exists or the migration isn't applied.
 */

import { useAlerts, type Alert } from "@/lib/AlertsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { loadTodayNews } from "@/lib/economic-calendar-client";
import { activeNewsWindow, type EconomicEvent } from "@/lib/economic-calendar";
import { useEffect, useRef, useState } from "react";

const SOURCE_KEY = "news-window";

export default function NewsWindowGuard() {
  const { t, lang } = useLanguage();
  const { setSourceAlerts } = useAlerts();
  const supabase = createClient();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const eventsRef = useRef<EconomicEvent[]>([]);
  eventsRef.current = events;

  // Load today's high-impact events once per mount / language change.
  useEffect(() => {
    let alive = true;
    loadTodayNews(supabase, "high").then(({ events }) => {
      if (alive) setEvents(events);
    });
    return () => { alive = false; };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every minute: surface or clear the news-window alert.
  useEffect(() => {
    const evaluate = () => {
      const active = activeNewsWindow(eventsRef.current);
      if (!active) {
        setSourceAlerts(SOURCE_KEY, []);
        return;
      }
      const time = new Date(active.event_time).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      const alert: Alert = {
        id: "news_window_active",
        level: "warning",
        category: "session_reminder",
        message: t("news_guard_message")
          .replace("{title}", active.title)
          .replace("{currency}", active.currency)
          .replace("{time}", time),
        dismissible: true,
      };
      setSourceAlerts(SOURCE_KEY, [alert]);
    };

    evaluate();
    const id = setInterval(evaluate, 60_000);
    return () => {
      clearInterval(id);
      setSourceAlerts(SOURCE_KEY, []);
    };
  }, [events, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
