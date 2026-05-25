import { notFound, permanentRedirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PostRedirectPage({ params }: PageProps) {
  const { id } = await params;

  const { data: p } = await supabase
    .from('posts')
    .select('slug, title, businesses(username, areas(slug))')
    .eq('id', id)
    .single();

  const post = p as any;
  const biz = post?.businesses;
  const area = biz?.areas;

  if (!post || !biz || !area) {
    notFound();
  }

  const areaSlug = (Array.isArray(area) ? area[0]?.slug : area?.slug) || '';
  const username = (Array.isArray(biz) ? biz[0]?.username : biz?.username) || 'shop';
  const postSlug = post.slug || post.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  permanentRedirect(`/${username}-post-${postSlug}-in-${areaSlug}`);
}
