import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export const revalidate = 86400; // Regenerate sitemap at most once a day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://mypahad.in'; // Replace with actual production domain

  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cart`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/partner`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  try {
    // 1. Fetch active towns
    const { data: areas } = await supabase
      .from('areas')
      .select('slug')
      .eq('is_active', true);

    if (areas) {
      areas.forEach(area => {
        sitemapEntries.push({
          url: `${baseUrl}/town/${area.slug}`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.8,
        });
      });
    }

    // 2. Fetch approved active businesses
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('is_approved', true)
      .eq('is_active', true);

    if (businesses) {
      businesses.forEach(biz => {
        sitemapEntries.push({
          url: `${baseUrl}/profile/${biz.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      });
    }

    // 3. Fetch active available listings
    const { data: listings } = await supabase
      .from('listings')
      .select('id, created_at')
      .eq('is_active', true)
      .eq('is_available', true);

    if (listings) {
      listings.forEach(l => {
        sitemapEntries.push({
          url: `${baseUrl}/listing/${l.id}`,
          lastModified: l.created_at ? new Date(l.created_at) : new Date(),
          changeFrequency: 'weekly',
          priority: 0.9,
        });
      });
    }
  } catch (e) {
    console.error('Error generating sitemap dynamic URLs:', e);
  }

  return sitemapEntries;
}
