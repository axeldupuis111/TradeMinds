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
                PostTrade(state, instrument, ex.Time);
                _open.Remove(instrument);
            }
            else if ((prevNet > 0 && state.NetQty < 0) || (prevNet < 0 && state.NetQty > 0))
            {
                // Sur-cloture : ancienne position fermee, le reste ouvre l'opposee.
                PostTrade(state, instrument, ex.Time);
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

        private void PostTrade(PosState s, string instrument, DateTime closeTime)
        {
            double exitPrice = s.ExitQty > 0 ? s.ExitNotional / s.ExitQty : s.AvgEntry;

            var sb = new StringBuilder();
            sb.Append("{");
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

            string body = "{\"token\":\"" + Escape(SyncToken) + "\",\"trade\":" + sb + "}";
            Post(body, s.FirstExecId);
        }

        private void Post(string body, string id)
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
                    if (response.StatusCode != HttpStatusCode.OK)
                        Print("TradeDiscipline ERREUR : trade " + id + " - HTTP " + (int)response.StatusCode);
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
            }
            catch (Exception ex)
            {
                Print("TradeDiscipline ERREUR : trade " + id + " - " + ex.Message);
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
