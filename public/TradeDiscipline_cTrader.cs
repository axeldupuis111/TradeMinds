// ============================================================================
//  TradeDiscipline — cTrader cBot
//  Synchronise les positions fermees vers TradeDiscipline.
//
//  Installation :
//   1. Ouvre cTrader > Automate (icone robot a gauche).
//   2. Cree un nouveau cBot, colle ce code, puis "Build" (icone marteau).
//   3. Ajoute le cBot sur n'importe quel graphique.
//   4. Dans les parametres, colle ton token (Reglages > Synchronisation).
//   5. A l'ajout, cTrader demande l'autorisation d'acces reseau : accepte.
//   6. Clique "Play". L'historique des 90 derniers jours est envoye, puis
//      chaque nouvelle position fermee est synchronisee automatiquement.
//
//  Le cBot n'ouvre et ne ferme AUCUNE position : il lit seulement l'historique.
//
//  v2 - le cBot envoie aussi l'etat du compte (solde reel, equity, positions
//  ouvertes, devise), avec chaque trade et par battement de coeur toutes les
//  60 s. TradeDiscipline affiche donc le vrai solde du broker au lieu de le
//  reconstituer, suit l'equity en direct position ouverte, et connait la devise
//  du compte.
//
//  Note : contrairement a MetaTrader, cTrader tourne ici en UTC (attribut
//  TimeZone ci-dessous) et Unix() convertit explicitement. Les horodatages sont
//  donc deja justes : ce client n'a pas besoin d'envoyer server_time.
// ============================================================================

