'use client';

import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { getBusinessLink, getListingLink } from '@/lib/dbHelpers';

interface Business {
  id: string;
  business_name: string;
  username?: string | null;
  dp_url: string | null;
  whatsapp: string | null;
  areas?: {
    name: string;
    slug: string;
  } | null;
}

interface Post {
  id: string;
  title: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  tags?: string | null;
  created_at: string;
}

interface Listing {
  id: string;
  name: string;
  price: string | null;
  discount_price: string | null;
  image_url: string | null;
}

interface PostDetailProps {
  post: Post;
  business: Business;
  listings: Listing[];
}

export default function PostDetail({ post, business, listings }: PostDetailProps) {
  const areaSlug = business.areas?.slug || 'town';
  const bizUsername = business.username || 'shop';
  const bizProfileUrl = getBusinessLink(bizUsername, areaSlug);
  
  // Format YouTube Link
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const ytId = post.media_url && post.media_type === 'youtube' ? getYouTubeId(post.media_url) : null;
  const showImage = post.media_url && post.media_type !== 'youtube';

  const formattedDate = new Date(post.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const parsePrice = (p: string | null) => {
    if (!p) return 0;
    const cleaned = String(p).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const renderPrice = (l: Listing) => {
    const orig = parsePrice(l.price);
    const disc = parsePrice(l.discount_price);
    if (l.discount_price) {
      return (
        <div className="text-[#e05a2b] text-[10px] font-bold mt-0.5">
          {l.discount_price} <span className="line-through text-gray-400 text-[8px] font-normal">{l.price}</span>
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

  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-16 font-sans">
      {/* Top Navbar */}
      <div className="bg-[#1a5c3a] p-2 px-3 flex items-center justify-between sticky top-0 z-50 shadow-sm text-white">
        <div className="flex items-center gap-2">
          <Link href={bizProfileUrl} className="text-white text-base font-bold tracking-tight">
            MyPahad
          </Link>
          <span className="text-[10px] text-white/70 border-l border-white/30 pl-2 leading-none">
            Post
          </span>
        </div>
        <Link href={bizProfileUrl} className="bg-white/15 text-white border-none px-2.5 py-1 rounded text-[11px] font-semibold hover:bg-white/25 transition-colors">
          View Shop
        </Link>
      </div>

      {/* Main Post Content */}
      <div className="max-w-[600px] mx-auto bg-white border-b border-gray-200 overflow-hidden shadow-sm">
        {/* Media Block */}
        {ytId ? (
          <div className="relative aspect-video w-full">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${ytId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        ) : showImage ? (
          <div className="relative w-full aspect-[4/3] bg-gray-100">
            <img src={getOptimizedImageUrl(post.media_url!, 'large')} alt={post.title} className="w-full h-full object-cover" />
          </div>
        ) : null}

        {/* Text details */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Link href={bizProfileUrl} className="flex items-center gap-2 group">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                {business.dp_url ? (
                  <img src={getOptimizedImageUrl(business.dp_url, 'dp')} className="w-full h-full object-cover" alt="" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  </svg>
                )}
              </div>
              <span className="text-xs font-bold text-gray-700 group-hover:text-[#1a5c3a] transition-colors">
                {business.business_name}
              </span>
            </Link>
            <span className="text-[10px] text-gray-400">•</span>
            <span className="text-[10px] text-gray-400">{formattedDate}</span>
          </div>

          <h1 className="text-lg font-bold text-gray-900 leading-snug mb-3">{post.title}</h1>
          
          <div 
            className="text-xs text-gray-700 leading-relaxed mb-4 prose max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          ></div>

          {/* Tags */}
          {post.tags && (
            <div className="flex flex-wrap gap-1 border-t border-gray-100 pt-3">
              {post.tags.split(',').map((tag, idx) => {
                const cleanTag = tag.trim();
                if (!cleanTag) return null;
                return (
                  <span key={idx} className="bg-gray-100 text-gray-500 text-[9px] font-semibold px-2 py-0.5 rounded">
                    #{cleanTag}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Business products under the post */}
      {listings.length > 0 && (
        <div className="max-w-[600px] mx-auto bg-white border-t-4 border-[#f0f0ee] p-4 shadow-sm mt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-800">Featured Items from {business.business_name}</span>
            <Link href={bizProfileUrl} className="text-[10px] font-bold text-[#1a5c3a] hover:underline">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {listings.map(l => (
              <div 
                key={l.id} 
                onClick={() => {
                  window.location.href = getListingLink(bizUsername, generateSlug(l.name), areaSlug);
                }}
                className="bg-white rounded border border-gray-200 overflow-hidden cursor-pointer shadow-sm"
              >
                {l.image_url ? (
                  <img src={getOptimizedImageUrl(l.image_url, 'card')} className="w-full aspect-square object-cover" alt={l.name} loading="lazy" />
                ) : (
                  <div className="w-full aspect-square bg-[#e8f5ee] flex items-center justify-center">
                    <svg viewBox="0 0 815.87 616.68" className="w-4 h-4 text-[#1a5c3a]" role="img" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.57,572.97 C-14.62,339.44 2.09,154.1 54.52,6.42 C131.36,20.31 232.4,73.22 354.99,164.82 C404.05,86.33 455.12,32.57 500.69,0 C663.72,152.93 769.22,344.53 815.87,575.22 C672.26,616.9 459.11,628.39 186.41,604.02 C196.86,520.39 228.65,425.92 266.84,328.03 L188.35,216.96 L87.47,383.14 L136.67,386.07 L70.38,505.35 L136.98,507.05 L136.13,597.9 C87.58,590.41 37.72,582.23 13.57,572.97 Z" fill="currentColor" fillRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="p-1 px-1.5">
                  <div className="text-[9px] font-semibold line-clamp-2 leading-tight h-[24px]">
                    {l.name}
                  </div>
                  {renderPrice(l)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer back links */}
      <div className="max-w-[600px] mx-auto mt-4 px-4 text-center">
        <Link href={bizProfileUrl} className="text-xs text-gray-500 font-semibold underline hover:text-[#1a5c3a]">
          ← Back to Business Profile
        </Link>
      </div>
    </div>
  );
}
