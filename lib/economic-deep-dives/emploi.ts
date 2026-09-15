import type { DeepDiveRecord } from "./types";

/** Emploi : NFP, ADP, chômage, inscriptions hebdomadaires, salaires, JOLTS. */
export const EMPLOI: Record<string, DeepDiveRecord> = {
  nfp: {
    fr: {
      sections: [
        {
          heading: "D'où sort le chiffre",
          body: "Chaque mois, le Bureau of Labor Statistics interroge environ 120 000 entreprises et administrations américaines sur le nombre de salariés présents sur leur feuille de paie durant la semaine du 12. Le total est publié le premier vendredi du mois suivant à 14h30 (heure de Paris). L'agriculture en est exclue, d'où le nom : son emploi saisonnier rendrait la série impossible à comparer d'un mois à l'autre.",
        },
        {
          heading: "Ce n'est pas le chiffre qui compte, c'est l'écart",
          body: "Le consensus des analystes est connu d'avance et déjà dans les prix. Seule la SURPRISE bouge le marché : 20 000 emplois d'écart passent inaperçus, 150 000 provoquent en quelques secondes un mouvement de plusieurs dizaines de points sur les indices américains et de 50 à 100 pips sur l'EUR/USD. Un très bon chiffre peut donc faire baisser le marché, et un mauvais le faire monter : tout dépend de ce qui était attendu.",
        },
        {
          heading: "Trois données tombent en même temps",
          body: "Le rapport publie simultanément les créations d'emplois, le taux de chômage et le salaire horaire moyen, et ces trois-là peuvent se contredire (beaucoup d'emplois créés mais des salaires atones, par exemple). S'y ajoutent les révisions des deux mois précédents, qui effacent parfois la surprise du jour. C'est pour cela que le premier mouvement s'inverse si souvent dans le quart d'heure : le marché lit le titre, puis le détail.",
        },
        {
          heading: "La chaîne complète, à avoir en tête",
          body: "La Fed a deux mandats : le plein emploi et la stabilité des prix. Un marché du travail très tendu pousse les salaires, donc l'inflation, donc des taux élevés plus longtemps. Emploi solide → taux élevés → dollar soutenu, or sous pression, actions pénalisées par le coût de l'argent. Un emploi qui s'effondre inverse la chaîne, mais fait entrer la peur de la récession, qui pèse elle aussi sur les actions.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Nettement au-dessus du consensus",
          body: "Le dollar monte, l'or et les obligations baissent. Les indices réagissent dans les deux sens : l'économie va bien (bon pour les bénéfices) mais les taux resteront hauts (mauvais pour les valorisations). Le mouvement du dollar est le plus lisible des trois.",
        },
        {
          tone: "down",
          label: "Nettement en dessous du consensus",
          body: "Le dollar baisse, l'or et les obligations montent. Les indices apprécient la perspective de baisses de taux, sauf si le chiffre est assez mauvais pour réveiller la crainte d'une récession : là, tout baisse ensemble.",
        },
        {
          tone: "neutral",
          label: "Conforme aux attentes",
          body: "Le marché se reporte immédiatement sur le salaire horaire et sur les révisions. Le mouvement est plus petit mais les spreads s'élargissent quand même : l'absence de surprise ne veut pas dire l'absence de volatilité.",
        },
      ],
      watch: [
        "Premier vendredi du mois, 14h30 heure de Paris (8h30 à New York).",
        "Les spreads s'élargissent une minute avant et après : un stop serré peut sauter sans que le prix ait vraiment bougé.",
        "Les révisions des deux mois précédents comptent autant que le chiffre du jour.",
        "Le premier mouvement s'inverse fréquemment dans les quinze minutes qui suivent.",
      ],
    },
    en: {
      sections: [
        {
          heading: "Where the number comes from",
          body: "Every month the Bureau of Labor Statistics surveys around 120,000 US businesses and government bodies about how many people were on their payroll during the week containing the 12th. The total is released on the first Friday of the following month at 8:30am New York time. Farming is excluded, hence the name: its seasonal hiring would make the series impossible to compare month to month.",
        },
        {
          heading: "The number doesn't matter, the gap does",
          body: "The analyst consensus is known in advance and already in the price. Only the SURPRISE moves markets: a 20,000 miss goes unnoticed, a 150,000 one produces tens of points on US indices and 50 to 100 pips on EUR/USD within seconds. A great number can therefore sell off, and a poor one rally: what counts is what was expected.",
        },
        {
          heading: "Three numbers land at once",
          body: "The report publishes job creation, the unemployment rate and average hourly earnings at the same moment, and they can contradict each other (plenty of new jobs but flat wages, say). Revisions to the previous two months land with them, and sometimes cancel out the day's surprise. That is why the first move so often reverses within fifteen minutes: the market reads the headline, then the detail.",
        },
        {
          heading: "The full chain, worth holding in your head",
          body: "The Fed has two mandates: maximum employment and price stability. A very tight labour market pushes wages, so inflation, so rates stay higher for longer. Strong jobs → higher rates → firmer dollar, softer gold, equities pressured by the cost of money. Collapsing jobs run the chain in reverse, but bring recession fear, which weighs on equities too.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Clearly above consensus",
          body: "The dollar rises, gold and bonds fall. Indices can go either way: the economy is healthy (good for earnings) but rates will stay high (bad for valuations). The dollar's move is the most readable of the three.",
        },
        {
          tone: "down",
          label: "Clearly below consensus",
          body: "The dollar falls, gold and bonds rise. Indices like the prospect of rate cuts, unless the print is bad enough to wake recession fear, in which case everything sells off together.",
        },
        {
          tone: "neutral",
          label: "In line with expectations",
          body: "The market switches straight to average hourly earnings and to the revisions. The move is smaller but spreads still widen: no surprise does not mean no volatility.",
        },
      ],
      watch: [
        "First Friday of the month, 8:30am New York time.",
        "Spreads widen a minute either side: a tight stop can be taken out without the price truly moving.",
        "Revisions to the previous two months matter as much as the headline.",
        "The first move frequently reverses within the following fifteen minutes.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Woher die Zahl kommt",
          body: "Das Bureau of Labor Statistics befragt monatlich rund 120.000 US-Unternehmen und Behörden, wie viele Beschäftigte in der Woche mit dem 12. auf der Lohnliste standen. Die Summe erscheint am ersten Freitag des Folgemonats um 14:30 Uhr MEZ. Die Landwirtschaft bleibt außen vor, daher der Name: ihre Saisonarbeit würde die Reihe von Monat zu Monat unvergleichbar machen.",
        },
        {
          heading: "Nicht die Zahl zählt, sondern die Abweichung",
          body: "Der Analystenkonsens ist vorher bekannt und bereits eingepreist. Nur die ÜBERRASCHUNG bewegt den Markt: 20.000 Abweichung fallen niemandem auf, 150.000 erzeugen binnen Sekunden zweistellige Punktbewegungen in den US-Indizes und 50 bis 100 Pips im EUR/USD. Eine sehr gute Zahl kann den Markt also fallen lassen und eine schlechte ihn heben: entscheidend ist, was erwartet wurde.",
        },
        {
          heading: "Drei Zahlen auf einmal",
          body: "Der Bericht liefert Stellenaufbau, Arbeitslosenquote und Durchschnittsstundenlohn im selben Moment, und sie können sich widersprechen (viele neue Stellen, aber flaue Löhne). Dazu kommen die Revisionen der beiden Vormonate, die die Überraschung des Tages manchmal aufheben. Deshalb dreht die erste Bewegung so oft innerhalb einer Viertelstunde: der Markt liest die Schlagzeile, dann das Detail.",
        },
        {
          heading: "Die ganze Kette",
          body: "Die Fed hat zwei Mandate: Vollbeschäftigung und Preisstabilität. Ein sehr angespannter Arbeitsmarkt treibt die Löhne, damit die Inflation, damit bleiben die Zinsen länger hoch. Starker Arbeitsmarkt → hohe Zinsen → fester Dollar, schwächeres Gold, Aktien unter Druck. Ein einbrechender Arbeitsmarkt dreht die Kette um, weckt aber die Rezessionsangst, die ebenfalls auf Aktien lastet.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Deutlich über dem Konsens",
          body: "Der Dollar steigt, Gold und Anleihen fallen. Indizes können in beide Richtungen: die Wirtschaft läuft (gut für Gewinne), aber die Zinsen bleiben hoch (schlecht für Bewertungen). Die Dollarbewegung ist von den dreien am klarsten.",
        },
        {
          tone: "down",
          label: "Deutlich unter dem Konsens",
          body: "Der Dollar fällt, Gold und Anleihen steigen. Indizes mögen die Aussicht auf Zinssenkungen, außer die Zahl ist schlecht genug für Rezessionsangst: dann fällt alles zusammen.",
        },
        {
          tone: "neutral",
          label: "Im Rahmen der Erwartungen",
          body: "Der Markt springt sofort zu den Stundenlöhnen und den Revisionen. Die Bewegung ist kleiner, die Spreads weiten sich trotzdem: keine Überraschung heißt nicht keine Volatilität.",
        },
      ],
      watch: [
        "Erster Freitag im Monat, 14:30 Uhr MEZ (8:30 Uhr in New York).",
        "Die Spreads weiten sich eine Minute davor und danach: ein enger Stop fliegt, ohne dass der Kurs wirklich gelaufen ist.",
        "Die Revisionen der beiden Vormonate zählen so viel wie die aktuelle Zahl.",
        "Die erste Bewegung dreht häufig innerhalb der folgenden fünfzehn Minuten.",
      ],
    },
    es: {
      sections: [
        {
          heading: "De dónde sale el dato",
          body: "Cada mes la Oficina de Estadísticas Laborales pregunta a unas 120.000 empresas y administraciones de EE. UU. cuántos empleados figuraban en nómina durante la semana del día 12. El total se publica el primer viernes del mes siguiente a las 8:30 de Nueva York. La agricultura queda fuera, de ahí el nombre: su empleo estacional haría imposible comparar la serie de un mes a otro.",
        },
        {
          heading: "No importa el dato, importa la diferencia",
          body: "El consenso de los analistas se conoce de antemano y ya está en el precio. Solo la SORPRESA mueve el mercado: 20.000 de diferencia pasan inadvertidos, 150.000 provocan en segundos decenas de puntos en los índices de EE. UU. y de 50 a 100 pips en el EUR/USD. Un dato excelente puede por tanto hacer caer el mercado, y uno malo hacerlo subir: lo que cuenta es lo que se esperaba.",
        },
        {
          heading: "Tres datos llegan a la vez",
          body: "El informe publica a la vez la creación de empleo, la tasa de paro y el salario por hora, y pueden contradecirse (mucho empleo nuevo pero salarios planos). Se añaden las revisiones de los dos meses anteriores, que a veces anulan la sorpresa del día. Por eso el primer movimiento se da la vuelta tan a menudo en un cuarto de hora: el mercado lee el titular y después el detalle.",
        },
        {
          heading: "La cadena completa",
          body: "La Fed tiene dos mandatos: pleno empleo y estabilidad de precios. Un mercado laboral muy tenso empuja los salarios, por tanto la inflación, por tanto los tipos se quedan altos más tiempo. Empleo fuerte → tipos altos → dólar firme, oro presionado, bolsa castigada por el coste del dinero. Un empleo que se hunde invierte la cadena, pero despierta el miedo a la recesión, que también pesa sobre la bolsa.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Claramente por encima del consenso",
          body: "El dólar sube, el oro y los bonos bajan. Los índices pueden ir en ambos sentidos: la economía va bien (bueno para los beneficios) pero los tipos seguirán altos (malo para las valoraciones). El movimiento del dólar es el más legible de los tres.",
        },
        {
          tone: "down",
          label: "Claramente por debajo del consenso",
          body: "El dólar baja, el oro y los bonos suben. A los índices les gusta la perspectiva de bajadas de tipos, salvo que el dato sea lo bastante malo como para despertar el miedo a la recesión: entonces cae todo junto.",
        },
        {
          tone: "neutral",
          label: "En línea con lo esperado",
          body: "El mercado pasa de inmediato al salario por hora y a las revisiones. El movimiento es menor pero los spreads se abren igual: que no haya sorpresa no significa que no haya volatilidad.",
        },
      ],
      watch: [
        "Primer viernes del mes, 8:30 de Nueva York (14:30 en España).",
        "Los spreads se abren un minuto antes y después: un stop ajustado salta sin que el precio se haya movido de verdad.",
        "Las revisiones de los dos meses anteriores cuentan tanto como el dato del día.",
        "El primer movimiento se invierte con frecuencia en los quince minutos siguientes.",
      ],
    },
  },

  adp: {
    fr: {
      sections: [
        {
          heading: "Une mesure privée, pas officielle",
          body: "ADP est le plus gros gestionnaire de paie américain : il voit passer les bulletins de salaire de plus de 25 millions de salariés du privé. Il en tire une estimation mensuelle des créations d'emplois, publiée le mercredi qui précède le NFP, à 14h15 heure de Paris. Ce n'est pas une statistique officielle, c'est la lecture d'un acteur privé sur son propre fichier.",
        },
        {
          heading: "Pourquoi le marché la regarde quand même",
          body: "Elle arrive deux jours avant le rapport officiel et sert de répétition générale : le marché ajuste ses attentes pour le vendredi. La réaction immédiate est réelle mais bien plus courte que sur le NFP, et elle se limite souvent au dollar et aux futures indices.",
        },
        {
          heading: "Sa limite, qui est sérieuse",
          body: "La corrélation mois par mois avec le NFP est médiocre : ADP peut afficher un chiffre très fort et le rapport officiel décevoir deux jours plus tard, parce que les deux ne mesurent pas la même chose (ADP ignore le secteur public et utilise sa propre méthode). Traiter ADP comme une prédiction fiable du NFP est l'erreur classique du débutant.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Au-dessus des attentes",
          body: "Le dollar se renforce brièvement, les attentes pour le NFP du vendredi sont revues à la hausse. Mouvement généralement modéré et vite digéré.",
        },
        {
          tone: "down",
          label: "En dessous des attentes",
          body: "Le dollar se détend, l'or reprend un peu. Le marché commence à craindre un NFP faible, ce qui prépare une réaction plus violente le vendredi.",
        },
      ],
      watch: [
        "Mercredi précédant le NFP, 14h15 heure de Paris.",
        "Volatilité réelle mais courte : quelques minutes, pas une séance.",
        "Ne l'utilise jamais comme prédiction du NFP : la corrélation mensuelle est faible.",
      ],
    },
    en: {
      sections: [
        {
          heading: "A private read, not an official one",
          body: "ADP is the largest US payroll processor: it sees the pay slips of more than 25 million private-sector employees. From that it builds a monthly estimate of job creation, released on the Wednesday before the NFP at 8:15am New York time. This is not an official statistic, it is one private company's reading of its own book.",
        },
        {
          heading: "Why the market watches it anyway",
          body: "It lands two days before the official report and acts as a dress rehearsal: the market adjusts its expectations for Friday. The immediate reaction is real but far shorter than on NFP day, and it is often confined to the dollar and index futures.",
        },
        {
          heading: "Its limit, and it is a serious one",
          body: "Month-to-month correlation with the NFP is poor: ADP can print very strong and the official report disappoint two days later, because the two do not measure the same thing (ADP excludes the public sector and uses its own method). Treating ADP as a reliable forecast of the NFP is the classic beginner's mistake.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Above expectations",
          body: "The dollar firms briefly and Friday's NFP expectations are revised higher. Usually a moderate move, quickly digested.",
        },
        {
          tone: "down",
          label: "Below expectations",
          body: "The dollar eases, gold picks up a little. The market starts to fear a weak NFP, which sets up a sharper reaction on Friday.",
        },
      ],
      watch: [
        "The Wednesday before NFP, 8:15am New York time.",
        "Real but short-lived volatility: minutes, not a session.",
        "Never use it as an NFP forecast: the month-to-month correlation is weak.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Eine private, keine amtliche Messung",
          body: "ADP ist der größte US-Lohnabrechner und sieht die Abrechnungen von über 25 Millionen Beschäftigten der Privatwirtschaft. Daraus entsteht eine monatliche Schätzung des Stellenaufbaus, veröffentlicht am Mittwoch vor den NFP um 14:15 Uhr MEZ. Das ist keine amtliche Statistik, sondern die Lesart eines privaten Anbieters auf seinem eigenen Bestand.",
        },
        {
          heading: "Warum der Markt trotzdem hinschaut",
          body: "Sie kommt zwei Tage vor dem offiziellen Bericht und dient als Generalprobe: der Markt justiert seine Erwartungen für Freitag. Die sofortige Reaktion ist real, aber deutlich kürzer als bei den NFP, und beschränkt sich oft auf Dollar und Index-Futures.",
        },
        {
          heading: "Die Grenze, und sie ist ernst",
          body: "Die Korrelation von Monat zu Monat mit den NFP ist schwach: ADP kann sehr stark ausfallen und der offizielle Bericht zwei Tage später enttäuschen, weil beide nicht dasselbe messen (ADP lässt den öffentlichen Sektor außen vor und nutzt eine eigene Methode). ADP als verlässliche NFP-Prognose zu behandeln ist der klassische Anfängerfehler.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Über den Erwartungen",
          body: "Der Dollar zieht kurz an, die NFP-Erwartungen für Freitag werden angehoben. Meist moderate Bewegung, schnell verdaut.",
        },
        {
          tone: "down",
          label: "Unter den Erwartungen",
          body: "Der Dollar gibt nach, Gold erholt sich etwas. Der Markt fürchtet schwache NFP, was am Freitag eine heftigere Reaktion vorbereitet.",
        },
      ],
      watch: [
        "Mittwoch vor den NFP, 14:15 Uhr MEZ.",
        "Echte, aber kurze Volatilität: Minuten, keine ganze Sitzung.",
        "Nie als NFP-Prognose verwenden: die monatliche Korrelation ist schwach.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Una medida privada, no oficial",
          body: "ADP es la mayor gestora de nóminas de EE. UU.: ve las nóminas de más de 25 millones de empleados del sector privado. De ahí saca una estimación mensual de creación de empleo, publicada el miércoles anterior a las NFP a las 8:15 de Nueva York. No es una estadística oficial, es la lectura de una empresa privada sobre su propia cartera.",
        },
        {
          heading: "Por qué el mercado la mira igualmente",
          body: "Llega dos días antes del informe oficial y sirve de ensayo general: el mercado ajusta sus expectativas para el viernes. La reacción inmediata existe pero es mucho más corta que con las NFP, y suele limitarse al dólar y a los futuros de índices.",
        },
        {
          heading: "Su límite, que es serio",
          body: "La correlación mes a mes con las NFP es mediocre: ADP puede salir muy fuerte y el informe oficial decepcionar dos días después, porque no miden lo mismo (ADP excluye el sector público y usa su propio método). Tratar ADP como una predicción fiable de las NFP es el error clásico del principiante.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Por encima de lo esperado",
          body: "El dólar se refuerza brevemente y las expectativas para las NFP del viernes suben. Movimiento normalmente moderado y digerido rápido.",
        },
        {
          tone: "down",
          label: "Por debajo de lo esperado",
          body: "El dólar se relaja y el oro recupera algo. El mercado empieza a temer unas NFP débiles, lo que prepara una reacción más violenta el viernes.",
        },
      ],
      watch: [
        "Miércoles anterior a las NFP, 8:15 de Nueva York.",
        "Volatilidad real pero corta: minutos, no una sesión.",
        "Nunca la uses como predicción de las NFP: la correlación mensual es débil.",
      ],
    },
  },

  unemployment_rate: {
    fr: {
      sections: [
        {
          heading: "Ce que le taux compte vraiment",
          body: "Le taux de chômage rapporte le nombre de personnes sans emploi ET qui en cherchent activement à la population active totale. Une personne qui abandonne ses recherches sort du calcul : elle n'est plus comptée comme chômeuse. C'est la subtilité qui explique qu'un taux puisse baisser pour une mauvaise raison, parce que des gens ont renoncé plutôt que trouvé.",
        },
        {
          heading: "Pourquoi il bouge peu, et pourquoi ça compte quand il bouge",
          body: "Le taux évolue par dixièmes de point et sa publication surprend rarement. Mais son niveau est un repère politique : la Fed le surveille comme thermomètre du plein emploi, et une remontée de plusieurs dixièmes en quelques mois a historiquement annoncé les retournements de cycle.",
        },
        {
          heading: "Toujours lu avec le reste du rapport",
          body: "Il sort en même temps que le NFP et les salaires. Quand les deux se contredisent (emplois créés mais chômage en hausse), le marché hésite, fait un aller-retour, puis tranche en faveur de ce qui compte le plus pour les taux à ce moment du cycle : l'inflation quand elle est le problème, l'emploi quand la récession l'est.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Taux plus haut qu'attendu",
          body: "Marché du travail qui se détend : le dollar baisse, les attentes de baisse de taux montent, l'or se renforce. Au-delà d'un certain seuil, la crainte de récession prend le dessus et les indices baissent aussi.",
        },
        {
          tone: "up",
          label: "Taux plus bas qu'attendu",
          body: "Marché du travail tendu : le dollar se renforce et les paris sur une baisse de taux reculent. Vérifie toujours si la baisse vient de créations d'emplois ou d'un recul de la population active.",
        },
      ],
      watch: [
        "Publié avec le NFP, premier vendredi du mois.",
        "Un dixième de point d'écart suffit à faire réagir le marché.",
        "Un taux qui baisse parce que des gens ont cessé de chercher n'est pas une bonne nouvelle.",
      ],
    },
    en: {
      sections: [
        {
          heading: "What the rate actually counts",
          body: "The unemployment rate divides the number of people without a job AND actively looking for one by the total labour force. Someone who stops looking drops out of the calculation entirely: they are no longer counted as unemployed. That subtlety is why the rate can fall for a bad reason, because people gave up rather than found work.",
        },
        {
          heading: "Why it barely moves, and why that matters when it does",
          body: "The rate moves in tenths of a point and rarely surprises. But its level is a policy landmark: the Fed watches it as its thermometer for full employment, and a rise of several tenths within a few months has historically flagged turns in the cycle.",
        },
        {
          heading: "Always read with the rest of the report",
          body: "It lands with the NFP and wages. When they contradict each other (jobs created but unemployment up), the market hesitates, whipsaws, then settles on whatever matters most for rates at that point in the cycle: inflation when that is the problem, jobs when recession is.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Higher than expected",
          body: "A loosening labour market: the dollar falls, rate-cut expectations rise, gold firms. Past a certain point recession fear takes over and indices fall too.",
        },
        {
          tone: "up",
          label: "Lower than expected",
          body: "A tight labour market: the dollar firms and rate-cut bets are pared back. Always check whether the drop came from new jobs or from a shrinking labour force.",
        },
      ],
      watch: [
        "Released with the NFP, first Friday of the month.",
        "A single tenth of a point is enough to move the market.",
        "A rate falling because people stopped looking is not good news.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Was die Quote wirklich zählt",
          body: "Die Arbeitslosenquote setzt die Zahl der Menschen ohne Stelle, die aktiv suchen, ins Verhältnis zu allen Erwerbspersonen. Wer die Suche aufgibt, fällt aus der Rechnung: er gilt nicht mehr als arbeitslos. Deshalb kann die Quote aus einem schlechten Grund sinken, weil Menschen aufgegeben statt gefunden haben.",
        },
        {
          heading: "Warum sie kaum schwankt und das umso mehr zählt",
          body: "Die Quote bewegt sich in Zehntelpunkten und überrascht selten. Ihr Niveau ist aber ein politischer Orientierungspunkt: die Fed liest sie als Thermometer der Vollbeschäftigung, und ein Anstieg um mehrere Zehntel in wenigen Monaten hat historisch Wendepunkte im Zyklus angekündigt.",
        },
        {
          heading: "Immer mit dem übrigen Bericht lesen",
          body: "Sie kommt mit den NFP und den Löhnen. Widersprechen sie sich (Stellen geschaffen, aber Quote steigt), zögert der Markt, läuft hin und her und entscheidet sich dann für das, was gerade für die Zinsen zählt: die Inflation, wenn sie das Problem ist, der Arbeitsmarkt, wenn es die Rezession ist.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Höher als erwartet",
          body: "Der Arbeitsmarkt entspannt sich: der Dollar fällt, die Zinssenkungserwartungen steigen, Gold zieht an. Ab einem gewissen Punkt übernimmt die Rezessionsangst und auch die Indizes fallen.",
        },
        {
          tone: "up",
          label: "Niedriger als erwartet",
          body: "Angespannter Arbeitsmarkt: der Dollar zieht an, Wetten auf Zinssenkungen werden zurückgenommen. Prüfe immer, ob der Rückgang von neuen Stellen kommt oder von einer schrumpfenden Erwerbsbevölkerung.",
        },
      ],
      watch: [
        "Erscheint mit den NFP, erster Freitag im Monat.",
        "Ein Zehntelpunkt Abweichung reicht für eine Marktreaktion.",
        "Eine Quote, die sinkt, weil Menschen die Suche aufgaben, ist keine gute Nachricht.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Lo que la tasa cuenta de verdad",
          body: "La tasa de paro divide el número de personas sin empleo Y que lo buscan activamente entre la población activa total. Quien deja de buscar sale del cálculo: ya no cuenta como parado. Esa sutileza explica que la tasa pueda bajar por un mal motivo, porque hay gente que ha renunciado en vez de encontrar trabajo.",
        },
        {
          heading: "Por qué se mueve poco y por qué importa cuando se mueve",
          body: "La tasa avanza por décimas y rara vez sorprende. Pero su nivel es una referencia política: la Fed la vigila como termómetro del pleno empleo, y una subida de varias décimas en pocos meses ha anunciado históricamente los giros de ciclo.",
        },
        {
          heading: "Siempre se lee con el resto del informe",
          body: "Sale a la vez que las NFP y los salarios. Cuando se contradicen (empleo creado pero paro al alza), el mercado duda, va y vuelve, y luego se decanta por lo que más pesa en los tipos en ese momento del ciclo: la inflación cuando es el problema, el empleo cuando lo es la recesión.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Más alta de lo esperado",
          body: "Mercado laboral que se afloja: el dólar baja, suben las expectativas de bajada de tipos y el oro se refuerza. Pasado cierto umbral, domina el miedo a la recesión y los índices también caen.",
        },
        {
          tone: "up",
          label: "Más baja de lo esperado",
          body: "Mercado laboral tenso: el dólar se refuerza y las apuestas por bajadas de tipos retroceden. Comprueba siempre si la caída viene de empleo nuevo o de una población activa que se reduce.",
        },
      ],
      watch: [
        "Se publica con las NFP, primer viernes del mes.",
        "Una décima de diferencia basta para que el mercado reaccione.",
        "Una tasa que baja porque la gente dejó de buscar no es una buena noticia.",
      ],
    },
  },

  jobless_claims: {
    fr: {
      sections: [
        {
          heading: "La donnée la plus fraîche du calendrier",
          body: "Chaque jeudi à 14h30 (heure de Paris), le département du Travail publie le nombre de nouvelles demandes d'allocations chômage déposées la semaine précédente. Aucune autre statistique macro américaine n'est aussi récente : elle décrit la semaine qui vient de s'écouler, là où le NFP décrit un mois déjà terminé.",
        },
        {
          heading: "Une donnée bruyante qu'on lit en moyenne",
          body: "Le chiffre hebdomadaire saute dans tous les sens (météo, jours fériés, fermetures d'usines saisonnières). Les professionnels lisent surtout la moyenne mobile sur quatre semaines, qui filtre ce bruit. Une semaine isolée au-dessus des attentes ne dit presque rien ; trois semaines de hausse consécutives disent beaucoup.",
        },
        {
          heading: "Son rôle en période de doute",
          body: "En temps calme, elle ne fait pas bouger grand-chose. Quand le marché se demande si l'économie ralentit, elle devient le rendez-vous hebdomadaire le plus suivi : c'est le premier endroit où une dégradation de l'emploi devient visible, des semaines avant les rapports mensuels.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Demandes plus nombreuses que prévu",
          body: "Signe d'un emploi qui se fissure : le dollar recule, les obligations et l'or montent. Réaction amplifiée si la moyenne sur quatre semaines monte elle aussi.",
        },
        {
          tone: "up",
          label: "Demandes moins nombreuses que prévu",
          body: "Marché du travail résistant : le dollar se renforce modérément, les paris sur une baisse de taux reculent d'un cran.",
        },
      ],
      watch: [
        "Chaque jeudi, 14h30 heure de Paris.",
        "Lis la moyenne sur quatre semaines, pas la semaine isolée.",
        "Jours fériés et intempéries faussent régulièrement une semaine donnée.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The freshest data on the calendar",
          body: "Every Thursday at 8:30am New York time, the Labor Department publishes the number of new unemployment-benefit claims filed the previous week. No other US macro statistic is this recent: it describes the week just gone, where the NFP describes a month already over.",
        },
        {
          heading: "A noisy series you read as an average",
          body: "The weekly number jumps around (weather, public holidays, seasonal plant shutdowns). Professionals mostly read the four-week moving average, which filters that noise out. One week above expectations says almost nothing; three consecutive rising weeks say a lot.",
        },
        {
          heading: "Its role when the market is unsure",
          body: "In calm times it barely moves anything. When the market is asking whether the economy is slowing, it becomes the most-watched weekly event: it is the first place a deteriorating labour market becomes visible, weeks before the monthly reports.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "More claims than expected",
          body: "A sign the jobs market is cracking: the dollar slips, bonds and gold rise. The reaction is amplified if the four-week average is climbing too.",
        },
        {
          tone: "up",
          label: "Fewer claims than expected",
          body: "A resilient labour market: the dollar firms modestly and rate-cut bets are trimmed a notch.",
        },
      ],
      watch: [
        "Every Thursday, 8:30am New York time.",
        "Read the four-week average, not the single week.",
        "Holidays and bad weather regularly distort any given week.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Die frischeste Zahl im Kalender",
          body: "Jeden Donnerstag um 14:30 Uhr MEZ meldet das Arbeitsministerium die Zahl der in der Vorwoche neu gestellten Anträge auf Arbeitslosenunterstützung. Keine andere US-Makrozahl ist so aktuell: sie beschreibt die gerade vergangene Woche, während die NFP einen längst beendeten Monat beschreiben.",
        },
        {
          heading: "Eine verrauschte Reihe, die man als Durchschnitt liest",
          body: "Der Wochenwert springt stark (Wetter, Feiertage, saisonale Werksschließungen). Profis lesen vor allem den gleitenden Vierwochendurchschnitt, der dieses Rauschen filtert. Eine einzelne Woche über den Erwartungen sagt fast nichts; drei steigende Wochen in Folge sagen viel.",
        },
        {
          heading: "Ihre Rolle in Zweifelsphasen",
          body: "In ruhigen Zeiten bewegt sie wenig. Fragt sich der Markt, ob die Wirtschaft abkühlt, wird sie zum meistbeachteten Wochentermin: hier wird eine Verschlechterung am Arbeitsmarkt zuerst sichtbar, Wochen vor den Monatsberichten.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Mehr Anträge als erwartet",
          body: "Zeichen eines bröckelnden Arbeitsmarkts: der Dollar gibt nach, Anleihen und Gold steigen. Die Reaktion verstärkt sich, wenn auch der Vierwochenschnitt steigt.",
        },
        {
          tone: "up",
          label: "Weniger Anträge als erwartet",
          body: "Robuster Arbeitsmarkt: der Dollar zieht moderat an, Wetten auf Zinssenkungen werden etwas zurückgefahren.",
        },
      ],
      watch: [
        "Jeden Donnerstag, 14:30 Uhr MEZ.",
        "Lies den Vierwochendurchschnitt, nicht die einzelne Woche.",
        "Feiertage und Unwetter verzerren regelmäßig eine einzelne Woche.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El dato más fresco del calendario",
          body: "Cada jueves a las 8:30 de Nueva York, el Departamento de Trabajo publica el número de nuevas solicitudes de subsidio por desempleo de la semana anterior. Ninguna otra estadística macro de EE. UU. es tan reciente: describe la semana que acaba de pasar, mientras que las NFP describen un mes ya cerrado.",
        },
        {
          heading: "Un dato ruidoso que se lee en media",
          body: "La cifra semanal salta en todas direcciones (clima, festivos, cierres estacionales de fábricas). Los profesionales leen sobre todo la media móvil de cuatro semanas, que filtra ese ruido. Una semana aislada por encima de lo previsto no dice casi nada; tres semanas seguidas al alza dicen mucho.",
        },
        {
          heading: "Su papel en momentos de duda",
          body: "En tiempos tranquilos mueve poco. Cuando el mercado se pregunta si la economía se frena, se convierte en la cita semanal más seguida: es el primer sitio donde se ve un deterioro del empleo, semanas antes que en los informes mensuales.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Más solicitudes de lo previsto",
          body: "Señal de un empleo que se agrieta: el dólar retrocede, los bonos y el oro suben. La reacción se amplifica si la media de cuatro semanas también sube.",
        },
        {
          tone: "up",
          label: "Menos solicitudes de lo previsto",
          body: "Mercado laboral resistente: el dólar se refuerza con moderación y las apuestas por bajadas de tipos retroceden un punto.",
        },
      ],
      watch: [
        "Cada jueves, 8:30 de Nueva York.",
        "Lee la media de cuatro semanas, no la semana suelta.",
        "Los festivos y el mal tiempo distorsionan con frecuencia una semana concreta.",
      ],
    },
  },

  avg_hourly_earnings: {
    fr: {
      sections: [
        {
          heading: "Le lien direct entre emploi et inflation",
          body: "Cette ligne du rapport emploi mesure la variation du salaire horaire moyen dans le privé, en mensuel et en annuel. C'est le maillon qui relie le marché du travail à l'inflation : des salaires qui accélèrent financent la consommation, qui soutient les prix, ce qui oblige la banque centrale à rester ferme.",
        },
        {
          heading: "Pourquoi il vole parfois la vedette au NFP",
          body: "Quand l'inflation est le sujet du moment, le marché regarde d'abord les salaires. Un NFP très fort accompagné de salaires atones peut être lu comme une bonne nouvelle (croissance sans inflation) ; un NFP moyen avec des salaires en accélération franche fait bondir les taux. C'est le cas typique où le titre et le détail disent le contraire.",
        },
        {
          heading: "Le piège de composition",
          body: "La moyenne peut monter parce que les bas salaires disparaissent, pas parce que les salaires augmentent. Des licenciements massifs dans la restauration font mécaniquement grimper le salaire horaire moyen. Ce biais est bien connu des économistes et explique certaines lectures contre-intuitives.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Salaires en accélération",
          body: "Pression inflationniste : les taux attendus montent, le dollar se renforce, les indices et l'or souffrent. C'est souvent la donnée qui détermine la direction finale de la séance NFP.",
        },
        {
          tone: "down",
          label: "Salaires en ralentissement",
          body: "L'inflation se calme sans casser l'emploi : scénario favorable aux actions et aux obligations, défavorable au dollar.",
        },
      ],
      watch: [
        "Publié avec le NFP, premier vendredi du mois.",
        "Regarde la variation annuelle autant que la mensuelle : le mensuel est bruyant.",
        "Une hausse de la moyenne peut venir de licenciements dans les métiers peu payés.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The direct link between jobs and inflation",
          body: "This line of the employment report measures the change in average private-sector hourly pay, monthly and yearly. It is the link between the labour market and inflation: accelerating wages fund consumption, consumption supports prices, and that forces the central bank to stay firm.",
        },
        {
          heading: "Why it sometimes outranks the NFP",
          body: "When inflation is the story, the market looks at wages first. A very strong NFP with flat wages can read as good news (growth without inflation); an average NFP with sharply accelerating wages sends yields up. This is the classic case where the headline and the detail say opposite things.",
        },
        {
          heading: "The composition trap",
          body: "The average can rise because low-paid jobs disappeared, not because pay went up. Mass layoffs in hospitality mechanically lift average hourly earnings. Economists know this bias well, and it explains some counter-intuitive prints.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Wages accelerating",
          body: "Inflationary pressure: expected rates rise, the dollar firms, indices and gold suffer. This is often the number that decides the final direction of NFP day.",
        },
        {
          tone: "down",
          label: "Wages slowing",
          body: "Inflation cooling without breaking the jobs market: a favourable backdrop for equities and bonds, an unfavourable one for the dollar.",
        },
      ],
      watch: [
        "Released with the NFP, first Friday of the month.",
        "Watch the yearly change as much as the monthly one: monthly is noisy.",
        "A rising average can come from layoffs in low-paid work.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Die direkte Verbindung von Arbeitsmarkt und Inflation",
          body: "Diese Zeile des Arbeitsmarktberichts misst die Veränderung des durchschnittlichen Stundenlohns in der Privatwirtschaft, monatlich und jährlich. Sie ist das Bindeglied zwischen Arbeitsmarkt und Inflation: steigende Löhne finanzieren den Konsum, der Konsum stützt die Preise, und das zwingt die Notenbank zur Härte.",
        },
        {
          heading: "Warum sie den NFP manchmal die Schau stiehlt",
          body: "Wenn Inflation das Thema ist, schaut der Markt zuerst auf die Löhne. Sehr starke NFP mit flauen Löhnen lesen sich als gute Nachricht (Wachstum ohne Inflation); mittelmäßige NFP mit klar beschleunigten Löhnen treiben die Renditen. Der klassische Fall, in dem Schlagzeile und Detail Gegenteiliges sagen.",
        },
        {
          heading: "Die Zusammensetzungsfalle",
          body: "Der Durchschnitt kann steigen, weil niedrig bezahlte Stellen wegfielen, nicht weil Löhne stiegen. Massenentlassungen in der Gastronomie heben den Durchschnittslohn rein rechnerisch. Ökonomen kennen diesen Verzerrungseffekt gut, er erklärt manche widersprüchliche Zahl.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Löhne beschleunigen",
          body: "Inflationsdruck: die erwarteten Zinsen steigen, der Dollar zieht an, Indizes und Gold leiden. Oft entscheidet diese Zahl die endgültige Richtung des NFP-Tages.",
        },
        {
          tone: "down",
          label: "Löhne verlangsamen sich",
          body: "Die Inflation kühlt ab, ohne den Arbeitsmarkt zu brechen: günstig für Aktien und Anleihen, ungünstig für den Dollar.",
        },
      ],
      watch: [
        "Erscheint mit den NFP, erster Freitag im Monat.",
        "Achte auf die Jahres- ebenso wie auf die Monatsveränderung: der Monatswert ist verrauscht.",
        "Ein steigender Durchschnitt kann von Entlassungen in schlecht bezahlten Berufen kommen.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El vínculo directo entre empleo e inflación",
          body: "Esta línea del informe de empleo mide la variación del salario por hora en el sector privado, en mensual y en anual. Es el eslabón que une el mercado laboral con la inflación: unos salarios que aceleran financian el consumo, el consumo sostiene los precios y eso obliga al banco central a mantenerse firme.",
        },
        {
          heading: "Por qué a veces eclipsa a las NFP",
          body: "Cuando la inflación es el tema del momento, el mercado mira primero los salarios. Unas NFP muy fuertes con salarios planos se leen como buena noticia (crecimiento sin inflación); unas NFP normales con salarios acelerando con fuerza disparan los tipos. Es el caso típico en que el titular y el detalle dicen lo contrario.",
        },
        {
          heading: "La trampa de composición",
          body: "La media puede subir porque han desaparecido los empleos peor pagados, no porque suban los sueldos. Despidos masivos en hostelería elevan mecánicamente el salario medio por hora. Los economistas conocen bien este sesgo y explica algunas lecturas contraintuitivas.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Salarios acelerando",
          body: "Presión inflacionista: los tipos esperados suben, el dólar se refuerza, los índices y el oro sufren. Suele ser el dato que decide la dirección final de la sesión de las NFP.",
        },
        {
          tone: "down",
          label: "Salarios frenándose",
          body: "La inflación se calma sin romper el empleo: escenario favorable para bolsa y bonos, desfavorable para el dólar.",
        },
      ],
      watch: [
        "Se publica con las NFP, primer viernes del mes.",
        "Mira la variación anual tanto como la mensual: la mensual es ruidosa.",
        "Una subida de la media puede venir de despidos en los trabajos peor pagados.",
      ],
    },
  },

  jolts: {
    fr: {
      sections: [
        {
          heading: "Le nombre de postes ouverts, pas de postes pourvus",
          body: "L'enquête JOLTS compte les offres d'emploi non pourvues au dernier jour du mois, ainsi que les embauches, les démissions et les licenciements. Elle mesure donc la DEMANDE de travail des entreprises, là où le NFP mesure ce qui a été effectivement embauché.",
        },
        {
          heading: "Le ratio que surveille la banque centrale",
          body: "Le chiffre qui compte vraiment est le rapport entre postes ouverts et chômeurs. Quand il y a beaucoup plus de postes que de candidats, les entreprises doivent surenchérir sur les salaires : c'est la définition d'un marché du travail trop chaud, et la Fed l'a explicitement cité comme indicateur de sa politique.",
        },
        {
          heading: "Le taux de démission, un bon détecteur de confiance",
          body: "Le même rapport publie le taux de démission volontaire. On ne quitte pas son emploi quand on a peur de ne pas en retrouver : un taux élevé signale une confiance forte des salariés, un taux qui chute annonce souvent un retournement avant qu'il n'apparaisse dans le chômage.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Plus de postes ouverts qu'attendu",
          body: "Marché du travail tendu, pression salariale persistante : le dollar se renforce, les paris sur des baisses de taux reculent.",
        },
        {
          tone: "down",
          label: "Moins de postes ouverts qu'attendu",
          body: "La demande de travail se normalise : lecture favorable pour les obligations et les actions, défavorable pour le dollar. C'est souvent le premier signe visible d'un ralentissement en douceur.",
        },
      ],
      watch: [
        "Publié avec un mois de décalage : la donnée est ancienne, la réaction reste réelle.",
        "Le ratio postes ouverts par chômeur compte plus que le nombre brut.",
        "Regarde aussi le taux de démission, souvent plus parlant que le total.",
      ],
    },
    en: {
      sections: [
        {
          heading: "Openings, not hires",
          body: "The JOLTS survey counts job openings unfilled on the last day of the month, along with hires, quits and layoffs. It measures firms' DEMAND for labour, where the NFP measures who actually got hired.",
        },
        {
          heading: "The ratio the central bank watches",
          body: "The number that really counts is openings per unemployed worker. When there are far more openings than candidates, firms have to bid up wages: that is the definition of an overheated labour market, and the Fed has explicitly cited it as a policy gauge.",
        },
        {
          heading: "The quits rate, a good confidence detector",
          body: "The same report publishes the voluntary quits rate. People do not leave a job when they fear not finding another: a high rate signals strong worker confidence, and a falling rate often flags a turn before it shows up in unemployment.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "More openings than expected",
          body: "A tight labour market with persistent wage pressure: the dollar firms and rate-cut bets are pared back.",
        },
        {
          tone: "down",
          label: "Fewer openings than expected",
          body: "Labour demand is normalising: friendly for bonds and equities, unfriendly for the dollar. It is often the first visible sign of a soft slowdown.",
        },
      ],
      watch: [
        "Published with a month's lag: the data is old, the reaction is still real.",
        "Openings per unemployed worker matters more than the raw number.",
        "Check the quits rate too, often more telling than the total.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Offene Stellen, nicht besetzte",
          body: "Die JOLTS-Erhebung zählt die am letzten Tag des Monats unbesetzten Stellen sowie Einstellungen, Kündigungen und Entlassungen. Sie misst also die NACHFRAGE der Unternehmen nach Arbeit, während die NFP messen, wer tatsächlich eingestellt wurde.",
        },
        {
          heading: "Das Verhältnis, auf das die Notenbank schaut",
          body: "Entscheidend ist das Verhältnis offener Stellen je Arbeitslosem. Gibt es weit mehr Stellen als Bewerber, müssen Firmen bei den Löhnen überbieten: genau das ist ein überhitzter Arbeitsmarkt, und die Fed hat es ausdrücklich als Maßstab genannt.",
        },
        {
          heading: "Die Kündigungsquote als Vertrauensmesser",
          body: "Derselbe Bericht veröffentlicht die Quote freiwilliger Kündigungen. Niemand kündigt, wenn er fürchtet, nichts Neues zu finden: eine hohe Quote zeigt starkes Vertrauen der Beschäftigten, eine fallende kündigt oft eine Wende an, bevor sie in der Arbeitslosigkeit sichtbar wird.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Mehr offene Stellen als erwartet",
          body: "Angespannter Arbeitsmarkt mit anhaltendem Lohndruck: der Dollar zieht an, Wetten auf Zinssenkungen werden zurückgenommen.",
        },
        {
          tone: "down",
          label: "Weniger offene Stellen als erwartet",
          body: "Die Arbeitsnachfrage normalisiert sich: freundlich für Anleihen und Aktien, unfreundlich für den Dollar. Oft das erste sichtbare Zeichen einer sanften Abkühlung.",
        },
      ],
      watch: [
        "Erscheint mit einem Monat Verzögerung: die Daten sind alt, die Reaktion trotzdem echt.",
        "Offene Stellen je Arbeitslosem zählen mehr als die reine Zahl.",
        "Sieh dir auch die Kündigungsquote an, oft aussagekräftiger als die Summe.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Vacantes, no contrataciones",
          body: "La encuesta JOLTS cuenta las vacantes sin cubrir el último día del mes, además de contrataciones, dimisiones y despidos. Mide por tanto la DEMANDA de trabajo de las empresas, mientras que las NFP miden quién fue contratado de verdad.",
        },
        {
          heading: "El ratio que vigila el banco central",
          body: "La cifra que de verdad cuenta es la de vacantes por parado. Cuando hay muchas más vacantes que candidatos, las empresas tienen que pujar al alza por los salarios: esa es la definición de un mercado laboral recalentado, y la Fed lo ha citado explícitamente como indicador de su política.",
        },
        {
          heading: "La tasa de dimisiones, buen detector de confianza",
          body: "El mismo informe publica la tasa de dimisión voluntaria. Nadie deja su empleo si teme no encontrar otro: una tasa alta señala confianza fuerte de los trabajadores, y una tasa que se hunde suele anunciar un giro antes de que aparezca en el paro.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Más vacantes de lo esperado",
          body: "Mercado laboral tenso y presión salarial persistente: el dólar se refuerza y las apuestas por bajadas de tipos retroceden.",
        },
        {
          tone: "down",
          label: "Menos vacantes de lo esperado",
          body: "La demanda de trabajo se normaliza: lectura favorable para bonos y bolsa, desfavorable para el dólar. Suele ser la primera señal visible de una desaceleración suave.",
        },
      ],
      watch: [
        "Se publica con un mes de retraso: el dato es antiguo, la reacción sigue siendo real.",
        "El ratio de vacantes por parado importa más que la cifra bruta.",
        "Mira también la tasa de dimisiones, a menudo más elocuente que el total.",
      ],
    },
  },
};
