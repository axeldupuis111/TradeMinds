"use client";

/**
 * Dictée et lecture à voix haute du coach, via l'API Web Speech du navigateur.
 *
 * POURQUOI CE CHOIX — Claude ne prend pas d'audio en entrée : la voix passe
 * forcément par une transcription. L'API du navigateur est gratuite et ne
 * demande aucun backend, là où un fournisseur de transcription coûterait de
 * l'ordre de 0,006 $/minute et ajouterait une route. Le support est inégal
 * (Chrome et Edge bien, Safari inégal surtout en PWA installée, Firefox non),
 * d'où `isDictationSupported()` : le bouton micro ne s'affiche que là où il
 * marche, plutôt que d'offrir une fonction qui échoue en silence.
 *
 * ⚠️ VIE PRIVÉE — sur Chrome, la reconnaissance vocale envoie l'audio aux
 * serveurs de Google. C'est à mentionner dans la politique de confidentialité
 * avant toute mise en avant commerciale de la dictée.
 *
 * La synthèse vocale (lecture des réponses) est, elle, purement locale.
 */

const BCP47: Record<string, string> = {
  fr: "fr-FR",
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
};

export function toBcp47(lang: string): string {
  return BCP47[lang] ?? "en-US";
}

// ── Reconnaissance vocale ───────────────────────────────────────────────────

interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isDictationSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface DictationHandle {
  stop(): void;
}

export interface DictationCallbacks {
  /** Texte en cours de reconnaissance (non figé) — pour l'aperçu live. */
  onPartial?(text: string): void;
  /** Texte figé, à ajouter au champ de saisie. */
  onFinal(text: string): void;
  /** Fin de la dictée, quelle qu'en soit la raison. */
  onEnd?(): void;
  /** Erreur exploitable (`not-allowed` = micro refusé, `no-speech` = silence). */
  onError?(code: string): void;
}

/**
 * Démarre la dictée. Renvoie `null` si le navigateur ne sait pas faire, pour
 * que l'appelant puisse retomber sur la saisie clavier sans cas particulier.
 */
export function startDictation(lang: string, cb: DictationCallbacks): DictationHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  let recognition: SpeechRecognitionLike;
  try {
    recognition = new Ctor();
  } catch {
    return null;
  }

  recognition.lang = toBcp47(lang);
  // `continuous` laisse parler sans couper à la première pause : un trader qui
  // décrit son trade s'interrompt naturellement pour réfléchir.
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (e) => {
    let partial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const text = res[0]?.transcript ?? "";
      if (res.isFinal) cb.onFinal(text.trim());
      else partial += text;
    }
    if (partial) cb.onPartial?.(partial.trim());
  };
  recognition.onerror = (e) => cb.onError?.(e.error ?? "unknown");
  recognition.onend = () => cb.onEnd?.();

  try {
    recognition.start();
  } catch {
    // start() lève si une session est déjà en cours : on considère l'appel nul.
    return null;
  }

  return {
    stop() {
      try { recognition.stop(); } catch { /* déjà arrêtée */ }
    },
  };
}

// ── Synthèse vocale ─────────────────────────────────────────────────────────

export function isSpeechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Nettoie le texte avant lecture : le coach écrit en markdown léger, et faire
 * prononcer « astérisque astérisque » ruine l'intérêt de l'écoute.
 */
export function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")   // blocs de code
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // liens markdown
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function speak(text: string, lang: string): void {
  if (!isSpeechOutputSupported()) return;
  const clean = stripForSpeech(text);
  if (!clean) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = toBcp47(lang);
  utterance.rate = 1.05; // légèrement soutenu : le coach informe, il ne récite pas
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (isSpeechOutputSupported()) window.speechSynthesis.cancel();
}
