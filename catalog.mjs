// catalog.mjs — araç katalog veri bankası.
//
// İKİ KAYNAK, İKİ KATMAN (uydurma teknik özellik yok):
//   1) observed  — toplanan ilanlardan GÖZLEMLENEN özellik dağılımları (kanıtlı, sayılabilir)
//   2) taxonomy  — sitenin kategori yapısından gelen SINIFLAMA (marka/seri/model/segment)
// Her öneri, kaç ilana dayandığını ve hangi kriterin gözlemlenmediğini açıkça söyler.
// Gözlemlenmemiş bir özellik asla tahmin edilmez; "belirsiz" olarak işaretlenir.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DIACRITICS = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };

export function slug(text) {
  return String(text || '')
    .split('')
    .map((ch) => DIACRITICS[ch] ?? ch)
    .join('')
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function modelFromListing(listing) {
  if (!listing || !listing.make || !listing.model) return null;
  return slug(`${listing.make} ${listing.model}`);
}

export function emptyCatalog() {
  return {
    meta: {
      version: 1,
      learned_from_listings: 0,
      last_updated: null,
      note: 'observed = ilanlardan gözlenen dağılımlar; taxonomy = sitenin kategori sınıflaması. Teknik özellik tahmini yapılmaz.',
    },
    models: {},
  };
}

function bump(obj, key) {
  if (key == null || key === '') return;
  obj[key] = (obj[key] || 0) + 1;
}

function median(nums) {
  const a = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

function initModel(catalog, id, { make, model, series, segment } = {}) {
  if (!catalog.models[id]) {
    catalog.models[id] = {
      id,
      make: make || null,
      model: model || null,
      series: series || null,
      segment: segment || null,
      taxonomy: null,
      specs: null,
      observed: {
        listings_count: 0,
        seen_ids: [],
      samples: [],
        first_seen: null,
        last_seen: null,
        year: { min: null, max: null, median: null },
        km: { min: null, max: null, median: null },
        price_try: { min: null, max: null, median: null },
        bodies: {},
        fuels: {},
        gearboxes: {},
        colors: {},
        seller_types: {},
        power_hp: { min: null, max: null },
        cities: {},
        sources: {},
      },
    };
  }
  return catalog.models[id];
}

function aggregate(catalog, modelId) {
  const m = catalog.models[modelId];
  const rows = (m.observed && m.observed.samples) || m._rows || [];
  if (!rows.length) return;
  const prices = rows.map((r) => r.price_try).filter(Boolean);
  const kms = rows.map((r) => r.km).filter(Boolean);
  const years = rows.map((r) => r.year).filter(Boolean);
  const hps = rows.map((r) => r.power_hp).filter(Boolean);
  m.observed.price_try = { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null, median: median(prices) };
  m.observed.km = { min: kms.length ? Math.min(...kms) : null, max: kms.length ? Math.max(...kms) : null, median: median(kms) };
  m.observed.year = { min: years.length ? Math.min(...years) : null, max: years.length ? Math.max(...years) : null, median: median(years) };
  m.observed.power_hp = { min: hps.length ? Math.min(...hps) : null, max: hps.length ? Math.max(...hps) : null };
  m.observed.listings_count = rows.length;
}

/** İlan listesinden katalogu büyütür (tekilleştirilmiş: source+listing_id). */
export function upsertObserved(catalog, listings = []) {
  const c = catalog && catalog.models ? catalog : emptyCatalog();
  const seenKeys = new Set();
  for (const m of Object.values(c.models)) {
    for (const k of m.observed.seen_ids || []) seenKeys.add(k);
  }
  let added = 0;

  for (const listing of listings) {
    const id = modelFromListing(listing);
    if (!id) continue;
    const dedupeKey =
      listing.listing_id || (listing.source || listing.source_site ? `${listing.source || listing.source_site}|${id}|${listing.year}|${listing.km}|${listing.price_try}` : null);
    if (dedupeKey && seenKeys.has(dedupeKey)) continue;
    if (dedupeKey) seenKeys.add(dedupeKey);

    const m = initModel(c, id, {
      make: listing.make,
      model: listing.model,
      series: listing.series || null,
      segment: listing.body || null,
    });
    // ÖRNEKLER KALICI: fiyat istatistikleri ve değerleme karşılaştırma seti buradan gelir.
    m.observed.samples = m.observed.samples || [];
    m.observed.samples.push({
      price_try: listing.price_try ?? null,
      km: listing.km ?? null,
      year: listing.year ?? null,
      power_hp: listing.power_hp ?? null,
      body: listing.body ?? null,
      fuel: listing.fuel ?? null,
      gearbox: listing.gearbox ?? null,
      variant: listing.variant ?? null,
      city: listing.city ?? null,
      source: listing.source || listing.source_site || null,
      listing_id: listing.listing_id ?? null,
    });
    if (m.observed.samples.length > MAX_SAMPLES) m.observed.samples = m.observed.samples.slice(-MAX_SAMPLES);
    m.observed.seen_ids.push(dedupeKey || `${id}|${added}`);
    bump(m.observed.bodies, listing.body);
    bump(m.observed.fuels, listing.fuel);
    bump(m.observed.gearboxes, listing.gearbox);
    bump(m.observed.colors, listing.color);
    bump(m.observed.seller_types, listing.seller_type);
    bump(m.observed.cities, listing.city);
    bump(m.observed.sources, listing.source || listing.source_site);
    const ts = listing.captured_at || new Date().toISOString();
    if (!m.observed.first_seen || ts < m.observed.first_seen) m.observed.first_seen = ts;
    if (!m.observed.last_seen || ts > m.observed.last_seen) m.observed.last_seen = ts;
    aggregate(c, id);
    added++;
  }

  c.meta.learned_from_listings = Object.values(c.models).reduce((s, m) => s + m.observed.listings_count, 0);
  c.meta.last_updated = new Date().toISOString();
  // iç kullanım satırlarını dışa yazma
  for (const m of Object.values(c.models)) delete m._rows;
  return c;
}

/** Sitenin kategori yapısından gelen sınıflamayı işler (marka/seri/model/segment). */
export function upsertTaxonomy(catalog, entries = []) {
  const c = catalog && catalog.models ? catalog : emptyCatalog();
  for (const e of entries) {
    if (!e || !e.make) continue;
    const id = e.model ? slug(`${e.make} ${e.model}`) : slug(e.make);
    const m = initModel(c, id, { make: e.make, model: e.model });
    m.taxonomy = {
      source: e.source || null,
      series: e.series || null,
      segment: e.segment || null,
      listing_count_hint: e.listing_count ?? null,
      url: e.url || null,
    };
    if (!m.series && e.series) m.series = e.series;
    if (!m.segment && e.segment) m.segment = e.segment;
  }
  return c;
}

/** Oto360/katalog teknik verisini modele işler (kaynak + lisans korunur). */
export function upsertSpecs(catalog, specs = []) {
  const c = catalog && catalog.models ? catalog : emptyCatalog();
  let n = 0;
  for (const sp of specs) {
    if (!sp || !sp.make || !sp.model) continue;
    const id = slug(`${sp.make} ${sp.model}`);
    const m = initModel(c, id, { make: sp.make, model: sp.model });
    m.specs = {
      body: sp.body || null,
      fuel: sp.fuel || null,
      gearbox: sp.gearbox || null,
      seats: sp.seats ?? null,
      doors: sp.doors ?? null,
      engine_cc: sp.engine_cc ?? null,
      power_hp: sp.power_hp ?? null,
      year: sp.year ?? null,
      price_min_try: sp.price_min_try ?? null,
      price_max_try: sp.price_max_try ?? null,
      variant_count: sp.variant_count ?? null,
      source: sp.source || null,
      license: sp.license || null,
      url: sp.url || null,
      fetched_at: sp.fetched_at || null,
    };
    if (sp.body && !m.segment) m.segment = sp.body;
    n++;
  }
  c.meta.specs_models = (c.meta.specs_models || 0) + n;
  c.meta.last_updated = new Date().toISOString();
  return c;
}

export function specsCoverage(catalog) {
  const models = Object.values(catalog.models || {});
  const withSpecs = models.filter((m) => m.specs);
  return {
    total: models.length,
    with_specs: withSpecs.length,
    without_specs: models.length - withSpecs.length,
    sources: [...new Set(withSpecs.map((m) => m.specs.source).filter(Boolean))],
    missing: models.filter((m) => !m.specs).map((m) => `${m.make} ${m.model}`),
  };
}

function share(dist, value) {
  if (!dist || !value) return null;
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const hit = Object.entries(dist).find(([k]) => slug(k) === slug(value));
  return hit ? hit[1] / total : 0;
}

/**
 * Kriterlere uyan modelleri önerir.
 * criteria: { price_max, price_min, body, fuel, gearbox, color, seller_type, year_min, km_max, city, seats_min, power_hp_min }
 * Dönen her öneri: { id, make, model, score, reasons[], unknown_attributes[], budget_fit, evidence }
 */
export function suggestModels(catalog, criteria = {}, { minListings = 1 } = {}) {
  const out = [];
  for (const [id, m] of Object.entries(catalog.models || {})) {
    const obs = m.observed || {};
    if ((obs.listings_count || 0) < minListings && !m.taxonomy && !m.specs) continue;

    const reasons = [];
    const unknown = [];
    let score = 0;
    let weight = 0;
    let unknownWeight = 0; // bilinmeyen kriterlerin ceza ağırlığı

    const push = (label, hit, w, detail) => {
      weight += w;
      if (hit === true) {
        score += w;
        reasons.push(`${label}: ${detail}`);
      } else if (hit === false) {
        reasons.push(`✗ ${label}: ${detail}`);
      } else {
        markUnknown(label);
      }
    };
    // bilinmeyen alanların tipik ağırlığı (push ile aynı büyüklük mertebesi)
    const UNKNOWN_WEIGHT = 1.5;
    const markUnknown = (label) => {
      unknown.push(label);
      unknownWeight += UNKNOWN_WEIGHT;
    };

    // bütçe (medyan fiyata göre)
    let budgetFit = null;
    if (criteria.price_max != null) {
      const med = obs.price_try && obs.price_try.median;
      if (med == null) markUnknown('price_max');
      else {
        budgetFit = med <= criteria.price_max;
        push(
          'bütçe',
          budgetFit,
          2,
          `gözlenen medyan ${med.toLocaleString('tr-TR')} TL ${budgetFit ? '≤' : '>'} bütçe ${Number(criteria.price_max).toLocaleString('tr-TR')} TL`,
        );
      }
    }
    if (criteria.price_min != null && obs.price_try && obs.price_try.max != null) {
      const ok = obs.price_try.max >= criteria.price_min;
      push('bütçe alt sınırı', ok, 1, `gözlenen en yüksek ${obs.price_try.max.toLocaleString('tr-TR')} TL`);
    }

    // kasa / yakıt / vites — ÖNCE katalog teknik verisi, yoksa gözlenen dağılım
    const specMap = { bodies: 'body', fuels: 'fuel', gearboxes: 'gearbox' };
    for (const [key, criterion, w] of [
      ['bodies', criteria.body, 2],
      ['fuels', criteria.fuel, 2],
      ['gearboxes', criteria.gearbox, 2],
      ['colors', criteria.color, 1],
      ['seller_types', criteria.seller_type, 1],
    ]) {
      if (!criterion) continue;
      const specField = specMap[key];
      const specValue = specField && m.specs ? m.specs[specField] : null;
      if (specValue) {
        const hit = slug(specValue) === slug(criterion) || String(specValue).toLowerCase() === String(criterion).toLowerCase();
        push(key, hit, 3, `katalog teknik: ${specValue}${m.specs.year ? ` (${m.specs.year}, ${m.specs.source})` : ''}`);
        continue;
      }
      const s = share(obs[key], criterion);
      if (s == null) markUnknown(key);
      else push(key, s > 0, w, `ilanların %${Math.round(s * 100)}'i ${criterion}`);
    }
    // koltuk/kapı: katalogda varsa kullanılır (gözlemle öğrenilemeyen alanlar)
    if (criteria.seats_min != null) {
      if (m.specs && m.specs.seats != null) {
        push('seats_min', m.specs.seats >= criteria.seats_min, 2, `katalog: ${m.specs.seats} koltuk`);
      } else markUnknown('seats_min');
    }
    if (criteria.engine_cc_min != null || criteria.engine_cc_max != null) {
      const cc = m.specs ? m.specs.engine_cc : null;
      if (cc == null) markUnknown('engine_cc');
      else {
        const within = (criteria.engine_cc_min == null || cc >= criteria.engine_cc_min) && (criteria.engine_cc_max == null || cc <= criteria.engine_cc_max);
        push('motor hacmi', within, 2, `katalog: ${cc} cm3`);
      }
    }

    // yıl / km
    if (criteria.year_min != null) {
      const yrs = (obs.samples || []).map((x) => x.year).filter(Number.isFinite);
      if (yrs.length) {
        const okShare = yrs.filter((y) => y >= criteria.year_min).length / yrs.length;
        push(
          'yıl',
          okShare >= 0.2,
          2,
          `ilanların %${Math.round(okShare * 100)}'i ${criteria.year_min} ve üstü (gözlenen aralık ${obs.year?.min ?? '—'}–${obs.year?.max ?? '—'})`,
        );
      } else if (obs.year && obs.year.max != null) {
        push('yıl', obs.year.max >= criteria.year_min, 1, `gözlenen en yeni ${obs.year.max}`);
      } else markUnknown('year_min');
    }
    if (criteria.km_max != null) {
      const mn = obs.km && obs.km.min;
      const medKm = obs.km && obs.km.median;
      if (medKm == null) markUnknown('km_max');
      else push('km', medKm <= criteria.km_max, 1, `gözlenen medyan ${medKm.toLocaleString('tr-TR')} km`);
    }
    if (criteria.city != null) {
      const s = share(obs.cities, criteria.city);
      if (s == null) markUnknown('city');
      else push('şehir', s > 0, 1, `ilanların %${Math.round(s * 100)}'i ${criteria.city}`);
    }
    if (criteria.power_hp_min != null) {
      if (!obs.power_hp || obs.power_hp.max == null) markUnknown('power_hp_min');
      else push('motor gücü', obs.power_hp.max >= criteria.power_hp_min, 1, `gözlenen aralık ${obs.power_hp.min}-${obs.power_hp.max} hp`);
    }
    // gözlemlenemeyen alanlar (site verisi yok)
    for (const k of ['seats_min', 'doors', 'equipment']) if (criteria[k] != null) markUnknown(k);

    // Bilinmeyen kriter cezası: skor yalnızca BİLİNEN kriterler üzerinden hesaplanır;
    // belirsizlik arttıkça (bilinen ağırlık payı düşükçe) skor kök oranla indirilir.
    const knownWeightRatio = weight + unknownWeight > 0 ? weight / (weight + unknownWeight) : 0;
    const normalized = weight > 0 ? (score / weight) * Math.sqrt(knownWeightRatio) : 0;
    out.push({
      id,
      make: m.make,
      model: m.model,
      segment: m.segment,
      score: Math.round(normalized * 100) / 100,
      reasons,
      unknown_attributes: [...new Set(unknown)],
      budget_fit: budgetFit,
      evidence: {
        listings: obs.listings_count || 0,
        spec_source: m.specs ? m.specs.source : null,
        spec_body: m.specs ? m.specs.body : null,
        sources: Object.keys(obs.sources || {}),
        price_median: obs.price_try ? obs.price_try.median : null,
        year_range: obs.year ? [obs.year.min, obs.year.max] : [null, null],
        km_median: obs.km ? obs.km.median : null,
        top_fuel: topKey(obs.fuels),
        top_gearbox: topKey(obs.gearboxes),
        top_body: topKey(obs.bodies),
      },
      taxonomy: m.taxonomy || null,
    });
  }

  return out
    .filter((s) => s.evidence.listings > 0 || s.taxonomy || s.evidence.spec_source)
    .sort((a, b) => b.score - a.score || b.evidence.listings - a.evidence.listings);
}

function topKey(dist) {
  if (!dist) return null;
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : null;
}

export function renderSuggestions(suggestions, { criteria = {}, limit = 10 } = {}) {
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));
  const lines = [];
  lines.push('# Özellik → Model Önerileri');
  lines.push('');
  lines.push(
    `Kriterler: ${Object.entries(criteria)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || '—'}`,
  );
  lines.push('');
  lines.push(
    '_Öneriler iki kanıta dayanır: (1) toplanan ilanlardan GÖZLENEN dağılımlar, (2) katalog TEKNİK verisi (Oto360/JATO). ' +
      'Hiçbir özellik tahmin edilmez; gözlemlenmeyen kriterler "belirsiz" olarak işaretlenir._',
  );
  lines.push('');
  if (!suggestions.length) {
    lines.push('Kriterlere uyan model bulunamadı. Katalog boşsa önce tarama yapılmalı (`node market-scan.mjs` çıktısını katalogla besle).');
    return lines.join('\n');
  }
  lines.push('| # | Model | Uyum | Kanıt (ilan) | Belirsiz kriter | Medyan fiyat | Yıl aralığı | Yakıt/Vites/Kasa | Teknik |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  suggestions.slice(0, limit).forEach((s, i) => {
    const unk = s.unknown_attributes.length ? s.unknown_attributes.join(',') : '—';
    const tech = s.evidence.spec_source ? `${s.evidence.spec_body || '—'} (${s.evidence.spec_source})` : '—';
    lines.push(
      `| ${i + 1} | **${s.make} ${s.model}** | ${(s.score * 100).toFixed(0)}% | ${s.evidence.listings} | ${unk} | ${fmt(s.evidence.price_median)} TL | ${s.evidence.year_range[0] ?? '—'}–${s.evidence.year_range[1] ?? '—'} | ${s.evidence.top_fuel || '—'} / ${s.evidence.top_gearbox || '—'} / ${s.evidence.top_body || '—'} | ${tech} |`,
    );
  });
  lines.push('');
  lines.push('## Gerekçeler');
  for (const s of suggestions.slice(0, limit)) {
    lines.push(`\n### ${s.make} ${s.model} (uyum %${(s.score * 100).toFixed(0)})`);
    for (const r of s.reasons) lines.push(`- ${r}`);
    if (s.unknown_attributes.length) lines.push(`- ⚠ gözlemlenmeyen kriterler (belirsiz): ${s.unknown_attributes.join(', ')}`);
    if (s.budget_fit === false) lines.push('- ⚠ gözlenen medyan bütçenin üstünde — pazarlık/alt donanım gerekir');
  }
  return lines.join('\n');
}

