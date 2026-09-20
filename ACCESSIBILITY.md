# Accessibility Statement & Audit Report (WCAG 2.1 AA)

**Brand:** VB Fits Studios  
**Standard:** Web Content Accessibility Guidelines (WCAG) 2.1 Level AA  
**Status:** Compliant across all storefront routes and interactive dialogs  

---

## 1. Executive Summary

An accessibility audit was conducted across the entire VB Fits Studios application—evaluating screen reader compatibility, keyboard navigation, color contrast, semantic document structure, and focus management across all storefront pages and slide-over drawers.

All findings identified during the audit have been systematically resolved to guarantee a luxury, inclusive shopping experience for all clients.

---

## 2. Key Remediations & Implementations

### A. Visible Focus States
- **Custom Minimalist Focus Ring:** Implemented a global `:focus-visible` styling in `src/index.css` featuring a crisp 2px solid `#111111` ring with a 2px offset.
- **Dark Mode / Contrast Adaptations:** Elements placed on black or dark charcoal backgrounds (`bg-black`, `bg-[#111111]`, `bg-[#111114]`) receive a high-contrast `#FFFFFF` focus ring.
- **Mouse User Suppression:** Pointer interactions retain clean aesthetics via `:focus:not(:focus-visible) { outline: none; }` without disabling keyboard focus cues.

### B. Keyboard-Operable Drawers & Focus Trapping
Full ARIA dialog semantics and keyboard traps were implemented across all modal surfaces:
- **`CartDrawer`:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="cart-drawer-title"`, Tab/Shift+Tab focus trap cycling, Escape key to close, and background scroll lock.
- **`MenuDrawer`:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="menu-drawer-title"`, focus trap, Escape key listener, and descriptive external link announcements.
- **`SearchOverlay`:** `role="dialog"`, `aria-modal="true"`, `aria-label="Search catalog"`, focus trap, Escape key dismissal, and keyboard-selectable result cards (`role="button"`, `tabIndex={0}`, `Enter`/`Space` activation).
- **`FilterSortBar` (Mobile Drawer):** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="mobile-filters-title"`, `aria-expanded` toggles, focus trap, and Escape key dismissal.
- **`SizeGuideModal` & `RestockModal`:** `role="dialog"`, `aria-modal="true"`, accessible close buttons, Escape key handlers, and table `th[scope="col"]` / `th[scope="row"]` semantics.
- **`ImageLightbox`:** `role="dialog"`, `aria-modal="true"`, Escape key dismissal, and backdrop click handler.

### C. Icon-Only Buttons & Screen Reader Labels
All interactive buttons lacking visible text now possess unambiguous accessible names:
- **Header Navigation:**
  - Search trigger: `aria-label="Search Catalog"`
  - Account trigger: `aria-label="User Account (Signed in)"` / `"Sign In to Account"`
  - Shopping Bag trigger: `aria-label="Shopping Bag, N items"` with dynamic item count
  - Hamburger Menu: `aria-label="Open Navigation Menu"`
  - Inner icons marked `alt="" aria-hidden="true"` to prevent redundant screen reader announcements.
- **Product Cards & Galleries:**
  - Wishlist button: `aria-label="Save [Product Name] to Wishlist"` / `"Remove [Product Name] from Wishlist"`
  - Colorway swatches: `aria-label="View [Product Name] in [Color Name]"`
  - Size selection: `aria-label="Size [S/M/L]"` with out-of-stock indicators
  - Grid density toggle: `aria-label="2-column editorial view"` / `"4-column grid view"` with `aria-pressed` states.
- **Audio & Media:**
  - Atelier Audio Player: `aria-label="Expand Atelier Radio"`, `aria-label="Mute soundscape"`, `aria-label="Minimize audio player"`, and `aria-pressed` playback state.
  - Soundscape toggle in Announcement Bar: `aria-label="Play Atelier Soundscape"` / `"Pause Atelier Soundscape"`.

### D. Image Alternative Text
- **Product Images:** Primary and alternate product photography includes descriptive product names (e.g. `"VB Fits Studios Washed Black Long Sleeve"`).
- **Decorative Media:** Purely decorative icons, close glyphs, background gradients, and waveform animations use `alt=""` and `aria-hidden="true"`.
- **Hero Slider:** Hero slides render explicit `alt` descriptions with high-priority preloading on the active slide.

### E. Heading Hierarchy
Every storefront route establishes a single, logical `<h1>` followed by ordered sub-headings:
- **Landing Page (`/`):** `<h1>` in `HeroSlider` (`active.title`) + `<h2>` sections (`Featured Silhouettes`, `Vault Drop`, etc.).
- **Shop Page (`/shop`):** `<h1>Ready-to-Wear</h1>` + `<h2>` empty/status states.
- **Product Detail (`/product/:id`):** `<h1>{product.name}</h1>` + `<h2>` for curated recommendations.
- **Lookbook / Collections (`/collections`):** `<h1>VB Fits Studios — Lookbook &amp; Collections</h1>`.
- **About Atelier (`/about`):** `<h1>About VB Fits Studios</h1>`.
- **Contact Concierge (`/contact`):** `<h1>Contact Us</h1>`.
- **Legal Policies (`/policies/:type`):** `<h1>{policy.title}</h1>`.
- **Authenticity Registry (`/verify`):** `<h1>Garment Authenticity Verification</h1>`.
- **Checkout (`/checkout`):** `<h1>Finalize Acquisition</h1>` (or `<h1>Your Shopping Bag is Empty</h1>`).
- **Client Account (`/login`, `/register`, `/forgot-password`):** Dedicated `<h1>` titles for each auth view.

### F. High-Contrast Monochrome Palette
- **WCAG AA Ratio Compliance:** Standard text on white backgrounds requires a minimum contrast ratio of 4.5:1.
- **Global Typography Enhancement:** In `src/index.css`, utility classes targeting tertiary metadata grays (`#888888`, `#999999`, `#AAAAAA`) are remapped to `#666666` and `#707070`, boosting contrast from 3.54:1 to **5.74:1** against `#FFFFFF`.
- Primary black text (`#111111`) maintains a contrast ratio of **18.2:1**, well exceeding WCAG AAA standards.

