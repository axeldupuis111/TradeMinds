import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { utilisateurDuJeton } from "@/lib/desinscription";

export const dynamic = "force-dynamic";

/**
 * DÉSINSCRIPTION DES E-MAILS RÉCURRENTS, SANS SESSION.
 *
 * Les trois envois récurrents (rappel quotidien, rapport hebdomadaire,
 * réactivation) sont tous gouvernés par `profiles.email_notif_session` : couper
 * cette colonne, c'est couper les trois.
 *
 * ⚠️⚠️ LE GET NE DÉSINSCRIT PAS, ET C'EST ESSENTIEL. Les antivirus de messagerie
 * et les aperçus de lien VISITENT les URL d'un e-mail avant que le lecteur ne
 * clique. Un GET destructeur désinscrirait des gens qui n'ont rien demandé, et
 * la panne serait invisible : ils cesseraient simplement de recevoir.
 *
 * Le GET rend donc une page avec un bouton, et c'est le POST qui agit. C'est
 * aussi ce que demande la RFC 8058 pour le « un clic » des fournisseurs :
 * Gmail et Yahoo envoient un POST, jamais un GET.
 *
 * ⚠️ ET CETTE PAGE PARLE QUATRE LANGUES. Elle s'ouvre hors session : le seul
 * indice de langue dont elle dispose est celui que l'expéditeur a posé dans le
 * lien (`&l=`). Sans lui, le repli est l'ANGLAIS, pas le français : dix-sept
 * des vingt et un inscrits sont anglophones.
 */

type Lang = "fr" | "en" | "de" | "es";

interface Textes {
  invalideTitre: string;
  invalideCorps: string;
  confirmerTitre: string;
  confirmerCorps: string;
  bouton: string;
  faitTitre: string;
  faitCorps: string;
  echecTitre: string;
  echecCorps: string;
  reglages: string;
}

const T: Record<Lang, Textes> = {
  fr: {
    invalideTitre: "Lien expiré ou invalide",
    invalideCorps:
      "Ce lien de désinscription n'est plus valable. Tu peux gérer tes notifications depuis tes réglages.",
    confirmerTitre: "Se désinscrire des e-mails",
    confirmerCorps:
      "Tu ne recevras plus le rappel quotidien, le rapport hebdomadaire ni les messages de reprise. Les alertes que tu as activées dans l'application ne changent pas.",
    bouton: "Confirmer la désinscription",
    faitTitre: "C'est fait",
    faitCorps:
      "Tu ne recevras plus ces e-mails. Tu peux les réactiver à tout moment depuis tes réglages.",
    echecTitre: "Ça n'a pas marché",
    echecCorps:
      "On n'a pas réussi à enregistrer ta désinscription. Réessaie dans un instant, ou coupe le rappel depuis tes réglages.",
    reglages: "Gérer toutes mes notifications",
  },
  en: {
    invalideTitre: "Link expired or invalid",
    invalideCorps:
      "This unsubscribe link is no longer valid. You can manage your notifications from your settings.",
    confirmerTitre: "Unsubscribe from these emails",
    confirmerCorps:
      "You will no longer receive the daily reminder, the weekly report or the come-back messages. Alerts you enabled inside the app are not affected.",
    bouton: "Confirm unsubscribe",
    faitTitre: "Done",
    faitCorps:
      "You will no longer receive these emails. You can turn them back on at any time from your settings.",
    echecTitre: "That did not work",
    echecCorps:
      "We could not save your choice. Try again in a moment, or turn the reminder off from your settings.",
    reglages: "Manage all my notifications",
  },
  de: {
    invalideTitre: "Link abgelaufen oder ungültig",
    invalideCorps:
      "Dieser Abmeldelink ist nicht mehr gültig. Du kannst deine Benachrichtigungen in den Einstellungen verwalten.",
    confirmerTitre: "Diese E-Mails abbestellen",
    confirmerCorps:
      "Du erhältst dann weder die tägliche Erinnerung noch den Wochenbericht oder die Rückkehr-Nachrichten. Benachrichtigungen in der App bleiben unverändert.",
    bouton: "Abmeldung bestätigen",
    faitTitre: "Erledigt",
    faitCorps:
      "Du erhältst diese E-Mails nicht mehr. Du kannst sie jederzeit in den Einstellungen wieder aktivieren.",
    echecTitre: "Das hat nicht geklappt",
    echecCorps:
      "Wir konnten deine Abmeldung nicht speichern. Versuche es gleich noch einmal, oder deaktiviere die Erinnerung in den Einstellungen.",
    reglages: "Alle Benachrichtigungen verwalten",
  },
  es: {
    invalideTitre: "Enlace caducado o no válido",
    invalideCorps:
      "Este enlace para darse de baja ya no es válido. Puedes gestionar tus notificaciones desde tus ajustes.",
    confirmerTitre: "Darse de baja de estos correos",
    confirmerCorps:
      "Dejarás de recibir el recordatorio diario, el informe semanal y los mensajes de regreso. Las alertas que activaste en la aplicación no cambian.",
    bouton: "Confirmar la baja",
    faitTitre: "Hecho",
    faitCorps:
      "Ya no recibirás estos correos. Puedes volver a activarlos cuando quieras desde tus ajustes.",
    echecTitre: "No ha funcionado",
    echecCorps:
      "No hemos podido guardar tu baja. Inténtalo de nuevo en un momento, o desactiva el recordatorio desde tus ajustes.",
    reglages: "Gestionar todas mis notificaciones",
  },
};

