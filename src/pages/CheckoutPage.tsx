import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../lib/orders';
import { getUserAddresses, createAddress, type Address } from '../lib/addresses';
import { validateDiscountCode } from '../lib/adminMarketing';
import { calculateShippingFee, getEstimatedShippingFee, type ShippingZone } from '../lib/shippingZones';
import { BRAND_CONFIG } from '../config/assets';

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

// Payment Method: Cash on Delivery is the only option for new orders.
type PaymentMethodOption = 'Cash on Delivery';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, subtotal, totalItems, clearCart } = useCart();
  const { user, supabaseUser, isLoggedIn } = useAuth();

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

  // Payment Method (Cash on Delivery is the only option for new orders)
  const paymentMethod: PaymentMethodOption = 'Cash on Delivery';

  // Promo Code
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // Order notes
  const [orderNotes, setOrderNotes] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccessData | null>(null);

  // Populate user data dynamically when logged in
  useEffect(() => {
    if (isLoggedIn && user) {
      setContactName(user.name || '');
      setContactEmail(user.email || '');

      // Resolve phone dynamically for the logged in user
      const userPhone = user.phone || supabaseUser?.user_metadata?.phone || supabaseUser?.phone || '';
      setContactPhone(userPhone);

      setAddressesLoading(true);
      getUserAddresses(user.id)
        .then((addrs) => {
          setSavedAddresses(addrs);
          const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            // Only override phone from address if user didn't have one on account
            if (!userPhone && defaultAddr.phone) {
              setContactPhone(defaultAddr.phone);
            }
          } else {
            setSelectedAddressId('new');
          }
        })
        .finally(() => setAddressesLoading(false));
    } else if (!isLoggedIn) {
      // Clear data when not logged in so no previous account's details persist
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setSavedAddresses([]);
      setSelectedAddressId('new');
    }
  }, [isLoggedIn, user?.id, user?.phone]);

  const handleSelectAddress = (addrId: string) => {
    setSelectedAddressId(addrId);
    if (addrId === 'new') {
      const uPhone = user?.phone || supabaseUser?.user_metadata?.phone || '';
      if (uPhone) setContactPhone(uPhone);
    } else {
      const chosen = savedAddresses.find((a) => a.id === addrId);
      if (chosen?.phone) {
        setContactPhone(chosen.phone);
      }
    }
  };

  // Handle promo code (validated by the database; the order trigger re-validates and
  // recomputes the final discount, so this value is only a preview)
  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    const result = await validateDiscountCode(promoCode, subtotal);
    if (result.valid) {
      setAppliedDiscount(result.discountAmount);
      setAppliedPromoCode(promoCode.trim().toUpperCase());
      setPromoMessage(result.message);
    } else {
      setAppliedDiscount(0);
      setAppliedPromoCode(null);
      setPromoMessage(result.message);
    }
  };

  // Re-validate the applied code whenever the cart subtotal changes
  useEffect(() => {
    if (!appliedPromoCode) return;
    let isMounted = true;
    validateDiscountCode(appliedPromoCode, subtotal).then((result) => {
      if (!isMounted) return;
      if (result.valid) {
        setAppliedDiscount(result.discountAmount);
      } else {
        setAppliedDiscount(0);
        setAppliedPromoCode(null);
        setPromoMessage(result.message);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [subtotal, appliedPromoCode]);

  // Active governorate based on selected saved address or inline form
  const effectiveGov = useMemo(() => {
    if (isLoggedIn && user && selectedAddressId !== 'new') {
      const chosen = savedAddresses.find((a) => a.id === selectedAddressId);
      return chosen?.governorate || gov;
    }
    return gov;
  }, [isLoggedIn, user, selectedAddressId, savedAddresses, gov]);

  // Dynamic Shipping calculation state
  const [shippingFee, setShippingFee] = useState<number>(() => getEstimatedShippingFee('Cairo', subtotal));
  const [currentZone, setCurrentZone] = useState<ShippingZone | null>(null);

  // Recalculate shipping fee dynamically whenever the governorate or subtotal changes.
  // Shipping is always charged (no free-shipping threshold).
  useEffect(() => {
    let isMounted = true;
    calculateShippingFee(effectiveGov, subtotal).then((res) => {
      if (isMounted) {
        setShippingFee(res.fee);
        setCurrentZone(res.zone);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [effectiveGov, subtotal]);

  // Cash on Delivery is the only payment method; destinations without COD cannot be ordered to
  const codUnavailable = !!currentZone && currentZone.cod_available === false;

  // Grand total calculation (subtotal minus discount plus governorate shipping fee)
  const grandTotal = Math.max(0, subtotal - appliedDiscount + shippingFee);

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
    if (codUnavailable) {
      setErrorMessage(
        `Cash on Delivery is unavailable for ${effectiveGov}, so orders to this destination cannot be placed. Please choose a different delivery governorate.`
      );
      return;
    }

    // Determine delivery address snapshot
    let finalAddressSnapshot: any = null;

    if (isLoggedIn && user && selectedAddressId !== 'new') {
      const chosen = savedAddresses.find((a) => a.id === selectedAddressId);
      if (chosen) {
        finalAddressSnapshot = {
          name: chosen.name,
          email: contactEmail.trim(),
          phone: chosen.phone || contactPhone,
          governorate: chosen.governorate,
          city: chosen.city,
          street: chosen.street,
          building: chosen.building,
          floor: chosen.floor,
          landmark: chosen.landmark,
          country: 'Egypt',
          customer_id: user.id
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
        email: contactEmail.trim(),
        phone: contactPhone.trim(),
        governorate: gov.trim(),
        city: city.trim(),
        street: street.trim(),
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
        landmark: landmark.trim() || undefined,
        country: 'Egypt',
        customer_id: isLoggedIn && user ? user.id : undefined
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
      productId: item.productId,
      name: item.name,
      size: item.size,
      color: item.color,
      price: item.price,
      image: item.image,
      quantity: item.quantity
    }));

    setIsSubmitting(true);

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
      subtotal: subtotal,
      discountAmount: appliedDiscount,
      shippingAmount: shippingFee,
      total: grandTotal,
      discountCode: appliedPromoCode || undefined,
      shippingAddress: finalAddressSnapshot,
      paymentMethod: 'Cash on Delivery',
      notes: notesSummary,
      status: 'pending'
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
        total: Number(order?.total ?? grandTotal),
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
              <span className="font-semibold text-black text-sm">{orderSuccess.total.toFixed(2)} EGP</span>
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
  // VIEW: Main Checkout — Shopify-style two-column layout
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── TOP HEADER BAR (fixed, replaces global navbar on checkout) ── */}
      <div className="fixed top-0 left-0 right-0 z-[40] border-b border-[#E8E8E8] bg-white shadow-sm">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 h-16 sm:h-20 flex items-center justify-between">
          {/* Back to shop link */}
          <Link to="/shop" className="text-[11px] text-[#888888] hover:text-black transition-colors flex items-center gap-1.5 uppercase tracking-wider min-w-[80px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Shop
          </Link>

          {/* Logo centered */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <img
              src={BRAND_CONFIG.logo.dark}
              alt={BRAND_CONFIG.logo.alt}
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </Link>

          {/* Cart icon with count */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#555555] uppercase tracking-wider min-w-[80px] justify-end">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="font-semibold text-black text-[13px]">{totalItems}</span>
          </div>
        </div>
      </div>

      {/* Spacer to push content below the fixed header */}
      <div className="h-16 sm:h-20 flex-shrink-0" />

      {/* ── MAIN TWO-COLUMN BODY ── */}
      <div className="flex flex-col lg:flex-row flex-1">

        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Checkout Form (white bg)
        ════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 lg:max-w-[56%] px-5 sm:px-8 lg:px-14 xl:px-20 py-8 lg:py-10 order-2 lg:order-1">

          {/* Error notification */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-[#FFF5F5] border border-[#FEB2B2] text-[#C53030] text-xs flex justify-between items-center rounded-sm">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="font-bold text-[#C53030] hover:opacity-60 ml-3 text-sm"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handlePlaceOrder} className="space-y-8">

            {/* ── SECTION: Contact ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-[#1a1a1a]">Contact</h2>
                {!isLoggedIn ? (
                  <Link to="/login" className="text-[13px] text-[#1a1a1a] underline hover:no-underline">
                    Sign in
                  </Link>
                ) : (
                  <span className="text-[12px] text-[#555555]">
                    {user?.name} · <Link to="/profile" className="underline hover:no-underline">Account</Link>
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {/* Full Name */}
                <div className="relative">
                  <input
                    type="text"
                    id="contact_name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    placeholder=" "
                    className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
                  />
                  <label
                    htmlFor="contact_name"
                    className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                  >
                    Full name
                  </label>
                </div>

                {/* Email */}
                <div className="relative">
                  <input
                    type="email"
                    id="contact_email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                    placeholder=" "
                    className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
                  />
                  <label
                    htmlFor="contact_email"
                    className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                  >
                    Email address
                  </label>
                </div>

                {/* Phone */}
                <div className="relative">
                  <input
                    type="tel"
                    id="contact_phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                    placeholder=" "
                    className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
                  />
                  <label
                    htmlFor="contact_phone"
                    className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                  >
                    Phone (courier contact)
                  </label>
                </div>
              </div>
            </section>

            {/* ── SECTION: Delivery ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-[#1a1a1a]">Delivery</h2>
                {isLoggedIn && savedAddresses.length > 0 && (
                  <span className="text-[12px] text-[#888888]">
                    {savedAddresses.length} saved address{savedAddresses.length > 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              {/* Saved addresses (logged in) */}
              {isLoggedIn && savedAddresses.length > 0 && (
                <div className="space-y-2 mb-4">
                  {savedAddresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 border rounded-md p-3.5 cursor-pointer transition-all ${
                        selectedAddressId === addr.id
                          ? 'border-[#333333] ring-1 ring-[#333333] bg-[#FAFAFA]'
                          : 'border-[#D9D9D9] hover:border-[#AAAAAA] bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping_address_choice"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => handleSelectAddress(addr.id)}
                        className="mt-0.5 accent-black"
                      />
                      <div className="text-[13px] text-[#1a1a1a] leading-snug">
                        <p className="font-medium">{addr.name}</p>
                        <p className="text-[#555555]">
                          {addr.street}{addr.building ? `, Bldg ${addr.building}` : ''}{addr.floor ? `, Fl ${addr.floor}` : ''}
                        </p>
                        <p className="text-[#555555]">{addr.city}, {addr.governorate}</p>
                        {addr.isDefault && (
                          <span className="text-[10px] uppercase tracking-wider text-[#888888]">Default</span>
                        )}
                      </div>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 border rounded-md p-3.5 cursor-pointer transition-all ${
                      selectedAddressId === 'new'
                        ? 'border-[#333333] ring-1 ring-[#333333] bg-[#FAFAFA]'
                        : 'border-[#D9D9D9] hover:border-[#AAAAAA] bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping_address_choice"
                      value="new"
                      checked={selectedAddressId === 'new'}
                      onChange={() => handleSelectAddress('new')}
                      className="accent-black"
                    />
                    <span className="text-[13px] text-[#1a1a1a] font-medium">+ Use a different address</span>
                  </label>
                </div>
              )}

              {/* Inline address fields */}
              {(!isLoggedIn || selectedAddressId === 'new' || savedAddresses.length === 0) && (
                <div className="space-y-3">
                  {/* Country (static — Egypt) */}
                  <div className="relative">
                    <select
                      value="Egypt"
                      disabled
                      className="w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-[#F9F9F9] focus:outline-none appearance-none"
                    >
                      <option>Egypt</option>
                    </select>
                    <label className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none">
                      Country / Region
                    </label>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </div>

                  {/* Governorate */}
                  <div className="relative">
                    <select
                      id="gov"
                      value={gov}
                      onChange={(e) => setGov(e.target.value)}
                      required
                      className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors appearance-none"
                    >
                      {GOVERNORATES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <label
                      htmlFor="gov"
                      className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none"
                    >
                      Governorate
                    </label>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </div>

                  {/* City */}
                  <div className="relative">
                    <input
                      type="text"
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      placeholder=" "
                      className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
                    />
                    <label
                      htmlFor="city"
                      className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                    >
                      City / District
                    </label>
                  </div>

                  {/* Street */}
                  <div className="relative">
                    <input
                      type="text"
                      id="street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      required
                      placeholder=" "
                      className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
                    />
                    <label
                      htmlFor="street"
                      className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                    >
                      Address
                    </label>
                  </div>

                  {/* Building + Floor */}
                  <div className="relative">
                    <input
                      type="text"
                      id="building"
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      placeholder=" "
                      className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
                    />
                    <label
                      htmlFor="building"
                      className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                    >
                      Apartment, building, floor (optional)
                    </label>
                  </div>

                  {/* Landmark */}
                  <div className="relative">
                    <input
                      type="text"
                      id="landmark"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder=" "
                      className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-5 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
                    />
                    <label
                      htmlFor="landmark"
                      className="absolute left-3 top-1 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                    >
                      Landmark / courier instructions (optional)
                    </label>
                  </div>

                  {/* Save address (logged in) */}
                  {isLoggedIn && (
                    <label className="flex items-center gap-2.5 cursor-pointer text-[13px] text-[#444444] select-none mt-1">
                      <input
                        type="checkbox"
                        checked={saveToProfile}
                        onChange={(e) => setSaveToProfile(e.target.checked)}
                        className="w-4 h-4 accent-black rounded"
                      />
                      Save this address to my account
                    </label>
                  )}
                </div>
              )}
            </section>

            {/* ── SECTION: Shipping Method ── */}
            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1a1a] mb-4">Shipping method</h2>
              <div className="border border-[#D9D9D9] rounded-md p-4 bg-[#F9F9F9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Truck icon */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
                    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
                    <rect x="9" y="11" width="14" height="10" rx="1"/>
                    <circle cx="12" cy="21" r="1"/>
                    <circle cx="20" cy="21" r="1"/>
                  </svg>
                  <div>
                    <p className="text-[13px] font-medium text-[#1a1a1a]">Express Courier — Egypt Nationwide</p>
                    <p className="text-[12px] text-[#888888]">Delivery within 2–5 business days</p>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-[#1a1a1a]">{shippingFee.toFixed(2)} EGP</span>
              </div>
            </section>

            {/* ── SECTION: Payment ── */}
            <section>
              <h2 className="text-[15px] font-semibold text-[#1a1a1a] mb-1">Payment</h2>
              <p className="text-[12px] text-[#888888] mb-4 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                All transactions are secure and encrypted.
              </p>

              <div className="border border-[#D9D9D9] rounded-md overflow-hidden divide-y divide-[#E8E8E8]">

                {/* Option 1: Cash on Delivery */}
                <label
                  className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                    currentZone && !currentZone.cod_available ? 'opacity-60 cursor-not-allowed bg-zinc-50' : paymentMethod === 'Cash on Delivery' ? 'bg-[#F2F2F2]' : 'bg-white hover:bg-[#FAFAFA]'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    value="Cash on Delivery"
                    disabled={currentZone ? !currentZone.cod_available : false}
                    checked={paymentMethod === 'Cash on Delivery'}
                    readOnly
                    className="mt-0.5 accent-black"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium text-[#1a1a1a]">Cash on Delivery</span>
                      <span className="text-[11px] text-[#555555] bg-[#EEEEEE] px-2 py-0.5 rounded uppercase tracking-wide font-medium">COD</span>
                    </div>
                    {currentZone && !currentZone.cod_available ? (
                      <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
                        Cash on Delivery is unavailable for {effectiveGov}, so orders to this destination cannot be placed. Please choose a different delivery governorate.
                      </p>
                    ) : (
                      paymentMethod === 'Cash on Delivery' && (
                        <p className="text-[12px] text-[#666666] mt-2 leading-relaxed">
                          Pay in cash or via POS card machine directly to the courier at your door.
                        </p>
                      )
                    )}
                  </div>
                </label>

              </div>
            </section>

            {/* ── SECTION: Order Notes ── */}
            <section>
              <div className="relative">
                <textarea
                  id="order_notes"
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder=" "
                  className="peer w-full border border-[#D9D9D9] rounded-md px-3 pt-6 pb-2 text-[14px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors resize-none"
                />
                <label
                  htmlFor="order_notes"
                  className="absolute left-3 top-1.5 text-[10px] text-[#888888] uppercase tracking-wider pointer-events-none peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:capitalize peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-wider transition-all"
                >
                  Delivery notes / gate code (optional)
                </label>
              </div>
            </section>

            {/* ── SUBMIT BUTTON ── */}
            <button
              type="submit"
              disabled={isSubmitting || codUnavailable}
              className="w-full bg-[#111111] hover:bg-black text-white py-4 rounded-md text-[15px] font-semibold tracking-wide transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    {paymentMethod === 'Cash on Delivery'
                      ? 'Placing order…'
                      : 'Connecting to payment…'}
                  </span>
                </>
              ) : (
                <span>
                  {paymentMethod === 'Cash on Delivery'
                    ? `Confirm order · ${grandTotal.toFixed(2)} EGP`
                    : `Pay now · ${grandTotal.toFixed(2)} EGP`}
                </span>
              )}
            </button>

            {/* ── POLICY FOOTER LINKS ── */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2 pb-8">
              {[
                { label: 'Refund policy', path: '/policies/returns' },
                { label: 'Shipping policy', path: '/policies/shipping' },
                { label: 'Privacy policy', path: '/policies/privacy' },
                { label: 'Terms of service', path: '/policies/terms' },
                { label: 'Contact', path: '/contact' },
              ].map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-[12px] text-[#666666] underline hover:text-[#333333] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

          </form>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Order Summary (gray bg, sticky)
        ════════════════════════════════════════════════════════════════ */}
        <div className="lg:w-[44%] xl:w-[42%] bg-[#F5F5F5] border-t lg:border-t-0 lg:border-l border-[#E8E8E8] order-1 lg:order-2">
          <div className="sticky top-0 px-5 sm:px-8 lg:px-10 xl:px-14 py-8 lg:py-10 space-y-5">

            {/* Cart Items */}
            <div className="space-y-4 max-h-[40vh] lg:max-h-[50vh] overflow-y-auto pr-2 pt-2.5 pb-1">
              {cart.map((item) => (
                <div key={`${item.id}-${item.size}`} className="flex items-center gap-4">
                  {/* Thumbnail with quantity badge */}
                  <div className="relative flex-shrink-0">
                    <div className="w-[64px] h-[72px] bg-white border border-[#E0E0E0] rounded-md overflow-hidden flex items-center justify-center">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain p-1.5 mix-blend-multiply"
                      />
                    </div>
                    {/* Quantity badge — sized and positioned to fit completely without clipping */}
                    <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 bg-[#444444] text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm z-10 overflow-visible">
                      {item.quantity}
                    </span>
                  </div>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1a1a1a] truncate leading-snug">{item.name}</p>
                    <p className="text-[12px] text-[#888888] mt-0.5 whitespace-nowrap">Size: {item.size}</p>
                  </div>

                  {/* Price */}
                  <div className="text-[14px] font-medium text-[#1a1a1a] flex-shrink-0 whitespace-nowrap overflow-visible">
                    {(item.price * item.quantity).toFixed(2)} EGP
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[#E0E0E0]" />

            {/* Discount Code */}
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Discount code"
                className="flex-1 border border-[#D9D9D9] rounded-md px-3 py-2.5 text-[13px] text-[#1a1a1a] bg-white focus:outline-none focus:border-[#333333] focus:ring-1 focus:ring-[#333333] transition-colors"
              />
              <button
                type="submit"
                className="border border-[#D9D9D9] hover:border-[#888888] bg-white px-4 py-2.5 text-[13px] text-[#1a1a1a] font-medium rounded-md transition-colors"
              >
                Apply
              </button>
            </form>
            {promoMessage && (
              <p className={`text-[12px] -mt-2 ${appliedDiscount > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {promoMessage}
              </p>
            )}

            <div className="border-t border-[#E0E0E0]" />

            {/* Totals */}
            <div className="space-y-2.5 text-[14px]">
              <div className="flex justify-between text-[#555555]">
                <span>Subtotal · {totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
                <span className="text-[#1a1a1a] font-medium">{subtotal.toFixed(2)} EGP</span>
              </div>

              {appliedDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>−{appliedDiscount.toFixed(2)} EGP</span>
                </div>
              )}

              <div className="flex justify-between text-[#555555]">
                <span>Shipping ({effectiveGov})</span>
                <span className="text-[#1a1a1a] font-medium">{shippingFee.toFixed(2)} EGP</span>
              </div>

              <div className="border-t border-[#E0E0E0] pt-3 flex justify-between items-baseline">
                <span className="text-[16px] font-semibold text-[#1a1a1a]">Total</span>
                <span className="text-[18px] font-bold text-[#1a1a1a]">
                  {grandTotal.toFixed(2)} <span className="text-[12px] font-normal text-[#888888] ml-1">EGP</span>
                </span>
              </div>
            </div>

            {/* Trust badges */}
            <div className="border-t border-[#E0E0E0] pt-4 space-y-2">
              {[
                'Signature luxury archival box & garment bag',
                'Discreet express courier with live tracking',
                '14-day returns & complimentary size exchange',
              ].map((badge) => (
                <div key={badge} className="flex items-center gap-2 text-[11px] text-[#777777]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {badge}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
