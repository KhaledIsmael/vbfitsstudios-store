# 03 — RLS Security Audit Report
**VB FITS STUDIOS · fix/egress-reliability · Recovery Phase 3**
_Generated: 2026-11-24 · Status: **PROPOSED — no SQL applied, no production permissions changed**_

---

## ⚠️ Mandatory Disclaimer

All findings in this document are derived from static analysis of **migration files in the repository**.
They describe the _intended_ database state at the time each migration was written.

> **We cannot confirm which policies are live in production** without executing the verification
> queries in §4 against the Supabase SQL editor.  Every finding is therefore classified as
> `HYPOTHESIS` until the owner confirms it with the read-only queries below.

No customer PII was accessed, queried, or disclosed during this audit.
All UUIDs used in test SQL are synthetic placeholders.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Migration Ancestry](#2-migration-ancestry)
3. [Methodology](#3-methodology)
4. [Live Verification Queries (READ-ONLY)](#4-live-verification-queries-read-only)
5. [Finding Register](#5-finding-register)
6. [Access Matrix](#6-access-matrix)
7. [Proposed Policy Fixes](#7-proposed-policy-fixes)
8. [Idempotent Forward + Rollback SQL](#8-idempotent-forward--rollback-sql)
9. [Regression Test Suite](#9-regression-test-suite)
10. [Code Change Proposals](#10-code-change-proposals)
11. [Manual Approval Gates](#11-manual-approval-gates)

---

## 1. Executive Summary

| Severity | Count | Confirmed in Code | Live-Verified |
|----------|-------|-------------------|---------------|
| 🔴 CRITICAL | 4 | ✅ All 4 | ❌ Not yet |
| 🟠 HIGH | 4 | ✅ All 4 | ❌ Not yet |
| 🟡 MEDIUM | 4 | ✅ All 4 | ❌ Not yet |
| 🟢 LOW / INFO | 3 | ✅ | ❌ Not yet |

### Top Risks (Hypothesis — Must Verify Live)

| ID | Risk | Table | Impact |
|----|------|-------|--------|
| RLS-01 | Any authenticated user can SELECT **all guest orders** (names, phones, addresses, items) | `orders` | 🔴 CRITICAL |
| RLS-02 | Same guest-order exposure via `order_items` join | `order_items` | 🔴 CRITICAL |
| RLS-03 | Any authenticated user can SELECT **all guest carts** | `cart_items` | 🔴 CRITICAL |
| RLS-06 | `linkPastOrdersToCustomer` ships **all guest orders** to every logging-in user's browser | `orders` (client) | 🔴 CRITICAL |
| RLS-04 | Any authenticated user can **UPDATE** any guest order | `orders` | 🟠 HIGH |
| RLS-08 | `AuthContext.tsx` can upsert `role='admin'` via metadata before trigger fires | `customers` | 🟠 HIGH |
| RLS-10 | `order_items` SELECT is `USING (true)` — open to all | `order_items` | 🟠 HIGH |
| RLS-11 | `site_settings` GRANT ALL to `anon` persists (includes DELETE) | `site_settings` | 🟡 MEDIUM |

---

## 2. Migration Ancestry

The following migrations touch RLS policies on the tables in scope, in chronological order.
**Later migrations override earlier ones for the same table+command**.

```
20260919000017_rls_policies.sql          ← original policies (baseline)
20260925000020_critical_bug_fixes.sql    ← overrides orders, customers, store_settings
20261004000032_close_all_remaining_gaps.sql ← hardens customers trigger, return_requests
20261004000033_access_rules.sql          ← AUTHORITATIVE: drops & recreates all policies (607 lines)
20261004000034_functions_triggers.sql    ← adds RPCs, handle_new_customer trigger (SECURITY DEFINER)
20261004000035_storage.sql               ← storage bucket RLS (store-media, product-media, return-photos)
20261010000041_fix_order_items_purge_and_product_delete.sql ← RESETS order_items RLS to USING(true)
20261014000043_cod_only_trusted_totals.sql ← adds BEFORE INSERT trigger enforcing COD + trusted totals
20261124000045_order_idempotency_key.sql ← (PREPARED, NOT APPLIED) — idempotency key column + index
```

**Key insight:** Migration `000041` runs **after** `000033`.  It drops ALL `order_items` policies and
replaces them with `USING (true)` for SELECT and `WITH CHECK (true)` for INSERT.  This is the latest
applied state for `order_items`.

---

## 3. Methodology

1. Read all 44 migration files in chronological order, identifying the **last policy definition** per
   `(table, command)` pair.
2. Traced every `auth.uid()`, `is_admin()`, `is_admin_or_support()`, and `customer_id IS NULL`
   reference.
3. Read `src/context/AuthContext.tsx` (502 lines), `src/lib/orders.ts` (1 108 lines), and
   `api/paymob/webhook.ts` (255 lines) for client-side authorization paths.
4. Cross-referenced against the SECURITY DEFINER trigger `handle_new_customer` and the
   `create_order_with_server_totals` RPC to understand authoritative server paths.
5. Generated read-only verification queries (§4) so the owner can confirm the live state.

---

## 4. Live Verification Queries (READ-ONLY)

> **Instructions:** Run these in the Supabase project → SQL Editor.
> They are pure `SELECT` / `\df` queries — no mutations.
> Replace redacted placeholders with real values only where noted.

### Query A — Active policies on key tables

```sql
-- Run in Supabase SQL Editor (read-only)
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual       AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'orders', 'order_items', 'cart_items', 'customers',
    'return_requests', 'store_settings', 'site_settings', 'discount_codes'
  )
ORDER BY tablename, cmd, policyname;
```

**Expected / Concerning result to look for:**
- `orders` SELECT policy: does `qual` contain `OR customer_id IS NULL`?
- `orders` UPDATE policy: does `qual` or `with_check` contain `OR customer_id IS NULL`?
- `cart_items` SELECT policy: does `qual` contain `OR user_id IS NULL`?
- `order_items` SELECT policy: is `qual = 'true'`? (migration 000041 set this)
- `site_settings` policies: is there only an admin write guard, or does anon INSERT/DELETE survive?

---

### Query B — Helper function bodies

```sql
-- Verify SECURITY DEFINER and function bodies for is_admin, is_admin_or_support
SELECT
  routine_name,
  routine_definition,
  security_type   -- should be 'DEFINER' for both
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'is_admin_or_support', 'handle_new_customer')
ORDER BY routine_name;
```

**Look for:** `security_type = 'DEFINER'` on all three. Confirm `handle_new_customer` hardcodes
`'customer'` for the role field (not copying metadata).

---

### Query C — Table-level GRANT inventory

```sql
-- Column privileges on key tables
SELECT
  grantee,
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'orders', 'order_items', 'customers', 'site_settings', 'store_settings', 'cart_items'
  )
ORDER BY table_name, grantee, privilege_type;
```

**Look for:** `anon` having `DELETE` or `UPDATE` on `site_settings`, `store_settings`.
`anon` having `INSERT` on `order_items` (Migration 000041 grants this).

---

### Query D — Storage.objects policies on key buckets

```sql
-- Storage RLS policies
SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (qual LIKE '%store-media%' OR qual LIKE '%product-media%' OR qual LIKE '%return-photos%'
       OR with_check LIKE '%store-media%' OR with_check LIKE '%product-media%')
ORDER BY cmd, policyname;
```

**Look for:** Any INSERT policy on `product-media` with `auth.role() = 'authenticated'` (the legacy
permissive policy from an earlier migration).  If found, it coexists with the `is_admin_or_support()`
guard via OR logic and renders the guard ineffective for uploads.

---

### Query E — Verify handle_new_customer trigger target

```sql
-- Confirm trigger is on auth.users (not public.customers, which would cause recursion)
SELECT
  trigger_schema,
  trigger_name,
  event_object_schema,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_updated')
ORDER BY trigger_name;
```

---

### Query F — Confirm order_items latest RLS state

```sql
-- Check whether order_items SELECT is currently open (USING true) or restricted
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'order_items'
ORDER BY cmd;
```

**Concern:** If result shows `qual = 'true'` for SELECT, any user (anon or authenticated) can read
all order lines of all orders, including customer names and products.

---

### Query G — Confirm customers upsert role guard

```sql
-- Check if any UPDATE policy on customers allows setting role='admin' without is_admin check
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'customers'
ORDER BY cmd;
```

**Look for:** Whether an authenticated non-admin customer can UPDATE their own row and set
`role = 'admin'`.  The expected guard is `WITH CHECK (role = OLD.role OR is_admin_or_support())`.

---

### Query H — Confirm active grants to anon on site_settings

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'site_settings' AND grantee = 'anon';
```

---

## 5. Finding Register

> Legend: **Status** = `HYPOTHESIS` (confirmed in migration code, live state unverified) /
> `CONFIRMED-IN-CODE` (structural issue, not policy-dependent) / `INFO`

---

### RLS-01 — Guest Orders Fully Readable by Any Authenticated User
**Severity:** 🔴 CRITICAL · **Status:** HYPOTHESIS · **Table:** `orders`

**Evidence (migration `20261004000033_access_rules.sql`, line 300):**
```sql
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id          -- own authenticated orders
    OR customer_id IS NULL            -- ← ANY authenticated user reads ALL guest orders
    OR public.is_admin_or_support()
  );
```

**What this means:** Every guest order row (where `customer_id IS NULL`) is readable by any
logged-in customer via the Supabase REST API. Guest orders contain `shipping_address_snapshot`
(full name, phone, email, street address, city, governorate) and `notes` (which may contain email).

**Client-side "challenge" in `lookupGuestOrder`** (`src/lib/orders.ts` line 318–332) performs
email matching after fetching — but this is bypassed with a direct API call: anyone can run
`supabase.from('orders').select('*').is('customer_id', null)` and retrieve all guest order data.

**Reproduction:**
1. Register any account via the storefront.
2. Use the Supabase JS client with the anon key + authenticated session.
3. `await supabase.from('orders').select('*').is('customer_id', null)` → returns all guest orders.

**Recommended fix:** Remove `OR customer_id IS NULL` from the SELECT USING clause.
Provide a `SECURITY DEFINER` RPC for guest order lookup with rate-limiting (see §7).

---

### RLS-02 — Guest Order Items Transitively Exposed
**Severity:** 🔴 CRITICAL · **Status:** HYPOTHESIS (depends on RLS-01 and Query F result)

**Evidence (migration `20261010000041`, line 171):**
```sql
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (true);
```

Migration `000041` runs after `000033` and **drops all existing `order_items` policies**, then
creates `USING (true)` — meaning ALL `order_items` rows are readable by everyone (anon and
authenticated).  Combined with RLS-01, every item purchased in every guest order is exposed.

**Note:** Even if RLS-01 is patched, `USING (true)` on `order_items` means that knowing any
`order_id` (from any other source) allows reading that order's line items.

**Recommended fix:** Restrict `order_items` SELECT to rows whose `order_id` belongs to the caller's
own orders (see §7, Fix F2).

---

### RLS-03 — Guest Cart Items Readable by Any Authenticated User
**Severity:** 🔴 CRITICAL · **Status:** HYPOTHESIS · **Table:** `cart_items`

**Evidence (migration `20261004000033_access_rules.sql`, line 369):**
```sql
CREATE POLICY "cart_items_select"
  ON public.cart_items FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IS NULL   -- ← ANY authenticated user reads ALL guest cart rows
  );
```

Any authenticated user can call `supabase.from('cart_items').select('*').is('user_id', null)` and
read every guest cart in the database.  Guest carts contain product selections that may identify
purchasing intent; they are associated with `session_id` only.

Guest A and Guest B can read each other's carts (both have `user_id IS NULL`).

**Recommended fix:** Move guest cart state to localStorage only (no server-side row for guests),
or use a signed session token the server issues and verifies (not user-controlled).

---

### RLS-04 — Authenticated Users Can UPDATE Any Guest Order
**Severity:** 🟠 HIGH · **Status:** HYPOTHESIS · **Table:** `orders`

**Evidence (migration `20261004000033_access_rules.sql`, line 318):**
```sql
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR customer_id IS NULL   -- ← any authenticated user may UPDATE any guest order
    OR public.is_admin_or_support()
  );
```

A logged-in customer could update `status`, `notes`, `shipping_address_snapshot`, or other mutable
fields on any guest order.  The BEFORE UPDATE trigger `guard_order_financial_updates` (migration
`000043`) blocks changes to financial fields for non-admins, but it does **not** block status or
address changes.

**Recommended fix:** Remove `OR customer_id IS NULL` from the UPDATE policy.  Guest order status
changes should only be possible via service_role (admin panel, webhook).

---

### RLS-05 — Return Requests Expose Guest Data
**Severity:** 🟡 MEDIUM · **Status:** HYPOTHESIS · **Table:** `return_requests`

**Evidence (migration `20261004000033_access_rules.sql`, line 418):**
```sql
CREATE POLICY "return_requests_select" ON public.return_requests FOR SELECT
  USING (customer_id = auth.uid() OR customer_id IS NULL OR is_admin_or_support());
```

Same pattern: `customer_id IS NULL` guest return requests are readable by any authenticated user.

---

### RLS-06 — `linkPastOrdersToCustomer` Full-Table Scan Ships PII to Browser
**Severity:** 🔴 CRITICAL · **Status:** CONFIRMED-IN-CODE · **File:** `src/lib/orders.ts`

**Evidence (`src/lib/orders.ts`, lines 90–145):**
```typescript
const { data: guestOrders } = await supabase
  .from('orders')
  .select('id, shipping_address_snapshot, notes')
  .is('customer_id', null);  // ← fetches ALL guest orders to the client's browser
```

This function is called from `AuthContext.tsx` on **every login and every session restore**.
The full `shipping_address_snapshot` (name, phone, email, street address, landmark, city,
governorate) of every guest order in the database is transmitted to and processed in every
logging-in customer's browser.  Client-side filtering by email/phone happens after the data
arrives.

**Additional exposure in `getUserOrders`** (`src/lib/orders.ts`, lines 203–230):
```typescript
const { data: unassignedOrders } = await supabase
  .from('orders')
  .select(`id, order_number, ... shipping_address_snapshot, items:order_items(...)`)
  .is('customer_id', null);  // ← ALL guest orders + items fetched on every order history load
```

**Impact:** As guest order volume grows, this becomes a bandwidth + privacy liability even before
any deliberate attack.

**Recommended fix:** Replace both scans with a `SECURITY DEFINER` RPC that accepts
`(p_customer_id UUID, p_email TEXT, p_phone TEXT)`, performs the email/phone match server-side, and
returns only `{order_id, order_number}` pairs for linking, never the raw PII (see §10, Code-01).

---

### RLS-07 — `handle_new_customer` Trigger Is Safe (INFO)
**Severity:** 🟢 INFO · **Status:** CONFIRMED-IN-CODE · **File:** `supabase/migrations/20261004000034_functions_triggers.sql`

The `handle_new_customer` trigger (`000034`, lines 563–602) hardcodes `'customer'` for the `role`
field and runs AFTER INSERT on `auth.users`.

**However:** `AuthContext.tsx` lines 119–134 compute `initialRole` from `metadata.role`, then call
`supabase.from('customers').upsert({..., role: initialRole})`.  If the **upsert** (not the trigger)
fires first on a new signup, `role='admin'` from metadata could win.

**Analysis:** On `INSERT`, the trigger runs `AFTER INSERT` on `auth.users`, which is a separate
table from `public.customers`.  The upsert in `fetchCustomerProfile` (AuthContext) is a separate
Supabase PostgREST call that happens milliseconds later.  The trigger fires before the `fetchCustomerProfile` upsert.  Since the trigger uses `ON CONFLICT (id) DO UPDATE` and does **not** touch `role`, the subsequent upsert from `fetchCustomerProfile` **can overwrite role to 'admin'**.

**Specific risk:** A user who registers with `metadata.role = 'admin'` and whose email is not in
the allowlist will have `initialRole = 'customer'` (line 124 guard handles non-admin emails), so
in practice the email guard saves this.  But the allowlist is hardcoded to two specific emails —
any change to the allowlist could re-expose this.

**Recommended fix:** Remove `role` from the `fetchCustomerProfile` upsert entirely.  Role should
only be set by admin action via service_role, never by the client-side upsert.

---

### RLS-08 — `AuthContext.tsx` Upsert Can Set `role='admin'` from Metadata
**Severity:** 🟠 HIGH · **Status:** CONFIRMED-IN-CODE · **File:** `src/context/AuthContext.tsx`

**Evidence (lines 119–134):**
```typescript
const isAdminIdent =
  metadata.role === 'admin' ||          // ← user-controllable JWT metadata
  metadata.role === 'support' ||
  (sbUser.email && (sbUser.email === 'admin@vbfitsstudios.com' ...));

const initialRole: CustomerRole = isAdminIdent ? 'admin' : ...;

await supabase.from('customers').upsert({ ..., role: initialRole }, { onConflict: 'id' });
```

`metadata.role` is the JWT claim from `auth.users.raw_user_meta_data`.  While the trigger hardcodes
`'customer'`, the subsequent upsert executes under the customer's RLS session.

**What prevents exploitation today:** The `customers` UPDATE policy (from `000033`) should include
`WITH CHECK (role = OLD.role OR is_admin_or_support())`.  Run Query G to confirm whether this
constraint is active.  If it is not (or was replaced by a looser policy), the upsert path could
escalate privileges.

**Recommended fix (regardless of live state):**
1. Remove `role` from the client-side upsert in `fetchCustomerProfile`.
2. If a customers UPDATE policy does not exist or allows role changes, add the guard (see §7, Fix F6).

---

### RLS-09 — `store_settings` May Have Survived Permissive `000020` Policies
**Severity:** 🟡 MEDIUM · **Status:** HYPOTHESIS · **Table:** `store_settings`

Migration `000020` added `WITH CHECK (true)` for INSERT/UPDATE on `store_settings` as a "critical
bug fix."  Migration `000033` overwrites those with `is_admin_or_support()` guards.  If `000033`
applied cleanly, this is resolved.  Run Query A with `tablename = 'store_settings'` to confirm.

---

### RLS-10 — `order_items` Fully Open (SELECT + INSERT USING true)
**Severity:** 🟠 HIGH · **Status:** HYPOTHESIS · **Table:** `order_items`

As documented in RLS-02, migration `000041` sets:
```sql
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated, anon;
```

The comment says "order ownership enforced by the orders trigger," but no such ownership
verification exists in any trigger.  The `recompute_order_totals_after_item` trigger re-derives
totals from items, but does not validate that the inserter owns the target `order_id`.

A logged-in user can insert a fake `order_items` row for any `order_id` they know, potentially
inflating or deflating totals (the totals recompute trigger would recalculate based on all items).

---

### RLS-11 — `site_settings` GRANT ALL to `anon`
**Severity:** 🟡 MEDIUM · **Status:** HYPOTHESIS · **Table:** `site_settings`

Migration `000032` grants `ALL` to `anon` on `site_settings`.  Even with RLS enabled and only an
admin write policy, `GRANT ALL` includes `DELETE` privilege.  RLS controls whether the DELETE
succeeds, but the grant signals unintended intent.  Confirm with Query H.

---

### RLS-12 — Discount Codes Fully Readable (Intentional, Low Rate-Limit Risk)
**Severity:** 🟢 INFO · **Table:** `discount_codes`

The `anon` role can SELECT all active discount codes (intentional for checkout validation).
Risk: code-scraping via repeated `SELECT` to enumerate all valid codes.  No DB-level rate limit
exists; Supabase's API gateway provides some protection but is not project-configurable.

---

### RLS-13 — Paymob Webhook Uses Wrong Key Fallback
**Severity:** 🟡 MEDIUM · **Status:** CONFIRMED-IN-CODE · **File:** `api/paymob/webhook.ts`

**Evidence (lines 59–60):**
```typescript
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
```

If `SUPABASE_SERVICE_ROLE_KEY` is not set in Vercel environment variables, the webhook silently
falls back to the **anon key**.  The anon key cannot bypass RLS, so order status updates from
Paymob would silently fail (the `update()` call returns empty data, the error is logged but Paymob
gets HTTP 200, so it does not retry).

**Recommended fix:** Remove the fallback to `VITE_SUPABASE_ANON_KEY`.  Return HTTP 500 if
`SUPABASE_SERVICE_ROLE_KEY` is absent (see §10, Code-02).

---

### RLS-14 — Storage Legacy `product-media` Permissive INSERT (From Prior Audit)
**Severity:** 🟡 MEDIUM · **Status:** HYPOTHESIS · From `02_FINAL_VERIFICATION.md`

Migration `000035` correctly creates `is_admin_or_support()` guards for `product-media` INSERT.
If any earlier permissive policy (e.g., `auth.role() = 'authenticated'`) was not dropped before
migration `000035` ran, it coexists via OR logic and allows any authenticated user to upload.
Run Query D to confirm whether a legacy INSERT policy survives.

---

## 6. Access Matrix

Operations marked ✅ are **intended** per migration code.
Operations marked ⚠️ are **unintended** per hypothesis (pending live verification).
Operations marked ❌ should be blocked.

### `orders` table

| Operation | anon | Guest* | Customer A | Customer B | Admin |
|-----------|------|--------|-----------|-----------|-------|
| SELECT own orders | ❌ | ❌ | ✅ | ✅ | ✅ |
| SELECT guest orders (`customer_id IS NULL`) | ❌ | ❌ | ⚠️ HYPO | ⚠️ HYPO | ✅ |
| INSERT (via create_order RPC) | ✅ | ✅ | ✅ | ✅ | ✅ |
| INSERT (direct, COD only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| UPDATE own orders (non-financial) | ❌ | ❌ | ✅ | ✅ | ✅ |
| UPDATE guest orders | ❌ | ❌ | ⚠️ HYPO | ⚠️ HYPO | ✅ |
| DELETE | ❌ | ❌ | ❌ | ❌ | ✅ |

*Guest = unauthenticated session (anon key)

### `order_items` table

| Operation | anon | Guest* | Customer A | Customer B | Admin |
|-----------|------|--------|-----------|-----------|-------|
| SELECT any row | ⚠️ HYPO | ⚠️ HYPO | ⚠️ HYPO | ⚠️ HYPO | ✅ |
| INSERT (any order_id) | ⚠️ HYPO | ⚠️ HYPO | ⚠️ HYPO | ⚠️ HYPO | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ❌ | ✅ |

### `cart_items` table

| Operation | anon | Guest* | Customer A | Customer B | Admin |
|-----------|------|--------|-----------|-----------|-------|
| SELECT own cart | ✅ | ✅ | ✅ | ✅ | ✅ |
| SELECT guest carts (`user_id IS NULL`) | ❌ | ⚠️ HYPO | ⚠️ HYPO | ⚠️ HYPO | ✅ |
| INSERT | ✅ | ✅ | ✅ | ✅ | ✅ |
| UPDATE | ✅ | ✅ | own only | own only | ✅ |
| DELETE | ✅ | ✅ | own only | own only | ✅ |

### `customers` table

| Operation | anon | Guest* | Customer A | Customer B | Admin |
|-----------|------|--------|-----------|-----------|-------|
| SELECT own row | ❌ | ❌ | ✅ | ✅ | ✅ |
| SELECT other's row | ❌ | ❌ | ❌ | ❌ | ✅ |
| UPDATE own row (non-role) | ❌ | ❌ | ✅ | ✅ | ✅ |
| UPDATE role field | ❌ | ❌ | ⚠️ HYPO | ⚠️ HYPO | ✅ |

---

## 7. Proposed Policy Fixes

> **These are PROPOSALS only.**  None of these SQL statements have been applied.
> Each requires owner approval before execution.  See §11 for approval gates.

### Fix F1 — Remove `customer_id IS NULL` from `orders` SELECT

```sql
-- PROPOSED — do not apply without approval
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR public.is_admin_or_support()
    -- guest orders are served exclusively via the lookup_guest_order() RPC
  );
```

**Risk:** Guest order tracking on the storefront currently relies on the client-side
`lookupGuestOrder()` function which queries via this policy.  After this fix, `lookupGuestOrder`
must be rewritten to call the `lookup_guest_order` RPC (see §10, Code-01).

---

### Fix F2 — Restrict `order_items` SELECT to Caller's Orders

```sql
-- PROPOSED — do not apply without approval
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id = auth.uid()
    )
  );
-- Note: guest order items served via lookup_guest_order RPC (SECURITY DEFINER)
```

---

### Fix F3 — Remove `customer_id IS NULL` from `orders` UPDATE

```sql
-- PROPOSED — do not apply without approval
DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR public.is_admin_or_support()
  )
  WITH CHECK (
    auth.uid() = customer_id
    OR public.is_admin_or_support()
  );
```

---

### Fix F4 — Remove Guest Cart Exposure

```sql
-- PROPOSED — do not apply without approval
-- Option A: local-only guest carts (remove server-side guest cart rows entirely)
-- After migrating existing guest cart data to localStorage, apply:
DROP POLICY IF EXISTS "cart_items_select" ON public.cart_items;
CREATE POLICY "cart_items_select"
  ON public.cart_items FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

-- Also restrict INSERT/UPDATE/DELETE for guests (they use localStorage only)
DROP POLICY IF EXISTS "cart_items_insert" ON public.cart_items;
CREATE POLICY "cart_items_insert"
  ON public.cart_items FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );
```

---

### Fix F5 — Remove Guest Exposure from `return_requests`

```sql
-- PROPOSED — do not apply without approval
DROP POLICY IF EXISTS "return_requests_select" ON public.return_requests;
CREATE POLICY "return_requests_select"
  ON public.return_requests FOR SELECT
  USING (
    customer_id = auth.uid()
    OR public.is_admin_or_support()
  );
-- Guest return lookups served via a service_role API route
```

---

### Fix F6 — Guard `customers` Role Field on UPDATE

```sql
-- PROPOSED — do not apply without approval
-- Confirm current UPDATE policy first (Query G), then if role protection is absent:
DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update"
  ON public.customers FOR UPDATE
  USING (id = auth.uid() OR public.is_admin_or_support())
  WITH CHECK (
    (id = auth.uid() AND role = (SELECT role FROM public.customers WHERE id = auth.uid()))
    OR public.is_admin_or_support()
  );
-- This prevents a customer from changing their own role via upsert
```

---

### Fix F7 — Restrict `order_items` INSERT (Ownership Check)

```sql
-- PROPOSED — do not apply without approval
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
        AND o.created_at >= now() - INTERVAL '5 minutes'
        -- only allow item insertion into very recently created orders
    )
  );
