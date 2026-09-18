import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSnapshots,
  detectDrops,
  isRealDrop,
  detectRepost,
  summarize,
} from '../seller-signals.mjs';

const mk = (ts, price_try, price_usd_equiv = null, km = null, status = 'aktif') =>
  JSON.stringify({ ts, price_try, price_usd_equiv, km, status });

test('parseSnapshots: jsonl satırlarını sıralı okur, bozuk satırı atar', () => {
  const lines = [
    mk('2026-09-01T10:00:00Z', 900000),
    'bu satır bozuk',
    mk('2026-09-05T10:00:00Z', 870000),
  ];
  const s = parseSnapshots(lines.join('\n'));
  assert.equal(s.length, 2);
  assert.equal(s[0].price_try, 900000);
});

test('detectDrops: fiyat düşüşlerini tespit eder, yüzdesiyle', () => {
  const s = parseSnapshots([
    mk('2026-08-01T10:00:00Z', 900000),
    mk('2026-08-10T10:00:00Z', 900000),   // değişim yok
    mk('2026-08-20T10:00:00Z', 850000),   // -5.56%
    mk('2026-09-01T10:00:00Z', 800000),   // -5.88%
  ].join('\n'));
  const d = detectDrops(s);
  assert.equal(d.length, 2);
  assert.equal(d[0].from, 900000);
  assert.equal(d[0].to, 850000);
  assert.ok(Math.abs(d[0].pct - 5.56) < 0.01);
});

test('isRealDrop: TL düşüşü kur artışının altındaysa gerçek indirim değildir', () => {
  // TL -%5 ama USD eşdeğeri +%2 → gerçek düşüş yok
  assert.equal(isRealDrop(900000, 855000, 100000, 102000), false);
  // TL -%5, USD -%3 → gerçek düşüş
  assert.equal(isRealDrop(900000, 855000, 100000, 97000), true);
  // USD verisi yoksa TL düşüşü kabul edilir (temkinli varsayılan)
  assert.equal(isRealDrop(900000, 855000, null, null), true);
});

test('detectRepost: 30+ gün ara + fiyat sıfırlama = yeniden yayın şüphesi', () => {
  const gap = parseSnapshots([
    mk('2026-06-01T10:00:00Z', 800000),
    mk('2026-08-15T10:00:00Z', 880000),   // araya 75 gün, fiyat fırladı
  ].join('\n'));
  assert.equal(detectRepost(gap), true);
  const normal = parseSnapshots([
    mk('2026-08-01T10:00:00Z', 800000),
    mk('2026-08-15T10:00:00Z', 820000),
  ].join('\n'));
  assert.equal(detectRepost(normal), false);
});

test('summarize: tam karne — düşüş sayısı, oran, ilan yaşı, sinyal', () => {
  const now = '2026-09-18T10:00:00Z';
  const s = parseSnapshots([
    mk('2026-08-01T10:00:00Z', 900000, 10714),
    mk('2026-08-20T10:00:00Z', 850000, 10119),
    mk('2026-09-10T10:00:00Z', 800000, 9524),
  ].join('\n'));
  const sum = summarize(s, now);
  assert.equal(sum.count, 3);
  assert.equal(sum.drops_count, 2);
  assert.equal(sum.first_price, 900000);
  assert.equal(sum.last_price, 800000);
  assert.ok(Math.abs(sum.total_drop_pct - 11.11) < 0.01);
  assert.ok(Math.abs(sum.total_drop_pct_usd - 11.11) < 0.01);
  assert.equal(sum.real_drop, true);
  assert.ok(sum.listing_age_days >= 47);
  assert.equal(sum.signal, 'duzenli-indiriyor');
});

test('summarize: tek snapshot → sinyal yok, veri eksikliği söylenir', () => {
  const s = parseSnapshots(mk('2026-09-17T10:00:00Z', 800000));
  const sum = summarize(s, '2026-09-18T10:00:00Z');
  assert.equal(sum.drops_count, 0);
  assert.equal(sum.signal, 'yetersiz-veri');
});

test('summarize: ilan kaldırılmışsa status yansır', () => {
  const s = parseSnapshots([
    mk('2026-08-01T10:00:00Z', 900000),
    mk('2026-09-01T10:00:00Z', 900000, null, null, 'kapandi'),
  ].join('\n'));
  const sum = summarize(s, '2026-09-18T10:00:00Z');
  assert.equal(sum.last_status, 'kapandi');
});
