import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  excludeSelf,
  engineKey,
  engineMatches,
  fuelClass,
  isWeakData,
  baselineFromComparables,
  parseOto360Bands,
  combineBaselines,
  conditionAdjustments,
  kmAdjustment,
  adjustedValue,
  dealVerdict,
  valuationFlags,
  confidence,
  valueListing,
  renderValuation,
  DEFAULT_THRESHOLDS,
  ASSUMPTION_FACTORS,
} from '../valuation.mjs';

// --- karşılaştırma setinden baz değer -------------------------------------
const CMP = [
  { year: 2023, km: 26000, price_try: 1015000 },
  { year: 2023, km: 41000, price_try: 1065000 },
  { year: 2023, km: 18000, price_try: 1115000 },
  { year: 2024, km: 42500, price_try: 1025000 },
  { year: 2023, km: 52000, price_try: 985000 },
  { year: 2023, km: 31000, price_try: 1080000 },
];

test('baselineFromComparables: medyan, çeyreklikler, km medyanı ve örneklem', () => {
  const b = baselineFromComparables(CMP);
  assert.equal(b.sample_size, 6);
  assert.equal(b.median, 1045000); // (1025000+1065000)/2
  assert.equal(b.km_median, 36000);
  assert.equal(b.year_median, 2023);
  assert.ok(b.p25 <= b.median && b.median <= b.p75);
});

test('baselineFromComparables: boş set → null (uydurma yok)', () => {
  assert.equal(baselineFromComparables([]), null);
});

test('baselineFromComparables: yıl/km bandı dışındakiler kullanılmaz', () => {
  const wide = [...CMP, { year: 2018, km: 200000, price_try: 400000 }];
  const b = baselineFromComparables(wide, { year: 2023, km: 30000 });
  assert.equal(b.sample_size, 6, 'band dışı ilan örnekleme girmemeli');
  assert.ok(b.median > 900000);
});

// --- Oto360 bandı ---------------------------------------------------------
test('parseOto360Bands: 5 bandı etiketleriyle okur', () => {
  const txt = `Düşük Fiyat 916.000 - 933.000 TL Ortalama Altı 933.000 - 950.000 TL
    Piyasa Ortalaması 950.000 - 980.000 TL Ortalama Üstü 980.000 - 996.000 TL
    Yüksek Fiyat 996.000 - 1.015.000 TL`;
  const b = parseOto360Bands(txt);
  assert.deepEqual(b.market, [950000, 980000]);
  assert.deepEqual(b.low, [916000, 933000]);
  assert.deepEqual(b.high, [996000, 1015000]);
});

test('parseOto360Bands: bant yoksa null', () => {
  assert.equal(parseOto360Bands('hiçbir şey'), null);
});

// --- baz değer birleştirme ------------------------------------------------
test('combineBaselines: iki kaynak varsa ikisini de raporlar', () => {
  const cmp = baselineFromComparables(CMP);
  const oto = parseOto360Bands('Piyasa Ortalaması 1.020.000 - 1.080.000 TL');
  const c = combineBaselines({ oto360: oto, comparables: cmp });
  assert.equal(c.reference_try, 1050000); // oto360 ortası
  assert.equal(c.own_median_try, cmp.median);
  assert.ok(c.source.includes('oto360'));
  assert.ok(c.agreement_pct != null);
});

test('combineBaselines: %15+ ayrışma işaretlenir', () => {
  const cmp = baselineFromComparables(CMP); // ~1.072.500
  const oto = parseOto360Bands('Piyasa Ortalaması 800.000 - 800.000 TL');
  const c = combineBaselines({ oto360: oto, comparables: cmp });
  assert.equal(c.divergent, true);
});

test('combineBaselines: sadece kendi verisi → düşük güven işareti', () => {
  const c = combineBaselines({ comparables: baselineFromComparables(CMP) });
  assert.equal(c.reference_try, null);
  assert.ok(c.notes.some((n) => /Oto360|baz servis/i.test(n)));
});

// --- durum düzeltmesi -----------------------------------------------------
test('kmAdjustment: km medyanın üstündeyse değer düşer, altındaysa artar', () => {
  assert.ok(kmAdjustment({ km: 66000, km_median: 36000 }) < 0);
  assert.ok(kmAdjustment({ km: 16000, km_median: 36000 }) > 0);
  assert.equal(kmAdjustment({ km: 36000, km_median: 36000 }), 0);
});

test('kmAdjustment: etki ±%10 ile sınırlı (uç değerde sapma yok)', () => {
  assert.ok(kmAdjustment({ km: 900000, km_median: 36000 }) >= -0.10);
  assert.ok(kmAdjustment({ km: 0, km_median: 36000 }) <= 0.10);
});

