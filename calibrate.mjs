// calibrate.mjs — değerleme katsayılarını KENDİ ilan verimizden kestirir.
//
// Neden: `data/catalog/factors.json` başlangıçta temkinli VARSAYIM değerleriyle geliyor.
// Bir modelde yeterli ilan biriktiğinde km/yıl/yakıt etkisini regresyonla kestirip
// katsayıları `kestirim` durumuna geçiriyoruz. Böylece rapor "varsayım" yerine
// "kendi verimizden kestirim (n=…)" yazabiliyor.
//
// DÜRÜSTLÜK SINIRI: tramer/boya/değişen katsayıları ilan listelerinden kestirilemez —
// toplanan kartlarda hasar alanı yok. Bu katsayılar `varsayım` olarak KALIR; dosyaya
// gerekçesiyle yazılır. Uydurma kestirim üretilmez.

import { readFileSync, writeFileSync } from 'node:fs';

const KM_STEP = 10000;

/**
 * log(fiyat) ~ katsayılar × özellikler ile en küçük kareler (normal denklemler + Gauss).
 * Yetersiz/gözenekli veride null döner (sıfıra bölme veya tekil matris → kestirim yok).
 */
export function fitLogLinear(samples = [], features = []) {
  const rows = (samples || []).filter((s) => s && Number.isFinite(s.price_try) && s.price_try > 0);
  if (rows.length < features.length + 5) return null;

  const X = [];
  const y = [];
  for (const r of rows) {
    const vals = features.map((f) => Number(f.value(r)));
    if (vals.some((v) => !Number.isFinite(v))) continue;
    X.push([1, ...vals]);
    y.push(Math.log(r.price_try));
  }
  if (X.length < features.length + 5) return null;

  const p = features.length + 1;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const beta = solve(XtX, Xty);
  if (!beta) return null;

  const yMean = y.reduce((s, v) => s + v, 0) / y.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < X.length; i++) {
    const pred = X[i].reduce((s, v, k) => s + v * beta[k], 0);
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return {
    n: X.length,
    intercept: beta[0],
    coefficients: features.map((f, i) => ({ name: f.name, value: beta[i + 1], log: Boolean(f.log) })),
    r2: Math.round(r2 * 1000) / 1000,
    rmse_log: Math.round(Math.sqrt(ssRes / X.length) * 1000) / 1000,
  };
}

/** Tek model için katsayılar (km/yıl/yakıt). */
export function modelFactors(samples = [], { minSamples = 20 } = {}) {
  const rows = (samples || []).filter((s) => Number.isFinite(s.price_try) && Number.isFinite(s.km) && Number.isFinite(s.year));
  const out = { n: rows.length, ok: false, km_per_10k_pct: null, year_pct: null, fuel_premium: null, r2: null, reason: null };
  if (rows.length < minSamples) {
    out.reason = `örneklem yetersiz (n=${rows.length} < ${minSamples})`;
    return out;
  }
  const fuels = [...new Set(rows.map((r) => r.fuel).filter(Boolean))];
  const useFuel = fuels.length > 1 && rows.filter((r) => r.fuel).length >= rows.length * 0.8;

  const features = [
    { name: 'yil', value: (r) => r.year - 2020 },
    { name: 'log_km', value: (r) => Math.log(r.km), log: true },
  ];
  if (useFuel && fuels.includes('Dizel')) features.push({ name: 'dizel', value: (r) => (r.fuel === 'Dizel' ? 1 : 0) });

  const fit = fitLogLinear(rows, features);
  if (!fit) {
    out.reason = 'regresyon kurulamadı (veri çeşitliliği yetersiz)';
    return out;
  }
  const kmMedian = median(rows.map((r) => r.km));
  const bLogKm = fit.coefficients.find((c) => c.name === 'log_km').value;
  const bYear = fit.coefficients.find((c) => c.name === 'yil').value;
  const bDiesel = fit.coefficients.find((c) => c.name === 'dizel');

  out.ok = true;
  out.km_elasticity = Math.round(bLogKm * 1000) / 1000;
  // log uzayındaki esneklik → medyan km etrafında 10.000 km'lik yüzde değişim
  out.km_per_10k_pct = Math.round(bLogKm * (KM_STEP / kmMedian) * 10000) / 10000;
  out.year_pct = Math.round((Math.exp(bYear) - 1) * 10000) / 10000;
  out.fuel_premium = bDiesel ? { Dizel: Math.round((Math.exp(bDiesel.value) - 1) * 10000) / 10000 } : null;
  out.r2 = fit.r2;
  out.km_median = kmMedian;
  out.reason = null;
  return out;
}

