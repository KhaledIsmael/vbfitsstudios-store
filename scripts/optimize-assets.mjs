import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ASSETS = [
  {
    input: 'public/assets/hero/hero.webp',
    widths: [480, 800],
    quality: 80,
  },
  {
    input: 'public/assets/products/black-shirt.webp',
    widths: [480, 800],
    quality: 82,
  },
  {
    input: 'public/assets/products/white-shirt.webp',
    widths: [480, 800],
    quality: 82,
  },
];

async function run() {
  for (const asset of ASSETS) {
    if (!fs.existsSync(asset.input)) continue;
    const ext = path.extname(asset.input);
    const base = asset.input.slice(0, -ext.length);
    const meta = await sharp(asset.input).metadata();

    for (const w of asset.widths) {
      if (meta.width && w >= meta.width) continue;
      const outPath = `${base}-${w}w.webp`;
      await sharp(asset.input)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: asset.quality })
        .toFile(outPath);
      const stat = fs.statSync(outPath);
      console.log(`Generated ${outPath} (${stat.size} bytes)`);
    }
  }
}

run().catch((err) => {
  console.error('optimize-assets failed:', err);
  process.exit(1);
});
