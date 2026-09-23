# UI/UX Reference Specification: Sorvea Storefront Architecture

> **Type**: Architecture & Design System Reference Specification  
> **Target Reference**: Modern Minimalist High-End Fashion Storefront (`sorveaclo.com/en`)  
> **Evaluation Viewports**: 1920px (Desktop Large), 1440px (Desktop Standard), 430px (Mobile Standard/Pro Max), 390px (Mobile Compact)  
> **Analysis Methodology**: HTTP asset inspection, token extraction, stylesheet disassembly, and DOM hierarchy analysis.  
> **Status**: Read-only extraction. No proprietary brand assets, logos, copy, or source files copied. All metrics categorized as `[MEASURED]` or `[ESTIMATED]`.

---

## 1. Global Design Tokens & Foundation

### 1.1 Typography Tokens
- **Base Font Family**: `Helvetica, Arial, sans-serif` `[MEASURED]`
- **Headline Font Family**: `Helvetica, Arial, sans-serif` `[MEASURED]`
- **Button Font Family**: `Helvetica, Arial, sans-serif` `[MEASURED]`
- **Price Font Family**: `Helvetica, Arial, sans-serif` `[MEASURED]`
- **Text Transform**: `uppercase` for navigation, headlines, buttons, and prices `[MEASURED]`
- **Letter Spacing**:
  - Global base: `-0.5px` `[MEASURED]`
  - Headline: `-0.5px` `[MEASURED]`
  - Navigation: `-0.5px` `[MEASURED]`
  - Buttons: `-0.5px` (CTA banner buttons: `1px`) `[MEASURED]`
  - Prices: `-0.5px` `[MEASURED]`
  - RTL scripts: `normal` (reset via `html[dir="rtl"]`) `[MEASURED]`
- **Type Scale**:
  - Desktop (≥ 1200px / 1440px / 1920px):
    - Base body size: `12px` `[MEASURED]`
    - Navigation size: `13px` `[MEASURED]`
    - Headline size: `16px` (scaled up by element multipliers) `[MEASURED]`
    - Button size: `13px` `[MEASURED]`
  - Mobile (< 900px / 430px / 390px):
    - Base body size: `12px` `[MEASURED]`
    - Navigation size: `12px` `[MEASURED]`
    - Headline size: `14px` `[MEASURED]`
    - Button size: `12px` `[MEASURED]`

### 1.2 Color & Contrast Palette
- **Background**: `#ffffff` (RGB: `255, 255, 255`) `[MEASURED]`
- **Primary Text**: `#2d2d2d` (RGB: `45, 45, 45`) `[MEASURED]`
- **Muted / Secondary Text**: `#6b6b6b` / `#8e8e8e` `[MEASURED]`
- **Inactive / Placeholder Text**: `#adadad` `[MEASURED]`
- **Borders & Dividers**: `#dddddd` / `#d6d6d6` / `#e0dedb` `[MEASURED]`
- **Primary Button Background**: `#4d4d4d` (Hover: `#000000`) `[MEASURED]`
- **Primary Button Text**: `#ffffff` (Hover: `#ececec`) `[MEASURED]`
- **Secondary Button Background**: `#ffffff` (Hover: `#2d2d2d`) `[MEASURED]`
- **Secondary Button Border**: `#dddddd` `[MEASURED]`
- **Secondary Button Text**: `#2d2d2d` (Hover: `#ffffff`) `[MEASURED]`
- **Sale / Accent Color**: `#c60c0c` `[MEASURED]`
- **Badges**:
  - "New" Badge: Background `#e4e4e4`, Text `#212121` `[MEASURED]`
  - "Restock" Badge: Background `#cdcccc`, Text `#ffffff` `[MEASURED]`
  - Sale Badge: Background `#c60c0c`, Text `#ffffff` `[MEASURED]`
- **Overlay Scrim**: `#00000080` (RGBA: `0, 0, 0, 0.5`) with blur `[MEASURED]`

