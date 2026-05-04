import { supabase } from '@/lib/supabase'
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Products & Services – MyPahad',
  description: 'Browse products and services from local businesses in Pahadi towns of Himachal Pradesh.',
}

async function getListings(type?: string) {
  let q = supabase
    .from('listings')
    .select('id,name,price,image_url,listing_type,businesses!inner(id,business_name,username,is_approved,is_active,areas(name))')
    .eq('businesses.is_approved', true)
    .eq('businesses.is_active', true)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(60)

  if (type === 'product' || type === 'service') {
    q = q.eq('listing_type', type)
  }

  const { data } = await q
  return data || []
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams
  const listings = await getListings(type)

  return (
    <main style={{ fontFamily: "'DM Sans',sans-serif", background: '#f0f0ee', minHeight: '100vh', color: '#111' }}>
      <div style={{ background: '#1a5c3a', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: '#fff', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>Browse</span>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #ddd' }}>
        {[['', 'All'], ['product', 'Products'], ['service', 'Services']].map(([val, label]) => (
          <Link key={val} href={val ? `/products?type=${val}` : '/products'}
            style={{ padding: '5px 14px', borderRadius: 4, border: '1px solid', borderColor: (type || '') === val ? '#1a5c3a' : '#ddd', background: (type || '') === val ? '#1a5c3a' : '#fff', color: (type || '') === val ? '#fff' : '#4a4a4a', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
            {label}
          </Link>
        ))}
      </div>

      <div style={{ padding: '10px 10px 30px' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, paddingLeft: 2 }}>{listings.length} items</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {listings.map((l: any) => (
            <Link key={l.id} href={`/products/${l.id}`}
              style={{ background: '#fff', borderRadius: 6, border: '1px solid #ddd', overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
              {l.image_url
                ? <img src={l.image_url} alt={l.name} loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '1', background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
              }
              <div style={{ padding: '6px 7px 9px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{l.name}</div>
                {l.price && <div style={{ fontSize: 12, color: '#1a5c3a', fontWeight: 700, marginTop: 2 }}>{l.price}</div>}
                <div style={{ fontSize: 9, color: '#888', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{l.businesses?.business_name}</div>
              </div>
            </Link>
          ))}
        </div>
        {listings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#888', fontSize: 13 }}>No listings found.</div>
        )}
      </div>
    </main>
  )
}
