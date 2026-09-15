import type { DeepDiveRecord } from "./types";

/** Banques centrales : décision de taux, minutes de réunion. */
export const BANQUES_CENTRALES: Record<string, DeepDiveRecord> = {
  rate_decision: {
    fr: {
      sections: [
        {
          heading: "Ce qui se décide vraiment",
          body: "La banque centrale fixe le taux auquel les banques se prêtent entre elles au jour le jour. Ce taux se propage à tout le reste : crédit immobilier, financement des entreprises, rendement des obligations, coût de portage de chaque position à effet de levier. C'est le prix de l'argent, et il repose sur deux objectifs souvent contradictoires : contenir l'inflation, sans casser l'emploi.",
        },
        {
          heading: "La décision est rarement la surprise",
          body: "Le marché connaît la décision à l'avance dans neuf cas sur dix : les contrats à terme sur les taux affichent en permanence la probabilité de chaque issue, et les banquiers centraux préparent le terrain dans leurs discours pour éviter les chocs. Ce qui surprend, ce n'est donc presque jamais le chiffre, c'est ce qui l'accompagne.",
        },
        {
          heading: "Le communiqué, les projections, la conférence",
          body: "Trois couches se succèdent. Le communiqué : chaque mot compte, un adverbe retiré vaut un signal. Les projections (le fameux « dot plot » à la Fed, chaque trimestre) : les taux que les membres eux-mêmes anticipent. Puis la conférence de presse, trente à quarante-cinq minutes plus tard, où le président répond aux questions : c'est très souvent LÀ que naît le vrai mouvement, et il va fréquemment à l'inverse de la première réaction.",
        },
        {
          heading: "Ferme ou accommodant, le vocabulaire à connaître",
          body: "« Ferme » (hawkish) veut dire : priorité à l'inflation, taux plus hauts ou maintenus plus longtemps. « Accommodant » (dovish) : priorité à la croissance et à l'emploi, baisses plus proches. Un discours ferme soutient la devise et pèse sur les actions et l'or ; un discours accommodant fait l'inverse. Une banque peut baisser ses taux avec un discours ferme, et le marché lira alors le discours, pas la baisse.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Plus ferme que prévu",
          body: "Taux inchangés mais ton dur, ou hausse non anticipée : la devise se renforce nettement, les obligations et l'or baissent, les indices corrigent. L'effet dure souvent plusieurs séances, contrairement à celui d'une statistique.",
        },
        {
          tone: "down",
          label: "Plus accommodant que prévu",
          body: "Signal de baisses plus rapides : la devise s'affaiblit, les obligations, l'or et les actions montent. Le mouvement est d'autant plus large que le marché était positionné dans l'autre sens.",
        },
        {
          tone: "neutral",
          label: "Conforme aux attentes",
          body: "Le marché attend alors la conférence de presse. Une décision sans surprise suivie d'une conférence mal reçue produit quand même une grosse séance.",
        },
      ],
      watch: [
        "Regarde l'heure de la conférence de presse autant que celle de la décision.",
        "Le vote (combien de membres dissidents) est un signal à part entière.",
        "Les deux premières minutes sont souvent un faux départ : le communiqué se lit en entier.",
        "C'est le type d'annonce où une position à effet de levier peut sauter sur un simple élargissement de spread.",
      ],
    },
    en: {
      sections: [
        {
          heading: "What is actually being decided",
          body: "The central bank sets the rate at which banks lend to each other overnight. That rate spreads into everything else: mortgages, corporate funding, bond yields, the carrying cost of every leveraged position. It is the price of money, and it rests on two often conflicting goals: contain inflation without breaking employment.",
        },
        {
          heading: "The decision is rarely the surprise",
          body: "Nine times out of ten the market knows the decision in advance: rate futures continuously price the probability of each outcome, and policymakers prepare the ground in speeches to avoid shocks. So what surprises is almost never the number itself, it is what comes with it.",
        },
        {
          heading: "The statement, the projections, the press conference",
          body: "Three layers follow one another. The statement: every word counts, a dropped adverb is a signal. The projections (the Fed's 'dot plot', quarterly): the rates the members themselves expect. Then the press conference, thirty to forty-five minutes later, where the chair takes questions: very often THAT is where the real move is born, and it frequently runs against the first reaction.",
        },
        {
          heading: "Hawkish or dovish, the vocabulary to know",
          body: "Hawkish means: inflation first, rates higher or held longer. Dovish: growth and jobs first, cuts closer. A hawkish message supports the currency and weighs on equities and gold; a dovish one does the opposite. A bank can cut rates with a hawkish message, and the market will read the message, not the cut.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "More hawkish than expected",
          body: "Rates unchanged but a hard tone, or an unanticipated hike: the currency firms sharply, bonds and gold fall, indices correct. The effect often lasts several sessions, unlike a statistical release.",
        },
        {
          tone: "down",
          label: "More dovish than expected",
          body: "A signal of faster cuts: the currency weakens, bonds, gold and equities rise. The bigger the market's positioning the other way, the wider the move.",
        },
        {
          tone: "neutral",
          label: "In line with expectations",
          body: "The market then waits for the press conference. An unsurprising decision followed by a badly received conference still produces a big session.",
        },
      ],
      watch: [
        "Note the press conference time as carefully as the decision time.",
        "The vote split (how many dissenters) is a signal in its own right.",
        "The first two minutes are often a false start: the statement gets read in full.",
        "This is the kind of event where a leveraged position can be stopped out on a spread widening alone.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Was tatsächlich entschieden wird",
          body: "Die Notenbank setzt den Zins, zu dem sich Banken über Nacht Geld leihen. Dieser Zins strahlt auf alles andere aus: Immobilienkredite, Unternehmensfinanzierung, Anleiherenditen, Haltekosten jeder gehebelten Position. Er ist der Preis des Geldes und beruht auf zwei oft widersprüchlichen Zielen: die Inflation bändigen, ohne den Arbeitsmarkt zu brechen.",
        },
        {
          heading: "Die Entscheidung ist selten die Überraschung",
          body: "In neun von zehn Fällen kennt der Markt die Entscheidung vorab: Zinsfutures preisen laufend die Wahrscheinlichkeit jedes Ausgangs, und Notenbanker bereiten das Feld in Reden vor, um Schocks zu vermeiden. Was überrascht, ist daher fast nie die Zahl, sondern was sie begleitet.",
        },
        {
          heading: "Erklärung, Projektionen, Pressekonferenz",
          body: "Drei Ebenen folgen aufeinander. Die Erklärung: jedes Wort zählt, ein gestrichenes Adverb ist ein Signal. Die Projektionen (der Dot Plot der Fed, quartalsweise): die Zinsen, die die Mitglieder selbst erwarten. Dann die Pressekonferenz dreißig bis fünfundvierzig Minuten später, in der sich der Vorsitzende den Fragen stellt: sehr oft entsteht DORT die eigentliche Bewegung, und sie läuft häufig gegen die erste Reaktion.",
        },
        {
          heading: "Hawkish oder dovish, das nötige Vokabular",
          body: "Hawkish heißt: Inflation zuerst, Zinsen höher oder länger oben. Dovish: Wachstum und Arbeitsmarkt zuerst, Senkungen näher. Eine harte Botschaft stützt die Währung und belastet Aktien und Gold, eine weiche macht das Gegenteil. Eine Bank kann senken und dabei hart klingen, dann liest der Markt die Botschaft, nicht die Senkung.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Härter als erwartet",
          body: "Zinsen unverändert, aber harter Ton, oder eine unerwartete Erhöhung: die Währung zieht deutlich an, Anleihen und Gold fallen, Indizes korrigieren. Die Wirkung hält oft mehrere Sitzungen, anders als bei einer Statistik.",
        },
        {
          tone: "down",
          label: "Weicher als erwartet",
          body: "Signal für schnellere Senkungen: die Währung schwächt sich ab, Anleihen, Gold und Aktien steigen. Je einseitiger der Markt positioniert war, desto größer die Bewegung.",
        },
        {
          tone: "neutral",
          label: "Wie erwartet",
          body: "Dann wartet der Markt auf die Pressekonferenz. Eine erwartungsgemäße Entscheidung mit schlecht aufgenommener Konferenz erzeugt trotzdem einen großen Tag.",
        },
      ],
      watch: [
        "Merke dir die Uhrzeit der Pressekonferenz ebenso genau wie die der Entscheidung.",
        "Das Abstimmungsverhältnis (wie viele Gegenstimmen) ist selbst ein Signal.",
        "Die ersten zwei Minuten sind oft ein Fehlstart: die Erklärung wird erst ganz gelesen.",
        "Hier kann eine gehebelte Position allein durch eine Spread-Ausweitung ausgestoppt werden.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Lo que se decide de verdad",
          body: "El banco central fija el tipo al que los bancos se prestan entre sí a un día. Ese tipo se propaga a todo lo demás: hipotecas, financiación de empresas, rentabilidad de los bonos, coste de mantener cualquier posición apalancada. Es el precio del dinero, y descansa sobre dos objetivos a menudo contradictorios: contener la inflación sin romper el empleo.",
        },
        {
          heading: "La decisión rara vez es la sorpresa",
          body: "Nueve de cada diez veces el mercado conoce la decisión de antemano: los futuros sobre tipos muestran en todo momento la probabilidad de cada resultado, y los banqueros centrales preparan el terreno en sus discursos para evitar sustos. Lo que sorprende casi nunca es la cifra, sino lo que la acompaña.",
        },
        {
          heading: "El comunicado, las proyecciones, la rueda de prensa",
          body: "Se suceden tres capas. El comunicado: cada palabra cuenta, un adverbio retirado ya es una señal. Las proyecciones (el famoso dot plot de la Fed, cada trimestre): los tipos que los propios miembros esperan. Y la rueda de prensa, treinta o cuarenta y cinco minutos después, donde el presidente responde preguntas: muy a menudo es AHÍ donde nace el movimiento real, y con frecuencia va en contra de la primera reacción.",
        },
        {
          heading: "Duro o acomodaticio, el vocabulario necesario",
          body: "Duro (hawkish) significa: primero la inflación, tipos más altos o mantenidos más tiempo. Acomodaticio (dovish): primero el crecimiento y el empleo, bajadas más cerca. Un mensaje duro apoya a la divisa y pesa sobre bolsa y oro; uno acomodaticio hace lo contrario. Un banco puede bajar tipos con un mensaje duro, y entonces el mercado leerá el mensaje, no la bajada.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Más duro de lo previsto",
          body: "Tipos sin cambios pero tono severo, o subida no anticipada: la divisa se refuerza con claridad, los bonos y el oro bajan y los índices corrigen. El efecto suele durar varias sesiones, a diferencia de una estadística.",
        },
        {
          tone: "down",
          label: "Más acomodaticio de lo previsto",
          body: "Señal de bajadas más rápidas: la divisa se debilita y suben bonos, oro y bolsa. El movimiento es tanto mayor cuanto más posicionado estaba el mercado en el otro sentido.",
        },
        {
          tone: "neutral",
          label: "En línea con lo esperado",
          body: "El mercado espera entonces la rueda de prensa. Una decisión sin sorpresa seguida de una rueda mal recibida produce igualmente una gran sesión.",
        },
      ],
      watch: [
        "Fíjate en la hora de la rueda de prensa tanto como en la de la decisión.",
        "El reparto del voto (cuántos discrepantes) es una señal por sí mismo.",
        "Los dos primeros minutos suelen ser una salida en falso: el comunicado se lee entero.",
        "Es el tipo de evento en que una posición apalancada puede saltar solo por la apertura del spread.",
      ],
    },
  },

  fomc_minutes: {
    fr: {
      sections: [
        {
          heading: "Le compte rendu, trois semaines après",
          body: "Les minutes sont le procès-verbal détaillé de la réunion de politique monétaire, publié environ trois semaines après la décision. Elles racontent le débat : qui a plaidé quoi, quels scénarios ont été envisagés, quelles conditions déclencheraient un changement de cap.",
        },
        {
          heading: "Pourquoi un document sur le passé fait bouger le présent",
          body: "Le communiqué du jour J est court et consensuel ; les minutes révèlent la dispersion des opinions derrière ce consensus. Apprendre que plusieurs membres ont envisagé une hausse alors que le communiqué semblait neutre change l'estimation du marché sur la prochaine réunion. C'est de l'information nouvelle sur le FUTUR, extraite d'un texte sur le passé.",
        },
        {
          heading: "La limite à garder en tête",
          body: "Entre la réunion et la publication, trois à quatre semaines de données sont tombées. Si l'inflation ou l'emploi ont nettement changé depuis, les minutes sont déjà périmées et le marché les ignore largement. Leur impact est donc très variable : parfois nul, parfois comparable à une décision.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Débat plus ferme que ce que laissait croire le communiqué",
          body: "La devise se renforce, les obligations et les indices reculent. Réaction concentrée sur les premières minutes de la publication.",
        },
        {
          tone: "down",
          label: "Débat plus accommodant qu'attendu",
          body: "Les paris sur une baisse de taux avancent : devise plus faible, obligations et actions soutenues.",
        },
      ],
      watch: [
        "Trois semaines après la réunion, 20h00 heure de Paris pour la Fed.",
        "Impact très variable : nul si les données ont changé depuis, fort sinon.",
        "Cherche les conditions annoncées (« si X, alors Y ») : c'est le vrai contenu.",
      ],
    },
    en: {
      sections: [
        {
          heading: "The record, three weeks later",
          body: "The minutes are the detailed record of the policy meeting, published around three weeks after the decision. They tell the story of the debate: who argued what, which scenarios were considered, what conditions would trigger a change of course.",
        },
        {
          heading: "Why a document about the past moves the present",
          body: "The day-one statement is short and consensual; the minutes reveal the spread of opinion behind that consensus. Learning that several members considered a hike when the statement looked neutral changes the market's view of the next meeting. It is new information about the FUTURE, drawn from a text about the past.",
        },
        {
          heading: "The limit to keep in mind",
          body: "Between the meeting and publication, three or four weeks of data have landed. If inflation or employment has clearly shifted since, the minutes are already stale and the market largely ignores them. Their impact is therefore very uneven: sometimes nil, sometimes comparable to a decision.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "A more hawkish debate than the statement suggested",
          body: "The currency firms, bonds and indices give ground. The reaction is concentrated in the first minutes after release.",
        },
        {
          tone: "down",
          label: "A more dovish debate than expected",
          body: "Rate-cut bets are brought forward: a softer currency, supported bonds and equities.",
        },
      ],
      watch: [
        "Three weeks after the meeting, 2:00pm New York time for the Fed.",
        "Very uneven impact: nil if the data has moved on, large otherwise.",
        "Look for stated conditions ('if X, then Y'): that is the real content.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Das Protokoll, drei Wochen später",
          body: "Die Minutes sind das ausführliche Protokoll der geldpolitischen Sitzung, rund drei Wochen nach der Entscheidung veröffentlicht. Sie erzählen die Debatte: wer was vertrat, welche Szenarien erwogen wurden, welche Bedingungen einen Kurswechsel auslösen würden.",
        },
        {
          heading: "Warum ein Dokument über die Vergangenheit die Gegenwart bewegt",
          body: "Die Erklärung am Sitzungstag ist kurz und konsensual; die Minutes zeigen die Meinungsbreite dahinter. Zu erfahren, dass mehrere Mitglieder eine Erhöhung erwogen, obwohl die Erklärung neutral wirkte, ändert die Einschätzung zur nächsten Sitzung. Es ist neue Information über die ZUKUNFT, gewonnen aus einem Text über die Vergangenheit.",
        },
        {
          heading: "Die Grenze, die man kennen sollte",
          body: "Zwischen Sitzung und Veröffentlichung sind drei bis vier Wochen Daten eingetroffen. Haben sich Inflation oder Arbeitsmarkt seither deutlich verändert, sind die Minutes bereits überholt und der Markt ignoriert sie weitgehend. Ihre Wirkung schwankt daher stark: mal null, mal wie eine Entscheidung.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Härtere Debatte als die Erklärung nahelegte",
          body: "Die Währung zieht an, Anleihen und Indizes geben nach. Die Reaktion konzentriert sich auf die ersten Minuten nach der Veröffentlichung.",
        },
        {
          tone: "down",
          label: "Weichere Debatte als erwartet",
          body: "Wetten auf Zinssenkungen rücken vor: schwächere Währung, gestützte Anleihen und Aktien.",
        },
      ],
      watch: [
        "Drei Wochen nach der Sitzung, für die Fed um 20:00 Uhr MEZ.",
        "Sehr unterschiedliche Wirkung: null, wenn die Daten weitergelaufen sind, sonst groß.",
        "Suche nach genannten Bedingungen (wenn X, dann Y): das ist der eigentliche Inhalt.",
      ],
    },
    es: {
      sections: [
        {
          heading: "El acta, tres semanas después",
          body: "Las actas son el registro detallado de la reunión de política monetaria, publicado unas tres semanas después de la decisión. Cuentan el debate: quién defendió qué, qué escenarios se estudiaron y qué condiciones provocarían un cambio de rumbo.",
        },
        {
          heading: "Por qué un documento sobre el pasado mueve el presente",
          body: "El comunicado del día es corto y consensuado; las actas revelan la dispersión de opiniones detrás de ese consenso. Saber que varios miembros contemplaron una subida cuando el comunicado parecía neutro cambia la estimación del mercado sobre la próxima reunión. Es información nueva sobre el FUTURO, extraída de un texto sobre el pasado.",
        },
        {
          heading: "El límite que hay que tener presente",
          body: "Entre la reunión y la publicación han llegado tres o cuatro semanas de datos. Si la inflación o el empleo han cambiado claramente desde entonces, las actas ya están caducadas y el mercado las ignora en buena medida. Su impacto es por tanto muy variable: a veces nulo, a veces comparable al de una decisión.",
        },
      ],
      outcomes: [
        {
          tone: "up",
          label: "Debate más duro de lo que sugería el comunicado",
          body: "La divisa se refuerza, los bonos y los índices ceden. La reacción se concentra en los primeros minutos tras la publicación.",
        },
        {
          tone: "down",
          label: "Debate más acomodaticio de lo esperado",
          body: "Las apuestas por una bajada de tipos se adelantan: divisa más débil, bonos y bolsa apoyados.",
        },
      ],
      watch: [
        "Tres semanas después de la reunión, 14:00 de Nueva York en el caso de la Fed.",
        "Impacto muy variable: nulo si los datos han cambiado, fuerte si no.",
        "Busca las condiciones enunciadas (si X, entonces Y): ese es el contenido real.",
      ],
    },
  },
};
