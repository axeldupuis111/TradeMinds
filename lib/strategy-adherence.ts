/**
 * L'ÉCART ENTRE CE QUE LE TRADER A ÉCRIT ET CE QU'IL FAIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * « Ce qui impacte le plus la rentabilité, c'est la psychologie et la
 * discipline. » C'est vrai, tout le monde le répète, et à peu près personne ne
 * le MESURE. On se contente de le proclamer, ce qui n'a jamais changé le
 * comportement de qui que ce soit.
 *
 * Or on peut le mesurer, et sans rien inventer : la fiche du trader contient
 * des règles chiffrées (risque par trade, trades par jour, arrêt après N
 * pertes), et son journal contient ce qu'il a réellement fait. Il suffit de
 * confronter les deux.
 *
 * ⚠️ ON NE MESURE QUE LES RÈGLES QU'IL A LUI-MÊME ÉCRITES. Aucune norme
 * extérieure, aucun « 2 % par trade recommandé ». Une règle absente de la fiche
 * n'est pas violée, elle n'existe pas : on ne peut pas reprocher à quelqu'un de
 * ne pas respecter une règle qu'il n'a jamais posée. C'est ce qui rend le
 * constat inattaquable, et donc utile.
 *
 * ⚠️ ET ON NE MORALISE PAS. La sortie est un COMPTE (« 4 jours sur 30 »), pas
 * un jugement. Le trader tire lui-même la conclusion, et c'est la seule façon
 * qu'elle tienne.
 */

/** Un trade clôturé, réduit à ce que la mesure d'écart demande. */
export interface TradeAdherence {
  /** ISO. Sert à regrouper par journée. */
  open_time: string;
  /** P&L net, commissions et swap déduits. */
  netPnl: number;
}

/** Les règles chiffrées de la fiche. Null = règle non posée, donc non mesurée. */
export interface ReglesMesurables {
  max_trades_per_day?: number | null;
  max_consecutive_losses?: number | null;
  risk_per_trade_pct?: number | null;
}

export interface EcartRegle {
  /** Clé de traduction du libellé. */
  code: string;
  /** Occurrences où la règle n'a pas été tenue. */
  ecarts: number;
  /** Occurrences totales où elle POUVAIT l'être (jours, trades, séries). */
  occasions: number;
  /** Valeur déclarée dans la fiche, pour la rappeler au trader. */
  declare: number;
  /** Le pire dépassement observé, pour donner l'échelle. */
  pire: number;
  /**
   * Le pourcentage tel que le trader l'a écrit, quand la règle en est un.
   *
   * ⚠️ Sans lui, la carte affichait « tu as écrit un risque de 2 500 $ par
   * trade » alors qu'il avait écrit « 5 % ». Le chiffre était juste et la
   * phrase fausse : on lui attribue une règle qu'il n'a jamais formulée ainsi.
   */
  declarePct?: number;
}

export interface Adherence {
  /** Une entrée par règle MESURABLE, c'est-à-dire posée dans la fiche. */
  regles: EcartRegle[];
  /** Trades couverts par la mesure. */
  trades: number;
  /** Journées de trading couvertes. */
  jours: number;
  /**
   * Part des occasions où les règles posées ont été tenues, toutes règles
   * confondues. `null` si aucune règle chiffrée n'est posée : dans ce cas il n'y
   * a rien à respecter, et afficher 100 % serait un mensonge flatteur.
   */
  taux: number | null;
}

