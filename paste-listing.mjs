#!/usr/bin/env node
// paste-listing.mjs — paste modu: stdin'den ilan HTML'i al → ListingRecord →
// data/listings/<id>.md kaydı. Bot korumalı sitelerde birincil veri yolu:
// kullanıcı ilanı browser'ında açar, HTML'i kopyalar, buraya yapıştırır.
//
// kullanım:
//   node paste-listing.mjs --site sahibinden [--url https://...] < kayit.html
//   node paste-listing.mjs --record ilan.json        # agent ListingRecord JSON'unu doğrudan yazar

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSahibindenHtml, renderListingMd, listingUrlPattern } from './providers/sahibinden.mjs';

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

let rec;
if (args.record) {
  rec = JSON.parse(readFileSync(args.record, 'utf8'));
} else {
  let site = args.site || 'sahibinden';
  if (args.url && site === 'sahibinden' && !listingUrlPattern.test(args.url)) {
    console.error('UYARI: URL sahibinden ilan deseniyle eşleşmiyor, yine de sahibinden parser kullanılacak.');
  }
  if (site !== 'sahibinden') {
    console.error(`bilinmeyen site: ${site} — şimdilik sahibinden var. providers/base.md'e yeni provider ekleyin.`);
    process.exit(1);
  }
  const html = readFileSync(0, 'utf8'); // stdin
  if (!html.trim()) {
    console.error('stdin boş: ilan HTML\'ini yapıştırın (kullanım: ... < kayit.html)');
    process.exit(1);
  }
  rec = parseSahibindenHtml(html, {
    url: args.url || null,
    captured_at: new Date().toISOString(),
  });
}

if (!rec.listing_id) {
  console.error('listing_id çıkarılamadı — --url verin veya HTML\'de ilan no olduğundan emin olun.');
  process.exit(1);
}

mkdirSync('data/listings', { recursive: true });
const mdPath = resolve('data/listings', `${rec.listing_id}.md`);
const jsonPath = resolve('data/listings', `${rec.listing_id}.json`);

if (existsSync(mdPath) && !args.force) {
  console.error(`DOSYA VAR: ${mdPath} — üzerine yazmak için --force`);
  process.exit(1);
}

writeFileSync(mdPath, renderListingMd(rec), 'utf8');
writeFileSync(jsonPath, JSON.stringify(rec, null, 2) + '\n', 'utf8');
console.log(`kaydedildi: ${mdPath}`);
console.log(`kaydedildi: ${jsonPath}`);
console.log(`id: ${rec.listing_id} | fiyat: ${rec.price_try ?? 'bilinmiyor'} | iddia sayısı: ${rec.claims.length}`);
