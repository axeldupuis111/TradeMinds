import type { DeepDiveRecord } from "./types";

/** Inflation : CPI, PPI, PCE. */
export const INFLATION: Record<string, DeepDiveRecord> = {
  cpi: {
    fr: {
      sections: [
        {
          heading: "Comment le panier est construit",
          body: "L'indice des prix à la consommation suit le prix d'un panier fixe de biens et de services (logement, alimentation, énergie, transport, santé, loisirs) relevé chaque mois dans des milliers de points de vente. Chaque poste est pondéré par sa part dans le budget des ménages : aux États-Unis, le logement pèse à lui seul près d'un tiers de l'indice, ce qui explique qu'il puisse à lui seul décider du chiffre du mois.",
        },
        {
          heading: "Pourquoi tout le monde regarde le « core »",
          body: "Le CPI sous-jacent (core) retire l'alimentation et l'énergie. Ce n'est pas parce qu'elles ne comptent pas, c'est parce que leurs prix bougent pour des raisons météo ou géopolitiques qui ne disent rien de la tendance de fond. Les banques centrales pilotent sur la tendance, pas sur le bruit : quand le titre et le core divergent, c'est le core qui fait la réaction du marché.",
        },
        {
          heading: "Mensuel ou annuel : les deux racontent autre chose",
          body: "La variation annuelle donne le niveau d'inflation dont parlent les médias, mais elle traîne l'année écoulée : elle peut baisser simplement parce qu'un mois très élevé sort de la comparaison (l'effet de base). La variation mensuelle décrit ce qui se passe MAINTENANT. Les professionnels lisent le mensuel, annualisé sur trois ou six mois, pour savoir où va vraiment l'inflation.",
        },
        {
          heading: "Pourquoi c'est souvent l'annonce la plus violente du mois",
          body: "Le CPI décide directement des attentes de taux, et les attentes de taux valorisent tout le reste. Une surprise de deux dixièmes réécrit la trajectoire attendue de la banque centrale du pays concerné, donc le rendement à deux ans, donc le dollar, donc l'or, donc les multiples des actions. C'est le seul chiffre qui touche toutes les classes d'actifs dans la même seconde.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Inflation plus forte qu'attendu",
          body: "Le marché anticipe des taux plus élevés plus longtemps : le dollar monte, l'or et les obligations baissent, les indices baissent (les valeurs de croissance en premier, car elles sont les plus sensibles aux taux).",
        },
        {
          tone: "down",
          label: "Inflation plus faible qu'attendu",
          body: "Des baisses de taux redeviennent crédibles : le dollar recule, l'or et les obligations montent, les indices montent souvent fort. C'est le scénario qui produit les plus grosses séances haussières de l'année.",
        },
        {
          tone: "neutral",
          label: "Conforme au consensus",
          body: "Le marché lit alors le détail : logement, services hors logement, biens. Un chiffre conforme avec une composition inquiétante peut tout de même faire réagir les taux.",
        },
      ],
      watch: [
        "Publié vers le milieu du mois. L'heure dépend du pays : celle de cette annonce est en haut de la fiche.",
        "Le core prime sur le chiffre global en cas de divergence.",
        "L'effet de base peut faire baisser l'annuel sans qu'aucun prix ne baisse.",
        "Les cinq premières minutes se retournent souvent : laisse le marché choisir sa direction.",
      ],
    },
    en: {
      sections: [
        {
          heading: "How the basket is built",
          body: "The consumer price index tracks the price of a fixed basket of goods and services (housing, food, energy, transport, healthcare, leisure) collected monthly across thousands of outlets. Each line is weighted by its share of household budgets: in the US, housing alone is close to a third of the index, which is why it can decide the month's number on its own.",
        },
        {
          heading: "Why everyone watches core",
          body: "Core CPI strips out food and energy. Not because they do not matter, but because their prices move for weather or geopolitical reasons that say nothing about the underlying trend. Central banks steer on the trend, not the noise: when headline and core diverge, core drives the market reaction.",
        },
        {
          heading: "Monthly or yearly: they tell different stories",
          body: "The yearly change is the inflation number the media quote, but it drags the past twelve months behind it: it can fall simply because a very high month drops out of the comparison (the base effect). The monthly change describes what is happening NOW. Professionals read the monthly figure, annualised over three or six months, to see where inflation is really going.",
        },
        {
          heading: "Why it is often the most violent release of the month",
          body: "CPI sets rate expectations directly, and rate expectations price everything else. A two-tenths surprise rewrites the expected path of that country's central bank, so the two-year yield, so the dollar, so gold, so equity multiples. It is the one number that hits every asset class in the same second.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Hotter than expected",
          body: "The market prices higher rates for longer: the dollar rises, gold and bonds fall, indices fall (growth names first, as they are the most rate-sensitive).",
        },
        {
          tone: "down",
          label: "Cooler than expected",
          body: "Rate cuts become credible again: the dollar slips, gold and bonds rise, indices often rally hard. This is the scenario behind the biggest up days of the year.",
        },
        {
          tone: "neutral",
          label: "In line with consensus",
          body: "The market then reads the detail: shelter, services ex-shelter, goods. An in-line print with a worrying composition can still move yields.",
        },
      ],
      watch: [
        "Released mid-month. The time depends on the country: this announcement's own time is at the top of the card.",
        "Core beats headline when the two disagree.",
        "The base effect can pull the yearly rate down with no price actually falling.",
        "The first five minutes often reverse: let the market pick its direction.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Wie der Warenkorb gebaut ist",
          body: "Der Verbraucherpreisindex verfolgt den Preis eines festen Korbs aus Waren und Dienstleistungen (Wohnen, Lebensmittel, Energie, Verkehr, Gesundheit, Freizeit), monatlich in tausenden Verkaufsstellen erhoben. Jede Position wird mit ihrem Anteil am Haushaltsbudget gewichtet: in den USA macht Wohnen allein fast ein Drittel des Index aus und kann die Monatszahl im Alleingang entscheiden.",
        },
        {
          heading: "Warum alle auf die Kernrate schauen",
          body: "Die Kernrate klammert Lebensmittel und Energie aus. Nicht weil sie unwichtig wären, sondern weil ihre Preise aus Wetter- oder geopolitischen Gründen schwanken, die nichts über den Grundtrend sagen. Notenbanken steuern nach dem Trend, nicht nach dem Rauschen: weichen Gesamt- und Kernrate voneinander ab, bestimmt die Kernrate die Reaktion.",
        },
        {
          heading: "Monatlich oder jährlich: zwei Geschichten",
          body: "Die Jahresrate ist die Zahl, die in den Medien steht, schleppt aber zwölf Monate hinter sich her: sie kann allein deshalb fallen, weil ein sehr hoher Monat aus dem Vergleich fällt (Basiseffekt). Die Monatsrate beschreibt, was JETZT passiert. Profis lesen den Monatswert, über drei oder sechs Monate annualisiert.",
        },
        {
          heading: "Warum es oft die heftigste Zahl des Monats ist",
          body: "Der CPI bestimmt direkt die Zinserwartungen, und die Zinserwartungen bepreisen alles andere. Zwei Zehntel Überraschung schreiben den erwarteten Pfad der jeweiligen Notenbank um, damit die zweijährige Rendite, den Dollar, das Gold, die Aktienbewertungen. Es ist die einzige Zahl, die alle Anlageklassen in derselben Sekunde trifft.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Höher als erwartet",
          body: "Der Markt preist länger hohe Zinsen: der Dollar steigt, Gold und Anleihen fallen, Indizes fallen (Wachstumswerte zuerst, weil am zinssensibelsten).",
        },
        {
          tone: "down",
          label: "Niedriger als erwartet",
          body: "Zinssenkungen werden wieder glaubwürdig: der Dollar gibt nach, Gold und Anleihen steigen, Indizes ziehen oft kräftig an. Dieses Szenario bringt die größten Aufwärtstage des Jahres.",
        },
        {
          tone: "neutral",
          label: "Im Rahmen des Konsenses",
          body: "Dann liest der Markt das Detail: Wohnen, Dienstleistungen ohne Wohnen, Waren. Eine erwartungsgemäße Zahl mit bedenklicher Zusammensetzung bewegt die Renditen trotzdem.",
        },
      ],
      watch: [
        "Erscheint Mitte des Monats. Die Uhrzeit hängt vom Land ab: die dieser Ankündigung steht oben auf der Karte.",
        "Bei Abweichung zählt die Kernrate mehr als die Gesamtrate.",
        "Der Basiseffekt kann die Jahresrate drücken, ohne dass ein Preis fällt.",
        "Die ersten fünf Minuten drehen oft: lass den Markt seine Richtung wählen.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Cómo se construye la cesta",
          body: "El índice de precios al consumo sigue el precio de una cesta fija de bienes y servicios (vivienda, alimentación, energía, transporte, sanidad, ocio) recogida cada mes en miles de puntos de venta. Cada partida se pondera por su peso en el presupuesto de los hogares: en EE. UU. la vivienda supone casi un tercio del índice, y puede decidir por sí sola el dato del mes.",
        },
        {
          heading: "Por qué todo el mundo mira el subyacente",
          body: "El IPC subyacente quita alimentación y energía. No porque no importen, sino porque sus precios se mueven por razones meteorológicas o geopolíticas que no dicen nada de la tendencia de fondo. Los bancos centrales pilotan por la tendencia, no por el ruido: cuando el general y el subyacente divergen, es el subyacente el que provoca la reacción.",
        },
        {
          heading: "Mensual o anual: cuentan cosas distintas",
          body: "La variación anual es la inflación de la que hablan los medios, pero arrastra los doce meses anteriores: puede bajar solo porque un mes muy alto sale de la comparación (efecto base). La variación mensual describe lo que pasa AHORA. Los profesionales leen el mensual, anualizado a tres o seis meses.",
        },
        {
          heading: "Por qué suele ser el dato más violento del mes",
          body: "El IPC fija directamente las expectativas de tipos, y las expectativas de tipos valoran todo lo demás. Una sorpresa de dos décimas reescribe la senda esperada del banco central del país, por tanto el bono a dos años, el dólar, el oro y los múltiplos de la bolsa. Es el único dato que toca todas las clases de activo en el mismo segundo.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Inflación más alta de lo esperado",
          body: "El mercado descuenta tipos altos durante más tiempo: el dólar sube, el oro y los bonos bajan, los índices caen (primero las tecnológicas de crecimiento, las más sensibles a los tipos).",
        },
        {
          tone: "down",
          label: "Inflación más baja de lo esperado",
          body: "Las bajadas de tipos vuelven a ser creíbles: el dólar retrocede, el oro y los bonos suben y los índices suelen subir con fuerza. Es el escenario de las mayores sesiones alcistas del año.",
        },
        {
          tone: "neutral",
          label: "En línea con el consenso",
          body: "El mercado pasa al detalle: vivienda, servicios sin vivienda, bienes. Un dato en línea con una composición preocupante puede mover igualmente los tipos.",
        },
      ],
      watch: [
        "Se publica a mediados de mes. La hora depende del país: la de este anuncio está arriba en la ficha.",
        "El subyacente manda sobre el general cuando difieren.",
        "El efecto base puede bajar la tasa anual sin que ningún precio baje.",
        "Los cinco primeros minutos suelen darse la vuelta: deja que el mercado elija dirección.",
      ],
    },
  },

  ppi: {
    fr: {
      sections: [
        {
          heading: "L'inflation vue du côté des entreprises",
          body: "L'indice des prix à la production mesure ce que les producteurs ENCAISSENT pour leurs biens et services, avant qu'ils n'arrivent en rayon. C'est l'inflation à la source : matières premières, produits intermédiaires, produits finis sortis d'usine.",
        },
        {
          heading: "Pourquoi il précède parfois le CPI",
          body: "Une entreprise qui paie ses intrants plus cher finit par répercuter cette hausse sur ses clients, avec quelques mois de décalage et seulement si la demande le permet. Le PPI est donc lu comme un indice avancé, imparfait : quand les marges absorbent le choc, la hausse ne se transmet jamais au consommateur.",
        },
        {
          heading: "Sa vraie utilité dans le calendrier",
          body: "Publié généralement le lendemain du CPI, il sert de confirmation ou de démenti. Deux chiffres qui vont dans le même sens renforcent le mouvement de la veille ; deux chiffres contradictoires le neutralisent souvent. Certaines de ses composantes alimentent aussi directement le calcul du PCE, l'indicateur préféré de la Fed.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Prix à la production en hausse surprise",
          body: "Le marché anticipe une transmission vers les prix à la consommation : le dollar se renforce, les obligations baissent. Réaction plus modérée que sur le CPI.",
        },
        {
          tone: "down",
          label: "Prix à la production en baisse surprise",
          body: "Pression inflationniste qui reflue à la source : favorable aux obligations et aux actions, défavorable au dollar.",
        },
      ],
      watch: [
        "Souvent le lendemain du CPI du même pays.",
        "Réaction plus faible que le CPI, sauf quand les deux se contredisent.",
        "Une hausse des coûts ne devient de l'inflation que si les entreprises peuvent la répercuter.",
      ],
    },
    en: {
      sections: [
        {
          heading: "Inflation seen from the producer's side",
          body: "The producer price index measures what producers RECEIVE for their goods and services, before anything reaches a shelf. It is inflation at source: raw materials, intermediate goods, finished output leaving the factory.",
        },
        {
          heading: "Why it sometimes leads CPI",
          body: "A firm paying more for its inputs eventually passes that on to customers, with a few months' lag and only if demand allows. So PPI reads as a leading indicator, an imperfect one: when margins absorb the shock, the increase never reaches the consumer.",
        },
        {
          heading: "Its real use in the calendar",
          body: "Usually published the day after CPI, it confirms or contradicts. Two numbers pointing the same way reinforce the previous day's move; two contradicting each other often neutralise it. Some of its components also feed directly into the PCE calculation, the Fed's preferred gauge.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Producer prices surprise higher",
          body: "The market expects pass-through to consumer prices: the dollar firms, bonds fall. A more moderate reaction than on CPI.",
        },
        {
          tone: "down",
          label: "Producer prices surprise lower",
          body: "Inflation pressure receding at source: friendly for bonds and equities, unfriendly for the dollar.",
        },
      ],
      watch: [
        "Often the day after the same country's CPI.",
        "A weaker reaction than CPI, except when the two contradict each other.",
        "Rising costs only become inflation if firms can pass them on.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Inflation aus Sicht der Unternehmen",
          body: "Der Erzeugerpreisindex misst, was Produzenten für ihre Güter und Dienstleistungen ERHALTEN, bevor etwas im Regal landet. Das ist Inflation an der Quelle: Rohstoffe, Vorprodukte, fertige Ware ab Werk.",
        },
        {
          heading: "Warum er dem CPI manchmal vorausläuft",
          body: "Ein Unternehmen, das mehr für Vorleistungen zahlt, gibt das irgendwann weiter, mit einigen Monaten Verzögerung und nur, wenn die Nachfrage es zulässt. Der PPI gilt daher als Frühindikator, ein unvollkommener: fangen die Margen den Schock auf, erreicht die Erhöhung den Verbraucher nie.",
        },
        {
          heading: "Sein eigentlicher Nutzen im Kalender",
          body: "Meist am Tag nach dem CPI veröffentlicht, bestätigt oder widerlegt er. Zwei gleichgerichtete Zahlen verstärken die Bewegung vom Vortag; zwei widersprüchliche neutralisieren sie oft. Einige Komponenten fließen zudem direkt in die PCE-Berechnung ein, das bevorzugte Maß der Fed.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Erzeugerpreise überraschend höher",
          body: "Der Markt erwartet eine Weitergabe an die Verbraucherpreise: der Dollar zieht an, Anleihen fallen. Moderatere Reaktion als beim CPI.",
        },
        {
          tone: "down",
          label: "Erzeugerpreise überraschend niedriger",
          body: "Inflationsdruck lässt an der Quelle nach: freundlich für Anleihen und Aktien, unfreundlich für den Dollar.",
        },
      ],
      watch: [
        "Oft am Tag nach dem CPI desselben Landes.",
        "Schwächere Reaktion als beim CPI, außer wenn beide sich widersprechen.",
        "Steigende Kosten werden nur dann Inflation, wenn Firmen sie weitergeben können.",
      ],
    },
    es: {
      sections: [
        {
          heading: "La inflación vista desde las empresas",
          body: "El índice de precios de producción mide lo que los productores COBRAN por sus bienes y servicios, antes de que lleguen al lineal. Es la inflación en origen: materias primas, productos intermedios, producto terminado a pie de fábrica.",
        },
        {
          heading: "Por qué a veces adelanta al IPC",
          body: "Una empresa que paga más por sus insumos acaba trasladándolo a sus clientes, con unos meses de retraso y solo si la demanda lo permite. Por eso el IPP se lee como indicador adelantado, imperfecto: cuando los márgenes absorben el golpe, la subida nunca llega al consumidor.",
        },
        {
          heading: "Su utilidad real en el calendario",
          body: "Suele publicarse el día después del IPC y sirve de confirmación o desmentido. Dos datos en el mismo sentido refuerzan el movimiento de la víspera; dos contradictorios lo neutralizan a menudo. Algunos de sus componentes alimentan además el cálculo del PCE, el indicador preferido de la Fed.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Precios de producción por encima de lo previsto",
          body: "El mercado anticipa traslado a los precios de consumo: el dólar se refuerza y los bonos bajan. Reacción más moderada que con el IPC.",
        },
        {
          tone: "down",
          label: "Precios de producción por debajo de lo previsto",
          body: "La presión inflacionista cede en origen: favorable para bonos y bolsa, desfavorable para el dólar.",
        },
      ],
      watch: [
        "A menudo el día después del IPC del mismo país.",
        "Reacción más floja que el IPC, salvo cuando ambos se contradicen.",
        "Una subida de costes solo se convierte en inflación si las empresas pueden trasladarla.",
      ],
    },
  },

  pce: {
    fr: {
      sections: [
        {
          heading: "L'indicateur que la Fed regarde vraiment",
          body: "Le PCE mesure l'inflation à partir des dépenses réellement effectuées par les ménages, telles que les comptes nationaux les enregistrent. C'est CET indice, et non le CPI, que la Fed a inscrit dans sa cible de 2 % : quand elle dit « l'inflation », elle parle du PCE sous-jacent.",
        },
        {
          heading: "Pourquoi il diffère du CPI",
          body: "Deux raisons. Ses pondérations se mettent à jour en continu : si le bœuf devient trop cher et que les ménages achètent du poulet, le panier suit ce report, là où le CPI garde un panier fixe plus longtemps. Et son périmètre est plus large (il inclut par exemple les soins payés par les assurances). Résultat, le PCE affiche presque toujours une inflation un peu plus basse que le CPI.",
        },
        {
          heading: "Une réaction plus calme, et c'est logique",
          body: "Il est publié en fin de mois, environ deux semaines après le CPI, et l'essentiel de son contenu est déjà déductible du CPI et du PPI : les analystes l'estiment avec précision avant sa sortie. Le marché bouge donc moins, sauf quand le core surprend d'un dixième, parce que c'est exactement ce chiffre que la Fed compare à sa cible.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "PCE sous-jacent au-dessus des attentes",
          body: "La cible de 2 % s'éloigne : le dollar se renforce, les attentes de baisse de taux reculent, les indices corrigent.",
        },
        {
          tone: "down",
          label: "PCE sous-jacent en dessous des attentes",
          body: "La désinflation est confirmée par la mesure que la Fed préfère : soutien net aux obligations et aux actions, dollar plus faible.",
        },
      ],
      watch: [
        "Fin de mois, 8h30 à New York.",
        "Regarde le core annuel : c'est lui que la Fed compare à sa cible de 2 %.",
        "Réaction plus faible que le CPI parce qu'il est en grande partie anticipé.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The gauge the Fed actually watches",
          body: "PCE measures inflation from the spending households actually did, as recorded in the national accounts. It is THIS index, not CPI, that the Fed wrote into its 2% target: when it says 'inflation', it means core PCE.",
        },
        {
          heading: "Why it differs from CPI",
          body: "Two reasons. Its weights update continuously: if beef gets too expensive and households switch to chicken, the basket follows that substitution, where CPI keeps a fixed basket for longer. And its scope is wider (it includes healthcare paid by insurers, for instance). As a result PCE almost always prints slightly lower inflation than CPI.",
        },
        {
          heading: "A calmer reaction, and logically so",
          body: "It lands at the end of the month, about two weeks after CPI, and most of its content is already derivable from CPI and PPI: analysts estimate it accurately before release. So the market moves less, except when core surprises by a tenth, because that is precisely the number the Fed compares with its target.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Core PCE above expectations",
          body: "The 2% target moves further away: the dollar firms, rate-cut expectations retreat, indices correct.",
        },
        {
          tone: "down",
          label: "Core PCE below expectations",
          body: "Disinflation confirmed by the Fed's preferred measure: clear support for bonds and equities, a softer dollar.",
        },
      ],
      watch: [
        "End of month, 8:30am New York time.",
        "Watch yearly core: that is the number the Fed holds against its 2% target.",
        "A weaker reaction than CPI because it is largely anticipated.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Das Maß, auf das die Fed wirklich schaut",
          body: "Der PCE misst die Inflation anhand der tatsächlich getätigten Ausgaben der Haushalte, wie sie die Volkswirtschaftlichen Gesamtrechnungen erfassen. DIESER Index, nicht der CPI, steht im 2-Prozent-Ziel der Fed: wenn sie von Inflation spricht, meint sie den Kern-PCE.",
        },
        {
          heading: "Warum er vom CPI abweicht",
          body: "Zwei Gründe. Seine Gewichte werden laufend aktualisiert: wird Rindfleisch zu teuer und die Haushalte kaufen Hähnchen, folgt der Korb dieser Substitution, während der CPI länger an einem festen Korb festhält. Und sein Umfang ist breiter (er enthält etwa von Versicherern bezahlte Gesundheitsleistungen). Deshalb zeigt der PCE fast immer etwas niedrigere Inflation als der CPI.",
        },
        {
          heading: "Ruhigere Reaktion, und das ist logisch",
          body: "Er erscheint zum Monatsende, rund zwei Wochen nach dem CPI, und sein Inhalt lässt sich weitgehend aus CPI und PPI ableiten: Analysten schätzen ihn vorab präzise. Der Markt bewegt sich daher weniger, außer die Kernrate überrascht um ein Zehntel, denn genau diese Zahl hält die Fed gegen ihr Ziel.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Kern-PCE über den Erwartungen",
          body: "Das 2-Prozent-Ziel rückt weiter weg: der Dollar zieht an, Zinssenkungserwartungen gehen zurück, Indizes korrigieren.",
        },
        {
          tone: "down",
          label: "Kern-PCE unter den Erwartungen",
          body: "Die Disinflation wird vom bevorzugten Maß der Fed bestätigt: klare Stütze für Anleihen und Aktien, schwächerer Dollar.",
        },
      ],
      watch: [
        "Monatsende, 8:30 Uhr New Yorker Zeit.",
        "Achte auf die Jahreskernrate: sie hält die Fed gegen ihr 2-Prozent-Ziel.",
        "Schwächere Reaktion als beim CPI, weil er weitgehend vorweggenommen ist.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El indicador que la Fed mira de verdad",
          body: "El PCE mide la inflación a partir del gasto realmente efectuado por los hogares, tal como lo registran las cuentas nacionales. Es ESTE índice, y no el IPC, el que la Fed inscribió en su objetivo del 2 %: cuando dice inflación, habla del PCE subyacente.",
        },
        {
          heading: "Por qué difiere del IPC",
          body: "Dos razones. Sus ponderaciones se actualizan de forma continua: si la ternera se encarece y los hogares compran pollo, la cesta sigue esa sustitución, mientras que el IPC mantiene una cesta fija más tiempo. Y su perímetro es más amplio (incluye, por ejemplo, la sanidad pagada por aseguradoras). Por eso el PCE casi siempre muestra una inflación algo más baja que el IPC.",
        },
        {
          heading: "Una reacción más tranquila, y con lógica",
          body: "Se publica a final de mes, unas dos semanas después del IPC, y buena parte de su contenido ya se deduce del IPC y del IPP: los analistas lo estiman con precisión antes de salir. El mercado se mueve menos, salvo cuando el subyacente sorprende por una décima, porque es exactamente la cifra que la Fed compara con su objetivo.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "PCE subyacente por encima de lo esperado",
          body: "El objetivo del 2 % se aleja: el dólar se refuerza, las expectativas de bajada de tipos retroceden y los índices corrigen.",
        },
        {
          tone: "down",
          label: "PCE subyacente por debajo de lo esperado",
          body: "La desinflación queda confirmada por la medida preferida de la Fed: apoyo claro a bonos y bolsa, dólar más débil.",
        },
      ],
      watch: [
        "Final de mes, 8:30 de Nueva York.",
        "Mira el subyacente anual: es el que la Fed compara con su objetivo del 2 %.",
        "Reacción más floja que el IPC porque está en gran parte anticipado.",
      ],
    },
  },
};
