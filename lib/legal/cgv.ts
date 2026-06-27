import type { LegalContent } from "./types";
import { COMPANY } from "./company";

const content: LegalContent = {
  fr: {
    title: "Conditions générales de vente",
    updated: "Dernière mise à jour : 27 juin 2026",
    intro:
      `Les présentes conditions générales de vente (« CGV ») régissent la vente des abonnements payants au service ${COMPANY.brand}. Elles s'appliquent à tout consommateur souscrivant un abonnement et complètent les Conditions générales d'utilisation.`,
    sections: [
      {
        heading: "1. Vendeur",
        blocks: [
          {
            kind: "p",
            text: `Le service est vendu par ${COMPANY.legalName}, ${COMPANY.status}, SIRET ${COMPANY.siret}, ${COMPANY.address}. Contact : ${COMPANY.supportEmail}. TVA non applicable, art. 293 B du CGI.`,
          },
        ],
      },
      {
        heading: "2. Offres et prix",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} propose des abonnements (notamment Plus et Premium), facturés mensuellement ou annuellement. Les prix applicables, en euros et toutes taxes comprises (TVA non applicable), sont ceux affichés sur la page d'abonnement au moment de la commande. L'éditeur peut modifier ses prix à tout moment ; le prix applicable à un abonnement en cours reste celui en vigueur lors de la souscription, sauf information préalable en cas de reconduction.`,
          },
        ],
      },
      {
        heading: "3. Commande et conclusion du contrat",
        blocks: [
          {
            kind: "p",
            text: "La commande est passée en ligne via le parcours de paiement. Le contrat est conclu lorsque le paiement est confirmé. Un email de confirmation et une facture vous sont alors adressés.",
          },
        ],
      },
      {
        heading: "4. Paiement",
        blocks: [
          {
            kind: "p",
            text: "Le paiement s'effectue par carte bancaire via notre prestataire de paiement sécurisé Stripe. Nous ne stockons aucune donnée bancaire. L'abonnement donne lieu à un paiement récurrent (mensuel ou annuel) prélevé automatiquement à chaque échéance jusqu'à résiliation.",
          },
        ],
      },
      {
        heading: "5. Durée, reconduction et résiliation",
        blocks: [
          {
            kind: "p",
            text: "L'abonnement est souscrit pour la période choisie (mensuelle ou annuelle) et se renouvelle par tacite reconduction pour une durée identique, sauf résiliation. Vous pouvez résilier à tout moment depuis votre espace client (portail de gestion de l'abonnement).",
          },
          {
            kind: "p",
            text: "La résiliation prend effet à la fin de la période en cours déjà payée : vous conservez l'accès aux fonctionnalités jusqu'à cette date, puis votre compte repasse en formule gratuite. Aucun remboursement, total ou partiel, n'est effectué pour la période entamée.",
          },
          {
            kind: "p",
            text: "Conformément à l'article L. 215-1 du Code de la consommation, pour les abonnements annuels reconduits tacitement, vous êtes informé de la date limite de résiliation et pouvez résilier la reconduction dans les conditions prévues par la loi.",
          },
        ],
      },
      {
        heading: "6. Droit de rétractation",
        blocks: [
          {
            kind: "p",
            text: "En tant que consommateur, vous disposez en principe d'un délai de quatorze (14) jours pour exercer votre droit de rétractation à compter de la conclusion du contrat, sans avoir à motiver votre décision (art. L. 221-18 du Code de la consommation).",
          },
          {
            kind: "p",
            text: "Toutefois, le service étant un contenu / service numérique fourni immédiatement, vous reconnaissez et acceptez expressément, lors de la souscription, que l'exécution du service commence dès le paiement et, en conséquence, que vous renoncez à votre droit de rétractation une fois le service pleinement exécuté (art. L. 221-28, 13° du Code de la consommation). Tant que le service n'a pas commencé, le droit de rétractation reste exerçable en nous contactant à {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
      {
        heading: "7. Disponibilité du service",
        blocks: [
          {
            kind: "p",
            text: "Nous mettons en œuvre nos meilleurs efforts pour assurer la disponibilité du service. Des interruptions peuvent survenir pour maintenance ou pour des raisons indépendantes de notre volonté. Le service est fourni « en l'état », sans garantie de résultat de trading.",
          },
        ],
      },
      {
        heading: "8. Responsabilité — Absence de conseil financier",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} est un outil d'analyse et de journal de trading et ne constitue pas un conseil financier ou en investissement. Toute décision de trading relève de votre seule responsabilité. Le trading comporte un risque significatif de perte en capital. Dans les limites permises par la loi, notre responsabilité ne saurait être engagée pour les pertes de trading ou dommages indirects.`,
          },
        ],
      },
      {
        heading: "9. Données personnelles",
        blocks: [
          {
            kind: "p",
            text: "Le traitement de vos données dans le cadre de la vente est régi par notre {privacy}.",
            links: [{ token: "{privacy}", label: "Politique de confidentialité", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "10. Litiges et droit applicable",
        blocks: [
          {
            kind: "p",
            text: "Les présentes CGV sont soumises au droit français. En cas de litige, vous êtes invité à nous contacter en priorité pour rechercher une solution amiable. À défaut d'accord, le litige peut être porté devant les tribunaux compétents, sous réserve des règles protectrices du consommateur.",
          },
          {
            kind: "p",
            text: "La Commission européenne met à disposition une plateforme de règlement en ligne des litiges accessible à l'adresse : {odr}.",
            links: [{ token: "{odr}", label: "ec.europa.eu/consumers/odr", href: "https://ec.europa.eu/consumers/odr" }],
          },
        ],
      },
      {
        heading: "11. Contact",
        blocks: [
          {
            kind: "p",
            text: "Pour toute question relative à votre commande ou à votre abonnement : {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
  },
  en: {
    title: "Terms of Sale",
    updated: "Last updated: June 27, 2026",
    intro: `These Terms of Sale ("Terms") govern the sale of paid subscriptions to the ${COMPANY.brand} service. They apply to any consumer subscribing to a plan and supplement the Terms of Service.`,
    sections: [
      {
        heading: "1. Seller",
        blocks: [
          {
            kind: "p",
            text: `The service is sold by ${COMPANY.legalName}, French sole trader (entreprise individuelle), SIRET ${COMPANY.siret}, ${COMPANY.address}. Contact: ${COMPANY.supportEmail}. VAT not applicable, art. 293 B of the French CGI.`,
          },
        ],
      },
      {
        heading: "2. Plans and prices",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} offers subscriptions (notably Plus and Premium), billed monthly or annually. The applicable prices, in euros and inclusive of all taxes (VAT not applicable), are those shown on the subscription page at the time of order. The publisher may change its prices at any time; the price applicable to an ongoing subscription remains the one in force at the time of subscription, except upon renewal with prior notice.`,
          },
        ],
      },
      {
        heading: "3. Order and formation of the contract",
        blocks: [
          {
            kind: "p",
            text: "The order is placed online via the checkout flow. The contract is formed once payment is confirmed. A confirmation email and an invoice are then sent to you.",
          },
        ],
      },
      {
        heading: "4. Payment",
        blocks: [
          {
            kind: "p",
            text: "Payment is made by card through our secure payment provider Stripe. We do not store any banking data. The subscription gives rise to a recurring payment (monthly or annual) charged automatically at each due date until cancellation.",
          },
        ],
      },
      {
        heading: "5. Duration, renewal and cancellation",
        blocks: [
          {
            kind: "p",
            text: "The subscription is taken out for the chosen period (monthly or annual) and renews automatically for an identical term unless cancelled. You can cancel at any time from your customer area (subscription management portal).",
          },
          {
            kind: "p",
            text: "Cancellation takes effect at the end of the current paid period: you keep access to the features until that date, after which your account reverts to the free plan. No refund, full or partial, is issued for the period already started.",
          },
          {
            kind: "p",
            text: "For annually renewed subscriptions, you are informed of the cancellation deadline and may cancel the renewal under the conditions provided by law (art. L. 215-1 of the French Consumer Code).",
          },
        ],
      },
      {
        heading: "6. Right of withdrawal",
        blocks: [
          {
            kind: "p",
            text: "As a consumer, you have in principle a period of fourteen (14) days to exercise your right of withdrawal from the conclusion of the contract, without having to give reasons (art. L. 221-18 of the French Consumer Code).",
          },
          {
            kind: "p",
            text: "However, as the service is digital content/service provided immediately, you expressly acknowledge and agree, upon subscription, that performance begins as soon as payment is made and that you accordingly waive your right of withdrawal once the service is fully performed (art. L. 221-28, 13° of the French Consumer Code). As long as the service has not started, the right of withdrawal can still be exercised by contacting us at {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
      {
        heading: "7. Service availability",
        blocks: [
          {
            kind: "p",
            text: 'We make our best efforts to ensure the availability of the service. Interruptions may occur for maintenance or for reasons beyond our control. The service is provided "as is", without any guarantee of trading results.',
          },
        ],
      },
      {
        heading: "8. Liability — No financial advice",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} is a trading journal and analysis tool and does not constitute financial or investment advice. Any trading decision is your sole responsibility. Trading involves a significant risk of capital loss. To the extent permitted by law, we cannot be held liable for trading losses or indirect damages.`,
          },
        ],
      },
      {
        heading: "9. Personal data",
        blocks: [
          {
            kind: "p",
            text: "The processing of your data in connection with the sale is governed by our {privacy}.",
            links: [{ token: "{privacy}", label: "Privacy Policy", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "10. Disputes and governing law",
        blocks: [
          {
            kind: "p",
            text: "These Terms are governed by French law. In the event of a dispute, you are invited to contact us first to seek an amicable solution. Failing agreement, the dispute may be brought before the competent courts, subject to the protective rules for consumers.",
          },
          {
            kind: "p",
            text: "The European Commission provides an online dispute resolution platform available at: {odr}.",
            links: [{ token: "{odr}", label: "ec.europa.eu/consumers/odr", href: "https://ec.europa.eu/consumers/odr" }],
          },
        ],
      },
      {
        heading: "11. Contact",
        blocks: [
          {
            kind: "p",
            text: "For any question regarding your order or subscription: {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
    footerNote: "This is a translation provided for convenience. The French version of this document prevails.",
  },
  es: {
    title: "Condiciones generales de venta",
    updated: "Última actualización: 27 de junio de 2026",
    intro: `Las presentes condiciones generales de venta ("Condiciones") rigen la venta de las suscripciones de pago al servicio ${COMPANY.brand}. Se aplican a todo consumidor que contrate una suscripción y complementan los Términos de uso.`,
    sections: [
      {
        heading: "1. Vendedor",
        blocks: [
          {
            kind: "p",
            text: `El servicio lo vende ${COMPANY.legalName}, empresario individual francés (entreprise individuelle), SIRET ${COMPANY.siret}, ${COMPANY.address}. Contacto: ${COMPANY.supportEmail}. IVA no aplicable, art. 293 B del CGI francés.`,
          },
        ],
      },
      {
        heading: "2. Ofertas y precios",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} ofrece suscripciones (en particular Plus y Premium), facturadas mensual o anualmente. Los precios aplicables, en euros e impuestos incluidos (IVA no aplicable), son los mostrados en la página de suscripción en el momento del pedido. El editor puede modificar sus precios en cualquier momento; el precio aplicable a una suscripción en curso sigue siendo el vigente en el momento de la contratación, salvo información previa en caso de renovación.`,
          },
        ],
      },
      {
        heading: "3. Pedido y formación del contrato",
        blocks: [
          {
            kind: "p",
            text: "El pedido se realiza en línea mediante el proceso de pago. El contrato se perfecciona cuando se confirma el pago. Se le envía entonces un correo de confirmación y una factura.",
          },
        ],
      },
      {
        heading: "4. Pago",
        blocks: [
          {
            kind: "p",
            text: "El pago se efectúa con tarjeta a través de nuestro proveedor de pagos seguro Stripe. No almacenamos ningún dato bancario. La suscripción da lugar a un pago recurrente (mensual o anual) cargado automáticamente en cada vencimiento hasta su cancelación.",
          },
        ],
      },
      {
        heading: "5. Duración, renovación y cancelación",
        blocks: [
          {
            kind: "p",
            text: "La suscripción se contrata por el periodo elegido (mensual o anual) y se renueva automáticamente por una duración idéntica, salvo cancelación. Puede cancelar en cualquier momento desde su área de cliente (portal de gestión de la suscripción).",
          },
          {
            kind: "p",
            text: "La cancelación surte efecto al final del periodo en curso ya pagado: conserva el acceso a las funciones hasta esa fecha y después su cuenta vuelve al plan gratuito. No se realiza ningún reembolso, total o parcial, por el periodo iniciado.",
          },
          {
            kind: "p",
            text: "Para las suscripciones anuales renovadas automáticamente, se le informa de la fecha límite de cancelación y puede cancelar la renovación en las condiciones previstas por la ley (art. L. 215-1 del Código de consumo francés).",
          },
        ],
      },
      {
        heading: "6. Derecho de desistimiento",
        blocks: [
          {
            kind: "p",
            text: "Como consumidor, dispone en principio de un plazo de catorce (14) días para ejercer su derecho de desistimiento desde la celebración del contrato, sin necesidad de justificación (art. L. 221-18 del Código de consumo francés).",
          },
          {
            kind: "p",
            text: "No obstante, al tratarse de un contenido/servicio digital de acceso inmediato, usted reconoce y acepta expresamente, al contratar, que la ejecución del servicio comienza desde el pago y que, en consecuencia, renuncia a su derecho de desistimiento una vez prestado plenamente el servicio (art. L. 221-28, 13° del Código de consumo francés). Mientras el servicio no haya comenzado, el derecho de desistimiento puede ejercerse contactándonos en {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
      {
        heading: "7. Disponibilidad del servicio",
        blocks: [
          {
            kind: "p",
            text: 'Hacemos nuestros mejores esfuerzos para garantizar la disponibilidad del servicio. Pueden producirse interrupciones por mantenimiento o por causas ajenas a nuestra voluntad. El servicio se presta "tal cual", sin garantía de resultados de trading.',
          },
        ],
      },
      {
        heading: "8. Responsabilidad — Ausencia de asesoramiento financiero",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} es una herramienta de análisis y diario de trading y no constituye asesoramiento financiero ni de inversión. Toda decisión de trading es de su exclusiva responsabilidad. El trading conlleva un riesgo significativo de pérdida de capital. En los límites permitidos por la ley, no podremos ser considerados responsables de las pérdidas de trading ni de los daños indirectos.`,
          },
        ],
      },
      {
        heading: "9. Datos personales",
        blocks: [
          {
            kind: "p",
            text: "El tratamiento de sus datos en el marco de la venta se rige por nuestra {privacy}.",
            links: [{ token: "{privacy}", label: "Política de privacidad", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "10. Litigios y ley aplicable",
        blocks: [
          {
            kind: "p",
            text: "Las presentes Condiciones se rigen por la ley francesa. En caso de litigio, le invitamos a contactarnos en primer lugar para buscar una solución amistosa. A falta de acuerdo, el litigio podrá someterse a los tribunales competentes, sin perjuicio de las normas protectoras del consumidor.",
          },
          {
            kind: "p",
            text: "La Comisión Europea pone a disposición una plataforma de resolución de litigios en línea accesible en: {odr}.",
            links: [{ token: "{odr}", label: "ec.europa.eu/consumers/odr", href: "https://ec.europa.eu/consumers/odr" }],
          },
        ],
      },
      {
        heading: "11. Contacto",
        blocks: [
          {
            kind: "p",
            text: "Para cualquier consulta sobre su pedido o suscripción: {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Esta es una traducción facilitada por comodidad. Prevalece la versión francesa de este documento.",
  },
  de: {
    title: "Allgemeine Verkaufsbedingungen",
    updated: "Letzte Aktualisierung: 27. Juni 2026",
    intro: `Diese Allgemeinen Verkaufsbedingungen ("Bedingungen") regeln den Verkauf kostenpflichtiger Abonnements des Dienstes ${COMPANY.brand}. Sie gelten für jeden Verbraucher, der ein Abonnement abschließt, und ergänzen die Nutzungsbedingungen.`,
    sections: [
      {
        heading: "1. Verkäufer",
        blocks: [
          {
            kind: "p",
            text: `Der Dienst wird verkauft von ${COMPANY.legalName}, französischer Einzelunternehmer (entreprise individuelle), SIRET ${COMPANY.siret}, ${COMPANY.address}. Kontakt: ${COMPANY.supportEmail}. Umsatzsteuer nicht anwendbar, Art. 293 B des französischen CGI.`,
          },
        ],
      },
      {
        heading: "2. Angebote und Preise",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} bietet Abonnements an (insbesondere Plus und Premium), die monatlich oder jährlich abgerechnet werden. Die geltenden Preise in Euro und inklusive aller Steuern (Umsatzsteuer nicht anwendbar) sind die zum Zeitpunkt der Bestellung auf der Abonnementseite angezeigten Preise. Der Anbieter kann seine Preise jederzeit ändern; der für ein laufendes Abonnement geltende Preis bleibt der zum Zeitpunkt des Abschlusses gültige Preis, vorbehaltlich vorheriger Information bei einer Verlängerung.`,
          },
        ],
      },
      {
        heading: "3. Bestellung und Vertragsschluss",
        blocks: [
          {
            kind: "p",
            text: "Die Bestellung erfolgt online über den Bezahlvorgang. Der Vertrag kommt zustande, sobald die Zahlung bestätigt ist. Anschließend werden Ihnen eine Bestätigungs-E-Mail und eine Rechnung zugesandt.",
          },
        ],
      },
      {
        heading: "4. Zahlung",
        blocks: [
          {
            kind: "p",
            text: "Die Zahlung erfolgt per Karte über unseren sicheren Zahlungsdienstleister Stripe. Wir speichern keine Bankdaten. Das Abonnement führt zu einer wiederkehrenden Zahlung (monatlich oder jährlich), die zu jedem Fälligkeitstermin bis zur Kündigung automatisch eingezogen wird.",
          },
        ],
      },
      {
        heading: "5. Laufzeit, Verlängerung und Kündigung",
        blocks: [
          {
            kind: "p",
            text: "Das Abonnement wird für den gewählten Zeitraum (monatlich oder jährlich) abgeschlossen und verlängert sich automatisch um einen identischen Zeitraum, sofern es nicht gekündigt wird. Sie können jederzeit über Ihren Kundenbereich (Verwaltungsportal des Abonnements) kündigen.",
          },
          {
            kind: "p",
            text: "Die Kündigung wird zum Ende des laufenden, bereits bezahlten Zeitraums wirksam: Sie behalten den Zugang zu den Funktionen bis zu diesem Datum, danach wird Ihr Konto auf den kostenlosen Tarif zurückgestuft. Für den begonnenen Zeitraum erfolgt keine Erstattung, weder ganz noch teilweise.",
          },
          {
            kind: "p",
            text: "Bei jährlich automatisch verlängerten Abonnements werden Sie über die Kündigungsfrist informiert und können die Verlängerung unter den gesetzlich vorgesehenen Bedingungen kündigen (Art. L. 215-1 des französischen Verbrauchergesetzbuchs).",
          },
        ],
      },
      {
        heading: "6. Widerrufsrecht",
        blocks: [
          {
            kind: "p",
            text: "Als Verbraucher haben Sie grundsätzlich eine Frist von vierzehn (14) Tagen ab Vertragsschluss, um Ihr Widerrufsrecht ohne Angabe von Gründen auszuüben (Art. L. 221-18 des französischen Verbrauchergesetzbuchs).",
          },
          {
            kind: "p",
            text: "Da es sich jedoch um sofort bereitgestellte digitale Inhalte/Dienste handelt, erkennen Sie bei Abschluss ausdrücklich an und stimmen zu, dass die Ausführung des Dienstes ab der Zahlung beginnt und dass Sie folglich auf Ihr Widerrufsrecht verzichten, sobald der Dienst vollständig erbracht ist (Art. L. 221-28, 13° des französischen Verbrauchergesetzbuchs). Solange der Dienst nicht begonnen hat, kann das Widerrufsrecht durch Kontaktaufnahme unter {support} ausgeübt werden.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
      {
        heading: "7. Verfügbarkeit des Dienstes",
        blocks: [
          {
            kind: "p",
            text: 'Wir bemühen uns nach besten Kräften um die Verfügbarkeit des Dienstes. Unterbrechungen können aufgrund von Wartungsarbeiten oder aus von uns nicht zu vertretenden Gründen auftreten. Der Dienst wird "wie besehen" bereitgestellt, ohne Gewähr für Trading-Ergebnisse.',
          },
        ],
      },
      {
        heading: "8. Haftung — Keine Finanzberatung",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} ist ein Trading-Tagebuch und Analysewerkzeug und stellt keine Finanz- oder Anlageberatung dar. Jede Trading-Entscheidung liegt in Ihrer alleinigen Verantwortung. Trading ist mit einem erheblichen Risiko des Kapitalverlusts verbunden. Soweit gesetzlich zulässig, können wir nicht für Trading-Verluste oder indirekte Schäden haftbar gemacht werden.`,
          },
        ],
      },
      {
        heading: "9. Personenbezogene Daten",
        blocks: [
          {
            kind: "p",
            text: "Die Verarbeitung Ihrer Daten im Rahmen des Verkaufs richtet sich nach unserer {privacy}.",
            links: [{ token: "{privacy}", label: "Datenschutzerklärung", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "10. Streitigkeiten und anwendbares Recht",
        blocks: [
          {
            kind: "p",
            text: "Diese Bedingungen unterliegen französischem Recht. Im Streitfall werden Sie gebeten, uns zunächst zu kontaktieren, um eine gütliche Lösung zu suchen. Kommt keine Einigung zustande, kann der Streit vor die zuständigen Gerichte gebracht werden, vorbehaltlich der Verbraucherschutzvorschriften.",
          },
          {
            kind: "p",
            text: "Die Europäische Kommission stellt eine Online-Plattform zur Streitbeilegung bereit, die unter folgender Adresse erreichbar ist: {odr}.",
            links: [{ token: "{odr}", label: "ec.europa.eu/consumers/odr", href: "https://ec.europa.eu/consumers/odr" }],
          },
        ],
      },
      {
        heading: "11. Kontakt",
        blocks: [
          {
            kind: "p",
            text: "Bei Fragen zu Ihrer Bestellung oder Ihrem Abonnement: {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Dies ist eine Übersetzung zur Vereinfachung. Es gilt die französische Fassung dieses Dokuments.",
  },
};

export default content;