### 1.3 Layout Units & Geometry
- **Base Grid Unit (`--gap`)**: `8px` `[MEASURED]`
- **Grid Gap Desktop**: `16px` (`--grid-gap: 16px`) `[MEASURED]`
- **Border Radius Global**: `0px` (`--border-radius: 0px`) `[MEASURED]`
- **Border Radius Button**: `0px` (`--border-radius-button: 0px`) `[MEASURED]`
- **Site Maximum Width**: `1900px` (`--site-max-width: 1900px`) `[MEASURED]`
- **Navbar Reference Height**: `48px` (`--navbar-height: 48px`) `[MEASURED]`

---

## 2. Header & Navigation Architecture

### 2.1 Height & Padding Across Viewports
- **1920px (Desktop Large)**:
  - Header Height: `124px` natural flow `[MEASURED]`
  - Body Padding: Top `22px` (`calc(var(--gap) * 2.75)`), Bottom `22px`, Horizontal `32px` (`calc(var(--gap) * 4)`) `[MEASURED]`
  - Max Width: `1900px` centered `[MEASURED]`
- **1440px (Desktop Standard)**:
  - Header Height: `124px` natural flow `[MEASURED]`
  - Body Padding: Top `22px`, Bottom `22px`, Horizontal `32px` `[MEASURED]`
- **430px (Mobile Standard/Pro Max)**:
  - Header Height: `77px` natural flow `[MEASURED]`
  - Body Padding: Top `14px` (`calc(var(--gap) * 1.75)`), Bottom `14px`, Horizontal `16px` (`calc(var(--gap) * 2)`) `[MEASURED]`
- **390px (Mobile Compact)**:
  - Header Height: `77px` natural flow `[MEASURED]`
  - Body Padding: Top `14px`, Bottom `14px`, Horizontal `16px` `[MEASURED]`

### 2.2 Scroll & Sticky Dynamics
- **Detection Architecture**:
  - Sentinel element: `.sticky-header__threshold` monitored via `IntersectionObserver` `[MEASURED]`
  - `rootMargin`: `-100px 0px 0px 0px` (or `-160px` in `isStickyAlways` mode) `[MEASURED]`
  - Root class toggle: `document.body.classList.add("page-header-sticky")` `[MEASURED]`
- **Scroll Directional Behavior**:
  - Downward Scroll (`currentScrollPos > prevScrollpos`): Header translates out of view (`sticky-show` removed, `transform: translateY(-100%)` or `display: none` / slide up) `[MEASURED]`
  - Upward Scroll (`prevScrollpos > currentScrollPos`): Header smoothly slides down and docks at `top: 0` (`sticky-show` added, `sticky-enabled` active) `[MEASURED]`
  - Natural Height Capture: System writes `--header-natural-height` as an inline CSS variable to `document.documentElement` dynamically before activating sticky mode `[MEASURED]`
- **Section Overlap Suppression**:
  - Header listens to `data-hide-over-selector=".collection__grid"` to dynamically hide sticky header over critical product selection screens `[MEASURED]`
- **Transparent Hero Overlap**:
  - Over hero banner, header receives `.wt-header--transparent` `[MEASURED]`
  - Hero banner container receives programmatic negative top margin: `marginTop = -(${headerHeight}px + ${announcementHeight}px)` `[MEASURED]`
  - Background is `transparent`, border is `0`, and text/icon colors inherit `--color-transparent-header` (`#ffffff`) `[MEASURED]`

### 2.3 Announcement Bar (Optional Header Feature)
- **Animation**: Continuous horizontal ticker marquee `[MEASURED]`
- **Transition Duration Token**: `--duration-announcement-bar: 250ms` `[MEASURED]`
- **Marquee Gap (`--mgap`)**: `50px` on mobile, `75px` on desktop `[MEASURED]`

---

## 3. Brand Representation & Logo Swap Dynamics

### 3.1 Sizing Across Breakpoints
- **Desktop (1920px & 1440px)**:
  - Logo Width: `130px` (`--logo-width-desk: 130px`) `[MEASURED]`
  - Max Height Constraint: `96px` (`calc(var(--gap) * 12)`) `[MEASURED]`
  - Rendered Height: `~80px` based on 3412:2099 aspect ratio `[MEASURED]`