/** Katalogdan tek model için değerleme karşılaştırma setini çıkarır. */
export function exportSamples(catalog, make, model) {
  const id = slug(`${make} ${model}`);
  const m = catalog.models[id];
  if (!m) return [];
  return (m.observed.samples || []).map((s) => ({ ...s, make, model }));
}

export function catalogStats(catalog) {
  const models = Object.values(catalog.models || {});
  const sources = new Set();
  for (const m of models) {
    for (const s of Object.keys(m.observed.sources || {})) sources.add(s);
    if (m.specs && m.specs.source) sources.add(m.specs.source);
  }
  return {
    models: models.length,
    listings: models.reduce((s, m) => s + (m.observed.listings_count || 0), 0),
    with_taxonomy: models.filter((m) => m.taxonomy).length,
    with_specs: models.filter((m) => m.specs).length,
    sources: ['observed', ...(sources.size ? [...sources] : [])],
    last_updated: catalog.meta.last_updated,
  };
}

// ---- dosya işlemleri ----
export function loadCatalogFile(path) {
  if (!existsSync(path)) return emptyCatalog();
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const MAX_SAMPLES = 2000;

export function saveCatalogFile(path, catalog) {
  mkdirSync(dirname(path), { recursive: true });
  const clean = JSON.parse(JSON.stringify(catalog));
  for (const m of Object.values(clean.models || {})) delete m._rows; // örnekler observed.samples'ta kalıcı
  writeFileSync(path, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  return path;
}

// ---- CLI ----
// node catalog.mjs --learn data/market/<dosya>.json        → katalogu ilanlarla besle
// node catalog.mjs --suggest --max 1200000 --kasa crossover --yakit benzin --vites otomatik
// node catalog.mjs --stats
export async function runCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) args[k] = true;
    else {
      args[k] = next;
      i++;
    }
  }
  const catalogPath = args.katalog || 'data/catalog/catalog.json';
  let catalog = loadCatalogFile(catalogPath);

  if (args['learn-specs']) {
    const dir = args['learn-specs'];
    const files = String(dir).endsWith('.json') ? [dir] : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => `${dir}/${f}`);
    const specs = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
    catalog = upsertSpecs(catalog, specs);
    saveCatalogFile(catalogPath, catalog);
    console.log(`teknik özellik işlendi: ${specs.length} model → ${catalogPath}`);
    return;
  }

  if (args['learn-taxonomy']) {
    const payload = JSON.parse(readFileSync(args['learn-taxonomy'], 'utf8'));
    const entries = (payload.brands || payload).map((b) => ({ make: b.make, segment: b.segment || null, source: payload.source || null, listing_count: b.count ?? null }));
    catalog = upsertTaxonomy(catalog, entries);
    saveCatalogFile(catalogPath, catalog);
    console.log(`sınıflama işlendi: ${entries.length} marka → ${catalogPath}`);
    return;
  }

  if (args.learn) {
    const payload = JSON.parse(readFileSync(args.learn, 'utf8'));
    const listings = Array.isArray(payload) ? payload : payload.listings || [];
    const before = catalogStats(catalog).listings;
    catalog = upsertObserved(catalog, listings);
    saveCatalogFile(catalogPath, catalog);
    const after = catalogStats(catalog).listings;
    console.log(`katalog güncellendi: ${catalogPath}`);
    console.log(`ilan: ${before} → ${after} | model: ${catalogStats(catalog).models}`);
    return;
  }

  if (args.stats || !args.suggest) {
    const s = catalogStats(catalog);
    console.log(`# Katalog: ${catalogPath}`);
    console.log(JSON.stringify(s, null, 2));
    if (!args.suggest) return;
  }

  const criteria = {
    price_max: args.max != null ? Number(args.max) : null,
    price_min: args.min != null ? Number(args.min) : null,
    body: args.kasa || null,
    fuel: args.yakit || null,
    gearbox: args.vites || null,
    color: args.renk || null,
    seller_type: args.satici || null,
    year_min: args['yil-min'] != null ? Number(args['yil-min']) : null,
    km_max: args['km-max'] != null ? Number(args['km-max']) : null,
    city: args.il || null,
    power_hp_min: args['hp-min'] != null ? Number(args['hp-min']) : null,
  };
  const suggestions = suggestModels(catalog, criteria);
  const md = renderSuggestions(suggestions, { criteria });
  console.log(md);
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, md + '\n', 'utf8');
    console.log(`\nyazıldı: ${args.out}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('catalog.mjs')) {
  await runCli(process.argv.slice(2));
}
