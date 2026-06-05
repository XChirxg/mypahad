'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, generateUUID, triggerNavigationStart } from '@/lib/supabase';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import AdBanner from '@/components/AdBanner';
import { getAreaCategories, getRandomizedListings, getBusinessLink, getListingLink, getCategoryLink } from '@/lib/dbHelpers';

interface Area {
  id: string;
  name: string;
  slug: string;
  state: string;
  district: string;
  is_active: boolean;
}

interface Business {
  id: string;
  business_name: string;
  dp_url: string | null;
  username?: string | null;
}

interface Ad {
  id: string;
  area_id: string;
  ad_type: string;
  image_url: string | null;
  link_url: string | null;
  listing_id: string | null;
  business_id: string | null;
  slot_number?: string | null;
  category_id?: string | null;
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
  ad_id?: string;
  businesses?: {
    business_name: string;
  };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface TownFeedProps {
  area: Area;
  initialStories: Business[];
  initialAds: Ad[];
  initialCategories: Category[];
  allAreas?: Area[];
}

const PS = 5; // Categories per page
const detailPS = 18; // Listings per page in detail view

export default function TownFeed({ area, initialStories, initialAds, initialCategories, allAreas = [] }: TownFeedProps) {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'businesses'>('home');
  const [listingType, setListingType] = useState<string | null>(null); // null = All, 'product', 'service'
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [categoryPage, setCategoryPage] = useState(0);
  const [categoryListings, setCategoryListings] = useState<Record<string, Listing[]>>({});
  const [loadingCategoryListings, setLoadingCategoryListings] = useState<Record<string, boolean>>({});
  
  // Detail Category View
  const [detailCat, setDetailCat] = useState<Category | null>(null);
  const [detailPage, setDetailPage] = useState(0);
  const [detailListings, setDetailListings] = useState<Listing[]>([]);
  const [detailHasNext, setDetailHasNext] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Stories, Ads, Cart
  const [stories] = useState<Business[]>(initialStories);
  const [bannerAds, setBannerAds] = useState<Ad[]>([]);
  const [sponsoredListings, setSponsoredListings] = useState<Listing[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [isSeller, setIsSeller] = useState(false);
  
  // Seeds & Session
  const [sessionSeed, setSessionSeed] = useState('');
  const [sid, setSid] = useState('');
  const [bizUsernames, setBizUsernames] = useState<Record<string, string>>({});

  // Town Selector states
  const [showFullSelector, setShowFullSelector] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('mp_town_selected_v2');
  });
  const [tempTownId, setTempTownId] = useState('');
  const [bizMenuOpen, setBizMenuOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (bizMenuOpen && !(e.target as HTMLElement).closest('.biz-menu-container')) {
        setBizMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [bizMenuOpen]);

  useEffect(() => {
    const initialMap: Record<string, string> = {};
    stories.forEach(s => {
      if (s.id && s.username) {
        initialMap[s.id] = s.username;
      }
    });
    setBizUsernames(initialMap);
  }, [stories]);

  useEffect(() => {
    // Save current town to localStorage to maintain backward compatibility
    localStorage.setItem('mp_area', JSON.stringify(area));

    let savedSid = localStorage.getItem('mp_sid');
    if (!savedSid) {
      savedSid = generateUUID();
      localStorage.setItem('mp_sid', savedSid);
    }
    setSid(savedSid);

    // Seed
    let savedSeed = sessionStorage.getItem('mp_listing_seed');
    if (!savedSeed) {
      savedSeed = Math.random().toString(36).substring(2, 12);
      sessionStorage.setItem('mp_listing_seed', savedSeed);
    }
    setSessionSeed(savedSeed);

    // Track analytics
    supabase.from('analytics').insert({
      area_id: area.id,
      event_type: 'area_visit',
      session_id: savedSid
    }).then(null, err => console.warn('Analytics tracking failed:', err));

    // Check cart count
    updateCartCount();

    // Check if user is a partner
    checkPartnerStatus();

    // Parse Ads
    const banners = initialAds.filter(a => a.ad_type === 'banner');
    setBannerAds(banners);
    
    const sponsoredAds = initialAds.filter(a => a.ad_type === 'sponsored_product' || a.ad_type === 'sponsored_service');
    fetchSponsoredListings(sponsoredAds);
  }, [area, initialAds]);

  // Load category listings when category page or listing type changes
  useEffect(() => {
    loadCategoryBoxes();
  }, [categoryPage, listingType, categories, sessionSeed]);

  const updateCartCount = () => {
    let cart: Record<string, { items?: { quantity: number }[] }> = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}
    
    let totalCount = 0;
    Object.keys(cart).forEach(bid => {
      if (cart[bid]?.items) {
        cart[bid].items!.forEach(item => {
          totalCount += Number(item.quantity) || 0;
        });
      }
    });
    setCartCount(totalCount);
  };

