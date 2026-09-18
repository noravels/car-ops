import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffUrls, inferParamMap, renderSuggestedPatch } from '../learn-params.mjs';

const BASE = 'https://www.sahibinden.com/fiat-egea-cross';

test('diffUrls: filtrelenmiş URL ile taban arasındaki farkı çıkarır', () => {
  const d = diffUrls(BASE, 'https://www.sahibinden.com/fiat-egea-cross?a8=12345');
  assert.deepEqual(d.queryAdded, [{ key: 'a8', value: '12345' }]);
  assert.deepEqual(d.queryRemoved, []);
  assert.deepEqual(d.pathSuffix, null);
});

test('diffUrls: yol eki farkını yakalar (ör. -otomatik)', () => {
  const d = diffUrls(BASE, 'https://www.sahibinden.com/fiat-egea-cross-otomatik');
  assert.equal(d.pathSuffix, 'otomatik');
});

test('inferParamMap: bilinmeyen yeni parametreyi filtre anahtarına bağlar', () => {
  const rows = [
    { filter: 'gearbox', base: BASE, filtered: 'https://www.sahibinden.com/fiat-egea-cross?a8=1', value: '1' },
    { filter: 'fuel', base: BASE, filtered: 'https://www.sahibinden.com/fiat-egea-cross?a9=2', value: '2' },
  ];
  const map = inferParamMap(rows, { known: { gearbox: null, fuel: null } });
  assert.equal(map.gearbox.param, 'a8');
  assert.equal(map.fuel.param, 'a9');
  assert.equal(map.gearbox.strategy, 'query');
  assert.equal(map.gearbox.verified, true);
});

test('inferParamMap: yol ekini path stratejisi olarak işaretler', () => {
  const rows = [{ filter: 'gearbox', base: BASE, filtered: 'https://www.sahibinden.com/fiat-egea-cross-otomatik', value: 'otomatik' }];
  const map = inferParamMap(rows, { known: {} });
  assert.equal(map.gearbox.strategy, 'path');
  assert.equal(map.gearbox.encode, 'suffix');
  assert.equal(map.gearbox.value_sample, 'otomatik');
});

test('inferParamMap: fark yoksa filtreyi postfilter olarak önerir (uydurma yok)', () => {
  const rows = [{ filter: 'color', base: BASE, filtered: BASE, value: 'beyaz' }];
  const map = inferParamMap(rows, { known: {} });
  assert.equal(map.color.strategy, 'postfilter');
  assert.match(map.color.reason, /fark bulunamadı|URL'de/);
});

test('renderSuggestedPatch: filters.json için uygulanabilir JSON parçası üretir', () => {
  const rows = [{ filter: 'gearbox', base: BASE, filtered: 'https://www.sahibinden.com/fiat-egea-cross?a8=1', value: '1' }];
  const map = inferParamMap(rows, { known: {} });
  const patch = renderSuggestedPatch('sahibinden', map);
  const parsed = JSON.parse(patch);
  assert.equal(parsed.providers.sahibinden.map.gearbox.param, 'a8');
  assert.equal(parsed.providers.sahibinden.map.gearbox.verified, true);
});

test('diffUrls: mevcut parametre değeri değiştiyse queryChanged olarak raporlar', () => {
  const d = diffUrls('https://www.sahibinden.com/fiat-egea-cross?price_max=1000', 'https://www.sahibinden.com/fiat-egea-cross?price_max=2000');
  assert.deepEqual(d.queryChanged, [{ key: 'price_max', from: '1000', to: '2000' }]);
});