-- Note: create_order_with_server_totals RPC (SECURITY DEFINER) is exempt from RLS
```

---

### Fix F8 — Revoke GRANT ALL from `anon` on `site_settings`

```sql
-- PROPOSED — do not apply without approval
REVOKE ALL ON public.site_settings FROM anon;
GRANT SELECT ON public.site_settings TO anon;
-- RLS policies still control what anon can read
```

---

## 8. Idempotent Forward + Rollback SQL

The following blocks are idempotent — safe to run multiple times.  Each change pair is independent.

### F1: orders SELECT rollback

```sql
-- ROLLBACK for Fix F1 (restore original behaviour)
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );
```

### F2: order_items SELECT rollback

```sql
-- ROLLBACK for Fix F2 (restore USING(true))
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (true);
```

### F3: orders UPDATE rollback

```sql
-- ROLLBACK for Fix F3
DROP POLICY IF EXISTS "orders_update" ON public.orders;
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR customer_id IS NULL
    OR public.is_admin_or_support()
  );
```

### F4: cart_items rollback

```sql
-- ROLLBACK for Fix F4
DROP POLICY IF EXISTS "cart_items_select" ON public.cart_items;
CREATE POLICY "cart_items_select"
  ON public.cart_items FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);
DROP POLICY IF EXISTS "cart_items_insert" ON public.cart_items;
CREATE POLICY "cart_items_insert"
  ON public.cart_items FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL OR public.is_admin_or_support());
