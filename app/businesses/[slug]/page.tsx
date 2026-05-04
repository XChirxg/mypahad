import { supabase, type Business, type Listing } from '@/lib/supabase'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

// Fetch business by username OR id
async function getBusiness(slug: string): Promise<Business | null> {
  // Try username first
  let { data } = await supabase
    .from('businesses')
    .select('*,areas(id,name,slug),categories(id,name)')
    .eq('username', slug)
    .eq('is_approved', true)
    .eq('is_active', true)
    .single()

  if (!data) {
    // Fallback to id
    const res = await supabase
      .from('businesses')
      .select('*,areas(id,name,slug),categories(id,name)')
      .eq('id', slug)
      .eq('is_approved', true)
      .eq('is_active', true)
      .single()
    data = res.data
  }
  return data
}

async function getListings(bizId: string): Promise<Listing[]> {
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('business_id', bizId)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
  return data || []
}

// ── SEO METADATA ──────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const biz = await getBusiness(slug)
  if (!biz) return { title: 'Business Not Found' }

  const area = (biz.areas as any)?.name || ''
  const cat = (biz.categories as any)?.name || ''
  const title = `${biz.business_name} – ${cat} in ${area} | MyPahad`
  const description = biz.description
    ? `${biz.description.slice(0, 140)} — Find ${biz.business_name} on MyPahad, your local business directory for ${area}.`
    : `${biz.business_name} is a ${cat} business in ${area}, Himachal Pradesh. Contact them on WhatsApp via MyPahad.`

  return {
    title,
    description,
    keywords: `${biz.business_name}, ${cat} in ${area}, local business ${area}, ${area} shops, Himachal Pradesh business`,
    openGraph: {
      title,
      description,
      images: biz.dp_url ? [{ url: biz.dp_url, width: 400, height: 400, alt: biz.business_name }] : [],
      type: 'website',
      siteName: 'MyPahad',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: biz.dp_url ? [biz.dp_url] : [],
    },
    alternates: {
      canonical: `https://mypahad.in/businesses/${slug}`,
    },
  }
}

// ── STATIC PATHS (top businesses) ─────────────────────────────────────────────
export const dynamicParams = true // allow slugs not in generateStaticParams

