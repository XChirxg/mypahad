'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, triggerNavigationStart } from '@/lib/supabase';
import { getBusinessLink, getListingLink } from '@/lib/dbHelpers';

interface Area {
  id: string;
  name: string;
  slug: string;
  state?: string;
  district?: string;
}

interface Category {
  name: string;
}

interface Business {
  id: string;
  business_name: string;
  username?: string | null;
  dp_url: string | null;
  description: string | null;
  user_id: string | null;
  categories?: Category;
  areas?: {
    name?: string;
    slug: string;
  };
}

interface Listing {
  id: string;
  name: string;
  price: string | null;
  discount_price: string | null;
  image_url: string | null;
  listing_type: string | null;
  description: string | null;
  business_id: string;
  businesses?: {
    id: string;
    business_name: string;
    username?: string | null;
    areas?: {
      name?: string;
      slug: string;
    };
  };
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'businesses' ? 'businesses' : 'home';

  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'businesses'>(initialTab === 'businesses' ? 'businesses' : 'search');
  const [currentArea, setCurrentArea] = useState<Area | null>(null);
  const [query, setQuery] = useState('');
  
  // Quick results dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [quickBizResults, setQuickBizResults] = useState<Business[]>([]);
  const [quickLstResults, setQuickLstResults] = useState<Listing[]>([]);
  const [quickAreaResults, setQuickAreaResults] = useState<Area[]>([]);
  
