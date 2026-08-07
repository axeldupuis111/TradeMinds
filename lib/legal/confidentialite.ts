import type { LegalContent } from "./types";
import { COMPANY } from "./company";

const content: LegalContent = {
  fr: {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : 7 août 2026",
    sections: [
      {
        heading: "1. Responsable du traitement",
        blocks: [
          {
            kind: "p",
            text: `Le responsable du traitement de vos données personnelles est ${COMPANY.legalName}, ${COMPANY.status}, SIRET ${COMPANY.siret}, ${COMPANY.address}. Pour toute question relative à vos données : {privacy}.`,
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "2. Données collectées",
        blocks: [
          {
            kind: "ul",
            items: [
              "Données de compte : adresse email, mot de passe (haché), pseudonyme facultatif ;",
              "Données de trading : historique des trades, P&L, émotions, qualité des setups, saisis ou importés par vous ;",
              "Données d'usage : pages visitées, fonctionnalités utilisées (anonymisées) ;",
              "Données de paiement : traitées par Stripe ; nous ne stockons aucune donnée bancaire.",
              "Données vocales : uniquement si vous activez la dictée, votre voix est transcrite en texte par votre navigateur (voir la section 7) ; aucun enregistrement sonore n'est conservé.",
            ],
          },
        ],
      },
      {
        heading: "3. Finalités du traitement",
        blocks: [
          {
            kind: "ul",
            items: [
              "Fournir et améliorer le service ;",
              "Générer des analyses IA personnalisées à partir de vos données de trading ;",
              "Gérer votre abonnement et vos paiements ;",
              "Vous adresser des communications liées au service (aucun marketing sans consentement).",
            ],
          },
        ],
      },
      {
        heading: "4. Base légale",
        blocks: [
          {
            kind: "p",
            text: "Les traitements reposent sur l'exécution du contrat (fourniture du service), le respect d'obligations légales (facturation, comptabilité) et, le cas échéant, votre consentement explicite.",
          },
        ],
      },
      {
        heading: "5. Sous-traitants et destinataires",
        blocks: [
          {
            kind: "ul",
            items: [
              "Supabase : hébergement de la base de données (UE) ;",
              "Anthropic (Claude) : génération des analyses IA (vos données de trading sont transmises pour analyse) ;",
              "Stripe : traitement des paiements ;",
              "Vercel : hébergement de l'application ;",
              "Resend : envoi des emails transactionnels.",
              "Google : transcription de la dictée vocale, uniquement si vous activez cette fonction et selon le navigateur utilisé (voir la section 7).",
            ],
          },
        ],
      },
      {
        heading: "6. Transferts hors Union européenne",
        blocks: [
          {
            kind: "p",
            text: "Certains de nos sous-traitants (notamment Anthropic, Stripe, Vercel et, si vous utilisez la dictée vocale, Google) sont établis aux États-Unis. Les transferts de données vers ces prestataires sont encadrés par des garanties appropriées au sens du RGPD, notamment les clauses contractuelles types de la Commission européenne. En utilisant les fonctionnalités d'IA, vous êtes informé que les données de trading concernées sont transmises à Anthropic pour traitement.",
          },
        ],
      },
      {
        heading: "7. Dictée vocale (fonction optionnelle)",
        blocks: [
          {
            kind: "p",
            text: "Le coach IA propose une dictée vocale, que vous activez vous-même en appuyant sur le bouton micro. Elle n'est jamais active par défaut : aucun son n'est capté tant que vous ne l'avez pas déclenchée, et la captation s'arrête dès que vous fermez le coach.",
          },
          {
            kind: "p",
            text: "Cette fonction repose sur la reconnaissance vocale intégrée à votre navigateur. Sur Google Chrome et Microsoft Edge, votre voix est transmise aux serveurs de Google pour y être transcrite en texte. Ce traitement est réalisé par Google, selon ses propres conditions, et échappe à notre contrôle. Nous ne recevons que le texte transcrit, jamais l'audio, et nous ne conservons aucun enregistrement sonore.",
          },
          {
            kind: "p",
            text: "Si vous ne souhaitez pas que votre voix transite par un tiers, n'utilisez pas le bouton micro : toutes les fonctions du coach restent accessibles au clavier.",
          },
          {
            kind: "p",
            text: "La lecture à voix haute des réponses est en revanche entièrement réalisée par votre appareil. Aucune donnée n'est transmise à un tiers pour cette fonction.",
          },
        ],
      },
      {
        heading: "8. Durée de conservation",
        blocks: [
          {
            kind: "p",
            text: "Vos données de compte et de trading sont conservées tant que votre compte est actif. En cas de suppression de votre compte, elles sont effacées sous 30 jours. Les factures et pièces comptables sont conservées 10 ans, conformément aux obligations légales.",
          },
        ],
      },
      {
        heading: "9. Vos droits (RGPD)",
        blocks: [
          {
            kind: "p",
            text: "Vous disposez des droits suivants :",
          },
          {
            kind: "ul",
            items: [
              "Droit d'accès à vos données ;",
              "Droit de rectification ;",
              "Droit à l'effacement (« droit à l'oubli ») ;",
              "Droit à la portabilité de vos données ;",
              "Droit d'opposition et de limitation.",
            ],
          },
          {
            kind: "p",
            text: "Pour exercer ces droits, contactez-nous à {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "10. Cookies",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} n'utilise que des cookies strictement nécessaires au fonctionnement du service (session d'authentification). Aucun cookie publicitaire ou de pistage tiers n'est utilisé ; aucun consentement préalable n'est donc requis pour ces cookies essentiels.`,
          },
        ],
      },
      {
        heading: "11. Sécurité",
        blocks: [
          {
            kind: "p",
            text: "Nous mettons en œuvre des mesures de sécurité appropriées (chiffrement, accès restreints) pour protéger vos données. Les identifiants de connexion à vos brokers sont chiffrés. Aucun système n'étant toutefois infaillible, nous ne pouvons garantir une sécurité absolue.",
          },
        ],
      },
      {
        heading: "12. Réclamations",
        blocks: [
          {
            kind: "p",
            text: "Vous pouvez introduire une réclamation auprès de la Commission Nationale de l'Informatique et des Libertés (CNIL), {cnil}, ou de l'autorité de protection des données de votre pays de résidence.",
            links: [{ token: "{cnil}", label: "www.cnil.fr", href: "https://www.cnil.fr" }],
          },
          {
            kind: "p",
            text: "Contact : {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: August 7, 2026",
    sections: [
      {
        heading: "1. Data controller",
        blocks: [
          {
            kind: "p",
            text: `The controller of your personal data is ${COMPANY.legalName}, French sole trader (entreprise individuelle), SIRET ${COMPANY.siret}, ${COMPANY.address}. For any question about your data: {privacy}.`,
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "2. Data collected",
        blocks: [
          {
            kind: "ul",
            items: [
              "Account data: email address, hashed password, optional username;",
              "Trading data: trade history, P&L, emotions, setup quality, entered or imported by you;",
              "Usage data: pages visited, features used (anonymized);",
              "Payment data: processed by Stripe; we do not store any banking data.",
              "Voice data: only if you enable dictation, your voice is transcribed into text by your browser (see section 7); no sound recording is kept.",
            ],
          },
        ],
      },
      {
        heading: "3. Purposes of processing",
        blocks: [
          {
            kind: "ul",
            items: [
              "Provide and improve the service;",
              "Generate personalized AI analyses from your trading data;",
              "Manage your subscription and payments;",
              "Send you service-related communications (no marketing without consent).",
            ],
          },
        ],
      },
      {
        heading: "4. Legal basis",
        blocks: [
          {
            kind: "p",
            text: "Processing is based on the performance of the contract (provision of the service), compliance with legal obligations (invoicing, accounting) and, where applicable, your explicit consent.",
          },
        ],
      },
      {
        heading: "5. Sub-processors and recipients",
        blocks: [
          {
            kind: "ul",
            items: [
              "Supabase: database hosting (EU);",
              "Anthropic (Claude): AI analysis generation (your trading data is sent for analysis);",
              "Stripe: payment processing;",
              "Vercel: application hosting;",
              "Resend: transactional email delivery.",
              "Google: transcription of voice dictation, only if you enable that feature and depending on the browser used (see section 7).",
            ],
          },
        ],
      },
      {
        heading: "6. Transfers outside the European Union",
        blocks: [
          {
            kind: "p",
            text: "Some of our sub-processors (notably Anthropic, Stripe, Vercel and, if you use voice dictation, Google) are established in the United States. Transfers of data to these providers are framed by appropriate safeguards within the meaning of the GDPR, in particular the European Commission's standard contractual clauses. By using the AI features, you are informed that the relevant trading data is sent to Anthropic for processing.",
          },
        ],
      },
      {
        heading: "7. Voice dictation (optional feature)",
        blocks: [
          {
            kind: "p",
            text: "The AI coach offers voice dictation, which you enable yourself by pressing the microphone button. It is never on by default: no sound is captured until you trigger it, and capture stops as soon as you close the coach.",
          },
          {
            kind: "p",
            text: "This feature relies on the speech recognition built into your browser. On Google Chrome and Microsoft Edge, your voice is sent to Google's servers to be transcribed into text. That processing is carried out by Google, under its own terms, and is outside our control. We only receive the transcribed text, never the audio, and we keep no sound recording.",
          },
          {
            kind: "p",
            text: "If you do not want your voice to pass through a third party, do not use the microphone button: every coach feature remains available from the keyboard.",
          },
          {
            kind: "p",
            text: "Reading the answers aloud, by contrast, is performed entirely by your device. No data is sent to a third party for that feature.",
          },
        ],
      },
      {
        heading: "8. Data retention",
        blocks: [
          {
            kind: "p",
            text: "Your account and trading data are kept as long as your account is active. If you delete your account, they are erased within 30 days. Invoices and accounting records are kept for 10 years in accordance with legal obligations.",
          },
        ],
      },
      {
        heading: "9. Your rights (GDPR)",
        blocks: [
          { kind: "p", text: "You have the following rights:" },
          {
            kind: "ul",
            items: [
              "Right of access to your data;",
              "Right to rectification;",
              'Right to erasure ("right to be forgotten");',
              "Right to data portability;",
              "Right to object and to restriction.",
            ],
          },
          {
            kind: "p",
            text: "To exercise these rights, contact us at {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "10. Cookies",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} only uses cookies strictly necessary for the operation of the service (authentication session). No advertising or third-party tracking cookies are used; no prior consent is therefore required for these essential cookies.`,
          },
        ],
      },
      {
        heading: "11. Security",
        blocks: [
          {
            kind: "p",
            text: "We implement appropriate security measures (encryption, restricted access) to protect your data. Your broker login credentials are encrypted. As no system is infallible, we cannot guarantee absolute security.",
          },
        ],
      },
      {
        heading: "12. Complaints",
        blocks: [
          {
            kind: "p",
            text: "You may lodge a complaint with the French data protection authority (CNIL), {cnil}, or with the data protection authority of your country of residence.",
            links: [{ token: "{cnil}", label: "www.cnil.fr", href: "https://www.cnil.fr" }],
          },
          {
            kind: "p",
            text: "Contact: {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
    ],
    footerNote: "This is a translation provided for convenience. The French version of this document prevails.",
  },
  es: {
    title: "Política de privacidad",
    updated: "Última actualización: 7 de agosto de 2026",
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        blocks: [
          {
            kind: "p",
            text: `El responsable del tratamiento de sus datos personales es ${COMPANY.legalName}, empresario individual francés (entreprise individuelle), SIRET ${COMPANY.siret}, ${COMPANY.address}. Para cualquier consulta sobre sus datos: {privacy}.`,
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "2. Datos recogidos",
        blocks: [
          {
            kind: "ul",
            items: [
              "Datos de cuenta: dirección de correo, contraseña (cifrada con hash), nombre de usuario opcional;",
              "Datos de trading: historial de operaciones, P&L, emociones, calidad de los setups, introducidos o importados por usted;",
              "Datos de uso: páginas visitadas, funciones utilizadas (anonimizados);",
              "Datos de pago: tratados por Stripe; no almacenamos ningún dato bancario.",
              "Datos de voz: únicamente si activa el dictado, su voz es transcrita a texto por su navegador (véase la sección 7); no se conserva ninguna grabación sonora.",
            ],
          },
        ],
      },
      {
        heading: "3. Finalidades del tratamiento",
        blocks: [
          {
            kind: "ul",
            items: [
              "Prestar y mejorar el servicio;",
              "Generar análisis de IA personalizados a partir de sus datos de trading;",
              "Gestionar su suscripción y sus pagos;",
              "Enviarle comunicaciones relativas al servicio (sin marketing sin consentimiento).",
            ],
          },
        ],
      },
      {
        heading: "4. Base jurídica",
        blocks: [
          {
            kind: "p",
            text: "Los tratamientos se basan en la ejecución del contrato (prestación del servicio), el cumplimiento de obligaciones legales (facturación, contabilidad) y, en su caso, su consentimiento explícito.",
          },
        ],
      },
      {
        heading: "5. Encargados y destinatarios",
        blocks: [
          {
            kind: "ul",
            items: [
              "Supabase: alojamiento de la base de datos (UE);",
              "Anthropic (Claude): generación de análisis de IA (sus datos de trading se transmiten para su análisis);",
              "Stripe: tratamiento de los pagos;",
              "Vercel: alojamiento de la aplicación;",
              "Resend: envío de correos transaccionales.",
              "Google: transcripción del dictado por voz, únicamente si activa esta función y según el navegador utilizado (véase la sección 7).",
            ],
          },
        ],
      },
      {
        heading: "6. Transferencias fuera de la Unión Europea",
        blocks: [
          {
            kind: "p",
            text: "Algunos de nuestros encargados (en particular Anthropic, Stripe, Vercel y, si utiliza el dictado por voz, Google) están establecidos en Estados Unidos. Las transferencias de datos a estos proveedores están enmarcadas por garantías adecuadas en el sentido del RGPD, en particular las cláusulas contractuales tipo de la Comisión Europea. Al utilizar las funciones de IA, se le informa de que los datos de trading correspondientes se transmiten a Anthropic para su tratamiento.",
          },
        ],
      },
      {
        heading: "7. Dictado por voz (función opcional)",
        blocks: [
          {
            kind: "p",
            text: "El coach IA ofrece un dictado por voz que usted activa pulsando el botón del micrófono. Nunca está activo por defecto: no se capta ningún sonido mientras no lo haya activado, y la captación se detiene en cuanto cierra el coach.",
          },
          {
            kind: "p",
            text: "Esta función se basa en el reconocimiento de voz integrado en su navegador. En Google Chrome y Microsoft Edge, su voz se transmite a los servidores de Google para ser transcrita a texto. Este tratamiento lo realiza Google, según sus propias condiciones, y escapa a nuestro control. Solo recibimos el texto transcrito, nunca el audio, y no conservamos ninguna grabación sonora.",
          },
          {
            kind: "p",
            text: "Si no desea que su voz transite por un tercero, no utilice el botón del micrófono: todas las funciones del coach siguen accesibles desde el teclado.",
          },
          {
            kind: "p",
            text: "La lectura en voz alta de las respuestas, en cambio, la realiza íntegramente su dispositivo. No se transmite ningún dato a terceros para esta función.",
          },
        ],
      },
      {
        heading: "8. Conservación de los datos",
        blocks: [
          {
            kind: "p",
            text: "Sus datos de cuenta y de trading se conservan mientras su cuenta esté activa. Si elimina su cuenta, se borran en un plazo de 30 días. Las facturas y documentos contables se conservan 10 años, conforme a las obligaciones legales.",
          },
        ],
      },
      {
        heading: "9. Sus derechos (RGPD)",
        blocks: [
          { kind: "p", text: "Usted dispone de los siguientes derechos:" },
          {
            kind: "ul",
            items: [
              "Derecho de acceso a sus datos;",
              "Derecho de rectificación;",
              'Derecho de supresión ("derecho al olvido");',
              "Derecho a la portabilidad de sus datos;",
              "Derecho de oposición y de limitación.",
            ],
          },
          {
            kind: "p",
            text: "Para ejercer estos derechos, contáctenos en {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "10. Cookies",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} solo utiliza cookies estrictamente necesarias para el funcionamiento del servicio (sesión de autenticación). No se utiliza ninguna cookie publicitaria ni de seguimiento de terceros; por tanto, no se requiere consentimiento previo para estas cookies esenciales.`,
          },
        ],
      },
      {
        heading: "11. Seguridad",
        blocks: [
          {
            kind: "p",
            text: "Aplicamos medidas de seguridad adecuadas (cifrado, accesos restringidos) para proteger sus datos. Las credenciales de conexión a sus brókers están cifradas. Dado que ningún sistema es infalible, no podemos garantizar una seguridad absoluta.",
          },
        ],
      },
      {
        heading: "12. Reclamaciones",
        blocks: [
          {
            kind: "p",
            text: "Puede presentar una reclamación ante la autoridad francesa de protección de datos (CNIL), {cnil}, o ante la autoridad de protección de datos de su país de residencia.",
            links: [{ token: "{cnil}", label: "www.cnil.fr", href: "https://www.cnil.fr" }],
          },
          {
            kind: "p",
            text: "Contacto: {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Esta es una traducción facilitada por comodidad. Prevalece la versión francesa de este documento.",
  },
  de: {
    title: "Datenschutzerklärung",
    updated: "Letzte Aktualisierung: 7. August 2026",
    sections: [
      {
        heading: "1. Verantwortlicher",
        blocks: [
          {
            kind: "p",
            text: `Verantwortlicher für die Verarbeitung Ihrer personenbezogenen Daten ist ${COMPANY.legalName}, französischer Einzelunternehmer (entreprise individuelle), SIRET ${COMPANY.siret}, ${COMPANY.address}. Bei Fragen zu Ihren Daten: {privacy}.`,
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "2. Erhobene Daten",
        blocks: [
          {
            kind: "ul",
            items: [
              "Kontodaten: E-Mail-Adresse, gehashtes Passwort, optionaler Benutzername;",
              "Trading-Daten: Trade-Historie, P&L, Emotionen, Setup-Qualität, von Ihnen eingegeben oder importiert;",
              "Nutzungsdaten: besuchte Seiten, genutzte Funktionen (anonymisiert);",
              "Zahlungsdaten: von Stripe verarbeitet; wir speichern keine Bankdaten.",
              "Sprachdaten: nur wenn Sie die Spracheingabe aktivieren, wird Ihre Stimme von Ihrem Browser in Text umgewandelt (siehe Abschnitt 7); es werden keine Tonaufnahmen gespeichert.",
            ],
          },
        ],
      },
      {
        heading: "3. Zwecke der Verarbeitung",
        blocks: [
          {
            kind: "ul",
            items: [
              "Bereitstellung und Verbesserung des Dienstes;",
              "Erstellung personalisierter KI-Analysen aus Ihren Trading-Daten;",
              "Verwaltung Ihres Abonnements und Ihrer Zahlungen;",
              "Versand dienstbezogener Mitteilungen (kein Marketing ohne Einwilligung).",
            ],
          },
        ],
      },
      {
        heading: "4. Rechtsgrundlage",
        blocks: [
          {
            kind: "p",
            text: "Die Verarbeitung stützt sich auf die Erfüllung des Vertrags (Bereitstellung des Dienstes), die Einhaltung gesetzlicher Pflichten (Rechnungsstellung, Buchhaltung) und gegebenenfalls Ihre ausdrückliche Einwilligung.",
          },
        ],
      },
      {
        heading: "5. Auftragsverarbeiter und Empfänger",
        blocks: [
          {
            kind: "ul",
            items: [
              "Supabase: Hosting der Datenbank (EU);",
              "Anthropic (Claude): Erstellung der KI-Analysen (Ihre Trading-Daten werden zur Analyse übermittelt);",
              "Stripe: Zahlungsabwicklung;",
              "Vercel: Hosting der Anwendung;",
              "Resend: Versand transaktionaler E-Mails.",
              "Google: Transkription der Spracheingabe, nur wenn Sie diese Funktion aktivieren und je nach verwendetem Browser (siehe Abschnitt 7).",
            ],
          },
        ],
      },
      {
        heading: "6. Übermittlungen außerhalb der Europäischen Union",
        blocks: [
          {
            kind: "p",
            text: "Einige unserer Auftragsverarbeiter (insbesondere Anthropic, Stripe, Vercel und, wenn Sie die Spracheingabe nutzen, Google) haben ihren Sitz in den Vereinigten Staaten. Übermittlungen von Daten an diese Anbieter sind durch geeignete Garantien im Sinne der DSGVO abgesichert, insbesondere die Standardvertragsklauseln der Europäischen Kommission. Bei Nutzung der KI-Funktionen werden Sie darüber informiert, dass die betreffenden Trading-Daten zur Verarbeitung an Anthropic übermittelt werden.",
          },
        ],
      },
      {
        heading: "7. Spracheingabe (optionale Funktion)",
        blocks: [
          {
            kind: "p",
            text: "Der KI-Coach bietet eine Spracheingabe, die Sie selbst über die Mikrofontaste aktivieren. Sie ist nie standardmäßig aktiv: Es wird kein Ton erfasst, solange Sie sie nicht ausgelöst haben, und die Erfassung endet, sobald Sie den Coach schließen.",
          },
          {
            kind: "p",
            text: "Diese Funktion nutzt die in Ihren Browser integrierte Spracherkennung. In Google Chrome und Microsoft Edge wird Ihre Stimme zur Umwandlung in Text an die Server von Google übertragen. Diese Verarbeitung erfolgt durch Google nach dessen eigenen Bedingungen und entzieht sich unserer Kontrolle. Wir erhalten ausschließlich den transkribierten Text, niemals die Audiodaten, und wir speichern keine Tonaufnahmen.",
          },
          {
            kind: "p",
            text: "Wenn Sie nicht möchten, dass Ihre Stimme über einen Dritten läuft, verwenden Sie die Mikrofontaste nicht: Alle Funktionen des Coachs bleiben über die Tastatur verfügbar.",
          },
          {
            kind: "p",
            text: "Das Vorlesen der Antworten erfolgt dagegen vollständig auf Ihrem Gerät. Für diese Funktion werden keine Daten an Dritte übermittelt.",
          },
        ],
      },
      {
        heading: "8. Speicherdauer",
        blocks: [
          {
            kind: "p",
            text: "Ihre Konto- und Trading-Daten werden gespeichert, solange Ihr Konto aktiv ist. Bei Löschung Ihres Kontos werden sie innerhalb von 30 Tagen gelöscht. Rechnungen und Buchhaltungsunterlagen werden gemäß den gesetzlichen Pflichten 10 Jahre aufbewahrt.",
          },
        ],
      },
      {
        heading: "9. Ihre Rechte (DSGVO)",
        blocks: [
          { kind: "p", text: "Ihnen stehen folgende Rechte zu:" },
          {
            kind: "ul",
            items: [
              "Recht auf Auskunft über Ihre Daten;",
              "Recht auf Berichtigung;",
              'Recht auf Löschung ("Recht auf Vergessenwerden");',
              "Recht auf Datenübertragbarkeit;",
              "Recht auf Widerspruch und Einschränkung.",
            ],
          },
          {
            kind: "p",
            text: "Zur Ausübung dieser Rechte kontaktieren Sie uns unter {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
      {
        heading: "10. Cookies",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} verwendet nur Cookies, die für den Betrieb des Dienstes unbedingt erforderlich sind (Authentifizierungssitzung). Es werden keine Werbe- oder Tracking-Cookies von Dritten verwendet; für diese essenziellen Cookies ist daher keine vorherige Einwilligung erforderlich.`,
          },
        ],
      },
      {
        heading: "11. Sicherheit",
        blocks: [
          {
            kind: "p",
            text: "Wir setzen geeignete Sicherheitsmaßnahmen ein (Verschlüsselung, beschränkter Zugriff), um Ihre Daten zu schützen. Ihre Broker-Zugangsdaten werden verschlüsselt. Da kein System unfehlbar ist, können wir keine absolute Sicherheit garantieren.",
          },
        ],
      },
      {
        heading: "12. Beschwerden",
        blocks: [
          {
            kind: "p",
            text: "Sie können eine Beschwerde bei der französischen Datenschutzbehörde (CNIL), {cnil}, oder bei der Datenschutzbehörde Ihres Wohnsitzlandes einreichen.",
            links: [{ token: "{cnil}", label: "www.cnil.fr", href: "https://www.cnil.fr" }],
          },
          {
            kind: "p",
            text: "Kontakt: {privacy}.",
            links: [{ token: "{privacy}", label: COMPANY.privacyEmail, href: `mailto:${COMPANY.privacyEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Dies ist eine Übersetzung zur Vereinfachung. Es gilt die französische Fassung dieses Dokuments.",
  },
};

export default content;
