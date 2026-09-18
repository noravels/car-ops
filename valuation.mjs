// valuation.mjs — "fiyat iyi mi?" motoru (Bluebook benzeri değerleme).
//
// KURAL: hiçbir sayı uydurulmaz. Baz değer ya gözlemlenen karşılaştırma setinden
// ya da kaynağı belirtilen dış referanstan (Oto360) gelir. Düzeltme katsayıları
// 'kestirim' (kendi verimizden) veya 'varsayım' (etiketli) olmak zorundadır.
//
// KATMANLAR:
//   1) baz değer      → karşılaştırma medyanı + Oto360 bandı (varsa)
//   2) durum düzeltmesi → tramer şiddeti, boyalı/değişen parça, km sapması
//   3) karar          → onaylanan eşiklerle fiyat sapması
//   4) flag'ler       → risk işaretleri (gerekçeli)

// Onaylanan eşikler (2026-09-18, kullanıcı onayı): -%25 şüpheli ucuz, ±%10 piyasa, +%25 pahalı
export const DEFAULT_THRESHOLDS = Object.freeze({
  suspicious_cheap: -0.25,
  below_market: -0.1,
  expensive: 0.1,
  very_expensive: 0.25,
});

// Varsayılan katsayılar. 'varsayım' = temkinli, etiketli; veri biriktikçe
// data/catalog/factors.json üzerinden 'kestirim' katsayılarıyla değiştirilir.
export const ASSUMPTION_FACTORS = Object.freeze({
  // anahtarlar tramer-normalize.mjs classifySeverity() çıktısıyla aynıdır
  severity: {
    'küçük': { pct: -0.02, note: 'küçük tramer (normalize tutar araç değerinin %5 altı)' },
    hafif: { pct: -0.02, note: 'hafif tramer' },
    orta: { pct: -0.06, note: 'orta tramer (normalize tutar araç değerinin %5–30 u)' },
    'ağır': { pct: -0.12, note: 'ağır tramer (normalize tutar araç değerinin %30–70 i) — şasi/karoser riski' },
    agir: { pct: -0.12, note: 'ağır tramer — şasi/karoser riski' },
    pert: { pct: -0.35, note: 'pert eşiği (normalize hasar ≥ araç değerinin %70 i)' },
  },
  painted_each: { pct: -0.015, cap: -0.12, note: 'her boyalı panel (üst sınır %12)' },
  changed_each: { pct: -0.04, cap: -0.2, note: 'her değişen parça (üst sınır %20)' },
  km_per_10k_above: { pct: -0.005, note: 'medyanın üstündeki her 10.000 km' },
  km_per_10k_below: { pct: 0.003, note: 'medyanın altındaki her 10.000 km' },
  km_cap: 0.1,
  source: 'varsayım',
  calibrated: false,
});

// ---------------------------------------------------------------- baz değer

/**
 * Motor kimliği: hacim + teknoloji (ör. "1.6 Multijet" ve "1.6 MJ" aynı aile).
 * Bilinmeyen metinde null döner — tahmin edilmez.
 */
export function engineKey(text) {
  const n = normTr(text).replace(/[^a-z0-9. ]/g, ' ');
  const disp = n.match(/([0-9]\.[0-9])/);
  if (!disp) return null;
  const d = disp[1];
  let tech = null;
  if (/multijet|\bmj\b/.test(n)) tech = 'dizel-multijet';
  else if (/\bt4\b|hibrit|hybrid/.test(n)) tech = 'hibrit';
  else if (/fire/.test(n)) tech = 'benzin-fire';
  else if (/tsi/.test(n)) tech = 'benzin-tsi';
  else if (/hdi/.test(n)) tech = 'dizel-hdi';
  else if (/crdi|vgt/.test(n)) tech = 'dizel-crdi';
  return tech ? `${d}-${tech}` : d;
}

/** Bir listenin motor anahtarı (variant/engine/note alanlarından). */
function listingEngine(l) {
  return engineKey(l.variant || l.engine || l.note || '');
}

