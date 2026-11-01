UPDATE public.vouchers
SET active = false, discount_type = 'percent', discount_value = 1
WHERE discount_type = 'fixed';

UPDATE public.welcome_voucher_settings
SET active = false, discount_type = 'percent', discount_value = 10
WHERE discount_type = 'fixed';

ALTER TABLE public.vouchers
  DROP CONSTRAINT IF EXISTS vouchers_discount_type_check,
  ADD CONSTRAINT vouchers_percentage_only_check CHECK (discount_type = 'percent');

ALTER TABLE public.welcome_voucher_settings
  DROP CONSTRAINT IF EXISTS welcome_voucher_settings_discount_type_check,
  ADD CONSTRAINT welcome_voucher_settings_percentage_only_check
    CHECK (discount_type = 'percent');

DROP POLICY IF EXISTS "eligible customers and admins read vouchers" ON public.vouchers;
CREATE POLICY "customers read their voucher history" ON public.vouchers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR eligible_to_all
    OR EXISTS (
      SELECT 1 FROM public.voucher_eligibility e
      WHERE e.voucher_id = vouchers.id AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.voucher_redemptions r
      WHERE r.voucher_id = vouchers.id AND r.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER sync_profile_email_after_auth_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();
