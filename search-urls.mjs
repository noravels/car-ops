// search-urls.mjs — kanonik filtrelerden provider arama URL'leri.
// Artık filtre eşlemesi provider sınıflarındadır (providers/base.mjs + config/filters.json).
// Bu modül yalnızca orkestrasyon yapar: filtreleri normalize eder, provider'lara dağıtır,
// sonucu tek planda birleştirir.

import { initProviders } from './providers/index.mjs';
import { slugify } from './providers/base.mjs';
import { resolveLocation } from './location.mjs';

export { slugify };

/** Kullanıcı profilini/dile getirdiği filtreleri kanonik filtre setine çevirir. */
export function normalizeFilters(input = {}) {
  const f = { ...input };

  // profil → filtre eşlemesi
  if (input.profile) {
    const p = input.profile;
    const v = p.vehicle_target || {};
    f.make = f.make ?? v.make ?? null;
    f.model = f.model ?? v.model ?? null;
    f.variant = f.variant ?? v.variant ?? null;
    const lim = p.limits || {};
    f.year_min = f.year_min ?? lim.year_min ?? null;
    f.year_max = f.year_max ?? lim.year_max ?? null;
    f.km_max = f.km_max ?? lim.km_max ?? null;
    // bütçe → fiyat üst sınırı (peşin: toplam bütçe; kredi: finansman.mjs ile araç üst limiti)
    const b = p.budget || {};
    if (f.price_max == null) {
      if (b.mode === 'pesin' && b.total_max_try != null) {
        f.price_max = b.total_max_try;
      } else if (b.mode === 'kredi' && b.down_payment_try != null && b.monthly_max_try != null) {
        const rate = b.monthly_rate_max ?? 0.035;
        const months = b.months ?? 24;
        const i = rate;
        const loan = i <= 0 ? b.monthly_max_try * months : b.monthly_max_try * (1 - Math.pow(1 + i, -months)) / i;
        f.price_max = Math.floor(b.down_payment_try + loan);
        f._budget_cap_note = `peşinat ${b.down_payment_try} + ${months}×${b.monthly_max_try} (aylık %${(rate*100).toFixed(2)}) → üst limit ${f.price_max}`;
      }
    }
    if (lim.gearbox && lim.gearbox !== 'any') f.gearbox = f.gearbox ?? lim.gearbox;
    if (lim.fuel && lim.fuel !== 'any') f.fuel = f.fuel ?? lim.fuel;
    if (lim.body && lim.body !== 'any') f.body = f.body ?? lim.body;
    const risk = p.risk || {};
    f.changed_parts_max = f.changed_parts_max ?? risk.max_changed_parts ?? null;
    f.painted_parts_max = f.painted_parts_max ?? risk.max_painted_parts ?? null;
    if (p.seller_preference && p.seller_preference !== 'any') f.seller_type = f.seller_type ?? p.seller_preference;
    if (!f.location && p.location) {
      f.location = resolveLocation(p.location.province, {
        radius: p.location.radius ?? 1,
        includeFerry: !!p.location.include_ferry,
      });
    }
    // must_have serbest metin maddeleri anahtar kelimeye dönüşür (raporda anlamsal süzme de yapılır)
    if (!f.keyword && Array.isArray(p.must_have) && p.must_have.length) {
      f.keyword = p.must_have[0];
    }
    f.must_have = p.must_have || [];
  }

  // boş değerleri temizle
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === '' || v === 'any') delete f[k];
  }
  return f;
}

/**
 * Tüm providerlar için arama planı.
 * Dönen her girdi: { provider, label, url, applied, postfilters, unsupported, verified, filter_in_page, plan }
 */
export function buildSearchUrls(filters = {}, opts = {}) {
  const providers = initProviders();
  const f = normalizeFilters(filters);
  const location = opts.location || f.location || null;
  const results = [];

  for (const p of providers) {
    const out = p.buildSearchUrl(f, { location });
    const postfilterKeys = out.postfilters.map((x) => x.filter);
    const planParts = [];
    if (out.applied.length) {
      planParts.push(
        'URL filtreleri: ' +
          out.applied
            .map((a) => (a.via === 'query' ? `${a.filter}=${a.value}${a.verified === false ? '(doğrulanmadı)' : ''}` : a.via === 'path-suffix' ? `${a.filter}→yol eki` : `${a.filter}→yol`))
            .join(', '),
      );
    }
    if (postfilterKeys.length) planParts.push(`rapor süzmesi: ${postfilterKeys.join(', ')}`);
    if (out.unsupported.length) planParts.push(`desteklenmiyor: ${out.unsupported.map((u) => u.filter).join(', ')}`);
    if (location && location.cities && location.cities.length > 1) {
      planParts.push(`il listesi: ${location.cities.join(', ')} (site filtresi varsayılan il; diğerleri raporda süzülür)`);
    }

    results.push({
      ...out,
      cities: location ? location.cities : [],
      plan: planParts.join(' | '),
      supported: true,
    });
  }

  return results;
}

