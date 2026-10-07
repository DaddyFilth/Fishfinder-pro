import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSeoPage, publicSeoStyles as styles } from '@/components/PublicSeoPage'
import { SPECIES } from '@/lib/speciesCatalog'

export const metadata: Metadata = {
  title: 'Oklahoma Fish Species Guide',
  description: 'Browse Oklahoma fish species in the SeamCast catalog, including habitat, seasonal guidance, and general tackle notes.',
  alternates: { canonical: '/species' },
}

export default function SpeciesPage() {
  return (
    <PublicSeoPage
      category="Species"
      title="Oklahoma fish species guide"
      description="Explore the fish species represented in the Oklahoma SeamCast catalog, with general habitat and fishing guidance."
    >
      <p className={styles.source}>
        Source: Oklahoma SeamCast species catalog. Species profiles are
        general guide information, not live sightings, current conditions, or
        official regulation guidance.
      </p>
      <section className={styles.grid} aria-label="Fish species">
        {SPECIES.map((species) => (
          <Link className={styles.card} href={`/species/${species.id}`} key={species.id}>
            <h2>{species.name}</h2>
            <p><i>{species.scientificName}</i> · {species.habitat}</p>
            <p>{species.habitatNotes}</p>
          </Link>
        ))}
      </section>
    </PublicSeoPage>
  )
}
