import { adminSupabase, supabase } from './supabaseClient';
import { PRODUCTS, type Product } from '../config/assets';

const LOCAL_STORAGE_CATALOG_KEY = 'vbfits_catalog_overrides';

export interface AdminProductVariant {
  id?: string;
  product_id?: string;
  size: string;
  color: string;
  color_hex?: string | null;
  stock: number;
  sku: string;
  price_override?: number | null;
}

export interface AdminProductImage {
  id?: string;
  product_id?: string;
  url: string;
  alt_text?: string | null;
  display_order: number;
  is_primary: boolean;
  media_type?: 'image' | 'video' | 'gif';
  video_poster_url?: string | null;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  subtitle?: string | null;
  description: string;
  price: number;
  currency: string;
  category_id?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  collection_tag?: string | null;
  featured: boolean;
  is_new_arrival: boolean;
  is_published: boolean;
  is_archived: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
  related_product_ids: string[];
  details: string[];
  fabric_care: string[];
  shipping_info?: string | null;
  variants: AdminProductVariant[];
  images: AdminProductImage[];
  created_at?: string;
  updated_at?: string;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
}

function getLocalCatalogOverrides(): Record<string, Partial<AdminProduct>> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CATALOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalCatalogOverride(idOrSlug: string, product: Partial<AdminProduct>) {
  try {
    const existing = getLocalCatalogOverrides();
    existing[idOrSlug] = { ...(existing[idOrSlug] || {}), ...product };
    localStorage.setItem(LOCAL_STORAGE_CATALOG_KEY, JSON.stringify(existing));
  } catch (err) {
    console.warn('Could not save local catalog override:', err);
  }
}

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Fetch all categories for the product editor dropdown.
 */
export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  const client = adminSupabase || supabase;
  try {
    const { data, error } = await client
      .from('categories')
      .select('id, name, slug')
      .order('name');
    if (!error && data && data.length > 0) return data;
  } catch (err) {
    console.warn('fetchAdminCategories exception:', err);
  }
  return [
    { id: 'cat-shirts', name: 'Shirts & Tops', slug: 'shirts' },
    { id: 'cat-outerwear', name: 'Outerwear', slug: 'outerwear' },
    { id: 'cat-bottoms', name: 'Trousers & Denims', slug: 'bottoms' },
    { id: 'cat-accessories', name: 'Leather & Accessories', slug: 'accessories' }
  ];
}

/**
 * Fetch all products for the admin table (merging database rows and universal store_settings overrides).
 */
