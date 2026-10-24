import type { Metadata } from 'next'
import Link from 'next/link'
import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { spotSlug, catalogSourceLabel } from '@/lib/publicSeo'

export const metadata: Metadata = {
  title: 'Oklahoma Public Fishing Spots',
  description: 'Browse 68 Oklahoma public fishing waters with access notes, region, coordinates, and source-labeled depth metadata.',
  alternates: { canonical: '/fishing-spots' },
  openGraph: {
    title: 'Oklahoma Public Fishing Spots',
    description: 'Browse source-labeled public fishing waters across Oklahoma.',
    url: '/fishing-spots',
    type: 'website',
  },
}

function matchesQuery(spot: (typeof DEFAULT_SPOTS)[number], query: string) {
  const haystack = [spot.name, spot.region, spot.spot_type, spot.access_type, spot.description, spot.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

export default async function FishingSpotsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string | string[] }>
}) {
  const { query: rawQuery } = await searchParams
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().slice(0, 100) ?? ''
  const spots = query ? DEFAULT_SPOTS.filter((spot) => matchesQuery(spot, query)) : DEFAULT_SPOTS
  return (
    <main className="seo-page">
      <header className="seo-page__header">
        <p className="seo-page__eyebrow">Oklahoma SeamCast directory</p>
        <h1>Oklahoma Public Fishing Spots</h1>
        <p>Explore 68 cataloged public waters with access notes, region, coordinates, and clearly labeled depth provenance. Catalog details are not live measurements; verify access, regulations, closures, and water conditions before traveling.</p>
        <Link className="seo-page__back" href="/">Open the live fishing dashboard →</Link>
      </header>
      <section aria-labelledby="spot-directory-heading">
        <h2 id="spot-directory-heading">Public waters by location</h2>
        <form action="/fishing-spots" method="get" role="search" aria-label="Filter public fishing spots">
          <label htmlFor="spot-query">Search by name, region, water type, access, or description</label>
          <input
            id="spot-query"
            name="query"
            type="search"
            defaultValue={query}
            maxLength={100}
          />
          <button type="submit">Search</button>
          {query ? <Link href="/fishing-spots">Clear search</Link> : null}
        </form>
        <p>Showing {spots.length} of {DEFAULT_SPOTS.length} public waters.</p>
        <div className="seo-card-grid">
          {spots.length === 0 ? <p>No public waters match “{query}”.</p> : null}
          {spots.map((spot) => (
            <article className="seo-card" key={spot.id}>
              <h3><Link href={`/fishing-spots/${spotSlug(spot)}`}>{spot.name}</Link></h3>
              <p>{spot.region} · {spot.spot_type} · {spot.access_type}</p>
              <p>{spot.description ?? spot.notes}</p>
            </article>
          ))}
        </div>
      </section>
      <p className="seo-page__source">Source: {catalogSourceLabel}. The catalog is a planning reference, not a guarantee of access, fish presence, depth, or current conditions.</p>
    </main>
  )
}
