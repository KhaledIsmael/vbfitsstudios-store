import { supabase } from './supabaseClient';
import { PRODUCTS, type Product } from '../config/assets';

export interface SearchProductResult {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  color: string;
  images: string[];
  similarity_score?: number;
}

/**
 * Searches the catalog via Postgres pg_trgm full-text search RPC.
 * Typo-tolerant: searches titles, categories, colors, and descriptions.
 * Falls back to in-memory matching if the Supabase RPC is temporarily unavailable.
 */
export async function searchProducts(
  query: string,
  limit: number = 12
): Promise<Product[]> {
  const clean = query.trim();
  if (!clean) return [];

  try {
    const { data, error } = await supabase.rpc('search_products', {
      search_query: clean,
      max_results: limit
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row: SearchProductResult) => {
        const fallbackProd = PRODUCTS.find((p) => p.id === row.id || p.id === row.slug);
        return {
          id: row.id,
          name: row.name,
          subtitle: row.subtitle || fallbackProd?.subtitle,
          price: Number(row.price),
          currency: row.currency || '$',
          category: (row.category?.toLowerCase() || fallbackProd?.category || 'tops') as any,
          featured: fallbackProd?.featured ?? false,
          isNewArrival: fallbackProd?.isNewArrival ?? false,
          images: Array.isArray(row.images) && row.images.length > 0
            ? row.images
            : (fallbackProd?.images || ['/assets/products/black-shirt.jpeg']),
          color: row.color || fallbackProd?.color || 'Standard',
          colorsAvailable: fallbackProd?.colorsAvailable || [],
          sizes: fallbackProd?.sizes || ['S', 'M', 'L', 'XL'],
          description: row.description || fallbackProd?.description || '',
          details: fallbackProd?.details || [],
          fabricCare: fallbackProd?.fabricCare || [],
          shippingInfo: fallbackProd?.shippingInfo || 'Complimentary express shipping on orders over $250.'
        };
      });
    }

    if (error) {
      console.warn('Postgres search_products RPC notice (falling back to local fuzzy):', error.message);
    }
  } catch (err) {
    console.warn('searchProducts exception (falling back to local fuzzy):', err);
  }

  // Local fallback: case-insensitive multi-field search
  const q = clean.toLowerCase();
  return PRODUCTS.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.color.toLowerCase().includes(q) ||
      (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
      p.description.toLowerCase().includes(q)
    );
  }).slice(0, limit);
}

/**
 * Fetches dynamic search suggestion pills backed by real categories, colors,
 * and featured silhouettes in Supabase.
 */
export async function fetchSearchSuggestions(limit: number = 6): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_search_suggestions', {
      max_suggestions: limit
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      const suggestions = data
        .map((r: any) => (typeof r === 'string' ? r : r.suggestion))
        .filter(Boolean);

      if (suggestions.length > 0) {
        return suggestions;
      }
    }
  } catch (err) {
    console.warn('fetchSearchSuggestions exception (falling back to catalog extraction):', err);
  }

  // Fallback: extract distinct categories and colors from PRODUCTS
  const dynamicSet = new Set<string>();
  PRODUCTS.forEach((p) => {
    if (p.category) dynamicSet.add(p.category.replace(/-/g, ' ').toUpperCase());
    if (p.color) dynamicSet.add(p.color);
    if (p.name) dynamicSet.add(p.name.split('—')[0].trim());
  });

  return Array.from(dynamicSet).slice(0, limit);
}
