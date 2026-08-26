"use client";

/**
 * Dock du coach IA — accessible depuis toutes les pages du dashboard.
 *
 * Le coach n'existait que sur /dashboard/analysis : pour lui demander quoi que
 * ce soit, il fallait quitter sa page, donc perdre le contexte et le temps
 * qu'il est censé faire gagner. Ici il s'ouvre par-dessus la page courante, et
 * reçoit la route en cours pour comprendre « celui-là » ou « ces trades ».
 *
 * Il est masqué sur /dashboard/analysis, où le chat est déjà intégré à la page :
 * deux surfaces de chat simultanées auraient deux états divergents.
 *
 * Voix : dictée (API Web Speech, gratuite) et lecture des réponses à voix
 * haute, pour le cas « je suis en position, j'ai les mains sur le graphique ».
 * Les deux boutons ne s'affichent que si le navigateur sait faire.
 */

import { Mic, MicOff, MessageCircle, Send, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ecouterDemandesCoach } from "@/lib/coach-bus";
import { coachActionMeta, useCoachChat } from "@/lib/hooks/useCoachChat";
import CoachConfirmBox from "@/components/coach/CoachConfirmBox";
import { describePage } from "@/lib/coach-page-context";
import { useLanguage } from "@/lib/LanguageContext";
import { usePlan } from "@/lib/PlanContext";
import {
  isDictationSupported,
  isSpeechOutputSupported,
  speak,
  startDictation,
  stopSpeaking,
  type DictationHandle,
} from "@/lib/speech";

/** Le chat de la page Analyse fait déjà le travail : pas de doublon. */
const HIDDEN_ON = ["/dashboard/analysis"];

