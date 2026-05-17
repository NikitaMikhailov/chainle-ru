#!/usr/bin/env node
// Replaces __BUILD_HASH__ in index.html and js/*.js with the current git commit hash.
// Falls back to a timestamp if git is unavailable.
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

let hash;
try {
  hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  hash = Date.now().toString(36);
}

const files = ['index.html', 'js/app.js'];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const updated = content.replaceAll('__BUILD_HASH__', hash);
  if (updated !== content) {
    writeFileSync(file, updated, 'utf8');
    console.log(`${file} → ${hash}`);
  }
}
