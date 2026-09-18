import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cdpAvailable, cardExtractionScript, tableExtractionScript, pageStateScript, listTabs } from '../lib/cdp.mjs';

test('cardExtractionScript: boşluklu/noktalı binlik ayırıcı ve kırıntı koruması içerir', () => {
  const s = cardExtractionScript();
  assert.ok(s.includes('\\u00A0'), 'NBSP desteği olmalı');
  assert.ok(s.includes('/^(₺|TL)/'), 'fiyat kırıntısı koruması olmalı');
  assert.ok(s.includes("[.\\s\\u00A0]"), 'boşluklu binlik ayırıcı deseni olmalı');
  assert.match(s, /maxCards|out\.length>=80/);
});

test('tableExtractionScript: tbody satırlarını hücre dizisi olarak verir', () => {
  const s = tableExtractionScript({ maxRows: 10 });
  assert.match(s, /tbody tr/);
  assert.match(s, /slice\(0,10\)/);
});

test('pageStateScript: başlık ve gövde uzunluğu döner', () => {
  const s = pageStateScript();
  assert.match(s, /document\.title/);
  assert.match(s, /bodyLength/);
});

test('cdpAvailable: erişilemeyen uçta ok=false ve açıklayıcı hata verir (uydurma başarı yok)', async () => {
  const res = await cdpAvailable('http://127.0.0.1:59999');
  assert.equal(res.ok, false);
  assert.ok(res.error && res.error.length > 5);
});

test('listTabs: erişilemeyen uçta hata fırlatır (boş liste döndürmez)', async () => {
  await assert.rejects(() => listTabs('http://127.0.0.1:59999'), /CDP/);
});
