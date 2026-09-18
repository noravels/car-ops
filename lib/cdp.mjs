// lib/cdp.mjs — kullanıcının GERÇEK Chrome'una bağlanan CDP istemcisi.
//
// ÖNEMLİ BULGU (2026-09-19, canlı doğrulandı):
//   Chrome 9222'de dinliyor ama HTTP uçları (`/json/version`, `/json/list`) **403
//   "Connection rejected"** döndürüyor. Buna karşılık `/devtools/browser` yolunda
//   **WebSocket el sıkışması 101** ile kabul ediliyor (UUID gerekmiyor).
//   Bu yüzden bu istemci HTTP keşfine GÜVENMEZ: doğrudan WS'e bağlanır ve
//   hedefleri CDP `Target.*` komutlarıyla bulur.
//
// Bot duvarı AŞILMAZ: kullanıcının mevcut oturumu kullanılır, sayfalar insan
// temposuyla açılır (çağıran taraf pacing uygular).

const DEFAULT_ENDPOINT = process.env.CAROPS_CDP_URL || 'http://127.0.0.1:9222';

/** http(s)://host:port → ws://host:port */
function toWsBase(endpoint) {
  return String(endpoint).replace(/^http/i, 'ws').replace(/\/+$/, '');
}

function candidateWsUrls(endpoint = DEFAULT_ENDPOINT) {
  const base = toWsBase(endpoint);
  if (/^wss?:\/\//i.test(endpoint)) return [String(endpoint).replace(/\/+$/, '')];
  return [`${base}/devtools/browser`];
}

/**
 * WebSocket el sıkışması denemesi.
 *
 * NOT: Chrome'un `/devtools/browser` ucu **tek istemci** kabul eder. Agent'ın tarayıcı
 * oturumu bağlıyken el sıkışma zaman aşımına düşebilir (oturum boşta kalınca serbest
 * kalır). Bu yüzden çağıran taraf tekrar denemeli — `cdpAvailable` bunu yapar.
 */
async function tryWs(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      finish({ ok: false, url, error: String(err?.message || err) });
      return;
    }
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* yok say */
      }
      finish({ ok: false, url, error: 'el sıkışma zaman aşımı' });
    }, timeoutMs);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      finish({ ok: true, url, ws });
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      finish({ ok: false, url, error: 'WS bağlantı hatası' });
    });
  });
}

/** HTTP keşfi (bazı kurulumlarda açık olabilir) — başarısızsa null. */
export async function httpDiscovery(endpoint = DEFAULT_ENDPOINT) {
  try {
    const res = await fetch(`${String(endpoint).replace(/\/+$/, '')}/json/version`);
    if (!res.ok) return null;
    const v = await res.json();
    return { browser: v.Browser, webSocketDebuggerUrl: v.webSocketDebuggerUrl };
  } catch {
    return null;
  }
}

/**
 * CDP erişilebilir mi? Önce HTTP, olmazsa doğrudan WS denenir.
 * @returns {{ok:boolean, transport?:'http'|'ws', browser?:string, wsUrl?:string, error?:string}}
 */
export async function cdpAvailable(endpoint = DEFAULT_ENDPOINT, { attempts = 6, delayMs = 2500 } = {}) {
  const http = await httpDiscovery(endpoint);
  if (http) return { ok: true, transport: 'http', browser: http.browser, wsUrl: http.webSocketDebuggerUrl };

  const errors = [];
  for (let i = 0; i < attempts; i++) {
    for (const url of candidateWsUrls(endpoint)) {
      const attempt = await tryWs(url);
      if (attempt.ok) {
        try {
          attempt.ws.close();
        } catch {
          /* yok say */
        }
        return { ok: true, transport: 'ws', browser: 'Chrome (WS üzerinden)', wsUrl: url, attempts: i + 1 };
      }
      errors.push(`${url}: ${attempt.error}`);
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return {
    ok: false,
    error:
      `${errors.slice(-2).join(' | ')} — Chrome /devtools/browser ucu TEK istemci kabul eder; ` +
      "agent'ın tarayıcı oturumu bağlıysa oturum boşta kalana kadar (~2 dk) bekleyip tekrar deneyin.",
  };
}

/** Aynı origin'de sekme bulur (CDP üzerinden); yoksa null. */
export async function findTab(client, url) {
  const origin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  })();
  const { targetInfos } = await client.send('Target.getTargets');
  const pages = (targetInfos || []).filter((t) => t.type === 'page');
  return pages.find((t) => origin && (t.url || '').startsWith(origin)) || null;
}

/** Sekmeye komut gönderebilen CDP oturumu açar (flatten modunda). */
export async function attach(client, targetId) {
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
  if (!sessionId) throw new Error('oturum açılamadı (attachToTarget sessionId dönmedi)');
  return sessionId;
}