test('conditionAdjustments: tramer şiddeti + boyalı/değişen parça ayrı satırlar', () => {
  const adj = conditionAdjustments(
    { severity: 'orta', painted_parts: 2, changed_parts: 1, expertise: 'yok' },
    ASSUMPTION_FACTORS,
  );
  const names = adj.map((a) => a.name);
  assert.ok(names.includes('tramer:orta'));
  assert.ok(names.includes('boyali:2'));
  assert.ok(names.includes('degisen:1'));
  assert.ok(adj.every((a) => typeof a.source === 'string' && a.source.length > 0), 'her düzeltme kaynağı etiketli olmalı');
});

test('conditionAdjustments: ekspertiz yokluğu DEĞERİ düşürmez, belirsizliği artırır', () => {
  const adj = conditionAdjustments({ severity: null, expertise: 'yok' }, ASSUMPTION_FACTORS);
  const total = adj.reduce((s, a) => s + a.pct, 0);
  assert.equal(total, 0);
  assert.ok(adj.some((a) => a.uncertainty_only === true));
});

test('conditionAdjustments: ağır tramer orta tramerden daha çok düşürür', () => {
  const agir = conditionAdjustments({ severity: 'agir' }, ASSUMPTION_FACTORS).reduce((s, a) => s + a.pct, 0);
  const orta = conditionAdjustments({ severity: 'orta' }, ASSUMPTION_FACTORS).reduce((s, a) => s + a.pct, 0);
  assert.ok(agir < orta);
  assert.ok(orta < 0);
});

test('adjustedValue: baz değere düzeltmeleri uygular', () => {
  const adj = conditionAdjustments({ severity: 'orta', painted_parts: 1, changed_parts: 1 }, ASSUMPTION_FACTORS);
  const v = adjustedValue(1000000, adj);
  assert.ok(v.adjusted_try < 1000000);
  assert.ok(v.adjusted_try > 800000);
  assert.equal(v.total_pct, Math.round(v.total_pct * 1000) / 1000);
});

// --- fiyat kararı ve flag'ler --------------------------------------------
test('dealVerdict: onaylanan eşikler — şüpheli ucuz / piyasa / pahalı', () => {
  assert.equal(dealVerdict({ asking: 700000, fair: 1000000 }).band, 'suspicious_cheap');
  assert.equal(dealVerdict({ asking: 880000, fair: 1000000 }).band, 'below_market');
  assert.equal(dealVerdict({ asking: 1000000, fair: 1000000 }).band, 'at_market');
  assert.equal(dealVerdict({ asking: 1150000, fair: 1000000 }).band, 'expensive');
  assert.equal(dealVerdict({ asking: 1300000, fair: 1000000 }).band, 'very_expensive');
});

test('dealVerdict: sapma yüzdesi ve etiket', () => {
  const v = dealVerdict({ asking: 900000, fair: 1000000 });
  assert.equal(v.deviation_pct, -10);
  assert.ok(v.label.length > 0);
});

test('valuationFlags: ağır tramer + piyasa üstü fiyat → tutarsızlık', () => {
  const f = valuationFlags({
    asking: 1100000,
    fair: 1000000,
    condition: { severity: 'agir' },
    baseline: { sample_size: 10 },
  });
  assert.ok(f.some((x) => x.code === 'tramer_not_priced' && x.severity === 'red'));
});

test('valuationFlags: ekspertiz yok + piyasa altı → riskli kombinasyon', () => {
  const f = valuationFlags({
    asking: 850000,
    fair: 1000000,
    condition: { expertise: 'yok' },
    baseline: { sample_size: 10 },
  });
  assert.ok(f.some((x) => x.code === 'no_expertise_cheap'));
});

test('valuationFlags: km uç değeri', () => {
  const f = valuationFlags({
    asking: 1000000,
    fair: 1000000,
    condition: {},
    km: 120000,
    km_median: 36000,
    baseline: { sample_size: 10 },
  });
  assert.ok(f.some((x) => x.code === 'km_outlier'));
});

test('valuationFlags: "hatasız" beyanı + değişen parça → çelişki', () => {
  const f = valuationFlags({
    asking: 1000000,
    fair: 1000000,
    condition: { changed_parts: 1 },
    description: 'Araç hatasız boyasız değişensizdir',
    baseline: { sample_size: 10 },
  });
  assert.ok(f.some((x) => x.code === 'claim_conflict'));
});

test('valuationFlags: iki kaynak ayrışırsa veri uyarısı', () => {
  const f = valuationFlags({
    asking: 1000000,
    fair: 1000000,
    condition: {},
    baseline: { sample_size: 10, divergent: true },
  });
  assert.ok(f.some((x) => x.code === 'source_divergence'));
});

