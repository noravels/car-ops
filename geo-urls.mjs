// geo-urls.mjs — provider başına DOĞRULANMIŞ coğrafi (şehir) arama URL'leri.
//
// Neden ayrı modül: her site şehir filtresini farklı taşıyor (sorgu parametresi,
// yol parçası, hiç desteklememe). Doğrulanmamış bir desenle URL üretmek sessizce
// filtresiz arama yapar (arabam `cityId=34` tuzağı) — bu yüzden `verified` alanı
// zorunludur ve doğrulanmamış provider için url null döner.
//
// Doğrulama tarihi: 2026-09-18 (canlı testler; docs/VERI-TOPLAMA.md §11).

import { loadProvinces, normalizeProvinceName } from './location.mjs';

export const GEO_PATTERNS = Object.freeze({
  sahibinden: {
    mode: 'query',
    base: 'https://www.sahibinden.com/otomobil',
    param: 'address_city',
    value: (ctx) => String(Number(ctx.plate)), // öndeki sıfır kaldırılır: canlı doğrulanan biçim (Aydın → 9)
    verified: true,
    verified_at: '2026-09-18',
    note: 'address_city=<plaka, öndeki sıfır olmadan> — canlı doğrulandı (35 İzmir, 45 Manisa, 9 Aydın, 34 İstanbul, 6 Ankara; başlık "<İl> 2.El Arabalar...", 51 satır/sayfa).',
  },
  arabam: {
    mode: 'path',
    template: 'https://www.arabam.com/ikinci-el/{slug}',
    verified: true,
    verified_at: '2026-09-18',
    note: 'Şehir yolu /ikinci-el/<slug>; şehir liste sayfasında KM KOLONU YOK (km null kaydedilir). take=50 ile 50 satır.',
  },
  renewturkiye: {
    mode: 'path',
    template: 'https://renewturkiye.com/otomobil/{slug}',
    verified: true,
    verified_at: '2026-09-18',
    note: 'Kart formatı: marka model | varyant | yıl | km | yakıt | vites | fiyat (21 kart/sayfa).',
  },
  otoplus: {
    mode: 'path',
    template: 'https://www.otoplus.com/{slug}-ikinci-el-araba',
    only: ['İstanbul'],
    verified: true,
    verified_at: '2026-09-18',
    note: 'Yalnızca İstanbul için şehir sayfası var; sayfa=N ile sayfalama. Kartta km yok.',
  },
  otosor: {
    mode: 'path',
    template: 'https://www.otosor.com.tr/araclar/{slug}-ikinci-el-araba',
    verified: false,
    verified_at: '2026-09-18',
    note: 'Desen var (30 sayfa linki görünüyor) ama tüm sayfa/il kombinasyonları AYNI 8 kartı döndürdü → liste statik blok, sayfalama JS ile. Doğrulanana kadar kullanılmaz.',
  },
  vavacars: {
    mode: null,
    verified: false,
    verified_at: '2026-09-18',
    note: 'Şehir filtresi URL ile taşınmıyor (SPA filtre paneli). Ulusal liste kullanılır, il bilgisi ilan detayından okunur.',
  },
  otokoc: {
    mode: null,
    verified: false,
    verified_at: '2026-09-18',
    note: 'Model sayfaları açılıyor (/ikinci-el/<marka>/<model>), ilanlar JS ile geliyor; şehir filtresi URL deseni yok.',
  },
  carvak: {
    mode: null,
    verified: false,
    verified_at: '2026-09-18',
    note: 'advanced-search-api şeması bilinmiyor; şehir filtresi URL ile taşınmıyor.',
  },
  ikinciyeni: {
    mode: null,
    verified: false,
    verified_at: '2026-09-18',
    note: 'apigw/ListedVehicles gövde şeması bilinmiyor; şehir filtresi URL ile taşınmıyor.',
  },
});

/** Türkçe il adını URL slug'ına çevirir (Aydın → aydin, İstanbul → istanbul). */
export function slugTr(name) {
  const map = { ı: 'i', İ: 'i', i: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
  return String(name ?? '')
    .split('')
    .map((ch) => map[ch] ?? ch.toLowerCase())
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** İl anahtarını bulur: önce doğrudan, sonra normalize edilmiş karşılaştırmayla. */
export function resolveKey(map, raw) {
  if (!map) return null;
  if (map[raw]) return raw;
  const norm = normalizeProvinceName(raw);
  if (norm && map[norm]) return norm;
  const flat = (s) => slugTr(s);
  const hit = Object.keys(map).find((k) => flat(k) === flat(raw));
  return hit || null;
}

/**
 * İl listesi × provider listesi için coğrafi arama URL'leri üretir.
 * Doğrulanmamış desende veya desteklenmeyen ilde url=null + note döner (uydurma yok).
 */
export function geoUrls(provinceNames = [], { provinces = loadProvinces(), providers = Object.keys(GEO_PATTERNS) } = {}) {
  const map = provinces && provinces.provinces ? provinces.provinces : provinces;
  const out = [];
  for (const raw of provinceNames) {
    const name = resolveKey(map, raw);
    const rec = name ? map[name] : null;
    if (!rec) throw new Error(`tanınmayan il: ${raw}`);
    const ctx = { province: name, plate: rec.plate, slug: slugTr(name), region: rec.region };
    for (const prov of providers) {
      const pattern = GEO_PATTERNS[prov];
      if (!pattern) throw new Error(`tanımsız provider: ${prov}`);
      if (pattern.mode === 'query') {
        out.push({
          provider: prov,
          province: name,
          url: `${pattern.base}?${pattern.param}=${pattern.value(ctx)}`,
          verified: pattern.verified,
          note: pattern.note,
          pattern: 'query',
        });
      } else if (pattern.mode === 'path') {
        if (pattern.only && !pattern.only.includes(name)) {
          out.push({
            provider: prov,
            province: name,
            url: null,
            verified: pattern.verified,
            note: `${prov}: yalnızca ${pattern.only.join(', ')} için şehir sayfası var — bu il atlandı.`,
            pattern: 'path',
          });
          continue;
        }
        out.push({
          provider: prov,
          province: name,
          url: pattern.template.replace('{slug}', ctx.slug),
          verified: pattern.verified,
          note: pattern.note,
          pattern: 'path',
        });
      } else {
        out.push({
          provider: prov,
          province: name,
          url: null,
          verified: false,
          note: `${prov}: doğrulanmış şehir URL deseni yok — ${pattern.note}`,
          pattern: null,
        });
      }
    }
  }
  return out;
}

// ---- CLI ----
// node geo-urls.mjs --iller "İzmir,Manisa,Aydın" [--providerlar sahibinden,arabam]
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
  const iller = String(args.iller || args.il || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!iller.length) {
    console.log('Kullanım: node geo-urls.mjs --iller "İzmir,Manisa,Aydın" [--providerlar sahibinden,arabam]');
    return;
  }
  const providers = args.providerlar ? String(args.providerlar).split(',').map((s) => s.trim()) : undefined;
  const rows = geoUrls(iller, providers ? { providers } : {});
  for (const r of rows) {
    if (r.url) console.log(`${r.verified ? '✅' : '⚠️ '} ${r.provider.padEnd(13)} ${r.province.padEnd(11)} ${r.url}`);
    else console.log(`⛔ ${r.provider.padEnd(13)} ${r.province.padEnd(11)} — ${r.note}`);
  }
  console.log(`\n${rows.filter((r) => r.url).length} kullanılabilir URL / ${rows.length} kombinasyon`);
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
