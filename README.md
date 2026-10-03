# VB FITS STUDIOS — Luxury Streetwear & Ready-to-Wear

An ultra-luxury, high-fashion editorial digital storefront inspired by contemporary ateliers (*Acne Studios*, *Fear of God*, *Represent*). Engineered for elite performance, accessibility, localization for the Egyptian and MENA market, and institutional-grade payment security.

Built with **React 19**, **TypeScript**, **Tailwind CSS**, **Vite**, **Supabase** (PostgreSQL 15 & Auth), and **Paymob Unified Checkout**.

---

## 🏛️ Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | High-performance component architecture with `React.lazy` code-splitting |
| **Styling & Design System** | Tailwind CSS + Vanilla CSS | Strict luxury typography, bespoke HSL palettes, and fluid micro-animations |
| **Build Engine** | Vite 8 + LightningCSS | Sub-second HMR, optimized Rollup chunking, and modern WebP image assets |
| **Database & Auth** | Supabase (PostgreSQL 15) | Row-Level Security (RLS), Auth Rate Limiting, Full-Text Search, and Storage |
| **Payment Gateway** | Paymob Hosted Unified Checkout | Meeza cards, Smart Wallets, ValU/Sympl, COD — **Zero raw card data in app (P2.3)** |
| **Email Infrastructure** | Brevo Transactional API | Automated transactional receipts and abandoned bag reminders |
| **End-to-End Testing** | Playwright Chromium | Automated smoke test validation against Staging Supabase project |
| **Deployment & Edge** | Vercel Serverless + CDN | Edge caching, security headers (CSP), and automated Git deployments |

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or higher (LTS recommended)
- **npm**: `v10.x` or higher
- **Git**: Installed and configured

### 2. Clone & Install
```bash
# Clone the repository
git clone https://github.com/your-username/vbfitsstudios-store.git
cd vbfitsstudios-store

# Install locked dependencies
npm install
```