/** ⚠️ Repli anglais, jamais français : c'est la langue de la majorité. */
function langue(req: NextRequest): Lang {
  const l = req.nextUrl.searchParams.get("l");
  return l === "fr" || l === "de" || l === "es" || l === "en" ? l : "en";
}

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Page minimale, sans dépendance : elle doit s'afficher dans n'importe quoi. */
function page(lang: Lang, titre: string, corps: string, formulaire?: string): NextResponse {
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre}</title></head>
<body style="margin:0;background:#eef2f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171e2a">
<div style="max-width:560px;margin:48px auto;padding:0 16px">
<div style="background:#fff;border:1px solid #e2e7ee;border-radius:14px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6e7887">TradeDiscipline</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${titre}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#3c4656">${corps}</p>
${formulaire ?? ""}
<p style="margin:18px 0 0;font-size:13px;color:#6e7887">
<a href="https://tradediscipline.app/dashboard/settings" style="color:#0a7f76">${T[lang].reglages}</a></p>
</div></div></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const lang = langue(req);
  const t = T[lang];
  const jeton = req.nextUrl.searchParams.get("t");
  if (!utilisateurDuJeton(jeton)) {
    return page(lang, t.invalideTitre, t.invalideCorps);
  }
  const action = `/api/unsubscribe?t=${encodeURIComponent(jeton!)}&l=${lang}`;
  return page(
    lang,
    t.confirmerTitre,
    t.confirmerCorps,
    `<form method="post" action="${action}">
<button type="submit" style="appearance:none;border:0;border-radius:10px;background:#0a0e18;color:#fff;font-size:15px;font-weight:600;padding:12px 18px;cursor:pointer">${t.bouton}</button>
</form>`,
  );
}

export async function POST(req: NextRequest) {
  const lang = langue(req);
  const t = T[lang];
  const jeton = req.nextUrl.searchParams.get("t");
  const userId = utilisateurDuJeton(jeton);
  if (!userId) {
    // ⚠️ Un POST invalide ne dit pas POURQUOI : ce serait un oracle sur les
    // identifiants. Même page que pour un lien périmé.
    return page(lang, t.invalideTitre, t.invalideCorps);
  }

  /**
   * ⚠️⚠️ ON LIT L'ERREUR. Le client Supabase ne jette pas : une écriture non
   * vérifiée annoncerait « c'est fait » pendant que les e-mails continuent, ce
   * qui est précisément ce qui transforme un lecteur agacé en plainte pour spam.
   */
  const { error } = await client()
    .from("profiles")
    .update({ email_notif_session: false })
    .eq("id", userId);

  if (error) {
    console.error("[Désinscription] Écriture refusée :", error.message);
    return page(lang, t.echecTitre, t.echecCorps);
  }

  return page(lang, t.faitTitre, t.faitCorps);
}
