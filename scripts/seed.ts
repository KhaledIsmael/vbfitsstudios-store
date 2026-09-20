import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from '../src/config/assets';

// Attempt to parse .env file if environment variables aren't already set in process.env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
  console.error('\n❌ Error: Missing or placeholder Supabase credentials.');
  console.error(
    'Please set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in your .env file.\n'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log('✨ Starting VB Fits Studios Supabase Product Seed...\n');

  try {
    // 1. Seed Category
    console.log('📁 Seeding categories...');
    const { data: category, error: catError } = await supabase
      .from('categories')
      .upsert(
        {
          name: 'Long Sleeve',
          slug: 'long-sleeve',
          description:
            'Luxury ready-to-wear heavyweight long sleeve silhouettes with signature motifs.',
          image_url: '/assets/products/black-shirt.jpeg',
          display_order: 1
        },
        { onConflict: 'slug' }
      )
      .select()
      .single();

    if (catError) {
      console.error('Error inserting category:', catError.message);
      throw catError;
    }
    console.log(`   ✓ Category ready: "${category.name}" (ID: ${category.id})\n`);

    // 2. Seed Products
    console.log(`📦 Seeding ${PRODUCTS.length} products from assets.ts...`);
    let seededCount = 0;

    for (const prod of PRODUCTS) {
      console.log(`\n→ Processing product: "${prod.name}" (${prod.id})`);

      // Upsert product record
      const { data: productRow, error: prodError } = await supabase
        .from('products')
        .upsert(
          {
            slug: prod.id,
            category_id: category.id,
            name: prod.name,
            subtitle: prod.subtitle || null,
            description: prod.description,
            price: prod.price,
            currency: prod.currency === '$' ? 'USD' : prod.currency,
            featured: prod.featured,
            is_new_arrival: prod.isNewArrival ?? false,
            is_published: true,
            details: prod.details,
            fabric_care: prod.fabricCare,
            shipping_info: prod.shippingInfo
          },
          { onConflict: 'slug' }
        )
        .select()
        .single();

      if (prodError) {
        console.error(`   ✗ Error inserting product ${prod.id}:`, prodError.message);
        continue;
      }

      console.log(`   ✓ Product record saved (UUID: ${productRow.id})`);

      // 3. Seed Variants
      const variantsToUpsert = prod.sizes.map((size) => {
        const sku = `${prod.id}-${size.toLowerCase()}`.replace(/[^a-zA-Z0-9_-]/g, '-');
        const colorHex =
          prod.colorsAvailable?.find((c) => c.name === prod.color)?.hex || '#111111';
        return {
          product_id: productRow.id,
          size,
          color: prod.color,
          color_hex: colorHex,
          stock: 30,
          sku
        };
      });

      const { data: variants, error: varError } = await supabase
        .from('product_variants')
        .upsert(variantsToUpsert, { onConflict: 'sku' })
        .select();

      if (varError) {
        console.error(`   ✗ Error inserting variants for ${prod.id}:`, varError.message);
      } else {
        console.log(`   ✓ ${variants?.length || 0} variants created (${prod.sizes.join(', ')})`);
      }

      // 4. Seed Images
      // Delete existing product images to avoid duplicate rows upon re-seeding
      await supabase.from('product_images').delete().eq('product_id', productRow.id);

      const imagesToInsert = prod.images.map((url, idx) => ({
        product_id: productRow.id,
        url,
        alt_text: `${prod.name} Editorial Photograph ${idx + 1}`,
        display_order: idx,
        is_primary: idx === 0
      }));

      const { data: images, error: imgError } = await supabase
        .from('product_images')
        .insert(imagesToInsert)
        .select();

      if (imgError) {
        console.error(`   ✗ Error inserting images for ${prod.id}:`, imgError.message);
      } else {
        console.log(`   ✓ ${images?.length || 0} product images registered`);
      }

      seededCount++;
    }

    console.log(`\n🎉 Successfully seeded ${seededCount} products into Supabase!\n`);
  } catch (err: any) {
    console.error('\n❌ Seed operation failed:', err?.message || err);
    process.exit(1);
  }
}

seedDatabase();
