// providers/base.mjs — abstract marketplace provider.
// Tüm siteler bu sınıftan türer; filtre kaydı (config/filters.json) üzerinden
// çalışır. Sözleşme: HİÇBİR FİLTRE SESSİZCE DÜŞMEZ — her filtre ya URL'e uygulanır
// (query/path), ya rapor aşamasında süzülür (postfilter), ya da açıkça
// 'unsupported' olarak bildirilir.
//
// Alt sınıflar yalnızca sitedeki ayrıştırmayı yazar:
//   parseListings(pageText)  → normalize satır dizisi
//   parseDetail(html, ctx)   → ListingRecord
// Geri kalan her şey (URL kurma, filtre eşleme, rate limit, iddia çıkarma) burada.

import { readFileSync } from 'node:fs';
import { isRateLimited, backoffSchedule, humanPacing } from './rate-guard.mjs';

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

export class ProviderError extends Error {
  constructor(message, { provider, code } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.code = code || 'error';
  }
}

let REGISTRY_CACHE = null;
export function loadFilterRegistry(config) {
  if (config) return config;
  if (!REGISTRY_CACHE) {
    REGISTRY_CACHE = JSON.parse(
      readFileSync(new URL('../config/filters.json', import.meta.url), 'utf8'),
    );
  }
  return REGISTRY_CACHE;
}

export class MarketplaceProvider {
  constructor({ registry } = {}) {
    if (new.target === MarketplaceProvider) {
      throw new ProviderError('MarketplaceProvider soyut sınıftır; doğrudan örneklenemez', {
        code: 'abstract',
      });
    }
    this.registry = loadFilterRegistry(registry);
  }

  // ---- alt sınıfın doldurması gerekenler ----
  static get id() {
    throw new ProviderError('static id tanımlanmalı', { code: 'abstract' });
  }

  get id() {
    return this.constructor.id;
  }

  get spec() {
    const spec = this.registry.providers[this.id];
    if (!spec) throw new ProviderError(`filtre kaydında provider yok: ${this.id}`, { provider: this.id, code: 'no-registry' });
    return spec;
  }

  get label() {
    return this.spec.label || this.id;
  }

  get baseUrl() {
    return this.spec.base;
  }

  /** Sayfa metninden normalize ilan satırları. Alt sınıf implement eder. */
  parseListings() {
    throw new ProviderError(`parseListings implement edilmeli (${this.id})`, { provider: this.id, code: 'not-implemented' });
  }

  /** İlan detay HTML'inden ListingRecord. Alt sınıf implement eder. */
  parseDetail() {
    throw new ProviderError(`parseDetail implement edilmeli (${this.id})`, { provider: this.id, code: 'not-implemented' });
  }

  // ---- ortak yetenekler ----

  /** Bu provider'ın hangi filtreleri URL'de, hangilerini raporda uyguladığı */
  capabilities() {
    const map = this.spec.map || {};
    const native = [];
    const native_unverified = [];
    const postfilter = [];
    const unsupported = [];
    for (const [key, rule] of Object.entries(map)) {
      if (!rule) continue;
      if (rule.strategy === 'query' || rule.strategy === 'path') {
        (rule.verified === false ? native_unverified : native).push(key);
      } else if (rule.strategy === 'postfilter') postfilter.push(key);
      else if (rule.strategy === 'unsupported') unsupported.push(key);
    }
    return { native, native_unverified, postfilter, unsupported };
  }

  /** Kanonik filtre kaydındaki tüm filtreler için strateji var mı? */
  coverage() {
    const all = Object.keys(this.registry.filters);
    const map = this.spec.map || {};
    const missing = all.filter((k) => !map[k]);
    return { total: all.length, missing, complete: missing.length === 0 };
  }

