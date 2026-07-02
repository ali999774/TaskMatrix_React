-- Task 6a: 'green' has no entry in the app's color map (CATEGORY_COLORS),
-- leaving affected categories unstyled. 'emerald' is the closest supported
-- color and already used elsewhere for the same semantic (Personal/Health).

-- Backfill any existing rows using the unsupported color.
UPDATE public.user_settings
SET categories = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'color' = 'green'
         THEN jsonb_set(elem, '{color}', '"emerald"')
         ELSE elem END
  )
  FROM jsonb_array_elements(categories) AS elem
)
WHERE categories @> '[{"color": "green"}]';

-- Fix the column default so new users don't get the same unstyled category.
ALTER TABLE public.user_settings
  ALTER COLUMN categories SET DEFAULT
  '[{"icon": "briefcase-business", "color": "blue", "label": "work", "display": "Work"}, {"icon": "user", "color": "emerald", "label": "personal", "display": "Personal"}, {"icon": "heart", "color": "emerald", "label": "health", "display": "Health"}, {"icon": "graduation-cap", "color": "purple", "label": "learning", "display": "Learning"}]'::jsonb;
