-- ============================================================
-- profiles.coach_memory — mémoire longitudinale du coach IA.
--
-- Profil comportemental persistant, mis à jour de façon DÉTERMINISTE
-- (aucun appel IA supplémentaire) :
--   - /api/analyze ajoute un snapshot après chaque analyse
--     (score, top violations, patterns) ;
--   - /api/session-debrief ajoute le « focus » du débrief comme
--     engagement à tenir.
-- Injecté ensuite dans les prompts du chat-coach, de l'analyse et du
-- débrief pour que l'IA se souvienne des récidives et des engagements.
--
-- JSONB shape (lib/coach-memory.ts est la source de vérité) :
--   {
--     "snapshots": [{ "date", "score", "trades", "period",
--                      "top_violations": [{ "type", "occurrences" }],
--                      "patterns": ["..."] }],       -- 8 max, FIFO
--     "commitments": [{ "date", "text", "source" }]  -- 5 max, FIFO
--   }
-- ============================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS coach_memory JSONB;

COMMENT ON COLUMN profiles.coach_memory IS 'Mémoire longitudinale du coach IA : { snapshots: [...8 max], commitments: [...5 max] }. Écrite par /api/analyze et /api/session-debrief, lue par les prompts IA (chat-coach, analyze, session-debrief).';