### 3. Configure Local Environment
Copy the staging example environment file:
```bash
cp .env.staging.example .env.local
```
Fill in your local Supabase credentials (see [Environment Variables](#-environment-variables)).

### 4. Run Development Server
```bash
# Start Vite local development server (defaults to port 5173)
npm run dev

# Or start directly with Staging mode configurations
npm run dev:staging
```
Access the application at [http://localhost:5173](http://localhost:5173).

---

## 🔑 Environment Variables

The project uses distinct configuration profiles for **Local / Staging** and **Production**.

### Staging & Production Reference Table

| Variable | Scope | Required | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `VITE_APP_ENV` | Client | Yes | Active runtime environment name | `staging` or `production` |
| `VITE_SUPABASE_URL` | Client | Yes | Supabase Project REST Endpoint | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Client | Yes | Supabase Public Anonymous API Key | `eyJhbGciOiJIUzI1Ni...` |
| `VITE_APP_URL` | Client | Yes | Canonical base URL of the store | `https://vbfitsstudios.com` |
| `VITE_WHATSAPP_NUMBER` | Client | Optional | Customer concierge WhatsApp digits | `201000000000` |
| `SUPABASE_URL` | Serverless | Yes | Internal Supabase URL for API functions | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless | Yes | Supabase Service Role Key (**Strict Secret**) | `eyJhbGciOiJIUzI1Ni...` |
| `PAYMOB_API_KEY` | Serverless | Yes | Paymob Merchant Gateway Secret Key | `ZXlKaGJHY2lPaUpJVX...` |
| `PAYMOB_INTEGRATION_ID` | Serverless | Yes | Default Paymob Card Integration ID | `4829102` |
| `PAYMOB_HMAC_SECRET` | Serverless | Yes | Paymob Webhook HMAC SHA-512 Secret | `B81A3F...` |
| `BREVO_API_KEY` | Serverless | Optional | Brevo Transactional Email Secret | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Serverless | Optional | Verified sender email address | `orders@vbfitsstudios.com` |

> [!CAUTION]
> Never prefix sensitive credentials (`SUPABASE_SERVICE_ROLE_KEY`, `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`) with `VITE_`. Doing so exposes them to the client-side JavaScript bundle.

---

## 🗄️ Supabase Database Setup & Migrations

The database schema is structured into 19 sequential SQL migrations located in [`supabase/migrations/`](supabase/migrations/).

### Option A: Using the Supabase CLI (Recommended)
```bash
# 1. Login to Supabase CLI
npx supabase login

# 2. Link to your remote project (replace with your project ref)
npx supabase link --project-ref your-project-ref

# 3. Push all 19 migrations in sequential order
npx supabase db push
```

### Option B: Using the Supabase Dashboard SQL Editor
Navigate to **Supabase Dashboard → SQL Editor**, and execute the migration files sequentially:
1. `20260919000000_create_ecommerce_schema.sql` — Core tables (`products`, `variants`, `collections`, `orders`, `order_items`, `addresses`, `customers`).
2. `20260919000001_create_cart_items.sql` — Persistent client shopping bag sync.
3. `20260919000002_allow_placed_order_status.sql` — Order lifecycle status constraints.
4. `20260919000003_add_address_fields.sql` — Egyptian governorates, districts, and courier landmark fields.
5. `20260919000004_allow_guest_orders.sql` — RLS permissions for anonymous guest checkout.
6. `20260919000005_add_cod_payment_support.sql` — Cash on Delivery support with `pending_collection` state.
7. `20260919000006_tracking_and_returns.sql` — Live tracking and client self-serve return portal.
8. `20260919000007_add_customer_role.sql` — Role-based access control (`customer`, `admin`).
9. `20260919000008_product_editor_and_archive.sql` — Backoffice product catalog and archive management.
10. `20260919000009_inventory_and_restock_notifications.sql` — Stock tracking by size and alert queues.
11. `20260919000010_admin_orders_refunds.sql` — Financial transaction records and refund state machines.
12. `20260919000011_admin_customers_loyalty.sql` — VIP Private Client loyalty tiers.
13. `20260919000012_admin_phase4_complete.sql` — Advanced analytics aggregation functions.
14. `20260919000013_hero_banners.sql` — Dynamic homepage campaign banner editor.
15. `20260919000014_abandoned_cart_recovery.sql` — Automated recovery email scheduler.
16. `20260919000015_supabase_storage_setup.sql` — Public storage buckets (`product-images`, `lookbook-images`).
17. `20260919000016_postgres_trigram_search.sql` — PostgreSQL `pg_trgm` extension for typo-tolerant catalog search.
18. `20260919000017_rls_policies.sql` — Production Row-Level Security policies.
19. `20260919000018_create_restock_signups.sql` — Customer waitlist notifications for out-of-stock sizes.

### Seed Initial Archival Catalog
```bash
# Seed initial products and variants
npm run seed
```

---

## 🔒 Payment Security (P2.3 Compliance)

VB Fits Studios strictly complies with **PCI-DSS SAQ A** and project requirement **P2.3**:
- **Zero Raw Card Data**: Credit card numbers (PAN), CVVs, and expiration dates **never touch the application DOM, backend serverless functions, or Supabase database**.
- **Paymob Hosted Checkout**: The client checkout form initiates a payment intention server-side via [`api/paymob/create-payment.ts`](api/paymob/create-payment.ts) and securely redirects the user to Paymob's PCI-DSS Level 1 hosted payment gateway.
- **HMAC Verification**: Webhook callbacks in [`api/paymob/webhook.ts`](api/paymob/webhook.ts) are authenticated using Paymob HMAC SHA-512 cryptographic signatures before updating order status.

---

## 🧪 Smoke Testing & CI/CD Pipeline

The project includes an automated end-to-end Playwright smoke test suite in [`tests/checkout-smoke.spec.ts`](tests/checkout-smoke.spec.ts) verifying:
1. Product catalog navigation & Add to Shopping Bag.
2. Complete guest checkout delivery coordinates validation (Egyptian Governorates).
3. P2.3 Payment Security compliance (asserting absence of card inputs).
4. Supabase Auth Rate Limiting & exponential backoff UI.

```bash
# Run the Playwright smoke test suite locally
npm run test:smoke
```

### GitHub Actions Pre-Deploy Pipeline (`.github/workflows/deploy.yml`)
Before every deployment to production, the GitHub Actions workflow automatically executes:
1. **`tsc`**: Static TypeScript typecheck (`npx tsc --noEmit`).
2. **`vite build`**: Staging compilation (`npm run build:staging`).
3. **Playwright Chromium**: End-to-end checkout smoke test against the Staging Supabase project.
4. **Deploy**: Only triggers production deployment once all tests pass with 100% green status.

---

## ☁️ Connecting to Vercel (Free Tier)

### Step 1: Push Repository to GitHub
```bash
git add .
git commit -m "feat: complete luxury e-commerce platform with PRD Section 13 compliance"
git remote add origin https://github.com/<your-account>/<your-repo>.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Click **Add New... → Project** and select your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build` (or `npm run build:production`)
   - **Output Directory**: `dist`

### Step 3: Configure Production Environment Variables
In **Vercel Project Settings → Environment Variables**, add the following keys for the **Production** environment:
- `VITE_APP_ENV` = `production`
- `VITE_SUPABASE_URL` = `https://<your-prod-project>.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `<your-prod-anon-key>`
- `SUPABASE_URL` = `https://<your-prod-project>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `<your-prod-service-role-key>`
- `PAYMOB_API_KEY` = `<your-production-paymob-api-key>`
- `PAYMOB_INTEGRATION_ID` = `<your-production-card-integration-id>`
- `PAYMOB_HMAC_SECRET` = `<your-production-paymob-hmac-secret>`
- `BREVO_API_KEY` = `<your-production-brevo-key>`
- `BREVO_SENDER_EMAIL` = `orders@vbfitsstudios.com`

### Step 4: Verify Deployment Flow
- **Push to `main`**: Automatically triggers a Production Build & Deploy to your custom domain.
- **Pull Requests**: Automatically triggers an ephemeral **Preview Deployment** with isolated test environments.

---

## 📄 License & Attribution

Designed and developed for **VB Fits Studios**. All rights reserved © 2026.
