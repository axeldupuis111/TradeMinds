/**
 * PHOTOGRAPHIE DES TITRES QUE LE FLUX ÉCONOMIQUE PUBLIE VRAIMENT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * ⚠️⚠️ LES GARDES QUI COMPARENT DU CODE À DU CODE SONT D'ACCORD ENTRE EUX ET
 * FAUX VIS-À-VIS DU MONDE. C'est ce qui avait laissé la leçon
 * `consumer_sentiment` invisible : l'alias du glossaire disait « umich consumer
 * sentiment », le flux écrit « Prelim UoM Consumer Sentiment », et tous les
 * tests passaient. Voir `lib/lecons-atteignables.test.ts`.
 *
 * `lib/titres-du-flux.json` est donc la même idée que `lib/schema-base.json` :
 * on photographie la réalité, on la commite, et les gardes comparent le code à
 * cette photo plutôt qu'à eux-mêmes.
 *
 * ⚠️ L'IMPACT EST DANS LA PHOTO, et ce n'est pas un détail : la règle de
 * traduction n'est pas « tout traduire » (le flux publie des centaines de
 * titres rares, et le repli en anglais est un choix documenté) mais « ce qui
 * compte doit être nommé ». Sans l'impact, cette règle ne peut pas s'écrire.
 *
 * ⚠️ L'IMPACT RETENU EST LE PLUS FORT VU POUR LA PAIRE : le flux publie parfois
 * la même annonce avec un impact différent selon la semaine, et une promesse de
 * couverture doit porter sur le pire cas.
 *
 * Usage :  npm run flux:sync
 * (lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local)
 */
import { readFileSync, writeFileSync } from "node:fs";

function env(cle) {
  if (process.env[cle]) return process.env[cle];
  const f = readFileSync(".env.local", "utf8");
  const m = new RegExp("^" + cle + "=(.*)$", "m").exec(f);
  if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error(cle + " introuvable (environnement ou .env.local)");
}

const U = env("NEXT_PUBLIC_SUPABASE_URL");
const K = env("SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: K, Authorization: "Bearer " + K };

const RANG = { high: 3, medium: 2, holiday: 1, low: 0 };

/** Lecture paginée : une photo amputée ferait passer un trou pour une couverture. */
const lignes = [];
for (let offset = 0; offset < 100000; offset += 1000) {
  const r = await fetch(
    `${U}/rest/v1/economic_events?select=title,impact,currency&order=id.asc&offset=${offset}&limit=1000`,
    { headers: H },
  );
  if (!r.ok) throw new Error(`lecture refusée (${r.status}) : ${await r.text()}`);
  const page = await r.json();
  lignes.push(...page);
  if (page.length < 1000) break;
}

const paires = new Map();
for (const l of lignes) {
  const cle = `${l.currency}|${l.title}`;
  const vu = paires.get(cle);
  if (!vu || (RANG[l.impact] ?? 0) > (RANG[vu.impact] ?? 0)) {
    paires.set(cle, { currency: l.currency, title: l.title, impact: l.impact });
  }
}

const sortie = Array.from(paires.values()).sort(
  (a, b) => a.currency.localeCompare(b.currency) || a.title.localeCompare(b.title),
);

writeFileSync("lib/titres-du-flux.json", JSON.stringify(sortie, null, 1) + "\n", "utf8");

const parImpact = {};
for (const p of sortie) parImpact[p.impact] = (parImpact[p.impact] ?? 0) + 1;
console.log(`${lignes.length} annonces lues, ${sortie.length} paires écrites dans lib/titres-du-flux.json`);
console.log("  par impact : " + JSON.stringify(parImpact));