### G. Form Association & Input Accessibility
- Form `<label>` tags across `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ContactPage`, `Footer` newsletter, and `FilterSortBar` are programmatically bound to their corresponding `<input>` and `<textarea>` elements via matching `htmlFor` and `id` attributes.
- Slider inputs include `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`.
- Skip to Main Content link added as the first focusable element on every page (`href="#main-content"`).

---

## 3. Remaining Known Issues & Third-Party Constraints

1. **Third-Party Payment Gateways (Paymob Hosted Checkout):**
   - When redirecting to external Paymob or ValU payment sessions, the iframe or external checkout page is rendered and hosted by Paymob. Accessibility compliance on those external payment forms is maintained by Paymob.
2. **Audio Waveform Visualizer (Web Audio API):**
   - The pulsing canvas waveform is purely aesthetic/ambient. It has been marked `aria-hidden="true"`, with assistive text providing equivalent state information via `aria-pressed` and audio control labels.
3. **Pulsing Tap-and-Hold Haptic Simulation on Mobile:**
   - On iOS Safari, the native Web Vibration API (`navigator.vibrate`) is restricted by WebKit security policies; on unsupported browsers, the interaction gracefully falls back to normal click-through navigation without haptic feedback.

---

## 4. Verification & Testing Procedure

To run automated checks locally or in CI/CD:

```bash
# 1. Verify TypeScript & Production Build
npm run build

# 2. Audit with Google Lighthouse CLI (requires lighthouse installed)
npx lighthouse-ci collect --url=http://localhost:5173

# 3. Audit using axe-core CLI
npx @axe-core/cli http://localhost:5173
```