  const checkPartnerStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', session.user.id)
          .single();
        if (biz) setIsSeller(true);
      }
    } catch (e) {}
  };

  const fetchSponsoredListings = async (ads: Ad[]) => {
    const list: Listing[] = [];
    const savedSid = localStorage.getItem('mp_sid') || '';
    for (const ad of ads) {
      if (ad.listing_id) {
        const { data: l } = await supabase
          .from('listings')
          .select('*, businesses(business_name)')
          .eq('id', ad.listing_id)
          .single();
        if (l) {
          list.push({ ...l, ad_id: ad.id } as unknown as Listing);
          
          // Log impression
          supabase.from('analytics').insert({
            area_id: area.id,
            event_type: 'ad_impression',
            ad_id: ad.id,
            session_id: savedSid
          }).then(null, err => console.warn('Ad impression logging failed:', err));
        }
      }
    }
    setSponsoredListings(list);
  };

  const openSponsoredProduct = async (l: Listing) => {
    triggerNavigationStart();
    const savedSid = localStorage.getItem('mp_sid') || '';
    if (l.ad_id) {
      await supabase.from('analytics').insert({
        area_id: area.id,
        event_type: 'ad_click',
        ad_id: l.ad_id,
        session_id: savedSid
      }).then(null, err => console.warn('Ad click logging failed:', err));
    }
    openProduct(l);
  };

  const loadCategoryBoxes = async () => {
    const pageCats = categories.slice(categoryPage * PS, (categoryPage + 1) * PS);
    if (!pageCats.length) return;
    
    pageCats.forEach(async (cat) => {
      setLoadingCategoryListings(prev => ({ ...prev, [cat.id]: true }));
      try {
        const data = await getRandomizedListings(
          area.id,
          area.slug,
          listingType,
          cat.id,
          sessionSeed || 'default_seed',
          6,
          0
        );
        
        if (data) {
          setCategoryListings(prev => ({ ...prev, [cat.id]: data }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCategoryListings(prev => ({ ...prev, [cat.id]: false }));
      }
    });
  };

  const handleFilterChange = async (type: string | null) => {
    setListingType(type);
    setDetailCat(null);
    setCategoryPage(0);
    
    // Fetch categories matching type
    try {
      const data = await getAreaCategories(area.id, area.slug, type);
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const openDetailView = async (cat: Category) => {
    setDetailCat(cat);
    setDetailPage(0);
    loadDetailListings(cat, 0);
  };

  const loadDetailListings = async (cat: Category, pageNum: number) => {
    setLoadingDetail(true);
    try {
      const data = await getRandomizedListings(
        area.id,
        area.slug,
        listingType,
        cat.id,
        sessionSeed || 'default_seed',
        detailPS + 1,
        pageNum * detailPS
      );

      if (data) {
        const hasNext = data.length > detailPS;
        setDetailHasNext(hasNext);
        setDetailListings(hasNext ? data.slice(0, detailPS) : data);
      } else {
        setDetailListings([]);
        setDetailHasNext(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const changeDetailPg = (d: number) => {
    const nextPg = detailPage + d;
    setDetailPage(nextPg);
    if (detailCat) {
      loadDetailListings(detailCat, nextPg);
    }
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

  const openProduct = async (l: Listing) => {
    triggerNavigationStart();
    localStorage.setItem('mp_view_lst', JSON.stringify(l));
    localStorage.setItem('mp_lst_back', `/${area.slug}`);

    let username = bizUsernames[l.business_id];
    if (!username) {
      const { data } = await supabase
        .from('businesses')
        .select('username')
        .eq('id', l.business_id)
        .single();
      if (data?.username) {
        username = data.username;
        setBizUsernames(prev => ({ ...prev, [l.business_id]: data.username }));
      }
    }

    const prodSlug = generateSlug(l.name);
    router.push(getListingLink(username, prodSlug, area.slug));
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

  const totalCatPages = Math.ceil(categories.length / PS);

  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-4 font-sans">
      {/* Top Navbar */}
      <div className="bg-[#1a5c3a] p-2 px-3 flex items-center justify-between gap-2 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-white text-base font-bold tracking-tight" style={{ color: 'white' }}>MyPahad</Link>
          {area.slug !== 'all' && (
            <span className="text-[10px] text-white/60 border-l border-white/20 pl-2 leading-none">
              {area.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!(area.slug === 'all' && showFullSelector) && (
            <button 
              onClick={() => {
                if (area.slug === 'all') {
                  setShowFullSelector(true);
                } else {
                  router.push('/');
                }
              }}
              className="bg-white/15 text-white border-none px-2 py-1 rounded text-[11px] font-semibold hover:bg-white/25 transition-colors cursor-pointer"
            >
              Change
            </button>
          )}
          {isSeller && (
            <a href="https://partner.mypahad.in" className="bg-white/15 text-white border-none px-2 py-1 rounded text-[11px] font-semibold hover:bg-white/25 transition-colors">
              Dashboard
            </a>
          )}
          <Link href="/cart" className="relative flex items-center justify-center p-1 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#e05a2b] text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
          
          <div className="relative biz-menu-container flex items-center">
            <button 
              onClick={() => setBizMenuOpen(!bizMenuOpen)}
              className="flex items-center justify-center p-1 text-white hover:text-gray-200 bg-none border-none cursor-pointer"
              title="Business Portal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h18v2H3z"/>
                <path d="M3 5l2 8h14l2-8z"/>
                <path d="M5 13v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
                <path d="M9 13v4h6v-4"/>
              </svg>
            </button>
            {bizMenuOpen && (
              <div className="absolute right-0 mt-2 top-7 w-44 bg-white rounded-md shadow-lg py-1.5 z-[1000] border border-gray-200">
                <a 
                  href="https://partner.mypahad.in/index.html" 
                  onClick={() => setBizMenuOpen(false)}
                  className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                >
                  Login Business
                </a>
                <a 
                  href="https://partner.mypahad.in/index.html?tab=register" 
                  onClick={() => setBizMenuOpen(false)}
                  className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 border-t border-gray-150"
                >
                  Register as a Business
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Input Redirect */}
      <div className="p-2 px-2.5 bg-white border-b border-[#ddd]">
        <Link href="/search" className="flex items-center bg-gray-100 rounded border border-[#ddd] p-2 px-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" className="mr-2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="text-[11px] text-gray-500 flex-1">Search products, services, or shops...</span>
        </Link>
      </div>

      {/* Town Selection Header / Banner */}
      {activeTab === 'home' && area.slug === 'all' && (
        showFullSelector ? (
          <div className="bg-white border-b border-[#ddd] p-4 flex flex-col items-center justify-center font-sans">
            <div className="w-full max-w-[360px] flex flex-col gap-2">
              <div className="text-center mb-1">
                <div className="text-sm font-bold text-[#1a5c3a]">Select your city..</div>
                <div className="text-[10px] text-gray-400">Apne Pahad ka Bazaar</div>
              </div>

              <div className="flex gap-2 items-center w-full">
                <div className="relative flex-1">
                  <select 
                    value={tempTownId} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'notinlist') {
                        window.open('https://support.mypahad.in/whyyourtownnotinlist.html', '_blank');
                        setTempTownId('');
                      } else {
                        setTempTownId(val);
                        const selected = allAreas?.find(a => a.id === val);
                        if (selected) {
                          localStorage.setItem('mp_town_selected_v2', 'true');
                          localStorage.setItem('mp_area', JSON.stringify(selected));
                          triggerNavigationStart();
                          router.push(`/${selected.slug}`);
                        }
                      }
                    }}
                    className="w-full appearance-none border border-gray-200 rounded-lg p-2.5 pr-8 text-xs focus:border-[#1a5c3a] outline-none bg-white cursor-pointer"
                  >
                    <option value="">Select your city...</option>
                    {allAreas?.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.district})</option>
                    ))}
                    <option value="notinlist">Your town not in the list? See why</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">▼</div>
                </div>

                <button 
                  onClick={() => {
                    const selected = allAreas?.find(a => a.id === tempTownId);
                    if (selected) {
                      localStorage.setItem('mp_town_selected_v2', 'true');
                      localStorage.setItem('mp_area', JSON.stringify(selected));
                      triggerNavigationStart();
                      router.push(`/${selected.slug}`);
                    }
                  }}
                  disabled={!tempTownId}
                  className="bg-[#1a5c3a] text-white border-none p-2.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-35 disabled:cursor-default active:scale-[0.98] transition-all flex items-center justify-center w-10 h-10 shrink-0"
                  title="Enter Bazaar"
                >
                  ➔
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-b border-[#ddd] p-2.5 px-3 flex items-center justify-between gap-2 shadow-xs text-xs text-gray-600">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[#1a5c3a]">📍</span>
              <span className="truncate">
                Check if your local bazaar is listed or explore all other places.
              </span>
            </div>
            <button 
              onClick={() => setShowFullSelector(true)}
              className="text-[#1a5c3a] bg-none border-none font-semibold hover:underline cursor-pointer shrink-0 text-xs"
            >
              Select Town
            </button>
          </div>
        )
      )}

      {/* Stories list */}
      {stories.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto p-2 px-3 bg-white border-b border-[#ddd] no-scrollbar">
          {stories.map(b => (
            <div 
              key={b.id} 
              onClick={() => {
                triggerNavigationStart();
                localStorage.setItem('mp_view_biz', b.id);
                localStorage.setItem('mp_prof_back', area.slug === 'all' ? '/' : `/${area.slug}`);
                router.push(getBusinessLink(b.username, area.slug));
              }}
              className="shrink-0 text-center w-12 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full border-2 border-[#1a5c3a] overflow-hidden mx-auto mb-1 flex items-center justify-center bg-gray-50">
                {b.dp_url ? (
                  <img src={getOptimizedImageUrl(b.dp_url, 'dp')} className="w-full h-full object-cover" alt={b.business_name} loading="lazy" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  </svg>
                )}
              </div>
              <div className="text-[8px] text-gray-700 leading-tight line-clamp-2 max-h-[22px] overflow-hidden">
                {b.business_name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banner Ad */}
      {bannerAds.find(a => a.slot_number === 'banner_top') && (
        <AdBanner ad={bannerAds.find(a => a.slot_number === 'banner_top')!} areaSlug={area.slug} />
      )}

      {/* Filter Chips */}
      <div className="flex gap-1 overflow-x-auto p-2 px-3 bg-white border-b border-[#ddd] no-scrollbar">
        <button 
          onClick={() => handleFilterChange(null)}
          className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded text-[11px] border border-[#ddd] ${listingType === null ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]' : 'bg-white text-gray-600'}`}
        >
          All Type
        </button>
        <button 
          onClick={() => handleFilterChange('product')}
          className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded text-[11px] border border-[#ddd] ${listingType === 'product' ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]' : 'bg-white text-gray-600'}`}
        >
          Products
        </button>
        <button 
          onClick={() => handleFilterChange('service')}
          className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded text-[11px] border border-[#ddd] ${listingType === 'service' ? 'bg-[#1a5c3a] text-white border-[#1a5c3a]' : 'bg-white text-gray-600'}`}
        >
          Services
        </button>
      </div>

      {/* Category Scroll Chips */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto p-2 px-3 bg-white border-b border-[#ddd] no-scrollbar">
          {categories.slice(0, 10).map(cat => (
            <button
              key={cat.id}
              onClick={() => openDetailView(cat)}
              className="shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Sponsored Listings */}
      {sponsoredListings.length > 0 && (
        <div className="bg-white border-b border-[#ddd]">
          <div className="flex items-center justify-between p-2 px-3">
            <span className="text-[12px] font-bold text-gray-800">Sponsored</span>
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-3 no-scrollbar">
            {sponsoredListings.map(l => (
              <div 
                key={l.id} 
                onClick={() => openSponsoredProduct(l)}
                className="shrink-0 w-[100px] bg-[#f8f8f8] rounded border border-[#ddd] overflow-hidden cursor-pointer"
              >
                {l.image_url ? (
                  <img src={getOptimizedImageUrl(l.image_url, 'card')} className="w-full h-[70px] object-cover bg-gray-100" alt={l.name} loading="lazy" />
                ) : (
                  <div className="w-full h-[70px] bg-[#e8f5ee] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                  </div>
                )}
                <div className="p-1 px-1.5">
                  <div className="text-[10px] font-medium line-clamp-2 leading-tight h-[26px]">
                    {l.name}
                  </div>
                  {renderPrice(l)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Listings View */}
      {!detailCat ? (
        <div className="flex flex-col">
          {categories.slice(categoryPage * PS, (categoryPage + 1) * PS).map((cat, index) => {
            const listings = categoryListings[cat.id] || [];
            const isLoading = loadingCategoryListings[cat.id];
            
            // If it's loaded and empty, hide the box entirely
            if (!isLoading && listings.length === 0) return null;
            
            const adToShow = bannerAds.find(a => a.slot_number === `banner${index + 1}`);
            const shouldShowAd = !!adToShow;

            return (
              <div key={cat.id}>
                <div className="bg-white border-b border-[#ddd] p-2 py-3 mb-2.5">
                <div 
                  onClick={() => openDetailView(cat)}
                  className="flex items-center justify-between px-1 mb-2 cursor-pointer group"
                >
                  <span className="text-[12px] font-bold text-gray-800 group-hover:text-[#1a5c3a] group-hover:underline">{cat.name}</span>
                  <span className="text-[10px] text-[#1a5c3a] font-bold opacity-80 group-hover:opacity-100 transition-opacity">View All →</span>
                </div>
                
                {isLoading ? (
                  <div className="grid grid-cols-3 gap-1.5 px-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-white rounded border border-[#ddd] overflow-hidden">
                        <div className="w-full aspect-square shim"></div>
                        <div className="p-1.5">
                          <div className="h-2.5 bg-gray-200 rounded shim mb-1.5 w-full"></div>
                          <div className="h-2 bg-gray-200 rounded shim w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-1.5 px-1">
                      {listings.map(l => (
                        <div 
                          key={l.id} 
                          onClick={() => openProduct(l)}
                          className="bg-white rounded border border-[#ddd] overflow-hidden cursor-pointer"
                        >
                          {l.image_url ? (
                            <img src={getOptimizedImageUrl(l.image_url, 'card')} className="w-full aspect-square object-cover" alt={l.name} loading="lazy" />
                          ) : (
                            <div className="w-full aspect-square bg-[#e8f5ee] flex items-center justify-center">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                              </svg>
                            </div>
                          )}
                          <div className="p-1 px-1.5">
                            <div className="text-[10px] font-medium line-clamp-2 leading-tight h-[26px]">
                              {l.name}
                            </div>
                            {renderPrice(l)}
                            <div className="text-[9px] text-gray-400 truncate mt-0.5">
                              {l.businesses?.business_name || ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {listings.length >= 6 && (
                      <div className="flex justify-center mt-3 pt-2.5 border-t border-dashed border-[#ddd] px-1">
                        <button 
                          onClick={() => openDetailView(cat)}
                          className="bg-none border border-[#1a5c3a] text-[#1a5c3a] text-[10px] font-semibold cursor-pointer py-1.5 px-3 rounded w-full hover:bg-[#1a5c3a] hover:text-white transition-colors text-center block"
                        >
                          View More →
                        </button>
                      </div>
                    )}
                  </>
                )}
                </div>
                {shouldShowAd && (
                  <AdBanner ad={adToShow} areaSlug={area.slug} />
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalCatPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3">
              <button 
                onClick={() => { setCategoryPage(p => Math.max(0, p - 1)); window.scrollTo(0, 0); }}
                disabled={categoryPage === 0}
                className="bg-white border border-[#ddd] p-1.5 px-3.5 rounded text-[11px] text-gray-600 disabled:opacity-35 disabled:cursor-default"
              >
                ← Prev
              </button>
              <button 
                onClick={() => { setCategoryPage(p => Math.min(totalCatPages - 1, p + 1)); window.scrollTo(0, 0); }}
                disabled={categoryPage >= totalCatPages - 1}
                className="bg-white border border-[#ddd] p-1.5 px-3.5 rounded text-[11px] text-gray-600 disabled:opacity-35 disabled:cursor-default"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Detailed Category View */
        <div className="bg-white min-h-screen">
          <div className="flex items-center gap-2.5 p-3.5 bg-white border-b border-[#ddd] mb-2 sticky top-12 z-40">
            <button onClick={() => setDetailCat(null)} className="bg-none border-none text-[#1a5c3a] text-base font-bold p-1">
              ←
            </button>
            <span className="text-[13px] font-bold text-gray-700">{detailCat.name}</span>
          </div>

          {loadingDetail ? (
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded border border-[#ddd] overflow-hidden">
                  <div className="w-full aspect-square shim"></div>
                  <div className="p-1.5">
                    <div className="h-2.5 bg-gray-200 rounded shim mb-1.5 w-full"></div>
                    <div className="h-2 bg-gray-200 rounded shim w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 p-3">
                {detailListings.length === 0 ? (
                  <div className="col-span-3 text-center py-8 text-gray-400 text-xs">
                    No listings found in this category.
                  </div>
                ) : (
                  detailListings.map(l => (
                    <div 
                      key={l.id} 
                      onClick={() => openProduct(l)}
                      className="bg-white rounded border border-[#ddd] overflow-hidden cursor-pointer"
                    >
                      {l.image_url ? (
                        <img src={getOptimizedImageUrl(l.image_url, 'card')} className="w-full aspect-square object-cover" alt={l.name} loading="lazy" />
                      ) : (
                        <div className="w-full aspect-square bg-[#e8f5ee] flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      )}
                      <div className="p-1 px-1.5">
                        <div className="text-[10px] font-medium line-clamp-2 leading-tight h-[26px]">
                          {l.name}
                        </div>
                        {renderPrice(l)}
                        <div className="text-[9px] text-gray-400 truncate mt-0.5">
                          {l.businesses?.business_name || ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Detail Pagination */}
              {(detailPage > 0 || detailHasNext) && (
                <div className="flex items-center justify-center gap-2 p-3 pb-6">
                  <button 
                    onClick={() => changeDetailPg(-1)}
                    disabled={detailPage === 0}
                    className="bg-white border border-[#ddd] p-1.5 px-3.5 rounded text-[11px] text-gray-600 disabled:opacity-35 disabled:cursor-default"
                  >
                    ← Prev
                  </button>
                  <button 
                    onClick={() => changeDetailPg(1)}
                    disabled={!detailHasNext}
                    className="bg-white border border-[#ddd] p-1.5 px-3.5 rounded text-[11px] text-gray-600 disabled:opacity-35 disabled:cursor-default"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
