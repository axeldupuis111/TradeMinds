import type { GuideContent } from "./types";

// Rail push NinjaTrader 8 (AddOn). Deux pièges : le token se colle dans le
// fichier AVANT compilation (pas dans une fenêtre de paramètres), et l'éditeur
// NinjaScript pré-remplit un squelette qu'il faut effacer.
//
// ⚠️ CE N'EST PLUS LE CHEMIN PRINCIPAL POUR LA PLUPART DES UTILISATEURS.
//
// Vérifié le 2026-08-19 : web.ninjatrader.com sert le MÊME build que
// trader.tradovate.com, six fichiers d'actifs partageant des empreintes de
// contenu identiques. Et le même compte s'y connecte : nos identifiants
// Tradovate ouvrent la session NinjaTrader, sur le même numéro de compte, le
// même solde et le même P&L. NinjaTrader Brokerage et Tradovate sont un seul
// compte avec deux portes d'entrée.
//
// Conséquence : ces utilisateurs, prop firms sur Tradovate comprises (Apex,
// Topstep), passent par le bouton OAuth de la carte Tradovate. Un clic, rien à
// installer, rien à compiler, et surtout pas de vérification d'identité, mur
// sur lequel bute quiconque tente d'installer la plateforme de bureau.
//
// L'AddOn reste nécessaire pour les comptes qui NE sont PAS sur ce socle : la
// plateforme NinjaTrader connectée à un autre courtier. D'où le premier
// prérequis ci-dessous, qui doit rester en tête de liste.

