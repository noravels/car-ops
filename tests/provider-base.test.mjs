import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MarketplaceProvider, loadFilterRegistry, ProviderError, slugify, extractClaims } from '../providers/base.mjs';
import { initProviders, allProviders, providerById, filterMatrix } from '../providers/index.mjs';

const registry = JSON.parse(readFileSync(new URL('../config/filters.json', import.meta.url), 'utf8'));
const providers = initProviders();

test('MarketplaceProvider soyut: doğrudan örneklenemez', () => {
  assert.throws(() => new MarketplaceProvider(), /soyut/);
});

test('her provider abstract sınıftan türer ve zorunlu üyeleri tanımlar', () => {
  for (const p of providers) {
    assert.ok(p instanceof MarketplaceProvider, `${p.id} base türevi değil`);
    assert.equal(typeof p.id, 'string');
    assert.equal(typeof p.buildSearchUrl, 'function');
    assert.equal(typeof p.parseListings, 'function');
    assert.equal(typeof p.parseDetail, 'function');
    assert.ok(p.spec, `${p.id} filtre kaydında yok`);
  }
});

test('FİLTRE KAPSAMA INVARIANTI: her provider, her kanonik filtre için strateji bildirir', () => {
  const allFilters = Object.keys(registry.filters);
  for (const p of providers) {
    const { missing, complete, total } = p.coverage();
    assert.equal(complete, true, `${p.id} eksik filtre stratejileri: ${missing.join(', ')}`);
    assert.equal(total, allFilters.length);
  }
});

test('SESSİZ DÜŞME YOK: verilen her filtre applied/postfilters/unsupported içinde görünür', () => {
  const filters = {
    make: 'Fiat',
    model: 'Egea Cross',
    price_max: 1200000,
    year_min: 2022,
    km_max: 120000,
    gearbox: 'otomatik',
    fuel: 'benzin',
    color: 'beyaz',
    seller_type: 'galeri',
    heavy_damage: false,
    changed_parts_max: 1,
    keyword: 'hatasız',
  };
  const location = { province: 'Kocaeli', plate: '41', cities: ['Kocaeli', 'Sakarya'] };
  for (const p of providers) {
    const out = p.buildSearchUrl(filters, { location });
    const seenKeys = new Set([
      ...out.applied.map((a) => a.filter),
      ...out.postfilters.map((f) => f.filter),
      ...out.unsupported.map((u) => u.filter),
    ]);
    for (const key of Object.keys(filters)) {
      assert.ok(seenKeys.has(key), `${p.id}: '${key}' filtresi hiçbir kategoride bildirilmedi (sessiz düşme)`);
    }
  }
});

test('arabam: currency=TL olmadan fiyat parametresi yazılmaz (canlı doğrulanmış kural)', () => {
  const arabam = providerById('arabam');
  const withPrice = arabam.buildSearchUrl({ make: 'Fiat', model: 'Egea Cross', price_max: 1100000 });
  assert.match(withPrice.url, /currency=TL/);
  assert.match(withPrice.url, /maxPrice=1100000/);
  const withoutPrice = arabam.buildSearchUrl({ make: 'Fiat', model: 'Egea Cross', year_min: 2023 });
  assert.ok(!withoutPrice.url.includes('currency='), 'fiyat yokken currency eklenmemeli');
});

test('arabam: vites ve yakıt yol eki olarak kodlanır + kategori kasa tipinden gelir', () => {
  const arabam = providerById('arabam');
  const out = arabam.buildSearchUrl({ make: 'Fiat', model: 'Egea Cross', body: 'crossover', gearbox: 'otomatik', fuel: 'benzin' });
  assert.match(out.url, /\/ikinci-el\/arazi-suv-pick-up\/fiat-egea-cross-otomatik-benzin/);
  const appliedKeys = out.applied.map((a) => a.filter);
  assert.ok(appliedKeys.includes('gearbox'));
  assert.ok(appliedKeys.includes('fuel'));
});

test('sahibinden: doğrulanmış parametreler (price_max, a5_min, a4_max, a109_max, address_city)', () => {
  const sb = providerById('sahibinden');
  const out = sb.buildSearchUrl(
    { make: 'Fiat', model: 'Egea Cross', price_max: 1200000, year_min: 2022, km_max: 120000, changed_parts_max: 1 },
    { location: { province: 'Ankara', plate: '06' } },
  );
  assert.match(out.url, /price_max=1200000/);
  assert.match(out.url, /a5_min=2022/);
  assert.match(out.url, /a4_max=120000/);
  assert.match(out.url, /a109_max=1/);
  assert.match(out.url, /address_city=06/);
});

test('vavacars/otokoc: URL filtresi yok → filtrelerin tamamı postfilter olarak bildirilir', () => {
  for (const id of ['vavacars', 'otokoc']) {
    const p = providerById(id);
    const out = p.buildSearchUrl({ make: 'Fiat', model: 'Egea Cross', price_max: 1200000, gearbox: 'otomatik' });
    assert.equal(out.filter_in_page, true);
    const keys = out.postfilters.map((f) => f.filter);
    assert.ok(keys.includes('price_max'), `${id} price_max bildirmedi`);
    assert.ok(keys.includes('gearbox'), `${id} gearbox bildirmedi`);
  }
});

test('unsupported filtreler açıkça bildirilir (kurumsal platformda seller_type gibi)', () => {
  const v = providerById('vavacars').buildSearchUrl({ make: 'Fiat', model: 'Egea Cross', seller_type: 'bireysel' });
  const u = v.unsupported.map((x) => x.filter);
  assert.ok(u.includes('seller_type'));
});

test('parseListings: implement edilmemişse ProviderError (sessiz boş dizi yok)', () => {
  class Fake extends MarketplaceProvider {
    static get id() { return 'sahibinden'; }
  }
  const f = new Fake();
  assert.throws(() => f.parseListings('x'), /implement edilmeli/);
  assert.throws(() => f.parseDetail('<html>'), /implement edilmeli/);
});

test('filterMatrix: tüm providerlar için kapsama ve doğrulama durumu raporlanır', () => {
  const m = filterMatrix();
  assert.deepEqual(Object.keys(m).sort(), ['arabam', 'otokoc', 'sahibinden', 'vavacars']);
  for (const [id, info] of Object.entries(m)) {
    assert.equal(info.coverage.complete, true, `${id} kapsama tamam değil`);
    assert.ok(Array.isArray(info.url_filters));
  }
  assert.ok(m.arabam.url_filters.includes('price_max'));
  assert.ok(m.sahibinden.url_filters.includes('year_min'));
});

test('extractClaims: finansman ve tramer beyanlarını yakalar', () => {
  const claims = extractClaims('HASAR KAYDI 129 BİN TL\'dir. 36 ay taksit yapılır, rehin/haciz yok.');
  const cats = claims.map((c) => c.category);
  assert.ok(cats.includes('tramer'));
  assert.ok(cats.includes('finansman'));
  assert.ok(cats.includes('hukuki'));
});

test('slugify: Türkçe karakterleri URL slugına çevirir', () => {
  assert.equal(slugify('Egea Cross'), 'egea-cross');
  assert.equal(slugify('Şahin'), 'sahin');
});
