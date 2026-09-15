import type { DeepDiveRecord } from "./types";

/** Enquêtes : PMI, ISM, confiance et sentiment des ménages. */
export const ENQUETES: Record<string, DeepDiveRecord> = {
  manufacturing_pmi: {
    fr: {
      sections: [
        {
          heading: "Une enquête, pas une mesure",
          body: "Le PMI manufacturier n'additionne pas des euros : chaque mois, les directeurs des achats de centaines d'usines répondent à une poignée de questions simples (nouvelles commandes, production, emploi, délais de livraison, stocks). Chacun dit seulement si la situation est meilleure, identique ou pire que le mois précédent.",
        },
        {
          heading: "Pourquoi 50 est la seule valeur qui compte",
          body: "Les réponses sont agrégées en un indice où 50 signifie « aucun changement ». Au-dessus, l'activité progresse ; en dessous, elle recule. Un PMI qui passe de 52 à 51 reste une expansion, simplement plus lente : confondre « l'indice baisse » et « l'activité baisse » est l'erreur la plus courante sur cette donnée.",
        },
        {
          heading: "Son atout : il arrive avant tout le monde",
          body: "L'estimation flash sort vers le 22 du mois en cours, quand le PIB du trimestre ne sera connu que des semaines après sa fin. Le marché paie cette avance : l'industrie ne pèse qu'une petite part de l'économie des pays développés, mais elle tourne la première dans un cycle, ce qui fait du PMI manufacturier un détecteur de retournement.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Au-dessus des attentes (et de 50)",
          body: "Activité industrielle qui accélère : devise soutenue, actions cycliques et matières premières bien orientées.",
        },
        {
          tone: "down",
          label: "En dessous des attentes (ou sous 50)",
          body: "Contraction ou ralentissement : devise sous pression, cycliques en repli. Un passage durable sous 50 nourrit le scénario de récession.",
        },
      ],
      watch: [
        "Estimation flash vers le 22, chiffre final au début du mois suivant.",
        "50 est la frontière : au-dessus c'est la croissance, en dessous la contraction.",
        "La composante « nouvelles commandes » anticipe l'indice global de un à deux mois.",
      ],
    },
    en: {
      sections: [
        {
          heading: "A survey, not a measurement",
          body: "The manufacturing PMI does not add up money: each month, purchasing managers at hundreds of factories answer a handful of simple questions (new orders, output, employment, delivery times, stocks). Each one only says whether things are better, the same, or worse than last month.",
        },
        {
          heading: "Why 50 is the only value that matters",
          body: "The answers are aggregated into an index where 50 means 'no change'. Above it, activity is expanding; below it, contracting. A PMI falling from 52 to 51 is still expansion, just slower: confusing 'the index fell' with 'activity fell' is the most common mistake on this release.",
        },
        {
          heading: "Its edge: it arrives before everyone else",
          body: "The flash estimate lands around the 22nd of the current month, while quarterly GDP only appears weeks after the quarter ends. The market pays for that lead: manufacturing is a small share of a developed economy, but it turns first in a cycle, which makes the manufacturing PMI a turning-point detector.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Above expectations (and above 50)",
          body: "Industrial activity accelerating: a supported currency, well-bid cyclicals and commodities.",
        },
        {
          tone: "down",
          label: "Below expectations (or below 50)",
          body: "Contraction or slowdown: the currency comes under pressure, cyclicals retreat. A sustained stay below 50 feeds the recession case.",
        },
      ],
      watch: [
        "Flash estimate around the 22nd, final print early the following month.",
        "50 is the line: above is growth, below is contraction.",
        "The 'new orders' component leads the headline index by one to two months.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Eine Umfrage, keine Messung",
          body: "Der Einkaufsmanagerindex für die Industrie addiert kein Geld: monatlich beantworten Einkaufsleiter hunderter Werke einige einfache Fragen (Auftragseingang, Produktion, Beschäftigung, Lieferzeiten, Lager). Jeder sagt nur, ob es besser, gleich oder schlechter ist als im Vormonat.",
        },
        {
          heading: "Warum nur die 50 zählt",
          body: "Die Antworten ergeben einen Index, bei dem 50 'keine Veränderung' bedeutet. Darüber wächst die Aktivität, darunter schrumpft sie. Fällt der PMI von 52 auf 51, ist das weiterhin Expansion, nur langsamer: 'der Index fällt' mit 'die Aktivität fällt' zu verwechseln ist der häufigste Fehler bei dieser Zahl.",
        },
        {
          heading: "Sein Vorteil: er kommt vor allen anderen",
          body: "Die Schnellschätzung erscheint um den 22. des laufenden Monats, während das Quartals-BIP erst Wochen nach Quartalsende vorliegt. Für diesen Vorlauf zahlt der Markt: die Industrie ist nur ein kleiner Teil einer entwickelten Volkswirtschaft, dreht im Zyklus aber zuerst, was den Industrie-PMI zum Wendepunktmelder macht.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Über den Erwartungen (und über 50)",
          body: "Beschleunigte Industrieaktivität: gestützte Währung, feste Zykliker und Rohstoffe.",
        },
        {
          tone: "down",
          label: "Unter den Erwartungen (oder unter 50)",
          body: "Schrumpfung oder Abkühlung: die Währung gerät unter Druck, Zykliker geben nach. Ein dauerhafter Stand unter 50 nährt das Rezessionsszenario.",
        },
      ],
      watch: [
        "Schnellschätzung um den 22., Endwert Anfang des Folgemonats.",
        "50 ist die Grenze: darüber Wachstum, darunter Schrumpfung.",
        "Die Komponente Auftragseingang läuft dem Gesamtindex ein bis zwei Monate voraus.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Una encuesta, no una medición",
          body: "El PMI manufacturero no suma euros: cada mes, los directores de compras de cientos de fábricas responden a unas pocas preguntas sencillas (nuevos pedidos, producción, empleo, plazos de entrega, inventarios). Cada uno solo dice si la situación es mejor, igual o peor que el mes anterior.",
        },
        {
          heading: "Por qué 50 es el único valor que cuenta",
          body: "Las respuestas se agregan en un índice donde 50 significa sin cambios. Por encima, la actividad crece; por debajo, se contrae. Un PMI que pasa de 52 a 51 sigue siendo expansión, solo que más lenta: confundir que el índice baja con que la actividad baja es el error más común con este dato.",
        },
        {
          heading: "Su ventaja: llega antes que nadie",
          body: "La estimación preliminar sale hacia el día 22 del mes en curso, cuando el PIB del trimestre no se conocerá hasta semanas después de cerrarlo. El mercado paga ese adelanto: la industria pesa poco en una economía desarrollada, pero gira la primera en un ciclo, lo que convierte al PMI manufacturero en un detector de giros.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Por encima de lo esperado (y de 50)",
          body: "Actividad industrial que acelera: divisa apoyada, cíclicas y materias primas bien orientadas.",
        },
        {
          tone: "down",
          label: "Por debajo de lo esperado (o de 50)",
          body: "Contracción o desaceleración: la divisa sufre y las cíclicas retroceden. Un tiempo prolongado por debajo de 50 alimenta el escenario de recesión.",
        },
      ],
      watch: [
        "Estimación preliminar hacia el día 22, dato final a principios del mes siguiente.",
        "50 es la frontera: por encima crecimiento, por debajo contracción.",
        "El componente de nuevos pedidos adelanta al índice general en uno o dos meses.",
      ],
    },
  },

  services_pmi: {
    fr: {
      sections: [
        {
          heading: "Le secteur qui fait l'essentiel de l'économie",
          body: "Même enquête que pour l'industrie, même échelle autour de 50, mais menée auprès des entreprises de services : banque, transport, santé, restauration, informatique. Dans les économies développées, les services représentent environ 70 % du PIB et de l'emploi.",
        },
        {
          heading: "Pourquoi il compte plus que le manufacturier",
          body: "Un PMI manufacturier sous 50 alors que les services tiennent à 55 décrit une économie qui ralentit sans entrer en récession. C'est exactement la configuration qui a dominé plusieurs cycles récents. Quand les deux passent sous 50 en même temps, le message change complètement de nature.",
        },
        {
          heading: "Ses prix payés, une info inflation en avance",
          body: "L'enquête publie aussi une composante de prix. Dans les services, les coûts sont surtout salariaux : une composante prix qui monte annonce une inflation de services persistante, précisément celle que les banques centrales ont le plus de mal à faire refluer.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Au-dessus des attentes",
          body: "Le cœur de l'économie résiste : devise soutenue, actions bien orientées, sauf si la composante prix ravive la crainte inflationniste.",
        },
        {
          tone: "down",
          label: "En dessous des attentes",
          body: "Ralentissement qui touche la majeure partie de l'activité : devise sous pression, et les paris sur une baisse des taux s'accélèrent.",
        },
      ],
      watch: [
        "L'estimation flash sort le même jour que celle de l'industrie, et c'est elle qui pèse le plus.",
        "Regarde l'écart entre services et industrie : il raconte la nature du cycle.",
        "La composante des prix payés est un indicateur avancé de l'inflation de services.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The sector that is most of the economy",
          body: "The same survey as manufacturing, the same scale around 50, but run among service businesses: banking, transport, healthcare, hospitality, IT. In developed economies, services are roughly 70% of GDP and of employment.",
        },
        {
          heading: "Why it matters more than manufacturing",
          body: "A manufacturing PMI below 50 while services hold at 55 describes an economy slowing without entering recession. That is exactly the configuration that has dominated several recent cycles. When both drop below 50 at once, the message changes nature entirely.",
        },
        {
          heading: "Its prices-paid line, an early inflation read",
          body: "The survey also publishes a price component. In services, costs are mostly wages: a rising price component flags persistent services inflation, precisely the kind central banks find hardest to bring down.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Above expectations",
          body: "The core of the economy is holding: a supported currency and firm equities, unless the price component revives inflation fear.",
        },
        {
          tone: "down",
          label: "Below expectations",
          body: "A slowdown reaching most of the activity: the currency comes under pressure and rate-cut bets accelerate.",
        },
      ],
      watch: [
        "The flash estimate lands the same day as manufacturing's, and it is the one that carries more weight.",
        "Watch the gap between services and manufacturing: it describes the nature of the cycle.",
        "The prices-paid component leads services inflation.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Der Sektor, der den Großteil der Wirtschaft ausmacht",
          body: "Dieselbe Umfrage wie in der Industrie, dieselbe Skala um 50, aber unter Dienstleistern erhoben: Banken, Verkehr, Gesundheit, Gastgewerbe, IT. In entwickelten Volkswirtschaften stehen Dienstleistungen für rund 70 Prozent von BIP und Beschäftigung.",
        },
        {
          heading: "Warum er mehr zählt als die Industrie",
          body: "Ein Industrie-PMI unter 50 bei Dienstleistungen auf 55 beschreibt eine Wirtschaft, die sich abkühlt, ohne in eine Rezession zu rutschen. Genau diese Konstellation hat mehrere jüngere Zyklen geprägt. Fallen beide gleichzeitig unter 50, ändert sich die Botschaft grundlegend.",
        },
        {
          heading: "Die Preiskomponente als früher Inflationshinweis",
          body: "Die Umfrage veröffentlicht auch eine Preiskomponente. Im Dienstleistungsbereich sind die Kosten vor allem Löhne: eine steigende Preiskomponente kündigt hartnäckige Dienstleistungsinflation an, genau jene, die Notenbanken am schwersten drücken können.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Über den Erwartungen",
          body: "Der Kern der Wirtschaft hält: gestützte Währung, feste Aktien, außer die Preiskomponente weckt die Inflationsangst.",
        },
        {
          tone: "down",
          label: "Unter den Erwartungen",
          body: "Eine Abkühlung, die den größten Teil der Aktivität erfasst: die Währung gerät unter Druck, Wetten auf Zinssenkungen nehmen zu.",
        },
      ],
      watch: [
        "Die Schnellschätzung erscheint am selben Tag wie die der Industrie und wiegt schwerer.",
        "Achte auf den Abstand zwischen Dienstleistungen und Industrie: er beschreibt die Art des Zyklus.",
        "Die Komponente der gezahlten Preise läuft der Dienstleistungsinflation voraus.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El sector que es casi toda la economía",
          body: "La misma encuesta que en la industria, la misma escala en torno a 50, pero realizada entre empresas de servicios: banca, transporte, sanidad, hostelería, informática. En las economías desarrolladas, los servicios suponen alrededor del 70 % del PIB y del empleo.",
        },
        {
          heading: "Por qué pesa más que el manufacturero",
          body: "Un PMI manufacturero por debajo de 50 con los servicios en 55 describe una economía que se frena sin entrar en recesión. Es exactamente la configuración que ha dominado varios ciclos recientes. Cuando ambos bajan de 50 a la vez, el mensaje cambia por completo de naturaleza.",
        },
        {
          heading: "Sus precios pagados, un aviso de inflación",
          body: "La encuesta publica además un componente de precios. En servicios los costes son sobre todo salariales: un componente de precios al alza anuncia una inflación de servicios persistente, precisamente la que más cuesta doblegar a los bancos centrales.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Por encima de lo esperado",
          body: "El corazón de la economía aguanta: divisa apoyada y bolsa firme, salvo que el componente de precios reavive el miedo a la inflación.",
        },
        {
          tone: "down",
          label: "Por debajo de lo esperado",
          body: "Desaceleración que alcanza a la mayor parte de la actividad: la divisa sufre y se aceleran las apuestas por bajadas de tipos.",
        },
      ],
      watch: [
        "La estimación preliminar sale el mismo día que la de la industria, y pesa más.",
        "Mira la diferencia entre servicios e industria: cuenta la naturaleza del ciclo.",
        "El componente de precios pagados adelanta la inflación de servicios.",
      ],
    },
  },

  ism_manufacturing: {
    fr: {
      sections: [
        {
          heading: "L'autre PMI américain, et le plus ancien",
          body: "L'ISM manufacturier est produit par l'Institute for Supply Management, une association américaine de professionnels des achats. Même principe que le PMI, même seuil de 50, mais un panel et une méthode différents, et une histoire qui remonte aux années 1940 : c'est la série que citent les économistes quand ils comparent des cycles.",
        },
        {
          heading: "Pourquoi il bouge davantage le marché que le PMI",
          body: "Aux États-Unis, l'ISM est publié le premier jour ouvré du mois, avant tout le reste, et il est historiquement la référence pour l'industrie américaine. Sa publication est souvent le premier vrai rendez-vous macro du mois, ce qui lui donne un poids que son seul contenu n'expliquerait pas.",
        },
        {
          heading: "Les deux composantes à lire en priorité",
          body: "Les nouvelles commandes anticipent l'indice général de un à deux mois : c'est le carnet de commandes futur. Les prix payés donnent une lecture avancée de l'inflation industrielle. Beaucoup de traders lisent ces deux lignes avant même le chiffre principal.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Au-dessus des attentes",
          body: "Industrie américaine qui se redresse : dollar soutenu, cycliques et matières premières en hausse.",
        },
        {
          tone: "down",
          label: "En dessous des attentes",
          body: "Industrie qui se contracte : dollar sous pression, et les attentes de baisse de taux progressent. Réaction rapide car la donnée ouvre le mois.",
        },
      ],
      watch: [
        "Premier jour ouvré du mois, 10h00 à New York.",
        "Lis « nouvelles commandes » et « prix payés » autant que l'indice principal.",
        "Publié avant l'ISM des services, qui sort deux jours plus tard.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The other US PMI, and the oldest one",
          body: "The manufacturing ISM is produced by the Institute for Supply Management, a US association of purchasing professionals. Same principle as the PMI, same 50 threshold, but a different panel and method, and a history going back to the 1940s: it is the series economists quote when they compare cycles.",
        },
        {
          heading: "Why it moves markets more than the PMI",
          body: "In the US, the ISM is published on the first business day of the month, ahead of everything else, and it has historically been the reference for American manufacturing. Its release is often the first real macro event of the month, which gives it weight its content alone would not explain.",
        },
        {
          heading: "The two components to read first",
          body: "New orders lead the headline index by one to two months: it is the future order book. Prices paid give an early read on industrial inflation. Many traders read those two lines before the headline itself.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Above expectations",
          body: "US manufacturing recovering: a supported dollar, higher cyclicals and commodities.",
        },
        {
          tone: "down",
          label: "Below expectations",
          body: "Manufacturing contracting: the dollar comes under pressure and rate-cut expectations build. A quick reaction, as this print opens the month.",
        },
      ],
      watch: [
        "First business day of the month, 10:00am New York time.",
        "Read 'new orders' and 'prices paid' as much as the headline.",
        "Published before the services ISM, which lands two days later.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Der andere US-PMI, und der älteste",
          body: "Der ISM für die Industrie stammt vom Institute for Supply Management, einem US-Verband der Einkaufsprofis. Gleiches Prinzip wie beim PMI, gleiche Schwelle 50, aber anderes Panel und andere Methode, und eine Historie bis in die 1940er: das ist die Reihe, die Ökonomen beim Zyklusvergleich zitieren.",
        },
        {
          heading: "Warum er den Markt stärker bewegt als der PMI",
          body: "In den USA erscheint der ISM am ersten Werktag des Monats, vor allem anderen, und gilt historisch als Referenz für die US-Industrie. Seine Veröffentlichung ist oft der erste echte Makrotermin des Monats, was ihm ein Gewicht gibt, das sein Inhalt allein nicht erklärt.",
        },
        {
          heading: "Die zwei Komponenten zuerst lesen",
          body: "Der Auftragseingang läuft dem Gesamtindex ein bis zwei Monate voraus: er ist das künftige Auftragsbuch. Die gezahlten Preise geben einen frühen Blick auf die Industrieinflation. Viele Trader lesen diese beiden Zeilen noch vor der Hauptzahl.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Über den Erwartungen",
          body: "Die US-Industrie erholt sich: gestützter Dollar, steigende Zykliker und Rohstoffe.",
        },
        {
          tone: "down",
          label: "Unter den Erwartungen",
          body: "Die Industrie schrumpft: der Dollar gerät unter Druck, Zinssenkungserwartungen nehmen zu. Schnelle Reaktion, weil die Zahl den Monat eröffnet.",
        },
      ],
      watch: [
        "Erster Werktag des Monats, 10:00 Uhr New Yorker Zeit.",
        "Lies Auftragseingang und gezahlte Preise ebenso wie den Hauptindex.",
        "Erscheint vor dem Dienstleistungs-ISM, der zwei Tage später kommt.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El otro PMI estadounidense, y el más antiguo",
          body: "El ISM manufacturero lo elabora el Institute for Supply Management, una asociación estadounidense de profesionales de compras. Mismo principio que el PMI, mismo umbral de 50, pero panel y método distintos, y una historia que se remonta a los años cuarenta: es la serie que citan los economistas cuando comparan ciclos.",
        },
        {
          heading: "Por qué mueve más el mercado que el PMI",
          body: "En EE. UU. el ISM se publica el primer día hábil del mes, antes que todo lo demás, y es históricamente la referencia de la industria estadounidense. Su publicación suele ser la primera cita macro real del mes, lo que le da un peso que su contenido por sí solo no explicaría.",
        },
        {
          heading: "Los dos componentes que hay que leer primero",
          body: "Los nuevos pedidos adelantan al índice general en uno o dos meses: son la cartera de pedidos futura. Los precios pagados dan una lectura anticipada de la inflación industrial. Muchos traders leen esas dos líneas antes que el dato principal.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Por encima de lo esperado",
          body: "Industria estadounidense que se recupera: dólar apoyado, cíclicas y materias primas al alza.",
        },
        {
          tone: "down",
          label: "Por debajo de lo esperado",
          body: "Industria que se contrae: el dólar sufre y crecen las expectativas de bajada de tipos. Reacción rápida porque el dato abre el mes.",
        },
      ],
      watch: [
        "Primer día hábil del mes, 10:00 de Nueva York.",
        "Lee nuevos pedidos y precios pagados tanto como el índice principal.",
        "Se publica antes que el ISM de servicios, que sale dos días después.",
      ],
    },
  },

  ism_services: {
    fr: {
      sections: [
        {
          heading: "La photo du secteur dominant",
          body: "L'ISM des services interroge les directeurs des achats des entreprises de services américaines, qui pèsent environ les deux tiers de l'économie du pays. Comme tous les indices de ce type, 50 sépare l'expansion de la contraction.",
        },
        {
          heading: "Pourquoi il départage les scénarios",
          body: "L'industrie américaine peut se contracter pendant des trimestres sans que l'économie entre en récession, parce que les services portent l'emploi et la consommation. L'ISM des services est donc l'indicateur qui permet de dire si un ralentissement industriel est un épisode sectoriel ou le début d'autre chose.",
        },
        {
          heading: "Sa composante emploi, souvent sous-estimée",
          body: "Elle donne une indication sur le marché du travail avant le rapport officiel, et dans le secteur qui embauche le plus. Quand elle passe sous 50 plusieurs mois de suite, le NFP finit généralement par ralentir.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Au-dessus des attentes",
          body: "L'économie américaine tient : dollar soutenu, actions bien orientées. Si la composante prix monte aussi, les taux attendus remontent et les indices peuvent reculer malgré la bonne nouvelle.",
        },
        {
          tone: "down",
          label: "En dessous des attentes",
          body: "Le doute sur la croissance américaine devient sérieux : dollar en baisse, obligations en hausse, cycliques pénalisées.",
        },
      ],
      watch: [
        "Troisième jour ouvré du mois, 10h00 à New York.",
        "Pèse plus lourd que l'ISM manufacturier dans la lecture du cycle.",
        "Surveille sa composante emploi comme avant-goût du rapport mensuel.",
      ],
    },
    en: {
      sections: [
        {
          heading: "A snapshot of the dominant sector",
          body: "The services ISM surveys purchasing managers at US service companies, which are roughly two thirds of the country's economy. As with every index of this type, 50 separates expansion from contraction.",
        },
        {
          heading: "Why it settles the argument",
          body: "US manufacturing can contract for quarters without the economy entering recession, because services carry employment and consumption. The services ISM is therefore the indicator that tells you whether an industrial slowdown is a sector episode or the start of something else.",
        },
        {
          heading: "Its employment component, often underrated",
          body: "It gives a read on the labour market ahead of the official report, and in the sector that hires the most. When it stays below 50 for several months, the NFP usually ends up slowing.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Above expectations",
          body: "The US economy is holding: a supported dollar, firm equities. If the price component rises too, expected rates climb and indices can fall despite the good news.",
        },
        {
          tone: "down",
          label: "Below expectations",
          body: "Doubt about US growth turns serious: a weaker dollar, higher bonds, cyclicals punished.",
        },
      ],
      watch: [
        "Third business day of the month, 10:00am New York time.",
        "Carries more weight than the manufacturing ISM when reading the cycle.",
        "Watch its employment component as a preview of the monthly jobs report.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Das Bild des dominierenden Sektors",
          body: "Der Dienstleistungs-ISM befragt Einkaufsleiter US-amerikanischer Dienstleister, die rund zwei Drittel der Volkswirtschaft ausmachen. Wie bei allen Indizes dieser Art trennt 50 Expansion von Schrumpfung.",
        },
        {
          heading: "Warum er die Szenarien entscheidet",
          body: "Die US-Industrie kann quartalsweise schrumpfen, ohne dass die Wirtschaft in eine Rezession fällt, weil die Dienstleistungen Beschäftigung und Konsum tragen. Der Dienstleistungs-ISM sagt daher, ob eine Industrieflaute eine Sektorepisode oder der Anfang von etwas anderem ist.",
        },
        {
          heading: "Die oft unterschätzte Beschäftigungskomponente",
          body: "Sie liefert einen Hinweis auf den Arbeitsmarkt vor dem offiziellen Bericht, und zwar im Sektor mit den meisten Einstellungen. Bleibt sie mehrere Monate unter 50, verlangsamen sich die NFP meist ebenfalls.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Über den Erwartungen",
          body: "Die US-Wirtschaft hält: gestützter Dollar, feste Aktien. Steigt auch die Preiskomponente, ziehen die erwarteten Zinsen an und Indizes können trotz guter Nachricht fallen.",
        },
        {
          tone: "down",
          label: "Unter den Erwartungen",
          body: "Der Zweifel am US-Wachstum wird ernst: schwächerer Dollar, steigende Anleihen, bestrafte Zykliker.",
        },
      ],
      watch: [
        "Dritter Werktag des Monats, 10:00 Uhr New Yorker Zeit.",
        "Wiegt bei der Zyklusdeutung schwerer als der Industrie-ISM.",
        "Achte auf die Beschäftigungskomponente als Vorgeschmack auf den Monatsbericht.",
      ],
    },
    es: {
      sections: [
        {
          heading: "La foto del sector dominante",
          body: "El ISM de servicios encuesta a los directores de compras de las empresas de servicios estadounidenses, que pesan alrededor de dos tercios de la economía del país. Como en todos los índices de este tipo, 50 separa expansión de contracción.",
        },
        {
          heading: "Por qué desempata los escenarios",
          body: "La industria estadounidense puede contraerse durante trimestres sin que la economía entre en recesión, porque los servicios sostienen el empleo y el consumo. El ISM de servicios es por tanto el indicador que dice si una desaceleración industrial es un episodio sectorial o el principio de otra cosa.",
        },
        {
          heading: "Su componente de empleo, a menudo infravalorado",
          body: "Da una indicación del mercado laboral antes del informe oficial, y en el sector que más contrata. Cuando se mantiene por debajo de 50 varios meses seguidos, las NFP acaban frenándose.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Por encima de lo esperado",
          body: "La economía estadounidense aguanta: dólar apoyado y bolsa firme. Si el componente de precios también sube, los tipos esperados repuntan y los índices pueden caer pese a la buena noticia.",
        },
        {
          tone: "down",
          label: "Por debajo de lo esperado",
          body: "La duda sobre el crecimiento de EE. UU. se vuelve seria: dólar a la baja, bonos al alza, cíclicas castigadas.",
        },
      ],
      watch: [
        "Tercer día hábil del mes, 10:00 de Nueva York.",
        "Pesa más que el ISM manufacturero al leer el ciclo.",
        "Vigila su componente de empleo como anticipo del informe mensual.",
      ],
    },
  },

  consumer_confidence: {
    fr: {
      sections: [
        {
          heading: "Ce que mesure l'indice du Conference Board",
          body: "Plusieurs milliers de ménages américains sont interrogés chaque mois sur leur perception de la situation actuelle (emploi, affaires) et sur leurs attentes à six mois. L'indice combine les deux, avec une base fixée à 100 sur une année de référence : le niveau absolu compte moins que la tendance.",
        },
        {
          heading: "Pourquoi cet indice-là est lié à l'emploi",
          body: "Sa question la plus suivie porte sur la facilité à trouver un travail. L'écart entre « emplois faciles à trouver » et « emplois difficiles à trouver » suit de près le taux de chômage, souvent avec un peu d'avance. C'est ce qui le distingue du sentiment de l'université du Michigan, davantage lié au pouvoir d'achat.",
        },
        {
          heading: "Confiance et dépense ne sont pas la même chose",
          body: "Un ménage pessimiste continue de payer son loyer et de faire ses courses. L'indice décrit un moral, pas un budget : il annonce mieux les achats reportables (voiture, électroménager, voyages) que la consommation totale. Le marché y réagit modérément, sauf retournement marqué.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Confiance plus haute qu'attendu",
          body: "Consommation à venir bien orientée : dollar et actions de consommation soutenus. Réaction généralement contenue.",
        },
        {
          tone: "down",
          label: "Confiance plus basse qu'attendu",
          body: "Signal de prudence des ménages : les valeurs de consommation discrétionnaire souffrent, le dollar s'effrite. Une chute marquée fait remonter les paris sur des baisses de taux.",
        },
      ],
      watch: [
        "Dernier mardi du mois, 10h00 à New York.",
        "Le sous-indice sur la facilité à trouver un emploi est le plus informatif.",
        "Un moral en baisse ne fait pas forcément baisser la consommation.",
      ],
    },
    en: {
      sections: [
        {
          heading: "What the Conference Board index measures",
          body: "Several thousand US households are surveyed each month on how they see the present situation (jobs, business conditions) and their expectations six months out. The index blends the two, with a base of 100 in a reference year: the absolute level matters less than the trend.",
        },
        {
          heading: "Why this one is tied to jobs",
          body: "Its most-watched question is about how easy it is to find work. The gap between 'jobs plentiful' and 'jobs hard to get' tracks the unemployment rate closely, often slightly ahead of it. That is what separates it from the University of Michigan sentiment index, which is more about purchasing power.",
        },
        {
          heading: "Confidence and spending are not the same thing",
          body: "A gloomy household still pays rent and buys groceries. The index describes a mood, not a budget: it predicts deferrable purchases (cars, appliances, travel) far better than total consumption. The market reacts moderately, absent a sharp turn.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Confidence higher than expected",
          body: "Future consumption looks healthy: a supported dollar and consumer stocks. Usually a contained reaction.",
        },
        {
          tone: "down",
          label: "Confidence lower than expected",
          body: "A signal of household caution: discretionary consumer names suffer, the dollar erodes. A sharp drop lifts rate-cut bets.",
        },
      ],
      watch: [
        "Last Tuesday of the month, 10:00am New York time.",
        "The 'jobs hard to get' sub-index is the most informative line.",
        "A falling mood does not necessarily mean falling spending.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Was der Conference-Board-Index misst",
          body: "Mehrere tausend US-Haushalte werden monatlich zur aktuellen Lage (Arbeitsmarkt, Geschäftsklima) und zu ihren Erwartungen auf Sicht von sechs Monaten befragt. Der Index verbindet beides, mit Basis 100 in einem Referenzjahr: das Niveau zählt weniger als der Trend.",
        },
        {
          heading: "Warum gerade dieser Index am Arbeitsmarkt hängt",
          body: "Die meistbeachtete Frage betrifft, wie leicht sich eine Stelle finden lässt. Der Abstand zwischen 'Stellen reichlich' und 'Stellen schwer zu finden' folgt der Arbeitslosenquote eng, oft mit leichtem Vorlauf. Das unterscheidet ihn vom Michigan-Sentiment, das stärker an der Kaufkraft hängt.",
        },
        {
          heading: "Zuversicht und Ausgaben sind nicht dasselbe",
          body: "Ein pessimistischer Haushalt zahlt weiterhin Miete und kauft Lebensmittel. Der Index beschreibt eine Stimmung, kein Budget: er sagt aufschiebbare Käufe (Auto, Haushaltsgeräte, Reisen) besser voraus als den Gesamtkonsum. Der Markt reagiert moderat, außer bei einem klaren Umschwung.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Zuversicht höher als erwartet",
          body: "Der künftige Konsum sieht gut aus: gestützter Dollar und Konsumwerte. Meist verhaltene Reaktion.",
        },
        {
          tone: "down",
          label: "Zuversicht niedriger als erwartet",
          body: "Zeichen für Vorsicht der Haushalte: zyklische Konsumwerte leiden, der Dollar bröckelt. Ein deutlicher Einbruch hebt die Zinssenkungswetten.",
        },
      ],
      watch: [
        "Letzter Dienstag im Monat, 10:00 Uhr New Yorker Zeit.",
        "Der Teilindex zur Schwierigkeit der Stellensuche ist die aussagekräftigste Zeile.",
        "Eine sinkende Stimmung bedeutet nicht zwingend sinkenden Konsum.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Qué mide el índice del Conference Board",
          body: "Cada mes se encuesta a varios miles de hogares estadounidenses sobre su percepción de la situación actual (empleo, negocios) y sus expectativas a seis meses. El índice combina ambas, con base 100 en un año de referencia: el nivel absoluto importa menos que la tendencia.",
        },
        {
          heading: "Por qué este índice está ligado al empleo",
          body: "Su pregunta más seguida es lo fácil que resulta encontrar trabajo. La diferencia entre empleos abundantes y empleos difíciles de encontrar sigue de cerca a la tasa de paro, a menudo con algo de adelanto. Eso lo distingue del sentimiento de la Universidad de Michigan, más ligado al poder adquisitivo.",
        },
        {
          heading: "Confianza y gasto no son lo mismo",
          body: "Un hogar pesimista sigue pagando el alquiler y haciendo la compra. El índice describe un estado de ánimo, no un presupuesto: anticipa mucho mejor las compras aplazables (coche, electrodomésticos, viajes) que el consumo total. El mercado reacciona con moderación salvo giro marcado.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Confianza más alta de lo esperado",
          body: "El consumo futuro pinta bien: dólar y valores de consumo apoyados. Reacción por lo general contenida.",
        },
        {
          tone: "down",
          label: "Confianza más baja de lo esperado",
          body: "Señal de prudencia de los hogares: los valores de consumo discrecional sufren y el dólar se desgasta. Una caída marcada eleva las apuestas por bajadas de tipos.",
        },
      ],
      watch: [
        "Último martes del mes, 10:00 de Nueva York.",
        "El subíndice sobre la dificultad de encontrar empleo es el más informativo.",
        "Un ánimo a la baja no implica necesariamente un consumo a la baja.",
      ],
    },
  },

  consumer_sentiment: {
    fr: {
      sections: [
        {
          heading: "L'enquête de l'université du Michigan",
          body: "Environ 1 000 ménages répondent chaque mois à un questionnaire en ligne sur leurs finances personnelles, leurs perspectives économiques et leur propension à acheter des biens durables. L'enquête se faisait par téléphone jusqu'en 2024. Panel plus petit que celui du Conference Board, donc indice plus nerveux d'un mois à l'autre.",
        },
        {
          heading: "Sa vraie valeur pour le marché : les anticipations d'inflation",
          body: "L'enquête demande aux ménages quelle inflation ils attendent à un an et à cinq ans. Ces deux chiffres sont suivis de très près par la Fed, car des anticipations qui dérapent finissent par créer l'inflation qu'elles annoncent (on négocie son salaire en fonction de ce qu'on croit). Il arrive que le marché ignore le sentiment et réagisse uniquement à cette ligne.",
        },
        {
          heading: "Deux publications par mois",
          body: "Une estimation préliminaire vers le milieu du mois, une version définitive à la fin. La préliminaire fait bien plus réagir : la seconde ne fait qu'ajuster à la marge, sauf révision importante des anticipations d'inflation.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Sentiment meilleur qu'attendu",
          body: "Moral des ménages en amélioration : dollar légèrement soutenu, valeurs de consommation bien orientées.",
        },
        {
          tone: "down",
          label: "Sentiment plus faible qu'attendu",
          body: "Ménages inquiets : consommation discrétionnaire pénalisée. Si les anticipations d'inflation montent en même temps, la combinaison est la plus mal reçue de toutes.",
        },
      ],
      watch: [
        "Estimation préliminaire vers le milieu du mois, version définitive en fin de mois, 10h00 à New York.",
        "Va directement lire les anticipations d'inflation à 1 an et à 5 ans.",
        "Panel réduit : un mois isolé se surinterprète facilement.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The University of Michigan survey",
          body: "Around 1,000 households answer an online questionnaire each month about their personal finances, their economic outlook and their willingness to buy durable goods. The survey was run by telephone until 2024. A smaller panel than the Conference Board's, so a jumpier index month to month.",
        },
        {
          heading: "Its real value to markets: inflation expectations",
          body: "The survey asks households what inflation they expect one year and five years out. The Fed follows both closely, because expectations that drift end up creating the inflation they predict (people negotiate pay based on what they believe). Sometimes the market ignores the sentiment number and reacts to that line alone.",
        },
        {
          heading: "Two releases a month",
          body: "A preliminary estimate around mid-month, a final version at the end. The preliminary one moves markets far more: the second only adjusts at the margin, unless inflation expectations are revised significantly.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Sentiment better than expected",
          body: "Improving household mood: a slightly supported dollar and firmer consumer names.",
        },
        {
          tone: "down",
          label: "Sentiment weaker than expected",
          body: "Worried households: discretionary consumption suffers. If inflation expectations rise at the same time, that combination is the worst received of all.",
        },
      ],
      watch: [
        "Preliminary around mid-month, final at month end, 10:00am New York time.",
        "Go straight to the 1-year and 5-year inflation expectations.",
        "Small panel: a single month is easy to over-read.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Die Umfrage der University of Michigan",
          body: "Rund 1.000 Haushalte beantworten monatlich online Fragen zu ihren Finanzen, ihrem Wirtschaftsausblick und ihrer Neigung, langlebige Güter zu kaufen. Bis 2024 lief die Befragung telefonisch. Kleineres Panel als beim Conference Board, daher ein von Monat zu Monat nervöserer Index.",
        },
        {
          heading: "Der eigentliche Marktwert: die Inflationserwartungen",
          body: "Die Umfrage fragt, welche Inflation die Haushalte auf ein und auf fünf Jahre erwarten. Die Fed verfolgt beide Zahlen genau, denn entgleitende Erwartungen erzeugen am Ende die Inflation, die sie ankündigen (Löhne werden nach dem verhandelt, was man glaubt). Manchmal ignoriert der Markt das Sentiment und reagiert nur auf diese Zeile.",
        },
        {
          heading: "Zwei Veröffentlichungen pro Monat",
          body: "Eine vorläufige Schätzung um die Monatsmitte, eine endgültige zum Monatsende. Die vorläufige bewegt weit mehr: die zweite justiert nur am Rand, außer die Inflationserwartungen werden deutlich revidiert.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Sentiment besser als erwartet",
          body: "Bessere Stimmung der Haushalte: leicht gestützter Dollar, festere Konsumwerte.",
        },
        {
          tone: "down",
          label: "Sentiment schwächer als erwartet",
          body: "Besorgte Haushalte: zyklischer Konsum leidet. Steigen gleichzeitig die Inflationserwartungen, ist diese Kombination die am schlechtesten aufgenommene überhaupt.",
        },
      ],
      watch: [
        "Vorläufig zur Monatsmitte, endgültig zum Monatsende, 10:00 Uhr New Yorker Zeit.",
        "Lies direkt die Inflationserwartungen auf 1 und 5 Jahre.",
        "Kleines Panel: ein einzelner Monat wird leicht überinterpretiert.",
      ],
    },
    es: {
      sections: [
        {
          heading: "La encuesta de la Universidad de Michigan",
          body: "Alrededor de 1.000 hogares responden cada mes un cuestionario en línea sobre sus finanzas personales, sus perspectivas económicas y su disposición a comprar bienes duraderos. Hasta 2024 la encuesta era telefónica. Panel más pequeño que el del Conference Board, y por tanto un índice más nervioso de un mes a otro.",
        },
        {
          heading: "Su valor real para el mercado: las expectativas de inflación",
          body: "La encuesta pregunta a los hogares qué inflación esperan a un año y a cinco. La Fed sigue muy de cerca ambas cifras, porque unas expectativas que se desanclan acaban creando la inflación que anuncian (uno negocia su sueldo según lo que cree). A veces el mercado ignora el sentimiento y reacciona solo a esa línea.",
        },
        {
          heading: "Dos publicaciones al mes",
          body: "Una estimación preliminar a mediados de mes y una versión definitiva al final. La preliminar mueve mucho más: la segunda solo ajusta al margen, salvo revisión importante de las expectativas de inflación.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Sentimiento mejor de lo esperado",
          body: "Mejora el ánimo de los hogares: dólar ligeramente apoyado y valores de consumo firmes.",
        },
        {
          tone: "down",
          label: "Sentimiento más débil de lo esperado",
          body: "Hogares preocupados: el consumo discrecional se resiente. Si a la vez suben las expectativas de inflación, esa combinación es la peor recibida de todas.",
        },
      ],
      watch: [
        "Preliminar hacia mediados de mes, definitiva a final de mes, 10:00 de Nueva York.",
        "Ve directo a las expectativas de inflación a 1 y a 5 años.",
        "Panel reducido: un mes aislado se sobreinterpreta con facilidad.",
      ],
    },
  },
};
