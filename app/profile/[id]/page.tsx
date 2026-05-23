import { notFound, permanentRedirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfileRedirectPage({ params }: PageProps) {
  const { id } = await params;

  const { data: biz } = await supabase
    .from('businesses')
    .select('username, areas(slug)')
    .eq('id', id)
    .single();

  const item = biz as any;
  const area = item?.areas;

  if (!item || !area) {
    notFound();
  }

  const areaSlug = (Array.isArray(area) ? area[0]?.slug : area?.slug) || '';
  const username = item.username || 'shop';

  permanentRedirect(`/${username}-in-${areaSlug}`);
}