/** WS üzerinden CDP komutu gönderen istemci (sessionId destekli). */
export async function connectWs(wsUrl, { timeoutMs = 30000 } = {}) {
  const ws = await new Promise((resolve, reject) => {
    const sock = new WebSocket(wsUrl);
    sock.addEventListener('open', () => resolve(sock), { once: true });
    sock.addEventListener('error', (e) => reject(new Error(`WS hatası: ${e?.message || 'bilinmiyor'}`)), { once: true });
  });

  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || 'CDP hatası'));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}, sessionId = null) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      const payload = { id: myId, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (pending.has(myId)) {
          pending.delete(myId);
          reject(new Error(`CDP zaman aşımı: ${method}`));
        }
      }, timeoutMs);
    });

  const evaluate = async (sessionId, expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'değerlendirme hatası');
    return r.result?.value;
  };

  return { send, evaluate, close: () => ws.close(), raw: ws };
}

/**
 * Yeni sekmede URL açar ve CDP oturumu döner.
 *
 * ÖNEMLİ: Bazı sitelerde `Page.navigate` asılı kalıyor (yavaş yüklenen sayfa).
 * Bu yüzden hedef doğrudan URL ile oluşturulur; `Page.navigate` yalnızca
 * `--navigate` gerektiğinde (fallback) kullanılır.
 */
export async function openPage(client, url, { waitMs = 6000, useNavigate = false } = {}) {
  const { targetId } = await client.send('Target.createTarget', { url: useNavigate ? 'about:blank' : url });
  const sessionId = await attach(client, targetId);
  if (useNavigate) {
    await client.send('Page.enable', {}, sessionId);
    await client.send('Page.navigate', { url }, sessionId);
  }
  await new Promise((r) => setTimeout(r, waitMs));
  return { targetId, sessionId };
}

/** Sayfa başlığı + gövde uzunluğu (blok/boş sayfa teşhisi için). */
export function pageStateScript() {
  return `(() => ({ title: document.title.slice(0,80), bodyLength: document.body.innerText.length,
    bodySample: document.body.innerText.replace(/\\n+/g,' | ').slice(0,200) }))()`;
}

/**
 * Kart metinlerini DOM'dan çeker (fiyat + yıl deseni).
 * - Binlik ayırıcı nokta VEYA boşluk (NBSP dahil) olabilir.
 * - Metin para birimiyle başlıyorsa bu bir "fiyat bloğu kırıntısıdır", atlanır.
 */
export function cardExtractionScript({ maxCards = 80 } = {}) {
  return `(() => {
    const PRICE=/(?:₺|TL)\\s*\\|?\\s*\\d{1,3}(?:[.\\s\\u00A0]\\d{3})+|\\d{1,3}(?:[.\\s\\u00A0]\\d{3})+\\s*(?:₺|TL)/;
    const YEAR=/\\b(19|20)\\d{2}\\b/;
    const out=[]; const seen=new Set();
    for (const el of document.querySelectorAll('div,li,article,a,section,tr')) {
      const t=(el.innerText||'').replace(/\\n+/g,' | ').trim();
      if (t.length<25||t.length>500) continue;
      if (/^(₺|TL)/.test(t)) continue;
      if (!PRICE.test(t)||!YEAR.test(t)) continue;
      if ([...el.children].some(c=>{const ct=c.innerText||''; return PRICE.test(ct)&&YEAR.test(ct)&&ct.length>25;})) continue;
      if (seen.has(t)) continue; seen.add(t); out.push(t);
      if (out.length>=${maxCards}) break;
    }
    return out;
  })()`;
}

/** Tablo satırlarını DOM'dan çeker (sahibinden/arabam tipi listeler). */
export function tableExtractionScript({ maxRows = 60 } = {}) {
  return `(() => {
    const out=[];
    document.querySelectorAll('tbody tr').forEach(tr=>{
      const tds=[...tr.querySelectorAll('td')].map(td=>td.innerText.trim());
      if (tds.length>=8) out.push(tds.slice(0,11));
    });
    return out.slice(0,${maxRows});
  })()`;
}

/** Geriye dönük uyumluluk: eski listTabs/connect API'si (HTTP varsa çalışır). */
export async function listTabs(endpoint = DEFAULT_ENDPOINT) {
  const http = await httpDiscovery(endpoint);
  if (http) {
    const res = await fetch(`${String(endpoint).replace(/\/+$/, '')}/json/list`);
    if (res.ok) return (await res.json()).filter((t) => t.type === 'page');
  }
  const avail = await cdpAvailable(endpoint);
  if (!avail.ok) throw new Error(`CDP erişilemedi: ${avail.error}`);
  const client = await connectWs(avail.wsUrl);
  try {
    const { targetInfos } = await client.send('Target.getTargets');
    return (targetInfos || []).filter((t) => t.type === 'page').map((t) => ({
      id: t.targetId,
      targetId: t.targetId,
      title: t.title,
      url: t.url,
      webSocketDebuggerUrl: null,
    }));
  } finally {
    client.close();
  }
}
