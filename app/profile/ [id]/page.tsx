import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import ProfileDetail from '@/components/ProfileDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  const { data: biz } = await supabase
    .from('businesses')
    .select('*, areas(name)')
    .eq('id', id)
    .single();

  if (!biz) {
    return {
      title: 'Business Profile Not Found | MyPahad',
    };
  }

  const townName = biz.areas?.name || '';
  const cleanDescription = biz.description 
    ? biz.description.substring(0, 160) 
    : `Shop local products & services from ${biz.business_name} in ${townName}.`;

  return {
    title: `${biz.business_name} in ${townName} | MyPahad`,
    description: cleanDescription,
    openGraph: {
      title: `${biz.business_name} in ${townName} | MyPahad`,
      description: cleanDescription,
      images: biz.dp_url ? [biz.dp_url] : [],
    }
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params;

  // 1. Fetch business details
  const { data: biz } = await supabase
    .from('businesses')
    .select('*, areas(name, slug), categories(name)')
    .eq('id', id)
    .single();

  if (!biz) {
    notFound();
  }

  // 2. Fetch business photos (stories)
  const { data: photos } = await supabase
    .from('business_photos')
    .select('*')
    .eq('business_id', id)
    .order('sort_order');

  // 3. Fetch first page of listings (limit 9)
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('business_id', id)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .range(0, 8);

  // 4. Check if visitor already hearted this business
  // Since server component cannot access client local storage 'mp_sid', we default to false on the server side
  // and handle checking the actual heart state on the client side using useEffect if necessary,
  // but to keep it simple, we pass false and let the client component load and manage the toggle state.
  const hasHearted = false;

  return (
    <ProfileDetail 
      business={biz} 
      photos={photos || []} 
      initialListings={listings || []} 
      initialHearts={hasHearted} 
    />
  );
}