```

### F5: return_requests rollback

```sql
-- ROLLBACK for Fix F5
DROP POLICY IF EXISTS "return_requests_select" ON public.return_requests;
CREATE POLICY "return_requests_select"
  ON public.return_requests FOR SELECT
  USING (customer_id = auth.uid() OR customer_id IS NULL OR public.is_admin_or_support());
```

### F6: customers UPDATE rollback

```sql
-- ROLLBACK for Fix F6
DROP POLICY IF EXISTS "customers_update" ON public.customers;
-- Restore prior policy (check Query G output for original definition before applying)
-- INSERT ORIGINAL POLICY DEFINITION HERE AFTER RUNNING QUERY G
```

### F8: site_settings grants rollback

```sql
-- ROLLBACK for Fix F8
GRANT ALL ON public.site_settings TO anon;
```

---

## 9. Regression Test Suite

> Run against an **isolated staging Supabase project** with synthetic data only.
> Never run against production.  Never use real customer data.

### Setup — Synthetic Users

```sql
-- Create synthetic test users in staging auth.users (Supabase Auth Admin API)
-- User IDs are deterministic fake UUIDs for reproducibility

-- admin_uuid:     '00000000-0000-0000-0000-000000000001'
-- customer_a_uuid:'00000000-0000-0000-0000-000000000002'
-- customer_b_uuid:'00000000-0000-0000-0000-000000000003'