test('valuationFlags: temiz araç + piyasa fiyatı → kritik flag yok', () => {
  const f = valuationFlags({
    asking: 1000000,
    fair: 1010000,
    condition: { severity: null, expertise: 'var' },
    km: 40000,
    km_median: 36000,
    baseline: { sample_size: 12 },
  });
  assert.equal(f.filter((x) => x.severity === 'red').length, 0);
});

// --- güven -----------------------------------------------------------------
test('confidence: örneklem büyükse yüksek, küçükse düşük', () => {
  assert.equal(confidence({ sample_size: 30, has_reference: true, divergent: false }).level, 'yüksek');
  assert.equal(confidence({ sample_size: 3, has_reference: false, divergent: false }).level, 'düşük');
});

test('confidence: ayrışma ve ekspertiz eksikliği güveni düşürür', () => {
  const a = confidence({ sample_size: 30, has_reference: true, divergent: false }).score;
  const b = confidence({ sample_size: 30, has_reference: true, divergent: true }).score;
  const c = confidence({ sample_size: 30, has_reference: true, divergent: false, expertise_missing: true }).score;
  assert.ok(b < a && c < a);
});

// --- uçtan uca -------------------------------------------------------------
test('valueListing: ilan → baz, düzeltme, karar, flag ve gerekçe', () => {
  const v = valueListing({
    listing: { make: 'Fiat', model: 'Egea Cross', year: 2023, km: 26000, price_try: 1015000, tramer_try: 13248, tramer_year: 2023 },
    comparables: CMP,
    condition: { severity: 'hafif', painted_parts: 0, changed_parts: 0, expertise: 'yok' },
    oto360: parseOto360Bands('Piyasa Ortalaması 950.000 - 980.000 TL'),
    vehicle_value_try: 1015000,
  });
  assert.ok(v.fair_value_try > 900000 && v.fair_value_try < 1100000);
  assert.ok(v.verdict.band);
  assert.ok(v.adjustments.length >= 1);
  assert.ok(v.confidence.level);
  const md = renderValuation(v);
  assert.match(md, /Neden bu değer/);
  assert.match(md, /Kaynak/);
});

test('valueListing: hiç karşılaştırma yoksa dürüstçe "hesaplanamadı" der', () => {
  const v = valueListing({ listing: { make: 'X', model: 'Y', year: 2020, km: 1000, price_try: 500000 }, comparables: [] });
  assert.equal(v.fair_value_try, null);
  assert.match(renderValuation(v), /hesaplanamadı|yetersiz/i);
});

test('DEFAULT_THRESHOLDS: onaylanan eşikler koda gömülü', () => {
  assert.deepEqual(DEFAULT_THRESHOLDS, { suspicious_cheap: -0.25, below_market: -0.10, expensive: 0.10, very_expensive: 0.25 });
});

test('excludeSelf: değerlenen ilan karşılaştırma setinden çıkarılır (kendi kendine referans yok)', () => {
  const listing = { year: 2025, km: 8288, price_try: 1198000 };
  const pool = [listing, { year: 2025, km: 11000, price_try: 1349000 }, { year: 2024, km: 7200, price_try: 1165000 }];
  const filtered = excludeSelf(pool, listing);
  assert.equal(filtered.length, 2);
  assert.ok(!filtered.includes(listing));
});

test('excludeSelf: aynı yıl+km ama farklı fiyat farklı ilandır (çıkarılmaz)', () => {
  const listing = { year: 2025, km: 8288, price_try: 1198000 };
  const other = { year: 2025, km: 8288, price_try: 1250000 };
  assert.equal(excludeSelf([other], listing).length, 1);
});

test('dealVerdict: zayıf veride "şüpheli ucuz" iddiası yerine veri yetersiz denir', () => {
  const v = dealVerdict({ asking: 700000, fair: 1000000, low_confidence: true });
  assert.equal(v.band, 'inconclusive');
  assert.ok(v.inconclusive_reason);
  assert.equal(v.deviation_pct, -30);
});

test('dealVerdict: zayıf veride piyasa değerinde kararı değişmez', () => {
  assert.equal(dealVerdict({ asking: 1000000, fair: 1000000, low_confidence: true }).band, 'at_market');
});

test('isWeakData: küçük örneklem veya geniş dağılım → zayıf', () => {
  assert.equal(isWeakData({ sample_size: 3, iqr_ratio: 0.1 }), true);
  assert.equal(isWeakData({ sample_size: 20, iqr_ratio: 0.4 }), true);
  assert.equal(isWeakData({ sample_size: 20, iqr_ratio: 0.1 }), false);
});

test('baselineFromComparables: dağılım genişliği (IQR/medyan) hesaplanır', () => {
  const b = baselineFromComparables(CMP);
  assert.ok(b.iqr_ratio > 0 && b.iqr_ratio < 0.5);
});