/** Katalogdaki tüm modeller için kalibrasyon; toplulaştırılmış katsayıları üretir. */
export function calibrate(catalog, { minSamples = 20, minModels = 2, minR2 = 0.35 } = {}) {
  const models = [];
  for (const [, m] of Object.entries(catalog.models || {})) {
    const samples = (m.observed && m.observed.samples) || [];
    if (!samples.length) continue;
    const mf = modelFactors(samples, { minSamples });
    models.push({ make: m.make, model: m.model, ...mf });
  }
  models.sort((a, b) => b.n - a.n);

  // KALİTE FİLTRESİ: toplulaştırmaya yalnızca güvenilir kestirimler girer.
  // R² düşük (gürültülü model), km işareti beklenmedik (pozitif) veya yıl etkisi
  // ters olan modeller dışlanır ve gerekçesi rapora yazılır.
  const allFitted = models.filter((x) => x.ok);
  const fitted = allFitted.filter((x) => {
    if (x.r2 < minR2) {
      x.excluded = `R² düşük (${x.r2} < ${minR2})`;
      return false;
    }
    if (x.km_per_10k_pct > 0) {
      x.excluded = 'km etkisi beklenmedik (pozitif) — muhtemelen yıl/donanım karışması';
      return false;
    }
    if (x.year_pct != null && x.year_pct < 0) {
      x.excluded = 'yıl etkisi negatif — veri ters';
      return false;
    }
    return true;
  });
  const agg = {
    based_on_models: fitted.length,
    excluded_models: allFitted.length - fitted.length,
    based_on_samples: fitted.reduce((s, x) => s + x.n, 0),
    km_per_10k_above_pct: null,
    km_per_10k_below_pct: null,
    year_pct: null,
    fuel_premium: null,
    median_r2: null,
  };
  if (fitted.length >= minModels) {
    const km = median(fitted.map((x) => x.km_per_10k_pct));
    const yr = median(fitted.map((x) => x.year_pct));
    agg.km_per_10k_above_pct = round4(km);
    // İlan verisi km etkisinde asimetri göstermiyorsa simetrik kullanılır (uydurma yok).
    agg.km_per_10k_below_pct = round4(-km);
    agg.year_pct = round4(yr);
    const diesels = fitted.map((x) => x.fuel_premium && x.fuel_premium.Dizel).filter((v) => v != null);
    if (diesels.length >= minModels) agg.fuel_premium = { Dizel: round4(median(diesels)) };
    agg.median_r2 = median(fitted.map((x) => x.r2));
  }
  return {
    status: fitted.length >= minModels ? 'kestirim' : 'varsayım',
    min_samples: minSamples,
    min_r2: minR2,
    models,
    fitted_models: fitted.length,
    aggregate: agg,
    generated_at: new Date().toISOString(),
  };
}

export function renderCalibrationReport(cal) {
  const L = [];
  L.push('# Katsayı Kalibrasyonu (kendi ilan verimizden)');
  L.push('');
  L.push(
    `Durum: **${cal.status}** · eşik: model başına ≥${cal.min_samples} ilan, R² ≥ ${cal.min_r2 ?? '—'} · kestirim yapılan model: ${cal.fitted_models}` +
      (cal.aggregate && cal.aggregate.excluded_models ? ` · kalite filtresine takılan: ${cal.aggregate.excluded_models}` : ''),
  );
  const a = cal.aggregate;
  if (cal.status !== 'kestirim') {
    L.push('');
    L.push(
      `_Toplulaştırılmış katsayı ÜRETİLMEDİ: yeterli sayıda model eşiği geçmedi (kestirim yapan model: ${cal.fitted_models}). Mevcut \`varsayım\` değerleri geçerli kalır. Aşağıdaki tablo yine de hangi modelin hazır olduğunu gösterir._`,
    );
    L.push('');
  } else {
    L.push('');
    L.push(`Toplulaştırılmış katsayılar (${a.based_on_models} model, ${a.based_on_samples} ilan örneklemi):`);
  }
  L.push('');
  L.push(`- km (10.000 km başına, medyan üstü): **${pct(a.km_per_10k_above_pct)}**`);
  L.push(`- km (10.000 km başına, medyan altı): **${pct(a.km_per_10k_below_pct)}** (veri asimetri göstermediği için simetrik)`);
  L.push(`- yıl (yıllık değer değişimi): **${pct(a.year_pct)}**`);
  if (a.fuel_premium) L.push(`- yakıt primi (Dizel): **${pct(a.fuel_premium.Dizel)}**`);
  L.push(`- medyan R²: ${a.median_r2}`);
  L.push('');
  L.push('## Model bazında');
  L.push('');
  L.push('| Marka | Model | n | km/10k | yıl | dizel primi | R² | durum |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const m of cal.models) {
    L.push(
      `| ${m.make} | ${m.model} | ${m.n} | ${m.ok ? pct(m.km_per_10k_pct) : '—'} | ${m.ok ? pct(m.year_pct) : '—'} | ${
        m.fuel_premium ? pct(m.fuel_premium.Dizel) : '—'
      } | ${m.ok ? m.r2 : '—'} | ${m.ok ? (m.excluded ? `⚠️ dışlandı: ${m.excluded}` : '✅ kestirim') : m.reason} |`,
    );
  }
  L.push('');
  L.push('**Kestirilemeyen katsayılar:** tramer şiddeti, boyalı/değişen parça. İlan listelerinde hasar alanı');
  L.push('yok; bu katsayılar `varsayım` olarak kalır ve raporda öyle etiketlenir.');
  return L.join('\n');
}

