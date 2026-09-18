import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildComparison, renderComparisonHtml, renderComparisonMarkdown, loadCandidates } from '../report-export.mjs';
import { emptyCatalog, upsertObserved } from '../catalog.mjs';
import { ASSUMPTION_FACTORS } from '../valuation.mjs';

// Gerçekçi karşılaştırma seti (Egea Cross bandı)
const pool = [
  { year: 2023, km: 26000, price_try: 1015000, variant: '1.4 Fire Urban', make: 'Fiat', model: 'Egea Cross', source: 'sahibinden.com', listing_id: 'p1' },
  { year: 2023, km: 41000, price_try: 1065000, variant: '1.4 Fire Urban', make: 'Fiat', model: 'Egea Cross', source: 'arabam.com', listing_id: 'p2' },
  { year: 2023, km: 18000, price_try: 1115000, variant: '1.4 Fire Street', make: 'Fiat', model: 'Egea Cross', source: 'arabam.com', listing_id: 'p3' },
  { year: 2024, km: 42500, price_try: 1025000, variant: '1.4 Fire Street', make: 'Fiat', model: 'Egea Cross', source: 'vava.cars', listing_id: 'p4' },
  { year: 2023, km: 52000, price_try: 985000, variant: '1.4 Fire Urban', make: 'Fiat', model: 'Egea Cross', source: 'sahibinden.com', listing_id: 'p5' },
  { year: 2023, km: 31000, price_try: 1080000, variant: '1.4 Fire Urban', make: 'Fiat', model: 'Egea Cross', source: 'carvak.com', listing_id: 'p6' },
];

const candidates = [
  {
    id: 'R004',
    label: '2023 Urban · Ankara',
    make: 'Fiat',
    model: 'Egea Cross',
    variant: '1.4 Fire',
    year: 2023,
    km: 26000,
    price_try: 1015000,
    tramer_try: 38000,
    tramer_year: 2023,
    painted_parts: 2,
    changed_parts: 1,
    expertise: 'yok',
    description: 'HARİCİ HATASIZ BOYASIZ DEĞİŞENSİZDİR',
    city: 'Ankara',
    source: 'sahibinden.com',
    url: 'https://www.sahibinden.com/ilan/1340705293',
  },
  {
    id: 'R007',
    label: '2025 Urban · İstanbul (vava)',
    make: 'Fiat',
    model: 'Egea Cross',
    variant: '1.4 Fire',
    year: 2024,
    km: 8288,
    price_try: 1198000,
    painted_parts: 0,
    changed_parts: 0,
    expertise: 'var',
    description: 'Boyasız değişensiz tramersiz',
    city: 'İstanbul',
    source: 'vava.cars',
    url: 'https://tr.vava.cars/buy/cars/x',
  },
];

function catalogWithPool() {
  return upsertObserved(emptyCatalog(), pool);
}

test('buildComparison: her aday için adil değer, karar ve flag üretir', () => {
  const rows = buildComparison(candidates, catalogWithPool());
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.ok(r.id);
    assert.ok(r.fair_value_try > 500000, `${r.id}: adil değer hesaplanmalı`);
    assert.ok(r.verdict && r.verdict.band);
    assert.ok(Array.isArray(r.flags));
    assert.ok(r.confidence && r.confidence.level);
    assert.ok(r.sample_size >= 1);
  }
});

test('buildComparison: adaylar sapmaya göre sıralanır (en iyi fırsat önce)', () => {
  const rows = buildComparison(candidates, catalogWithPool());
  const devs = rows.map((r) => r.deviation_pct);
  assert.deepEqual(devs, [...devs].sort((a, b) => a - b), 'artan sapma sırası beklenir');
});

test('buildComparison: karşılaştırma setine adayın kendisi girmez', () => {
  const rows = buildComparison([candidates[0]], catalogWithPool());
  const r = rows[0];
  // aday 1.015.000 TL; setten çıkarılmasa medyan aşağı çekilirdi
  assert.ok(r.sample_size <= pool.length, 'örneklem havuzdan büyük olamaz');
});

test('buildComparison: veri yoksa dürüstçe hesaplanamadı der', () => {
  const rows = buildComparison([{ ...candidates[0], make: 'Yokmarka', model: 'Yokmodel' }], emptyCatalog());
  assert.equal(rows[0].fair_value_try, null);
  assert.match(rows[0].decision_label, /veri|hesaplanamadı/i);
});

test('buildComparison: kalite sütunları (tramer/boya/ekspertiz) taşınır', () => {
  const rows = buildComparison(candidates, catalogWithPool());
  const r004 = rows.find((r) => r.id === 'R004');
  assert.equal(r004.condition.tramer_ref_try > 0, true);
  assert.equal(r004.condition.painted_parts, 2);
  assert.equal(r004.condition.expertise, 'yok');
});

test('renderComparisonHtml: tablo, karar etiketi, flag ve kaynak bilgisi içerir', () => {
  const rows = buildComparison(candidates, catalogWithPool());
  const html = renderComparisonHtml(rows, { generatedAt: '2026-09-19', title: 'Egea Cross aday karşılaştırması' });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Egea Cross aday karşılaştırması/);
  assert.match(html, /Adil değer/);
  assert.match(html, /R004/);
  assert.match(html, /tramer/i);
  assert.match(html, /print/i, 'yazdırma için stil olmalı');
  assert.match(html, /uydurma değer üretilmez|karar insana aittir/i, 'yasal/etik dipnot bulunmalı');
});

test('renderComparisonHtml: HTML kaçışı yapılır (not/URL içeriği etiketi bozmaz)', () => {
  const rows = buildComparison(
    [
      {
        ...candidates[0],
        note: '<script>alert(1)</script>',
        url: 'https://example.com/?a=1&b="2"',
        description: '<img src=x onerror=alert(2)> hatasız boyasız',
      },
    ],
    catalogWithPool(),
  );
  const html = renderComparisonHtml(rows, {});
  assert.ok(!html.includes('<script>alert(1)</script>'), 'script etiketi kaçışsız kalmamalı');
  assert.match(html, /&lt;script&gt;/, 'kaçışlı biçim görünmeli');
  assert.ok(!html.includes('<img src=x'), 'img etiketi kaçışsız kalmamalı');
});

test('renderComparisonMarkdown: markdown tablo üretir', () => {
  const rows = buildComparison(candidates, catalogWithPool());
  const md = renderComparisonMarkdown(rows, { generatedAt: '2026-09-19' });
  assert.match(md, /^\|.*Aday/m);
  assert.match(md, /R007/);
});

test('loadCandidates: aday listesi dosyasını okur ve normalize eder', () => {
  const list = loadCandidates({ candidates: candidates.slice(0, 1) });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'R004');
  const bare = loadCandidates([{ price_try: 900000, year: 2020, km: 50000 }]);
  assert.equal(bare.length, 1);
  assert.ok(bare[0].id, 'id yoksa üretilmeli');
});

test('buildComparison: ekspertiz yokluğu değeri düşürmez ama güveni düşürür', () => {
  const rows = buildComparison(candidates, catalogWithPool());
  const r004 = rows.find((r) => r.id === 'R004');
  const r007 = rows.find((r) => r.id === 'R007');
  assert.ok(r004.confidence.score <= r007.confidence.score, 'ekspertizsiz adayın güveni daha düşük olmalı');
  assert.ok(!r004.adjustments.some((a) => a.name === 'ekspertiz:yok' && a.pct < 0), 'ekspertiz yokluğu değer düşürmemeli');
});