export async function generateStaticParams() {
  const { data } = await supabase
    .from('businesses')
    .select('username,id')
    .eq('is_approved', true)
    .eq('is_active', true)
    .limit(200)
  return (data || []).map((b: any) => ({ slug: b.username || b.id }))
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default async function BusinessPage({ params }: Props) {
  const { slug } = await params
  const biz = await getBusiness(slug)
  if (!biz) notFound()

  const listings = await getListings(biz.id)
  const products = listings.filter(l => l.listing_type === 'product')
  const services = listings.filter(l => l.listing_type === 'service')

  const area = (biz.areas as any)?.name || ''
  const cat = (biz.categories as any)?.name || ''
  const waNum = fmtWa(biz.whatsapp)
  const waMsg = encodeURIComponent(`Hi *${biz.business_name}*,\n\nI found you on MyPahad.in!`)
  const waUrl = waNum ? `https://wa.me/${waNum}?text=${waMsg}` : null

  // JSON-LD Structured Data — makes Google show rich results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: biz.business_name,
    description: biz.description || `${biz.business_name} – ${cat} in ${area}`,
    url: `https://mypahad.in/businesses/${slug}`,
    image: biz.dp_url || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: area,
      addressRegion: 'Himachal Pradesh',
      addressCountry: 'IN',
    },
    ...(biz.address ? { streetAddress: biz.address } : {}),
    ...(waNum ? { telephone: '+91' + waNum.replace(/^91/, '') } : {}),
    ...(cat ? { '@type': ['LocalBusiness', mapCategoryToSchema(cat)] } : {}),
    hasOfferCatalog: listings.length > 0 ? {
      '@type': 'OfferCatalog',
      name: `Products & Services by ${biz.business_name}`,
      itemListElement: listings.slice(0, 10).map(l => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': l.listing_type === 'service' ? 'Service' : 'Product',
          name: l.name,
          description: l.description,
          image: l.image_url,
        },
        price: l.price ? l.price.replace(/[^0-9.]/g, '') : undefined,
        priceCurrency: 'INR',
      })),
    } : undefined,
  }

  return (
    <>
      {/* Inject JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main style={{ fontFamily: "'DM Sans',sans-serif", background: '#f0f0ee', minHeight: '100vh', color: '#111' }}>
        {/* Top bar */}
        <div style={{ background: '#1a5c3a', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 100 }}>
          <Link href="/businesses" style={{ background: 'none', border: 'none', color: '#fff', display: 'flex', padding: 0, cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biz.business_name}</span>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
              WhatsApp
            </a>
          )}
        </div>

        {/* Profile hero */}
        <div style={{ background: '#fff', padding: '14px 14px 10px', borderBottom: '5px solid #f0f0ee' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid #1a5c3a', overflow: 'hidden', flexShrink: 0, background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {biz.dp_url
                ? <img src={biz.dp_url} alt={biz.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{biz.business_name}</h1>
              <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{cat}{area ? ` · ${area}` : ''}</div>
              {biz.is_premium && <span style={{ display: 'inline-block', fontSize: 9, background: '#fff3cd', color: '#856404', padding: '2px 6px', borderRadius: 3, fontWeight: 700, marginTop: 4 }}>PREMIUM</span>}
              {biz.description && <p style={{ fontSize: 12, color: '#4a4a4a', marginTop: 6, lineHeight: 1.6 }}>{biz.description}</p>}
              {biz.address && <div style={{ fontSize: 11, color: '#888', marginTop: 5, display: 'flex', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {biz.address}
              </div>}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                style={{ background: '#25d366', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 5, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                Chat on WhatsApp
              </a>
            )}
            <a href={`https://mypahad.in/businesses/${slug}`}
              style={{ background: '#fff', border: '1px solid #ddd', color: '#4a4a4a', padding: '8px 12px', borderRadius: 5, fontSize: 12, textDecoration: 'none' }}>
              Share Profile
            </a>
          </div>
        </div>

        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Products */}
          {products.length > 0 && (
            <section style={{ marginTop: 0 }}>
              <div style={{ padding: '12px 14px 8px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 13, fontWeight: 700 }}>Products <span style={{ color: '#888', fontWeight: 400, fontSize: 11 }}>({products.length})</span></h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, padding: '8px 10px', background: '#f0f0ee' }}>
                {products.map(l => (
                  <Link key={l.id} href={`/products/${l.id}`}
                    style={{ background: '#fff', borderRadius: 6, border: '1px solid #ddd', overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    {l.image_url
                      ? <img src={l.image_url} alt={l.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '1', background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </div>
                    }
                    <div style={{ padding: '6px 7px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{l.name}</div>
                      {l.price && <div style={{ fontSize: 12, color: '#1a5c3a', fontWeight: 700, marginTop: 2 }}>{l.price}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Services */}
          {services.length > 0 && (
            <section style={{ marginTop: 5 }}>
              <div style={{ padding: '12px 14px 8px', background: '#fff', borderBottom: '1px solid #eee' }}>
                <h2 style={{ fontSize: 13, fontWeight: 700 }}>Services <span style={{ color: '#888', fontWeight: 400, fontSize: 11 }}>({services.length})</span></h2>
              </div>
              <div style={{ padding: '8px 10px', background: '#f0f0ee' }}>
                {services.map(l => (
                  <Link key={l.id} href={`/products/${l.id}`}
                    style={{ background: '#fff', borderRadius: 6, border: '1px solid #ddd', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, textDecoration: 'none', color: 'inherit' }}>
                    {l.image_url
                      ? <img src={l.image_url} alt={l.name} loading="lazy" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
                      : <div style={{ width: 48, height: 48, background: '#e8f5ee', borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{l.name}</div>
                      {l.price && <div style={{ fontSize: 13, color: '#1a5c3a', fontWeight: 700, marginTop: 2 }}>{l.price}</div>}
                      {l.description && <div style={{ fontSize: 11, color: '#4a4a4a', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{l.description}</div>}
                    </div>
                    <svg style={{ color: '#888', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {listings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#888', fontSize: 13 }}>
              No listings added yet.
            </div>
          )}

          {/* Breadcrumb for SEO */}
          <nav style={{ padding: '12px 14px', fontSize: 11, color: '#888' }} aria-label="breadcrumb">
            <Link href="/" style={{ color: '#1a5c3a' }}>MyPahad</Link>
            {' › '}
            <Link href="/businesses" style={{ color: '#1a5c3a' }}>Businesses</Link>
            {area && <>{' › '}<Link href={`/businesses?area=${(biz.areas as any)?.slug || ''}`} style={{ color: '#1a5c3a' }}>{area}</Link></>}
            {' › '}
            <span>{biz.business_name}</span>
          </nav>
        </div>
      </main>
    </>
  )
}

// Helpers
function fmtWa(raw?: string): string {
  if (!raw) return ''
  let num = String(raw).trim().replace(/\D/g, '')
  if (num.startsWith('91') && num.length === 12) num = num.slice(2)
  if (num.startsWith('0') && num.length === 11) num = num.slice(1)
  if (num.length !== 10) return ''
  return '91' + num
}

function mapCategoryToSchema(cat: string): string {
  const map: Record<string, string> = {
    restaurant: 'FoodEstablishment',
    food: 'FoodEstablishment',
    grocery: 'GroceryStore',
    medical: 'MedicalBusiness',
    pharmacy: 'Pharmacy',
    hotel: 'LodgingBusiness',
    hardware: 'HomeAndConstructionBusiness',
    tailor: 'ClothingStore',
    electronics: 'ElectronicsStore',
    beauty: 'BeautySalon',
    dairy: 'FoodEstablishment',
  }
  const lower = cat.toLowerCase()
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v
  }
  return 'LocalBusiness'
}