- **Mobile (430px & 390px)**:
  - Logo Width: `80px` (`--logo-width: 80px`) `[MEASURED]`
  - Max Height Constraint: `72px` (`calc(var(--gap) * 9)`) `[MEASURED]`
  - Rendered Height: `~49.2px` `[MEASURED]`

### 3.2 Swap & Visibility Logic
- **Hero Transparent State**:
  - Activated class on header: `.wt-header--transparent.wt-header--transparent-logo` `[MEASURED]`
  - Standard dark logo element: `display: none` `[MEASURED]`
  - High-contrast white logo element (`.wt-header__logo__img--transparent`): `display: block` `[MEASURED]`
- **Scrolled / Solid State**:
  - When header leaves hero intersection threshold: `.wt-header--transparent` removed `[MEASURED]`
  - White logo element: `display: none` `[MEASURED]`
  - Standard dark logo element (`.wt-header__logo__img`): `display: block` `[MEASURED]`
- **Mobile vs Desktop Asset Resolution**:
  - Responsive image element (`.wt-header__logo__img--mobile` vs `.wt-header__logo__img`) toggled via media query (`min-width: 900px`) `[MEASURED]`
- **Transitions**:
  - Opacity and color transitions: `opacity 0.3s ease, color 0.3s ease, background 0.3s ease` `[MEASURED]`

---

## 4. Off-Canvas Drawers & Modal Overlays

### 4.1 Cart Drawer (`<cart-drawer>`)
- **Width**:
  - Desktop (1920px & 1440px): `max-width: 50rem` (500px, expandable to `60rem` / 600px) `[MEASURED]`
  - Mobile (430px & 390px): `width: 100%`, `max-width: 100%` `[MEASURED]`
- **Position & Stacking**:
  - `position: fixed; top: 0; right: 0; height: 100%; z-index: 50; display: flex; flex-direction: column` `[MEASURED]`
  - RTL support: `left: 0; right: auto; transform: translate(-100%)` `[MEASURED]`
- **Resting & Open Transforms**:
  - Resting (Closed): `transform: translate(100%)` `[MEASURED]`
  - Active (Open): `transform: translateY(0)` / `translate(0)` (`.wt-cart__drawer--open` or `[open]`) `[MEASURED]`
- **Animation Timing**:
  - Duration: `300ms` (`0.3s`) `[MEASURED]`
  - Easing Curve: `cubic-bezier(0.12, 0.67, 0.53, 1)` `[MEASURED]`
  - Property: `transform 0.3s cubic-bezier(0.12, 0.67, 0.53, 1), opacity 0.3s cubic-bezier(0.12, 0.67, 0.53, 1)` `[MEASURED]`

### 4.2 Menu Drawer (`#wt-drawer-nav`)
- **Orientation & Slide Motion**:
  - Full-width top-down panel anchored below or under header `[MEASURED]`
  - Resting: `transform: translateY(-100%); position: relative; z-index: 10;` `[MEASURED]`
  - Active: `transform: translateY(0)` (`.wt-drawer--nav-show`) `[MEASURED]`
- **Animation Timing**:
  - Duration: `300ms` (`0.3s`) `[MEASURED]`
  - Easing Curve: `ease` `[MEASURED]`
  - Z-Index Delay on close: `z-index 0s 0.4s` to maintain stacking during slide-up `[MEASURED]`

### 4.3 Scrim & Backdrop Overlay (`.page-overlay-cart`, `.page-overlay`)
- **Color & Opacity**:
  - Background: `#00000080` (50% solid black) `[MEASURED]`
- **Backdrop Blur**:
  - `-webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);` `[MEASURED]`
- **Animation & Stacking**:
  - Inactive: `opacity: 0; transform: scale(0); pointer-events: none;` `[MEASURED]`
  - Active: `opacity: 1; transform: scale(1); pointer-events: auto;` `[MEASURED]`
  - Timing: `opacity 0.3s ease-in-out` `[MEASURED]`
  - Stacking Context: `z-index: 49` (immediately under drawer at `z-index: 50`) `[MEASURED]`
