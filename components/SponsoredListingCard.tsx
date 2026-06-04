'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { getListingLink } from '@/lib/dbHelpers';

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
    username?: string | null;
  };
}

interface SponsoredListingCardProps {
  ad: {
    id: string;
    area_id: string | null;
    business_id: string | null;
    listings: Listing;
  };
  areaSlug: string;
}

export default function SponsoredListingCard({ ad, areaSlug }: SponsoredListingCardProps) {
  const router = useRouter();
  const listing = ad.listings;
  
  if (!listing) return null;

  useEffect(() => {
    // Record impression
    const savedSid = localStorage.getItem('mp_sid') || '';
    supabase.from('analytics').insert({
      area_id: ad.area_id || null,
      business_id: ad.business_id || null,
      event_type: 'ad_impression',
      ad_id: ad.id,
      session_id: savedSid
    }).then(null, err => console.warn('Ad impression analytics failed:', err));
  }, [ad]);

  const handleAdClick = async (e: React.MouseEvent) => {
    const savedSid = localStorage.getItem('mp_sid') || '';
    // Record click
    await supabase.from('analytics').insert({
      area_id: ad.area_id || null,
      business_id: ad.business_id || null,
      event_type: 'ad_click',
      ad_id: ad.id,
      session_id: savedSid
    }).then(null, err => console.warn('Ad click analytics failed:', err));

    localStorage.setItem('mp_view_lst', JSON.stringify(listing));
    localStorage.setItem('mp_lst_back', window.location.pathname);
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

  const getProductHref = () => {
    const bizUsername = listing.businesses?.username || 'shop';
    const prodSlug = generateSlug(listing.name);
    return getListingLink(bizUsername, prodSlug, areaSlug);
  };

  const parsePrice = (p: string | null) => {
    if (!p) return 0;
    const cleaned = String(p).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const renderPrice = () => {
    const orig = parsePrice(listing.price);
    const disc = parsePrice(listing.discount_price);

    if (listing.discount_price) {
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
          {listing.discount_price}{' '}
          <span className="line-through text-gray-400 text-[8px] font-normal">{listing.price}</span>
          {pctSpan}
        </div>
      );
    } else if (listing.price) {
      return <div className="text-[#1a5c3a] text-[10px] font-bold mt-0.5">{listing.price}</div>;
    }
    return null;
  };

  return (
    <Link
      href={getProductHref()}
      onClick={handleAdClick}
      className="bg-[#fffdf6] rounded border-2 border-amber-200 overflow-hidden cursor-pointer shadow-sm hover:border-[#1a5c3a] transition-all flex flex-col justify-between relative"
    >
      <div className="absolute top-1 left-1 bg-amber-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded shadow z-10 uppercase tracking-wider">
        Sponsored
      </div>
      <div>
        {listing.image_url ? (
          <img
            src={getOptimizedImageUrl(listing.image_url, 'card')}
            className="w-full aspect-square object-cover bg-gray-50"
            alt={listing.name}
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
        <div className="p-1.5 px-2 mt-1">
          <div className="text-[10px] font-medium line-clamp-2 leading-tight h-[26px]">
            {listing.name}
          </div>
          {renderPrice()}
        </div>
      </div>
      
      <div className="p-1.5 pt-0 px-2">
        <div className="text-[9px] text-gray-400 truncate border-t border-gray-150 pt-1 mt-1">
          {listing.businesses?.business_name || ''}
        </div>
      </div>
    </Link>
  );
}
