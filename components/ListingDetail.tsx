'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, generateUUID, triggerNavigationStart } from '@/lib/supabase';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { getBusinessLink, getListingLink } from '@/lib/dbHelpers';

interface Area {
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
  username?: string | null;
  delivery_charges?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  areas?: {
    name: string;
    slug?: string;
  };
}

interface Listing {
  id: string;
  name: string;
  price: string | null;
  discount_price: string | null;
  image_url: string | null;
  description: string | null;
  is_available: boolean;
  business_id: string;
  qty_label: string | null;
  variants: any[] | null;
  booking_required: boolean;
  has_delivery: boolean;
  businesses?: Business;
}

const formatDescription = (desc: string | null) => {
  if (!desc) return null;
  
  const lines = desc.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  
  const flushList = (key: string) => {
    if (currentList.length > 0) {
      renderedElements.push(
        <ul key={key} className="list-none pl-0 my-2 flex flex-col gap-1.5">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(`list-${index}`);
      return;
    }

    // Check if it is a list item
    const listMatch = trimmed.match(/^[-*•+]\s+(.*)$/);
    if (listMatch) {
      const content = listMatch[1];
      currentList.push(
        <li key={`li-${index}`} className="flex items-start gap-2 text-xs md:text-sm text-gray-700">
          <span className="text-[#1a5c3a] font-bold text-sm leading-none mt-0.5">•</span>
          <span>{content}</span>
        </li>
      );
      return;
    }

    // Since it's not a list item, flush any accumulated list items first
    flushList(`list-${index}`);

    // Check if it is a key-value pair (e.g. "Duration: 5 Days", "Includes: Food, Guide")
    const kvMatch = trimmed.match(/^([^:\n]+)\s*:\s*([^:\n]+)$/);
    if (kvMatch && kvMatch[1].length < 25 && !trimmed.startsWith('http')) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      renderedElements.push(
        <div key={`kv-${index}`} className="flex justify-between items-center py-1 border-b border-gray-100 text-xs md:text-sm my-1">
          <span className="font-semibold text-gray-500">{key}</span>
          <span className="font-medium text-gray-800 text-right">{value}</span>
        </div>
      );
      return;
    }

    // Check if it is a heading/title block (starts with # or all caps and short)
    const isHeading = trimmed.startsWith('###') || trimmed.startsWith('##') || (trimmed.length < 35 && trimmed === trimmed.toUpperCase() && !trimmed.match(/[0-9:]/));
    if (isHeading) {
      const cleanHeading = trimmed.replace(/^#+\s*/, '');
      renderedElements.push(
        <h4 key={`h-${index}`} className="font-bold text-gray-900 text-xs md:text-sm mt-3 mb-1.5 uppercase tracking-wide border-b border-gray-100 pb-0.5">
          {cleanHeading}
        </h4>
      );
      return;
    }

    // Standard paragraph text
    renderedElements.push(
      <p key={`p-${index}`} className="text-xs md:text-sm text-gray-700 my-1 leading-relaxed whitespace-pre-wrap">
        {trimmed}
      </p>
    );
  });

  // Flush any trailing list items
  flushList(`list-final`);

  return <div className="space-y-1">{renderedElements}</div>;
};

interface ListingDetailProps {
  listing: Listing;
  relatedListings: Listing[];
}