- **Body Scroll Lock**:
  - Body class: `.page-overlay-cart-on` / `.page-overlay-on` `[MEASURED]`
  - Rules: `overflow: hidden; touch-action: none; height: 100%;` `[MEASURED]`

---

## 5. Hero Banner Section

### 5.1 Height & Aspect Behavior
- **Desktop (1920px & 1440px)**:
  - Height: `860px` (`--section-height-desk: 860px`) `[MEASURED]`
  - Media Orientation: Landscape banner image asset (`4205 × 2803px`, aspect ratio ~1.5:1), `object-fit: cover` `[MEASURED]`
- **Mobile (430px & 390px)**:
  - Height: `680px` (`--section-height: 680px`) `[MEASURED]`
  - Media Orientation: Dedicated portrait image asset (`2803 × 4205px`, aspect ratio ~0.67:1), `object-fit: cover` `[MEASURED]`

### 5.2 Title & Headline Typography
- **Font Stack**: `Helvetica, Arial, sans-serif` `[MEASURED]`
- **Font Weight**: `700` `[MEASURED]`
- **Text Transform**: `uppercase` `[MEASURED]`
- **Letter Spacing**: `-0.5px` `[MEASURED]`
- **Line Height**: `1.2` `[MEASURED]`
- **Desktop Typography (1920px & 1440px)**:
  - Base Headline Size: `16px` `[MEASURED]`
  - Section Headline Scale: `1.8` (`--font-headline-scale-desk: 1.8`) `[MEASURED]`
  - Calculated Size: `min(16px * 1.8, 16px + 8vw) = 28.8px` (~29px) `[MEASURED]`
- **Mobile Typography (430px & 390px)**:
  - Base Headline Size: `14px` `[MEASURED]`
  - Section Headline Scale: `1.3` (`--font-headline-scale: 1.3`) `[MEASURED]`
  - Calculated Size: `14px * 1.3 = 18.2px` (~18px) `[MEASURED]`
- **Overlay Positioning**:
  - Alignment: Bottom center (`hero__overlay--center hero__overlay--bottom`) `[MEASURED]`
  - Title margin-bottom: `calc(var(--gap) * 1) = 8px` `[MEASURED]`

---

## 6. Product Grid System & Collection Layout

### 6.1 Column Configuration & Gaps Per Breakpoint
| Breakpoint / Width | Columns (`--cols`) | Row Gap | Column Gap | Bottom Margin Per Item |
| :--- | :--- | :--- | :--- | :--- |
| **1920px (Desktop Large)** | `4` (or `3` with `data-cols-desktop="3"`) `[MEASURED]` | `16px` (`--grid-gap`) `[MEASURED]` | `16px` (`--grid-gap`) `[MEASURED]` | `40px` (`calc(var(--gap) * 5)`) `[MEASURED]` |
| **1440px (Desktop Standard)** | `4` (or `3` with `data-cols-desktop="3"`) `[MEASURED]` | `16px` (`--grid-gap`) `[MEASURED]` | `16px` (`--grid-gap`) `[MEASURED]` | `40px` (`calc(var(--gap) * 5)`) `[MEASURED]` |
| **430px (Mobile Standard)** | `2` (toggleable to `1`) `[MEASURED]` | `8px` (`calc(var(--gap) * 1)`) `[MEASURED]` | `16px` (`calc(var(--gap) * 2)`) `[MEASURED]` | `24px` (`calc(var(--gap) * 3)`) `[MEASURED]` |
| **390px (Mobile Compact)** | `2` (toggleable to `1`) `[MEASURED]` | `8px` (`calc(var(--gap) * 1)`) `[MEASURED]` | `16px` (`calc(var(--gap) * 2)`) `[MEASURED]` | `24px` (`calc(var(--gap) * 3)`) `[MEASURED]` |

