// lib/card-parse.mjs — ilan KARTI metnini normalize satıra çeviren GENEL ayrıştırıcı.
//
// Neden gerekli: birçok site (galeri siteleri, kurumsal platformlar) ilanları
// yapılandırılmış tablo yerine serbest metinli kart olarak veriyor. Her yeni site
// için ayrı kod yazmak yerine tek ayrıştırıcı + site başına URL deseni kullanılır.
//
// İLKELER:
//   1. Uydurma yok: fiyat yoksa kart atlanır; km/yıl bulunamazsa null yazılır ve
//      `notes` alanına gerekçe düşer.
//   2. Taşıyıcı sinyal fiyattır (her ilan kartında fiyat bulunur).
//   3. Türkçe tuzakları: model adındaki yıl (Peugeot 2008), taksit tutarı,
//      "0 KM" beyanı, büyük/küçük harf ve şehir adı normalizasyonu.

export const TR_MAKES = Object.freeze([
  'Alfa Romeo', 'Aston Martin', 'DS Automobiles', 'Great Wall', 'Land Rover', 'Mercedes-Benz',
  'Range Rover', 'Rolls-Royce', 'Volkswagen', 'Bmw', 'Bmw', 'Mini', 'Cupra', 'Smart', 'Volvo',
  'Toyota', 'Honda', 'Hyundai', 'Kia', 'Nissan', 'Mazda', 'Subaru', 'Mitsubishi', 'Suzuki',
  'Dacia', 'Lada', 'Skoda', 'Seat', 'Opel', 'Peugeot', 'Citroen', 'Citroën', 'Renault', 'Fiat',
  'Ford', 'Audi', 'Jeep', 'Chevrolet', 'Isuzu', 'Chery', 'Mg', 'Byd', 'Togg', 'Lexus', 'Jaguar',
  'Porsche', 'Iveco', 'Tofas', 'Tofaş', 'Bmc', 'Otokar', 'Lada', 'Proton', 'Daihatsu', 'Geely',
  'Maxus', 'Dfsk', 'Leapmotor', 'Skywell', 'Seres', 'Cadillac', 'Dodge', 'Chrysler', 'Infiniti',
  'Bentley', 'Maserati', 'Ferrari', 'Lamborghini', 'Tesla', 'Polestar', 'Nio', 'Volvo', 'Saab',
]);

// Model adı olan 4 haneli sayılar yıl sayılmaz (Peugeot 2008/3008/5008/4008 vb.)
const MODEL_NUMBERS = { Peugeot: ['2008', '3008', '5008', '4008'] };

// Gerçekten iki kelimeli modeller (tek kelime alınırsa marka/model bozulur)
const MODEL_PHRASES = ['Range Rover', 'Grand Cherokee', 'Discovery Sport', 'C4 Cactus', 'C3 Aircross', 'Corolla Cross'];

// Model adı + sonek AYRI segmentlere düşebilir: "Citroen C3 | SUV 1.2 PureTech ... AirCross".
// Bu durumda sonek varyant metninde geçiyorsa modele birleştirilir (yanlış modele atıf önlenir).
const MODEL_MERGE = [
  ['C3', 'Aircross'], ['C4', 'Aircross'], ['C5', 'Aircross'], ['C4', 'Cactus'],
  ['Sandero', 'Stepway'], ['Corolla', 'Cross'], ['Egea', 'Cross'], ['Clio', 'E-Tech'],
];

const FUEL_RULES = [
  [/\bdizel\b|\bdci\b|\btdi\b|multijet|bluehdi|\bhdi\b|\bcrdi\b|\bcdti\b|\bmj\b|\btdci\b/i, 'Dizel'],
  [/hybrid|hibrit|mhev/i, 'Hibrit'],
  [/elektrik|\bev\b|electric/i, 'Elektrik'],
  [/\blpg\b/i, 'LPG'],
  [/benzin|\btsi\b|\btce\b|ecoboost|\bfire\b|puretech|\bmpi\b|\bvvt\b|multidrive|multiair|\bvti\b|\bgdi\b|mivec|sidi|\bthp\b|vtec/i, 'Benzin'],
];

