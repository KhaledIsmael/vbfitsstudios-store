# VB FITS STUDIOS — Production Email & Authentication Setup Guide

This guide details the complete configuration required to resolve signup confirmation errors, deliver auth verification emails, and ensure all transactional order/status notifications land directly in client inboxes rather than failing silently or landing in spam.

---

## 1. Why Emails Were Failing ("Error sending confirmation")

1. **Default Supabase Built-In Rate Limits**:
   - The default Supabase Auth email service (free shared SMTP) is strictly rate-limited to **3 emails per hour**.
   - When the limit is reached or when test signups trigger anti-abuse safeguards, Supabase Auth returns: `Error: Error sending confirmation email`.
2. **Missing Custom Domain Authentication (SPF, DKIM, DMARC)**:
   - When unauthenticated or unverified sender domains are used, mail transfer agents (Gmail, Outlook, Yahoo) reject incoming messages at the gateway level or drop them silently without even placing them into the Spam folder.
3. **Database Profile Trigger Failures**:
   - In Supabase, if the `on_auth_user_created` trigger executing `handle_new_customer()` throws an uncaught database error (e.g. missing column, null constraint violation), the entire `auth.users` transaction is rolled back and signup fails with a generic server error.
   - The trigger in `supabase/migrations/20261004000034_functions_triggers.sql` and `MASTER_DATABASE_RESET.sql` handles conflicts safely with `ON CONFLICT (id) DO UPDATE`.

---

## 2. Serverless API Email Routes & Required Environment Variables

The codebase uses two transactional email dispatch patterns:
1. **Resend Unified Gateway** (`/api/email/dispatch.ts`)
2. **Dedicated Email Endpoints** (`/api/email/send-confirmation.ts`, `/api/email/order-status.ts`, `/api/email/restock-notify.ts`, `/api/email/return-refunded.ts`)

### API Routes & Functionality

| API Route | Purpose | Service Provider |
| :--- | :--- | :--- |
| `/api/email/dispatch` | Unified transactional engine (Order Confirmations, Status Updates, Returns, Refunds, Admin Alerts) | Resend |
| `/api/email/send-confirmation` | Order acquisition notification sent right after checkout | Brevo / Resend |
| `/api/email/order-status` | Branded updates when order status changes (Shipped, Delivered, Out for delivery) | Brevo / Resend |
| `/api/email/return-refunded` | Customer alert when an exchange or refund is approved | Brevo / Resend |
| `/api/email/restock-notify` | Back-in-stock alerts for waitlisted pieces & sizes | Brevo / Resend |

### Environment Variables Needed in Production (Names Only)

Add these variable names in Vercel (**Settings** > **Environment Variables**):

```env
# Resend Configuration
RESEND_API_KEY
VITE_RESEND_API_KEY

# Brevo Configuration (if using Brevo endpoints)
BREVO_API_KEY
BREVO_SENDER_EMAIL

# Supabase Auth & Service Connection
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# App & Domain Settings
VITE_APP_URL
```

*(Never paste actual secrets into repository markdown or public code).*

---

## 3. Step-by-Step Configuration

