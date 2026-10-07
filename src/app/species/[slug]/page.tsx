import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicSeoPage, publicSeoStyles as styles } from '@/components/PublicSeoPage'
import { findPublicSpecies } from '@/lib/publicCatalog'
import { SPECIES } from '@/lib/speciesCatalog'

export const dynamicParams = false

type SpeciesPageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return SPECIES.map(({ id }) => ({ slug: id }))
}

export async function generateMetadata({ params }: SpeciesPageProps): Promise<Metadata> {
  const { slug } = await params
  const species = findPublicSpecies(slug)
  if (!species) return { title: 'Species not found', robots: { index: false, follow: false } }

  return {
    title: `${species.name} Fishing Guide`,
    description: `${species.name} (${species.scientificName}) habitat, season, bait, and general fishing guidance.`,
    alternates: { canonical: `/species/${species.id}` },
  }
}

export default async function SpeciesDetailPage({ params }: SpeciesPageProps) {
  const { slug } = await params
  const species = findPublicSpecies(slug)
  if (!species) notFound()

  return (
    <PublicSeoPage
      category="Species"
      title={species.name}
      description={`${species.scientificName} · ${species.habitat} · Oklahoma catalog species.`}
    >
      <div className={styles.detail}>
        <section className={styles.detailSection}>
          <h2>Species profile</h2>
          <ul>
            <li>Scientific name: <i>{species.scientificName}</i></li>
            <li>Habitat category: {species.habitat}</li>
            <li>Species group: {species.group}</li>
            <li>General depth guidance: {species.depth}</li>
            <li>General best-time guidance: {species.bestTime}</li>
          </ul>
        </section>
        <section className={styles.detailSection}>
          <h2>Habitat and approach</h2>
          <p>{species.habitatNotes}</p>
          <p>{species.tips}</p>
        </section>
        <section className={styles.detailSection}>
          <h2>Seasonal guide</h2>
          <p>Catalog seasons: {species.season.join(', ')}.</p>
          <p>Suggested baits: {species.bestBait.join(', ')}.</p>
        </section>
        <p className={styles.source}>
          Source: Oklahoma SeamCast species catalog. This is general guide
          information, not a live sighting, current environmental measurement,
          verified catch report, or substitute for official fishing regulations.
        </p>
      </div>
    </PublicSeoPage>
  )
}
