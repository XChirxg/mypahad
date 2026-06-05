import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import TownFeed from '@/components/TownFeed';
import ProfileDetail from '@/components/ProfileDetail';
import ListingDetail from '@/components/ListingDetail';
import CategoryDetail from '@/components/CategoryDetail';
import PostDetail from '@/components/PostDetail';
import { getAreaCategories, getRandomizedListings } from '@/lib/dbHelpers';

interface PageProps {
  params: Promise<{ slug: string }>;
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

function parsePrice(p: string | null): number {
  if (!p) return 0;
  const cleaned = String(p).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

async function resolveSlug(slug: string) {
  const decodedSlug = decodeURIComponent(slug);

  // A. Check legacy redirects
  if (decodedSlug.endsWith('-in-all')) {
    const cleanSlug = decodedSlug.substring(0, decodedSlug.length - 7);
    return {
      type: 'redirect' as const,
      destination: `/${cleanSlug}`,
    };
  }

  if (decodedSlug === 'all') {
    return {
      type: 'redirect' as const,
      destination: '/',
    };
  }

  // A. Check if the slug contains "-in-"
  if (decodedSlug.includes('-in-')) {
    const lastInIndex = decodedSlug.lastIndexOf('-in-');
    const left = decodedSlug.substring(0, lastInIndex);
    const right = decodedSlug.substring(lastInIndex + 4); // skip "-in-"

    // Query area (town) by right slug
    const { data: area } = await supabase
      .from('areas')
      .select('*')
      .eq('slug', right)
      .eq('is_active', true)
      .single();

    if (!area) return null;

    if (area.slug === 'all') {
      return {
        type: 'redirect' as const,
        destination: '/',
      };
    }

    // Check if left matches a blog post slug (e.g. zicafe-post-grand-opening)
    if (left.toLowerCase().includes('-post-')) {
      const postIndex = left.toLowerCase().indexOf('-post-');
      const bizUsername = left.substring(0, postIndex);
      const postSlug = left.substring(postIndex + 6); // skip "-post-"

      const { data: business } = await supabase
        .from('businesses')
        .select('*, areas(name, slug), categories(name)')
        .eq('username', bizUsername.toLowerCase())
        .eq('area_id', area.id)
        .eq('is_active', true)
        .single();

      if (business) {
        const { data: post } = await supabase
          .from('posts')
          .select('*')
          .eq('business_id', business.id)
          .eq('slug', postSlug.toLowerCase())
          .single();

        if (post) {
          const { data: listings } = await supabase
            .from('listings')
            .select('id, name, price, discount_price, image_url')
            .eq('business_id', business.id)
            .eq('is_available', true)
            .limit(3);

          return {
            type: 'post' as const,
            post,
            business,
            listings: listings || [],
          };
        }
      }
      return null;
    }

    // A1. Check if left matches exactly a business username in this area
    const { data: business } = await supabase
      .from('businesses')
      .select('*, areas(name, slug), categories(name)')
      .eq('username', left.toLowerCase())
      .eq('area_id', area.id)
      .eq('is_active', true)
      .single();

    if (business) {
      // Fetch photos
      const { data: photos } = await supabase
        .from('business_photos')
        .select('*')
        .eq('business_id', business.id)
        .order('sort_order');

      // Fetch listings (first 30)
      const { data: listings } = await supabase
        .from('listings')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_available', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(0, 29);

      // Fetch blog posts
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });

      return {
        type: 'profile' as const,
        business,
        photos: photos || [],
        listings: listings || [],
        posts: posts || [],
      };
    }

    // A2. Check if left matches a category slug
    const { data: category } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', left.toLowerCase())
      .single();

    if (category) {
      // Fetch initial listings in this category and area using helper
      const listings = await getRandomizedListings(
        area.id,
        area.slug,
        null,
        category.id,
        'static_seed_123',
        19,
        0
      );

      const pageListings = (listings || []).slice(0, 18);
      const hasNext = (listings || []).length > 18;

      // Fetch usernames for these businesses
      const bizIds = Array.from(new Set(pageListings.map((l: any) => l.business_id)));
      const usernames: Record<string, string> = {};
      if (bizIds.length > 0) {
        const { data: bizs } = await supabase
          .from('businesses')
          .select('id, username')
          .in('id', bizIds);
        bizs?.forEach((b) => {
          usernames[b.id] = b.username || '';
        });
      }

      return {
        type: 'category' as const,
        area,
        category,
        listings: pageListings,
        hasNext,
        usernames,
      };
    }

    // A3. Check if it's a listing: left starts with business username + dash (e.g. zicafe-pizza)
    const { data: areaBusinesses } = await supabase
      .from('businesses')
      .select('id, username, business_name, whatsapp, dp_url, area_id, category_id, latitude, longitude, delivery_charges')
      .eq('area_id', area.id)
      .eq('is_approved', true)
      .eq('is_active', true);

    if (areaBusinesses) {
      // Sort businesses by username length descending to match the longest username first
      const sortedBizs = [...areaBusinesses].sort(
        (a, b) => (b.username || '').length - (a.username || '').length
      );

      for (const biz of sortedBizs) {
        const username = (biz.username || '').toLowerCase();
        if (username && left.toLowerCase().startsWith(username + '-')) {
          const productSlug = left.substring(username.length + 1); // extract product name part

          const { data: bizListings } = await supabase
            .from('listings')
            .select('*')
            .eq('business_id', biz.id)
            .eq('is_available', true);

          if (bizListings) {
            const matchingListing = bizListings.find(
              (l) => generateSlug(l.name) === productSlug.toLowerCase()
            );

            if (matchingListing) {
              const listingWithBiz = {
                ...matchingListing,
                businesses: {
                  ...biz,
                  areas: {
                    name: area.name,
                    slug: area.slug,
                  },
                },
              };

              // Fetch related listings
              let rel: any[] = [];
              const { data: sameBizData } = await supabase
                .from('listings')
                .select('*, businesses(id, business_name, whatsapp, area_id, is_approved, is_active, category_id, latitude, longitude, delivery_charges)')
                .eq('business_id', biz.id)
                .eq('is_available', true)
                .neq('id', matchingListing.id)
                .limit(9);
              if (sameBizData) rel = sameBizData;

              const needed = 9 - rel.length;
              if (needed > 0 && biz.category_id) {
                const { data: otherBizData } = await supabase
                  .from('listings')
                  .select('*, businesses!inner(id, business_name, whatsapp, area_id, is_approved, is_active, category_id, latitude, longitude, delivery_charges)')
                  .eq('businesses.category_id', biz.category_id)
                  .neq('business_id', biz.id)
                  .eq('businesses.is_approved', true)
                  .eq('businesses.is_active', true)
                  .eq('is_available', true)
                  .neq('id', matchingListing.id)
                  .limit(needed);

                if (otherBizData) {
                  const formattedOthers = otherBizData.map((item: any) => ({
                    ...item,
                    is_other_seller: true,
                  }));
                  rel = rel.concat(formattedOthers);
                }
              }

              return {
                type: 'listing' as const,
                listing: listingWithBiz,
                relatedListings: rel,
              };
            }
          }
        }
      }
    }

    return null;
  }

