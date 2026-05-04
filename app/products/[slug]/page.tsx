import { supabase, type Listing } from '@/lib/supabase'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

async function getListing(id: string): Promise<Listing | null> {
  const { data } = await supabase
    .from('listings')
    .select('*,businesses!inner(id,business_name,username,dp_url,whatsapp,address,is_approved,is_active,areas(name),categories(name))')
    .eq('id', id)
    .eq('businesses.is_approved', true)
    .eq('businesses.is_active', true)
    .single()
  return data
}

async function getRelated(listing: Listing): Promise<any[]> {
  if (!listing.category_id) return []
  const { data } = await supabase
    .from('listings')
    .select('id,name,price,image_url,listing_type,businesses!inner(id,business_name,is_approved,is_active)')
    .eq('category_id', listing.category_id)
    .eq('businesses.is_approved', true)
    .eq('businesses.is_active', true)
    .eq('is_available', true)
    .neq('id', listing.id)
    .limit(9)
  return data || []
}

// ── SEO METADATA ──────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const listing = await getListing(slug)
  if (!listing) return { title: 'Product Not Found' }

  const biz = listing.businesses as any
  const area = biz?.areas?.name || ''
  const bizName = biz?.business_name || ''
  const type = listing.listing_type === 'service' ? 'Service' : 'Product'

  const title = `${listing.name}${listing.price ? ` – ${listing.price}` : ''} | ${bizName} | MyPahad`
  const description = listing.description
    ? `${listing.description.slice(0, 150)} — Available at ${bizName}${area ? ` in ${area}` : ''}.`
    : `${listing.name} available at ${bizName}${area ? ` in ${area}, Himachal Pradesh` : ''}. Contact via WhatsApp on MyPahad.`

  return {
    title,
    description,
    keywords: `${listing.name}, ${bizName}, buy ${listing.name} ${area}, ${type} in ${area}, local market ${area}`,
    openGraph: {
      title,
      description,
      images: listing.image_url ? [{ url: listing.image_url, width: 800, height: 800, alt: listing.name }] : [],
      type: 'website',
      siteName: 'MyPahad',
    },
    twitter: {
      card: listing.image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      images: listing.image_url ? [listing.image_url] : [],
    },
    alternates: {
      canonical: `https://mypahad.in/products/${slug}`,
    },
  }
}

// ── STATIC PATHS ──────────────────────────────────────────────────────────────
export const dynamicParams = true // allow slugs not in generateStaticParams

