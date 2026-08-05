//+------------------------------------------------------------------+
//|                                          TradeDiscipline.mq5     |
//|        Synchronise les trades fermes vers TradeDiscipline        |
//+------------------------------------------------------------------+
//
//  v1.23 - chaque erreur dit desormais QUOI FAIRE, pas seulement un code. Une
//  partenaire a vu "code 4014" repete chaque minute sans pouvoir deviner qu'il
//  s'agissait de l'URL a autoriser dans Outils > Options. L'adresse a coller
//  est deduite de ApiUrl, donc le message ne peut pas se desynchroniser du code.
//
//  v1.21 - l'EA envoie aussi son heure serveur (server_time). MetaTrader date
//  ses trades en heure SERVEUR du broker : sans cette reference, un compte a
//  GMT+3 voyait ses trades dates 3 h dans le futur, ce qui faisait basculer les
//  trades de fin de seance sur le lendemain (P&L du jour, alerte de perte).
//
//  v1.20 - l'EA envoie desormais l'etat du compte (solde reel, equity, nombre
//  de positions ouvertes) a chaque envoi de trades ET a chaque battement de
//  coeur, meme sans trade ferme. TradeDiscipline affiche donc le vrai solde du
//  broker au lieu de le reconstituer a partir du capital saisi a la main, suit
//  l'equity en direct position ouverte, et voit les depots/retraits.
//
//  v1.10 - correctif majeur : un trade ouvert il y a plusieurs heures et
//  ferme a l'instant n'etait plus envoye correctement. L'EA ne chargeait que
//  la fenetre recente de l'historique, donc le deal d'OUVERTURE (prix, heure)
//  restait introuvable et le serveur refusait le trade en silence.
//  Desormais chaque position est rechargee entierement (HistorySelectByPosition)
//  et tous ses deals sont agreges : clotures partielles comprises.
//
#property copyright "TradeDiscipline"
#property version   "1.23"
#property strict

// --- Parametres configurables par l'utilisateur ---
input string SyncToken     = "";                                            // Token (Reglages > Synchronisation MetaTrader)
input string ApiUrl        = "https://www.tradediscipline.app/api/sync/mt";  // URL de l'API - ne pas modifier
input int    HistoryDays   = 90;                                             // Jours d'historique a envoyer au demarrage
input int    CheckSeconds  = 60;                                             // Frequence de verification (secondes)
input int    BatchSize     = 50;                                             // Trades envoyes par requete
input bool   SendBalance   = true;                                           // Envoyer le solde reel et l'equity du compte

// --- Etat interne ---
datetime lastCheck = 0;

//+------------------------------------------------------------------+
//| Adresse a coller dans la liste des URL autorisees.                |
//| Deduite de ApiUrl : le message dit donc EXACTEMENT quoi copier,   |
//| meme si l'adresse de l'API change un jour.                        |
//| "https://hote/chemin" -> "https://hote"                           |
//+------------------------------------------------------------------+
string AllowedUrlToPaste()
{
   int scheme = StringFind(ApiUrl, "://");
   if(scheme < 0) return(ApiUrl);
   int slash = StringFind(ApiUrl, "/", scheme + 3);
   if(slash < 0) return(ApiUrl);
   return(StringSubstr(ApiUrl, 0, slash));
}

//+------------------------------------------------------------------+
//| Traduit un echec reseau en consigne actionnable.                  |
//| Un code brut comme "4014" n'aide personne : ce qui manque au      |
//| trader, c'est la manipulation a faire, pas le numero.             |
//+------------------------------------------------------------------+
string NetworkErrorHint(int err)
{
   if(err == 4014)
      return("CAUSE : MetaTrader bloque la connexion car l'adresse n'est pas autorisee. " +
             "A FAIRE : menu Outils > Options > onglet Conseillers Experts. " +
             "Coche \"Autoriser les WebRequest pour les URL listees\", puis double-clique " +
             "sur la ligne vide de la liste et colle EXACTEMENT : " + AllowedUrlToPaste() + " " +
             "(avec le www, sans barre oblique a la fin, sans /api). " +
             "Verifie aussi que le bouton \"Trading Algo\" de la barre d'outils est actif. " +
             "Ensuite retire l'EA du graphique et remets-le.");
   if(err == 5200)
      return("CAUSE : l'adresse de l'API est mal formee. " +
             "A FAIRE : dans les Donnees d'entree de l'EA, remets ApiUrl a sa valeur d'origine.");
   if(err == 5201)
      return("CAUSE : impossible de joindre le serveur. " +
             "A FAIRE : verifie ta connexion Internet, puis un pare-feu ou un antivirus " +
             "qui bloquerait MetaTrader. Les trades seront renvoyes au prochain passage.");
   if(err == 5202)
      return("CAUSE : le serveur a mis trop de temps a repondre. " +
             "A FAIRE : rien, c'est temporaire. Les trades repartiront au prochain passage.");
   if(err == 5203)
      return("CAUSE : la requete a echoue. " +
             "A FAIRE : si cela se repete, verifie l'URL autorisee dans Outils > Options > " +
             "Conseillers Experts : elle doit etre exactement " + AllowedUrlToPaste());
   return("A FAIRE : note ce code et contacte le support depuis l'application.");
}

