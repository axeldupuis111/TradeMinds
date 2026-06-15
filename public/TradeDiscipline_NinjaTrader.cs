// ============================================================================
//  TradeDiscipline — NinjaTrader 8 AddOn
//  Synchronise les trades fermes (round-turns) vers TradeDiscipline.
//
//  Installation :
//   1. Colle ton token dans la constante SyncToken ci-dessous (entre guillemets).
//   2. NinjaTrader > menu Tools > NinjaScript Editor.
//   3. Clic droit sur "AddOns" > New AddOn (ou colle ce fichier dans
//      Documents\NinjaTrader 8\bin\Custom\AddOns\).
//   4. Colle ce code, puis compile (F5).
//   5. Redemarre NinjaTrader. L'AddOn se lance automatiquement et synchronise
//      chaque trade ferme tant que NinjaTrader est connecte.
//
//  L'AddOn n'envoie et ne modifie AUCUN ordre : il lit seulement l'historique.
// ============================================================================

#region Using declarations
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
#endregion

namespace NinjaTrader.NinjaScript.AddOns
{
    public class TradeDisciplineSync : AddOnBase
    {
        // ⬇️  COLLE TON TOKEN ICI (Reglages > Synchronisation)
        private const string SyncToken = "PASTE_YOUR_TOKEN_HERE";

        private const string ApiUrl = "https://www.tradediscipline.app/api/sync/push";

        // Round-turns deja envoyes pendant cette session (cle = ExecutionId d'entree).
        private readonly HashSet<string> _sent = new HashSet<string>();
        private readonly List<Account> _hooked = new List<Account>();
        private readonly object _lock = new object();

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "TradeDiscipline Sync";
            }
            else if (State == State.Configure)
            {
                if (string.IsNullOrEmpty(SyncToken) || SyncToken.Length < 10 || SyncToken.StartsWith("PASTE"))
                {
                    Print("TradeDiscipline ERREUR : token manquant. Edite la constante SyncToken dans l'AddOn.");
                    return;
                }
                HookAccounts();
            }
            else if (State == State.Terminated)
            {
                UnhookAccounts();
            }
        }

        private void HookAccounts()
        {
            lock (Account.All)
            {
                foreach (var account in Account.All)
                {
                    account.ExecutionUpdate += OnExecutionUpdate;
                    _hooked.Add(account);
                    // Envoie les trades deja presents au demarrage.
                    SyncAccount(account);
                }
            }
        }

        private void UnhookAccounts()
        {
            foreach (var account in _hooked)
                account.ExecutionUpdate -= OnExecutionUpdate;
            _hooked.Clear();
        }

        private void OnExecutionUpdate(object sender, ExecutionEventArgs e)
        {
            if (e == null || e.Execution == null || e.Execution.Account == null) return;
            SyncAccount(e.Execution.Account);
        }

        // Parcourt les round-turns du compte et envoie ceux pas encore synchronises.
        private void SyncAccount(Account account)
        {
            lock (_lock)
            {
                TradeCollection trades;
                try { trades = account.Trades; }
                catch { return; }
                if (trades == null) return;

                foreach (Trade trade in trades)
                {
                    if (trade == null || trade.Entry == null || trade.Exit == null) continue;

                    string key = trade.Entry.ExecutionId;
                    if (string.IsNullOrEmpty(key) || _sent.Contains(key)) continue;

                    if (SendTrade(trade))
                        _sent.Add(key);
                }
            }
        }

        private bool SendTrade(Trade trade)
        {
            try
            {
                string instrument = trade.Entry.Instrument != null
                    ? trade.Entry.Instrument.FullName
                    : "UNKNOWN";

                string direction = trade.Entry.MarketPosition == MarketPosition.Long ? "long" : "short";

                // ProfitCurrency = P&L brut (hors commission). On envoie la commission
                // en negatif (cout). L'app calcule le P&L net = profit + commission.
                double grossProfit = trade.ProfitCurrency;
                double commission = -Math.Abs(trade.Commission);

                var sb = new StringBuilder();
                sb.Append("{");
                sb.AppendFormat("\"ticket\":\"{0}\",", Escape(key: trade.Entry.ExecutionId));
                sb.AppendFormat("\"symbol\":\"{0}\",", Escape(key: instrument));
                sb.AppendFormat("\"direction\":\"{0}\",", direction);
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"volume\":{0},", trade.Quantity);
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_price\":{0},", Num(trade.Entry.Price, 5));
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"close_price\":{0},", Num(trade.Exit.Price, 5));
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_time\":{0},", Unix(trade.Entry.Time));
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"close_time\":{0},", Unix(trade.Exit.Time));
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"profit\":{0},", Num(grossProfit, 2));
                sb.AppendFormat(CultureInfo.InvariantCulture, "\"commission\":{0},", Num(commission, 2));
                sb.Append("\"swap\":0,\"sl\":null,\"tp\":null,");
                sb.Append("\"source\":\"ninjatrader\"");
                sb.Append("}");

                string body = "{\"token\":\"" + Escape(key: SyncToken) + "\",\"trade\":" + sb + "}";

                return Post(body, trade.Entry.ExecutionId);
            }
            catch (Exception ex)
            {
                Print("TradeDiscipline ERREUR : " + ex.Message);
                return false;
            }
        }

        private bool Post(string body, string id)
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(ApiUrl);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Timeout = 10000;

                byte[] data = Encoding.UTF8.GetBytes(body);
                request.ContentLength = data.Length;
                using (var stream = request.GetRequestStream())
                    stream.Write(data, 0, data.Length);

                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    if (response.StatusCode == HttpStatusCode.OK)
                        return true;

                    Print("TradeDiscipline ERREUR : trade " + id + " - HTTP " + (int)response.StatusCode);
                    return false;
                }
            }
            catch (WebException wex)
            {
                string detail = wex.Message;
                if (wex.Response is HttpWebResponse hr)
                {
                    using (var reader = new StreamReader(hr.GetResponseStream()))
                        detail = "HTTP " + (int)hr.StatusCode + " - " + reader.ReadToEnd();
                }
                Print("TradeDiscipline ERREUR : trade " + id + " - " + detail);
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

        private static string Escape(string key)
        {
            return key == null ? "" : key.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }
}
