// lib/cdp.mjs — kullanıcının GERÇEK Chrome'una (debug portu) bağlanan minimal CDP istemcisi.
//
// Amaç: provider entegrasyon kontrollerini agent'a bağlı kalmadan çalıştırabilmek
// (`node provider-check.mjs --live`). Bot duvarı AŞILMAZ: mevcut oturum kullanılır,
// sayfalar insan temposuyla açılır.

const DEFAULT_ENDPOINT = process.env.CAROPS_CDP_URL || 'http://127.0.0.1:9222';

export async function listTabs(endpoint = DEFAULT_ENDPOINT) {
  const res = await fetch(`${endpoint}/json/list`);
  if (!res.ok) throw new Error(`CDP erişilemedi (${endpoint}): ${res.status}`);
  const tabs = await res.json();
  return tabs.filter((t) => t.type === 'page');
}

export async function cdpAvailable(endpoint = DEFAULT_ENDPOINT) {
  try {
    const res = await fetch(`${endpoint}/json/version`);
    if (!res.ok) return false;
    const v = await res.json();
    return { ok: true, browser: v.Browser, webSocketDebuggerUrl: v.webSocketDebuggerUrl };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/** Aynı origin'de sekme bulur, yoksa yeni sekme açar. */
export async function ensureTab(url, endpoint = DEFAULT_ENDPOINT) {
  const origin = new URL(url).origin;
  const tabs = await listTabs(endpoint);
  const same = tabs.find((t) => t.url.startsWith(origin));
  if (same) return same;
  const res = await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) {
    // bazı Chrome sürümleri PUT yerine GET ister
    const alt = await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`);
    if (!alt.ok) throw new Error(`yeni sekme açılamadı: ${res.status}/${alt.status}`);
    return alt.json();
  }
  return res.json();
}

/** Sekmeye bağlanıp komut gönderebilen basit istemci. */
export async function connect(tab) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', (e) => reject(new Error(`WS hatası: ${e?.message || 'bilinmiyor'}`)), { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    } catch {
      /* yok say */
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params }));
      setTimeout(() => {
        if (pending.has(myId)) {
          pending.delete(myId);
          reject(new Error(`CDP zaman aşımı: ${method}`));
        }
      }, 30000);
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'değerlendirme hatası');
    return r.result?.value;
  };
  return {
    send,
    evaluate,
    close: () => ws.close(),
  };
}

/** URL'i sekmeye yükler ve ağın durulmasını bekler. */
export async function navigate(client, url, { waitMs = 6000 } = {}) {
  await client.send('Page.enable');
  await client.send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, waitMs));
}

/** Kart metinlerini DOM'dan çeker (fiyat+yıl deseni, yaprak düğüm mantığı). */
export function cardExtractionScript({ maxCards = 80 } = {}) {
  return `(() => {
    const PRICE=/(?:₺|TL)\\s*\\|?\\s*\\d{1,3}(\\.\\d{3})+|\\d{1,3}(\\.\\d{3})+\\s*(?:₺|TL)/, YEAR=/\\b(19|20)\\d{2}\\b/;
    const out=[]; const seen=new Set();
    for (const el of document.querySelectorAll('div,li,article,a,section,tr')) {
      const t=(el.innerText||'').replace(/\\n+/g,' | ').trim();
      if (t.length<25||t.length>420) continue;
      if (!PRICE.test(t)||!YEAR.test(t)) continue;
      if ([...el.children].some(c=>{const ct=c.innerText||''; return PRICE.test(ct)&&YEAR.test(ct)&&ct.length>20;})) continue;
      if (seen.has(t)) continue; seen.add(t); out.push(t);
      if (out.length>=${maxCards}) break;
    }
    return out;
  })()`;
}

/** Sayfa başlığı + gövde uzunluğu (blok/boş sayfa teşhisi için). */
export function pageStateScript() {
  return `(() => ({ title: document.title.slice(0,80), bodyLength: document.body.innerText.length,
    bodySample: document.body.innerText.replace(/\\n+/g,' | ').slice(0,200) }))()`;
}
