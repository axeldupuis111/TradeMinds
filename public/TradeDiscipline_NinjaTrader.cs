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
//  L'AddOn lit uniquement les executions du compte et reconstitue les trades
//  (entree + sortie) lui-meme. Il n'envoie et ne modifie AUCUN ordre.
//
//  v2 - l'AddOn envoie aussi l'etat du compte (solde reel, equity, positions
//  ouvertes, devise), avec chaque trade et par battement de coeur toutes les
//  60 s. TradeDiscipline affiche donc le vrai solde du broker au lieu de le
//  reconstituer, suit l'equity en direct position ouverte, et connait la devise
//  du compte.
//
//  Note : Unix() convertit explicitement en UTC, les horodatages sont donc deja
//  justes. Ce client n'a pas besoin d'envoyer server_time, contrairement aux EA
//  MetaTrader qui datent leurs trades en heure serveur du broker.
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

        // Etat d'une position ouverte par instrument (netting coût moyen).
        private class PosState
        {
            public int NetQty;            // signe : + long, - short
            public double AvgEntry;       // prix d'entree moyen de la quantite ouverte
            public int OpenQty;           // total contrats ayant ouvert la position
            public double RealizedPnl;    // P&L realise (brut)
            public double Commission;     // somme des commissions (negatif = cout)
            public double ExitNotional;   // pour la VWAP de sortie
            public int ExitQty;
            public string FirstExecId;    // id stable du trade
            public DateTime OpenTime;
            public double PointValue;
            public string Direction;      // "long" | "short"
        }

        private readonly Dictionary<string, PosState> _open = new Dictionary<string, PosState>();
        private readonly HashSet<string> _processed = new HashSet<string>(); // executions deja traitees
        private readonly List<Account> _hooked = new List<Account>();
        private readonly object _lock = new object();
        private System.Threading.Timer _heartbeat;

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

                // Battement de coeur : fait vivre le solde et l'equity en direct
                // pendant qu'une position est ouverte. AddOnBase n'expose aucun
                // timer, d'ou le timer .NET.
                _heartbeat = new System.Threading.Timer(
                    delegate { SendHeartbeat(); }, null, 5000, 60000);
            }
            else if (State == State.Terminated)
            {
                if (_heartbeat != null)
                {
                    _heartbeat.Dispose();
                    _heartbeat = null;
                }
                UnhookAccounts();
            }
        }

        // ── Etat du compte ──────────────────────────────────────────────────
        // NinjaTrader denomme les devises par une enumeration (UsDollar, Euro...),
        // pas par leur code ISO : sans cette correspondance, TradeDiscipline
        // afficherait « UsDollar » a la place de « $ ».
        private static string IsoCurrency(Currency c)
        {
            switch (c)
            {
                case Currency.UsDollar:         return "USD";
                case Currency.Euro:             return "EUR";
                case Currency.BritishPound:     return "GBP";
                case Currency.SwissFranc:       return "CHF";
                case Currency.AustralianDollar: return "AUD";
                case Currency.CanadianDollar:   return "CAD";
                case Currency.JapaneseYen:      return "JPY";
                default:                        return c.ToString();
            }
        }

        private string BuildAccountJson(Account account)
        {
            if (account == null) return "";

            double balance, equity;
            int openPositions;
            string currency;
            try
            {
                balance = account.Get(AccountItem.CashValue, account.Denomination);
                equity = account.Get(AccountItem.NetLiquidation, account.Denomination);
                openPositions = account.Positions != null ? account.Positions.Count : 0;
                currency = IsoCurrency(account.Denomination);
            }
            catch (Exception ex)
            {
                Print("TradeDiscipline : etat du compte illisible - " + ex.Message);
                return "";
            }

            var sb = new StringBuilder();
            sb.Append("{");
            sb.AppendFormat("\"account\":\"{0}\",", Escape(account.Name));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"balance\":{0},", Num(balance, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"equity\":{0},", Num(equity, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_positions\":{0},", openPositions);
            sb.AppendFormat("\"currency\":\"{0}\",", Escape(currency));
            sb.Append("\"source\":\"ninjatrader\"");
            sb.Append("}");
            return sb.ToString();
        }

        // Envoie l'etat de chaque compte suivi, sans aucun trade.
        private void SendHeartbeat()
        {
            List<Account> accounts;
            lock (_lock) { accounts = new List<Account>(_hooked); }

            foreach (var account in accounts)
            {
                string json = BuildAccountJson(account);
                if (json == "") continue;
                Post("{\"token\":\"" + Escape(SyncToken) + "\",\"account\":" + json + "}",
                     "etat du compte " + account.Name, true);
            }
        }

        private void HookAccounts()
        {
            lock (Account.All)
            {
                foreach (var account in Account.All)
                {
                    // S'abonner AVANT de rejouer l'historique evite de rater une
                    // execution arrivant pendant le seed (dedupe par ExecutionId).
                    account.ExecutionUpdate += OnExecutionUpdate;
                    _hooked.Add(account);
                    SeedFromHistory(account);
                }
            }
        }

        private void UnhookAccounts()
        {
            foreach (var account in _hooked)
                account.ExecutionUpdate -= OnExecutionUpdate;
            _hooked.Clear();
        }

        // Rejoue les executions de la session pour reconstituer les trades passes.
        private void SeedFromHistory(Account account)
        {
            ExecutionCollection executions;
            try { executions = account.Executions; }
            catch { return; }
            if (executions == null) return;

            lock (_lock)
            {
                foreach (Execution ex in executions)
                    Process(ex);
            }
        }

        private void OnExecutionUpdate(object sender, ExecutionEventArgs e)
        {
            if (e == null || e.Execution == null) return;
            lock (_lock)
            {
                Process(e.Execution);
            }
        }

        // Coeur du netting : met a jour la position et poste un trade complet
        // des que la position revient a plat. Identique a la logique serveur testee.
        private void Process(Execution ex)
        {
            if (ex == null || ex.Instrument == null) return;

            string execId = ex.ExecutionId;
            if (string.IsNullOrEmpty(execId) || _processed.Contains(execId)) return;
            _processed.Add(execId);

            string instrument = ex.Instrument.FullName;
            string account = ex.Account != null ? ex.Account.Name : "";
            double pointValue = ex.Instrument.MasterInstrument != null
                ? ex.Instrument.MasterInstrument.PointValue
                : 1.0;

            int qty = ex.Quantity;
            int signed = ex.MarketPosition == MarketPosition.Long ? qty : -qty;
            double commission = -Math.Abs(ex.Commission);

            PosState state;
            _open.TryGetValue(instrument, out state);

            // ── Position a plat → cette execution l'ouvre ───────────────────
            if (state == null)
            {
                _open[instrument] = NewState(ex, instrument, pointValue, signed, qty, commission);
                return;
            }

            int prevNet = state.NetQty;
            bool sameDir = (prevNet > 0 && signed > 0) || (prevNet < 0 && signed < 0);

            if (sameDir)
            {
                int totalQty = Math.Abs(prevNet) + qty;
                state.AvgEntry = (state.AvgEntry * Math.Abs(prevNet) + ex.Price * qty) / totalQty;
                state.NetQty = prevNet + signed;
                state.OpenQty += qty;
                state.Commission += commission;
                return;
            }

            // ── Sens oppose → cloture (et eventuellement inversion) ─────────
            int dirSign = prevNet > 0 ? 1 : -1;
            int closeQty = Math.Min(Math.Abs(prevNet), qty);

            state.RealizedPnl += (ex.Price - state.AvgEntry) * dirSign * closeQty * state.PointValue;
            state.ExitNotional += ex.Price * closeQty;
            state.ExitQty += closeQty;
            state.Commission += commission;
            state.NetQty = prevNet + signed;

            if (state.NetQty == 0)
            {
                PostTrade(state, instrument, ex.Time, account, ex.Account);
                _open.Remove(instrument);
            }
            else if ((prevNet > 0 && state.NetQty < 0) || (prevNet < 0 && state.NetQty > 0))
            {
                // Sur-cloture : ancienne position fermee, le reste ouvre l'opposee.
                PostTrade(state, instrument, ex.Time, account, ex.Account);
                int remainder = qty - closeQty;
                int remSigned = signed > 0 ? remainder : -remainder;
                _open[instrument] = NewState(ex, instrument, pointValue, remSigned, remainder, 0);
            }
            // sinon : cloture partielle, la position reste ouverte.
        }

        private PosState NewState(Execution ex, string instrument, double pointValue, int signedQty, int qty, double commission)
        {
            return new PosState
            {
                NetQty = signedQty,
                AvgEntry = ex.Price,
                OpenQty = qty,
                RealizedPnl = 0,
                Commission = commission,
                ExitNotional = 0,
                ExitQty = 0,
                FirstExecId = ex.ExecutionId,
                OpenTime = ex.Time,
                PointValue = pointValue,
                Direction = signedQty > 0 ? "long" : "short",
            };
        }

        private void PostTrade(PosState s, string instrument, DateTime closeTime, string account, Account accountObj)
        {
            double exitPrice = s.ExitQty > 0 ? s.ExitNotional / s.ExitQty : s.AvgEntry;

            var sb = new StringBuilder();
            sb.Append("{");
            sb.AppendFormat("\"account\":\"{0}\",", Escape(account));
            sb.AppendFormat("\"ticket\":\"{0}\",", Escape(s.FirstExecId));
            sb.AppendFormat("\"symbol\":\"{0}\",", Escape(instrument));
            sb.AppendFormat("\"direction\":\"{0}\",", s.Direction);
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"volume\":{0},", s.OpenQty);
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_price\":{0},", Num(s.AvgEntry, 5));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"close_price\":{0},", Num(exitPrice, 5));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"open_time\":{0},", Unix(s.OpenTime));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"close_time\":{0},", Unix(closeTime));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"profit\":{0},", Num(s.RealizedPnl, 2));
            sb.AppendFormat(CultureInfo.InvariantCulture, "\"commission\":{0},", Num(s.Commission, 2));
            sb.Append("\"swap\":0,\"sl\":null,\"tp\":null,");
            sb.Append("\"source\":\"ninjatrader\"");
            sb.Append("}");

            // L'etat du compte voyage avec le trade : le solde renvoye par le
            // broker l'inclut deja (il est lu apres sa cloture).
            string accountJson = BuildAccountJson(accountObj);
            string body = "{\"token\":\"" + Escape(SyncToken) + "\",\"trade\":" + sb
                          + (accountJson == "" ? "" : ",\"account\":" + accountJson) + "}";
            Post(body, "trade " + s.FirstExecId, false);
        }

        // `isAccountState` : seul un envoi d'etat de compte verifie que le serveur
        // l'a bien applique, et reste silencieux sinon (un envoi par minute).
        private void Post(string body, string label, bool isAccountState)
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
                    string payload;
                    using (var reader = new StreamReader(response.GetResponseStream()))
                        payload = reader.ReadToEnd();

                    if (response.StatusCode != HttpStatusCode.OK)
                        Print("TradeDiscipline ERREUR : " + label + " - HTTP " + (int)response.StatusCode);
                    else if (isAccountState && payload.IndexOf("\"account\":\"ok\"", StringComparison.Ordinal) < 0)
                        Print("TradeDiscipline ATTENTION : solde non pris en compte (" + label +
                              "). Motif renvoye par le serveur : " + payload);
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
                Print("TradeDiscipline ERREUR : " + label + " - " + detail);
            }
            catch (Exception ex)
            {
                Print("TradeDiscipline ERREUR : " + label + " - " + ex.Message);
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
