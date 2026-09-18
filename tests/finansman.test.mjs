import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  maxVehiclePrice,
  monthlyFromScenario,
  normFcRate,
  scenarioTable,
  renderBudget,
} from '../finansman.mjs';

const EPS = v => Math.round(v);

test('peşinat + taksit × vade → araç bütçe üst sınırı (faizli kredi PV)', () => {
  // 800.000 peşinat, 25.000 TL/ay, 24 ay, aylık %3.5
  // L = A*(1-(1+i)^-n)/i = 25000*(1-1.035^-24)/0.035 ≈ 398.900
  const got = maxVehiclePrice({ pesinat: 800000, taksit: 25000, vade_ay: 24, aylik_faiz: 0.035 });
  assert.equal(got.vehicle_cap, Math.floor(800000 + 25000 * (1 - Math.pow(1.035, -24)) / 0.035));
  assert.ok(got.vehicle_cap >= 1_180_000 && got.vehicle_cap <= 1_220_000);
});

test('faiz %0 ise basit toplam: peşinat + taksit×vade', () => {
  const got = maxVehiclePrice({ pesinat: 800000, taksit: 25000, vade_ay: 24, aylik_faiz: 0 });
  assert.equal(got.vehicle_cap, 800000 + 25000 * 24);
});

test('faiz %3.5 üstü → senaryo elenir, öneri: küçült vade / değiştir kurum', () => {
  const got = maxVehiclePrice({ pesinat: 800000, taksit: 25000, vade_ay: 24, aylik_faiz: 0.042 });
  assert.equal(got.faiz_ok, false);
  assert.match(got.note, /faiz/);
});

test('aylık faiz üst-sınır politikasına göre normalize (>= %3.5 reddedilir)', () => {
  assert.equal(normFcRate(0.0350).ok, false);  // "3.5'in altındaysa" → %3.50 DAHİL değil
  assert.equal(normFcRate(0.0349).ok, true);
  assert.equal(normFcRate(0.0360).ok, false);
  assert.equal(normFcRate(0.02).ok, true);
});

test('ters yön: peşinat + hedef fiyat → gerekli aylık taksit', () => {
  // 1.200.000 araç, 800k peşinat → kredi 400k; 24 ay %3.5 → aylık ≈ 25.076
  const got = monthlyFromScenario({ pesinat: 800000, fiyat: 1200000, vade_ay: 24, aylik_faiz: 0.035 });
  assert.ok(Math.abs(got.taksit - 400000 * 0.035 / (1 - Math.pow(1.035, -24))) < 1);
});

test('scenarioTable: banka vs galeri finansmanı iki senaryo üretir', () => {
  const t = scenarioTable({ pesinat: 800000, taksit_ceiling: 30000, vade_ay: 24, aylik_faiz: 0.0349 });
  assert.ok(t[0].label.includes('banka') || t[0].label.includes('kredi'));
  assert.ok(t.every(s => s.vehicle_cap > 0));
  // üst taksit: 30000 → cap daha yüksek olmalı
  const t2 = scenarioTable({ pesinat: 800000, taksit_ceiling: 30000, vade_ay: 24, aylik_faiz: 0.0349 });
  assert.equal(t2.length, 2);
});

test('renderBudget: TL formatlı, okunabilir çıktı', () => {
  const s = renderBudget({ pesinat: 800000, taksit: 25000, vade_ay: 24, aylik_faiz: 0.0349 });
  assert.match(s, /800/);
  assert.match(s, /1\.2\d\d/);
});
