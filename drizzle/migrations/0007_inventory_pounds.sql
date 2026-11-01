UPDATE public.ingredients
SET
  quantity = quantity * 2.20462,
  reorder_level = reorder_level * 2.20462,
  unit = 'lb'
WHERE lower(trim(unit)) = 'kg';

ALTER TABLE public.ingredients
  ALTER COLUMN unit SET DEFAULT 'lb';