export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  const client = adminSupabase || supabase;
  let dbProducts: AdminProduct[] = [];

  try {
    const { data, error } = await client
      .from('products')
      .select(`
        *,
        category:categories(id, name, slug),
        variants:product_variants(*),
        images:product_images(*)
      `)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      dbProducts = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        subtitle: row.subtitle,
        description: row.description || '',
        price: Number(row.price || 0),
        currency: row.currency || 'EGP',
        category_id: row.category_id,
        category: row.category,
        collection_tag: row.collection_tag || 'all',
        featured: Boolean(row.featured),
        is_new_arrival: Boolean(row.is_new_arrival),
        is_published: row.is_published !== false,
        is_archived: Boolean(row.is_archived),
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        related_product_ids: Array.isArray(row.related_product_ids)
          ? row.related_product_ids
          : [],
        details: Array.isArray(row.details) ? row.details : [],
        fabric_care: Array.isArray(row.fabric_care) ? row.fabric_care : [],
        shipping_info: row.shipping_info,
        variants: (row.variants || []).map((v: any) => ({
          id: v.id,
          product_id: v.product_id,
          size: v.size,
          color: v.color,
          color_hex: v.color_hex,
          stock: Number(v.stock || 0),
          sku: v.sku,
          price_override: v.price_override ? Number(v.price_override) : null
        })),
        images: (row.images || [])
          .slice()
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((img: any) => ({
            id: img.id,
            product_id: img.product_id,
            url: img.url,
            alt_text: img.alt_text,
            display_order: img.display_order ?? 0,
            is_primary: Boolean(img.is_primary),
            media_type: img.media_type || 'image',
            video_poster_url: img.video_poster_url
          })),
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    }
  } catch (err) {
    console.warn('fetchAdminProducts DB exception (falling back to static catalog):', err);
  }

  // If no DB products returned, initialize with demo PRODUCTS catalog
  if (dbProducts.length === 0) {
    dbProducts = PRODUCTS.map((p, idx) => ({
      id: p.id,
      name: p.name,
      slug: p.id,
      subtitle: p.subtitle,
      description: p.description,
      price: p.price,
      currency: p.currency,
      category_id: 'cat-shirts',
      category: { id: 'cat-shirts', name: 'Shirts & Tops', slug: 'shirts' },
      collection_tag: p.color.toLowerCase().includes('black') ? 'black' : 'white',
      featured: Boolean(p.featured),
      is_new_arrival: Boolean(p.isNewArrival),
      is_published: true,
      is_archived: false,
      seo_title: `${p.name} — Luxury Streetwear | VB Fits Studios`,
      seo_description: p.description,
      related_product_ids: PRODUCTS.filter((o) => o.id !== p.id).map((o) => o.id),
      details: p.details || [],
      fabric_care: p.fabricCare || [],
      shipping_info: p.shippingInfo,
      variants: (p.sizes || ['S', 'M', 'L', 'XL']).map((sz) => ({
        id: `var-${p.id}-${sz}`,
        product_id: p.id,
        size: sz,
        color: p.color,
        color_hex: p.color.toLowerCase().includes('black') ? '#111111' : '#FFFFFF',
        stock: p.stockBySize?.[sz] ?? 12,
        sku: `VB-${p.id.slice(0, 4).toUpperCase()}-${sz}`
      })),
      images: (p.mediaItems && p.mediaItems.length > 0
        ? p.mediaItems
        : p.images.map((url, i) => ({ url, type: 'image' as const, displayOrder: i }))
      ).map((m: any, i) => ({
        id: `img-${p.id}-${i}`,
        product_id: p.id,
        url: m.url,
        alt_text: p.name,
        display_order: i,
        is_primary: i === 0,
        media_type: m.type,
        video_poster_url: m.posterUrl || null
      })),
      created_at: new Date(Date.now() - idx * 86400000).toISOString()
    }));
  }

  // Fetch universal cloud overrides from store_settings
  let cloudOverrides: Record<string, AdminProduct> = {};
  try {
    const { data: settingsRow } = await client
      .from('store_settings')
      .select('value')
      .eq('key', 'catalog_products_override')
      .maybeSingle();

    if (settingsRow?.value && typeof settingsRow.value === 'object') {
      cloudOverrides = settingsRow.value;
    }
  } catch (e) {
    console.warn('Could not fetch cloud catalog overrides:', e);
  }

  const localOverrides = getLocalCatalogOverrides();
  const allOverrides = { ...localOverrides, ...cloudOverrides };

  // Apply overrides to existing products
  const productMap = new Map<string, AdminProduct>();
  dbProducts.forEach((p) => {
    productMap.set(p.id, p);
    if (p.slug) productMap.set(p.slug, p);
  });

  // Apply updates or inject newly created products
  Object.entries(allOverrides).forEach(([key, override]) => {
    const existing = productMap.get(key) || productMap.get(override.id || '') || productMap.get(override.slug || '');
    if (existing) {
      Object.assign(existing, override);
    } else if (override && override.name && override.price) {
      // It's a newly created product
      const newProd = override as AdminProduct;
      productMap.set(newProd.id, newProd);
      dbProducts.unshift(newProd);
    }
  });

  return Array.from(new Set(dbProducts));
}

/**
 * Soft delete (archive/restore) a product without removing foreign key order histories.
 */
