import { supabase } from './supabase';

export interface Area {
  id: string;
  name: string;
  slug: string;
  state: string;
  district: string;
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Listing {
  id: string;
  name: string;
  price: string | null;
  discount_price: string | null;
  image_url: string | null;
  listing_type: string | null;
  business_id: string;
  qty_label: string | null;
  ad_id?: string;
  businesses?: {
    business_name: string;
  };
}

export async function getAreaCategories(areaId: string, areaSlug: string, listingType: string | null): Promise<Category[]> {
  const { data, error } = await supabase.rpc('get_area_categories', {
    p_area_id: areaId,
    p_listing_type: listingType,
  });
  if (error) {
    console.error('Error fetching area categories:', error);
    return [];
  }
  return (data || []).filter((c: any) => c.id && c.name);
}

export async function getRandomizedListings(
  areaId: string,
  areaSlug: string,
  listingType: string | null,
  categoryId: string,
  seed: string,
  limit: number,
  offset: number
): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_randomized_listings', {
    p_area_id: areaId,
    p_listing_type: listingType,
    p_category_id: categoryId,
    p_seed: seed || 'default_seed',
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.error('Error calling get_randomized_listings RPC:', error);
    return [];
  }
  return data || [];
}

// URL Builders
export function getBusinessLink(username: string | null | undefined, areaSlug: string): string {
  const u = username || 'shop';
  if (areaSlug === 'all') {
    return `/${u}`;
  }
  return `/${u}-in-${areaSlug}`;
}

export function getListingLink(username: string | null | undefined, prodSlug: string, areaSlug: string): string {
  const u = username || 'shop';
  if (areaSlug === 'all') {
    return `/${u}-${prodSlug}`;
  }
  return `/${u}-${prodSlug}-in-${areaSlug}`;
}

export function getPostLink(username: string | null | undefined, postSlug: string, areaSlug: string): string {
  const u = username || 'shop';
  if (areaSlug === 'all') {
    return `/${u}-post-${postSlug}`;
  }
  return `/${u}-post-${postSlug}-in-${areaSlug}`;
}

export function getCategoryLink(categorySlug: string, areaSlug: string): string {
  if (areaSlug === 'all') {
    return `/${categorySlug}`;
  }
  return `/${categorySlug}-in-${areaSlug}`;
}
