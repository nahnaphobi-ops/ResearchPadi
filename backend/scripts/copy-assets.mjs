import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Non-TypeScript files the compiled code reads at runtime: tsc doesn't copy them.
const ASSETS = [
  'blueprints',
  // Editable model prices for the AI review stage (services/review/pricing.ts).
  'services/review/pricing.json',
];

for (const path of ASSETS) {
  const src = join(root, 'src', path);
  const dest = join(root, 'dist', path);
  if (!existsSync(src)) {
    console.warn(`copy-assets: src/${path} not found — skipping`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`copy-assets: copied src/${path} → dist/${path}`);
}
