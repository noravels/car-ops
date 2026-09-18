// doctor.mjs — kurulum ve kişiselleştirme kontrolü.
// Kullanıcı katmanı hazır mı? Eksik alanlar neler? (career-ops doctor deseni)

import { existsSync, readFileSync } from 'node:fs';

const REQUIRED_SYSTEM_FILES = [
  'AGENTS.md',
  'config/markets.yml',
  'config/filters.json',
  'config/locations/tr-provinces.json',
  'watchlist.yml',
];

const REQUIRED_PROFILE_FIELDS = ['location.province', 'budget.mode', 'vehicle_target'];

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

// Basit YAML okuyucu (bağımlılık eklememek için: düz anahtar/değer + iç içe 2 seviye yeterli)
export function parseSimpleYaml(text) {
  const out = {};
  let current = null;
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.match(/^\s*/)[0].length;
    const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, rest] = m;
    let value = rest.trim();
    if (value === '' || value.startsWith('#')) {
      if (indent === 0) {
        current = key;
        out[key] = out[key] || {};
      } else if (current) {
        out[current][key] = {};
      }
      continue;
    }
    if (value.includes('#') && !value.startsWith('#')) value = value.split('#')[0].trim();
    if (value === 'null' || value === '~') value = null;
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1).trim();
      value = inner ? inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')) : [];
    } else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    else value = value.replace(/^["']|["']$/g, '');

    if (indent === 0) {
      out[key] = value;
      current = value && typeof value === 'object' ? key : null;
    } else if (current) {
      out[current][key] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function checkSetup({ profile, files = {}, profileText = '', templateText = '' } = {}) {
  const missing = [];
  const warnings = [];
  const unpersonalized = [];
  const missing_files = [];

  if (!profile) missing.push('config/profile.yml');

  if (profile) {
    for (const field of REQUIRED_PROFILE_FIELDS) {
      const v = getPath(profile, field);
      if (v == null || (typeof v === 'string' && !v.trim()) || (typeof v === 'object' && !Object.keys(v).length)) {
        warnings.push(`profil alanı eksik: ${field}`);
      } else if (field === 'vehicle_target' && !profile.vehicle_target.model && !profile.vehicle_target.or_segment) {
        warnings.push('araç hedefi belirsiz: model veya segment gir (model yoksa segment ile arama yapılır)');
      }
    }

    const b = profile.budget || {};
    if (b.mode === 'kredi') {
      if (b.down_payment_try == null && b.monthly_max_try == null) {
        warnings.push('kredi modu: peşinat veya aylık tutar gir (bütçe hesabı için gerekli)');
      }
      if (b.months == null) warnings.push('kredi modu: vade (months) eksik');
      if (b.down_payment_try == null) warnings.push('kredi modu: peşinat (down_payment_try) eksik');
      if (b.monthly_max_try == null) warnings.push('kredi modu: aylık üst sınır (monthly_max_try) eksik');
    } else if (b.mode === 'pesin') {
      if (b.total_max_try == null) warnings.push('peşin modu: toplam bütçe (total_max_try) eksik');
    } else if (b.mode != null) {
      warnings.push(`bilinmeyen bütçe modu: ${b.mode} (pesin | kredi)`);
    }

    if (profile.location && !profile.location.province) {
      warnings.push('konum eksik: il (location.province) gir — çevre süzmesi için gerekli');
    }
  }

  if (templateText && profileText) {
    const t = String(templateText);
    const p = String(profileText);
    const templateIsNullHeavy = (t.match(/:\s*null/g) || []).length > 3;
    const sameAsTemplate = t.trim() === p.trim();
    if (sameAsTemplate || (templateIsNullHeavy && (p.match(/:\s*null/g) || []).length > 3)) {
      unpersonalized.push('config/profile.yml hâlâ şablon içeriği taşıyor — aramalar kişiselleştirilmemiş sınırlarla yapılır');
    }
  }

  for (const f of REQUIRED_SYSTEM_FILES) {
    const known = f === 'watchlist.yml' ? files.watchlist : f === 'config/markets.yml' ? files.markets : files[f];
    if (known === false) missing_files.push(f);
  }

  if (warnings.some((w) => /konum/.test(w))) {
    warnings.push('konum eksik → "X ilinde araba arıyorum" akışı için modes/intake.md çalıştırılmalı');
  }

  return {
    ok: missing.length === 0 && warnings.length === 0,
    onboarding_needed: missing.length > 0 || warnings.length > 0,
    missing,
    warnings: [...new Set(warnings)],
    unpersonalized,
    missing_files,
  };
}

export function runDoctor(cwd = process.cwd()) {
  const profilePath = `${cwd}/config/profile.yml`;
  const templatePath = `${cwd}/templates/profile.template.yml`;
  const profileText = existsSync(profilePath) ? readFileSync(profilePath, 'utf8') : '';
  const templateText = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : '';
  const profile = profileText ? parseSimpleYaml(profileText) : null;

  const files = {};
  for (const f of REQUIRED_SYSTEM_FILES) files[f] = existsSync(`${cwd}/${f}`);
  files.watchlist = existsSync(`${cwd}/watchlist.yml`);
  files.markets = existsSync(`${cwd}/config/markets.yml`);

  return checkSetup({ profile, files, profileText, templateText });
}

if (process.argv[1] && process.argv[1].endsWith('doctor.mjs')) {
  const r = runDoctor();
  console.log(JSON.stringify(r, null, 2));
  if (r.missing.length) {
    console.log('\nEksik dosyalar:', r.missing.join(', '));
    console.log('Şablonu kopyala: cp templates/profile.template.yml config/profile.yml');
  }
  if (r.warnings.length) {
    console.log('\nYapılacaklar:');
    for (const w of r.warnings) console.log(' -', w);
  }
  if (r.unpersonalized.length) {
    console.log('\nKişiselleştirme:');
    for (const u of r.unpersonalized) console.log(' -', u);
  }
  if (r.ok) console.log('\nKurulum tamam — aramaya hazır: node search-urls.mjs --make ... --il ...');
  process.exitCode = r.ok ? 0 : 1;
}
