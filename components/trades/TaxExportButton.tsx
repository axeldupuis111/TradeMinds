"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase-paginate";
import { browserTimezone, cleDeJourDuTrader, normalizeTimezone, startOfDateKeyUtc } from "@/lib/timezone";
import { FileSpreadsheet } from "lucide-react";

/** Colonnes de l'export comptable (voir la lecture paginée plus bas). */
interface TaxRow {
  close_time: string | null;
  open_time: string | null;
  pair: string;
  direction: string;
  lot_size: number | null;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  commission: number | null;
  swap: number | null;
}

/**
 * Annual accounting / tax export: downloads a trader's realised (closed) trades
 * for a chosen year as a standard CSV (UTF-8 BOM, comma-delimited, dot decimals,
 * quoted fields) — imports cleanly into Excel / Google Sheets / accounting tools.
 * Self-contained: reads the user's own rows (RLS), builds the file client-side.
 *
 * ⚠️⚠️ L'ANNÉE EST CELLE DU TRADER, PAS CELLE DE GREENWICH. La lecture bornait
 * l'année sur `"2026-01-01T00:00:00"`, une chaîne SANS FUSEAU : PostgREST la
 * compare à une colonne timestamptz, donc à minuit UTC. Pour un trader à Los
 * Angeles, tout ce qu'il a clôturé le 31 décembre après 16 h tombait dans le
 * fichier de l'ANNÉE SUIVANTE, et la colonne Date l'y datait du 1er janvier.
 * Sur un document comptable, c'est un revenu déclaré sur le mauvais exercice.
 *
 * ⚠️ LA RÈGLE ÉTAIT DÉJÀ ÉCRITE, et `startOfDateKeyUtc` existe précisément pour
 * ça (voir lib/timezone) : elle n'avait simplement jamais atteint cet export.
 * Le fuseau est celui du PROFIL, pas celui du navigateur : un trader en
 * déplacement ne change pas de résidence fiscale en changeant de fuseau.
 */
export default function TaxExportButton() {
  const { t } = useLanguage();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  // Close the menu on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function exportYear(year: number) {
    setBusy(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profil } = await supabase
        .from("profiles").select("timezone").eq("id", user.id).maybeSingle();
      const fuseau = normalizeTimezone((profil?.timezone as string | null) ?? browserTimezone());
      const start = (startOfDateKeyUtc(`${year}-01-01`, fuseau) ?? new Date(0)).toISOString();
      const end = (startOfDateKeyUtc(`${year + 1}-01-01`, fuseau) ?? new Date(0)).toISOString();
      // Lecture paginée. C'est un document comptable : une année de scalping
      // dépasse facilement 1 000 trades, et une lecture non bornée s'arrête
      // exactement là, sans erreur (voir lib/supabase-paginate.ts). Le fichier
      // aurait l'air complet, porterait la bonne année, et sous-déclarerait.
      const data = await fetchAllRows<TaxRow>((from, to) =>
        supabase
          .from("trades")
          .select("close_time, open_time, pair, direction, lot_size, entry_price, exit_price, pnl, commission, swap")
          .eq("user_id", user.id)
          .eq("status", "closed")
          .gte("close_time", start)
          .lt("close_time", end)
          .order("id", { ascending: true })
          .range(from, to),
      );

      // Plutôt aucun fichier qu'un fichier fiscal incomplet.
      if (data === null) {
        setError(t("trades_export_failed"));
        return;
      }

      const rows = data
        .slice()
        .sort(
          (a, b) =>
            new Date(a.close_time ?? 0).getTime() - new Date(b.close_time ?? 0).getTime(),
        );
      const header = ["Date", "Pair", "Direction", "Lots", "Entry", "Exit", "Gross P&L", "Commission", "Swap", "Net P&L"];
      // ⚠️ Nommé pour ce qu'il est : un CSV est un fichier machine, il garde le
      // point décimal quelle que soit la langue du lecteur.
      const csvNum = (v: number | null) => (v ?? 0).toFixed(2);

      const body = rows.map((r) => {
        const netv = (r.pnl ?? 0) + (r.commission ?? 0) + (r.swap ?? 0);
        const date = cleDeJourDuTrader(r.close_time || r.open_time, fuseau);
        return [date, r.pair ?? "", r.direction ?? "", r.lot_size ?? "", r.entry_price ?? "", r.exit_price ?? "", csvNum(r.pnl), csvNum(r.commission), csvNum(r.swap), csvNum(netv)];
      });

      const total = rows.reduce((s, r) => s + (r.pnl ?? 0) + (r.commission ?? 0) + (r.swap ?? 0), 0);
      const allRows: (string | number)[][] = [header, ...body, [], ["TOTAL", "", "", "", "", "", "", "", "", csvNum(total)]];

      const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = "﻿" + allRows.map((row) => row.map(esc).join(",")).join("\r\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tradediscipline-${year}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="px-3 py-2 rounded-md border border-border text-sm text-muted hover:text-foreground hover:bg-card transition-colors flex items-center gap-2 disabled:opacity-50"
      >
        <FileSpreadsheet className="w-4 h-4" />
        {t("tax_export")}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 min-w-[120px] rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => exportYear(y)}
              className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface transition-colors"
            >
              {y}
            </button>
          ))}
        </div>
      )}
      {/* Un export comptable qui échoue doit le dire : le menu se referme, et
          sans ce message il ne resterait qu'un bouton qui n'a rien téléchargé. */}
      {error && (
        <p role="alert" className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border border-border bg-card p-2 text-xs text-loss shadow-lg">
          {error}
        </p>
      )}
    </div>
  );
}
