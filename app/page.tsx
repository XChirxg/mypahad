import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MyPahad – Local Businesses in Pahadi Towns',
  description: 'Discover local businesses, shops, and professionals in Theog, Shimla and Pahadi towns of Himachal Pradesh.',
  keywords: 'local businesses Theog, Shimla shops, Pahad business directory, Himachal Pradesh local market',
  openGraph: {
    title: 'MyPahad – Apne Pahad ka Bazaar',
    description: 'Local businesses and products in your Pahadi town',
    type: 'website',
  },
}

async function getAreas() {
  const { data } = await supabase.from('areas').select('*').eq('is_active', true).order('name')
  return data || []
}

async function getFeaturedBusinesses() {
  const { data } = await supabase
    .from('businesses')
    .select('id,business_name,dp_url,description,username,categories(name),areas(name)')
    .eq('is_approved', true)
    .eq('is_active', true)
    .eq('is_premium', true)
    .limit(6)
  return data || []
}

async function getRecentListings() {
  const { data } = await supabase
    .from('listings')
    .select('id,name,price,image_url,listing_type,businesses!inner(id,business_name,username,is_approved,is_active,areas(name))')
    .eq('businesses.is_approved', true)
    .eq('businesses.is_active', true)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(12)
  return data || []
}

export default async function HomePage() {
  const [areas, featuredBiz, recentListings] = await Promise.all([
    getAreas(),
    getFeaturedBusinesses(),
    getRecentListings(),
  ])

  return (
    <main style={{ fontFamily: "'DM Sans', sans-serif", background: '#f0f0ee', minHeight: '100vh', color: '#111' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#1a5c3a 0%,#0e3d26 100%)', padding: '48px 20px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: '0 0 8px', position: 'relative', zIndex: 1 }}>
          MyPahad
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, margin: '0 0 24px', position: 'relative', zIndex: 1 }}>
          Apne Pahad ka Bazaar — Local businesses & professionals
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {areas.map((a: any) => (
            <Link key={a.id} href={`/businesses?area=${a.slug || a.id}`}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              {a.name}
            </Link>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>

        {/* Featured Businesses */}
        {featuredBiz.length > 0 && (
          <section style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Featured Businesses</h2>
              <Link href="/businesses" style={{ fontSize: 12, color: '#1a5c3a', textDecoration: 'none', fontWeight: 600 }}>See all →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
              {featuredBiz.map((b: any) => (
                <Link key={b.id} href={`/businesses/${b.username || b.id}`}
                  style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#e8f5ee', border: '2px solid #1a5c3a', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {b.dp_url ? <img src={b.dp_url} alt={b.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{b.business_name}</div>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{(b.categories as any)?.name} · {(b.areas as any)?.name}</div>
                    {b.description && <div style={{ fontSize: 11, color: '#4a4a4a', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{b.description}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent Products */}
        {recentListings.length > 0 && (
          <section style={{ marginTop: 28, marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Listings</h2>
              <Link href="/products" style={{ fontSize: 12, color: '#1a5c3a', textDecoration: 'none', fontWeight: 600 }}>Browse all →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
              {recentListings.map((l: any) => (
                <Link key={l.id} href={`/products/${l.id}`}
                  style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  {l.image_url ? (
                    <img src={l.image_url} alt={l.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '1', background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                  )}
                  <div style={{ padding: '8px 8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{l.name}</div>
                    {l.price && <div style={{ fontSize: 13, color: '#1a5c3a', fontWeight: 700, marginTop: 3 }}>{l.price}</div>}
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{(l.businesses as any)?.business_name}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
