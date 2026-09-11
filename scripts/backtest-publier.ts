/**
 * PUBLICATION DES BOUGIES VERS SUPABASE STORAGE.
 *
 *   node scripts/backtest-publier.ts
 *   node scripts/backtest-publier.ts --instrument=XAUUSD --force
 *
 * Lit `donnees-backtest/` (produit par `backtest-ingest.ts`) et téléverse chaque
 * fichier mensuel dans le bucket public `backtest`.
 *
 * ⚠️ REPRENABLE ET IDEMPOTENT. Deux cent soixante mégaoctets en quatre cent
 * cinquante fichiers : une coupure au milieu ne doit pas obliger à tout
 * recommencer. On liste ce qui est déjà en ligne, et on ne renvoie que ce qui
 * manque. `--force` réécrit tout, à utiliser après un changement de format.
 *
 * ⚠️ LE MANIFESTE PART EN DERNIER, TOUJOURS. C'est lui que le navigateur lit
 * pour savoir quels mois existent. Le publier avant ses données ferait promettre
 * à l'application des mois qu'elle ne peut pas encore télécharger, et l'erreur
 * apparaîtrait chez l'utilisateur, pas ici.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { INSTRUMENTS, instrumentParCode } from "../lib/backtest/instruments.ts";

const RACINE = "donnees-backtest";
const BUCKET = "backtest";
/** Assez pour saturer une connexion domestique sans faire tomber l'API. */
const PARALLELE = 6;

function env(nom: string): string {
  const v = process.env[nom];
  if (!v) {
    console.error(`Variable d'environnement absente : ${nom}`);
    process.exit(1);
  }
  return v;
}

/** Charge .env.local sans dépendance : le script tourne hors de Next. */
function chargerEnv() {
  if (!existsSync(".env.local")) return;
  for (const ligne of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(ligne.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function dejaEnLigne(url: string, cle: string, prefixe: string): Promise<Set<string>> {
  const vus = new Set<string>();
  let offset = 0;
  for (;;) {
    const rep = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, apikey: cle, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: prefixe, limit: 1000, offset }),
    });
    if (!rep.ok) return vus;
    const lot = (await rep.json()) as { name: string }[];
    for (const o of lot) vus.add(o.name);
    if (lot.length < 1000) return vus;
    offset += lot.length;
  }
}

async function televerser(
  url: string,
  cle: string,
  chemin: string,
  corps: Buffer,
  type: string,
): Promise<boolean> {
  const rep = await fetch(`${url}/storage/v1/object/${BUCKET}/${chemin}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cle}`,
      apikey: cle,
      "Content-Type": type,
      // Un mois déjà en ligne est remplacé plutôt que rejeté : c'est ce qui
      // rend `--force` utile après un changement de format.
      "x-upsert": "true",
      // Les bougies d'un mois clos ne changent plus jamais.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: new Uint8Array(corps),
  });
  if (!rep.ok) console.error(`  ÉCHEC ${chemin} : ${rep.status} ${await rep.text()}`);
  return rep.ok;
}

async function principal() {
  chargerEnv();
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const cle = env("SUPABASE_SERVICE_ROLE_KEY");

  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) args.set(m[1], m[2] ?? "1");
  }
  const force = args.has("force");
  const seul = args.get("instrument");
  const codes = seul
    ? [instrumentParCode(seul)?.code].filter((x): x is string => Boolean(x))
    : INSTRUMENTS.map((i) => i.code);

  if (codes.length === 0) {
    console.error(`Instrument inconnu : ${seul}`);
    process.exit(1);
  }

  let envoyes = 0;
  let sautes = 0;
  let octets = 0;
  let echecs = 0;

  for (const code of codes) {
    const dossier = `${RACINE}/${code}`;
    if (!existsSync(dossier)) {
      console.log(`${code.padEnd(8)} absent en local, ignoré`);
      continue;
    }

    const enLigne = force ? new Set<string>() : await dejaEnLigne(url, cle, code);
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".tdbt"));
    const aEnvoyer = fichiers.filter((f) => !enLigne.has(f));
    sautes += fichiers.length - aEnvoyer.length;

    // Par petits paquets : une connexion domestique n'aime pas quatre cent
    // cinquante requêtes simultanées, et l'API non plus.
    for (let i = 0; i < aEnvoyer.length; i += PARALLELE) {
      const paquet = aEnvoyer.slice(i, i + PARALLELE);
      const resultats = await Promise.all(
        paquet.map(async (f) => {
          const corps = readFileSync(`${dossier}/${f}`);
          const ok = await televerser(url, cle, `${code}/${f}`, corps, "application/octet-stream");
          return { ok, taille: corps.length };
        }),
      );
      for (const r of resultats) {
        if (r.ok) {
          envoyes++;
          octets += r.taille;
        } else echecs++;
      }
    }

    // ⚠️ Le manifeste en dernier, et seulement si rien n'a échoué pour cet
    // instrument : sinon il annoncerait des mois absents du bucket.
    const manifeste = `${dossier}/manifeste.json`;
    if (echecs === 0 && existsSync(manifeste)) {
      await televerser(url, cle, `${code}/manifeste.json`, readFileSync(manifeste), "application/json");
    }

    const poids = readdirSync(dossier)
      .filter((f) => f.endsWith(".tdbt"))
      .reduce((a, f) => a + statSync(`${dossier}/${f}`).size, 0);
    console.log(
      `${code.padEnd(8)} ${String(aEnvoyer.length).padStart(3)} envoyés, ` +
        `${String(fichiers.length - aEnvoyer.length).padStart(3)} déjà là  (${(poids / 1024 / 1024).toFixed(1)} Mo)`,
    );
  }

  console.log(
    `\n${envoyes} fichiers envoyés, ${sautes} déjà en ligne, ${echecs} échecs` +
      `\n${(octets / 1024 / 1024).toFixed(1)} Mo transférés\n`,
  );
  if (echecs > 0) process.exit(2);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
