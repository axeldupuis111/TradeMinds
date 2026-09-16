/**
 * CE QU'UN VISITEUR PEUT LIRE, SANS COMPTE ET AVEC UN COMPTE.
 *
 * La clé `anon` est publiée dans le bundle de chaque page : tout le monde l'a.
 * Ce script demande la base AVEC ELLE, comme n'importe qui peut le faire, puis
 * recommence avec un vrai jeton de session, et échoue si une colonne sensible
 * remonte dans l'un ou l'autre cas.
 *
 * Usage :
 *   npm run verif:acces
 *   npm run verif:acces -- --jeton <jwt>      (ou SUPABASE_TEST_JWT=<jwt>)
 *
 * Pour obtenir un jeton : ouvrir le produit connecté, console du navigateur,
 *   document.cookie.split('; ').filter(c=>c.includes('auth-token.')).sort()
 * puis concaténer les morceaux, retirer le préfixe `base64-`, décoder, et
 * prendre `access_token`. Il expire vite : c'est voulu, on ne le stocke pas.
 *
 * ── CE QUE CE SCRIPT CORRIGE PAR RAPPORT À `verif-anon.mjs` ─────────────────
 *
 * ⚠️⚠️ IL NE DEMANDAIT QUE `select=*`. Un 401 sur `select=*` était compté comme
 * « fermée », ce qui est vrai avec des privilèges de colonne mais ne PROUVE
 * rien sur une colonne précise : c'est la question posée qui doit être « me
 * donnes-tu `mt_sync_token` ? », pas « me donnes-tu tout ? ».
 *
 * ⚠️⚠️ ET IL DÉCLARAIT « rien de sensible n'est lisible » MÊME SI LA CLÉ ÉTAIT
 * MAUVAISE : tout répondait 401, donc tout passait. Une sonde de contrôle
 * vérifie maintenant qu'une lecture LÉGITIME répond bien 200 ; sans elle, le
 * script sort en erreur au lieu de se déclarer content.
 *
 * ⚠️ À RELANCER APRÈS TOUTE MIGRATION QUI TOUCHE AUX POLITIQUES OU AUX
 * PRIVILÈGES : c'est la seule vérification qui regarde le produit du dehors.
 */
import { readFileSync } from "node:fs";

function env(cle, obligatoire = true) {
  if (process.env[cle]) return process.env[cle];
  try {
    const f = readFileSync(".env.local", "utf8");
    const m = new RegExp("^" + cle + "=(.*)$", "m").exec(f);
    if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // pas de .env.local : on se rabat sur l'environnement seul
  }
  if (!obligatoire) return null;
  throw new Error(cle + " introuvable (environnement ou .env.local)");
}

const U = env("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const argJeton = (() => {
  const i = process.argv.indexOf("--jeton");
  return i > -1 ? process.argv[i + 1] : null;
})();
const JETON = argJeton || env("SUPABASE_TEST_JWT", false);

/**
 * Colonnes qu'un lecteur ne doit JAMAIS obtenir sur la ligne de QUELQU'UN
 * D'AUTRE.
 *
 * `mt_sync_token` en tête : ce n'est pas une donnée, c'est une clé d'écriture.
 * `/api/sync/push` et `/api/sync/tradingview` n'authentifient que par elle.
 */
const INTERDITES = {
  profiles: ["mt_sync_token", "email", "stripe_customer_id", "coach_memory", "demo_mode"],
  trades: ["notes"],
  session_reviews: [],
};

/** Une lecture légitime par table : si elle échoue, le script ne prouve rien. */
const CONTROLE = {
  profiles: "id,username",
  trades: "id",
  session_reviews: "id",
};

async function sonder(entetes, table, colonne) {
  const r = await fetch(`${U}/rest/v1/${table}?select=${colonne}&limit=1`, { headers: entetes });
  let corps = null;
  try {
    corps = await r.json();
  } catch {
    corps = null;
  }
  return { statut: r.status, corps };
}

/**
 * @returns {Promise<{fautes: number, muet: boolean}>} `muet` = on n'a rien pu
 * prouver (contrôle en échec), ce qui n'est PAS un succès.
 */
