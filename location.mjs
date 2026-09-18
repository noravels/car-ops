// location.mjs — "X ilinde veya çevresinde" aramasını somut il listesine çevirir.
// Veri: config/locations/<market>-provinces.json (TR için tr-provinces.json).
// Komşuluk kara sınırına dayanır; feribot/boğaz bağlantıları 'ferry' alanında
// ayrı tutulur ve isteğe bağlı dahil edilir (ör. İstanbul ↔ Bursa).

import { readFileSync } from 'node:fs';

const ALIASES = {
  afyon: 'Afyonkarahisar',
  'afyonkarahisar': 'Afyonkarahisar',
  urfa: 'Şanlıurfa',
  sanliurfa: 'Şanlıurfa',
  'şanlıurfa': 'Şanlıurfa',
  maras: 'Kahramanmaraş',
  'kahramanmaras': 'Kahramanmaraş',
  'kahramanmaraş': 'Kahramanmaraş',
  hatay: 'Hatay',
  istanbul: 'İstanbul',
  izmir: 'İzmir',
  'i̇stanbul': 'İstanbul',
  'i̇zmir': 'İzmir',
  'mugla': 'Muğla',
  'tekirdag': 'Tekirdağ',
  'kirklareli': 'Kırklareli',
  'canakkale': 'Çanakkale',
  'corum': 'Çorum',
  'gumushane': 'Gümüşhane',
  'kahramanmaraş': 'Kahramanmaraş',
  'sirnak': 'Şırnak',
  'tunceli': 'Tunceli',
};

let CACHE = null;

export function loadProvinces(data) {
  if (data) return normalizeData(data);
  if (!CACHE) {
    const raw = JSON.parse(
      readFileSync(new URL('./config/locations/tr-provinces.json', import.meta.url), 'utf8'),
    );
    CACHE = normalizeData(raw);
  }
  return CACHE;
}

function normalizeData(data) {
  return { meta: data.meta || {}, provinces: data.provinces || data };
}

function fold(text) {
  return String(text)
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/^i̇/, 'i');
}

export function normalizeProvinceName(input, data) {
  const p = loadProvinces(data);
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // plaka kodu
  if (/^\d{1,2}$/.test(raw)) {
    const plate = raw.padStart(2, '0');
    for (const [name, info] of Object.entries(p.provinces)) {
      if (info.plate === plate) return name;
    }
    return null;
  }

  // tam ad eşleşmesi (Türkçe büyük/küçük harf duyarlı)
  for (const name of Object.keys(p.provinces)) {
    if (name.toLocaleLowerCase('tr') === raw.toLocaleLowerCase('tr')) return name;
  }

  // ASCII'ye katlanmış eşleşme
  const f = fold(raw);
  for (const name of Object.keys(p.provinces)) {
    if (fold(name) === f) return name;
  }

  // alias tablosu
  const alias = ALIASES[raw.toLocaleLowerCase('tr')] || ALIASES[f];
  if (alias && p.provinces[alias]) return alias;

  // kısmi eşleşme (ör. "kahraman" → Kahramanmaraş) — tek aday varsa kabul
  const partial = Object.keys(p.provinces).filter((name) => fold(name).startsWith(f) && f.length >= 4);
  if (partial.length === 1) return partial[0];

  return null;
}

export function regionOf(input, data) {
  const p = loadProvinces(data);
  const name = normalizeProvinceName(input, data);
  return name ? p.provinces[name].region || null : null;
}

// radius: 0 = sadece il, 1 = il + kara komşuları, 2 = + komşuların komşuları
export function resolveLocation(input, { radius = 1, includeFerry = false } = {}, data) {
  const p = loadProvinces(data);
  const province = normalizeProvinceName(input, data);
  if (!province) return null;

  const cities = new Set([province]);
  const ferryCities = new Set();
  let frontier = [province];

  for (let step = 0; step < Math.max(0, radius); step++) {
    const next = [];
    for (const city of frontier) {
      const info = p.provinces[city];
      if (!info) continue;
      for (const nb of info.n || []) {
        if (!cities.has(nb)) {
          cities.add(nb);
          next.push(nb);
        }
      }
      for (const f of info.ferry || []) {
        ferryCities.add(f);
        if (includeFerry && !cities.has(f)) {
          cities.add(f);
          next.push(f);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }

  return {
    province,
    plate: p.provinces[province].plate,
    region: p.provinces[province].region || null,
    radius,
    include_ferry: includeFerry,
    cities: [...cities].sort((a, b) => a.localeCompare(b, 'tr')),
    plates: [...cities]
      .map((c) => p.provinces[c] && p.provinces[c].plate)
      .filter(Boolean)
      .sort(),
    ferry_available: [...ferryCities].sort((a, b) => a.localeCompare(b, 'tr')),
  };
}

export function nearbyProvinces(input, { radius = 1, includeFerry = false } = {}, data) {
  const loc = resolveLocation(input, { radius, includeFerry }, data);
  if (!loc) return [];
  return loc.cities.filter((c) => c !== loc.province);
}

// Doğal dil ipucundan il çıkarımı: "İzmir'de veya çevresinde araba arıyorum"
export function extractProvinceFromText(text, data) {
  const p = loadProvinces(data);
  const t = String(text || '');
  const hits = [];
  for (const name of Object.keys(p.provinces)) {
    const stem = name.length > 6 ? name.slice(0, name.length - 2) : name;
    const re = new RegExp(`\\b${stem}`, 'i');
    if (re.test(t)) hits.push(name);
  }
  // en uzun eşleşme en güvenilir (ör. "Kahramanmaraş" > "Maraş")
  hits.sort((a, b) => b.length - a.length);
  return hits[0] || null;
}

// CLI: node location.mjs --il Kocaeli [--cevre 1] [--feribot 1]
export function runCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  const il = args.il || argv[0];
  if (!il) {
    console.error('kullanım: node location.mjs --il Kocaeli [--cevre 1] [--feribot 1]');
    process.exitCode = 1;
    return;
  }
  const loc = resolveLocation(il, {
    radius: args.cevre != null ? Number(args.cevre) : 1,
    includeFerry: args.feribot === '1' || args.feribot === 'true',
  });
  if (!loc) {
    console.error(`il tanınamadı: ${il}`);
    process.exitCode = 1;
    return;
  }
  console.log(`# ${loc.province} (plaka ${loc.plate}, ${loc.region}) — çevre: ${loc.radius}`);
  console.log(`iller (${loc.cities.length}): ${loc.cities.join(', ')}`);
  console.log(`plakalar: ${loc.plates.join(', ')}`);
  if (loc.ferry_available.length) {
    console.log(
      `feribot bağlantılı: ${loc.ferry_available.join(', ')}${loc.include_ferry ? ' (dahil edildi)' : ' (dahil etmek için --feribot 1)'}`,
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith('location.mjs')) {
  runCli(process.argv.slice(2));
}
