import type { GuideContent } from "./types";

// Rail push MetaTrader (MT4/MT5, donc aussi Exness). C'est le guide le plus
// long des cinq : l'installation d'un Expert Advisor demande de déposer un
// fichier dans le bon dossier, de le compiler, puis d'autoriser une URL. Les
// trois étapes se ratent silencieusement, d'où un point de contrôle sur chacune.

const guide: GuideContent = {
  fr: {
    before: [
      "MetaTrader 4 ou 5 installé sur un ordinateur (Windows), connecté à ton compte de trading.",
      "Compte Exness ? Exness utilise le terminal MetaTrader : télécharge MetaTrader depuis ton espace Exness, connecte-toi, puis suis ce guide tel quel.",
      "Compte l'opération en 10 minutes la première fois. La synchro tourne ensuite toute seule.",
    ],
    steps: [
      {
        title: "Copie ton token",
        detail:
          "Clique sur « Copier » au-dessus de ce guide. Garde-le dans le presse-papiers jusqu'à l'étape 6, tu en auras besoin une seule fois.",
      },
      {
        title: "Télécharge le fichier qui correspond à ta version",
        detail:
          "MetaTrader 5 : le fichier .mq5. MetaTrader 4 : le fichier .mq4. Si tu ne sais pas laquelle tu as, regarde la barre de titre de MetaTrader, la version y est écrite.",
        check: "Le fichier est dans ton dossier Téléchargements.",
      },
      {
        title: "Dépose le fichier dans le dossier des Expert Advisors",
        detail:
          "C'est l'étape qui bloque le plus de monde : le fichier ne sert à rien dans Téléchargements. Dans MetaTrader, va dans « Fichier » puis « Ouvrir le dossier des données ». Une fenêtre de l'explorateur Windows s'ouvre. Entre dans le dossier MQL5 (MT5) ou MQL4 (MT4), puis dans le sous-dossier « Experts ». Glisse le fichier téléchargé dedans.",
        check: "Le fichier TradeDiscipline apparaît bien dans ce dossier Experts.",
      },
      {
        title: "Compile le fichier",
        detail:
          "Reviens dans MetaTrader et appuie sur F4 : MetaEditor s'ouvre. Dans le panneau de gauche, déplie « Experts » et double-clique sur TradeDiscipline pour l'ouvrir. Appuie sur F7 pour compiler.",
        check:
          "En bas de MetaEditor, tu lis « 0 error(s), 0 warning(s) ». S'il y a une erreur, c'est presque toujours que le fichier n'est pas dans le bon dossier (refais l'étape 3).",
      },
      {
        title: "Autorise l'accès web",
        detail:
          "Dans MetaTrader : menu « Outils » puis « Options », onglet « Conseillers Experts » (MT5) ou « Expert Advisors » (MT4). Coche « Autoriser le trading algorithmique » et « Autoriser les WebRequest pour les URL listées ». Dans la liste juste en dessous, double-clique sur la ligne vide et tape exactement : https://www.tradediscipline.app. Appuie sur Entrée, puis sur OK.",
        check:
          "L'URL apparaît dans la liste, avec le www, sans barre oblique à la fin et sans /api. C'est la première cause de « rien ne se synchronise ».",
      },
      {
        title: "Attache l'Expert Advisor à un graphique",
        detail:
          "Ouvre n'importe quel graphique. Ouvre le Navigateur (Ctrl+N), déplie « Expert Advisors » : si TradeDiscipline n'apparaît pas, fais un clic droit dans le Navigateur et choisis « Actualiser ». Glisse TradeDiscipline sur le graphique. Dans la fenêtre qui s'ouvre : onglet « Général », coche « Autoriser le trading algorithmique » (MT5) ou « Autoriser Trading en direct » (MT4). Puis onglet « Paramètres d'entrée » (MT5) ou « Données d'entrée » (MT4) : sur la ligne SyncToken, double-clique dans la colonne « Valeur » et colle ton token. Clique sur OK.",
        check:
          "En haut à droite du graphique s'affiche « TradeDiscipline » avec un visage souriant. Un visage triste ou une croix signifie que le trading algorithmique est coupé : clique sur le bouton « AutoTrading » de la barre d'outils pour le passer au vert.",
      },
      {
        title: "Vérifie que la synchro part",
        detail:
          "Dans le panneau du bas de MetaTrader, ouvre l'onglet « Experts » (onglet « Journal » sur MT4). Tu dois y lire une ligne « TradeDiscipline : demarrage. Envoi de l'historique des 90 derniers jours ».",
        check:
          "Tes trades clôturés des 90 derniers jours arrivent dans « Mes Trades » en moins d'une minute. Ensuite, chaque nouveau trade clôturé remonte tout seul.",
      },
    ],
    fixes: [
      {
        problem: "L'onglet Experts affiche « code 4014 » (ou 4060 sur MT4)",
        fix: "C'est la panne la plus fréquente, et elle a une seule cause : l'URL n'est pas autorisée. Va dans « Outils » puis « Options », onglet « Conseillers Experts » (« Expert Advisors » sur MT4). Coche « Autoriser les WebRequest pour les URL listées », puis double-clique sur la ligne vide de la liste et colle exactement https://www.tradediscipline.app. Avec le www, sans barre oblique à la fin, sans /api : MetaTrader exige une correspondance au caractère près. Retire ensuite l'Expert Advisor du graphique et remets-le, les trades en échec repartent tout seuls.",
      },
      {
        problem: "Rien n'arrive dans Mes Trades",
        fix: "Dans l'ordre de fréquence : le bouton « AutoTrading » de la barre d'outils n'est pas vert ; l'URL de l'étape 5 a été saisie sans le www ou avec une faute ; le token a été collé avec un espace au début ou à la fin. Vérifie les trois, dans cet ordre.",
      },
      {
        problem: "Visage triste ou croix en haut à droite du graphique",
        fix: "Le trading algorithmique est désactivé. Clique sur le bouton « AutoTrading » de la barre d'outils, il doit devenir vert. Si le problème persiste, refais un clic droit sur le graphique puis « Liste des Expert Advisors » et coche la case dans l'onglet Général.",
      },
      {
        problem: "TradeDiscipline n'apparaît pas dans le Navigateur",
        fix: "Le fichier n'est pas dans le bon dossier ou n'a pas été compilé. Refais les étapes 3 et 4, puis clic droit dans le Navigateur et « Actualiser ».",
      },
      {
        problem: "L'onglet Experts affiche « token manquant ou invalide »",
        fix: "Le token n'a pas été collé dans le champ SyncToken. Clic droit sur le graphique, « Liste des Expert Advisors », sélectionne TradeDiscipline puis « Propriétés » et colle le token dans l'onglet des paramètres d'entrée.",
      },
      {
        problem: "La synchro s'arrête quand j'éteins mon ordinateur",
        fix: "C'est normal : l'Expert Advisor tourne dans MetaTrader, donc le terminal doit rester ouvert. À la réouverture, les trades manqués sont rattrapés automatiquement.",
      },
      {
        problem: "Il manque des trades, surtout ceux gardés plusieurs heures",
        fix: "Tu utilises une version de l'Expert Advisor antérieure à la 1.10 : elle ne retrouvait pas le prix d'ouverture d'un trade ouvert avant la dernière vérification, et le trade partait dans le vide. Retélécharge le fichier .mq5 en haut de cette page, écrase l'ancien dans le dossier Experts, recompile (F7) et relance l'EA : les 90 derniers jours sont renvoyés et les trades manquants réapparaissent.",
      },
      {
        problem: "J'ai changé de token",
        fix: "Régénérer le token invalide l'ancien immédiatement. Rouvre les propriétés de l'Expert Advisor sur ton graphique et colle le nouveau token dans SyncToken.",
      },
    ],
    notes: [
      "TradeDiscipline affiche le P&L net (commissions et swaps inclus) : le montant peut donc différer du profit brut affiché par MetaTrader.",
      "L'Expert Advisor lit uniquement ton historique. Il n'ouvre, ne modifie et ne ferme aucune position.",
    ],
  },

  en: {
    before: [
      "MetaTrader 4 or 5 installed on a computer (Windows), logged into your trading account.",
      "Exness account? Exness runs on the MetaTrader terminal: download MetaTrader from your Exness area, log in, then follow this guide as is.",
      "Budget 10 minutes the first time. After that the sync runs on its own.",
    ],
    steps: [
      {
        title: "Copy your token",
        detail:
          "Click « Copy » above this guide. Keep it in your clipboard until step 6, you will need it once.",
      },
      {
        title: "Download the file matching your version",
        detail:
          "MetaTrader 5: the .mq5 file. MetaTrader 4: the .mq4 file. If you are unsure which one you run, the version is written in the MetaTrader title bar.",
        check: "The file is in your Downloads folder.",
      },
      {
        title: "Drop the file into the Expert Advisors folder",
        detail:
          "This is where most people get stuck: the file does nothing while it sits in Downloads. In MetaTrader, go to « File » then « Open Data Folder ». A Windows Explorer window opens. Go into the MQL5 folder (MT5) or MQL4 folder (MT4), then into the « Experts » subfolder. Drag the downloaded file in there.",
        check: "The TradeDiscipline file now shows up inside that Experts folder.",
      },
      {
        title: "Compile the file",
        detail:
          "Back in MetaTrader, press F4 to open MetaEditor. In the left panel, expand « Experts » and double-click TradeDiscipline to open it. Press F7 to compile.",
        check:
          "At the bottom of MetaEditor you read « 0 error(s), 0 warning(s) ». An error here almost always means the file is not in the right folder (redo step 3).",
      },
      {
        title: "Allow web access",
        detail:
          "In MetaTrader: « Tools » then « Options », « Expert Advisors » tab. Tick « Allow algorithmic trading » and « Allow WebRequest for listed URL ». In the list just below, double-click the empty row and type exactly: https://www.tradediscipline.app. Press Enter, then OK.",
        check:
          "The URL is in the list, with the www, no trailing slash and no /api. This is the number one cause of « nothing syncs ».",
      },
      {
        title: "Attach the Expert Advisor to a chart",
        detail:
          "Open any chart. Open the Navigator (Ctrl+N) and expand « Expert Advisors »: if TradeDiscipline is missing, right-click inside the Navigator and choose « Refresh ». Drag TradeDiscipline onto the chart. In the window that opens: « Common » tab, tick « Allow algorithmic trading » (MT5) or « Allow live trading » (MT4). Then the « Inputs » tab: on the SyncToken row, double-click the « Value » column and paste your token. Click OK.",
        check:
          "The top-right corner of the chart shows « TradeDiscipline » with a smiley face. A sad face or a cross means algorithmic trading is off: click the « AutoTrading » button in the toolbar so it turns green.",
      },
      {
        title: "Confirm the sync started",
        detail:
          "In the bottom panel of MetaTrader, open the « Experts » tab (« Journal » tab on MT4). You should see a line reading « TradeDiscipline : demarrage. Envoi de l'historique des 90 derniers jours ».",
        check:
          "Your closed trades from the last 90 days land in « My Trades » within a minute. From then on, every newly closed trade arrives on its own.",
      },
    ],
    fixes: [
      {
        problem: "The Experts tab shows « code 4014 » (or 4060 on MT4)",
        fix: "This is the most common failure, and it has a single cause: the URL is not allowed. Go to « Tools » then « Options », « Expert Advisors » tab. Tick « Allow WebRequest for listed URL », then double-click the empty line in the list and paste exactly https://www.tradediscipline.app. With the www, no trailing slash, no /api: MetaTrader requires a character-for-character match. Then remove the Expert Advisor from the chart and attach it again, the failed trades go out on their own.",
      },
      {
        problem: "Nothing shows up in My Trades",
        fix: "In order of likelihood: the « AutoTrading » toolbar button is not green; the step 5 URL was typed without the www or with a typo; the token was pasted with a leading or trailing space. Check all three, in that order.",
      },
      {
        problem: "Sad face or cross in the top-right of the chart",
        fix: "Algorithmic trading is disabled. Click the « AutoTrading » toolbar button, it must turn green. If it persists, right-click the chart, « Expert Advisors list », and tick the box in the Common tab.",
      },
      {
        problem: "TradeDiscipline is not in the Navigator",
        fix: "The file is either in the wrong folder or was never compiled. Redo steps 3 and 4, then right-click inside the Navigator and choose « Refresh ».",
      },
      {
        problem: "The Experts tab says the token is missing or invalid",
        fix: "The token was not pasted into the SyncToken field. Right-click the chart, « Expert Advisors list », select TradeDiscipline then « Properties », and paste the token in the inputs tab.",
      },
      {
        problem: "Sync stops when I shut down my computer",
        fix: "That is expected: the Expert Advisor runs inside MetaTrader, so the terminal has to stay open. Missed trades are caught up automatically next time you open it.",
      },
      {
        problem: "Some trades are missing, mostly the ones held for hours",
        fix: "You are running an Expert Advisor older than 1.10: it could not find the opening price of a trade opened before the last check, so the trade was dropped. Download the .mq5 file again at the top of this page, overwrite the old one in the Experts folder, recompile (F7) and restart the EA: the last 90 days are resent and the missing trades come back.",
      },
      {
        problem: "I regenerated my token",
        fix: "Regenerating invalidates the old token immediately. Reopen the Expert Advisor properties on your chart and paste the new token into SyncToken.",
      },
    ],
    notes: [
      "TradeDiscipline shows net P&L (commissions and swaps included), so the figure can differ from the gross profit MetaTrader displays.",
      "The Expert Advisor only reads your history. It never opens, modifies or closes a position.",
    ],
  },

  es: {
    before: [
      "MetaTrader 4 o 5 instalado en un ordenador (Windows), conectado a tu cuenta de trading.",
      "¿Cuenta Exness? Exness funciona sobre el terminal MetaTrader: descarga MetaTrader desde tu área Exness, inicia sesión y sigue esta guía tal cual.",
      "Cuenta unos 10 minutos la primera vez. Después la sincronización funciona sola.",
    ],
    steps: [
      {
        title: "Copia tu token",
        detail:
          "Pulsa « Copiar » encima de esta guía. Mantenlo en el portapapeles hasta el paso 6, lo necesitarás una sola vez.",
      },
      {
        title: "Descarga el archivo de tu versión",
        detail:
          "MetaTrader 5: el archivo .mq5. MetaTrader 4: el archivo .mq4. Si no sabes cuál tienes, la versión aparece en la barra de título de MetaTrader.",
        check: "El archivo está en tu carpeta de Descargas.",
      },
      {
        title: "Coloca el archivo en la carpeta de Expert Advisors",
        detail:
          "Aquí es donde se atasca casi todo el mundo: el archivo no sirve de nada mientras siga en Descargas. En MetaTrader ve a « Archivo » y luego « Abrir carpeta de datos ». Se abre una ventana del explorador de Windows. Entra en la carpeta MQL5 (MT5) o MQL4 (MT4) y después en la subcarpeta « Experts ». Arrastra ahí el archivo descargado.",
        check: "El archivo TradeDiscipline aparece dentro de esa carpeta Experts.",
      },
      {
        title: "Compila el archivo",
        detail:
          "Vuelve a MetaTrader y pulsa F4: se abre MetaEditor. En el panel izquierdo despliega « Experts » y haz doble clic en TradeDiscipline para abrirlo. Pulsa F7 para compilar.",
        check:
          "Abajo en MetaEditor lees « 0 error(s), 0 warning(s) ». Un error aquí casi siempre significa que el archivo no está en la carpeta correcta (repite el paso 3).",
      },
      {
        title: "Autoriza el acceso web",
        detail:
          "En MetaTrader: menú « Herramientas », luego « Opciones », pestaña « Asesores Expertos ». Marca « Permitir trading algorítmico » y « Permitir WebRequest para las URL listadas ». En la lista de debajo, haz doble clic en la fila vacía y escribe exactamente: https://www.tradediscipline.app. Pulsa Intro y luego Aceptar.",
        check:
          "La URL aparece en la lista, con el www, sin barra final y sin /api. Es la primera causa de « no se sincroniza nada ».",
      },
      {
        title: "Adjunta el Expert Advisor a un gráfico",
        detail:
          "Abre cualquier gráfico. Abre el Navegador (Ctrl+N) y despliega « Asesores Expertos »: si TradeDiscipline no aparece, haz clic derecho dentro del Navegador y elige « Actualizar ». Arrastra TradeDiscipline al gráfico. En la ventana que se abre: pestaña « General », marca « Permitir trading algorítmico » (MT5) o « Permitir trading en vivo » (MT4). Después, pestaña « Parámetros de entrada »: en la fila SyncToken, haz doble clic en la columna « Valor » y pega tu token. Pulsa Aceptar.",
        check:
          "Arriba a la derecha del gráfico aparece « TradeDiscipline » con una cara sonriente. Una cara triste o una cruz significa que el trading algorítmico está apagado: pulsa el botón « AutoTrading » de la barra de herramientas hasta que se ponga verde.",
      },
      {
        title: "Comprueba que la sincronización arranca",
        detail:
          "En el panel inferior de MetaTrader abre la pestaña « Expertos » (pestaña « Diario » en MT4). Debes ver una línea « TradeDiscipline : demarrage. Envoi de l'historique des 90 derniers jours ».",
        check:
          "Tus operaciones cerradas de los últimos 90 días llegan a « Mis Trades » en menos de un minuto. A partir de ahí, cada operación cerrada sube sola.",
      },
    ],
    fixes: [
      {
        problem: "La pestaña Expertos muestra « código 4014 » (o 4060 en MT4)",
        fix: "Es el fallo más frecuente y tiene una sola causa: la URL no está autorizada. Ve a « Herramientas » y luego « Opciones », pestaña « Asesores Expertos ». Marca « Permitir WebRequest para las URL listadas », después haz doble clic en la línea vacía de la lista y pega exactamente https://www.tradediscipline.app. Con el www, sin barra al final y sin /api: MetaTrader exige una coincidencia carácter por carácter. Luego quita el Asesor Experto del gráfico y vuelve a ponerlo, las operaciones fallidas salen solas.",
      },
      {
        problem: "No llega nada a Mis Trades",
        fix: "Por orden de frecuencia: el botón « AutoTrading » de la barra de herramientas no está verde; la URL del paso 5 se escribió sin el www o con una errata; el token se pegó con un espacio delante o detrás. Revisa los tres, en ese orden.",
      },
      {
        problem: "Cara triste o cruz arriba a la derecha del gráfico",
        fix: "El trading algorítmico está desactivado. Pulsa el botón « AutoTrading » de la barra de herramientas hasta que se ponga verde. Si sigue igual, clic derecho en el gráfico, « Lista de Asesores Expertos », y marca la casilla en la pestaña General.",
      },
      {
        problem: "TradeDiscipline no aparece en el Navegador",
        fix: "El archivo no está en la carpeta correcta o no se ha compilado. Repite los pasos 3 y 4, luego clic derecho en el Navegador y « Actualizar ».",
      },
      {
        problem: "La pestaña Expertos dice que el token falta o no es válido",
        fix: "El token no se pegó en el campo SyncToken. Clic derecho en el gráfico, « Lista de Asesores Expertos », selecciona TradeDiscipline y « Propiedades », y pega el token en la pestaña de parámetros de entrada.",
      },
      {
        problem: "La sincronización se para cuando apago el ordenador",
        fix: "Es normal: el Expert Advisor corre dentro de MetaTrader, así que el terminal debe seguir abierto. Al reabrirlo se recuperan automáticamente las operaciones perdidas.",
      },
      {
        problem: "Faltan operaciones, sobre todo las que duran varias horas",
        fix: "Estás usando un Expert Advisor anterior a la 1.10: no encontraba el precio de apertura de una operación abierta antes de la última comprobación y la operación se perdía. Vuelve a descargar el archivo .mq5 arriba en esta página, sustituye el antiguo en la carpeta Experts, recompila (F7) y reinicia el EA: se reenvían los últimos 90 días y las operaciones que faltaban reaparecen.",
      },
      {
        problem: "He regenerado mi token",
        fix: "Regenerar invalida el token anterior de inmediato. Vuelve a abrir las propiedades del Expert Advisor en tu gráfico y pega el nuevo token en SyncToken.",
      },
    ],
    notes: [
      "TradeDiscipline muestra el P&L neto (comisiones y swaps incluidos), por lo que la cifra puede diferir del beneficio bruto que muestra MetaTrader.",
      "El Expert Advisor solo lee tu historial. Nunca abre, modifica ni cierra una posición.",
    ],
  },

  de: {
    before: [
      "MetaTrader 4 oder 5 auf einem Computer (Windows) installiert und mit deinem Handelskonto verbunden.",
      "Exness-Konto? Exness läuft über das MetaTrader-Terminal: Lade MetaTrader in deinem Exness-Bereich herunter, melde dich an und folge dieser Anleitung unverändert.",
      "Rechne beim ersten Mal mit 10 Minuten. Danach läuft die Synchronisation von allein.",
    ],
    steps: [
      {
        title: "Kopiere deinen Token",
        detail:
          "Klicke oberhalb dieser Anleitung auf « Kopieren ». Behalte ihn bis Schritt 6 in der Zwischenablage, du brauchst ihn genau einmal.",
      },
      {
        title: "Lade die Datei für deine Version herunter",
        detail:
          "MetaTrader 5: die .mq5-Datei. MetaTrader 4: die .mq4-Datei. Wenn du unsicher bist: Die Version steht in der Titelleiste von MetaTrader.",
        check: "Die Datei liegt in deinem Downloads-Ordner.",
      },
      {
        title: "Lege die Datei in den Expert-Advisors-Ordner",
        detail:
          "An dieser Stelle bleiben die meisten hängen: Im Downloads-Ordner bewirkt die Datei nichts. Gehe in MetaTrader auf « Datei » und dann « Datenordner öffnen ». Es öffnet sich ein Windows-Explorer-Fenster. Wechsle in den Ordner MQL5 (MT5) bzw. MQL4 (MT4) und dort in den Unterordner « Experts ». Ziehe die heruntergeladene Datei hinein.",
        check: "Die Datei TradeDiscipline erscheint in diesem Experts-Ordner.",
      },
      {
        title: "Kompiliere die Datei",
        detail:
          "Zurück in MetaTrader: Drücke F4, MetaEditor öffnet sich. Klappe links « Experts » auf und öffne TradeDiscipline per Doppelklick. Drücke F7 zum Kompilieren.",
        check:
          "Unten in MetaEditor steht « 0 error(s), 0 warning(s) ». Ein Fehler bedeutet fast immer, dass die Datei im falschen Ordner liegt (Schritt 3 wiederholen).",
      },
      {
        title: "Web-Zugriff erlauben",
        detail:
          "In MetaTrader: Menü « Extras », dann « Optionen », Reiter « Expert Advisors ». Setze die Haken bei « Algorithmisches Trading erlauben » und « WebRequest für gelistete URL erlauben ». Doppelklicke in der Liste darunter auf die leere Zeile und tippe exakt: https://www.tradediscipline.app. Enter drücken, dann OK.",
        check:
          "Die URL steht in der Liste, mit www, ohne Schrägstrich am Ende und ohne /api. Das ist die häufigste Ursache für « nichts wird synchronisiert ».",
      },
      {
        title: "Hänge den Expert Advisor an einen Chart",
        detail:
          "Öffne einen beliebigen Chart. Öffne den Navigator (Strg+N) und klappe « Expert Advisors » auf: Fehlt TradeDiscipline, mache einen Rechtsklick im Navigator und wähle « Aktualisieren ». Ziehe TradeDiscipline auf den Chart. Im Fenster, das sich öffnet: Reiter « Allgemein », Haken bei « Algorithmisches Trading erlauben » (MT5) bzw. « Live-Trading erlauben » (MT4). Dann Reiter « Eingabeparameter »: In der Zeile SyncToken doppelklickst du in die Spalte « Wert » und fügst deinen Token ein. Klicke auf OK.",
        check:
          "Oben rechts im Chart steht « TradeDiscipline » mit einem lachenden Gesicht. Ein trauriges Gesicht oder ein Kreuz heißt: Algorithmisches Trading ist aus. Klicke in der Symbolleiste auf « AutoTrading », bis es grün ist.",
      },
      {
        title: "Prüfe, ob die Synchronisation startet",
        detail:
          "Öffne im unteren Bereich von MetaTrader den Reiter « Experten » (Reiter « Journal » bei MT4). Dort muss eine Zeile « TradeDiscipline : demarrage. Envoi de l'historique des 90 derniers jours » stehen.",
        check:
          "Deine geschlossenen Trades der letzten 90 Tage erscheinen innerhalb einer Minute unter « Meine Trades ». Ab dann kommt jeder neu geschlossene Trade von selbst an.",
      },
    ],
    fixes: [
      {
        problem: "Der Reiter Experten zeigt « Code 4014 » (oder 4060 bei MT4)",
        fix: "Das ist der häufigste Fehler, und er hat genau eine Ursache: Die URL ist nicht freigegeben. Gehe zu « Extras » und dann « Optionen », Reiter « Expert Advisors ». Setze den Haken bei « WebRequest für folgende URLs erlauben », doppelklicke dann auf die leere Zeile in der Liste und füge exakt https://www.tradediscipline.app ein. Mit www, ohne Schrägstrich am Ende, ohne /api: MetaTrader verlangt eine zeichengenaue Übereinstimmung. Nimm anschließend den Expert Advisor vom Chart und ziehe ihn erneut darauf, die fehlgeschlagenen Trades gehen von selbst raus.",
      },
      {
        problem: "Unter Meine Trades kommt nichts an",
        fix: "Nach Häufigkeit: Der Button « AutoTrading » in der Symbolleiste ist nicht grün; die URL aus Schritt 5 wurde ohne www oder mit Tippfehler eingetragen; der Token wurde mit einem Leerzeichen davor oder dahinter eingefügt. Prüfe alle drei in dieser Reihenfolge.",
      },
      {
        problem: "Trauriges Gesicht oder Kreuz oben rechts im Chart",
        fix: "Algorithmisches Trading ist deaktiviert. Klicke auf « AutoTrading » in der Symbolleiste, der Button muss grün werden. Hilft das nicht: Rechtsklick auf den Chart, « Expert-Advisors-Liste », und den Haken im Reiter Allgemein setzen.",
      },
      {
        problem: "TradeDiscipline steht nicht im Navigator",
        fix: "Die Datei liegt im falschen Ordner oder wurde nie kompiliert. Wiederhole Schritt 3 und 4, dann Rechtsklick im Navigator und « Aktualisieren ».",
      },
      {
        problem: "Der Reiter Experten meldet einen fehlenden oder ungültigen Token",
        fix: "Der Token wurde nicht in das Feld SyncToken eingefügt. Rechtsklick auf den Chart, « Expert-Advisors-Liste », TradeDiscipline auswählen, « Eigenschaften », und den Token im Reiter der Eingabeparameter einfügen.",
      },
      {
        problem: "Die Synchronisation stoppt, wenn ich den Rechner ausschalte",
        fix: "Das ist normal: Der Expert Advisor läuft in MetaTrader, das Terminal muss also offen bleiben. Verpasste Trades werden beim nächsten Öffnen automatisch nachgeholt.",
      },
      {
        problem: "Es fehlen Trades, vor allem die über mehrere Stunden gehaltenen",
        fix: "Du nutzt einen Expert Advisor älter als 1.10: Er fand den Eröffnungskurs eines vor der letzten Prüfung eröffneten Trades nicht, der Trade ging verloren. Lade die .mq5-Datei oben auf dieser Seite erneut herunter, überschreibe die alte im Ordner Experts, kompiliere neu (F7) und starte den EA neu: Die letzten 90 Tage werden erneut gesendet und die fehlenden Trades tauchen wieder auf.",
      },
      {
        problem: "Ich habe meinen Token neu erzeugt",
        fix: "Beim Neuerzeugen wird der alte Token sofort ungültig. Öffne die Eigenschaften des Expert Advisors auf deinem Chart und füge den neuen Token in SyncToken ein.",
      },
    ],
    notes: [
      "TradeDiscipline zeigt den Netto-P&L (inklusive Kommissionen und Swaps). Der Betrag kann daher vom Bruttogewinn in MetaTrader abweichen.",
      "Der Expert Advisor liest ausschließlich deine Historie. Er eröffnet, ändert und schließt keine Position.",
    ],
  },
};

export default guide;
