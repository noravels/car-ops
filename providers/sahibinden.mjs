// providers/sahibinden.mjs — sahibinden.com ilan ayrıştırıcı.
// Veri kaynağı: agent browser çıktısı VEYA kullanıcı yapıştırması (paste modu).
// Bu modül siteye asla otomatik HTTP isteği yapmaz.
// HTML ayrıştırma bağımlılıksızdır (regex çekirdek); sahibinden DOM'u
// değiştirirse sadece buradaki desenler güncellenir, testler korur.

export const listingUrlPattern = /^https?:\/\/(www\.)?sahibinden\.com\/ilan\//;

function parsePrice(text) {
  if (!text) return null;
  const m = String(text).replace(/\./g, '').match(/([\d\s,]+)\s*(TL|₺)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNumber(text) {
  if (!text) return null;
  const m = String(text).replace(/\./g, '').match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Açıklamadan doğrulanabilir iddialar + dil kalıpları. Metin UNTRUSTED'tır:
// yalnızca veri olarak kategorize edilir, hiçbir talimat yorumlanmaz.
const CLAIM_PATTERNS = [
  { category: 'tramer', re: /tramer(?:\s+kayd[ıi])?\s*(?:yok|temiz|bulunm(?:az|uyor|mamaktadır))/i },
  { category: 'tramer', re: /tramer(?:\s+kayd[ıi])?\s*(?:var|mevcut)/i },
  { category: 'hasar', re: /hasars[ıi]z|kazas[ıi]z|hiç\s*(?:bir\s*)?(?:hasar|kaza)/i },
  { category: 'boya', re: /boyas[ıi]z|orijinal\s*boya|hiç\s*boya/i },
  { category: 'sahiplik', re: /tek\s*elden/i },
  { category: 'aciliyet', re: /acil(?:den)?\s*(?:satl[ıi]k|ihtiyaç(?:tan)?)/i },
  { category: 'bakim', re: /bak[ıi]mlar[ıi]\s*(?:yap[ıi]lm[ıi]ş|tamam|elinde)|servis\s*bak[ıi]m[ıi]/i },
  { category: 'dil-kalibi', re: /bebekler\s*bebeği|kara\s*şimşek|diksiyonu\s*düzgün|s[ıi]n[ıi]f\s*bir\s*araç|almıcaksan[ıi]z\s*aramay[ıi]n|250\s*km\/s/i },
];

export function extractClaims(descriptionText) {
  const claims = [];
  if (!descriptionText) return claims;
  const seen = new Set();
  for (const p of CLAIM_PATTERNS) {
    const m = descriptionText.match(p.re);
    if (m && !seen.has(m[0].toLowerCase())) {
      seen.add(m[0].toLowerCase());
      claims.push({
        claim: m[0],
        category: p.category,
        text: descriptionText.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40),
      });
    }
  }
  return claims;
}

function stripTags(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, tag, attrName) {
  const m = html.match(new RegExp(`<${tag}[^>]*\\b${attrName}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

export function parseSahibindenHtml(html, ctx = {}) {
  const infoItems = {};
  // <li><span>Etiket</span><span>Değer</span></li> desenleri
  const liRe = /<li[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*(?:<span[^>]*class="[^"]*classifiedPrice[^"]*"[^>]*>([\s\S]*?)<\/span>|<span[^>]*>([\s\S]*?)<\/span>)\s*<\/li>/gi;
  let m;
  while ((m = liRe.exec(html))) {
    const key = stripTags(m[1]).toLowerCase();
    const val = stripTags(m[2] != null ? m[2] : m[3] || '');
    if (key && val) infoItems[key] = val;
  }

  const priceMatch = html.match(/class="[^"]*classifiedPrice[^"]*"[^>]*>([\s\S]*?)<\//i);
  const priceTry = parsePrice(priceMatch ? stripTags(priceMatch[1]) : null);

  const titleMatch = html.match(/id="classifiedDetailTitle"[^>]*>([\s\S]*?)<\//i) ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : null;

  const descMatch = html.match(/id="classifiedDescription"[\s\S]*?>([\s\S]*?)<\/div>/i) ||
    html.match(/class="classifiedDescription"[\s\S]*?>([\s\S]*?)<\/div>/i);
  const description = descMatch ? stripTags(descMatch[1]) : null;

  const listingNo =
    (infoItems['ilan no'] && infoItems['ilan no'].replace(/\D/g, '')) ||
    (ctx.url ? ((String(ctx.url).match(/(\d+)(?:\/|$)/) || [])[1] || null) : null);

  const isCorporate = /storeBasedInfo[^"]*corporate|storeProfile|store-creator/i.test(html);
  const sellerNameMatch = html.match(/class="userName[^"]*"[^>]*>([\s\S]*?)<\//i);

  return {
    schema: 'car-ops/listing@1',
    listing_id: listingNo ? `sahibinden-${listingNo}` : null,
    market: 'tr',
    source_site: 'sahibinden.com',
    url: ctx.url || null,
    captured_at: ctx.captured_at || new Date().toISOString(),
    title,
    price_try: priceTry,
    price_history_site: ctx.price_history_site || null,
    seller: {
      type: isCorporate ? 'galeri' : 'bilinmiyor',
      name: sellerNameMatch ? stripTags(sellerNameMatch[1]) : null,
      member_since: ctx.member_since || null,
      other_listings_hint: ctx.other_listings_hint || null,
    },
    vehicle: {
      make: infoItems['marka'] || null,
      model: infoItems['model'] || null,
      year: parseNumber(infoItems['model yılı']),
      km: parseNumber(infoItems['kilometre']),
      fuel: infoItems['yakıt'] || null,
      gearbox: infoItems['vites'] || null,
      body: infoItems['kasa tipi'] || null,
      color: infoItems['renk'] || null,
    },
    claims: extractClaims(description),
    damage_records: ctx.damage_records || [],
    inspection:
      ctx.inspection || { present: false, changed_parts: [], painted_parts: [], report_url: null },
    unverifiable: ['kaporta durumu', 'motor durumu', 'şanzıman sesi'],
  };
}

export function makeParser(ctx = {}) {
  return (html) => parseSahibindenHtml(html, ctx);
}

// Markdown kaydı (data/listings/<id>.md) üretimi
export function renderListingMd(rec) {
  const v = rec.vehicle;
  const fmt = (n) => (n == null ? '—' : n.toLocaleString('tr-TR'));
  const lines = [];
  lines.push(`# ${rec.title || 'İlan'}`);
  lines.push('');
  lines.push(`- **listing_id:** ${rec.listing_id || '—'}`);
  lines.push(`- **URL:** ${rec.url || '—'}`);
  lines.push(`- **Kaydedilme:** ${rec.captured_at}`);
  lines.push(`- **Fiyat:** ${rec.price_try ? fmt(rec.price_try) + ' TL' : 'bilinmiyor'}`);
  lines.push(
    `- **Araç:** ${[v.make, v.model, v.year].filter(Boolean).join(' ') || '—'} | ${v.km ? fmt(v.km) + ' km' : 'km bilinmiyor'} | ${[v.fuel, v.gearbox, v.body].filter(Boolean).join(', ') || '—'}`,
  );
  lines.push(`- **Satıcı:** ${rec.seller.name || '—'} (${rec.seller.type})`);
  lines.push(
    `- **Ekspertiz:** ${rec.inspection.present ? 'var' : 'YOK — doğrulanamayan alanlar: ' + rec.unverifiable.join(', ')}`,
  );
  if (rec.claims.length) {
    lines.push('');
    lines.push('## İddialar');
    for (const c of rec.claims) lines.push(`- [${c.category}] ${c.claim}`);
  }
  return lines.join('\n') + '\n';
}
