import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchUrls, slugify, providerSearchPlan } from '../search-urls.mjs';

const params = JSON.parse(readFileSync(new URL('../config/search-params.json', import.meta.url), 'utf8'));

test('slugify: marka/model adlarını URL slugına çevirir', () => {
  assert.equal(slugify('Egea Cross'), 'egea-cross');
  assert.equal(slugify('Mercedes-Benz'), 'mercedes-benz');
  assert.equal(slugify('Clio 1.0 SCe'), 'clio-1-0-sce');
  assert.equal(slugify('Şahin'), 'sahin');
});

test('buildSearchUrls: sahibinden için il + filtre parametreli URL üretir', () => {
  const urls = buildSearchUrls(
    {
      make: 'Fiat',
      model: 'Egea Cross',
      price_max: 1200000,
      year_min: 2022,
      km_max: 120000,
      location: { province: 'Ankara', plate: '06', cities: ['Ankara', 'Konya'] },
    },
    params,
  );
  const sb = urls.find((u) => u.provider === 'sahibinden');
  assert.ok(sb.url.startsWith('https://www.sahibinden.com/fiat-egea-cross'));
  assert.match(sb.url, /price_max=1200000/);
  assert.match(sb.url, /a5_min=2022/);
  assert.match(sb.url, /a4_max=120000/);
  assert.match(sb.url, /address_city=06/);
  assert.equal(sb.verified, true);
});

test('buildSearchUrls: arabam model yolu + parametreler', () => {
  const urls = buildSearchUrls({ make: 'Fiat', model: 'Egea Cross', price_max: 1200000 }, params);
  const a = urls.find((u) => u.provider === 'arabam');
  assert.ok(a.url.startsWith('https://www.arabam.com/ikinci-el/otomobil/fiat-egea-cross'));
  assert.match(a.url, /maxPrice=1200000/);
});

test('buildSearchUrls: vavacars/otokoc URL parametresi yok → süzme notu düşülür', () => {
  const urls = buildSearchUrls({ make: 'Fiat', model: 'Egea Cross', price_max: 1200000 }, params);
  const v = urls.find((u) => u.provider === 'vavacars');
  assert.equal(v.url, 'https://tr.vava.cars/buy/cars/Fiat/Egea%20Cross');
  assert.equal(v.filter_in_page, true);
  const o = urls.find((u) => u.provider === 'otokoc');
  assert.equal(o.url, 'https://www.otokocikinciel.com/ikinci-el/fiat/egea-cross');
  assert.equal(o.filter_in_page, true);
});

test('buildSearchUrls: il listesi (komşu iller) plan çıktısına girer', () => {
  const urls = buildSearchUrls(
    { make: 'Fiat', model: 'Egea', location: { province: 'Kocaeli', cities: ['Kocaeli', 'Sakarya', 'Bursa', 'Yalova', 'İstanbul'] } },
    params,
  );
  const sb = urls.find((u) => u.provider === 'sahibinden');
  assert.deepEqual(sb.cities, ['Kocaeli', 'Sakarya', 'Bursa', 'Yalova', 'İstanbul']);
  assert.match(sb.plan, /il listesinde rapor bazlı süzme/);
});

test('buildSearchUrls: bilinmeyen provider sessizce atlanmaz, listelenir', () => {
  const urls = buildSearchUrls({ make: 'Fiat', model: 'Egea' }, { ...params, bilinmeyen: params.sahibinden });
  const u = urls.find((x) => x.provider === 'bilinmeyen');
  assert.ok(u);
  assert.equal(u.supported, true);
});

test('providerSearchPlan: eksik model bilgisinde uyarı üretir', () => {
  const plan = providerSearchPlan({ make: 'Fiat' }, params);
  assert.ok(plan.warnings.some((w) => /model/.test(w)));
});
