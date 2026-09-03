# Logbook — Trip Journal

The Logbook tab is a local-first fishing trip journal. It replaces the former
"No catches logged yet" placeholder in `src/app/page.tsx` and lives alongside
the existing map-popup `CatchLogger` (per-spot catch entries), which is unchanged.

## What it does

- **Trip form** — title (required), date, water body, species, catch count,
  weather/conditions, and free-form notes.
- **Photo picker** — up to 4 photos per trip. Images are downscaled to a
  1280px longest side and re-encoded as JPEG (~0.8 quality) before being
  stored, keeping browser storage usage reasonable.
- **GPS** — one-tap capture of the device's current coordinates via the
  Geolocation API. Denial, timeout, and unsupported-browser states are all
  surfaced in the UI; GPS is optional. Coordinates are stored at full
  precision but **displayed masked by default** (see below).
- **Edit / delete** — trips can be edited (form is re-populated, photos and
  coordinates included) or deleted with a confirmation prompt.

## Where data lives

Trips are stored in `window.localStorage` under the key
`fishfinder.logbook.trips.v1` as a JSON array. Nothing leaves the device.

Implications:

- Clearing site data / browser storage deletes all trips. An export/import
  feature is the natural next step before relying on it for long-term records.
- localStorage is capped (~5 MB in most browsers). Photos are the main risk.
  If a save exceeds the quota, the UI shows a storage warning instead of
  failing silently.
- Data is per-browser and per-device; there is no sync yet.

## GPS and privacy

`navigator.geolocation.getCurrentPosition` is called only when the user taps
"Use current location" — no background or automatic location access. The
browser prompts for permission on first use.

Coordinates are stored in localStorage at full precision (~1 m), so the data
is there if you need it for map links or later export. However, they are
**never shown at full precision on screen by default**:

- Trip cards show coordinates at 2 decimal places (~1 km) with an
  "(approximate)" label.
- In the form, tapping the coordinate text reveals the exact value; tapping
  again hides it. This keeps precise spots out of casual screenshots and
  shoulder-surfing while keeping the data accessible to you.

Coordinates are user data, not app secrets — they are never sent to any
server in the current local-first build, and when Supabase sync is wired up
the `logbook_trips` RLS policies keep rows visible only to their owner.

## Supabase sync path (planned)

The UI is intentionally local-first; the schema for a later sync backend is in
`db/logbook_trips.sql`:

- `logbook_trips` — one row per trip, owned by `auth.users` via `user_id`.
- `logbook_trip_photos` — one row per photo, referencing its trip.
- Row Level Security policies restrict every row to its owner.
- Photos should move to a private `logbook-photos` storage bucket; the
  `photo_url` column is a fallback for hosted URLs, not for data URLs.

To apply: open the Supabase SQL editor and run `db/logbook_trips.sql`. The
script is additive (uses `if not exists` / `drop ... if exists`), so it is safe
to re-run and does not touch existing tables.

## Integration notes

- `src/app/page.tsx` renders `<LogbookTab />` for the `log` tab. Everything
  else in the page is untouched.
- The map-popup `CatchLogger` (`src/components/logbook/CatchLogger.tsx`) and
  the `/api/catches` route keep working exactly as before; the trip journal is
  a separate, additive feature.
