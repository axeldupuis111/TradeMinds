//+------------------------------------------------------------------+
//|                                      TradeDiscipline_MT4.mq4     |
//|        Synchronise les trades fermes vers TradeDiscipline        |
//+------------------------------------------------------------------+
//
//  v1.11 - l'EA envoie aussi son heure serveur (server_time). MetaTrader date
//  ses trades en heure SERVEUR du broker : sans cette reference, un compte a
//  GMT+3 voyait ses trades dates 3 h dans le futur, ce qui faisait basculer les
//  trades de fin de seance sur le lendemain (P&L du jour, alerte de perte).
//
//  v1.10 - l'EA envoie desormais l'etat du compte (solde reel, equity, nombre
//  de positions ouvertes) a chaque envoi de trades ET a chaque battement de
//  coeur, meme sans trade ferme. TradeDiscipline affiche donc le vrai solde du
//  broker au lieu de le reconstituer a partir du capital saisi a la main, suit
//  l'equity en direct position ouverte, et voit les depots/retraits.
//
#property copyright "TradeDiscipline"
#property version   "1.11"
#property strict

// --- Parametres configurables par l'utilisateur ---
extern string SyncToken     = "";                                            // Token (Reglages > Synchronisation MetaTrader)
extern string ApiUrl        = "https://www.tradediscipline.app/api/sync/mt";  // URL de l'API - ne pas modifier
extern int    HistoryDays   = 90;                                             // Jours d'historique a envoyer au demarrage
extern int    CheckSeconds  = 60;                                             // Frequence de verification (secondes)
extern bool   SendBalance   = true;                                           // Envoyer le solde reel et l'equity du compte

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

   Print("TradeDiscipline : demarrage (v1.11). Envoi de l'historique des ",
         HistoryDays, " derniers jours...");

   datetime from = TimeCurrent() - (datetime)HistoryDays * 24 * 60 * 60;
   SendClosedTrades(from);

   // Etat du compte des le demarrage : le solde reel s'affiche tout de suite,
   // sans attendre la premiere cloture.
   SendHeartbeat();

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
   bool sent = SendClosedTrades(from);
   lastCheck = TimeCurrent();

   // Battement de coeur : si aucun trade n'est parti, l'etat du compte part
   // quand meme. C'est ce qui fait vivre le solde et l'equity en direct
   // pendant qu'une position est ouverte.
   if(!sent)
      SendHeartbeat();
}

//+------------------------------------------------------------------+
//| Nombre de positions reellement ouvertes (hors ordres en attente) |
//+------------------------------------------------------------------+
int CountOpenPositions()
{
   int open = 0;
   int total = OrdersTotal();
   for(int i = 0; i < total; i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      int type = OrderType();
      if(type == OP_BUY || type == OP_SELL) open++;
   }
   return(open);
}

//+------------------------------------------------------------------+
//| Etat du compte : solde reel, equity, positions ouvertes          |
//| Renvoie le fragment JSON, ou "" si l'envoi du solde est desactive |
//+------------------------------------------------------------------+
string BuildAccountJson()
{
   if(!SendBalance) return("");

   string json  = "{";
   json += "\"account\":\""      + IntegerToString(AccountNumber())      + "\",";
   json += "\"balance\":"        + DoubleToString(AccountBalance(), 2)   + ",";
   json += "\"equity\":"         + DoubleToString(AccountEquity(), 2)    + ",";
   json += "\"open_positions\":" + IntegerToString(CountOpenPositions()) + ",";
   json += "\"currency\":\""     + AccountCurrency()                     + "\",";
   json += "\"source\":\"mt4\"";
   json += "}";
   return(json);
}

//+------------------------------------------------------------------+
//| Envoie l'etat du compte seul (aucun trade)                        |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string account = BuildAccountJson();
   if(account == "") return;

   string body = "{\"token\":\"" + SyncToken + "\",\"server_time\":"
                 + IntegerToString((long)TimeCurrent())
                 + ",\"account\":" + account + "}";

   char   post[];
   char   result[];
   string headers = "Content-Type: application/json\r\n";
   string resultHeaders;

   int len = StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0 && post[len - 1] == 0)
      ArrayResize(post, len - 1);

   ResetLastError();
   int status = WebRequest("POST", ApiUrl, headers, 5000, post, result, resultHeaders);

   // Le battement de coeur est volontairement silencieux quand tout va bien :
   // une ligne de journal par minute rendrait l'onglet Experts illisible.
   if(status == -1)
   {
      Print("TradeDiscipline ERREUR : etat du compte non envoye, code ", GetLastError());
      return;
   }
   if(status != 200)
   {
      Print("TradeDiscipline ERREUR : etat du compte - HTTP ", status,
            " - reponse : ", CharArrayToString(result));
      return;
   }

   string response = CharArrayToString(result);
   if(StringFind(response, "\"account\":\"ok\"") < 0)
      Print("TradeDiscipline ATTENTION : solde non pris en compte - ", response,
            " (verifie que le n° de compte ", AccountNumber(),
            " est bien celui saisi dans l'onglet Comptes).");
}

//+------------------------------------------------------------------+
//| Parcourt l'historique et envoie les ordres fermes                |
//| Renvoie true si au moins une requete est partie (elle porte alors |
//| l'etat du compte, ce qui rend le battement de coeur inutile).     |
//+------------------------------------------------------------------+
bool SendClosedTrades(datetime fromTime)
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

   return(okCount + errCount > 0);
}

//+------------------------------------------------------------------+
//| Envoie un trade (JSON) vers l'API TradeDiscipline                |
//+------------------------------------------------------------------+
bool PostTrade(string tradeJson, int ticket)
{
   // L'etat du compte voyage avec le trade : le solde renvoye par le broker
   // l'inclut deja (il est lu apres sa cloture), donc rien a recalculer.
   string account = BuildAccountJson();
   string body = "{\"token\":\"" + SyncToken + "\",\"server_time\":"
                 + IntegerToString((long)TimeCurrent())
                 + ",\"trade\":" + tradeJson;
   if(account != "") body += ",\"account\":" + account;
   body += "}";

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
