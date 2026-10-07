import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findSpeciesBySlug, publicSpeciesSlugs, speciesSlug, speciesSourceLabel } from '@/lib/publicSeo'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return publicSpeciesSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const species = findSpeciesBySlug(slug)
  if (!species) return { title: 'Species not found' }
  const description = `${species.name} Oklahoma fishing reference: habitat, season, bait, depth, and technique guidance. Catalog reference only; verify current regulations and conditions.`
  return {
    title: `${species.name} Fishing Guide`,
    description,
    alternates: { canonical: `/species/${speciesSlug(species)}` },
    openGraph: { title: `${species.name} Fishing Guide`, description, url: `/species/${speciesSlug(species)}`, type: 'article' },
  }
}

export default async function SpeciesPage({ params }: PageProps) {
  const { slug } = await params
  const species = findSpeciesBySlug(slug)
  if (!species) notFound()
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${species.name} Fishing Guide`,
    description: species.tips,
    about: { '@type': 'Thing', name: species.name },
    url: `https://www.fishfinder-pro.online/species/${speciesSlug(species)}`,
  }
  return (
    <main className="seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <p className="seo-page__eyebrow"><Link href="/species">Oklahoma fish species guide</Link> / {species.group}</p>
      <h1>{species.name} Fishing Guide</h1>
      <p className="seo-page__lead">{species.tips}</p>
      <div className="seo-detail-grid">
        <section className="seo-panel"><h2>Reference profile</h2><dl><div><dt>Scientific name</dt><dd><em>{species.scientificName}</em></dd></div><div><dt>Oklahoma status</dt><dd>{species.oklahomaStatus}</dd></div><div><dt>Habitat</dt><dd>{species.habitatNotes}</dd></div><div><dt>Best time</dt><dd>{species.bestTime}</dd></div></dl></section>
        <section className="seo-panel"><h2>Bait and depth</h2><p><strong>Reference baits:</strong> {species.bestBait.join(', ')}</p><p><strong>Reference depth:</strong> {species.depth}</p><p><strong>Season:</strong> {species.season.join(', ')}</p></section>
      </div>
      <section className="seo-panel"><h2>Technique guidance</h2><p>{species.advice.techniqueWarm}</p><p><strong>Warm-water depth:</strong> {species.advice.depthWarm}</p><p><strong>Cool-water depth:</strong> {species.advice.depthCold}</p></section>
      <p className="seo-page__source">Source: {speciesSourceLabel}. This is reference guidance, not a live prediction or a substitute for current Oklahoma regulations, advisories, or access rules. <Link href="/">Open the dashboard for provider-reported conditions →</Link></p>
    </main>
  )
}