export default function CoachDock() {
  const pathname = usePathname();
  const { t, lang } = useLanguage();
  const { plan, demoMode } = usePlan();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const dictationRef = useRef<DictationHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pageContext = useMemo(() => describePage(pathname), [pathname]);
  const chat = useCoachChat({ plan, lang, t, demoMode, pageContext });

  // Le dock vit dans le layout : il reste monté d'une page à l'autre et gardait
  // donc la conversation telle qu'elle était à son premier rendu. Or la page
  // Analyse écrit dans le MÊME fil. On parlait au coach en grand écran, on
  // revenait, et le raccourci affichait encore l'état d'avant.
  //
  // On relit donc à chaque fois que le dock (re)devient consultable : à
  // l'ouverture, et au retour d'une page où il était masqué pendant que la
  // conversation continuait ailleurs. Passer par une ref garde l'effet
  // insensible à l'identité de `refresh`, qui changerait à chaque rendu.
  const visible = open && !HIDDEN_ON.some((p) => pathname.startsWith(p));
  const refreshRef = useRef(chat.refresh);
  refreshRef.current = chat.refresh;
  useEffect(() => { if (visible) void refreshRef.current(); }, [visible]);

  // Le support de la dictée se teste côté client uniquement (pas au rendu SSR,
  // sinon l'hydratation diverge entre serveur et navigateur).
  const [canDictate, setCanDictate] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    setCanDictate(isDictationSupported());
    setCanSpeak(isSpeechOutputSupported());
  }, []);

  // Auto-scroll collant : on ne suit le bas que si l'utilisateur y est déjà.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  // Échap ferme le dock. Une seule façon de sortir d'un dialogue, c'est une
  // façon de trop peu : si la croix devient inatteignable (mise en page
  // étroite, clavier virtuel qui remonte), il reste cette issue.
  /**
   * Une page demande à parler au coach.
   *
   * ⚠️ LE CLIC ENVOIE, IL NE PRÉ-REMPLIT PLUS. La première version posait la
   * question dans le champ de saisie et attendait que le trader appuie, pour ne
   * pas consommer son quota sans accord. Résultat à l'écran : « pas de message
   * du coach, rien ». Deux clics pour une seule intention, et dans le moment
   * chaud où l'alerte se déclenche, le second ne serait jamais venu.
   *
   * Le consentement n'est pas perdu, il est au bon endroit : le clic sur « En
   * parler au coach » EST la demande. Ce qu'on refuse toujours, c'est qu'un
   * message parte sans que personne n'ait rien demandé.
   */
  useEffect(
    () =>
      ecouterDemandesCoach(({ question }) => {
        setOpen(true);
        void chat.send(question);
      }),
    [chat],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stopDictation = useCallback(() => {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setListening(false);
    setPartial("");
  }, []);

  // Fermer le dock coupe le micro et la lecture : rien ne doit continuer à
  // tourner derrière une fenêtre fermée.
  useEffect(() => {
    if (!open) {
      stopDictation();
      stopSpeaking();
    }
  }, [open, stopDictation]);

  useEffect(() => () => { dictationRef.current?.stop(); stopSpeaking(); }, []);

  function toggleDictation() {
    setMicError(null);
    if (listening) { stopDictation(); return; }
    const handle = startDictation(lang, {
      onPartial: setPartial,
      onFinal: (text) => {
        setPartial("");
        chat.setInput((prev) => (prev ? `${prev} ${text}` : text));
      },
      onEnd: () => { setListening(false); setPartial(""); dictationRef.current = null; },
      onError: (code) => {
        setMicError(code === "not-allowed" ? t("coach_voice_denied") : t("coach_voice_error"));
        setListening(false);
      },
    });
    if (!handle) { setMicError(t("coach_voice_unsupported")); return; }
    dictationRef.current = handle;
    setListening(true);
    inputRef.current?.focus();
  }

  async function handleSend() {
    if (listening) stopDictation();
    const answer = await chat.send();
    if (voiceReplies && answer) void speak(answer, lang);
  }

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const blocked = chat.remaining <= 0;

  return (
    <>
      {/* Bouton flottant, seul dans son coin : l'aide est passée dans la barre
          du haut, deux ronds côte à côte encombraient l'écran pour rien. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("coach_dock_open")}
          className="fixed bottom-20 lg:bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-accent text-black shadow-lg hover:brightness-110 transition-all hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" strokeWidth={2} />
        </button>
      )}

      {/* Sur mobile le panneau est borné EN HAUT (top-16). Sans cette borne il
          grandit jusqu'à glisser sous le header du dashboard, qui est en
          z-[60] : sa barre de titre passe derrière, la croix de fermeture
          devient impossible à cliquer, et le trader est enfermé dans le coach.
          z-[70] garantit en plus que le dialogue reste au-dessus. */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("coach_dock_title")}
          className="fixed z-[70] inset-x-4 top-16 bottom-36 sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-24 sm:w-[400px] sm:max-h-[min(620px,calc(100vh-9rem))] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-accent/[0.06]">
            <MessageCircle className="w-4 h-4 text-accent shrink-0" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground leading-tight">{t("coach_dock_title")}</h2>
              {chat.isPaidPlan && (
                /*
                 * LES DEUX BORNES, TOUJOURS. Le dock n'affichait que le
                 * quotidien : le plafond mensuel existait côté serveur mais le
                 * trader le découvrait en le heurtant, après avoir payé. C'était
                 * défendable tant qu'il valait 2,6× l'usage d'un professionnel ;
                 * depuis qu'il est à 1,5× (le prix de Sonnet 5 sur le coach),
                 * une limite qu'on peut atteindre doit se voir avant.
                 */
                <p className="text-[11px] text-foreground-muted">
                  {t("coach_dock_remaining_both")
                    .replace("{d}", String(chat.remaining))
                    .replace("{m}", String(chat.monthlyRemaining))}
                </p>
              )}
            </div>
            {canSpeak && (
              <button
                onClick={() => { const next = !voiceReplies; setVoiceReplies(next); if (!next) stopSpeaking(); }}
                aria-pressed={voiceReplies}
                aria-label={t("coach_voice_replies")}
                title={t("coach_voice_replies")}
                className={`p-1.5 rounded-lg transition-colors ${voiceReplies ? "text-accent bg-accent/10" : "text-foreground-muted hover:text-foreground"}`}
              >
                {voiceReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label={t("detail_close")}
              className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chat.messages.length === 0 && (
              <p className="text-sm text-foreground-muted">
                {pageContext ? t("coach_dock_empty_context") : t("coach_dock_empty")}
              </p>
            )}
            {chat.messages.map((msg, i) => (
              <div key={msg.id ?? i} className={msg.role === "user" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[92%] text-left rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-accent/15 text-foreground"
                      : "bg-background border border-border text-foreground-muted"
                  }`}
                >
                  {msg.content || (chat.loading ? "…" : "")}
                </div>
                {/* Rien n'est fait tant que le trader n'a pas tranché. */}
                {(msg.confirms ?? []).map((item, ci) => (
                  <CoachConfirmBox
                    key={`c${ci}`}
                    item={item}
                    t={t}
                    onResolve={(accept) => void chat.resolveConfirm(i, ci, accept)}
                  />
                ))}
                {(msg.actions ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(msg.actions ?? []).map((item, ai) => {
                      const meta = coachActionMeta(item.action, t);
                      if (!meta.label) return null;
                      return (
                        <span
                          key={ai}
                          className={`inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] ${item.undone ? "opacity-50 line-through" : ""}`}
                        >
                          <span className="text-accent">✓</span>
                          {meta.href ? (
                            <Link href={meta.href} className="hover:underline text-foreground" onClick={() => setOpen(false)}>
                              {meta.label}
                            </Link>
                          ) : (
                            <span className="text-foreground">{meta.label}</span>
                          )}
                          {item.undo && !item.undone && (
                            <button onClick={() => chat.undo(i, ai)} className="text-foreground-muted hover:text-foreground underline">
                              {t("coach_action_undo")}
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <footer className="border-t border-border p-3">
            {micError && <p className="text-[11px] text-red-500 mb-1.5">{micError}</p>}
            {listening && (
              <p className="text-[11px] text-accent mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
                {partial || t("coach_voice_listening")}
              </p>
            )}
            {blocked ? (
              <Link
                href="/dashboard/upgrade"
                className="block text-center text-sm font-semibold rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black py-2 hover:brightness-110 transition"
              >
                {chat.isPaidPlan ? t("coach_dock_limit_reached") : t("coach_dock_upgrade")}
              </Link>
            ) : (
              <div className="flex items-end gap-2">
                {canDictate && (
                  <button
                    onClick={toggleDictation}
                    aria-pressed={listening}
                    aria-label={listening ? t("coach_voice_stop") : t("coach_voice_start")}
                    title={listening ? t("coach_voice_stop") : t("coach_voice_start")}
                    className={`shrink-0 p-2 rounded-lg border transition-colors ${
                      listening
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  value={chat.input}
                  onChange={(e) => chat.setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  rows={1}
                  placeholder={t("coach_dock_placeholder")}
                  disabled={chat.loading}
                  className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/70 focus:outline-none focus:border-accent max-h-24"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={chat.loading || !chat.input.trim()}
                  aria-label={t("coach_dock_send")}
                  className="shrink-0 p-2 rounded-lg bg-accent text-black disabled:opacity-40 hover:brightness-110 transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </footer>
        </div>
      )}
    </>
  );
}
