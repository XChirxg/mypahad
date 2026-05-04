import { supabase } from '@/lib/supabase'
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'All Businesses – MyPahad',
  description: 'Browse all local businesses, shops and services in Pahadi towns of Himachal Pradesh.',
}

async function getBusinesses(areaSlug?: string) {
  let q = supabase
    .from('businesses')
    .select('id,business_name,username,dp_url,description,is_premium,categories(name),areas(id,name,slug)')
    .eq('is_approved', true)
    .eq('is_active', true)
    .order('is_premium', { ascending: false })
    .order('hearts', { ascending: false })
    .limit(60)

  if (areaSlug) {
    // Filter by area slug or id
    const { data: area } = await supabase.from('areas').select('id').or(`slug.eq.${areaSlug},id.eq.${areaSlug}`).single()
    if (area) q = (q as any).eq('area_id', area.id)
  }

  const { data } = await q
  return data || []
}

async function getAreas() {
  const { data } = await supabase.from('areas').select('id,name,slug').eq('is_active', true).order('name')
  return data || []
}

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams
  const [businesses, areas] = await Promise.all([
    getBusinesses(area),
    getAreas(),
  ])

  return (
    <main style={{ fontFamily: "'DM Sans',sans-serif", background: '#f0f0ee', minHeight: '100vh', color: '#111' }}>
      <div style={{ background: '#1a5c3a', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: '#fff', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>Businesses</span>
        <a href="/partner.html" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '5px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
          + Register
        </a>
      </div>

      {/* Area chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 12px', background: '#fff', borderBottom: '1px solid #ddd', scrollbarWidth: 'none' }}>
        <Link href="/businesses"
          style={{ whiteSpace: 'nowrap', padding: '4px 12px', borderRadius: 4, border: '1px solid', borderColor: !area ? '#1a5c3a' : '#ddd', background: !area ? '#1a5c3a' : '#fff', color: !area ? '#fff' : '#4a4a4a', fontSize: 11, fontWeight: 500, textDecoration: 'none' }}>
          All
        </Link>
        {areas.map((a: any) => (
          <Link key={a.id} href={`/businesses?area=${a.slug || a.id}`}
            style={{ whiteSpace: 'nowrap', padding: '4px 12px', borderRadius: 4, border: '1px solid', borderColor: area === (a.slug || a.id) ? '#1a5c3a' : '#ddd', background: area === (a.slug || a.id) ? '#1a5c3a' : '#fff', color: area === (a.slug || a.id) ? '#fff' : '#4a4a4a', fontSize: 11, fontWeight: 500, textDecoration: 'none' }}>
            {a.name}
          </Link>
        ))}
      </div>

      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>{businesses.length} businesses</div>
        {businesses.map((b: any) => (
          <Link key={b.id} href={`/businesses/${b.username || b.id}`}
            style={{ background: '#fff', borderRadius: 6, border: '1px solid #ddd', marginBottom: 8, padding: '11px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #e8f5ee', background: '#e8f5ee', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {b.dp_url
                ? <img src={b.dp_url} alt={b.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{b.business_name}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{b.categories?.name}{b.areas?.name ? ` · ${b.areas.name}` : ''}</div>
              {b.description && <div style={{ fontSize: 11, color: '#4a4a4a', marginTop: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{b.description}</div>}
              {b.is_premium && <span style={{ display: 'inline-block', fontSize: 8, background: '#fff3cd', color: '#856404', padding: '1px 5px', borderRadius: 2, fontWeight: 700, marginTop: 4 }}>PREMIUM</span>}
            </div>
            <svg style={{ color: '#888', flexShrink: 0, marginTop: 2 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
        ))}
        {businesses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#888', fontSize: 13 }}>No businesses found.</div>
        )}
      </div>
    </main>
  )
}