async function verifier(nom, entetes, { ignorerSaPropreLigne }) {
  console.log(`\n── ${nom} ` + "─".repeat(Math.max(0, 56 - nom.length)));
  let fautes = 0;
  let muet = false;

  for (const [table, interdites] of Object.entries(INTERDITES)) {
    const ctrl = await sonder(entetes, table, CONTROLE[table]);
    if (ctrl.statut !== 200) {
      console.log(`  ${table.padEnd(18)} ⚠ CONTRÔLE EN ÉCHEC (${ctrl.statut}) : rien n'est prouvé ici`);
      muet = true;
      continue;
    }
    const visibles = Array.isArray(ctrl.corps) ? ctrl.corps.length : 0;
    if (visibles === 0) {
      console.log(`  ${table.padEnd(18)} aucune ligne visible (rien à fuir)`);
      continue;
    }

    const fuites = [];
    for (const colonne of interdites) {
      const s = await sonder(entetes, table, `${CONTROLE[table]},${colonne}`);
      if (s.statut !== 200) continue; // refusée : c'est ce qu'on veut
      const lignes = Array.isArray(s.corps) ? s.corps : [];
      if (lignes.length === 0) continue;
      if (lignes.some((l) => l[colonne] !== undefined)) fuites.push(colonne);
    }

    if (fuites.length === 0) {
      console.log(`  ${table.padEnd(18)} ✅ aucune colonne sensible rendue`);
    } else {
      fautes += fuites.length;
      const note = ignorerSaPropreLigne ? " (y compris, peut-être, sa propre ligne)" : "";
      console.log(`  ${table.padEnd(18)} ⚠ FUITE : ${fuites.join(", ")}${note}`);
    }
  }
  return { fautes, muet };
}

let fautes = 0;
let muet = false;

const anonyme = await verifier("sans compte (clé anon)", { apikey: ANON, Authorization: "Bearer " + ANON }, {
  ignorerSaPropreLigne: false,
});
fautes += anonyme.fautes;
muet ||= anonyme.muet;

// L'écriture doit rester impossible, quoi qu'il arrive.
const w = await fetch(`${U}/rest/v1/trades`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ pair: "SONDE", direction: "long", pnl: 0 }),
});
if (w.status === 401 || w.status === 403) {
  console.log("  écriture anonyme   ✅ refusée (" + w.status + ")");
} else {
  fautes++;
  console.log("  écriture anonyme   ⚠ ACCEPTÉE (" + w.status + ")");
}

if (JETON) {
  /**
   * ⚠️ ICI LA FUITE EST CELLE DES AUTRES. Un compte lit légitimement SA ligne
   * en entier ; ce qu'on mesure, c'est ce qu'il obtient sur les lignes des
   * profils publics. La sonde le dit sans distinguer les deux : c'est à la
   * lecture du résultat de vérifier qu'il ne remonte QUE sa propre ligne, ce
   * que `migrations/20260916_profils_publics_rls.sql` garantit une fois posée.
   */
  const connecte = await verifier("avec un compte ordinaire", { apikey: ANON, Authorization: "Bearer " + JETON }, {
    ignorerSaPropreLigne: true,
  });
  fautes += connecte.fautes;
  muet ||= connecte.muet;

  // Combien de lignes remontent ? Une seule = la sienne, ce qui est correct.
  const r = await fetch(`${U}/rest/v1/profiles?select=id,username&limit=50`, {
    headers: { apikey: ANON, Authorization: "Bearer " + JETON },
  });
  const lignes = r.status === 200 ? await r.json() : [];
  console.log(`  profils visibles   ${Array.isArray(lignes) ? lignes.length : "?"} ligne(s)`);
  if (Array.isArray(lignes) && lignes.length > 1) {
    console.log("    ⚠ plus d'une ligne : la politique RLS expose encore les profils publics aux comptes");
  }
} else {
  console.log("\n── avec un compte ordinaire ──────────────────────────────");
  console.log("  ⚠ NON TESTÉ : passer --jeton <jwt> (voir l'en-tête de ce fichier).");
  console.log("  C'est la moitié qui restait ouverte le 2026-09-16 : ne pas la");
  console.log("  déclarer close sans l'avoir mesurée.");
}

console.log("");
if (muet) {
  console.log("⚠ une sonde de contrôle a échoué : ce script n'a rien prouvé.");
  process.exitCode = 1;
} else if (fautes === 0) {
  console.log("✅ aucune colonne sensible rendue sur les cas mesurés.");
} else {
  console.log(`⚠ ${fautes} fuite(s). Voir migrations/20260915_anon_column_grants.sql`);
  console.log("  et migrations/20260916_profils_publics_rls.sql.");
  process.exitCode = 1;
}
