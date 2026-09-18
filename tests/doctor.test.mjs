import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSetup } from '../doctor.mjs';

const FULL_PROFILE = {
  location: { province: 'Kocaeli', radius: 1 },
  budget: { mode: 'kredi', down_payment_try: 800000, monthly_max_try: 30000, months: 24, monthly_rate_max: 0.035 },
  vehicle_target: { make: 'Fiat', model: 'Egea Cross' },
  limits: { year_min: 2022, km_max: 120000 },
  risk: { tolerance: 'low' },
};

test('checkSetup: dolu profilde eksik yok', () => {
  const r = checkSetup({ profile: FULL_PROFILE, files: { watchlist: true, markets: true } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
});

test('checkSetup: boş profilde eksikler listelenir (hangi alanlar net)', () => {
  const r = checkSetup({ profile: null, files: { watchlist: false, markets: true } });
  assert.equal(r.ok, false);
  assert.ok(r.missing.includes('config/profile.yml'));
  assert.ok(r.onboarding_needed);
});

test('checkSetup: konum eksikse uyarı, bütçe eksikse uyarı', () => {
  const partial = { location: {}, budget: { mode: 'kredi' }, vehicle_target: { make: 'Fiat' } };
  const r = checkSetup({ profile: partial, files: { watchlist: true, markets: true } });
  assert.equal(r.ok, false);
  assert.ok(r.warnings.some((w) => /konum|il/.test(w)));
  assert.ok(r.warnings.some((w) => /bütçe|peşinat|aylık/.test(w)));
  assert.ok(r.warnings.some((w) => /model/.test(w)));
});

test('checkSetup: peşin modunda aylık alanları istenmez', () => {
  const cash = { location: { province: 'Ankara' }, budget: { mode: 'pesin', total_max_try: 1200000 }, vehicle_target: { make: 'Fiat', model: 'Egea' } };
  const r = checkSetup({ profile: cash, files: { watchlist: true, markets: true } });
  assert.equal(r.ok, true);
});

test('checkSetup: şablon içeriği kişiselleştirilmemişse uyarır', () => {
  const r = checkSetup({
    profile: { ...FULL_PROFILE, location: { province: null } },
    files: { watchlist: true, markets: true },
    templateText: 'location:\n  province: null\n',
    profileText: 'location:\n  province: null\n',
  });
  assert.ok(r.unpersonalized.length > 0);
});

test('checkSetup: eksik sistem dosyaları raporlanır', () => {
  const r = checkSetup({ profile: FULL_PROFILE, files: { watchlist: false, markets: false } });
  assert.ok(r.missing_files.includes('watchlist.yml'));
  assert.ok(r.missing_files.includes('config/markets.yml'));
});
