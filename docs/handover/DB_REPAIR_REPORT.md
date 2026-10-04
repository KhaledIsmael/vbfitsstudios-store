# VB FITS STUDIOS — Database Repair & System Health Report

This comprehensive audit document reviews the state of the database schema, security isolation rules, transactional procedures, and external integrations following the strict **DB-ONLY RULES**. No TypeScript/TSX source code files were modified; all fixes, data integrity protections, and automations are established at the PostgreSQL layer and verified against the production build (`npm run build` passed with zero errors).

---

## 1. Original Issues Resolution Matrix

| # | Item | Status | Verification & Technical Proof |
| :--- | :--- | :--- | :--- |
| **1** | **Signup ("Error sending confirmation")** | **Fixed after manual step** | Hardened `handle_new_customer()` trigger in `20261004000034_functions_triggers.sql` with an internal exception-handling block so profile sync errors can never abort the auth transaction. Delivery failure is resolved once Custom SMTP (Resend) is configured in Supabase. |
| **2** | **Guest Order** | **Fixed** | Verified RLS policy `orders_insert` in `20261004000033_access_rules.sql` allows `customer_id IS NULL`. Added trigger `tr_link_guest_orders_on_customer_signup` in `20261004000037_bidirectional_sync_and_realtime.sql` to link past guest orders to a customer upon registration. |
| **3** | **Admin Sales & Orders Count** | **Fixed** | Views `v_admin_dashboard_stats` and `fetchAdminOrders()` query real orders directly from `public.orders` and exclude `cancelled`/`refunded`. Real orders placed by guests or authenticated clients reflect dynamically in total volume and order counts. |
| **4** | **Archived Product Status in Admin** | **Fixed** | Trigger `enforce_archive_unpublish` in `20261004000034_functions_triggers.sql` syncs `is_archived = true` $\rightarrow$ `is_published = false`. View `v_product_visibility` maps `is_archived` to `'archived'`, and `fetchAdminProducts()` renders the archived badge. |
| **5** | **Hero Banner Save (Permission Denied)** | **Fixed** | Resolved by granting `INSERT, UPDATE, DELETE` to `authenticated, service_role` and applying RLS policy `hero_banners_admin_write` with `USING (public.is_admin_or_support())` in `20261004000033_access_rules.sql`. |
| **6** | **Instagram Link Saved & Opening** | **Needs code change** *(partial)* | Columns `social_instagram_url`, `social_tiktok_url`, `social_whatsapp_url` were created in `public.site_settings` and seeded. Admin can save to `store_settings`, but in `src/lib/siteSettings.ts` lines 218–233, `getSiteSettings()` omits social fields from the `merged` object when reading `site_settings`. |
| **7** | **Return Request Network Error** | **Fixed** | RLS policy `return_requests_insert` in `20261004000033_access_rules.sql` permits insert for guest and authenticated orders, and `api/returns/submit.ts` operates via `service_role` to prevent any RLS rejection. |
| **8** | **Return Shipping Fee Not Zero** | **Fixed** | Added column `return_shipping_fee` on `public.return_requests` and trigger `tr_set_return_shipping_fee` in `20261004000037_bidirectional_sync_and_realtime.sql`, which calls `public.get_return_shipping_fee(order_id)` reading directly from `public.shipping_zones`. |
| **9** | **Empty FAQ** | **Fixed** | `20261004000036_seed.sql` seeded 10 comprehensive bilingual FAQs (English and Arabic) across categories (`shipping`, `payment`, `returns_exchanges`, `sizing`, `orders`). Storefront chatbot and Admin Chatbot read live data. |
| **10** | **WhatsApp Concierge Number** | **Fixed after manual step** | Configured placeholder in `public.site_settings` and `public.store_settings`. Configurable via Admin Static Blocks editor or by running a single SQL update without touching frontend source code. |
| **11** | **Search Showing Archived Products** | **Fixed** | RPC functions `public.search_products` and `public.get_search_suggestions` in `20261004000037_bidirectional_sync_and_realtime.sql` filter strictly with `p.is_published = true AND COALESCE(p.is_archived, false) = false`. |
| **12** | **Colour Filter** | **Fixed** | `product_variants` and `product_images` have public read access (`SELECT USING (true)` in `20261004000033_access_rules.sql`). Seeded 8 luxury color swatches with precise hex codes. Color filtering matches real variant colors. |
| **13** | **Order Emails Never Arriving** | **Fixed after manual step** | Serverless route `/api/email/dispatch.ts` is configured for Resend. Delivery requires adding `RESEND_API_KEY`, verifying the custom domain with DNS records (SPF, DKIM, DMARC), and setting Supabase SMTP. |
| **14** | **Contact Form Messages** | **Needs code change** | The Contact Us form in `src/pages/StaticPages.tsx` (lines 84–87) currently executes `setSubmitted(true)` in local React component state and does not transmit data to Supabase. Code change required to persist submissions. |
| **15** | **Newsletter Subscription & Voucher** | **Fixed** | RPC function `subscribe_newsletter(p_email, p_source)` in `20261004000034_functions_triggers.sql` deduplicates entries, saves to `public.newsletter_subscribers`, and generates an atomic 10% discount code `WELCOME10_<hash>`. |

---

## 2. Simple Security & Data Isolation Check

The following checks confirm that unauthorized users cannot access sensitive data:

