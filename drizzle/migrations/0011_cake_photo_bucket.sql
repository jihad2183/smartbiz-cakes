INSERT INTO storage.buckets (id, name, public)
VALUES ('cake-photos', 'cake-photos', false)
ON CONFLICT (id) DO NOTHING;
