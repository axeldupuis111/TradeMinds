import { decoderSerie, fusionnerSeries } from "./serie";
import type { SerieM1 } from "./types";

/**
 * TÉLÉCHARGEMENT DES BOUGIES, CÔTÉ NAVIGATEUR.
 *
 * Les fichiers vivent dans un bucket public de Supabase Storage, un par
 * instrument et par mois. Le navigateur ne prend que les mois de la période
 * demandée, et le cache du navigateur garde ce qu'il a déjà vu : tester une
 * deuxième stratégie sur la même période ne retélécharge rien.
 *
 * ⚠️ AUCUNE FONCTION SERVEUR N'INTERVIENT. C'est le même choix que pour la
 * projection : le calcul et les données passent par le client, donc un backtest
 * ne coûte ni temps de fonction, ni appel IA, quel que soit le nombre de fois
 * où le trader rejoue son plan. C'est ce qui rend la fonctionnalité tenable.
 */

const NOM_CACHE = "backtest-bougies-v1";

/** Un mois manquant n'est pas une erreur : la période demandée déborde peut-être. */
export interface Chargement {
  serie: SerieM1;
  moisCharges: string[];
  moisManquants: string[];
  octets: number;
}

export interface Manifeste {
  instrument: string;
  tailleTick: number;
  mois: string[];
  importeLe: string;
}

function racine(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL absent");
  return `${base}/storage/v1/object/public/backtest`;
}

/** Liste les mois "YYYY-MM" de `de` à `a` inclus. */
export function moisEntre(de: string, a: string): string[] {
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

export async function lireManifeste(code: string): Promise<Manifeste | null> {
  const rep = await fetch(`${racine()}/${code}/manifeste.json`, { cache: "force-cache" });
  if (!rep.ok) return null;
  return (await rep.json()) as Manifeste;
}

/**
 * Récupère un mois, en passant par le cache du navigateur quand il existe.
 *
 * ⚠️ Le cache est facultatif : dans une fenêtre privée, sur un navigateur qui
 * bloque le stockage, ou dans un worker sans `caches`, l'accès jette. On
 * retombe alors sur un `fetch` normal plutôt que de refuser de fonctionner.
 */
async function unMois(code: string, aaaaMm: string): Promise<ArrayBuffer | null> {
  const url = `${racine()}/${code}/${aaaaMm}.tdbt`;

  try {
    const cache = await caches.open(NOM_CACHE);
    const vu = await cache.match(url);
    if (vu) return await vu.arrayBuffer();
    const rep = await fetch(url);
    if (!rep.ok) return null;
    await cache.put(url, rep.clone());
    return await rep.arrayBuffer();
  } catch {
    const rep = await fetch(url);
    if (!rep.ok) return null;
    return await rep.arrayBuffer();
  }
}

/**
 * Charge une période entière.
 *
 * `surAvancement` sert à afficher une progression : trois ans de M1 font une
 * vingtaine de mégaoctets, et un écran figé sans explication passe pour un bug.
 */
export async function chargerSerie(
  code: string,
  de: string,
  a: string,
  surAvancement?: (faits: number, total: number) => void,
): Promise<Chargement> {
  const demandes = moisEntre(de, a);
  const morceaux: SerieM1[] = [];
  const moisCharges: string[] = [];
  const moisManquants: string[] = [];
  let octets = 0;

  for (let i = 0; i < demandes.length; i++) {
    const buf = await unMois(code, demandes[i]);
    if (buf) {
      morceaux.push(decoderSerie(buf));
      moisCharges.push(demandes[i]);
      octets += buf.byteLength;
    } else {
      moisManquants.push(demandes[i]);
    }
    surAvancement?.(i + 1, demandes.length);
  }

  if (morceaux.length === 0) {
    throw new Error(`Aucune donnée disponible pour ${code} entre ${de} et ${a}`);
  }
  return { serie: fusionnerSeries(morceaux), moisCharges, moisManquants, octets };
}
