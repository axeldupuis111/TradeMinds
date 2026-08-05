// Solde d'un compte : ce que le broker annonce, pas ce qu'on reconstitue.
//
// Historiquement le solde valait « capital initial saisi à la main + somme des
// trades importés ». Deux défauts : une erreur de saisie décalait tout, et les
// dépôts/retraits n'étaient jamais vus. Depuis l'EA v1.20 (MT5) / v1.10 (MT4),
// le client pousse le solde réel et l'equity toutes les 60 s.
//
// Quand le solde réel est là, il est affiché TEL QUEL, sans rien y ajouter.
//
// Une version antérieure y ajoutait les trades clôturés après l'instantané.
// C'était faux deux fois. D'abord parce que tout trade passé sur le compte MT
// est déjà dans le solde que MT annonce, peu importe par quel chemin il est
// entré ici (synchro, import CSV, saisie manuelle) : l'ajouter le compte deux
// fois. Ensuite parce que la comparaison reposait sur `close_time`, qui vient
// de DEAL_TIME / OrderCloseTime() donc de l'heure SERVEUR du broker, lue comme
// de l'UTC : chez un broker à GMT+3, tout trade des 3 dernières heures paraît
// postérieur à l'instantané. Aucun horodatage broker n'intervient plus ici.
//
// Contrepartie assumée : un trade ajouté à la main pendant que l'EA est éteint
// ne bouge pas le solde affiché. C'est voulu — le solde affiché reste celui du
// broker, et il se remet à jour dès que l'EA redonne signe de vie.

/** Fenêtre au-delà de laquelle un compte n'est plus considéré « en direct ». */
export const LIVE_WINDOW_MS = 15 * 60 * 1000;

export interface SyncedAccountState {
  account_size: number;
  synced_balance?: number | null;
  synced_equity?: number | null;
  synced_open_positions?: number | null;
  synced_at?: string | null;
}

export interface ResolvedBalance {
  /** Solde à afficher. */
  balance: number;
  /** Somme nette des trades connus (la performance, dépôts exclus). */
  tradesPnl: number;
  /**
   * Décalage à appliquer à la courbe reconstituée pour qu'elle se termine sur
   * `balance`. Vaut 0 tant qu'aucun solde réel n'est arrivé. Un décalage
   * uniforme laisse les écarts (donc le drawdown) intacts.
   */
  curveOffset: number;
  /** true = solde annoncé par le broker, false = reconstitué depuis les trades. */
  fromBroker: boolean;
  /** true = un client a donné signe de vie il y a moins de LIVE_WINDOW_MS. */
  live: boolean;
  /** Equity temps réel, seulement si une position est ouverte en ce moment. */
  equity: number | null;
  /** Positions ouvertes au dernier instantané (0 si compte à plat ou hors ligne). */
  openPositions: number;
}

/**
 * @param tradesPnl  Somme nette (pnl + commissions + swaps) des trades du compte.
 *                   Sert uniquement au repli et au calage de la courbe.
 */
export function resolveAccountBalance(
  account: SyncedAccountState,
  tradesPnl: number,
  now: number = Date.now(),
): ResolvedBalance {
  const computed = account.account_size + tradesPnl;

  const syncedAt = account.synced_at ? Date.parse(account.synced_at) : NaN;
  const syncedBalance = account.synced_balance;

  // Solde ET equity à 0 : ce n'est pas un compte grillé (celui-là garde une
  // equity égale à son solde), c'est un terminal MetaTrader qui n'était
  // connecté à aucun compte au moment de l'envoi. Le retenir ferait afficher
  // 0 € de solde et 100 % de drawdown sur un compte en profit. Les envois de ce
  // type sont refusés à l'entrée depuis, mais des instantanés à deux zéros
  // dorment déjà en base : on les ignore ici plutôt que d'aller les effacer.
  const disconnectedTerminal = syncedBalance === 0 && (account.synced_equity ?? 0) === 0;

  if (syncedBalance == null || disconnectedTerminal || !isFinite(syncedAt)) {
    return {
      balance: computed,
      tradesPnl,
      curveOffset: 0,
      fromBroker: false,
      live: false,
      equity: null,
      openPositions: 0,
    };
  }

  // Le solde du broker, tel quel. Voir l'en-tête du fichier : y ajouter quoi que
  // ce soit revient à compter deux fois.
  const balance = syncedBalance;
  const openPositions = account.synced_open_positions ?? 0;
  const live = now - syncedAt < LIVE_WINDOW_MS;
  const equity =
    live && openPositions > 0 && account.synced_equity != null ? account.synced_equity : null;

  return {
    balance,
    tradesPnl,
    curveOffset: balance - computed,
    fromBroker: true,
    live,
    equity,
    openPositions,
  };
}
