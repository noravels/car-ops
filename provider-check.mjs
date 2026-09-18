#!/usr/bin/env node
// provider-check.mjs — provider ENTEGRASYON kontrolü.
//
// İki mod:
//   1) Çevrimdışı (varsayılan): tarif defterini doğrular, capability matrisini yazar,
//      kayıtlı fixture'larla ayrıştırmayı test eder. Ağ/browser gerekmez → her commit öncesi.
//   2) --live: kullanıcının Chrome debug oturumuna (lib/cdp.mjs) bağlanıp her sağlayıcının
//      ilan sayfasını açar, kartları çeker ve ayrıştırır. Bot duvarı aşılmaz, insan temposu.
//
// Kullanım:
//   node provider-check.mjs                        # çevrimdışı kontrol
//   node provider-check.mjs --live                 # CDP üzerinden canlı kontrol (verified olanlar)
//   node provider-check.mjs --live --idler renewturkiye,otoplus
//   node provider-check.mjs --live --json data/provider-checks/2026-09-18.json
//   node provider-check.mjs --from-dump data/provider-dumps/2026-09-18.json
//
// --live doğrudan Chrome DevTools HTTP ucunu arar. Bu makinede 9222 hem Chrome'a ait
// hem de HTTP /json uçları 404 döndüğü için (bkz. docs/VERI-TOPLAMA.md §13), aynı kontrol
// --from-dump ile agent'ın gerçek Chrome oturumundan alınan DOM dökümü üzerinden yapılır.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadRegistry, validateRegistry } from './providers/generic.mjs';
import { loadGenericProviders } from './providers/generic.mjs';
import { cdpAvailable, connectWs, openPage, cardExtractionScript, tableExtractionScript, pageStateScript } from './lib/cdp.mjs';

const args = parseArgs(process.argv.slice(2));
const registry = loadRegistry();
const providers = loadGenericProviders();

// ---------- 1) tarif defteri doğrulaması ----------
const check = validateRegistry(registry);
console.log('# Provider entegrasyon kontrolü (çevrimdışı)\n');
if (!check.ok) {
  console.error('❌ Tarif defteri hatalı:');
  check.errors.forEach((e) => console.error('   -', e));
  process.exitCode = 1;
} else {
  console.log('✅ Tarif defteri geçerli\n');
}

// ---------- 2) capability matrisi ----------
console.log('| provider | çıkarım | durum | şehir | pace | not |');
console.log('|---|---|---|---|---|---|');
for (const p of providers) {
  const geo = p.geo && p.geo.verified ? p.geo.mode : '—';
  const note = (p.notes || '').replace(/\|/g, '/').slice(0, 70);
  console.log(`| ${p.id} | ${p.extraction} | ${p.verificationState} | ${geo} | ${p.pacingSeconds}s | ${note} |`);
}
const byState = providers.reduce((a, p) => ((a[p.verificationState] = (a[p.verificationState] || 0) + 1), a), {});
console.log(`\nverified: ${byState.verified || 0} · pending: ${byState.pending || 0} · blocked: ${byState.blocked || 0}\n`);

// ---------- 3) fixture ile ayrıştırma kontrolü ----------
const fixturePath = 'tests/fixtures/provider-cards.json';
if (existsSync(fixturePath)) {
  const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));
  console.log('## Fixture ayrıştırma (kayıtlı gerçek kartlar)\n');
  for (const [id, cards] of Object.entries(fixtures)) {
    const p = providers.find((x) => x.id === id);
    if (!p) {
      console.log(`- ${id}: ⚠️ kayıt defterinde yok`);
      continue;
    }
    if (p.extraction !== 'text-pattern') {
      console.log(`- ${id}: atlandı (extraction=${p.extraction})`);
      continue;
    }
    const rows = p.parseCards(cards);
    const ratio = cards.length ? rows.length / cards.length : 0;
    const ok = ratio >= 0.8;
    console.log(`- ${id}: ${rows.length}/${cards.length} kart ayrıştı (%${Math.round(ratio * 100)}) ${ok ? '✅' : '❌'}`);
    if (!ok) {
      process.exitCode = 1;
      const failed = cards.filter((c) => !p.parseCards([c]).length);
      failed.slice(0, 3).forEach((f) => console.log(`    ayrışmayan: ${String(f).slice(0, 110)}`));
    }
  }
} else {
  console.log(`ℹ️ fixture dosyası yok: ${fixturePath}`);
}

