import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCardText,
  parseCardText,
  splitHeading,
  detectFuel,
  detectGearbox,
  detectBody,
  pickYear,
  pickPrice,
  pickKm,
  TR_MAKES,
} from '../lib/card-parse.mjs';

// --- GERÇEK kart metinleri (2026-09-18 canlı toplama) -----------------------

test('renew kartı: marka model | varyant | yıl | km | yakıt | vites | fiyat', () => {
  const row = parseCardText(
    'Dacia Sandero Stepway | 1.0 Turbo Prestige X-Tronic CVT | 2021 | 102.296 KM | Benzin | Otomatik | 1.129.000 ₺',
    { source: 'renewturkiye.com', city: 'İzmir' },
  );
  assert.equal(row.make, 'Dacia');
  assert.equal(row.model, 'Sandero Stepway', 'Stepway modele katılır');
  assert.equal(row.variant, '1.0 Turbo Prestige X-Tronic CVT');
  assert.equal(row.year, 2021);
  assert.equal(row.km, 102296);
  assert.equal(row.price_try, 1129000);
  assert.equal(row.fuel, 'Benzin');
  assert.equal(row.gearbox, 'Otomatik');
  assert.equal(row.city, 'İzmir');
});

test('otoplus kartı: km yok → null, diğer alanlar dolu', () => {
  const row = parseCardText('Opel COMBO | 2024 | COMBO EDITION 1.5 DIZEL AT8 130 FL | 1.295.000TL', {
    source: 'otoplus.com',
  });
  assert.equal(row.make, 'Opel');
  assert.equal(row.year, 2024);
  assert.equal(row.km, null);
  assert.equal(row.price_try, 1295000);
  assert.equal(row.fuel, 'Dizel');
  assert.equal(row.gearbox, 'Otomatik');
  assert.ok(row.notes.some((n) => /km yok/i.test(n)));
});

test('otofora kartı: yıl başta + 0 KM → km null + gerekçe notu', () => {
  const row = parseCardText(
    'OTOFORA | 2023 Land Rover Range Rover Sport 3.0 D Hybrid D350 Autobiography | 17.250.000 TL |  Dizel |  SUV |  Otomatik |  0 KM',
    { source: 'otofora.com', city: 'İzmir' },
  );
  assert.equal(row.make, 'Land Rover');
  assert.equal(row.model, 'Range Rover');
  assert.equal(row.year, 2023);
  assert.equal(row.km, null);
  assert.equal(row.price_try, 17250000);
  assert.equal(row.body, 'SUV');
  assert.ok(row.notes.some((n) => /km=0/i.test(n)));
});

test('otosor kartı: TAKSİT tutarı ana fiyat sanılmaz', () => {
  const row = parseCardText(
    'Toyota Corolla 1.5 Dream Multidrive S 123HP | ₺ 1.378.750 | ₺130.743 x 12 ay | Otomatik | 110.000 KM | 2021',
    { source: 'otosor.com.tr', city: 'İzmir' },
  );
  assert.equal(row.price_try, 1378750, 'aylık taksit değil peşin fiyat alınmalı');
  assert.equal(row.km, 110000);
  assert.equal(row.year, 2021);
  assert.equal(row.gearbox, 'Otomatik');
});

// --- TÜRKÇE/tuzak vakaları -------------------------------------------------

test('Peugeot 2008/3008 model adı yıl sanılmaz', () => {
  const row = parseCardText('Peugeot 2008 | 2025 | 2008 GT 1.2 PURETECH | 1.795.000TL | Benzin | Otomatik', {
    source: 'otoplus.com',
  });
  assert.equal(row.make, 'Peugeot');
  assert.equal(row.model, '2008');
  assert.equal(row.year, 2025, 'model adındaki 2008 yıl olarak alınmamalı');
});

test('çok kelimeli marka ve model rakamı: Mercedes-Benz C 200', () => {
  const h = splitHeading('Mercedes-Benz C 200 AMG');
  assert.equal(h.make, 'Mercedes-Benz');
  assert.equal(h.model, 'C 200');
  assert.equal(h.variant, 'AMG');
});

test('şehir adı normalize edilir (Istanbul → İstanbul)', () => {
  const row = parseCardText('Fiat Egea | 2023 | 1.4 Fire Urban | 950.000 TL | Benzin', {
    source: 'otoplus.com',
    city: 'Istanbul',
  });
  assert.equal(row.city, 'İstanbul');
});

test('fiyatı olmayan kart atlanır (uydurma yok)', () => {
  assert.equal(parseCardText('Fiat Egea 2023 Benzin Otomatik', { source: 'test' }), null);
});

test('tanınmayan marka ile başlayan kart atlanır', () => {
  assert.equal(parseCardText('Bilinmeyenmarka X | 2020 | 500.000 TL', { source: 'test' }), null);
});

// --- alan dedektörleri -----------------------------------------------------

