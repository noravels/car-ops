// learn-params.mjs — site filtre parametrelerini "öğrenme" aracı.
// Amaç: bloklanan/otomatikleştirilemeyen sitelerde parametre adlarını UYDURMADAN
// öğrenmek. Yöntem: kullanıcı aynı sayfanın iki halini (filtresiz taban + tek filtre
// uygulanmış) verir; araç URL farkından parametre adını çıkarır ve filters.json için
// uygulanabilir bir yama üretir.

function parseUrl(raw) {
  const u = new URL(String(raw).trim());
  return {
    base: `${u.origin}${u.pathname}`,
    params: Object.fromEntries(u.searchParams.entries()),
    pathname: u.pathname,
  };
}

/** Taban URL ile filtrelenmiş URL arasındaki yapısal farkı çıkarır. */
export function diffUrls(baseUrl, filteredUrl) {
  const a = parseUrl(baseUrl);
  const b = parseUrl(filteredUrl);

  const queryAdded = [];
  const queryRemoved = [];
  const queryChanged = [];
  for (const [k, v] of Object.entries(b.params)) {
    if (!(k in a.params)) queryAdded.push({ key: k, value: v });
    else if (a.params[k] !== v) queryChanged.push({ key: k, from: a.params[k], to: v });
  }
  for (const k of Object.keys(a.params)) {
    if (!(k in b.params)) queryRemoved.push({ key: k, value: a.params[k] });
  }

  // yol eki: taban yolun sonundan sonra gelen ek segment/parça
  let pathSuffix = null;
  if (a.pathname !== b.pathname) {
    const aSeg = a.pathname.split('/').pop() || '';
    const bSeg = b.pathname.split('/').pop() || '';
    if (bSeg.startsWith(aSeg) && bSeg.length > aSeg.length) {
      pathSuffix = bSeg.slice(aSeg.length).replace(/^-/, '');
    } else {
      pathSuffix = bSeg;
    }
  }

  return { queryAdded, queryRemoved, queryChanged, pathSuffix, base: a.base, filtered: b.base };
}

/**
 * Öğrenme satırlarından filtre → strateji eşlemesi üretir.
 * rows: [{ filter, base, filtered, value }]
 * opts.known: mevcut filters.json map'i (bilinen parametreleri korumak için)
 */
export function inferParamMap(rows, { known = {} } = {}) {
  const map = {};
  for (const row of rows) {
    if (!row || !row.filter) continue;
    const d = diffUrls(row.base, row.filtered);

    if (d.pathSuffix) {
      map[row.filter] = {
        strategy: 'path',
        encode: 'suffix',
        value_sample: row.value || d.pathSuffix,
        verified: true,
        learned_from: 'url-diff',
      };
      continue;
    }

    // yeni veya değişen bir query parametresi varsa onu bu filtreye bağla
    const candidate = d.queryAdded[0] || d.queryChanged[0];
    if (candidate && candidate.key) {
      const key = candidate.key;
      map[row.filter] = {
        strategy: 'query',
        param: key,
        verified: true,
        value_sample: row.value || candidate.value || candidate.to || null,
        learned_from: 'url-diff',
      };
      continue;
    }

    // fark yoksa: filtre URL'e yansımıyor → dürüstçe postfilter öner
    map[row.filter] = {
      strategy: 'postfilter',
      reason: "URL fark bulunamadı (filtre URL'e yansımıyor) → rapor süzmesi",
    };
  }
  return map;
}

/** filters.json'a yapıştırılabilecek JSON parçası üretir. */
export function renderSuggestedPatch(providerId, map) {
  return JSON.stringify({ providers: { [providerId]: { map } } }, null, 2);
}

// CLI:
//   node learn-params.mjs --provider sahibinden --filter gearbox \
//        --base "https://www.sahibinden.com/fiat-egea-cross" \
//        --filtered "https://www.sahibinden.com/fiat-egea-cross?a8=1"
//   Birden fazla filtre için: --filter vites --filtered <url> --filter yakit --filtered <url> ...
export function runCli(argv) {
  const args = {};
  const pairs = [];
  let currentFilter = null;
  const filteredUrls = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--filter') currentFilter = argv[++i];
    else if (t === '--filtered') {
      const url = argv[++i];
      filteredUrls.push(url);
      pairs.push({ filter: currentFilter, filtered: url });
    } else if (t.startsWith('--')) args[t.slice(2)] = argv[++i];
  }

  if (!args.provider || !args.base || !pairs.length) {
    console.error(`kullanım:
  node learn-params.mjs --provider sahibinden --base "<filtresiz URL>" \\
    --filter gearbox --filtered "<vites filtrelenmiş URL>" \\
    --filter fuel --filtered "<yakıt filtrelenmiş URL>"

Not: her --filtered, kendisinden önce gelen --filter'a aittir.`);
    process.exitCode = 1;
    return;
  }

  const rows = pairs.map((p) => ({ filter: p.filter, base: args.base, filtered: p.filtered, value: null }));
  const map = inferParamMap(rows, { known: {} });

  console.log('# Öğrenilen parametre eşlemesi\n');
  for (const [filter, rule] of Object.entries(map)) {
    if (rule.strategy === 'path') console.log(`- ${filter}: YOL EKİ ("${rule.value_sample}")`);
    else if (rule.strategy === 'query') console.log(`- ${filter}: query "${rule.param}"`);
    else console.log(`- ${filter}: URL'e yansımıyor → rapor süzmesi`);
  }
  console.log('\n# config/filters.json için öneri (map bloğuna ekleyin)\n');
  console.log(renderSuggestedPatch(args.provider, map));
}

if (process.argv[1] && process.argv[1].endsWith('learn-params.mjs')) {
  runCli(process.argv.slice(2));
}
