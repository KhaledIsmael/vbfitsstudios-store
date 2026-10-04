# Access Rules — Deployment Notes
## VB Fits Studios

---

## How admin identity works (2-line summary)

Admin = `customers.role = 'admin'`, checked by the `is_admin()` function which is
`SECURITY DEFINER` and reads directly from the DB — a user cannot spoof it through
RLS or client-side code. Migration `000032` also blocks role self-promotion.

---

## How to apply the migrations

Go to **Supabase Dashboard → SQL Editor**. Run each file in order:

```
20261004000032_close_all_remaining_gaps.sql   ← run first
20261004000033_access_rules.sql               ← run second
```

Both files are safe to re-run (idempotent).

---

## Make YOUR account the admin

Replace `your@email.com` with your actual email, then run this in
**Supabase Dashboard → SQL Editor**:

```sql
-- Step 1: create the Supabase auth user (skip if you already did this in Dashboard > Auth > Users)
-- Do this in Dashboard > Authentication > Users > "Add user" instead.
-- Then run Step 2:

-- Step 2: promote to admin
UPDATE public.customers
SET role = 'admin'
WHERE email = 'your@email.com';

-- Confirm it worked:
SELECT id, email, role FROM public.customers WHERE email = 'your@email.com';
```

> [!IMPORTANT]
> You must create the auth user in **Dashboard → Authentication → Users → Add user**
> before running Step 2. The `UPDATE` targets the `customers` row that the
> `on_auth_user_created` trigger creates automatically when the auth user is made.

---

## Three things to click to confirm access control works

### ✅ Test 1 — Logged-out visitor cannot open the admin dashboard

1. Open a private/incognito window (no cookies, no session).
2. Go to `https://<your-domain>/admin`.
3. **Expected:** You are redirected to `/admin/login` and cannot see any data.
   The page shows only the login form.

---

### ✅ Test 2 — A normal customer cannot open the admin dashboard

1. Sign up or log in as a regular customer at `/login`.
2. In the same browser tab, go to `https://<your-domain>/admin`.
3. **Expected:** You are redirected to `/admin/login` or see an "Unauthorized" screen.
   No orders, products, or customer data is shown.
   *(The admin dashboard reads `customers.role` on load; it redirects if role ≠ admin.)*

---

### ✅ Test 3 — Your admin account can save a hero banner

1. Go to `/admin/login` and sign in with your admin email and password.
2. Navigate to **Admin → Hero Banners** (or the Content / Banners section).
3. Click **Add Banner**, fill in the fields, and click **Save**.
4. **Expected:** The banner appears in the list and is visible on the homepage `/`.

If step 3 fails with "permission denied", check:
- The `customers` row for your email has `role = 'admin'` (run the SELECT above).
- Migration `000033` ran successfully (check for errors in SQL Editor output).

---

## Storage buckets (not covered by SQL migrations)

The code uses two storage buckets: `product-media` and `store-media`.
If they do not exist, go to **Dashboard → Storage** and create them as **Public**.
Then add this upload policy for each bucket (Dashboard → Storage → Policies):

- **SELECT**: `true` (public read)
- **INSERT**: `(auth.uid() IS NOT NULL AND public.is_admin_or_support())`
