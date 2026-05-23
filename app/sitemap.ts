import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export const revalidate = 86400; // Regenerate sitemap at most once a day

function generateSlug(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

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
    // 1. Fetch active towns (areas)
    const { data: areas } = await supabase
      .from('areas')
      .select('slug')
      .eq('is_active', true);

    if (areas) {
      areas.forEach(area => {
        sitemapEntries.push({
          url: `${baseUrl}/${area.slug}`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.8,
        });
      });
    }

    // 2. Fetch approved active businesses
    const { data: businesses } = await supabase
      .from('businesses')
      .select('username, areas(slug)')
      .eq('is_approved', true)
      .eq('is_active', true);

    if (businesses) {
      businesses.forEach(b => {
        const biz = b as any;
        const area = biz?.areas;
        const areaSlug = (Array.isArray(area) ? area[0]?.slug : area?.slug) || '';
        const username = biz.username || 'shop';
        if (areaSlug) {
          sitemapEntries.push({
            url: `${baseUrl}/${username}-in-${areaSlug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      });
    }

    // 3. Fetch active available listings
    const { data: listings } = await supabase
      .from('listings')
      .select('name, created_at, businesses(username, areas(slug))')
      .eq('is_active', true)
      .eq('is_available', true);

    if (listings) {
      listings.forEach(l => {
        const item = l as any;
        const biz = item?.businesses;
        const area = biz?.areas;
        const areaSlug = (Array.isArray(area) ? area[0]?.slug : area?.slug) || '';
        const username = (Array.isArray(biz) ? biz[0]?.username : biz?.username) || 'shop';
        if (areaSlug) {
          const prodSlug = generateSlug(item.name);
          sitemapEntries.push({
            url: `${baseUrl}/${username}-${prodSlug}-in-${areaSlug}`,
            lastModified: item.created_at ? new Date(item.created_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
          });
        }
      });
    }
  } catch (e) {
    console.error('Error generating sitemap dynamic URLs:', e);
  }

  return sitemapEntries;
}
