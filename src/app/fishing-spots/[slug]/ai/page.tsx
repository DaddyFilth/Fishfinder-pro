import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SpotMiniDashboard from '@/components/SpotMiniDashboard'
import { findSpotBySlug, publicSpotSlugs, spotSlug } from '@/lib/publicSeo'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return publicSpotSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const spot = findSpotBySlug(slug)
  if (!spot) return { title: 'Spot intelligence not found' }
  return {
    title: `${spot.name} Fishing Intelligence`,
    description: `Spot-specific fishing predictions, habitat context, bait guidance, bite windows, and target depth for ${spot.name}. Provider data and model estimates are labeled separately.`,
    alternates: { canonical: `/fishing-spots/${spotSlug(spot)}/ai` },
  }
}

export default async function SpotAiPage({ params }: PageProps) {
  const { slug } = await params
  const spot = findSpotBySlug(slug)
  if (!spot) notFound()
  return (
    <main className="seo-page">
      <p className="seo-page__eyebrow"><Link href={`/fishing-spots/${spotSlug(spot)}`}>← {spot.name} access page</Link></p>
      <h1>{spot.name} Fishing Intelligence</h1>
      <p className="seo-page__lead">A separate spot-scoped dashboard for provider conditions and AI analysis. The dashboard is keyed to this canonical spot ID so another water’s conditions or prediction cannot be displayed here.</p>
      <SpotMiniDashboard spot={spot} />
      <p className="seo-page__source">Habitat and behavior guidance is grounded in the Oklahoma freshwater species catalog. Predictions are estimates, not live guarantees or catch reports.</p>
    </main>
  )
}
