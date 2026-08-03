-- ============================================================
-- CODE D'INVITATION SECRET pour rejoindre une communauté partenaire.
--
-- Jusqu'ici, le code à saisir sur /dashboard/community ÉTAIT le slug de la
-- communauté, c'est-à-dire celui du lien d'affiliation (`?ref=infx`). Ce slug
-- est public par nature : il s'affiche dans l'URL de chaque publication du
-- partenaire. N'importe qui pouvait donc taper « infx », entrer dans le
-- classement privé d'INFX et voir ses défis sans avoir jamais été son abonné.
--
-- On sépare donc les deux rôles :
--  - le SLUG reste public, il sert au rattachement automatique à l'inscription
--    (arriver par le lien du partenaire prouve d'où l'on vient) ;
--  - le JOIN_CODE est secret, il sert à la saisie manuelle par les abonnés qui
--    avaient déjà un compte. Le partenaire le donne à sa communauté et peut le
--    régénérer à tout moment s'il fuite.
-- ============================================================

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS join_code TEXT;

-- Attribution d'un code aux communautés existantes. Un DO bloc plutôt qu'un
-- UPDATE ensembliste : dans un UPDATE, la sous-requête qui tire le code peut
-- être évaluée une seule fois pour toutes les lignes, ce qui donnerait le même
-- code à toutes les communautés.
--
-- Alphabet sans I, L, O, 0 ni 1 : le code se lit à voix haute en live et se
-- recopie à la main, une ambiguïté coûte un abonné qui n'arrive pas à entrer.
DO $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  target   RECORD;
  code     TEXT;
  i        INT;
BEGIN
  FOR target IN SELECT id FROM communities WHERE join_code IS NULL LOOP
    LOOP
      code := '';
      FOR i IN 1..8 LOOP
        code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM communities WHERE join_code = code);
    END LOOP;
    UPDATE communities SET join_code = code WHERE id = target.id;
  END LOOP;
END $$;

-- Deux communautés ne peuvent pas partager un code : la saisie doit désigner
-- une communauté et une seule.
CREATE UNIQUE INDEX IF NOT EXISTS communities_join_code_key ON communities(join_code);

COMMENT ON COLUMN communities.join_code IS
  'Code d''invitation SECRET (distinct du slug public), régénérable par l''animateur. Seule façon de rejoindre manuellement.';
