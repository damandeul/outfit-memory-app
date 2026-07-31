import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(process.cwd(), 'src/styles.css');
const packagePath = resolve(process.cwd(), 'package.json');

describe('privacy boundary', () => {
  it('does not load remote styles, fonts, or assets', () => {
    const css = readFileSync(sourcePath, 'utf8');
    expect(css).not.toMatch(/@import\s+url\(['"]?https?:\/\//i);
    expect(css).not.toMatch(/url\(['"]?https?:\/\//i);
  });

  it('builds production assets before independent QA', () => {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:qa']).toMatch(/^npm run build\s*&&\s*playwright test -c playwright\.qa\.config\.ts$/);
  });

  it('keeps one authoritative TypeScript config per tool', () => {
    expect(existsSync(resolve(process.cwd(), 'vite.config.js'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'playwright.config.js'))).toBe(false);
  });

  it('does not reuse an unrelated server during core E2E', () => {
    const config = readFileSync(resolve(process.cwd(), 'playwright.config.ts'), 'utf8');
    expect(config).toContain('reuseExistingServer:false');
  });
});