### 6.2 Responsive Media Queries & Sticky Filter Toolbar
- `@media (max-width: 599px)`: Base mobile, `--cols: 2` (or 1) `[MEASURED]`
- `@media (min-width: 600px)`: Tablet portrait, `--cols: 2` `[MEASURED]`
- `@media (min-width: 900px)`: Tablet landscape / small desktop, `--cols: 3`, gap switches from 8px/16px to unified `16px` `[MEASURED]`
- `@media (min-width: 1200px)`: Desktop wide, `--cols: 4; margin-top: calc(var(--gap) * 1)` `[MEASURED]`
- **Collection Sticky Toolbar (`.collection__toolbar`)**:
  - Docks at `top: 0` (`position: sticky; z-index: 10; background-color: var(--color-background);`) `[MEASURED]`
  - Top border: `1px solid var(--color-border)` (`#dddddd`) `[MEASURED]`
  - Padding: `8px 0` `[MEASURED]`
  - Controls: Filter trigger button, Sort dropdown, and Column switch button `[MEASURED]`

---

## 7. Product Card Anatomy & Micro-Interactions

### 7.1 Image Container & Aspect Ratio
- **Portrait Aspect Ratio**: `0.6666666666666666` (exact `2:3` ratio, `--aspect-ratio-portait: 0.67`) `[MEASURED]`
- **Container Overflow**: `overflow: hidden; position: relative;` `[MEASURED]`
- **Image Fit**: `object-fit: cover; width: 100%; height: 100%; display: block;` `[MEASURED]`

### 7.2 Title & Price Typography & Spacing
- **Product Title**:
  - Font: `Helvetica, Arial, sans-serif` `[MEASURED]`
  - Weight: `700` (`--font-base-weight`) `[MEASURED]`
  - Text Transform: `uppercase` `[MEASURED]`
  - Letter Spacing: `-0.5px` `[MEASURED]`
  - Line Height: `1.4` `[MEASURED]`
  - Size: `12px` (mobile & desktop base with `--card-title-font-scale: 100`) `[MEASURED]`
  - Margin Top: `16px` (`calc(var(--gap) * 2)`) `[MEASURED]`
  - Margin Bottom: `0px` `[MEASURED]`
- **Product Price**:
  - Font: `Helvetica, Arial, sans-serif` `[MEASURED]`
  - Weight: `400` (`--font-price-weight`) `[MEASURED]`
  - Text Transform: `uppercase` `[MEASURED]`
  - Letter Spacing: `-0.5px` `[MEASURED]`
  - Size: `12px` mobile, `13px` desktop (scaled via `--card-price-font-scale: 100`) `[MEASURED]`
  - Margin Top: `4px` (`calc(var(--gap) * 0.5)`) `[MEASURED]`
  - Margin Bottom: `4px` (`calc(var(--gap) * 0.5)`) `[MEASURED]`
  - Discount / Strikethrough Price: `opacity: 0.5; text-decoration: line-through; margin-right: 8px; color: var(--color-sale-price);` `[MEASURED]`

### 7.3 Hover & Interaction Behavior
- **Image Scale Transform**:
  - Scale Factor: `1.05` (`--onhover-picture-scale: 1.05`) `[MEASURED]`
  - Duration: `1.5s` (`--onhover-picture-duration: 1.5s`) `[MEASURED]`
  - Timing Function: `ease-out` `[ESTIMATED]`
- **Secondary Image Crossfade**:
  - Secondary image sits absolutely positioned over primary image with `opacity: 0; transition: opacity 0.4s ease;` `[ESTIMATED]`
  - On card hover, secondary image transitions to `opacity: 1` `[ESTIMATED]`
- **Quick-Add / Quick-Buy Button**:
  - Positioned along bottom edge of card media or under price `[MEASURED]`
  - On desktop: Revealed / slides up on `:hover` `[MEASURED]`
  - On mobile: Persistent subtle button or tapped directly from card `[MEASURED]`

---

## 8. Product Details Page (PDP) Layout & Gallery

### 8.1 Layout Structure
- **Desktop (1920px & 1440px)**:
  - 2-Column Split Layout `[MEASURED]`
  - Left Media Column: `max-width: 55%` (expandable to `70%` / `75%` on ultra-wide `≥ 1800px` via `[desktop-media-size=large]`) `[MEASURED]`
  - Right Details Column: `45%` flex-basis `[MEASURED]`
  - Sticky Details Behavior: Product title, price, variants, and buy buttons remain sticky in right viewport while media column scrolls vertically `[MEASURED]`