  // B. Does not contain "-in-": check if it's a town slug, category, listing or is a username
  
  // B1. Check areas
  const { data: area } = await supabase
    .from('areas')
    .select('*')
    .eq('slug', decodedSlug)
    .eq('is_active', true)
    .single();

  if (area) {
    if (area.slug === 'all') {
      return {
        type: 'redirect' as const,
        destination: '/',
      };
    }

    // Fetch stories (active & approved businesses in the area)
    const { data: stories } = await supabase
      .from('businesses')
      .select('id, business_name, dp_url, username')
      .eq('area_id', area.id)
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('hearts', { ascending: false })
      .limit(20);

    // Fetch active Ads
    const now = new Date().toISOString();
    const { data: ads } = await supabase
      .from('ads')
      .select('*')
      .eq('area_id', area.id)
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now);

    // Fetch initial categories
    const categories = await getAreaCategories(area.id, area.slug, null);

    return {
      type: 'town' as const,
      area,
      stories: stories || [],
      ads: ads || [],
      categories,
    };
  }

  // B2. Check if it matches a business username directly
  const usernameClean = decodedSlug.startsWith('@')
    ? decodedSlug.substring(1).toLowerCase()
    : decodedSlug.toLowerCase();

  const { data: biz } = await supabase
    .from('businesses')
    .select('id, username, areas(id, name, slug)')
    .eq('username', usernameClean)
    .single();

  if (biz && biz.areas) {
    const areaSlug = (biz.areas as any).slug;
    if (areaSlug === 'all') {
      // Resolve it as a business profile directly!
      const { data: photos } = await supabase
        .from('business_photos')
        .select('*')
        .eq('business_id', biz.id)
        .order('sort_order');

      const { data: listings } = await supabase
        .from('listings')
        .select('*')
        .eq('business_id', biz.id)
        .eq('is_available', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(0, 29);

      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false });

      return {
        type: 'profile' as const,
        business: {
          ...biz,
          areas: biz.areas
        },
        photos: photos || [],
        listings: listings || [],
        posts: posts || [],
      };
    } else {
      return {
        type: 'redirect' as const,
        destination: `/${biz.username}-in-${areaSlug}`,
      };
    }
  }

  // B3. Check if it matches a listing or blog post for a business in the "All" area
  const { data: allAreaBusinesses } = await supabase
    .from('businesses')
    .select('id, username, business_name, whatsapp, dp_url, area_id, category_id, latitude, longitude, delivery_charges')
    .eq('area_id', 'a46763ea-4cfd-4336-aad0-e61163f5d430') // 'all' area ID
    .eq('is_approved', true)
    .eq('is_active', true);

  if (allAreaBusinesses) {
    const sortedBizs = [...allAreaBusinesses].sort(
      (a, b) => (b.username || '').length - (a.username || '').length
    );

    for (const biz of sortedBizs) {
      const username = (biz.username || '').toLowerCase();
      if (username && decodedSlug.startsWith(username + '-')) {
        const productSlug = decodedSlug.substring(username.length + 1);

        // Check for blog post (e.g. zicafe-post-grand-opening)
        if (productSlug.startsWith('post-')) {
          const postSlug = productSlug.substring(5); // skip "post-"
          const { data: post } = await supabase
            .from('posts')
            .select('*')
            .eq('business_id', biz.id)
            .eq('slug', postSlug.toLowerCase())
            .single();

          if (post) {
            const { data: listings } = await supabase
              .from('listings')
              .select('id, name, price, discount_price, image_url')
              .eq('business_id', biz.id)
              .eq('is_available', true)
              .limit(3);

            return {
              type: 'post' as const,
              post,
              business: {
                ...biz,
                areas: {
                  name: 'All',
                  slug: 'all'
                }
              },
              listings: listings || [],
            };
          }
        }

        // Check for listing
        const { data: bizListings } = await supabase
          .from('listings')
          .select('*')
          .eq('business_id', biz.id)
          .eq('is_available', true);

        if (bizListings) {
          const matchingListing = bizListings.find(
            (l) => generateSlug(l.name) === productSlug.toLowerCase()
          );

          if (matchingListing) {
            const listingWithBiz = {
              ...matchingListing,
              businesses: {
                ...biz,
                areas: {
                  name: 'All',
                  slug: 'all',
                },
              },
            };

            // Fetch related listings
            let rel: any[] = [];
            const { data: sameBizData } = await supabase
              .from('listings')
              .select('*, businesses(id, business_name, whatsapp, area_id, is_approved, is_active, category_id, latitude, longitude, delivery_charges)')
              .eq('business_id', biz.id)
              .eq('is_available', true)
              .neq('id', matchingListing.id)
              .limit(9);
            if (sameBizData) rel = sameBizData;

            const needed = 9 - rel.length;
            if (needed > 0 && biz.category_id) {
              const { data: otherBizData } = await supabase
                .from('listings')
                .select('*, businesses!inner(id, business_name, whatsapp, area_id, is_approved, is_active, category_id, latitude, longitude, delivery_charges)')
                .eq('businesses.category_id', biz.category_id)
                .neq('business_id', biz.id)
                .eq('businesses.is_approved', true)
                .eq('businesses.is_active', true)
                .eq('is_available', true)
                .neq('id', matchingListing.id)
                .limit(needed);

              if (otherBizData) {
                const formattedOthers = otherBizData.map((item: any) => ({
                  ...item,
                  is_other_seller: true,
                }));
                rel = rel.concat(formattedOthers);
              }
            }

            return {
              type: 'listing' as const,
              listing: listingWithBiz,
              relatedListings: rel,
            };
          }
        }
      }
    }
  }

  // B4. Check if it matches a category slug in "All"
  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', decodedSlug)
    .single();

  if (category) {
    const { data: allArea } = await supabase
      .from('areas')
      .select('*')
      .eq('slug', 'all')
      .eq('is_active', true)
      .single();

    if (allArea) {
      const listings = await getRandomizedListings(
        allArea.id,
        allArea.slug,
        null,
        category.id,
        'static_seed_123',
        19,
        0
      );

      const pageListings = (listings || []).slice(0, 18);
      const hasNext = (listings || []).length > 18;

      // Fetch usernames for these businesses
      const bizIds = Array.from(new Set(pageListings.map((l: any) => l.business_id)));
      const usernames: Record<string, string> = {};
      if (bizIds.length > 0) {
        const { data: bizs } = await supabase
          .from('businesses')
          .select('id, username')
          .in('id', bizIds);
        bizs?.forEach((b) => {
          usernames[b.id] = b.username || '';
        });
      }

      return {
        type: 'category' as const,
        area: allArea,
        category,
        listings: pageListings,
        hasNext,
        usernames,
      };
    }
  }

  return null;
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await resolveSlug(slug);

  if (!result) {
    return {
      title: 'Page Not Found | MyPahad',
    };
  }

  if (result.type === 'redirect') {
    return {};
  }

  if (result.type === 'town') {
    const { area } = result;
    return {
      title: `Local Shops & Products in ${area.name} | MyPahad`,
      description: `Explore local businesses, shops, services, and products in ${area.name}, ${area.district}, ${area.state}. Buy locally through WhatsApp. Apne Pahad ka Bazaar.`,
      openGraph: {
        title: `Local Shops & Products in ${area.name} | MyPahad`,
        description: `Explore local businesses, shops, services, and products in ${area.name}, ${area.district}, ${area.state}.`,
      },
    };
  }

  if (result.type === 'profile') {
    const { business } = result;
    const townName = business.areas?.name || '';
    const isAll = townName.toLowerCase() === 'all';
    
    const cleanDescription = business.description
      ? business.description.substring(0, 160)
      : (isAll
          ? `Shop local products & services from ${business.business_name}.`
          : `Shop local products & services from ${business.business_name} in ${townName}.`);

    const titleText = isAll
      ? `${business.business_name} | MyPahad`
      : `${business.business_name} in ${townName} | MyPahad`;

    return {
      title: titleText,
      description: cleanDescription,
      openGraph: {
        title: titleText,
        description: cleanDescription,
        images: business.dp_url ? [business.dp_url] : [],
      },
    };
  }

  if (result.type === 'category') {
    const { area, category } = result;
    return {
      title: `${category.name} in ${area.name} | MyPahad`,
      description: `Browse all ${category.name} listings on MyPahad in ${area.name}, ${area.district}, ${area.state}.`,
      openGraph: {
        title: `${category.name} in ${area.name} | MyPahad`,
        description: `Browse all ${category.name} listings on MyPahad in ${area.name}.`,
      },
    };
  }

  if (result.type === 'listing') {
    const { listing } = result;
    const townName = listing.businesses?.areas?.name || '';
    const sellerName = listing.businesses?.business_name || '';
    const isAll = townName.toLowerCase() === 'all';

    const cleanDescription = listing.description
      ? listing.description.substring(0, 160)
      : (isAll
          ? `Buy ${listing.name} from ${sellerName} on MyPahad.`
          : `Buy ${listing.name} from ${sellerName} in ${townName} on MyPahad.`);

    const titleText = isAll
      ? `${listing.name} - Buy Online | MyPahad`
      : `${listing.name} - Buy in ${townName} | MyPahad`;

    return {
      title: titleText,
      description: cleanDescription,
      openGraph: {
        title: titleText,
        description: cleanDescription,
        images: listing.image_url ? [listing.image_url] : [],
      },
    };
  }

  if (result.type === 'post') {
    const { post, business } = result;
    const cleanDescription = post.content
      ? post.content.replace(/<[^>]*>/g, '').substring(0, 160)
      : `Read post "${post.title}" by ${business.business_name} on MyPahad.`;

    return {
      title: `${post.title} | ${business.business_name} | MyPahad`,
      description: cleanDescription,
      keywords: post.tags || undefined,
      openGraph: {
        title: `${post.title} | ${business.business_name} | MyPahad`,
        description: cleanDescription,
        images: (post.media_type === 'image' && post.media_url) ? [post.media_url] : [],
      },
    };
  }

  return {};
}

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await resolveSlug(slug);

  if (!result) {
    notFound();
  }

  if (result.type === 'redirect') {
    redirect(result.destination);
  }

  if (result.type === 'town') {
    const { data: otherAreas } = await supabase
      .from('areas')
      .select('id, name, slug, state, district, is_active')
      .eq('is_active', true)
      .neq('slug', 'all')
      .order('name');

    return (
      <TownFeed
        area={result.area}
        initialStories={result.stories}
        initialAds={result.ads}
        initialCategories={result.categories}
        allAreas={otherAreas || []}
      />
    );
  }

  if (result.type === 'profile') {
    return (
      <ProfileDetail
        business={result.business}
        photos={result.photos}
        initialListings={result.listings}
        initialPosts={result.posts}
        initialHearts={false}
      />
    );
  }

  if (result.type === 'category') {
    return (
      <CategoryDetail
        area={result.area}
        category={result.category}
        initialListings={result.listings}
        initialHasNext={result.hasNext}
        usernames={result.usernames}
      />
    );
  }

  if (result.type === 'listing') {
    const actualPrice = result.listing.discount_price
      ? parsePrice(result.listing.discount_price)
      : parsePrice(result.listing.price);

    const schemaMarkup = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: result.listing.name,
      image: result.listing.image_url ? [result.listing.image_url] : [],
      description:
        result.listing.description ||
        `Buy ${result.listing.name} from ${result.listing.businesses?.business_name} in ${result.listing.businesses?.areas?.name} on MyPahad.`,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price: actualPrice || 0,
        itemCondition: 'https://schema.org/NewCondition',
        availability: result.listing.is_available
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'LocalBusiness',
          name: result.listing.businesses?.business_name || 'Local Seller',
          image: result.listing.businesses?.dp_url || undefined,
        },
      },
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
        />
        <ListingDetail listing={result.listing} relatedListings={result.relatedListings} />
      </>
    );
  }

  if (result.type === 'post') {
    return (
      <PostDetail
        post={result.post}
        business={result.business}
        listings={result.listings}
      />
    );
  }

  notFound();
}
