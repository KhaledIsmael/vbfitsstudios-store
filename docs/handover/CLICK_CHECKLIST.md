# VB FITS STUDIOS — Storefront & Admin Verification Click Checklist

This checklist contains the exact manual clicks to perform on the live website and Admin Dashboard to confirm that data flows bidirectionally between the storefront, the database, and the admin panel without data loss.

---

## Flow 1: Order Creation, Sales, Shipping & Inventory Decrement

### Steps to Click:
1. **On the Storefront (`/shop`):**
   - Click on any product (e.g. *Archival Boxy Tee*).
   - Select a specific size (e.g. `M`) and click **Add to Cart**.
   - Go to `/checkout` (or open the Cart Drawer and click Checkout).
   - Fill in client shipping info (select Governorate: `Cairo` or `Giza`) and choose **Cash on Delivery (COD)**.
   - Click **Complete Acquisition**.
2. **What you should see:**
   - Redirect to `/order-confirmation/:id` displaying the generated order number (e.g. `VBF-XXXXX`), delivery destination, and COD breakdown.
3. **In Admin Dashboard (`/admin`):**
   - Open `/admin` (Overview).
   - **Total Sales**: Value increased immediately by the order total.
   - **New Orders / Orders Count**: Increased by 1.
   - Click **Client Orders** (`/admin/orders`):
     - The top row shows the new order with reference number, customer name, correct total in EGP, status `placed` or `confirmed`, and payment status `pending_collection`.
   - Click **Inventory Matrix** (`/admin/inventory`):
     - The variant for the purchased silhouette and size `M` has its unit count decremented by the purchased quantity.
   - Click **Private Clients** (`/admin/customers`):
     - If placed as an authenticated client, the customer record shows the updated lifetime spend and total order count.

---

## Flow 2: Product Archiving, Visibility & Search Exclusion

### Steps to Click:
1. **In Admin Dashboard (`/admin/products`):**
   - Find an active product (e.g., *Black Heavyweight Oversized Tee*).
   - Click the status toggle or edit button and toggle **Archive Product** (or set status to Archived).
   - Click **Save Changes**.
2. **What you should see in Admin:**
   - The product status badge changes to **Archived** (`is_archived = true`, `is_published = false`).
3. **On Storefront (`/shop`):**
   - Refresh `/shop`.
   - The archived product is completely removed from the catalog grid.
4. **In Search Bar (`/search` or Header Search Modal):**
   - Click the Search icon and type the exact name or color of the archived product.
   - **What you should see:** The search results return "No silhouettes found matching your query" and the suggestion pills strictly exclude the archived product.

---

## Flow 3: New Product with Image & Color Swatch Filter

### Steps to Click:
1. **In Admin Dashboard (`/admin/products`):**
   - Click **Add New Silhouette / Product**.
   - Enter Name (e.g., *Atelier Mockneck Fleece*), Price `2200`, Category `Outerwear`.
   - Add Variants: Color `Bone White` with Sizes `S, M, L`, Stock `10`.
   - Upload media or select an image asset.
   - Ensure **Published** is checked and click **Save**.
2. **On Storefront (`/shop`):**
   - Refresh `/shop`.
   - The newly created silhouette appears in the catalog grid with its image, title, and price.
3. **Color Filtering:**
   - In the filter bar, click the **Bone** or **White** color swatch (or filter `white`).
   - **What you should see:** The grid filters dynamically, showing only products with variants matching that color. Other colors are hidden.

---

## Flow 4: Hero Banners & Social Links Persistence

### Steps to Click:
1. **In Admin Dashboard (`/admin/marketing`):**
   - Click on the **Hero Showcase** tab.
   - Edit the headline (e.g. *Capsule 01 — Architectural Silhouette*) or sort order, and click **Save Hero Slides**.
   - Click on the **Homepage & Static Blocks** editor (`/admin/marketing` or Static Blocks editor).
   - Change the **Instagram URL** to `https://instagram.com/vbfitsstudios` and click **Save Links**.
2. **Test Persistence:**
   - Hard refresh the page (`Ctrl + F5` or `Cmd + Shift + R`).
   - Confirm the inputs in Admin still contain the edited text.
3. **On Storefront Homepage (`/`):**
   - Check the main Hero slider: The new headline is active.
   - Scroll to the Footer: Click the Instagram icon and confirm it links to the saved URL.

