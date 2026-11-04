BEGIN;

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS account_type text,
  ADD COLUMN IF NOT EXISTS account_holder_name text;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_methods_account_type_check'
      AND conrelid = 'public.payment_methods'::regclass
  ) THEN
    ALTER TABLE public.payment_methods
      ADD CONSTRAINT payment_methods_account_type_check
      CHECK (account_type IS NULL OR account_type IN ('personal', 'merchant', 'agent'));
  END IF;
END
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
