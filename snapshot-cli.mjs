#!/usr/bin/env node
// snapshot.mjs — bir ilanın anlık değerini jsonl'e append eder.
// Değerleri agent browser'dan okuyup geçirir; bu script siteye gitmez.
//
// kullanım:
//   node snapshot.mjs --id sahibinden-123 --price 800000 [--km 120000] [--usd 19047] [--status aktif]

import { appendSnapshot, readSnapshotFile, shouldWrite } from './snapshot.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function argParse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

const args = argParse(process.argv.slice(2));
if (!args.id) {
  console.error('kullanım: node snapshot.mjs --id <listing-id> --price <TL> [--km N] [--usd N] [--status aktif|kapandi|pasif]');
  process.exit(1);
}
const price = args.price != null && args.price !== '' ? Number(args.price) : null;
const km = args.km != null && args.km !== '' ? Number(args.km) : null;
const usd = args.usd != null && args.usd !== '' ? Number(args.usd) : null;
const status = args.status || 'aktif';

mkdirSync('data/snapshots', { recursive: true });
const file = resolve('data/snapshots', `${args.id}.jsonl`);
const existing = readSnapshotFile(file);
const now = new Date();
const today = now.toISOString().slice(0, 10);

if (!shouldWrite(existing, price, km, status, today)) {
  console.log('atlandı: bugün için değişiklik yok');
  process.exit(0);
}

appendSnapshot(file, now.toISOString(), price, usd, km, status);
console.log(`snapshot yazıldı: ${file} (${today} / ${price ?? '?'} TL / ${status})`);