---

## Flow 5: Return / Exchange Request with Accurate Shipping Fee

### Steps to Click:
1. **On Storefront (`/returns` or `/orders/:id/track`):**
   - Enter an existing Order ID and email.
   - Select an item to return, choose reason: *Wrong size received*, select refund method *Vodafone Cash* or *Instapay*, and submit.
2. **In Database (`public.return_requests`):**
   - Open Supabase Table Editor > `return_requests`.
   - Locate the new row: `return_shipping_fee` is populated automatically from `shipping_zones` based on the order governorate (e.g., `65.00` EGP for Cairo, `85.00` EGP for Upper Egypt).
3. **In Admin Dashboard (`/admin/returns`):**
   - The return request appears in the **Pending Review** queue showing the customer name, order number, return reason, items, and refund amount.
   - Change status to **Approved** or **Collected** and click Save.

---

## Flow 6: Newsletter Subscribers & Audience Growth

### Steps to Click:
1. **On Storefront Footer (`/`):**
   - Scroll to the bottom footer newsletter form.
   - Enter a test email (e.g. `client.test@vbfits.com`) and click **Join / Subscribe**.
   - **What you should see:** Success confirmation message: *"Welcome to the VB Fits Studios private newsletter"*.
2. **In Admin Dashboard (`/admin/marketing`):**
   - Check the **VIP Atelier Community** newsletter card or export the subscriber list.
3. **In Database (`public.newsletter_subscribers`):**
   - Check table `public.newsletter_subscribers`: the email is recorded with `source: 'footer'`.
   - Check table `public.discount_codes`: a single-use code `WELCOME10_...` is generated for this email.

---

## Flow 7: FAQ & Concierge Chatbot Knowledge Sync

### Steps to Click:
1. **In Admin Dashboard (`/admin/chatbot`):**
   - Click **Add FAQ Entry**.
   - Question: *"What are the delivery transit times for Alexandria?"*
   - Answer: *"Express transit to Alexandria takes 2 to 3 business days via our private courier."*
   - Category: `shipping`, Language: `en`.
   - Click **Save FAQ**.
2. **On Storefront (`/`):**
   - Click the Floating Concierge Chatbot icon in the bottom-right corner.
   - Click the question prompt or type: *"delivery transit Alexandria"*.
   - **What you should see:** The concierge chatbot answers with the answer saved in Admin.
3. **In Admin Dashboard (`/admin/chatbot` > Chat Logs tab):**
   - Confirm the conversation log entry is recorded with the query and response.

---

## Code-Level Discrepancies & Suggested Minimal Fixes

During the database-level verification, two frontend code-level limitations were identified that cannot be fixed by SQL migrations alone:

### 1. Contact Form Client-Only State
- **File**: [`src/pages/StaticPages.tsx`](file:///d:/vbfitsstudois%20store/src/pages/StaticPages.tsx#L84-L87)
- **Issue**: The `handleSubmit` function only executes `setSubmitted(true)` in local React state. It does not insert the message into a database table or trigger an API route.
- **Smallest Suggested Fix**:
  ```tsx
  // in src/pages/StaticPages.tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('chatbot_logs').insert({
      user_message: `Contact Form [${formData.name} - ${formData.email}]: ${formData.message}`,
      bot_response: 'Transmitted to Atelier Concierge'
    });
    setSubmitted(true);
  };
  ```

### 2. Social URLs Partial Sync in `getSiteSettings()`
- **File**: [`src/lib/siteSettings.ts`](file:///d:/vbfitsstudois%20store/src/lib/siteSettings.ts#L218-L233)
- **Issue**: When `getSiteSettings()` reads from the `site_settings` table, the object mapping explicitly omits `social_instagram_url`, `social_tiktok_url`, and `social_whatsapp_url`, which can cause social links to revert to defaults upon page refresh if `store_settings` is bypassed.
- **Smallest Suggested Fix**:
  ```tsx
  // in src/lib/siteSettings.ts (line 218)
  const merged: SiteSettings = {
    ...DEFAULT_SITE_SETTINGS,
    ...data, // includes social_instagram_url, social_tiktok_url, social_whatsapp_url
    countdown_gate_enabled: gateEnabled,
    gate_enabled: gateEnabled,
    updated_at: data.updated_at
  };
  ```