- **Mobile (430px & 390px)**:
  - Single Column Stacked (`100%` width) `[MEASURED]`
  - Media gallery sits first, followed by title, price, swatches, collapsible details `[MEASURED]`
  - Bottom Sticky Bar: Fixed footer checkout bar (`.wt-product__sticky-buy`) docks at bottom edge with background `rgb(255, 255, 255)` (`--sticky-button-bg`) `[MEASURED]`

### 8.2 Gallery Behavior
- **Desktop Gallery Format**:
  - Architecture: Masonry vertical sequence (`wt-product__gallery--masonry`) `[MEASURED]`
  - Slide Aspect Ratio: Maintained at `0.67` portrait (`--aspect-ratio-portait`) `[MEASURED]`
  - Lightbox: PhotoSwipe modal triggerable on click for full-screen inspection `[MEASURED]`
- **Mobile Gallery Format**:
  - Architecture: Swiper touch carousel (`swiper-container`, horizontal slide) `[MEASURED]`
  - Slide Width: `100%` (`flex: 0 0 100%`) `[MEASURED]`
  - Pagination: Minimalist slide indicator / counter dots `[MEASURED]`
  - Border Radius: Flat `0px` edge-to-edge `[MEASURED]`

### 8.3 Variant Selectors (Size Chips & Swatches)
- **Size Selector Pills**:
  - Mobile Chip Height: `40px` (`--height-chip: 4rem`) `[MEASURED]`
  - Desktop Chip Height: `32px` (`--height-chip: 3.2rem`) `[MEASURED]`
  - Sizing Pill Border Radius: `0px` (`--border-radius: 0px`) `[MEASURED]`
  - State: Selected size has active solid border (`#000000`), inactive has subtle border (`#dddddd`) `[MEASURED]`
- **Color Swatches**:
  - Diameter: `32px` (`--custom-size: 32px`) `[MEASURED]`

---

## 9. Button Design System & Interactive Hover Mechanics

### 9.1 Base Button Dimensions & Styles
- **Primary Action Button (`.wt-button--primary`, `.hero__button--primary`)**:
  - Border Radius: `0px` (`--border-radius-button: 0px`) `[MEASURED]`
  - Default Background: `#4d4d4d` (or `rgba(0, 0, 0, 0.25)` over hero) `[MEASURED]`
  - Default Text Color: `#ffffff` `[MEASURED]`
  - Border: `1px solid transparent` (or `1px solid #666666` over hero) `[MEASURED]`
  - Font Size: `12px` mobile, `13px` desktop (hero button: `11px`) `[MEASURED]`
  - Text Transform: `uppercase` `[MEASURED]`
  - Padding:
    - Hero Desktop: `12px 60px` `[MEASURED]`
    - Hero Mobile: `12px 30px` `[MEASURED]`
    - Standard Form CTA: `14px 24px` (`calc(var(--gap) * 1.75) calc(var(--gap) * 3)`) `[ESTIMATED]`
- **Secondary Action Button (`.wt-button--secondary`, `.hero__button--secondary`)**:
  - Border Radius: `0px` `[MEASURED]`
  - Background: `#ffffff` `[MEASURED]`
  - Text Color: `#2d2d2d` `[MEASURED]`
  - Border: `1px solid #dddddd` (`--color-button-secondary-border`) `[MEASURED]`

### 9.2 The "Fill on Hover" Animation Pattern
- **Selector Trigger**: `[data-button-animations=fill_on_hover] .wt-button, .hero__button` `[MEASURED]`
- **Mechanism**:
  - Element has `position: relative; z-index: 1; clip-path: inset(0 round var(--border-radius-button)); overflow: hidden;` `[MEASURED]`
  - Pseudo-element `::after`:
    ```css
    content: "";
    position: absolute;
    top: -1px;
    right: -1px;
    bottom: -1px;
    left: -1px;
    background: var(--btn-hover-fill, var(--color-button-primary-background-hover));
    transform: translateY(101%);
    transition: transform 0.3s ease-in-out;
    z-index: -1;
    border-radius: var(--border-radius-button);
    ```
  - Hover state `:hover::after`:
    ```css
    transform: translateY(0);
    ```
