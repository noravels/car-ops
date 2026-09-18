// Provider sözleşme testleri — her provider aynı kurallara uyar; update sonrası
// `npm test` bunları çalıştırır, `npm run check:providers --live` canlı doğrular.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRegistry, loadGenericProviders, validateRegistry, createGenericProvider } from '../../providers/generic.mjs';

const registry = loadRegistry();
const providers = loadGenericProviders();
const fixtures = JSON.parse(readFileSync('tests/fixtures/provider-cards.json', 'utf8'));

test('tarif defteri geçerli ve her provider zorunlu alanları taşır', () => {
  const check = validateRegistry(registry);
  assert.equal(check.ok, true, `tarif hataları: ${check.errors.join('; ')}`);
  assert.ok(providers.length >= 10, 'en az 10 sağlayıcı kayıtlı olmalı');
});

test('her provider kimlik + çıkarım modu + doğrulama durumu taşır', () => {
  for (const p of providers) {
    assert.ok(p.id, 'id yok');
    assert.ok(p.label, `${p.id}: label yok`);
    assert.ok(['table', 'text-pattern', 'api', 'none'].includes(p.extraction), `${p.id}: geçersiz extraction`);
    assert.ok(['verified', 'pending', 'blocked'].includes(p.verificationState), `${p.id}: geçersiz durum`);
    assert.ok(p.notes && p.notes.length > 10, `${p.id}: notes yok`);
    assert.ok(p.pacingSeconds >= 3, `${p.id}: insan temposu (>=3 sn) tanımlı olmalı`);
  }
});

test('verified sağlayıcı listesinde çelişki yok (verified ↔ çıkarım yapılabilir)', () => {
  for (const p of providers) {
    if (p.verificationState === 'verified') {
      assert.notEqual(p.extraction, 'none', `${p.id}: verified ama çıkarım yok`);
    }
    if (p.extraction === 'none' || p.extraction === 'api') {
      assert.notEqual(p.verificationState, 'verified', `${p.id}: çıkarım yapılamıyorken verified olamaz`);
    }
  }
});

test('geoUrl: doğrulanmış desende gerçek URL, doğrulanmamışta null (sessiz filtresiz arama yok)', () => {
  const sahibinden = providers.find((p) => p.id === 'sahibinden');
  assert.equal(sahibinden.geoUrl({ plate: '35' }), 'https://www.sahibinden.com/otomobil?address_city=35');
  const arabam = providers.find((p) => p.id === 'arabam');
  assert.equal(arabam.geoUrl({ slug: 'izmir' }), 'https://www.arabam.com/ikinci-el/izmir');
  const otoplus = providers.find((p) => p.id === 'otoplus');
  assert.equal(otoplus.geoUrl({ slug: 'istanbul' }).includes('istanbul'), true);
  assert.equal(otoplus.geoUrl({ slug: 'izmir' }), null, 'yalnızca İstanbul destekli');
  for (const p of providers) {
    if (!p.geo || !p.geo.verified) {
      assert.equal(p.geoUrl({ slug: 'izmir', plate: '35' }), null, `${p.id}: doğrulanmamış geo URL üretmemeli`);
    }
  }
});

// --- fixture tabanlı ayrıştırma (gerçek kartlar) ---------------------------

for (const [id, cards] of Object.entries(fixtures)) {
  test(`fixture: ${id} kartlarının en az %80'i ayrışır`, () => {
    const p = providers.find((x) => x.id === id);
    assert.ok(p, `${id} kayıt defterinde yok`);
    assert.equal(p.extraction, 'text-pattern', `${id} text-pattern olmalı`);
    const rows = p.parseCards(cards);
    const ratio = rows.length / cards.length;
    assert.ok(ratio >= 0.8, `${id}: ${rows.length}/${cards.length} kart ayrıştı (%${Math.round(ratio * 100)})`);
    for (const r of rows) {
      assert.ok(r.price_try > 10000, `${id}: fiyat mantıklı olmalı`);
      if (r.year != null) assert.ok(r.year >= 1990 && r.year <= 2027, `${id}: yıl aralığı (${r.year})`);
      assert.ok(r.make && r.model, `${id}: marka/model dolu olmalı`);
      assert.equal(r.source, p.label);
    }
  });
}

test('parseCards: text-pattern olmayan provider\'da açıkça hata verir (sessiz boş liste yok)', () => {
  const carvak = createGenericProvider('carvak', registry.providers.carvak);
  assert.throws(() => carvak.parseCards(['x']), /text-pattern/);
});

test('parseTable: tablo provider\'ı satırları normalize eder', () => {
  const sahibinden = providers.find((p) => p.id === 'sahibinden');
  const rows = sahibinden.parseTable([
    ['', 'Fiat', 'Egea Cross', '1.4 Fire Urban', '2023 Fiat Egea Cross', '2023', '26.000', '1.015.000 TL', '18 Eylül 2026', 'Ankara Sincan', ''],
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].make, 'Fiat');
  assert.equal(rows[0].km, 26000);
  assert.equal(rows[0].price_try, 1015000);
});

test('parseTable: fiyatsız/yılsız satır atlanır', () => {
  const arabam = providers.find((p) => p.id === 'arabam');
  assert.equal(arabam.parseTable([['', 'Fiat', 'x', 'v', 't', 'yıl', 'km', 'fiyat']]).length, 0);
});

test('parseTable: arabam düzeni (marka model TEK hücrede) doğru bölünür — sahibinden düzeniyle karışmaz', () => {
  const arabam = providers.find((p) => p.id === 'arabam');
  const rows = arabam.parseTable([
    ['', 'Renault Clio 1.5 dCi Alize', 'Galeriden Renault Clio', '2019', '120.000', 'Gri', '780.000 TL', '18 Eylül 2026', 'İzmir\nBornova', ''],
  ]);
  assert.equal(rows.length, 1, 'arabam satırı ayrışmalı (kolon düzeni tariften gelir)');
  assert.equal(rows[0].make, 'Renault');
  assert.equal(rows[0].model, 'Clio');
  assert.equal(rows[0].variant, '1.5 dCi Alize');
  assert.equal(rows[0].year, 2019);
  assert.equal(rows[0].km, 120000);
  assert.equal(rows[0].price_try, 780000);
  assert.equal(rows[0].city, 'İzmir Bornova');
});

test('parseTable: kolon düzeni tanımsız provider tablo ayrıştıramaz (sessiz yanlış eşleme yok)', () => {
  const registry2 = JSON.parse(readFileSync('config/providers-generic.json', 'utf8'));
  const copy = { ...registry2.providers.sahibinden, table_layout: undefined };
  const p = createGenericProvider('sahibinden-kopya', copy);
  assert.throws(() => p.parseTable([['', 'Fiat', 'Egea', '1.4', 't', '2023', '50.000', '900.000 TL', 'd', 'İzmir']]), /table_layout/);
});