const guide: GuideContent = {
  fr: {
    before: [
      "AVANT DE COMMENCER, VÉRIFIE SI TU EN AS BESOIN : si ton compte est un compte NinjaTrader Brokerage, ou une prop firm qui passe par Tradovate (Apex, Topstep et la plupart des autres), n'installe rien. Va dans la section « Synchronisation Tradovate et NinjaTrader » et clique sur « Continuer vers NinjaTrader » : c'est le même compte, et il n'y a qu'un bouton à cliquer. Ce guide ne concerne que les comptes NinjaTrader tenus par un AUTRE courtier.",
      "NinjaTrader 8 installé et connecté à ton compte (NinjaTrader 7 n'est pas compatible).",
      "Adapté aux comptes futures et aux prop firms qui passent par NinjaTrader (Apex, Topstep et autres).",
      "Particularité : ici le token se colle dans le fichier avant de compiler, il n'y a pas de fenêtre de paramètres.",
    ],
    steps: [
      {
        title: "Télécharge l'AddOn et ouvre-le dans le Bloc-notes",
        detail:
          "Télécharge le fichier .cs avec le bouton au-dessus de ce guide. Fais un clic droit dessus, « Ouvrir avec », puis « Bloc-notes ».",
        check: "Le fichier s'ouvre dans une fenêtre de texte, pas dans Visual Studio.",
      },
      {
        title: "Colle ton token dans le fichier",
        detail:
          "Vers le haut du fichier, repère la ligne : private const string SyncToken = \"PASTE_YOUR_TOKEN_HERE\";. Sélectionne uniquement PASTE_YOUR_TOKEN_HERE (sans toucher aux guillemets) et colle ton token à la place. Enregistre avec Ctrl+S.",
        check:
          "La ligne ressemble maintenant à private const string SyncToken = \"ton-token\"; avec les guillemets toujours présents des deux côtés.",
      },
      {
        title: "Ouvre l'éditeur NinjaScript",
        detail:
          "Dans NinjaTrader : menu « Tools » puis « NinjaScript Editor ». Dans l'arborescence de gauche, fais un clic droit sur « AddOns » et choisis « New AddOn ». Nomme-le TradeDisciplineSync et valide.",
        check: "Un nouvel onglet s'ouvre avec un squelette de code généré automatiquement.",
      },
      {
        title: "Remplace entièrement le code généré",
        detail:
          "Comme pour cTrader, il faut effacer le squelette et non coller par-dessus. Clique dans l'éditeur, fais Ctrl+A puis Suppr. Reviens dans le Bloc-notes, fais Ctrl+A puis Ctrl+C, et colle dans l'éditeur NinjaScript avec Ctrl+V.",
        check: "La première ligne commence par // ============ et ton token est visible dans le code collé.",
      },
      {
        title: "Compile",
        detail: "Appuie sur F5 pour compiler.",
        check:
          "Le panneau d'erreurs en bas reste vide. S'il affiche des erreurs, le squelette n'a pas été entièrement effacé à l'étape 4.",
      },
      {
        title: "Redémarre NinjaTrader",
        detail:
          "Ferme complètement NinjaTrader puis rouvre-le. L'AddOn ne se lance qu'au démarrage de l'application.",
        check:
          "Tes trades clôturés remontent dans « Mes Trades ». Ensuite, chaque round-turn fermé est envoyé automatiquement tant que NinjaTrader est connecté.",
      },
    ],
    fixes: [
      {
        problem: "La compilation affiche des erreurs",
        fix: "Le squelette généré par « New AddOn » n'a pas été effacé avant de coller. Refais l'étape 4 : Ctrl+A puis Suppr avant de coller.",
      },
      {
        problem: "Ça compile mais rien n'arrive",
        fix: "Le plus souvent, PASTE_YOUR_TOKEN_HERE est resté dans le fichier : le token n'a pas été collé, ou il a été collé après la compilation. Corrige la ligne SyncToken, recompile avec F5, puis redémarre NinjaTrader.",
      },
      {
        problem: "J'ai supprimé un guillemet par erreur",
        fix: "La ligne doit garder ses deux guillemets autour du token, sinon la compilation échoue. Réécris-la à l'identique : private const string SyncToken = \"ton-token\";",
      },
      {
        problem: "Rien ne se passe alors que j'ai bien compilé",
        fix: "L'AddOn démarre uniquement au lancement de NinjaTrader. Ferme l'application entièrement et relance-la.",
      },
    ],
    notes: [
      "L'AddOn lit uniquement les exécutions du compte et reconstitue les trades (entrée puis sortie). Il n'envoie et ne modifie aucun ordre.",
      "Si tu régénères ton token, il faut le recoller dans le fichier, recompiler et redémarrer NinjaTrader.",
    ],
  },

  en: {
    before: [
      "BEFORE YOU START, CHECK WHETHER YOU NEED THIS: if your account is a NinjaTrader Brokerage account, or a prop firm running on Tradovate (Apex, Topstep and most others), install nothing. Go to the “Tradovate and NinjaTrader sync” section and click “Continue to NinjaTrader”: it is the same account, and it takes one click. This guide only covers NinjaTrader accounts held with a DIFFERENT broker.",
      "NinjaTrader 8 installed and connected to your account (NinjaTrader 7 is not supported).",
      "Suited to futures accounts and prop firms running on NinjaTrader (Apex, Topstep and others).",
      "One specificity: here the token goes inside the file before compiling, there is no parameters window.",
    ],
    steps: [
      {
        title: "Download the AddOn and open it in Notepad",
        detail:
          "Download the .cs file with the button above this guide. Right-click it, « Open with », then « Notepad ».",
        check: "The file opens in a plain text window, not in Visual Studio.",
      },
      {
        title: "Paste your token into the file",
        detail:
          "Near the top of the file, find the line: private const string SyncToken = \"PASTE_YOUR_TOKEN_HERE\";. Select only PASTE_YOUR_TOKEN_HERE (leave the quotes alone) and paste your token in its place. Save with Ctrl+S.",
        check:
          "The line now reads private const string SyncToken = \"your-token\"; with the quotes still there on both sides.",
      },
      {
        title: "Open the NinjaScript editor",
        detail:
          "In NinjaTrader: « Tools » menu then « NinjaScript Editor ». In the left tree, right-click « AddOns » and choose « New AddOn ». Name it TradeDisciplineSync and confirm.",
        check: "A new tab opens with an automatically generated code skeleton.",
      },
      {
        title: "Replace the generated code entirely",
        detail:
          "As with cTrader, you must erase the skeleton rather than paste over it. Click inside the editor, press Ctrl+A then Delete. Go back to Notepad, press Ctrl+A then Ctrl+C, and paste into the NinjaScript editor with Ctrl+V.",
        check: "The first line starts with // ============ and your token is visible in the pasted code.",
      },
      {
        title: "Compile",
        detail: "Press F5 to compile.",
        check:
          "The errors panel at the bottom stays empty. If errors appear, the skeleton was not fully erased in step 4.",
      },
      {
        title: "Restart NinjaTrader",
        detail:
          "Close NinjaTrader completely, then reopen it. The AddOn only starts when the application launches.",
        check:
          "Your closed trades land in « My Trades ». From then on, every closed round-turn is sent automatically while NinjaTrader is connected.",
      },
    ],
    fixes: [
      {
        problem: "Compiling shows errors",
        fix: "The skeleton generated by « New AddOn » was not erased before pasting. Redo step 4: Ctrl+A then Delete before pasting.",
      },
      {
        problem: "It compiles but nothing arrives",
        fix: "Usually PASTE_YOUR_TOKEN_HERE is still in the file: the token was never pasted, or was pasted after compiling. Fix the SyncToken line, recompile with F5, then restart NinjaTrader.",
      },
      {
        problem: "I deleted a quote by mistake",
        fix: "The line must keep both quotes around the token, otherwise compiling fails. Rewrite it exactly as: private const string SyncToken = \"your-token\";",
      },
      {
        problem: "Nothing happens even though it compiled",
        fix: "The AddOn only starts when NinjaTrader launches. Close the application completely and start it again.",
      },
    ],
    notes: [
      "The AddOn only reads account executions and rebuilds trades (entry then exit) itself. It never sends or modifies an order.",
      "If you regenerate your token, paste it into the file again, recompile, and restart NinjaTrader.",
    ],
  },

  es: {
    before: [
      "ANTES DE EMPEZAR, COMPRUEBA SI LO NECESITAS: si tu cuenta es de NinjaTrader Brokerage, o de una prop firm que funciona sobre Tradovate (Apex, Topstep y la mayoría), no instales nada. Ve a la sección « Sincronización Tradovate y NinjaTrader » y pulsa « Continuar a NinjaTrader »: es la misma cuenta y basta un clic. Esta guía solo cubre cuentas de NinjaTrader con OTRO bróker.",
      "NinjaTrader 8 instalado y conectado a tu cuenta (NinjaTrader 7 no es compatible).",
      "Pensado para cuentas de futuros y prop firms que funcionan con NinjaTrader (Apex, Topstep y otras).",
      "Particularidad: aquí el token se pega dentro del archivo antes de compilar, no hay ventana de parámetros.",
    ],
    steps: [
      {
        title: "Descarga el AddOn y ábrelo en el Bloc de notas",
        detail:
          "Descarga el archivo .cs con el botón encima de esta guía. Haz clic derecho, « Abrir con » y luego « Bloc de notas ».",
        check: "El archivo se abre en una ventana de texto, no en Visual Studio.",
      },
      {
        title: "Pega tu token dentro del archivo",
        detail:
          "Cerca del principio del archivo busca la línea: private const string SyncToken = \"PASTE_YOUR_TOKEN_HERE\";. Selecciona solo PASTE_YOUR_TOKEN_HERE (sin tocar las comillas) y pega tu token en su lugar. Guarda con Ctrl+S.",
        check:
          "La línea queda como private const string SyncToken = \"tu-token\"; con las comillas intactas a ambos lados.",
      },
      {
        title: "Abre el editor NinjaScript",
        detail:
          "En NinjaTrader: menú « Tools » y luego « NinjaScript Editor ». En el árbol de la izquierda haz clic derecho en « AddOns » y elige « New AddOn ». Ponle el nombre TradeDisciplineSync y confirma.",
        check: "Se abre una pestaña nueva con un esqueleto de código generado automáticamente.",
      },
      {
        title: "Sustituye por completo el código generado",
        detail:
          "Igual que en cTrader, hay que borrar el esqueleto en vez de pegar encima. Haz clic en el editor, pulsa Ctrl+A y luego Supr. Vuelve al Bloc de notas, pulsa Ctrl+A y Ctrl+C, y pega en el editor NinjaScript con Ctrl+V.",
        check: "La primera línea empieza por // ============ y tu token es visible en el código pegado.",
      },
      {
        title: "Compila",
        detail: "Pulsa F5 para compilar.",
        check:
          "El panel de errores de abajo queda vacío. Si aparecen errores, el esqueleto no se borró del todo en el paso 4.",
      },
      {
        title: "Reinicia NinjaTrader",
        detail:
          "Cierra NinjaTrader por completo y vuelve a abrirlo. El AddOn solo arranca al iniciar la aplicación.",
        check:
          "Tus operaciones cerradas llegan a « Mis Trades ». A partir de ahí, cada round-turn cerrado se envía automáticamente mientras NinjaTrader esté conectado.",
      },
    ],
    fixes: [
      {
        problem: "La compilación muestra errores",
        fix: "El esqueleto generado por « New AddOn » no se borró antes de pegar. Repite el paso 4: Ctrl+A y Supr antes de pegar.",
      },
      {
        problem: "Compila pero no llega nada",
        fix: "Casi siempre PASTE_YOUR_TOKEN_HERE sigue en el archivo: el token no se pegó, o se pegó después de compilar. Corrige la línea SyncToken, recompila con F5 y reinicia NinjaTrader.",
      },
      {
        problem: "He borrado una comilla por error",
        fix: "La línea debe conservar las dos comillas alrededor del token o la compilación falla. Reescríbela así: private const string SyncToken = \"tu-token\";",
      },
      {
        problem: "No pasa nada aunque haya compilado",
        fix: "El AddOn solo arranca al iniciar NinjaTrader. Cierra la aplicación por completo y vuelve a abrirla.",
      },
    ],
    notes: [
      "El AddOn solo lee las ejecuciones de la cuenta y reconstruye las operaciones (entrada y salida). Nunca envía ni modifica una orden.",
      "Si regeneras tu token, tendrás que pegarlo de nuevo en el archivo, recompilar y reiniciar NinjaTrader.",
    ],
  },

  de: {
    before: [
      "PRÜFE ZUERST, OB DU DAS ÜBERHAUPT BRAUCHST: Wenn dein Konto ein NinjaTrader-Brokerage-Konto ist oder zu einer Prop Firm auf Tradovate gehört (Apex, Topstep und die meisten anderen), installiere nichts. Gehe zum Abschnitt « Tradovate- und NinjaTrader-Synchronisierung » und klicke auf « Weiter zu NinjaTrader »: es ist dasselbe Konto und kostet einen Klick. Diese Anleitung gilt nur für NinjaTrader-Konten bei einem ANDEREN Broker.",
      "NinjaTrader 8 installiert und mit deinem Konto verbunden (NinjaTrader 7 wird nicht unterstützt).",
      "Gedacht für Futures-Konten und Prop Firms, die über NinjaTrader laufen (Apex, Topstep und andere).",
      "Besonderheit: Der Token wird hier vor dem Kompilieren in die Datei eingefügt, es gibt kein Parameterfenster.",
    ],
    steps: [
      {
        title: "AddOn herunterladen und im Editor öffnen",
        detail:
          "Lade die .cs-Datei über den Button oberhalb dieser Anleitung herunter. Rechtsklick darauf, « Öffnen mit », dann « Editor ».",
        check: "Die Datei öffnet sich in einem einfachen Textfenster, nicht in Visual Studio.",
      },
      {
        title: "Token in die Datei einfügen",
        detail:
          "Suche im oberen Teil der Datei die Zeile: private const string SyncToken = \"PASTE_YOUR_TOKEN_HERE\";. Markiere nur PASTE_YOUR_TOKEN_HERE (die Anführungszeichen bleiben stehen) und füge deinen Token an dieser Stelle ein. Speichern mit Strg+S.",
        check:
          "Die Zeile lautet jetzt private const string SyncToken = \"dein-token\"; und die Anführungszeichen stehen weiterhin auf beiden Seiten.",
      },
      {
        title: "NinjaScript-Editor öffnen",
        detail:
          "In NinjaTrader: Menü « Tools », dann « NinjaScript Editor ». Rechtsklick im linken Baum auf « AddOns », dann « New AddOn ». Nenne ihn TradeDisciplineSync und bestätige.",
        check: "Ein neuer Reiter öffnet sich mit einem automatisch erzeugten Code-Gerüst.",
      },
      {
        title: "Erzeugten Code vollständig ersetzen",
        detail:
          "Wie bei cTrader muss das Gerüst gelöscht und nicht überschrieben werden. Klicke in den Editor, drücke Strg+A und dann Entf. Zurück im Editor/Notepad: Strg+A, Strg+C, und im NinjaScript-Editor mit Strg+V einfügen.",
        check: "Die erste Zeile beginnt mit // ============ und dein Token ist im eingefügten Code sichtbar.",
      },
      {
        title: "Kompilieren",
        detail: "Drücke F5 zum Kompilieren.",
        check:
          "Das Fehlerfenster unten bleibt leer. Erscheinen Fehler, wurde das Gerüst in Schritt 4 nicht vollständig gelöscht.",
      },
      {
        title: "NinjaTrader neu starten",
        detail:
          "Schließe NinjaTrader vollständig und öffne es erneut. Das AddOn startet nur beim Start der Anwendung.",
        check:
          "Deine geschlossenen Trades erscheinen unter « Meine Trades ». Ab dann wird jeder geschlossene Round-Turn automatisch gesendet, solange NinjaTrader verbunden ist.",
      },
    ],
    fixes: [
      {
        problem: "Beim Kompilieren erscheinen Fehler",
        fix: "Das von « New AddOn » erzeugte Gerüst wurde vor dem Einfügen nicht gelöscht. Wiederhole Schritt 4: Strg+A und Entf, dann einfügen.",
      },
      {
        problem: "Es kompiliert, aber nichts kommt an",
        fix: "Meist steht noch PASTE_YOUR_TOKEN_HERE in der Datei: Der Token wurde nie eingefügt oder erst nach dem Kompilieren. Korrigiere die SyncToken-Zeile, kompiliere erneut mit F5 und starte NinjaTrader neu.",
      },
      {
        problem: "Ich habe versehentlich ein Anführungszeichen gelöscht",
        fix: "Die Zeile braucht beide Anführungszeichen um den Token, sonst schlägt das Kompilieren fehl. Schreibe sie exakt so: private const string SyncToken = \"dein-token\";",
      },
      {
        problem: "Es passiert nichts, obwohl kompiliert wurde",
        fix: "Das AddOn startet nur beim Start von NinjaTrader. Schließe die Anwendung vollständig und starte sie neu.",
      },
    ],
    notes: [
      "Das AddOn liest ausschließlich die Ausführungen des Kontos und setzt die Trades (Einstieg und Ausstieg) selbst zusammen. Es sendet und ändert keine Order.",
      "Wenn du den Token neu erzeugst, musst du ihn erneut in die Datei einfügen, neu kompilieren und NinjaTrader neu starten.",
    ],
  },
};

export default guide;
