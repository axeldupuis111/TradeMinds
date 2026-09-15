import type { DeepDiveRecord } from "./types";

/** Croissance et échanges : ventes au détail, PIB, biens durables, permis, balances. */
export const CROISSANCE: Record<string, DeepDiveRecord> = {
  retail_sales: {
    fr: {
      sections: [
        {
          heading: "Le thermomètre de la consommation",
          body: "Les ventes au détail additionnent le chiffre d'affaires des commerces, en valeur et avant inflation. Aux États-Unis, la consommation des ménages représente environ 70 % du PIB : cette statistique mesure donc, à elle seule, le principal moteur de l'économie du pays.",
        },
        {
          heading: "Pourquoi on regarde le « groupe de contrôle »",
          body: "Le chiffre global inclut l'automobile, l'essence et les matériaux de construction, trois postes très volatils : une hausse du prix du carburant gonfle mécaniquement les ventes sans qu'un seul article de plus ait été vendu. Le « control group », qui les exclut, alimente directement le calcul du PIB et reste la ligne la plus suivie par les analystes.",
        },
        {
          heading: "Une donnée en valeur, pas en volume",
          body: "Comme le chiffre n'est pas corrigé de l'inflation, des ventes en hausse de 0,3 % avec une inflation mensuelle de 0,3 % signifient un volume inchangé : les ménages ont payé plus cher la même chose. Confondre les deux fait lire une croissance là où il n'y a qu'une hausse des prix.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Ventes au-dessus des attentes",
          body: "Consommation robuste : dollar soutenu, mais si l'inflation est le sujet du moment, la crainte de taux durablement hauts peut faire baisser les indices malgré la bonne nouvelle.",
        },
        {
          tone: "down",
          label: "Ventes en dessous des attentes",
          body: "Le moteur de l'économie faiblit : dollar en repli, obligations en hausse, distribution et consommation discrétionnaire pénalisées.",
        },
      ],
      watch: [
        "Vers le milieu du mois, 14h30 heure de Paris.",
        "Lis le groupe de contrôle plutôt que le chiffre global.",
        "Les révisions du mois précédent changent parfois complètement la lecture.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The thermometer of consumption",
          body: "Retail sales add up the turnover of shops, in value terms and before inflation. In the US, household consumption is roughly 70% of GDP: this one statistic measures the main engine of the economy.",
        },
        {
          heading: "Why people watch the 'control group'",
          body: "The headline includes autos, gasoline and building materials, three very volatile lines: a rise in fuel prices mechanically inflates sales without a single extra item being sold. The control group, which excludes them, feeds directly into the GDP calculation and remains the line analysts follow.",
        },
        {
          heading: "A value figure, not a volume one",
          body: "Since the number is not adjusted for inflation, sales up 0.3% with monthly inflation at 0.3% means flat volume: households paid more for the same thing. Confusing the two reads growth where there is only a price increase.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Sales above expectations",
          body: "Robust consumption: a supported dollar, but if inflation is the story, fear of rates staying high can push indices down despite the good news.",
        },
        {
          tone: "down",
          label: "Sales below expectations",
          body: "The engine of the economy is weakening: a softer dollar, higher bonds, retail and discretionary consumption punished.",
        },
      ],
      watch: [
        "Around mid-month, 8:30am New York time.",
        "Read the control group rather than the headline.",
        "Revisions to the previous month sometimes flip the reading entirely.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Das Thermometer des Konsums",
          body: "Die Einzelhandelsumsätze addieren die Erlöse des Handels, in Werten und vor Inflation. In den USA macht der private Konsum rund 70 Prozent des BIP aus: diese eine Statistik misst also den Hauptmotor der Volkswirtschaft.",
        },
        {
          heading: "Warum man auf die Kernrate schaut",
          body: "Der Gesamtwert enthält Autos, Kraftstoff und Baustoffe, drei sehr schwankende Posten: ein höherer Spritpreis bläht die Umsätze rein rechnerisch auf, ohne dass ein Stück mehr verkauft wurde. Die Kontrollgruppe ohne diese Posten fließt direkt in die BIP-Rechnung ein und bleibt die von Analysten beachtete Zeile.",
        },
        {
          heading: "Ein Wert, kein Volumen",
          body: "Da die Zahl nicht inflationsbereinigt ist, bedeuten Umsätze plus 0,3 Prozent bei 0,3 Prozent Monatsinflation ein unverändertes Volumen: die Haushalte haben für dasselbe mehr gezahlt. Wer beides verwechselt, liest Wachstum, wo nur Preise steigen.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Umsätze über den Erwartungen",
          body: "Robuster Konsum: gestützter Dollar, doch wenn Inflation das Thema ist, kann die Angst vor dauerhaft hohen Zinsen die Indizes trotz guter Nachricht drücken.",
        },
        {
          tone: "down",
          label: "Umsätze unter den Erwartungen",
          body: "Der Motor der Wirtschaft schwächelt: schwächerer Dollar, steigende Anleihen, Handel und zyklischer Konsum unter Druck.",
        },
      ],
      watch: [
        "Etwa zur Monatsmitte, 14:30 Uhr MEZ.",
        "Lies die Kontrollgruppe statt der Gesamtzahl.",
        "Revisionen des Vormonats drehen die Lesart manchmal komplett.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El termómetro del consumo",
          body: "Las ventas minoristas suman la facturación del comercio, en valor y antes de inflación. En EE. UU. el consumo de los hogares supone cerca del 70 % del PIB: esta sola estadística mide el motor principal de la economía.",
        },
        {
          heading: "Por qué se mira el grupo de control",
          body: "El dato general incluye automóvil, gasolina y materiales de construcción, tres partidas muy volátiles: una subida del carburante infla mecánicamente las ventas sin que se haya vendido un artículo más. El grupo de control, que las excluye, alimenta directamente el cálculo del PIB y es la línea que siguen los analistas.",
        },
        {
          heading: "Un dato en valor, no en volumen",
          body: "Como la cifra no se corrige de inflación, unas ventas al alza del 0,3 % con una inflación mensual del 0,3 % significan volumen plano: los hogares han pagado más caro lo mismo. Confundir ambas cosas hace leer crecimiento donde solo hay subida de precios.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Ventas por encima de lo esperado",
          body: "Consumo robusto: dólar apoyado, pero si la inflación es el tema del momento, el miedo a tipos altos durante más tiempo puede hacer caer los índices pese a la buena noticia.",
        },
        {
          tone: "down",
          label: "Ventas por debajo de lo esperado",
          body: "El motor de la economía flaquea: dólar a la baja, bonos al alza, distribución y consumo discrecional castigados.",
        },
      ],
      watch: [
        "Hacia mediados de mes, 8:30 de Nueva York.",
        "Lee el grupo de control en vez del dato general.",
        "Las revisiones del mes anterior a veces cambian por completo la lectura.",
      ],
    },
  },

  gdp: {
    fr: {
      sections: [
        {
          heading: "La somme de tout ce qui a été produit",
          body: "Le produit intérieur brut additionne la valeur de tous les biens et services produits dans un pays sur un trimestre. Aux États-Unis, il est annoncé en rythme annualisé : « 2,4 % » signifie le rythme qu'atteindrait l'année entière si le trimestre se répétait quatre fois, pas la croissance du trimestre lui-même.",
        },
        {
          heading: "Trois publications pour un même trimestre",
          body: "Une estimation avancée un mois après la fin du trimestre, puis deux révisions à un mois d'intervalle. Seule la première fait vraiment bouger le marché : les suivantes ne corrigent que quelques dixièmes, sur une période déjà lointaine.",
        },
        {
          heading: "Pourquoi une donnée si importante fait si peu bouger",
          body: "Le PIB décrit un trimestre déjà terminé, et tous ses ingrédients (consommation, emploi, commerce extérieur, stocks) ont été publiés mois par mois depuis. Le marché l'a donc largement reconstitué avant sa sortie. Il compte surtout pour ce qu'il confirme ou infirme du récit en cours : récession ou pas récession.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Croissance supérieure aux attentes",
          body: "Économie plus solide que prévu : devise soutenue. Si l'inflation reste le sujet, une croissance trop forte pèse sur les obligations et les actions.",
        },
        {
          tone: "down",
          label: "Croissance inférieure aux attentes",
          body: "Scénario de ralentissement renforcé : devise sous pression, obligations recherchées. Deux trimestres consécutifs de recul constituent la définition technique la plus citée de la récession.",
        },
      ],
      watch: [
        "Estimation avancée un mois après la fin du trimestre.",
        "Chiffre annualisé aux États-Unis : pense à ne pas le comparer tel quel à celui de la zone euro.",
        "Regarde d'où vient la croissance : les stocks gonflent un chiffre sans rien dire de la demande.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The sum of everything produced",
          body: "Gross domestic product adds up the value of all goods and services produced in a country over a quarter. In the US it is reported at an annualised rate: '2.4%' is the pace the full year would reach if the quarter repeated four times, not the quarter's own growth.",
        },
        {
          heading: "Three releases for one quarter",
          body: "An advance estimate a month after the quarter ends, then two revisions a month apart. Only the first really moves markets: the others adjust by a few tenths, over a period already well behind us.",
        },
        {
          heading: "Why such an important number moves so little",
          body: "GDP describes a quarter that is already over, and all of its ingredients (consumption, jobs, trade, inventories) have been published month by month since. The market has largely rebuilt it before release. It matters mostly for what it confirms or denies in the running story: recession or no recession.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Growth above expectations",
          body: "A stronger economy than assumed: a supported currency. If inflation is still the story, growth that is too strong weighs on bonds and equities.",
        },
        {
          tone: "down",
          label: "Growth below expectations",
          body: "The slowdown case strengthens: the currency comes under pressure, bonds are bid. Two consecutive quarters of contraction is the most quoted technical definition of recession.",
        },
      ],
      watch: [
        "Advance estimate a month after the quarter ends.",
        "Annualised in the US: do not compare it directly with the euro-area figure.",
        "Check where the growth came from: inventories can inflate a number while saying nothing about demand.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Die Summe alles Produzierten",
          body: "Das Bruttoinlandsprodukt addiert den Wert aller in einem Quartal erzeugten Güter und Dienstleistungen. In den USA wird es annualisiert gemeldet: '2,4 Prozent' ist das Tempo des Gesamtjahres, wenn sich das Quartal viermal wiederholte, nicht das Wachstum des Quartals selbst.",
        },
        {
          heading: "Drei Veröffentlichungen für ein Quartal",
          body: "Eine erste Schätzung einen Monat nach Quartalsende, dann zwei Revisionen im Monatsabstand. Nur die erste bewegt den Markt wirklich: die weiteren korrigieren wenige Zehntel für einen bereits fernen Zeitraum.",
        },
        {
          heading: "Warum eine so wichtige Zahl so wenig bewegt",
          body: "Das BIP beschreibt ein abgeschlossenes Quartal, und alle seine Bestandteile (Konsum, Arbeitsmarkt, Außenhandel, Lager) wurden seither monatlich veröffentlicht. Der Markt hat es vorab weitgehend rekonstruiert. Es zählt vor allem dafür, was es an der laufenden Erzählung bestätigt oder widerlegt: Rezession oder nicht.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Wachstum über den Erwartungen",
          body: "Stärkere Wirtschaft als gedacht: gestützte Währung. Ist Inflation weiter das Thema, belastet zu starkes Wachstum Anleihen und Aktien.",
        },
        {
          tone: "down",
          label: "Wachstum unter den Erwartungen",
          body: "Das Abkühlungsszenario gewinnt: die Währung gerät unter Druck, Anleihen sind gefragt. Zwei Quartale Rückgang in Folge sind die meistzitierte technische Rezessionsdefinition.",
        },
      ],
      watch: [
        "Erste Schätzung einen Monat nach Quartalsende.",
        "In den USA annualisiert: nicht direkt mit dem Eurozonen-Wert vergleichen.",
        "Sieh nach, woher das Wachstum kam: Lageraufbau bläht eine Zahl auf, ohne etwas über die Nachfrage zu sagen.",
      ],
    },
    es: {
      sections: [
        {
          heading: "La suma de todo lo producido",
          body: "El producto interior bruto suma el valor de todos los bienes y servicios producidos en un país durante un trimestre. En EE. UU. se anuncia en tasa anualizada: un 2,4 % es el ritmo que alcanzaría el año entero si el trimestre se repitiera cuatro veces, no el crecimiento del trimestre en sí.",
        },
        {
          heading: "Tres publicaciones para un mismo trimestre",
          body: "Una estimación avanzada un mes después de cerrar el trimestre y luego dos revisiones con un mes de diferencia. Solo la primera mueve de verdad al mercado: las siguientes corrigen unas décimas de un periodo ya lejano.",
        },
        {
          heading: "Por qué un dato tan importante mueve tan poco",
          body: "El PIB describe un trimestre ya terminado, y todos sus ingredientes (consumo, empleo, comercio exterior, inventarios) se han publicado mes a mes desde entonces. El mercado lo ha reconstruido en buena parte antes de que salga. Cuenta sobre todo por lo que confirma o desmiente del relato en curso: recesión o no recesión.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Crecimiento superior a lo esperado",
          body: "Economía más sólida de lo previsto: divisa apoyada. Si la inflación sigue siendo el tema, un crecimiento demasiado fuerte pesa sobre bonos y bolsa.",
        },
        {
          tone: "down",
          label: "Crecimiento inferior a lo esperado",
          body: "Se refuerza el escenario de desaceleración: divisa presionada, bonos buscados. Dos trimestres consecutivos de caída son la definición técnica de recesión más citada.",
        },
      ],
      watch: [
        "Estimación avanzada un mes después del cierre del trimestre.",
        "Anualizado en EE. UU.: no lo compares tal cual con el de la zona euro.",
        "Mira de dónde viene el crecimiento: los inventarios inflan un dato sin decir nada de la demanda.",
      ],
    },
  },

  durable_goods: {
    fr: {
      sections: [
        {
          heading: "Ce qu'on appelle un bien durable",
          body: "Un bien conçu pour durer au moins trois ans : machine-outil, camion, avion, matériel informatique professionnel. Les commandes de biens durables mesurent donc les engagements pris par les entreprises et les ménages sur des achats lourds, c'est-à-dire des décisions qui engagent l'avenir.",
        },
        {
          heading: "Pourquoi il faut retirer les transports",
          body: "Une seule commande de plusieurs dizaines d'avions peut faire bondir le total de 20 % sans rien dire de l'économie. C'est pourquoi la ligne de référence est « hors transport », et plus encore les commandes de biens d'équipement hors défense et hors aéronautique : c'est la mesure propre de l'investissement des entreprises.",
        },
        {
          heading: "Un indicateur avancé du cycle d'investissement",
          body: "Une entreprise ne commande une nouvelle ligne de production que si elle croit à sa demande future. Ces commandes se retournent donc avant la production et avant l'emploi industriel : c'est un signal précoce, mais très bruyant d'un mois sur l'autre.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Commandes au-dessus des attentes",
          body: "Les entreprises investissent : dollar soutenu, valeurs industrielles bien orientées.",
        },
        {
          tone: "down",
          label: "Commandes en dessous des attentes",
          body: "Investissement qui se contracte : signal de prudence des entreprises, dollar en repli, industrielles sous pression.",
        },
      ],
      watch: [
        "Vers la fin du mois, 14h30 heure de Paris.",
        "Regarde le chiffre hors transport, jamais le total brut.",
        "Donnée très volatile : la tendance sur trois mois vaut mieux qu'un mois isolé.",
      ],
    },
    en: {
      sections: [
        {
          heading: "What counts as a durable good",
          body: "Anything built to last at least three years: machine tools, trucks, aircraft, business IT equipment. Durable goods orders therefore measure the commitments firms and households make on heavy purchases, which are decisions about the future.",
        },
        {
          heading: "Why transport has to come out",
          body: "A single order for dozens of aircraft can lift the total by 20% while saying nothing about the economy. That is why the reference line is 'ex-transport', and more precisely core capital goods orders excluding defence and aircraft: the clean measure of business investment.",
        },
        {
          heading: "A leading indicator of the investment cycle",
          body: "A company only orders a new production line if it believes in future demand. These orders therefore turn before output and before industrial employment: an early signal, but a very noisy one month to month.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Orders above expectations",
          body: "Firms are investing: a supported dollar and firmer industrial names.",
        },
        {
          tone: "down",
          label: "Orders below expectations",
          body: "Investment contracting: a signal of corporate caution, a softer dollar, industrials under pressure.",
        },
      ],
      watch: [
        "Toward the end of the month, 8:30am New York time.",
        "Read the ex-transport figure, never the raw total.",
        "Very volatile: a three-month trend beats any single month.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Was ein langlebiges Gut ist",
          body: "Etwas, das mindestens drei Jahre halten soll: Werkzeugmaschinen, Lkw, Flugzeuge, professionelle IT-Ausrüstung. Die Aufträge für langlebige Güter messen also die Zusagen von Unternehmen und Haushalten für große Anschaffungen, mithin Entscheidungen über die Zukunft.",
        },
        {
          heading: "Warum der Verkehr herausgerechnet werden muss",
          body: "Eine einzige Bestellung über Dutzende Flugzeuge kann die Summe um 20 Prozent hochziehen, ohne etwas über die Wirtschaft zu sagen. Deshalb ist die Referenz 'ohne Verkehr', genauer die Kernaufträge für Investitionsgüter ohne Rüstung und Luftfahrt: das saubere Maß der Unternehmensinvestitionen.",
        },
        {
          heading: "Ein Frühindikator des Investitionszyklus",
          body: "Ein Unternehmen bestellt eine neue Fertigungslinie nur, wenn es an die künftige Nachfrage glaubt. Diese Aufträge drehen daher vor der Produktion und vor der Industriebeschäftigung: ein frühes, aber von Monat zu Monat sehr verrauschtes Signal.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Aufträge über den Erwartungen",
          body: "Die Unternehmen investieren: gestützter Dollar, festere Industriewerte.",
        },
        {
          tone: "down",
          label: "Aufträge unter den Erwartungen",
          body: "Schrumpfende Investitionen: Zeichen unternehmerischer Vorsicht, schwächerer Dollar, Industriewerte unter Druck.",
        },
      ],
      watch: [
        "Gegen Monatsende, 14:30 Uhr MEZ.",
        "Lies den Wert ohne Verkehr, nie die rohe Gesamtzahl.",
        "Sehr volatil: der Dreimonatstrend schlägt jeden Einzelmonat.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Qué es un bien duradero",
          body: "Un bien pensado para durar al menos tres años: máquina herramienta, camión, avión, equipo informático profesional. Los pedidos de bienes duraderos miden por tanto los compromisos de empresas y hogares en compras pesadas, es decir, decisiones sobre el futuro.",
        },
        {
          heading: "Por qué hay que quitar el transporte",
          body: "Un solo pedido de decenas de aviones puede disparar el total un 20 % sin decir nada de la economía. Por eso la línea de referencia es sin transporte, y aún mejor los pedidos de bienes de equipo excluyendo defensa y aeronáutica: la medida limpia de la inversión empresarial.",
        },
        {
          heading: "Un indicador adelantado del ciclo de inversión",
          body: "Una empresa solo encarga una nueva línea de producción si cree en su demanda futura. Estos pedidos giran por tanto antes que la producción y que el empleo industrial: es una señal temprana, pero muy ruidosa de un mes a otro.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Pedidos por encima de lo esperado",
          body: "Las empresas invierten: dólar apoyado y valores industriales firmes.",
        },
        {
          tone: "down",
          label: "Pedidos por debajo de lo esperado",
          body: "Inversión que se contrae: señal de prudencia empresarial, dólar a la baja, industriales presionadas.",
        },
      ],
      watch: [
        "Hacia final de mes, 8:30 de Nueva York.",
        "Mira el dato sin transporte, nunca el total bruto.",
        "Dato muy volátil: la tendencia a tres meses vale más que un mes suelto.",
      ],
    },
  },

  building_permits: {
    fr: {
      sections: [
        {
          heading: "L'autorisation avant le chantier",
          body: "Un permis de construire est déposé avant que la moindre pelleteuse n'arrive. Le nombre de permis délivrés mesure donc l'intention de construire, plusieurs mois avant les mises en chantier, elles-mêmes bien avant les livraisons de logements.",
        },
        {
          heading: "Pourquoi l'immobilier annonce le cycle",
          body: "La construction est l'un des secteurs les plus sensibles aux taux d'intérêt : quand le crédit se renchérit, les projets sont reportés les premiers, et quand il se détend, ils repartent les premiers. Les permis de construire font partie des indicateurs avancés officiels du cycle américain pour cette raison précise.",
        },
        {
          heading: "Son effet de diffusion",
          body: "Un chantier entraîne du bois, du ciment, des électroménagers, des meubles, des emplois locaux. Le marché lit donc les permis bien au-delà du logement : c'est un signal sur la demande future de toute une chaîne industrielle.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Plus de permis qu'attendu",
          body: "Confiance des promoteurs et crédit qui circule : dollar soutenu, valeurs de la construction et matériaux bien orientées.",
        },
        {
          tone: "down",
          label: "Moins de permis qu'attendu",
          body: "Les taux mordent : construction en repli, signal avancé de ralentissement de l'investissement et de l'emploi local.",
        },
      ],
      watch: [
        "Vers le milieu du mois, 14h30 heure de Paris, avec les mises en chantier.",
        "Série sensible à la météo : un hiver rude fausse un mois.",
        "Lis-la avec les taux hypothécaires, qui en sont la cause principale.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The permission before the site",
          body: "A building permit is filed before a single digger turns up. The number of permits issued therefore measures the intention to build, several months ahead of housing starts, which themselves come well before completions.",
        },
        {
          heading: "Why housing leads the cycle",
          body: "Construction is one of the most rate-sensitive sectors: when credit gets expensive, projects are the first to be shelved, and when it eases, they are the first to restart. That is precisely why building permits sit in the official US leading indicators.",
        },
        {
          heading: "Its spillover effect",
          body: "A building site pulls in timber, cement, appliances, furniture and local jobs. So the market reads permits well beyond housing: it is a signal about future demand across an entire industrial chain.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "More permits than expected",
          body: "Developer confidence and credit flowing: a supported dollar, firmer construction and materials names.",
        },
        {
          tone: "down",
          label: "Fewer permits than expected",
          body: "Rates are biting: construction pulling back, an early signal of slowing investment and local employment.",
        },
      ],
      watch: [
        "Around mid-month, 8:30am New York time, alongside housing starts.",
        "Weather-sensitive series: a harsh winter distorts a month.",
        "Read it with mortgage rates, which are its main driver.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Die Genehmigung vor der Baustelle",
          body: "Eine Baugenehmigung wird beantragt, bevor der erste Bagger anrückt. Die Zahl der erteilten Genehmigungen misst also die Bauabsicht, mehrere Monate vor den Baubeginnen, die ihrerseits lange vor den Fertigstellungen liegen.",
        },
        {
          heading: "Warum der Bau dem Zyklus vorausläuft",
          body: "Der Bau ist einer der zinssensibelsten Sektoren: wird Kredit teuer, werden Projekte zuerst verschoben, entspannt er sich, starten sie zuerst wieder. Genau deshalb gehören Baugenehmigungen zu den offiziellen US-Frühindikatoren.",
        },
        {
          heading: "Die Ausstrahlung",
          body: "Eine Baustelle zieht Holz, Zement, Haushaltsgeräte, Möbel und lokale Arbeitsplätze nach sich. Der Markt liest Genehmigungen daher weit über den Wohnungsbau hinaus: als Signal für die künftige Nachfrage einer ganzen Industriekette.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Mehr Genehmigungen als erwartet",
          body: "Zuversicht der Bauträger und fließender Kredit: gestützter Dollar, festere Bau- und Baustoffwerte.",
        },
        {
          tone: "down",
          label: "Weniger Genehmigungen als erwartet",
          body: "Die Zinsen beißen: rückläufiger Bau, ein frühes Signal für nachlassende Investitionen und lokale Beschäftigung.",
        },
      ],
      watch: [
        "Etwa zur Monatsmitte, 14:30 Uhr MEZ, zusammen mit den Baubeginnen.",
        "Wetterempfindliche Reihe: ein harter Winter verzerrt einen Monat.",
        "Lies sie zusammen mit den Hypothekenzinsen, ihrer Hauptursache.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El permiso antes de la obra",
          body: "Una licencia de obra se solicita antes de que llegue la primera excavadora. El número de permisos concedidos mide por tanto la intención de construir, varios meses antes de los inicios de vivienda, que a su vez van mucho antes de las entregas.",
        },
        {
          heading: "Por qué la vivienda adelanta el ciclo",
          body: "La construcción es uno de los sectores más sensibles a los tipos: cuando el crédito se encarece, los proyectos son los primeros en aplazarse, y cuando se relaja, los primeros en arrancar. Justo por eso los permisos de construcción figuran entre los indicadores adelantados oficiales de EE. UU.",
        },
        {
          heading: "Su efecto de arrastre",
          body: "Una obra arrastra madera, cemento, electrodomésticos, muebles y empleo local. El mercado lee los permisos mucho más allá de la vivienda: son una señal sobre la demanda futura de toda una cadena industrial.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Más permisos de lo esperado",
          body: "Confianza de los promotores y crédito que circula: dólar apoyado, constructoras y materiales bien orientados.",
        },
        {
          tone: "down",
          label: "Menos permisos de lo esperado",
          body: "Los tipos muerden: construcción a la baja, señal adelantada de menor inversión y empleo local.",
        },
      ],
      watch: [
        "Hacia mediados de mes, 8:30 de Nueva York, junto a los inicios de vivienda.",
        "Serie sensible al clima: un invierno duro distorsiona un mes.",
        "Léela junto a los tipos hipotecarios, que son su causa principal.",
      ],
    },
  },

  trade_balance: {
    fr: {
      sections: [
        {
          heading: "Exportations moins importations",
          body: "La balance commerciale soustrait ce qu'un pays achète à l'étranger de ce qu'il y vend. Un solde positif est un excédent, un solde négatif un déficit. Ce n'est pas un jugement de valeur : les États-Unis vivent avec un déficit structurel depuis des décennies, l'Allemagne avec un excédent.",
        },
        {
          heading: "Le lien avec la devise",
          body: "Un exportateur payé en devise étrangère doit la convertir dans sa monnaie nationale pour payer ses salaires : chaque exportation crée une demande pour la devise, chaque importation crée une offre. Un excédent qui s'élargit soutient donc mécaniquement la monnaie, à flux financiers inchangés.",
        },
        {
          heading: "Pourquoi la réaction reste modeste",
          body: "Ces flux commerciaux sont lents et largement anticipés, et ils sont écrasés par les flux financiers, bien plus gros et plus rapides. La donnée compte surtout pour les devises des pays exportateurs de matières premières (dollar australien, dollar canadien, dollar néo-zélandais), où le commerce pèse lourd dans l'économie.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Solde meilleur qu'attendu",
          body: "Excédent en hausse ou déficit en baisse : léger soutien à la devise, surtout pour une économie exportatrice.",
        },
        {
          tone: "down",
          label: "Solde moins bon qu'attendu",
          body: "Déficit qui se creuse : pression modérée sur la devise. L'effet devient significatif si le mouvement se répète plusieurs mois.",
        },
      ],
      watch: [
        "Début de mois pour les États-Unis, 14h30 heure de Paris.",
        "Donnée en valeur : une hausse du prix du pétrole creuse le déficit sans changement de volume.",
        "Compte surtout pour AUD, CAD et NZD, peu pour les grandes devises.",
      ],
    },
    en: {
      sections: [
        {
          heading: "Exports minus imports",
          body: "The trade balance subtracts what a country buys abroad from what it sells there. A positive balance is a surplus, a negative one a deficit. This is not a value judgement: the US has run a structural deficit for decades, Germany a surplus.",
        },
        {
          heading: "The link with the currency",
          body: "An exporter paid in a foreign currency has to convert it into its home currency to pay wages: every export creates demand for the currency, every import creates supply. A widening surplus therefore mechanically supports the currency, all financial flows equal.",
        },
        {
          heading: "Why the reaction stays modest",
          body: "These trade flows are slow and largely anticipated, and they are dwarfed by financial flows, which are far bigger and faster. The release matters most for commodity-exporting currencies (Australian, Canadian and New Zealand dollars), where trade is a large share of the economy.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Balance better than expected",
          body: "A larger surplus or smaller deficit: mild support for the currency, especially for an exporting economy.",
        },
        {
          tone: "down",
          label: "Balance worse than expected",
          body: "A widening deficit: moderate pressure on the currency. The effect becomes meaningful if it repeats over several months.",
        },
      ],
      watch: [
        "Early in the month for the US, 8:30am New York time.",
        "A value figure: a higher oil price widens the deficit with no change in volume.",
        "Matters mostly for AUD, CAD and NZD, much less for the major currencies.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Exporte minus Importe",
          body: "Die Handelsbilanz zieht ab, was ein Land im Ausland kauft, von dem, was es dort verkauft. Ein positiver Saldo ist ein Überschuss, ein negativer ein Defizit. Das ist kein Werturteil: die USA leben seit Jahrzehnten mit einem strukturellen Defizit, Deutschland mit einem Überschuss.",
        },
        {
          heading: "Die Verbindung zur Währung",
          body: "Ein in Fremdwährung bezahlter Exporteur muss sie in die Heimatwährung tauschen, um Löhne zu zahlen: jeder Export schafft Nachfrage nach der Währung, jeder Import Angebot. Ein wachsender Überschuss stützt die Währung daher rein mechanisch, bei unveränderten Finanzströmen.",
        },
        {
          heading: "Warum die Reaktion bescheiden bleibt",
          body: "Diese Handelsströme sind träge und weitgehend vorweggenommen, und sie werden von den viel größeren und schnelleren Finanzströmen überlagert. Die Zahl zählt vor allem für Währungen rohstoffexportierender Länder (australischer, kanadischer, neuseeländischer Dollar), wo der Handel schwer wiegt.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Saldo besser als erwartet",
          body: "Größerer Überschuss oder kleineres Defizit: leichte Stütze für die Währung, vor allem bei einer Exportwirtschaft.",
        },
        {
          tone: "down",
          label: "Saldo schlechter als erwartet",
          body: "Wachsendes Defizit: moderater Druck auf die Währung. Bedeutsam wird es, wenn es sich über mehrere Monate wiederholt.",
        },
      ],
      watch: [
        "Für die USA Anfang des Monats, 14:30 Uhr MEZ.",
        "Ein Wert: ein höherer Ölpreis weitet das Defizit ohne Mengenänderung.",
        "Zählt vor allem für AUD, CAD und NZD, weit weniger für die großen Währungen.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Exportaciones menos importaciones",
          body: "La balanza comercial resta lo que un país compra fuera de lo que le vende. Un saldo positivo es superávit, uno negativo déficit. No es un juicio de valor: EE. UU. vive con un déficit estructural desde hace décadas y Alemania con un superávit.",
        },
        {
          heading: "El vínculo con la divisa",
          body: "Un exportador cobrado en divisa extranjera tiene que convertirla a su moneda para pagar salarios: cada exportación crea demanda de la divisa y cada importación crea oferta. Un superávit que se amplía apoya por tanto mecánicamente a la moneda, con los flujos financieros constantes.",
        },
        {
          heading: "Por qué la reacción es modesta",
          body: "Estos flujos comerciales son lentos y están en gran parte anticipados, y quedan aplastados por los flujos financieros, mucho mayores y más rápidos. El dato importa sobre todo para las divisas de países exportadores de materias primas (dólar australiano, canadiense y neozelandés), donde el comercio pesa mucho.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Saldo mejor de lo esperado",
          body: "Superávit al alza o déficit a la baja: ligero apoyo a la divisa, sobre todo en una economía exportadora.",
        },
        {
          tone: "down",
          label: "Saldo peor de lo esperado",
          body: "Déficit que se agranda: presión moderada sobre la divisa. El efecto se vuelve relevante si se repite varios meses.",
        },
      ],
      watch: [
        "Principios de mes en EE. UU., 8:30 de Nueva York.",
        "Dato en valor: una subida del precio del petróleo agranda el déficit sin cambio de volumen.",
        "Cuenta sobre todo para AUD, CAD y NZD, mucho menos para las grandes divisas.",
      ],
    },
  },

  current_account: {
    fr: {
      sections: [
        {
          heading: "Plus large que la balance commerciale",
          body: "La balance courante ajoute aux échanges de biens ceux de services (tourisme, conseil, logiciel), les revenus des investissements détenus à l'étranger et les transferts (envois de fonds des travailleurs migrants, aide publique). C'est le compte complet des échanges d'un pays avec le reste du monde.",
        },
        {
          heading: "Ce qu'un déficit implique vraiment",
          body: "Un pays en déficit courant consomme plus qu'il ne produit : il doit donc attirer des capitaux étrangers pour financer l'écart. Tant que ces capitaux viennent, tout va bien. Le risque est qu'ils cessent de venir, et c'est ce qui rend les devises des pays très déficitaires vulnérables aux crises de confiance.",
        },
        {
          heading: "Une donnée structurelle, pas un signal de trading",
          body: "Elle est publiée par trimestre, avec un décalage important, et elle évolue lentement. Elle fait rarement bouger un graphique dans la minute : elle sert à comprendre pourquoi une devise est fragile sur le fond, pas à prendre une position sur la séance.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Solde meilleur qu'attendu",
          body: "Moins de dépendance aux capitaux étrangers : soutien de fond pour la devise, effet immédiat généralement faible.",
        },
        {
          tone: "down",
          label: "Solde plus dégradé qu'attendu",
          body: "Besoin de financement extérieur accru : fragilité de fond de la devise, qui se révèle surtout quand l'aversion au risque monte.",
        },
      ],
      watch: [
        "Publication trimestrielle, avec un décalage de plusieurs semaines.",
        "Impact immédiat faible : c'est un indicateur de contexte, pas de séance.",
        "Un pays très déficitaire souffre davantage quand l'appétit pour le risque se retourne.",
      ],
    },
    en: {
      sections: [
        {
          heading: "Broader than the trade balance",
          body: "The current account adds services (tourism, consulting, software) to goods trade, along with income from investments held abroad and transfers (migrant remittances, public aid). It is the complete account of a country's dealings with the rest of the world.",
        },
        {
          heading: "What a deficit really implies",
          body: "A country in current-account deficit consumes more than it produces: it therefore has to attract foreign capital to fund the gap. As long as that capital keeps coming, all is well. The risk is that it stops, and that is what makes heavily deficit currencies vulnerable to confidence shocks.",
        },
        {
          heading: "A structural figure, not a trading signal",
          body: "It is published quarterly, with a long lag, and it moves slowly. It rarely moves a chart within the minute: it explains why a currency is fundamentally fragile, it does not set up an intraday position.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Balance better than expected",
          body: "Less dependence on foreign capital: underlying support for the currency, usually a small immediate effect.",
        },
        {
          tone: "down",
          label: "Balance worse than expected",
          body: "A greater external funding need: underlying fragility in the currency, which shows up mostly when risk aversion rises.",
        },
      ],
      watch: [
        "Quarterly release, several weeks after the period.",
        "Small immediate impact: a context indicator, not a session one.",
        "A heavily deficit country suffers more when risk appetite turns.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Breiter als die Handelsbilanz",
          body: "Die Leistungsbilanz ergänzt den Warenhandel um Dienstleistungen (Tourismus, Beratung, Software), um Einkommen aus Auslandsanlagen und um Übertragungen (Rücküberweisungen, staatliche Hilfen). Sie ist die vollständige Rechnung eines Landes mit dem Rest der Welt.",
        },
        {
          heading: "Was ein Defizit wirklich bedeutet",
          body: "Ein Land mit Leistungsbilanzdefizit konsumiert mehr, als es produziert: es muss ausländisches Kapital anziehen, um die Lücke zu schließen. Solange dieses Kapital kommt, ist alles gut. Das Risiko ist, dass es ausbleibt, und genau das macht Währungen stark defizitärer Länder anfällig für Vertrauenskrisen.",
        },
        {
          heading: "Eine strukturelle Größe, kein Handelssignal",
          body: "Sie erscheint quartalsweise mit deutlicher Verzögerung und verändert sich langsam. Sie bewegt selten einen Chart innerhalb einer Minute: sie erklärt, warum eine Währung grundsätzlich fragil ist, sie begründet keine Tagesposition.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Saldo besser als erwartet",
          body: "Geringere Abhängigkeit von ausländischem Kapital: grundsätzliche Stütze für die Währung, meist geringe Sofortwirkung.",
        },
        {
          tone: "down",
          label: "Saldo schlechter als erwartet",
          body: "Höherer Außenfinanzierungsbedarf: strukturelle Schwäche der Währung, die vor allem bei steigender Risikoaversion sichtbar wird.",
        },
      ],
      watch: [
        "Quartalsweise, mehrere Wochen nach dem Zeitraum.",
        "Geringe Sofortwirkung: ein Kontextindikator, kein Sitzungsindikator.",
        "Ein stark defizitäres Land leidet mehr, wenn die Risikoneigung dreht.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Más amplia que la balanza comercial",
          body: "La balanza por cuenta corriente añade al comercio de bienes el de servicios (turismo, consultoría, software), las rentas de las inversiones en el exterior y las transferencias (remesas de migrantes, ayuda pública). Es la cuenta completa de los intercambios de un país con el resto del mundo.",
        },
        {
          heading: "Lo que implica de verdad un déficit",
          body: "Un país con déficit por cuenta corriente consume más de lo que produce: tiene que atraer capital extranjero para financiar la diferencia. Mientras ese capital llegue, no hay problema. El riesgo es que deje de llegar, y eso hace vulnerables a crisis de confianza a las divisas de los países muy deficitarios.",
        },
        {
          heading: "Un dato estructural, no una señal de trading",
          body: "Se publica por trimestres, con un retraso importante, y evoluciona despacio. Rara vez mueve un gráfico en un minuto: sirve para entender por qué una divisa es frágil de fondo, no para abrir una posición en la sesión.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Saldo mejor de lo esperado",
          body: "Menos dependencia del capital extranjero: apoyo de fondo para la divisa, con efecto inmediato normalmente pequeño.",
        },
        {
          tone: "down",
          label: "Saldo peor de lo esperado",
          body: "Mayor necesidad de financiación exterior: fragilidad de fondo de la divisa, que se nota sobre todo cuando sube la aversión al riesgo.",
        },
      ],
      watch: [
        "Publicación trimestral, varias semanas después del periodo.",
        "Impacto inmediato bajo: es un indicador de contexto, no de sesión.",
        "Un país muy deficitario sufre más cuando se da la vuelta el apetito por el riesgo.",
      ],
    },
  },
};
