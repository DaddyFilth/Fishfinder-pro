import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicSeoPage, publicSeoStyles as styles } from '@/components/PublicSeoPage'
import { findPublicLocation, PUBLIC_LOCATIONS } from '@/lib/publicCatalog'

export const dynamicParams = false

export function generateStaticParams() {
  return PUBLIC_LOCATIONS.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<'/locations/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const location = findPublicLocation(slug)
  if (!location) return { title: 'Location not found', robots: { index: false, follow: false } }

  return {
    title: `${location.name} Fishing Location`,
    description: `${location.name}: ${location.notes ?? location.description ?? 'Oklahoma public-water fishing location.'}`,
    alternates: { canonical: `/locations/${location.slug}` },
  }
}

export default async function LocationPage({ params }: PageProps<'/locations/[slug]'>) {
  const { slug } = await params
  const location = findPublicLocation(slug)
  if (!location) notFound()

  return (
    <PublicSeoPage
      category="Locations"
      title={location.name}
      description={`${location.region ?? 'Oklahoma'} public-water location · ${location.spot_type}.`}
    >
      <div className={styles.detail}>
        <section className={styles.detailSection}>
          <h2>Location details</h2>
          <ul>
            <li>Region: {location.region ?? 'Oklahoma'}</li>
            <li>Water: {location.water_type}</li>
            <li>Location type: {location.spot_type}</li>
            {location.access_type && <li>Catalog access note: {location.access_type}</li>}
            <li>Map-pin coordinates: {location.lat}, {location.lng}</li>
          </ul>
        </section>
        <section className={styles.detailSection}>
          <h2>Catalog notes</h2>
          <p>{location.notes ?? location.description ?? 'No additional catalog notes are available.'}</p>
        </section>
        <p className={styles.source}>
          Source: {location.source ?? 'Bundled Oklahoma public-water catalog'}.
          These catalog details are not live access or environmental measurements.
          Verify current access, permits, closures, and regulations with the
          managing agency before traveling.
        </p>
      </div>
    </PublicSeoPage>
  )
}
