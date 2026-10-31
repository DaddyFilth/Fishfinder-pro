-- Co-tenant migration recorded on shared Supabase project dkafqgapepebzjtoghos (the_keep).
-- Preserved in repository migration history so Supabase CLI / GitHub Preview validation stays 1:1 with remote schema_migrations.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Novice' CHECK (tier IN ('Novice', 'Apprentice', 'Adept', 'Master', 'Expert Illusionist')),
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