  // Full results
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bizResults, setBizResults] = useState<Business[]>([]);
  const [lstResults, setLstResults] = useState<Listing[]>([]);
  const [areaResults, setAreaResults] = useState<Area[]>([]);
  
  // Explore listings (fallback when no results found)
  const [exploreListings, setExploreListings] = useState<Listing[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Read selected area from localStorage
    try {
      const saved = localStorage.getItem('mp_area');
      if (saved) {
        const areaObj = JSON.parse(saved) as Area;
        if (areaObj && areaObj.id && !areaObj.slug) {
          supabase
            .from('areas')
            .select('slug, name')
            .eq('id', areaObj.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const fullArea = { ...areaObj, slug: data.slug, name: data.name };
                localStorage.setItem('mp_area', JSON.stringify(fullArea));
                setCurrentArea(fullArea);
              } else {
                setCurrentArea(areaObj);
              }
            });
        } else {
          setCurrentArea(areaObj);
        }
      } else {
        router.push('/');
      }
    } catch (e) {
      router.push('/');
    }

    // Handle clicks outside of dropdown to close it
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    // Check if coming with a search tab preselected
    if (initialTab === 'businesses') {
      setActiveTab('businesses');
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // When active tab is switched to businesses or when area loads, trigger business load
  useEffect(() => {
    if (activeTab === 'businesses' && currentArea) {
      loadAllBusinesses();
    }
  }, [activeTab, currentArea]);

  const loadAllBusinesses = async () => {
    if (!currentArea) return;
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from('businesses')
        .select('id, business_name, username, dp_url, description, user_id, categories(name), areas(name, slug)')
        .eq('is_approved', true)
        .eq('is_active', true);
      
      if (currentArea.slug !== 'mypahad' && currentArea.slug !== 'all') {
        queryBuilder = queryBuilder.eq('area_id', currentArea.id);
      }

      const { data } = await queryBuilder.order('hearts', { ascending: false });
      setBizResults((data as unknown as Business[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const q = val.trim();
    if (!q || q.length < 2) {
      setDropdownOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      if (!currentArea) return;
      try {
        let lstQuery = supabase
          .from('listings')
          .select('id, name, price, discount_price, image_url, listing_type, business_id, businesses!inner(id, business_name, username, area_id, is_approved, is_active, areas(name, slug))')
          .ilike('name', `%${q}%`)
          .eq('businesses.is_approved', true)
          .eq('businesses.is_active', true)
          .eq('is_available', true);

        let bizQuery = supabase
          .from('businesses')
          .select('id, business_name, username, dp_url, user_id, categories(name), areas(name, slug)')
          .ilike('business_name', `%${q}%`)
          .eq('is_approved', true)
          .eq('is_active', true);

        lstQuery = lstQuery.eq('businesses.area_id', currentArea.id);
        bizQuery = bizQuery.eq('area_id', currentArea.id);

        const promises: PromiseLike<any>[] = [
          lstQuery.limit(5),
          bizQuery.limit(3)
        ];

        if (currentArea.slug === 'mypahad' || currentArea.slug === 'all') {
          promises.push(
            supabase
              .from('areas')
              .select('id, name, slug, state, district')
              .eq('is_active', true)
              .not('slug', 'in', '("mypahad","all")')
              .ilike('name', `%${q}%`)
              .limit(3)
          );
        }

        const results = await Promise.all(promises);

        setQuickLstResults((results[0].data as unknown as Listing[]) || []);
        setQuickBizResults((results[1].data as unknown as Business[]) || []);
        if (currentArea.slug === 'mypahad' || currentArea.slug === 'all') {
          setQuickAreaResults(results[2]?.data || []);
        } else {
          setQuickAreaResults([]);
        }
        setDropdownOpen(true);
      } catch (err) {
        console.error(err);
      }
    }, 280);
  };

  const triggerSearch = async () => {
    const q = query.trim();
    if (!q || q.length < 2) return;
    setDropdownOpen(false);
    setLoading(true);
    setHasSearched(true);
    setActiveTab('search');

    if (!currentArea) return;

    try {
      let lstQuery = supabase
        .from('listings')
        .select('id, name, price, discount_price, image_url, listing_type, description, business_id, businesses!inner(id, business_name, username, area_id, is_approved, is_active, areas(name, slug))')
        .ilike('name', `%${q}%`)
        .eq('businesses.is_approved', true)
        .eq('businesses.is_active', true)
        .eq('is_available', true);

      let bizQuery = supabase
        .from('businesses')
        .select('id, business_name, username, dp_url, description, user_id, categories(name), areas(name, slug)')
        .ilike('business_name', `%${q}%`)
        .eq('is_approved', true)
        .eq('is_active', true);

      lstQuery = lstQuery.eq('businesses.area_id', currentArea.id);
      bizQuery = bizQuery.eq('area_id', currentArea.id);

      const promises: PromiseLike<any>[] = [
        lstQuery.limit(20),
        bizQuery.limit(10)
      ];

      if (currentArea.slug === 'mypahad' || currentArea.slug === 'all') {
        promises.push(
          supabase
            .from('areas')
            .select('id, name, slug, state, district')
            .eq('is_active', true)
            .not('slug', 'in', '("mypahad","all")')
            .ilike('name', `%${q}%`)
            .limit(5)
        );
      }

      const results = await Promise.all(promises);

      const lsts = (results[0].data as unknown as Listing[]) || [];
      const bizs = (results[1].data as unknown as Business[]) || [];

      setLstResults(lsts);
      setBizResults(bizs);
      if (currentArea.slug === 'mypahad' || currentArea.slug === 'all') {
        setAreaResults(results[2]?.data || []);
      } else {
        setAreaResults([]);
      }

      // Fetch explore products if no search results found
      if (lsts.length === 0 && bizs.length === 0 && (currentArea.slug !== 'mypahad' && currentArea.slug !== 'all' || (results[2]?.data || []).length === 0)) {
        let expQuery = supabase
          .from('listings')
          .select('id, name, price, discount_price, image_url, listing_type, description, business_id, businesses!inner(id, business_name, username, area_id, is_approved, is_active, areas(slug))')
          .eq('businesses.is_approved', true)
          .eq('businesses.is_active', true)
          .eq('is_available', true);

        expQuery = expQuery.eq('businesses.area_id', currentArea.id);

        const { data } = await expQuery.limit(30);

        if (data && data.length > 0) {
          const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 5);
          setExploreListings(shuffled as unknown as Listing[]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  const openProduct = (l: Listing) => {
    localStorage.setItem('mp_view_lst', JSON.stringify(l));
    localStorage.setItem('mp_lst_back', '/search');
    const bizUsername = l.businesses?.username || 'shop';
    const areaSlug = l.businesses?.areas?.slug || currentArea?.slug || 'town';
    const prodSlug = generateSlug(l.name);
    triggerNavigationStart();
    router.push(getListingLink(bizUsername, prodSlug, areaSlug));
  };

  const openProfile = (b: Business) => {
    localStorage.setItem('mp_view_biz', b.id);
    localStorage.setItem('mp_prof_back', '/search');
    const areaSlug = b.areas?.slug || currentArea?.slug || 'town';
    const bizUsername = b.username || 'shop';
    triggerNavigationStart();
    router.push(getBusinessLink(bizUsername, areaSlug));
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
        <div className="text-[#e05a2b] text-xs font-bold mt-0.5">
          {l.discount_price}{' '}
          <span className="line-through text-gray-400 text-[9px] font-normal">{l.price}</span>
          {pctSpan}
        </div>
      );
    } else if (l.price) {
      return <div className="text-[#1a5c3a] text-xs font-bold mt-0.5">{l.price}</div>;
    }
    return null;
  };

  const renderSrpRow = (l: Listing) => {
    const isAllArea = currentArea?.slug === 'mypahad' || currentArea?.slug === 'all';
    const townText = (isAllArea && l.businesses?.areas?.slug !== 'mypahad' && l.businesses?.areas?.slug !== 'all' && l.businesses?.areas?.name) ? ` (in ${l.businesses.areas.name})` : '';
    return (
      <div 
        key={l.id} 
        onClick={() => openProduct(l)}
        className="flex gap-2.5 p-2.5 bg-white border-b border-gray-100 hover:bg-[#e8f5ee] cursor-pointer items-start"
      >
        {l.image_url ? (
          <img src={l.image_url} className="w-[90px] h-[66px] rounded object-cover shrink-0 bg-gray-50" alt={l.name} />
        ) : (
          <div className="w-[90px] h-[66px] rounded bg-[#e8f5ee] shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 815.87 616.68" className="w-5 h-5 text-[#1a5c3a]" role="img" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.57,572.97 C-14.62,339.44 2.09,154.1 54.52,6.42 C131.36,20.31 232.4,73.22 354.99,164.82 C404.05,86.33 455.12,32.57 500.69,0 C663.72,152.93 769.22,344.53 815.87,575.22 C672.26,616.9 459.11,628.39 186.41,604.02 C196.86,520.39 228.65,425.92 266.84,328.03 L188.35,216.96 L87.47,383.14 L136.67,386.07 L70.38,505.35 L136.98,507.05 L136.13,597.9 C87.58,590.41 37.72,582.23 13.57,572.97 Z" fill="currentColor" fillRule="evenodd" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-xs font-bold text-gray-800 leading-tight">{l.name}</div>
          {renderPrice(l)}
          <div className="text-[10px] text-gray-400 truncate mt-0.5">
            {l.businesses?.business_name}
            {townText && <span className="text-[9px] font-normal text-gray-400">{townText}</span>}
          </div>
          {l.description && <div className="text-[9.5px] text-gray-500 line-clamp-2 mt-1 leading-normal">{l.description}</div>}
          <span className="text-[9px] bg-[#e8f5ee] text-[#1a5c3a] px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">
            {l.listing_type || 'Item'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-[60px] font-sans">
      {/* Top Search Bar */}
      <div className="bg-[#1a5c3a] p-2 px-3 sticky top-0 z-50">
        {activeTab === 'businesses' ? (
          <div className="flex justify-between items-center py-1 px-1">
            <span className="text-white text-sm font-bold tracking-wide">mypahad.in</span>
            <span className="text-white text-[9px] opacity-75">Local Directory</span>
          </div>
        ) : (
          <>
            <div className="text-white text-xs font-bold mb-1.5 opacity-85">Search</div>
            <div className="flex gap-1.5 items-center relative" ref={dropdownRef}>
              <div className="relative flex-1">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none animate-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" style={{ zIndex: 10 }}>
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => { if (query.trim().length >= 2) setDropdownOpen(true); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
                  placeholder="Search listings, businesses…" 
                  className="w-full pr-3 py-2 border-none rounded text-xs text-gray-800 outline-none placeholder:text-gray-400 bg-white"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
              
              <button 
                onClick={triggerSearch}
                className="shrink-0 h-8.5 px-3.5 bg-[#e05a2b] text-white border-none rounded text-xs font-bold active:scale-[0.98] transition-all"
              >
                Search
              </button>              {/* Quick results Dropdown */}
              {dropdownOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#ddd] rounded shadow-lg max-h-[260px] overflow-y-auto z-50 flex flex-col">
                  {quickBizResults.length === 0 && quickLstResults.length === 0 && quickAreaResults.length === 0 ? (
                    <div className="p-3 text-[11px] text-gray-400">No quick results — press Search</div>
                  ) : (
                    <>
                      {quickAreaResults.length > 0 && (
                        <>
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest p-1.5 px-3.5 bg-gray-50 border-b border-gray-100">Locations</div>
                          {quickAreaResults.map(a => (
                            <div 
                              key={a.id} 
                              onClick={() => {
                                setQuery('');
                                setDropdownOpen(false);
                                localStorage.setItem('mp_area', JSON.stringify(a));
                                router.push(`/${a.slug}`);
                              }}
                              className="flex items-center gap-2.5 p-2 px-3 border-b border-gray-50 hover:bg-[#e8f5ee] cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded bg-[#e8f5ee] flex items-center justify-center shrink-0">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#1a5c3a] shrink-0">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold text-gray-800 truncate">{a.name}</div>
                                <div className="text-[9px] text-gray-400 truncate">{a.district}, {a.state}</div>
                              </div>
                              <span className="text-[9px] bg-gray-150 text-gray-400 px-1 py-0.5 rounded">Town</span>
                            </div>
                          ))}
                        </>
                      )}

                      {quickBizResults.length > 0 && (
                        <>
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest p-1.5 px-3.5 bg-gray-50 border-b border-gray-100">Businesses</div>
                          {quickBizResults.map(b => {
                            const claimed = b.user_id !== null;
                            const isAllArea = currentArea?.slug === 'mypahad' || currentArea?.slug === 'all';
                            const townText = (isAllArea && b.areas?.slug !== 'mypahad' && b.areas?.slug !== 'all' && b.areas?.name) ? ` (in ${b.areas.name})` : '';
                            return (
                              <div 
                                key={b.id} 
                                onClick={() => { setQuery(''); setDropdownOpen(false); openProfile(b); }}
                                className="flex items-center gap-2.5 p-2 px-3 border-b border-gray-50 hover:bg-[#e8f5ee] cursor-pointer"
                              >
                                {b.dp_url ? (
                                  <img src={b.dp_url} className="w-8 h-8 rounded object-cover shrink-0 bg-gray-50" alt="" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-[#e8f5ee] flex items-center justify-center shrink-0">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-semibold text-gray-800 truncate flex items-center gap-1">
                                    {claimed && (
                                      <span className="inline-flex items-center justify-center bg-[#0095f6] text-white w-3 h-3 rounded-full shrink-0">
                                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                          <polyline points="20 6 9 17 4 12"/>
                                        </svg>
                                      </span>
                                    )}
                                    {b.business_name}
                                    {townText && <span className="text-[9px] font-normal text-gray-400">{townText}</span>}
                                  </div>
                                  <div className="text-[9px] text-gray-400">{b.categories?.name}</div>
                                </div>
                                <span className="text-[9px] bg-gray-150 text-gray-400 px-1 py-0.5 rounded">Shop</span>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {quickLstResults.length > 0 && (
                        <>
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest p-1.5 px-3.5 bg-gray-50 border-b border-gray-100">Listings</div>
                          {quickLstResults.map(l => {
                            const isAllArea = currentArea?.slug === 'mypahad' || currentArea?.slug === 'all';
                            const townText = (isAllArea && l.businesses?.areas?.slug !== 'mypahad' && l.businesses?.areas?.slug !== 'all' && l.businesses?.areas?.name) ? ` (in ${l.businesses.areas.name})` : '';
                            return (
                              <div 
                                key={l.id} 
                                onClick={() => { setQuery(''); setDropdownOpen(false); openProduct(l); }}
                                className="flex items-center gap-2.5 p-2 px-3 border-b border-gray-50 hover:bg-[#e8f5ee] cursor-pointer"
                              >
                                {l.image_url ? (
                                  <img src={l.image_url} className="w-8 h-8 rounded object-cover shrink-0 bg-gray-50" alt="" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-[#e8f5ee] flex items-center justify-center shrink-0">
                                    <svg viewBox="0 0 815.87 616.68" className="w-4 h-4 text-[#1a5c3a]" role="img" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M13.57,572.97 C-14.62,339.44 2.09,154.1 54.52,6.42 C131.36,20.31 232.4,73.22 354.99,164.82 C404.05,86.33 455.12,32.57 500.69,0 C663.72,152.93 769.22,344.53 815.87,575.22 C672.26,616.9 459.11,628.39 186.41,604.02 C196.86,520.39 228.65,425.92 266.84,328.03 L188.35,216.96 L87.47,383.14 L136.67,386.07 L70.38,505.35 L136.98,507.05 L136.13,597.9 C87.58,590.41 37.72,582.23 13.57,572.97 Z" fill="currentColor" fillRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-semibold text-gray-800 truncate">
                                    {l.name}
                                    {townText && <span className="text-[9px] font-normal text-gray-400">{townText}</span>}
                                  </div>
                                  <div className="text-[9px] text-gray-400 truncate">{l.businesses?.business_name}</div>
                                </div>
                                {(l.discount_price || l.price) && (
                                  <span className="text-[9px] bg-[#e8f5ee] text-[#1a5c3a] px-1.5 py-0.5 rounded font-semibold shrink-0">
                                    {l.discount_price || l.price}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                      
                      <div 
                        onClick={triggerSearch} 
                        className="p-2.5 text-[11px] text-[#1a5c3a] font-bold text-center border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        See all results →
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col gap-2.5 p-3.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-2.5 p-2.5 bg-white rounded border border-[#ddd]">
              <div className="w-[90px] h-[66px] shim rounded"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded shim w-2/3 mb-1.5"></div>
                <div className="h-2.5 bg-gray-200 rounded shim w-1/3 mb-1.5"></div>
                <div className="h-2 bg-gray-200 rounded shim w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'businesses' ? (
        /* Businesses Tab content */
        <div className="p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
            {/* Direct listings filter category chips could go here, for simplicity we show all */}
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest py-1.5">
              All Businesses in {currentArea?.name}
            </div>
          </div>
          
          <a 
            href="https://partner.mypahad.in" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="block w-full bg-[#1a5c3a] text-white text-center py-2.5 px-4 rounded-lg text-xs font-bold mb-3 hover:bg-[#154c30] transition-colors shadow-sm"
          >
            Register as Business
          </a>
          
          <div className="flex flex-col gap-2">
            {bizResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">No businesses found.</div>
            ) : (
              bizResults.map(b => {
                const claimed = b.user_id !== null;
                return (
                  <div 
                    key={b.id} 
                    onClick={() => openProfile(b)}
                    className="bg-white rounded-lg border border-[#ddd] p-3 flex gap-2.5 hover:bg-[#e8f5ee] cursor-pointer transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-150 shrink-0 bg-gray-50 flex items-center justify-center">
                      {b.dp_url ? (
                        <img src={b.dp_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                        {claimed && (
                          <span className="inline-flex items-center justify-center bg-[#0095f6] text-white w-3 h-3 rounded-full shrink-0">
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </span>
                        )}
                        {b.business_name}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{b.categories?.name}</div>
                      {b.description && <div className="text-[10px] text-gray-500 mt-1 line-clamp-2">{b.description}</div>}
                    </div>
                    <span className="text-gray-400 text-sm shrink-0 self-center">›</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'search' && hasSearched ? (
        /* Results view */
        <div className="flex flex-col">
          {bizResults.length === 0 && lstResults.length === 0 && areaResults.length === 0 ? (
            /* Empty State fallback with explore */
            <div className="flex flex-col">
              <div className="text-center py-10 px-4 bg-white border-b border-[#ddd] mb-2.5 flex flex-col items-center">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" className="opacity-40 mb-2.5">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <p className="text-sm font-semibold text-gray-800">No results found for &quot;{query}&quot;</p>
                <small className="text-xs text-gray-400 mt-1">Try a different keyword or explore matching listings below</small>
              </div>
              
              {exploreListings.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3.5 mb-2">Explore in {currentArea?.name}</div>
                  {exploreListings.map(renderSrpRow)}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Show matching locations */}
              {areaResults.length > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest p-2 px-3.5 bg-gray-50 border-b border-gray-150">Locations ({areaResults.length})</div>
                  {areaResults.map(a => (
                    <div 
                      key={a.id} 
                      onClick={() => {
                        localStorage.setItem('mp_area', JSON.stringify(a));
                        router.push(`/${a.slug}`);
                      }}
                      className="flex gap-2.5 p-2.5 bg-white border-b border-gray-150 hover:bg-[#e8f5ee] cursor-pointer items-start"
                    >
                      <div className="w-[40px] h-[40px] rounded bg-[#e8f5ee] shrink-0 flex items-center justify-center border border-gray-200">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#1a5c3a] shrink-0">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-xs font-bold text-gray-800">{a.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{a.district}, {a.state}</div>
                      </div>
                      <span className="text-[9px] bg-gray-150 text-gray-400 px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">Town</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Show matching shops */}
              {bizResults.length > 0 && (
                <div className="mb-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest p-2 px-3.5 bg-gray-50 border-b border-gray-150">Businesses ({bizResults.length})</div>
                  {bizResults.map(b => {
                    const claimed = b.user_id !== null;
                    const isAllArea = currentArea?.slug === 'mypahad' || currentArea?.slug === 'all';
                    const townText = (isAllArea && b.areas?.slug !== 'mypahad' && b.areas?.slug !== 'all' && b.areas?.name) ? ` (in ${b.areas.name})` : '';
                    return (
                      <div 
                        key={b.id} 
                        onClick={() => openProfile(b)}
                        className="flex gap-2.5 p-2.5 bg-white border-b border-gray-100 hover:bg-[#e8f5ee] cursor-pointer items-start"
                      >
                        {b.dp_url ? (
                          <img src={b.dp_url} className="w-[52px] h-[52px] rounded-full object-cover shrink-0 bg-gray-50 border" alt="" />
                        ) : (
                          <div className="w-[52px] h-[52px] rounded-full bg-[#e8f5ee] shrink-0 flex items-center justify-center border border-gray-200">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="text-xs font-bold text-gray-800 flex items-center gap-1 flex-wrap">
                            {b.business_name}
                            {townText && <span className="text-[9.5px] font-normal text-gray-400">{townText}</span>}
                            {claimed && (
                              <span className="inline-flex items-center justify-center bg-[#0095f6] text-white w-3 h-3 rounded-full shrink-0">
                                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{b.categories?.name}</div>
                          {b.description && <div className="text-[9.5px] text-gray-500 line-clamp-2 mt-1 leading-normal">{b.description}</div>}
                          <span className="text-[9px] bg-gray-150 text-gray-400 px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">Shop</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Show matching listings */}
              {lstResults.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest p-2 px-3.5 bg-gray-50 border-b border-gray-150">Listings ({lstResults.length})</div>
                  {lstResults.map(renderSrpRow)}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Empty / Before Search Hint */
        <div className="text-center py-16 px-6 flex flex-col items-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" className="opacity-20 mb-3.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p className="text-xs text-gray-400">
            Type to search in <span className="font-semibold text-[#1a5c3a]">{currentArea?.name}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f0f0ee] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-8 h-8 rounded-full border-2 border-[#1a5c3a] border-t-transparent animate-spin mb-3"></div>
        <p className="text-xs text-gray-400">Loading Search...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

