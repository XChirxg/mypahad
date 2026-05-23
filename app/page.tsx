import { supabase } from '@/lib/supabase';
import TownSelector from '@/components/TownSelector';

export const revalidate = 3600; // Cache landing page and static links for 1 hour

export default async function Home() {
  const { data: areas } = await supabase
    .from('areas')
    .select('id, name, slug, state, district, is_active')
    .eq('is_active', true)
    .order('state')
    .order('district')
    .order('name');

  return (
    <TownSelector initialAreas={areas || []} />
  );
}