export async function generateStaticParams() {
  const { data } = await supabase
    .from('listings')
    .select('id')
    .eq('is_available', true)
    .limit(500)
  return (data || []).map((l: any) => ({ slug: l.id }))
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const listing = await getListing(slug)
  if (!listing) notFound()

  const biz = listing.businesses as any
  const bizName = biz?.business_name || ''
  const bizSlug = biz?.username || biz?.id || ''
  const area = biz?.areas?.name || ''
  const cat = biz?.categories?.name || ''

  const related = await getRelated(listing)

  const waNum = fmtWa(biz?.whatsapp)
  const waMsg = encodeURIComponent(
    `Hi *${bizName}*,\n\nI am interested in: *${listing.name}*${listing.price ? ' – ' + listing.price : ''}\n\nI found you on MyPahad.in`
  )
  const waUrl = waNum ? `https://wa.me/${waNum}?text=${waMsg}` : null

  // JSON-LD — Product schema (Google shows price, availability in search)
  const priceNum = listing.price ? listing.price.replace(/[^0-9.]/g, '') : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': listing.listing_type === 'service' ? 'Service' : 'Product',
    name: listing.name,
    description: listing.description || `${listing.name} available at ${bizName} in ${area}`,
    image: listing.image_url || undefined,
    url: `https://mypahad.in/products/${slug}`,
    ...(listing.listing_type !== 'service' && priceNum ? {
      offers: {
        '@type': 'Offer',
        price: priceNum,
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        seller: {
          '@type': 'LocalBusiness',
          name: bizName,
          address: {
            '@type': 'PostalAddress',
            addressLocality: area,
            addressRegion: 'Himachal Pradesh',
            addressCountry: 'IN',
          },
        },
      },
    } : {}),
    brand: {
      '@type': 'Brand',
      name: bizName,
    },
    // Breadcrumb for Google
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MyPahad', item: 'https://mypahad.in' },
        { '@type': 'ListItem', position: 2, name: 'Products', item: 'https://mypahad.in/products' },
        { '@type': 'ListItem', position: 3, name: listing.name, item: `https://mypahad.in/products/${slug}` },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main style={{ fontFamily: "'DM Sans',sans-serif", background: '#f0f0ee', minHeight: '100vh', color: '#111' }}>
        {/* Top bar */}
        <div style={{ background: '#1a5c3a', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 100 }}>
          <Link href={bizSlug ? `/businesses/${bizSlug}` : '/'}
            style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', padding: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing.name}
          </span>
        </div>

        {/* Product image */}
        {listing.image_url
          ? <img src={listing.image_url} alt={listing.name} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block', background: '#e8f5ee' }} />
          : <div style={{ width: '100%', aspectRatio: '1', maxHeight: 360, background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="0.7"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
        }

        {/* Product info */}
        <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '5px solid #f0f0ee' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{listing.name}</h1>
          {listing.price && (
            <div style={{ fontSize: 22, color: '#1a5c3a', fontWeight: 800, marginTop: 6 }}>{listing.price}</div>
          )}
          {listing.listing_type === 'service' && (
            <span style={{ display: 'inline-block', fontSize: 10, background: '#e8f5ee', color: '#1a5c3a', padding: '2px 8px', borderRadius: 3, fontWeight: 700, marginTop: 6 }}>SERVICE</span>
          )}
          {listing.description && (
            <p style={{ fontSize: 13, color: '#4a4a4a', marginTop: 10, lineHeight: 1.7 }}>{listing.description}</p>
          )}
        </div>

        {/* Seller card */}
        <div style={{ background: '#fff', padding: '12px 14px', borderBottom: '5px solid #f0f0ee' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 8 }}>
            {listing.listing_type === 'service' ? 'Offered by' : 'Sold by'}
          </div>
          <Link href={bizSlug ? `/businesses/${bizSlug}` : '#'}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#e8f5ee', border: '1px solid #ddd', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {biz?.dp_url
                ? <img src={biz.dp_url} alt={bizName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{bizName}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{cat}{area ? ` · ${area}` : ''} · View profile →</div>
            </div>
            <svg style={{ color: '#888', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        </div>

        {/* Sticky bottom WhatsApp CTA */}
        <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #ddd', padding: '10px 14px', zIndex: 50 }}>
          {waUrl ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', background: '#1a5c3a', color: '#fff', border: 'none', padding: '13px', borderRadius: 7, fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
              Contact on WhatsApp
            </a>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', fontSize: 12, padding: '8px 0' }}>
              Visit the business profile to contact
            </div>
          )}
        </div>

        {/* Related listings */}
        {related.length > 0 && (
          <div style={{ padding: '0 0 24px' }}>
            <div style={{ padding: '14px 14px 8px', fontSize: 13, fontWeight: 700 }}>More like this</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, padding: '0 10px' }}>
              {related.map(r => (
                <Link key={r.id} href={`/products/${r.id}`}
                  style={{ background: '#fff', borderRadius: 6, border: '1px solid #ddd', overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  {r.image_url
                    ? <img src={r.image_url} alt={r.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '1', background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                      </div>
                  }
                  <div style={{ padding: '5px 6px 8px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{r.name}</div>
                    {r.price && <div style={{ fontSize: 11, color: '#1a5c3a', fontWeight: 700, marginTop: 2 }}>{r.price}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        <nav style={{ padding: '8px 14px 20px', fontSize: 11, color: '#888' }} aria-label="breadcrumb">
          <Link href="/" style={{ color: '#1a5c3a' }}>MyPahad</Link>
          {' › '}
          <Link href="/products" style={{ color: '#1a5c3a' }}>Products</Link>
          {' › '}
          <span>{listing.name}</span>
        </nav>
      </main>
    </>
  )
}

function fmtWa(raw?: string): string {
  if (!raw) return ''
  let num = String(raw).trim().replace(/\D/g, '')
  if (num.startsWith('91') && num.length === 12) num = num.slice(2)
  if (num.startsWith('0') && num.length === 11) num = num.slice(1)
  if (num.length !== 10) return ''
  return '91' + num
}