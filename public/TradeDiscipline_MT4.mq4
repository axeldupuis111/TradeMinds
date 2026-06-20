//+------------------------------------------------------------------+
//|                                      TradeDiscipline_MT4.mq4     |
//|        Synchronise les trades fermes vers TradeDiscipline        |
//+------------------------------------------------------------------+
#property copyright "TradeDiscipline"
#property version   "1.02"
#property strict

// --- Parametres configurables par l'utilisateur ---
extern string SyncToken     = "";                                            // Token (Reglages > Synchronisation MetaTrader)
extern string ApiUrl        = "https://www.tradediscipline.app/api/sync/mt";  // URL de l'API - ne pas modifier
extern int    HistoryDays   = 90;                                             // Jours d'historique a envoyer au demarrage
extern int    CheckSeconds  = 60;                                             // Frequence de verification (secondes)

// --- Etat interne ---
datetime lastCheck = 0;

//+------------------------------------------------------------------+
//| Initialisation                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(SyncToken) < 10)
   {
      Print("TradeDiscipline ERREUR : token manquant ou invalide. ",
            "Renseigne ton token dans l'onglet Donnees d'entree de l'EA.");
      return(INIT_FAILED);
   }

   Print("TradeDiscipline : demarrage. Envoi de l'historique des ",
         HistoryDays, " derniers jours...");

   datetime from = TimeCurrent() - (datetime)HistoryDays * 24 * 60 * 60;
   SendClosedTrades(from);

   lastCheck = TimeCurrent();
   EventSetTimer(CheckSeconds);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Nettoyage                                                        |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Tick : non utilise (l'EA travaille au timer)                     |
//+------------------------------------------------------------------+
void OnTick()
{
   // Volontairement vide : la synchronisation se fait via OnTimer.
}

//+------------------------------------------------------------------+
//| Timer : verification periodique des nouveaux trades fermes       |
//+------------------------------------------------------------------+
void OnTimer()
{
   datetime from = lastCheck - (datetime)5 * 60;
   SendClosedTrades(from);
   lastCheck = TimeCurrent();
}

//+------------------------------------------------------------------+
//| Parcourt l'historique et envoie les ordres fermes                |
//+------------------------------------------------------------------+
void SendClosedTrades(datetime fromTime)
{
   int total    = OrdersHistoryTotal();
   int okCount  = 0;
   int errCount = 0;

   for(int i = 0; i < total; i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY))
         continue;

      // On ne garde que les vrais trades : achats et ventes.
      int orderType = OrderType();
      if(orderType != OP_BUY && orderType != OP_SELL)
         continue;

      // On ne garde que les trades fermes dans la fenetre demandee.
      datetime closeTime = OrderCloseTime();
      if(closeTime == 0)        continue;   // trade encore ouvert
      if(closeTime < fromTime)  continue;   // trop ancien

      int      ticket     = OrderTicket();
      string   symbol     = OrderSymbol();
      double   volume     = OrderLots();
      double   openPrice  = OrderOpenPrice();
      double   closePrice = OrderClosePrice();
      datetime openTime   = OrderOpenTime();
      double   profit     = OrderProfit();
      double   commission = OrderCommission();   // commission totale du trade
      double   swap       = OrderSwap();
      double   sl         = OrderStopLoss();
      double   tp         = OrderTakeProfit();

      string direction = (orderType == OP_BUY) ? "buy" : "sell";

      string json = "{";
      json += "\"account\":\""   + IntegerToString(AccountNumber())  + "\",";
      json += "\"ticket\":"      + IntegerToString(ticket)          + ",";
      json += "\"symbol\":\""    + symbol                            + "\",";
      json += "\"direction\":\"" + direction                         + "\",";
      json += "\"source\":\"mt4\",";
      json += "\"volume\":"      + DoubleToString(volume, 2)         + ",";
      json += "\"open_price\":"  + DoubleToString(openPrice, 5)      + ",";
      json += "\"close_price\":" + DoubleToString(closePrice, 5)     + ",";
      json += "\"open_time\":"   + IntegerToString((long)openTime)   + ",";
      json += "\"close_time\":"  + IntegerToString((long)closeTime)  + ",";
      json += "\"profit\":"      + DoubleToString(profit, 2)         + ",";
      json += "\"commission\":"  + DoubleToString(commission, 2)     + ",";
      json += "\"swap\":"        + DoubleToString(swap, 2)           + ",";
      json += "\"sl\":"          + DoubleToString(sl, 5)             + ",";
      json += "\"tp\":"          + DoubleToString(tp, 5);
      json += "}";

      if(PostTrade(json, ticket))
         okCount++;
      else
         errCount++;
   }

   Print("TradeDiscipline : envoi termine - ", okCount,
         " reussi(s), ", errCount, " echec(s).");
}

//+------------------------------------------------------------------+
//| Envoie un trade (JSON) vers l'API TradeDiscipline                |
//+------------------------------------------------------------------+
bool PostTrade(string tradeJson, int ticket)
{
   string body = "{\"token\":\"" + SyncToken + "\",\"trade\":" + tradeJson + "}";

   char   post[];
   char   result[];
   string headers = "Content-Type: application/json\r\n";
   string resultHeaders;

   int len = StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0 && post[len - 1] == 0)
      ArrayResize(post, len - 1);

   ResetLastError();
   int status = WebRequest("POST", ApiUrl, headers, 5000, post, result, resultHeaders);

   if(status == -1)
   {
      int err = GetLastError();
      Print("TradeDiscipline ERREUR : trade ", ticket,
            " - WebRequest a echoue, code ", err,
            ". Si code 4060 : l'URL n'est pas autorisee (Outils > Options > Expert Advisors).");
      return(false);
   }

   if(status != 200)
   {
      Print("TradeDiscipline ERREUR : trade ", ticket,
            " - le serveur a repondu HTTP ", status,
            " - reponse : ", CharArrayToString(result));
      return(false);
   }

   Print("TradeDiscipline OK : trade ", ticket,
         " - reponse serveur : ", CharArrayToString(result));
   return(true);
}
//+------------------------------------------------------------------+