export function providerSearchPlan(filters = {}, opts = {}) {
  const warnings = [];
  const f = normalizeFilters(filters);
  if (!f.make) warnings.push('marka bilgisi eksik — URL model yolu kurulamaz (marka geneli için keyword kullan)');
  if (!f.model) warnings.push('model bilgisi eksik — marka geneli aramaya düşülür');
  if (!f.location) warnings.push('konum bilgisi yok — il/çevre süzmesi uygulanamaz (rapor süzmesi ile idare edilir)');
  if (f.price_max == null && f.price_min == null) warnings.push('fiyat aralığı yok — bütçe dışı ilanlar sonuçlara karışır');
  if (f.must_have && f.must_have.length > 1) {
    warnings.push(`must_have maddelerinden yalnızca ilki anahtar kelimeye çevrildi; kalanlar rapor süzmesinde: ${f.must_have.slice(1).join(', ')}`);
  }
  return { urls: buildSearchUrls(filters, opts), warnings, filters: f };
}

// CLI: node search-urls.mjs --make Fiat --model "Egea Cross" --il Kocaeli --cevre 1
//      [--max 1200000] [--min] [--yil-min 2022] [--yil-max] [--km-max 120000] [--vites otomatik]
//      [--yakit benzin] [--kasa crossover] [--satici galeri] [--anahtar hatasız] [--feribot 1] [--matris]
export async function runCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      args[key] = true; // boolean bayrak (ör. --matris)
    } else {
      args[key] = next;
      i++;
    }
  }

  if (args.matris || args.matrix) {
    printMatrix();
    return;
  }

  let location = null;
  if (args.il) {
    location = resolveLocation(args.il, {
      radius: args.cevre != null ? Number(args.cevre) : 1,
      includeFerry: args.feribot === '1' || args.feribot === 'true',
    });
    if (!location) {
      console.error(`il tanınamadı: ${args.il}`);
      process.exitCode = 1;
      return;
    }
  }

  const filters = {
    make: args.make,
    model: args.model,
    variant: args.varyant,
    price_min: args.min != null ? Number(args.min) : null,
    price_max: args.max != null ? Number(args.max) : null,
    year_min: args['yil-min'] != null ? Number(args['yil-min']) : null,
    year_max: args['yil-max'] != null ? Number(args['yil-max']) : null,
    km_min: args['km-min'] != null ? Number(args['km-min']) : null,
    km_max: args['km-max'] != null ? Number(args['km-max']) : null,
    gearbox: args.vites,
    fuel: args.yakit,
    body: args.kasa,
    color: args.renk,
    seller_type: args.satici,
    changed_parts_max: args['degisen-max'] != null ? Number(args['degisen-max']) : null,
    painted_parts_max: args['boyali-max'] != null ? Number(args['boyali-max']) : null,
    heavy_damage: args['agir-hasar'] === '1' ? true : undefined,
    trade_in: args.takas === '1' ? true : undefined,
    service_warranty: args.garanti === '1' ? true : undefined,
    listed_within_days: args['ilan-tarihi'] != null ? Number(args['ilan-tarihi']) : null,
    seats_min: args['koltuk-min'] != null ? Number(args['koltuk-min']) : null,
    doors: args.kapi != null ? Number(args.kapi) : null,
    drive: args.cekis,
    power_hp_min: args['hp-min'] != null ? Number(args['hp-min']) : null,
    power_hp_max: args['hp-max'] != null ? Number(args['hp-max']) : null,
    engine_cc_min: args['cc-min'] != null ? Number(args['cc-min']) : null,
    engine_cc_max: args['cc-max'] != null ? Number(args['cc-max']) : null,
    keyword: args.anahtar,
    sort: args.sirala,
    location,
  };

  const { urls, warnings, filters: f } = providerSearchPlan(filters);
  if (location) {
    console.log(`# ${location.province} (plaka ${location.plate}, ${location.region}) — çevre: ${location.radius}`);
    console.log(`# iller: ${location.cities.join(', ')}`);
    if (location.ferry_available.length) {
      console.log(`# feribot: ${location.ferry_available.join(', ')}${location.include_ferry ? ' (dahil)' : ' (dahil etmek için --feribot 1)'}`);
    }
  }
  const activeFilters = Object.entries(f).filter(([k]) => k !== 'location' && k !== 'must_have');
  if (activeFilters.length) console.log(`# filtreler: ${activeFilters.map(([k, v]) => `${k}=${v}`).join(', ')}`);

  for (const u of urls) {
    console.log(`\n## ${u.label} [${u.provider}]${u.verified ? '' : ' — parametreler doğrulanmadı'}`);
    console.log(u.url);
    console.log(`   ${u.plan}`);
  }
  if (warnings.length) console.log(`\nUYARILAR: ${warnings.join(' | ')}`);
}

export async function printMatrix() {
  const { filterMatrix } = await import('./providers/index.mjs');
  const m = filterMatrix();
  console.log('# Filtre kapsama matrisi (hangi filtre nerede uygulanıyor)\n');
  for (const [id, info] of Object.entries(m)) {
    console.log(`## ${info.label} [${id}]${info.verified ? '' : ' (doğrulanmadı)'}`);
    console.log(`   URL filtresi (doğrulanmış): ${info.url_filters.join(', ') || '—'}`);
    if (info.url_filters_unverified.length) console.log(`   URL filtresi (doğrulanmamış): ${info.url_filters_unverified.join(', ')}`);
    console.log(`   rapor süzmesi: ${info.postfilters} filtre`);
    console.log(`   desteklenmiyor: ${info.unsupported.join(', ') || '—'}`);
    console.log(`   kapsama: ${info.coverage.complete ? 'TAM' : 'EKSİK: ' + info.coverage.missing.join(', ')} (${info.coverage.total} filtre)\n`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('search-urls.mjs')) {
  await runCli(process.argv.slice(2));
}
