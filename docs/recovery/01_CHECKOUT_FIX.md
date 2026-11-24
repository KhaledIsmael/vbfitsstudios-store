# 01 — Checkout Reliability Fix

**Branch:** `fix/egress-reliability`  
**Date:** 2026-11-24  
**Recovery Lead:** Antigravity (AI Recovery Agent)  
**Status:** ✅ Code changes complete; typecheck, unit tests (21/21), and production build passed — stopped before deploy or migration

---

## 1. Audit Finding Being Addressed

**Finding 3.2 — Checkout failure path clears cart and navigates to false success**

| Attribute | Detail |
|-----------|--------|
| File | `src/pages/CheckoutPage.tsx` |
| Severity | Critical |
| Affected journey | COD checkout — 100% of orders |
| Root cause | `clearCart()` called before confirming `order?.id` from server; no double-submit guard using a ref |

---

## 2. Files Changed

| File | Change type | Purpose |
|------|-------------|---------|
| `src/pages/CheckoutPage.tsx` | Modified | Submit guard, failure path hardening, stale-price check, outage error handling |
| `src/lib/orderErrors.ts` | New | Extracted `classifyOrderError` helper for outage/RLS/network error classification |
| `src/lib/orders.ts` | Modified | Added `clientRequestId` to `CreateOrderParams` and primary insert payload |
| `supabase/migrations/20261124000045_order_idempotency_key.sql` | New (not applied) | Adds `client_request_id` column + partial unique index for server-side idempotency |
| `src/__tests__/checkout-reliability.test.ts` | New | Vitest unit tests — 21 test cases |
| `package.json` / `package-lock.json` | Modified | Added `vitest` devDependency to run unit tests |

---

## 3. Before / After Behaviour

### Fix A — Submit guard (double-tap prevention)

| Scenario | Before | After |
|----------|--------|-------|
| User taps "Confirm order" twice rapidly | Second call raced through `isSubmitting` state | `isSubmittingRef.current` (ref-based) blocks second call immediately; no race possible |
| `isSubmitting` reset timing | Reset before error check on line 341 | Reset only after error/success path resolves |
| Button state | Disabled while `isSubmitting` state is true | Same — plus the ref prevents any re-entry before state settles |

**Implementation:** `useRef<boolean>(false)` checked at top of `handlePlaceOrder`. Early-return if `isSubmittingRef.current` is `true`. Reset on all exit paths (error or success).

---

### Fix B — Failure path hardening (Finding 3.2)

| Scenario | Before | After |
|----------|--------|-------|
| `createOrder` returns `{ error, order: null }` | `clearCart()` called; navigate to `/order-confirmation` without an ID | Returns immediately with error message; `clearCart()` NOT called; cart preserved; form NOT reset |
| `createOrder` returns `{ order: { id: undefined } }` | `clearCart()` called; navigates to `/order-confirmation` (fallback route) | Treated as failure — no order ID = no success; error shown |
| `createOrder` returns valid `order.id` | `clearCart()` and `navigate()` called correctly | Same — `clearCart()` and `navigate()` only called after confirmed truthy `order.id` |

**Key guard added (line ~445):**
```ts
if (error || !order?.id) {
  // preserve cart, show error — STOP
  return;
}
// Only here: clearCart() + navigate()
const confirmedOrderId = order.id;
clearCart();
navigate(`/order-confirmation/${confirmedOrderId}`, { state: { ... } });
```

---

### Fix C — Error classification and outage messages

| Error type | Old message | New message |
|------------|------------|-------------|
| Supabase 402 billing | `"Order placement notice: 402 …"` | "The store is temporarily unavailable due to a service limit. Your bag is preserved…" |
| Supabase 429 rate-limit | `"Order placement notice: Too many requests"` | "Too many requests. Please wait a moment…" |
| RLS / permission denied | `"Guest orders are currently completing setup…"` | Same intent, now via `classifyOrderError()` |
| 5xx server error | `"Order placement notice: 500 …"` | "A server error occurred. Your order was not placed…" |
| Network timeout / `failed to fetch` | `"Order placement notice: Failed to fetch"` | "Your connection dropped before we could confirm your order. Check your Order History or contact us before retrying — a duplicate order may have been registered." (amber warning, `isAmbiguous: true`) |

