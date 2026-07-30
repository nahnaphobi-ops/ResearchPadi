import { cpSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'blueprints');
const dest = join(root, 'dist', 'blueprints');

if (!existsSync(src)) {
  console.warn('copy-assets: src/blueprints not found — skipping');
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('copy-assets: copied src/blueprints → dist/blueprints');
