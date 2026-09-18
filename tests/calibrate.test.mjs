import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fitLogLinear,
  modelFactors,
  calibrate,
  renderCalibrationReport,
  writeFactors,
} from '../calibrate.mjs';
import { emptyCatalog, upsertObserved } from '../catalog.mjs';

// Sentetik veri: fiyat = 1.000.000 × (km/50.000)^-0.30 × 1,05^(yıl-2020) × (dizel ? 1,15 : 1)
function synthetic(n = 40, { withFuel = true } = {}) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const year = 2018 + (i % 6);
    const km = 20000 + i * 3500;
    const fuel = withFuel ? (i % 2 === 0 ? 'Dizel' : 'Benzin') : null;
    const price = 1000000 * Math.pow(km / 50000, -0.3) * Math.pow(1.05, year - 2020) * (fuel === 'Dizel' ? 1.15 : 1);
    rows.push({ year, km, price_try: Math.round(price), fuel, source: 'test', listing_id: `s${i}` });
  }
  return rows;
}

test('fitLogLinear: bilinen katsayıları makul toleransla kestirir', () => {
  const fit = fitLogLinear(synthetic(60), [
    { name: 'yil', value: (r) => r.year - 2020 },
    { name: 'log_km', value: (r) => Math.log(r.km), log: true },
  ]);
  assert.ok(fit, 'fit üretilmeli');
  const yil = fit.coefficients.find((c) => c.name === 'yil');
  const logKm = fit.coefficients.find((c) => c.name === 'log_km');
  assert.ok(Math.abs(yil.value - Math.log(1.05)) < 0.02, `yıl katsayısı ~0.0488 olmalı, gelen ${yil.value}`);
  assert.ok(Math.abs(logKm.value - -0.3) < 0.08, `km esnekliği ~-0.30 olmalı, gelen ${logKm.value}`);
  assert.ok(fit.n === 60);
});

test('fitLogLinear: yetersiz/gözenekli veride null döner (uydurma yok)', () => {
  assert.equal(fitLogLinear([], [{ name: 'yil', value: (r) => r.year }]), null);
  const same = Array.from({ length: 5 }, () => ({ year: 2020, km: 50000, price_try: 1000000, source: 't', listing_id: 'x' }));
  assert.equal(fitLogLinear(same, [{ name: 'yil', value: (r) => r.year }, { name: 'log_km', value: (r) => Math.log(r.km), log: true }]), null);
});

test('modelFactors: km esnekliğini 10.000 km başına yüzdeye çevirir', () => {
  const mf = modelFactors(synthetic(40), { minSamples: 20 });
  assert.equal(mf.ok, true);
  assert.ok(mf.km_per_10k_pct < -0.02 && mf.km_per_10k_pct > -0.2, `km etkisi makul olmalı: ${mf.km_per_10k_pct}`);
  assert.ok(mf.year_pct > 0.02 && mf.year_pct < 0.1, `yıl etkisi makul olmalı: ${mf.year_pct}`);
  assert.ok(mf.r2 > 0.9);
});

test('modelFactors: yakıt primi kestirilir (dizel/benzin)', () => {
  const mf = modelFactors(synthetic(40), { minSamples: 20 });
  assert.ok(mf.fuel_premium && mf.fuel_premium.Dizel > 0.08, `dizel primi ~%15 olmalı: ${JSON.stringify(mf.fuel_premium)}`);
});

test('modelFactors: örneklem eşiğin altındaysa ok=false ve değer üretmez', () => {
  const mf = modelFactors(synthetic(8), { minSamples: 20 });
  assert.equal(mf.ok, false);
  assert.equal(mf.km_per_10k_pct, null);
  assert.ok(mf.reason);
});

test('calibrate: eşiği geçen modellerden toplulaştırılmış katsayı üretir', () => {
  const temp = mkdtempSync(join(tmpdir(), 'cal-'));
  const path = join(temp, 'catalog.json');
  const rows = [
    ...synthetic(40).map((r, i) => ({ ...r, make: 'Fiat', model: 'Egea Cross', listing_id: `a${i}` })),
    ...synthetic(30).map((r, i) => ({ ...r, make: 'Renault', model: 'Clio', listing_id: `b${i}` })),
    ...synthetic(5).map((r, i) => ({ ...r, make: 'Kia', model: 'Stonic', listing_id: `c${i}` })),
  ];
  const catalog = upsertObserved(emptyCatalog(), rows);
  const cal = calibrate(catalog, { minSamples: 20 });
  assert.equal(cal.models.length, 3, 'tüm modeller raporlanır (ok olmayanlar da)');
  assert.equal(cal.fitted_models, 2);
  assert.ok(cal.aggregate.km_per_10k_above_pct < 0);
  assert.ok(cal.aggregate.year_pct > 0);
  assert.ok(cal.aggregate.based_on_models === 2);
  const stonic = cal.models.find((m) => m.model === 'Stonic');
  assert.equal(stonic.ok, false);
});

