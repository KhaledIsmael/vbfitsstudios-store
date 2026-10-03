-- ==============================================================================
-- VB FITS STUDIOS — DATA INTEGRITY AUDIT REPORT
-- File: supabase/audit_data_integrity_report.sql
-- Purpose: READ-ONLY. Run each section independently in Supabase SQL Editor.
--          Review results BEFORE applying any fixes.
--          No data is modified by this file.
-- ==============================================================================

-- ── SECTION 1 ────────────────────────────────────────────────────────────────
-- AUTH ↔ CUSTOMERS 1:1 Integrity
-- Surfaces:
--   A) auth.users rows with NO corresponding customers row
--   B) customers rows with NO corresponding auth.users row (orphaned profiles)
--   C) email mismatch between auth.users and customers

-- 1A. Auth users missing a customers row (never landed in public.customers)
SELECT
  u.id          AS auth_user_id,
  u.email       AS auth_email,
  u.created_at  AS auth_created_at,
  u.last_sign_in_at,
  'MISSING customers row' AS issue
FROM auth.users u
LEFT JOIN public.customers c ON c.id = u.id
WHERE c.id IS NULL
ORDER BY u.created_at DESC;

-- 1B. Customers rows with no auth.users entry (ghost/orphaned profile)
SELECT
  c.id         AS customer_id,
  c.email      AS customer_email,
  c.full_name,
  c.created_at AS customer_created_at,
  'ORPHANED — no matching auth.users row' AS issue
FROM public.customers c
LEFT JOIN auth.users u ON u.id = c.id
WHERE u.id IS NULL
ORDER BY c.created_at DESC;

-- 1C. Email mismatch between auth.users and customers
SELECT
  u.id             AS auth_user_id,
  u.email          AS auth_email,
  c.email          AS customers_email,
  c.full_name,
  'EMAIL MISMATCH' AS issue
FROM auth.users u
JOIN public.customers c ON c.id = u.id
WHERE u.email IS DISTINCT FROM c.email
ORDER BY u.created_at DESC;

-- ── SECTION 2 ────────────────────────────────────────────────────────────────
-- ADDRESSES ownership audit
-- Surfaces: address rows whose customer_id points to a customer that
--   (a) doesn't exist, OR
--   (b) has a different auth.users id than expected (should never happen
--       since customers.id IS the auth.users.id)

-- 2A. Addresses referencing a non-existent customer
SELECT
  a.id          AS address_id,
  a.customer_id AS address_customer_id,
  a.name,
  a.city,
  a.governorate,
  a.created_at,
  'DANGLING — customer_id not in customers table' AS issue
FROM public.addresses a
LEFT JOIN public.customers c ON c.id = a.customer_id
WHERE c.id IS NULL
ORDER BY a.created_at DESC;

-- 2B. Snapshot: count of addresses per customer (useful for spotting
--     one customer absorbing many others' addresses)
SELECT
  c.id         AS customer_id,
  c.email,
  c.full_name,
  COUNT(a.id)  AS address_count,
  c.branch
FROM public.customers c
LEFT JOIN public.addresses a ON a.customer_id = c.id
GROUP BY c.id, c.email, c.full_name, c.branch
HAVING COUNT(a.id) > 3      -- flag customers with unusually many addresses
ORDER BY address_count DESC;

-- ── SECTION 3 ────────────────────────────────────────────────────────────────
-- ORDERS ownership audit
-- Surfaces: orders whose customer_id doesn't match the address used
--   (shipping_address_id references an address belonging to a DIFFERENT customer)

-- 3A. Orders where shipping_address_id belongs to a different customer
SELECT
  o.id             AS order_id,
  o.order_number,
  o.customer_id    AS order_customer_id,
  oc.email         AS order_customer_email,
  a.customer_id    AS address_customer_id,
  ac.email         AS address_customer_email,
  o.created_at,
  'CROSS-CUSTOMER address reference' AS issue
FROM public.orders o
JOIN public.addresses a  ON a.id = o.shipping_address_id
JOIN public.customers oc ON oc.id = o.customer_id
JOIN public.customers ac ON ac.id = a.customer_id
WHERE o.customer_id IS NOT NULL
  AND a.customer_id IS NOT NULL
  AND o.customer_id IS DISTINCT FROM a.customer_id
ORDER BY o.created_at DESC;

-- 3B. Orders where customer_id is set but the customer doesn't exist
SELECT
  o.id           AS order_id,
  o.order_number,
  o.customer_id,
  o.total,
  o.status,
  o.created_at,
  'DANGLING — customer_id not in customers table' AS issue
FROM public.orders o
LEFT JOIN public.customers c ON c.id = o.customer_id
WHERE o.customer_id IS NOT NULL
  AND c.id IS NULL
ORDER BY o.created_at DESC;

-- 3C. Orders with no customer_id (guest orders) — informational only
SELECT
  COUNT(*) AS guest_order_count,
  SUM(total) AS guest_order_revenue
FROM public.orders
WHERE customer_id IS NULL;

-- ── SECTION 4 ────────────────────────────────────────────────────────────────
-- RETURN REQUESTS ownership audit
-- Surfaces: return_requests whose customer_id differs from the order's customer_id

SELECT
  r.id             AS return_id,
  r.order_id,
  o.order_number,
  r.customer_id    AS return_customer_id,
  rc.email         AS return_customer_email,
  o.customer_id    AS order_customer_id,
  oc.email         AS order_customer_email,
  r.status,
  r.created_at,
  'CROSS-CUSTOMER return request' AS issue
FROM public.return_requests r
JOIN public.orders o ON o.id = r.order_id
LEFT JOIN public.customers rc ON rc.id = r.customer_id
LEFT JOIN public.customers oc ON oc.id = o.customer_id
WHERE r.customer_id IS NOT NULL
  AND o.customer_id IS NOT NULL
  AND r.customer_id IS DISTINCT FROM o.customer_id
ORDER BY r.created_at DESC;

-- ── SECTION 5 ────────────────────────────────────────────────────────────────
-- BRANCH FIELD — current state snapshot
-- Shows all customers with their current branch value (NULL = unassigned)

SELECT
  c.id,
  c.email,
  c.full_name,
  c.phone,
  c.role,
  c.branch,
  c.created_at,
  COUNT(o.id) AS orders_count
FROM public.customers c
LEFT JOIN public.orders o ON o.customer_id = c.id
GROUP BY c.id, c.email, c.full_name, c.phone, c.role, c.branch, c.created_at
ORDER BY c.branch NULLS LAST, c.created_at DESC;

-- ==============================================================================
-- END OF AUDIT — DO NOT APPLY ANY CHANGES UNTIL RESULTS HAVE BEEN REVIEWED
-- ==============================================================================
