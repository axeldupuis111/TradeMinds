/**
 * CE QU'UN VISITEUR SANS COMPTE PEUT LIRE.
 *
 * La clé `anon` est publiée dans le bundle de chaque page : tout le monde l'a.
 * Ce script demande la base AVEC ELLE, comme n'importe qui peut le faire, et
 * échoue si une colonne sensible remonte.
 *
 * Usage :  node scripts/verif-anon.mjs
 * (lit NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans
 *  .env.local, ou dans l'environnement)
 *
 * ⚠️ À RELANCER APRÈS TOUTE MIGRATION QUI TOUCHE AUX POLITIQUES OU AUX
 * PRIVILÈGES : c'est la seule vérification qui regarde le produit du dehors.
 */
import { readFileSync } from "node:fs";

function env(cle) {
  if (process.env[cle]) return process.env[cle];
  try {
    const f = readFileSync(".env.local", "utf8");
    const m = new RegExp("^" + cle + "=(.*)$", "m").exec(f);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  throw new Error(cle + " introuvable (environnement ou .env.local)");
}

const U = env("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const H = { apikey: ANON, Authorization: "Bearer " + ANON };

/**
 * Colonnes qu'un inconnu ne doit JAMAIS obtenir.
 *
 * `mt_sync_token` en tête : ce n'est pas une donnée, c'est une clé d'écriture.
 * `/api/sync/push` n'authentifie que par elle.
 */
const INTERDITES = {
  profiles: ["mt_sync_token", "email", "stripe_customer_id", "coach_memory", "demo_mode"],
  trades: ["notes"],
  session_reviews: [],
};

let fautes = 0;

for (const [table, interdites] of Object.entries(INTERDITES)) {
  const r = await fetch(`${U}/rest/v1/${table}?select=*&limit=1`, { headers: H });
  if (r.status !== 200) {
    console.log(`  ${table.padEnd(18)} fermée à l'anonyme (${r.status})`);
    continue;
  }
  const lignes = await r.json();
  if (!Array.isArray(lignes) || lignes.length === 0) {
    console.log(`  ${table.padEnd(18)} aucune ligne visible`);
    continue;
  }
  const obtenues = Object.keys(lignes[0]);
  const fuites = interdites.filter((c) => obtenues.includes(c));
  if (fuites.length === 0) {
    console.log(`  ${table.padEnd(18)} ✅ ${obtenues.length} colonne(s), aucune sensible`);
  } else {
    fautes += fuites.length;
    console.log(`  ${table.padEnd(18)} ⚠ FUITE : ${fuites.join(", ")}`);
  }
}

// L'écriture doit rester impossible, quoi qu'il arrive.
const w = await fetch(`${U}/rest/v1/trades`, {
  method: "POST",
  headers: { ...H, "Content-Type": "application/json" },
  body: JSON.stringify({ pair: "SONDE", direction: "long", pnl: 0 }),
});
if (w.status === 401 || w.status === 403) {
  console.log("  écriture anonyme   ✅ refusée (" + w.status + ")");
} else {
  fautes++;
  console.log("  écriture anonyme   ⚠ ACCEPTÉE (" + w.status + ")");
}

console.log("");
if (fautes === 0) {
  console.log("✅ rien de sensible n'est lisible sans compte.");
} else {
  console.log(`⚠ ${fautes} fuite(s). Appliquer migrations/20260915_anon_column_grants.sql.`);
  process.exitCode = 1;
}
