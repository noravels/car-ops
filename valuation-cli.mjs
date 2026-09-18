#!/usr/bin/env node
// valuation-cli.mjs — "fiyat iyi mi?" sorusunu komut satırından cevaplar.
//
// Örnek:
//   node valuation-cli.mjs --fiyat 1015000 --marka Fiat --model "Egea Cross" \
//     --yil 2023 --km 26000 --tramer 13248 --tramer-yil 2023 \
//     --boyali 0 --degisen 0 --ekspertiz yok \
//     --data data/market/egea-cross-2026-09-18.json
//
// Oto360 bandı yapıştırılırsa referans olarak kullanılır:
//   --oto360 "Piyasa Ortalaması 950.000 - 980.000 TL"

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { valueListing, renderValuation, parseOto360Bands, ASSUMPTION_FACTORS } from './valuation.mjs';
import { loadCatalogFile, exportSamples } from './catalog.mjs';
import { normalizeAmountTufe, classifySeverity } from './tramer-normalize.mjs';
import { loadBandText } from './valuation-ref.mjs';

const args = parseArgs(process.argv.slice(2));

if (args.help || (!args.fiyat && !args['json-ilan'])) {
  console.log(`Kullanım: node valuation-cli.mjs --fiyat <TL> [seçenekler]

  --fiyat <TL>          İlanın istenen fiyatı (zorunlu)
  --marka / --model     Araç kimliği (karşılaştırma filtresi)
  --yil / --km          Model yılı ve kilometre
  --motor "<sürüm>"     Motor sürümü (ör. "1.4 Fire", "1.6 Multijet") — karşılaştırmayı aynı motorla sınırlar
  --tramer <TL>         İlanda YAZAN tramer tutarı (uydurulmaz)
  --tramer-yil <yıl>    Tramer kaydının yılı (enflasyon normalizasyonu için ŞART)
  --boyali <n>          Boyalı parça sayısı
  --degisen <n>         Değişen parça sayısı
  --ekspertiz var|yok   Bağımsız ekspertiz raporu durumu
  --aciklama "<metin>"  İlan açıklaması (beyan/kayıt çelişkisi taraması)
  --katalog [dosya]     Karşılaştırma setini katalogdan al (data/catalog/catalog.json) — --marka/--model ile
  --data <dosya.json>   Karşılaştırma seti (market tarama çıktısı)
  --oto360 "<bant metni>"  Oto360 Araç Değerleme çıktısı (veya @data/valuations/<dosya>.json)
  --out <dosya.md>      Raporu dosyaya yaz
  --katsayi <dosya.json> Katsayı dosyası (varsayılan: data/catalog/factors.json)
`);
  process.exit(args.help ? 0 : 1);
}

const anchors = loadJson('config/inflation/tr-tufe.json');
// referans yıl: çapa dosyasının kendi ref_year'ı, yoksa en yeni endeks yılı
const refYear = String(anchors.ref_year || Object.keys(anchors.index).sort().pop());

// 1) karşılaştırma seti — katalogdan (--katalog) veya dosyadan (--data)
let comparables = [];
const catalogPath = typeof args.katalog === 'string' ? args.katalog : 'data/catalog/catalog.json';
if (args.katalog && existsSync(catalogPath) && args.marka && args.model) {
  const catalog = loadCatalogFile(catalogPath);
  comparables = exportSamples(catalog, args.marka, args.model);
  console.log(`(kaynak: katalog — ${args.marka} ${args.model}, ${comparables.length} ilan örneği)`);
}
if (args.data) {
  const payload = loadJson(args.data);
  const rows = Array.isArray(payload) ? payload : payload.listings || payload.items || [];
  comparables = rows.filter((l) => Number.isFinite(l.price_try));
  if (args.marka) comparables = comparables.filter((l) => !l.make || slug(l.make) === slug(args.marka));
  if (args.model) comparables = comparables.filter((l) => !l.model || slug(l.model) === slug(args.model));
}

