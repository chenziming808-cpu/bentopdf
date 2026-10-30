#!/usr/bin/env node
// Copy self-hosted runtime assets (.selfhost-cache/wasm) into dist/wasm.
import { cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, '.selfhost-cache', 'wasm');
const dest = join(root, 'dist', 'wasm');
if (!existsSync(src)) {
  console.error(
    '[selfhost] .selfhost-cache/wasm missing – run scripts/fetch-selfhost-assets.sh first'
  );
  process.exit(1);
}
cpSync(src, dest, { recursive: true });
console.log(`[selfhost] copied ${src} -> ${dest}`);
