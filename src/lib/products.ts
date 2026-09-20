import { supabase } from './supabaseClient';
import { PRODUCTS, type Product, type MediaItem } from '../config/assets';

export type { Product };

export interface SupabaseProductRow {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  description: string;
  price: number;
  currency: string;
  featured: boolean;
  is_new_arrival: boolean;
  is_published: boolean;
  details?: string[] | any;
  fabric_care?: string[] | any;
  shipping_info?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  variants?: Array<{
    id: string;
    size: string;
    color: string;
    color_hex?: string | null;
    stock: number;
    sku: string;
  }> | null;
  images?: Array<{
    id: string;
    url: string;
    alt_text?: string | null;
    display_order: number;
    is_primary: boolean;
    /** 'image' | 'video' | 'gif' — added by migration */
    media_type?: 'image' | 'video' | 'gif' | null;
    /** Static poster frame URL for video thumbnails */
    video_poster_url?: string | null;
  }> | null;
}

/**
 * Maps a Supabase relational row to the frontend Product model.
 */
function mapSupabaseToProduct(row: SupabaseProductRow): Product {
  const sortedDbImages = (row.images || [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order);

  // Build the rich MediaItem array (used by ProductGallery)
  const mediaItems: MediaItem[] = sortedDbImages.map((img) => ({
    url: img.url,
    type: (img.media_type as MediaItem['type']) || 'image',
    posterUrl: img.video_poster_url || undefined,
    altText: img.alt_text || undefined,
    displayOrder: img.display_order,
  }));

  // Legacy flat images[] — use poster URL for video entries so ProductCard
  // and other image-only consumers still see a valid displayable URL.
  const flatImages = sortedDbImages.map((img) =>
    img.media_type === 'video' && img.video_poster_url
      ? img.video_poster_url
      : img.url
  );

  const finalImages =
    flatImages.length > 0
      ? flatImages
      : ['/assets/products/black-shirt.jpeg', '/assets/hero/hero.jpg'];

  const finalMediaItems =
    mediaItems.length > 0
      ? mediaItems
      : finalImages.map((url, i) => ({
          url,
          type: 'image' as const,
          displayOrder: i,
        }));

  const sizes = Array.from(new Set((row.variants || []).map((v) => v.size)));
  const primaryColor = row.variants?.[0]?.color || 'Washed Black';

  const colorsAvailableMap = new Map<string, { name: string; hex: string; productId: string }>();
  (row.variants || []).forEach((v) => {
    if (!colorsAvailableMap.has(v.color)) {
      colorsAvailableMap.set(v.color, {
        name: v.color,
        hex: v.color_hex || '#111111',
        productId: row.slug || row.id
      });
    }
  });

  /**
   * stockBySize: sum stock across all variants that share the same size.
   * A single product row in the DB can have multiple colorway variants per size
   * (e.g. Black/M + White/M both live in product_variants for the same product).
   * We sum them all so "Only N left in size M" reflects the true per-size availability
   * for this specific product — never hardcoded, always from Supabase.
   */
  const stockBySize: Record<string, number> = {};
  const variantIdBySize: Record<string, string> = {};
  (row.variants || []).forEach((v) => {
    if (typeof v.stock === 'number') {
      stockBySize[v.size] = (stockBySize[v.size] ?? 0) + v.stock;
    }
    if (v.size && v.id && !variantIdBySize[v.size]) {
      variantIdBySize[v.size] = v.id;
    }
  });

  return {
    id: row.slug || row.id,
    name: row.name,
    subtitle: row.subtitle || undefined,
    price: Number(row.price),
    currency: row.currency === 'USD' ? '$' : row.currency || '$',
    category: (row.category?.slug as any) || 'long-sleeve',
    featured: Boolean(row.featured),
    isNewArrival: Boolean(row.is_new_arrival),
    images: finalImages,
    mediaItems: finalMediaItems,
    color: primaryColor,
    colorsAvailable:
      colorsAvailableMap.size > 0
        ? Array.from(colorsAvailableMap.values())
        : [{ name: primaryColor, hex: '#111111', productId: row.slug || row.id }],
    sizes: sizes.length > 0 ? sizes : ['S', 'M', 'L', 'XL', 'XXL'],
    description: row.description || '',
    details: Array.isArray(row.details) ? row.details : [],
    fabricCare: Array.isArray(row.fabric_care) ? row.fabric_care : [],
    shippingInfo:
      row.shipping_info ||
      'Complimentary express shipping on orders over $250. Standard delivery 3–5 business days. 14-day hassle-free returns.',
    stockBySize: Object.keys(stockBySize).length > 0 ? stockBySize : undefined,
    variantIdBySize: Object.keys(variantIdBySize).length > 0 ? variantIdBySize : undefined,
  };
}

/**
 * Fetches all published products from Supabase with relations (category, variants, images).
 */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*),
        images:product_images(*)
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase getAllProducts query notice (falling back to static catalog):', error.message);
      return PRODUCTS;
    }

    if (!data || data.length === 0) {
      return PRODUCTS;
    }

    return data.map(mapSupabaseToProduct);
  } catch (err) {
    console.warn('getAllProducts exception (falling back to static catalog):', err);
    return PRODUCTS;
  }
}