/**
 * Motor eşleşmesi. Katı: hacim + teknoloji aynı ("1.6 MJ" ↔ "1.6 Multijet").
 * Gevşek: biri teknoloji belirtmiyorsa yalnızca hacim karşılaştırılır
 * ("1.4 Urban" ↔ "1.4 Fire") — dizel/benzin ayrımı yine korunur.
 */
/** Yakıt sınıfı: dizel ↔ benzin karşılaştırması geçersizdir (fiyat %25+ ayrışır). */
export function fuelClass(key) {
  if (!key) return null;
  const k = String(key);
  if (/-dizel-/.test(k) || /multijet|hdi|crdi/.test(k)) return 'dizel';
  if (/-benzin-|-hibrit/.test(k) || /fire|tsi/.test(k)) return 'benzin';
  return null;
}

export function engineMatches(a, b) {
  if (!a || !b) return false;
  const [da, ta] = String(a).split('-');
  const [db, tb] = String(b).split('-');
  if (da !== db) return false;
  if (ta && tb) return ta === tb;
  return true;
}

/** Karşılaştırma setinden baz değer. Yıl ±1, km ±%35, motor ailesi eşleşmesi uygulanır. */
export function baselineFromComparables(listings = [], criteria = {}) {
  const rows = (listings || []).filter((l) => l && Number.isFinite(l.price_try));
  if (!rows.length) return null;

  const year = criteria.year ?? null;
  const km = criteria.km ?? null;
  let pool = rows;
  if (year != null) pool = pool.filter((l) => l.year == null || Math.abs(l.year - year) <= 1);
  // km bandı yalnızca çağıran km verdiyse ve örneklemi EZMEDEN uygulanabilirse
  if (km != null) {
    const banded = pool.filter((l) => l.km == null || Math.abs(l.km - km) / km <= 0.35);
    if (banded.length >= 3) pool = banded;
  }
  // MOTOR AİLESİ: aynı modelin dizel/benzin sürümleri fiyatta %25+ ayrışır —
  // karışık bant yanlış "ucuz/pahalı" kararı üretir. Yeterli örnek varsa daralt.
  let engine_filtered = false;
  let engine_loose = false;
  const wantEngine = criteria.engine ? engineKey(criteria.engine) : null;
  if (wantEngine) {
    let matched = pool.filter((l) => engineMatches(listingEngine(l), wantEngine));
    // katı/gevşek eşleşme yetmezse: ÇELİŞEN yakıt sınıfını (dizel↔benzin) dışla
    if (matched.length < 2) {
      const wantFuel = fuelClass(wantEngine);
      if (wantFuel) {
        matched = pool.filter((l) => {
          const fc = fuelClass(listingEngine(l));
          return fc == null || fc === wantFuel;
        });
      }
    }
    if (matched.length >= 2) {
      pool = matched;
      engine_filtered = true;
      engine_loose = matched.some((l) => {
        const k = listingEngine(l);
        return !k || !String(k).includes('-') || String(k).split('-')[1] !== String(wantEngine).split('-')[1];
      });
    }
  }
  if (!pool.length) pool = rows;

  const prices = pool.map((l) => l.price_try).sort((a, b) => a - b);
  const kms = pool.map((l) => l.km).filter(Number.isFinite).sort((a, b) => a - b);
  const years = pool.map((l) => l.year).filter(Number.isFinite).sort((a, b) => a - b);
  const med = median(prices);
  const q25 = quantile(prices, 0.25);
  const q75 = quantile(prices, 0.75);
  return {
    sample_size: pool.length,
    iqr_ratio: med ? round3((q75 - q25) / med) : null,
    median: med,
    p25: quantile(prices, 0.25),
    p75: quantile(prices, 0.75),
    min: prices[0],
    max: prices[prices.length - 1],
    km_median: median(kms),
    year_median: median(years),
    engine_filtered,
    engine_loose,
    engine_mixed: !engine_filtered && new Set(pool.map(listingEngine).filter(Boolean)).size > 1,
    members: pool.length,
  };
}

