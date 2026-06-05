import { supabase } from '@/lib/supabase';
import TownFeed from '@/components/TownFeed';
import { getAreaCategories } from '@/lib/dbHelpers';

export const revalidate = 3600; // Cache landing page and static links for 1 hour

export default async function Home() {
  // 1. Fetch the "All" area
  const { data: area } = await supabase
    .from('areas')
    .select('*')
    .eq('slug', 'all')
    .eq('is_active', true)
    .single();

  if (!area) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white text-center font-sans">
        <p className="text-sm text-gray-500">Service temporarily unavailable. Please try again later.</p>
      </div>
    );
  }

  // 2. Fetch categories for "all" area
  const categories = await getAreaCategories(area.id, area.slug, null);

  // 3. Fetch active ads for "all" area
  const now = new Date().toISOString();
  const { data: ads } = await supabase
    .from('ads')
    .select('*')
    .eq('area_id', area.id)
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now);

  // 4. Fetch other active areas (excluding 'all') for the selector
  const { data: otherAreas } = await supabase
    .from('areas')
    .select('id, name, slug, state, district, is_active')
    .eq('is_active', true)
    .neq('slug', 'all')
    .order('name');

  // 5. Fetch stories (active & approved businesses from 'all' area)
  const { data: stories } = await supabase
    .from('businesses')
    .select('id, business_name, dp_url, username')
    .eq('area_id', area.id)
    .eq('is_approved', true)
    .eq('is_active', true)
    .order('hearts', { ascending: false })
    .limit(20);

  return (
    <TownFeed
      area={area}
      initialStories={stories || []}
      initialAds={ads || []}
      initialCategories={categories || []}
      allAreas={otherAreas || []}
    />
  );
}

