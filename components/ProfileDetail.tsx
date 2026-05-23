'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, generateUUID } from '@/lib/supabase';

interface Area {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Business {
  id: string;
  business_name: string;
  whatsapp: string | null;
  dp_url: string | null;
  area_id: string | null;
  is_approved: boolean;
  is_active: boolean;
  category_id: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  user_id: string | null;
  hearts: number;
  description: string | null;
  address: string | null;
  username?: string | null;
  areas?: {
    name: string;
    slug: string;
  };
  categories?: {
    name: string;
  };
}

interface BusinessPhoto {
  id: string;
  business_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
}

interface Listing {
  id: string;
  name: string;
  price: string | null;
  discount_price: string | null;
  image_url: string | null;
  description: string | null;
  is_available: boolean;
}

interface ProfileDetailProps {
  business: Business;
  photos: BusinessPhoto[];
  initialListings: Listing[];
  initialHearts: boolean;
}

export default function ProfileDetail({ business, photos, initialListings, initialHearts }: ProfileDetailProps) {
  const router = useRouter();
  
  const bizId = business.id;
  const bizName = business.business_name;
  const townName = business.areas?.name || '';
  
  // State
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialListings.length === 9);
  const [loading, setLoading] = useState(false);
  const [hasHearted, setHasHearted] = useState(initialHearts);
  const [heartsCount, setHeartsCount] = useState(business.hearts || 0);
  
  // Cart
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [otherBizWarning, setOtherBizWarning] = useState(false);
  const [miniCartClosed, setMiniCartClosed] = useState(false);
  
  // Stories & Photo overlays
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const [storyElapsed, setStoryElapsed] = useState(0);
  const [storyPaused, setStoryPaused] = useState(false);
  
  const [toastMsg, setToastMsg] = useState('');
  const [sid, setSid] = useState('');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const storyDuration = 15000;