-- Create matching customers rows
INSERT INTO public.customers (id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'test-admin@staging.local', 'Test Admin', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'test-customer-a@staging.local', 'Customer A', 'customer'),
  ('00000000-0000-0000-0000-000000000003', 'test-customer-b@staging.local', 'Customer B', 'customer')
ON CONFLICT (id) DO NOTHING;

-- Create synthetic orders: one owned, one guest
INSERT INTO public.orders (id, customer_id, order_number, status, total, shipping_address_snapshot)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'VBF-TEST-A', 'placed', 100,
   '{"name":"Customer A","email":"test-customer-a@staging.local","phone":"01000000001"}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002', NULL, -- GUEST ORDER
   'VBF-GUEST-1', 'placed', 150,
   '{"name":"Guest User","email":"guest@example.com","phone":"01099999999"}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
   'VBF-TEST-B', 'placed', 200,
   '{"name":"Customer B","email":"test-customer-b@staging.local","phone":"01000000002"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.order_items (order_id, product_name, variant_title, unit_price, quantity, total_price)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Test Product A', 'Size: M', 50, 2, 100),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Test Product Guest', 'Size: L', 75, 2, 150),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Test Product B', 'Size: S', 100, 2, 200)
ON CONFLICT DO NOTHING;
```

### Test T-01 — anon cannot read orders (expect 0 rows)

```sql
-- Set role to anon (simulate unauthenticated request)
SET LOCAL ROLE anon;
SELECT count(*) FROM public.orders; -- expect: 0
SELECT count(*) FROM public.order_items; -- expect: 0 (after Fix F2) or all rows (before fix)
RESET ROLE;
```

### Test T-02 — Customer A cannot read Customer B's authenticated order

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT id, order_number FROM public.orders; -- expect: only VBF-TEST-A
-- must NOT see VBF-TEST-B
RESET ROLE;
```