- **Interaction Feel**: The hover background smoothly wipes upwards from the bottom edge to the top edge over exactly `300ms`, creating an architectural lift effect.

---

## 10. Cart Drawer States & Lifecycle

### 10.1 Empty State (`.wt-cart--empty`)
- **Structure**:
  - Header: Drawer title (`Your Cart`), item count `0`, and close icon button (`svg-icon--close`) `[MEASURED]`
  - Body Container: `.wt-cart__header--empty` `[MEASURED]`
  - Empty Icon: Minimalist shopping bag icon (`svg-icon--bag`) centered `[MEASURED]`
  - Explanatory copy: Empty cart message `[MEASURED]`
  - Action Button: Full-width "Continue Shopping" CTA (`.wt-button--continue-shopping`) `[MEASURED]`
  - Account prompt: Optional customer login link (`.wt-cart__login`) `[MEASURED]`

### 10.2 Filled State (`.wt-cart` with line items)
- **Free Shipping Progress Bar (`.wt-free-shipping-bar`)**:
  - Container Margin: `24px 0 8px` (`calc(var(--gap) * 3) 0 calc(var(--gap) * 1)`) `[MEASURED]`
  - Header text: `14px`, margin-bottom `8px` `[MEASURED]`
  - Track (`.wt-progress-bar`): Height `4px`, background `rgba(45, 45, 45, 0.2)`, radius `0px` `[MEASURED]`
  - Progress Fill (`.wt-progress-bar__fill`): Background `#2d2d2d`, `transition: width 0.5s ease-in-out` `[MEASURED]`
- **Item Cards Layout (`.wt-cart__item`)**:
  - Top & bottom padding: `24px` (`calc(var(--gap) * 3)`) `[MEASURED]`
  - Divider: `1px solid var(--color-border)` (`#dddddd`) between items `[MEASURED]`
  - Left Column: Product thumbnail image with `0.67` portrait aspect ratio, width `~80px` `[MEASURED]`
  - Right Column (`.wt-cart__item__data`):
    - Top row: Product title and variant label `[MEASURED]`
    - Inline remove action: Top-right `×` icon (`.wt-cart__item__remove--title`) `[MEASURED]`
    - Price line: Unit price (or discounted sale price in red/muted) `[MEASURED]`
    - Stepper quantity counter: `[-] [quantity] [+]` inline selector buttons `[MEASURED]`
- **Cart Summary & Footer**:
  - Order Note / Gift Message collapsible field (`.giftnote__save`) `[MEASURED]`
  - Subtotal row: Label and prominent calculated currency total `[MEASURED]`
  - Primary CTA: Full-width Checkout button (`.wt-cart__cta`, `.btn-checkout`) `[MEASURED]`
  - Accelerated Wallets: Apple Pay / Shop Pay container immediately underneath checkout `[MEASURED]`

### 10.3 Item-Added Notification Lifecycle
- **Trigger**: Addition of product from PDP or Collection quick-add `[MEASURED]`
- **Event Flow**:
  1. Network payload fetched via Shopify Cart API `[MEASURED]`
  2. DOM parser updates `#CartDrawer` and `#cart-icon-bubble` `[MEASURED]`
  3. Drawer auto-opens via `renderContents(parsedState, isClosedCart = true)` triggering `toggleDrawerClasses()` `[MEASURED]`
  4. Header cart count dot updates (`--color-action-background: #2d2d2d; --color-action-text: #ffffff`) `[MEASURED]`
  5. Focus is automatically transferred to `.wt-cart__drawer__close` for accessibility `[MEASURED]`

---

## 11. Footer Layout & Multi-Column Architecture

