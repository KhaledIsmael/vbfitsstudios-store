// Centralized Asset and Product Configuration
// All assets can be replaced directly in the public/assets/ directories without touching UI code.

/**
 * A single media item in the product gallery.
 * type 'image'  → rendered with <img>
 * type 'gif'    → rendered with <img> (browsers autoplay GIFs natively)
 * type 'video'  → rendered with <video autoPlay muted loop playsInline>
 *
 * posterUrl is an optional static frame used as the thumbnail image for
 * video items so the thumbnail rail always shows a real fashion image.
 */
export interface MediaItem {
  url: string;
  type: 'image' | 'video' | 'gif';
  /** Static poster frame for video thumbnails (first frame export, etc.) */
  posterUrl?: string;
  altText?: string;
  displayOrder: number;
}

export interface Product {
  id: string;
  name: string;
  subtitle?: string;
  price: number;
  currency: string;
  category: 'long-sleeve' | 'tops' | 'bottoms' | 'accessories';
  featured: boolean; // For landing page (displays exactly 2 products)
  isNewArrival?: boolean;
  /** Legacy flat URL list — kept for backwards compat with ProductCard, SearchOverlay, etc. */
  images: string[];
  /**
   * Rich media items including images, GIFs, and one optional video.
   * When present, ProductGallery uses this instead of `images`.
   * Falls back to synthesising image MediaItems from `images` when absent.
   */
  mediaItems?: MediaItem[];
  color: string;
  colorsAvailable: { name: string; hex: string; productId: string }[];
  sizes: string[];
  description: string;
  details: string[];
  fabricCare: string[];
  shippingInfo: string;
  /**
   * Live stock count per size, sourced from product_variants.
   * Absence means unknown (e.g. static fallback catalog).
   * 0 = sold out; 1–5 = low stock; >5 = in stock.
   */
  stockBySize?: Record<string, number>;
  /**
   * Maps each size to its underlying product_variant_id (UUID or identifier)
   * used for restock alerts and waitlist signups.
   */
  variantIdBySize?: Record<string, string>;
}

export const BRAND_CONFIG = {
  name: "VB FITS STUDIOS",
  tagline: "Luxury Ready-to-Wear & Streetwear",
  copyright: "© 2026 VB FITS STUDIOS. ALL RIGHTS RESERVED.",
  logo: {
    src: "/assets/logo/logo-dark.png",
    dark: "/assets/logo/logo-dark.png",
    light: "/assets/logo/logo-light.png",
    alt: "VB Fits Studios Logo"
  },
  hero: {
    src: "/assets/hero/hero.webp",
    title: "Long Sleeve Shirt",
    subtitle: "AUTUMN / WINTER 2026",
    buttonText: "Shop Now",
    buttonLink: "/shop"
  },
  icons: {
    search: "/assets/icons/search.svg",
    user: "/assets/icons/user.svg",
    cart: "/assets/icons/cart.svg",
    menu: "/assets/icons/menu.svg",
    close: "/assets/icons/close.svg"
  },
  whatsapp: {
    phoneNumber: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WHATSAPP_NUMBER) || "201000000000",
    defaultGreeting: "Hello VB FITS STUDIOS! I have an inquiry regarding your collection."
  }
};