/**
 * Fetches featured products for the Landing Page.
 */
export async function getFeaturedProducts(limit = 2): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*),
        images:product_images(*)
      `)
      .eq('is_published', true)
      .eq('featured', true)
      .limit(limit);

    if (error) {
      console.warn('Supabase getFeaturedProducts query notice (falling back to static catalog):', error.message);
      return PRODUCTS.filter((p) => p.featured).slice(0, limit);
    }

    if (!data || data.length === 0) {
      return PRODUCTS.filter((p) => p.featured).slice(0, limit);
    }

    return data.map(mapSupabaseToProduct);
  } catch (err) {
    console.warn('getFeaturedProducts exception (falling back to static catalog):', err);
    return PRODUCTS.filter((p) => p.featured).slice(0, limit);
  }
}

/**
 * Fetches a single product by UUID or slug from Supabase.
 */
export async function getProductById(idOrSlug: string): Promise<Product | null> {
  if (!idOrSlug) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*),
        images:product_images(*)
      `)
      .eq('is_published', true);

    if (isUuid) {
      query = query.or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`);
    } else {
      query = query.eq('slug', idOrSlug);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.warn(`Supabase getProductById query notice for "${idOrSlug}":`, error.message);
      const fallback = PRODUCTS.find((p) => p.id === idOrSlug);
      return fallback || null;
    }

    if (!data) {
      const fallback = PRODUCTS.find((p) => p.id === idOrSlug);
      return fallback || null;
    }

    return mapSupabaseToProduct(data);
  } catch (err) {
    console.warn(`getProductById exception for "${idOrSlug}":`, err);
    const fallback = PRODUCTS.find((p) => p.id === idOrSlug);
    return fallback || null;
  }
}

/**
 * Fetches multiple products by UUIDs or slugs from Supabase,
 * and sorts the result to preserve the input array order (most-recent-first).
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids || ids.length === 0) return [];

  try {
    const uuids = ids.filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    const slugs = ids.filter((id) =>
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );

    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*),
        images:product_images(*)
      `)
      .eq('is_published', true);

    const orClauses: string[] = [];
    if (uuids.length > 0) {
      orClauses.push(`id.in.(${uuids.join(',')})`);
    }
    if (slugs.length > 0) {
      orClauses.push(`slug.in.(${slugs.join(',')})`);
    }

    if (orClauses.length > 0) {
      query = query.or(orClauses.join(','));
    }

    const { data, error } = await query;

    let list: Product[] = [];
    if (!error && data && data.length > 0) {
      list = data.map(mapSupabaseToProduct);
    } else {
      list = PRODUCTS.filter((p) => ids.includes(p.id));
    }

    // Preserve the original ordering of the input `ids` (most-recent-first)
    const productMap = new Map<string, Product>();
    list.forEach((p) => {
      productMap.set(p.id, p);
    });

    const ordered: Product[] = [];
    for (const targetId of ids) {
      const found = productMap.get(targetId) || PRODUCTS.find((p) => p.id === targetId);
      if (found && !ordered.some((p) => p.id === found.id)) {
        ordered.push(found);
      }
    }

    return ordered;
  } catch (err) {
    console.warn('getProductsByIds exception (falling back to static catalog):', err);
    return ids
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
  }
}


export interface ProductFilterParams {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  inStockOnly?: boolean;
  collectionFilter?: 'all' | 'new' | 'black' | 'white';
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'popularity' | 'default';
}

/**
 * Queries Supabase products dynamically with applied filter and sort parameters.
 * Falls back gracefully to filtering static catalog if Supabase is unavailable.
 */
