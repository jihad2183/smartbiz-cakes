import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Administrator permission rules', () => {
  const sql = readFileSync('drizzle/migrations/0001_require_admin_approval_on_signup.sql', 'utf8');
  it('signup grants customer access only, never administrator access', () => {
    const signup = sql.split('CREATE OR REPLACE FUNCTION public.decide_admin_request')[0] ?? '';
    expect(signup).toMatch(/VALUES\(new.id,'customer'\)/);
    expect(signup).not.toContain("'admin'");
  });
  it('requires the current administrator and a pending request before approval', () => {
    const decision = sql.split('CREATE OR REPLACE FUNCTION public.decide_admin_request')[1] ?? '';
    expect(decision).toContain("IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION");
    expect(decision).toContain("r.status <> 'pending' THEN RAISE EXCEPTION");
    expect(decision).toContain("IF _approve THEN INSERT INTO public.user_roles");
  });
});