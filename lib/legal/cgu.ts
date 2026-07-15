import type { LegalContent } from "./types";
import { COMPANY } from "./company";

const content: LegalContent = {
  fr: {
    title: "Conditions générales d'utilisation",
    updated: "Dernière mise à jour : 27 juin 2026",
    intro:
      `Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et l'utilisation du service ${COMPANY.brand}. Les conditions de vente des abonnements payants figurent dans les Conditions générales de vente (CGV).`,
    sections: [
      {
        heading: "1. Objet et acceptation",
        blocks: [
          {
            kind: "p",
            text: `En accédant à ${COMPANY.brand} et en utilisant nos services, vous acceptez d'être lié par les présentes CGU. Si vous ne les acceptez pas, n'utilisez pas le service.`,
          },
        ],
      },
      {
        heading: "2. Description du service",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} est un journal de trading intelligent permettant d'importer ses trades, d'analyser ses performances et d'interagir avec un coach IA spécialisé. Le service est fourni « en l'état » et destiné à un usage personnel.`,
          },
        ],
      },
      {
        heading: "3. Avertissement : absence de conseil financier",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} est un outil d'analyse et de journalisation. Il ne constitue pas un conseil financier, en investissement ou en trading. Les analyses générées par l'IA sont fournies à titre purement informatif. Toute décision de trading relève de votre seule responsabilité. Le trading comporte un risque significatif de perte en capital.`,
          },
        ],
      },
      {
        heading: "4. Compte utilisateur",
        blocks: [
          {
            kind: "p",
            text: "Vous êtes responsable de la confidentialité de vos identifiants et de toutes les activités effectuées depuis votre compte. Vous vous engagez à nous signaler sans délai tout accès non autorisé.",
          },
        ],
      },
      {
        heading: "5. Utilisation acceptable",
        blocks: [
          {
            kind: "p",
            text: "Vous vous engagez à ne pas :",
          },
          {
            kind: "ul",
            items: [
              "détourner le service de sa finalité ou en perturber le fonctionnement ;",
              "tenter d'accéder à des données d'autres utilisateurs ou à nos systèmes sans autorisation ;",
              "automatiser un usage abusif des fonctionnalités IA dans le but de contourner les quotas.",
            ],
          },
        ],
      },
      {
        heading: "6. Propriété intellectuelle",
        blocks: [
          {
            kind: "p",
            text: `L'ensemble du contenu de ${COMPANY.brand} (code, design, textes, marque) est la propriété exclusive de l'éditeur. Vous ne pouvez ni le reproduire, ni le distribuer, ni en créer des œuvres dérivées sans autorisation écrite. Vous conservez la propriété des données de trading que vous saisissez ou importez.`,
          },
        ],
      },
      {
        heading: "7. Données personnelles",
        blocks: [
          {
            kind: "p",
            text: "La collecte et le traitement de vos données personnelles sont régis par notre {privacy}.",
            links: [{ token: "{privacy}", label: "Politique de confidentialité", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "8. Limitation de responsabilité",
        blocks: [
          {
            kind: "p",
            text: `Dans les limites permises par la loi, ${COMPANY.brand} ne saurait être tenu responsable des pertes de trading, des pertes de données ou de tout dommage indirect résultant de l'utilisation du service.`,
          },
        ],
      },
      {
        heading: "9. Résiliation",
        blocks: [
          {
            kind: "p",
            text: "Nous nous réservons le droit de suspendre ou de résilier votre accès au service à tout moment, notamment en cas de violation des présentes CGU. Les modalités de résiliation des abonnements payants sont précisées dans les {cgv}.",
            links: [{ token: "{cgv}", label: "Conditions générales de vente", href: "/legal/cgv" }],
          },
        ],
      },
      {
        heading: "10. Modifications",
        blocks: [
          {
            kind: "p",
            text: "Nous pouvons modifier les présentes CGU à tout moment. Les modifications prennent effet dès leur publication. La poursuite de l'utilisation du service vaut acceptation des nouvelles conditions.",
          },
        ],
      },
      {
        heading: "11. Droit applicable",
        blocks: [
          {
            kind: "p",
            text: "Les présentes CGU sont soumises au droit français. À défaut de résolution amiable, les tribunaux français sont compétents, sous réserve des règles protectrices applicables aux consommateurs.",
          },
        ],
      },
      {
        heading: "12. Contact",
        blocks: [
          {
            kind: "p",
            text: "Pour toute question relative aux présentes CGU : {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: June 27, 2026",
    intro: `These Terms of Service ("Terms") govern access to and use of the ${COMPANY.brand} service. The terms of sale of paid subscriptions are set out in the Terms of Sale.`,
    sections: [
      {
        heading: "1. Purpose and acceptance",
        blocks: [
          {
            kind: "p",
            text: `By accessing ${COMPANY.brand} and using our services, you agree to be bound by these Terms. If you do not accept them, please do not use the service.`,
          },
        ],
      },
      {
        heading: "2. Service description",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} is an intelligent trading journal that lets you import your trades, analyze your performance and interact with a specialized AI coach. The service is provided "as is" and intended for personal use.`,
          },
        ],
      },
      {
        heading: "3. Disclaimer: No financial advice",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} is an analysis and journaling tool. It does not constitute financial, investment or trading advice. AI-generated analyses are provided for informational purposes only. Any trading decision is your sole responsibility. Trading involves a significant risk of capital loss.`,
          },
        ],
      },
      {
        heading: "4. User account",
        blocks: [
          {
            kind: "p",
            text: "You are responsible for keeping your credentials confidential and for all activity carried out from your account. You agree to notify us without delay of any unauthorized access.",
          },
        ],
      },
      {
        heading: "5. Acceptable use",
        blocks: [
          { kind: "p", text: "You agree not to:" },
          {
            kind: "ul",
            items: [
              "misuse the service or disrupt its operation;",
              "attempt to access other users' data or our systems without authorization;",
              "automate abusive use of the AI features in order to circumvent quotas.",
            ],
          },
        ],
      },
      {
        heading: "6. Intellectual property",
        blocks: [
          {
            kind: "p",
            text: `All ${COMPANY.brand} content (code, design, text, brand) is the exclusive property of the publisher. You may not reproduce, distribute or create derivative works without written authorization. You retain ownership of the trading data you enter or import.`,
          },
        ],
      },
      {
        heading: "7. Personal data",
        blocks: [
          {
            kind: "p",
            text: "The collection and processing of your personal data is governed by our {privacy}.",
            links: [{ token: "{privacy}", label: "Privacy Policy", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "8. Limitation of liability",
        blocks: [
          {
            kind: "p",
            text: `To the extent permitted by law, ${COMPANY.brand} shall not be liable for trading losses, data loss or any indirect damage resulting from use of the service.`,
          },
        ],
      },
      {
        heading: "9. Termination",
        blocks: [
          {
            kind: "p",
            text: "We reserve the right to suspend or terminate your access to the service at any time, in particular in case of breach of these Terms. The cancellation terms for paid subscriptions are set out in the {cgv}.",
            links: [{ token: "{cgv}", label: "Terms of Sale", href: "/legal/cgv" }],
          },
        ],
      },
      {
        heading: "10. Changes",
        blocks: [
          {
            kind: "p",
            text: "We may amend these Terms at any time. Changes take effect upon publication. Continued use of the service constitutes acceptance of the new terms.",
          },
        ],
      },
      {
        heading: "11. Governing law",
        blocks: [
          {
            kind: "p",
            text: "These Terms are governed by French law. Failing an amicable resolution, the French courts have jurisdiction, subject to the protective rules applicable to consumers.",
          },
        ],
      },
      {
        heading: "12. Contact",
        blocks: [
          {
            kind: "p",
            text: "For any question regarding these Terms: {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
    footerNote: "This is a translation provided for convenience. The French version of this document prevails.",
  },
  es: {
    title: "Términos de uso",
    updated: "Última actualización: 27 de junio de 2026",
    intro: `Los presentes términos de uso ("Términos") rigen el acceso y el uso del servicio ${COMPANY.brand}. Las condiciones de venta de las suscripciones de pago figuran en las Condiciones generales de venta.`,
    sections: [
      {
        heading: "1. Objeto y aceptación",
        blocks: [
          {
            kind: "p",
            text: `Al acceder a ${COMPANY.brand} y utilizar nuestros servicios, usted acepta quedar vinculado por estos Términos. Si no los acepta, no utilice el servicio.`,
          },
        ],
      },
      {
        heading: "2. Descripción del servicio",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} es un diario de trading inteligente que permite importar tus operaciones, analizar tu rendimiento e interactuar con un coach de IA especializado. El servicio se presta "tal cual" y está destinado a un uso personal.`,
          },
        ],
      },
      {
        heading: "3. Advertencia: ausencia de asesoramiento financiero",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} es una herramienta de análisis y registro. No constituye asesoramiento financiero, de inversión ni de trading. Los análisis generados por la IA se facilitan únicamente a título informativo. Toda decisión de trading es de su exclusiva responsabilidad. El trading conlleva un riesgo significativo de pérdida de capital.`,
          },
        ],
      },
      {
        heading: "4. Cuenta de usuario",
        blocks: [
          {
            kind: "p",
            text: "Usted es responsable de la confidencialidad de sus credenciales y de toda la actividad realizada desde su cuenta. Se compromete a notificarnos sin demora cualquier acceso no autorizado.",
          },
        ],
      },
      {
        heading: "5. Uso aceptable",
        blocks: [
          { kind: "p", text: "Usted se compromete a no:" },
          {
            kind: "ul",
            items: [
              "desviar el servicio de su finalidad ni perturbar su funcionamiento;",
              "intentar acceder a datos de otros usuarios o a nuestros sistemas sin autorización;",
              "automatizar un uso abusivo de las funciones de IA para eludir las cuotas.",
            ],
          },
        ],
      },
      {
        heading: "6. Propiedad intelectual",
        blocks: [
          {
            kind: "p",
            text: `Todo el contenido de ${COMPANY.brand} (código, diseño, textos, marca) es propiedad exclusiva del editor. No puede reproducirlo, distribuirlo ni crear obras derivadas sin autorización escrita. Usted conserva la propiedad de los datos de trading que introduce o importa.`,
          },
        ],
      },
      {
        heading: "7. Datos personales",
        blocks: [
          {
            kind: "p",
            text: "La recogida y el tratamiento de sus datos personales se rigen por nuestra {privacy}.",
            links: [{ token: "{privacy}", label: "Política de privacidad", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "8. Limitación de responsabilidad",
        blocks: [
          {
            kind: "p",
            text: `En los límites permitidos por la ley, ${COMPANY.brand} no será responsable de las pérdidas de trading, la pérdida de datos ni de cualquier daño indirecto derivado del uso del servicio.`,
          },
        ],
      },
      {
        heading: "9. Resolución",
        blocks: [
          {
            kind: "p",
            text: "Nos reservamos el derecho de suspender o cancelar su acceso al servicio en cualquier momento, en particular en caso de incumplimiento de estos Términos. Las condiciones de cancelación de las suscripciones de pago figuran en las {cgv}.",
            links: [{ token: "{cgv}", label: "Condiciones generales de venta", href: "/legal/cgv" }],
          },
        ],
      },
      {
        heading: "10. Modificaciones",
        blocks: [
          {
            kind: "p",
            text: "Podemos modificar estos Términos en cualquier momento. Las modificaciones surten efecto desde su publicación. El uso continuado del servicio implica la aceptación de los nuevos términos.",
          },
        ],
      },
      {
        heading: "11. Ley aplicable",
        blocks: [
          {
            kind: "p",
            text: "Estos Términos se rigen por la ley francesa. A falta de resolución amistosa, los tribunales franceses serán competentes, sin perjuicio de las normas protectoras aplicables a los consumidores.",
          },
        ],
      },
      {
        heading: "12. Contacto",
        blocks: [
          {
            kind: "p",
            text: "Para cualquier consulta sobre estos Términos: {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Esta es una traducción facilitada por comodidad. Prevalece la versión francesa de este documento.",
  },
  de: {
    title: "Nutzungsbedingungen",
    updated: "Letzte Aktualisierung: 27. Juni 2026",
    intro: `Diese Nutzungsbedingungen ("Bedingungen") regeln den Zugang zum und die Nutzung des Dienstes ${COMPANY.brand}. Die Verkaufsbedingungen für kostenpflichtige Abonnements sind in den Allgemeinen Verkaufsbedingungen festgelegt.`,
    sections: [
      {
        heading: "1. Zweck und Annahme",
        blocks: [
          {
            kind: "p",
            text: `Durch den Zugriff auf ${COMPANY.brand} und die Nutzung unserer Dienste erklären Sie sich mit diesen Bedingungen einverstanden. Wenn Sie sie nicht akzeptieren, nutzen Sie den Dienst bitte nicht.`,
          },
        ],
      },
      {
        heading: "2. Leistungsbeschreibung",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} ist ein intelligentes Trading-Tagebuch, mit dem Sie Ihre Trades importieren, Ihre Performance analysieren und mit einem spezialisierten KI-Coach interagieren können. Der Dienst wird "wie besehen" bereitgestellt und ist für den persönlichen Gebrauch bestimmt.`,
          },
        ],
      },
      {
        heading: "3. Hinweis: Keine Finanzberatung",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} ist ein Analyse- und Tagebuchwerkzeug. Es stellt keine Finanz-, Anlage- oder Trading-Beratung dar. KI-generierte Analysen dienen ausschließlich Informationszwecken. Jede Trading-Entscheidung liegt in Ihrer alleinigen Verantwortung. Trading ist mit einem erheblichen Risiko des Kapitalverlusts verbunden.`,
          },
        ],
      },
      {
        heading: "4. Benutzerkonto",
        blocks: [
          {
            kind: "p",
            text: "Sie sind für die Vertraulichkeit Ihrer Zugangsdaten und für alle über Ihr Konto durchgeführten Aktivitäten verantwortlich. Sie verpflichten sich, uns unverzüglich über jeden unbefugten Zugriff zu informieren.",
          },
        ],
      },
      {
        heading: "5. Zulässige Nutzung",
        blocks: [
          { kind: "p", text: "Sie verpflichten sich, Folgendes zu unterlassen:" },
          {
            kind: "ul",
            items: [
              "den Dienst zweckentfremden oder seinen Betrieb stören;",
              "ohne Berechtigung versuchen, auf Daten anderer Nutzer oder auf unsere Systeme zuzugreifen;",
              "eine missbräuchliche Nutzung der KI-Funktionen automatisieren, um Kontingente zu umgehen.",
            ],
          },
        ],
      },
      {
        heading: "6. Geistiges Eigentum",
        blocks: [
          {
            kind: "p",
            text: `Sämtliche Inhalte von ${COMPANY.brand} (Code, Design, Texte, Marke) sind ausschließliches Eigentum des Anbieters. Sie dürfen sie ohne schriftliche Genehmigung weder vervielfältigen noch verbreiten oder abgeleitete Werke erstellen. Sie behalten das Eigentum an den von Ihnen eingegebenen oder importierten Trading-Daten.`,
          },
        ],
      },
      {
        heading: "7. Personenbezogene Daten",
        blocks: [
          {
            kind: "p",
            text: "Die Erhebung und Verarbeitung Ihrer personenbezogenen Daten richtet sich nach unserer {privacy}.",
            links: [{ token: "{privacy}", label: "Datenschutzerklärung", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "8. Haftungsbeschränkung",
        blocks: [
          {
            kind: "p",
            text: `Soweit gesetzlich zulässig, haftet ${COMPANY.brand} nicht für Trading-Verluste, Datenverluste oder sonstige indirekte Schäden, die aus der Nutzung des Dienstes entstehen.`,
          },
        ],
      },
      {
        heading: "9. Kündigung",
        blocks: [
          {
            kind: "p",
            text: "Wir behalten uns das Recht vor, Ihren Zugang zum Dienst jederzeit zu sperren oder zu beenden, insbesondere bei Verstoß gegen diese Bedingungen. Die Kündigungsmodalitäten für kostenpflichtige Abonnements sind in den {cgv} festgelegt.",
            links: [{ token: "{cgv}", label: "Allgemeine Verkaufsbedingungen", href: "/legal/cgv" }],
          },
        ],
      },
      {
        heading: "10. Änderungen",
        blocks: [
          {
            kind: "p",
            text: "Wir können diese Bedingungen jederzeit ändern. Änderungen treten mit ihrer Veröffentlichung in Kraft. Die fortgesetzte Nutzung des Dienstes gilt als Annahme der neuen Bedingungen.",
          },
        ],
      },
      {
        heading: "11. Anwendbares Recht",
        blocks: [
          {
            kind: "p",
            text: "Diese Bedingungen unterliegen französischem Recht. Kommt keine gütliche Einigung zustande, sind die französischen Gerichte zuständig, vorbehaltlich der für Verbraucher geltenden Schutzvorschriften.",
          },
        ],
      },
      {
        heading: "12. Kontakt",
        blocks: [
          {
            kind: "p",
            text: "Bei Fragen zu diesen Bedingungen: {support}.",
            links: [{ token: "{support}", label: COMPANY.supportEmail, href: `mailto:${COMPANY.supportEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Dies ist eine Übersetzung zur Vereinfachung. Es gilt die französische Fassung dieses Dokuments.",
  },
};

export default content;
