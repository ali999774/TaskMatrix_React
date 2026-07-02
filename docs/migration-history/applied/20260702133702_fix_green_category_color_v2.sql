-- Correction: align with src/lib/categories.ts CATEGORY_DEFAULTS exactly
-- (Health = red, not emerald) instead of an invented substitute.

UPDATE public.user_settings
SET categories = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'color' = 'green'
         THEN jsonb_set(elem, '{color}', '"red"')
         ELSE elem END
  )
  FROM jsonb_array_elements(categories) AS elem
)
WHERE categories @> '[{"color": "green"}]';

ALTER TABLE public.user_settings
  ALTER COLUMN categories SET DEFAULT
  '[{"icon": "user", "color": "emerald", "label": "personal", "display": "Personal"}, {"icon": "briefcase-business", "color": "blue", "label": "work", "display": "Work"}, {"icon": "heart", "color": "red", "label": "health", "display": "Health"}, {"icon": "graduation-cap", "color": "purple", "label": "learning", "display": "Learning"}]'::jsonb;
