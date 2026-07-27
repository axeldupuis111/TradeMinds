import type { GuideContent } from "./types";

// Rail push cTrader (cBot). Le piège récurrent : cTrader pré-remplit l'éditeur
// avec un squelette de cBot, et coller par-dessus sans l'effacer produit une
// erreur de compilation incompréhensible pour un non-développeur.

const guide: GuideContent = {
  fr: {
    before: [
      "cTrader Desktop installé (la version web ne permet pas d'installer un cBot), connecté à ton compte.",
      "Fonctionne avec tous les brokers cTrader : IC Markets, Pepperstone, FxPro, et les autres.",
    ],
    steps: [
      {
        title: "Copie ton token et télécharge le cBot",
        detail:
          "Le token est celui de la section MetaTrader plus haut : un seul token pour toutes tes plateformes. Télécharge ensuite le fichier .cs avec le bouton au-dessus de ce guide.",
      },
      {
        title: "Ouvre l'atelier cBot",
        detail:
          "Dans cTrader, clique sur l'icône « Automate » dans la barre de gauche (l'icône en forme de robot), puis sur l'onglet « cBots ». Clique sur le bouton « + » (Nouveau) et donne le nom TradeDiscipline.",
        check: "Un éditeur de code s'ouvre, déjà rempli avec un modèle de cBot vide.",
      },
      {
        title: "Remplace entièrement le code du modèle",
        detail:
          "C'est l'étape qui rate le plus souvent : il faut effacer le modèle, pas coller par-dessus. Clique dans l'éditeur, fais Ctrl+A pour tout sélectionner puis Suppr pour tout effacer. Ouvre ensuite le fichier .cs téléchargé avec le Bloc-notes (clic droit sur le fichier, « Ouvrir avec », « Bloc-notes »), fais Ctrl+A puis Ctrl+C, et reviens coller dans cTrader avec Ctrl+V.",
        check: "La première ligne de l'éditeur commence par // ============ et non par « using System; » seul.",
      },
      {
        title: "Compile",
        detail: "Clique sur l'icône marteau « Build » en haut de l'éditeur, ou fais Ctrl+B.",
        check:
          "cTrader affiche « Build succeeded » et 0 erreur. Si la compilation échoue, c'est que le modèle n'a pas été entièrement effacé à l'étape 3.",
      },
      {
        title: "Ajoute le cBot sur un graphique et colle ton token",
        detail:
          "Reviens à la liste des cBots, trouve TradeDiscipline et clique sur « Add » pour l'ajouter à n'importe quel graphique. Dans le panneau de paramètres qui s'ouvre à droite, colle ton token dans le champ « Token de synchronisation ». Ne touche pas au champ URL API.",
        check: "Le champ token est rempli et le champ URL contient bien https://www.tradediscipline.app/api/sync/push.",
      },
      {
        title: "Lance le cBot",
        detail:
          "Clique sur le bouton « Play ». cTrader demande l'autorisation d'accès réseau au premier lancement : accepte-la, sinon rien ne pourra être envoyé.",
        check:
          "L'instance passe au vert (« Running ») et tes trades clôturés des 90 derniers jours arrivent dans « Mes Trades ». Ensuite, chaque position fermée remonte automatiquement.",
      },
    ],
    fixes: [
      {
        problem: "La compilation échoue",
        fix: "Le code du modèle n'a pas été effacé avant de coller. Refais l'étape 3 : Ctrl+A puis Suppr dans l'éditeur avant de coller.",
      },
      {
        problem: "Le cBot tourne mais rien n'arrive",
        fix: "Le champ « Token de synchronisation » est vide ou contient un espace. Arrête le cBot, corrige le token dans les paramètres, relance avec Play.",
      },
      {
        problem: "cTrader a refusé l'accès réseau",
        fix: "Supprime l'instance du cBot et rajoute-la : la demande d'autorisation réapparaît au premier lancement. Accepte l'accès complet.",
      },
      {
        problem: "La synchro s'arrête quand je ferme cTrader",
        fix: "C'est normal : le cBot tourne dans cTrader. Le terminal doit rester ouvert avec l'instance en Play.",
      },
    ],
    notes: [
      "Le cBot lit uniquement ton historique de positions. Il n'ouvre et ne ferme aucune position.",
    ],
  },

  en: {
    before: [
      "cTrader Desktop installed (the web version cannot install a cBot), logged into your account.",
      "Works with every cTrader broker: IC Markets, Pepperstone, FxPro and the rest.",
    ],
    steps: [
      {
        title: "Copy your token and download the cBot",
        detail:
          "The token is the one from the MetaTrader section above: one token covers all your platforms. Then download the .cs file with the button above this guide.",
      },
      {
        title: "Open the cBot workshop",
        detail:
          "In cTrader, click « Automate » in the left sidebar (the robot icon), then the « cBots » tab. Click the « + » (New) button and name it TradeDiscipline.",
        check: "A code editor opens, already filled with an empty cBot template.",
      },
      {
        title: "Replace the template code entirely",
        detail:
          "This is the step that fails most often: you must erase the template, not paste on top of it. Click inside the editor, press Ctrl+A to select everything, then Delete. Now open the downloaded .cs file with Notepad (right-click the file, « Open with », « Notepad »), press Ctrl+A then Ctrl+C, and paste into cTrader with Ctrl+V.",
        check: "The first line of the editor starts with // ============ and not with a bare « using System; ».",
      },
      {
        title: "Build",
        detail: "Click the « Build » hammer icon at the top of the editor, or press Ctrl+B.",
        check:
          "cTrader shows « Build succeeded » and 0 errors. If the build fails, the template was not fully erased in step 3.",
      },
      {
        title: "Add the cBot to a chart and paste your token",
        detail:
          "Go back to the cBots list, find TradeDiscipline and click « Add » to attach it to any chart. In the parameters panel on the right, paste your token into the « Token de synchronisation » field. Leave the API URL field alone.",
        check: "The token field is filled and the URL field reads https://www.tradediscipline.app/api/sync/push.",
      },
      {
        title: "Start the cBot",
        detail:
          "Click « Play ». cTrader asks for network access permission on first launch: accept it, otherwise nothing can be sent.",
        check:
          "The instance turns green (« Running ») and your closed trades from the last 90 days land in « My Trades ». From then on, every closed position arrives automatically.",
      },
    ],
    fixes: [
      {
        problem: "The build fails",
        fix: "The template code was not erased before pasting. Redo step 3: Ctrl+A then Delete in the editor before pasting.",
      },
      {
        problem: "The cBot runs but nothing arrives",
        fix: "The « Token de synchronisation » field is empty or contains a space. Stop the cBot, fix the token in the parameters, and press Play again.",
      },
      {
        problem: "cTrader denied network access",
        fix: "Remove the cBot instance and add it again: the permission prompt comes back on first launch. Accept full access.",
      },
      {
        problem: "Sync stops when I close cTrader",
        fix: "That is expected: the cBot runs inside cTrader. The terminal must stay open with the instance playing.",
      },
    ],
    notes: ["The cBot only reads your position history. It never opens or closes a position."],
  },

  es: {
    before: [
      "cTrader Desktop instalado (la versión web no permite instalar un cBot), conectado a tu cuenta.",
      "Funciona con todos los brókers cTrader: IC Markets, Pepperstone, FxPro y los demás.",
    ],
    steps: [
      {
        title: "Copia tu token y descarga el cBot",
        detail:
          "El token es el de la sección MetaTrader de arriba: un solo token para todas tus plataformas. Después descarga el archivo .cs con el botón encima de esta guía.",
      },
      {
        title: "Abre el taller de cBots",
        detail:
          "En cTrader pulsa el icono « Automate » en la barra izquierda (el icono de robot) y luego la pestaña « cBots ». Pulsa el botón « + » (Nuevo) y ponle el nombre TradeDiscipline.",
        check: "Se abre un editor de código, ya relleno con una plantilla de cBot vacía.",
      },
      {
        title: "Sustituye por completo el código de la plantilla",
        detail:
          "Este es el paso que más falla: hay que borrar la plantilla, no pegar encima. Haz clic dentro del editor, pulsa Ctrl+A para seleccionarlo todo y luego Supr para borrarlo. Abre el archivo .cs descargado con el Bloc de notas (clic derecho, « Abrir con », « Bloc de notas »), pulsa Ctrl+A y Ctrl+C, y vuelve a cTrader para pegar con Ctrl+V.",
        check: "La primera línea del editor empieza por // ============ y no por un « using System; » suelto.",
      },
      {
        title: "Compila",
        detail: "Pulsa el icono de martillo « Build » arriba del editor, o Ctrl+B.",
        check:
          "cTrader muestra « Build succeeded » y 0 errores. Si falla, la plantilla no se borró del todo en el paso 3.",
      },
      {
        title: "Añade el cBot a un gráfico y pega tu token",
        detail:
          "Vuelve a la lista de cBots, busca TradeDiscipline y pulsa « Add » para añadirlo a cualquier gráfico. En el panel de parámetros de la derecha, pega tu token en el campo « Token de synchronisation ». No toques el campo de URL de la API.",
        check: "El campo del token está relleno y el de URL indica https://www.tradediscipline.app/api/sync/push.",
      },
      {
        title: "Arranca el cBot",
        detail:
          "Pulsa « Play ». cTrader pide autorización de acceso a la red en el primer arranque: acéptala, si no, no se podrá enviar nada.",
        check:
          "La instancia se pone verde (« Running ») y tus operaciones cerradas de los últimos 90 días llegan a « Mis Trades ». A partir de ahí, cada posición cerrada sube automáticamente.",
      },
    ],
    fixes: [
      {
        problem: "La compilación falla",
        fix: "No se borró el código de la plantilla antes de pegar. Repite el paso 3: Ctrl+A y Supr en el editor antes de pegar.",
      },
      {
        problem: "El cBot funciona pero no llega nada",
        fix: "El campo « Token de synchronisation » está vacío o tiene un espacio. Detén el cBot, corrige el token en los parámetros y vuelve a pulsar Play.",
      },
      {
        problem: "cTrader denegó el acceso a la red",
        fix: "Elimina la instancia del cBot y vuelve a añadirla: la petición de permiso reaparece en el primer arranque. Acepta el acceso completo.",
      },
      {
        problem: "La sincronización se para cuando cierro cTrader",
        fix: "Es normal: el cBot corre dentro de cTrader. El terminal debe seguir abierto con la instancia en Play.",
      },
    ],
    notes: ["El cBot solo lee tu historial de posiciones. Nunca abre ni cierra una posición."],
  },

  de: {
    before: [
      "cTrader Desktop installiert (in der Web-Version lässt sich kein cBot installieren), mit deinem Konto verbunden.",
      "Funktioniert mit allen cTrader-Brokern: IC Markets, Pepperstone, FxPro und weiteren.",
    ],
    steps: [
      {
        title: "Token kopieren und cBot herunterladen",
        detail:
          "Der Token ist derselbe wie im MetaTrader-Abschnitt oben: ein Token für alle Plattformen. Lade anschließend die .cs-Datei über den Button oberhalb dieser Anleitung herunter.",
      },
      {
        title: "Öffne die cBot-Werkstatt",
        detail:
          "Klicke in cTrader in der linken Leiste auf « Automate » (das Roboter-Symbol) und dann auf den Reiter « cBots ». Klicke auf « + » (Neu) und vergib den Namen TradeDiscipline.",
        check: "Ein Code-Editor öffnet sich, bereits gefüllt mit einer leeren cBot-Vorlage.",
      },
      {
        title: "Ersetze den Vorlagen-Code vollständig",
        detail:
          "Dieser Schritt geht am häufigsten schief: Die Vorlage muss gelöscht werden, nicht überschrieben. Klicke in den Editor, drücke Strg+A zum Markieren und dann Entf zum Löschen. Öffne die heruntergeladene .cs-Datei mit dem Editor/Notepad (Rechtsklick auf die Datei, « Öffnen mit », « Editor »), drücke Strg+A und Strg+C und füge sie in cTrader mit Strg+V ein.",
        check: "Die erste Zeile im Editor beginnt mit // ============ und nicht mit einem einzelnen « using System; ».",
      },
      {
        title: "Kompilieren",
        detail: "Klicke oben im Editor auf das Hammer-Symbol « Build » oder drücke Strg+B.",
        check:
          "cTrader meldet « Build succeeded » und 0 Fehler. Schlägt der Build fehl, wurde die Vorlage in Schritt 3 nicht vollständig gelöscht.",
      },
      {
        title: "cBot an einen Chart hängen und Token einfügen",
        detail:
          "Zurück zur cBot-Liste: Suche TradeDiscipline und klicke auf « Add », um ihn an einen beliebigen Chart zu hängen. Füge im Parameter-Panel rechts deinen Token in das Feld « Token de synchronisation » ein. Das API-URL-Feld bleibt unverändert.",
        check: "Das Token-Feld ist gefüllt und im URL-Feld steht https://www.tradediscipline.app/api/sync/push.",
      },
      {
        title: "Starte den cBot",
        detail:
          "Klicke auf « Play ». cTrader fragt beim ersten Start nach der Netzwerk-Berechtigung: Erlaube sie, sonst kann nichts gesendet werden.",
        check:
          "Die Instanz wird grün (« Running ») und deine geschlossenen Trades der letzten 90 Tage erscheinen unter « Meine Trades ». Ab dann kommt jede geschlossene Position automatisch an.",
      },
    ],
    fixes: [
      {
        problem: "Der Build schlägt fehl",
        fix: "Der Vorlagen-Code wurde vor dem Einfügen nicht gelöscht. Wiederhole Schritt 3: Strg+A und Entf im Editor, dann einfügen.",
      },
      {
        problem: "Der cBot läuft, aber nichts kommt an",
        fix: "Das Feld « Token de synchronisation » ist leer oder enthält ein Leerzeichen. Stoppe den cBot, korrigiere den Token in den Parametern und drücke erneut Play.",
      },
      {
        problem: "cTrader hat den Netzwerkzugriff verweigert",
        fix: "Entferne die cBot-Instanz und füge sie erneut hinzu: Die Abfrage erscheint beim ersten Start wieder. Erlaube den vollen Zugriff.",
      },
      {
        problem: "Die Synchronisation stoppt, wenn ich cTrader schließe",
        fix: "Das ist normal: Der cBot läuft in cTrader. Das Terminal muss offen bleiben und die Instanz auf Play stehen.",
      },
    ],
    notes: ["Der cBot liest ausschließlich deine Positionshistorie. Er eröffnet und schließt keine Position."],
  },
};

export default guide;
