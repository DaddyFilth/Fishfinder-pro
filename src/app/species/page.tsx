import type { Metadata } from 'next'
import Link from 'next/link'
import { SPECIES } from '@/lib/speciesCatalog'
import { speciesSlug, speciesSourceLabel } from '@/lib/publicSeo'

export const metadata: Metadata = {
  title: 'Oklahoma Fish Species Guide',
  description: 'Browse Oklahoma fish species reference pages with habitat, season, bait, depth, and source-labeled fishing guidance.',
  alternates: { canonical: '/species' },
  openGraph: {
    title: 'Oklahoma Fish Species Guide',
    description: 'Browse source-labeled Oklahoma fish species reference pages.',
    url: '/species',
    type: 'website',
  },
}

export default function SpeciesIndexPage() {
  return (
    <main className="seo-page">
      <header className="seo-page__header">
        <p className="seo-page__eyebrow">Oklahoma SeamCast reference guide</p>
        <h1>Oklahoma Fish Species Guide</h1>
        <p>Browse reference pages for species recorded in the Oklahoma catalog. Habitat, bait, depth, and seasonal guidance are general reference information—not live predictions or a substitute for current regulations.</p>
        <Link className="seo-page__back" href="/">Open the live fishing dashboard →</Link>
      </header>
      <section aria-labelledby="species-directory-heading">
        <h2 id="species-directory-heading">Species in the Oklahoma catalog</h2>
        <div className="seo-card-grid">
          {SPECIES.map((species) => (
            <article className="seo-card" key={species.id}>
              <h3><Link href={`/species/${speciesSlug(species)}`}>{species.name}</Link></h3>
              <p>{species.group} · {species.oklahomaStatus}</p>
              <p>{species.habitatNotes}</p>
            </article>
          ))}
        </div>
      </section>
      <p className="seo-page__source">Source: {speciesSourceLabel}. Guidance is catalog reference content; conditions, regulations, access, and fish activity can change.</p>
    </main>
  )
}
