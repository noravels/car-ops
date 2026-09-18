// snapshot.mjs — watchlist ilanlarının zaman serisi kaydı.
// Dosya canonical: data/snapshots/<id>.jsonl append-only.
// Aynı gün + aynı fiyat + aynı km + aynı durum → satır yazılmaz (gürültü önleme).

import fs from 'node:fs';

export function shouldWrite(existingLines, priceTry, km, status, todayIso) {
  const today = String(todayIso).slice(0, 10);
  for (const line of existingLines) {
    try {
      const row = JSON.parse(line);
      const rowDay = String(row.ts).slice(0, 10);
      if (rowDay === today && row.status === status) {
        if (row.price_try === priceTry && row.km === km) return false;
      }
      // Kapanan ilan zaten kaydedildiyse tekrar yazılmaz
      if (row.status === 'kapandi' && status === 'kapandi') return false;
    } catch {
      // bozuk satır yoksayılır
    }
  }
  return true;
}

export function appendSnapshot(file, tsIso, priceTry, priceUsdEquiv, km, status) {
  const row = { ts: tsIso, price_try: priceTry ?? null, price_usd_equiv: priceUsdEquiv ?? null, km: km ?? null, status };
  const json = JSON.stringify(row);
  if (typeof json !== 'string') return false;
  fs.appendFileSync(file, json + '\n', 'utf8');
  return true;
}

export function readSnapshotFile(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
}
