// providers/arabam.mjs — arabam.com ilan listesi ayrıştırıcı.
// Veri kaynağı: agent browser (kullanıcının Chrome oturumu) → liste/detay metni.
// Siteye otomatik HTTP isteği yapılmaz; rate limit'e saygılı yavaş tempo kullanılır.

export const arabamUrlPattern = /^https?:\/\/(www\.)?arabam\.com\/ikinci-el\/otomobil\//;
export const arabamListingPattern = /^https?:\/\/(www\.)?arabam\.com\/ilan\//;

const CITIES =
  'Adana|Adıyaman|Afyonkarahisar|Ağrı|Aksaray|Amasya|Ankara|Antalya|Ardahan|Artvin|Aydın|Balıkesir|Bartın|Batman|Bayburt|Bilecik|Bingöl|Bitlis|Bolu|Burdur|Bursa|Çanakkale|Çankırı|Çorum|Denizli|Diyarbakır|Düzce|Edirne|Elazığ|Erzincan|Erzurum|Eskişehir|Gaziantep|Giresun|Gümüşhane|Hakkari|Hatay|Iğdır|Isparta|İstanbul|İzmir|Kahramanmaraş|Karabük|Karaman|Kars|Kastamonu|Kayseri|Kilis|Kırıkkale|Kırklareli|Kırşehir|Kocaeli|Konya|Kütahya|Malatya|Manisa|Mardin|Mersin|Muğla|Muş|Nevşehir|Niğde|Ordu|Osmaniye|Rize|Sakarya|Samsun|Siirt|Sinop|Sivas|Şanlıurfa|Şırnak|Tekirdağ|Tokat|Trabzon|Tunceli|Uşak|Van|Yalova|Yozgat|Zonguldak';

function toNumber(text) {
  if (text == null) return null;
  const t = String(text).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Liste satırı metni (sekme yok, sıralı alanlar): model / başlık / yıl / km / renk / fiyat / tarih / şehir
export function parseArabamRowText(rowText, ctx = {}) {
  const raw = stripTags(rowText);
  if (!raw) return null;

  const priceMatches = [...raw.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*TL/g)].map((m) => toNumber(m[1]));
  if (!priceMatches.length) return null;
  const firstPriceIndex = raw.search(/(\d{1,3}(?:\.\d{3})+)\s*TL/);

  // km: ilk fiyattan önceki, yıl aralığında olmayan son sayı (km kolonu fiyattan hemen önce gelir)
  const beforePrice = raw.slice(0, firstPriceIndex >= 0 ? firstPriceIndex : raw.length);
  const numRe = /(?<![\d.])(\d{1,3}(?:\.\d{3})+|\d{4,6})(?![\d.])/g;
  let km = null;
  let kmIndex = -1;
  for (const m of beforePrice.matchAll(numRe)) {
    const v = toNumber(m[1]);
    if (v == null) continue;
    if (v >= 1980 && v <= 2035) continue; // yıl
    if (v < 1000) continue; // anlamsız km
    km = v;
    kmIndex = m.index;
  }

  // yıl: km'den önceki son yıl değeri (ilan başlığındaki yıl değil, kolondaki yıl esas)
  let year = null;
  for (const m of beforePrice.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)) {
    const idx = m.index ?? -1;
    if (kmIndex < 0 || idx < kmIndex) year = Number(m[1]);
  }

  // şehir + ilçe
  const cityM = raw.match(new RegExp(`\\b(${CITIES})\\b(?:\\s+([A-ZÇĞİÖŞÜ][\\wçğıöşüÇĞİÖŞÜ.'-]{2,}))?`));
  const city = cityM ? [cityM[1], cityM[2]].filter(Boolean).join(' ') : ctx.city || null;

  const isIndividual = /sahibinden[\s-]*(?:satılık|satilik)|^(?!.*galeri).*sahibinden/i.test(raw);

  const current = priceMatches[priceMatches.length - 1];
  const previous = priceMatches.length > 1 ? priceMatches[0] : null;
  const title = raw.replace(/^\S+\s+\S+\s+\S+\s*/, '').slice(0, 160);

  return {
    title,
    year,
    km,
    price_try: current,
    price_previous_try: previous && previous > current ? previous : null,
    price_drop_try: previous && previous > current ? previous - current : null,
    city,
    seller_type: ctx.seller_type || (isIndividual ? 'bireysel' : 'galeri'),
    source: 'arabam.com',
    raw: raw.slice(0, 300),
  };
}