test('renderCalibrationReport: model tablosu ve kaynak/örneklem bilgisi verir', () => {
  const rows = [
    ...synthetic(40).map((r, i) => ({ ...r, make: 'Fiat', model: 'Egea Cross', listing_id: `a${i}` })),
    ...synthetic(30).map((r, i) => ({ ...r, make: 'Renault', model: 'Clio', listing_id: `b${i}` })),
  ];
  const catalog = upsertObserved(emptyCatalog(), rows);
  const md = renderCalibrationReport(calibrate(catalog, { minSamples: 20 }));
  assert.match(md, /Egea Cross/);
  assert.match(md, /örneklem|n=/);
  assert.match(md, /kestirim/i);
});

test('writeFactors: kestirim değerlerini yazar, hasar katsayılarını varsayım olarak KORUR', () => {
  const temp = mkdtempSync(join(tmpdir(), 'cal-'));
  const path = join(temp, 'factors.json');
  writeFileSync(path, JSON.stringify({
    severity: { orta: { pct: -0.06, sample: 0 } },
    painted_each: { pct: -0.015, cap: -0.12 },
    changed_each: { pct: -0.04, cap: -0.2 },
    km_per_10k_above: { pct: -0.005 },
    km_per_10k_below: { pct: 0.003 },
    status: 'varsayım',
  }));
  const rows = [
    ...synthetic(40).map((r, i) => ({ ...r, make: 'Fiat', model: 'Egea Cross', listing_id: `a${i}` })),
    ...synthetic(30).map((r, i) => ({ ...r, make: 'Renault', model: 'Clio', listing_id: `b${i}` })),
  ];
  const catalog = upsertObserved(emptyCatalog(), rows);
  const cal = calibrate(catalog, { minSamples: 20 });
  const written = writeFactors(path, cal);
  const f = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(f.status, 'kestirim');
  assert.ok(f.km_per_10k_above.pct < 0);
  assert.ok(f.km_per_10k_above.sample >= 20, 'katsayı örneklem sayısı yazılmalı');
  assert.equal(f.severity.orta.pct, -0.06, 'hasar katsayısı varsayım olarak korunmalı (ilan verisinde hasar alanı yok)');
  assert.equal(f.severity.orta.source, 'varsayım');
  assert.match(f.calibration.note, /hasar/i);
  assert.equal(written.status, 'kestirim');
});

test('calibrate: kalite filtresi — düşük R² ve ters işaretli modeller toplulaştırmaya girmez', () => {
  // gürültülü model: fiyat km/yıl ile ilişkisiz (rastgele)
  const noisy = Array.from({ length: 30 }, (_, i) => ({
    make: 'Kia', model: 'Stonic', listing_id: `n${i}`,
    year: 2018 + (i % 7), km: 30000 + ((i * 7919) % 90000), price_try: 900000 + ((i * 3571) % 400000), source: 't',
  }));
  const rows = [
    ...synthetic(40).map((r, i) => ({ ...r, make: 'Fiat', model: 'Egea Cross', listing_id: `a${i}` })),
    ...synthetic(30).map((r, i) => ({ ...r, make: 'Renault', model: 'Clio', listing_id: `b${i}` })),
    ...noisy,
  ];
  const cal = calibrate(upsertObserved(emptyCatalog(), rows), { minSamples: 20, minR2: 0.35 });
  const stonic = cal.models.find((m) => m.model === 'Stonic');
  assert.ok(stonic.excluded || !stonic.ok, 'gürültülü model dışlanmalı veya kestirim yapmamalı');
  assert.ok(cal.aggregate.excluded_models >= 1);
  assert.ok(cal.aggregate.km_per_10k_above_pct < 0, 'toplulaştırma temiz kalmalı');
});