const GEARBOX_RULES = [
  [/otomatik|\bdct\b|\bdsg\b|\bcvt\b|x-tronic|\beat\b|\bat8\b|\bat6\b|\bedc\b|steptronic|multitronic|tiptronic|multidrive/i, 'Otomatik'],
  [/manuel|d[uü]z vites|düz\b/i, 'Manuel'],
];

const BODY_RULES = [
  [/\bsuv\b/i, 'SUV'],
  [/sedan/i, 'Sedan'],
  [/hatchback/i, 'Hatchback'],
  [/crossover/i, 'Crossover'],
  [/station|\bsw\b/i, 'Station Wagon'],
  [/\bmpv\b/i, 'MPV'],
  [/coupe|coupé/i, 'Coupe'],
  [/pick-?up|kamyonet/i, 'Pickup'],
];

const CITY_FIX = { istanbul: 'İstanbul', izmir: 'İzmir', ankara: 'Ankara' };

export function detectFuel(text) {
  return firstMatch(String(text ?? ''), FUEL_RULES);
}

export function detectGearbox(text) {
  return firstMatch(String(text ?? ''), GEARBOX_RULES);
}

/** Varyant metninden yıl/km/vites/yakıt/kasa gürültüsünü temizler. */
export function stripVariantNoise(segment) {
  return String(segment ?? '')
    .replace(/^(SUV|Sedan|Hatchback|Crossover|Station Wagon|Coupe|MPV|Pickup)\s+/i, '')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\d{1,3}(?:\.\d{3})+\s*km/gi, ' ')
    .replace(/\b(Otomatik|Manuel|Benzin|Dizel|Hibrit|Elektrik|LPG)\b/g, ' ')
    .replace(/[•·|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function detectBody(text) {
  return firstMatch(String(text ?? ''), BODY_RULES);
}

/**
 * Kasa tipini yalnızca segment BAŞINDA arar (kart metninde geçen "SUV" kelimesinin
 * yanlış modele yazılmasını önler: "C3 Aircross" kartında kasa doğru okunur).
 */
export function detectBodyInSegments(segments = []) {
  for (const seg of segments) {
    if (/indirim|kampanya|tasarruf/i.test(String(seg))) continue;
    const m = String(seg ?? '').trim().match(/^(SUV|Sedan|Hatchback|Crossover|Station Wagon|Coupe|MPV|Pickup)\b/i);
    if (m) return m[1].replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

/** Yıl: önce tek başına duran segment, sonra metin içi (Peugeot model numaraları hariç). */
export function pickYear(segments = [], text = '') {
  for (const s of segments) {
    if (/^(19|20)\d{2}$/.test(String(s).trim())) return Number(s);
  }
  const make = segments.find((s) => startsWithMake(String(s))) || '';
  const makeName = startsWithMake(make);
  const blocked = (makeName && MODEL_NUMBERS[makeName]) || [];
  const re = /\b(19|20)\d{2}\b/g;
  let m;
  while ((m = re.exec(String(text)))) {
    const year = m[0];
    const before = String(text).slice(Math.max(0, m.index - 14), m.index);
    if (blocked.includes(year) && new RegExp(makeName, 'i').test(before)) continue;
    const after = String(text).slice(m.index + year.length, m.index + year.length + 12);
    if (/^\s*(KM|km)/.test(after)) continue; // "110.000 KM" içindeki sayı yıl değil
    return Number(year);
  }
  return null;
}

/**
 * Fiyat: hem "1.250.000 TL" (sonek) hem "₺ 1.378.750" (önek) biçimi desteklenir.
 * Aylık taksit ("x 12 ay") tutarları elenir; metinde en erken geçen geçerli tutar alınır.
 */
/**
 * Türkçe sayı çözümleyici: binlik ayırıcı nokta VEYA boşluk olabilir
 * ("1.550.000", "1 550 000", "1 550 000,50"). Ondalık virgül desteklenir.
 */
export function parseTrNumber(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[\s\u00A0\u202F.]/g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Binlik ayırıcı: nokta veya boşluk (NBSP dahil)
const NUM_GROUP = '\\d{1,3}(?:[.\\s\\u00A0]\\d{3})+';

export function pickPrice(text) {
  const t = String(text ?? '');
  const NUM = `(${NUM_GROUP}|\\d{4,9})`;
  const forms = [
    { re: new RegExp(`(?<![\\d.,])${NUM}\\s*(?:TL|₺)`, 'g'), numGroup: 1 }, // 1.250.000 TL
    { re: new RegExp(`(?:₺|TL)\\s*(?<![\\d.])${NUM}`, 'g'), numGroup: 1 }, // ₺ 1.378.750
  ];
  const found = [];
  for (const { re, numGroup } of forms) {
    let m;
    while ((m = re.exec(t))) {
      const end = m.index + m[0].length; // JS match nesnesinde .end yok
      const after = t.slice(end, end + 16);
      if (/^\s*x\s*\d+\s*ay/i.test(after)) continue; // aylık taksit
      // indirim/kampanya etiketi araç fiyatı değildir (ör. "Özel İndirim: 15.000₺")
      const before = t.slice(Math.max(0, m.index - 30), m.index);
      if (/indirim|kampanya|tasarruf|avantaj/i.test(before)) continue;
      const value = parseTrNumber(m[numGroup]);
      if (Number.isFinite(value) && value > 1000) found.push({ at: m.index, value });
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => a.at - b.at);
  return found[found.length - 1].value; // araç fiyatı kartın sonunda olur
}

/** Kilometre: "102.296 KM" / "40.582KM" biçimleri. Bulunamazsa null (0 da bir beyandır). */
export function pickKm(text) {
  const t = String(text ?? '');
  // DİKKAT: toLowerCase() Türkçe 'İ' harfini 2 kod noktasına çevirir ve indeks kayar —
  // bu yüzden 'km' konumu ORİJİNAL metinden (büyük/küçük harf duyarsız regex ile) bulunur.
  const kmHit = /km/i.exec(t);
  if (!kmHit) return null;
  const idx = kmHit.index;
  // km'den hemen önceki sayısal token alınır; binlik ayırıcı nokta veya boşluk olabilir.
  // (?<![\d.,]) koruması "2023 122.222 km" gibi ifadede yılın sayıya katılmasını engeller.
  const before = t.slice(Math.max(0, idx - 22), idx);
  const m = before.match(/(?<![\d.,])(\d{1,3}(?:[.\s\u00A0]\d{3})+|\d{1,7})\s*$/);
  if (!m) return null;
  return parseTrNumber(m[1]);
}

/** Marka/model/varyant: marka listesiyle en uzun eşleşme kazanır. */
export function splitHeading(title) {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim();
  const stripped = t.replace(/^(19|20)\d{2}\s+/, ''); // baştaki yıl
  const make = startsWithMake(stripped);
  if (!make) return { make: null, model: null, variant: null };
  const rest = stripped.slice(make.length).trim();
  if (!rest) return { make, model: null, variant: null };
  const phrase = MODEL_PHRASES.find((ph) => rest.toLowerCase().startsWith(ph.toLowerCase()));
  if (phrase) {
    const remainder = rest.slice(phrase.length).trim();
    return { make, model: phrase, variant: remainder || null };
  }
  const parts = rest.split(' ');
  let model = parts[0];
  let skip = 1;
  if (parts.length > 1 && /^\d{2,4}$/.test(parts[1])) {
    model = `${parts[0]} ${parts[1]}`; // "C 200", "3 20"
    skip = 2;
  }
  let variant = parts.slice(skip).join(' ') || null;

  // model + sonek birleştirme ("C3" + "… AirCross" → "C3 Aircross")
  if (variant) {
    const vLow = variant.toLowerCase();
    for (const [base, suffix] of MODEL_MERGE) {
      if (model.toLowerCase() !== base.toLowerCase()) continue;
      if (!new RegExp(`\\b${suffix.toLowerCase()}\\b`).test(vLow)) continue;
      model = `${model} ${suffix}`;
      variant = variant.replace(new RegExp(`\\s*${suffix}\\b`, 'i'), '').trim() || null;
      break;
    }
  }
  return { make, model, variant };
}

export function startsWithMake(text) {
  const low = String(text ?? '').toLowerCase();
  const sorted = [...TR_MAKES].sort((a, b) => b.length - a.length);
  for (const mk of sorted) {
    if (low.startsWith(mk.toLowerCase())) {
      const after = low.slice(mk.length);
      // "Mg" markası "Mg4" gibi modellerde ve "mg" kelimesinde karışabilir
      if (mk === 'Mg' && !/^[\s\d]/.test(after || ' ')) continue;
      return mk;
    }
  }
  return null;
}

/**
 * Kart metni → normalize ilan satırı. Fiyat yoksa veya marka tanınmıyorsa null döner.
 * @param {string} text kart metni
 * @param {{source: string, city?: string|null}} ctx
 */
/**
 * Kart metnini normalize eder:
 *  - para birimi ile tutar arasındaki ayırıcıları kaldırır ("₺ | 1.278.000" → "₺ 1.278.000")
 *  - madde işaretini boşluğa çevirir ("Volkswagen • Polo" → "Volkswagen Polo")
 */
export function normalizeCardText(text) {
  return String(text ?? '')
    .replace(/\n+/g, ' | ')
    .replace(/(₺|TL)\s*\|\s*(?=\d)/g, '$1 ')
    .replace(/(\d)\s*\|\s*(₺|TL)/g, '$1 $2')
    .replace(/[•·]/g, ' ')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseCardText(text, { source, city = null } = {}) {
  if (!text || typeof text !== 'string') return null;
  const normalized = normalizeCardText(text);
  const segments = normalized.split('|').map((s) => s.trim()).filter(Boolean);
  const flat = segments.join(' | ');

  const price = pickPrice(flat);
  if (price == null) return null;

  const headingEntry = segments.map((seg) => ({ seg, h: splitHeading(seg) })).find((x) => x.h.make);
  if (!headingEntry) return null;
  const heading = headingEntry.h;

  // Varyant başka segmentte olabilir: "Citroen C3 | SUV 1.2 PureTech ... AirCross".
  // Motor hacmi deseni taşıyan ilk başlık-dışı segment varyant kabul edilir.
  const others = segments.filter((seg) => seg !== headingEntry.seg);
  const variantSeg = others.find(
    (seg) => /\b\d[.,]\d\b/.test(seg) && !/km|TL|₺|indirim|kampanya|fiyat|tasarruf/i.test(seg),
  );
  let segVariant = variantSeg ? stripVariantNoise(variantSeg) : null;
  // Bazı siteler (ör. carvak) yıl/km/vites ile varyantı TEK segmentte verir:
  // "2023 122.222 km 1.0 TSI Life Otomatik" → "1.0 TSI Life"
  if (!segVariant) {
    for (const seg of others) {
      if (/TL|₺|indirim|kampanya/i.test(seg)) continue;
      const cleaned = stripVariantNoise(seg);
      if (cleaned && /\d[.,]\d|TSI|TDI|TCe|dCi|Fire|PureTech|MPI|DCT|CVT/i.test(cleaned)) {
        segVariant = cleaned;
        break;
      }
    }
  }
  let variant = heading.variant || segVariant || null;

  // MODEL + SONEK birleştirme (C3 + AirCross → C3 Aircross): sonek kartın herhangi bir
  // segmentinde geçiyorsa modele katılır ve varyanttan düşülür.
  const context = others.join(' | ');
  for (const [base, suffix] of MODEL_MERGE) {
    if (heading.model.toLowerCase() !== base.toLowerCase()) continue;
    if (!new RegExp(`\\b${suffix.toLowerCase()}\\b`).test(context.toLowerCase())) continue;
    heading.model = `${heading.model} ${suffix}`;
    if (variant) variant = variant.replace(new RegExp(`\\s*${suffix}\\b`, 'i'), '').trim();
    if (!variant) variant = segVariant || null;
    break;
  }

  const notes = [];
  let km = pickKm(flat);
  if (km === 0) {
    notes.push('kart km=0 gösteriyor (sıfır km / doğrulanmalı)');
    km = null;
  } else if (km == null) {
    notes.push('kartta km yok');
  }

  const cityNorm = city == null ? null : CITY_FIX[String(city).toLowerCase()] ?? city;

  return {
    source,
    make: heading.make,
    model: heading.model,
    variant,
    year: pickYear(segments, flat),
    km,
    price_try: price,
    fuel: detectFuel(flat),
    gearbox: detectGearbox(flat),
    body: detectBodyInSegments(others) || detectBody(flat),
    city: cityNorm,
    notes: notes.length ? notes : null,
    raw_card: flat.slice(0, 220),
    attribute_source: `${source} ilan kartı (platform beyanı)`,
  };
}

function firstMatch(text, rules) {
  for (const [re, val] of rules) if (re.test(text)) return val;
  return null;
}
