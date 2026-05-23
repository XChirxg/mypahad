'use client';

import { useEffect } from 'react';
import { supabase, triggerNavigationStart } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Ad {
  id: string;
  area_id?: string | null;
  business_id: string | null;
  title?: string | null;
  image_url: string | null;
  link_url: string | null;
  ad_type: string;
  listing_id: string | null;
}

interface AdBannerProps {
  ad: Ad;
  areaSlug: string;
}

export default function AdBanner({ ad, areaSlug }: AdBannerProps) {
  const router = useRouter();

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
    e.preventDefault();
    e.stopPropagation();
    
    const savedSid = localStorage.getItem('mp_sid') || '';
    // Record click
    await supabase.from('analytics').insert({
      area_id: ad.area_id || null,
      business_id: ad.business_id || null,
      event_type: 'ad_click',
      ad_id: ad.id,
      session_id: savedSid
    }).then(null, err => console.warn('Ad click analytics failed:', err));

    if (ad.listing_id) {
      try {
        const { data: l } = await supabase
          .from('listings')
          .select('*, businesses(username)')
          .eq('id', ad.listing_id)
          .single();
        if (l) {
          localStorage.setItem('mp_view_lst', JSON.stringify(l));
          localStorage.setItem('mp_lst_back', `/${areaSlug}`);
          
          const username = l.businesses?.username || 'shop';
          const cleanName = l.name
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
            
          triggerNavigationStart();
          router.push(`/${username}-${cleanName}-in-${areaSlug}`);
        }
      } catch (e) {
        console.error(e);
      }
    } else if (ad.link_url) {
      window.open(ad.link_url, '_blank');
    }
  };

  if (!ad.image_url) return null;

  return (
    <div 
      onClick={handleAdClick}
      className="m-2 mx-2.5 rounded-lg overflow-hidden cursor-pointer shadow-sm border border-gray-200 transition-all hover:opacity-95"
    >
      <img 
        src={ad.image_url} 
        alt={ad.title || "Banner Ad"} 
        className="w-full aspect-[16/9] object-cover" 
        loading="lazy"
      />
    </div>
  );
}
