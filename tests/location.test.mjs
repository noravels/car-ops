import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadProvinces,
  normalizeProvinceName,
  resolveLocation,
  nearbyProvinces,
  regionOf,
} from '../location.mjs';

const data = JSON.parse(readFileSync(new URL('../config/locations/tr-provinces.json', import.meta.url), 'utf8'));

test('veri seti 81 ili ve komşulukları içerir', () => {
  const p = loadProvinces(data);
  assert.equal(Object.keys(p.provinces).length, 81);
  assert.ok(p.provinces['Ankara'].n.includes('Konya'));
  assert.equal(p.provinces['İstanbul'].plate, '34');
});

test('normalizeProvinceName: yazım varyantlarını ve plaka kodunu çözer', () => {
  assert.equal(normalizeProvinceName('istanbul', data), 'İstanbul');
  assert.equal(normalizeProvinceName('  ANKARA ', data), 'Ankara');
  assert.equal(normalizeProvinceName('34', data), 'İstanbul');
  assert.equal(normalizeProvinceName('afyon', data), 'Afyonkarahisar');
  assert.equal(normalizeProvinceName('bilinmeyen-il', data), null);
});

test('resolveLocation: il + komşu iller (radius=1) listesi', () => {
  const loc = resolveLocation('Kocaeli', { radius: 1 }, data);
  assert.equal(loc.province, 'Kocaeli');
  assert.equal(loc.plate, '41');
  assert.equal(loc.region, 'Marmara');
  assert.deepEqual(loc.cities.sort(), ['Bursa', 'Kocaeli', 'Sakarya', 'Yalova', 'İstanbul'].sort());
  assert.equal(loc.radius, 1);
});

test('resolveLocation: radius=0 sadece ilin kendisi', () => {
  const loc = resolveLocation('Kocaeli', { radius: 0 }, data);
  assert.deepEqual(loc.cities, ['Kocaeli']);
});

test('resolveLocation: radius=2 komşunun komşusunu da katar', () => {
  const loc = resolveLocation('Yalova', { radius: 2 }, data);
  // Yalova -> Kocaeli, Bursa -> (İstanbul, Sakarya, Yalova, Bursa, Kütahya, Bilecik)
  assert.ok(loc.cities.includes('Sakarya'));
  assert.ok(loc.cities.includes('İstanbul'));
});

test('resolveLocation: includeFerry ile boğaz/feribot komşuları eklenir', () => {
  const without = resolveLocation('Yalova', { radius: 1 }, data);
  assert.ok(!without.cities.includes('İstanbul'));
  const withFerry = resolveLocation('Yalova', { radius: 1, includeFerry: true }, data);
  assert.ok(withFerry.cities.includes('İstanbul'));
});

test('nearbyProvinces: yalnızca komşular (il hariç)', () => {
  const n = nearbyProvinces('Ankara', { radius: 1 }, data);
  assert.ok(n.includes('Konya'));
  assert.ok(!n.includes('Ankara'));
});

test('regionOf: bölge adı döner', () => {
  assert.equal(regionOf('Trabzon', data), 'Karadeniz');
  assert.equal(regionOf('Şanlıurfa', data), 'Güneydoğu Anadolu');
  assert.equal(regionOf('yok', data), null);
});

test('resolveLocation: bilinmeyen il null döner (uydurma yok)', () => {
  assert.equal(resolveLocation('Atlantis', {}, data), null);
});
