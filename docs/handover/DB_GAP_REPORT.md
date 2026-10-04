# DB Gap Report — VB Fits Studios
## STATUS: ALL SQL GAPS CLOSED

Migration `20261004000032_close_all_remaining_gaps.sql` was written on 2026-10-04
and closes all remaining gaps identified in the original report below.

---

## How to apply all migrations

1. Go to **Supabase Dashboard → SQL Editor**
2. Run each migration file **in filename order** (the timestamp prefix is the order):
   ```
   20260919000000  →  20261004000032
   ```
3. Each file is idempotent (uses `IF NOT EXISTS`, `DROP … IF EXISTS`, `ON CONFLICT`).
   Re-running a file does not break anything.
4. After the last file, run `00_inspect.sql` (in `docs/handover/sql/`) and paste
   the result back so the live schema can be verified.

### Admin user

After running migrations, create the admin user **manually** in the dashboard:
- **Dashboard → Authentication → Users → Invite user**
- Email: `admin@vbfitsstudios.com`
- Set a strong password
- Then in **SQL Editor** run:
  ```sql
  UPDATE public.customers
  SET role = 'admin'
  WHERE email = 'admin@vbfitsstudios.com';
  ```

### Dashboard settings (SQL cannot change these)

| Setting | Where | Value |
|---|---|---|
| Site URL | Auth → URL Configuration | Your Vercel URL |
| Redirect URLs | Auth → URL Configuration | `https://<your-domain>/**` |
| Confirm email | Auth → Settings | Disable for COD store, or enable |
| Email templates | Auth → Email Templates | Customise as needed |

---

## Decisions from §6 of original report

| ID | Decision made |
|---|---|
| D1 | **Option A** — Admin logs in on both `/login` (storefront) and `/admin/login`. The storefront client session carries the admin JWT and admin-only RLS passes. |
| D2 | **Option A (DB-only)** — `site_settings` is not exposed to `anon`. Storefront falls back to `store_settings['site_settings']` which already holds the admin-saved values. |
| D3 | Guest orders remain readable by anyone for tracking. Risk documented. |
| D4 | Server-side totals not implemented (name+size matching too fragile). Browser sends totals; risk is noted. Revisit if needed with a code change. |
| D5 | Return shipping fee fixed at EGP 0.00. Cannot be changed from DB. |

---

## Original gap report (for reference)

> [!NOTE]
> All items below have been addressed in migrations 000000–000032.

### 1. Tables and columns (all resolved)

| Table | Gap | Migration |
|---|---|---|
| `orders` | `discount_code`, `shipping_company`, `internal_notes`, `delivered_at`, `payment_method` missing; `status` and `payment_status` CHECK too narrow | 000032 |
| `product_images` | `media_type`, `video_poster_url` missing | 000032 |
| `return_requests` | `staff_notes`, `refund_amount`, `items`, `updated_at` missing | 000032 |
| `shipping_zones` | `shipping_fee`, `rate` alias columns missing | 000032 |
| `discount_codes` | CHECK rejects `'fixed'`; `min_spend`, `times_used`, `starts_at` missing | 000032 |
| `product_variants` | `low_stock_threshold` missing | 000032 |
| `chatbot_faqs` | `category` missing | 000032 |

### 2. Functions and triggers (all resolved)

| Object | Gap | Migration |
|---|---|---|
| `purge_all_test_data()` | Executable by `anon` | 000032 |
| `handle_new_customer` | Copies `role` from user metadata (self-promotion) | 000032 |
| `customers_update_own` | Allows role self-promotion | 000032 |
| Archive sync trigger | `is_archived=true` did not force `is_published=false` | 000032 |

### 3. Grants and RLS (all resolved)

| Table | Gap | Migration |
|---|---|---|
| `categories`, `hero_banners`, `chatbot_faqs/logs`, `newsletter_subscribers`, `discount_codes`, `return_requests`, `refunds`, `addresses`, `waitlist_signups`, `store_settings` | Missing GRANTs; missing or incorrect RLS policies | 000032 |
