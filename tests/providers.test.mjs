import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSahibindenHtml, listingUrlPattern } from '../providers/sahibinden.mjs';

const FIXTURE = `<!doctype html><html><body>
<div class="classifiedDetail">
  <h1 id="classifiedDetailTitle">Honda Civic 1.6 ECO Elegance</h1>
  <ul class="classifiedInfoList">
    <li><span>Fiyat</span><span class="classifiedPrice ">850.000 TL</span></li>
    <li><span>İlan No</span><span>1234567890</span></li>
    <li><span>Marka</span><span>Honda</span></li>
    <li><span>Model</span><span>Civic</span></li>
    <li><span>Model Yılı</span><span>2018</span></li>
    <li><span>Kilometre</span><span>120.000 KM</span></li>
    <li><span>Yakıt</span><span>Benzin</span></li>
    <li><span>Vites</span><span>Otomatik</span></li>
    <li><span>Kasa Tipi</span><span>Sedan</span></li>
    <li><span>Renk</span><span>Gri</span></li>
  </ul>
  <div class="classifiedDescription" id="classifiedDescription">
    <p>2018 Honda Civic, tek elden, tramer kaydı yoktur, hasarsızdır.
    Bebekler bebeği gibi araç, detaylar için arayınız.</p>
  </div>
  <div class="storeBasedInfo"><div class="userName">Ali Veli</div></div>
</div>
</body></html>`;

test("listingUrlPattern sahibinden ilan URL'sini tanır", () => {
  assert.ok(listingUrlPattern.test('https://www.sahibinden.com/ilan/otomobil-honda-civic-1234567890'));
  assert.ok(!listingUrlPattern.test('https://www.arabam.com/ilan/x-1'));
});

test('parseSahibindenHtml: temel alanları çeker', () => {
  const rec = parseSahibindenHtml(FIXTURE, { url: 'https://www.sahibinden.com/ilan/x-1234567890' });
  assert.equal(rec.schema, 'car-ops/listing@1');
  assert.equal(rec.listing_id, 'sahibinden-1234567890');
  assert.equal(rec.market, 'tr');
  assert.equal(rec.title, 'Honda Civic 1.6 ECO Elegance');
  assert.equal(rec.price_try, 850000);
  assert.equal(rec.vehicle.make, 'Honda');
  assert.equal(rec.vehicle.year, 2018);
  assert.equal(rec.vehicle.km, 120000);
  assert.equal(rec.vehicle.fuel, 'Benzin');
  assert.equal(rec.vehicle.gearbox, 'Otomatik');
});

test('parseSahibindenHtml: satıcı tipi tespiti — bireysel vs galeri', () => {
  const bireysel = parseSahibindenHtml(FIXTURE, {});
  assert.equal(bireysel.seller.type, 'bilinmiyor'); // fixture'da tip etiketi yok

  const galeriHtml = FIXTURE.replace('<div class="storeBasedInfo">', '<div class="storeBasedInfo corporate">');
  const galeri = parseSahibindenHtml(galeriHtml, {});
  assert.equal(galeri.seller.type, 'galeri');
});

test('parseSahibindenHtml: açıklama iddiaları kategorize edilir', () => {
  const rec = parseSahibindenHtml(FIXTURE, {});
  const cats = rec.claims.map(c => c.category);
  assert.ok(cats.includes('tramer'));
  const tramerClaim = rec.claims.find(c => c.category === 'tramer');
  assert.match(tramerClaim.text, /tramer kaydı yok/i);
});

test('parseSahibindenHtml: eksik alan null kalır, uydurulmaz', () => {
  const minimal = '<html><body><h1 id="classifiedDetailTitle">Araç</h1></body></html>';
  const rec = parseSahibindenHtml(minimal, { url: 'https://www.sahibinden.com/ilan/y-999' });
  assert.equal(rec.price_try, null);
  assert.equal(rec.vehicle.year, null);
  assert.equal(rec.vehicle.km, null);
  assert.equal(rec.listing_id, 'sahibinden-999');
});

test('parseSahibindenHtml: ekspertiz yoksa unverifiable doldurulur', () => {
  const rec = parseSahibindenHtml(FIXTURE, {});
  assert.equal(rec.inspection.present, false);
  assert.ok(rec.unverifiable.includes('kaporta durumu'));
  assert.ok(rec.unverifiable.includes('motor durumu'));
});
