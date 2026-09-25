import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserOrders } from '../lib/orders';
import type { Order } from '../lib/orders';
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type Address
} from '../lib/addresses';
import {
  createReturnRequest,
  hasExistingReturnRequest,
  isWithinReturnWindow,
  RETURN_REASONS,
  RETURN_WINDOW_DAYS,
  type ReturnReason
} from '../lib/returns';

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

export const ProfilePage: React.FC = () => {
  const { user, role, isLoggedIn, loading, logout, wishlistProducts, wishlistLoading, toggleSaveItem, updatePhone } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'orders' | 'saved' | 'address'>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Return request state
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState<ReturnReason>('wrong_size');
  const [returnNote, setReturnNote] = useState('');
  const [returnSelectedItems, setReturnSelectedItems] = useState<Set<string>>(new Set());
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState(false);
  // Track which orders already have a pending return (orderId → boolean)
  const [existingReturns, setExistingReturns] = useState<Record<string, boolean>>({});

  // Addresses State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);

  // User Account Phone Editing State
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleStartEditPhone = () => {
    setPhoneInput(user?.phone || '');
    setPhoneError(null);
    setIsEditingPhone(true);
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneSaving(true);
    setPhoneError(null);
    const res = await updatePhone(phoneInput);
    setPhoneSaving(false);
    if (res.error) {
      setPhoneError(res.error);
    } else {
      setIsEditingPhone(false);
    }
  };

  // Address Modal & Form State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGovernorate, setFormGovernorate] = useState('Cairo');
  const [formCity, setFormCity] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formBuilding, setFormBuilding] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formLandmark, setFormLandmark] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch real orders whenever the authenticated user changes
  useEffect(() => {
    if (!user?.id) return;

    setOrdersLoading(true);
    setOrdersError(null);

    getUserOrders(user.id, user.email, user.phone)
      .then((data) => {
        setOrders(data);
        // Check each delivered order for an existing return request
        data
          .filter((o) => o.status.toLowerCase() === 'delivered')
          .forEach(async (o) => {
            const exists = await hasExistingReturnRequest(o.rawId);
            if (exists) {
              setExistingReturns((prev) => ({ ...prev, [o.rawId]: true }));
            }
          });
      })
      .catch(() => setOrdersError('Unable to load orders. Please try again.'))
      .finally(() => setOrdersLoading(false));
  }, [user?.id, user?.email, user?.phone]);

  // Fetch addresses
  const loadAddresses = async () => {
    if (!user?.id) return;
    setAddressesLoading(true);
    setAddressesError(null);
    try {
      const data = await getUserAddresses(user.id);
      setAddresses(data);
    } catch {
      setAddressesError('Unable to load shipping addresses.');
    } finally {
      setAddressesLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadAddresses();
    }
  }, [user?.id]);

  const openAddModal = () => {
    setEditingAddress(null);
    setFormName(user?.name || '');
    setFormPhone(user?.phone || '');
    setFormGovernorate('Cairo');
    setFormCity('');
    setFormStreet('');
    setFormBuilding('');
    setFormFloor('');
    setFormLandmark('');
    setFormIsDefault(addresses.length === 0);
    setFormError(null);
    setIsAddressModalOpen(true);
  };

  const openEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setFormName(addr.name);
    setFormPhone(addr.phone);
    setFormGovernorate(addr.governorate || 'Cairo');
    setFormCity(addr.city);
    setFormStreet(addr.street);
    setFormBuilding(addr.building || '');
    setFormFloor(addr.floor || '');
    setFormLandmark(addr.landmark || '');
    setFormIsDefault(addr.isDefault);
    setFormError(null);
    setIsAddressModalOpen(true);
  };

  const closeAddressModal = () => {
    if (formSubmitting) return;
    setIsAddressModalOpen(false);
    setEditingAddress(null);
    setFormError(null);
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!formName.trim() || !formPhone.trim() || !formCity.trim() || !formStreet.trim()) {
      setFormError('Please fill in Name, Phone, City, and Street.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const inputData = {
      name: formName.trim(),
      phone: formPhone.trim(),
      governorate: formGovernorate.trim() || 'Cairo',
      city: formCity.trim(),
      street: formStreet.trim(),
      building: formBuilding.trim() || undefined,
      floor: formFloor.trim() || undefined,
      landmark: formLandmark.trim() || undefined,
      isDefault: formIsDefault
    };

    if (editingAddress) {
      const { error } = await updateAddress(user.id, editingAddress.id, inputData);
      if (error) {
        setFormError(error);
        setFormSubmitting(false);
        return;
      }
    } else {
      const { error } = await createAddress(user.id, inputData);
      if (error) {
        setFormError(error);
        setFormSubmitting(false);
        return;
      }
    }

    setFormSubmitting(false);
    setIsAddressModalOpen(false);
    await loadAddresses();
  };

  const handleSetDefault = async (addressId: string) => {
    if (!user?.id) return;
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === addressId
      }))
    );
    const { error } = await setDefaultAddress(user.id, addressId);
    if (error) {
      await loadAddresses();
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user?.id) return;
    setAddresses((prev) => prev.filter((a) => a.id !== addressId));
    setDeleteConfirmId(null);
    const { error } = await deleteAddress(user.id, addressId);
    if (error) {
      await loadAddresses();
    }
  };

  if (loading) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-luxury text-[#777777]">
          Verifying Client Credentials...
        </p>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-xl uppercase tracking-wider font-light mb-4">Please sign in to access your profile</h2>
        <Link
          to="/login"
          className="bg-black text-white px-8 py-3 text-xs uppercase tracking-luxury hover:opacity-80 transition-opacity"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const savedProducts = wishlistProducts;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Status dot colour helper
  const statusColour = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'delivered') return 'bg-emerald-600';
    if (s === 'shipped' || s === 'out_for_delivery') return 'bg-blue-500';
    if (s === 'processing' || s === 'confirmed' || s === 'packed') return 'bg-amber-500';
    return 'bg-gray-400'; // Placed / pending
  };

  // Handle return request form submission
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnOrder || !user?.id) return;
    if (returnSelectedItems.size === 0) {
      setReturnError('Please select at least one item to return.');
      return;
    }
    setReturnSubmitting(true);
    setReturnError(null);

    const itemsPayload = returnOrder.items
      .filter((it) => returnSelectedItems.has(it.id))
      .map((it) => ({
        order_item_id: it.id,
        name: it.name,
        size: it.size,
        quantity_to_return: it.quantity
      }));

    const { error } = await createReturnRequest({
      orderId: returnOrder.rawId,
      customerId: user.id,
      reason: returnReason,
      reasonNote: returnNote.trim() || undefined,
      items: itemsPayload
    });

    setReturnSubmitting(false);
    if (error) {
      setReturnError(error);
    } else {
      setReturnSuccess(true);
      // Mark as submitted so the button disappears
      setExistingReturns((prev) => ({ ...prev, [returnOrder.rawId]: true }));
    }
  };

  const closeReturnModal = () => {
    setReturnOrder(null);
    setReturnSuccess(false);
    setReturnError(null);
  };

  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-16">

        {/* Profile Header */}
        <div className="border-b border-[#EAEAEA] pb-10 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-[10px] text-[#888888] tracking-luxury uppercase">
              Private Client Profile
            </span>
            <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-black">
              {user.name}
            </h1>
            <p className="text-xs text-[#666666]">{user.email}</p>

            {/* Dynamic Phone Binding & Inline Editor */}
            <div className="pt-0.5">
              {isEditingPhone ? (
                <form onSubmit={handleSavePhone} className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Enter mobile phone"
                    className="border border-black px-2.5 py-1 text-xs text-black font-mono w-48 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={phoneSaving}
                    className="bg-black text-white text-[10px] uppercase tracking-wider px-3 py-1 font-medium hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {phoneSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(false)}
                    className="text-[10px] uppercase text-[#777777] hover:text-black underline px-1"
                  >
                    Cancel
                  </button>
                  {phoneError && <span className="text-[11px] text-red-600 block w-full mt-1">{phoneError}</span>}
                </form>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[#555555]">
                  <span>Phone:</span>
                  {user.phone ? (
                    <>
                      <span className="font-mono text-black font-medium">{user.phone}</span>
                      <button
                        type="button"
                        onClick={handleStartEditPhone}
                        className="text-[10px] text-[#888888] hover:text-black underline font-mono ml-1"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEditPhone}
                      className="text-[11px] text-black underline font-medium hover:opacity-70"
                    >
                      + Add Phone Number
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#999999] pt-1">Client Member since {user.memberSince}</p>
          </div>

          <button
            onClick={handleLogout}
            className="self-start md:self-center border border-[#CCCCCC] hover:border-black hover:bg-black hover:text-white px-6 py-2.5 text-xs uppercase tracking-luxury transition-all rounded-none"
          >
            Sign Out
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#EAEAEA] gap-8 pt-8 text-xs">
          {[
            { id: 'orders', label: `Order History (${ordersLoading ? '…' : orders.length})` },
            { id: 'saved', label: `Saved Silhouettes (${wishlistLoading ? '…' : savedProducts.length})` },
            { id: 'address', label: `Shipping Address (${addressesLoading ? '…' : addresses.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 uppercase tracking-luxury transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-black text-black font-medium'
                  : 'border-transparent text-[#888888] hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Orders */}
        {activeTab === 'orders' && (
          <div className="py-10 space-y-8 animate-fade-in">
            {/* Loading state */}
            {ordersLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#888888] uppercase tracking-wider">Loading Order History…</p>
              </div>
            )}

            {/* Error state */}
            {!ordersLoading && ordersError && (
              <p className="text-xs text-red-500 py-10 text-center uppercase tracking-wider">
                {ordersError}
              </p>
            )}

            {/* Empty state */}
            {!ordersLoading && !ordersError && orders.length === 0 && (
              <div className="py-16 text-center space-y-3">
                <p className="text-xs text-[#777777] uppercase tracking-wider">
                  No orders recorded yet.
                </p>
                <Link
                  to="/shop"
                  className="inline-block text-xs uppercase tracking-luxury text-black underline underline-offset-4"
                >
                  Explore Catalog
                </Link>
              </div>
            )}

            {/* Order list */}
            {!ordersLoading && !ordersError && orders.length > 0 && (
              <div className="space-y-6">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-[#EAEAEA] p-6 sm:p-8 space-y-6 bg-white"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#EAEAEA] gap-3 text-xs">
                      <div>
                        <span className="text-[#888888] uppercase tracking-wider">Order No.</span>
                        <p className="font-semibold text-black mt-0.5">{order.id}</p>
                      </div>
                      <div>
                        <span className="text-[#888888] uppercase tracking-wider">Order Date</span>
                        <p className="text-black mt-0.5">{order.date}</p>
                      </div>
                      <div>
                        <span className="text-[#888888] uppercase tracking-wider">Fulfillment Status</span>
                        <p className="text-black font-medium mt-0.5 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${statusColour(order.status)}`} />
                          {order.status}
                        </p>
                      </div>
                      <div>
                        <span className="text-[#888888] uppercase tracking-wider">Total</span>
                        <p className="font-semibold text-black mt-0.5">{order.total.toFixed(2)} {order.currency || 'EGP'}</p>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="divide-y divide-[#EAEAEA]">
                      {order.items.map((item) => (
                        <div key={item.id} className="py-4 flex items-center gap-4 sm:gap-6">
                          <div className="w-16 h-20 bg-[#FAFAFA] flex-shrink-0 overflow-hidden">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-contain p-1 mix-blend-multiply"
                              loading="lazy"
                              decoding="async"
                              width={64}
                              height={80}
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xs font-medium text-black uppercase">{item.name}</h4>
                            <p className="text-[11px] text-[#777777] mt-0.5">
                              Size: {item.size} • Qty: {item.quantity}
                            </p>
                          </div>
                          <div className="text-xs font-medium text-black">
                            {(item.price * item.quantity).toFixed(2)} {order.currency || 'EGP'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order card footer — Track + Return buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#EAEAEA] text-[11px]">
                      <span className="text-[#888888]">
                        {order.trackingNumber ? `Tracking: ${order.trackingNumber}` : 'Awaiting dispatch'}
                      </span>
                      <div className="flex items-center gap-3">
                        {/* Track Package — real link to /orders/:rawId/track */}
                        <Link
                          to={`/orders/${order.rawId}/track`}
                          className="text-black uppercase tracking-wider underline underline-offset-2 hover:opacity-60 transition-opacity"
                        >
                          Track Package
                        </Link>

                        {/* Request Return — only visible within 14-day window for delivered orders */}
                        {order.status.toLowerCase() === 'delivered' &&
                          isWithinReturnWindow(order.deliveredAt, order.date) &&
                          !existingReturns[order.rawId] && (
                          <button
                            onClick={() => {
                              setReturnOrder(order);
                              setReturnReason('wrong_size');
                              setReturnNote('');
                              setReturnSelectedItems(new Set(order.items.map((i) => i.id)));
                              setReturnError(null);
                              setReturnSuccess(false);
                            }}
                            className="border border-[#CCCCCC] hover:border-black text-black uppercase tracking-wider px-3 py-1.5 transition-all text-[10px] font-medium"
                          >
                            Request Return
                          </button>
                        )}

                        {/* Already submitted badge */}
                        {order.status.toLowerCase() === 'delivered' &&
                          existingReturns[order.rawId] && (
                          <span className="text-[10px] uppercase tracking-wider text-[#888888] border border-[#EAEAEA] px-2.5 py-1">
                            Return Requested
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Saved Items */}
        {activeTab === 'saved' && (
          <div className="py-10 animate-fade-in">
            {wishlistLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#888888] uppercase tracking-wider">Loading Saved Silhouettes…</p>
              </div>
            )}
            {!wishlistLoading && savedProducts.length === 0 && (
              <div className="py-16 text-center space-y-3">
                <p className="text-xs text-[#777777] uppercase tracking-wider">No saved silhouettes in your wishlist.</p>
                <Link
                  to="/shop"
                  className="inline-block text-xs uppercase tracking-luxury text-black underline underline-offset-4"
                >
                  Explore Catalog
                </Link>
              </div>
            )}
            {!wishlistLoading && savedProducts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {savedProducts.map((item) => (
                  <Link
                    key={item.productId}
                    to={`/product/${item.productId}`}
                    className="group block border border-[#EAEAEA] hover:border-black transition-colors bg-white"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[4/5] bg-[#FAFAFA] overflow-hidden relative group/img">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                        width={200}
                        height={250}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSaveItem(item.productId);
                        }}
                        title="Remove from saved silhouettes"
                        aria-label="Remove from saved silhouettes"
                        className="absolute top-2 right-2 bg-white/90 hover:bg-black hover:text-white text-black p-1.5 rounded-full transition-colors shadow-sm"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      </button>
                    </div>
                    {/* Info */}
                    <div className="p-4 border-t border-[#EAEAEA] space-y-1">
                      <h3 className="text-xs font-medium text-black uppercase tracking-wider truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-[#666666]">
                        {item.price.toFixed(2)} {item.currency || 'EGP'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Shipping Address (Full CRUD) */}
        {activeTab === 'address' && (
          <div className="py-10 animate-fade-in space-y-8">
            {/* Header with Add Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAEAEA]">
              <div>
                <h2 className="text-sm uppercase tracking-widest font-semibold text-black">
                  Shipping Addresses
                </h2>
                <p className="text-xs text-[#777777] mt-0.5">
                  Manage delivery coordinates for private courier transit.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="self-start sm:self-center bg-[#111111] hover:bg-black text-white px-5 py-2.5 text-xs uppercase tracking-luxury transition-all flex items-center gap-2"
              >
                <span>+</span>
                <span>Add Address</span>
              </button>
            </div>

            {/* Loading state */}
            {addressesLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#888888] uppercase tracking-wider">
                  Loading Delivery Coordinates…
                </p>
              </div>
            )}

            {/* Error state */}
            {!addressesLoading && addressesError && (
              <div className="p-4 bg-[#FFF5F5] border border-[#FEB2B2] text-[#C53030] text-xs flex justify-between items-center">
                <span>{addressesError}</span>
                <button
                  type="button"
                  onClick={loadAddresses}
                  className="uppercase tracking-wider underline text-black hover:opacity-70"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!addressesLoading && !addressesError && addresses.length === 0 && (
              <div className="py-16 text-center space-y-4 border border-dashed border-[#EAEAEA] p-8">
                <p className="text-xs text-[#777777] uppercase tracking-wider">
                  No delivery addresses on record.
                </p>
                <p className="text-xs text-[#999999] max-w-sm mx-auto">
                  Add your shipping destination to ensure uninterrupted checkout and discreet courier delivery.
                </p>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-block text-xs uppercase tracking-luxury text-black underline underline-offset-4 hover:opacity-60"
                >
                  + Add Your First Address
                </button>
              </div>
            )}

            {/* Address Cards Grid */}
            {!addressesLoading && addresses.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`border p-6 sm:p-7 space-y-4 bg-white transition-all ${
                      addr.isDefault
                        ? 'border-black ring-1 ring-black shadow-sm'
                        : 'border-[#EAEAEA] hover:border-[#CCCCCC]'
                    }`}
                  >
                    {/* Header: Name + Badge */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-black">
                          {addr.name}
                        </h3>
                        {addr.phone && (
                          <p className="text-[11px] text-[#666666] tracking-wider mt-0.5">
                            {addr.phone}
                          </p>
                        )}
                      </div>
                      {addr.isDefault && (
                        <span className="text-[9px] uppercase tracking-widest text-black bg-[#EEEEEE] px-2.5 py-1 font-semibold">
                          Default
                        </span>
                      )}
                    </div>

                    {/* Address Body */}
                    <div className="text-xs text-[#444444] space-y-1 pt-1 border-t border-[#F3F3F3]">
                      <p className="font-medium text-black">
                        {addr.street}
                        {addr.building ? `, Bldg ${addr.building}` : ''}
                        {addr.floor ? `, Floor ${addr.floor}` : ''}
                      </p>
                      {addr.landmark && (
                        <p className="text-[11px] text-[#777777] italic">
                          Landmark: {addr.landmark}
                        </p>
                      )}
                      <p className="text-[11px] text-[#666666] uppercase tracking-wider">
                        {addr.city}, {addr.governorate}
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-[#F3F3F3] flex justify-between items-center text-[11px]">
                      <div>
                        {!addr.isDefault ? (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-black uppercase tracking-luxury underline underline-offset-4 hover:opacity-60"
                          >
                            Set Default
                          </button>
                        ) : (
                          <span className="text-[10px] uppercase tracking-widest text-[#888888]">
                            Primary Destination
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditModal(addr)}
                          className="text-black uppercase tracking-luxury underline underline-offset-4 hover:opacity-60"
                        >
                          Edit
                        </button>

                        {deleteConfirmId === addr.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#C53030] uppercase">Sure?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="text-[10px] uppercase font-semibold text-[#C53030] underline"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[10px] uppercase text-[#888888] underline"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(addr.id)}
                            className="text-[#C53030] uppercase tracking-luxury underline underline-offset-4 hover:opacity-60"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Address Modal (Add / Edit) */}
        {isAddressModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div
              className="bg-white border border-[#EAEAEA] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative"
              role="dialog"
              aria-modal="true"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={closeAddressModal}
                disabled={formSubmitting}
                className="absolute top-5 right-5 text-lg text-[#888888] hover:text-black transition-colors"
                aria-label="Close address form"
              >
                ✕
              </button>

              {/* Modal Header */}
              <div className="mb-6 space-y-1">
                <span className="text-[10px] uppercase tracking-luxury text-[#888888]">
                  Delivery Registry
                </span>
                <h2 className="text-base sm:text-lg font-light uppercase tracking-wider text-black">
                  {editingAddress ? 'Edit Shipping Address' : 'New Shipping Address'}
                </h2>
                <p className="text-xs text-[#777777]">
                  Enter precise coordinates for courier transit.
                </p>
              </div>

              {/* Error Banner */}
              {formError && (
                <div className="mb-5 p-3.5 bg-[#FFF5F5] border border-[#FEB2B2] text-[#C53030] text-xs">
                  {formError}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAddressSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="e.g. Alexander Vance"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    required
                    placeholder="e.g. +20 100 123 4567"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                  />
                </div>

                {/* Governorate & City Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                      Governorate *
                    </label>
                    <select
                      value={formGovernorate}
                      onChange={(e) => setFormGovernorate(e.target.value)}
                      required
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                    >
                      {GOVERNORATES.map((gov) => (
                        <option key={gov} value={gov}>
                          {gov}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                      City / District *
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      required
                      placeholder="e.g. New Cairo"
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                    />
                  </div>
                </div>

                {/* Street Address */}
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                    Street Name / Address *
                  </label>
                  <input
                    type="text"
                    value={formStreet}
                    onChange={(e) => setFormStreet(e.target.value)}
                    required
                    placeholder="e.g. 15 South 90th Street"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                  />
                </div>

                {/* Building & Floor Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                      Building No. / Villa
                    </label>
                    <input
                      type="text"
                      value={formBuilding}
                      onChange={(e) => setFormBuilding(e.target.value)}
                      placeholder="e.g. Building 12"
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                      Floor / Apartment
                    </label>
                    <input
                      type="text"
                      value={formFloor}
                      onChange={(e) => setFormFloor(e.target.value)}
                      placeholder="e.g. 4th Floor, Apt 8"
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                    />
                  </div>
                </div>

                {/* Landmark */}
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[#555555] mb-1.5 font-medium">
                    Landmark / Instructions
                  </label>
                  <input
                    type="text"
                    value={formLandmark}
                    onChange={(e) => setFormLandmark(e.target.value)}
                    placeholder="e.g. Beside Dusit Thani, Behind Mall"
                    className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                  />
                </div>

                {/* Is Default Checkbox */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsDefault}
                      onChange={(e) => setFormIsDefault(e.target.checked)}
                      className="w-4 h-4 accent-black rounded-none cursor-pointer"
                    />
                    <span className="text-xs uppercase tracking-wider text-black">
                      Set as primary default delivery address
                    </span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex gap-3">
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="flex-1 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-3.5 px-6 font-medium transition-all duration-300 disabled:opacity-60"
                  >
                    {formSubmitting
                      ? 'Saving Coordinates...'
                      : editingAddress
                      ? 'Update Address'
                      : 'Save Address'}
                  </button>
                  <button
                    type="button"
                    onClick={closeAddressModal}
                    disabled={formSubmitting}
                    className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-3.5 px-6 font-medium transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* ──────────────────────────────────────────────────────── */}
        {/* Return Request Modal                                     */}
        {/* ──────────────────────────────────────────────────────── */}
        {returnOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={(e) => { if (e.target === e.currentTarget) closeReturnModal(); }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal panel */}
            <div className="relative z-10 bg-white border border-[#EAEAEA] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#EAEAEA]">
                <div>
                  <span className="text-[9px] uppercase tracking-luxury text-[#888888] block mb-0.5">
                    Order {returnOrder.id}
                  </span>
                  <h2 className="text-sm font-light uppercase tracking-wider text-black">
                    Request a Return
                  </h2>
                </div>
                <button
                  onClick={closeReturnModal}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F5] transition-colors"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Success state */}
              {returnSuccess ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-12 h-12 border border-black rounded-full flex items-center justify-center mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <p className="text-[10px] uppercase tracking-luxury text-[#888888]">Return Submitted</p>
                  <h3 className="text-lg font-light uppercase tracking-wider text-black">
                    Request Received
                  </h3>
                  <p className="text-xs text-[#666666] max-w-xs mx-auto leading-relaxed">
                    Our team will review your return request within 1–2 business days and contact you with next steps.
                  </p>
                  <p className="text-[10px] text-[#888888] uppercase tracking-wider">
                    Return window: {RETURN_WINDOW_DAYS} days from delivery
                  </p>
                  <button
                    onClick={closeReturnModal}
                    className="mt-2 bg-[#111111] text-white text-xs uppercase tracking-luxury py-3.5 px-8 font-medium hover:opacity-80 transition-opacity"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReturnSubmit} className="p-6 space-y-6">

                  {/* Policy note */}
                  <div className="bg-[#FAFAFA] border border-[#EAEAEA] p-4 text-[10px] text-[#777777] uppercase tracking-wider">
                    Returns accepted within {RETURN_WINDOW_DAYS} days of delivery · Items must be unworn with tags attached
                  </div>

                  {/* Item selection */}
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                      Select Items to Return
                    </label>
                    <div className="divide-y divide-[#EAEAEA] border border-[#EAEAEA]">
                      {returnOrder.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-4 p-3 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={returnSelectedItems.has(item.id)}
                            onChange={(e) => {
                              const next = new Set(returnSelectedItems);
                              if (e.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              setReturnSelectedItems(next);
                            }}
                            className="w-4 h-4 border-[#CCCCCC] rounded-none accent-black"
                          />
                          <div className="w-10 h-12 bg-[#F5F5F5] flex-shrink-0 overflow-hidden">
                            <img src={item.image} alt={item.name}
                              className="w-full h-full object-contain mix-blend-multiply"
                              loading="lazy"
                              decoding="async"
                              width={40}
                              height={48}
                              onError={(e) => { (e.target as HTMLImageElement).src = '/assets/products/black-shirt.jpeg'; }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-black uppercase tracking-wider truncate">{item.name}</p>
                            <p className="text-[10px] text-[#777777]">Size: {item.size} · Qty: {item.quantity}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Reason selector */}
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                      Return Reason
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none appearance-none"
                    >
                      {RETURN_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Additional note */}
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                      Additional Notes <span className="text-[#AAAAAA] normal-case tracking-normal">(optional)</span>
                    </label>
                    <textarea
                      value={returnNote}
                      onChange={(e) => setReturnNote(e.target.value)}
                      rows={3}
                      placeholder="Describe the issue in more detail…"
                      className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none resize-none"
                    />
                  </div>

                  {/* Error */}
                  {returnError && (
                    <p className="text-xs text-red-500 uppercase tracking-wider">{returnError}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={returnSubmitting || returnSelectedItems.size === 0}
                      className="flex-1 bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 font-medium transition-all disabled:opacity-40"
                    >
                      {returnSubmitting ? 'Submitting…' : 'Submit Return Request'}
                    </button>
                    <button
                      type="button"
                      onClick={closeReturnModal}
                      disabled={returnSubmitting}
                      className="border border-[#EAEAEA] hover:border-black text-black text-xs uppercase tracking-luxury py-4 px-6 font-medium transition-all"
                    >
                      Cancel
                    </button>
                  </div>

                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
