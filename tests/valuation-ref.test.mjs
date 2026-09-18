import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildValuationRef, saveValuationRef, listValuationRefs, loadBandText } from '../valuation-ref.mjs';

const BANT = 'Düşük Fiyat 916.000 - 933.000 TL Ortalama Altı 933.000 - 950.000 TL Piyasa Ortalaması 950.000 - 980.000 TL Ortalama Üstü 980.000 - 996.000 TL Yüksek Fiyat 996.000 - 1.015.000 TL';

test('buildValuationRef: bantları ayrıştırır, piyasa ortalaması ortasını hesaplar', () => {
  const ref = buildValuationRef({ make: 'Fiat', model: 'Egea Cross', year: 2023, km: 26000, bandText: BANT, fetchedAt: '2026-09-19' });
  assert.deepEqual(ref.bands.market, [950000, 980000]);
  assert.equal(ref.market_mid_try, 965000);
  assert.equal(ref.fetched_at, '2026-09-19');
  assert.match(ref.note, /Elle yapıştırılan/);
});

test('buildValuationRef: bant yoksa veya "Piyasa Ortalaması" eksikse kayıt YAPILMAZ', () => {
  assert.throws(() => buildValuationRef({ bandText: '' }), /bant metni boş/);
  assert.throws(() => buildValuationRef({ bandText: 'alakasız metin' }), /okunamadı/);
  assert.throws(() => buildValuationRef({ bandText: 'Düşük Fiyat 900.000 - 910.000 TL' }), /Piyasa Ortalaması/);
});

test('saveValuationRef + listValuationRefs: tarihli dosya adı ve listeleme', () => {
  const dir = mkdtempSync(join(tmpdir(), 'valref-'));
  const ref = buildValuationRef({ make: 'Fiat', model: 'Egea Cross', year: 2023, bandText: BANT, fetchedAt: '2026-09-19' });
  const path = saveValuationRef(ref, { dir });
  assert.match(path, /2026-09-19-fiat-egea-cross-2023\.json$/);
  const list = listValuationRefs({ dir });
  assert.equal(list.length, 1);
  assert.equal(list[0].market_mid_try, 965000);
});

test('loadBandText: @dosya biçiminden bandı geri okur (CLI entegrasyonu)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'valref-'));
  const ref = buildValuationRef({ make: 'Fiat', model: 'Egea Cross', bandText: BANT, fetchedAt: '2026-09-19' });
  const path = saveValuationRef(ref, { dir });
  assert.match(loadBandText(`@${path}`), /Piyasa Ortalaması/);
});
