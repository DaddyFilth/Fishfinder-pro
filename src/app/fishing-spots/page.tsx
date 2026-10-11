import type { Metadata } from 'next'
import Link from 'next/link'
import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { spotSlug, catalogSourceLabel } from '@/lib/publicSeo'

export const metadata: Metadata = {
  title: 'Oklahoma Public Fishing Spots',
  description: 'Browse 76 Oklahoma public fishing waters with access notes, region, coordinates, and source-labeled depth metadata.',
  alternates: { canonical: '/fishing-spots' },
  openGraph: {
    title: 'Oklahoma Public Fishing Spots',
    description: 'Browse source-labeled public fishing waters across Oklahoma.',
    url: '/fishing-spots',
    type: 'website',
  },
}

export default function FishingSpotsIndexPage() {
  return (
    <main className="seo-page">
      <header className="seo-page__header">
        <p className="seo-page__eyebrow">Oklahoma SeamCast directory</p>
        <h1>Oklahoma Public Fishing Spots</h1>
        <p>Explore 76 cataloged public waters with access notes, region, coordinates, and clearly labeled depth provenance. Catalog details are not live measurements; verify access, regulations, closures, and water conditions before traveling.</p>
        <Link className="seo-page__back" href="/">Open the live fishing dashboard →</Link>
      </header>
      <section aria-labelledby="spot-directory-heading">
        <h2 id="spot-directory-heading">Public waters by location</h2>
        <div className="seo-card-grid">
          {DEFAULT_SPOTS.map((spot) => (
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