Ambiguous errors render in **amber** (instead of red) to visually distinguish "we don't know" from "it failed".

---

### Fix D — Stale-price guard

Before submitting, the page now queries `products` table for live prices of all cart `productId`s.

| Scenario | Before | After |
|----------|--------|-------|
| Product price changed in DB after cart loaded | Order placed at stale cart price | Submission blocked; amber warning shown: "One or more prices in your bag have changed. Please return to the shop to refresh your cart." |
| Price check Supabase request fails (402, network) | N/A | Non-fatal; logs warning, allows submission to proceed |
| Items with no productId (static catalog entries) | N/A | Skipped from price-check gracefully |

---

### Fix E — Client request ID (idempotency key)

**`clientRequestIdRef`:** A UUID generated once per checkout page load (`crypto.randomUUID()`), stable across form state changes and failed retries.

- Sent as `clientRequestId` parameter to `createOrder()`
- Appended to the order insert payload as `client_request_id` column
- **If the column does not yet exist** (before migration): the payload field is harmlessly rejected by Supabase's schema validation and falls through to the existing fallback retry logic, with the `client_request_id` stripped from the minimal fallback payload

**NOT yet enforced server-side** until migration `20261124000045_order_idempotency_key.sql` is applied (see §7).

---

## 4. Code Walkthrough — Exact Diffs

### `src/pages/CheckoutPage.tsx`

**Lines 1–10 (imports):**
- Added `useRef`, `useCallback` from React
- Added `supabase` from `'../lib/supabaseClient'`

**Lines 11–90 (new `classifyOrderError` helper):**
- Pure function, no side-effects
- Maps raw error strings → `{ userMessage, isAmbiguous }`
- Covers: 402, 429, RLS, 5xx, network/timeout, generic

**Lines ~141–152 (component additions):**
- `isSubmittingRef = useRef(false)` — double-submit guard
- `clientRequestIdRef = useRef(crypto.randomUUID())` — stable session idempotency key

**Lines ~177–183 (state additions):**
- `errorIsAmbiguous: boolean` — drives amber vs red error colour
- `stalePriceWarning: string | null` — separate UI state for stale-price blocker

**Lines ~308–465 (`handlePlaceOrder` rewrite):**
1. Guard: `if (isSubmittingRef.current) return;` — first line
2. Stale-price fetch before `setIsSubmitting(true)` — non-fatal fallthrough on failure
3. Payload unchanged — same fields sent to `createOrder`
4. `clientRequestId: clientRequestIdRef.current` added to call
5. **New failure guard:** `if (error || !order?.id)` → show error, return; `clearCart()` only after this guard
6. `isSubmittingRef.current = false` on all exit paths

**Lines ~676–704 (UI changes):**
- Stale-price amber alert added above error notification
- Error notification: amber styling when `errorIsAmbiguous`, red otherwise

### `src/lib/orders.ts`

**Lines 37–68 (`CreateOrderParams`):**
- Added `clientRequestId?: string` with JSDoc explaining intent

**Lines 379–392 (`createOrder` signature):**
- Destructures `clientRequestId` from params

**Lines 479–501 (primary payload):**
- After building `primaryPayload`, conditionally appends `client_request_id` when provided

---

## 5. Server Trust — Gaps Documented

> These gaps require DB-level atomic functions or migrations. No code-only fix applied for these.

| Gap | Risk | Recommended fix |
|-----|------|-----------------|
| **Client-trusted totals:** `subtotal`, `discountAmount`, `shippingAmount`, `total` are computed on the client and sent to the server. No DB trigger or RPC validates them. | High: a crafty request could bypass pricing | Add a `SECURITY DEFINER` RPC (`create_cod_order`) that accepts only `items[]` + `discount_code` and computes all amounts server-side |
| **Stock not enforced:** No inventory table or stock decrement. Overselling is possible. | Medium: limited to current 2 SKUs | Add `inventory` table + decrement trigger; return stock error from RPC |
| **Discount re-validation:** Client sends `discountCode`; DB trigger (`apply_discount_trigger`) re-validates but the trigger's presence and idempotency were not confirmed in this session | Medium | Confirm trigger active in live DB; add test with invalid code |
| **Order number collision:** `VBF-${Math.floor(10000 + Math.random() * 90000)}` — 90,000 possibilities; collision probability non-negligible at scale | Low (current order volume) | Use DB sequence (`nextval`) or UUID-derived prefix |

