// providers/vavacars.mjs — VavaCars (kurumsal, ekspertizli) ilan ayrıştırıcı.
// VavaCars "boyasız, değişensiz, tramersiz" etiketi ve "Özel İndirim: N₺" verir;
// bu ikisi doğrudan C (tramer) ve D (fiyat düşüşü) bloklarına girdi olur.

export const vavacarsUrlPattern = /^https?:\/\/tr\.vava\.cars\/buy\/cars\//;

function num(text) {
  if (text == null) return null;
  const n = Number(String(text).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const CAR_BLOCK = /Fiat\s+Egea\s+Cross\s*\n\s*(Crossover[^\n]*)\n\s*(\d{4})\n\s*([\d.,]+)\s*km\n\s*(Otomatik|Manuel)\n\s*([A-Za-zçğıöşüÇĞİÖŞÜ]+)\n\s*([0-9A-Z]{5,9})\n\s*([\d.]+)₺/g;

export function parseVavacarsCard(text) {
  const t = String(text);
  const m = t.match(
    /Fiat\s+Egea\s+Cross\s*\n\s*(Crossover[^\n]*)\n\s*(\d{4})\n\s*([\d.,]+)\s*km\n\s*(Otomatik|Manuel)\n\s*([A-Za-zçğıöşüÇĞİÖŞÜ]+)\n\s*([0-9A-Z]{5,9})\n\s*([\d.]+)₺/,
  );
  if (!m) return null;
  const prices = [...t.matchAll(/([\d.]+)₺/g)].map((x) => num(x[1])).filter(Boolean);
  const discount = t.match(/Özel\s*İndirim:\s*([\d.]+)₺/);
  const current = num(m[7]);
  const prev = prices.find((p) => p > current) || null;
  return {
    make: 'Fiat',
    model: 'Egea Cross',
    variant: m[1].trim(),
    year: Number(m[2]),
    km: num(m[3]),
    gearbox: m[4],
    fuel: m[5],
    plate: m[6],
    price_try: current,
    price_previous_try: prev,
    price_drop_try: discount ? num(discount[1]) : prev ? prev - current : null,
    tramer_claim: /Boyasız, değişensiz, tramersiz/i.test(t) ? 'temiz' : null,
    source: 'vava.cars',
    corporate: true,
  };
}

export function parseVavacarsCards(pageText) {
  const text = String(pageText);
  const blocks = text.split(/(?=Fiat\s+Egea\s+Cross)/).filter((b) => /Crossover/.test(b));
  const cars = [];
  for (const b of blocks) {
    const c = parseVavacarsCard(b);
    if (c && c.price_try) cars.push(c);
  }
  const seen = new Set();
  return cars.filter((c) => {
    const k = `${c.plate}|${c.price_try}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function renderVavacarsRow(c) {
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));
  const drop = c.price_drop_try ? ` ↓${fmt(c.price_drop_try)} TL` : '';
  return `${c.year} | ${fmt(c.km)} km | ${c.gearbox} ${c.fuel} | ${fmt(c.price_try)} TL${drop} | ${c.variant}${c.tramer_claim === 'temiz' ? ' | boyasız-değişensiz-tramersiz' : ''}`;
}