// ---------- 3b) dump üzerinden entegrasyon kontrolü ----------
if (args['from-dump']) {
  const dumpPath = String(args['from-dump']);
  if (!existsSync(dumpPath)) {
    console.error(`❌ dump yok: ${dumpPath}`);
    process.exitCode = 2;
  } else {
    const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
    console.log(`\n## Entegrasyon kontrolü — DOM dökümü (${dumpPath})\n`);
    console.log(`döküm alındı: ${dump.captured_at || '?'} · tarayıcı: ${dump.browser || '?'}\n`);
    console.log('| provider | mod | kart/satır | ayrışan | durum |');
    console.log('|---|---|---|---|---|');
    const results = [];
    let failed = 0;
    for (const [id, d] of Object.entries(dump.providers || {})) {
      const p = providers.find((x) => x.id === id);
      const rec = { id, url: d.url, title: d.title, body_length: d.body_length, status: 'unknown' };
      if (!p) {
        rec.status = 'unknown-provider';
        failed++;
      } else {
        try {
          const rows = p.extraction === 'text-pattern'
            ? p.parseCards(d.cards || [])
            : p.extraction === 'table'
              ? p.parseTable(d.table || [])
              : [];
          const inputCount = p.extraction === 'table' ? (d.table || []).length : (d.cards || []).length;
          rec.parsed = rows.length;
          rec.input = inputCount;
          const ratio = inputCount ? rows.length / inputCount : 0;
          rec.status = rows.length >= 3 && ratio >= 0.6 ? 'ok' : inputCount === 0 ? 'empty' : 'low-parse';
          rec.sample = rows[0] ? `${rows[0].make} ${rows[0].model} ${rows[0].year ?? ''} ${rows[0].price_try ?? ''}` : null;
          if (rec.status !== 'ok') failed++;
        } catch (err) {
          rec.status = 'error';
          rec.error = String(err?.message || err).slice(0, 120);
          failed++;
        }
      }
      results.push(rec);
      const icon = rec.status === 'ok' ? '✅' : rec.status === 'empty' ? '⚠️' : '❌';
      console.log(`| ${id} | ${p ? p.extraction : '—'} | ${rec.input ?? 0} | ${rec.parsed ?? 0} | ${icon} ${rec.status} |`);
    }
    const out = args.json || `data/provider-checks/${new Date().toISOString().slice(0, 10)}-dump.json`;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify({ checked_at: new Date().toISOString(), source: dumpPath, results }, null, 2)}\n`);
    console.log(`\nrapor: ${out}`);
    if (failed) process.exitCode = 1;
  }
}

// ---------- 4) canlı kontrol (CDP) ----------
if (args.live) {
  const wanted = args.idler ? String(args.idler).split(',').map((s) => s.trim()) : null;
  const targets = providers.filter(
    (p) => (!wanted || wanted.includes(p.id)) && (p.extraction === 'text-pattern' || p.extraction === 'table') && p.listingUrl,
  );
  const avail = await cdpAvailable();
  if (!avail.ok) {
    console.error(`\n❌ Chrome debug oturumuna bağlanılamadı: ${avail.error}`);
    console.error('   Chrome\'u şu şekilde başlatın: open -na "Google Chrome" --args --remote-debugging-port=9222');
    console.error('   Not: Chrome HTTP /json uçlarını reddediyorsa bu araç /devtools/browser WebSocket yolunu dener.');
    console.error('   Alternatif: node provider-check.mjs --from-dump data/provider-dumps/<tarih>.json');
    process.exitCode = 2;
  } else {
    console.log(`\n## Canlı kontrol (CDP: ${avail.transport} · ${avail.browser})\n`);
    const client = await connectWs(avail.wsUrl);
    const results = [];
    try {
      for (const p of targets) {
        const started = Date.now();
        const rec = { id: p.id, url: p.listingUrl, cards: 0, rows: 0, status: 'unknown', ms: 0 };
        let targetId = null;
        try {
          const waitMs = p.liveWaitMs || Math.max(6000, p.pacingSeconds * 1000);
          const page = await openPage(client, p.listingUrl, { waitMs });
          targetId = page.targetId;
          const state = await client.evaluate(page.sessionId, pageStateScript());
          let rows = [];
          let inputCount = 0;
          if (p.extraction === 'table') {
            const table = (await client.evaluate(page.sessionId, tableExtractionScript())) || [];
            inputCount = table.length;
            rows = p.parseTable(table);
          } else {
            const cards = (await client.evaluate(page.sessionId, cardExtractionScript())) || [];
            inputCount = cards.length;
            rows = p.parseCards(cards);
          }
          rec.cards = inputCount;
          rec.rows = rows.length;
          rec.title = state?.title;
          rec.bodyLength = state?.bodyLength;
          rec.status = rows.length >= 3 ? 'ok' : inputCount === 0 ? 'empty' : 'parse-low';
          if (rec.status === 'empty') {
            rec.hint = `gövde ${state?.bodyLength} karakter — liste JS/API ile geliyor olabilir: ${String(state?.bodySample || '').slice(0, 120)}`;
          }
          if (rows[0]) rec.sample = `${rows[0].make} ${rows[0].model} ${rows[0].year ?? ''} ${rows[0].price_try ?? ''}`;
        } catch (err) {
          rec.status = 'error';
          rec.error = String(err?.message || err).slice(0, 160);
        } finally {
          if (targetId) {
            try {
              await client.send('Target.closeTarget', { targetId });
            } catch {
              /* yok say */
            }
          }
        }
        rec.ms = Date.now() - started;
        results.push(rec);
        const icon = rec.status === 'ok' ? '✅' : rec.status === 'empty' ? '⚠️' : '❌';
        console.log(`${icon} ${p.id.padEnd(13)} kart ${String(rec.cards).padStart(3)} → satır ${String(rec.rows).padStart(3)} (${rec.ms} ms) ${rec.hint || rec.error || rec.sample || ''}`);
        await new Promise((r) => setTimeout(r, Math.max(2000, p.pacingSeconds * 400)));
      }
    } finally {
      client.close();
    }
    const out = args.json || `data/provider-checks/${new Date().toISOString().slice(0, 10)}-live.json`;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify({ checked_at: new Date().toISOString(), transport: avail.transport, browser: avail.browser, results }, null, 2)}\n`);
    console.log(`\nrapor yazıldı: ${out}`);
    const failed = results.filter((r) => r.status !== 'ok' && r.status !== 'empty');
    if (failed.length) process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) out[k] = true;
    else {
      out[k] = next;
      i++;
    }
  }
  return out;
}
