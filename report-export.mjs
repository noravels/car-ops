// report-export.mjs — aday listesini TEK karşılaştırma sayfasına çevirir (HTML + Markdown).
//
// Neden: karar aşamasında birden fazla aday yan yana görülmek isteniyor. Raporlar tek tek
// markdown; bu modül aynı değerleme motorunu (valuation.mjs) kullanarak tabloyu üretir —
// yani karşılaştırma, raporların elle kopyalanması değil, tek kaynaktan hesaplanır.
//
// Girdi: aday listesi (JSON) + katalog (karşılaştırma seti).
// Çıktı: reports/karsilastirma.html (yazdırılabilir) ve .md

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadCatalogFile, exportSamples } from './catalog.mjs';
import { valueListing, renderValuation, parseOto360Bands, ASSUMPTION_FACTORS } from './valuation.mjs';
import { normalizeAmountTufe, classifySeverity } from './tramer-normalize.mjs';

/** Aday listesini normalize eder: eksik id üretilir, alanlar tiplenir. */
export function loadCandidates(input) {
  const raw = Array.isArray(input) ? input : input && input.candidates ? input.candidates : [];
  return raw.map((c, i) => ({
    id: c.id || `A${String(i + 1).padStart(3, '0')}`,
    label: c.label || [c.year, c.variant, c.city].filter(Boolean).join(' · ') || `Aday ${i + 1}`,
    make: c.make || null,
    model: c.model || null,
    variant: c.variant || c.motor || null,
    year: c.year ?? null,
    km: c.km ?? null,
    price_try: c.price_try ?? c.price ?? null,
    tramer_try: c.tramer_try ?? null,
    tramer_year: c.tramer_year ?? null,
    painted_parts: c.painted_parts ?? 0,
    changed_parts: c.changed_parts ?? 0,
    expertise: c.expertise ?? null,
    description: c.description || '',
    city: c.city || null,
    source: c.source || null,
    url: c.url || null,
    note: c.note || null,
    oto360: c.oto360 || null,
  }));
}

/**
 * Adayları katalogdaki karşılaştırma setiyle değerler ve karşılaştırma satırları üretir.
 * Sıralama: sapma artan (en iyi fırsat önce); hesaplanamayanlar sona.
 */
export function buildComparison(candidates, catalog, { refYear = null, factors = ASSUMPTION_FACTORS } = {}) {
  let anchors = null;
  try {
    anchors = JSON.parse(readFileSync('config/inflation/tr-tufe.json', 'utf8'));
  } catch {
    anchors = null;
  }
  const useRefYear = refYear || (anchors && (anchors.ref_year || Object.keys(anchors.index || {}).sort().pop()));
  const factors2 = { ...factors };
  try {
    const f = JSON.parse(readFileSync('data/catalog/factors.json', 'utf8'));
    Object.assign(factors2, f);
    if (f.year_pct && !factors2.year_pct) factors2.year_pct = f.year_pct;
  } catch {
    /* katsayı dosyası yoksa varsayılanlar */
  }

  const rows = [];
  for (const c of candidates) {
    // koşul: tramer tutarı + hasar yılı ilanda yazıyorsa normalize edilip şiddet sınıflanır
    let condition = {
      painted_parts: c.painted_parts,
      changed_parts: c.changed_parts,
      expertise: c.expertise,
      severity: null,
      tramer_ref_try: null,
    };
    if (c.tramer_try && anchors && useRefYear) {
      const year = String(c.tramer_year || c.year || '');
      if (anchors.index && anchors.index[year]) {
        const refTry = Math.round(normalizeAmountTufe(c.tramer_try, year, anchors, String(useRefYear)));
        condition.tramer_ref_try = refTry;
        condition.severity = classifySeverity(refTry, c.price_try);
      }
    }

    const comparables = c.make && c.model ? exportSamples(catalog, c.make, c.model) : [];
    const oto360 = c.oto360 ? parseOto360Bands(c.oto360) : null;

    const v = valueListing({
      listing: {
        make: c.make,
        model: c.model,
        year: c.year,
        km: c.km,
        price_try: c.price_try,
        description: c.description,
        variant: c.variant,
      },
      comparables,
      condition,
      oto360,
      factors: factors2,
    });

    rows.push({
      id: c.id,
      label: c.label,
      make: c.make,
      model: c.model,
      variant: c.variant,
      year: c.year,
      km: c.km,
      price_try: c.price_try,
      city: c.city,
      source: c.source,
      url: c.url,
      note: c.note,
      condition,
      verdict: v.verdict,
      fair_value_try: v.fair_value_try,
      range_try: v.range_try,
      deviation_pct: v.verdict ? v.verdict.deviation_pct : null,
      decision_band: v.verdict ? v.verdict.band : 'unknown',
      decision_label: v.verdict ? `${v.verdict.symbol} ${v.verdict.label}` : 'Hesaplanamadı',
      flags: v.flags || [],
      red_flags: (v.flags || []).filter((f) => f.severity === 'red'),
      adjustments: v.adjustments || [],
      confidence: v.confidence,
      sample_size: v.baseline_sample_size || 0,
      baseline_median_try: v.baseline ? v.baseline.own_median_try : null,
      valuation: v,
    });
  }

  return rows.sort((a, b) => {
    const av = a.deviation_pct;
    const bv = b.deviation_pct;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv;
  });
}