//+------------------------------------------------------------------+
//| Traduit un code HTTP en consigne actionnable.                     |
//+------------------------------------------------------------------+
string HttpErrorHint(int status)
{
   if(status == 401 || status == 403)
      return("CAUSE : ton token est invalide ou n'est plus valable. " +
             "A FAIRE : recopie-le depuis Reglages dans l'application, puis colle-le dans " +
             "les Donnees d'entree de l'EA, sans espace avant ni apres.");
   if(status == 404 || status == 405)
      return("CAUSE : l'adresse utilisee n'est pas la bonne, en general parce qu'elle a ete " +
             "saisie sans le www et que le site redirige. " +
             "A FAIRE : dans Outils > Options > Conseillers Experts, l'adresse autorisee doit " +
             "etre exactement " + AllowedUrlToPaste());
   if(status == 429)
      return("CAUSE : trop d'envois en peu de temps. " +
             "A FAIRE : rien, l'envoi reprendra tout seul.");
   if(status >= 500)
      return("CAUSE : panne momentanee de notre cote, ce n'est pas ton installation. " +
             "A FAIRE : rien, les trades seront renvoyes automatiquement.");
   return("A FAIRE : note ce code et contacte le support depuis l'application.");
}

//+------------------------------------------------------------------+
//| Initialisation                                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(SyncToken) < 10)
   {
      Print("TradeDiscipline ERREUR : aucun token valide. ",
            "A FAIRE : ouvre Reglages dans l'application, clique sur Copier a cote du token, ",
            "puis fais un clic droit sur le graphique > Liste des Expert Advisors > Proprietes > ",
            "onglet Donnees d'entree, et colle-le sur la ligne SyncToken (sans espace avant ni apres).");
      return(INIT_FAILED);
   }

   Print("TradeDiscipline : demarrage (v1.23). Envoi de l'historique des ",
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
   // Fenetre de detection des CLOTURES uniquement : les deals d'ouverture,
   // eux, sont recharges position par position (voir BuildTradeJson).
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
//| Etat du compte : solde reel, equity, positions ouvertes          |
//| Renvoie le fragment JSON, ou "" si l'envoi du solde est desactive |
//+------------------------------------------------------------------+
string BuildAccountJson()
{
   if(!SendBalance) return("");

   string json  = "{";
   json += "\"account\":\""  + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))       + "\",";
   json += "\"balance\":"    + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2)    + ",";
   json += "\"equity\":"     + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2)     + ",";
   json += "\"open_positions\":" + IntegerToString(PositionsTotal())                    + ",";
   json += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY)                      + "\",";
   json += "\"source\":\"mt5\"";
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
   int status = WebRequest("POST", ApiUrl, headers, 10000, post, result, resultHeaders);

   // Le battement de coeur est volontairement silencieux quand tout va bien :
   // une ligne de journal par minute rendrait l'onglet Experts illisible.
   if(status == -1)
   {
      int err = GetLastError();
      Print("TradeDiscipline ERREUR : le solde du compte n'a pas pu etre envoye (code ", err, "). ",
            NetworkErrorHint(err));
      return;
   }
   if(status != 200)
   {
      Print("TradeDiscipline ERREUR : le solde du compte a ete refuse (HTTP ", status, "). ",
            HttpErrorHint(status), " Reponse du serveur : ", CharArrayToString(result));
      return;
   }

   string response = CharArrayToString(result);
   if(StringFind(response, "\"account\":\"ok\"") < 0)
      Print("TradeDiscipline ATTENTION : tes trades passent bien, mais le solde du compte ",
            AccountInfoInteger(ACCOUNT_LOGIN), " n'a pas ete pris en compte. ",
            "A FAIRE : dans l'application, onglet Comptes, verifie qu'un compte porte ce numero ",
            "exact. Motif renvoye par le serveur : ", response);
}

