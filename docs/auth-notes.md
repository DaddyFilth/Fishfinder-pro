# Auth notes

## Setup

1. Create a Supabase project.
2. Add the SQL in `db/supabase-schema.sql` to the SQL editor and run it.
3. Copy `.env.example` to `.env.local`.
4. Fill in your Supabase URL and anon key.

## Client usage

- Use Supabase Auth for sign up and sign in.
- Store user profile data in `public.profiles`.
- The trigger creates a profile row automatically after a new user is created.

## Recommended env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Notes

- `MapWrapper.tsx` disables SSR for the map component.
- Keep map access on the client side when using browser-only APIs.
