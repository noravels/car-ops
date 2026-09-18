#!/usr/bin/env node
// scripts/print-pdf.mjs — yerel HTML'i Chrome (headless) ile PDF'e çevirir.
//
// Neden ayrı script: headless Chrome bazı sürümlerde PDF'i yazdıktan sonra KAPANMIYOR.
// Bu yüzden süreç arka planda başlatılır, dosyanın oluşması beklenir, sonra temizlenir.
//
// Kullanım: node scripts/print-pdf.mjs --html reports/karsilastirma.html [--pdf reports/karsilastirma.pdf]

import { spawn } from 'node:child_process';
import { existsSync, statSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const args = {};
for (let i = 0; i < process.argv.length - 2; i++) {
  const a = process.argv.slice(2)[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const next = process.argv.slice(2)[i + 1];
  if (next == null || next.startsWith('--')) args[k] = true;
  else args[k] = next;
}

const html = resolve(args.html || 'reports/karsilastirma.html');
const pdf = resolve(args.pdf || html.replace(/\.html?$/i, '.pdf'));
if (!existsSync(html)) {
  console.error(`❌ HTML bulunamadı: ${html}`);
  process.exit(1);
}
const chrome = args.chrome || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chrome)) {
  console.error(`❌ Chrome bulunamadı: ${chrome} (--chrome ile yol verilebilir)`);
  process.exit(2);
}

if (existsSync(pdf)) rmSync(pdf);
const profile = `/tmp/carops-pdf-${process.pid}`;
const child = spawn(
  chrome,
  ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdf}`, `file://${html}`],
  { stdio: 'ignore', detached: true },
);
child.unref();

const timeoutMs = Number(args.zaman || 30000);
const startedAt = Date.now();
let ok = false;
while (Date.now() - startedAt < timeoutMs) {
  await new Promise((r) => setTimeout(r, 500));
  if (existsSync(pdf) && statSync(pdf).size > 1000) {
    // dosya yazımı bitene kadar kısa bekleme (Chrome bitişik yazıyor olabilir)
    await new Promise((r) => setTimeout(r, 1000));
    ok = statSync(pdf).size > 1000;
    if (ok) break;
  }
}
// Chrome bazen kapanmıyor: profil dizininden süreçleri temizle
try {
  spawn('pkill', ['-f', profile], { stdio: 'ignore' }).on('exit', () => {});
} catch {
  /* yok say */
}

if (!ok) {
  console.error(`❌ PDF üretilemedi (${timeoutMs} ms). Alternatif: HTML'i tarayıcıda açıp Cmd/Ctrl+P ile PDF kaydet.`);
  process.exit(3);
}
console.log(`✅ PDF: ${pdf} (${Math.round(statSync(pdf).size / 1024)} KB)`);
