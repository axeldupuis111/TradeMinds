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
 * Nettoie le texte avant lecture.
 *
 * Le coach écrit en markdown léger et ponctue d'émojis : lus tels quels, la
 * synthèse annonce « astérisque astérisque » puis décrit chaque pictogramme
 * (« graphique en hausse »), ce qui casse net l'illusion d'un interlocuteur.
 */
export function stripForSpeech(text: string): string {
  return text
    // Blocs de code : on absorbe aussi les sauts de ligne qui les entourent,
    // sinon leur suppression laisse une pause béante au milieu de la phrase.
    .replace(/\n?```[\s\S]*?```\n?/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // liens markdown
    // Émojis et pictogrammes : la synthèse les VERBALISE (« graphique en
    // hausse »), ce qui casse net l'illusion d'un interlocuteur.
    // Écrit en paires de substitution plutôt qu'avec le drapeau `u` : la cible
    // TypeScript du projet ne l'accepte pas.
    //   [\uD800-\uDBFF][\uDC00-\uDFFF] → tout le plan astral (émojis modernes)
    //   les plages BMP ci-après        → flèches, symboles, dingbats
    //   ️ / ‍                → sélecteur de variante et liant ZWJ
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[←-⇿⌀-⏿☀-➿⬀-⯿️‍]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Découpe en phrases pour la lecture.
 *
 * Deux raisons. D'abord Chrome coupe silencieusement une énonciation de plus
 * d'une quinzaine de secondes : une réponse d'un bloc s'arrête au milieu. Ensuite
 * une file de phrases courtes respire mieux qu'un pavé lu d'une traite, ce qui
 * est l'essentiel de l'effet « robot qui bégaye ».
 */
export function splitIntoUtterances(text: string, maxChars = 180): string[] {
  const sentences = text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) { out.push(current); current = ""; }
      // Phrase trop longue : on coupe sur la ponctuation faible, jamais en
      // plein mot (une coupure au milieu d'un mot s'entend immédiatement).
      const parts = sentence.split(/(?<=[,;:])\s+/);
      let chunk = "";
      for (const part of parts) {
        if ((chunk + " " + part).trim().length > maxChars && chunk) { out.push(chunk.trim()); chunk = part; }
        else chunk = (chunk ? `${chunk} ${part}` : part);
      }
      if (chunk.trim()) out.push(chunk.trim());
      continue;
    }
    if ((current + " " + sentence).trim().length > maxChars && current) {
      out.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Choisit la voix la plus naturelle disponible pour la langue.
 *
 * Les navigateurs embarquent deux familles : des voix « compactes » anciennes,
 * métalliques, et des voix neuronales nettement meilleures (Google, Microsoft
 * Natural, Apple Premium/Enhanced). Sans sélection explicite, le moteur retient
 * souvent la première de la liste, c'est-à-dire la mauvaise.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const target = toBcp47(lang);
  const base = target.split("-")[0];
  const candidates = voices.filter((v) => v.lang === target || v.lang.startsWith(`${base}-`) || v.lang === base);
  if (candidates.length === 0) return null;

  const score = (v: SpeechSynthesisVoice): number => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural|premium|enhanced|siri/.test(n)) s += 100; // familles neuronales
    if (n.includes("google")) s += 60;                            // bonne qualité, très répandue
    if (/compact|espeak|pico/.test(n)) s -= 100;                  // voix historiques métalliques
    if (v.lang === target) s += 10;                               // variante régionale exacte
    if (!v.localService) s += 5;                                  // les voix serveur sont les meilleures
    return s;
  };
  return candidates.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * La liste des voix arrive de façon asynchrone sur Chrome : au premier appel
 * elle est vide, et l'événement `voiceschanged` la remplit ensuite. Sans cette
 * attente, la toute première lecture se fait toujours avec la voix par défaut.
 */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) { resolve(existing); return; }
    const timer = setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => { clearTimeout(timer); resolve(window.speechSynthesis.getVoices()); },
      { once: true },
    );
  });
}

export async function speak(text: string, lang: string): Promise<void> {
  if (!isSpeechOutputSupported()) return;
  const clean = stripForSpeech(text);
  if (!clean) return;

  window.speechSynthesis.cancel();
  const voices = await loadVoices();
  const voice = pickVoice(voices, lang);

  for (const chunk of splitIntoUtterances(clean)) {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = toBcp47(lang);
    if (voice) u.voice = voice;
    // Débit parlé naturel : au-delà de 1,05 la prosodie des voix neuronales
    // se dégrade et on retombe sur l'effet récitation.
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }
}

export function stopSpeaking(): void {
  if (isSpeechOutputSupported()) window.speechSynthesis.cancel();
}
