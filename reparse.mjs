// reparse.mjs — HAM KART taşıyan veri setlerini güncel ayrıştırıcıyla yeniden işler.
//
// Neden: veri setleri toplandığı günkü ayrıştırıcıyla yazıldı. Ayrıştırıcı düzeldiğinde
// (ör. "C3 Aircross" artık "C3" değil) eski dosyalar yanlış alanları taşımaya devam eder.
// Kartın ham metni (`raw_card` / `raw`) saklandığı sürece yeniden işlemek mümkündür —
// yeni ağ trafiği gerekmez, veri uydurulmaz.
//
// Kullanım: node reparse.mjs --data data/market/<dosya>.json [--yaz] [--kuru]

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCardText } from './lib/card-parse.mjs';

/** Bir veri setindeki ham kartlı kayıtları yeniden ayrıştırır. */
export function reparseDataset(payload, { source = null } = {}) {
  const listings = Array.isArray(payload) ? payload : payload.listings || [];
  const changes = [];
  const out = listings.map((l) => {
    const raw = l.raw_card || l.raw;
    if (!raw) return l;
    const parsed = parseCardText(raw, { source: source || l.source || 'bilinmiyor', city: l.city || null });
    if (!parsed) return l;
    const next = { ...l };
    for (const key of ['make', 'model', 'variant', 'fuel', 'gearbox', 'body', 'year', 'km', 'price_try']) {
      const before = l[key];
      const after = parsed[key];
      if (after != null && after !== before) {
        next[key] = after;
        if (['make', 'model', 'variant'].includes(key)) changes.push({ from: `${before}`, to: `${after}`, key, raw_card: String(raw).slice(0, 90) });
      }
    }
    if (parsed.body && parsed.body !== l.body) next.body = parsed.body;
    return next;
  });
  return {
    listings: out,
    changed: changes.length,
    changes: changes.slice(0, 40),
    total: listings.length,
    with_raw: listings.filter((l) => l.raw_card || l.raw).length,
  };
}

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
  const files = String(args.data || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!files.length) {
    console.log('Kullanım: node reparse.mjs --data data/market/a.json[,b.json] [--yaz]');
    return;
  }
  for (const f of files) {
    const payload = JSON.parse(readFileSync(f, 'utf8'));
    const res = reparseDataset(payload);
    console.log(`\n${f}: ${res.with_raw}/${res.total} kayıtta ham kart var · ${res.changed} alan değişti`);
    for (const c of res.changes.slice(0, 8)) console.log(`   ${c.key}: "${c.from}" → "${c.to}"  (${c.raw_card.slice(0, 60)}…)`);
    if (args.yaz) {
      const next = Array.isArray(payload) ? res.listings : { ...payload, listings: res.listings, reparsed_at: new Date().toISOString() };
      writeFileSync(f, `${JSON.stringify(next, null, 1)}\n`);
      console.log('   → dosya güncellendi');
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) runCli();
