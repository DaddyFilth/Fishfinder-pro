import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSeoPage, publicSeoStyles as styles } from '@/components/PublicSeoPage'
import { PUBLIC_LOCATIONS } from '@/lib/publicCatalog'

export const metadata: Metadata = {
  title: 'Oklahoma Public Fishing Locations',
  description: 'Browse Oklahoma public-water fishing locations with catalog descriptions, access notes, and map-pin coordinates.',
  alternates: { canonical: '/locations' },
}

export default function LocationsPage() {
  return (
    <PublicSeoPage
      category="Locations"
      title="Oklahoma public fishing locations"
      description="Browse public lakes, rivers, reservoirs, and fishing areas in the Oklahoma SeamCast location catalog."
    >
      <p className={styles.source}>
        Source: Bundled Oklahoma public-water catalog. Entries are catalog pins,
        not live access reports; confirm current access and rules with the
        managing agency before traveling.
      </p>
      <section className={styles.grid} aria-label="Oklahoma fishing locations">
        {PUBLIC_LOCATIONS.map((location) => (
          <Link className={styles.card} href={`/locations/${location.slug}`} key={location.slug}>
            <h2>{location.name}</h2>
            <p>{location.region ?? 'Oklahoma'} · {location.spot_type}</p>
            <p>{location.notes ?? location.description ?? 'Public-water catalog entry.'}</p>
          </Link>
        ))}
      </section>
    </PublicSeoPage>
  )
}