### Test T-03 — CRITICAL: Customer A cannot read guest orders (after Fix F1)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT id, order_number FROM public.orders WHERE customer_id IS NULL;
-- expect: 0 rows (AFTER Fix F1 is applied)
-- expect: 1 row (VBF-GUEST-1) BEFORE fix — this confirms the vulnerability
RESET ROLE;
```

### Test T-04 — Customer A cannot UPDATE guest order (after Fix F3)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
UPDATE public.orders SET notes = 'tampered' WHERE order_number = 'VBF-GUEST-1';
-- expect: 0 rows updated (AFTER Fix F3)
-- expect: 1 row updated BEFORE fix — confirms vulnerability
RESET ROLE;
```

### Test T-05 — Customer A cannot read Customer B's cart

```sql
-- Insert guest cart row for session test
INSERT INTO public.cart_items (user_id, session_id, product_id, quantity)
VALUES (NULL, 'sess-guest-123', (SELECT id FROM public.products LIMIT 1), 1)
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT count(*) FROM public.cart_items WHERE user_id IS NULL;
-- expect: 0 (AFTER Fix F4)
-- expect: 1 (BEFORE fix — confirms vulnerability)
RESET ROLE;
```

### Test T-06 — Customer cannot change own role to admin (after Fix F6)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
UPDATE public.customers SET role = 'admin' WHERE id = '00000000-0000-0000-0000-000000000002';
-- expect: 0 rows updated (error or no-op) AFTER Fix F6
SELECT role FROM public.customers WHERE id = '00000000-0000-0000-0000-000000000002';
-- expect: 'customer' (unchanged)
RESET ROLE;
```

### Test T-07 — Admin can read all orders

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
-- is_admin_or_support() checks customers table for role='admin'
SELECT count(*) FROM public.orders; -- expect: 3 (all test orders)
RESET ROLE;
```

