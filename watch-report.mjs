#!/usr/bin/env node
// watch-report.mjs — data/snapshots/*.jsonl üzerinden satıcı davranış karnesi.
// Watchlist'teki her ilan için özet üretir; raporlara D/E bloğu girdisi olur.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSnapshots, summarize, renderSummary } from './seller-signals.mjs';

const dir = resolve('data/snapshots');
if (!existsSync(dir)) {
  console.log('data/snapshots/ yok — önce snapshot toplayın (node snapshot-cli.mjs)');
  process.exit(0);
}

const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
if (!files.length) {
  console.log('snapshot dosyası yok.');
  process.exit(0);
}

for (const f of files) {
  const id = f.replace(/\.jsonl$/, '');
  const snaps = parseSnapshots(readFileSync(resolve(dir, f), 'utf8'));
  const sum = summarize(snaps, new Date().toISOString());
  console.log(`\n## ${id}`);
  console.log(renderSummary(sum));
}
