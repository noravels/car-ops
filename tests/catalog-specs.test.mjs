import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCatalog, upsertSpecs, upsertTaxonomy, upsertObserved, suggestModels, catalogStats, specsCoverage, saveCatalogFile, loadCatalogFile, exportSamples } from '../catalog.mjs';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SPECS = [
  { make: 'Fiat', model: 'Egea Cross', body: 'SUV', fuel: 'Dizel', gearbox: 'Otomatik', year: 2026, price_min_try: 1890900, price_max_try: 1999900, variant_count: 4, source: 'oto360' },
  { make: 'Dacia', model: 'Duster', body: 'SUV', fuel: 'Benzin', gearbox: 'Otomatik', year: 2026, price_min_try: 1500000, price_max_try: 1800000, variant_count: 5, source: 'oto360' },
];

const LISTINGS = [
  { make: 'Dacia', model: 'Duster', year: 2015, km: 160000, price_try: 900000, body: 'SUV', fuel: 'Dizel', gearbox: 'Manuel', source: 'sahibinden.com', listing_id: 'a1' },
  { make: 'Dacia', model: 'Duster', year: 2016, km: 150000, price_try: 950000, body: 'SUV', fuel: 'Dizel', gearbox: 'Manuel', source: 'sahibinden.com', listing_id: 'a2' },
];

test('upsertSpecs: teknik özellikleri modele işler (kaynak + lisans alanıyla)', () => {
  const c = upsertSpecs(emptyCatalog(), SPECS);
  const m = c.models['fiat-egea-cross'];
  assert.equal(m.specs.body, 'SUV');
  assert.equal(m.specs.fuel, 'Dizel');
  assert.equal(m.specs.year, 2026);
  assert.equal(m.specs.price_min_try, 1890900);
  assert.equal(m.specs.source, 'oto360');
  assert.equal(c.meta.specs_models, 2);
});

test('specsCoverage: hangi modellerin teknik verisi var', () => {
  let c = upsertSpecs(emptyCatalog(), SPECS);
  c = upsertObserved(c, LISTINGS);
  const cov = specsCoverage(c);
  assert.equal(cov.with_specs, 2);
  assert.equal(cov.without_specs, 0);
  assert.ok(cov.total >= 2);
});

test('suggestModels: teknik özellik varsa gözlemlenen dağılımdan ÖNCE kullanılır', () => {
  let c = upsertSpecs(emptyCatalog(), SPECS);
  c = upsertObserved(c, LISTINGS); // Duster ilanları dizel+manuel gözlemlenmiş
  const sug = suggestModels(c, { fuel: 'Benzin', gearbox: 'Otomatik', body: 'SUV' });
  const duster = sug.find((s) => s.model === 'Duster');
  assert.ok(duster);
  // gözlem dizel/manuel der ama KATALOG teknik verisi benzin/otomatik der → katalog esas
  assert.ok(duster.reasons.some((r) => /katalog|Oto360|teknik/i.test(r)), 'katalog kanıtı gerekçede görünmeli');
  assert.ok(duster.score > 0.5);
});

test('suggestModels: teknik veri yoksa gözlemlenen dağılıma düşer (fallback)', () => {
  const c = upsertObserved(emptyCatalog(), LISTINGS);
  const sug = suggestModels(c, { gearbox: 'Manuel' });
  const duster = sug.find((s) => s.model === 'Duster');
  assert.ok(duster);
  assert.ok(duster.reasons.some((r) => /ilanların %/.test(r)), 'gözlem gerekçesi kullanılmalı');
});

test('suggestModels: katalogda olup ilanı olmayan model de önerilebilir (katalog kaynaklı)', () => {
  const c = upsertSpecs(emptyCatalog(), SPECS);
  const sug = suggestModels(c, { body: 'SUV', fuel: 'Benzin' });
  const duster = sug.find((s) => s.model === 'Duster');
  assert.ok(duster, 'yalnızca katalog verisiyle de öneri üretilmeli');
  assert.equal(duster.evidence.listings, 0);
  assert.equal(duster.evidence.spec_source, 'oto360');
});

test('upsertTaxonomy: sınıflama bilgisi (segment/seri) modele işlenir', () => {
  const c = upsertTaxonomy(emptyCatalog(), [
    { make: 'Fiat', model: 'Egea Cross', series: 'Egea', segment: 'SUV', listing_count: 1477, source: 'sahibinden.com', url: 'https://www.sahibinden.com/fiat-egea-cross' },
  ]);
  const m = c.models['fiat-egea-cross'];
  assert.equal(m.taxonomy.series, 'Egea');
  assert.equal(m.taxonomy.listing_count_hint, 1477);
  assert.equal(m.segment, 'SUV');
});

test('catalogStats: spec ve taxonomy sayıları raporlanır', () => {
  let c = upsertSpecs(emptyCatalog(), SPECS);
  c = upsertTaxonomy(c, [{ make: 'Dacia', model: 'Duster', segment: 'SUV' }]);
  const s = catalogStats(c);
  assert.equal(s.with_specs, 2);
  assert.equal(s.with_taxonomy, 1);
  assert.ok(s.sources.includes('oto360'));
});

test('KALICILIK: örnekler dosyaya yazılır ve yeniden yüklenince istatistikler korunur', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-'));
  const path = join(dir, 'catalog.json');
  let c = upsertObserved(emptyCatalog(), [
    { make: 'Renault', model: 'Clio', year: 2020, km: 60000, price_try: 900000, source: 'sahibinden.com', listing_id: 'a' },
    { make: 'Renault', model: 'Clio', year: 2021, km: 40000, price_try: 1000000, source: 'arabam.com', listing_id: 'b' },
  ]);
  assert.equal(c.models['renault-clio'].observed.listings_count, 2);
  saveCatalogFile(path, c);
  const reloaded = loadCatalogFile(path);
  assert.equal(reloaded.models['renault-clio'].observed.listings_count, 2, 'yeniden yüklemede sayı korunmalı');
  assert.equal(reloaded.models['renault-clio'].observed.price_try.median, 950000);
  // ikinci parti eklenince sayı ARTAR, sıfırlanmaz
  const c2 = upsertObserved(reloaded, [
    { make: 'Renault', model: 'Clio', year: 2022, km: 20000, price_try: 1100000, source: 'sahibinden.com', listing_id: 'c' },
  ]);
  assert.equal(c2.models['renault-clio'].observed.listings_count, 3);
});

test('exportSamples: katalogdan değerleme için karşılaştırma seti çıkarır', () => {
  const c = upsertObserved(emptyCatalog(), [
    { make: 'Fiat', model: 'Egea Cross', year: 2023, km: 26000, price_try: 1015000, source: 'sahibinden.com', listing_id: 'x', variant: '1.4 Fire Urban' },
    { make: 'Fiat', model: 'Egea Cross', year: 2024, km: 42500, price_try: 1025000, source: 'arabam.com', listing_id: 'y', variant: '1.4 Fire Street' },
  ]);
  const rows = exportSamples(c, 'Fiat', 'Egea Cross');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price_try, 1015000);
  assert.equal(rows[0].variant, '1.4 Fire Urban');
});
