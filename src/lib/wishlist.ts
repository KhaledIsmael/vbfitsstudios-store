import { supabase } from './supabaseClient';

export interface WishlistProduct {
  wishlistId: string;   // wishlists.id
  productId: string;    // products.id
  name: string;
  price: number;
  currency: string;
  image: string;
  slug: string;
}

/**
 * Fetches all wishlist entries for a user, joined with product data.
 * Returns an empty array on any error so callers can handle gracefully.
 */
export async function getWishlist(userId: string): Promise<WishlistProduct[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        product_id,
        products (
          id,
          name,
          price,
          currency,
          slug,
          product_images ( url, is_primary, display_order )
        )
      `)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getWishlist Supabase error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => {
      const p = row.products;
      if (!p) return null;

      // Pick primary image, or first image, or placeholder
      const images: Array<{ url: string; is_primary: boolean; display_order: number }> =
        p.product_images || [];
      const sorted = [...images].sort(
        (a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          a.display_order - b.display_order
      );
      const image = sorted[0]?.url || '/assets/products/placeholder.jpeg';

      return {
        wishlistId: row.id,
        productId: p.id,
        name: p.name,
        price: Number(p.price),
        currency: p.currency || 'EGP',
        image,
        slug: p.slug
      } satisfies WishlistProduct;
    }).filter(Boolean) as WishlistProduct[];
  } catch (err) {
    console.warn('getWishlist exception:', err);
    return [];
  }
}

/**
 * Adds a product to the user's wishlist. Silently ignores duplicate-key conflicts.
 */
export async function addToWishlist(
  userId: string,
  productId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('wishlists')
    .insert({ customer_id: userId, product_id: productId });

  if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Removes a product from the user's wishlist by customer_id + product_id.
 */
export async function removeFromWishlist(
  userId: string,
  productId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('wishlists')
    .delete()
    .eq('customer_id', userId)
    .eq('product_id', productId);

  if (error) return { error: error.message };
  return { error: null };
}
