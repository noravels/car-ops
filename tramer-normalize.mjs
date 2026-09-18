// tramer-normalize.mjs — tramer hasar tutarlarını enflasyonla normalize eder.
// Kural: nominal tutar karşılaştırılamaz; tutar + yıl birlikte anlamlıdır.
// Çapalar: TÜFE (birincil) ve TCMB USD yıllık ortalama (ikincil görünüm).

export function normalizeAmountTufe(amountTry, year, tufeAnchor, refYear) {
  const from = tufeAnchor.index[year];
  const to = tufeAnchor.index[refYear];
  if (from == null || to == null) {
    throw new Error(`anchor missing for year ${from == null ? year : refYear}`);
  }
  return (amountTry * to) / from;
}

export function normalizeAmountUsd(amountTry, year, usdAnchor, refYear) {
  const from = usdAnchor.usd_try[year];
  const to = usdAnchor.usd_try[refYear];
  if (from == null || to == null) {
    throw new Error(`anchor missing for year ${from == null ? year : refYear}`);
  }
  return (amountTry / from) * to;
}

// Şiddet: normalize tutarın araç değerine oranı.
// küçük < %5, orta %5–30, ağır %30–70, pert >= %70 (onarım > değer ~%70)
export function classifySeverity(amountRefTry, vehicleValueTry) {
  if (!vehicleValueTry || vehicleValueTry <= 0) return 'bilinmiyor';
  const ratio = amountRefTry / vehicleValueTry;
  if (ratio >= 0.7) return 'pert';
  if (ratio >= 0.3) return 'ağır';
  if (ratio > 0.05) return 'orta';
  return 'küçük';
}

export function buildTramerTable(records, anchors, refYear, vehicleValueTry) {
  const rows = [];
  let totalRefTry = 0;
  for (const r of records || []) {
    const refTry = normalizeAmountTufe(r.amount_try, r.year, anchors.tufe, refYear);
    const refUsdTry = normalizeAmountUsd(r.amount_try, r.year, anchors.usd, refYear);
    totalRefTry += refTry;
    rows.push({
      year: r.year,
      amount_try: r.amount_try,
      amount_ref_try: refTry,
      amount_ref_usd_try: refUsdTry,
      severity: classifySeverity(refTry, vehicleValueTry),
      kind: r.kind || null,
      source: r.source || null,
    });
  }
  return {
    ref_year: refYear,
    rows,
    total_ref_try: totalRefTry,
    total_ref_to_price: vehicleValueTry ? totalRefTry / vehicleValueTry : 0,
  };
}

// Markdown tablo çıktısı (rapor C bloğuna giren metin)
export function renderTramerTable(table) {
  if (!table.rows.length) {
    return `Tramer kaydı yok (normalize çapa: ${table.ref_year}). Not: tramer temiz ≠ kazasız — sigortasız tamirler kayda düşmez.`;
  }
  const lines = [
    `| Yıl | Nominal | Normalize (${table.ref_year}) | USD eşdeğeri | Şiddet | Tür | Kaynak |`,
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of table.rows) {
    lines.push(
      `| ${r.year} | ${r.amount_try.toLocaleString('tr-TR')} TL | ` +
        `${Math.round(r.amount_ref_try).toLocaleString('tr-TR')} TL | ` +
        `${Math.round(r.amount_ref_usd_try).toLocaleString('tr-TR')} TL | ` +
        `${r.severity} | ${r.kind || '—'} | ${r.source || '—'} |`,
    );
  }
  lines.push(
    `Toplam normalize hasar: ${Math.round(table.total_ref_try).toLocaleString('tr-TR')} TL ` +
      `(ilan fiyatının %${(table.total_ref_to_price * 100).toFixed(1)}'i)`,
  );
  return lines.join('\n');
}

// CLI: node tramer-normalize.mjs <tramer.json> [araç-değeri]
// tramer.json: {"records":[{"year":2018,"amount_try":20000,"source":"sbm"}],"vehicle_value_try":850000}
export async function runCli(argv) {
  const [file, valueArg] = argv;
  if (!file) {
    console.error('kullanım: node tramer-normalize.mjs <tramer.json> [araç-değeri-TL]');
    process.exitCode = 1;
    return;
  }
  const { readFileSync } = await import('node:fs');
  const input = JSON.parse(readFileSync(file, 'utf8'));
  const tufe = JSON.parse(readFileSync(new URL('./config/inflation/tr-tufe.json', import.meta.url), 'utf8'));
  const usd = JSON.parse(readFileSync(new URL('./config/inflation/tr-usd.json', import.meta.url), 'utf8'));
  const value = valueArg ? Number(valueArg) : input.vehicle_value_try;
  const table = buildTramerTable(input.records, { tufe, usd }, tufe.ref_year, value);
  console.log(renderTramerTable(table));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  await runCli(process.argv.slice(2));
}
