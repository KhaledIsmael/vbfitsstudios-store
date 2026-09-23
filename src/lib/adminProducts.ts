import { supabase } from './supabaseClient';
import { PRODUCTS, type Product } from '../config/assets';

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

/**
 * Fetch all categories for the product editor dropdown.
 */
export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  try {
    const { data, error } = await supabase
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
 * Fetch all products for the admin table (including drafts and archived items).
 */
export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, slug),
        variants:product_variants(*),
        images:product_images(*)
      `)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
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
    console.warn('fetchAdminProducts exception (falling back to static demo catalog):', err);
  }

  // Fallback to demo PRODUCTS catalog
  return PRODUCTS.map((p, idx) => ({
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

/**
 * Soft delete (archive/restore) a product without removing foreign key order histories.
 */
export async function archiveAdminProduct(id: string, isArchived: boolean): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('products')
      .update({
        is_archived: isArchived,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Archiving failed' };
  }
}

/**
 * Upload an image, GIF, or video file to Supabase Storage ('product-media' bucket)
 * and return the public URL.
 */
export async function uploadAdminMedia(file: File): Promise<{ url: string | null; error: string | null }> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase();
    const fileName = `${Date.now()}-${cleanName}.${ext}`;
    const filePath = `products/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.warn('Storage upload error (falling back to object URL for demo):', uploadError);
      return { url: URL.createObjectURL(file), error: null };
    }

    const { data: publicUrlData } = supabase.storage
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
 */
export async function saveAdminProduct(
  productData: Partial<AdminProduct>,
  variants: AdminProductVariant[],
  images: AdminProductImage[]
): Promise<{ data: AdminProduct | null; error: string | null }> {
  try {
    const isNew = !productData.id || productData.id.startsWith('new-') || productData.id.startsWith('temp-');

    const productPayload = {
      name: productData.name,
      slug: productData.slug || (productData.name ? productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `prod-${Date.now()}`),
      subtitle: productData.subtitle || null,
      description: productData.description || '',
      price: productData.price ?? 0,
      currency: productData.currency || 'EGP',
      category_id: productData.category_id || null,
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

    let currentPayload: Record<string, any> = { ...productPayload };
    let savedProductId = productData.id;

    // Helper to perform resilient save (retries if any optional column does not exist in schema)
    const executeSave = async (payload: Record<string, any>): Promise<{ id: string | null; error: string | null }> => {
      let attempts = 0;
      let workingPayload = { ...payload };

      while (attempts < 6) {
        attempts++;
        if (isNew) {
          const { data: newProd, error: insertError } = await supabase
            .from('products')
            .insert([workingPayload])
            .select()
            .single();

          if (!insertError && newProd) {
            return { id: newProd.id, error: null };
          }

          if (insertError) {
            // Check if error is due to missing column or schema cache delay
            const colMatch =
              insertError.message.match(/column ["']?([a-zA-Z0-9_]+)["']?.*does not exist/i) ||
              insertError.message.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
              insertError.message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation .* does not exist/i);

            const missingCol = colMatch ? (colMatch[1] || colMatch[2]) : null;
            if (missingCol && workingPayload[missingCol] !== undefined) {
              console.warn(`Resilient schema fallback: removing missing/uncached column "${missingCol}" and retrying save.`);
              delete workingPayload[missingCol];
              continue;
            }
            return { id: null, error: insertError.message };
          }
        } else {
          const { error: updateError } = await supabase
            .from('products')
            .update(workingPayload)
            .eq('id', savedProductId);

          if (!updateError) {
            return { id: savedProductId || null, error: null };
          }

          if (updateError) {
            const colMatch =
              updateError.message.match(/column ["']?([a-zA-Z0-9_]+)["']?.*does not exist/i) ||
              updateError.message.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i) ||
              updateError.message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? of relation .* does not exist/i);

            const missingCol = colMatch ? (colMatch[1] || colMatch[2]) : null;
            if (missingCol && workingPayload[missingCol] !== undefined) {
              console.warn(`Resilient schema fallback: removing missing/uncached column "${missingCol}" and retrying save.`);
              delete workingPayload[missingCol];
              continue;
            }
            return { id: null, error: updateError.message };
          }
        }
      }
      return { id: null, error: 'Maximum retry attempts exceeded saving product.' };
    };

    const saveResult = await executeSave(currentPayload);
    if (saveResult.error || !saveResult.id) {
      return { data: null, error: saveResult.error || 'Failed to persist product.' };
    }
    savedProductId = saveResult.id;

    if (!savedProductId) {
      return { data: null, error: 'Product ID is required for variant assignment.' };
    }

    // 1. Sync variants: Remove previous and re-insert or upsert
    if (variants && variants.length > 0) {
      // Clean up previous variants
      await supabase.from('product_variants').delete().eq('product_id', savedProductId);

      const variantRows = variants.map((v) => ({
        product_id: savedProductId,
        size: v.size,
        color: v.color,
        color_hex: v.color_hex || '#111111',
        stock: Number(v.stock || 0),
        sku: v.sku || `VB-${savedProductId.slice(0, 4).toUpperCase()}-${v.size}`,
        price_override: v.price_override || null
      }));

      const { error: varError } = await supabase.from('product_variants').insert(variantRows);
      if (varError) console.warn('Variant save notice:', varError.message);
    }

    // 2. Sync images: Remove previous and re-insert with sorted display_order
    if (images && images.length > 0) {
      await supabase.from('product_images').delete().eq('product_id', savedProductId);

      const imageRows = images.map((img, idx) => ({
        product_id: savedProductId,
        url: img.url,
        alt_text: img.alt_text || productData.name,
        display_order: idx,
        is_primary: idx === 0 || img.is_primary,
        media_type: img.media_type || (img.url.endsWith('.mp4') ? 'video' : img.url.endsWith('.gif') ? 'gif' : 'image'),
        video_poster_url: img.video_poster_url || null
      }));

      const { error: imgError } = await supabase.from('product_images').insert(imageRows);
      if (imgError) console.warn('Image save notice:', imgError.message);
    }

    return {
      data: {
        ...(productPayload as any),
        id: savedProductId,
        variants,
        images
      },
      error: null
    };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to save product.' };
  }
}
