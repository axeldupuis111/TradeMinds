-- Vector annotations drawn over a trade's chart screenshot, stored as JSON
-- (shapes) rather than a flattened image — editable, CORS-free, non-destructive.
-- See lib/annotations.ts for the shape schema.

alter table trades
  add column if not exists screenshot_annotations jsonb;
