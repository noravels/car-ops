#!/usr/bin/env node
// tools/capture-api.mjs — bir sayfanın AĞ trafiğini CDP ile yakalar (API şeması keşfi).
//
// Neden: SPA sitelerde liste, DOM'a değil bir XHR/fetch çağrısından gelir. İstek gövdesini
// tahmin etmek yerine (yasak: şema uydurma) gerçek çağrı yakalanır ve registry'ye yazılır.
//
// Kullanım:
//   node tools/capture-api.mjs --url "https://www.ikinciyeni.com/araba-al" --host apigw --sure 12000
//   node tools/capture-api.mjs --url "https://www.otokocikinciel.com/ikinci-el" --filtre "ikinci-el|api"
//
// Çıktı: yakalanan isteklerin method/url/body özeti (ilk N).

import { cdpAvailable, connectWs, attach, pageStateScript } from '../lib/cdp.mjs';

const args = {};
const argv = process.argv.slice(2);
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

if (!args.url) {
  console.log('Kullanım: node tools/capture-api.mjs --url <sayfa> [--host apigw] [--filtre regex] [--sure 12000] [--tumu]');
  process.exit(1);
}

const filter = args.filtre ? new RegExp(String(args.filtre), 'i') : null;
const host = args.host ? String(args.host).toLowerCase() : null;
const waitMs = Number(args.sure) || 12000;
const showAll = Boolean(args.tumu);

const avail = await cdpAvailable();
if (!avail.ok) {
  console.error(`❌ CDP erişilemedi: ${avail.error}`);
  process.exit(2);
}
console.log(`# CDP: ${avail.transport} · ${avail.browser}`);
const client = await connectWs(avail.wsUrl);
const captured = [];

try {
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const sessionId = await attach(client, targetId);
  await client.send('Network.enable', {}, sessionId);
  await client.send('Page.enable', {}, sessionId);

  // olayları dinle: istek + gönderilen gövde
  client.raw.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.method === 'Network.requestWillBeSent' && msg.params) {
      const { request } = msg.params;
      const url = request.url || '';
      if (!/^https?:/.test(url)) return;
      if (/\.(js|css|png|jpe?g|webp|svg|woff2?|ico|gif)(\?|$)/i.test(url)) return;
      if (host && !url.toLowerCase().includes(host)) return;
      if (filter && !filter.test(url) && !filter.test(String(request.postData || ''))) return;
      captured.push({
        method: request.method,
        url,
        headers: Object.fromEntries(Object.entries(request.headers || {}).slice(0, 8)),
        postData: request.postData ? String(request.postData).slice(0, 1200) : null,
      });
    }
  });

  await client.send('Page.navigate', { url: args.url }, sessionId);
  await new Promise((r) => setTimeout(r, waitMs));
  const state = await client.evaluate(sessionId, pageStateScript());
  console.log(`sayfa: ${state?.title} · gövde ${state?.bodyLength} karakter · yakalanan ${captured.length} istek`);
} catch (err) {
  console.error('hata:', String(err?.message || err));
} finally {
  client.close();
}

const list = showAll ? captured : captured.slice(0, 12);
for (const c of list) {
  console.log(`\n--- ${c.method} ${c.url.slice(0, 140)}`);
  const interesting = Object.entries(c.headers).filter(([k]) => /content-type|authorization|api-key|x-/i.test(k));
  if (interesting.length) console.log(`    başlık: ${interesting.map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(' | ')}`);
  if (c.postData) console.log(`    GÖVDE: ${c.postData}`);
}
if (!captured.length) {
  console.log('\n⚠️ Filtreye uyan istek yakalanmadı. --host/--filtre olmadan tekrar deneyin (--tumu ile tam liste).');
}
