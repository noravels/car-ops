import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRateLimited,
  backoffSchedule,
  buildFilterUrl,
  humanPacing,
} from '../providers/rate-guard.mjs';

test('isRateLimited: rate-limit DOM/uRL tespiti', () => {
  const blockHtml = '<div class="error-page-container too-many-requests">Olağan dışı erişim</div>';
  assert.equal(isRateLimited({ url: 'https://www.sahibinden.com/', html: '<x>ok</x>' }), false);
  assert.equal(isRateLimited({ url: 'https://www.sahibinden.com/olagandisi-kullanim', html: '' }), true);
  assert.equal(isRateLimited({ url: 'https://www.sahibinden.com/', html: blockHtml }), true);
  assert.equal(isRateLimited({ url: 'https://www.sahibinden.com/', html: '<b>Olağan dışı erişim</b>' }), true);
});

test('backoffSchedule: 15 dk dilimli sınır tekerrürleri', () => {
  const s = backoffSchedule({ chunk_seconds: 900, retries: 2 });
  assert.deepEqual(s, [900, 900]);
});

test('buildFilterUrl: filter param PLL — sahibinden query_str kurar', () => {
  const u = buildFilterUrl({
    base: 'https://www.sahibinden.com/otomobel-fiat-egea',
    filters: { a109_max: 2, a5_min: 2022, price_max: 1200000 },
  });
  assert.ok(u.includes('a109_max=2'));
  assert.ok(u.includes('a5_min=2022'));
  assert.ok(u.includes('price_max=1200000'));
});

test('humanPacing: hiren age側 randum range', () => {
  const d = humanPacing({ min_s: 20, max_s: 30 });
  assert.ok(d >= 20 && d <= 30);
});