### Test T-08 — order_items INSERT without ownership (after Fix F7)

```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
-- Customer B tries to insert an item into Customer A's order
INSERT INTO public.order_items (order_id, product_name, unit_price, quantity, total_price)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Injected Item', 1, 1, 1);
-- expect: permission denied / 0 rows inserted (AFTER Fix F7)
RESET ROLE;
```

### Cleanup

```sql
DELETE FROM public.order_items WHERE order_id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003'
);
DELETE FROM public.orders WHERE id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003'
);
DELETE FROM public.customers WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
```

---

## 10. Code Change Proposals

> These are **proposed changes only** — not yet implemented in the codebase.
> Code changes in §10 depend on live RLS verification (§4) and policy approval (§11).

### Code-01 — Replace `linkPastOrdersToCustomer` Full-Table Scan

**Current problem:** Ships all guest order PII to every logging-in browser.

**Proposed SECURITY DEFINER RPC** (migration `20261124000046_link_guest_orders_rpc.sql`):

```sql
-- PROPOSED MIGRATION — do not apply without approval
CREATE OR REPLACE FUNCTION public.link_guest_orders_to_customer(
  p_customer_id UUID,
  p_email       TEXT,
  p_phone       TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_email TEXT := lower(trim(p_email));
  v_clean_phone TEXT := regexp_replace(trim(p_phone), '[\s\-()]', '', 'g');
  v_linked      INT  := 0;
BEGIN
  -- Rate limit: allow max 5 link attempts per customer per hour
  IF (
    SELECT count(*) FROM public.guest_link_audit
    WHERE customer_id = p_customer_id
      AND attempted_at >= now() - INTERVAL '1 hour'
  ) >= 5 THEN
    RETURN json_build_object('linked_count', 0, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.guest_link_audit (customer_id, attempted_at)
  VALUES (p_customer_id, now());

  WITH matched AS (
    SELECT id
    FROM public.orders
    WHERE customer_id IS NULL
      AND (
        lower(shipping_address_snapshot->>'email') = v_clean_email
        OR (
          v_clean_phone IS NOT NULL
          AND length(v_clean_phone) >= 8
          AND regexp_replace(shipping_address_snapshot->>'phone', '[\s\-()]', '', 'g')
              LIKE '%' || right(v_clean_phone, 8)
        )
      )
  )
  UPDATE public.orders
  SET customer_id = p_customer_id
  WHERE id IN (SELECT id FROM matched)
    AND customer_id IS NULL; -- guard against race

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RETURN json_build_object('linked_count', v_linked, 'error', null);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_guest_orders_to_customer(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.link_guest_orders_to_customer(UUID, TEXT, TEXT)
  TO authenticated, service_role;
```