### Step 1: Create Resend Account & Generate API Key
1. Navigate to [resend.com](https://resend.com) and create an account or sign in.
2. In the left navigation sidebar, click on **API Keys**.
3. Click the **Create API Key** button.
4. Set **Name** to `vbfits-production`.
5. Set **Permission** to `Full access`.
6. Click **Add**.
7. Copy the key immediately (starts with `re_...`) and store it securely.

---

### Step 2: Add and Verify Your Domain in Resend
1. In the Resend left sidebar, click on **Domains**.
2. Click **Add Domain**.
3. Enter your domain: `vbfitsstudios.com` (or your active primary domain).
4. Select your preferred region (e.g. `eu-west-1` / Frankfurt or `us-east-1`).
5. Click **Add**.
6. Resend displays the DNS records you must add to your DNS provider (Cloudflare, Namecheap, GoDaddy, or Vercel DNS):
   - **DKIM (CNAME or TXT)**: Verifies domain cryptographic ownership.
   - **SPF (TXT)**: Authorizes Resend servers to send on behalf of your domain.
   - **DMARC (TXT)**: Defines policy for email delivery validation (`v=DMARC1; p=none;`).
   - **MX (if using receiving)**: For inbound mail routing.
7. Add the exact records into your DNS management dashboard.
8. Back in Resend, click **Verify DNS Records** until domain status shows **Verified** (green checkmark).

---

### Step 3: Configure Supabase Auth SMTP with Resend
To route all Auth emails (Signup Confirmation, Password Reset, Magic Link) through Resend:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. In the left sidebar, click on the **Project Settings** (gear icon at the bottom).
4. Under the **Authentication** section, click on **SMTP Settings** (or navigate to **Authentication** > **Providers** > **Email** > **SMTP Settings**).
5. Toggle **Enable Custom SMTP** to **ON**.
6. Fill in the Resend SMTP credentials:
   - **Sender email**: `noreply@vbfitsstudios.com` (must match your verified domain in Resend).
   - **Sender name**: `VB FITS STUDIOS`.
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (with SSL/TLS) or `587` (with STARTTLS).
   - **Minimum TLS Version**: `TLSv1.2`.
   - **User**: `resend`
   - **Password**: Your Resend API Key (`re_...`).
7. Click **Save Changes**.

---

### Step 4: Configure Site URL and Redirect URLs in Supabase
This prevents the `Invalid redirect URL` error during email verification clicks:

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**.
2. Set **Site URL** to your canonical production URL:
   - `https://vbfitsstudios.com` (or your active Vercel production domain).
3. Under **Redirect URLs**, click **Add URL** and add the following allowed callback patterns:
   - `https://vbfitsstudios.com/**`
   - `https://vbfitsstudios-store.vercel.app/**`
   - `http://localhost:5173/**` (for local development testing)
4. Click **Save**.

---

### Step 5: Configure Supabase Email Templates
1. In Supabase Dashboard, navigate to **Authentication** > **Email Templates**.
2. Click on **Confirm signup**.
3. Verify that the **Subject** is branded:
   - `VB FITS STUDIOS — Confirm Your Atelier Account`
4. In the template body, confirm the confirmation link points to:
   ```html
   <h2>Welcome to VB FITS STUDIOS</h2>
   <p>Follow this link to verify your private client account:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm My Account</a></p>
   ```
5. Click **Save Changes**.

---

### Step 6: Add Environment Variables in Vercel & Redeploy
1. Open your [Vercel Dashboard](https://vercel.com).
2. Click on your project (`vbfitsstudios-store`).
3. Click on **Settings** tab at the top.
4. Select **Environment Variables** in the left sidebar.
5. Add each of the required keys:
   - `RESEND_API_KEY`: *(Your key from Step 1)*
   - `VITE_RESEND_API_KEY`: *(Same key)*
   - `SUPABASE_SERVICE_ROLE_KEY`: *(From Supabase Project Settings > API > service_role)*
   - `SUPABASE_URL`: `https://[your-project-ref].supabase.co`
   - `VITE_SUPABASE_URL`: `https://[your-project-ref].supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: *(From Supabase Project Settings > API > anon/public)*
   - `VITE_APP_URL`: `https://vbfitsstudios.com`
6. Select environments: Check **Production**, **Preview**, and **Development**.
7. Click **Save**.
8. Go to **Deployments** tab and click **Redeploy** on the latest deployment to make the variables take effect.

---

## 4. Verification & Testing Checklist

Once steps 1 through 6 are completed, perform this live verification:

- [ ] **Test 1: Client Signup Confirmation**
  1. Open an incognito browser window and navigate to the signup page.
  2. Create a new test account using a real personal email address (e.g. Gmail/Outlook).
  3. Verify that the UI displays the confirmation notification without throwing `Error sending confirmation`.
  4. Check your inbox: email must arrive within 10–30 seconds.
  5. Check Resend Dashboard > **Emails**: confirm status is `Delivered`.
  6. Click the link in the email and ensure it redirects seamlessly to the storefront account page.

- [ ] **Test 2: Supabase Profile Record Creation**
  1. Open Supabase Dashboard > **Table Editor** > `public.customers`.
  2. Confirm that a new row exists matching the newly registered user ID and email.

- [ ] **Test 3: Resend Code / Password Reset**
  1. Go to forgot password / reset password.
  2. Request a password reset link.
  3. Verify email receipt and link redirection.

- [ ] **Test 4: Order Confirmation Email**
  1. Place a test order (using COD or test payment).
  2. Confirm the transactional confirmation email arrives with order number, line items, and shipping address.
  3. In Supabase Dashboard, check the `public.email_logs` table (if enabled) to ensure the dispatch event is logged as `sent`.

- [ ] **Test 5: Newsletter Subscription**
  1. Submit the footer newsletter form.
  2. Verify subscriber entry in `public.newsletter_subscribers`.