### 11.1 Desktop Layout (1920px & 1440px)
- **Arrangement**: Horizontal multi-column layout (`flex-direction: row; flex-wrap: nowrap; gap: 32px`) `[MEASURED]`
- **Max Width**: Centered container constrained to `1900px` (`--site-max-width`) `[MEASURED]`
- **Column Distribution (4 Columns)**:
  - Column 1: Newsletter subscription block (`flex: 1 1 25%` to `31%`) with headline, input field, and submit button `[MEASURED]`
  - Column 2: Navigation menu list (`flex: 1 1 15%`) `[MEASURED]`
  - Column 3: Navigation menu list (`flex: 1 1 15%`) `[MEASURED]`
  - Column 4: Navigation menu list (`flex: 1 1 15%`) `[MEASURED]`
- **Bottom Bar**:
  - Copyright notices, payment provider icons, language/currency selectors, and social media icons (Instagram, Pinterest, TikTok) `[MEASURED]`

### 11.2 Mobile Layout (430px & 390px)
- **Arrangement**: Vertical stacked column layout (`flex-direction: column`) `[MEASURED]`
- **Collapsible Menus (Accordions)**:
  - Navigation columns convert into accordion triggers (`.wt-collapse__trigger`) `[MEASURED]`
  - Header displays column title with SVG `+` / `-` toggle icon on right edge `[MEASURED]`
  - Content unfolds smoothly with max-height transition `[MEASURED]`
  - Newsletter form remains persistently expanded at top or bottom `[MEASURED]`

---

## 12. Transition Timing & Motion System

### 12.1 Centralized Duration & Easing Matrix
| Design System Token | Measured / Configured Value | Primary Usage Areas |
| :--- | :--- | :--- |
| `--duration-short` | `100ms` `[MEASURED]` | Micro-toggles, icon color shifts |
| `--duration-default` | `200ms` `[MEASURED]` | Standard hover states, subtle link color fades |
| `--duration-announcement-bar` | `250ms` `[MEASURED]` | Ticker / top announcement bar slides |
| `--duration-medium` | `300ms` `[MEASURED]` | Header reveal/hide, drawer slide, overlay fade |
| `--duration-long` | `500ms` `[MEASURED]` | Large section fades, accordion unfold |
| `--duration-extra-long` | `600ms` `[MEASURED]` | Modal appearances, entrance animations |
| `--duration-extended` | `3000ms` (`3s`) `[MEASURED]` | Ambient background video loops, marquee text |
| `--ease-out-slow` | `cubic-bezier(0, 0, 0.3, 1)` `[MEASURED]` | Entrance slide-in (`--animation-slide-in`) |
| **Drawer Slide Easing** | `cubic-bezier(0.12, 0.67, 0.53, 1)` `[MEASURED]` | Cart drawer transform and opacity |
| **Button Fill Hover** | `300ms ease-in-out` `[MEASURED]` | Vertical lift hover fill on all buttons |
| **Free Shipping Bar Fill** | `500ms ease-in-out` `[MEASURED]` | Width fill transition on cart threshold change |
| **Image Picture Zoom** | `1500ms (1.5s) ease` `[MEASURED]` | Product card image scale (`1.05`) on hover |
| **Header Color Swap** | `300ms ease` `[MEASURED]` | Background and logo swap on scroll transition |

---

## 13. Implementation Guidelines for Replication

1. **Maintain Exact Aspect Ratios**: Use strictly `0.6667` (2:3) for all apparel product imagery to prevent layout shift and maintain high-end editorial proportions.
2. **Execute Clean Geometry**: Set border radius to `0px` globally across cards, buttons, input fields, and modal containers. Minimalist luxury relies on sharp rectilinear edges.
3. **Typography Discipline**: Keep base text at `12px` or `13px` with negative letter-spacing (`-0.5px`) and uppercase transforms. Large headlines should be clamped using `min(calc(...), calc(... + 8vw))` to avoid mobile overflow.
4. **Motion Polish**: Always pair the cart drawer and navigation drawer with the `300ms cubic-bezier(0.12, 0.67, 0.53, 1)` easing curve and a `blur(4px)` 50% opacity black scrim for an authentic native feel.
