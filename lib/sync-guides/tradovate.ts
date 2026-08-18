import type { GuideContent } from "./types";

// Rail pull Tradovate (API). Seul rail sans logiciel à laisser ouvert.
//
// Réécrit le 2026-08-19. Depuis le partenariat NinjaTrader, le trader se
// connecte avec son seul login dans une fenêtre Tradovate : il n'achète plus
// l'add-on API à environ 25 $/mois et n'a plus besoin d'un compte approvisionné
// à 1 000 $, ce que la plupart des comptes de prop firm ne permettaient pas.
//
// L'ancien guide décrivait ce mur et conseillait même d'aller voir ailleurs
// (« passe plutôt par NinjaTrader ou par l'import CSV »). Il aurait détourné
// exactement les utilisateurs que le partenariat débloque.
//
// Le chemin par clé API reste accessible en lien discret sous le bouton, pour
// les comptes qui ont déjà leur propre clé. Il n'est plus le chemin principal
// et n'est plus décrit en premier.

const guide: GuideContent = {
  fr: {
    before: [
      "Un compte Tradovate, ou un compte de prop firm qui passe par Tradovate (Apex, Topstep et autres).",
      "Rien à acheter : depuis notre partenariat avec NinjaTrader, tu n'as plus besoin de l'add-on API ni d'un compte approvisionné à 1 000 $. Ton login Tradovate suffit.",
      "Rien à installer non plus, et rien à laisser ouvert : la synchro tourne sur nos serveurs toutes les heures.",
      "Nous lisons uniquement tes ordres exécutés et ton solde. Nous ne passons jamais d'ordre, et nous ne voyons jamais ton mot de passe : tu le saisis chez Tradovate, pas chez nous.",
    ],
    steps: [
      {
        title: "Choisis le bon environnement",
        detail:
          "Dans l'encadré « Se connecter avec son login Tradovate », choisis « Live » si tu te connectes d'habitude sur trader.tradovate.com avec un compte réel. Choisis « Démo » si ton compte est un compte de simulation ou d'évaluation. En cas de doute, essaie l'un puis l'autre : une erreur se voit tout de suite.",
      },
      {
        title: "Clique sur « Continuer vers Tradovate »",
        detail:
          "Tu quittes TradeDiscipline et tu arrives sur une page du domaine tradovate.com. C'est normal, et c'est tout l'intérêt : tes identifiants ne transitent jamais par nous.",
        check:
          "L'adresse de la page commence bien par trader.tradovate.com. Si ce n'est pas le cas, ferme l'onglet et recommence depuis les réglages.",
      },
      {
        title: "Identifie-toi et autorise l'accès",
        detail:
          "Saisis ton identifiant et ton mot de passe Tradovate habituels, puis accepte la demande d'autorisation. Elle porte uniquement sur la lecture : compte, positions, exécutions et bibliothèque de contrats.",
        check: "Tradovate te renvoie automatiquement sur TradeDiscipline après l'autorisation.",
      },
      {
        title: "Vérifie que la connexion est active",
        detail:
          "De retour dans les réglages, la nouvelle connexion apparaît dans la liste avec son environnement.",
        check:
          "Le statut affiche « Active » et une date de dernière synchro. Tes trades futures remontent dans « Mes Trades ».",
      },
      {
        title: "Renseigne ta commission par contrat",
        detail:
          "Tradovate ne transmet pas les frais dans ses données : sans cette valeur, ton P&L reste brut et ne collera pas à ton relevé. Indique le coût aller-retour d'un contrat chez ton broker, souvent entre 4 et 5 $ chez les prop firms. Le champ se modifie à tout moment sur la ligne de connexion.",
        check:
          "Sur un trade importé, le net affiché correspond à ton relevé Tradovate, aux arrondis près.",
      },
    ],
    fixes: [
      {
        problem: "Je ne vois pas l'encadré « Se connecter avec son login Tradovate »",
        fix: "Ce rail demande le plan Premium. Si tu l'as déjà, recharge la page : l'encadré n'apparaît que lorsque nos identifiants partenaires sont actifs côté serveur.",
      },
      {
        problem: "L'écran Tradovate affiche une erreur d'application ou refuse de s'ouvrir",
        fix: "Ne recommence pas en boucle, écris-nous. C'est un problème de configuration de notre côté ou du leur, pas de ton compte, et rien dans l'application ne peut le corriger.",
      },
      {
        problem: "La connexion affiche le statut « Erreur »",
        fix: "Le message s'affiche à côté du statut. La cause la plus fréquente est le mauvais environnement : Live au lieu de Démo, ou l'inverse. Supprime la connexion et refais le parcours avec l'autre environnement.",
      },
      {
        problem: "Le statut est « Active » mais aucun trade n'arrive",
        fix: "Le compte connecté n'a pas de trade clôturé sur la période, ou tu as connecté l'environnement qui ne contient pas ton activité. Clique sur « Synchroniser » pour forcer un passage, puis vérifie l'environnement.",
      },
      {
        problem: "La connexion s'est mise en erreur après une longue pause",
        fix: "L'autorisation Tradovate se renouvelle toute seule tant que la synchro tourne. Si la connexion est restée suspendue plus de deux semaines, l'autorisation expire. Supprime-la et refais le parcours : trente secondes.",
      },
      {
        problem: "J'ai changé mon mot de passe Tradovate",
        fix: "Rien à faire. C'est justement l'avantage de ce rail : nous ne stockons pas ton mot de passe, la connexion continue de fonctionner.",
      },
    ],
    notes: [
      "Les autorisations sont chiffrées (AES-256) et ne sont jamais réaffichées.",
      "Tu peux suspendre une connexion à tout moment sans la supprimer : elle cesse de se synchroniser et tes trades déjà importés restent en place.",
      "Si tu possèdes déjà ta propre clé API Tradovate, le lien « Utiliser plutôt une clé API » sous le bouton ouvre l'ancien formulaire.",
    ],
  },

  en: {
    before: [
      "A Tradovate account, or a prop firm account running on Tradovate (Apex, Topstep and others).",
      "Nothing to buy: through our NinjaTrader partnership you no longer need the API add-on or a funded account above $1,000. Your Tradovate login is enough.",
      "Nothing to install either, and nothing to leave running: the sync happens on our servers every hour.",
      "We only read your filled orders and your balance. We never place orders, and we never see your password: you type it on Tradovate, not here.",
    ],
    steps: [
      {
        title: "Pick the right environment",
        detail:
          "In the “Connect with your Tradovate login” box, choose “Live” if you normally sign in at trader.tradovate.com with a real account. Choose “Demo” if yours is a simulation or evaluation account. If unsure, try one then the other: a mistake shows immediately.",
      },
      {
        title: "Click “Continue to Tradovate”",
        detail:
          "You leave TradeDiscipline and land on a page hosted by tradovate.com. That is expected, and it is the whole point: your credentials never pass through us.",
        check:
          "The page address starts with trader.tradovate.com. If it does not, close the tab and start again from settings.",
      },
      {
        title: "Sign in and authorise access",
        detail:
          "Enter your usual Tradovate username and password, then approve the authorisation request. It covers reading only: account, positions, fills and contract library.",
        check: "Tradovate sends you back to TradeDiscipline automatically once you approve.",
      },
      {
        title: "Check the connection is active",
        detail: "Back in settings, the new connection appears in the list with its environment.",
        check:
          "The status reads “Active” with a last sync time. Your futures trades appear under “My Trades”.",
      },
      {
        title: "Set your commission per contract",
        detail:
          "Tradovate does not send fees in its data: without this value your P&L stays gross and will not match your statement. Enter the round-turn cost of one contract at your broker, often between $4 and $5 at prop firms. You can change it any time on the connection row.",
        check:
          "On an imported trade, the net shown matches your Tradovate statement, give or take rounding.",
      },
    ],
    fixes: [
      {
        problem: "I cannot see the “Connect with your Tradovate login” box",
        fix: "This rail requires the Premium plan. If you already have it, reload the page: the box only appears once our partner credentials are active on the server.",
      },
      {
        problem: "The Tradovate screen shows an application error or will not open",
        fix: "Do not retry in a loop, write to us instead. That is a configuration problem on our side or theirs, not on your account, and nothing in the app can fix it.",
      },
      {
        problem: "The connection shows an “Error” status",
        fix: "The message appears next to the status. The most common cause is the wrong environment: Live instead of Demo, or the other way round. Delete the connection and run through it again with the other environment.",
      },
      {
        problem: "Status is “Active” but no trades arrive",
        fix: "The connected account has no closed trade in the period, or you connected the environment that does not hold your activity. Click “Sync” to force a pass, then check the environment.",
      },
      {
        problem: "The connection failed after a long pause",
        fix: "The Tradovate authorisation renews itself as long as the sync runs. If the connection stayed paused for more than two weeks, the authorisation expires. Delete it and run through the flow again: thirty seconds.",
      },
      {
        problem: "I changed my Tradovate password",
        fix: "Nothing to do. That is precisely the advantage of this rail: we do not store your password, and the connection keeps working.",
      },
    ],
    notes: [
      "Authorisations are encrypted (AES-256) and never displayed again.",
      "You can pause a connection at any time without deleting it: it stops syncing and the trades already imported stay in place.",
      "If you already hold your own Tradovate API key, the “Use an API key instead” link under the button opens the previous form.",
    ],
  },

  es: {
    before: [
      "Una cuenta de Tradovate, o una cuenta de prop firm que funcione sobre Tradovate (Apex, Topstep y otras).",
      "Nada que comprar: gracias a nuestro acuerdo con NinjaTrader ya no necesitas el add-on de API ni una cuenta financiada por encima de 1.000 $. Basta con tu login de Tradovate.",
      "Tampoco hay nada que instalar ni que dejar abierto: la sincronización se ejecuta en nuestros servidores cada hora.",
      "Solo leemos tus órdenes ejecutadas y tu saldo. Nunca enviamos órdenes y nunca vemos tu contraseña: la escribes en Tradovate, no aquí.",
    ],
    steps: [
      {
        title: "Elige el entorno correcto",
        detail:
          "En el recuadro « Conectar con tu login de Tradovate », elige « Live » si entras normalmente en trader.tradovate.com con una cuenta real. Elige « Demo » si la tuya es una cuenta de simulación o de evaluación. Si dudas, prueba una y luego la otra: el error se ve al instante.",
      },
      {
        title: "Pulsa « Continuar a Tradovate »",
        detail:
          "Sales de TradeDiscipline y llegas a una página del dominio tradovate.com. Es lo esperado, y es justamente el objetivo: tus credenciales nunca pasan por nosotros.",
        check:
          "La dirección de la página empieza por trader.tradovate.com. Si no es así, cierra la pestaña y vuelve a empezar desde los ajustes.",
      },
      {
        title: "Identifícate y autoriza el acceso",
        detail:
          "Introduce tu usuario y contraseña habituales de Tradovate y acepta la solicitud de autorización. Cubre únicamente la lectura: cuenta, posiciones, ejecuciones y biblioteca de contratos.",
        check: "Tradovate te devuelve automáticamente a TradeDiscipline tras la autorización.",
      },
      {
        title: "Comprueba que la conexión está activa",
        detail: "De vuelta en los ajustes, la nueva conexión aparece en la lista con su entorno.",
        check:
          "El estado indica « Activa » y una hora de última sincronización. Tus operaciones de futuros aparecen en « Mis Trades ».",
      },
      {
        title: "Indica tu comisión por contrato",
        detail:
          "Tradovate no transmite las comisiones en sus datos: sin este valor tu P&L queda en bruto y no cuadrará con tu extracto. Indica el coste de ida y vuelta de un contrato en tu broker, a menudo entre 4 y 5 $ en las prop firms. Puedes cambiarlo en cualquier momento en la línea de la conexión.",
        check:
          "En una operación importada, el neto mostrado coincide con tu extracto de Tradovate, salvo redondeos.",
      },
    ],
    fixes: [
      {
        problem: "No veo el recuadro « Conectar con tu login de Tradovate »",
        fix: "Este canal requiere el plan Premium. Si ya lo tienes, recarga la página: el recuadro solo aparece cuando nuestras credenciales de socio están activas en el servidor.",
      },
      {
        problem: "La pantalla de Tradovate muestra un error de aplicación o no abre",
        fix: "No lo reintentes en bucle, escríbenos. Es un problema de configuración por nuestra parte o por la suya, no de tu cuenta, y no puedes resolverlo desde la aplicación.",
      },
      {
        problem: "La conexión muestra el estado « Error »",
        fix: "El mensaje aparece junto al estado. La causa más frecuente es el entorno equivocado: Live en lugar de Demo, o al revés. Borra la conexión y repite el proceso con el otro entorno.",
      },
      {
        problem: "El estado es « Activa » pero no llega ninguna operación",
        fix: "La cuenta conectada no tiene operaciones cerradas en el periodo, o conectaste el entorno que no contiene tu actividad. Pulsa « Sincronizar » para forzar una pasada y revisa el entorno.",
      },
      {
        problem: "La conexión falló tras una pausa larga",
        fix: "La autorización de Tradovate se renueva sola mientras la sincronización funcione. Si la conexión estuvo pausada más de dos semanas, la autorización caduca. Bórrala y repite el proceso: treinta segundos.",
      },
      {
        problem: "He cambiado mi contraseña de Tradovate",
        fix: "Nada que hacer. Es precisamente la ventaja de este canal: no guardamos tu contraseña y la conexión sigue funcionando.",
      },
    ],
    notes: [
      "Las autorizaciones están cifradas (AES-256) y nunca se vuelven a mostrar.",
      "Puedes pausar una conexión en cualquier momento sin borrarla: deja de sincronizar y las operaciones ya importadas se mantienen.",
      "Si ya tienes tu propia clave API de Tradovate, el enlace « Usar una clave API en su lugar » bajo el botón abre el formulario anterior.",
    ],
  },

  de: {
    before: [
      "Ein Tradovate-Konto oder ein Prop-Firm-Konto, das über Tradovate läuft (Apex, Topstep und andere).",
      "Nichts zu kaufen: dank unserer NinjaTrader-Partnerschaft brauchst du weder das API-Add-on noch ein Konto mit mehr als 1.000 $. Dein Tradovate-Login genügt.",
      "Auch nichts zu installieren und nichts offen zu lassen: die Synchronisierung läuft stündlich auf unseren Servern.",
      "Wir lesen ausschließlich deine ausgeführten Orders und deinen Kontostand. Wir platzieren nie Orders und sehen nie dein Passwort: du gibst es bei Tradovate ein, nicht bei uns.",
    ],
    steps: [
      {
        title: "Wähle die richtige Umgebung",
        detail:
          "Wähle im Feld « Mit deinem Tradovate-Login verbinden » die Option « Live », wenn du dich normalerweise mit einem echten Konto bei trader.tradovate.com anmeldest. Wähle « Demo », wenn es ein Simulations- oder Evaluierungskonto ist. Im Zweifel probiere erst das eine, dann das andere: ein Fehler zeigt sich sofort.",
      },
      {
        title: "Klicke auf « Weiter zu Tradovate »",
        detail:
          "Du verlässt TradeDiscipline und landest auf einer Seite der Domain tradovate.com. Das ist so gewollt und genau der Punkt: deine Zugangsdaten laufen nie über uns.",
        check:
          "Die Adresse der Seite beginnt mit trader.tradovate.com. Falls nicht, schließe den Tab und beginne erneut in den Einstellungen.",
      },
      {
        title: "Melde dich an und erteile die Freigabe",
        detail:
          "Gib deinen gewohnten Tradovate-Benutzernamen und dein Passwort ein und bestätige die Freigabe. Sie umfasst ausschließlich Lesezugriff: Konto, Positionen, Ausführungen und Kontraktbibliothek.",
        check: "Tradovate leitet dich nach der Freigabe automatisch zu TradeDiscipline zurück.",
      },
      {
        title: "Prüfe, ob die Verbindung aktiv ist",
        detail:
          "Zurück in den Einstellungen erscheint die neue Verbindung mit ihrer Umgebung in der Liste.",
        check:
          "Der Status lautet « Aktiv » und zeigt eine letzte Synchronisierung. Deine Futures-Trades erscheinen unter « Meine Trades ».",
      },
      {
        title: "Trage deine Kommission pro Kontrakt ein",
        detail:
          "Tradovate übermittelt keine Gebühren: ohne diesen Wert bleibt dein P&L brutto und passt nicht zu deiner Abrechnung. Trage die Round-Turn-Kosten eines Kontrakts bei deinem Broker ein, bei Prop Firms oft zwischen 4 und 5 $. Der Wert lässt sich jederzeit in der Verbindungszeile ändern.",
        check:
          "Bei einem importierten Trade entspricht der angezeigte Nettowert deiner Tradovate-Abrechnung, bis auf Rundungen.",
      },
    ],
    fixes: [
      {
        problem: "Ich sehe das Feld « Mit deinem Tradovate-Login verbinden » nicht",
        fix: "Dieser Weg erfordert den Premium-Plan. Wenn du ihn bereits hast, lade die Seite neu: das Feld erscheint erst, wenn unsere Partner-Zugangsdaten serverseitig aktiv sind.",
      },
      {
        problem: "Der Tradovate-Bildschirm zeigt einen Anwendungsfehler oder öffnet nicht",
        fix: "Versuche es nicht in Schleife, schreib uns. Das ist ein Konfigurationsproblem auf unserer oder ihrer Seite, nicht bei deinem Konto, und in der App lässt sich nichts daran ändern.",
      },
      {
        problem: "Die Verbindung zeigt den Status « Fehler »",
        fix: "Die Meldung steht neben dem Status. Häufigste Ursache ist die falsche Umgebung: Live statt Demo oder umgekehrt. Lösche die Verbindung und durchlaufe den Vorgang mit der anderen Umgebung erneut.",
      },
      {
        problem: "Der Status ist « Aktiv », aber es kommen keine Trades an",
        fix: "Das verbundene Konto hat im Zeitraum keinen geschlossenen Trade, oder du hast die Umgebung verbunden, die deine Aktivität nicht enthält. Klicke auf « Synchronisieren », um einen Durchlauf zu erzwingen, und prüfe die Umgebung.",
      },
      {
        problem: "Die Verbindung ist nach einer langen Pause fehlgeschlagen",
        fix: "Die Tradovate-Freigabe erneuert sich selbst, solange die Synchronisierung läuft. War die Verbindung länger als zwei Wochen pausiert, läuft die Freigabe ab. Lösche sie und durchlaufe den Vorgang erneut: dreißig Sekunden.",
      },
      {
        problem: "Ich habe mein Tradovate-Passwort geändert",
        fix: "Nichts zu tun. Genau das ist der Vorteil dieses Wegs: wir speichern dein Passwort nicht, und die Verbindung funktioniert weiter.",
      },
    ],
    notes: [
      "Die Freigaben sind verschlüsselt (AES-256) und werden nie erneut angezeigt.",
      "Du kannst eine Verbindung jederzeit pausieren, ohne sie zu löschen: sie synchronisiert nicht mehr, und bereits importierte Trades bleiben erhalten.",
      "Wenn du bereits einen eigenen Tradovate-API-Schlüssel besitzt, öffnet der Link « Stattdessen einen API-Schlüssel verwenden » unter der Schaltfläche das bisherige Formular.",
    ],
  },
};

export default guide;