// 2) tramer → normalize tutar + şiddet (yalnızca ilanda YAZAN tutar)
let severity = null;
let tramerRefTry = null;
let severityNote = null;
if (args.tramer) {
  const amount = Number(String(args.tramer).replace(/\./g, '').replace(',', '.'));
  const year = Number(args['tramer-yil'] || args.yil);
  if (!Number.isFinite(amount)) throw new Error(`tramer tutarı okunamadı: ${args.tramer}`);
  if (!anchors.index[String(year)]) throw new Error(`TÜFE çapası yok: ${year} (--tramer-yil gerekli)`);
  tramerRefTry = Math.round(normalizeAmountTufe(amount, String(year), anchors, refYear));
  severity = classifySeverity(tramerRefTry, Number(args.fiyat));
  severityNote = `${year} yılı ${amount.toLocaleString('tr-TR')} TL → ${refYear} değerinde ${tramerRefTry.toLocaleString('tr-TR')} TL (TÜFE ile normalize)`;
} else if (args.ekspertiz === 'var') {
  severityNote = 'İlanda tramer tutarı yazılmamış; hasar şiddeti bilinmiyor (ekspertiz var beyanı).';
}

// 3) katsayılar: dosya varsa onu kullan (kalibre edilmiş olabilir)
let factors = ASSUMPTION_FACTORS;
const factorPath = args.katsayi || 'data/catalog/factors.json';
if (existsSync(factorPath)) {
  const f = loadJson(factorPath);
  // derin birleştirme: dosyadaki katsayılar (kalibre) üstüne yazar, notlar korunur
  factors = { ...ASSUMPTION_FACTORS, ...f, source: f.status || 'varsayım', calibrated: f.status === 'kestirim' };
  for (const [k, val] of Object.entries(f.severity || {})) {
    factors.severity[k] = { ...(ASSUMPTION_FACTORS.severity[k] || {}), ...val };
  }
  for (const key of ['painted_each', 'changed_each', 'km_per_10k_above', 'km_per_10k_below']) {
    if (f[key]) factors[key] = { ...ASSUMPTION_FACTORS[key], ...f[key] };
  }
}

// --oto360  "<bant metni>"  veya  --oto360 @data/valuations/<dosya>.json
let oto360Text = null;
if (args.oto360 && typeof args.oto360 === 'string') {
  if (args.oto360.startsWith('@')) {
    const refPath = args.oto360.slice(1);
    if (!existsSync(refPath)) throw new Error(`referans dosyası yok: ${refPath}`);
    oto360Text = loadBandText(refPath);
    console.error(`(referans: ${refPath})`);
  } else if (existsSync(args.oto360)) {
    oto360Text = readFileSync(args.oto360, 'utf8');
  } else {
    oto360Text = args.oto360;
  }
}
const oto360 = oto360Text ? parseOto360Bands(oto360Text) : null;

const result = valueListing({
  listing: {
    make: args.marka || null,
    model: args.model || null,
    year: Number(args.yil) || null,
    km: Number(args.km) || null,
    // motor sürümü fiyatı belirleyen ana değişken (ör. "1.4 Fire", "1.6 Multijet")
    variant: args.motor || args.varyant || null,
    price_try: Number(args.fiyat),
    description: args.aciklama || '',
    tramer_try: args.tramer ? Number(String(args.tramer).replace(/\./g, '').replace(',', '.')) : null,
    tramer_year: args['tramer-yil'] ? Number(args['tramer-yil']) : null,
  },
  comparables,
  condition: {
    severity,
    tramer_ref_try: tramerRefTry,
    painted_parts: Number(args.boyali) || 0,
    changed_parts: Number(args.degisen) || 0,
    expertise: args.ekspertiz || null,
  },
  oto360,
  factors,
  vehicle_value_try: Number(args.fiyat),
});

const md = [
  `# Değerleme: ${[args.marka, args.model].filter(Boolean).join(' ') || 'araç'} ${args.yil || ''}`.trim(),
  '',
  `- İstenen fiyat: **${fmt(Number(args.fiyat))} TL**${args.km ? ` · ${fmt(Number(args.km))} km` : ''}${args.yil ? ` · ${args.yil}` : ''}`,
  severity ? `- Tramer: ${severityNote} → şiddet **${severity}**` : severityNote ? `- Tramer: ${severityNote}` : '- Tramer: ilanda tutar yazılmamış (bilinmiyor)',
  '',
  renderValuation(result),
].join('\n');

console.log(md);
if (args.out) {
  writeFileSync(args.out, `${md}\n`);
  console.log(`\n(rapor yazıldı: ${args.out})`);
}

// -------------------------------------------------------------- yardımcılar
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}
function loadJson(p) {
  if (!existsSync(p)) throw new Error(`dosya yok: ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}
function slug(s) {
  return String(s).toLowerCase().replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g').replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[çÇ]/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function fmt(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('tr-TR') : '—';
}
