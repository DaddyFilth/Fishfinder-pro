import { notFound, permanentRedirect } from 'next/navigation'
import { findSpotBySlug, publicSpotSlugs } from '@/lib/publicSeo'

export const dynamicParams = false

type LocationPageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return publicSpotSlugs.map((slug) => ({ slug }))
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { slug } = await params
  const spot = findSpotBySlug(slug)
  if (!spot) notFound()

  permanentRedirect(`/fishing-spots/${spot.slug}`)
}