export default function ListingDetail({ listing, relatedListings }: ListingDetailProps) {
  const router = useRouter();
  
  const biz = listing.businesses;
  const bizId = biz?.id || listing.business_id;
  const bizName = biz?.business_name || '';
  const townName = biz?.areas?.name || '';
  
  // State
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  
  const [sid, setSid] = useState('');
  const [whatsappHref, setWhatsappHref] = useState('#');
  const [whatsappDisabled, setWhatsappDisabled] = useState(true);
  const [otherBizCartWarning, setOtherBizCartWarning] = useState(false);
  const [miniCartClosed, setMiniCartClosed] = useState(false);
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
    // Generate/get Session ID
    let savedSid = localStorage.getItem('mp_sid');
    if (!savedSid) {
      savedSid = generateUUID();
      localStorage.setItem('mp_sid', savedSid);
    }
    setSid(savedSid);

    // Save product to view history
    localStorage.setItem('mp_view_lst', JSON.stringify(listing));
    
    // Set back-link default
    if (!localStorage.getItem('mp_lst_back')) {
      localStorage.setItem('mp_lst_back', '/');
    }

    // Analytics event
    let areaId = null;
    try {
      const areaObj = JSON.parse(localStorage.getItem('mp_area') || '{}');
      areaId = areaObj?.id || biz?.area_id;
    } catch (e) {
      areaId = biz?.area_id;
    }

    supabase.from('analytics').insert({
      area_id: areaId,
      event_type: 'listing_click',
      session_id: savedSid
    }).then(null, err => console.warn('Analytics failed:', err));

    // Load initial quantities from cart
    loadInitialQuantitiesFromCart();
  }, [listing]);

  // Recalculate WhatsApp link & Cart details when quantities or booking info change
  useEffect(() => {
    updateWhatsAppBtn();
    renderMiniCart();
    updateCartBadge();
  }, [quantities, bookingDate, bookingTime]);

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

  const fmtWa = (raw: string | null) => {
    if (!raw) return '';
    let n = String(raw).trim().replace(/\D/g, '');
    if (n.startsWith('91') && n.length === 12) n = n.slice(2);
    if (n.startsWith('0') && n.length === 11) n = n.slice(1);
    if (n.length !== 10) return '';
    return '91' + n;
  };

  const loadInitialQuantitiesFromCart = () => {
    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}

    const bizCart = cart[bizId];
    if (!bizCart || !bizCart.items) return;

    const initialQuants: Record<string, number> = {};
    const vars = listing.variants || [];

    if (vars.length > 0) {
      vars.forEach((v, idx) => {
        const vObj = typeof v === 'string' ? parseLegacyVariant(v) : v;
        const matchItems = bizCart.items.filter((item: any) => item.id === listing.id && item.variant === vObj.name);
        const totalQty = matchItems.reduce((acc: number, item: any) => acc + (parseInt(item.quantity) || 0), 0);
        initialQuants[`var-${idx}`] = totalQty;
      });
    } else {
      const matchItems = bizCart.items.filter((item: any) => item.id === listing.id && !item.variant);
      const totalQty = matchItems.reduce((acc: number, item: any) => acc + (parseInt(item.quantity) || 0), 0);
      initialQuants['main'] = totalQty;
    }
    
    setQuantities(initialQuants);

    const firstMatch = bizCart.items.find((item: any) => item.id === listing.id);
    if (firstMatch) {
      if (firstMatch.booking_date) setBookingDate(firstMatch.booking_date);
      if (firstMatch.booking_time) setBookingTime(firstMatch.booking_time);
    }
  };

  const parseLegacyVariant = (str: string) => {
    if (typeof str !== 'string') return str;
    try {
      let parsed = JSON.parse(str);
      while (parsed && typeof parsed === 'object') {
        if (parsed.name && typeof parsed.name === 'string' && (parsed.name.trim().startsWith('{') || parsed.name.trim().startsWith('['))) {
          try {
            const nested = JSON.parse(parsed.name);
            if (nested && typeof nested === 'object') {
              parsed = nested;
              continue;
            }
          } catch (e) {}
        }
        break;
      }
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {}
    
    let name = str;
    let price = 0;
    let discount_price = null;
    const match = str.match(/^(.*?)\s*[-–—:]\s*₹?\s*([0-9.]+)(?:\s*[-–—:]\s*₹?\s*([0-9.]+))?$/);
    if (match) {
      name = match[1].trim();
      price = parseFloat(match[2]) || 0;
      if (match[3]) {
        discount_price = parseFloat(match[3]) || null;
      }
    } else {
      const matchNoDash = str.match(/^(.*?)\s*₹?\s*([0-9.]+)$/);
      if (matchNoDash) {
        name = matchNoDash[1].trim();
        price = parseFloat(matchNoDash[2]) || 0;
      }
    }
    return { name, price, discount_price };
  };

  const adjustQty = (key: string, d: number) => {
    setQuantities(prev => {
      const val = prev[key] || 0;
      const nextVal = Math.max(0, val + d);
      const nextQuants = { ...prev, [key]: nextVal };
      
      // Save to localStorage immediately on change
      saveToCart(nextQuants);
      return nextQuants;
    });
    setMiniCartClosed(false);
  };

  const saveToCart = (currentQuants: Record<string, number>) => {
    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}

    if (!cart[bizId]) {
      cart[bizId] = {
        business_name: bizName,
        whatsapp: biz?.whatsapp || '',
        items: []
      };
    }

    const qtyLabel = listing.qty_label || 'Quantity';
    
    // Filter out previous instances of this listing in the cart
    cart[bizId].items = cart[bizId].items.filter((item: any) => item.id !== listing.id);

    const vars = listing.variants || [];
    if (vars.length > 0) {
      vars.forEach((v, idx) => {
        const q = currentQuants[`var-${idx}`] || 0;
        if (q > 0) {
          const vObj = typeof v === 'string' ? parseLegacyVariant(v) : v;
          const vPrice = (vObj.discount_price !== null && vObj.discount_price !== undefined) ? vObj.discount_price : vObj.price;
          cart[bizId].items.push({
            id: listing.id,
            name: listing.name,
            price: parsePrice(vPrice || listing.discount_price || listing.price),
            variant: vObj.name,
            quantity: q,
            qty_label: qtyLabel,
            booking_date: bookingDate,
            booking_time: bookingTime,
            has_delivery: listing.has_delivery
          });
        }
      });
    } else {
      const q = currentQuants['main'] || 0;
      if (q > 0) {
        cart[bizId].items.push({
          id: listing.id,
          name: listing.name,
          price: parsePrice(listing.discount_price || listing.price),
          variant: null,
          quantity: q,
          qty_label: qtyLabel,
          booking_date: bookingDate,
          booking_time: bookingTime,
          has_delivery: listing.has_delivery
        });
      }
    }

    if (cart[bizId].items.length === 0) {
      delete cart[bizId];
    }

    localStorage.setItem('mp_cart', JSON.stringify(cart));
  };

  const updateWhatsAppBtn = () => {
    const waNum = fmtWa(biz?.whatsapp || '');
    if (!waNum) {
      setWhatsappDisabled(true);
      return;
    }

    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}

    const bizCart = cart[bizId];
    let msg = '';

    if (bizCart && bizCart.items && bizCart.items.length > 0) {
      msg = `*New Order / Inquiry from MyPahad*\n\n`;
      bizCart.items.forEach((item: any, idx: number) => {
        msg += `${idx + 1}. *${item.name}*\n`;
        if (item.variant) msg += `   - Option: ${item.variant}\n`;
        if (item.booking_date) msg += `   - Booking Date/Time: ${item.booking_date} ${item.booking_time || 'Same Day'}\n`;
        msg += `   - Quantity: ${item.quantity} ${item.qty_label || 'Quantity'}\n`;
        msg += `   - Price: ₹${item.price || '—'}\n\n`;
      });
      if (biz?.delivery_charges) {
        msg += `Delivery Charges: ${biz.delivery_charges}\n\n`;
      }
      msg += `Please confirm availability. Thank you!`;
    } else {
      let selectionStr = '';
      const vars = listing.variants || [];
      if (vars.length > 0) {
        const parts: string[] = [];
        vars.forEach((v, idx) => {
          const q = quantities[`var-${idx}`] || 0;
          if (q > 0) {
            const vObj = typeof v === 'string' ? parseLegacyVariant(v) : v;
            parts.push(`${q} x ${vObj.name}`);
          }
        });
        selectionStr = parts.join(', ');
      } else {
        const q = quantities['main'] || 0;
        if (q > 0) {
          selectionStr = `${q} ${listing.qty_label || 'Quantity'}`;
        }
      }

      msg = `Hi *${bizName}*,\n\nI am interested in: *${listing.name}*`;
      if (selectionStr) {
        msg += ` (${selectionStr})`;
      }
      if (listing.discount_price || listing.price) {
        msg += ` – ${listing.discount_price || listing.price}`;
      }
      if (bookingDate) {
        msg += `\nBooking Date: ${bookingDate}`;
        if (bookingTime) msg += ` at ${bookingTime}`;
      }
      if (biz?.delivery_charges) {
        msg += `\nDelivery Charges: ${biz.delivery_charges}`;
      }
      msg += `\n\nI found you on MyPahad.in`;
    }

    setWhatsappHref(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`);
    setWhatsappDisabled(false);
  };

  const handleWhatsAppClick = () => {
    let areaId = null;
    try {
      const areaObj = JSON.parse(localStorage.getItem('mp_area') || '{}');
      areaId = areaObj?.id || biz?.area_id;
    } catch (e) {}

    supabase.from('analytics').insert({
      area_id: areaId,
      event_type: 'whatsapp_click',
      session_id: sid
    }).then(null, err => console.warn('Analytics failed:', err));
  };

  const renderMiniCart = () => {
    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}

    const otherBizIds = Object.keys(cart).filter(id => id !== String(bizId) && cart[id]?.items?.length > 0);
    setOtherBizCartWarning(otherBizIds.length > 0);

    const currentBizCart = cart[bizId];
    const items = currentBizCart?.items || [];
    setCartItems(miniCartClosed ? [] : items);
  };

  const updateCartBadge = () => {
    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}

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

    if (listing.id === itemId) {
      setQuantities(prev => {
        const nextQuants = { ...prev };
        if (variant) {
          const vars = listing.variants || [];
          vars.forEach((v, idx) => {
            const vObj = typeof v === 'string' ? parseLegacyVariant(v) : v;
            if (vObj.name === variant) {
              nextQuants[`var-${idx}`] = 0;
            }
          });
        } else {
          nextQuants['main'] = 0;
        }
        return nextQuants;
      });
    } else {
      // Force render refresh
      renderMiniCart();
      updateCartBadge();
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

  const buyMoreFromSeller = () => {
    triggerNavigationStart();
    saveToCart(quantities);
    const areaSlug = biz?.areas?.slug || '';
    const bizUsername = biz?.username || 'shop';
    localStorage.setItem('mp_view_biz', bizId);
    localStorage.setItem('mp_prof_back', getListingLink(bizUsername, generateSlug(listing.name), areaSlug));
    router.push(getBusinessLink(bizUsername, areaSlug));
  };

  const getSelectedCount = () => {
    let total = 0;
    const vars = listing.variants || [];
    if (vars.length > 0) {
      vars.forEach((_, idx) => {
        total += quantities[`var-${idx}`] || 0;
      });
    } else {
      total = quantities['main'] || 0;
    }
    return total;
  };

  // Rendering prices & discount badges
  const origPrice = parsePrice(listing.price);
  const discPrice = parsePrice(listing.discount_price);
  let discountBadge = null;
  if (origPrice > 0 && discPrice > 0 && origPrice > discPrice) {
    const pct = Math.round(((origPrice - discPrice) / origPrice) * 100);
    discountBadge = <span className="bg-[#e05a2b] text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-1">{pct}% OFF</span>;
  }

  const vars = listing.variants || [];

  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-8 font-sans">
      {/* Top Navbar */}
      <div className="bg-[#1a5c3a] p-2 px-3 flex items-center justify-between gap-2 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href={typeof window !== 'undefined' ? localStorage.getItem('mp_lst_back') || '/' : '/'} className="text-white text-base font-bold tracking-tight flex items-center gap-1.5" style={{ color: 'white' }}>
            <svg viewBox="0 0 690 690" className="w-6 h-6 text-white shrink-0" role="img" xmlns="http://www.w3.org/2000/svg">
              <polygon points="170,480 310,200 450,480" fill="currentColor" opacity="0.18" />
              <polygon points="310,480 460,240 610,480" fill="currentColor" opacity="0.30" />
              <polygon points="210,480 370,170 530,480" fill="currentColor" opacity="0.80" />
            </svg>
            <span>MyPahad</span>
          </Link>
          {townName && townName.toLowerCase() !== 'all' && townName.toLowerCase() !== 'mypahad' && townName.toLowerCase() !== 'other' && (
            <span className="text-[10px] text-white/70 border-l border-white/30 pl-2 leading-none">
              {townName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/search" className="text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </Link>
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
                  className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 font-sans"
                  style={{ color: '#374151' }}
                >
                  Login Business
                </a>
                <a 
                  href="https://partner.mypahad.in/index.html?tab=register" 
                  onClick={() => setBizMenuOpen(false)}
                  className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 border-t border-gray-150 font-sans"
                  style={{ color: '#374151' }}
                >
                  Register as a Business
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Listing Detail Body */}
      <div className="bg-[#f0f0ee] py-4 px-3.5 md:px-6 md:py-8 font-sans">
        <div className="max-w-[1200px] mx-auto bg-white rounded-xl shadow-sm border border-gray-150 p-4 md:p-8">
          <div className="md:grid md:grid-cols-2 md:gap-10 items-start">
            
            {/* Left Column: Image Display */}
            <div className="md:sticky md:top-20">
              <div className="relative mb-3 bg-white">
                {listing.image_url ? (
                  <img src={getOptimizedImageUrl(listing.image_url, 'detail')} alt={listing.name} className="w-full aspect-square object-cover rounded-lg border border-[#e5e7eb] shadow-sm max-h-[500px]" />
                ) : (
                  <div className="w-full aspect-square bg-[#e8f5ee] rounded-lg border border-[#e5e7eb] flex items-center justify-center max-h-[500px]">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                )}
                {listing.image_url && <div className="text-[8.5px] text-gray-400 mt-1 text-center italic opacity-75">*Image may not represent actual product</div>}
                
                {listing.has_delivery && (
                  <div className="absolute top-5 right-5 bg-[#1a5c3a]/90 text-white px-2 py-1 rounded text-[9px] font-bold shadow-md flex items-center gap-1 backdrop-blur-[2px]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13"/>
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    Home Delivery Available
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Title, Prices, Details, Options, Actions, and Sold By */}
            <div className="flex flex-col gap-4 mt-4 md:mt-0">
              <div>
                {/* Listing Title */}
                <h1 className="text-base md:text-2xl font-bold text-gray-900 leading-tight">{listing.name}</h1>
                
                {/* Pricing block */}
                {listing.discount_price ? (
                  <div className="flex items-center gap-2 mt-1.5 mb-2">
                    <span className="text-[#e05a2b] font-bold text-lg md:text-2xl">₹{listing.discount_price}</span>
                    <span className="line-through text-gray-400 text-sm md:text-base">₹{listing.price}</span>
                    {discountBadge}
                  </div>
                ) : (
                  listing.price && <div className="text-[#1a5c3a] font-bold text-lg md:text-2xl mt-1 mb-2">₹{listing.price}</div>
                )}
              </div>

              {/* Description */}
              {listing.description && (
                <div className="text-[12px] md:text-sm text-gray-600 leading-relaxed pt-2 border-t border-gray-100">
                  <div className={`relative transition-all duration-300 ${!isDescExpanded && listing.description.length > 180 ? 'max-h-[140px] overflow-hidden' : 'max-h-none'}`}>
                    {formatDescription(listing.description)}
                    {!isDescExpanded && listing.description.length > 180 && (
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                    )}
                  </div>
                  {listing.description.length > 180 && (
                    <button
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="text-[#1a5c3a] font-bold text-[11px] hover:underline bg-none border-none p-0 mt-2 cursor-pointer block"
                    >
                      {isDescExpanded ? 'Read Less' : 'Read More'}
                    </button>
                  )}
                </div>
              )}

              {/* Booking required fields */}
              {listing.booking_required && (
                <div className="p-3 bg-[#e8f5ee] border border-[#ddd] rounded-lg">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Booking Information Required</div>
                  <div className="flex gap-2.5">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 font-semibold mb-1 block">Date</label>
                      <input 
                        type="date" 
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full p-2 border border-[#ddd] rounded text-xs" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 font-semibold mb-1 block">Time</label>
                      <input 
                        type="time" 
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        className="w-full p-2 border border-[#ddd] rounded text-xs" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quantities & Options Selector */}
              {vars.length > 0 ? (
                <div className="mt-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Options / Sizes (Select Quantity)</div>
                  <div className="flex flex-col gap-2">
                    {vars.map((v, idx) => {
                      const vObj = typeof v === 'string' ? parseLegacyVariant(v) : v;
                      const qtyVal = quantities[`var-${idx}`] || 0;
                      
                      let optionPriceText = null;
                      if (vObj.discount_price !== null && vObj.discount_price !== undefined) {
                        const o = parseFloat(vObj.price) || 0;
                        const d = parseFloat(vObj.discount_price) || 0;
                        let offBadge = null;
                        if (o > 0 && d > 0 && o > d) {
                          const pct = Math.round(((o - d) / o) * 100);
                          offBadge = <span className="bg-[#e05a2b] text-white text-[7px] font-bold px-1 py-0.5 rounded ml-1">{pct}% OFF</span>;
                        }
                        optionPriceText = (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[#e05a2b] font-bold text-[11px]">₹{vObj.discount_price}</span>
                            <span className="line-through text-gray-400 text-[10px]">₹{vObj.price}</span>
                            {offBadge}
                          </div>
                        );
                      } else if (vObj.price) {
                        optionPriceText = <div className="text-gray-500 font-semibold text-[11px]">₹{vObj.price}</div>;
                      }

                      return (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-none">
                          <div>
                            <div className="text-xs font-semibold text-gray-700">{vObj.name}</div>
                            {optionPriceText}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => adjustQty(`var-${idx}`, -1)} className="w-6 h-6 rounded-full border border-[#ddd] bg-white flex items-center justify-center text-xs font-bold active:bg-gray-100">-</button>
                            <span className="text-xs font-semibold w-4 text-center">{qtyVal}</span>
                            <button onClick={() => adjustQty(`var-${idx}`, 1)} className="w-6 h-6 rounded-full border border-[#ddd] bg-white flex items-center justify-center text-xs font-bold active:bg-gray-100">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center p-2.5 bg-[#e8f5ee] rounded-lg">
                  <span className="text-xs font-bold text-gray-700">{listing.qty_label || 'Quantity'}</span>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => adjustQty('main', -1)} className="w-6 h-6 rounded-full border border-[#ddd] bg-white flex items-center justify-center text-xs font-bold active:bg-gray-100">-</button>
                    <span className="text-xs font-semibold w-4 text-center">{quantities['main'] || 0}</span>
                    <button onClick={() => adjustQty('main', 1)} className="w-6 h-6 rounded-full border border-[#ddd] bg-white flex items-center justify-center text-xs font-bold active:bg-gray-100">+</button>
                  </div>
                </div>
              )}
              
              {/* Inline Actions Row (Cart & Buy Now) */}
              <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-gray-150">
                {/* Warning Banner */}
                {otherBizCartWarning && (
                  <div className="bg-[#fffcf6] border border-[#ffeeba] rounded-lg p-2.5 text-[10px] text-[#856404] leading-tight flex items-start gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#856404] shrink-0 mt-0.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span><strong>Not the same business!</strong> You have items in your cart from another business. Buying this will start a new cart list.</span>
                  </div>
                )}
                
                {/* Mini Cart Display */}
                {cartItems.length > 0 && !miniCartClosed && (
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200 flex flex-col gap-1.5 max-h-[140px] overflow-y-auto mb-2">
                    <div className="flex justify-between items-center pb-1.5 border-b border-gray-200 mb-1">
                      <span className="text-[10px] font-bold text-[#1a5c3a] flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                        Current Cart Items
                      </span>
                      <button onClick={() => setMiniCartClosed(true)} className="text-gray-400 hover:text-gray-600 font-bold text-xs px-1">&times;</button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {cartItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] py-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <button onClick={(e) => removeMiniCartItem(e, item.id, item.variant)} className="text-[#e05a2b] font-bold text-sm px-1">&times;</button>
                            <span 
                              onClick={() => {
                                if (item.id !== listing.id) {
                                  triggerNavigationStart();
                                  router.push(`/listing/${item.id}`);
                                }
                              }}
                              className={`truncate font-medium ${item.id !== listing.id ? 'underline text-[#1a5c3a] cursor-pointer' : 'text-gray-700'}`}
                            >
                              {item.name} {item.variant ? `(${item.variant})` : ''}
                            </span>
                          </div>
                          <span className="font-bold text-[#1a5c3a] shrink-0 ml-2">₹{item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => {
                      let updatedQuants = { ...quantities };
                      const totalCount = getSelectedCount();
                      if (totalCount === 0) {
                        if (vars.length > 0) {
                          updatedQuants['var-0'] = 1;
                        } else {
                          updatedQuants['main'] = 1;
                        }
                        setQuantities(updatedQuants);
                      }
                      saveToCart(updatedQuants);
                      updateWhatsAppBtn();
                      renderMiniCart();
                      updateCartBadge();
                    }}
                    className="flex-1 bg-white text-[#1a5c3a] border border-[#1a5c3a] p-2.5 rounded-lg text-xs font-bold text-center hover:bg-[#e8f5ee] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Add to Cart
                  </button>
                  
                  {biz?.whatsapp === 'mypahad' ? (
                    <button
                      onClick={() => {
                        saveToCart(quantities);
                        let cart: any = {};
                        try { cart = JSON.parse(localStorage.getItem('mp_cart') || '{}'); } catch(e){}
                        const bizData = cart[bizId];
                        let items = bizData?.items || [];
                        
                        if (items.length === 0) {
                          const qtyLabel = listing.qty_label || 'Quantity';
                          const priceVal = parsePrice(listing.discount_price || listing.price);
                          items = [{
                            id: listing.id,
                            name: listing.name,
                            price: priceVal,
                            variant: null,
                            quantity: 1,
                            qty_label: qtyLabel,
                            booking_date: bookingDate || null,
                            booking_time: bookingTime || null,
                            has_delivery: listing.has_delivery
                          }];
                        }
                        
                        const params = new URLSearchParams();
                        params.set('biz_id', bizId);
                        params.set('biz_name', bizName);
                        params.set('biz_town', townName);
                        params.set('biz_delivery_charges', biz?.delivery_charges || '0');
                        if (biz?.latitude) params.set('biz_latitude', String(biz.latitude));
                        if (biz?.longitude) params.set('biz_longitude', String(biz.longitude));
                        params.set('biz_whatsapp', biz?.whatsapp || '');
                        if (biz?.dp_url) params.set('biz_dp', biz.dp_url);
                        params.set('biz_username', biz?.username || '');
                        params.set('biz_area_slug', biz?.areas?.slug || '');
                        params.set('items', JSON.stringify(items));
                        
                        window.location.href = `https://chat.mypahad.in?${params.toString()}`;
                      }}
                      className="flex-1 bg-[#1a5c3a] hover:bg-[#154a2e] text-white p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Buy Now (Order Chat)
                    </button>
                  ) : (
                    <a 
                      href={whatsappHref} 
                      onClick={(e) => {
                        saveToCart(quantities);
                        handleWhatsAppClick();
                      }}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`flex-1 bg-[#1a5c3a] text-white p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer ${whatsappDisabled ? 'opacity-40 pointer-events-none' : ''}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                      </svg>
                      <span>Buy Now (Order from WhatsApp)</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Sold By Info Box */}
              {biz && (
                <div className="bg-white border border-[#ddd] p-3 rounded-lg mt-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sold By</div>
                  <div 
                    onClick={() => {
                      triggerNavigationStart();
                      const areaSlug = biz?.areas?.slug || '';
                      const bizUsername = biz?.username || 'shop';
                      localStorage.setItem('mp_view_biz', bizId);
                      localStorage.setItem('mp_prof_back', getListingLink(bizUsername, generateSlug(listing.name), areaSlug));
                      router.push(getBusinessLink(bizUsername, areaSlug));
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg border border-[#eee] hover:bg-[#e8f5ee] cursor-pointer transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-[#ddd] shrink-0 bg-gray-50 flex items-center justify-center">
                      {biz.dp_url ? (
                        <img src={getOptimizedImageUrl(biz.dp_url, 'dp')} className="w-full h-full object-cover" alt={bizName} />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800 truncate">{bizName}</div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">
                        {townName && townName.toLowerCase() !== 'all' && townName.toLowerCase() !== 'mypahad' && townName.toLowerCase() !== 'other' ? `${townName} · ` : ''}View profile →
                      </div>
                    </div>
                    <span className="text-gray-400 text-sm">›</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedListings.length > 0 && (
        <div className="bg-white border-t-4 border-[#f0f0ee] py-3.5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3.5 mb-2">More like this</div>
          <div className="flex gap-2 overflow-x-auto px-3.5 pb-2 no-scrollbar">
            {relatedListings.map(r => (
              <div 
                key={r.id} 
                onClick={async () => {
                  triggerNavigationStart();
                  localStorage.setItem('mp_view_lst', JSON.stringify(r));
                  const areaSlug = biz?.areas?.slug || '';
                  let rUsername = r.businesses?.username;
                  let rAreaSlug = r.businesses?.areas?.slug;
                  if (!rUsername || !rAreaSlug) {
                    const { data: b } = await supabase
                      .from('businesses')
                      .select('username, areas(slug)')
                      .eq('id', r.business_id)
                      .single();
                    if (b) {
                      rUsername = b.username || 'shop';
                      rAreaSlug = (b.areas as any)?.slug || areaSlug;
                    }
                  }
                  router.push(getListingLink(rUsername, generateSlug(r.name), rAreaSlug || areaSlug));
                }}
                className="shrink-0 w-[110px] bg-white rounded-lg border border-[#ddd] overflow-hidden cursor-pointer shadow-sm hover:border-[#1a5c3a] transition-colors"
              >
                {r.image_url ? (
                  <img src={getOptimizedImageUrl(r.image_url, 'card')} className="w-full aspect-square object-cover" alt={r.name} loading="lazy" />
                ) : (
                  <div className="w-full aspect-square bg-[#e8f5ee] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                  </div>
                )}
                <div className="p-1 px-1.5">
                  <div className="text-[10px] font-medium line-clamp-2 leading-tight h-[26px]">
                    {r.name}
                  </div>
                  {renderPrice(r)}
                  {r.businesses?.business_name && (
                    <div className="text-[8px] text-gray-400 truncate mt-0.5">{r.businesses.business_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
