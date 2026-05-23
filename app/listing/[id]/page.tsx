import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import ListingDetail from '@/components/ListingDetail';

interface PageProps {
  params: Promise<{ id: string }>;
}

function parsePrice(p: string | null): number {
  if (!p) return 0;
  const cleaned = String(p).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  const { data: l } = await supabase
    .from('listings')
    .select('*, businesses(business_name, areas(name))')
    .eq('id', id)
    .single();

  if (!l) {
    return {
      title: 'Product Not Found | MyPahad',
    };
  }

  const townName = l.businesses?.areas?.name || '';
  const sellerName = l.businesses?.business_name || '';
  const cleanDescription = l.description 
    ? l.description.substring(0, 160) 
    : `Buy ${l.name} from ${sellerName} in ${townName} on MyPahad.`;

  return {
    title: `${l.name} - Buy in ${townName} | MyPahad`,
    description: cleanDescription,
    openGraph: {
      title: `${l.name} - Buy in ${townName} | MyPahad`,
      description: cleanDescription,
      images: l.image_url ? [l.image_url] : [],
    }
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Fetch current listing
  const { data: l } = await supabase
    .from('listings')
    .select('*, businesses(id, business_name, whatsapp, dp_url, area_id, is_approved, is_active, category_id, areas(name))')
    .eq('id', id)
    .single();

  if (!l) {
    notFound();
  }

  const biz = l.businesses;
  const bizId = biz?.id || l.business_id;
  const categoryId = biz?.category_id;

  // 2. Fetch related listings (imitating the listing.html related listings logic)
  let rel: any[] = [];
  if (bizId) {
    const { data: sameBizData } = await supabase
      .from('listings')
      .select('*, businesses(id, business_name, whatsapp, area_id, is_approved, is_active, category_id)')
      .eq('business_id', bizId)
      .eq('is_available', true)
      .neq('id', l.id)
      .limit(9);
    if (sameBizData) rel = sameBizData;
  }
  
  const needed = 9 - rel.length;
  if (needed > 0 && categoryId && biz) {
    const { data: otherBizData } = await supabase
      .from('listings')
      .select('*, businesses!inner(id, business_name, whatsapp, area_id, is_approved, is_active, category_id)')
      .eq('businesses.category_id', categoryId)
      .neq('business_id', bizId)
      .eq('businesses.is_approved', true)
      .eq('businesses.is_active', true)
      .eq('is_available', true)
      .neq('id', l.id)
      .limit(needed);
      
    if (otherBizData) {
      const formattedOthers = otherBizData.map((item: any) => ({ ...item, is_other_seller: true }));
      rel = rel.concat(formattedOthers);
    }
  }

  // 3. Construct JSON-LD Schema
  const actualPrice = l.discount_price ? parsePrice(l.discount_price) : parsePrice(l.price);
  
  const schemaMarkup = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": l.name,
    "image": l.image_url ? [l.image_url] : [],
    "description": l.description || `Buy ${l.name} from ${biz?.business_name} in ${biz?.areas?.name} on MyPahad.`,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "INR",
      "price": actualPrice || 0,
      "itemCondition": "https://schema.org/NewCondition",
      "availability": l.is_available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "LocalBusiness",
        "name": biz?.business_name || "Local Seller",
        "image": biz?.dp_url || undefined
      }
    }
  };

  return (
    <>
      {/* Dynamic JSON-LD structured schema script block */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <ListingDetail listing={l} relatedListings={rel} />
    </>
  );
}
