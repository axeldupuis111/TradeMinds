import type { GuideContent } from "./types";

// Rail pull Tradovate (API). Seul rail sans logiciel à laisser ouvert, mais le
// seul aussi à demander une clé API : c'est le point qui bloque, d'autant que
// certaines prop firms ne l'activent pas sur leurs comptes.

const guide: GuideContent = {
  fr: {
    before: [
      "Un compte Tradovate, ou un compte de prop firm qui passe par Tradovate (Apex, Topstep et autres).",
      "L'accès API doit être activé sur ce compte : c'est ce qui fournit la clé (cid) et le secret (sec). Toutes les prop firms ne l'autorisent pas.",
      "Avantage de ce rail : rien à installer et rien à laisser ouvert, la synchro tourne sur nos serveurs toutes les heures.",
    ],
    steps: [
      {
        title: "Récupère ta clé API chez Tradovate",
        detail:
          "Connecte-toi sur trader.tradovate.com, ouvre les paramètres de l'application et cherche la section « API Access ». Génère une clé : Tradovate affiche une clé (« key », que nous appelons cid) et un secret (« secret », que nous appelons sec). Copie les deux.",
        check:
          "Tu as bien deux valeurs distinctes sous les yeux. Le secret n'est en général affiché qu'une fois : garde-le de côté avant de fermer la page.",
      },
      {
        title: "Ouvre le formulaire de connexion",
        detail: "Clique sur « Connecter Tradovate » au-dessus de ce guide.",
      },
      {
        title: "Donne un nom à la connexion",
        detail:
          "Le champ « Nom de la connexion » sert uniquement à t'y retrouver si tu connectes plusieurs comptes. Par exemple : Apex 50k, ou Compte perso.",
      },
      {
        title: "Choisis le bon environnement",
        detail:
          "Choisis « Live » si tu te connectes normalement sur trader.tradovate.com avec un compte réel. Choisis « Démo » si ton compte est un compte de simulation ou d'évaluation. En cas de doute, essaie l'un puis l'autre : une erreur d'environnement se voit tout de suite au statut de la connexion.",
      },
      {
        title: "Renseigne tes identifiants et connecte",
        detail:
          "Identifiant et mot de passe sont ceux de ta connexion Tradovate habituelle. Colle ensuite la clé dans « Clé API (cid) » et le secret dans « Clé API secret (sec) ». Clique sur « Connecter ».",
        check:
          "La connexion apparaît dans la liste avec le statut « Active » et une date de dernière synchro. Tes trades futures remontent dans « Mes Trades ».",
      },
    ],
    fixes: [
      {
        problem: "Je ne trouve pas « API Access » chez Tradovate",
        fix: "Ton broker ou ta prop firm n'a pas activé l'accès API sur ce compte, ce qui arrive souvent sur les comptes d'évaluation. Contacte leur support pour le demander. En attendant, tu peux passer par NinjaTrader ou par l'import CSV.",
      },
      {
        problem: "La connexion affiche le statut « Erreur »",
        fix: "Le message d'erreur s'affiche à côté du statut. Dans l'ordre : mauvais environnement (Live au lieu de Démo ou l'inverse), puis identifiants ou clés recopiés avec un espace en trop. Supprime la connexion et recrée-la.",
      },
      {
        problem: "Le statut est « Active » mais aucun trade n'arrive",
        fix: "Le compte connecté n'a pas de trade clôturé sur la période, ou tu as connecté l'environnement qui ne contient pas ton activité. Clique sur « Synchroniser » pour forcer un passage, puis vérifie l'environnement.",
      },
      {
        problem: "J'ai changé mon mot de passe Tradovate",
        fix: "La connexion passera en erreur au prochain passage. Supprime-la et recrée-la avec les nouveaux identifiants.",
      },
    ],
    notes: [
      "Tes identifiants et tes clés sont chiffrés (AES-256) et ne sont jamais réaffichés une fois enregistrés.",
      "Tu peux suspendre une connexion à tout moment sans la supprimer : elle cesse de se synchroniser et tes trades déjà importés restent en place.",
    ],
  },

  en: {
    before: [
      "A Tradovate account, or a prop firm account running on Tradovate (Apex, Topstep and others).",
      "API access must be enabled on that account: that is what gives you the key (cid) and secret (sec). Not every prop firm allows it.",
      "The upside of this rail: nothing to install and nothing to keep open, the sync runs on our servers every hour.",
    ],
    steps: [
      {
        title: "Get your API key from Tradovate",
        detail:
          "Log in to trader.tradovate.com, open the application settings and look for the « API Access » section. Generate a key: Tradovate shows a key (which we call cid) and a secret (which we call sec). Copy both.",
        check:
          "You have two distinct values in front of you. The secret is usually shown only once: save it before closing the page.",
      },
      {
        title: "Open the connection form",
        detail: "Click « Connect Tradovate » above this guide.",
      },
      {
        title: "Name the connection",
        detail:
          "The « connection name » field is only there to help you tell accounts apart if you connect several. For example: Apex 50k, or Personal account.",
      },
      {
        title: "Pick the right environment",
        detail:
          "Choose « Live » if you normally log in to trader.tradovate.com with a real account. Choose « Demo » if your account is a simulation or evaluation account. When in doubt, try one then the other: a wrong environment shows up immediately in the connection status.",
      },
      {
        title: "Fill in your credentials and connect",
        detail:
          "Username and password are your usual Tradovate login. Then paste the key into « API key (cid) » and the secret into « API secret (sec) ». Click « Connect ».",
        check:
          "The connection appears in the list with status « Active » and a last-sync date. Your futures trades land in « My Trades ».",
      },
    ],
    fixes: [
      {
        problem: "I cannot find « API Access » in Tradovate",
        fix: "Your broker or prop firm has not enabled API access on that account, which is common on evaluation accounts. Contact their support to request it. In the meantime you can use NinjaTrader or CSV import.",
      },
      {
        problem: "The connection shows status « Error »",
        fix: "The error message is displayed next to the status. In order: wrong environment (Live instead of Demo or the other way round), then credentials or keys copied with a stray space. Delete the connection and create it again.",
      },
      {
        problem: "Status is « Active » but no trade arrives",
        fix: "The connected account has no closed trade in the window, or you connected the environment that does not hold your activity. Click « Sync » to force a pass, then check the environment.",
      },
      {
        problem: "I changed my Tradovate password",
        fix: "The connection will error out on the next pass. Delete it and create it again with the new credentials.",
      },
    ],
    notes: [
      "Your credentials and keys are encrypted (AES-256) and never displayed again once saved.",
      "You can pause a connection at any time without deleting it: it stops syncing and the trades already imported stay in place.",
    ],
  },

  es: {
    before: [
      "Una cuenta Tradovate, o una cuenta de prop firm que funcione con Tradovate (Apex, Topstep y otras).",
      "El acceso API debe estar activado en esa cuenta: es lo que te da la clave (cid) y el secreto (sec). No todas las prop firms lo permiten.",
      "La ventaja de esta vía: nada que instalar ni que dejar abierto, la sincronización corre en nuestros servidores cada hora.",
    ],
    steps: [
      {
        title: "Consigue tu clave API en Tradovate",
        detail:
          "Entra en trader.tradovate.com, abre los ajustes de la aplicación y busca la sección « API Access ». Genera una clave: Tradovate muestra una clave (que llamamos cid) y un secreto (que llamamos sec). Copia las dos.",
        check:
          "Tienes delante dos valores distintos. El secreto suele mostrarse una sola vez: guárdalo antes de cerrar la página.",
      },
      {
        title: "Abre el formulario de conexión",
        detail: "Pulsa « Conectar Tradovate » encima de esta guía.",
      },
      {
        title: "Pon nombre a la conexión",
        detail:
          "El campo « nombre de la conexión » solo sirve para distinguir cuentas si conectas varias. Por ejemplo: Apex 50k, o Cuenta personal.",
      },
      {
        title: "Elige el entorno correcto",
        detail:
          "Elige « Live » si normalmente entras en trader.tradovate.com con una cuenta real. Elige « Demo » si tu cuenta es de simulación o de evaluación. Ante la duda, prueba uno y luego el otro: un entorno equivocado se nota enseguida en el estado de la conexión.",
      },
      {
        title: "Introduce tus credenciales y conecta",
        detail:
          "Usuario y contraseña son los de tu acceso habitual a Tradovate. Después pega la clave en « Clave API (cid) » y el secreto en « Clave API secreta (sec) ». Pulsa « Conectar ».",
        check:
          "La conexión aparece en la lista con estado « Activa » y una fecha de última sincronización. Tus operaciones de futuros llegan a « Mis Trades ».",
      },
    ],
    fixes: [
      {
        problem: "No encuentro « API Access » en Tradovate",
        fix: "Tu bróker o prop firm no ha activado el acceso API en esa cuenta, algo habitual en cuentas de evaluación. Contacta con su soporte para pedirlo. Mientras tanto puedes usar NinjaTrader o la importación CSV.",
      },
      {
        problem: "La conexión muestra el estado « Error »",
        fix: "El mensaje de error aparece junto al estado. Por orden: entorno equivocado (Live en vez de Demo o al revés), y después credenciales o claves copiadas con un espacio de más. Borra la conexión y créala de nuevo.",
      },
      {
        problem: "El estado es « Activa » pero no llega ninguna operación",
        fix: "La cuenta conectada no tiene operaciones cerradas en el periodo, o has conectado el entorno que no contiene tu actividad. Pulsa « Sincronizar » para forzar una pasada y comprueba el entorno.",
      },
      {
        problem: "He cambiado mi contraseña de Tradovate",
        fix: "La conexión dará error en la siguiente pasada. Bórrala y créala de nuevo con las credenciales nuevas.",
      },
    ],
    notes: [
      "Tus credenciales y claves se cifran (AES-256) y no se vuelven a mostrar una vez guardadas.",
      "Puedes suspender una conexión en cualquier momento sin borrarla: deja de sincronizar y las operaciones ya importadas se mantienen.",
    ],
  },

  de: {
    before: [
      "Ein Tradovate-Konto oder ein Prop-Firm-Konto, das über Tradovate läuft (Apex, Topstep und andere).",
      "Der API-Zugang muss für dieses Konto freigeschaltet sein: Daraus stammen Key (cid) und Secret (sec). Nicht jede Prop Firm erlaubt das.",
      "Vorteil dieses Wegs: nichts zu installieren und nichts offen zu halten, die Synchronisation läuft stündlich auf unseren Servern.",
    ],
    steps: [
      {
        title: "API-Schlüssel bei Tradovate holen",
        detail:
          "Melde dich auf trader.tradovate.com an, öffne die Anwendungseinstellungen und suche den Bereich « API Access ». Erzeuge einen Schlüssel: Tradovate zeigt einen Key (bei uns cid) und ein Secret (bei uns sec). Kopiere beides.",
        check:
          "Du hast zwei verschiedene Werte vor dir. Das Secret wird meist nur einmal angezeigt: Sichere es, bevor du die Seite schließt.",
      },
      {
        title: "Verbindungsformular öffnen",
        detail: "Klicke oberhalb dieser Anleitung auf « Tradovate verbinden ».",
      },
      {
        title: "Verbindung benennen",
        detail:
          "Das Feld für den Verbindungsnamen dient nur dazu, mehrere Konten auseinanderzuhalten. Zum Beispiel: Apex 50k oder Privatkonto.",
      },
      {
        title: "Die richtige Umgebung wählen",
        detail:
          "Wähle « Live », wenn du dich normalerweise mit einem echten Konto auf trader.tradovate.com anmeldest. Wähle « Demo », wenn dein Konto ein Simulations- oder Evaluierungskonto ist. Im Zweifel probierst du erst die eine, dann die andere: Eine falsche Umgebung zeigt sich sofort am Verbindungsstatus.",
      },
      {
        title: "Zugangsdaten eintragen und verbinden",
        detail:
          "Benutzername und Passwort sind deine üblichen Tradovate-Zugangsdaten. Füge dann den Key in « API-Schlüssel (cid) » und das Secret in « API-Secret (sec) » ein. Klicke auf « Verbinden ».",
        check:
          "Die Verbindung erscheint in der Liste mit Status « Aktiv » und einem Zeitpunkt der letzten Synchronisation. Deine Futures-Trades erscheinen unter « Meine Trades ».",
      },
    ],
    fixes: [
      {
        problem: "Ich finde « API Access » bei Tradovate nicht",
        fix: "Dein Broker oder deine Prop Firm hat den API-Zugang für dieses Konto nicht freigeschaltet, was bei Evaluierungskonten häufig vorkommt. Frag deren Support danach. Bis dahin kannst du NinjaTrader oder den CSV-Import nutzen.",
      },
      {
        problem: "Die Verbindung zeigt den Status « Fehler »",
        fix: "Die Fehlermeldung steht neben dem Status. Der Reihe nach: falsche Umgebung (Live statt Demo oder umgekehrt), dann Zugangsdaten oder Schlüssel mit einem überzähligen Leerzeichen kopiert. Lösche die Verbindung und lege sie neu an.",
      },
      {
        problem: "Status ist « Aktiv », aber es kommt kein Trade an",
        fix: "Das verbundene Konto hat im Zeitraum keinen geschlossenen Trade, oder du hast die Umgebung verbunden, in der deine Aktivität nicht liegt. Klicke auf « Synchronisieren », um einen Durchlauf zu erzwingen, und prüfe die Umgebung.",
      },
      {
        problem: "Ich habe mein Tradovate-Passwort geändert",
        fix: "Die Verbindung läuft beim nächsten Durchlauf auf einen Fehler. Lösche sie und lege sie mit den neuen Zugangsdaten neu an.",
      },
    ],
    notes: [
      "Deine Zugangsdaten und Schlüssel werden verschlüsselt gespeichert (AES-256) und nach dem Speichern nie wieder angezeigt.",
      "Du kannst eine Verbindung jederzeit pausieren, ohne sie zu löschen: Sie synchronisiert nicht mehr, bereits importierte Trades bleiben erhalten.",
    ],
  },
};

export default guide;