  buildSearchUrl(filters = {}, { location } = {}) {
    const spec = this.spec;
    const applied = [];
    const postfilters = [];
    const unsupported = [];

    // 1) yol (path)
    let category = null;
    if (spec.category_by_body) {
      const body = filters.body;
      category = spec.category_by_body[body] || spec.category_by_body.default;
    }
    let path = this.buildPath({ ...filters, category });

    // yol segmentine giren filtreleri (make/model) bildir
    for (const key of ['make', 'model']) {
      if (filters[key] != null && filters[key] !== '') {
        applied.push({ filter: key, via: 'path', value: String(filters[key]) });
      }
    }

    // 2) yol eki (path suffix) filtreleri — ör. arabam vites/yakıt
    const suffixes = [];
    for (const [key, rule] of Object.entries(spec.map || {})) {
      if (rule.strategy !== 'path' || rule.encode !== 'suffix') continue;
      const value = filters[key];
      if (value == null || value === '') continue;
      const encoded = (rule.values && rule.values[value]) || slugify(value);
      suffixes.push(encoded);
      applied.push({ filter: key, via: 'path-suffix', encoded });
    }
    if (suffixes.length) path = `${path}-${suffixes.join('-')}`;

    const url = new URL(spec.base + path);
    const needsCurrency =
      Object.values(spec.map || {}).some((r) => r && Array.isArray(r.requires) && r.requires.includes('currency')) &&
      (filters.price_min != null || filters.price_max != null);
    if (needsCurrency && spec.currency_param) {
      url.searchParams.set(spec.currency_param.param, spec.currency_param.value);
    }

    // 3) query filtreleri
    for (const [key, rule] of Object.entries(spec.map || {})) {
      if (rule.strategy !== 'query') continue;
      let value = filters[key];
      if (key === 'city') {
        // şehir filtresi konumdan gelir (filters.city yoksa location kullanılır)
        if (!location) {
          postfilters.push({ filter: key, reason: 'konum bilgisi verilmedi → rapor süzmesi' });
          continue;
        }
        value = rule.encode === 'plate' ? location.plate || (location.plates && location.plates[0]) : location.province;
        if (value == null) {
          postfilters.push({ filter: key, reason: 'şehir konumu çözümlenemedi → rapor süzmesi' });
          continue;
        }
      }
      if (value == null || value === '') continue;
      if (Array.isArray(value)) value = value.join(',');
      url.searchParams.set(rule.param, String(value));
      applied.push({ filter: key, via: 'query', param: rule.param, value: String(value), verified: rule.verified !== false });
    }

    // 4) site desteklemeyen ama raporda süzülebilen → postfilter; hiç desteklenmeyen → unsupported
    const META_KEYS = new Set(['location', 'must_have', 'profile', 'make', 'model']);
    for (const [key, value] of Object.entries(filters)) {
      if (value == null || value === '') continue;
      if (META_KEYS.has(key)) continue;
      const rule = (spec.map || {})[key];
      if (!rule) {
        postfilters.push({ filter: key, reason: 'kayıtta tanımsız → raporda süzülür' });
        continue;
      }
      if (rule.strategy === 'postfilter') postfilters.push({ filter: key, reason: rule.reason || 'site URL filtresi yok → raporda süzülür' });
      else if (rule.strategy === 'unsupported') unsupported.push({ filter: key, reason: rule.reason || 'bu sitede desteklenmiyor' });
      else if (rule.strategy === 'query' || rule.strategy === 'path') {
        const already = applied.some((a) => a.filter === key);
        if (!already) {
          if (key === 'city' && !location) postfilters.push({ filter: key, reason: 'konum bilgisi verilmedi → rapor süzmesi' });
          else postfilters.push({ filter: key, reason: 'uygulanamadı → rapor süzmesi' });
        }
      }
    }

    // kanonik anahtarlar dışındaki kullanıcı anahtarları (must_have vb.) rapora
    for (const { filter } of postfilters) {
      if (!this.registry.filters[filter]) {
        // serbest metin/özellik filtreleri raporda anlamsal olarak süzülür
      }
    }

    // URL'in taşıdığı "süzülebilir" filtreler (make/model yol segmenti hariç):
    // bunlar yoksa site içi/rapor süzmesi gerekir.
    const refinable = applied.filter((a) => a.via === 'query' || a.via === 'path-suffix');

    return {
      provider: this.id,
      label: this.label,
      url: url.toString(),
      applied,
      postfilters,
      unsupported,
      verified: !!spec.verified,
      filter_in_page: refinable.length === 0,
      capabilities: this.capabilities(),
    };
  }