export const PRODUCTS: Product[] = [
  {
    id: "vb-long-sleeve-black",
    name: "VB Fits Studios Long Sleeve — Black",
    subtitle: "Ornate Sleeve Motif / Heavyweight Cotton",
    price: 195,
    currency: "$",
    category: "long-sleeve",
    featured: true, // Landing page featured product 1
    isNewArrival: true,
    images: [
      "/assets/products/black-shirt.webp",
      "/assets/hero/hero.webp"
    ],
    color: "Washed Black",
    colorsAvailable: [
      { name: "Washed Black", hex: "#111111", productId: "vb-long-sleeve-black" },
      { name: "Optic White", hex: "#F5F5F5", productId: "vb-long-sleeve-white" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    description: "Crafted from custom-milled 340 GSM organic French terry cotton. Featuring signature ornate baroque sleeve screenprint graphics with high-density archival ink and the iconic VB Fits Studios calligraphy chest signature.",
    details: [
      "Custom relaxed boxy silhouette",
      "Dropped shoulders with reinforced seam construction",
      "Signature ornate sleeve botanical pattern artwork",
      "VB Fits Studios chest embroidery signature",
      "Pre-shrunk vintage wash treatment",
      "Made in Portugal"
    ],
    fabricCare: [
      "100% Combed Heavyweight Organic Cotton (340 GSM)",
      "Machine wash cold inside out with like colors",
      "Do not tumble dry; lay flat to dry in shade",
      "Iron on reverse low heat, do not iron over prints"
    ],
    shippingInfo: "Complimentary express shipping on orders over $250. Standard delivery 3–5 business days. 14-day hassle-free returns.",
    stockBySize: { S: 0, M: 3, L: 14, XL: 8, XXL: 5 },
    variantIdBySize: {
      S: "var-vb-long-sleeve-black-S",
      M: "var-vb-long-sleeve-black-M",
      L: "var-vb-long-sleeve-black-L",
      XL: "var-vb-long-sleeve-black-XL",
      XXL: "var-vb-long-sleeve-black-XXL"
    }
  },
  {
    id: "vb-long-sleeve-white",
    name: "VB Fits Studios Long Sleeve — White",
    subtitle: "Royal Indigo Sleeve Motif / Clean Tailored Cut",
    price: 195,
    currency: "$",
    category: "long-sleeve",
    featured: true, // Landing page featured product 2
    isNewArrival: true,
    images: [
      "/assets/products/white-shirt.webp",
      "/assets/hero/hero.webp"
    ],
    color: "Optic White",
    colorsAvailable: [
      { name: "Optic White", hex: "#F5F5F5", productId: "vb-long-sleeve-white" },
      { name: "Washed Black", hex: "#111111", productId: "vb-long-sleeve-black" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    description: "A pristine optic white rendition featuring intricate royal indigo botanical sleeve embellishments. Designed with an effortless drape and luxury streetwear fit for year-round layering.",
    details: [
      "Pure optic white heavyweight 340 GSM knit",
      "Precision tonal collar ribbing that retains shape",
      "Subtle VB Fits Studios chest script in midnight indigo",
      "Intricate sleeve floral scroll screenprint",
      "Finished with hand-distressed edge hems",
      "Made in Portugal"
    ],
    fabricCare: [
      "100% Combed Heavyweight Organic Cotton (340 GSM)",
      "Machine wash cold inside out with delicate cycle",
      "Lay flat to dry to preserve silhouette",
      "Do not bleach; warm iron inside out"
    ],
    shippingInfo: "Complimentary express shipping on orders over $250. Standard delivery 3–5 business days. 14-day hassle-free returns.",
    stockBySize: { S: 10, M: 4, L: 0, XL: 2, XXL: 6 },
    variantIdBySize: {
      S: "var-vb-long-sleeve-white-S",
      M: "var-vb-long-sleeve-white-M",
      L: "var-vb-long-sleeve-white-L",
      XL: "var-vb-long-sleeve-white-XL",
      XXL: "var-vb-long-sleeve-white-XXL"
    }
  },
  {
    id: "vb-long-sleeve-nocturne",
    name: "VB Fits Nocturne Long Sleeve",
    subtitle: "Deep Charcoal / Tonal Sleeve Graphics",
    price: 210,
    currency: "$",
    category: "long-sleeve",
    featured: false,
    isNewArrival: true,
    images: [
      "/assets/products/black-shirt.jpeg",
      "/assets/hero/hero.jpg"
    ],
    color: "Deep Charcoal",
    colorsAvailable: [
      { name: "Deep Charcoal", hex: "#222222", productId: "vb-long-sleeve-nocturne" },
      { name: "Pure White", hex: "#FFFFFF", productId: "vb-long-sleeve-white" }
    ],
    sizes: ["S", "M", "L", "XL"],
    description: "A limited runway edition in deep charcoal with tonal matte rubberized sleeve elements. Understated luxury at its pinnacle.",
    details: [
      "Heavyweight 360 GSM loopback cotton",
      "Tonal dark sleeve motif with subtle sheen",
      "Dropped oversized cut",
      "Single needle stitch finishes"
    ],
    fabricCare: [
      "100% Organic Cotton",
      "Gentle cold wash inside out",
      "Dry flat"
    ],
    shippingInfo: "Complimentary express shipping on orders over $250."
  },
  {
    id: "vb-long-sleeve-monochrome",
    name: "VB Fits Studios Archival Long Sleeve",
    subtitle: "Bone White / Matte Black Sleeve Artwork",
    price: 210,
    currency: "$",
    category: "long-sleeve",
    featured: false,
    isNewArrival: false,
    images: [
      "/assets/products/white-shirt.jpeg",
      "/assets/hero/hero.jpg"
    ],
    color: "Bone White",
    colorsAvailable: [
      { name: "Bone White", hex: "#F2EFE9", productId: "vb-long-sleeve-monochrome" },
      { name: "Washed Black", hex: "#111111", productId: "vb-long-sleeve-black" }
    ],
    sizes: ["S", "M", "L", "XL"],
    description: "Archival edition in natural bone white. Tailored to an architectural drop-shoulder cut with high-density ink detailing.",
    details: [
      "Bone white unbleached heavyweight jersey",
      "Archival edition woven label at inner nape",
      "Reinforced twin needle hem"
    ],
    fabricCare: [
      "100% Organic Heavyweight Cotton",
      "Cold water wash",
      "Air dry only"
    ],
    shippingInfo: "Complimentary express shipping on orders over $250."
  }
];

export const NAV_LINKS = [
  { name: "Home", path: "/" },
  { name: "Shop", path: "/shop" },
  { name: "Lookbook", path: "/lookbook" },
  { name: "Authenticate", path: "/verify" },
  { name: "Craftsmanship & About", path: "/about" },
  { name: "Contact", path: "/contact" }
];

export const FOOTER_DATA = {
  newsletter: {
    title: "JOIN OUR BRAND TODAY!",
    subtitle: "Get 10% off your first order.",
    placeholder: "Enter your email address",
    buttonText: "Subscribe"
  },
  service: [
    { name: "Contact Us", path: "/contact" },
    { name: "Track Order", path: "/track-order" },
    { name: "Verify Authenticity", path: "/verify" }
  ],
  policies: [
    { name: "Shipping Policy", path: "/policies/shipping" },
    { name: "Returns & Refund Policy", path: "/policies/returns" },
    { name: "Privacy Policy", path: "/policies/privacy" },
    { name: "Terms of Service", path: "/policies/terms" },
    { name: "Legal Notice", path: "/policies/legal" }
  ],
  socials: [
    { name: "WhatsApp", url: "https://whatsapp.com" },
    { name: "Instagram", url: "https://instagram.com" },
    { name: "TikTok", url: "https://tiktok.com" },
    { name: "Pinterest", url: "https://pinterest.com" }
  ]
};
