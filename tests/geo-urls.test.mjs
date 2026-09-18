import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geoUrls, GEO_PATTERNS, slugTr } from '../geo-urls.mjs';
import { loadProvinces } from '../location.mjs';

const PROVINCES = loadProvinces();

test('slugTr: Türkçe karakterleri URL slug\'ına çevirir', () => {
  assert.equal(slugTr('Aydın'), 'aydin');
  assert.equal(slugTr('İstanbul'), 'istanbul');
  assert.equal(slugTr('Manisa'), 'manisa');
  assert.equal(slugTr('Muğla'), 'mugla');
});

test('geoUrls: sahibinden şehir filtresi plaka koduyla kurulur', () => {
  const out = geoUrls(['İzmir'], { provinces: PROVINCES, providers: ['sahibinden'] });
  assert.equal(out.length, 1);
  assert.equal(out[0].url, 'https://www.sahibinden.com/otomobil?address_city=35');
  assert.equal(out[0].verified, true);
});

test('geoUrls: İzmir çevresi (Manisa + Aydın) ayrı URL üretir — site tek il kabul ediyor', () => {
  const out = geoUrls(['İzmir', 'Manisa', 'Aydın'], { provinces: PROVINCES, providers: ['sahibinden'] });
  assert.equal(out.length, 3);
  const codes = out.map((o) => o.url.match(/address_city=(\d+)/)[1]);
  assert.deepEqual(codes, ['35', '45', '9']);
});

test('geoUrls: arabam şehir yolu /ikinci-el/<slug>', () => {
  const out = geoUrls(['İzmir', 'Manisa'], { provinces: PROVINCES, providers: ['arabam'] });
  assert.deepEqual(out.map((o) => o.url), [
    'https://www.arabam.com/ikinci-el/izmir',
    'https://www.arabam.com/ikinci-el/manisa',
  ]);
  assert.ok(out.every((o) => o.verified === true));
});

test('geoUrls: renewturkiye /otomobil/<slug>', () => {
  const out = geoUrls(['Aydın'], { provinces: PROVINCES, providers: ['renewturkiye'] });
  assert.equal(out[0].url, 'https://renewturkiye.com/otomobil/aydin');
});

test('geoUrls: otoplus yalnızca İstanbul için şehir sayfası sunar; diğerleri atlanır ve nedeni yazılır', () => {
  const out = geoUrls(['İstanbul', 'İzmir'], { provinces: PROVINCES, providers: ['otoplus'] });
  const ist = out.find((o) => o.province === 'İstanbul');
  const izm = out.find((o) => o.province === 'İzmir');
  assert.ok(ist && ist.url.includes('istanbul-ikinci-el-araba'));
  assert.equal(izm.url, null);
  assert.ok(/yalnızca/i.test(izm.note));
});

test('geoUrls: otosor deseni var ama doğrulanmamış olarak işaretli', () => {
  const out = geoUrls(['İzmir'], { provinces: PROVINCES, providers: ['otosor'] });
  assert.equal(out[0].url, 'https://www.otosor.com.tr/araclar/izmir-ikinci-el-araba');
  assert.equal(out[0].verified, false);
  assert.ok(out[0].note);
});

test('geoUrls: şehir filtresi doğrulanmamış provider için url null döner (uydurma yok)', () => {
  const out = geoUrls(['İzmir'], { provinces: PROVINCES, providers: ['vavacars', 'otokoc'] });
  assert.ok(out.every((o) => o.url === null));
  assert.ok(out.every((o) => o.note));
});

test('geoUrls: tanınmayan il adı hata verir', () => {
  assert.throws(() => geoUrls(['Yokil'], { provinces: PROVINCES, providers: ['sahibinden'] }));
});

test('GEO_PATTERNS: her desen kaynak/doğrulama bilgisi taşır', () => {
  for (const [name, p] of Object.entries(GEO_PATTERNS)) {
    assert.ok(p.verified !== undefined, `${name} verified alanı taşımalı`);
    assert.ok(p.note, `${name} note alanı taşımalı`);
    assert.ok(p.verified_at, `${name} doğrulama tarihi taşımalı`);
  }
});
