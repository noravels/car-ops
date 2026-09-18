import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchUrls, providerSearchPlan, normalizeFilters, slugify } from '../search-urls.mjs';

const PROFILE = {
  location: { province: 'Kocaeli', radius: 1 },
  budget: { mode: 'kredi', down_payment_try: 800000, monthly_max_try: 28000, months: 24, monthly_rate_max: 0.035 },
  vehicle_target: { make: 'Fiat', model: 'Egea Cross' },
  limits: { year_min: 2022, km_max: 120000, gearbox: 'otomatik', body: 'crossover' },
  risk: { tolerance: 'low', max_changed_parts: 1, max_painted_parts: 2 },
  must_have: [],
  seller_preference: 'any',
};

test('normalizeFilters: profilden kanonik filtre seti üretir', () => {
  const f = normalizeFilters({ profile: PROFILE });
  assert.equal(f.make, 'Fiat');
  assert.equal(f.model, 'Egea Cross');
  assert.equal(f.year_min, 2022);
  assert.equal(f.km_max, 120000);
  assert.equal(f.gearbox, 'otomatik');
  assert.equal(f.body, 'crossover');
  assert.equal(f.changed_parts_max, 1);
  assert.ok(f.location);
  assert.equal(f.location.province, 'Kocaeli');
  assert.equal(f.location.plate, '41');
});

test('normalizeFilters: boş/any değerler temizlenir', () => {
  const f = normalizeFilters({ reach: null, gearbox: 'any', fuel: '', make: 'Fiat' });
  assert.equal(f.reach, undefined);
  assert.equal(f.gearbox, undefined);
  assert.equal(f.fuel, undefined);
  assert.equal(f.make, 'Fiat');
});

test('buildSearchUrls: 4 provider için plan üretir', () => {
  const urls = buildSearchUrls({ profile: PROFILE });
  assert.equal(urls.length, 4);
  for (const u of urls) {
    assert.ok(u.url.startsWith('http'), `${u.provider} URL yok`);
    assert.ok(u.plan.length > 0, `${u.provider} plan boş`);
  }
});

test('sahibinden planı: doğrulanmış URL filtreleri (artık vites/yakıt/kasa/satıcı da URL\'de)', () => {
  const sb = buildSearchUrls({ profile: PROFILE }).find((u) => u.provider === 'sahibinden');
  assert.match(sb.url, /fiat-egea-cross|fiat-egea/);
  assert.match(sb.url, /a5_min=2022/);
  assert.match(sb.url, /a4_max=120000/);
  assert.match(sb.url, /a109_max=1/);
  assert.match(sb.url, /address_city=41/);
  // vites artık gerçek parametre (a6), kasa tipi a8 → rapor süzmesine düşmemeli
  assert.match(sb.url, /a6=32466/);
  const pf = sb.postfilters.map((p) => p.filter);
  assert.ok(!pf.includes('gearbox'), 'gearbox artık URL filtresi olmalı');
  // hâlâ rapor süzmesinde olanlar (site bant bazlı / parametre yok)
  // boya sınırı 0 değil → site bayrağı yok, rapor süzmesinde görünmeli
  assert.ok(pf.includes('painted_parts_max'), 'boyalı parça sınırı rapor süzmesinde olmalı');
  // kasa tipi "crossover" sahibinden a8 listesinde yok → uydurma kod göndermek yerine rapora düşer
  assert.ok(pf.includes('body'), 'desteklenmeyen enum değeri rapor süzmesine düşmeli');
  // tekilleştirme: aynı filtre iki kez bildirilmemeli
  const dupes = pf.filter((k, i) => pf.indexOf(k) !== i);
  assert.deepEqual(dupes, [], 'postfilter listesi tekilleştirilmeli');
  assert.match(sb.plan, /gearbox=32466/);
});

test('arabam planı: kasa tipi kategori yolunu, vites yol ekini belirler', () => {
  const a = buildSearchUrls({ profile: PROFILE }).find((u) => u.provider === 'arabam');
  assert.match(a.url, /\/ikinci-el\/arazi-suv-pick-up\/fiat-egea-cross-otomatik/);
  assert.match(a.plan, /gearbox→yol eki/);
});

test('vavacars/otokoc: filtrelerin tamamı rapor süzmesinde, URL sadece model yolu', () => {
  for (const id of ['vavacars', 'otokoc']) {
    const u = buildSearchUrls({ profile: PROFILE }).find((x) => x.provider === id);
    assert.equal(u.filter_in_page, true);
    assert.match(u.plan, /rapor süzmesi/);
  }
});

test('providerSearchPlan: eksik bilgilerde uyarı üretir', () => {
  const plan = providerSearchPlan({ make: 'Fiat', must_have: ['otomatik vites', 'geri görüş kamerası', 'sıfır boya'] });
  assert.ok(plan.warnings.some((w) => /model/.test(w)));
  assert.ok(plan.warnings.some((w) => /konum/.test(w)));
  assert.ok(plan.warnings.some((w) => /must_have/.test(w)));
});

test('slugify: Türkçe karakter + boşluk dönüşümü (dışa açık)', () => {
  assert.equal(slugify('Egea Cross'), 'egea-cross');
  assert.equal(slugify('Şahin 1.6'), 'sahin-1-6');
});