export async function getFilteredProducts(params: ProductFilterParams = {}): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        variants:product_variants(*),
        images:product_images(*)
      `)
      .eq('is_published', true);

    // Database price range filtering
    if (params.minPrice !== undefined && params.minPrice > 0) {
      query = query.gte('price', params.minPrice);
    }
    if (params.maxPrice !== undefined && params.maxPrice < 1000) {
      query = query.lte('price', params.maxPrice);
    }

    // New Arrivals collection pill
    if (params.collectionFilter === 'new') {
      query = query.eq('is_new_arrival', true);
    }

    // Database sorting
    if (params.sortBy === 'price-asc') {
      query = query.order('price', { ascending: true });
    } else if (params.sortBy === 'price-desc') {
      query = query.order('price', { ascending: false });
    } else if (params.sortBy === 'popularity') {
      query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    let results: Product[];

    if (error || !data || data.length === 0) {
      results = [...PRODUCTS];
    } else {
      results = data.map(mapSupabaseToProduct);
    }

    // Category filter
    if (params.category && params.category !== 'all') {
      results = results.filter((p) => p.category === params.category);
    }

    // Collection pills (Noir / Blanc / New)
    if (params.collectionFilter === 'black') {
      results = results.filter(
        (p) =>
          p.color.toLowerCase().includes('black') ||
          p.color.toLowerCase().includes('charcoal') ||
          p.colorsAvailable?.some(
            (c) =>
              c.name.toLowerCase().includes('black') ||
              c.name.toLowerCase().includes('charcoal')
          )
      );
    } else if (params.collectionFilter === 'white') {
      results = results.filter(
        (p) =>
          p.color.toLowerCase().includes('white') ||
          p.color.toLowerCase().includes('bone') ||
          p.colorsAvailable?.some(
            (c) =>
              c.name.toLowerCase().includes('white') ||
              c.name.toLowerCase().includes('bone')
          )
      );
    } else if (params.collectionFilter === 'new') {
      results = results.filter((p) => p.isNewArrival);
    }

    // Fallback price filter (guarantees local products also adhere to price)
    if (params.minPrice !== undefined && params.minPrice > 0) {
      results = results.filter((p) => p.price >= (params.minPrice || 0));
    }
    if (params.maxPrice !== undefined && params.maxPrice < 1000) {
      results = results.filter((p) => p.price <= (params.maxPrice || 1000));
    }

    // Size filter
    if (params.sizes && params.sizes.length > 0) {
      results = results.filter((p) =>
        params.sizes!.some((s) => p.sizes.includes(s))
      );
    }

    // Color swatches filter
    if (params.colors && params.colors.length > 0) {
      results = results.filter((p) =>
        params.colors!.some((c) => {
          const target = c.toLowerCase();
          return (
            p.color.toLowerCase().includes(target) ||
            p.colorsAvailable?.some((ca) => ca.name.toLowerCase().includes(target))
          );
        })
      );
    }

    // Availability (In Stock Only)
    if (params.inStockOnly) {
      results = results.filter((p) => p.sizes && p.sizes.length > 0);
    }

    // In-memory sorting as second pass
    if (params.sortBy === 'price-asc') {
      results.sort((a, b) => a.price - b.price);
    } else if (params.sortBy === 'price-desc') {
      results.sort((a, b) => b.price - a.price);
    } else if (params.sortBy === 'popularity') {
      results.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    return results;
  } catch (err) {
    console.warn('getFilteredProducts exception, returning catalog:', err);
    return PRODUCTS;
  }
}

/**
 * Fetches categories list for filtering options.
 */
export async function getCategories(): Promise<Array<{ id: string; name: string; slug: string }>> {
  try {
    const { data } = await supabase
      .from('categories')
      .select('id, name, slug')
      .order('display_order', { ascending: true });

    if (data && data.length > 0) {
      return [{ id: 'all', name: 'All Categories', slug: 'all' }, ...data];
    }
  } catch (e) {
    // fallback
  }

  return [
    { id: 'all', name: 'All Categories', slug: 'all' },
    { id: 'long-sleeve', name: 'Long Sleeve', slug: 'long-sleeve' },
    { id: 'tops', name: 'Tops & Tees', slug: 'tops' },
    { id: 'bottoms', name: 'Pants & Bottoms', slug: 'bottoms' },
    { id: 'accessories', name: 'Accessories', slug: 'accessories' }
  ];
}