/** Clé de journée dans le fuseau du trader, pour regrouper sans décalage. */
function jourDe(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Confronte le journal aux règles de la fiche.
 *
 * @param capital sert à convertir « 2 % par trade » en euros. Sans capital
 *        connu, la règle de risque n'est pas mesurable et disparaît de la
 *        sortie plutôt que d'être évaluée sur une base inventée.
 */
export function mesurerAdherence(
  trades: TradeAdherence[],
  regles: ReglesMesurables,
  capital: number,
  timezone = "UTC",
): Adherence {
  const chronologiques = trades
    .slice()
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const parJour = new Map<string, TradeAdherence[]>();
  for (const t of chronologiques) {
    const j = jourDe(t.open_time, timezone);
    const liste = parJour.get(j);
    if (liste) liste.push(t);
    else parJour.set(j, [t]);
  }

  const sortie: EcartRegle[] = [];

  // ── Cadence : plus de trades dans une journée que la fiche n'autorise ─────
  const cadence = positif(regles.max_trades_per_day);
  if (cadence) {
    let ecarts = 0;
    let pire = 0;
    for (const liste of Array.from(parJour.values())) {
      if (liste.length > cadence) {
        ecarts++;
        pire = Math.max(pire, liste.length);
      }
    }
    sortie.push({
      code: "adh_cadence",
      ecarts,
      occasions: parJour.size,
      declare: cadence,
      pire,
    });
  }

  // ── Risque : une perte plus lourde que ce que la fiche autorise ──────────
  //
  // ⚠️ CE QUE CE COMPTE SIGNIFIE VRAIMENT. Une perte supérieure au risque
  // déclaré veut dire l'une de deux choses : la position était trop grosse, ou
  // le stop n'a pas été tenu. Les deux relèvent de la discipline, et aucune des
  // deux ne se voit dans un P&L mensuel. C'est précisément ce qu'on cherche.
  const risquePct = positif(regles.risk_per_trade_pct);
  if (risquePct && capital > 0) {
    const plafond = (risquePct / 100) * capital;
    let ecarts = 0;
    let pire = 0;
    for (const t of chronologiques) {
      const perte = -Math.min(0, t.netPnl);
      if (perte > plafond) {
        ecarts++;
        pire = Math.max(pire, perte);
      }
    }
    sortie.push({
      code: "adh_risque",
      ecarts,
      occasions: chronologiques.length,
      declare: Math.round(plafond),
      pire: Math.round(pire),
      declarePct: risquePct,
    });
  }

  // ── Arrêt : séries de pertes plus longues que la fiche ne l'autorise ─────
  //
  // On compte les JOURNÉES où la série a été dépassée, pas les trades : ce qui
  // est en cause est la décision de continuer après la Nième perte, et elle se
  // prend une fois par journée.
  const serie = positif(regles.max_consecutive_losses);
  if (serie) {
    let ecarts = 0;
    let pire = 0;
    for (const liste of Array.from(parJour.values())) {
      let courante = 0;
      let maxJour = 0;
      for (const t of liste) {
        if (t.netPnl < 0) {
          courante++;
          maxJour = Math.max(maxJour, courante);
        } else {
          courante = 0;
        }
      }
      if (maxJour > serie) {
        ecarts++;
        pire = Math.max(pire, maxJour);
      }
    }
    sortie.push({
      code: "adh_serie",
      ecarts,
      occasions: parJour.size,
      declare: serie,
      pire,
    });
  }

  // ⚠️ AUCUNE RÈGLE POSÉE, DONC AUCUN TAUX. Rendre 100 % dirait « tu respectes
  // tout » à quelqu'un qui n'a rien à respecter : c'est le genre de flatterie
  // qui décrédibilise l'outil entier auprès de celui qui comprend.
  //
  // ⚠️ ET LA MOYENNE SE FAIT PAR RÈGLE, PAS SUR LE TOTAL DES OCCASIONS.
  //
  // Défaut vu en prévisualisation le 2026-08-25 : en additionnant toutes les
  // occasions, un trader qui avait dépassé sa cadence 3 jours sur 21 ET sa règle
  // d'arrêt 4 jours sur 21 affichait 93 % de respect, parce que ses 60 trades
  // au bon risque noyaient le dénominateur. Les règles ne se comptent pas dans
  // la même unité (des journées pour la cadence, des trades pour le risque) :
  // les mettre dans le même sac fait gagner celle qui a le plus d'occasions.
  //
  // Chaque règle pèse donc pareil, quel que soit le nombre de fois où elle
  // pouvait être tenue. Sur le même exemple : 86 %, 100 % et 81 %, soit 89 %.
  // L'écart avec 93 % paraît petit ; il va dans le sens de la flatterie, et
  // c'est exactement le sens qu'on refuse.
  const mesurables = sortie.filter((r) => r.occasions > 0);
  const taux =
    mesurables.length === 0
      ? null
      : mesurables.reduce((n, r) => n + (r.occasions - r.ecarts) / r.occasions, 0) / mesurables.length;

  return {
    regles: sortie,
    trades: chronologiques.length,
    jours: parJour.size,
    taux,
  };
}

function positif(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}
