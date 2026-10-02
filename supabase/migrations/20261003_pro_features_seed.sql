-- Seed the achievements referenced by ProLogger so badge inserts never fail.
INSERT INTO public.achievements (id, title, description, xp_reward, criteria, icon_url)
VALUES ('first_catch', 'First Catch', 'Log your first catch.', 50, '{"species": "*", "count": 1}', null)
ON CONFLICT (id) DO NOTHING;
