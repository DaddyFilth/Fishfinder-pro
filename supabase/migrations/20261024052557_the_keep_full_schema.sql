-- Co-tenant migration recorded on shared Supabase project dkafqgapepebzjtoghos (the_keep).
-- Preserved in repository migration history so Supabase CLI / GitHub Preview validation stays 1:1 with remote schema_migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Novice' CHECK (tier IN ('Novice', 'Apprentice', 'Adept', 'Master', 'Expert Illusionist')),
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tricks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Novice', 'Apprentice', 'Adept', 'Master', 'Expert Illusionist')),
  category TEXT NOT NULL CHECK (category IN ('cards', 'coins', 'mentalism', 'diy_props', 'street_magic', 'illusions')),
  effect_description TEXT NOT NULL,
  required_materials JSONB NOT NULL DEFAULT '[]',
  construction_steps JSONB NOT NULL DEFAULT '[]',
  performance_steps JSONB NOT NULL DEFAULT '[]',
  common_mistakes JSONB NOT NULL DEFAULT '[]',
  practice_drills JSONB NOT NULL DEFAULT '[]',
  safety_warnings JSONB NOT NULL DEFAULT '[]',
  has_blueprint BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trick_id UUID NOT NULL REFERENCES tricks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'practicing', 'performed', 'mastered')),
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, trick_id)
);

CREATE TABLE IF NOT EXISTS visual_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trick_id UUID NOT NULL REFERENCES tricks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('diagram', 'blueprint', 'frame_sequence')),
  step_index INTEGER,
  storage_path TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tricks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tricks' AND policyname='Authenticated users can view tricks') THEN
    CREATE POLICY "Authenticated users can view tricks" ON tricks FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_progress' AND policyname='Users can view own progress') THEN
    CREATE POLICY "Users can view own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_progress' AND policyname='Users can insert own progress') THEN
    CREATE POLICY "Users can insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_progress' AND policyname='Users can update own progress') THEN
    CREATE POLICY "Users can update own progress" ON user_progress FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_progress' AND policyname='Users can delete own progress') THEN
    CREATE POLICY "Users can delete own progress" ON user_progress FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='visual_assets' AND policyname='Authenticated users can view visual assets metadata') THEN
    CREATE POLICY "Authenticated users can view visual assets metadata" ON visual_assets FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.the_keep_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS the_keep_on_auth_user_created ON auth.users;
CREATE TRIGGER the_keep_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.the_keep_handle_new_user();

CREATE OR REPLACE FUNCTION public.the_keep_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS the_keep_update_users_updated_at ON users;
CREATE TRIGGER the_keep_update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION public.the_keep_set_updated_at();
DROP TRIGGER IF EXISTS the_keep_update_tricks_updated_at ON tricks;
CREATE TRIGGER the_keep_update_tricks_updated_at BEFORE UPDATE ON tricks FOR EACH ROW EXECUTE FUNCTION public.the_keep_set_updated_at();
DROP TRIGGER IF EXISTS the_keep_update_user_progress_updated_at ON user_progress;
CREATE TRIGGER the_keep_update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION public.the_keep_set_updated_at();
