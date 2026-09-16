import type { MetadataRoute } from 'next'
const base = 'https://fishfinder-pro.online'
export default function sitemap(): MetadataRoute.Sitemap {
  const species = ['atlantic-tarpon','black-crappie','blue-catfish','bluefish','bluegill','bowfin','brown-trout','channel-catfish','chinook-salmon','cobia','common-carp','common-snook','crappie','flathead-catfish','flounder','hybrid-striper','largemouth-bass','longnose-gar','muskellunge','northern-pike','other','rainbow-trout','red-drum','redear-sunfish','redfish-red-drum','sauger','smallmouth-bass','southern-flounder','spotted-bass','steelhead','striped-bass','walleye','white-bass','white-crappie','yellow-perch']
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...species.map((s) => ({ url: base + '/species/' + s, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 })),
  ]
}