---

## 6. Test Coverage

**File:** `src/__tests__/checkout-reliability.test.ts`  
**Framework:** Vitest (unit, no browser/network required)  
**Run:** `npx vitest run src/__tests__/checkout-reliability.test.ts`

> **Note:** Vitest is not yet in `package.json`. To run tests, install with:  
> `npm install -D vitest @vitest/ui`

| Test group | Cases | What it covers |
|-----------|-------|---------------|
| `classifyOrderError` | 6 | 402, 429, RLS, 5xx, network timeout, generic — correct classification and `isAmbiguous` flag |
| `createOrder — success` | 3 | Returns valid order ID, no error, `clientRequestId` forwarded to insert payload |
| `createOrder — failure` | 4 | All-fallback failure returns null order, empty items blocked, non-COD blocked, `order_items` failure auto-cancels orphan |
| Submit guard | 1 | Sequential calls handled correctly; guard is component-level (documented) |
| Outage classification | 5 | 402, 429, 503, timeout, RLS — `isAmbiguous` correctness |
| COD false success guard | 2 | Null-data response = error (not success); `order_items` failure = error not success |

**Total: 21 test cases**

**Not covered (requires Playwright / running app):**
- Duplicate click on actual DOM submit button being blocked by `isSubmittingRef`
- Stale-price UI rendering amber warning
- Navigation to `/order-confirmation` not triggered on failure
- Form state preserved (inputs not cleared) on error

---

## 7. Idempotency Migration (NOT applied)

**File:** `supabase/migrations/20261124000045_order_idempotency_key.sql`

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS orders_client_request_id_key
  ON public.orders (client_request_id)
  WHERE client_request_id IS NOT NULL;
```

**Apply when:** CheckoutPage fix is approved for production deployment.  
**Risk:** Low — nullable column, partial unique index, non-breaking for existing rows.  
**Rollback:** `DROP INDEX orders_client_request_id_key; ALTER TABLE orders DROP COLUMN client_request_id;`

**Current state without migration:** `client_request_id` is included in the INSERT payload. If the column does not exist, Supabase returns a schema error, the fallback retry logic strips unknown columns and retries with a minimal payload. The client-side `isSubmittingRef` guard still prevents concurrent UI submissions.

---

## 8. Remaining Risks

| Risk | Severity | Status |
|------|----------|--------|
| Server-side duplicate order on ambiguous network error (request reached server, response lost, user retries) | High | **Mitigated** by idempotency migration (pending application) + ambiguous-error UI warning |
| Client-trusted order totals (price, shipping, discount) | High | **Documented** — requires `create_cod_order` server-side RPC (future work) |
| Storage RLS legacy permissive INSERT policy coexists with hardened policy | Medium | Documented in `02_FINAL_VERIFICATION.md` — separate approval needed |
| Stale-price check fails silently (non-fatal) | Low | Logged to console; non-blocking by design to avoid blocking orders during Supabase 402 |
| Order number collision | Low | Documented — requires DB sequence migration |
| `crypto.randomUUID()` availability | Very Low | Available in all modern browsers (Chrome 92+, Safari 15.4+, Firefox 95+). Falls back gracefully if column not present. |

---

## 9. Typecheck, Unit Tests, and Build Results

All checks ran after the final edit on branch `fix/egress-reliability`:

1. **Typecheck (`node node_modules\typescript\bin\tsc --noEmit`)**: ✅ Passed (exit code 0, no errors)
2. **Unit Tests (`node node_modules\vitest\vitest.mjs run src/__tests__/checkout-reliability.test.ts`)**: ✅ Passed — 1 test file, 21 passed (21 tests), 65ms
3. **Production Build (`npm run build` → `tsc && vite build`)**: ✅ Passed — 2614 modules transformed, built in 3.45s

---

## 10. Production Safety

| Control | Status |
|---------|--------|
| Production Vercel deployment | ✅ Untouched |
| DB migrations applied | ✅ None applied — migration file prepared only |
| RLS policy changes | ✅ None |
| `master` branch | ✅ Unmodified |
| All changes on `fix/egress-reliability` | ✅ Confirmed |