test('valuationFlags: geniş dağılım uyarısı', () => {
  const f = valuationFlags({ asking: 1000000, fair: 1000000, baseline: { sample_size: 9, iqr_ratio: 0.4 } });
  assert.ok(f.some((x) => x.code === 'wide_spread'));
});

test('engineKey: aynı motor ailesi farklı yazımlarda eşleşir', () => {
  assert.equal(engineKey('1.6 Multijet Urban'), engineKey('1.6 MJ Lounge DCT'));
  assert.equal(engineKey('1.4 Fire Urban'), engineKey('1.4 FIRE'));
  assert.notEqual(engineKey('1.4 Fire'), engineKey('1.6 Multijet'));
  assert.equal(engineKey('bilinmeyen metin'), null);
});

test('baselineFromComparables: motor ailesi eşleşmesi bandı daraltır (dizel/benzin karışmaz)', () => {
  const mixed = [
    { year: 2025, km: 9000, price_try: 1198000, note: '1.4 Fire Urban' },
    { year: 2025, km: 8000, price_try: 1349000, note: '1.5 T4 Urban' },
    { year: 2024, km: 11000, price_try: 1195000, note: '1.4 Urban' },
    { year: 2025, km: 8989, price_try: 1640000, note: '1.6 MJ Lounge' },
    { year: 2024, km: 6001, price_try: 1650000, note: '1.6 Multijet Urban DCT' },
    { year: 2026, km: 6001, price_try: 1725000, note: '1.6 MJ Urban' },
  ];
  const benzin = baselineFromComparables(mixed, { year: 2025, km: 8288, engine: '1.4 Fire' });
  assert.equal(benzin.engine_filtered, true);
  assert.ok(benzin.median < 1300000, 'dizel ilanlar medyanı yukarı çekmemeli');
  const dizel = baselineFromComparables(mixed, { year: 2025, km: 8288, engine: '1.6 Multijet' });
  assert.ok(dizel.median > 1500000);
});

test('baselineFromComparables: motor bilgisi yoksa karışık bant işaretlenir', () => {
  const mixed = [
    { year: 2025, km: 9000, price_try: 1198000, note: '1.4 Fire Urban' },
    { year: 2025, km: 8989, price_try: 1640000, note: '1.6 MJ Lounge' },
  ];
  const b = baselineFromComparables(mixed, { year: 2025, km: 9000 });
  assert.equal(b.engine_mixed, true);
});

test('valuationFlags: karışık motor bandı uyarısı', () => {
  const f = valuationFlags({ asking: 1200000, fair: 1200000, baseline: { sample_size: 9, engine_mixed: true } });
  assert.ok(f.some((x) => x.code === 'engine_mixed_band'));
});

test('engineMatches: hacim aynı + teknoloji bilinmiyorsa gevşek eşleşme olur, dizel-benzin karışmaz', () => {
  assert.equal(engineMatches('1.4-benzin-fire', '1.4'), true);
  assert.equal(engineMatches('1.6-dizel-multijet', '1.6'), true);
  assert.equal(engineMatches('1.4-benzin-fire', '1.6-dizel-multijet'), false);
  assert.equal(engineMatches('1.4-benzin-fire', '1.4-hibrit'), false);
  assert.equal(engineMatches(null, '1.4'), false);
});

test('fuelClass: dizel/benzin sınıfı ayrılır, bilinmeyen null', () => {
  assert.equal(fuelClass('1.6-dizel-multijet'), 'dizel');
  assert.equal(fuelClass('1.4-benzin-fire'), 'benzin');
  assert.equal(fuelClass('1.5-hibrit'), 'benzin');
  assert.equal(fuelClass('1.4'), null);
  assert.equal(fuelClass(null), null);
});

test('motor filtresi: yeterli aynı-motor ilan yoksa çelişen yakıt sınıfı dışlanır', () => {
  const pool = [
    { year: 2025, km: 11000, price_try: 1349000, note: '2025 Urban Traction+ GSR' }, // motor bilgisi yazılmamış
    { year: 2024, km: 11000, price_try: 1195000, note: '1.4 Urban 11 bin km' },
    { year: 2025, km: 8989, price_try: 1640000, note: '1.6 MJ Lounge' },
    { year: 2024, km: 6001, price_try: 1650000, note: '1.6 Multijet Urban DCT' },
  ];
  const b = baselineFromComparables(pool, { year: 2025, km: 8288, engine: '1.4 Fire' });
  assert.equal(b.engine_filtered, true, 'dizeller dışlanmalı');
  assert.ok(b.median < 1400000, `dizel fiyatları medyanı yukarı çekmemeli (medyan=${b.median})`);
  assert.equal(b.engine_mixed, false);
});