**Updated `src/lib/orders.ts`** `linkPastOrdersToCustomer`:
```typescript
// PROPOSED CODE CHANGE
export async function linkPastOrdersToCustomer(
  customerId: string,
  email?: string,
  phone?: string
): Promise<void> {
  if (!customerId || !email) return;
  try {
    await supabase.rpc('link_guest_orders_to_customer', {
      p_customer_id: customerId,
      p_email: email.trim().toLowerCase(),
      p_phone: phone?.trim() ?? null
    });
  } catch (err) {
    console.warn('linkPastOrdersToCustomer RPC notice:', err);
  }
}
```

---

### Code-02 — Harden Paymob Webhook Service Key

**Current problem (`api/paymob/webhook.ts`, lines 59–60):**
```typescript
// CURRENT — risky fallback
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
```

**Proposed fix:**
```typescript
// PROPOSED CODE CHANGE
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set — webhook cannot update orders');
  return res.status(500).send('Webhook not configured');
}
```

---

### Code-03 — Remove `role` from `fetchCustomerProfile` Upsert

**Current problem (`src/context/AuthContext.tsx`, lines 126–138):**
```typescript
// CURRENT — can set role='admin' via metadata
await supabase.from('customers').upsert({ ..., role: initialRole }, { onConflict: 'id' });
```