  const triggerToast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(''), 2400);
  };

  useEffect(() => {
    // Generate/get Session ID
    let savedSid = localStorage.getItem('mp_sid');
    if (!savedSid) {
      savedSid = generateUUID();
      localStorage.setItem('mp_sid', savedSid);
    }
    setSid(savedSid);

    // Save profile to history
    localStorage.setItem('mp_view_biz', bizId);
    
    // Set default back link
    if (!localStorage.getItem('mp_prof_back')) {
      localStorage.setItem('mp_prof_back', '/');
    }

    // Analytics event
    let areaId = null;
    try {
      const areaObj = JSON.parse(localStorage.getItem('mp_area') || '{}');
      areaId = areaObj?.id || business.area_id;
    } catch (e) {
      areaId = business.area_id;
    }

    supabase.from('analytics').insert({
      area_id: areaId,
      business_id: bizId,
      event_type: 'business_view',
      session_id: savedSid
    }).then(null, err => console.warn('Analytics failed:', err));

    // Infinite scroll listener
    window.addEventListener('scroll', handleScroll);
    
    // Cart details
    updateCartDetails();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [bizId]);

  // React to cart state
  useEffect(() => {
    updateCartDetails();
  }, [miniCartClosed]);

  const updateCartDetails = () => {
    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}

    // Check other business additions
    const otherBizIds = Object.keys(cart).filter(id => id !== String(bizId) && cart[id]?.items?.length > 0);
    setOtherBizWarning(otherBizIds.length > 0);

    // Cart items for this business
    const items = cart[bizId]?.items || [];
    setCartItems(miniCartClosed ? [] : items);

    // Total Cart Count
    let totalCount = 0;
    Object.keys(cart).forEach(bid => {
      if (cart[bid]?.items) {
        cart[bid].items.forEach((item: any) => {
          totalCount += parseInt(item.quantity) || 0;
        });
      }
    });
    setCartCount(totalCount);
  };

  const handleScroll = () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100) {
      loadMoreListings();
    }
  };

  const loadMoreListings = async () => {
    if (!hasMore || loading) return;
    setLoading(true);

    const start = page * 9;
    const end = start + 8;

    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('business_id', bizId)
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (error || !data || data.length === 0) {
        setHasMore(false);
      } else {
        if (data.length < 9) setHasMore(false);
        setListings(prev => [...prev, ...data]);
        setPage(p => p + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fmtWa = (raw: string | null) => {
    if (!raw) return '';
    let n = String(raw).trim().replace(/\D/g, '');
    if (n.startsWith('91') && n.length === 12) n = n.slice(2);
    if (n.startsWith('0') && n.length === 11) n = n.slice(1);
    if (n.length !== 10) return '';
    return '91' + n;
  };

  const shareProfile = async () => {
    const areaSlug = business.areas?.slug || 'town';
    const bizUsername = business.username || 'shop';
    const url = `${window.location.origin}/${bizUsername}-in-${areaSlug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: bizName,
          text: `Check out ${bizName} on MyPahad!`,
          url
        });
      } catch (e) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        triggerToast('Link copied!');
      } catch (e) {
        triggerToast('Share: ' + url);
      }
    }
  };

  const toggleHeart = async () => {
    const was = hasHearted;
    setHasHearted(!was);
    setHeartsCount(c => c + (was ? -1 : 1));

    if (was) {
      await supabase.from('hearts').delete().eq('business_id', bizId).eq('session_id', sid);
      await supabase.rpc('decrement_hearts', { biz_id: bizId });
    } else {
      await supabase.from('hearts').insert({ business_id: bizId, session_id: sid });
      await supabase.rpc('increment_hearts', { biz_id: bizId });
    }
  };

  // Cart action
  const removeMiniCartItem = (event: React.MouseEvent, itemId: string, variant: string | null) => {
    event.stopPropagation();
    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}

    const bizCart = cart[bizId];
    if (bizCart && bizCart.items) {
      bizCart.items = bizCart.items.filter((item: any) => !(item.id === itemId && (item.variant || '') === (variant || '')));
      if (bizCart.items.length === 0) {
        delete cart[bizId];
      }
      localStorage.setItem('mp_cart', JSON.stringify(cart));
    }
    updateCartDetails();
  };

  const sendCartToWhatsApp = () => {
    let cart: any = {};
    try { cart = JSON.parse(localStorage.getItem('mp_cart') || '{}'); } catch(e){}
    const bizData = cart[bizId];
    if (!bizData) return;

    let msg = `*New Order / Inquiry from MyPahad*\n\n`;
    bizData.items.forEach((item: any, idx: number) => {
      msg += `${idx + 1}. *${item.name}*\n`;
      if (item.variant) msg += `   - Variant: ${item.variant}\n`;
      if (item.booking_date) msg += `   - Booking Date/Time: ${item.booking_date} ${item.booking_time || 'Same Day'}\n`;
      msg += `   - Quantity: ${item.quantity} ${item.qty_label || 'Quantity'}\n`;
      msg += `   - Price: ₹${item.price || '—'}\n\n`;
    });
    msg += `Please confirm availability. Thank you!`;

    supabase.from('analytics').insert({
      business_id: bizId,
      event_type: 'whatsapp_click',
      session_id: sid
    }).then(null, err => console.warn('Analytics failed:', err));

    const waNum = fmtWa(business.whatsapp);
    if (waNum) {
      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  // Story Loops
  useEffect(() => {
    if (activeStoryIdx !== null) {
      startTimeRef.current = performance.now();
      elapsedRef.current = 0;
      setStoryElapsed(0);
      
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(storyLoop);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [activeStoryIdx, storyPaused]);

  const storyLoop = () => {
    if (storyPaused) {
      animationRef.current = requestAnimationFrame(storyLoop);
      return;
    }

    const now = performance.now();
    const elapsed = now - startTimeRef.current + elapsedRef.current;
    const pct = Math.min((elapsed / storyDuration) * 100, 100);
    setStoryElapsed(pct);

    if (elapsed >= storyDuration) {
      nextStory();
    } else {
      animationRef.current = requestAnimationFrame(storyLoop);
    }
  };

  const nextStory = () => {
    if (activeStoryIdx === null) return;
    if (activeStoryIdx + 1 < photos.length) {
      elapsedRef.current = 0;
      setActiveStoryIdx(activeStoryIdx + 1);
    } else {
      closeStories();
    }
  };

  const prevStory = () => {
    if (activeStoryIdx === null) return;
    if (activeStoryIdx - 1 >= 0) {
      elapsedRef.current = 0;
      setActiveStoryIdx(activeStoryIdx - 1);
    } else {
      // Loop to 0
      elapsedRef.current = 0;
      setActiveStoryIdx(0);
    }
  };

  const closeStories = () => {
    setActiveStoryIdx(null);
    document.body.style.overflow = '';
  };

  const handleStoryPress = () => {
    setStoryPaused(true);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    elapsedRef.current += performance.now() - startTimeRef.current;
  };

  const handleStoryRelease = (clientX: number) => {
    setStoryPaused(false);
    startTimeRef.current = performance.now();
    
    // Check if was quick press
    const screenWidth = window.innerWidth;
    if (clientX < screenWidth / 2) {
      prevStory();
    } else {
      nextStory();
    }
  };

  const parsePriceVal = (p: string | null) => {
    if (!p) return 0;
    const cleaned = String(p).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
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

  const openProductDetail = (l: Listing) => {
    const areaSlug = business.areas?.slug || 'town';
    const bizUsername = business.username || 'shop';
    localStorage.setItem('mp_view_lst', JSON.stringify(l));
    localStorage.setItem('mp_lst_back', `/${bizUsername}-in-${areaSlug}`);
    router.push(`/${bizUsername}-${generateSlug(l.name)}-in-${areaSlug}`);
  };

  const claimed = business.user_id !== null;
  const waNum = fmtWa(business.whatsapp);
  const waMsg = `Hi *${business.business_name}*,\n\nI found you on MyPahad.in!`;
  const waHref = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}` : '';

  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-[70px] font-sans">
      {toastMsg && <div id="toast" style={{ display: 'block' }}>{toastMsg}</div>}

      {/* Stories Viewer Modal */}
      {activeStoryIdx !== null && photos[activeStoryIdx] && (
        <div id="story-overlay" className="fixed inset-0 bg-black z-[1000] flex flex-col justify-center items-center select-none">
          {/* Progress bar tracks */}
          <div className="absolute top-3 left-3 right-3 display flex gap-1 z-[1010]">
            {photos.map((_, i) => (
              <div key={i} className="flex-1 h-1 bg-white/30 rounded overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-75"
                  style={{
                    width: i < activeStoryIdx ? '100%' : i > activeStoryIdx ? '0%' : `${storyElapsed}%`
                  }}
                ></div>
              </div>
            ))}
          </div>

          {/* Stories Header details */}
          <div className="absolute top-7 left-3 right-3 flex items-center justify-between z-[1010] text-white">
            <div className="flex items-center gap-2">
              {business.dp_url && <img src={business.dp_url} className="w-8 h-8 rounded-full object-cover border border-white/50" />}
              <div className="flex flex-col">
                <span className="text-xs font-bold shadow-sm">{bizName}</span>
                <span className="text-[10px] text-gray-300 truncate max-w-[200px]">
                  {photos[activeStoryIdx].caption || 'Photo Highlight'}
                </span>
              </div>
            </div>
            <button onClick={closeStories} className="bg-none border-none text-white text-3xl p-1 cursor-pointer font-light">&times;</button>
          </div>

          {/* Story Image container */}
          <div 
            className="w-full h-full flex items-center justify-center cursor-pointer"
            onMouseDown={handleStoryPress}
            onMouseUp={(e) => handleStoryRelease(e.clientX)}
            onTouchStart={handleStoryPress}
            onTouchEnd={(e) => handleStoryRelease(e.changedTouches[0].clientX)}
          >
            <img src={photos[activeStoryIdx].url} className="max-w-full max-h-full object-contain" alt="Story" />
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <div className="bg-[#1a5c3a] p-2 px-3 flex items-center justify-between gap-2 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href={typeof window !== 'undefined' ? localStorage.getItem('mp_prof_back') || '/' : '/'} className="text-white text-base font-bold tracking-tight">
            MyPahad
          </Link>
          {townName && (
            <span className="text-[10px] text-white/70 border-l border-white/30 pl-2 leading-none">
              {townName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={shareProfile} className="bg-white/16 text-white border-none px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
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
        </div>
      </div>

      {/* Seller Hero Section */}
      <div className="bg-white p-3 border-b border-gray-200">
        <div className="flex gap-3.5 items-start">
          {business.dp_url ? (
            <img src={business.dp_url} className="w-14 h-14 rounded-full border-2 border-[#1a5c3a] object-cover shrink-0" alt={bizName} />
          ) : (
            <div className="w-14 h-14 rounded-full border-2 border-[#1a5c3a] bg-gray-50 flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="text-[15px] font-bold text-gray-800 flex items-center gap-1 flex-wrap leading-tight">
                {claimed && (
                  <span className="inline-flex items-center justify-center bg-[#0095f6] text-white w-3.5 h-3.5 rounded-full" title="Verified Business">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </span>
                )}
                {bizName}
              </div>
              <button 
                onClick={toggleHeart}
                className={`shrink-0 flex items-center gap-1 text-[11px] p-1 px-2 border rounded-full transition-colors ${hasHearted ? 'text-red-500 border-red-500 bg-red-50/20' : 'text-gray-500 border-gray-200 bg-white'}`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={hasHearted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>{heartsCount}</span>
              </button>
            </div>
            
            <div className="text-[10px] text-gray-400 mt-0.5">
              {business.categories?.name} · {townName}
            </div>
          </div>
        </div>

        {/* Business details description */}
        {business.description && (
          <p className="text-[11px] text-gray-600 leading-relaxed mt-2.5">
            {business.description}
          </p>
        )}

        {/* Address */}
        {business.address && (
          <div className="text-[10px] text-gray-400 mt-2 flex items-start gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {business.address}
          </div>
        )}

        {/* Actions Button Strip */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {waHref ? (
            <a 
              href={waHref} 
              target="_blank" 
              onClick={() => {
                supabase.from('analytics').insert({
                  area_id: business.area_id,
                  event_type: 'whatsapp_click',
                  session_id: sid
                }).then(null, err => console.warn('Analytics failed:', err));
              }}
              className="bg-[#25d366] text-white border-none py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1 hover:bg-[#20ba5a] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
              </svg>
              WhatsApp
            </a>
          ) : (
            <button className="bg-gray-100 text-gray-400 py-1.5 px-3 rounded text-xs font-semibold" disabled>
              No WhatsApp
            </button>
          )}

          {business.instagram && (
            <a href={`https://instagram.com/${business.instagram}`} target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 py-1.5 px-3 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Instagram
            </a>
          )}
          {business.facebook && (
            <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 py-1.5 px-3 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Facebook
            </a>
          )}
          {business.website && (
            <a href={business.website} target="_blank" rel="noopener noreferrer" className="bg-white border border-gray-200 py-1.5 px-3 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Website
            </a>
          )}
        </div>
      </div>

      {/* Profile claims text */}
      {!claimed && (
        <div className="p-2.5 px-3 text-[9.5px] text-gray-400 text-center bg-white border-b border-gray-100 leading-normal">
          Directory compilation from public records; actual products & pricing may vary. Is this your business?{' '}
          <Link href="/partner" className="text-[#1a5c3a] font-semibold underline">Claim profile</Link> or{' '}
          <a href="https://wa.me/917876602575?text=Please%20remove%20my%20listing" className="text-[#1a5c3a] font-semibold underline" target="_blank" rel="noreferrer">
            request removal
          </a>.
        </div>
      )}

      {/* Photo highlights list */}
      {photos.length > 0 && (
        <div className="flex gap-3 overflow-x-auto p-2.5 px-3.5 bg-white border-b border-gray-200 no-scrollbar">
          {photos.map((p, i) => (
            <div key={p.id} onClick={() => setActiveStoryIdx(i)} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer">
              <div className="w-12 h-12 rounded-full border-2 border-[#1a5c3a] p-0.5 bg-white overflow-hidden shrink-0">
                <img src={p.url} className="w-full h-full rounded-full object-cover" alt="Highlight" />
              </div>
              <span className="text-[9px] text-gray-600 max-w-[48px] text-center truncate">{p.caption || 'Photo'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Products list grid */}
      <div className="bg-white border-t-[5px] border-[#f0f0ee]">
        <div className="flex items-center justify-between p-2.5 px-3.5">
          <span className="text-[12px] font-bold text-gray-800">Products & Services</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 px-3.5">
          {listings.map(l => {
            const orig = parsePriceVal(l.price);
            const disc = parsePriceVal(l.discount_price);
            
            let priceTextHtml = null;
            if (l.discount_price) {
              let offPctSpan = null;
              if (orig > 0 && disc > 0 && orig > disc) {
                const pct = Math.round(((orig - disc) / orig) * 100);
                offPctSpan = <span className="bg-[#e05a2b] text-white text-[7px] font-bold px-1 py-0.5 rounded ml-1">{pct}% OFF</span>;
              }
              priceTextHtml = (
                <div className="text-[#e05a2b] text-[10px] font-bold mt-0.5">
                  {l.discount_price}{' '}
                  <span className="line-through text-gray-400 text-[8px] font-normal">{l.price}</span>
                  {offPctSpan}
                </div>
              );
            } else if (l.price) {
              priceTextHtml = <div className="text-[#1a5c3a] text-[10px] font-bold mt-0.5">{l.price}</div>;
            }

            return (
              <div 
                key={l.id} 
                onClick={() => openProductDetail(l)}
                className="bg-white rounded-lg border border-[#ddd] overflow-hidden cursor-pointer shadow-sm"
              >
                {l.image_url ? (
                  <img src={l.image_url} className="w-full aspect-square object-cover" alt={l.name} loading="lazy" />
                ) : (
                  <div className="w-full aspect-square bg-[#e8f5ee] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                  </div>
                )}
                <div className="p-1 px-1.5">
                  <div className="text-[10px] font-medium line-clamp-2 leading-tight h-[26px]">
                    {l.name}
                  </div>
                  {priceTextHtml}
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="text-center py-4 text-[11px] text-gray-500">Loading more items...</div>
        )}
      </div>

      {/* Sticky Bottom Actions footer */}
      <div id="profile-sticky-footer" className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#ddd] p-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0))] flex flex-col gap-2 z-50 shadow-lg">
        {/* Warning Banner */}
        {otherBizWarning && (
          <div className="bg-[#fffcf6] border border-[#ffeeba] rounded p-2 text-[10px] text-[#856404] leading-tight mx-2">
            ⚠️ <strong>Not the same business!</strong> You have items in your cart from another business. Buying this will start a new cart list.
          </div>
        )}

        {/* Mini Cart Display */}
        {cartItems.length > 0 && (
          <div className="bg-white border-b border-gray-100 pb-2 flex flex-col gap-1.5 max-h-[140px] overflow-y-auto px-2">
            <div className="flex justify-between items-center pb-1.5 border-b border-gray-100 mb-1">
              <div className="flex items-center gap-1.5">
                <button onClick={() => setMiniCartClosed(true)} className="text-gray-400 hover:text-gray-600 font-bold text-sm px-1">&times;</button>
                <span className="text-[10px] font-bold text-[#1a5c3a] flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  Current Cart Items
                </span>
              </div>
              <button 
                onClick={sendCartToWhatsApp}
                className="bg-[#1a5c3a] text-white border-none px-2 py-1 rounded text-[10px] font-semibold hover:bg-[#154c30] transition-colors"
              >
                Send Order
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {cartItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-[10px] py-0.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <button onClick={(e) => removeMiniCartItem(e, item.id, item.variant)} className="text-[#e05a2b] font-bold text-sm px-1">&times;</button>
                    <span 
                      onClick={() => router.push(`/listing/${item.id}`)}
                      className="truncate font-medium underline text-[#1a5c3a] cursor-pointer"
                    >
                      {item.name} {item.variant ? `(${item.variant})` : ''}
                    </span>
                  </div>
                  <span className="font-bold text-[#1a5c3a] shrink-0 ml-2">{item.quantity} x ₹{item.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <nav className="flex z-50 pb-safe">
          <Link href={`/${business.areas?.slug || ''}`} className="flex-1 flex flex-col items-center justify-center py-1 text-[9px] gap-0.5 text-gray-400 bg-none border-none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            Home
          </Link>
          <Link href="/search" className="flex-1 flex flex-col items-center justify-center py-1 text-[9px] gap-0.5 text-gray-400 bg-none border-none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Search
          </Link>
          <Link href="/search?tab=businesses" className="flex-1 flex flex-col items-center justify-center py-1 text-[9px] gap-0.5 text-gray-400 bg-none border-none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            Businesses
          </Link>
        </nav>
      </div>
    </div>
  );
}
