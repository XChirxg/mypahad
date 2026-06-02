'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, generateUUID, triggerNavigationStart } from '@/lib/supabase';

interface CartItem {
  id: string;
  name: string;
  price: number;
  variant: string | null;
  quantity: number;
  qty_label: string;
  booking_date: string | null;
  booking_time: string | null;
}

interface CartStore {
  business_name: string;
  whatsapp: string;
  items: CartItem[];
}

type Cart = Record<string, CartStore>;

export default function CartPage() {
  const router = useRouter();
  
  const [cart, setCart] = useState<Cart>({});
  const [bizIds, setBizIds] = useState<string[]>([]);
  const [sid, setSid] = useState('');

  useEffect(() => {
    // Generate/get Session ID
    let savedSid = localStorage.getItem('mp_sid');
    if (!savedSid) {
      savedSid = generateUUID();
      localStorage.setItem('mp_sid', savedSid);
    }
    setSid(savedSid);

    loadCart();
  }, []);

  const loadCart = () => {
    let savedCart: Cart = {};
    try {
      savedCart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {
      savedCart = {};
    }

    const ids = Object.keys(savedCart).filter(
      id => savedCart[id] && savedCart[id].items && savedCart[id].items.length > 0
    );

    setCart(savedCart);
    setBizIds(ids);
  };

  const goBack = () => {
    // Navigate back to listing page if present, else back to area town home
    try {
      const area = JSON.parse(localStorage.getItem('mp_area') || '{}');
      triggerNavigationStart();
      if (area && area.slug) {
        router.push(`/${area.slug}`);
      } else {
        router.push('/');
      }
    } catch (e) {
      triggerNavigationStart();
      router.push('/');
    }
  };

  const deleteCartItem = (bid: string, idx: number) => {
    const nextCart = { ...cart };
    if (nextCart[bid] && nextCart[bid].items) {
      nextCart[bid].items.splice(idx, 1);
      
      if (nextCart[bid].items.length === 0) {
        delete nextCart[bid];
      }
      
      localStorage.setItem('mp_cart', JSON.stringify(nextCart));
      loadCart();
    }
  };

  const deleteBizCart = (bid: string) => {
    if (!confirm("Clear this store's items from your cart?")) return;
    
    const nextCart = { ...cart };
    delete nextCart[bid];
    
    localStorage.setItem('mp_cart', JSON.stringify(nextCart));
    loadCart();
  };

  const fmtWa = (raw: string | null) => {
    if (!raw) return '';
    let n = String(raw).trim().replace(/\D/g, '');
    if (n.startsWith('91') && n.length === 12) n = n.slice(2);
    if (n.startsWith('0') && n.length === 11) n = n.slice(1);
    if (n.length !== 10) return '';
    return '91' + n;
  };

  const sendCartToWhatsApp = (bid: string) => {
    const bizData = cart[bid];
    if (!bizData) return;

    let msg = `*New Order / Inquiry from MyPahad*\n\n`;
    let totalOrder = 0;
    
    bizData.items.forEach((item, idx) => {
      const itemTotal = item.quantity * item.price;
      totalOrder += itemTotal;

      msg += `${idx + 1}. *${item.name}*\n`;
      if (item.variant) msg += `   - Variant: ${item.variant}\n`;
      if (item.booking_date) msg += `   - Booking Date/Time: ${item.booking_date} ${item.booking_time || 'Same Day'}\n`;
      msg += `   - Quantity: ${item.quantity} ${item.qty_label || 'Quantity'}\n`;
      msg += `   - Price: ₹${item.price || '—'}\n`;
      msg += `   - Total: ₹${itemTotal}\n\n`;
    });

    msg += `*Order Subtotal: ₹${totalOrder}*\n\n`;
    msg += `Please confirm availability. Thank you!`;

    // Analytics
    supabase.from('analytics').insert({
      business_id: bid,
      event_type: 'whatsapp_click',
      session_id: sid
    }).then(null, err => console.warn('Analytics failed:', err));

    const waNum = fmtWa(bizData.whatsapp);
    if (waNum) {
      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-10 font-sans">
      {/* Top Navbar */}
      <div className="bg-[#1a5c3a] p-3 px-4 flex items-center gap-3 sticky top-0 z-50 shadow-sm">
        <button onClick={goBack} className="bg-none border-none text-white p-0 flex items-center justify-center cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <span className="text-[15px] font-bold text-white">Shopping Cart</span>
      </div>

      <div className="p-4 px-3 max-w-[600px] mx-auto flex flex-col">
        {bizIds.length === 0 ? (
          <div className="text-center py-12 text-gray-400 flex flex-col items-center gap-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" className="opacity-40">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <div className="text-sm font-semibold text-gray-800">Your cart is empty</div>
            <div className="text-[11px] text-gray-400 max-w-[200px] leading-normal">
              Browse listings to find products you want to buy.
            </div>
            <button 
              onClick={goBack}
              className="bg-[#1a5c3a] text-white border-none py-2 px-5 rounded-lg text-xs font-semibold hover:bg-[#154c30] cursor-pointer mt-2"
            >
              Explore Products
            </button>
          </div>
        ) : (
          bizIds.map(bid => {
            const bizData = cart[bid];
            let bizSubtotal = 0;

            return (
              <div key={bid} className="bg-white border border-[#ddd] rounded-lg p-4 mb-4 shadow-sm">
                <div className="text-[13px] font-bold text-[#1a5c3a] border-b border-gray-150 pb-2 mb-3">
                  {bizData.business_name}
                </div>
                
                <div className="flex flex-col gap-2.5">
                  {bizData.items.map((item, idx) => {
                    const rowTotal = item.quantity * item.price;
                    bizSubtotal += rowTotal;

                    return (
                      <div key={`${item.id}-${idx}`} className="flex justify-between items-start text-xs text-gray-700 pb-2 border-b border-dashed border-gray-100 last:border-none last:pb-0">
                        <div className="flex-1 pr-2 min-w-0">
                          <Link href={`/listing/${item.id}`} className="font-semibold text-gray-800 hover:underline hover:text-[#1a5c3a]">
                            {item.name}
                          </Link>
                          {item.variant && <div className="text-[10px] text-gray-400 mt-0.5">Option: {item.variant}</div>}
                          {item.booking_date && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              Booking: {item.booking_date} {item.booking_time || ''}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex items-start gap-1">
                          <div>
                            <div className="font-bold text-[#1a5c3a] text-[11px]">
                              {item.quantity} x ₹{item.price}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">Total: ₹{rowTotal}</div>
                          </div>
                          <button 
                            onClick={() => deleteCartItem(bid, idx)}
                            className="bg-none border-none text-[#e05a2b] text-base p-0 pl-2 font-bold cursor-pointer flex items-center justify-center leading-none self-center"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-gray-800 mt-3 pt-2.5 border-t border-gray-150">
                  <span>Subtotal</span>
                  <span className="text-[#1a5c3a] text-sm">₹{bizSubtotal}</span>
                </div>

                <div className="flex gap-2 mt-3.5 items-center">
                  {bizData.whatsapp === 'mypahad' ? (
                    <button 
                      onClick={() => {
                        triggerNavigationStart();
                        router.push(`/chat?biz_id=${bid}`);
                      }}
                      className="flex-1.8 bg-[#1a5c3a] text-white border-none py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#154c30] transition-colors"
                    >
                      💬 Order Chat
                    </button>
                  ) : (
                    <button 
                      onClick={() => sendCartToWhatsApp(bid)}
                      className="flex-1.8 bg-[#1a5c3a] text-white border-none py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#154c30] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                      </svg>
                      Buy through WhatsApp
                    </button>
                  )}
                  <button 
                    onClick={() => deleteBizCart(bid)}
                    className="flex-1 bg-white text-[#e05a2b] border border-[#e05a2b] py-2 px-3 rounded-lg text-xs font-semibold hover:bg-red-50/20 active:bg-red-50/40 transition-colors"
                  >
                    Delete List
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