**Proposed fix:**
```typescript
// PROPOSED CODE CHANGE — remove 'role' from the upsert payload entirely
const { data: created } = await supabase
  .from('customers')
  .upsert(
    {
      id: sbUser.id,
      email: sbUser.email || '',
      full_name: rawName,
      phone: metadata.phone || sbUser.phone || null
      // role intentionally omitted — set only by admin via service_role
    },
    { onConflict: 'id' }
  )
  .select('role, phone')
  .maybeSingle();
```

---

### Code-04 — Remove Guest Full-Table Scan from `getUserOrders`

**Current problem (`src/lib/orders.ts`, lines 203–230):**
Ships all guest orders + items to every browser when a customer views their order history.

**Proposed fix:** Remove the second query (`is('customer_id', null)`) from `getUserOrders`.
Guest orders are linked to the account by `linkPastOrdersToCustomer` (which now uses the RPC).
After linking, they appear in the first query (`eq('customer_id', customerId)`).

```typescript
// PROPOSED CODE CHANGE — remove the guest full-table scan from getUserOrders
// Lines 201-245 in src/lib/orders.ts: remove the second supabase query block entirely.
// guestMatches will always be [] — the linkPastOrdersToCustomer RPC handles linking server-side.
const guestMatches: any[] = [];
```

---

## 11. Manual Approval Gates

The following actions require **explicit written approval** from the owner before execution.
No action has been taken beyond static analysis and proposal.

### 🔴 Gate G1 — Apply policy fixes F1 through F8

**Prerequisites:**
- [ ] Owner has run Verification Queries A–H in Supabase SQL Editor
- [ ] Owner has confirmed which policies are currently live
- [ ] Owner has tested the lookup_guest_order RPC in staging
- [ ] Owner has confirmed guest cart localStorage migration is complete

**Approval required before:** Any `CREATE POLICY`, `DROP POLICY`, `REVOKE`, or `GRANT` statement.

---

### 🔴 Gate G2 — Apply migration 000046 (link_guest_orders RPC)

**Prerequisites:**
- [ ] RPC tested in staging Supabase project with synthetic data
- [ ] `guest_link_audit` table created (prerequisite schema)
- [ ] Rate limiting confirmed working (Test T-01 through T-08 all pass in staging)

**Approval required before:** Running migration in production.

---

### 🟠 Gate G3 — Code changes to `src/lib/orders.ts` and `AuthContext.tsx`

**Prerequisites:**
- [ ] G1 policy fixes applied and verified live (removes the data exposure)
- [ ] lookup_guest_order RPC available in production
- [ ] TypeScript typecheck passes
- [ ] All existing Vitest tests pass with proposed code changes

**Approval required before:** Committing and deploying code changes.

---

### 🟠 Gate G4 — Paymob Webhook Key Hardening (Code-02)

**Prerequisites:**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed set in Vercel environment
- [ ] Paymob sandbox test confirms webhook still updates order status correctly

**Approval required before:** Deploying webhook change.

---

### 🟡 Gate G5 — Regression Tests in Staging

**Prerequisites:**
- [ ] Staging Supabase project provisioned (separate from production)
- [ ] All 8 regression tests passing with proposed fixes applied
- [ ] All 8 regression tests failing in the expected way against unpatched policies
  (confirms tests correctly detect the vulnerabilities)

---

## Appendix — Unresolved Questions for Owner

1. **Are guest carts stored server-side intentionally?** If yes, the Fix F4 approach (localStorage
   only) requires a migration plan for existing cart rows.

2. **Is the `order_items USING(true)` policy in migration 000041 intentional?** The comment says
   "order ownership enforced by the orders trigger" but no such trigger was found.  Was this
   intended as a temporary debugging aid?

3. **Has the `SUPABASE_SERVICE_ROLE_KEY` been set in Vercel environment variables?**  If not, the
   Paymob webhook has never successfully updated order payment status post-payment.

4. **What is the current live Supabase subscription plan?**  Image Transformations require the Pro
   plan or above.  Confirmed from prior audit `02_FINAL_VERIFICATION.md`.

5. **Should guest return requests be accessible via the guest lookup flow?**  If yes, a server-side
   RPC similar to `lookup_guest_order` is needed for return requests.

---

_End of RLS Security Audit — no SQL applied, no production permissions changed._
_Recovery Lead · VB FITS STUDIOS · 2026-11-24_
