import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SpotMiniDashboard from '@/components/SpotMiniDashboard'
import { catalogSourceLabel, catalogSourceUrl, findSpotBySlug, publicSpotSlugs, spotSlug } from '@/lib/publicSeo'

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return publicSpotSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const spot = findSpotBySlug(slug)
  if (!spot) return { title: 'Fishing spot not found' }
  const description = `${spot.name} in Oklahoma: ${spot.spot_type}, ${spot.access_type}, ${spot.region} region. Source-labeled catalog access and depth notes; verify current conditions before travel.`
  return {
    title: `${spot.name} Fishing Access`,
    description,
    alternates: { canonical: `/fishing-spots/${spotSlug(spot)}` },
    openGraph: { title: `${spot.name} Fishing Access`, description, url: `/fishing-spots/${spotSlug(spot)}`, type: 'article' },
  }
}

export default async function FishingSpotPage({ params }: PageProps) {
  const { slug } = await params
  const spot = findSpotBySlug(slug)
  if (!spot) notFound()
  const description = spot.description ?? spot.notes ?? 'Public Oklahoma fishing water catalog entry.'
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: spot.name,
    description,
    geo: { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng },
    address: { '@type': 'PostalAddress', addressRegion: 'Oklahoma', addressCountry: 'US' },
    url: `https://www.fishfinder-pro.online/fishing-spots/${spotSlug(spot)}`,
  }
  return (
    <main className="seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <p className="seo-page__eyebrow"><Link href="/fishing-spots">Oklahoma public fishing spots</Link> / {spot.region}</p>
      <h1>{spot.name} Fishing Access</h1>
      <p className="seo-page__lead">{description}</p>
      <div className="seo-detail-grid">
        <section className="seo-panel"><h2>Access and location</h2><dl><div><dt>Water type</dt><dd>{spot.spot_type}</dd></div><div><dt>Access</dt><dd>{spot.access_type}</dd></div><div><dt>Region</dt><dd>{spot.region}</dd></div><div><dt>Coordinates</dt><dd>{spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}</dd></div></dl></section>
        <section className="seo-panel"><h2>Depth provenance</h2><p>{spot.depth_metadata?.note ?? 'Depth information is not available in the catalog.'}</p><p><strong>Source:</strong> {spot.depth_metadata?.source ?? catalogSourceLabel}</p>{spot.depth_metadata?.source_url && <p><a href={spot.depth_metadata.source_url} rel="noreferrer">View source documentation</a></p>}</section>
      </div>
      <section className="seo-panel"><h2>Planning note</h2><p>This page uses the {catalogSourceLabel}. It does not report a live water temperature, live depth reading, current bite score, or guaranteed fish presence. Confirm access, permits, closures, lake level, weather, and Oklahoma fishing regulations with the responsible agency before traveling.</p><p><a href={catalogSourceUrl} rel="noreferrer">Review Oklahoma bathymetry source documentation</a></p></section>
      <p><Link href={`/fishing-spots/${spotSlug(spot)}/ai`}>Open the dedicated {spot.name} AI dashboard →</Link></p>
      <SpotMiniDashboard spot={spot} />
      <p className="seo-page__source">Catalog coordinates and descriptions are source-labeled planning data. <Link href="/">Open the dashboard for provider-reported conditions →</Link></p>
    </main>
  )
}