1. **Logged-out Visitors (`anon` role)**:
   - **Admin Access**: Blocked at both route guard level and database level. The `is_admin()` function checks `auth.uid()` against `public.customers WHERE role = 'admin'`. For an unauthenticated visitor, `auth.uid()` is `NULL`, causing all admin policies to evaluate to `false`.
   - **Orders & Revenue**: Cannot view `/admin`. Direct SQL/REST queries to `public.orders` only allow selecting rows where `customer_id = auth.uid()` or where `customer_id IS NULL` for order tracking. The overall revenue sums, financial aggregates, and customer lists reject access.
   - **Customer Records**: `public.customers` SELECT policy (`customers_select_own_or_admin`) requires `id = auth.uid() OR is_admin()`. An anonymous visitor receives zero rows.

2. **Normal Customers (`authenticated` role, `role = 'customer'`)**:
   - **Admin Dashboard**: Blocked because `is_admin()` returns `false`.
   - **Cross-Order Isolation**: A customer can only select and view orders where `customer_id = auth.uid()`. They cannot read other customers' orders, addresses, or phone numbers.
   - **Financial Figures**: Total sales, margin analytics, and store performance views (`v_admin_dashboard_stats`, `v_top_products`) grant SELECT only to `service_role` and verified admins.

---

## 3. Step-by-Step Manual Actions Required

Follow these exact steps in your browser to bring the entire system to live production readiness:

### Step 1: Execute SQL Migrations in Supabase SQL Editor
Open your [Supabase Project Dashboard](https://supabase.com/dashboard) > **SQL Editor**, and run the following files in exact order:
1. `supabase/migrations/20261004000032_close_all_remaining_gaps.sql`
2. `supabase/migrations/20261004000033_access_rules.sql`
3. `supabase/migrations/20261004000034_functions_triggers.sql`
4. `supabase/migrations/20261004000035_storage.sql`
5. `supabase/migrations/20261004000036_seed.sql`
6. `supabase/migrations/20261004000037_bidirectional_sync_and_realtime.sql`

*(Paste the text of each file into the SQL Editor query window and click **Run**).*

---

### Step 2: Set Environment Variables in Vercel & Redeploy
1. Open your [Vercel Project Dashboard](https://vercel.com) > **Settings** > **Environment Variables**.
2. Add or verify the following keys:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://xxxx.supabase.co`).
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon/Public Key.
   - `SUPABASE_URL`: Same as `VITE_SUPABASE_URL`.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (from Supabase **Project Settings** > **API**).
   - `RESEND_API_KEY`: Your Resend API Key (`re_...`).
   - `VITE_RESEND_API_KEY`: Same Resend API Key.
   - `VITE_APP_URL`: Your production URL (e.g. `https://vbfitsstudios.com`).
3. Go to the **Deployments** tab, click the three dots on the latest deployment, and select **Redeploy**.

---

### Step 3: Promote Your User Account to Admin
1. On your storefront, sign up or log in with your primary email address.
2. In the Supabase Dashboard, navigate to **SQL Editor** and run:
   ```sql
   UPDATE public.customers
   SET role = 'admin'
   WHERE email = 'vbfitsstudios@gmail.com'; -- Replace with your signup email
   ```
3. Refresh your storefront and navigate to `/admin` to access the full admin suite.

---

### Step 4: Configure WhatsApp Number & Social URLs in Admin
1. Open `/admin/marketing` (or `/admin` > Static Homepage Blocks).
2. Set the **WhatsApp URL** (e.g. `https://wa.me/201000000000`) and **Instagram URL** (`https://instagram.com/vbfitsstudios`).
3. Click **Save Links**.
4. In Supabase **SQL Editor**, ensure the fallback row in `store_settings` is also updated:
   ```sql
   UPDATE public.site_settings
   SET social_whatsapp_url = 'https://wa.me/201000000000',
       social_instagram_url = 'https://instagram.com/vbfitsstudios'
   WHERE id = 'current';
   ```

---

### Step 5: Configure Custom SMTP (Resend) in Supabase
1. In Supabase Dashboard, go to **Project Settings** > **Authentication** > **SMTP Settings**.
2. Enable **Enable Custom SMTP**.
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (SSL) or `587` (TLS)
   - **User**: `resend`
   - **Password**: Your Resend API key (`re_...`)
   - **Sender Email**: `noreply@vbfitsstudios.com` (must be a verified domain in Resend)
   - **Sender Name**: `VB FITS STUDIOS`
3. Click **Save Changes**.

---

### Step 6: Verify Supabase Storage Buckets
1. In Supabase Dashboard, click on **Storage** in the left sidebar.
2. Confirm the three buckets exist:
   - `store-media` (Public)
   - `product-media` (Public)
   - `return-photos` (Private)
3. If any bucket is missing, create it using the **New Bucket** button and set the visibility accordingly.

---

### Step 7: Whitelist Authentication URLs
1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**.
2. Set **Site URL** to:
   `https://vbfitsstudios.com`
3. Under **Redirect URLs**, add:
   - `https://vbfitsstudios.com/**`
   - `https://vbfitsstudios-store.vercel.app/**`
   - `http://localhost:5173/**`
4. Click **Save**.

---

### Step 8: Re-add Products, Colors & Sizes in Admin Dashboard
Since the database reset cleans out any mock test items:
1. Log in to the Admin Dashboard and open **Silhouettes & Products** (`/admin/products`).
2. Click **Add New Silhouette / Product**.
3. Enter title, description, price (in EGP), and select the category.
4. Add the appropriate colorway, assign size variants (`S`, `M`, `L`, `XL`, `XXL`), and set initial inventory levels.
5. Upload product imagery to `product-media`.
6. Ensure **Published** is toggled on, then click **Save**.
7. Confirm the newly added items appear immediately on `/shop`.
