import { notFound, redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function UsernameRedirectPage({ params }: PageProps) {
  const { username } = await params;

  // Clean the username parameter (remove leading '@' if present, decode URI)
  const decodedUsername = decodeURIComponent(username);
  const usernameClean = decodedUsername.startsWith('@') 
    ? decodedUsername.substring(1).toLowerCase() 
    : decodedUsername.toLowerCase();

  // Query database for business with this username
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, areas(id, name, slug, state, district, is_active)')
    .eq('username', usernameClean)
    .single();

  if (!biz) {
    notFound();
  }

  // Pre-save the business open state and area (if we can, but since this is server-side, 
  // we just redirect to the profile page which will handle localStorage saving on client mount)
  redirect(`/profile/${biz.id}`);
}
