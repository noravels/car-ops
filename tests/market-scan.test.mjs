import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeListings, medianOf, statsByYear, budgetCandidates, renderMarketReport } from '../market-scan.mjs';

const RAW = [
  { source: 'arabam.com', year: 2023, km: 26000, price_try: 1015000, city: 'Ankara Sincan', seller_type: 'galeri' },
  { source: 'arabam.com', year: 2023, km: 26000, price_try: 1015000, city: 'Ankara Sincan', seller_type: 'galeri' }, // dup
  { source: 'sahibinden.com', year: 2024, km: 15000, price_try: 1050000, city: 'Gaziantep', seller_type: 'galeri' },
  { source: 'vava.cars', year: 2025, km: 8288, price_try: 1198000, city: null, seller_type: 'kurumsal' },
  { source: 'arabam.com', year: 2026, km: 6001, price_try: 1725000, city: 'Kayseri', seller_type: 'galeri' },
];

test('dedupeListings: aynı ilanı tekilleştirir', () => {
  const d = dedupeListings(RAW);
  assert.equal(d.length, 4);
});

test('medianOf: çift/tek sayıda medyan', () => {
  assert.equal(medianOf([10, 20, 30]), 20);
  assert.equal(medianOf([10, 20, 30, 40]), 25);
});

test('statsByYear: yıl bazında medyan ve adet', () => {
  const s = statsByYear(RAW);
  assert.equal(s['2023'].count, 1);
  assert.equal(s['2023'].median, 1015000);
  assert.equal(s['2024'].median, 1050000);
});

test('budgetCandidates: bütçe üst limitine girenleri medyana göre sırala', () => {
  const c = budgetCandidates(RAW, { cap: 1200000, median: 1198000 });
  assert.ok(c.length >= 2);
  assert.ok(c.every(x => x.price_try <= 1200000));
  // medyanın en çok altında olan ilk sırada
  assert.equal(c[0].price_try, 1015000);
});

test('renderMarketReport: kaynak dağılımı + medyan + adaylar', () => {
  const md = renderMarketReport({ listings: RAW, cap: 1200000, usd_try: 48.73 });
  assert.match(md, /Medyan/);
  assert.match(md, /arabam\.com/);
  assert.match(md, /vava\.cars/);
  assert.match(md, /Bütçe/);
});
