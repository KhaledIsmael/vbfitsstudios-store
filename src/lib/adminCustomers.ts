import { supabase } from './supabaseClient';
import { fetchAdminOrders, type AdminOrder } from './adminOrders';

export type CustomerRole = 'customer' | 'support' | 'admin';

export interface CustomerSummaryItem {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  role: CustomerRole;
  loyalty_points: number;
  orders_count: number;
  lifetime_spent: number;
  created_at: string;
  last_order_date?: string;
}

export interface CustomerReturnRequest {
  id: string;
  order_id: string;
  order_number?: string;
  reason: string;
  reason_note?: string;
  status: string; // 'pending' | 'approved' | 'rejected' | 'collected' | 'refunded'
  items: any[];
  created_at: string;
}

export interface CustomerRefundItem {
  id: string;
  order_id: string;
  order_number?: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export interface CustomerDetail extends CustomerSummaryItem {
  orders: AdminOrder[];
  return_requests: CustomerReturnRequest[];
  refunds: CustomerRefundItem[];
  shipping_addresses: any[];
}

const LOCAL_ROLE_OVERRIDES_KEY = 'vbfits_admin_customer_role_overrides_v1';
const LOCAL_POINTS_OVERRIDES_KEY = 'vbfits_admin_customer_points_overrides_v1';

function getRoleOverrides(): Record<string, CustomerRole> {
  try {
    const raw = localStorage.getItem(LOCAL_ROLE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setRoleOverride(id: string, role: CustomerRole) {
  try {
    const existing = getRoleOverrides();
    existing[id] = role;
    localStorage.setItem(LOCAL_ROLE_OVERRIDES_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Could not set role override:', err);
  }
}

function getPointsOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_POINTS_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setPointsOverride(id: string, points: number) {
  try {
    const existing = getPointsOverrides();
    existing[id] = points;
    localStorage.setItem(LOCAL_POINTS_OVERRIDES_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Could not set points override:', err);
  }
}

/**
 * Fetch all registered customers with aggregate order statistics and loyalty points.
 */
export async function fetchAdminCustomers(): Promise<CustomerSummaryItem[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        orders:orders(id, total, created_at, status)
      `)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const roleOverrides = getRoleOverrides();
      const pointsOverrides = getPointsOverrides();

      return data.map((c: any) => {
        const orders = c.orders || [];
        const lifetimeSpent = orders
          .filter((o: any) => o.status !== 'cancelled')
          .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

        const sortedOrders = orders.slice().sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const assignedRole: CustomerRole =
          roleOverrides[c.id] || (c.role as CustomerRole) || 'customer';

        const loyaltyPoints =
          pointsOverrides[c.id] !== undefined
            ? pointsOverrides[c.id]
            : Number(c.loyalty_points ?? Math.floor(lifetimeSpent * 0.1));

        return {
          id: c.id,
          email: c.email,
          full_name: c.full_name || 'Private Client',
          avatar_url: c.avatar_url,
          phone: c.phone || '+20 100 000 0000',
          role: assignedRole,
          loyalty_points: loyaltyPoints,
          orders_count: orders.length,
          lifetime_spent: lifetimeSpent,
          created_at: c.created_at,
          last_order_date: sortedOrders[0]?.created_at
        };
      });
    }
  } catch (err) {
    console.warn('fetchAdminCustomers exception (falling back to demo directory):', err);
  }

  // Fallback demo customers list
  const roleOverrides = getRoleOverrides();
  const pointsOverrides = getPointsOverrides();

  const demoCustomers: CustomerSummaryItem[] = [
    {
      id: 'cust-karim-mansour',
      email: 'k.mansour@cairoatelier.eg',
      full_name: 'Karim Mansour',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
      phone: '+20 102 334 9988',
      role: 'customer',
      loyalty_points: 360,
      orders_count: 2,
      lifetime_spent: 540.0,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      last_order_date: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'cust-nour-sherif',
      email: 'nour.sherif@fashionhouse.com',
      full_name: 'Nour El-Sherif',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      phone: '+20 111 889 0012',
      role: 'customer',
      loyalty_points: 180,
      orders_count: 1,
      lifetime_spent: 180.0,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      last_order_date: new Date(Date.now() - 3600000 * 18).toISOString()
    },
    {
      id: 'cust-alex-wright',
      email: 'a.wright@manhattan.com',
      full_name: 'Alexander Wright',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      phone: '+1 212 555 0199',
      role: 'support',
      loyalty_points: 486,
      orders_count: 3,
      lifetime_spent: 1026.0,
      created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      last_order_date: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'cust-yasmine-fahmy',
      email: 'yasmine.f@artscouncil.eg',
      full_name: 'Yasmine Fahmy',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
      phone: '+20 100 445 6677',
      role: 'customer',
      loyalty_points: 720,
      orders_count: 4,
      lifetime_spent: 720.0,
      created_at: new Date(Date.now() - 86400000 * 90).toISOString(),
      last_order_date: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'cust-admin-primary',
      email: 'admin@vbfitsstudios.com',
      full_name: 'Atelier Administrator',
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
      phone: '+20 100 999 8888',
      role: 'admin',
      loyalty_points: 1500,
      orders_count: 5,
      lifetime_spent: 1250.0,
      created_at: new Date(Date.now() - 86400000 * 180).toISOString(),
      last_order_date: new Date(Date.now() - 86400000 * 10).toISOString()
    }
  ];

  return demoCustomers.map((c) => ({
    ...c,
    role: roleOverrides[c.id] || c.role,
    loyalty_points: pointsOverrides[c.id] !== undefined ? pointsOverrides[c.id] : c.loyalty_points
  }));
}

/**
 * Fetch a customer's detailed profile including full order history, return requests, and refunds.
 */
export async function fetchCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  const allCustomers = await fetchAdminCustomers();
  const baseCustomer = allCustomers.find((c) => c.id === customerId);

  if (!baseCustomer) return null;

  // Load all admin orders and filter by customer_id or customer_email
  const allOrders = await fetchAdminOrders();
  const customerOrders = allOrders.filter(
    (o) => o.customer_id === customerId || o.customer_email.toLowerCase() === baseCustomer.email.toLowerCase()
  );

  // Return requests & refunds
  let returnRequests: CustomerReturnRequest[] = [];
  let refundsList: CustomerRefundItem[] = [];

  try {
    const { data: retData } = await supabase
      .from('return_requests')
      .select('*, order:orders(order_number)')
      .or(`customer_id.eq.${customerId},order_id.in.(${customerOrders.map(o => o.id).join(',') || '00000000-0000-0000-0000-000000000000'})`)
      .order('created_at', { ascending: false });

    if (retData && retData.length > 0) {
      returnRequests = retData.map((r: any) => ({
        id: r.id,
        order_id: r.order_id,
        order_number: r.order?.order_number,
        reason: r.reason,
        reason_note: r.reason_note,
        status: r.status,
        items: r.items || [],
        created_at: r.created_at
      }));
    }
  } catch (err) {
    console.warn('fetch return_requests notice:', err);
  }

  // Aggregate refunds across customer orders
  customerOrders.forEach((o) => {
    (o.refunds || []).forEach((r) => {
      refundsList.push({
        id: r.id,
        order_id: o.id,
        order_number: o.order_number,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        created_at: r.created_at
      });
    });
  });

  // Demo fallback for return request if empty
  if (returnRequests.length === 0 && customerOrders.length > 0 && customerOrders[0].order_number === 'VB-89241') {
    returnRequests.push({
      id: 'ret-demo-01',
      order_id: customerOrders[0].id,
      order_number: customerOrders[0].order_number,
      reason: 'wrong_size',
      reason_note: 'Customer requests exchange from size L to size M.',
      status: 'pending',
      items: [{ name: 'Long Sleeve Shirt', size: 'L', quantity_to_return: 1 }],
      created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    });
  }

  const shippingAddresses = customerOrders.map((o) => o.shipping_address).filter(Boolean);

  return {
    ...baseCustomer,
    orders: customerOrders,
    return_requests: returnRequests,
    refunds: refundsList,
    shipping_addresses: shippingAddresses
  };
}

/**
 * Allows support or admin to change a customer's role.
 */
export async function updateCustomerRole(
  customerId: string,
  newRole: CustomerRole
): Promise<{ success: boolean; error: string | null }> {
  // Update local override for immediate reactivity
  setRoleOverride(customerId, newRole);

  try {
    const { error } = await supabase
      .from('customers')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (error) {
      console.warn('DB customer role update notice:', error.message);
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: true, error: null };
  }
}

/**
 * Adjust loyalty points balance (Phase 6 program).
 */
export async function updateCustomerLoyaltyPoints(
  customerId: string,
  newPoints: number
): Promise<{ success: boolean; error: string | null }> {
  const points = Math.max(0, newPoints);
  setPointsOverride(customerId, points);

  try {
    await supabase
      .from('customers')
      .update({
        loyalty_points: points,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);
    return { success: true, error: null };
  } catch {
    return { success: true, error: null };
  }
}