//+------------------------------------------------------------------+
//| Ajoute un id de position dans le tableau s'il n'y est pas deja    |
//+------------------------------------------------------------------+
void AddUniquePosition(long &list[], long positionId)
{
   int n = ArraySize(list);
   for(int i = 0; i < n; i++)
      if(list[i] == positionId)
         return;

   ArrayResize(list, n + 1);
   list[n] = positionId;
}

//+------------------------------------------------------------------+
//| Parcourt l'historique et envoie les positions fermees            |
//| Renvoie true si au moins une requete est partie (elle porte alors |
//| l'etat du compte, ce qui rend le battement de coeur inutile).     |
//+------------------------------------------------------------------+
bool SendClosedTrades(datetime fromTime)
{
   // +1 h de marge : l'heure serveur du broker peut devancer TimeCurrent().
   if(!HistorySelect(fromTime, TimeCurrent() + 3600))
   {
      Print("TradeDiscipline ERREUR : MetaTrader n'a pas pu charger ton historique. ",
            "A FAIRE : dans l'onglet Historique en bas de MetaTrader, fais un clic droit et ",
            "choisis une periode qui couvre au moins ", HistoryDays, " jours, puis retire l'EA ",
            "du graphique et remets-le.");
      return(false);
   }

   // --- Passe 1 : reperer les positions ayant un deal de cloture ---
   long positions[];
   ArrayResize(positions, 0);

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;

      long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY && entry != DEAL_ENTRY_INOUT)
         continue;

      long positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(positionId <= 0) continue;

      AddUniquePosition(positions, positionId);
   }

   int count = ArraySize(positions);
   if(count == 0) return(false);

   // --- Passe 2 : reconstruire chaque trade complet et l'envoyer par lots ---
   // ATTENTION : BuildTradeJson appelle HistorySelectByPosition, ce qui remplace
   // l'historique charge. La passe 1 doit donc etre entierement terminee avant.
   string batch  = "";
   int batchCount = 0;
   int okCount    = 0;
   int errCount   = 0;
   int ignored    = 0;

   for(int p = 0; p < count; p++)
   {
      string json = "";
      if(!BuildTradeJson(positions[p], json))
      {
         ignored++;
         continue;
      }

      if(batchCount > 0) batch += ",";
      batch += json;
      batchCount++;

      if(batchCount >= BatchSize)
      {
         if(PostTrades(batch, batchCount)) okCount += batchCount;
         else                              errCount += batchCount;
         batch = "";
         batchCount = 0;
      }
   }

   if(batchCount > 0)
   {
      if(PostTrades(batch, batchCount)) okCount += batchCount;
      else                              errCount += batchCount;
   }

   if(errCount > 0)
      Print("TradeDiscipline : envoi termine - ", okCount, " envoye(s), ", errCount, " echec(s), ",
            ignored, " position(s) encore ouverte(s) ou incomplete(s). ",
            "La cause et la marche a suivre sont dans la ligne ERREUR juste au-dessus.");
   else
      Print("TradeDiscipline : envoi termine - ", okCount, " envoye(s), ", errCount, " echec(s), ",
            ignored, " position(s) encore ouverte(s) ou incomplete(s).");

   return(okCount + errCount > 0);
}