/** Oto360 5 bantlı çıktısını okur. Bant yoksa null (uydurma yok). */
export function parseOto360Bands(text) {
  if (!text || typeof text !== 'string') return null;
  const flat = text.replace(/\s+/g, ' ');
  const labels = {
    low: ['Düşük Fiyat'],
    below_avg: ['Ortalama Altı'],
    market: ['Piyasa Ortalaması'],
    above_avg: ['Ortalama Üstü'],
    high: ['Yüksek Fiyat'],
  };
  const out = {};
  for (const [key, names] of Object.entries(labels)) {
    for (const name of names) {
      const re = new RegExp(`${name}\\s*([0-9][0-9.,]*)\\s*-\\s*([0-9][0-9.,]*)\\s*TL`, 'i');
      const m = flat.match(re);
      if (m) {
        const a = trNumber(m[1]);
        const b = trNumber(m[2]);
        if (a != null && b != null) out[key] = a <= b ? [a, b] : [b, a];
        break;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

/** İki baz kaynağı birleştirir; ayrışma varsa işaretler. */
export function combineBaselines({ oto360 = null, comparables = null } = {}) {
  const notes = [];
  let reference = null;
  let source = null;
  const market = oto360 && oto360.market;
  if (Array.isArray(market) && market.length === 2) {
    reference = Math.round((market[0] + market[1]) / 2);
    source = 'oto360 (sahibinden ilan verisi, son 30 gün — istatistiksel model)';
  } else {
    notes.push('Oto360 baz servisi verisi yok: fiyat yalnızca kendi karşılaştırma setimize dayanıyor.');
  }

  const own = comparables ? comparables.median : null;
  let agreement_pct = null;
  let divergent = false;
  if (reference != null && own != null && own > 0) {
    agreement_pct = Math.round((Math.abs(reference - own) / reference) * 1000) / 10;
    divergent = agreement_pct > 15;
    if (divergent) {
      notes.push(
        `İki kaynak %${agreement_pct} ayrışıyor (Oto360 ${fmt(reference)} TL, kendi setimiz ${fmt(own)} TL): örneklem veya donanım farkı olabilir.`,
      );
    }
  } else if (own != null && reference == null) {
    notes.push('Tek kaynak: kendi karşılaştırma setimiz (güven sınırlı).');
  }
  if (comparables && comparables.sample_size != null && comparables.sample_size < 5) {
    notes.push(`Karşılaştırma örneklemi küçük (n=${comparables.sample_size}).`);
  }

  return { reference_try: reference, own_median_try: own, source, agreement_pct, divergent, notes, oto360, comparables };
}

// ------------------------------------------------------- durum düzeltmesi

export function kmAdjustment({ km, km_median }, factors = ASSUMPTION_FACTORS) {
  if (!Number.isFinite(km) || !Number.isFinite(km_median) || km_median <= 0) return 0;
  const units = (km - km_median) / 10000;
  const raw = units >= 0 ? units * factors.km_per_10k_above.pct : -units * factors.km_per_10k_below.pct;
  const cap = factors.km_cap ?? 0.1;
  return clamp(round3(raw), -cap, cap);
}

/** Durum düzeltmelerini satır satır üretir (her satır kaynaklı). */
export function conditionAdjustments(condition = {}, factors = ASSUMPTION_FACTORS) {
  const out = [];
  const sev = condition.severity || null;
  if (sev && factors.severity[sev]) {
    out.push({
      name: `tramer:${sev}`,
      pct: factors.severity[sev].pct,
      source: factors.source,
      note: factors.severity[sev].note,
      detail: condition.tramer_ref_try != null ? `normalize tramer ${fmt(condition.tramer_ref_try)} TL` : null,
    });
  }
  const painted = Number(condition.painted_parts) || 0;
  if (painted > 0) {
    const cap = factors.painted_each.cap ?? -0.12;
    out.push({
      name: `boyali:${painted}`,
      pct: Math.max(painted * factors.painted_each.pct, cap),
      source: factors.source,
      note: factors.painted_each.note,
    });
  }
  const changed = Number(condition.changed_parts) || 0;
  if (changed > 0) {
    const cap = factors.changed_each.cap ?? -0.2;
    out.push({
      name: `degisen:${changed}`,
      pct: Math.max(changed * factors.changed_each.pct, cap),
      source: factors.source,
      note: factors.changed_each.note,
    });
  }
  if (condition.km != null && condition.km_median != null) {
    const pct = kmAdjustment({ km: condition.km, km_median: condition.km_median }, factors);
    if (pct !== 0) {
      out.push({
        name: 'km',
        pct,
        source: factors.source,
        note: pct < 0 ? factors.km_per_10k_above.note : factors.km_per_10k_below.note,
        detail: `${fmt(condition.km)} km (set medyanı ${fmt(condition.km_median)} km)`,
      });
    }
  }
  // Ekspertiz yokluğu değeri DÜŞÜRMEZ — yalnızca belirsizliği artırır.
  if (condition.expertise && condition.expertise !== 'var') {
    out.push({
      name: 'ekspertiz:yok',
      pct: 0,
      source: 'kural',
      uncertainty_only: true,
      note: 'Bağımsız ekspertiz raporu yok: değer düşürülmez, belirsizlik artar ve fiyat pazarlık payı doğrulanamaz.',
    });
  }
  return out;
}

export function adjustedValue(baselineTry, adjustments = []) {
  if (!Number.isFinite(baselineTry)) return { adjusted_try: null, total_pct: 0 };
  const total = adjustments.reduce((s, a) => s + (Number(a.pct) || 0), 0);
  const capped = clamp(round3(total), -0.45, 0.25);
  return { adjusted_try: Math.round(baselineTry * (1 + capped)), total_pct: capped };
}

// ------------------------------------------------------------ karar & flag

export function dealVerdict({ asking, fair, thresholds = DEFAULT_THRESHOLDS, low_confidence = false }) {
  if (!Number.isFinite(asking) || !Number.isFinite(fair) || fair <= 0) {
    return { deviation_pct: null, band: 'unknown', label: 'Hesaplanamadı', symbol: '❔' };
  }
  const dev = round3((asking - fair) / fair);
  const devPct = Math.round(dev * 1000) / 10;
  let band;
  if (dev <= thresholds.suspicious_cheap) band = 'suspicious_cheap';
  else if (dev <= thresholds.below_market) band = 'below_market';
  else if (dev <= thresholds.expensive) band = 'at_market';
  else if (dev <= thresholds.very_expensive) band = 'expensive';
  else band = 'very_expensive';
  // örneklem küçük / dağılım çok genişse "şüpheli ucuz" veya "belirgin pahalı"
  // gibi keskin iddialar veri yetersizliği olarak işaretlenir
  if (low_confidence && (band === 'suspicious_cheap' || band === 'very_expensive')) {
    return {
      deviation_pct: devPct,
      band: 'inconclusive',
      label: 'Veri yetersiz — kesin karar yok',
      symbol: '❔',
      inconclusive_reason: 'Örneklem küçük veya dağılım çok geniş: bu sapma tek başına alım kararı için yeterli kanıt değil.',
    };
  }
  const meta = {
    suspicious_cheap: { label: 'Şüpheli ucuz', symbol: '🔴' },
    below_market: { label: 'Piyasa altı', symbol: '🟡' },
    at_market: { label: 'Piyasa değerinde', symbol: '⚪' },
    expensive: { label: 'Pahalı', symbol: '🟡' },
    very_expensive: { label: 'Belirgin pahalı', symbol: '🔴' },
    unknown: { label: 'Hesaplanamadı', symbol: '❔' },
  }[band];
  return { deviation_pct: devPct, band, label: meta.label, symbol: meta.symbol };
}

/** Risk işaretleri — her biri gerekçesiyle. */
export function valuationFlags({
  asking,
  fair,
  condition = {},
  km,
  km_median,
  baseline = {},
  description = '',
  thresholds = DEFAULT_THRESHOLDS,
} = {}) {
  const flags = [];
  const dev = Number.isFinite(asking) && Number.isFinite(fair) && fair > 0 ? (asking - fair) / fair : null;

  if (dev != null) {
    if (dev <= thresholds.suspicious_cheap) {
      flags.push({
        code: 'suspicious_cheap',
        severity: 'red',
        message: `Fiyat adil değerin %${Math.abs(Math.round(dev * 1000) / 10)} altında: pert/şasi kaydı, kaporo tuzağı veya ilanda yazılmayan hasar olasılığı. Bağımsız ekspertiz + şasi/pert sorgusu olmadan ilerlemeyin.`,
      });
    } else if (dev <= thresholds.below_market) {
      flags.push({
        code: 'below_market',
        severity: 'yellow',
        message: `Adil değerin %${Math.abs(Math.round(dev * 1000) / 10)} altında: doğrulanırsa iyi fırsat; tramer/boya beyanı ve ekspertiz şart.`,
      });
    } else if (dev > thresholds.very_expensive) {
      flags.push({
        code: 'very_expensive',
        severity: 'red',
        message: `Adil değerin %${Math.round(dev * 1000) / 10} üzerinde: bu fark ancak çok düşük km + tam donanım + kusursuz geçmişle açıklanabilir.`,
      });
    } else if (dev > thresholds.expensive) {
      flags.push({
        code: 'expensive',
        severity: 'yellow',
        message: `Adil değerin %${Math.round(dev * 1000) / 10} üzerinde: gerekçe isteyin (donanım, km, bakım geçmişi).`,
      });
    }
  }

  const sev = condition.severity;
  if (sev === 'pert') {
    flags.push({
      code: 'pert_record',
      severity: 'red',
      message: 'Normalize hasar tutarı araç değerinin %70+ i: sigorta pert kaydı düzeyinde hasar. Bu araç için fiyat tartışması değil, "alınmaz" kararı konuşulur.',
    });
  }
  if ((sev === 'ağır' || sev === 'agir' || sev === 'orta') && dev != null && dev >= 0) {
    flags.push({
      code: 'tramer_not_priced',
      severity: 'red',
      message: `Tramer kaydı (${sev}) fiyata yansımamış: araç hasarsız muamelesi görüyor. Onarılmış hasarın ikinci el değer kaybı pazarlık konusu olmalı.`,
    });
  }

  const exp = condition.expertise;
  if ((exp === 'yok' || exp === 'belirsiz') && dev != null && dev < thresholds.below_market) {
    flags.push({
      code: 'no_expertise_cheap',
      severity: 'red',
      message: 'Piyasa altı fiyat + bağımsız ekspertiz yok: ucuzluğun nedeni kanıtlanmamış. Ekspertiz raporu alınmadan ödeme yapılmamalı.',
    });
  }

  if (Number.isFinite(km) && Number.isFinite(km_median) && km_median > 0) {
    const rel = Math.abs(km - km_median) / km_median;
    if (rel > 0.3) {
      flags.push({
        code: 'km_outlier',
        severity: 'yellow',
        message: `Kilometre set medyanından %${Math.round(rel * 100)} sapıyor (${fmt(km)} km / medyan ${fmt(km_median)} km): fiyat etkisi ayrıca hesaplandı, km doğrulaması (servis kaydı) isteyin.`,
      });
    }
  }

  // Türkçe büyük harf tuzağı: I/İ ve ı ayrı kod noktaları, önce normalize et
  const cleanClaim = /hatasiz|boyasiz|degisensiz|orjinal|orijinal/.test(normTr(description));
  const hasDamage = (Number(condition.painted_parts) || 0) > 0 || (Number(condition.changed_parts) || 0) > 0;
  if (cleanClaim && hasDamage) {
    flags.push({
      code: 'claim_conflict',
      severity: 'red',
      message: `İlan metni "${cleanClaimText(description)}" diyor ama kayıtta ${Number(condition.changed_parts) || 0} değişen / ${Number(condition.painted_parts) || 0} boyalı parça var: beyan ile kayıt çelişiyor.`,
    });
  }

  if (baseline.iqr_ratio != null && baseline.iqr_ratio > 0.25) {
    flags.push({
      code: 'wide_spread',
      severity: 'yellow',
      message: `Karşılaştırma setinin dağılımı çok geniş (çeyrekler arası fark medyanın %${Math.round(baseline.iqr_ratio * 100)}'i): aynı yıl/km bandında fiyatlar birbirinden çok farklı, sapma yorumu temkinli yapılmalı.`,
    });
  }
  if (baseline.engine_loose) {
    flags.push({
      code: 'engine_partial_match',
      severity: 'info',
      message:
        'Bazı karşılaştırma ilanlarında motor teknolojisi yazılı değil: eşleşme hacim üzerinden yapıldı (ör. "1.4 Urban" ↔ "1.4 Fire"). Aynı motor sürümüyle doğrulama önerilir.',
    });
  }
  if (baseline.engine_mixed) {
    flags.push({
      code: 'engine_mixed_band',
      severity: 'yellow',
      message:
        'Karşılaştırma bandında farklı motor sürümleri karışık (ör. 1.4 benzin + 1.6 dizel): bu sürümlerin fiyatı belirgin ayrışır, sapma yorumu temkinli yapılmalı ve aynı motorlu ilanlarla doğrulanmalı.',
    });
  }
  if (baseline.divergent) {
    flags.push({
      code: 'source_divergence',
      severity: 'yellow',
      message: `Değerleme kaynakları ayrışıyor (%${baseline.agreement_pct}): fiyat kararı tek kaynağa dayandırılmamalı.`,
    });
  }
  if (baseline.sample_size != null && baseline.sample_size < 5) {
    flags.push({
      code: 'low_sample',
      severity: 'info',
      message: `Karşılaştırma örneklemi küçük (n=${baseline.sample_size}): aralık genişletildi, karar öncesi daha fazla ilan toplanmalı.`,
    });
  }
  return flags;
}

export function confidence({ sample_size = 0, has_reference = false, divergent = false, expertise_missing = false } = {}) {
  let score = sample_size >= 15 ? 0.85 : sample_size >= 5 ? 0.65 : sample_size >= 2 ? 0.4 : 0.2;
  const reasons = [];
  if (has_reference) {
    score += 0.15;
    reasons.push('Oto360 referans bandı mevcut');
  } else reasons.push('Oto360 referansı yok — yalnızca kendi karşılaştırma seti');
  if (divergent) {
    score -= 0.25;
    reasons.push('iki kaynak %15+ ayrışıyor');
  }
  if (expertise_missing) {
    score -= 0.15;
    reasons.push('bağımsız ekspertiz raporu yok (hasar gizli olabilir)');
  }
  reasons.push(`karşılaştırma örneklemi n=${sample_size}`);
  score = clamp(round3(score), 0, 1);
  const level = score >= 0.8 ? 'yüksek' : score >= 0.5 ? 'orta' : 'düşük';
  return { score, level, reasons };
}

// --------------------------------------------------------------- uçtan uca

export function valueListing({
  listing = {},
  comparables = [],
  condition = {},
  oto360 = null,
  factors = ASSUMPTION_FACTORS,
  thresholds = DEFAULT_THRESHOLDS,
  vehicle_value_try = null,
} = {}) {
  // kendi kendine referans olmasın: değerlenen ilan karşılaştırma setinden çıkarılır
  const pool = excludeSelf(comparables, listing);
  const cmp = baselineFromComparables(pool, {
    year: listing.year,
    km: listing.km,
    engine: listing.variant || listing.engine || null,
  });
  const bases = combineBaselines({ oto360, comparables: cmp });
  const baseValue = bases.reference_try ?? bases.own_median_try ?? null;

  const cond = {
    severity: condition.severity ?? null,
    painted_parts: condition.painted_parts ?? 0,
    changed_parts: condition.changed_parts ?? 0,
    expertise: condition.expertise ?? null,
    km: listing.km ?? null,
    km_median: cmp ? cmp.km_median : null,
    tramer_ref_try: condition.tramer_ref_try ?? null,
  };
  const adjustments = conditionAdjustments(cond, factors);

  if (baseValue == null) {
    const conf = confidence({ sample_size: 0, has_reference: false });
    const out = {
      fair_value_try: null,
      range_try: null,
      baseline: bases,
      adjustments,
      verdict: dealVerdict({ asking: listing.price_try, fair: null, thresholds }),
      flags: [],
      confidence: conf,
      notes: ['Karşılaştırma verisi yok: adil değer hesaplanamadı. Uydurma değer üretilmez — önce aynı model/yıl bandında ilan toplayın.'],
      listing,
      asking_try: listing.price_try ?? null,
    };
    out.flags = [
      { code: 'no_data', severity: 'yellow', message: out.notes[0] },
      ...valuationFlags({ asking: listing.price_try, fair: null, condition: cond, km: cond.km, km_median: null, baseline: bases, description: listing.description || '' }),
    ];
    return out;
  }

  const adj = adjustedValue(baseValue, adjustments);
  const conf = confidence({
    sample_size: cmp ? cmp.sample_size : bases.oto360 ? 0 : 0,
    has_reference: bases.reference_try != null,
    divergent: bases.divergent,
    expertise_missing: cond.expertise === 'yok' || cond.expertise === 'belirsiz',
  });
  const width = conf.level === 'yüksek' ? 0.05 : conf.level === 'orta' ? 0.08 : 0.12;
  const fair = adj.adjusted_try;
  const flags = valuationFlags({
    asking: listing.price_try,
    fair,
    condition: cond,
    km: cond.km,
    km_median: cond.km_median,
    baseline: bases,
    description: listing.description || '',
    thresholds,
  });
  return {
    fair_value_try: fair,
    range_try: [Math.round(fair * (1 - width)), Math.round(fair * (1 + width))],
    raw_baseline_try: baseValue,
    baseline: bases,
    adjustments,
    baseline_sample_size: cmp ? cmp.sample_size : 0,
    verdict: dealVerdict({ asking: listing.price_try, fair, thresholds, low_confidence: isWeakData(cmp) }),
    flags,
    confidence: conf,
    notes: bases.notes,
    listing,
    asking_try: listing.price_try ?? null,
    vehicle_value_try: vehicle_value_try ?? null,
    generated_at: new Date().toISOString(),
  };
}

export function renderValuation(v) {
  const L = [];
  L.push('### Fiyat Değerlemesi (Bluebook)');
  if (v.fair_value_try == null) {
    L.push('');
    L.push('**Adil değer: hesaplanamadı** — yeterli karşılaştırma verisi yok, uydurma değer üretilmedi.');
    (v.notes || []).forEach((n) => L.push(`- ${n}`));
    return L.join('\n');
  }
  L.push('');
  L.push(`- **İstenen fiyat:** ${fmt(v.asking_try)} TL`);
  L.push(`- **Adil değer (düzeltilmiş):** ${fmt(v.fair_value_try)} TL`);
  L.push(`- **Beklenen bant:** ${fmt(v.range_try[0])} – ${fmt(v.range_try[1])} TL`);
  L.push(`- **Karar:** ${v.verdict.symbol} **${v.verdict.label}** (sapma ${v.verdict.deviation_pct > 0 ? '+' : ''}%${v.verdict.deviation_pct})`);
  L.push(`- **Güven:** ${v.confidence.level} (${v.confidence.reasons.join('; ')})`);
  L.push('');
  L.push('#### Neden bu değer');
  L.push('');
  L.push('| Etken | Etki | Kaynak | Açıklama |');
  L.push('|---|---|---|---|');
  L.push(`| baz değer | — | ${v.baseline.source || 'kendi karşılaştırma seti'} | ${fmt(v.raw_baseline_try)} TL${v.baseline.own_median_try && v.baseline.reference_try ? ` (kendi setimiz: ${fmt(v.baseline.own_median_try)} TL, ayrışma %${v.baseline.agreement_pct})` : ''} |`);
  (v.adjustments || []).forEach((a) => {
    L.push(`| ${a.name} | ${a.pct === 0 ? 'değer etkisi yok' : `${a.pct > 0 ? '+' : ''}${(a.pct * 100).toFixed(1)}%`} | ${a.source}${a.source !== 'kural' && a.source !== 'varsayım' && a.source !== 'kestirim' ? '' : ''} | ${a.detail ? `${a.detail} — ` : ''}${a.note} |`);
  });
  L.push('');
  if (v.flags.length) {
    L.push('#### Saptanan riskler');
    L.push('');
    v.flags.forEach((f) => {
      const icon = f.severity === 'red' ? '🔴' : f.severity === 'yellow' ? '🟡' : 'ℹ️';
      L.push(`- ${icon} **${f.code}** — ${f.message}`);
    });
    L.push('');
  }
  if (v.notes && v.notes.length) {
    L.push('#### Veri notları');
    L.push('');
    v.notes.forEach((n) => L.push(`- ${n}`));
    L.push('');
  }
  L.push('#### Kaynak');
  L.push('');
  const engInfo = v.baseline.comparables
    ? v.baseline.comparables.engine_filtered
      ? ', aynı motor ailesi'
      : v.baseline.comparables.engine_mixed
        ? ', MOTOR KARIŞIK (temkinli yorum)'
        : ''
    : '';
  L.push(`- Karşılaştırma seti: ${v.baseline_sample_size} ilan (yıl ±1, km ±%35${engInfo}) — medyan ${fmt(v.baseline.own_median_try)} TL`);
  if (v.baseline.reference_try != null) L.push('- Oto360 Araç Değerleme (sahibinden.com, son 30 gün ilan verisiyle istatistiksel model) — boya/hasar gözetmez, bu yüzden durum düzeltmesi bizim katmanımızda yapılır.');
  L.push(`- Katsayı kaynağı: ${ASSUMPTION_FACTORS.calibrated ? 'kendi verimizden kestirim' : 'temkinli varsayım (veri biriktikçe kalibre edilecek)'}`);
  L.push('- Bu rapor yatırım/alım tavsiyesi değildir: karar insana aittir, ödeme öncesi bağımsız ekspertiz şarttır.');
  return L.join('\n');
}

// ------------------------------------------------------------------ yardımcı

/** Veri zayıf mı: örneklem < 5 veya dağılım çok geniş (IQR/medyan > %25). */
export function isWeakData(cmp) {
  if (!cmp) return true;
  if ((cmp.sample_size || 0) < 5) return true;
  return cmp.iqr_ratio != null && cmp.iqr_ratio > 0.25;
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}
function round3(x) {
  const r = Math.round(x * 1000) / 1000;
  return r === 0 ? 0 : r;
}
function median(arr) {
  if (!arr || !arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}
function trNumber(s) {
  const cleaned = String(s).replace(/\./g, '').replace(/,(\d{1,2})$/, '.$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
function fmt(n) {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('tr-TR');
}
/** Değerlenen ilanın kendisini karşılaştırma setinden çıkarır (aynı yıl+km+fiyat = aynı ilan). */
export function excludeSelf(comparables = [], listing = {}) {
  if (!listing || listing.price_try == null) return comparables || [];
  return (comparables || []).filter(
    (l) => !(l && l.year === listing.year && l.km === listing.km && l.price_try === listing.price_try),
  );
}

function normTr(t) {
  return String(t || '')
    .replace(/[İI]/g, 'i')
    .replace(/[ıi]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .toLowerCase();
}
function cleanClaimText(desc) {
  const n = normTr(desc);
  const m = n.match(/hatasiz[^.,;]*|boyasiz[^.,;]*|degisensiz[^.,;]*/);
  return m ? m[0].trim() : 'temiz beyanı';
}
