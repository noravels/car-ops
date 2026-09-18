// search-urls.mjs — kullanıcı filtresinden provider arama URL'leri üretir.
// Parametre adları config/search-params.json'dan gelir (uydurulmaz).
// URL parametresi desteklemeyen sitelerde (vavacars, otokoc) süzme rapor
// aşamasında yapılır ve bu açıkça işaretlenir (filter_in_page: true).

import { readFileSync } from 'node:fs';

const DIACRITICS = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };

export function slugify(text) {
  return String(text || '')
    .split('')
    .map((ch) => DIACRITICS[ch] ?? ch)
    .join('')
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadParams(config) {
  if (config) return config;
  return JSON.parse(readFileSync(new URL('./config/search-params.json', import.meta.url), 'utf8'));
}

function applyPath(template, { make, model }) {
  return template
    .replace('{make-slug}', slugify(make))
    .replace('{model-slug}', slugify(model))
    .replace('{Make}', encodeURIComponent(String(make)))
    .replace('{Model}', encodeURIComponent(String(model)));
}

export function buildSearchUrls(filters = {}, config) {
  const params = loadParams(config);
  const results = [];

  for (const [provider, spec] of Object.entries(params)) {
    if (!spec || typeof spec !== 'object' || !spec.base) continue;

    const path = applyPath(spec.path || '', filters);
    const url = new URL(spec.base + path);
    const p = spec.params || {};
    let applied = 0;

    const mapping = [
      ['price_max', filters.price_max],
      ['price_min', filters.price_min],
      ['year_min', filters.year_min],
      ['year_max', filters.year_max],
      ['km_max', filters.km_max],
      ['changed_parts_max', filters.changed_parts_max],
      ['paging_size', filters.paging_size],
    ];
    for (const [key, value] of mapping) {
      if (value == null || !p[key]) continue;
      url.searchParams.set(p[key], String(value));
      applied++;
    }

    // il filtresi: provider destekliyorsa uygula, desteklemiyorsa rapor bazlı süzme
    let cityApplied = false;
    if (spec.city_param && filters.location) {
      const value =
        spec.city_value === 'plate'
          ? filters.location.plate || (filters.location.plates && filters.location.plates[0])
          : filters.location.province || (filters.location.cities && filters.location.cities[0]);
      if (value) {
        url.searchParams.set(spec.city_param, String(value));
        cityApplied = true;
      }
    }

    const cities = (filters.location && filters.location.cities) || [];
    const planParts = [];
    if (cityApplied) {
      planParts.push(`${spec.city_param} ile il filtresi uygulandı (${url.searchParams.get(spec.city_param)})`);
    }
    if (cities.length > 1) {
      planParts.push(
        `il listesinde rapor bazlı süzme: ${cities.join(', ')}` +
          (cityApplied ? ' (site filtresi varsayılan il; diğer iller raporda süzülür)' : ''),
      );
    }
    if (!spec.city_param && cities.length) {
      planParts.push('site il filtresi desteklemiyor → il süzmesi raporda yapılır');
    }

    results.push({
      provider,
      url: url.toString(),
      supported: true,
      verified: !!spec.verified,
      params_applied: applied,
      city_applied: cityApplied,
      filter_in_page: !Object.keys(p).length,
      cities,
      plan: planParts.join('; ') || 'süzme raporda yapılır',
      notes: spec.notes || [],
    });
  }

  return results;
}

export function providerSearchPlan(filters = {}, config) {
  const warnings = [];
  if (!filters.make) warnings.push('marka bilgisi eksik — URL model yolu kurulamaz');
  if (!filters.model) warnings.push('model bilgisi eksik — marka geneli aramaya düşülür');
  if (!filters.location) warnings.push('konum bilgisi yok — il/çevre süzmesi uygulanamaz');
  if (filters.price_max == null && filters.price_min == null) {
    warnings.push('fiyat aralığı yok — bütçe dışı ilanlar sonuçlara karışır');
  }
  return { urls: buildSearchUrls(filters, config), warnings };
}

// CLI: node search-urls.mjs --make Fiat --model "Egea Cross" --il Ankara --cevre 1 --max 1200000 [--yil-min 2022] [--km-max 120000]
export async function runCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  const { resolveLocation } = await import('./location.mjs');
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
    price_max: args.max != null ? Number(args.max) : null,
    price_min: args.min != null ? Number(args.min) : null,
    year_min: args['yil-min'] != null ? Number(args['yil-min']) : null,
    km_max: args['km-max'] != null ? Number(args['km-max']) : null,
    location,
  };
  const { urls, warnings } = providerSearchPlan(filters);
  if (location) {
    console.log(`# ${location.province} ${location.radius > 0 ? `+ ${location.radius} çevre` : ''} → ${location.cities.join(', ')}`);
    if (location.ferry_available.length) console.log(`# feribot bağlantılı: ${location.ferry_available.join(', ')} (dahil etmek için --feribot 1)`);
  }
  for (const u of urls) {
    console.log(`\n## ${u.provider}${u.verified ? '' : ' (parametreler doğrulanmadı)'}`);
    console.log(u.url);
    if (u.plan) console.log(`süzme: ${u.plan}`);
  }
  if (warnings.length) console.log(`\nUYARILAR: ${warnings.join(' | ')}`);
}

if (process.argv[1] && process.argv[1].endsWith('search-urls.mjs')) {
  await runCli(process.argv.slice(2));
}