test('yakıt/vites/kasa dedektörleri', () => {
  assert.equal(detectFuel('1.5 BlueHDI Feel'), 'Dizel');
  assert.equal(detectFuel('1.0 TSI Life'), 'Benzin');
  assert.equal(detectFuel('1.6 Hybrid e-CVT'), 'Hibrit');
  assert.equal(detectFuel('EV Long Range'), 'Elektrik');
  assert.equal(detectGearbox('Otomatik vites'), 'Otomatik');
  assert.equal(detectGearbox('Düz vites'), 'Manuel');
  assert.equal(detectBody('SUV 1.6'), 'SUV');
  assert.equal(detectBody('Sedan 1.3'), 'Sedan');
});

test('pickYear: tek başına duran yıl segmenti öncelikli', () => {
  assert.equal(pickYear(['Peugeot 2008', '2025'], 'Peugeot 2008 | 2025'), 2025);
  assert.equal(pickYear([], '2019 model temiz'), 2019);
  assert.equal(pickYear([], 'yıl bilgisi yok'), null);
});

test('pickPrice: TL/₺ ve taksit ayrımı', () => {
  assert.equal(pickPrice('1.250.000 TL'), 1250000);
  assert.equal(pickPrice('₺ 999.500'), 999500);
  assert.equal(pickPrice('₺130.743 x 12 ay'), null);
  assert.equal(pickPrice('fiyat yok'), null);
});

test('pickKm: KM eki ve noktalı binlik ayırıcı', () => {
  assert.equal(pickKm('102.296 KM'), 102296);
  assert.equal(pickKm('40.582KM'), 40582);
  assert.equal(pickKm('0 KM'), 0);
  assert.equal(pickKm('km yok'), null);
});

test('TR_MAKES: yaygın markalar listede ve çok kelimeli olanlar önce eşleşir', () => {
  for (const m of ['Fiat', 'Renault', 'Volkswagen', 'Land Rover', 'Mercedes-Benz', 'Alfa Romeo']) {
    assert.ok(TR_MAKES.includes(m), `${m} listede olmalı`);
  }
  const h = splitHeading('Land Rover Discovery Sport');
  assert.equal(h.make, 'Land Rover');
  assert.equal(h.model, 'Discovery Sport', 'iki kelimeli model tek parça kalmalı');
  assert.equal(h.variant, null);
});

test('model soneki ayrı segmentteyse modele birleştirilir (C3 Aircross ≠ C3)', () => {
  const h = splitHeading('Citroen C3');
  assert.equal(h.model, 'C3');
  const row = parseCardText('Citroen C3 | SUV 1.2 PureTech Feel Bold AirCross | 2023 | 40.000 KM | Benzin | Otomatik | 1.450.000 TL', { source: 'test' });
  assert.equal(row.model, 'C3 Aircross', 'Aircross modele katılmalı');
  assert.equal(row.variant, '1.2 PureTech Feel Bold');
  assert.equal(row.body, 'SUV');
});

test('Egea Cross ve Sandero Stepway de doğru modele yazılır', () => {
  const egea = parseCardText('Fiat Egea | 1.4 Fire Urban Cross | 2023 | 26.000 KM | Benzin | Manuel | 1.015.000 TL', { source: 'test' });
  assert.equal(`${egea.make} ${egea.model}`, 'Fiat Egea Cross');
  const sandero = parseCardText('Dacia Sandero | 1.0 Turbo Stepway Prestige | 2021 | 102.296 KM | Benzin | Otomatik | 1.129.000 TL', { source: 'test' });
  assert.equal(`${sandero.make} ${sandero.model}`, 'Dacia Sandero Stepway');
});

test('indirim etiketi: araç fiyatı sanılmaz, varyant sanılmaz', () => {
  const row = parseCardText(
    'Özel İndirim: 15.000₺ | Hyundai Kona | SUV 1.6 Crdi Elite Smart | 2024 | 12.000 km | Otomatik | Dizel | 34ABC123 | 1.450.000₺',
    { source: 'vava.cars' },
  );
  assert.equal(row.price_try, 1450000, 'indirim tutarı değil araç fiyatı alınmalı');
  assert.match(row.variant, /1\.6/i, 'varyant motor bilgisi olmalı');
  assert.equal(row.body, 'SUV');
});

test('birden fazla fiyat varsa araç fiyatı (sonuncu) alınır', () => {
  assert.equal(pickPrice('Peşin 900.000 TL | Kredi ile 950.000 TL'), 950000);
});

test('carvak kartı: ayırıcılı para birimi ve madde işareti normalize edilir', () => {
  const row = parseCardText('Volkswagen • Polo | 2023 • 122.222 km • 1.0 TSI Life • Otomatik | ₺ | 1.278.000', { source: 'carvak' });
  assert.ok(row, 'kart ayrışmalı');
  assert.equal(row.make, 'Volkswagen');
  assert.equal(row.model, 'Polo');
  assert.equal(row.year, 2023);
  assert.equal(row.km, 122222);
  assert.equal(row.price_try, 1278000);
  assert.equal(row.gearbox, 'Otomatik');
  assert.match(row.variant, /1\.0 TSI Life/i);
});

test('normalizeCardText: para birimi ve madde işareti temizlenir, dikey çizgiler korunur', () => {
  assert.equal(normalizeCardText('Volkswagen • Polo | ₺ | 1.278.000'), 'Volkswagen Polo | ₺ 1.278.000');
});
