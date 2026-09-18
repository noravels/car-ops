import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyCatalog,
  upsertObserved,
  modelFromListing,
  suggestModels,
  renderSuggestions,
  catalogStats,
} from '../catalog.mjs';

const LISTINGS = [
  { make: 'Fiat', model: 'Egea Cross', year: 2023, km: 26000, price_try: 1015000, body: 'Crossover', fuel: 'Benzin', gearbox: 'Manuel' },
  { make: 'Fiat', model: 'Egea Cross', year: 2024, km: 15000, price_try: 1050000, body: 'Sedan', fuel: 'Benzin', gearbox: 'Manuel' },
  { make: 'Fiat', model: 'Egea Cross', year: 2025, km: 8288, price_try: 1198000, body: 'Crossover', fuel: 'Benzin', gearbox: 'Manuel' },
  { make: 'Fiat', model: 'Egea Cross', year: 2023, km: 96000, price_try: 1275000, body: 'Crossover', fuel: 'Hibrit', gearbox: 'Otomatik' },
  { make: 'Renault', model: 'Clio', year: 2021, km: 60000, price_try: 780000, body: 'Hatchback', fuel: 'Benzin', gearbox: 'Otomatik' },
  { make: 'Renault', model: 'Clio', year: 2020, km: 90000, price_try: 700000, body: 'Hatchback', fuel: 'Benzin', gearbox: 'Manuel' },
];

test('emptyCatalog: boş katalog yapısı', () => {
  const c = emptyCatalog();
  assert.deepEqual(c.models, {});
  assert.equal(c.meta.learned_from_listings, 0);
});

test('modelFromListing: marka+model anahtarı üretir', () => {
  assert.equal(modelFromListing({ make: 'Fiat', model: 'Egea Cross' }), 'fiat-egea-cross');
  assert.equal(modelFromListing({ make: 'Mercedes-Benz', model: 'C 200' }), 'mercedes-benz-c-200');
});

test('upsertObserved: ilanlardan gözlemlenen özellikleri biriktirir', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const m = c.models['fiat-egea-cross'];
  assert.equal(m.observed.listings_count, 4);
  assert.deepEqual(m.observed.fuels, { Benzin: 3, Hibrit: 1 });
  assert.deepEqual(m.observed.gearboxes, { Manuel: 3, Otomatik: 1 });
  assert.deepEqual(m.observed.bodies, { Crossover: 3, Sedan: 1 });
  assert.equal(m.observed.year.min, 2023);
  assert.equal(m.observed.year.max, 2025);
  assert.equal(m.observed.price_try.min, 1015000);
  assert.equal(m.observed.price_try.max, 1275000);
  assert.equal(c.meta.learned_from_listings, 6);
});

test('upsertObserved: ikinci kez aynı ilanları eklemek sayacı şişirmez (kaynak+id tekilleştirme)', () => {
  let c = upsertObserved(emptyCatalog(), LISTINGS.map((l, i) => ({ ...l, listing_id: `x-${i}`, source: 'test' })));
  c = upsertObserved(c, LISTINGS.map((l, i) => ({ ...l, listing_id: `x-${i}`, source: 'test' })));
  assert.equal(c.models['fiat-egea-cross'].observed.listings_count, 4, 'tekrar sayılmamalı');
});

test('suggestModels: bütçe + kasa + yakıt kriterine uyan modelleri önerir', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const sug = suggestModels(c, { price_max: 1200000, body: 'Crossover', fuel: 'Benzin' });
  assert.ok(sug.length >= 1);
  assert.equal(sug[0].model, 'Egea Cross');
  assert.ok(sug[0].reasons.some((r) => /Crossover/.test(r)));
  assert.ok(sug[0].score > 0);
});

test('suggestModels: otomatik vites istenirse manuel ağırlıklı model düşük skor alır', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const sug = suggestModels(c, { gearbox: 'Otomatik', price_max: 800000 });
  const clio = sug.find((s) => s.model === 'Clio');
  const egea = sug.find((s) => s.model === 'Egea Cross');
  assert.ok(clio, 'Clio önerilmeli (otomatik gözlemlenmiş)');
  if (egea) assert.ok(clio.score > egea.score, 'otomatik isteğinde Clio daha yüksek skor almalı');
});

test('suggestModels: kanıtsız (gözlemlenmemiş) kriter açıkça belirsiz işaretlenir', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const sug = suggestModels(c, { seats_min: 7 });
  // koltuk bilgisi gözlemlenmedi → skorlama yapılamaz, uydurma yok
  assert.ok(sug.every((s) => s.unknown_attributes.includes('seats_min') || s.score === 0));
});

test('suggestModels: bütçe üstü modeller elenmez, "bütçe üstü" olarak işaretlenir', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const sug = suggestModels(c, { price_max: 600000, body: 'Hatchback' });
  const clio = sug.find((s) => s.model === 'Clio');
  assert.ok(clio);
  assert.equal(clio.budget_fit, false);
  assert.ok(/bütçe/.test(clio.reasons.join(' ')));
});

test('renderSuggestions: gerekçeli metin üretir', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const md = renderSuggestions(suggestModels(c, { price_max: 1200000, body: 'Crossover' }), { criteria: { price_max: 1200000 } });
  assert.match(md, /Egea Cross/);
  assert.match(md, /kanıt|ilan/i);
});

test('catalogStats: katalog özeti', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const s = catalogStats(c);
  assert.equal(s.models, 2);
  assert.equal(s.listings, 6);
  assert.ok(s.sources.includes('observed'));
});