export async function exportComparison({ candidatesPath, catalogPath = 'data/catalog/catalog.json', htmlPath = 'reports/karsilastirma.html', mdPath = 'reports/karsilastirma.md', title = 'Aday karşılaştırması' } = {}) {
  const candidates = loadCandidates(JSON.parse(readFileSync(candidatesPath, 'utf8')));
  const catalog = loadCatalogFile(catalogPath);
  const rows = buildComparison(candidates, catalog);
  const generatedAt = new Date().toISOString().slice(0, 10);

  if (htmlPath) {
    mkdirSync(dirname(htmlPath), { recursive: true });
    writeFileSync(htmlPath, renderComparisonHtml(rows, { title, generatedAt }));
  }
  if (mdPath) {
    mkdirSync(dirname(mdPath), { recursive: true });
    writeFileSync(mdPath, renderComparisonMarkdown(rows, { title, generatedAt }));
  }
  return { rows, htmlPath, mdPath };
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));

export function renderComparisonHtml(rows, { title = 'Aday karşılaştırması', generatedAt = new Date().toISOString().slice(0, 10) } = {}) {
  const bandClass = (band) =>
    ({
      suspicious_cheap: 'band-cheap',
      below_market: 'band-below',
      at_market: 'band-market',
      expensive: 'band-high',
      very_expensive: 'band-veryhigh',
      inconclusive: 'band-unknown',
      unknown: 'band-unknown',
    })[band] || 'band-unknown';

  const tableRows = rows
    .map(
      (r) => `
      <tr class="${bandClass(r.decision_band)}">
        <td><b>${esc(r.id)}</b><br><span class="muted">${esc(r.label)}</span></td>
        <td>${esc(r.make)} ${esc(r.model)}<br><span class="muted">${esc(r.variant || '')}</span></td>
        <td>${esc(r.year)} · ${fmt(r.km)} km${r.city ? ` · ${esc(r.city)}` : ''}</td>
        <td class="num">${fmt(r.price_try)} TL</td>
        <td class="num"><b>${fmt(r.fair_value_try)} TL</b><br><span class="muted">${r.range_try ? `${fmt(r.range_try[0])}–${fmt(r.range_try[1])}` : '—'}</span></td>
        <td class="num">${r.deviation_pct == null ? '—' : `${r.deviation_pct > 0 ? '+' : ''}${r.deviation_pct}%`}</td>
        <td>${esc(r.decision_label)}</td>
        <td>${r.red_flags.length ? r.red_flags.map((f) => `<span class="flag red" title="${esc(f.message)}">🔴 ${esc(f.code)}</span>`).join(' ') : '<span class="muted">—</span>'}</td>
        <td>${esc(r.confidence ? r.confidence.level : '—')}<br><span class="muted">n=${r.sample_size}</span></td>
      </tr>`,
    )
    .join('\n');

  const details = rows
    .map(
      (r) => `
    <section class="candidate">
      <h3>${esc(r.id)} — ${esc(r.label)} ${r.url ? `<a href="${esc(r.url)}" rel="noreferrer">ilan</a>` : ''}</h3>
      <p class="muted">
        ${esc(r.source || '')} · ${esc(r.make)} ${esc(r.model)} ${esc(r.variant || '')} · ${esc(r.year)} · ${fmt(r.km)} km
        · tramer: ${r.condition.tramer_ref_try ? `${fmt(r.condition.tramer_ref_try)} TL (normalize, şiddet: ${esc(r.condition.severity)})` : 'ilanda yazılmamış'}
        · boyalı ${r.condition.painted_parts} / değişen ${r.condition.changed_parts} · ekspertiz: ${esc(r.condition.expertise || 'belirsiz')}
      </p>
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}
      <pre class="valuation">${esc(renderValuation(r.valuation))}</pre>
    </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --line:#e3e3e8; --muted:#6b7280; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px auto; max-width: 1200px; padding: 0 16px; color:#111827; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h1 + p.muted { margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0 32px; }
  th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; font-size: 13px; }
  th { background: #f7f7f9; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color:#374151; }
  td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .muted { color: var(--muted); font-size: 12px; }
  .flag { display:inline-block; font-size: 11px; padding: 1px 6px; border-radius: 10px; margin-right: 4px; }
  .flag.red { background: #fee2e2; color:#991b1b; }
  .band-cheap { background: #fff1f2; }
  .band-below { background: #fffbeb; }
  .band-market { background: #ffffff; }
  .band-high { background: #fffbeb; }
  .band-veryhigh { background: #fff1f2; }
  .band-unknown { background: #f9fafb; }
  section.candidate { border-top: 2px solid var(--line); padding-top: 12px; margin-top: 24px; page-break-inside: avoid; }
  pre.valuation { white-space: pre-wrap; background: #f9fafb; border: 1px solid var(--line); border-radius: 6px; padding: 12px; font-size: 12px; }
  footer { margin-top: 40px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); padding-top: 12px; }
  @media print {
    body { margin: 0; max-width: none; }
    section.candidate { page-break-inside: avoid; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p class="muted">Üretildi: ${esc(generatedAt)} · ${rows.length} aday · değerleme karşılaştırma seti katalogdan (yıl ±1, km ±%35, motor ailesi)</p>

<table>
  <thead>
    <tr>
      <th>Aday</th><th>Araç</th><th>Yıl / Km / İl</th><th>İstenen</th><th>Adil değer (bant)</th><th>Sapma</th><th>Karar</th><th>Kırmızı bayrak</th><th>Güven</th>
    </tr>
  </thead>
  <tbody>
${tableRows || '<tr><td colspan="9">Aday yok.</td></tr>'}
  </tbody>
</table>

<h2>Aday detayları</h2>
${details}

<footer>
  Değerleme uydurma değer üretmez: baz değer karşılaştırma setinden (katalog) gelir, düzeltme katsayıları
  <code>data/catalog/factors.json</code>'da etiketlidir (varsayım/kestirim). Bu sayfa yatırım/alım tavsiyesi değildir —
  <b>karar insana aittir</b>; ödeme öncesi bağımsız ekspertiz şarttır.
  <span class="no-print">Yazdırmak için: Ctrl/Cmd + P (PDF çıktısı).</span>
</footer>
</body>
</html>
`;
}

export function renderComparisonMarkdown(rows, { title = 'Aday karşılaştırması', generatedAt = new Date().toISOString().slice(0, 10) } = {}) {
  const L = [];
  L.push(`# ${title}`);
  L.push('');
  L.push(`Üretildi: ${generatedAt} · ${rows.length} aday`);
  L.push('');
  L.push('| Aday | Araç | Yıl/Km/İl | İstenen | Adil değer | Sapma | Karar | Kırmızı bayrak | Güven |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    L.push(
      `| **${r.id}** | ${r.make} ${r.model} ${r.variant || ''} | ${r.year} · ${fmt(r.km)} km${r.city ? ` · ${r.city}` : ''} | ${fmt(r.price_try)} TL | ${fmt(r.fair_value_try)} TL | ${
        r.deviation_pct == null ? '—' : `${r.deviation_pct > 0 ? '+' : ''}${r.deviation_pct}%`
      } | ${r.decision_label} | ${r.red_flags.map((f) => f.code).join(', ') || '—'} | ${r.confidence ? r.confidence.level : '—'} (n=${r.sample_size}) |`,
    );
  }
  L.push('');
  L.push('## Aday detayları');
  for (const r of rows) {
    L.push('');
    L.push(`### ${r.id} — ${r.label}`);
    L.push('');
    L.push(renderValuation(r.valuation));
  }
  L.push('');
  L.push('_Değerleme uydurma değer üretmez; katsayılar etiketlidir. Karar insana aittir._');
  return `${L.join('\n')}\n`;
}