  buildPath({ make, model, category }) {
    const spec = this.spec;
    return (spec.path || '/')
      .replace('{category}', category || '')
      .replace(/\/{2,}/g, '/')
      .replace('{make-slug}', slugify(make))
      .replace('{model-slug}', slugify(model))
      .replace('{Make}', encodeURIComponent(String(make || '')))
      .replace('{Model}', encodeURIComponent(String(model || '')));
  }

  /** Rate limit tespiti (tüm providerlar aynı kuralları kullanır) */
  checkRateLimit({ url, html } = {}) {
    return isRateLimited({ url, html });
  }

  /** Rate limit varken bekleme planı */
  waitPlan() {
    return backoffSchedule({});
  }

  /** İnsan benzeri tempo (sn) */
  pacing({ min_s = 20, max_s = 30 } = {}) {
    return humanPacing({ min_s, max_s });
  }
}

// Ortak iddia çıkarımı: TR ikinci el ilan açıklamalarındaki finansal/hasar beyanları.
// Metin UNTRUSTED'dır; yalnızca veri olarak kategorize edilir.
export const CLAIM_PATTERNS = [
  { category: 'tramer', re: /tramer(?:\s+kayd[ıi])?\s*(?:yok|temiz|bulunm(?:az|uyor|mamaktadır))/i },
  { category: 'tramer', re: /tramer(?:\s+kayd[ıi])?\s*(?:var|mevcut)/i },
  { category: 'tramer', re: /hasar\s*kayd[ıi]\s*[:=]?\s*([\d.,]+\s*(?:tl|bin)?)/i },
  { category: 'hasar', re: /hasars[ıi]z|kazas[ıi]z|hiç\s*(?:bir\s*)?(?:hasar|kaza)/i },
  { category: 'boya', re: /boyas[ıi]z|orijinal\s*boya|hiç\s*boya/i },
  { category: 'boya', re: /lokal\s*boya|boyali?\s*(?:parça|kapi|kapı|çamurluk)/i },
  { category: 'degisen', re: /değişen\s*(?:parça|yok|var)/i },
  { category: 'sahiplik', re: /tek\s*elden|ilk\s*sahibinden/i },
  { category: 'aciliyet', re: /acil(?:den)?\s*(?:satl[ıi]k|ihtiyaç(?:tan)?)/i },
  { category: 'bakim', re: /bak[ıi]mlar[ıi]\s*(?:yap[ıi]lm[ıi]ş|tamam|elinde)|servis\s*bak[ıi]m[ıi]|yetkili\s*servis/i },
  { category: 'garanti', re: /garanti(?:si|miz)?\s*(?:devam|var|kapsam)/i },
  { category: 'finansman', re: /(\d{1,3})\s*(?:ay|taksit)|peşin(?:at)?\s*[:=]?\s*[\d.,]+|kredi\s*kart[ıi]/i },
  { category: 'hukuki', re: /rehin|haciz|borcu\s*yok/i },
  { category: 'dil-kalibi', re: /bebekler\s*bebeği|kara\s*şimşek|diksiyonu\s*düzgün|s[ıi]n[ıi]f\s*bir\s*araç|almıcaksan[ıi]z\s*aramay[ıi]n|250\s*km\/s/i },
];

export function extractClaims(descriptionText) {
  const claims = [];
  if (!descriptionText) return claims;
  const seen = new Set();
  for (const p of CLAIM_PATTERNS) {
    const m = String(descriptionText).match(p.re);
    if (m && !seen.has(m[0].toLowerCase())) {
      seen.add(m[0].toLowerCase());
      claims.push({
        claim: m[0],
        category: p.category,
        text: String(descriptionText).slice(Math.max(0, m.index - 40), m.index + m[0].length + 40),
      });
    }
  }
  return claims;
}

// Provider örneklerini tek yerden almak için kayıt defteri (registry pattern)
const INSTANCES = new Map();
export function registerProvider(ProviderClass) {
  const inst = new ProviderClass();
  INSTANCES.set(ProviderClass.id, inst);
  return inst;
}
export function getProvider(id) {
  return INSTANCES.get(id) || null;
}
export function listProviders() {
  return [...INSTANCES.values()];
}