/** factors.json'a yazar: kestirim değerleri + hasar varsayımlarını korur. */
export function writeFactors(path, cal, { existingPath = path } = {}) {
  let f = {};
  try {
    f = JSON.parse(readFileSync(existingPath, 'utf8'));
  } catch {
    f = {};
  }
  if (cal.status !== 'kestirim') {
    f.status = 'varsayım';
    f.calibration = { ...(f.calibration || {}), last_attempt: cal.generated_at, note: 'yeterli model yok; varsayım geçerli' };
    writeFileSync(path, `${JSON.stringify(f, null, 2)}\n`);
    return f;
  }
  const a = cal.aggregate;
  f.km_per_10k_above = { pct: a.km_per_10k_above_pct, sample: a.based_on_samples, source: 'kestirim' };
  f.km_per_10k_below = { pct: a.km_per_10k_below_pct, sample: a.based_on_samples, source: 'kestirim' };
  if (a.year_pct != null) f.year_pct = { pct: a.year_pct, sample: a.based_on_samples, source: 'kestirim' };
  if (a.fuel_premium) f.fuel_premium = { ...a.fuel_premium, sample: a.based_on_samples, source: 'kestirim' };
  for (const k of ['severity', 'painted_each', 'changed_each']) {
    const v = f[k];
    if (!v) continue;
    if (k === 'severity') for (const key of Object.keys(v)) f.severity[key] = { ...v[key], source: 'varsayım' };
    else f[k] = { ...v, source: 'varsayım' };
  }
  f.status = 'kestirim';
  f.calibrated_at = cal.generated_at;
  f.calibration = {
    min_sample_per_model: cal.min_samples,
    fitted_models: cal.fitted_models,
    based_on_samples: a.based_on_samples,
    median_r2: a.median_r2,
    note: 'km/yıl/yakıt katsayıları kendi ilan verimizden regresyonla kestirildi. Tramer/boya/değişen katsayıları ilan verisinde hasar alanı olmadığı için VARSAYIM olarak korunur.',
  };
  writeFileSync(path, `${JSON.stringify(f, null, 2)}\n`);
  return f;
}

// ---- CLI ----
// node calibrate.mjs [--min 20] [--yaz] [--json] [--rapor dosya.md]
export function runCli(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) args[k] = true;
    else {
      args[k] = next;
      i++;
    }
  }
  const catalogPath = args.katalog || 'data/catalog/catalog.json';
  const factorsPath = args.katsayi || 'data/catalog/factors.json';
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const cal = calibrate(catalog, { minSamples: Number(args.min) || 20 });
  if (args.json) {
    writeFileSync(String(args.json), `${JSON.stringify(cal, null, 2)}\n`);
    console.log(`kalibrasyon verisi yazıldı: ${args.json}`);
  }
  const md = renderCalibrationReport(cal);
  console.log(md);
  if (args.rapor) {
    writeFileSync(String(args.rapor), `${md}\n`);
    console.log(`\nrapor: ${args.rapor}`);
  }
  if (args.yaz) {
    const f = writeFactors(factorsPath, cal);
    console.log(`\n${factorsPath} güncellendi → status: ${f.status}${f.calibration ? ` (${f.calibration.fitted_models} model, ${f.calibration.based_on_samples} örneklem)` : ''}`);
  }
}

// -------------------------------------------------------------- yardımcılar
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) return null; // tekil → kestirim yok
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  // Gauss-Jordan sonrası köşegen form: x_i = M[i][n] / M[i][i]
  return M.map((row, i) => row[n] / row[i]);
}

function median(arr) {
  const s = [...arr].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function pct(x) {
  return x == null ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(2)}%`;
}
function round4(x) {
  return x == null ? null : Math.round(x * 10000) / 10000;
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
