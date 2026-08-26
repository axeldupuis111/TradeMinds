/**
 * IMPORT DES BOUGIES M1 POUR LE BACKTEST.
 *
 * Se lance avec Node 24, qui lit le TypeScript nativement :
 *
 *   node scripts/backtest-ingest.ts --source=binance   --symbole=BTCUSDT --tick=0.01    --de=2024-01 --a=2024-12
 *   node scripts/backtest-ingest.ts --source=dukascopy --symbole=xauusd  --tick=0.01    --de=2023-01 --a=2026-06
 *   node scripts/backtest-ingest.ts --source=dukascopy --symbole=eurusd  --tick=0.00001 --de=2023-01 --a=2026-06
 *
 * ⚠️ IL IMPORTE LE MÊME ENCODEUR QUE L'APPLICATION (`lib/backtest/serie.ts`).
 * Réécrire le format binaire ici « pour aller vite » garantirait qu'un jour les
 * deux divergent d'un octet, et un décalage d'un octet sur un tableau de prix
 * ne plante pas : il rend des chiffres faux, ce qui est bien pire.
 *
 * ⚠️ DUKASCOPY REFUSE LES IP DE CENTRE DE DONNÉES. Le téléchargement doit
 * partir d'une machine ordinaire. Binance, lui, répond de partout : c'est la
 * source qui permet de valider toute la chaîne sans dépendre de personne.
 *
 * Un fichier par instrument et par MOIS, plus un manifeste. Le navigateur ne
 * télécharge ainsi que les mois de la période testée, et les garde en cache.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync, constants as zlibConstants } from "node:zlib";
import { encoderSerie, serieDepuisLignes } from "../lib/backtest/serie.ts";
import type { LigneOHLC } from "../lib/backtest/serie.ts";

interface Options {
  source: "binance" | "dukascopy";
  symbole: string;
  tick: number;
  de: string;
  a: string;
  sortie: string;
}

function lireOptions(): Options {
  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) args.set(m[1], m[2]);
  }
  const requis = (k: string): string => {
    const v = args.get(k);
    if (!v) {
      console.error(`Argument manquant : --${k}=…`);
      process.exit(1);
    }
    return v;
  };
  const source = requis("source");
  if (source !== "binance" && source !== "dukascopy") {
    console.error(`Source inconnue : ${source}. Attendu : binance ou dukascopy.`);
    process.exit(1);
  }
  const tick = Number(requis("tick"));
  if (!Number.isFinite(tick) || tick <= 0) {
    console.error("--tick doit être un nombre positif (0.01 sur l'or, 0.00001 sur l'euro).");
    process.exit(1);
  }
  return {
    source,
    symbole: requis("symbole"),
    tick,
    de: requis("de"),
    a: requis("a"),
    sortie: args.get("sortie") ?? "donnees-backtest",
  };
}

/** Liste les mois "YYYY-MM" de `de` à `a` inclus. */
function mois(de: string, a: string): string[] {
  const [ad, md] = de.split("-").map(Number);
  const [aa, ma] = a.split("-").map(Number);
  const out: string[] = [];
  for (let an = ad, m = md; an < aa || (an === aa && m <= ma); m++) {
    if (m > 12) {
      m = 1;
      an++;
      if (an > aa) break;
    }
    out.push(`${an}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Extrait l'unique entrée d'une archive ZIP.
 *
 * Écrit à la main plutôt qu'avec une dépendance : les archives de Binance ne
 * contiennent qu'un fichier et l'en-tête local suffit à le trouver.
 */
function dezipper(buf: Buffer): Buffer {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error("Archive ZIP non reconnue");
  const methode = buf.readUInt16LE(8);
  const tailleCompressee = buf.readUInt32LE(18);
  const debut = 30 + buf.readUInt16LE(26) + buf.readUInt16LE(28);
  // Quand l'archive utilise un descripteur de données, la taille vaut 0 dans
  // l'en-tête local : on laisse alors zlib s'arrêter à la fin du flux.
  const fin = tailleCompressee > 0 ? debut + tailleCompressee : buf.length;
  const donnees = buf.subarray(debut, fin);
  if (methode === 0) return Buffer.from(donnees);
  return inflateRawSync(donnees, { finishFlush: zlibConstants.Z_SYNC_FLUSH });
}

async function lireBinance(symbole: string, aaaaMm: string): Promise<LigneOHLC[]> {
  const url = `https://data.binance.vision/data/spot/monthly/klines/${symbole}/1m/${symbole}-1m-${aaaaMm}.zip`;
  const rep = await fetch(url);
  if (rep.status === 404) return [];
  if (!rep.ok) throw new Error(`${rep.status} sur ${url}`);

  const csv = dezipper(Buffer.from(await rep.arrayBuffer())).toString("utf8");
  return csv
    .trim()
    .split("\n")
    .filter((r) => r && !r.startsWith("open_time"))
    .map((r) => {
      const p = r.split(",");
      let ms = Number(p[0]);
      // Binance publie certains jeux en microsecondes. Une date de 1970 ou de
      // l'an 5000 passerait ensuite inaperçue dans un graphique.
      if (ms > 1e14) ms = Math.round(ms / 1000);
      return {
        ms,
        ouverture: Number(p[1]),
        haut: Number(p[2]),
        bas: Number(p[3]),
        cloture: Number(p[4]),
      };
    });
}

async function lireDukascopy(symbole: string, aaaaMm: string): Promise<LigneOHLC[]> {
  const { getHistoricalRates } = await import("dukascopy-node");
  const [an, m] = aaaaMm.split("-").map(Number);
  const rates = (await getHistoricalRates({
    instrument: symbole,
    dates: { from: new Date(Date.UTC(an, m - 1, 1)), to: new Date(Date.UTC(an, m, 1)) },
    timeframe: "m1",
    format: "json",
    // Le côté vendeur est le prix affiché par défaut ; le spread est modélisé
    // séparément dans le moteur, il ne doit pas être compté deux fois.
    priceType: "bid",
  })) as Array<{ timestamp: number; open: number; high: number; low: number; close: number }>;

  return rates.map((r) => ({
    ms: r.timestamp,
    ouverture: r.open,
    haut: r.high,
    bas: r.low,
    cloture: r.close,
  }));
}

async function principal() {
  const opts = lireOptions();
  const dossier = `${opts.sortie}/${opts.symbole.toUpperCase()}`;
  mkdirSync(dossier, { recursive: true });

  const disponibles: string[] = [];
  let totalBougies = 0;
  let totalEcartees = 0;
  let totalOctets = 0;

  for (const aaaaMm of mois(opts.de, opts.a)) {
    const chemin = `${dossier}/${aaaaMm}.tdbt`;
    if (existsSync(chemin)) {
      // Reprise après interruption : trois ans de Dukascopy prennent longtemps,
      // et retélécharger ce qu'on a déjà est la meilleure façon de renoncer.
      disponibles.push(aaaaMm);
      totalOctets += readFileSync(chemin).length;
      console.log(`  ${aaaaMm}  déjà présent`);
      continue;
    }

    let lignes: LigneOHLC[];
    try {
      lignes =
        opts.source === "binance"
          ? await lireBinance(opts.symbole, aaaaMm)
          : await lireDukascopy(opts.symbole, aaaaMm);
    } catch (e) {
      console.error(`  ${aaaaMm}  ÉCHEC : ${(e as Error).message}`);
      continue;
    }

    if (lignes.length === 0) {
      console.log(`  ${aaaaMm}  aucune donnée`);
      continue;
    }

    const { serie, ecartees } = serieDepuisLignes(lignes, opts.symbole.toUpperCase(), opts.tick);
    const buf = Buffer.from(encoderSerie(serie));
    writeFileSync(chemin, buf);

    disponibles.push(aaaaMm);
    totalBougies += serie.t.length;
    totalEcartees += ecartees;
    totalOctets += buf.length;

    const alerte = ecartees > lignes.length * 0.01 ? "  ⚠️ SOURCE ABÎMÉE" : "";
    console.log(
      `  ${aaaaMm}  ${String(serie.t.length).padStart(7)} bougies  ${(buf.length / 1024).toFixed(0).padStart(5)} Ko  ${ecartees} écartées${alerte}`,
    );
  }

  writeFileSync(
    `${dossier}/manifeste.json`,
    JSON.stringify(
      {
        instrument: opts.symbole.toUpperCase(),
        tailleTick: opts.tick,
        source: opts.source,
        mois: disponibles.sort(),
        importeLe: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    `\n${disponibles.length} mois dans ${dossier}` +
      `\n${totalBougies} bougies importées, ${totalEcartees} écartées` +
      `\n${(totalOctets / 1024 / 1024).toFixed(1)} Mo au total\n`,
  );

  // Une source qui perd plus d'un pour cent de ses bougies n'est pas une source
  // dégradée, c'est une source dont on ne peut rien conclure.
  if (totalBougies > 0 && totalEcartees > totalBougies * 0.01) {
    console.error("⚠️ Plus de 1 % des bougies écartées : ne pas backtester sur ces données.");
    process.exit(2);
  }
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
