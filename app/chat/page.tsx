'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { supabaseLeads } from '@/lib/supabaseLeads';
import { getOptimizedImageUrl } from '@/lib/cloudinary';

// Dynamic helper to wrap hook usage in Suspense
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#ece5dd] flex items-center justify-center text-sm font-semibold text-gray-600">Loading Order Chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}

// Main chat logic component
function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bizId = searchParams.get('biz_id');

  // State
  const [business, setBusiness] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'tel' | 'none'>('text');
  const [inputPlaceholder, setInputPlaceholder] = useState('Type a message...');
  const [chips, setChips] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Map state
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSearchText, setMapSearchText] = useState('');
  const [currentAddress, setCurrentAddress] = useState('Move the pin to see address...');
  const [currentLocData, setCurrentLocData] = useState<any>(null);
  const [mapConfirmEnabled, setMapConfirmEnabled] = useState(false);

  // Extra listings selector state
  const [extraSelectorOpen, setExtraSelectorOpen] = useState(false);
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>({});

interface OrderState {
  name: string;
  phone: string;
  delivery: string;
  location: any;
  items: any[];
  notes: string;
  delivery_charges: string;
  currentEditingItem?: any;
}

  // Chat Order Flow State
  const [savedCustomer, setSavedCustomer] = useState<Record<string, any>>({});
  const [orderState, setOrderState] = useState<OrderState>({
    name: '',
    phone: '',
    delivery: '', // 'delivery' | 'pickup'
    location: null, // { label, fullAddress, lat, lng }
    items: [] as any[], // [{ id, name, variant, price, quantity, qty_label }]
    notes: '',
    delivery_charges: ''
  });

  const [currentStep, setCurrentStep] = useState<number>(0);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocodeTimerRef = useRef<any>(null);

  // 1. Fetch Business and Listings + Load Customer
  useEffect(() => {
    if (!bizId) {
      router.push('/');
      return;
    }

    const loadData = async () => {
      // Fetch business profile
      const { data: biz, error } = await supabase
        .from('businesses')
        .select('*, areas(name, district, state)')
        .eq('id', bizId)
        .single();

      if (error || !biz) {
        console.error('Error fetching business:', error);
        router.push('/');
        return;
      }
      setBusiness(biz);

      // Fetch active listings
      const { data: items } = await supabase
        .from('listings')
        .select('*')
        .eq('business_id', bizId)
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      setListings(items || []);

      // Load customer from localStorage
      let localCustomer: any = {};
      try {
        localCustomer = JSON.parse(localStorage.getItem('mypahad_customer') || '{}');
      } catch (e) {}
      setSavedCustomer(localCustomer);

      // Boot Chat Flow
      bootChatFlow(biz, localCustomer);
    };

    loadData();
  }, [bizId]);

  // Load Leaflet dynamically
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, chips, extraSelectorOpen]);

  // 2. Chat Helper Functions
  const addBotMessage = async (html: string, delay = 800) => {
    setIsTyping(true);
    await new Promise(r => setTimeout(r, delay));
    setIsTyping(false);
    setMessages(prev => [...prev, { dir: 'in', text: html, time: getFormattedTime() }]);
  };

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, { dir: 'out', text, time: getFormattedTime() }]);
  };

  const getFormattedTime = () => {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // 3. Flow Engine
  const bootChatFlow = async (biz: any, customer: any) => {
    await addBotMessage(`👋 Namasté! Welcome to <b>${biz.business_name}</b>.<br>Fresh local products from ${biz.areas?.name || 'Himachal Pradesh'} 🌿`, 500);

    if (customer.name && customer.phone) {
      // Return Customer
      // Verify in leads database
      let fetchedCustomer = null;
      try {
        const { data } = await supabaseLeads
          .from('customers')
          .select('*')
          .eq('phone', customer.phone)
          .single();
        if (data) fetchedCustomer = data;
      } catch (e) {}

      const name = fetchedCustomer?.name || customer.name;
      const phone = fetchedCustomer?.phone || customer.phone;
      const location = fetchedCustomer ? {
        label: fetchedCustomer.saved_address?.split(',')[0] || 'Saved Location',
        fullAddress: fetchedCustomer.saved_address,
        lat: parseFloat(fetchedCustomer.saved_lat),
        lng: parseFloat(fetchedCustomer.saved_lng)
      } : customer.location;

      setOrderState(prev => ({
        ...prev,
        name,
        phone,
        location
      }));

      await addBotMessage(`Welcome back, <b>${name}</b>! 👋🏼 Great to see you again.`, 600);
      
      // Check if they have items in cart
      let cart: any = {};
      try {
        cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
      } catch (e) {}
      const cartItems = cart[biz.id]?.items || [];

      if (cartItems.length > 0) {
        // Prefill order items from Cart
        setOrderState(prev => ({ ...prev, items: cartItems }));
        await addBotMessage(`I see you have <b>${cartItems.length} item(s)</b> in your cart: <br/>${cartItems.map((c: any) => `• ${c.name} (${c.variant || 'Standard'}) x ${c.quantity}`).join('<br/>')}`, 800);
        
        // Check if any product has delivery
        const isDeliveryAvailable = cartItems.some((c: any) => {
          const matched = listings.find(l => l.id === c.id);
          return matched?.has_delivery;
        });

        setTimeout(() => askDelivery(isDeliveryAvailable), 1000);
      } else {
        // No items in cart, start selecting product
        setCurrentStep(3); // Product picking
        setTimeout(() => showProductPicker(), 800);
      }

    } else {
      // New Customer
      await addBotMessage(`May I know your <b>good name</b>? 😊`, 900);
      setCurrentStep(1);
      setInputMode('text');
    }
  };

  // Step 1: Handle Name Input
  const handleNameInput = async (val: string) => {
    const stopWords = new Set(['i', 'm', 'me', 'my', 'im', 'am', 'hi', 'hey', 'hello', 'ok', 'okay', 'yes', 'no']);
    const cleanName = val.trim().split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w.toLowerCase())).slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    if (cleanName.length < 2) {
      addUserMessage(val);
      await addBotMessage(`Hmm, I didn't catch that 😅<br>Please share your full name (e.g. <i>Ramesh Kumar</i>)`);
      return;
    }

    addUserMessage(val);
    setOrderState(prev => ({ ...prev, name: cleanName }));
    setSavedCustomer(prev => ({ ...prev, name: cleanName }));
    setCurrentStep(2);
    setInputMode('tel');
    setInputPlaceholder('Enter 10-digit mobile number...');
    await addBotMessage(`Nice to meet you, <b>${cleanName}</b>! 🙏<br>Please share your <b>WhatsApp number</b> so we can reach you.`, 600);
  };

  // Step 2: Handle Phone Input
  const handlePhoneInput = async (val: string) => {
    const cleanPhone = val.replace(/\D/g, '');
    const isValid = /^[6-9]\d{9}$/.test(cleanPhone);

    if (!isValid) {
      addUserMessage(val);
      await addBotMessage(`That doesn't look right 🤔<br>Please enter a valid 10-digit Indian mobile number.`, 600);
      return;
    }

    addUserMessage(val);

    // Look up leads database for returning customer details
    let dbCustomer: any = null;
    try {
      const { data } = await supabaseLeads
        .from('customers')
        .select('*')
        .eq('phone', cleanPhone)
        .single();
      if (data) dbCustomer = data;
    } catch (e) {}

    let name = orderState.name;
    let location = orderState.location;

    if (dbCustomer) {
      name = dbCustomer.name;
      location = {
        label: dbCustomer.saved_address?.split(',')[0] || 'Saved Location',
        fullAddress: dbCustomer.saved_address,
        lat: parseFloat(dbCustomer.saved_lat),
        lng: parseFloat(dbCustomer.saved_lng)
      };
      await addBotMessage(`Found your profile! Prefilled name as <b>${name}</b>.`, 600);
    }

    const updatedCustomer = { ...savedCustomer, name, phone: cleanPhone, location };
    setOrderState(prev => ({ ...prev, name, phone: cleanPhone, location }));
    setSavedCustomer(updatedCustomer);
    localStorage.setItem('mypahad_customer', JSON.stringify(updatedCustomer));

    // Move to items selection
    // Check local storage cart
    let cart: any = {};
    try {
      cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
    } catch (e) {}
    const cartItems = cart[business.id]?.items || [];

    if (cartItems.length > 0) {
      setOrderState(prev => ({ ...prev, items: cartItems }));
      await addBotMessage(`I see you have <b>${cartItems.length} item(s)</b> in your cart: <br/>${cartItems.map((c: any) => `• ${c.name} (${c.variant || 'Standard'}) x ${c.quantity}`).join('<br/>')}`, 800);
      
      const isDeliveryAvailable = cartItems.some((c: any) => {
        const matched = listings.find(l => l.id === c.id);
        return matched?.has_delivery;
      });
      setTimeout(() => askDelivery(isDeliveryAvailable), 1000);
    } else {
      setCurrentStep(3);
      setInputMode('none');
      showProductPicker();
    }
  };

  // Step 3: Product Picker
  const showProductPicker = () => {
    if (listings.length === 0) {
      addBotMessage(`Currently, no products are available from this shop.`, 600);
      return;
    }

    addBotMessage(`What would you like to order? 🛍️`, 500);
    setChips(listings.map(l => ({
      label: l.name + (l.price ? ` - ${l.price}` : ''),
      value: l.id
    })));
  };

  const handleProductSelect = async (listId: string) => {
    setChips([]);
    const matched = listings.find(l => l.id === listId);
    if (!matched) return;

    addUserMessage(`I want to order ${matched.name}`);

    // Create temp item
    const newItem = {
      id: matched.id,
      name: matched.name,
      variant: null,
      price: parsePriceValue(matched.discount_price || matched.price),
      quantity: 1,
      qty_label: matched.qty_label || 'Quantity',
      has_delivery: matched.has_delivery
    };

    if (matched.variants && matched.variants.length > 0) {
      // Has variants, must choose
      showVariantPicker(matched, newItem);
    } else {
      // Ask Quantity
      askQuantity(newItem);
    }
  };

  // Step 3b: Variant Picker
  const showVariantPicker = (product: any, item: any) => {
    addBotMessage(`Great choice! Which pack size / variant? 📦`, 500);
    setChips(product.variants.map((v: any) => {
      const parsed = parseLegacyVariant(v);
      return {
        label: `${parsed.name} (₹${parsed.discount_price || parsed.price})`,
        value: parsed
      };
    }));

    // Listen to select
    setCurrentStep(4);
    // Bind temp item details to state to track
    setOrderState(prev => ({ ...prev, currentEditingItem: item }));
  };

  const handleVariantSelect = (variantObj: any) => {
    setChips([]);
    addUserMessage(`Selected: ${variantObj.name}`);
    const item = {
      ...orderState.currentEditingItem,
      variant: variantObj.name,
      price: parseFloat(variantObj.discount_price || variantObj.price) || itemPriceFallback()
    };
    askQuantity(item);
  };

  const itemPriceFallback = () => {
    return orderState.currentEditingItem?.price || 0;
  };

  // Step 3c: Ask Quantity
  const askQuantity = (item: any) => {
    addBotMessage(`How many packs of <b>${item.name}</b> (${item.variant || 'Standard'}) would you like?`, 500);
    setChips(['1', '2', '3', '4', '5'].map(q => ({ label: q, value: q })));
    setCurrentStep(5);
    setOrderState(prev => ({ ...prev, currentEditingItem: item }));
  };

  const handleQuantitySelect = (q: string) => {
    setChips([]);
    addUserMessage(`Quantity: ${q}`);
    const finalItem = {
      ...orderState.currentEditingItem,
      quantity: parseInt(q) || 1
    };

    // Add item to items array
    const updatedItems = [...orderState.items, finalItem];
    setOrderState(prev => ({
      ...prev,
      items: updatedItems,
      currentEditingItem: null
    }));

    // Check if item has delivery option
    const matched = listings.find(l => l.id === finalItem.id);
    const hasDelivery = matched?.has_delivery;

    askDelivery(hasDelivery);
  };

  // Step 4: Ask Delivery Method
  const askDelivery = (isDeliveryAvailable: boolean) => {
    if (isDeliveryAvailable) {
      addBotMessage(`Would you like <b>Home Delivery</b> or <b>Shop Pickup</b>? 🚚`, 500);
      setChips([
        { label: '🚚 Home Delivery', value: 'delivery' },
        { label: '🏪 Shop Pickup', value: 'pickup' }
      ]);
      setCurrentStep(6);
    } else {
      // Directly go to Buy Extra Items
      setOrderState(prev => ({ ...prev, delivery: 'pickup' }));
      askBuyExtra();
    }
  };

  const handleDeliverySelect = (val: string) => {
    setChips([]);
    addUserMessage(val === 'delivery' ? '🚚 Home Delivery' : '🏪 Shop Pickup');
    setOrderState(prev => ({ ...prev, delivery: val }));

    if (val === 'delivery') {
      askLocationPin();
    } else {
      askBuyExtra();
    }
  };

  // Step 5: Pin Location
  const askLocationPin = async () => {
    const loc = orderState.location;
    if (loc && loc.lat && loc.lng) {
      // Returning location
      await addBotMessage(`📍 I have your saved delivery address:`, 500);
      await addBotMessage(`<b>${loc.label}</b><br/>${loc.fullAddress}`);
      setChips([
        { label: '✅ Deliver to this address', value: 'use_saved' },
        { label: '📍 Change delivery pin', value: 'change_pin' }
      ]);
      setCurrentStep(7);
    } else {
      await addBotMessage(`Please pin your exact delivery location on the map below 🗺️<br/><span style="font-size:11px;color:#666">Drag the marker or search your area in Himachal Pradesh</span>`, 600);
      setCurrentStep(8);
      // Automatically trigger map overlay open
      setTimeout(() => {
        setMapOpen(true);
      }, 1000);
    }
  };

  const handleSavedLocationSelect = (val: string) => {
    setChips([]);
    if (val === 'use_saved') {
      addUserMessage(`✅ Deliver to saved address`);
      askBuyExtra();
    } else {
      addUserMessage(`📍 Change delivery pin`);
      setCurrentStep(8);
      setMapOpen(true);
    }
  };

  // Step 6: Ask for Extra Items
  const askBuyExtra = () => {
    addBotMessage(`Would you like to buy anything else from <b>${business.business_name}</b>? 🛍️`, 500);
    setChips([
      { label: 'Yes, add items', value: 'yes' },
      { label: 'No, proceed to checkout', value: 'no' }
    ]);
    setCurrentStep(9);
  };

  const handleBuyExtraSelect = (val: string) => {
    setChips([]);
    addUserMessage(val === 'yes' ? 'Yes, add more items' : 'No, proceed to checkout');

    if (val === 'yes') {
      // Open selector UI list inside chat
      setExtraSelectorOpen(true);
      setInputMode('none');
      setInputPlaceholder('Select items above...');
    } else {
      // Ask Notes
      askNotes();
    }
  };

  // Step 7: Ask Notes
  const askNotes = () => {
    addBotMessage(`Any special instructions for the order? (landmark, gate code, floor etc.)<br/>Or say <b>"No"</b> to skip 🙂`, 500);
    setCurrentStep(10);
    setInputMode('text');
    setInputPlaceholder('Type instructions or "No"...');
  };

  const handleNotesInput = (val: string) => {
    addUserMessage(val);
    setOrderState(prev => ({ ...prev, notes: val }));
    setInputMode('none');
    setInputPlaceholder('Please confirm order details below...');
    showOrderSummary(val);
  };

  // Step 8: Show Summary
  const showOrderSummary = (notesVal: string) => {
    const items = orderState.items;
    let subtotal = 0;
    items.forEach((item: any) => {
      subtotal += item.price * item.quantity;
    });

    const isDelivery = orderState.delivery === 'delivery';
    const deliveryCharges = business.delivery_charges || '0';
    const deliveryFeeNum = parseFloat(deliveryCharges.replace(/[^0-9.]/g, '')) || 0;
    const finalTotal = subtotal + (isDelivery ? deliveryFeeNum : 0);

    const summaryRows = [
      `🏪 <b>Seller:</b> ${business.business_name}`,
      `👤 <b>Name:</b> ${orderState.name}`,
      `📞 <b>Phone:</b> ${orderState.phone}`,
      `🛍️ <b>Items:</b><br/>${items.map((it: any) => ` - ${it.name} ${it.variant ? `(${it.variant})` : ''} x ${it.quantity} = ₹${it.price * it.quantity}`).join('<br/>')}`,
      `🚚 <b>Type:</b> ${isDelivery ? 'Home Delivery' : 'Shop Pickup'}`,
    ];

    if (isDelivery && orderState.location) {
      summaryRows.push(`📍 <b>Location:</b> ${orderState.location.label}<br/>${orderState.location.fullAddress}`);
      summaryRows.push(`🚚 <b>Delivery Charges:</b> ₹${deliveryCharges} <span style="font-size:10px;color:#777;">(may vary if location is too far)</span>`);
    }

    if (notesVal && notesVal.toLowerCase() !== 'no') {
      summaryRows.push(`📝 <b>Notes:</b> ${notesVal}`);
    }

    summaryRows.push(`💵 <b>Payment:</b> Cash on Delivery`);
    summaryRows.push(`💰 <b>Total Bill:</b> ₹${finalTotal}`);

    addBotMessage(`Here is your order summary 👇`, 500);
    setTimeout(() => {
      setMessages(prev => [...prev, {
        dir: 'in',
        isSummary: true,
        summaryText: summaryRows.join('<br/><br/>'),
        time: getFormattedTime()
      }]);
      
      // Confirm order chips
      setChips([
        { label: '✅ Confirm Order', value: 'confirm' },
        { label: '✏️ Start Over', value: 'restart' }
      ]);
      setCurrentStep(11);
    }, 800);
  };

  // Submit Order
  const handleFinalConfirmSelect = async (val: string) => {
    setChips([]);
    if (val === 'restart') {
      addUserMessage('✏️ Start Over');
      // Reset
      setOrderState({
        name: savedCustomer.name || '',
        phone: savedCustomer.phone || '',
        delivery: '',
        location: savedCustomer.location || null,
        items: [],
        notes: '',
        delivery_charges: ''
      });
      setMessages([]);
      bootChatFlow(business, savedCustomer);
    } else {
      addUserMessage('✅ Confirm Order');
      setIsTyping(true);

      try {
        // 1. Create/Update customer record in leads DB
        let customerId = null;
        const { data: exCust } = await supabaseLeads
          .from('customers')
          .select('id')
          .eq('phone', orderState.phone)
          .maybeSingle();

        if (exCust) {
          customerId = exCust.id;
          await supabaseLeads.from('customers').update({
            name: orderState.name,
            saved_address: orderState.location?.fullAddress || '',
            saved_lat: orderState.location?.lat || null,
            saved_lng: orderState.location?.lng || null,
            updated_at: new Date().toISOString()
          }).eq('id', customerId);
        } else {
          const { data: newCust, error: custErr } = await supabaseLeads.from('customers').insert({
            name: orderState.name,
            phone: orderState.phone,
            saved_address: orderState.location?.fullAddress || '',
            saved_lat: orderState.location?.lat || null,
            saved_lng: orderState.location?.lng || null
          }).select('id').single();

          if (custErr) throw custErr;
          customerId = newCust.id;
        }

        // 2. Insert Order
        let subtotal = 0;
        orderState.items.forEach((it: any) => {
          subtotal += it.price * it.quantity;
        });
        const deliveryFee = orderState.delivery === 'delivery' ? (parseFloat(business.delivery_charges?.replace(/[^0-9.]/g, '')) || 0) : 0;
        const totalBill = subtotal + deliveryFee;

        const businessLocation = {
          address: business.address || '',
          latitude: business.latitude || null,
          longitude: business.longitude || null
        };

        const { data: orderData, error: orderErr } = await supabaseLeads.from('orders').insert({
          customer_id: customerId,
          customer_name: orderState.name,
          customer_phone: orderState.phone,
          business_id: business.id,
          business_name: business.business_name,
          business_location: businessLocation,
          delivery_type: orderState.delivery,
          delivery_address: orderState.location?.fullAddress || '',
          delivery_lat: orderState.location?.lat || null,
          delivery_lng: orderState.location?.lng || null,
          delivery_charges: business.delivery_charges || '0',
          items: orderState.items,
          notes: orderState.notes,
          total_price: totalBill
        }).select('id').single();

        if (orderErr) throw orderErr;

        // Clear local storage cart for this business
        let cart: any = {};
        try {
          cart = JSON.parse(localStorage.getItem('mp_cart') || '{}');
        } catch (e) {}
        delete cart[business.id];
        localStorage.setItem('mp_cart', JSON.stringify(cart));

        setIsTyping(false);
        const refCode = 'MP' + orderData.id.slice(0, 6).toUpperCase();

        await addBotMessage(`🎉 <b>Order Confirmed!</b>`, 300);
        await addBotMessage(`Thank you, <b>${orderState.name}</b>!<br/>Your order reference is: <b>${refCode}</b><br/><br/>You will be contacted by <b>${business.business_name}</b> soon.<br/>Payment terms: <b>Cash on Delivery (COD)</b>.`, 600);
      } catch (err: any) {
        console.error('Order submission failed:', err);
        setIsTyping(false);
        await addBotMessage(`❌ <b>Order submission failed</b>: ${err.message}. Please try again later.`, 500);
      }
    }
  };

  // 4. Map Leaflet initialization & Geocoding
  useEffect(() => {
    if (mapOpen && leafletLoaded) {
      setTimeout(() => {
        initMap();
      }, 100);
    }
  }, [mapOpen, leafletLoaded]);

  const initMap = () => {
    const L = (window as any).L;
    if (!L) return;

    const hpCenter = [31.9, 77.1];
    let startCoords = hpCenter;

    if (orderState.location?.lat) {
      startCoords = [orderState.location.lat, orderState.location.lng];
    } else if (business.latitude && business.longitude) {
      startCoords = [business.latitude, business.longitude];
    }

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView(startCoords, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="font-size:32px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        className: ''
      });

      const marker = L.marker(startCoords, { draggable: true, icon }).addTo(map);
      marker.on('dragend', () => {
        const latlng = marker.getLatLng();
        reverseGeocode(latlng);
      });

      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        reverseGeocode(e.latlng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      reverseGeocode(L.latLng(startCoords[0], startCoords[1]));
    } else {
      mapRef.current.setView(startCoords, 13);
      markerRef.current.setLatLng(startCoords);
      mapRef.current.invalidateSize();
      reverseGeocode(L.latLng(startCoords[0], startCoords[1]));
    }
  };

  const reverseGeocode = (latlng: any) => {
    setCurrentAddress('Fetching address...');
    setMapConfirmEnabled(false);
    clearTimeout(geocodeTimerRef.current);

    geocodeTimerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`, {
          headers: { 'Accept-Language': 'en' }
        });
        const d = await r.json();
        const a = d.address || {};
        const parts = [
          a.house_number,
          a.road || a.pedestrian,
          a.village || a.suburb || a.neighbourhood || a.hamlet,
          a.town || a.city || a.county,
          a.state_district,
          a.state
        ].filter(Boolean);

        const fullAddress = parts.join(', ') || d.display_name || `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        const label = parts.slice(2, 5).join(', ') || 'Pinned Location';

        setCurrentAddress(fullAddress);
        setCurrentLocData({
          label,
          fullAddress,
          lat: latlng.lat,
          lng: latlng.lng
        });
        setMapConfirmEnabled(true);
      } catch (e) {
        const coordsStr = `${latlng.lat.toFixed(4)}°N, ${latlng.lng.toFixed(4)}°E`;
        setCurrentAddress(coordsStr);
        setCurrentLocData({
          label: 'Pinned Location',
          fullAddress: coordsStr,
          lat: latlng.lat,
          lng: latlng.lng
        });
        setMapConfirmEnabled(true);
      }
    }, 750);
  };

  const handleMapSearch = async () => {
    if (!mapSearchText.trim()) return;
    setCurrentAddress('Searching location...');
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchText.trim() + ', Himachal Pradesh, India')}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const d = await r.json();
      if (d && d.length > 0) {
        const L = (window as any).L;
        const ll = L.latLng(parseFloat(d[0].lat), parseFloat(d[0].lon));
        mapRef.current.setView(ll, 15);
        markerRef.current.setLatLng(ll);
        reverseGeocode(ll);
      } else {
        setCurrentAddress('Not found. Search for a different location name.');
      }
    } catch (e) {
      setCurrentAddress('Search failed.');
    }
  };

  const handleConfirmLocation = () => {
    if (!currentLocData) return;

    // Save location to orderState
    setOrderState(prev => ({ ...prev, location: currentLocData }));
    const updatedCustomer = { ...savedCustomer, location: currentLocData };
    setSavedCustomer(updatedCustomer);
    localStorage.setItem('mypahad_customer', JSON.stringify(updatedCustomer));

    setMapOpen(false);

    // Render location confirmed bubble
    setMessages(prev => [...prev, {
      dir: 'out',
      isLocation: true,
      label: currentLocData.label,
      fullAddress: currentLocData.fullAddress,
      time: getFormattedTime()
    }]);

    askBuyExtra();
  };

  // Add multiple items logic
  const handleExtraQuantityChange = (listId: string, d: number) => {
    setExtraQuantities(prev => {
      const q = prev[listId] || 0;
      return { ...prev, [listId]: Math.max(0, q + d) };
    });
  };

  const submitExtraItems = () => {
    const extraItemsToAdd: any[] = [];
    Object.keys(extraQuantities).forEach(listId => {
      const q = extraQuantities[listId];
      if (q > 0) {
        const item = listings.find(l => l.id === listId);
        if (item) {
          extraItemsToAdd.push({
            id: item.id,
            name: item.name,
            variant: null, // Select standard for multiple adding
            price: parsePriceValue(item.discount_price || item.price),
            quantity: q,
            qty_label: item.qty_label || 'Quantity'
          });
        }
      }
    });

    if (extraItemsToAdd.length > 0) {
      const newItems = [...orderState.items, ...extraItemsToAdd];
      setOrderState(prev => ({ ...prev, items: newItems }));
      addUserMessage(`Added ${extraItemsToAdd.length} extra product(s) to order`);
    } else {
      addUserMessage(`Proceeding without adding extra items`);
    }

    setExtraSelectorOpen(false);
    setExtraQuantities({});
    askNotes();
  };

  const parsePriceValue = (price: string | null | number): number => {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    const cleaned = String(price).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const parseLegacyVariant = (str: string) => {
    if (typeof str !== 'string') return str;
    try {
      return JSON.parse(str);
    } catch (e) {}

    let name = str;
    let price = 0;
    let discount_price: any = null;
    const match = str.match(/^(.*?)\s*[-–—:]\s*₹?\s*([0-9.]+)(?:\s*[-–—:]\s*₹?\s*([0-9.]+))?$/);
    if (match) {
      name = match[1].trim();
      price = parseFloat(match[2]) || 0;
      if (match[3]) discount_price = parseFloat(match[3]) || null;
    }
    return { name, price, discount_price };
  };

  // Submit Text Input manually
  const handleSendText = () => {
    const val = inputValue.trim();
    if (!val) return;
    setInputValue('');

    if (currentStep === 1) {
      handleNameInput(val);
    } else if (currentStep === 2) {
      handlePhoneInput(val);
    } else if (currentStep === 10) {
      handleNotesInput(val);
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[480px] mx-auto bg-[#ece5dd] shadow-lg relative font-sans">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-[#075E54] to-[#128C7E] sticky top-0 z-40 text-white shadow-md">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-lg font-bold">
          {business?.dp_url ? (
            <img src={getOptimizedImageUrl(business.dp_url, 'dp')} className="w-full h-full rounded-full object-cover" alt="" />
          ) : (
            '🌿'
          )}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold leading-tight">{business?.business_name || 'Loading Shop...'}</div>
          <div className="text-[10px] text-white/80 mt-0.5">🟢 {business?.areas?.name || 'Himachal Pradesh'} • Order Agent</div>
        </div>
        <div className="bg-white/15 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider">Chat Bot</div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 pb-[90px]">
        {messages.map((msg, idx) => {
          if (msg.isSummary) {
            return (
              <div key={idx} className="flex justify-start">
                <div className="max-w-[94%] bg-white rounded-lg border border-gray-200 overflow-hidden shadow-md">
                  <div className="bg-[#1a5c3a] text-white p-2 px-3 text-xs font-bold flex items-center gap-1.5">
                    🛒 Order Summary
                  </div>
                  <div className="p-3 text-[12px] text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: msg.summaryText }} />
                  <span className="block text-[9px] text-gray-400 text-right pr-2 pb-1.5">{msg.time}</span>
                </div>
              </div>
            );
          }

          if (msg.isLocation) {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[85%] bg-[#d9fdd3] rounded-lg p-2.5 shadow-sm border border-gray-150">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">📍</span>
                    <div className="text-xs text-gray-800 leading-normal">
                      <b className="text-[13px]">{msg.label}</b>
                      <div className="text-gray-500 text-[10px] mt-0.5">{msg.fullAddress}</div>
                    </div>
                  </div>
                  <span className="block text-[8px] text-[#7cad7e] text-right mt-1.5">{msg.time} ✓✓</span>
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className={`flex ${msg.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-lg p-2.5 text-[12.5px] leading-relaxed shadow-sm ${msg.dir === 'out' ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                <span dangerouslySetInnerHTML={{ __html: msg.text }} />
                <span className={`block text-[9px] text-right mt-1 ml-4 ${msg.dir === 'out' ? 'text-[#7cad7e]' : 'text-gray-400'}`}>
                  {msg.time} {msg.dir === 'out' && '✓✓'}
                </span>
              </div>
            </div>
          );
        })}

        {/* Typing Loader */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg rounded-tl-none p-3 flex gap-1 items-center shadow-sm">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}

        {/* Option Chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end pt-2">
            {chips.map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => {
                  if (currentStep === 3) handleProductSelect(chip.value);
                  else if (currentStep === 4) handleVariantSelect(chip.value);
                  else if (currentStep === 5) handleQuantitySelect(chip.value);
                  else if (currentStep === 6) handleDeliverySelect(chip.value);
                  else if (currentStep === 7) handleSavedLocationSelect(chip.value);
                  else if (currentStep === 9) handleBuyExtraSelect(chip.value);
                  else if (currentStep === 11) handleFinalConfirmSelect(chip.value);
                }}
                className="bg-white hover:bg-[#1a5c3a] hover:text-white border border-[#1a5c3a] text-[#1a5c3a] font-bold text-xs py-2 px-4 rounded-full shadow-sm transition-all"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Extra items list selector inline popup */}
      {extraSelectorOpen && (
        <div className="absolute inset-x-0 bottom-[56px] max-h-[360px] bg-white border-t border-gray-300 z-30 flex flex-col shadow-2xl">
          <div className="flex justify-between items-center p-2.5 px-3.5 bg-gray-50 border-b border-gray-250">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Add More Items</span>
            <button onClick={() => setExtraSelectorOpen(false)} className="text-gray-400 font-bold text-base hover:text-gray-600">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {listings.map(l => {
              const count = extraQuantities[l.id] || 0;
              return (
                <div key={l.id} className="flex gap-2.5 items-center p-2 rounded-lg border border-gray-150 hover:bg-gray-50">
                  {l.image_url ? (
                    <img src={getOptimizedImageUrl(l.image_url, 'card')} className="w-10 h-10 rounded object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-[#e8f5ee] flex items-center justify-center text-xs">📦</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-bold text-gray-800 truncate">{l.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{l.discount_price || l.price}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleExtraQuantityChange(l.id, -1)} className="w-5.5 h-5.5 rounded-full border border-gray-300 bg-white flex items-center justify-center font-bold text-xs">-</button>
                    <span className="text-[11px] font-semibold w-4 text-center">{count}</span>
                    <button onClick={() => handleExtraQuantityChange(l.id, 1)} className="w-5.5 h-5.5 rounded-full border border-gray-300 bg-white flex items-center justify-center font-bold text-xs">+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-2 bg-gray-50 border-t border-gray-200">
            <button onClick={submitExtraItems} className="w-full bg-[#1a5c3a] text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow">Confirm Items ✓</button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="fixed bottom-0 left-50% -translate-x-50% w-full max-w-[480px] bg-[#f0f0f0] border-t border-gray-300 p-2.5 flex gap-2 items-end z-40">
        <div className="flex-1 bg-white rounded-full p-2 px-4 shadow-sm border border-gray-250 flex items-center min-h-[40px]">
          <input
            type={inputMode === 'tel' ? 'tel' : 'text'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) handleSendText();
            }}
            placeholder={inputPlaceholder}
            disabled={inputMode === 'none'}
            className="w-full border-none outline-none font-sans text-[13px] bg-transparent text-gray-800 disabled:text-gray-400 placeholder:text-gray-400"
          />
        </div>
        <button
          onClick={handleSendText}
          disabled={!inputValue.trim() || inputMode === 'none'}
          className="w-10.5 h-10.5 rounded-full bg-[#128C7E] disabled:bg-gray-350 hover:bg-[#075E54] border-none flex items-center justify-center cursor-pointer transition-colors shrink-0"
        >
          <svg className="fill-white w-5 h-5" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>

      {/* Map Overlay Modal */}
      {mapOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
          <div className="w-full max-w-[480px] mx-auto bg-white rounded-t-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#1a5c3a] p-3 px-4 flex items-center text-white justify-between">
              <div>
                <h3 className="text-xs font-bold">📍 Pin Delivery Location</h3>
                <p className="text-[9px] text-white/70 mt-0.5">Search or drag the marker to your home</p>
              </div>
              <button onClick={() => setMapOpen(false)} className="bg-white/20 hover:bg-white/35 rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm text-white">&times;</button>
            </div>
            
            <div className="p-2.5 px-3 flex gap-2 bg-gray-50 border-b border-gray-150 items-center">
              <input
                type="text"
                value={mapSearchText}
                onChange={(e) => setMapSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMapSearch();
                }}
                placeholder="Search village, town, area in HP..."
                className="flex-1 p-2 border border-gray-350 rounded-lg text-xs outline-none"
              />
              <button onClick={handleMapSearch} className="bg-[#1a5c3a] text-white rounded-lg py-2 px-4 text-[11px] font-bold">Search</button>
            </div>

            <div ref={mapContainerRef} style={{ height: '300px', width: '100%', flexShrink: 0 }} />

            <div className="text-center text-[10px] text-gray-400 p-1.5 bg-gray-50 border-b border-gray-200">
              Drag the 📍 pin to adjust to your exact house / street
            </div>

            <div className="p-3 bg-white min-h-[50px]">
              <span className="text-[9px] font-bold text-gray-400 block tracking-wider uppercase mb-1">Selected Location</span>
              <div className={`text-[12px] font-semibold leading-relaxed ${currentAddress.includes('Fetching') || currentAddress.includes('Searching') ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                {currentAddress}
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <button
                onClick={handleConfirmLocation}
                disabled={!mapConfirmEnabled}
                className="w-full bg-[#1a5c3a] disabled:bg-gray-350 text-white font-bold text-xs py-3 rounded-lg text-center uppercase tracking-wider transition-colors shadow"
              >
                Confirm This Location ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
