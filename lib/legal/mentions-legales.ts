import type { LegalContent } from "./types";
import { COMPANY, HOSTS } from "./company";

const content: LegalContent = {
  fr: {
    title: "Mentions légales",
    updated: "Dernière mise à jour : 27 juin 2026",
    sections: [
      {
        heading: "Éditeur du site",
        blocks: [
          {
            kind: "p",
            text: `Le site ${COMPANY.brand} (${COMPANY.site}) est édité par ${COMPANY.legalName}, ${COMPANY.status}.`,
          },
          {
            kind: "ul",
            items: [
              `Dénomination : ${COMPANY.legalName} (nom commercial : ${COMPANY.brand})`,
              `SIRET : ${COMPANY.siret} — SIREN : ${COMPANY.siren}`,
              `Siège : ${COMPANY.address}`,
              `Contact : ${COMPANY.contactEmail}`,
            ],
          },
          {
            kind: "p",
            text: "Directeur de la publication : Axel Dupuis.",
          },
          {
            kind: "p",
            text: "TVA non applicable, art. 293 B du CGI (franchise en base de TVA).",
          },
        ],
      },
      {
        heading: "Hébergement",
        blocks: [
          {
            kind: "p",
            text: "Le site et les données sont hébergés par :",
          },
          {
            kind: "ul",
            items: [
              `Application : ${HOSTS.app.name}, ${HOSTS.app.address} — ${HOSTS.app.site}`,
              `Base de données : ${HOSTS.data.name}, ${HOSTS.data.address} — ${HOSTS.data.site}`,
            ],
          },
        ],
      },
      {
        heading: "Propriété intellectuelle",
        blocks: [
          {
            kind: "p",
            text: `L'ensemble du contenu de ce site (code, design, textes, marque ${COMPANY.brand}) est la propriété exclusive de l'éditeur et est protégé par les lois relatives à la propriété intellectuelle. Toute reproduction ou distribution sans autorisation écrite est interdite.`,
          },
        ],
      },
      {
        heading: "Données personnelles",
        blocks: [
          {
            kind: "p",
            text: "Le traitement de vos données personnelles est régi par notre {privacy}.",
            links: [{ token: "{privacy}", label: "Politique de confidentialité", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "Limitation de responsabilité",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} est un outil d'analyse et de journal de trading. Il ne constitue en aucun cas un conseil financier ou en investissement. Toute décision de trading reste sous votre entière responsabilité. Le trading implique un risque significatif de perte en capital.`,
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            kind: "p",
            text: "Pour toute question relative aux présentes mentions légales : {contact}.",
            links: [{ token: "{contact}", label: COMPANY.contactEmail, href: `mailto:${COMPANY.contactEmail}` }],
          },
        ],
      },
    ],
  },
  en: {
    title: "Legal Notice",
    updated: "Last updated: June 27, 2026",
    sections: [
      {
        heading: "Publisher",
        blocks: [
          {
            kind: "p",
            text: `The website ${COMPANY.brand} (${COMPANY.site}) is published by ${COMPANY.legalName}, a French sole trader (entreprise individuelle).`,
          },
          {
            kind: "ul",
            items: [
              `Name: ${COMPANY.legalName} (trading name: ${COMPANY.brand})`,
              `SIRET: ${COMPANY.siret} — SIREN: ${COMPANY.siren}`,
              `Registered office: ${COMPANY.address}`,
              `Contact: ${COMPANY.contactEmail}`,
            ],
          },
          { kind: "p", text: "Publication director: Axel Dupuis." },
          { kind: "p", text: "VAT not applicable, art. 293 B of the French CGI (VAT exemption scheme)." },
        ],
      },
      {
        heading: "Hosting",
        blocks: [
          { kind: "p", text: "The website and data are hosted by:" },
          {
            kind: "ul",
            items: [
              `Application: ${HOSTS.app.name}, ${HOSTS.app.address} — ${HOSTS.app.site}`,
              `Database: ${HOSTS.data.name}, ${HOSTS.data.address} — ${HOSTS.data.site}`,
            ],
          },
        ],
      },
      {
        heading: "Intellectual property",
        blocks: [
          {
            kind: "p",
            text: `All content on this website (code, design, text, the ${COMPANY.brand} brand) is the exclusive property of the publisher and is protected by intellectual property laws. Any reproduction or distribution without written authorization is prohibited.`,
          },
        ],
      },
      {
        heading: "Personal data",
        blocks: [
          {
            kind: "p",
            text: "The processing of your personal data is governed by our {privacy}.",
            links: [{ token: "{privacy}", label: "Privacy Policy", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "Limitation of liability",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} is a trading journal and analysis tool. It does not constitute financial or investment advice. Any trading decision remains your sole responsibility. Trading involves a significant risk of capital loss.`,
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            kind: "p",
            text: "For any question regarding this legal notice: {contact}.",
            links: [{ token: "{contact}", label: COMPANY.contactEmail, href: `mailto:${COMPANY.contactEmail}` }],
          },
        ],
      },
    ],
    footerNote: "This is a translation provided for convenience. The French version of this document prevails.",
  },
  es: {
    title: "Aviso legal",
    updated: "Última actualización: 27 de junio de 2026",
    sections: [
      {
        heading: "Editor del sitio",
        blocks: [
          {
            kind: "p",
            text: `El sitio ${COMPANY.brand} (${COMPANY.site}) está editado por ${COMPANY.legalName}, empresario individual francés (entreprise individuelle).`,
          },
          {
            kind: "ul",
            items: [
              `Denominación: ${COMPANY.legalName} (nombre comercial: ${COMPANY.brand})`,
              `SIRET: ${COMPANY.siret} — SIREN: ${COMPANY.siren}`,
              `Domicilio: ${COMPANY.address}`,
              `Contacto: ${COMPANY.contactEmail}`,
            ],
          },
          { kind: "p", text: "Director de la publicación: Axel Dupuis." },
          { kind: "p", text: "IVA no aplicable, art. 293 B del CGI francés (régimen de franquicia de IVA)." },
        ],
      },
      {
        heading: "Alojamiento",
        blocks: [
          { kind: "p", text: "El sitio y los datos están alojados por:" },
          {
            kind: "ul",
            items: [
              `Aplicación: ${HOSTS.app.name}, ${HOSTS.app.address} — ${HOSTS.app.site}`,
              `Base de datos: ${HOSTS.data.name}, ${HOSTS.data.address} — ${HOSTS.data.site}`,
            ],
          },
        ],
      },
      {
        heading: "Propiedad intelectual",
        blocks: [
          {
            kind: "p",
            text: `Todo el contenido de este sitio (código, diseño, textos, marca ${COMPANY.brand}) es propiedad exclusiva del editor y está protegido por las leyes de propiedad intelectual. Queda prohibida toda reproducción o distribución sin autorización escrita.`,
          },
        ],
      },
      {
        heading: "Datos personales",
        blocks: [
          {
            kind: "p",
            text: "El tratamiento de sus datos personales se rige por nuestra {privacy}.",
            links: [{ token: "{privacy}", label: "Política de privacidad", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "Limitación de responsabilidad",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} es una herramienta de análisis y diario de trading. No constituye asesoramiento financiero ni de inversión. Toda decisión de trading es de su exclusiva responsabilidad. El trading conlleva un riesgo significativo de pérdida de capital.`,
          },
        ],
      },
      {
        heading: "Contacto",
        blocks: [
          {
            kind: "p",
            text: "Para cualquier consulta sobre este aviso legal: {contact}.",
            links: [{ token: "{contact}", label: COMPANY.contactEmail, href: `mailto:${COMPANY.contactEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Esta es una traducción facilitada por comodidad. Prevalece la versión francesa de este documento.",
  },
  de: {
    title: "Impressum",
    updated: "Letzte Aktualisierung: 27. Juni 2026",
    sections: [
      {
        heading: "Anbieter",
        blocks: [
          {
            kind: "p",
            text: `Die Website ${COMPANY.brand} (${COMPANY.site}) wird betrieben von ${COMPANY.legalName}, französischer Einzelunternehmer (entreprise individuelle).`,
          },
          {
            kind: "ul",
            items: [
              `Name: ${COMPANY.legalName} (Handelsname: ${COMPANY.brand})`,
              `SIRET: ${COMPANY.siret} — SIREN: ${COMPANY.siren}`,
              `Sitz: ${COMPANY.address}`,
              `Kontakt: ${COMPANY.contactEmail}`,
            ],
          },
          { kind: "p", text: "Verantwortlich für den Inhalt: Axel Dupuis." },
          { kind: "p", text: "Umsatzsteuer nicht anwendbar, Art. 293 B des französischen CGI (Kleinunternehmerregelung)." },
        ],
      },
      {
        heading: "Hosting",
        blocks: [
          { kind: "p", text: "Die Website und die Daten werden gehostet von:" },
          {
            kind: "ul",
            items: [
              `Anwendung: ${HOSTS.app.name}, ${HOSTS.app.address} — ${HOSTS.app.site}`,
              `Datenbank: ${HOSTS.data.name}, ${HOSTS.data.address} — ${HOSTS.data.site}`,
            ],
          },
        ],
      },
      {
        heading: "Urheberrecht",
        blocks: [
          {
            kind: "p",
            text: `Sämtliche Inhalte dieser Website (Code, Design, Texte, Marke ${COMPANY.brand}) sind ausschließliches Eigentum des Anbieters und durch das Urheberrecht geschützt. Jede Vervielfältigung oder Verbreitung ohne schriftliche Genehmigung ist untersagt.`,
          },
        ],
      },
      {
        heading: "Personenbezogene Daten",
        blocks: [
          {
            kind: "p",
            text: "Die Verarbeitung Ihrer personenbezogenen Daten richtet sich nach unserer {privacy}.",
            links: [{ token: "{privacy}", label: "Datenschutzerklärung", href: "/legal/privacy" }],
          },
        ],
      },
      {
        heading: "Haftungsbeschränkung",
        blocks: [
          {
            kind: "p",
            text: `${COMPANY.brand} ist ein Trading-Tagebuch und Analysewerkzeug. Es stellt keine Finanz- oder Anlageberatung dar. Jede Trading-Entscheidung liegt in Ihrer alleinigen Verantwortung. Trading ist mit einem erheblichen Risiko des Kapitalverlusts verbunden.`,
          },
        ],
      },
      {
        heading: "Kontakt",
        blocks: [
          {
            kind: "p",
            text: "Bei Fragen zu diesem Impressum: {contact}.",
            links: [{ token: "{contact}", label: COMPANY.contactEmail, href: `mailto:${COMPANY.contactEmail}` }],
          },
        ],
      },
    ],
    footerNote: "Dies ist eine Übersetzung zur Vereinfachung. Es gilt die französische Fassung dieses Dokuments.",
  },
};

export default content;
