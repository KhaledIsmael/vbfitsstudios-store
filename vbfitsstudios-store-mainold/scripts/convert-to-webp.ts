import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function convertImages() {
  const assetsDir = path.resolve(process.cwd(), 'public/assets');
  console.log('Scanning directory for images:', assetsDir);

  const entries = fs.readdirSync(assetsDir, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        const fullPath = path.join(entry.parentPath || entry.path, entry.name);
        const baseName = path.basename(entry.name, ext);
        const dirName = entry.parentPath || entry.path;
        
        const webpPath = path.join(dirName, `${baseName}.webp`);
        const avifPath = path.join(dirName, `${baseName}.avif`);

        const originalStats = fs.statSync(fullPath);

        // Convert to WebP (Quality 85, Near Lossless for graphics)
        await sharp(fullPath)
          .webp({ quality: 85, effort: 6 })
          .toFile(webpPath);
        
        const webpStats = fs.statSync(webpPath);
        const webpReduction = ((1 - webpStats.size / originalStats.size) * 100).toFixed(1);

        // Convert to AVIF (Quality 80)
        await sharp(fullPath)
          .avif({ quality: 80, effort: 6 })
          .toFile(avifPath);

        const avifStats = fs.statSync(avifPath);
        const avifReduction = ((1 - avifStats.size / originalStats.size) * 100).toFixed(1);

        console.log(`\n[OPTIMIZED] ${entry.name} (${(originalStats.size / 1024).toFixed(1)} KB)`);
        console.log(`  -> WebP: ${(webpStats.size / 1024).toFixed(1)} KB (-${webpReduction}%)`);
        console.log(`  -> AVIF: ${(avifStats.size / 1024).toFixed(1)} KB (-${avifReduction}%)`);
      }
    }
  }

  console.log('\nAll images successfully generated in modern WebP & AVIF formats.');
}

convertImages().catch((err) => {
  console.error('Error during image conversion:', err);
  process.exit(1);
});