// ---- CLI ----
// node report-export.mjs --adaylar data/candidates/egea-cross.json [--html reports/x.html] [--md reports/x.md]
export async function runCli(argv = process.argv.slice(2)) {
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
  if (!args.adaylar && !args.candidates) {
    console.log('Kullanım: node report-export.mjs --adaylar data/candidates/<dosya>.json [--html out.html] [--md out.md] [--baslik "..."]');
    return;
  }
  const res = await exportComparison({
    candidatesPath: args.adaylar || args.candidates,
    catalogPath: args.katalog || 'data/catalog/catalog.json',
    htmlPath: args.html || 'reports/karsilastirma.html',
    mdPath: args.md || 'reports/karsilastirma.md',
    title: args.baslik || 'Aday karşılaştırması',
  });
  console.log(`# ${res.rows.length} aday karşılaştırıldı`);
  console.log('| Aday | Adil değer | Sapma | Karar |');
  console.log('|---|---|---|---|');
  for (const r of res.rows) {
    console.log(`| ${r.id} | ${fmt(r.fair_value_try)} TL | ${r.deviation_pct == null ? '—' : `${r.deviation_pct}%`} | ${r.decision_label} |`);
  }
  console.log(`\nHTML: ${res.htmlPath}\nMarkdown: ${res.mdPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
