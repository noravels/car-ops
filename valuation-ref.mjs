#!/usr/bin/env node
// valuation-ref.mjs — Oto360 (veya benzeri) değerleme BANTLARINI tarihli referans olarak saklar.
//
// Neden: Oto360 değerleme sorgusu giriş + form etkileşimi gerektirdiği için otomatikleştirilemedi
// (bkz. docs/TODO.md P5). Ama bandın KENDİSİ kanıt değeri taşır: alındığı araç özellikleri,
// tarih, ham metin. Bu araç bandı yapıştırıp kayıt altına alır; değerleme CLI'sı `--oto360 @dosya`
// ile bu kaydı doğrudan kullanır. Böylece "uydurma bant yok" kuralı korunur ve referans izlenebilir olur.
//
// Kullanım:
//   node valuation-ref.mjs --kaydet --marka Fiat --model "Egea Cross" --yil 2023 --km 26000 \
//        --bant "Düşük Fiyat 916.000 - 933.000 TL ... Piyasa Ortalaması 950.000 - 980.000 TL ..."
//   node valuation-ref.mjs --listele

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseOto360Bands } from './valuation.mjs';

const DIR = 'data/valuations';

export function slugTr(name) {
  const map = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
  return String(name ?? '')
    .split('')
    .map((ch) => map[ch] ?? ch.toLowerCase())
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Bandı ayrıştırır ve kayıt nesnesi üretir; bant yoksa hata verir (uydurma yok). */
export function buildValuationRef({ make, model, variant, year, km, bandText, source = 'Oto360 (sahibinden.com Araç Değerleme)', fetchedAt = new Date().toISOString().slice(0, 10) }) {
  if (!bandText || typeof bandText !== 'string') throw new Error('bant metni boş — kayıt yapılmaz');
  const bands = parseOto360Bands(bandText);
  if (!bands) throw new Error('bantlar okunamadı (en az "Piyasa Ortalaması X - Y TL" gerekir) — kayıt yapılmaz');
  if (!bands.market) throw new Error('"Piyasa Ortalaması" bandı yok — referans olarak kullanılamaz');
  return {
    make: make || null,
    model: model || null,
    variant: variant || null,
    year: year ?? null,
    km: km ?? null,
    source,
    fetched_at: fetchedAt,
    bands,
    market_mid_try: Math.round((bands.market[0] + bands.market[1]) / 2),
    band_text: bandText.trim(),
    note: 'Elle yapıştırılan bant (Oto360 sorgusu giriş gerektiriyor) — değerlemede --oto360 @dosya ile kullanılır.',
  };
}

export function saveValuationRef(ref, { dir = DIR } = {}) {
  mkdirSync(dir, { recursive: true });
  const name = `${ref.fetched_at}-${slugTr(`${ref.make || 'bilinmeyen'} ${ref.model || ''} ${ref.year || ''}`)}.json`;
  const path = join(dir, name);
  writeFileSync(path, `${JSON.stringify(ref, null, 2)}\n`);
  return path;
}

export function listValuationRefs({ dir = DIR } = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      try {
        const ref = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        return { file: join(dir, f), ...ref };
      } catch {
        return { file: join(dir, f), error: 'okunamadı' };
      }
    });
}

/** Değerleme CLI'sı için `@dosya` çözümleyici: kayıtlı bandı metin olarak döndürür. */
export function loadBandText(refPath) {
  const ref = JSON.parse(readFileSync(refPath.replace(/^@/, ''), 'utf8'));
  if (!ref.band_text) throw new Error(`${refPath}: band_text alanı yok`);
  return ref.band_text;
}

// ---- CLI ----
const argv = process.argv.slice(2);
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

if (args.listele) {
  const refs = listValuationRefs();
  if (!refs.length) {
    console.log(`kayıtlı referans yok (${DIR})`);
  } else {
    console.log('| tarih | araç | piyasa ortalaması | dosya |');
    console.log('|---|---|---|---|');
    for (const r of refs) {
      console.log(`| ${r.fetched_at} | ${r.make || ''} ${r.model || ''} ${r.year || ''} | ${r.market_mid_try ? r.market_mid_try.toLocaleString('tr-TR') + ' TL' : '—'} | ${r.file} |`);
    }
  }
} else if (args.kaydet) {
  try {
    const ref = buildValuationRef({
      make: args.marka,
      model: args.model,
      variant: args.motor || args.varyant,
      year: args.yil ? Number(args.yil) : null,
      km: args.km ? Number(args.km) : null,
      bandText: typeof args.bant === 'string' ? args.bant : null,
      fetchedAt: args.tarih || new Date().toISOString().slice(0, 10),
    });
    const path = saveValuationRef(ref);
    console.log(`✅ referans kaydedildi: ${path}`);
    console.log(`   bantlar: ${Object.entries(ref.bands).map(([k, v]) => `${k}=${v[0]}-${v[1]}`).join(' · ')}`);
    console.log(`   piyasa ortalaması ortası: ${ref.market_mid_try.toLocaleString('tr-TR')} TL`);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
  }
} else {
  console.log(`Kullanım:
  node valuation-ref.mjs --kaydet --marka Fiat --model "Egea Cross" --yil 2023 --km 26000 \\
       --bant "Düşük Fiyat 916.000 - 933.000 TL Ortalama Altı ... Piyasa Ortalaması 950.000 - 980.000 TL ..."
  node valuation-ref.mjs --listele

Değerlemede kullanım:  node valuation-cli.mjs ... --oto360 @data/valuations/<dosya>.json`);
}
