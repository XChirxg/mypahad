'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, generateUUID } from '@/lib/supabase';

interface Area {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Business {
  id: string;
  business_name: string;
  username: string | null;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  dp_url: string | null;
  area_id: string | null;
  category_id: string | null;
  draft_category?: string | null;
  type: string;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  is_approved: boolean;
  is_active: boolean;
}

interface Listing {
  id: string;
  name: string;
  price: string | null;
  discount_price: string | null;
  image_url: string | null;
  listing_type: string | null;
  description: string | null;
  is_active: boolean;
  qty_label: string | null;
  variants: any[] | null;
  has_delivery: boolean;
  booking_required: boolean;
}

interface BusinessPhoto {
  id: string;
  url: string;
  caption: string | null;
}

export default function PartnerPage() {
  const router = useRouter();
  
  // Auth state
  const [session, setSession] = useState<any>(null);
  const [authTab, setAuthTab] = useState<'login' | 'reg'>('login');
  const [loading, setLoading] = useState(true);
  
  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register Form
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regUsernameStatus, setRegUsernameStatus] = useState('');
  const [regUsernameColor, setRegUsernameColor] = useState('text-gray-400');
  const [regAreaId, setRegAreaId] = useState('');
  const [regCategoryName, setRegCategoryName] = useState('');
  const [regCategoryId, setRegCategoryId] = useState('');
  const [regType, setRegType] = useState('product');
  const [regWa, setRegWa] = useState('');
  const [regPh, setRegPh] = useState('');
  const [regAddr, setRegAddr] = useState('');
  const [regDesc, setRegDesc] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regError, setRegError] = useState('');
  
  // Dropdown caches
  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCats, setFilteredCats] = useState<Category[]>([]);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);

  // Dashboard state
  const [biz, setBiz] = useState<Business | null>(null);
  const [dashTab, setDashTab] = useState<'stats' | 'profile' | 'add'>('stats');
  const [listings, setListings] = useState<Listing[]>([]);
  const [photos, setPhotos] = useState<BusinessPhoto[]>([]);
  const [analyticsData, setAnalyticsData] = useState({ views: 0, items: 0, contacts: 0 });
  const [dailyViews, setDailyViews] = useState<{ date: string; count: number }[]>([]);

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [editingListing, setEditingListing] = useState<Listing | null>(null);

  // Add/Edit Listing Form
  const [lstType, setLstType] = useState('product');
  const [lstName, setLstName] = useState('');
  const [lstPrice, setLstPrice] = useState('');
  const [lstDiscPrice, setLstDiscPrice] = useState('');
  const [lstQtyType, setLstQtyType] = useState('Quantity');
  const [lstQtyCustom, setLstQtyCustom] = useState('');
  const [lstHasDelivery, setLstHasDelivery] = useState(false);
  const [lstBookingRequired, setLstBookingRequired] = useState(false);
  const [lstDesc, setLstDesc] = useState('');
  const [lstImgUrl, setLstImgUrl] = useState('');
  const [lstVariants, setLstVariants] = useState<any[]>([]);
  const [lstError, setLstError] = useState('');

  // Highlights state
  const [hlOpen, setHlOpen] = useState(false);
  const [hlLabel, setHlLabel] = useState('');
  const [hlImgUrl, setHlImgUrl] = useState('');
  const [hlError, setHlError] = useState('');

  // AI Prompt Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  
  const checkUsernameTimer = useRef<NodeJS.Timeout | null>(null);

  const triggerToast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(''), 2400);
  };

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadBusinessDetails(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadBusinessDetails(session.user.id);
      } else {
        setBiz(null);
        setLoading(false);
      }
    });

    // Load initial form cache dropdowns
    supabase.from('areas').select('id,name').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setAreas(data);
    });
    supabase.from('categories').select('id,name').order('name').then(({ data }) => {
      if (data) setCategories(data);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadBusinessDetails = async (userId: string) => {
    setLoading(true);
    try {
      const { data: b } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (b) {
        setBiz(b as Business);
        await Promise.all([
          loadListings(b.id),
          loadPhotos(b.id),
          loadAnalytics(b.id)
        ]);
      } else {
        // Logged in but has no business row yet (failed registration or admin account)
        setSession(null);
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadListings = async (bizId: string) => {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('business_id', bizId)
      .order('sort_order')
      .order('created_at', { ascending: false });
    if (data) setListings(data);
  };

  const loadPhotos = async (bizId: string) => {
    const { data } = await supabase
      .from('business_photos')
      .select('*')
      .eq('business_id', bizId)
      .order('sort_order');
    if (data) setPhotos(data);
  };

  const loadAnalytics = async (bizId: string) => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data: ev } = await supabase
      .from('analytics')
      .select('event_type,created_at')
      .eq('business_id', bizId)
      .gte('created_at', since);
      
    if (ev) {
      const views = ev.filter(e => e.event_type === 'business_view').length;
      const items = ev.filter(e => e.event_type === 'listing_click').length;
      const contacts = ev.filter(e => e.event_type === 'whatsapp_click').length;
      setAnalyticsData({ views, items, contacts });

      // Daily chart aggregation
      const days: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        days[d] = 0;
      }
      ev.filter(e => e.event_type === 'business_view').forEach(e => {
        const d = e.created_at.slice(0, 10);
        if (days[d] !== undefined) days[d]++;
      });
      
      const chartPoints = Object.keys(days).map(date => ({
        date: date.slice(5),
        count: days[date]
      }));
      setDailyViews(chartPoints);
    }
  };

  // Auth functions
  const handleLogin = async () => {
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Enter email and password.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword
    });
    if (error) setLoginError(error.message);
  };

  const handleRegister = async () => {
    setRegError('');
    if (!regName || !regAreaId || !regWa || !regEmail || !regPass) {
      setRegError('Fill all required fields.');
      return;
    }
    if (regPass.length < 6) {
      setRegError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPass
    });

    if (error) {
      setRegError(error.message);
      setLoading(false);
      return;
    }

    const uid = data.user?.id;
    if (!uid) {
      setRegError('Account creation failed.');
      setLoading(false);
      return;
    }

    // Resolve category or draft
    let resolvedCategoryId: string | null = null;
    let resolvedDraftCategory: string | null = null;

    if (regCategoryName.trim()) {
      const trimmedName = regCategoryName.trim();
      const exactMatch = categories.find(
        c => c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (exactMatch) {
        resolvedCategoryId = exactMatch.id;
      } else {
        resolvedDraftCategory = trimmedName;
      }
    }

    const { error: insErr } = await supabase.from('businesses').insert({
      user_id: uid,
      area_id: regAreaId,
      business_name: regName,
      username: regUsername || null,
      category_id: resolvedCategoryId,
      draft_category: resolvedDraftCategory,
      type: regType,
      whatsapp: regWa,
      phone: regPh || null,
      address: regAddr || null,
      description: regDesc || null,
      is_approved: false,
      is_active: true
    });

    if (insErr) {
      setRegError(insErr.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      triggerToast('Welcome to MyPahad!');
      setSession(data.session);
    } else {
      triggerToast('Check email, then login.');
      setAuthTab('login');
      setLoginEmail(regEmail);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setBiz(null);
  };

  // Autocomplete
  const handleCatInput = (val: string) => {
    setRegCategoryName(val);
    const q = val.trim().toLowerCase();
    if (!q) {
      setFilteredCats([]);
      setCatDropdownOpen(false);
      return;
    }

    const matches = categories.filter(c => c.name.toLowerCase().includes(q));
    setFilteredCats(matches.slice(0, 8));
    setCatDropdownOpen(true);
  };

  const selectCategory = (c: Category) => {
    setRegCategoryId(c.id);
    setRegCategoryName(c.name);
    setCatDropdownOpen(false);
  };

  const handleUsernameChange = (val: string) => {
    setRegUsername(val);
    if (checkUsernameTimer.current) clearTimeout(checkUsernameTimer.current);
    
    const v = val.trim().toLowerCase();
    if (!v || v.length < 3) {
      setRegUsernameStatus('');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(v)) {
      setRegUsernameStatus('Only a–z, 0–9, _');
      setRegUsernameColor('text-red-500');
      return;
    }

    checkUsernameTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('businesses').select('id').eq('username', v);
      const taken = data && data.length > 0;
      setRegUsernameStatus(taken ? 'Taken' : 'Available');
      setRegUsernameColor(taken ? 'text-red-500' : 'text-[#1a5c3a]');
    }, 500);
  };

  // Edit fields
  const saveFieldEdit = async () => {
    if (!editingField || !biz) return;
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ [editingField]: editingVal.trim() || null })
        .eq('id', biz.id);
        
      if (error) {
        triggerToast('Error: ' + error.message);
      } else {
        setBiz(prev => prev ? { ...prev, [editingField]: editingVal.trim() || null } : null);
        triggerToast('Saved!');
        setEditingField(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dynamic Base64 File Uploader
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const max = 800;
        if (w > max || h > max) {
          if (w > h) {
            h = Math.round((h * max) / w);
            w = max;
          } else {
            w = Math.round((w * max) / h);
            h = max;
          }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        callback(dataUrl);
      };
      img.src = uploadEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Listing Functions
  const addVariantField = () => {
    setLstVariants(prev => [...prev, { name: '', price: '', discount_price: null }]);
  };

  const handleVariantChange = (idx: number, field: string, val: string) => {
    setLstVariants(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const saveListing = async () => {
    if (!lstName || !biz) {
      setLstError('Item name is required.');
      return;
    }

    setLstError('');
    const unit = lstQtyType === 'other' ? (lstQtyCustom.trim() || 'Quantity') : lstQtyType;
    const price = lstPrice ? `₹${lstPrice}${unit !== 'Quantity' ? '/' + unit : ''}` : null;
    const discount_price = lstDiscPrice ? `₹${lstDiscPrice}${unit !== 'Quantity' ? '/' + unit : ''}` : null;
    
    const formattedVariants = lstVariants
      .map(v => {
        if (!v.name && !v.price) return null;
        return {
          name: v.name || 'Default',
          price: parseFloat(v.price) || 0,
          discount_price: v.discount_price ? parseFloat(v.discount_price) : null
        };
      })
      .filter(Boolean);

    const payload = {
      business_id: biz.id,
      listing_type: lstType,
      name: lstName,
      price,
      discount_price,
      qty_label: unit,
      has_delivery: lstHasDelivery,
      booking_required: lstBookingRequired,
      description: lstDesc || null,
      image_url: lstImgUrl || null,
      variants: formattedVariants.length > 0 ? formattedVariants : null,
      is_active: true
    };

    try {
      if (editingListing) {
        // Edit existing
        const { error } = await supabase
          .from('listings')
          .update(payload)
          .eq('id', editingListing.id);
        if (error) throw error;
        triggerToast('Listing updated!');
      } else {
        // Create new
        const { error } = await supabase
          .from('listings')
          .insert({ ...payload, id: generateUUID() });
        if (error) throw error;
        triggerToast('Item added!');
      }
      
      // Reset uploader form
      clearListingForm();
      loadListings(biz.id);
      setDashTab('profile');
    } catch (e: any) {
      setLstError(e.message);
    }
  };

  const clearListingForm = () => {
    setEditingListing(null);
    setLstName('');
    setLstType('product');
    setLstPrice('');
    setLstDiscPrice('');
    setLstQtyType('Quantity');
    setLstQtyCustom('');
    setLstHasDelivery(false);
    setLstBookingRequired(false);
    setLstDesc('');
    setLstImgUrl('');
    setLstVariants([]);
  };

  const startEditListing = (l: Listing) => {
    setEditingListing(l);
    setLstName(l.name);
    setLstType(l.listing_type || 'product');
    
    // Parse unit & pricing
    const unit = l.qty_label || 'Quantity';
    const cleanPrice = l.price ? String(l.price).replace(/[^0-9.]/g, '') : '';
    const cleanDisc = l.discount_price ? String(l.discount_price).replace(/[^0-9.]/g, '') : '';
    
    setLstPrice(cleanPrice);
    setLstDiscPrice(cleanDisc);
    
    const standardUnits = ['Quantity', 'kg', 'lt', 'ft', 'm'];
    if (standardUnits.includes(unit)) {
      setLstQtyType(unit);
      setLstQtyCustom('');
    } else {
      setLstQtyType('other');
      setLstQtyCustom(unit);
    }
    
    setLstHasDelivery(l.has_delivery);
    setLstBookingRequired(l.booking_required);
    setLstDesc(l.description || '');
    setLstImgUrl(l.image_url || '');
    
    // Parse variants
    if (l.variants) {
      setLstVariants(l.variants.map(v => ({
        name: v.name,
        price: v.price != null ? String(v.price) : '',
        discount_price: v.discount_price != null ? String(v.discount_price) : null
      })));
    } else {
      setLstVariants([]);
    }
    
    setDashTab('add');
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return;
    await supabase.from('listings').delete().eq('id', id);
    triggerToast('Deleted');
    if (biz) loadListings(biz.id);
  };

  // Highlights
  const addHighlight = async () => {
    if (!hlImgUrl || !biz) {
      setHlError('Image is required.');
      return;
    }
    if (photos.length >= 6) {
      triggerToast('Max 6 highlights allowed.');
      setHlOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('business_photos')
        .insert({
          business_id: biz.id,
          url: hlImgUrl,
          caption: hlLabel.trim() || 'Photo',
          sort_order: photos.length + 1
        });
      if (error) throw error;
      
      triggerToast('Highlight added!');
      setHlOpen(false);
      setHlLabel('');
      setHlImgUrl('');
      loadPhotos(biz.id);
    } catch (e: any) {
      setHlError(e.message);
    }
  };

  const deleteHighlight = async (id: string) => {
    if (!confirm('Delete this highlight?')) return;
    await supabase.from('business_photos').delete().eq('id', id);
    triggerToast('Highlight deleted');
    if (biz) loadPhotos(biz.id);
  };

  // AI Prompt Helper
  const openAIPrompt = () => {
    if (listings.length === 0 || !biz) {
      triggerToast('Add items to your catalog first.');
      return;
    }

    const itemLines = listings.map(l => {
      let line = `• ${l.name}`;
      if (l.discount_price) line += ` - ${l.discount_price} (was ${l.price})`;
      else if (l.price) line += ` - ${l.price}`;
      return line;
    }).join('\n');

    const prompt = `Create a beautiful product catalogue menu card graphic poster for a business named "${biz.business_name}" located in Himachal Pradesh, India.
    
Business Info:
• Name: ${biz.business_name}
• Description: ${biz.description || ''}
• Location: ${biz.address || ''}

Items List:
${itemLines}

Visual Style Instructions:
- Elegant rustic local aesthetic, green and cream hues matching pahadi nature.
- Large clear text of business name at the top.
- Detailed readable grid listing of items and prices.
- Bottom disclaimer tag line saying: "Find us on myPahad.in"`;

    setAiPromptText(prompt);
    setAiModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-500 text-xs">
        Loading Partner Portal...
      </div>
    );
  }

  // Not logged in -> Show login/register screens
  if (!session || !biz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {toastMsg && <div id="toast" style={{ display: 'block' }}>{toastMsg}</div>}
        <div className="w-full max-w-[420px] bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          <div className="bg-[#1a5c3a] p-6 text-center text-white">
            <h1 className="text-2xl font-bold">🏔 MyPahad</h1>
            <p className="text-[11px] opacity-75 mt-1">Partner &amp; Business Portal</p>
          </div>

          <div className="p-5">
            <div className="flex border-b border-gray-200 mb-5">
              <button 
                onClick={() => setAuthTab('login')}
                className={`flex-1 text-center py-2 text-xs font-semibold border-b-2 ${authTab === 'login' ? 'text-[#1a5c3a] border-[#1a5c3a]' : 'text-gray-400 border-transparent'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setAuthTab('reg')}
                className={`flex-1 text-center py-2 text-xs font-semibold border-b-2 ${authTab === 'reg' ? 'text-[#1a5c3a] border-[#1a5c3a]' : 'text-gray-400 border-transparent'}`}
              >
                Register
              </button>
            </div>

            {/* Login View */}
            {authTab === 'login' ? (
              <div className="flex flex-col gap-3">
                <div className="fg">
                  <label>Email</label>
                  <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="your@email.com" />
                </div>
                <div className="fg">
                  <label>Password</label>
                  <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Password" />
                </div>
                {loginError && <div className="text-red-500 text-xs mt-1">{loginError}</div>}
                
                <button onClick={handleLogin} className="w-full bg-[#1a5c3a] text-white p-3 rounded-lg text-xs font-semibold mt-2 hover:bg-[#154c30] transition-colors">
                  Login →
                </button>
              </div>
            ) : (
              /* Register View */
              <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
                <div className="fg">
                  <label>Business Name *</label>
                  <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Sharma General Store" />
                </div>
                <div className="fg">
                  <label>Username *</label>
                  <input type="text" value={regUsername} onChange={(e) => handleUsernameChange(e.target.value)} placeholder="sharmastore" />
                  {regUsernameStatus && <small className={`text-[10px] mt-0.5 block font-bold ${regUsernameColor}`}>{regUsernameStatus}</small>}
                </div>
                <div className="fg">
                  <label>Town *</label>
                  <select value={regAreaId} onChange={(e) => setRegAreaId(e.target.value)}>
                    <option value="">Select town…</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="fg relative">
                  <label>Category</label>
                  <input 
                    type="text" 
                    value={regCategoryName} 
                    onChange={(e) => handleCatInput(e.target.value)} 
                    placeholder="Grocery, Honey, Hotel…" 
                  />
                  {catDropdownOpen && filteredCats.length > 0 && (
                    <div className="absolute top-[100%] left-0 right-0 bg-white border border-gray-200 shadow-lg rounded z-50 max-h-32 overflow-y-auto">
                      {filteredCats.map(c => (
                        <div key={c.id} onClick={() => selectCategory(c)} className="p-2 text-xs hover:bg-[#e8f5ee] cursor-pointer">
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="fg">
                  <label>Type *</label>
                  <select value={regType} onChange={(e) => setRegType(e.target.value)}>
                    <option value="product">Products</option>
                    <option value="service">Services</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="fg">
                  <label>WhatsApp *</label>
                  <input type="tel" value={regWa} onChange={(e) => setRegWa(e.target.value)} placeholder="9876543210" />
                </div>
                <div className="fg">
                  <label>Email *</label>
                  <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="your@email.com" />
                </div>
                <div className="fg">
                  <label>Password *</label>
                  <input type="password" value={regPass} onChange={(e) => setRegPass(e.target.value)} placeholder="Min 6 characters" />
                </div>
                {regError && <div className="text-red-500 text-xs mt-1">{regError}</div>}
                
                <button onClick={handleRegister} className="w-full bg-[#1a5c3a] text-white p-3 rounded-lg text-xs font-semibold mt-2 hover:bg-[#154c30] transition-colors">
                  Register →
                </button>
              </div>
            )}

            <div className="text-center mt-5">
              <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                ← Back to MyPahad
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in -> Show seller Dashboard dashboard
  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-16 font-sans">
      {toastMsg && <div id="toast" style={{ display: 'block' }}>{toastMsg}</div>}

      {/* Top Navbar */}
      <div className="bg-[#1a5c3a] p-3 px-4 flex items-center justify-between text-white sticky top-0 z-50 shadow">
        <div>
          <h1 className="text-sm font-bold truncate max-w-[200px]">{biz.business_name}</h1>
          <p className="text-[10px] opacity-75">Partner Dashboard</p>
        </div>
        <button 
          onClick={handleLogout}
          className="bg-white/10 text-white text-xs border border-white/20 py-1 px-3 rounded hover:bg-white/25 transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Main Tabs view */}
      {dashTab === 'stats' && (
        <div className="p-3 max-w-[600px] mx-auto flex flex-col gap-3">
          {/* Approved status banner */}
          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500 font-semibold">Listing Status:</span>
            {biz.is_approved ? (
              <span className="text-[10px] font-bold text-[#1a5c3a] bg-[#e8f5ee] px-2 py-0.5 rounded border border-[#1a5c3a]">
                ✓ Approved & Live
              </span>
            ) : (
              <span className="text-[10px] font-bold text-yellow-800 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-300 animate-pulse">
                ⏳ Pending Verification
              </span>
            )}
          </div>

          {/* Stats Boxes */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white p-3.5 rounded-lg border border-gray-200 text-center">
              <div className="text-lg font-bold text-[#1a5c3a]">{analyticsData.views}</div>
              <div className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">Profile Views</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-gray-200 text-center">
              <div className="text-lg font-bold text-[#1a5c3a]">{analyticsData.items}</div>
              <div className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">Item Clicks</div>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-gray-200 text-center">
              <div className="text-lg font-bold text-[#1a5c3a]">{analyticsData.contacts}</div>
              <div className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">WA Contacts</div>
            </div>
          </div>

          {/* Views custom SVG chart */}
          {dailyViews.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h2 className="text-xs font-bold text-gray-700 mb-4">Profile views (Last 30 Days)</h2>
              <div className="h-28 w-full flex items-end justify-between gap-1 select-none">
                {dailyViews.map((point, i) => {
                  const maxVal = Math.max(...dailyViews.map(d => d.count), 1);
                  const hPct = (point.count / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                      <div className="absolute bottom-[calc(100%+2px)] bg-black text-white text-[8px] font-bold p-1 rounded hidden group-hover:block pointer-events-none z-10 whitespace-nowrap">
                        {point.count} views
                      </div>
                      <div 
                        className="w-full bg-[#1a5c3a] hover:bg-[#207047] rounded-sm transition-all"
                        style={{ height: `${hPct}%` }}
                      ></div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-gray-400 mt-2 font-semibold">
                <span>{dailyViews[0]?.date}</span>
                <span>{dailyViews[14]?.date}</span>
                <span>{dailyViews[29]?.date}</span>
              </div>
            </div>
          )}

          {/* Pricing & AI Helper Box */}
          <div className="bg-white border border-[#ddd] rounded-lg p-4 shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1">
              🎨 Marketing & AI Tools
            </h3>
            <p className="text-[11px] text-gray-500 leading-normal">
              Copy this menu data and paste it into Gemini or DALL-E to generate custom graphic catalogs.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={openAIPrompt} 
                className="flex-1 bg-[#1a5c3a]/10 text-[#1a5c3a] border border-[#1a5c3a]/30 p-2.5 rounded text-xs font-bold active:scale-[0.98] transition-all"
              >
                🤖 Generate AI Menu Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Edit tab */}
      {dashTab === 'profile' && (
        <div className="p-3 max-w-[600px] mx-auto flex flex-col gap-3">
          {/* Hero editor card */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3.5">
            <div className="flex gap-3.5 items-start">
              {/* DP */}
              <div className="relative shrink-0">
                {biz.dp_url ? (
                  <img src={biz.dp_url} className="w-14 h-14 rounded-full border-2 border-[#1a5c3a] object-cover" alt="" />
                ) : (
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#1a5c3a] flex items-center justify-center bg-gray-50 text-[10px] text-gray-400">
                    No DP
                  </div>
                )}
                <label className="absolute bottom-0 right-0 w-5 h-5 bg-[#1a5c3a] border border-white rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileUpload(e, async (url) => {
                      const { error } = await supabase.from('businesses').update({ dp_url: url }).eq('id', biz.id);
                      if (!error) {
                        setBiz(prev => prev ? { ...prev, dp_url: url } : null);
                        triggerToast('DP updated!');
                      }
                    })} 
                    className="hidden" 
                  />
                  <span className="text-white text-[8px]">✏</span>
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    {biz.business_name}
                    <button onClick={() => { setEditingField('business_name'); setEditingVal(biz.business_name); }} className="text-gray-400 hover:text-gray-600 text-xs">✏</button>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Editable listing fields (tap inputs to update)
                </div>
              </div>
            </div>

            {/* Inlines field editor display */}
            {editingField && (
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">Edit {editingField}</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={editingVal} 
                    onChange={(e) => setEditingVal(e.target.value)} 
                    className="flex-1 p-2 border rounded text-xs bg-white" 
                  />
                  <button onClick={saveFieldEdit} className="bg-[#1a5c3a] text-white px-3 py-1.5 rounded text-xs font-semibold">Save</button>
                  <button onClick={() => setEditingField(null)} className="bg-white border text-gray-600 px-3 py-1.5 rounded text-xs">Cancel</button>
                </div>
              </div>
            )}

            {/* Profile fields checklist */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-medium">WhatsApp</span>
                <button onClick={() => { setEditingField('whatsapp'); setEditingVal(biz.whatsapp || ''); }} className="text-[#1a5c3a] font-semibold hover:underline">
                  {biz.whatsapp || '+ Add WhatsApp'}
                </button>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-medium">Description</span>
                <button onClick={() => { setEditingField('description'); setEditingVal(biz.description || ''); }} className="text-[#1a5c3a] font-semibold hover:underline truncate max-w-[200px]">
                  {biz.description || '+ Add Description'}
                </button>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-medium">Address</span>
                <button onClick={() => { setEditingField('address'); setEditingVal(biz.address || ''); }} className="text-[#1a5c3a] font-semibold hover:underline truncate max-w-[200px]">
                  {biz.address || '+ Add Address'}
                </button>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-medium">Instagram</span>
                <button onClick={() => { setEditingField('instagram'); setEditingVal(biz.instagram || ''); }} className="text-[#1a5c3a] font-semibold hover:underline">
                  {biz.instagram ? `@${biz.instagram}` : '+ Add Instagram'}
                </button>
              </div>
            </div>
          </div>

          {/* Highlights stories Section */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-gray-700">Photo Highlights ({photos.length}/6)</h3>
              <button 
                onClick={() => { setHlOpen(true); setHlError(''); }} 
                className="bg-[#1a5c3a]/10 text-[#1a5c3a] border-none px-3 py-1 rounded text-[10px] font-semibold cursor-pointer"
              >
                + Add Photo
              </button>
            </div>
            
            {hlOpen && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 flex flex-col gap-3">
                <div className="fg">
                  <label>Label / Title</label>
                  <input type="text" value={hlLabel} onChange={(e) => setHlLabel(e.target.value)} placeholder="Offers, New Arrivals…" />
                </div>
                <div className="fg">
                  <label>Select Highlight Image</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleFileUpload(e, (url) => setHlImgUrl(url))} 
                  />
                  {hlImgUrl && <img src={hlImgUrl} className="w-12 h-12 rounded-full object-cover mt-2 border border-gray-300" />}
                </div>
                {hlError && <div className="text-red-500 text-xs">{hlError}</div>}
                
                <div className="flex gap-2">
                  <button onClick={addHighlight} className="bg-[#1a5c3a] text-white px-3 py-1.5 rounded text-xs font-semibold flex-1">Add</button>
                  <button onClick={() => setHlOpen(false)} className="bg-white border text-gray-600 px-3 py-1.5 rounded text-xs flex-1">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
              {photos.map(p => (
                <div key={p.id} className="relative flex flex-col items-center gap-1 shrink-0">
                  <div className="w-12 h-12 rounded-full border border-gray-200 overflow-hidden">
                    <img src={p.url} className="w-full h-full object-cover" alt="" />
                  </div>
                  <span className="text-[9px] text-gray-500 max-w-[48px] truncate">{p.caption}</span>
                  <button 
                    onClick={() => deleteHighlight(p.id)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white border-none rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Listings Items grid list */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-xs font-bold text-gray-700 mb-3.5">Your Catalog / Listings</h3>
            <div className="flex flex-col gap-3">
              {listings.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  No items added yet. Switch to the &apos;Add Item&apos; tab to add products.
                </div>
              ) : (
                listings.map(l => (
                  <div key={l.id} className="flex gap-3 items-center py-2.5 border-b border-gray-100 last:border-none">
                    <div className="w-10 h-10 rounded overflow-hidden bg-gray-50 shrink-0 border border-gray-200 flex items-center justify-center">
                      {l.image_url ? (
                        <img src={l.image_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a5c3a" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-800 truncate">{l.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{l.discount_price || l.price || 'No Price'}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => startEditListing(l)}
                        className="bg-[#e8f5ee] text-[#1a5c3a] border border-[#1a5c3a] py-1 px-2.5 rounded text-[10px] font-semibold"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteListing(l.id)}
                        className="bg-red-50 text-red-500 border border-red-200 py-1 px-2 rounded text-[10px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Listing Tab */}
      {dashTab === 'add' && (
        <div className="p-3 max-w-[500px] mx-auto bg-white rounded-lg border border-gray-200 mt-3">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-gray-800">
              {editingListing ? `Edit Item: ${editingListing.name}` : 'Add New Item'}
            </h2>
            {editingListing && (
              <button 
                onClick={clearListingForm}
                className="text-gray-400 hover:text-gray-600 text-xs font-semibold"
              >
                Clear / Add New
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            <div className="fg">
              <label>Type *</label>
              <select value={lstType} onChange={(e) => setLstType(e.target.value)}>
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </div>

            <div className="fg">
              <label>Name *</label>
              <input type="text" value={lstName} onChange={(e) => setLstName(e.target.value)} placeholder="e.g. Organic Pahadi Honey 500g" />
            </div>

            <div className="fg">
              <label>Base Price</label>
              <div className="price-row">
                <span>₹</span>
                <input type="number" value={lstPrice} onChange={(e) => setLstPrice(e.target.value)} placeholder="250" />
              </div>
            </div>

            <div className="fg">
              <label>Discount Price (optional)</label>
              <div className="price-row">
                <span>₹</span>
                <input type="number" value={lstDiscPrice} onChange={(e) => setLstDiscPrice(e.target.value)} placeholder="200" />
              </div>
            </div>

            <div className="fg">
              <label>Quantity Type / Unit</label>
              <select value={lstQtyType} onChange={(e) => setLstQtyType(e.target.value)}>
                <option value="Quantity">Quantity (Default)</option>
                <option value="kg">kg (Kilograms)</option>
                <option value="lt">lt (Liters)</option>
                <option value="ft">ft (Feet)</option>
                <option value="m">m (Meters)</option>
                <option value="other">other (Custom Unit)</option>
              </select>
            </div>
            {lstQtyType === 'other' && (
              <div className="fg">
                <label>Custom Unit (e.g. Box, Person, Day)</label>
                <input type="text" value={lstQtyCustom} onChange={(e) => setLstQtyCustom(e.target.value)} placeholder="Enter unit..." />
              </div>
            )}

            <div className="flex gap-4 my-2.5">
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer font-medium select-none">
                <input type="checkbox" checked={lstHasDelivery} onChange={(e) => setLstHasDelivery(e.target.checked)} className="w-auto" />
                Home Delivery Available
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer font-medium select-none">
                <input type="checkbox" checked={lstBookingRequired} onChange={(e) => setLstBookingRequired(e.target.checked)} className="w-auto" />
                Requires Booking
              </label>
            </div>

            <div className="fg">
              <label>Description</label>
              <textarea value={lstDesc} onChange={(e) => setLstDesc(e.target.value)} rows={2} placeholder="Tell customers about this item..." />
            </div>

            {/* Listing Image */}
            <div className="fg">
              <label>Image Upload</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e, (url) => setLstImgUrl(url))} 
              />
              <div className="my-1.5 text-[10px] text-gray-400 text-center font-medium">OR paste URL</div>
              <input 
                type="url" 
                value={lstImgUrl && !lstImgUrl.startsWith('data:') ? lstImgUrl : ''} 
                onChange={(e) => setLstImgUrl(e.target.value)} 
                placeholder="https://images.unsplash.com/..." 
              />
              {lstImgUrl && (
                <div className="mt-2.5 relative w-20 h-20 rounded overflow-hidden border">
                  <img src={lstImgUrl} className="w-full h-full object-cover" alt="" />
                  <button onClick={() => setLstImgUrl('')} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">&times;</button>
                </div>
              )}
            </div>

            {/* Variants Editor */}
            <div className="fg">
              <label>Variants / Options (e.g. Size, Weight, Options)</label>
              <div className="flex flex-col gap-2 mb-2">
                {lstVariants.map((v, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      value={v.name} 
                      onChange={(e) => handleVariantChange(idx, 'name', e.target.value)}
                      placeholder="Name (e.g. 1kg)" 
                      className="flex-2 p-1.5 border rounded text-xs bg-white"
                    />
                    <input 
                      type="number" 
                      value={v.price} 
                      onChange={(e) => handleVariantChange(idx, 'price', e.target.value)}
                      placeholder="Base (₹)" 
                      className="flex-1.2 p-1.5 border rounded text-xs bg-white"
                    />
                    <input 
                      type="number" 
                      value={v.discount_price || ''} 
                      onChange={(e) => handleVariantChange(idx, 'discount_price', e.target.value)}
                      placeholder="Disc (₹)" 
                      className="flex-1.2 p-1.5 border rounded text-xs bg-white"
                    />
                    <button 
                      onClick={() => setLstVariants(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 text-lg px-1 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={addVariantField} 
                className="bg-gray-100 hover:bg-gray-200 border-none px-3 py-1.5 rounded text-[11px] font-semibold"
              >
                + Add Variant Option
              </button>
            </div>

            {lstError && <div className="text-red-500 text-xs">{lstError}</div>}
            
            <button onClick={saveListing} className="bg-[#1a5c3a] text-white p-3 rounded-lg text-xs font-semibold mt-2 hover:bg-[#154c30] transition-colors">
              {editingListing ? 'Save Changes' : 'Save Item'}
            </button>
          </div>
        </div>
      )}

      {/* AI PROMPT MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-[480px] w-full relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-800 mb-2">🤖 AI Menu Prompt Generator</h3>
            <button onClick={() => setAiModalOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
            <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
              Copy the prompt text below and paste it on Gemini (Imagen 3) or Ideogram to auto-generate beautiful marketing graphics for your local store!
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-[10.5px] text-slate-800 font-mono select-all max-h-52 overflow-y-auto whitespace-pre-wrap">
              {aiPromptText}
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(aiPromptText);
                triggerToast('Copied!');
              }}
              className="w-full bg-[#1a5c3a] text-white p-2.5 rounded-lg text-xs font-bold mt-4"
            >
              📋 Copy Prompt Text
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav Dashboard Actions */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40 pb-safe shadow-lg">
        <button 
          onClick={() => setDashTab('stats')}
          className={`flex-1 flex flex-col items-center justify-center py-2 text-[9px] gap-0.5 bg-none border-none ${dashTab === 'stats' ? 'text-[#1a5c3a]' : 'text-gray-400'}`}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Stats
        </button>
        <button 
          onClick={() => { clearListingForm(); setDashTab('add'); }}
          className={`flex-1 flex flex-col items-center justify-center py-2 text-[9px] gap-0.5 bg-none border-none ${dashTab === 'add' ? 'text-[#1a5c3a]' : 'text-gray-400'}`}
        >
          <div className="w-8 h-8 rounded-full bg-[#1a5c3a] flex items-center justify-center shadow-md -mt-4 mb-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          Add Item
        </button>
        <button 
          onClick={() => setDashTab('profile')}
          className={`flex-1 flex flex-col items-center justify-center py-2 text-[9px] gap-0.5 bg-none border-none ${dashTab === 'profile' ? 'text-[#1a5c3a]' : 'text-gray-400'}`}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Profile
        </button>
      </nav>
    </div>
  );
}
