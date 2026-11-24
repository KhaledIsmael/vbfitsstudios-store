import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getOptimizedImageUrl,
  DEFAULT_PRODUCT_FALLBACK,
  DEFAULT_HERO_FALLBACK,
} from '../lib/image';

describe('Storage Polish & Safety Invariants', () => {
  it('does NOT fallback to hardcoded production Supabase project when VITE_SUPABASE_URL is missing', () => {
    // When a relative path is passed without VITE_SUPABASE_URL configured
    const result = getOptimizedImageUrl('products/test-shirt.webp');
    expect(result).not.toContain('nsdurxslkhxqjwlbcpxc.supabase.co');
    expect(result).toBe(DEFAULT_PRODUCT_FALLBACK);

    const heroResult = getOptimizedImageUrl('hero/test-banner.webp');
    expect(heroResult).not.toContain('nsdurxslkhxqjwlbcpxc.supabase.co');
    expect(heroResult).toBe(DEFAULT_HERO_FALLBACK);
  });

  it('ensures secret server keys are never exposed with VITE_ prefix in client files', () => {
    const srcDir = path.resolve(__dirname, '..');
    const walkFiles = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          if (!fullPath.includes('node_modules') && !fullPath.includes('dist') && !fullPath.includes('__tests__')) {
            results = results.concat(walkFiles(fullPath));
          }
        } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const files = walkFiles(srcDir);
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      expect(content).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
      expect(content).not.toContain('VITE_PAYMOB_HMAC_SECRET');
      expect(content).not.toContain('VITE_PAYMOB_API_KEY');
      expect(content).not.toContain('VITE_CRON_SECRET');
    }
  });

  it('hero brand assets exist in both public/assets/hero and assets/hero', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const publicHeroWebp = path.join(rootDir, 'public/assets/hero/hero.webp');
    const mirrorHeroWebp = path.join(rootDir, 'assets/hero/hero.webp');

    expect(fs.existsSync(publicHeroWebp)).toBe(true);
    expect(fs.existsSync(mirrorHeroWebp)).toBe(true);

    const publicSize = fs.statSync(publicHeroWebp).size;
    const mirrorSize = fs.statSync(mirrorHeroWebp).size;

    expect(publicSize).toBeGreaterThan(10000);
    expect(publicSize).toBe(mirrorSize);
  });

  it('vercel.json restricts wildcard CORS from administrative and cron endpoints', () => {
    const vercelConfigPath = path.resolve(__dirname, '../../vercel.json');
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));

    const corsHeaderConfig = vercelConfig.headers.find(
      (h: any) => h.headers?.some((item: any) => item.key === 'Access-Control-Allow-Origin')
    );

    expect(corsHeaderConfig).toBeDefined();
    // Must NOT be broad /api/(.*)
    expect(corsHeaderConfig.source).not.toBe('/api/(.*)');
    // Must explicitly scope to allowed public endpoints
    expect(corsHeaderConfig.source).toContain('contact');
    expect(corsHeaderConfig.source).not.toContain('cron');
  });

  it('webhook preserves existing order notes when recording Paymob updates', () => {
    const webhookPath = path.resolve(__dirname, '../../api/paymob/webhook.ts');
    const content = fs.readFileSync(webhookPath, 'utf8');

    // Asserts that existing notes are fetched and preserved
    expect(content).toContain('existingOrder?.notes');
    expect(content).toContain('${existingOrder.notes} | ${paymobNote}');
  });

  it('admin auth rejects arbitrary admin@ emails without verified DB role', () => {
    const adminAuthPath = path.resolve(__dirname, '../context/AdminAuthContext.tsx');
    const content = fs.readFileSync(adminAuthPath, 'utf8');

    // cleanEmail.startsWith('admin@') must NOT be present
    expect(content).not.toContain("cleanEmail.startsWith('admin@')");
  });
});
