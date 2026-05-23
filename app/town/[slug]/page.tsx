import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import TownFeed from '@/components/TownFeed';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const { data: area } = await supabase
    .from('areas')
    .select('name, district, state')
    .eq('slug', slug)
    .single();

  if (!area) {
    return {
      title: 'Town Not Found | MyPahad',
    };
  }

  return {
    title: `Local Shops & Products in ${area.name} | MyPahad`,
    description: `Explore local businesses, shops, services, and products in ${area.name}, ${area.district}, ${area.state}. Buy locally through WhatsApp. Apne Pahad ka Bazaar.`,
    openGraph: {
      title: `Local Shops & Products in ${area.name} | MyPahad`,
      description: `Explore local businesses, shops, services, and products in ${area.name}, ${area.district}, ${area.state}.`,
    }
  };
}

export default async function TownPage({ params }: PageProps) {
  const { slug } = await params;

  // 1. Get town area details
  const { data: area } = await supabase
    .from('areas')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!area) {
    notFound();
  }

  // 2. Fetch stories (active & approved businesses in the area)
  const { data: stories } = await supabase
    .from('businesses')
    .select('id, business_name, dp_url')
    .eq('area_id', area.id)
    .eq('is_approved', true)
    .eq('is_active', true)
    .order('hearts', { ascending: false })
    .limit(20);

  // 3. Fetch active Ads
  const now = new Date().toISOString();
  const { data: ads } = await supabase
    .from('ads')
    .select('*')
    .eq('area_id', area.id)
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now);

  // 4. Fetch initial categories using the DB RPC
  const { data: categories } = await supabase.rpc('get_area_categories', {
    p_area_id: area.id,
    p_listing_type: null
  });

  const filteredCategories = (categories || []).filter((c: any) => c.id && c.name);

  return (
    <TownFeed 
      area={area} 
      initialStories={stories || []} 
      initialAds={ads || []} 
      initialCategories={filteredCategories} 
    />
  );
}
