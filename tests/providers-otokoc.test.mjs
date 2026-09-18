import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOtokocRow, otokocUrlPattern, otokocModelUrl, renderOtokocRow } from '../providers/otokoc.mjs';

const ROW = 'FIAT DOBLO CARGO SAFELINE2020 Model, Beyaz119.578 kmDizelManuelSamsunFIAT-DOBLO COMBİ-1.3 95 HP MJET EU6D SAFELINE COMBI ESP18.09.2026780.000 TL';

test('otokocUrlPattern ikinci-el ilan ve model yollarını tanır', () => {
  assert.ok(otokocUrlPattern.test('https://www.otokocikinciel.com/ikinci-el/fiat'));
  assert.ok(otokocUrlPattern.test('https://www.otokocikinciel.com/ikinci-el/fiat/egea-cross'));
  assert.ok(!otokocUrlPattern.test('https://www.arabam.com/ikinci-el/otomobil/fiat'));
});

test('otokocModelUrl: marka/model yolu kurar', () => {
  assert.equal(otokocModelUrl('fiat', 'egea-cross'), 'https://www.otokocikinciel.com/ikinci-el/fiat/egea-cross');
  assert.equal(otokocModelUrl('Fiat'), 'https://www.otokocikinciel.com/ikinci-el/fiat');
});

test('parseOtokocRow: yıl/km/yakıt/vites/şehir/fiyat/tarih çıkarır', () => {
  const r = parseOtokocRow(ROW, { url: 'https://www.otokocikinciel.com/ilan/x-71265' });
  assert.equal(r.year, 2020);
  assert.equal(r.km, 119578);
  assert.equal(r.fuel, 'Dizel');
  assert.equal(r.gearbox, 'Manuel');
  assert.equal(r.city, 'Samsun');
  assert.equal(r.price_try, 780000);
  assert.equal(r.listed_at, '18.09.2026');
  assert.equal(r.seller_type, 'kurumsal-yetkili');
  assert.equal(r.guarantee, 'otokoc-2el-garanti');
});

test('parseOtokocRow: fiyat yoksa null döner (uydurma yok)', () => {
  const r = parseOtokocRow('FIAT EGEA 2020 Model, Beyaz50.000 kmBenzinManuelAnkara', {});
  assert.equal(r.price_try, null);
  assert.equal(r.year, 2020);
});

test('renderOtokocRow: okunabilir satır', () => {
  const line = renderOtokocRow(parseOtokocRow(ROW, {}));
  assert.match(line, /2020/);
  assert.match(line, /780\.000/);
});
