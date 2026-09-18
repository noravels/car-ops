// seller-signals.mjs — snapshot geçmişinden satıcı davranış sinyalleri.
// JSONL satırı: {ts, price_try, price_usd_equiv, km, status}

export function parseSnapshots(jsonlText) {
  const rows = [];
  for (const line of String(jsonlText || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t);
      if (row && typeof row.ts === 'string') rows.push(row);
    } catch {
      // bozuk satır sessizce atlanır — uydurma yok
    }
  }
  rows.sort((a, b) => a.ts.localeCompare(b.ts));
  return rows;
}

export function detectDrops(snaps) {
  const drops = [];
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const cur = snaps[i];
    if (prev.price_try != null && cur.price_try != null && cur.price_try < prev.price_try) {
      drops.push({
        ts: cur.ts,
        from: prev.price_try,
        to: cur.price_try,
        pct: Math.round(((prev.price_try - cur.price_try) / prev.price_try) * 10000) / 100,
      });
    }
  }
  return drops;
}

// TL düşüşü kur artışının altında kaldıysa gerçek indirim değildir.
// USD verisi yoksa TL düşüşü kabul edilir (temkinli varsayılan).
export function isRealDrop(fromTry, toTry, fromUsd, toUsd) {
  if (fromUsd != null && toUsd != null) return toUsd < fromUsd;
  return toTry < fromTry;
}

// Sil-yeniden-yayın şüphesi: uzun aradan sonra fiyatın sıfırlanması.
export function detectRepost(snaps, gapDays = 30) {
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const cur = snaps[i];
    const gapMs = new Date(cur.ts) - new Date(prev.ts);
    const gap = gapMs / 86400000;
    if (
      gap > gapDays &&
      prev.price_try != null &&
      cur.price_try != null &&
      cur.price_try > prev.price_try
    ) {
      return true;
    }
  }
  return false;
}

export function summarize(snaps, nowIso) {
  const now = nowIso ? new Date(nowIso) : new Date();
  if (!snaps.length) {
    return { count: 0, signal: 'yetersiz-veri', note: 'snapshot verisi yok' };
  }
  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  const drops = detectDrops(snaps);
  const count = snaps.length;
  const firstPrice = first.price_try ?? null;
  const lastPrice = last.price_try ?? null;
  const totalDropPct =
    firstPrice && lastPrice != null && firstPrice > 0
      ? Math.round(((firstPrice - lastPrice) / firstPrice) * 10000) / 100
      : 0;
  const totalDropPctUsd =
    first.price_usd_equiv != null && last.price_usd_equiv != null && first.price_usd_equiv > 0
      ? Math.round(((first.price_usd_equiv - last.price_usd_equiv) / first.price_usd_equiv) * 10000) / 100
      : null;
  const listingAgeDays = Math.floor((now - new Date(first.ts)) / 86400000);
  let signal = 'yetersiz-veri';
  if (count >= 2) {
    if (drops.length >= 2) signal = 'duzenli-indiriyor';
    else if (drops.length === 1) signal = 'tek-dusus';
    else signal = 'sabit';
  }
  return {
    count,
    first_price: firstPrice,
    last_price: lastPrice,
    drops_count: drops.length,
    drops,
    total_drop_pct: totalDropPct,
    total_drop_pct_usd: totalDropPctUsd,
    real_drop:
      firstPrice != null && lastPrice != null
        ? isRealDrop(firstPrice, lastPrice, first.price_usd_equiv, last.price_usd_equiv)
        : null,
    listing_age_days: listingAgeDays,
    repost_suspected: detectRepost(snaps),
    last_status: last.status || 'aktif',
    signal,
  };
}

// Karne markdown'ı (rapor D/E bloklarına giren metin)
export function renderSummary(sum) {
  if (sum.count < 2) {
    return `Snapshot verisi yetersiz (${sum.count} kayıt). İzlemeye alınıp birkaç snapshot sonrası davranış sinyali üretilebilir.`;
  }
  const lines = [];
  lines.push(`- Snapshot: ${sum.count} | İlan yaşı: ~${sum.listing_age_days} gün`);
  if (sum.first_price != null && sum.last_price != null) {
    lines.push(
      `- Fiyat: ${sum.first_price.toLocaleString('tr-TR')} → ${sum.last_price.toLocaleString('tr-TR')} TL ` +
        `(${sum.total_drop_pct >= 0 ? '-' : '+'}${Math.abs(sum.total_drop_pct)}%)`,
    );
  }
  if (sum.total_drop_pct_usd != null) {
    lines.push(`- USD eşdeğeri değişim: ${sum.total_drop_pct_usd}% → gerçek indirim: ${sum.real_drop ? 'evet' : 'hayır (kur etkisi)'}`);
  }
  lines.push(`- Düşüş sayısı: ${sum.drops_count} | Sinyal: ${sum.signal}`);
  if (sum.repost_suspected) {
    lines.push('- DİKKAT: sil-yeniden-yayın şüphesi (uzun aradan sonra fiyat sıfırlaması)');
  }
  if (sum.last_status !== 'aktif') {
    lines.push(`- İlan durumu: ${sum.last_status}`);
  }
  return lines.join('\n');
}
