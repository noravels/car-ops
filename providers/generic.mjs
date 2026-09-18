// providers/generic.mjs — TARİF TABANLI genel provider.
//
// Fikir: yeni bir site eklendiğinde KOD yazmak yerine config/providers-generic.json'a
// bir tarif yazılır (URL deseni, sayfalama, şehir mekanizması, çıkarım modu).
// Bu modül tarifi uygular: sayfadan kart metinlerini/ tablo satırlarını alır,
// lib/card-parse.mjs ile normalize eder, doğrulama durumunu korur.
//
// Chrome debug (CDP) tarafı agent/`provider-check.mjs --live` ile yapılır: bu modül
// SAF'tır (ağ/browser erişimi yok) → test edilebilir.

import { readFileSync } from 'node:fs';
import { parseCardText, splitHeading } from '../lib/card-parse.mjs';

export const REGISTRY_PATH = 'config/providers-generic.json';

export function loadRegistry(path = REGISTRY_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Tarif kayıtlarını doğrular: eksik/çelişkili alan varsa hata verir. */
export function validateRegistry(registry) {
  const errors = [];
  const providers = registry.providers || {};
  for (const [id, p] of Object.entries(providers)) {
    if (!p.label) errors.push(`${id}: label yok`);
    if (!p.homepage) errors.push(`${id}: homepage yok`);
    if (!p.verified) errors.push(`${id}: verified durumu yok`);
    if (!['verified', 'pending', 'blocked'].includes(p.verified)) errors.push(`${id}: geçersiz verified durumu (${p.verified})`);
    if (!['table', 'text-pattern', 'api', 'none'].includes(p.extraction)) errors.push(`${id}: geçersiz extraction (${p.extraction})`);
    if (p.extraction === 'api' && !p.api_base) errors.push(`${id}: extraction=api ama api_base yok`);
    if (p.extraction === 'text-pattern' && !p.listing_url) errors.push(`${id}: extraction=text-pattern ama listing_url yok`);
    if (!p.notes) errors.push(`${id}: notes yok (yöntem/sınır yazılmalı)`);
    if (p.verified === 'verified' && p.extraction === 'none') errors.push(`${id}: verified ama extraction=none — çelişki`);
  }
  return { ok: errors.length === 0, errors };
}

/** Provider kaydını tariften üretir (diğer provider'larla aynı arayüz). */
export function createGenericProvider(id, recipe) {
  if (!recipe) throw new Error(`tarif yok: ${id}`);
  return {
    id,
    label: recipe.label,
    homepage: recipe.homepage,
    listingUrl: recipe.listing_url || null,
    extraction: recipe.extraction,
    verified: recipe.verified === 'verified',
    verificationState: recipe.verified,
    geo: recipe.geo || { mode: null, verified: false },
    pacingSeconds: recipe.pacing_seconds ?? 8,
    liveWaitMs: recipe.live_wait_ms ?? null, // canlı kontrolde sayfa yüklemeyi bekleme
    notes: recipe.notes,

    /** Tarif yeterli mi: çıkarım yapılabilir mi? */
    canExtract() {
      return this.extraction === 'text-pattern' || this.extraction === 'table';
    },

    /** Kart metinlerini tarifin kaynağıyla normalize eder. */
    parseCards(cardTexts = [], { city = null } = {}) {
      if (this.extraction !== 'text-pattern') {
        throw new Error(`${id}: extraction=${this.extraction} — parseCards yalnızca text-pattern için`);
      }
      const rows = [];
      for (const text of cardTexts) {
        const row = parseCardText(text, { source: this.label, city });
        if (row) rows.push(row);
      }
      return rows;
    },

    /** Tablo hücre dizilerini normalize eder; kolon düzeni tariften gelir. */
    parseTable(tableRows = [], { cityFallback = null } = {}) {
      if (this.extraction !== 'table') {
        throw new Error(`${id}: extraction=${this.extraction} — parseTable yalnızca table için`);
      }
      if (!recipe.table_layout) {
        throw new Error(`${id}: table_layout tanımsız — kolon düzeni doğrulanmadan tablo ayrıştırılamaz`);
      }
      return tableRows
        .map((cells) => normalizeTableRow(cells, this.label, cityFallback, recipe.table_layout))
        .filter(Boolean);
    },

    /** Şehir URL'i: doğrulanmamışsa null (sessiz filtresiz arama olmasın). */
    geoUrl({ slug = null, plate = null } = {}) {
      const g = this.geo;
      if (!g || g.mode == null || !g.verified) return null;
      if (g.mode === 'path') {
        if (g.only && slug && !g.only.map(slugifyTr).includes(slugifyTr(slug))) return null;
        return g.template.replace('{slug}', slug);
      }
      if (g.mode === 'query') {
        if (plate == null) return null;
        return `${this.listingUrl}?${g.param}=${Number(plate)}`;
      }
      return null;
    },
  };
}

export function loadGenericProviders(path = REGISTRY_PATH) {
  const registry = loadRegistry(path);
  return Object.entries(registry.providers || {}).map(([id, recipe]) => createGenericProvider(id, recipe));
}

/**
 * Tablo satırı → normalize satır. Kolon düzeni provider tarifinden gelir (LAYOUT);
 * marka/model tek hücredeyse (arabam) `heading` alanı splitHeading ile bölünür.
 */
export function normalizeTableRow(cells = [], source, cityFallback = null, layout = null) {
  if (!Array.isArray(cells) || !layout) return null;
  const at = (idx) => (idx == null ? null : cells[idx]);
  const year = Number(at(layout.year));
  if (!Number.isInteger(year) || year < 1950 || year > 2100) return null;
  const prices = String(at(layout.price) ?? '')
    .split('\n')
    .map((s) => Number(s.replace(/[^0-9]/g, '')))
    .filter((n) => n > 1000);
  if (!prices.length) return null;

  let make = at(layout.make);
  let model = at(layout.model);
  let variant = at(layout.variant);
  if (layout.heading != null) {
    const h = splitHeading(at(layout.heading));
    make = h.make ?? make;
    model = h.model ?? model;
    variant = h.variant ?? variant;
  }
  const km = Number(String(at(layout.km) ?? '').replace(/[^0-9]/g, '')) || null;
  const cityRaw = at(layout.city);
  return {
    source,
    make,
    model,
    variant,
    title: String(at(layout.title) ?? '').slice(0, 120),
    year,
    km,
    price_try: prices[prices.length - 1],
    price_drop_try: prices.length > 1 ? prices[0] - prices[prices.length - 1] : null,
    city: cityRaw ? String(cityRaw).replace(/\n/g, ' ') : cityFallback,
  };
}

function slugifyTr(s) {
  const map = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
  return String(s ?? '')
    .split('')
    .map((ch) => map[ch] ?? ch.toLowerCase())
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---- CLI: node providers/generic.mjs [--durum] ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const registry = loadRegistry();
  const check = validateRegistry(registry);
  const rows = Object.entries(registry.providers).map(([id, p]) => ({
    id,
    label: p.label,
    extraction: p.extraction,
    state: p.verified,
    geo: p.geo && p.geo.verified ? `${p.geo.mode}` : '—',
  }));
  console.log(`# Generic provider kayıt defteri (${rows.length} site)\n`);
  console.log('| id | site | çıkarım | durum | şehir |');
  console.log('|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.label} | ${r.extraction} | ${r.state} | ${r.geo} |`);
  const byState = rows.reduce((a, r) => ((a[r.state] = (a[r.state] || 0) + 1), a), {});
  console.log(`\nverified: ${byState.verified || 0} · pending: ${byState.pending || 0} · blocked: ${byState.blocked || 0}`);
  if (!check.ok) {
    console.error('\nTARİF HATALARI:');
    check.errors.forEach((e) => console.error('  -', e));
    process.exitCode = 1;
  }
}
