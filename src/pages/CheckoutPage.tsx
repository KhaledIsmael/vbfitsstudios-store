import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../lib/orders';
import { getUserAddresses, createAddress, type Address } from '../lib/addresses';
import { validateDiscountCode } from '../lib/adminMarketing';

const GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Qalyubia',
  'Sharqia',
  'Dakahlia',
  'Gharbia',
  'Monufia',
  'Beheira',
  'Kafr El Sheikh',
  'Damietta',
  'Port Said',
  'Ismailia',
  'Suez',
  'Red Sea',
  'South Sinai',
  'North Sinai',
  'Beni Suef',
  'Faiyum',
  'Minya',
  'Asyut',
  'Sohag',
  'Qena',
  'Luxor',
  'Aswan',
  'Matrouh',
  'New Valley'
];

interface OrderSuccessData {
  orderNumber: string;
  trackingNumber: string;
  email: string;
  total: number;
}

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, subtotal, totalItems, clearCart } = useCart();
  const { user, isLoggedIn } = useAuth();

  // Contact Info (for guest or editable for user)
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Logged-in Saved Addresses
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');
  const [addressesLoading, setAddressesLoading] = useState(false);

  // New / Inline Address fields
  const [gov, setGov] = useState('Cairo');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [landmark, setLandmark] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'Cash on Delivery' | 'Pay Online'>('Cash on Delivery');
  const [paymentSubMethod, setPaymentSubMethod] = useState<'card' | 'wallet' | 'installments'>('card');
  const [walletPhone, setWalletPhone] = useState('');

  // Promo Code
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // Order notes
  const [orderNotes, setOrderNotes] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccessData | null>(null);

  // Populate user data when logged in
  useEffect(() => {
    if (isLoggedIn && user) {
      setContactName(user.name || '');
      setContactEmail(user.email || '');

      setAddressesLoading(true);
      getUserAddresses(user.id)
        .then((addrs) => {
          setSavedAddresses(addrs);
          const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            setContactPhone(defaultAddr.phone || '');
          } else {
            setSelectedAddressId('new');
          }
        })
        .finally(() => setAddressesLoading(false));
    }
  }, [isLoggedIn, user]);

  // Handle promo code
  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    const result = await validateDiscountCode(promoCode, subtotal);
    if (result.valid) {
      setAppliedDiscount(result.discountAmount);
      setPromoMessage(result.message);
    } else {
      setAppliedDiscount(0);
      setPromoMessage(result.message);
    }
  };

  // Grand total calculation
  const grandTotal = Math.max(0, subtotal - appliedDiscount);

  // Place Order Handler
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (cart.length === 0) {
      setErrorMessage('Your shopping bag is empty.');
      return;
    }

    // Validation
    if (!contactName.trim()) {
      setErrorMessage('Please provide your full legal name.');
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      setErrorMessage('Please provide a valid delivery confirmation email.');
      return;
    }
    if (!contactPhone.trim()) {
      setErrorMessage('Please enter a reachable mobile phone number for the courier.');
      return;
    }

    // Determine delivery address snapshot
    let finalAddressSnapshot: any = null;

    if (isLoggedIn && user && selectedAddressId !== 'new') {
      const chosen = savedAddresses.find((a) => a.id === selectedAddressId);
      if (chosen) {
        finalAddressSnapshot = {
          name: chosen.name,
          phone: chosen.phone || contactPhone,
          governorate: chosen.governorate,
          city: chosen.city,
          street: chosen.street,
          building: chosen.building,
          floor: chosen.floor,
          landmark: chosen.landmark,
          country: 'Egypt'
        };
      }
    }

    // If using inline / new address
    if (!finalAddressSnapshot) {
      if (!city.trim() || !street.trim()) {
        setErrorMessage('Please complete the City and Street Address fields.');
        return;
      }

      finalAddressSnapshot = {
        name: contactName.trim(),
        phone: contactPhone.trim(),
        governorate: gov.trim(),
        city: city.trim(),
        street: street.trim(),
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
        landmark: landmark.trim() || undefined,
        country: 'Egypt'
      };

      // If logged in and requested to save to profile
      if (isLoggedIn && user && saveToProfile) {
        createAddress(user.id, {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          governorate: gov.trim(),
          city: city.trim(),
          street: street.trim(),
          building: building.trim() || undefined,
          floor: floor.trim() || undefined,
          landmark: landmark.trim() || undefined,
          isDefault: savedAddresses.length === 0
        }).catch((err) => console.warn('Could not auto-save address:', err));
      }
    }

    // For online payments: no frontend card validation — handled by Paymob hosted page

    // Build items payload (shared by both payment paths)
    const itemsPayload = cart.map((item) => ({
      name: item.name,
      size: item.size,
      price: item.price,
      image: item.image,
      quantity: item.quantity
    }));

    setIsSubmitting(true);

    // ── ONLINE PAYMENT PATH: Create pending order → call Paymob → redirect ──
    if (paymentMethod === 'Pay Online') {
      // 1. Create a 'pending' order in Supabase first so we never lose the order
      const { order: pendingOrder, error: orderErr } = await createOrder({
        customerId: isLoggedIn && user ? user.id : null,
        items: itemsPayload,
        subtotal: grandTotal,
        shippingAddress: finalAddressSnapshot,
        paymentMethod: 'Pay Online',
        status: 'Placed',
        notes: `Payment: Pay Online (pending) | Email: ${contactEmail} | Phone: ${contactPhone}${orderNotes ? ' | ' + orderNotes : ''}`
      });

      setIsSubmitting(false);

      if (orderErr || !pendingOrder) {
        setErrorMessage(
          orderErr?.includes('violates row-level security')
            ? 'Guest orders are completing setup. Please sign in or try again shortly.'
            : `Order registration error: ${orderErr}`
        );
        return;
      }

      // 2. Build billing data for Paymob
      const nameParts = contactName.trim().split(' ');
      const billingData = {
        firstName: nameParts[0] || 'Guest',
        lastName: nameParts.slice(1).join(' ') || 'Client',
        email: contactEmail,
        phone: contactPhone,
        street: finalAddressSnapshot?.street || 'NA',
        building: finalAddressSnapshot?.building || 'NA',
        floor: finalAddressSnapshot?.floor || 'NA',
        apartment: finalAddressSnapshot?.floor || 'NA',
        city: finalAddressSnapshot?.city || 'Cairo',
        governorate: finalAddressSnapshot?.governorate || 'Cairo',
        country: 'EG'
      };

      // 3. Call Paymob serverless function
      try {
        setIsSubmitting(true);
        const channel = paymentSubMethod === 'installments' ? 'valu' : paymentSubMethod;
        const finalWalletPhone = paymentSubMethod === 'wallet' ? (walletPhone.trim() || contactPhone.trim()) : undefined;

        const paymobRes = await fetch('/api/paymob/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: pendingOrder.id,
            orderNumber: pendingOrder.order_number,
            amountCents: Math.round(grandTotal * 100),
            currency: 'EGP',
            paymentChannel: channel,
            walletPhone: finalWalletPhone,
            billingData
          })
        });

        const paymobData = await paymobRes.json();
        setIsSubmitting(false);

        if (!paymobRes.ok || paymobData.error) {
          setErrorMessage(
            paymobData.error ||
              'The payment gateway is temporarily unavailable. Please choose Cash on Delivery or try again.'
          );
          return;
        }

        // 4. Redirect to Paymob hosted payment page
        // Note: We preserve cart in state so if the payment is declined or cancelled,
        // the client does not lose their shopping bag! Cart is cleared upon verified callback.
        window.location.href = paymobData.redirectUrl;
        return;
      } catch (fetchErr: any) {
        setIsSubmitting(false);
        setErrorMessage(
          'Unable to reach the payment gateway. Please check your connection or select Cash on Delivery.'
        );
        return;
      }
    }

    // ── COD PATH: create order directly and navigate to confirmation ──

    const notesSummary = [
      `Payment: Cash on Delivery`,
      contactEmail ? `Contact Email: ${contactEmail}` : null,
      contactPhone ? `Contact Phone: ${contactPhone}` : null,
      orderNotes ? `Notes: ${orderNotes}` : null
    ]
      .filter(Boolean)
      .join(' | ');

    const { order, error } = await createOrder({
      customerId: isLoggedIn && user ? user.id : null,
      items: itemsPayload,
      subtotal: grandTotal,
      shippingAddress: finalAddressSnapshot,
      paymentMethod: 'Cash on Delivery',
      notes: notesSummary,
      status: 'Placed'
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(
        error.includes('violates row-level security')
          ? 'Guest orders are currently completing setup. Please sign in or try again shortly.'
          : `Order placement notice: ${error}`
      );
      return;
    }

    // COD success → deep-link to order confirmation page with real UUID
    clearCart();
    const orderId = order?.id;
    navigate(orderId ? `/order-confirmation/${orderId}` : '/order-confirmation', {
      state: {
        orderNumber: order?.order_number || 'VBF-CONFIRMED',
        trackingNumber: order?.tracking_number || '',
        email: contactEmail,
        total: grandTotal,
        paymentMethod: 'COD',
        paymentStatus: 'pending_collection',
        address: finalAddressSnapshot
      }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW: Order Confirmation View (legacy in-page view — kept for fallback)
  // ─────────────────────────────────────────────────────────────────────────────
  if (orderSuccess) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 sm:px-8 text-center space-y-8 animate-fade-in">
          {/* Status Badge */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-black text-black mx-auto mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-luxury text-[#888888]">
              Acquisition Confirmed
            </span>
            <h1 className="text-2xl sm:text-4xl font-light uppercase tracking-wider text-black">
              Thank You for Your Order
            </h1>
            <p className="text-xs text-[#666666] max-w-md mx-auto leading-relaxed">
              Your garments have been registered into the private fulfillment registry. A digital receipt has been dispatched to{' '}
              <strong className="text-black font-semibold">{orderSuccess.email}</strong>.
            </p>
          </div>

          {/* Details Card */}
          <div className="border border-[#EAEAEA] p-6 sm:p-8 bg-[#FAFAFA] space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-3 text-xs">
              <span className="text-[#888888] uppercase tracking-wider">Order Reference</span>
              <span className="font-semibold text-black uppercase tracking-wider">{orderSuccess.orderNumber}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-3 text-xs">
              <span className="text-[#888888] uppercase tracking-wider">Discreet Tracking ID</span>
              <span className="font-mono text-black">{orderSuccess.trackingNumber}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-3 text-xs">
              <span className="text-[#888888] uppercase tracking-wider">Fulfillment Method</span>
              <span className="text-black uppercase tracking-wider">Express Courier Delivery</span>
            </div>
            <div className="flex justify-between items-center pt-1 text-xs">
              <span className="text-[#888888] uppercase tracking-wider">Total Value</span>
              <span className="font-semibold text-black text-sm">${orderSuccess.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {isLoggedIn ? (
              <Link
                to="/profile"
                className="bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all"
              >
                View Order in Profile
              </Link>
            ) : (
              <Link
                to="/register"
                className="bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all"
              >
                Create Account to Track
              </Link>
            )}
            <Link
              to="/shop"
              className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-8 font-medium transition-all"
            >
              Continue Exploring
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW: Empty Bag View
  // ─────────────────────────────────────────────────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-white">
        <div className="max-w-md mx-auto px-6 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full border border-[#EAEAEA] flex items-center justify-center mx-auto text-[#888888]">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl uppercase tracking-wider font-light text-black">
              Your Shopping Bag is Empty
            </h1>
            <p className="text-xs text-[#777777] leading-relaxed">
              Explore our luxury prêt-à-porter collection to add garments before proceeding to checkout.
            </p>
          </div>
          <Link
            to="/shop"
            className="inline-block bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-3.5 px-8 font-medium transition-all"
          >
            Explore the Capsule
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW: Main Checkout Page
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white text-[#111111]">
      <div className="max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16">
        
        {/* Navigation Breadcrumb */}
        <div className="py-4 text-[11px] text-[#888888] tracking-luxury uppercase border-b border-[#EAEAEA] flex items-center justify-between">
          <div>
            <Link to="/" className="hover:text-black transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <Link to="/shop" className="hover:text-black transition-colors">Shop</Link>
            <span className="mx-2">/</span>
            <span className="text-black font-medium">Checkout</span>
          </div>
          <span className="text-[10px] tracking-widest text-[#999999] uppercase">
            Private & Encrypted
          </span>
        </div>

        {/* Layout Grid: Left Form (7 cols) + Right Summary Sidebar (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 pt-8">
          
          {/* LEFT: Checkout Form */}
          <div className="lg:col-span-7 space-y-10">
            
            {/* Header */}
            <div>
              <span className="text-[10px] uppercase tracking-luxury text-[#888888]">
                Courier Fulfillment
              </span>
              <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-black mt-1">
                Finalize Acquisition
              </h1>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-4 bg-[#FFF5F5] border border-[#FEB2B2] text-[#C53030] text-xs flex justify-between items-center animate-fade-in">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="font-semibold text-black hover:opacity-60 ml-3"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Auth status notification banner */}
            <div className="border border-[#EAEAEA] p-4 bg-[#FAFAFA] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {isLoggedIn && user ? (
                <>
                  <span className="text-[#555555]">
                    Signed in as <strong className="text-black font-semibold">{user.name}</strong> ({user.email})
                  </span>
                  <Link
                    to="/profile"
                    className="text-[11px] text-black uppercase tracking-wider underline hover:opacity-60"
                  >
                    View Account
                  </Link>
                </>
              ) : (
                <>
                  <span className="text-[#555555]">
                    Completing order as <strong>Guest</strong>. Already a Private Client member?
                  </span>
                  <Link
                    to="/login"
                    className="text-[11px] text-black uppercase tracking-wider underline hover:opacity-60 font-semibold"
                  >
                    Sign In for Saved Addresses
                  </Link>
                </>
              )}
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-10">
              
              {/* ───────────────────────────────────────────────────────────── */}
              {/* SECTION 1: Client Contact Information */}
              {/* ───────────────────────────────────────────────────────────── */}
              <section className="space-y-4">
                <div className="border-b border-[#EAEAEA] pb-2">
                  <h2 className="text-xs uppercase tracking-widest font-semibold text-black">
                    1. Contact Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      required
                      placeholder="e.g. Christian Dior"
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                      Email Address (Order Confirmation) *
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      placeholder="name@domain.com"
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                    Mobile Phone Number (Courier Tracking) *
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                    placeholder="+20 100 000 0000"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                  />
                  <p className="text-[10px] text-[#888888] mt-1">
                    Used strictly for discreet courier delivery call before arrival.
                  </p>
                </div>
              </section>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* SECTION 2: Shipping Destination */}
              {/* ───────────────────────────────────────────────────────────── */}
              <section className="space-y-4">
                <div className="border-b border-[#EAEAEA] pb-2 flex justify-between items-center">
                  <h2 className="text-xs uppercase tracking-widest font-semibold text-black">
                    2. Delivery Coordinates
                  </h2>
                  {isLoggedIn && savedAddresses.length > 0 && (
                    <span className="text-[10px] uppercase tracking-luxury text-[#888888]">
                      {savedAddresses.length} Saved in Registry
                    </span>
                  )}
                </div>

                {/* Logged-in: Pick from Saved Addresses */}
                {isLoggedIn && savedAddresses.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#666666]">Select from your saved addresses:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedAddresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`border p-4 cursor-pointer block transition-all text-xs ${
                            selectedAddressId === addr.id
                              ? 'border-black ring-1 ring-black bg-[#FAFAFA]'
                              : 'border-[#EAEAEA] hover:border-[#CCCCCC] bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="shipping_address_choice"
                                value={addr.id}
                                checked={selectedAddressId === addr.id}
                                onChange={() => setSelectedAddressId(addr.id)}
                                className="accent-black"
                              />
                              <span className="font-semibold text-black uppercase tracking-wider">{addr.name}</span>
                            </div>
                            {addr.isDefault && (
                              <span className="text-[9px] uppercase tracking-widest text-black bg-[#EEEEEE] px-1.5 py-0.5">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="pl-6 pt-2 text-[#666666] space-y-0.5 text-[11px]">
                            <p className="text-black font-medium">
                              {addr.street}
                              {addr.building ? `, Bldg ${addr.building}` : ''}
                              {addr.floor ? `, Fl ${addr.floor}` : ''}
                            </p>
                            <p>{addr.city}, {addr.governorate}</p>
                            {addr.phone && <p className="text-[#888888]">Tel: {addr.phone}</p>}
                          </div>
                        </label>
                      ))}

                      {/* Option to use a new address */}
                      <label
                        className={`border p-4 cursor-pointer block transition-all text-xs ${
                          selectedAddressId === 'new'
                            ? 'border-black ring-1 ring-black bg-[#FAFAFA]'
                            : 'border-[#EAEAEA] hover:border-[#CCCCCC] bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="shipping_address_choice"
                            value="new"
                            checked={selectedAddressId === 'new'}
                            onChange={() => setSelectedAddressId('new')}
                            className="accent-black"
                          />
                          <span className="font-semibold text-black uppercase tracking-wider">
                            + Deliver to a New Address
                          </span>
                        </div>
                        <p className="pl-6 pt-2 text-[#777777] text-[11px]">
                          Enter alternative destination coordinates below.
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {/* Inline Address Inputs (Shown for guests, or if logged-in selects "new" or has 0 addresses) */}
                {(!isLoggedIn || selectedAddressId === 'new' || savedAddresses.length === 0) && (
                  <div className="space-y-4 pt-2 border-t border-[#F0F0F0]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                          Governorate *
                        </label>
                        <select
                          value={gov}
                          onChange={(e) => setGov(e.target.value)}
                          required
                          className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                        >
                          {GOVERNORATES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                          City / District *
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          placeholder="e.g. New Cairo / Zamalek"
                          className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        required
                        placeholder="e.g. 15 South 90th Street"
                        className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                          Building No. / Compound
                        </label>
                        <input
                          type="text"
                          value={building}
                          onChange={(e) => setBuilding(e.target.value)}
                          placeholder="e.g. Tower 4, Apt 12"
                          className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                          Floor / Apartment
                        </label>
                        <input
                          type="text"
                          value={floor}
                          onChange={(e) => setFloor(e.target.value)}
                          placeholder="e.g. 3rd Floor"
                          className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                        Landmark / Courier Instructions
                      </label>
                      <input
                        type="text"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        placeholder="e.g. Beside Dusit Thani, Behind Mall"
                        className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                      />
                    </div>

                    {isLoggedIn && (
                      <label className="flex items-center gap-2.5 cursor-pointer pt-1 text-xs select-none">
                        <input
                          type="checkbox"
                          checked={saveToProfile}
                          onChange={(e) => setSaveToProfile(e.target.checked)}
                          className="w-4 h-4 accent-black rounded-none"
                        />
                        <span className="text-[#555555]">
                          Save this destination to my Private Client profile
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </section>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* SECTION 3: Settlement Method */}
              {/* ───────────────────────────────────────────────────────────── */}
              <section className="space-y-4">
                <div className="border-b border-[#EAEAEA] pb-2 flex justify-between items-center">
                  <h2 className="text-xs uppercase tracking-widest font-semibold text-black">
                    3. Settlement Method
                  </h2>
                  <span className="text-[10px] text-[#888888] uppercase tracking-wider">
                    Egyptian Market Certified
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Option 1: Cash on Delivery */}
                  <label
                    className={`border p-5 cursor-pointer block transition-all ${
                      paymentMethod === 'Cash on Delivery'
                        ? 'border-black ring-1 ring-black bg-[#FAFAFA]'
                        : 'border-[#EAEAEA] hover:border-[#CCCCCC] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="payment_choice"
                          value="Cash on Delivery"
                          checked={paymentMethod === 'Cash on Delivery'}
                          onChange={() => setPaymentMethod('Cash on Delivery')}
                          className="accent-black"
                        />
                        <span className="text-xs font-semibold text-black uppercase tracking-wider">
                          Cash on Delivery
                        </span>
                      </div>
                      <span className="text-[10px] text-[#666666] uppercase tracking-wider">
                        COD
                      </span>
                    </div>
                    <p className="pl-6 pt-2 text-[11px] text-[#666666] leading-relaxed">
                      Settle payment in physical currency or via POS card machine directly with the private courier at delivery.
                    </p>
                  </label>

                  {/* Option 2: Pay Online */}
                  <label
                    className={`border p-5 cursor-pointer block transition-all ${
                      paymentMethod === 'Pay Online'
                        ? 'border-black ring-1 ring-black bg-[#FAFAFA]'
                        : 'border-[#EAEAEA] hover:border-[#CCCCCC] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="payment_choice"
                          value="Pay Online"
                          checked={paymentMethod === 'Pay Online'}
                          onChange={() => setPaymentMethod('Pay Online')}
                          className="accent-black"
                        />
                        <span className="text-xs font-semibold text-black uppercase tracking-wider">
                          Pay Online
                        </span>
                      </div>
                      <span className="text-[9px] uppercase tracking-widest text-black bg-[#EEEEEE] px-1.5 py-0.5 font-semibold">
                        Instant Lock
                      </span>
                    </div>
                    <p className="pl-6 pt-2 text-[11px] text-[#666666] leading-relaxed">
                      Cards (Visa, MC, Meeza), Mobile Wallets (Vodafone Cash, etc.), or Installments (ValU/Sympl).
                    </p>
                  </label>

                </div>

                {/* Online Payment Channels Sub-Selector */}
                {paymentMethod === 'Pay Online' && (
                  <div className="border border-[#EAEAEA] p-5 bg-[#FAFAFA] space-y-4 animate-fade-in text-xs">
                    <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-2">
                      <span className="text-[10px] uppercase tracking-widest text-black font-semibold">
                        Select Payment Channel
                      </span>
                      <span className="text-[9px] uppercase tracking-luxury text-[#888888]">
                        Powered by Paymob
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Channel 1: Bank Cards & Meeza */}
                      <button
                        type="button"
                        onClick={() => setPaymentSubMethod('card')}
                        className={`text-left p-3 border transition-all ${
                          paymentSubMethod === 'card'
                            ? 'border-black bg-white ring-1 ring-black shadow-sm'
                            : 'border-[#EAEAEA] bg-[#F7F7F7] hover:border-[#CCCCCC]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-black">
                            Bank Cards
                          </span>
                          <span className="text-[9px] text-[#777777]">MEEZA</span>
                        </div>
                        <p className="text-[10px] text-[#666666] leading-tight">
                          Visa, Mastercard, & Egyptian Meeza cards.
                        </p>
                      </button>

                      {/* Channel 2: Mobile Wallets */}
                      <button
                        type="button"
                        onClick={() => setPaymentSubMethod('wallet')}
                        className={`text-left p-3 border transition-all ${
                          paymentSubMethod === 'wallet'
                            ? 'border-black bg-white ring-1 ring-black shadow-sm'
                            : 'border-[#EAEAEA] bg-[#F7F7F7] hover:border-[#CCCCCC]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-black">
                            Smart Wallets
                          </span>
                          <span className="text-[9px] bg-black text-white px-1 py-0.2">FAST</span>
                        </div>
                        <p className="text-[10px] text-[#666666] leading-tight">
                          Vodafone Cash, Orange, WE, Etisalat, InstaPay.
                        </p>
                      </button>

                      {/* Channel 3: Installments (BNPL) */}
                      <button
                        type="button"
                        onClick={() => setPaymentSubMethod('installments')}
                        className={`text-left p-3 border transition-all ${
                          paymentSubMethod === 'installments'
                            ? 'border-black bg-white ring-1 ring-black shadow-sm'
                            : 'border-[#EAEAEA] bg-[#F7F7F7] hover:border-[#CCCCCC]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-black">
                            Installments
                          </span>
                          <span className="text-[9px] text-[#777777]">ValU / Sympl</span>
                        </div>
                        <p className="text-[10px] text-[#666666] leading-tight">
                          Flexible plans up to 60 mos with 0% down payment.
                        </p>
                      </button>
                    </div>

                    {/* Specific details per channel */}
                    {paymentSubMethod === 'wallet' && (
                      <div className="pt-2 border-t border-[#EAEAEA] space-y-2">
                        <label className="block text-[10px] uppercase tracking-widest text-[#555555] font-medium">
                          Wallet Registered Mobile Number (Optional — for direct OTP push)
                        </label>
                        <input
                          type="tel"
                          value={walletPhone}
                          onChange={(e) => setWalletPhone(e.target.value)}
                          placeholder={contactPhone || '010 1234 5678'}
                          className="w-full bg-white border border-[#EAEAEA] px-3 py-2.5 text-xs text-black focus:outline-none focus:border-black rounded-none"
                        />
                        <p className="text-[10px] text-[#888888]">
                          Accepts Vodafone Cash, Orange Money, Etisalat Cash, WE Pay, or Smart Wallet linked accounts.
                        </p>
                      </div>
                    )}

                    {paymentSubMethod === 'installments' && (
                      <div className="pt-2 border-t border-[#EAEAEA] flex items-center justify-between bg-white p-3 border border-[#EAEAEA]">
                        <div>
                          <p className="text-[11px] font-semibold text-black">
                            Estimated Monthly Installment
                          </p>
                          <p className="text-[10px] text-[#666666]">
                            Starting from ~{(grandTotal / 6).toFixed(0)} EGP/month over 6 months
                          </p>
                        </div>
                        <span className="text-[10px] font-mono uppercase bg-[#111111] text-white px-2 py-1">
                          ValU · Sympl
                        </span>
                      </div>
                    )}

                    {paymentSubMethod === 'card' && (
                      <div className="pt-1 flex items-center justify-between text-[10px] text-[#888888]">
                        <span>Supported Cards: Visa, Mastercard, Meeza debit/credit, American Express</span>
                        <span className="font-mono uppercase text-black">256-bit SSL</span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Special Instructions (Optional) */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                  Delivery Notes / Gate Code (Optional)
                </label>
                <textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Leave with private concierge / Ring second doorbell"
                  className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                />
              </div>

              {/* Submit CTA button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#111111] hover:bg-black text-white py-4 px-8 text-xs uppercase tracking-luxury font-medium transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      {paymentMethod === 'Pay Online'
                        ? 'Connecting to Payment Gateway…'
                        : 'Transmitting Order to Courier…'}
                    </span>
                  </>
                ) : (
                  <span>
                    {paymentMethod === 'Pay Online'
                      ? `Proceed to Payment • ${grandTotal.toFixed(2)} USD`
                      : `Confirm Acquisition • ${grandTotal.toFixed(2)} USD`}
                  </span>
                )}
              </button>

              <p className="text-[10px] text-center text-[#888888] tracking-wider uppercase">
                By placing your order you consent to VB Fits Studios Terms of Service & Privacy Policy.
              </p>
            </form>
          </div>

          {/* RIGHT: Order Summary Sidebar (5 cols, sticky) */}
          <div className="lg:col-span-5">
            <div className="border border-[#EAEAEA] p-6 sm:p-8 bg-[#FAFAFA] sticky top-36 space-y-6">
              
              {/* Header */}
              <div className="flex justify-between items-baseline border-b border-[#EAEAEA] pb-4">
                <h3 className="text-xs uppercase tracking-widest font-semibold text-black">
                  Order Summary
                </h3>
                <span className="text-[11px] text-[#777777] uppercase tracking-wider">
                  {totalItems} {totalItems === 1 ? 'Silhouette' : 'Silhouettes'}
                </span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-[#EAEAEA] max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={`${item.id}-${item.size}`} className="py-3.5 flex items-center gap-4">
                    <div className="w-14 h-16 bg-white border border-[#EAEAEA] flex-shrink-0 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain p-1 mix-blend-multiply"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-medium text-black uppercase truncate">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-[#777777] mt-0.5">
                        Size: {item.size} • Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-xs font-medium text-black">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Privilege / Promo Code Form */}
              <form onSubmit={handleApplyPromo} className="pt-2 border-t border-[#EAEAEA] space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Voucher or Privilege Code"
                    className="flex-1 bg-white border border-[#EAEAEA] px-3 py-2 text-xs uppercase text-black focus:outline-none focus:border-black rounded-none"
                  />
                  <button
                    type="submit"
                    className="border border-[#CCCCCC] hover:border-black bg-white hover:bg-black hover:text-white px-4 py-2 text-[10px] uppercase tracking-luxury font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {promoMessage && (
                  <p className="text-[10px] text-[#666666] tracking-wider italic">
                    {promoMessage}
                  </p>
                )}
              </form>

              {/* Financial Breakdown */}
              <div className="space-y-2.5 pt-4 border-t border-[#EAEAEA] text-xs">
                <div className="flex justify-between text-[#666666]">
                  <span>Subtotal</span>
                  <span className="text-black font-medium">${subtotal.toFixed(2)}</span>
                </div>

                {appliedDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Privilege Discount</span>
                    <span>-${appliedDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[#666666]">
                  <span>Express Courier Transit</span>
                  <span className="uppercase text-[11px] tracking-wider text-black font-medium">
                    Complimentary
                  </span>
                </div>

                <div className="flex justify-between text-[#666666]">
                  <span>Import Duties & Taxes</span>
                  <span className="uppercase text-[11px] tracking-wider text-black font-medium">
                    Included
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-4 border-t border-black/10 text-sm font-semibold text-black">
                  <span className="uppercase tracking-widest">Total Value</span>
                  <span className="text-base">${grandTotal.toFixed(2)} USD</span>
                </div>
              </div>

              {/* Luxury Guarantee Badges */}
              <div className="pt-4 border-t border-[#EAEAEA] space-y-2.5 text-[10px] text-[#777777] uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Signature luxury archival box & protective garment bag</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Discreet express courier transit with tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>14-day client returns & complimentary sizing exchange</span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
