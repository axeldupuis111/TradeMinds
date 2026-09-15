import type { DeepDiveRecord } from "./types";

/** Énergie : stocks hebdomadaires de brut. */
export const ENERGIE: Record<string, DeepDiveRecord> = {
  crude_oil_inventories: {
    fr: {
      sections: [
        {
          heading: "Ce que mesure le rapport",
          body: "Chaque mercredi, l'agence américaine de l'énergie publie la variation des stocks de pétrole brut détenus sur le territoire, hors réserve stratégique. Une hausse des stocks signifie qu'il est arrivé plus de brut que les raffineries n'en ont consommé ; une baisse, l'inverse. C'est une mesure directe de l'équilibre entre offre et demande, semaine après semaine.",
        },
        {
          heading: "Pourquoi le prix réagit immédiatement",
          body: "Le pétrole se stocke difficilement et coûte cher à immobiliser. Un excédent inattendu doit trouver preneur tout de suite : le prix baisse jusqu'à ce que quelqu'un accepte de l'acheter. À l'inverse, un déstockage plus fort que prévu signale une demande vigoureuse et fait monter le baril dans la minute.",
        },
        {
          heading: "Les lignes qui expliquent la surprise",
          body: "Le même rapport donne les stocks d'essence et de distillats, le taux d'utilisation des raffineries et la production américaine. Une hausse des stocks de brut due à des raffineries à l'arrêt pour maintenance ne dit rien de la demande finale : c'est là que se joue la différence entre une réaction durable et un faux signal.",
        },
        {
          heading: "Qui est concerné au-delà du pétrole",
          body: "Le prix du baril se propage aux devises des pays producteurs (dollar canadien, couronne norvégienne, rouble), aux compagnies pétrolières cotées, aux compagnies aériennes par leurs coûts, et à l'inflation par le prix des carburants. Une surprise sur les stocks peut donc se retrouver, deux mois plus tard, dans un chiffre d'inflation.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Stocks en hausse (plus que prévu)",
          body: "Offre abondante ou demande faible : le baril baisse, les compagnies pétrolières suivent, le dollar canadien se détend. Bon pour les transporteurs et pour l'inflation.",
        },
        {
          tone: "up",
          label: "Stocks en baisse (plus que prévu)",
          body: "Demande vigoureuse ou offre contrainte : le baril monte, les pétrolières et les devises productrices en profitent, la facture énergétique remonte.",
        },
      ],
      watch: [
        "Chaque mercredi, 16h30 heure de Paris (10h30 à New York).",
        "L'API publie son propre chiffre la veille au soir : il donne souvent le ton.",
        "Regarde aussi essence, distillats et taux d'utilisation des raffineries.",
        "Réaction très rapide sur le baril : c'est un des créneaux les plus volatils de la semaine.",
      ],
    },
    en: {
      sections: [
        {
          heading: "What the report measures",
          body: "Every Wednesday, the US Energy Information Administration publishes the change in crude oil stocks held onshore, excluding the strategic reserve. A build means more crude arrived than refineries consumed; a draw means the opposite. It is a direct measure of the supply and demand balance, week by week.",
        },
        {
          heading: "Why the price reacts instantly",
          body: "Oil is hard to store and expensive to hold. An unexpected surplus has to find a buyer straight away: the price falls until someone agrees to take it. Conversely, a bigger draw than expected signals strong demand and lifts the barrel within the minute.",
        },
        {
          heading: "The lines that explain the surprise",
          body: "The same report gives gasoline and distillate stocks, refinery utilisation and US production. A crude build caused by refineries down for maintenance says nothing about final demand: that is where a lasting reaction parts ways from a false signal.",
        },
        {
          heading: "Who else is affected",
          body: "The oil price spreads to producer currencies (Canadian dollar, Norwegian krone, rouble), to listed oil companies, to airlines through their costs, and to inflation through fuel prices. An inventory surprise can therefore show up, two months later, inside an inflation print.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Stocks build (more than expected)",
          body: "Ample supply or weak demand: the barrel falls, oil companies follow, the Canadian dollar eases. Good for transport firms and for inflation.",
        },
        {
          tone: "up",
          label: "Stocks draw (more than expected)",
          body: "Strong demand or constrained supply: the barrel rises, oil names and producer currencies benefit, the energy bill goes back up.",
        },
      ],
      watch: [
        "Every Wednesday, 10:30am New York time.",
        "The API publishes its own number the previous evening: it often sets the tone.",
        "Check gasoline, distillates and refinery utilisation too.",
        "A very fast reaction in crude: one of the most volatile slots of the week.",
      ],
    },
    de: {
      sections: [
        {
          heading: "Was der Bericht misst",
          body: "Jeden Mittwoch veröffentlicht die US-Energiebehörde die Veränderung der im Land gelagerten Rohölbestände, ohne die strategische Reserve. Ein Aufbau heißt, es kam mehr Rohöl an, als die Raffinerien verbraucht haben; ein Abbau das Gegenteil. Es ist ein direktes Maß für das Gleichgewicht von Angebot und Nachfrage, Woche für Woche.",
        },
        {
          heading: "Warum der Preis sofort reagiert",
          body: "Öl lässt sich schwer lagern und ist teuer zu halten. Ein unerwarteter Überschuss muss sofort einen Abnehmer finden: der Preis fällt, bis jemand zugreift. Umgekehrt signalisiert ein stärkerer Abbau als erwartet kräftige Nachfrage und hebt das Fass binnen einer Minute.",
        },
        {
          heading: "Die Zeilen, die die Überraschung erklären",
          body: "Derselbe Bericht liefert Benzin- und Destillatbestände, Raffinerieauslastung und US-Produktion. Ein Bestandsaufbau, weil Raffinerien in Wartung stehen, sagt nichts über die Endnachfrage: genau hier trennt sich eine dauerhafte Reaktion vom Fehlsignal.",
        },
        {
          heading: "Wer sonst betroffen ist",
          body: "Der Ölpreis strahlt auf die Währungen der Förderländer aus (kanadischer Dollar, norwegische Krone, Rubel), auf börsennotierte Ölkonzerne, über die Kosten auf Fluggesellschaften und über die Kraftstoffpreise auf die Inflation. Eine Bestandsüberraschung kann daher zwei Monate später in einer Inflationszahl auftauchen.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Bestände steigen (stärker als erwartet)",
          body: "Reichliches Angebot oder schwache Nachfrage: das Fass fällt, Ölkonzerne folgen, der kanadische Dollar gibt nach. Gut für Transportunternehmen und für die Inflation.",
        },
        {
          tone: "up",
          label: "Bestände fallen (stärker als erwartet)",
          body: "Kräftige Nachfrage oder knappes Angebot: das Fass steigt, Ölwerte und Förderwährungen profitieren, die Energierechnung zieht wieder an.",
        },
      ],
      watch: [
        "Jeden Mittwoch, 16:30 Uhr MEZ (10:30 Uhr in New York).",
        "Das API veröffentlicht am Vorabend seine eigene Zahl: sie gibt oft den Ton vor.",
        "Sieh dir auch Benzin, Destillate und die Raffinerieauslastung an.",
        "Sehr schnelle Reaktion im Rohöl: eines der volatilsten Zeitfenster der Woche.",
      ],
    },
    es: {
      sections: [
        {
          heading: "Qué mide el informe",
          body: "Cada miércoles, la agencia estadounidense de la energía publica la variación de las reservas de petróleo crudo en el país, sin contar la reserva estratégica. Un aumento significa que llegó más crudo del que consumieron las refinerías; una caída, lo contrario. Es una medida directa del equilibrio entre oferta y demanda, semana a semana.",
        },
        {
          heading: "Por qué el precio reacciona al instante",
          body: "El petróleo es difícil de almacenar y caro de mantener. Un excedente inesperado tiene que encontrar comprador de inmediato: el precio baja hasta que alguien acepta llevárselo. A la inversa, una caída de reservas mayor de lo previsto señala demanda vigorosa y sube el barril en un minuto.",
        },
        {
          heading: "Las líneas que explican la sorpresa",
          body: "El mismo informe da las reservas de gasolina y destilados, la utilización de refinerías y la producción estadounidense. Un aumento de crudo causado por refinerías paradas por mantenimiento no dice nada de la demanda final: ahí se separa una reacción duradera de una señal falsa.",
        },
        {
          heading: "A quién afecta más allá del petróleo",
          body: "El precio del barril se propaga a las divisas de los países productores (dólar canadiense, corona noruega, rublo), a las petroleras cotizadas, a las aerolíneas por sus costes y a la inflación por el precio de los carburantes. Una sorpresa en reservas puede aparecer, dos meses después, dentro de un dato de inflación.",
        },
      ],
      outcomes: [
        {
          tone: "down",
          label: "Reservas al alza (más de lo previsto)",
          body: "Oferta abundante o demanda floja: el barril baja, las petroleras le siguen y el dólar canadiense se relaja. Bueno para el transporte y para la inflación.",
        },
        {
          tone: "up",
          label: "Reservas a la baja (más de lo previsto)",
          body: "Demanda vigorosa u oferta limitada: el barril sube, las petroleras y las divisas productoras se benefician y la factura energética repunta.",
        },
      ],
      watch: [
        "Cada miércoles, 10:30 de Nueva York (16:30 en España).",
        "El API publica su propio dato la víspera por la tarde: suele marcar el tono.",
        "Mira también gasolina, destilados y utilización de refinerías.",
        "Reacción muy rápida en el crudo: una de las franjas más volátiles de la semana.",
      ],
    },
  },
};