//+------------------------------------------------------------------+
//| Reconstruit un trade complet a partir de TOUS les deals d'une    |
//| position (ouvertures multiples, clotures partielles comprises).  |
//| Renvoie false si la position n'est pas entierement fermee.       |
//+------------------------------------------------------------------+
bool BuildTradeJson(long positionId, string &json)
{
   // La position est-elle encore ouverte ? On attend sa cloture complete.
   if(PositionSelectByTicket((ulong)positionId))
      return(false);

   // Recharge TOUS les deals de cette position, quelle que soit leur date :
   // c'est ce qui manquait avant et qui faisait perdre le prix d'ouverture.
   if(!HistorySelectByPosition((ulong)positionId))
      return(false);

   double   inVolume = 0, inNotional  = 0;
   double   outVolume = 0, outNotional = 0;
   double   profit = 0, commission = 0, swap = 0;
   double   sl = 0, tp = 0;
   datetime openTime = 0, closeTime = 0;
   string   symbol = "";
   long     openType = -1;

   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID) != positionId) continue;

      long dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
      // Ignore les operations de solde/credit/commission agregee.
      if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) continue;

      long     entry  = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
      double   volume = HistoryDealGetDouble(dealTicket,  DEAL_VOLUME);
      double   price  = HistoryDealGetDouble(dealTicket,  DEAL_PRICE);
      datetime dtime  = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);

      profit     += HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      commission += HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
      swap       += HistoryDealGetDouble(dealTicket, DEAL_SWAP);

      if(symbol == "") symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);

      if(entry == DEAL_ENTRY_IN)
      {
         inVolume   += volume;
         inNotional += price * volume;
         if(openType < 0)                 openType = dealType;
         if(openTime == 0 || dtime < openTime) openTime = dtime;
      }
      else
      {
         // OUT, OUT_BY et INOUT ferment l'exposition en cours.
         outVolume   += volume;
         outNotional += price * volume;
         if(dtime > closeTime) closeTime = dtime;

         double dealSl = HistoryDealGetDouble(dealTicket, DEAL_SL);
         double dealTp = HistoryDealGetDouble(dealTicket, DEAL_TP);
         if(dealSl > 0) sl = dealSl;
         if(dealTp > 0) tp = dealTp;
      }
   }

   // Trade incomplet (ouverture hors historique du broker, position partielle) :
   // on ne l'envoie pas plutot que d'envoyer des donnees fausses.
   if(inVolume <= 0 || outVolume <= 0)          return(false);
   if(openTime == 0 || closeTime == 0)          return(false);
   if(openType < 0 || symbol == "")             return(false);
   if(outVolume < inVolume - 0.0000001)         return(false); // cloture partielle en cours

   double openPrice  = inNotional  / inVolume;
   double closePrice = outNotional / outVolume;
   string direction  = (openType == DEAL_TYPE_BUY) ? "buy" : "sell";

   json  = "{";
   json += "\"account\":\""   + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"ticket\":"      + IntegerToString(positionId)     + ",";
   json += "\"symbol\":\""    + symbol                          + "\",";
   json += "\"direction\":\"" + direction                       + "\",";
   json += "\"source\":\"mt5\",";
   json += "\"volume\":"      + DoubleToString(inVolume, 2)     + ",";
   json += "\"open_price\":"  + DoubleToString(openPrice, 5)    + ",";
   json += "\"close_price\":" + DoubleToString(closePrice, 5)   + ",";
   json += "\"open_time\":"   + IntegerToString((long)openTime) + ",";
   json += "\"close_time\":"  + IntegerToString((long)closeTime)+ ",";
   json += "\"profit\":"      + DoubleToString(profit, 2)       + ",";
   json += "\"commission\":"  + DoubleToString(commission, 2)   + ",";
   json += "\"swap\":"        + DoubleToString(swap, 2)         + ",";
   json += "\"sl\":"          + DoubleToString(sl, 5)           + ",";
   json += "\"tp\":"          + DoubleToString(tp, 5);
   json += "}";

   return(true);
}

//+------------------------------------------------------------------+
//| Envoie un lot de trades (JSON) vers l'API TradeDiscipline        |
//+------------------------------------------------------------------+
bool PostTrades(string tradesJson, int tradeCount)
{
   // L'etat du compte voyage avec les trades : le solde renvoye par le broker
   // les inclut deja (il est lu apres leur cloture), donc rien a recalculer.
   string account = BuildAccountJson();
   string body = "{\"token\":\"" + SyncToken + "\",\"server_time\":"
                 + IntegerToString((long)TimeCurrent())
                 + ",\"trades\":[" + tradesJson + "]";
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
   int status = WebRequest("POST", ApiUrl, headers, 10000, post, result, resultHeaders);

   if(status == -1)
   {
      int err = GetLastError();
      Print("TradeDiscipline ERREUR : ", tradeCount, " trade(s) n'ont pas pu etre envoyes (code ",
            err, "). ", NetworkErrorHint(err));
      return(false);
   }

   string response = CharArrayToString(result);

   if(status != 200)
   {
      Print("TradeDiscipline ERREUR : ", tradeCount, " trade(s) refuses (HTTP ", status, "). ",
            HttpErrorHint(status), " Reponse du serveur : ", response);
      return(false);
   }

   // Un 200 ne suffit pas : le serveur peut avoir refuse des trades.
   // On rend le motif visible au lieu de le perdre en silence.
   if(StringFind(response, "\"skipped\":0") < 0)
      Print("TradeDiscipline ATTENTION : des trades ont ete refuses - ", response);
   else
      Print("TradeDiscipline OK : ", tradeCount, " trade(s) - reponse serveur : ", response);

   return(true);
}
//+------------------------------------------------------------------+
