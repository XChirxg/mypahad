'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Area {
  id: string;
  name: string;
  slug: string;
  state: string;
  district: string;
  is_active: boolean;
}

interface TownSelectorProps {
  initialAreas: Area[];
}

export default function TownSelector({ initialAreas }: TownSelectorProps) {
  const router = useRouter();
  
  const [states, setStates] = useState<string[]>(() => {
    return Array.from(new Set(initialAreas.map(r => r.state).filter(Boolean))).sort();
  });
  const [selectedState, setSelectedState] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [towns, setTowns] = useState<Area[]>([]);
  const [selectedTownId, setSelectedTownId] = useState('');
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  
  const [locHint, setLocHint] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [locCallback, setLocCallback] = useState<(() => void) | null>(null);
  
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(''), 2400);
  };

  // 1. Initialize states
  useEffect(() => {
    // Check local storage for last visited area
    try {
      const saved = localStorage.getItem('mp_area');
      if (saved) {
        const areaObj = JSON.parse(saved) as Area;
        if (areaObj && areaObj.name) {
          const fullArea = initialAreas.find(a => a.id === areaObj.id || a.slug === areaObj.slug);
          const areaToUse = fullArea || areaObj;

          setLocHint(`Last visited: ${areaToUse.name}`);
          setLocCallback(() => () => preselectArea(areaToUse));
          // Proactively preselect
          preselectArea(areaToUse);
        }
      }
    } catch (e) {}

    // Check deep links (e.g. hash /@username or search ?@username)
    detectDeepLink();
    
    // Trigger auto-detect
    detectLocation();
  }, [initialAreas]);

  // Deep link checks
  const detectDeepLink = async () => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    
    const raw = path.match(/\/@([a-z0-9_]+)/i)
             || hash.match(/#@([a-z0-9_]+)/i)
             || search.match(/[?&]@([a-z0-9_]+)/i);
             
    if (raw?.[1]) {
      const username = raw[1].toLowerCase();
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: biz } = await supabase
          .from('businesses')
          .select('id, areas(id,name,slug,state,district,is_active)')
          .eq('username', username)
          .single();
          
        if (biz && biz.areas) {
          const areaObj = biz.areas as unknown as Area;
          localStorage.setItem('mp_area', JSON.stringify(areaObj));
          localStorage.setItem('mp_open_biz', biz.id);
          router.push(`/${areaObj.slug}`);
        } else {
          triggerToast('Profile not found: @' + username);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Geolocation
  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocHint('Detecting your location…');
    setLocLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const geo = await res.json();
          const addr = geo.address || {};
          const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
          const stateRaw = addr.state || '';
          
          matchAndPreselect(city, stateRaw);
        } catch (e) {
          setLocLoading(false);
          setLocHint('');
        }
      },
      () => {
        setLocLoading(false);
        // Silently fail or keep last visited
      }
    );
  };

  const matchAndPreselect = (city: string, stateRaw: string) => {
    setLocLoading(false);
    if (!city && !stateRaw) {
      setLocHint('');
      return;
    }
    
    // Find matching town in initialAreas
    const match = initialAreas.find(a => 
      a.name.toLowerCase().includes(city.toLowerCase()) || 
      city.toLowerCase().includes(a.name.toLowerCase())
    );
    
    if (match) {
      setLocHint(`📍 Detected: ${match.name}, ${match.district}`);
      setLocCallback(() => () => preselectArea(match));
      preselectArea(match);
      return;
    }
    
    // State fallback
    const stateMatch = states.find(s => 
      stateRaw.toLowerCase().includes(s.toLowerCase()) || 
      s.toLowerCase().includes(stateRaw.toLowerCase())
    );
    if (stateMatch) {
      setSelectedState(stateMatch);
      // Load districts for this state
      const stateDistricts = Array.from(new Set(
        initialAreas.filter(r => r.state === stateMatch).map(r => r.district).filter(Boolean)
      )).sort();
      setDistricts(stateDistricts);
      setSelectedDistrict('');
      setTowns([]);
      setSelectedTownId('');
      setSelectedArea(null);
      setLocHint(`📍 Detected state: ${stateMatch}`);
    } else {
      setLocHint('');
    }
  };

  const preselectArea = (area: Area) => {
    if (!area) return;

    // Ensure we have a complete area object from initialAreas
    const fullArea = initialAreas.find(a => a.id === area.id || a.slug === area.slug) || area;

    setSelectedState(fullArea.state || '');
    
    // districts
    const stateDistricts = fullArea.state ? Array.from(new Set(
      initialAreas.filter(r => r.state === fullArea.state).map(r => r.district).filter(Boolean)
    )).sort() : [];
    setDistricts(stateDistricts);
    setSelectedDistrict(fullArea.district || '');
    
    // towns
    const districtTowns = (fullArea.state && fullArea.district) ? initialAreas.filter(
      r => r.state === fullArea.state && r.district === fullArea.district
    ) : [];
    setTowns(districtTowns);
    setSelectedTownId(fullArea.id || '');
    setSelectedArea(fullArea);
  };

  // Dropdown changes
  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedDistrict('');
    setSelectedTownId('');
    setSelectedArea(null);
    setTowns([]);
    
    if (!state) {
      setDistricts([]);
      return;
    }
    
    const stateDistricts = Array.from(new Set(
      initialAreas.filter(r => r.state === state).map(r => r.district).filter(Boolean)
    )).sort();
    setDistricts(stateDistricts);
  };

  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    setSelectedTownId('');
    setSelectedArea(null);
    
    if (!district) {
      setTowns([]);
      return;
    }
    
    const districtTowns = initialAreas.filter(r => r.state === selectedState && r.district === district);
    setTowns(districtTowns);
  };

  const handleTownChange = (townId: string) => {
    setSelectedTownId(townId);
    const townObj = towns.find(t => t.id === townId) || null;
    setSelectedArea(townObj);
  };

  const enterTown = () => {
    if (!selectedArea) return;
    localStorage.setItem('mp_area', JSON.stringify(selectedArea));
    router.push(`/${selectedArea.slug}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6 font-sans">
      {toastMsg && (
        <div id="toast" style={{ display: 'block' }}>
          {toastMsg}
        </div>
      )}
      
      <div className="text-center mb-10">
        <img 
          src="/logoGreen.png" 
          className="h-14 w-auto mx-auto mb-2" 
          alt="MyPahad Logo"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
            const lt = document.getElementById('lt');
            if (lt) lt.style.display = 'block';
          }}
        />
        <div id="lt" className="text-3xl font-bold text-[#1a5c3a] tracking-tight hidden">MyPahad</div>
        <div className="text-xs text-gray-400 mt-1 font-medium">Apne Pahad ka Bazaar</div>
      </div>

      <div className="w-full max-w-[400px]">
        {/* Dropdowns */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="relative">
            <select 
              value={selectedState} 
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full appearance-none border-1.5 border-[#e5e7eb] rounded-lg p-3 pr-9 text-sm focus:border-[#1a5c3a] outline-none bg-white cursor-pointer"
            >
              <option value="">Select state…</option>
              {states.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
          </div>

          <div className="relative">
            <select 
              value={selectedDistrict} 
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={!selectedState}
              className="w-full appearance-none border-1.5 border-[#e5e7eb] rounded-lg p-3 pr-9 text-sm focus:border-[#1a5c3a] outline-none bg-white cursor-pointer disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <option value="">Select district…</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
          </div>

          <div className="relative">
            <select 
              value={selectedTownId} 
              onChange={(e) => handleTownChange(e.target.value)}
              disabled={!selectedDistrict}
              className="w-full appearance-none border-1.5 border-[#e5e7eb] rounded-lg p-3 pr-9 text-sm focus:border-[#1a5c3a] outline-none bg-white cursor-pointer disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <option value="">Select town…</option>
              {towns.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
          </div>
        </div>

        {/* Location Hint */}
        <div className="min-h-5 flex items-center gap-1.5 text-[11px] text-gray-400 mb-3 px-0.5">
          {locHint && (
            <>
              <span className={`w-1.5 h-1.5 rounded-full bg-[#1a5c3a] shrink-0 ${locLoading ? 'animate-pulse' : ''}`}></span>
              {locCallback ? (
                <span onClick={locCallback} className="text-[#1a5c3a] cursor-pointer underline decoration-dotted underline-offset-2">
                  {locHint}
                </span>
              ) : (
                <span>{locHint}</span>
              )}
            </>
          )}
        </div>

        {/* Enter Button */}
        <button 
          onClick={enterTown}
          disabled={!selectedArea}
          className="w-full bg-[#1a5c3a] text-white border-none p-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-35 disabled:cursor-default active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          {selectedArea ? `Enter ${selectedArea.name}` : 'Enter your town'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <div className="flex items-center gap-2.5 my-4 text-gray-400 text-[11px]">
          <div className="flex-1 h-[1px] bg-gray-200"></div>
          <span>or</span>
          <div className="flex-1 h-[1px] bg-gray-200"></div>
        </div>

        {/* Direct Links */}
        <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          <a href="https://partner.mypahad.in" className="flex items-center gap-3 p-3 bg-white hover:bg-gray-50 border-b border-gray-100 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[#fff5eb] flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c05c00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-800">List your Business</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Free listing for local shops & services</div>
            </div>
            <span className="text-gray-400 text-lg">›</span>
          </a>
        </div>
      </div>
    </div>
  );
}
