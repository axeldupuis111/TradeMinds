-- Rétablit l'ordre des paires question/réponse du coach IA.
--
-- LE DÉFAUT — la question et la réponse étaient insérées dans un SEUL appel,
-- donc Postgres leur attribuait le même `created_at` par défaut. Au
-- rechargement, `order by created_at` n'avait plus de quoi les départager :
-- l'ordre devenait arbitraire et la réponse s'affichait au-dessus de sa
-- question une fois sur deux. Relevé en production : 19 horodatages sur 19
-- étaient partagés par exactement deux messages.
--
-- Le code écrit désormais deux dates distinctes (lib/hooks/useCoachChat,
-- pairTimestamps). Cette migration répare l'historique déjà écrit.
--
-- MÉTHODE — pour chaque horodatage partagé par exactement une question et une
-- réponse d'un même trader, on décale la RÉPONSE d'une milliseconde. Rien
-- d'autre n'est touché : ni le contenu, ni les lignes déjà correctement
-- ordonnées, ni les groupes atypiques (plus de deux messages à la même date).
--
-- Idempotente : après passage il n'existe plus de collision, donc un second
-- lancement ne modifie rien.

update chat_messages m
   set created_at = m.created_at + interval '1 millisecond'
 where m.role = 'assistant'
   and exists (
     select 1
       from chat_messages q
      where q.user_id = m.user_id
        and q.created_at = m.created_at
        and q.role = 'user'
   )
   -- Uniquement les paires nettes : on ne réordonne pas à l'aveugle un groupe
   -- de trois messages ou plus, dont l'intention d'origine est inconnue.
   and (
     select count(*)
       from chat_messages c
      where c.user_id = m.user_id
        and c.created_at = m.created_at
   ) = 2;