export function parseArabamHtml(pageText, ctx = {}) {
  const out = [];
  for (const chunk of String(pageText).split(/\n{2,}|(?=\bFiat\s+Egea)/)) {
    const r = parseArabamRowText(chunk, ctx);
    if (r && r.price_try && r.year) out.push(r);
  }
  const seen = new Set();
  return out.filter((r) => {
    const k = `${r.year}|${r.km}|${r.price_try}|${r.city}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function renderArabamRow(r) {
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR'));
  const drop = r.price_drop_try ? ` ↓${fmt(r.price_drop_try)} TL (${fmt(r.price_previous_try)}'den)` : '';
  return `${r.year} | ${fmt(r.km)} km | ${fmt(r.price_try)} TL${drop} | ${r.city || '—'} | ${r.seller_type}`;
}


// ---------------------------------------------------------------------------
// Abstract provider uygulaması
// ---------------------------------------------------------------------------
import { MarketplaceProvider, extractClaims } from './base.mjs';

export class ArabamProvider extends MarketplaceProvider {
  static get id() {
    return 'arabam';
  }

  static get urlPattern() {
    return arabamUrlPattern;
  }

  /** Liste sayfası metninden satırlar (arabam kartları: model / başlık / yıl / km / renk / fiyat / tarih / şehir) */
  parseListings(pageText, ctx = {}) {
    const out = [];
    for (const chunk of String(pageText || '').split(/\n{2,}|(?=\b(?:Fiat|Renault|Ford|Toyota|Honda|Hyundai|Volkswagen|Opel|Peugeot|Citroen|Dacia|Skoda|Seat|Audi|BMW|Mercedes|Nissan|Kia|Volvo|MG|Chery)\b)/)) {
      const r = parseArabamRowText(chunk, ctx);
      if (r && r.price_try && r.year) out.push(r);
    }
    const seen = new Set();
    return out.filter((r) => {
      const k = `${r.year}|${r.km}|${r.price_try}|${r.city}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /** Detay sayfası: yapısal alanlar + "Boya, Değişen ve Tramer" bölümü + açıklama */
  parseDetail(pageText, ctx = {}) {
    const raw = String(pageText || '');
    const field = (label) => {
      const m = raw.match(new RegExp(`${label}\\s*\\n\\s*([^\\n]{1,60})`, 'i'));
      return m ? m[1].trim() : null;
    };
    const priceM = raw.match(/([\d.]{4,})\s*TL/);
    const boyaM = raw.match(/Boya-değişen\s*\n\s*([^\n]{1,60})/i);
    const expM = raw.match(/EXPERT[İI]Z[\s\S]{0,600}/i);
    const tramerM = raw.match(/TRAMER\s*[:=]?\s*([\d.,]+)\s*(?:TL|BİN|bin)?/i);
    const idM = raw.match(/İlan No\s*\n\s*(\d{6,})/) || (ctx.url ? String(ctx.url).match(/(\d{6,})/) : null);
    const listingNo = idM ? (Array.isArray(idM) ? idM[1] : idM) : null;

    const expertizText = expM ? expM[0] : '';
    const changed = [...expertizText.matchAll(/([A-ZÇĞİÖŞÜ\s]{4,30}?)\s*DEĞİŞEN/gi)].map((m) => m[1].trim());
    const painted = [...expertizText.matchAll(/([A-ZÇĞİÖŞÜ\s]{4,30}?)\s*BOYALI/gi)].map((m) => m[1].trim());

    return {
      schema: 'car-ops/listing@1',
      listing_id: listingNo ? `arabam-${listingNo}` : null,
      market: 'tr',
      source_site: 'arabam.com',
      url: ctx.url || null,
      captured_at: ctx.captured_at || new Date().toISOString(),
      title: field('İlan Başlığı') || raw.slice(0, 120),
      price_try: priceM ? Number(priceM[1].replace(/\./g, '')) : null,
      price_history_site: null,
      seller: {
        type: /Galeriden/i.test(raw) ? 'galeri' : /Sahibinden/i.test(raw) ? 'bireysel' : 'bilinmiyor',
        name: ctx.seller_name || null,
        member_since: null,
        other_listings_hint: null,
      },
      vehicle: {
        make: field('Marka'),
        model: field('Model'),
        year: Number(field('Yıl')) || null,
        km: field('Kilometre') ? Number(String(field('Kilometre')).replace(/[^\d]/g, '')) : null,
        fuel: field('Yakıt Tipi'),
        gearbox: field('Vites Tipi'),
        body: field('Kasa Tipi'),
        color: field('Renk'),
      },
      claims: extractClaims(raw),
      damage_records: tramerM ? [{ year: null, amount_try: Number(tramerM[1].replace(/\./g, '')), source: 'seller-claim', kind: 'tramer beyanı' }] : [],
      inspection: {
        present: !!(changed.length || painted.length),
        changed_parts: changed,
        painted_parts: painted,
        report_url: null,
        structured_field: boyaM ? boyaM[1].trim() : null,
      },
      unverifiable: ['kaporta durumu', 'motor durumu', 'şanzıman sesi'],
    };
  }

  parseClaims(descriptionText) {
    return extractClaims(descriptionText);
  }
}
