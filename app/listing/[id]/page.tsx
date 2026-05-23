import { notFound, permanentRedirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{ id: string }>;
}

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

export default async function ListingRedirectPage({ params }: PageProps) {
  const { id } = await params;

  const { data: l } = await supabase
    .from('listings')
    .select('name, businesses(username, areas(slug))')
    .eq('id', id)
    .single();

  const item = l as any;
  const biz = item?.businesses;
  const area = biz?.areas;

  if (!item || !biz || !area) {
    notFound();
  }

  const areaSlug = (Array.isArray(area) ? area[0]?.slug : area?.slug) || '';
  const username = (Array.isArray(biz) ? biz[0]?.username : biz?.username) || 'shop';
  const prodSlug = generateSlug(item.name);

  permanentRedirect(`/${username}-${prodSlug}-in-${areaSlug}`);
}
