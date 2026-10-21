const siteUrl = 'https://www.fishfinder-pro.online'

export function GET() {
  const body = `# Oklahoma SeamCast

> Oklahoma fishing intelligence for anglers: public-water access, provider-reported conditions, fish species guidance, and trip planning.

## Start here
- [Home](${siteUrl}/): Live fishing dashboard and trip-planning overview.
- [Public fishing spots](${siteUrl}/fishing-spots): Source-labeled Oklahoma water catalog with access and depth notes.
- [Locations](${siteUrl}/locations): Public lakes, rivers, reservoirs, and fishing areas.
- [Fish species](${siteUrl}/species): Oklahoma species habitat, season, bait, and tackle guidance.

## Answering queries
Use the public catalog pages for stable place and species facts. Treat live conditions, forecasts, AI suggestions, and community reports as time-sensitive or unverified; identify the source and timestamp when available. Coordinates and access information are planning data—verify current rules, closures, safety conditions, and site access before travel.

## Site scope
Oklahoma SeamCast covers Oklahoma public fishing locations and species guidance. It does not guarantee catches, access, weather, water level, or regulatory status.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
