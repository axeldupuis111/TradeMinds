//+------------------------------------------------------------------+
//|                                          TradeDiscipline.mq5     |
//|        Synchronise les trades fermes vers TradeDiscipline        |
//+------------------------------------------------------------------+
#property copyright "TradeDiscipline"
#property version   "1.06"
#property strict

// --- Parametres configurables par l'utilisateur ---
input string SyncToken     = "";                                            // Token (Reglages > Synchronisation MetaTrader)
input string ApiUrl        = "https://www.tradediscipline.app/api/sync/mt";  // URL de l'API - ne pas modifier
input int    HistoryDays   = 90;                                             // Jours d'historique a envoyer au demarrage
input int    CheckSeconds  = 60;                                             // Frequence de verification (secondes)

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
//| Parcourt l'historique et envoie les deals de cloture             |
//+------------------------------------------------------------------+
void SendClosedTrades(datetime fromTime)
{
   if(!HistorySelect(fromTime, TimeCurrent()))
   {
      Print("TradeDiscipline ERREUR : impossible de charger l'historique.");
      return;
   }

   int total   = HistoryDealsTotal();
   int okCount  = 0;
   int errCount = 0;

   for(int i = 0; i < total; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

      long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT) continue;

      string   symbol      = HistoryDealGetString(dealTicket,  DEAL_SYMBOL);
      double   volume      = HistoryDealGetDouble(dealTicket,  DEAL_VOLUME);
      double   closePrice  = HistoryDealGetDouble(dealTicket,  DEAL_PRICE);
      double   profit      = HistoryDealGetDouble(dealTicket,  DEAL_PROFIT);
      double   closeComm   = HistoryDealGetDouble(dealTicket,  DEAL_COMMISSION);
      double   swap        = HistoryDealGetDouble(dealTicket,  DEAL_SWAP);
      datetime closeTime   = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      long     positionId  = HistoryDealGetInteger(dealTicket,  DEAL_POSITION_ID);

      // SL/TP de la position au moment de la cloture (deal de sortie).
      double   sl          = HistoryDealGetDouble(dealTicket,  DEAL_SL);
      double   tp          = HistoryDealGetDouble(dealTicket,  DEAL_TP);

      long dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      string direction = (dealType == DEAL_TYPE_SELL) ? "buy" : "sell";

      // --- Donnees du deal d'ouverture (prix, heure, commission) ---
      double   openPrice = 0;
      datetime openTime  = 0;
      double   openComm  = 0;
      FindOpenDeal(positionId, openPrice, openTime, openComm);

      // Commission totale du trade = commission ouverture + commission cloture.
      double commission = openComm + closeComm;

      string json = "{";
      json += "\"account\":\""   + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
      json += "\"ticket\":"      + IntegerToString(positionId)      + ",";
      json += "\"symbol\":\""    + symbol                            + "\",";
      json += "\"direction\":\"" + direction                         + "\",";
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

      if(PostTrade(json, positionId))
         okCount++;
      else
         errCount++;
   }

   Print("TradeDiscipline : envoi termine - ", okCount,
         " reussi(s), ", errCount, " echec(s).");
}

//+------------------------------------------------------------------+
//| Retrouve le deal d'ouverture (prix, heure, commission)           |
//+------------------------------------------------------------------+
void FindOpenDeal(long positionId, double &openPrice, datetime &openTime,
                  double &openComm)
{
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong t = HistoryDealGetTicket(i);
      if(t == 0) continue;
      if(HistoryDealGetInteger(t, DEAL_POSITION_ID) != positionId) continue;
      if(HistoryDealGetInteger(t, DEAL_ENTRY) != DEAL_ENTRY_IN)     continue;

      openPrice = HistoryDealGetDouble(t, DEAL_PRICE);
      openTime  = (datetime)HistoryDealGetInteger(t, DEAL_TIME);
      openComm  = HistoryDealGetDouble(t, DEAL_COMMISSION);
      return;
   }
}

//+------------------------------------------------------------------+
//| Envoie un trade (JSON) vers l'API TradeDiscipline                |
//+------------------------------------------------------------------+
bool PostTrade(string tradeJson, long positionId)
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
      Print("TradeDiscipline ERREUR : trade ", positionId,
            " - WebRequest a echoue, code ", err,
            ". Si code 4014 : l'URL n'est pas autorisee (Outils > Options > Expert Advisors).");
      return(false);
   }

   if(status != 200)
   {
      Print("TradeDiscipline ERREUR : trade ", positionId,
            " - le serveur a repondu HTTP ", status,
            " - reponse : ", CharArrayToString(result));
      return(false);
   }

   Print("TradeDiscipline OK : trade ", positionId,
         " - reponse serveur : ", CharArrayToString(result));
   return(true);
}
//+------------------------------------------------------------------+
