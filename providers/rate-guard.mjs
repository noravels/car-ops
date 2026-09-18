// rate-guard.mjs — sahibinden rate-limit koruma yardımcıları.
// Kaynak tarzı: emrekentli/sahibinden-scraper (is_rate_limited + handle_rate_limit_wait)
// ve filtre URL desenini config.json'dan adapting ediyoruz.

export function isRateLimited({ url, html }) {
  if (!url && !html) return false;
  if (typeof url === 'string' && /olagand?i?[-_]?(?:disi|kullanim)|(?:olagan[-_]dis[-_]i?)/i.test(url)) {
    return true;
  }
  if (typeof html === 'string') {
    if (/class="[^"]*error-page-container[^"]*too-many-requests/i.test(html)) return true;
    if (/Ola[ğg]an\s*d[ıi][şs][ıi]\s*(?:bir|erişim)/i.test(html)) return true;
    if (/olağan dışı erişim|olağandışı/i.test(html)) return true;
    if (/too[- ]many[- ]requests/i.test(html)) return true;
  }
  return false;
}

export function backoffSchedule({ chunk_seconds = 900, retries = 2 } = {}) {
  return Array.from({ length: retries }, () => chunk_seconds);
}

// Sahibinden filtre URL parametresi akıllı biri: (a109 = max changed, a5 = year, vs.)
export function buildFilterUrl({ base, filters = {} }) {
  const u = new URL(String(base));
  for (const [k, v] of Object.entries(filters)) {
    if (v == null) continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

export function humanPacing({ min_s = 20, max_s = 30 } = {}) {
  return min_s + Math.random() * (max_s - min_s);
}

// Rate-limit tespit → bekleme yönetimi (sadece referans değer, gerçek uyku browser
// dışında yapılmıyor çünkü agent muhatap havaşmeya; agent tick)
export function rateLimitPlan({ blocked, schedule } = {}) {
  if (!schedule) schedule = backoffSchedule({});
  if (!schedule.length) return { should_retry: false, waits: [], note: 'no retries left' };
  return { should_retry: true, waits: schedule.slice() };
}
