// providers/otokoc.mjs — Otokoç 2. El (otokocikinciel.com) ayrıştırıcı.
// Kurumsal yetkili satıcı kanalı: "Koşulsuz İade" ve "Otokoç 2. El Garanti" avantajı var.
// Liste satır formatı (bir kart): <başlık><yıl> Model, <renk><km> km<yakıt><vites><şehir><açıklama><gg.aa.yyyy><fiyat> TL

export const otokocUrlPattern = /^https?:\/\/(www\.)?otokocikinciel\.com\/(ikinci-el|ilan)\//;

const FUELS = ['Dizel', 'Benzin', 'Hibrit', 'Elektrik', 'Benzin & LPG', 'LPG'];
const GEARBOXES = ['Otomatik', 'Manuel', 'Yarı Otomatik'];

export function otokocModelUrl(make, model) {
  const base = 'https://www.otokocikinciel.com/ikinci-el';
  const slug = (s) => String(s).toLowerCase().trim().replace(/\s+/g, '-');
  return model ? `${base}/${slug(make)}/${slug(model)}` : `${base}/${slug(make)}`;
}

function toNum(text) {
  if (text == null) return null;
  const n = Number(String(text).replace(/\./g, '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseOtokocRow(rowText, ctx = {}) {
  const raw = String(rowText).replace(/\s+/g, ' ').trim();
  const yearM = raw.match(/(\d{4})\s*Model/);
  const kmM = raw.match(/([\d.]+)\s*km/i);
  const fuel = FUELS.find((f) => new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(raw)) || null;
  const gearbox = GEARBOXES.find((g) => raw.includes(g)) || null;
  const dateM = raw.match(/(\d{2}\.\d{2}\.\d{4})/);
  // tarih fiyata yapışık gelebilir ("18.09.2026780.000 TL") → fiyat aramasını tarihsiz metinde yap
  const withoutDate = dateM ? raw.replace(dateM[1], ' ') : raw;
  const priceM = withoutDate.match(/([\d.]{4,})\s*TL/);
  const colorM = raw.match(/Model,\s*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+)/);

  // şehir: vites anahtar kelimesinden sonra gelen ilk büyük harfli kelime
  let city = null;
  if (gearbox) {
    const afterGear = raw.slice(raw.indexOf(gearbox) + gearbox.length);
    const cityM = afterGear.match(/^\s*([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/);
    if (cityM) city = cityM[1].trim();
  }

  return {
    source: 'otokocikinciel.com',
    url: ctx.url || null,
    title: raw.slice(0, 120),
    year: yearM ? Number(yearM[1]) : null,
    km: kmM ? toNum(kmM[1]) : null,
    color: colorM ? colorM[1] : null,
    fuel,
    gearbox,
    city,
    listed_at: dateM ? dateM[1] : null,
    price_try: priceM ? toNum(priceM[1]) : null,
    seller_type: 'kurumsal-yetkili',
    guarantee: 'otokoc-2el-garanti',
    perks: ['Koşulsuz İade', 'Otokoç 2. El Garanti'],
    raw: raw.slice(0, 300),
  };
}

export function parseOtokocHtml(pageText, ctx = {}) {
  const out = [];
  for (const chunk of String(pageText).split(/\n{2,}/)) {
    const r = parseOtokocRow(chunk, ctx);
    if (r && r.year) out.push(r);
  }
  const seen = new Set();
  return out.filter((r) => {
    const k = `${r.year}|${r.km}|${r.price_try}|${r.city}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function renderOtokocRow(r) {
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));
  return `${r.year} | ${fmt(r.km)} km | ${fmt(r.price_try)} TL | ${[r.fuel, r.gearbox].filter(Boolean).join('/')} | ${r.city || '—'} | ${r.guarantee}`;
}
