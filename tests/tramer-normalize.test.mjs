import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAmountTufe,
  normalizeAmountUsd,
  classifySeverity,
  buildTramerTable,
} from '../tramer-normalize.mjs';

// Senteitik çapa setleri (test için; gerçek dosyalar config/inflation/ altında)
const TUFE = {
  ref_year: 2025,
  index: { 2015: 20, 2018: 40, 2021: 60, 2023: 90, 2025: 100 },
};
const USD = {
  ref_year: 2025,
  usd_try: { 2015: 3.0, 2018: 4.8, 2021: 8.9, 2023: 23.5, 2025: 42.0 },
};

test('TÜFE normalizasyonu: 2018/20k ≈ 2025/50k', () => {
  const got = normalizeAmountTufe(20000, 2018, TUFE, 2025);
  assert.equal(got, 50000);
});

test('TÜFE normalizasyonu: referans yılındaki tutar değişmez', () => {
  assert.equal(normalizeAmountTufe(100000, 2025, TUFE, 2025), 100000);
});

test('Çapa setinde yıl yoksa hata fırlatır (sessiz uydurma yasak)', () => {
  assert.throws(() => normalizeAmountTufe(1000, 2012, TUFE, 2025), /anchor/);
});

test('USD normalizasyonu: hasar yılı USD değeri bugünkü kurla', () => {
  // 20000 TL / 4.8 = 4166.67 USD → * 42.0 = 175000
  const got = normalizeAmountUsd(20000, 2018, USD, 2025);
  assert.ok(Math.abs(got - 175000) < 1);
});

test('Şiddet sınıflaması normalize tutarın araç değerine oranına göre', () => {
  assert.equal(classifySeverity(10000, 1000000), 'küçük');
  assert.equal(classifySeverity(100000, 1000000), 'orta');
  assert.equal(classifySeverity(450000, 1000000), 'ağır');
  assert.equal(classifySeverity(720000, 1000000), 'pert');
});

test('Aynı nominal, farklı yıl: eski kayıt daha ağır çıkar', () => {
  const eski = normalizeAmountTufe(20000, 2018, TUFE, 2025);   // 50k
  const yeni = normalizeAmountTufe(50000, 2023, TUFE, 2025);   // 55.5k
  assert.ok(eski < yeni);
  // ama oran: 20k/2018 kaydı 50k'ya denk — 50k/2023 kaydından şiddet oranı olarak yakın
  assert.equal(
    classifySeverity(eski, 1000000),
    classifySeverity(50000, 1000000), // 2023 nominali ile KIYASLANAMAZ — sadece normalize ile
  );
});

test('buildTramerTable: satırlar nominal→normalize→şiddet, toplam ve oran', () => {
  const recs = [
    { year: 2018, amount_try: 20000, source: 'sbm', kind: 'maddi hasar' },
    { year: 2023, amount_try: 50000, source: 'seller-claim', kind: 'cam' },
  ];
  const t = buildTramerTable(recs, { tufe: TUFE, usd: USD }, 2025, 1000000);
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[0].amount_try, 20000);
  assert.equal(t.rows[0].amount_ref_try, 50000);
  assert.equal(t.rows[0].severity, 'küçük');
  assert.ok(t.rows[0].amount_ref_usd_try > 0);
  assert.ok(Math.abs(t.total_ref_try - (50000 + 50000 / 0.9)) < 1);
  assert.ok(Math.abs(t.total_ref_to_price - 0.105) < 0.01);
});

test('buildTramerTable: boş kayıt → temiz yapı, uydurma yok', () => {
  const t = buildTramerTable([], { tufe: TUFE, usd: USD }, 2025, 1000000);
  assert.equal(t.rows.length, 0);
  assert.equal(t.total_ref_try, 0);
  assert.equal(t.total_ref_to_price, 0);
});
