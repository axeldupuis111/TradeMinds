import type { GuideContent } from "./types";

// Rail push TradingView (webhook d'alerte). Rien à installer, mais deux
// conditions non évidentes : il faut un abonnement payant pour les webhooks, et
// l'alerte doit porter sur la STRATÉGIE avec « alert() function calls only ».

const guide: GuideContent = {
  fr: {
    before: [
      "Un abonnement TradingView payant (Essential ou supérieur) : les webhooks d'alerte n'existent pas dans le plan gratuit.",
      "Une stratégie Pine (script commençant par strategy(...)), pas un simple indicateur.",
      "Rien à installer et rien à laisser ouvert : TradingView appelle nos serveurs directement.",
    ],
    steps: [
      {
        title: "Copie ton URL de webhook",
        detail:
          "Utilise le bouton « Copier » au-dessus de ce guide. Cette URL contient ton token : ne la partage avec personne. Si le champ est vide, génère d'abord ton token dans la section MetaTrader plus haut.",
      },
      {
        title: "Ajoute le snippet à ta stratégie",
        detail:
          "Télécharge le fichier .pine avec le bouton ci-dessus et ouvre-le dans le Bloc-notes. Dans TradingView, ouvre ta stratégie dans l'éditeur Pine, place le curseur tout en bas du script et colle le bloc. Clique sur « Enregistrer » puis sur « Ajouter au graphique ».",
        check: "La stratégie se recharge sur le graphique sans erreur rouge dans la console Pine.",
      },
      {
        title: "Crée l'alerte sur la stratégie",
        detail:
          "Clique sur l'icône réveil « Alerte » en haut du graphique. Dans le champ « Condition », choisis le nom de ta stratégie (pas l'indicateur, pas le symbole) et sélectionne « alert() function calls only ».",
        check:
          "Le champ Condition affiche bien le nom de ta stratégie suivi de « alert() function calls only ».",
      },
      {
        title: "Colle l'URL dans l'onglet Notifications",
        detail:
          "Toujours dans la fenêtre d'alerte, ouvre l'onglet « Notifications ». Coche « Webhook URL » et colle l'URL copiée à l'étape 1. Ne touche pas au champ Message : le snippet s'occupe du contenu.",
        check: "La case Webhook URL est cochée et l'URL collée commence par https://www.tradediscipline.app.",
      },
      {
        title: "Crée l'alerte",
        detail: "Clique sur « Créer ». L'alerte apparaît dans ton panneau d'alertes TradingView.",
        check:
          "Au prochain trade clôturé par ta stratégie, il apparaît dans « Mes Trades » en quelques secondes, avec le P&L calculé par TradingView.",
      },
    ],
    fixes: [
      {
        problem: "L'option « Webhook URL » est grisée",
        fix: "Les webhooks demandent un abonnement TradingView payant (Essential ou supérieur). Sur le plan gratuit, l'option reste inaccessible.",
      },
      {
        problem: "L'alerte se déclenche mais rien n'arrive",
        fix: "Dans neuf cas sur dix, l'alerte a été créée sur l'indicateur au lieu de la stratégie, ou la condition n'est pas « alert() function calls only ». Supprime l'alerte et recrée-la en suivant l'étape 3.",
      },
      {
        problem: "L'alerte a cessé de fonctionner au bout de quelques semaines",
        fix: "TradingView fait expirer les alertes après un certain temps selon ton abonnement. Rouvre le panneau d'alertes et relance-la, ou recrée-la.",
      },
      {
        problem: "Je ne vois pas où coller le snippet",
        fix: "Le bloc se colle à la toute fin de ton script Pine, après ta logique de stratégie. Il n'y a rien à modifier dedans.",
      },
    ],
    notes: [
      "Le P&L envoyé est celui calculé par TradingView, dans la devise du compte de la stratégie.",
      "Tu peux aussi envoyer ton propre JSON sur cette URL, avec les champs : symbol, direction, volume, entry_price, exit_price, profit.",
    ],
  },

  en: {
    before: [
      "A paid TradingView plan (Essential or above): alert webhooks do not exist on the free plan.",
      "A Pine strategy (a script starting with strategy(...)), not a plain indicator.",
      "Nothing to install and nothing to keep open: TradingView calls our servers directly.",
    ],
    steps: [
      {
        title: "Copy your webhook URL",
        detail:
          "Use the « Copy » button above this guide. This URL contains your token: do not share it with anyone. If the field is empty, generate your token first in the MetaTrader section above.",
      },
      {
        title: "Add the snippet to your strategy",
        detail:
          "Download the .pine file with the button above and open it in Notepad. In TradingView, open your strategy in the Pine editor, put the cursor at the very bottom of the script and paste the block. Click « Save » then « Add to chart ».",
        check: "The strategy reloads on the chart with no red error in the Pine console.",
      },
      {
        title: "Create the alert on the strategy",
        detail:
          "Click the « Alert » clock icon at the top of the chart. In the « Condition » field, pick your strategy name (not the indicator, not the symbol) and select « alert() function calls only ».",
        check: "The Condition field shows your strategy name followed by « alert() function calls only ».",
      },
      {
        title: "Paste the URL in the Notifications tab",
        detail:
          "Still in the alert window, open the « Notifications » tab. Tick « Webhook URL » and paste the URL you copied in step 1. Leave the Message field alone: the snippet handles the payload.",
        check: "The Webhook URL box is ticked and the pasted URL starts with https://www.tradediscipline.app.",
      },
      {
        title: "Create the alert",
        detail: "Click « Create ». The alert shows up in your TradingView alerts panel.",
        check:
          "On the next trade your strategy closes, it appears in « My Trades » within seconds, with the P&L computed by TradingView.",
      },
    ],
    fixes: [
      {
        problem: "The « Webhook URL » option is greyed out",
        fix: "Webhooks require a paid TradingView plan (Essential or above). On the free plan the option stays locked.",
      },
      {
        problem: "The alert fires but nothing arrives",
        fix: "Nine times out of ten the alert was created on the indicator instead of the strategy, or the condition is not « alert() function calls only ». Delete the alert and recreate it following step 3.",
      },
      {
        problem: "The alert stopped working after a few weeks",
        fix: "TradingView expires alerts after a while depending on your plan. Reopen the alerts panel and restart it, or recreate it.",
      },
      {
        problem: "I cannot tell where to paste the snippet",
        fix: "The block goes at the very end of your Pine script, after your strategy logic. There is nothing to edit inside it.",
      },
    ],
    notes: [
      "The P&L sent is the one computed by TradingView, in the strategy account currency.",
      "You can also post your own JSON to this URL, with the fields: symbol, direction, volume, entry_price, exit_price, profit.",
    ],
  },

  es: {
    before: [
      "Una suscripción de pago de TradingView (Essential o superior): los webhooks de alerta no existen en el plan gratuito.",
      "Una estrategia Pine (un script que empieza por strategy(...)), no un simple indicador.",
      "Nada que instalar ni que dejar abierto: TradingView llama a nuestros servidores directamente.",
    ],
    steps: [
      {
        title: "Copia tu URL de webhook",
        detail:
          "Usa el botón « Copiar » encima de esta guía. Esta URL contiene tu token: no la compartas con nadie. Si el campo está vacío, genera primero tu token en la sección MetaTrader de arriba.",
      },
      {
        title: "Añade el snippet a tu estrategia",
        detail:
          "Descarga el archivo .pine con el botón de arriba y ábrelo en el Bloc de notas. En TradingView abre tu estrategia en el editor Pine, coloca el cursor al final del script y pega el bloque. Pulsa « Guardar » y luego « Añadir al gráfico ».",
        check: "La estrategia se recarga en el gráfico sin errores rojos en la consola de Pine.",
      },
      {
        title: "Crea la alerta sobre la estrategia",
        detail:
          "Pulsa el icono de despertador « Alerta » en la parte superior del gráfico. En el campo « Condición » elige el nombre de tu estrategia (no el indicador, no el símbolo) y selecciona « alert() function calls only ».",
        check: "El campo Condición muestra el nombre de tu estrategia seguido de « alert() function calls only ».",
      },
      {
        title: "Pega la URL en la pestaña Notificaciones",
        detail:
          "Sin salir de la ventana de alerta, abre la pestaña « Notificaciones ». Marca « Webhook URL » y pega la URL copiada en el paso 1. No toques el campo Mensaje: del contenido se encarga el snippet.",
        check: "La casilla Webhook URL está marcada y la URL pegada empieza por https://www.tradediscipline.app.",
      },
      {
        title: "Crea la alerta",
        detail: "Pulsa « Crear ». La alerta aparece en tu panel de alertas de TradingView.",
        check:
          "En la siguiente operación que cierre tu estrategia, aparece en « Mis Trades » en unos segundos, con el P&L calculado por TradingView.",
      },
    ],
    fixes: [
      {
        problem: "La opción « Webhook URL » está en gris",
        fix: "Los webhooks requieren una suscripción de pago de TradingView (Essential o superior). En el plan gratuito la opción sigue bloqueada.",
      },
      {
        problem: "La alerta salta pero no llega nada",
        fix: "Nueve de cada diez veces la alerta se creó sobre el indicador en vez de la estrategia, o la condición no es « alert() function calls only ». Borra la alerta y vuelve a crearla siguiendo el paso 3.",
      },
      {
        problem: "La alerta dejó de funcionar tras unas semanas",
        fix: "TradingView caduca las alertas pasado un tiempo según tu plan. Vuelve al panel de alertas y reactívala, o créala de nuevo.",
      },
      {
        problem: "No sé dónde pegar el snippet",
        fix: "El bloque va al final del todo de tu script Pine, después de la lógica de tu estrategia. No hay que modificar nada dentro.",
      },
    ],
    notes: [
      "El P&L enviado es el que calcula TradingView, en la divisa de la cuenta de la estrategia.",
      "También puedes enviar tu propio JSON a esta URL, con los campos: symbol, direction, volume, entry_price, exit_price, profit.",
    ],
  },

  de: {
    before: [
      "Ein kostenpflichtiges TradingView-Abo (Essential oder höher): Alert-Webhooks gibt es im Gratis-Plan nicht.",
      "Eine Pine-Strategie (ein Skript, das mit strategy(...) beginnt), kein einfacher Indikator.",
      "Nichts zu installieren und nichts offen zu lassen: TradingView ruft unsere Server direkt auf.",
    ],
    steps: [
      {
        title: "Webhook-URL kopieren",
        detail:
          "Nutze den Button « Kopieren » oberhalb dieser Anleitung. Diese URL enthält deinen Token: Gib sie an niemanden weiter. Ist das Feld leer, erzeuge zuerst deinen Token im MetaTrader-Abschnitt oben.",
      },
      {
        title: "Snippet in die Strategie einfügen",
        detail:
          "Lade die .pine-Datei über den Button oben herunter und öffne sie im Editor. Öffne in TradingView deine Strategie im Pine-Editor, setze den Cursor ganz ans Ende des Skripts und füge den Block ein. Klicke auf « Speichern » und dann « Zum Chart hinzufügen ».",
        check: "Die Strategie lädt im Chart neu, ohne roten Fehler in der Pine-Konsole.",
      },
      {
        title: "Alarm auf die Strategie erstellen",
        detail:
          "Klicke oben im Chart auf das Wecker-Symbol « Alarm ». Wähle im Feld « Bedingung » den Namen deiner Strategie (nicht den Indikator, nicht das Symbol) und dann « alert() function calls only ».",
        check: "Im Feld Bedingung steht dein Strategiename gefolgt von « alert() function calls only ».",
      },
      {
        title: "URL im Reiter Benachrichtigungen einfügen",
        detail:
          "Öffne im selben Alarmfenster den Reiter « Benachrichtigungen ». Setze den Haken bei « Webhook-URL » und füge die in Schritt 1 kopierte URL ein. Das Feld Nachricht bleibt unverändert: Den Inhalt übernimmt das Snippet.",
        check: "Der Haken bei Webhook-URL ist gesetzt und die eingefügte URL beginnt mit https://www.tradediscipline.app.",
      },
      {
        title: "Alarm erstellen",
        detail: "Klicke auf « Erstellen ». Der Alarm erscheint in deiner TradingView-Alarmliste.",
        check:
          "Beim nächsten von deiner Strategie geschlossenen Trade erscheint er innerhalb von Sekunden unter « Meine Trades », mit dem von TradingView berechneten P&L.",
      },
    ],
    fixes: [
      {
        problem: "Die Option « Webhook-URL » ist ausgegraut",
        fix: "Webhooks erfordern ein kostenpflichtiges TradingView-Abo (Essential oder höher). Im Gratis-Plan bleibt die Option gesperrt.",
      },
      {
        problem: "Der Alarm löst aus, aber nichts kommt an",
        fix: "In neun von zehn Fällen wurde der Alarm auf den Indikator statt auf die Strategie gelegt, oder die Bedingung ist nicht « alert() function calls only ». Lösche den Alarm und erstelle ihn nach Schritt 3 neu.",
      },
      {
        problem: "Der Alarm hat nach ein paar Wochen aufgehört zu funktionieren",
        fix: "TradingView lässt Alarme je nach Abo nach einiger Zeit ablaufen. Öffne die Alarmliste und starte ihn neu oder lege ihn neu an.",
      },
      {
        problem: "Ich weiß nicht, wo das Snippet hin soll",
        fix: "Der Block kommt ganz ans Ende deines Pine-Skripts, nach deiner Strategielogik. Darin ist nichts anzupassen.",
      },
    ],
    notes: [
      "Der gesendete P&L ist der von TradingView berechnete, in der Kontowährung der Strategie.",
      "Du kannst auch eigenes JSON an diese URL senden, mit den Feldern: symbol, direction, volume, entry_price, exit_price, profit.",
    ],
  },
};

export default guide;
