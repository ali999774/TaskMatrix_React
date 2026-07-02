-- Task 6a: 'green' has no entry in the app's color map (CATEGORY_COLORS in
-- src/lib/categories.ts), leaving categories using it unstyled. Backfill
-- existing rows and fix the column default to match CATEGORY_DEFAULTS
-- exactly (Health = red).

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
