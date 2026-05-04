import { supabase } from '@/lib/supabase'
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://mypahad.in'

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/businesses`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ]

  // All businesses
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id,username,updated_at')
    .eq('is_approved', true)
    .eq('is_active', true)

  const bizRoutes: MetadataRoute.Sitemap = (businesses || []).map((b: any) => ({
    url: `${base}/businesses/${b.username || b.id}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // All listings
  const { data: listings } = await supabase
    .from('listings')
    .select('id,updated_at')
    .eq('is_available', true)

  const listingRoutes: MetadataRoute.Sitemap = (listings || []).map((l: any) => ({
    url: `${base}/products/${l.id}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...bizRoutes, ...listingRoutes]
}