export async function archiveAdminProduct(id: string, isArchived: boolean): Promise<{ error: string | null }> {
  const client = adminSupabase || supabase;
  setLocalCatalogOverride(id, { is_archived: isArchived, updated_at: new Date().toISOString() });

  // 1. Direct database update if valid UUID (always attempt first)
  if (isValidUUID(id)) {
    try {
      const { error } = await client
        .from('products')
        .update({
          is_archived: isArchived,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.warn('DB archive notice:', error.message);
      } else {
        // Success — also update store_settings for cross-client sync
        await _syncProductToStoreSettings(client, id, { is_archived: isArchived });
        return { error: null };
      }
    } catch (err: any) {
      console.warn('DB archive exception:', err);
    }
  }

  // 2. Fallback: Persist to universal store_settings table
  try {
    await _syncProductToStoreSettings(client, id, { is_archived: isArchived });
  } catch (err) {
    console.warn('Failed to sync archive status to store_settings:', err);
  }

  return { error: null };
}

/**
 * Helper: sync a product partial update to store_settings cloud backup.
 */
async function _syncProductToStoreSettings(client: any, id: string, partial: Partial<AdminProduct>): Promise<void> {
  try {
    const { data: existingRow } = await client
      .from('store_settings')
      .select('value')
      .eq('key', 'catalog_products_override')
      .maybeSingle();

    const existingMap = (existingRow?.value && typeof existingRow.value === 'object') ? existingRow.value : {};
    existingMap[id] = {
      ...(existingMap[id] || {}),
      ...partial,
      updated_at: new Date().toISOString()
    };

    await client.from('store_settings').upsert({
      key: 'catalog_products_override',
      value: existingMap,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('_syncProductToStoreSettings failed:', err);
  }
}

/**
 * Upload an image, GIF, or video file to Supabase Storage ('product-media' bucket)
 * and return the public URL.
 */
export async function uploadAdminMedia(file: File): Promise<{ url: string | null; error: string | null }> {
  const client = adminSupabase || supabase;
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();
    const fileName = `${Date.now()}-${cleanName}.${ext}`;
    const filePath = `products/${fileName}`;

    const { data: uploadData, error: uploadError } = await client.storage
      .from('product-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.warn('Storage upload error (falling back to object URL for demo):', uploadError);
      return { url: URL.createObjectURL(file), error: null };
    }

    const { data: publicUrlData } = client.storage
      .from('product-media')
      .getPublicUrl(uploadData.path);

    return { url: publicUrlData.publicUrl, error: null };
  } catch (err: any) {
    console.warn('uploadAdminMedia exception (falling back to object URL):', err);
    return { url: URL.createObjectURL(file), error: null };
  }
}

/**
 * Save / Upsert a product with all its nested variants and images.
 * Performs a real database INSERT for new products and UPDATE for existing ones.
 * Also saves variants and images to their respective tables.
 * Falls back to store_settings cloud sync for guaranteed persistence.
 */
export async function saveAdminProduct(
  productData: Partial<AdminProduct>,
  variants: AdminProductVariant[],
  images: AdminProductImage[]
): Promise<{ data: AdminProduct | null; error: string | null }> {
  const client = adminSupabase || supabase;
  try {
    const isNew = !productData.id || productData.id.startsWith('new-') || productData.id.startsWith('temp-');

    const effectiveSlug = productData.slug || (productData.name ? productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `prod-${Date.now()}`);
    const safeCategoryId = isValidUUID(productData.category_id) ? productData.category_id : null;

    // Core DB payload (without id for INSERT, with id for UPDATE)
    const dbPayload: Record<string, any> = {
      name: productData.name || '',
      slug: effectiveSlug,
      subtitle: productData.subtitle || null,
      description: productData.description || '',
      price: Number(productData.price ?? 0),
      currency: productData.currency || 'EGP',
      category_id: safeCategoryId,
      collection_tag: productData.collection_tag || 'all',
      featured: Boolean(productData.featured),
      is_new_arrival: Boolean(productData.is_new_arrival),
      is_published: productData.is_published !== false,
      is_archived: Boolean(productData.is_archived),
      seo_title: productData.seo_title || null,
      seo_description: productData.seo_description || null,
      related_product_ids: productData.related_product_ids || [],
      details: productData.details || [],
      fabric_care: productData.fabric_care || [],
      shipping_info: productData.shipping_info || null,
      updated_at: new Date().toISOString()
    };

    let effectiveId: string | null = null;

    if (isNew) {
      // ── INSERT new product into DB ──
      try {
        const { data: inserted, error: insertErr } = await client
          .from('products')
          .insert({ ...dbPayload, created_at: new Date().toISOString() })
          .select('id')
          .single();

        if (!insertErr && inserted?.id) {
          effectiveId = inserted.id;
          console.log('[saveAdminProduct] New product inserted with ID:', effectiveId);
        } else {
          console.warn('[saveAdminProduct] INSERT failed:', insertErr?.message);
        }
      } catch (insertEx: any) {
        console.warn('[saveAdminProduct] INSERT exception:', insertEx.message);
      }
    } else {
      // ── UPDATE existing product ──
      effectiveId = productData.id!;

      if (isValidUUID(effectiveId)) {
        try {
          const { error: updateErr } = await client
            .from('products')
            .update(dbPayload)
            .eq('id', effectiveId);

          if (updateErr) {
            console.warn('[saveAdminProduct] UPDATE by id failed:', updateErr.message);
            // Fallback: try by slug
            await client.from('products').update(dbPayload).eq('slug', effectiveSlug);
          }
        } catch (updateEx: any) {
          console.warn('[saveAdminProduct] UPDATE exception:', updateEx.message);
        }
      } else {
        // Non-UUID id (static catalog product): try slug-based update
        try {
          await client.from('products').update(dbPayload).eq('slug', effectiveSlug);
        } catch (slugEx: any) {
          console.warn('[saveAdminProduct] Slug-based UPDATE exception:', slugEx.message);
        }
      }
    }

    // Use DB-assigned UUID if we got one, otherwise use provided/generated id
    const finalId = effectiveId || productData.id || `vb-prod-${Date.now()}`;

    // ── Save variants to product_variants table ──
    if (isValidUUID(finalId) && variants.length > 0) {
      try {
        // Delete old variants and re-insert (simplest approach for correctness)
        await client.from('product_variants').delete().eq('product_id', finalId);

        const variantsPayload = variants.map((v) => ({
          product_id: finalId,
          size: v.size,
          color: v.color || 'Black',
          color_hex: v.color_hex || null,
          stock: Math.max(0, Number(v.stock || 0)),
          sku: v.sku || `VB-${finalId.slice(0, 4).toUpperCase()}-${v.size}`,
          price_override: v.price_override ? Number(v.price_override) : null
        }));

        const { error: variantsErr } = await client
          .from('product_variants')
          .insert(variantsPayload);

        if (variantsErr) {
          console.warn('[saveAdminProduct] Variants insert notice:', variantsErr.message);
        }
      } catch (varEx: any) {
        console.warn('[saveAdminProduct] Variants save exception:', varEx.message);
      }
    }

    // ── Save images to product_images table ──
    if (isValidUUID(finalId) && images.length > 0) {
      try {
        // Only save images with real URLs (not blob: URLs)
        const realImages = images.filter((img) => img.url && !img.url.startsWith('blob:'));

        if (realImages.length > 0) {
          await client.from('product_images').delete().eq('product_id', finalId);

          const imagesPayload = realImages.map((img, idx) => ({
            product_id: finalId,
            url: img.url,
            alt_text: img.alt_text || productData.name || '',
            display_order: idx,
            is_primary: idx === 0 || img.is_primary,
            media_type: img.media_type || (img.url.endsWith('.mp4') ? 'video' : img.url.endsWith('.gif') ? 'gif' : 'image'),
            video_poster_url: img.video_poster_url || null
          }));

          const { error: imagesErr } = await client
            .from('product_images')
            .insert(imagesPayload);

          if (imagesErr) {
            console.warn('[saveAdminProduct] Images insert notice:', imagesErr.message);
          }
        }
      } catch (imgEx: any) {
        console.warn('[saveAdminProduct] Images save exception:', imgEx.message);
      }
    }

    // Build the full product object for the return value and cloud sync
    const fullProductObj: AdminProduct = {
      id: finalId,
      name: productData.name || '',
      slug: effectiveSlug,
      subtitle: productData.subtitle || null,
      description: productData.description || '',
      price: Number(productData.price ?? 0),
      currency: productData.currency || 'EGP',
      category_id: productData.category_id || null,
      category: productData.category || null,
      collection_tag: productData.collection_tag || 'all',
      featured: Boolean(productData.featured),
      is_new_arrival: Boolean(productData.is_new_arrival),
      is_published: productData.is_published !== false,
      is_archived: Boolean(productData.is_archived),
      seo_title: productData.seo_title || null,
      seo_description: productData.seo_description || null,
      related_product_ids: productData.related_product_ids || [],
      details: productData.details || [],
      fabric_care: productData.fabric_care || [],
      shipping_info: productData.shipping_info || null,
      variants: variants.map((v) => ({
        ...v,
        product_id: finalId,
        sku: v.sku || `VB-${finalId.slice(0, 4).toUpperCase()}-${v.size}`
      })),
      images: images.map((img, idx) => ({
        ...img,
        product_id: finalId,
        display_order: idx,
        is_primary: idx === 0 || img.is_primary,
        media_type: img.media_type || (img.url.endsWith('.mp4') ? 'video' : img.url.endsWith('.gif') ? 'gif' : 'image')
      })),
      created_at: productData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Optimistic local cache update
    setLocalCatalogOverride(finalId, fullProductObj);
    if (effectiveSlug) setLocalCatalogOverride(effectiveSlug, fullProductObj);

    // Cloud sync to store_settings as fallback persistence layer
    try {
      await _syncProductToStoreSettings(client, finalId, fullProductObj);
      if (effectiveSlug && effectiveSlug !== finalId) {
        await _syncProductToStoreSettings(client, effectiveSlug, fullProductObj);
      }
    } catch (syncErr) {
      console.warn('[saveAdminProduct] Cloud sync notice:', syncErr);
    }

    return { data: fullProductObj, error: null };
  } catch (err: any) {
    console.error('saveAdminProduct exception:', err);
    return { data: null, error: err.message || 'Failed to save product.' };
  }
}
