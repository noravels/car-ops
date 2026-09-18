// market-scan.mjs — çok kaynaklı ilan listesinden piyasa analizi.
// Girdi: providers'ların ürettiği normalize satırlar (agent browser çıktısı JSON).
// Çıktı: yıl bazlı medyanlar, bütçeye uyan adaylar, markdown rapor.

export function dedupeListings(listings) {
  const seen = new Set();
  const out = [];
  for (const l of listings) {
    if (!l || l.price_try == null) continue;
    const k = `${l.year}|${l.km}|${l.price_try}|${l.city || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

export function medianOf(nums) {
  const a = [...nums].filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

export function statsByYear(listings) {
  const byYear = {};
  for (const l of dedupeListings(listings)) {
    if (l.year == null) continue;
    (byYear[l.year] ||= []).push(l);
  }
  const out = {};
  for (const [y, arr] of Object.entries(byYear)) {
    const prices = arr.map((x) => x.price_try);
    out[y] = {
      count: arr.length,
      median: medianOf(prices),
      min: Math.min(...prices),
      max: Math.max(...prices),
      km_median: medianOf(arr.map((x) => x.km).filter(Boolean)),
    };
  }
  return out;
}

// Bütçe üst limitine giren adaylar: medyana göre en çok altında olan önce.
// Aşırı ucuz (medyanın %75'inin altı) "şüpheli ucuz" olarak işaretlenir.
export function budgetCandidates(listings, { cap, median } = {}) {
  const base = median ?? medianOf(dedupeListings(listings).map((l) => l.price_try));
  return dedupeListings(listings)
    .filter((l) => cap == null || l.price_try <= cap)
    .map((l) => ({
      ...l,
      ratio_to_median: base ? l.price_try / base : null,
      suspicious_cheap: base ? l.price_try < base * 0.75 : false,
    }))
    .sort((a, b) => a.ratio_to_median - b.ratio_to_median);
}

export function renderMarketReport({ listings, cap, usd_try, title = 'Egea Cross piyasa taraması' } = {}) {
  const dedup = dedupeListings(listings);
  const med = medianOf(dedup.map((l) => l.price_try));
  const byYear = statsByYear(dedup);
  const bySource = {};
  for (const l of dedup) bySource[l.source || '?'] = (bySource[l.source || '?'] || 0) + 1;

  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`- Toplam tekil ilan: **${dedup.length}**`);
  lines.push(`- Kaynak dağılımı: ${Object.entries(bySource).map(([s, n]) => `${s} (${n})`).join(', ')}`);
  lines.push(`- **Medyan: ${fmt(med)} TL**${usd_try ? ` (≈ ${fmt(Math.round(med / usd_try))} USD)` : ''}`);
  if (cap) lines.push(`- Bütçe üst limiti: **${fmt(cap)} TL**`);
  lines.push('');
  lines.push('## Yıl bazında');
  lines.push('| Yıl | Adet | Medyan | Min | Max | Medyan km |');
  lines.push('|---|---|---|---|---|---|');
  for (const y of Object.keys(byYear).sort()) {
    const s = byYear[y];
    lines.push(`| ${y} | ${s.count} | ${fmt(s.median)} | ${fmt(s.min)} | ${fmt(s.max)} | ${fmt(s.km_median)} |`);
  }
  lines.push('');
  lines.push('## Bütçeye uyan adaylar');
  const cands = budgetCandidates(dedup, { cap, median: med });
  if (!cands.length) {
    lines.push('_Bütçe üst limitine giren ilan yok — limit artır veya km/yıl kısıtını gevşet._');
  } else {
    lines.push('| Fiyat | Medyana oran | Yıl | Km | Kaynak | Şehir | Satıcı | Not |');
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const c of cands.slice(0, 15)) {
      const note = c.suspicious_cheap ? 'şüpheli ucuz' : c.price_drop_try ? `indirim ${fmt(c.price_drop_try)} TL` : '';
      lines.push(
        `| ${fmt(c.price_try)} | ${c.ratio_to_median != null ? (c.ratio_to_median * 100).toFixed(1) + '%' : '—'} | ${c.year ?? '—'} | ${fmt(c.km)} | ${c.source || '—'} | ${c.city || '—'} | ${c.seller_type || '—'} | ${note} |`,
      );
    }
  }
  lines.push('');
  lines.push('_Not: medyan yalnızca toplanan ilanlara dayanır; örneklem küçükse temkinli yorumla._');
  return lines.join('\n');
}

// CLI: node market-scan.mjs --input data/market/<dosya>.json [--cap 1250000] [--usd 48.73]
export async function runCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  if (!args.input) {
    console.error('kullanım: node market-scan.mjs --input data/market/<dosya>.json [--cap N] [--usd N] [--out dosya.md]');
    process.exitCode = 1;
    return;
  }
  const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  const payload = JSON.parse(readFileSync(args.input, 'utf8'));
  const listings = Array.isArray(payload) ? payload : payload.listings;
  const md = renderMarketReport({
    listings,
    cap: args.cap ? Number(args.cap) : null,
    usd_try: args.usd ? Number(args.usd) : null,
    title: payload.title || 'Piyasa taraması',
  });
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, md + '\n', 'utf8');
    console.log(`yazıldı: ${args.out}`);
  } else {
    console.log(md);
  }
}

if (process.argv[1] && process.argv[1].endsWith('market-scan.mjs')) {
  await runCli(process.argv.slice(2));
}
