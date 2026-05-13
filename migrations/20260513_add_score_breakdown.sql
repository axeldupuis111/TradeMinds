-- Add score_breakdown column to session_reviews
-- Stores the detailed breakdown of how the discipline score was calculated
-- Format: JSONB array of CategoryBreakdown objects
ALTER TABLE session_reviews
ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN session_reviews.score_breakdown IS 'Detailed breakdown of discipline score calculation (penalties by category). NULL for legacy reviews.';
