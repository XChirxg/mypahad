'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Area {
  id: string;
  name: string;
  slug: string;
  state: string;
  district: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Listing {
  id: string;
  name: string;
  price: string | null;
  discount_price: string | null;
  image_url: string | null;
  listing_type: string | null;
  business_id: string;
  qty_label: string | null;
  businesses?: {
    id: string;
    business_name: string;
  };
}

interface CategoryDetailProps {
  area: Area;
  category: Category;
  initialListings: Listing[];
  initialHasNext: boolean;
  usernames: Record<string, string>;
}

const PS = 18; // Items per page

export default function CategoryDetail({
  area,
  category,
  initialListings,
  initialHasNext,
  usernames,
}: CategoryDetailProps) {
  const router = useRouter();
  
  const [listingType, setListingType] = useState<string | null>(null); // null = All, 'product', 'service'
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loading, setLoading] = useState(false);
  const [bizUsernames, setBizUsernames] = useState<Record<string, string>>(usernames);

  // Randomization seed
  const [sessionSeed, setSessionSeed] = useState('');

  useEffect(() => {
    let savedSeed = sessionStorage.getItem('mp_listing_seed');
    if (!savedSeed) {
      savedSeed = Math.random().toString(36).substring(2, 12);
      sessionStorage.setItem('mp_listing_seed', savedSeed);
    }
    setSessionSeed(savedSeed);
  }, []);

  // Fetch listings when page or listingType changes (except on first mount with default values)
  useEffect(() => {
    if (page === 0 && listingType === null && sessionSeed === '') return;
    loadListings();
  }, [page, listingType, sessionSeed]);

  const loadListings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_randomized_listings', {
        p_area_id: area.id,
        p_listing_type: listingType,
        p_category_id: category.id,
        p_seed: sessionSeed || 'default_seed',
        p_limit: PS + 1,
        p_offset: page * PS,
      });

      if (!error && data) {
        const hasNextPage = data.length > PS;
        setHasNext(hasNextPage);
        const pageItems = hasNextPage ? data.slice(0, PS) : data;
        setListings(pageItems);

        // Fetch usernames for any new businesses that aren't in our map yet
        const missingBizIds = pageItems
          .map((l: Listing) => l.business_id)
          .filter((id: string) => !bizUsernames[id]);

        if (missingBizIds.length > 0) {
          const { data: newBizs } = await supabase
            .from('businesses')
            .select('id, username')
            .in('id', missingBizIds);

          if (newBizs) {
            setBizUsernames((prev) => {
              const updated = { ...prev };
              newBizs.forEach((b) => {
                updated[b.id] = b.username || '';
              });
              return updated;
            });
          }
        }
      } else {
        setListings([]);
        setHasNext(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (type: string | null) => {
    setListingType(type);
    setPage(0);
  };

  const parsePrice = (p: string | null) => {
    if (!p) return 0;
    const cleaned = String(p).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const renderPrice = (l: Listing) => {
    const orig = parsePrice(l.price);
    const disc = parsePrice(l.discount_price);

    if (l.discount_price) {
      let pctSpan = null;
      if (orig > 0 && disc > 0 && orig > disc) {
        const pct = Math.round(((orig - disc) / orig) * 100);
        pctSpan = (
          <span className="bg-[#e05a2b] text-white text-[7px] font-bold px-1 py-0.5 rounded ml-1">
            {pct}% OFF
          </span>
        );
      }
      return (
        <div className="text-[#e05a2b] text-[10px] font-bold mt-0.5">
          {l.discount_price}{' '}
          <span className="line-through text-gray-400 text-[8px] font-normal">{l.price}</span>
          {pctSpan}
        </div>
      );
    } else if (l.price) {
      return <div className="text-[#1a5c3a] text-[10px] font-bold mt-0.5">{l.price}</div>;
    }
    return null;
  };

  const generateSlug = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const getProductHref = (l: Listing) => {
    const bizUsername = bizUsernames[l.business_id] || 'shop';
    const prodSlug = generateSlug(l.name);
    return `/${bizUsername}-${prodSlug}-in-${area.slug}`;
  };

  const getProfileHref = (businessId: string) => {
    const username = bizUsernames[businessId] || 'shop';
    return `/${username}-in-${area.slug}`;
  };

  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-[60px] font-sans">
      {/* Top Navbar */}
      <div className="bg-[#1a5c3a] p-2 px-3 flex items-center justify-between gap-2 sticky top-0 z-50 shadow-sm">
        <button
          onClick={() => router.back()}
          className="bg-white/14 border-none text-white px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          ← Back
        </button>
        <span className="text-white text-sm font-bold truncate max-w-[200px]">
          {category.name}
        </span>
        <Link href={`/${area.slug}`} className="text-white text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity">
          MyPahad
        </Link>
      </div>

      <div className="max-w-[1100px] mx-auto">
        {/* Breadcrumb Row */}
        <div className="p-2 px-3.5 bg-white border-b border-gray-200 text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
          <Link href={`/${area.slug}`} className="text-[#1a5c3a] hover:underline">
            {area.name}
          </Link>
          <span>›</span>
          <span className="text-gray-600 font-medium">{category.name}</span>
        </div>

        {/* Page Header */}
        <div className="p-3 px-3.5 bg-white border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-800">{category.name}</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {loading ? 'Updating listings...' : `${listings.length}${hasNext ? '+' : ''} item${listings.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Filter Chip Row */}
        <div className="flex gap-1.5 overflow-x-auto p-2 px-3.5 bg-white border-b border-gray-200 no-scrollbar">
          <button
            onClick={() => handleFilterChange(null)}
            className={`shrink-0 whitespace-nowrap px-3 py-1 rounded text-[11px] border border-gray-200 transition-all ${
              listingType === null
                ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]'
                : 'bg-white text-gray-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('product')}
            className={`shrink-0 whitespace-nowrap px-3 py-1 rounded text-[11px] border border-gray-200 transition-all ${
              listingType === 'product'
                ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]'
                : 'bg-white text-gray-600'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => handleFilterChange('service')}
            className={`shrink-0 whitespace-nowrap px-3 py-1 rounded text-[11px] border border-gray-200 transition-all ${
              listingType === 'service'
                ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]'
                : 'bg-white text-gray-600'
            }`}
          >
            Services
          </button>
        </div>

        {/* Listings Grid */}
        {loading && listings.length === 0 ? (
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="w-full aspect-square shim bg-gray-200" />
                <div className="p-1.5">
                  <div className="h-2.5 bg-gray-200 rounded shim mb-1.5 w-full" />
                  <div className="h-2 bg-gray-200 rounded shim w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-xs">
            No listings found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 p-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={getProductHref(l)}
                onClick={() => {
                  localStorage.setItem('mp_view_lst', JSON.stringify(l));
                  localStorage.setItem('mp_lst_back', `/${category.slug}-in-${area.slug}`);
                }}
                className="bg-white rounded border border-gray-200 overflow-hidden cursor-pointer shadow-sm hover:border-[#1a5c3a] transition-all flex flex-col justify-between"
              >
                <div>
                  {l.image_url ? (
                    <img
                      src={l.image_url}
                      className="w-full aspect-square object-cover"
                      alt={l.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-[#e8f5ee] flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  <div className="p-1.5 px-2">
                    <div className="text-[10px] font-medium line-clamp-2 leading-tight h-[26px]">
                      {l.name}
                    </div>
                    {renderPrice(l)}
                  </div>
                </div>
                
                <div className="p-1.5 pt-0 px-2">
                  <div className="text-[9px] text-gray-400 truncate border-t border-gray-50 pt-1">
                    {l.businesses?.business_name || ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination Row */}
        {(page > 0 || hasNext) && (
          <div className="flex items-center justify-center gap-3 p-4 pb-8">
            <button
              onClick={() => {
                setPage((p) => Math.max(0, p - 1));
                window.scrollTo(0, 0);
              }}
              disabled={page === 0 || loading}
              className="bg-white border border-gray-200 p-1.5 px-4 rounded text-xs text-gray-600 disabled:opacity-35 disabled:cursor-default"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-400 font-medium">Page {page + 1}</span>
            <button
              onClick={() => {
                setPage((p) => p + 1);
                window.scrollTo(0, 0);
              }}
              disabled={!hasNext || loading}
              className="bg-white border border-gray-200 p-1.5 px-4 rounded text-xs text-gray-600 disabled:opacity-35 disabled:cursor-default"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 pb-safe">
        <Link
          href={`/${area.slug}`}
          className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-[9px] gap-0.5 text-gray-400 hover:text-[#1a5c3a] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
          Home
        </Link>
        <Link
          href="/search"
          className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-[9px] gap-0.5 text-gray-400 hover:text-[#1a5c3a] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Search
        </Link>
        <Link
          href="/search?tab=businesses"
          className="flex-1 flex flex-col items-center justify-center py-2 px-1 text-[9px] gap-0.5 text-gray-400 hover:text-[#1a5c3a] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Businesses
        </Link>
      </nav>
    </div>
  );
}
