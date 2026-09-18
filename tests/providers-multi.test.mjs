import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArabamHtml, arabamUrlPattern, renderArabamRow } from '../providers/arabam.mjs';
import { parseVavacarsCards, vavacarsUrlPattern, parseVavacarsCard } from '../providers/vavacars.mjs';

const ARABAM_ROW = `
<tr class="listing">
  <td class="listing-model">Fiat Egea Cross 1.4 Fire Urban</td>
  <td class="listing-title">YMS CAR'DAN 2023+URBAN+26 BİN KM+SERVİS BAKIMLI+EXTRALI</td>
  <td>2023</td>
  <td>26.000</td>
  <td>Mavi</td>
  <td class="listing-price">1.015.000 TL</td>
  <td>10 Eylül 2026</td>
  <td>Ankara Sincan</td>
</tr>`;

const ARABAM_ROW_DROP = `
<tr class="listing">
  <td class="listing-model">Fiat Egea Cross 1.4 Fire Street</td>
  <td class="listing-title">EGEA CROSS 1.4 STREET | 42.000 KM | HATASIZ SERVİS BAKIMLI</td>
  <td>2024</td>
  <td>42.500</td>
  <td>Beyaz</td>
  <td class="listing-price"><del>1.042.500 TL</del> 1.025.000 TL</td>
  <td>06 Eylül 2026</td>
  <td>Kayseri Melikgazi</td>
</tr>`;

test('arabamUrlPattern model listesi URL tanır', () => {
  assert.ok(arabamUrlPattern.test('https://www.arabam.com/ikinci-el/otomobil/fiat-egea-cross'));
  assert.ok(!arabamUrlPattern.test('https://www.sahibinden.com/fiat-egea'));
});

test('parseArabamHtml: yıl/km/fiyat/şehir/satıcı tipi çıkarır', () => {
  const rows = parseArabamHtml(ARABAM_ROW, {});
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.year, 2023);
  assert.equal(r.km, 26000);
  assert.equal(r.price_try, 1015000);
  assert.equal(r.city, 'Ankara Sincan');
  assert.equal(r.seller_type, 'galeri');
  assert.match(r.title, /YMS CAR/);
});

test('parseArabamHtml: üstü çizili eski fiyat + yeni fiyat → fiyat düşüşü kaydı', () => {
  const rows = parseArabamHtml(ARABAM_ROW_DROP, {});
  const r = rows[0];
  assert.equal(r.price_try, 1025000);
  assert.equal(r.price_previous_try, 1042500);
  assert.equal(r.price_drop_try, 17500);
});

test('parseArabamHtml: sahibinden ilanını bireysel sayar', () => {
  const html = ARABAM_ROW.replace('galeriden', 'sahibinden');
  const rows = parseArabamHtml(html.replace('YMS CAR', 'sahibinden satılık'), {});
  assert.equal(rows[0].seller_type, 'bireysel');
});

test('renderArabamRow: rapor satırı okunabilir', () => {
  const rows = parseArabamHtml(ARABAM_ROW, {});
  const line = renderArabamRow(rows[0]);
  assert.match(line, /2023/);
  assert.match(line, /1\.015\.000/);
});

const VAVA_TEXT = `4 araç bulundu
Fiat Egea Cross
Crossover 1.6 Multijet Lounge
2023
20.270 km
Otomatik
Dizel
34HKV018
1.570.000₺
Fiat Egea Cross
Crossover 1.4 Fire Urban
2025
17.771 km
Manuel
Benzin
06FIY311
1.185.000₺
Boyasız, değişensiz, tramersiz
Fiat Egea Cross
Crossover 1.6 Multijet Lounge
2025
8.989 km
Otomatik
Dizel
35COM978
1.640.000₺
Boyasız, değişensiz, tramersiz
Özel İndirim: 17.000₺
Fiat Egea Cross
Crossover 1.4 Fire Urban
2025
8.288 km
Manuel
Benzin
41BCV693
1.198.000₺
1.215.000₺`;

test('vavacarsUrlPattern: Egea Cross rota', () => {
  assert.ok(vavacarsUrlPattern.test('https://tr.vava.cars/buy/cars/Fiat/Egea%20Cross'));
});

test('parseVavacarsCards: 4 aracı yıl/km/fiyat/vites ile çıkarır', () => {
  const cars = parseVavacarsCards(VAVA_TEXT);
  assert.equal(cars.length, 4);
  assert.equal(cars[0].year, 2023);
  assert.equal(cars[0].km, 20270);
  assert.equal(cars[0].price_try, 1570000);
  assert.equal(cars[0].gearbox, 'Otomatik');
  assert.equal(cars[1].price_try, 1185000);
  assert.equal(cars[1].tramer_claim, 'temiz');
});

test('parseVavacarsCards: indirim tutarı ve önceki fiyat yakalanır', () => {
  const cars = parseVavacarsCards(VAVA_TEXT);
  const c = cars.find(x => x.price_try === 1198000);
  assert.ok(c);
  assert.equal(c.price_previous_try, 1215000);
  assert.equal(c.price_drop_try, 17000);
});

test('parseVavacarsCard: tek kart (detay sayfası metni) doğru ayrışır', () => {
  const card = parseVavacarsCard(`Fiat Egea Cross
Crossover 1.4 Fire Urban
2025
8.288 km
Manuel
Benzin
41BCV693
1.198.000₺`);
  assert.equal(card.year, 2025);
  assert.equal(card.plate, '41BCV693');
});