using System;
using System.Globalization;
using System.Net.Http;
using System.Text;
using System.Collections.Generic;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(AccessRights = AccessRights.FullAccess, TimeZone = TimeZones.UTC)]
    public class TradeDiscipline : Robot
    {
        [Parameter("Token de synchronisation", DefaultValue = "")]
        public string SyncToken { get; set; }

        [Parameter("URL API (ne pas modifier)", DefaultValue = "https://www.tradediscipline.app/api/sync/push")]
        public string ApiUrl { get; set; }

        [Parameter("Jours d'historique au demarrage", DefaultValue = 90, MinValue = 1, MaxValue = 365)]
        public int HistoryDays { get; set; }

        [Parameter("Envoyer le solde reel et l'equity", DefaultValue = true)]
        public bool SendBalance { get; set; }

        // Positions deja envoyees pendant cette session (evite les doublons).
        private readonly HashSet<long> _sent = new HashSet<long>();
        private static readonly HttpClient Http = new HttpClient();

        protected override void OnStart()
        {
            if (string.IsNullOrWhiteSpace(SyncToken) || SyncToken.Length < 10)
            {
                Print("TradeDiscipline ERREUR : token manquant ou invalide. " +
                      "Renseigne ton token dans les parametres du cBot.");
                Stop();
                return;
            }

            Print("TradeDiscipline : demarrage. Envoi de l'historique des {0} derniers jours...", HistoryDays);

            var from = Server.Time.AddDays(-HistoryDays);
            SendClosedTrades(from);

            // Etat du compte des le demarrage : le solde reel s'affiche tout de
            // suite, sans attendre la premiere cloture.
            SendHeartbeat();

            // Synchronise en temps reel chaque nouvelle position fermee.
            Positions.Closed += OnPositionClosed;

            // Battement de coeur : fait vivre le solde et l'equity en direct
            // pendant qu'une position est ouverte.
            Timer.Start(TimeSpan.FromSeconds(60));
        }

        protected override void OnTimer()
        {
            SendHeartbeat();
        }

        protected override void OnStop()
        {
            Timer.Stop();
            Positions.Closed -= OnPositionClosed;
        }

        // Etat du compte : solde reel, equity, positions ouvertes, devise.
        // Renvoie "" si l'envoi du solde est desactive.
        private string BuildAccountJson()
        {
            if (!SendBalance) return "";

            var sb = new StringBuilder();
            sb.Append("{");
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"account\":\"{0}\",", Account.Number);
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"balance\":{0},", Num(Account.Balance, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"equity\":{0},", Num(Account.Equity, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_positions\":{0},", Positions.Count);
            sb.AppendFormat("\"currency\":\"{0}\",", Escape(Account.Currency));
            sb.Append("\"source\":\"ctrader\"");
            sb.Append("}");
            return sb.ToString();
        }

        // Envoie l'etat du compte seul (aucun trade).
        private void SendHeartbeat()
        {
            string account = BuildAccountJson();
            if (account == "") return;

            string body = "{\"token\":\"" + Escape(SyncToken) + "\",\"account\":" + account + "}";

            try
            {
                var content = new StringContent(body, Encoding.UTF8, "application/json");
                var res = Http.PostAsync(ApiUrl, content).Result;
                string payload = res.Content.ReadAsStringAsync().Result;

                // Volontairement silencieux quand tout va bien : une ligne par
                // minute rendrait le journal illisible.
                if (!res.IsSuccessStatusCode)
                    Print("TradeDiscipline ERREUR : etat du compte - HTTP {0}", (int)res.StatusCode);
                else if (payload.IndexOf("\"account\":\"ok\"", StringComparison.Ordinal) < 0)
                    Print("TradeDiscipline ATTENTION : solde non pris en compte (compte {0}). " +
                          "Motif renvoye par le serveur : {1}", Account.Number, payload);
            }
            catch (Exception ex)
            {
                Print("TradeDiscipline ERREUR : etat du compte - {0}", ex.Message);
            }
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            // La position fermee apparait dans l'historique : renvoie la fenetre recente.
            SendClosedTrades(Server.Time.AddMinutes(-10));
        }

        // Parcourt l'historique des trades fermes et envoie ceux pas encore synchronises.
        private void SendClosedTrades(DateTime fromTime)
        {
            int ok = 0, err = 0;

            foreach (var trade in History)
            {
                if (trade.ClosingTime < fromTime) continue;
                if (_sent.Contains(trade.PositionId)) continue;

                if (SendTrade(trade)) ok++;
                else err++;
            }

            if (ok > 0 || err > 0)
                Print("TradeDiscipline : envoi termine - {0} reussi(s), {1} echec(s).", ok, err);
        }

        private bool SendTrade(HistoricalTrade trade)
        {
            // Volume en lots (coherent avec MetaTrader). VolumeInUnitsToQuantity
            // convertit les unites en lots selon le symbole.
            double volumeLots = trade.VolumeInUnits;
            var symbol = Symbols.GetSymbol(trade.SymbolName);
            if (symbol != null)
                volumeLots = symbol.VolumeInUnitsToQuantity(trade.VolumeInUnits);

            string direction = trade.TradeType == TradeType.Buy ? "buy" : "sell";

            // P&L brut + commission + swap separes (comme l'EA MetaTrader).
            // L'app calcule le P&L net = profit + commission + swap.
            var sb = new StringBuilder();
            sb.Append("{");
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"account\":\"{0}\",", Account.Number);
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"ticket\":{0},", trade.PositionId);
            sb.AppendFormat("\"symbol\":\"{0}\",", Escape(trade.SymbolName));
            sb.AppendFormat("\"direction\":\"{0}\",", direction);
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"volume\":{0},", Num(volumeLots, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_price\":{0},", Num(trade.EntryPrice, 5));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"close_price\":{0},", Num(trade.ClosingPrice, 5));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_time\":{0},", Unix(trade.EntryTime));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"close_time\":{0},", Unix(trade.ClosingTime));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"profit\":{0},", Num(trade.GrossProfit, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"commission\":{0},", Num(trade.Commissions, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"swap\":{0},", Num(trade.Swap, 2));
            sb.Append("\"sl\":null,\"tp\":null,");
            sb.Append("\"source\":\"ctrader\"");
            sb.Append("}");

            // L'etat du compte voyage avec le trade : le solde renvoye par le
            // broker l'inclut deja (il est lu apres sa cloture).
            string account = BuildAccountJson();
            string body = "{\"token\":\"" + Escape(SyncToken) + "\",\"trade\":" + sb
                          + (account == "" ? "" : ",\"account\":" + account) + "}";

            try
            {
                var content = new StringContent(body, Encoding.UTF8, "application/json");
                var res = Http.PostAsync(ApiUrl, content).Result;
                if (res.IsSuccessStatusCode)
                {
                    _sent.Add(trade.PositionId);
                    return true;
                }

                Print("TradeDiscipline ERREUR : trade {0} - HTTP {1}", trade.PositionId, (int)res.StatusCode);
                return false;
            }
            catch (Exception ex)
            {
                Print("TradeDiscipline ERREUR : trade {0} - {1}", trade.PositionId, ex.Message);
                return false;
            }
        }

        private static string Num(double v, int digits)
        {
            return Math.Round(v, digits).ToString("0.0#####", CultureInfo.InvariantCulture);
        }

        private static long Unix(DateTime dt)
        {
            return (long)(dt.ToUniversalTime() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
        }

        private static string Escape(string s)
        {
            return s == null ? "" : s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }
}
