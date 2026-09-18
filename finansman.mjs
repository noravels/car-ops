// finansman.mjs — Akış 1'in çekirdeği:
// peşinat + aylık bütçe + vade + aylık faiz → aracın üst bütçe sınırı
// ve tersini (bütçenin gerekli taksiti). Galeriler kendi finansmanını yapabilir;
// bu yüzden faiz senaryoları banka/kredi + galeri finansmanı olarak üretilir.

const TR_FC_MONTHLY_RATE_LIMIT = 0.035;

// Kullanıcı "faiz %3.5'in altındaysa" dedin: >= %3.5 ayda bir biçimde reddedilir.
export function normFcRate(monthlyRate) {
  const r = Number(monthlyRate);
  if (!Number.isFinite(r) || r < 0) return { ok: false, note: 'faiz geçersiz' };
  //IST NOMINE %3.5 üstü senaryoyu reddet
  if (r >= TR_FC_MONTHLY_RATE_LIMIT) {
    return {
      ok: false,
      note: `aylık faiz %${(r * 100).toFixed(2)} kabul edilen %3,50 sınırının üstünde — vadeyi kısalt veya başka finansman (banka/kredi) dene`,
      rate: r,
    };
  }
  return { ok: true, note: `aylık faiz %${(r * 100).toFixed(2)} kabul; üstünde ise vade kısalt` , rate: r };
}

// Peşinat + kredi tutarı = araç fiyatı. Kredi tutarı = taksit akışının bugünkü değeri.
export function maxVehiclePrice({ pesinat, taksit, vade_ay, aylik_faiz, fc_rate_note = true }) {
  const rNorm = normFcRate(aylik_faiz);
  const i = aylik_faiz;
  let loan = null;
  if (i <= 0) {
    loan = taksit * vade_ay;
  } else {
    loan = taksit * (1 - Math.pow(1 + i, -vade_ay)) / i;
  }
  const cap = Math.floor(pesinat + loan);
  return {
    vehicle_cap: cap,
    loan_amount: Math.round(loan),
    total_cost: pesinat + taksit * vade_ay,
    faiz_ok: rNorm.ok,
    note: rNorm.ok ? rNorm.note : rNorm.note,
  };
}

// Ters hesap: belli bir fiyatı karşılayacak aylık taksit
export function monthlyFromScenario({ pesinat, fiyat, vade_ay, aylik_faiz }) {
  const kredi = fiyat - pesinat;
  if (kredi <= 0) return { taksit: 0, kredi: 0 };
  const taksit = kredi * aylik_faiz / (1 - Math.pow(1 + aylik_faiz, -vade_ay));
  return { taksit, kredi };
}

// İki senaryo üretir: banka kredisi (verilen faiz) ve galeri finansmanı
// (%25 peşinat şartı ve +0,5 faiz varsayımı — parametrelerle override edilebilir)
export function scenarioTable({ pesinat, taksit_ceiling, vade_ay, aylik_faiz }) {
  const bank = maxVehiclePrice({
    pesinat, taksit: taksit_ceiling, vade_ay, aylik_faiz, fc_rate_note: false,
  });
  // galeri senaryosu: peşinatın en az %25'i şart ve aylık faiz +0.5 puan yükseltir
  const galfc = aylik_faiz + 0.005;
  const gal = maxVehiclePrice({
    pesinat: Math.max(pesinat, 0.25 * (pesinat + taksit_ceiling * vade_ay)),
    taksit: taksit_ceiling, vade_ay, aylik_faiz: galfc, fc_rate_note: false,
  });
  return [
    { label: 'banka/kredi kurumu', ...bank },
    { label: 'galeri finansmanı (peşinat %25 + faiz +0.5)', ...gal },
  ];
}

export function renderBudget({ pesinat, taksit, vade_ay, aylik_faiz }) {
  const caps = scenarioTable({ pesinat, taksit_ceiling: taksit, vade_ay, aylik_faiz});
  const fmt = n => Math.round(n).toLocaleString('tr-TR');
  const lines = [];
  lines.push(`Bütçe: peşinat ${fmt(pesinat)} TL + aylık ≤ ${fmt(taksit)} TL × ${vade_ay} ay (aylık faiz %${(aylik_faiz*100).toFixed(2)})`);
  for (const s of caps) {
    lines.push(`- ${s.label}: araç üst limiti ≈ ${Math.round(s.vehicle_cap).toLocaleString('tr-TR')} TL${s.note ? ' — ' + s.note : ''}`);
  }
  return lines.join('\n');
}

// CLI: node finansman.mjs --pesinat 800000 --taksit 25000 --vade 24 --faiz 0.0349 [-hedef fiyat]
export async function runCli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') { _help(); return; }
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  const pesinat = Number(args.pesinat || 0);
  const taksit = Number(args.taksit || 0);
  const vade_ay = Number(args.vade || 24);
  const aylik_faiz = args.faiz != null ? Number(args.faiz) : 0.0349;
  if (!pesinat) { _help(); process.exitCode = 1; return; }
  if (args.hedef) {
    const fmt = n => Math.round(n).toLocaleString('tr-TR');
    const m = monthlyFromScenario({ pesinat, fiyat: Number(args.hedef), vade_ay, aylik_faiz });
    console.log(`Fiyat ${fmt(args.hedef)} TL için peşinat ${fmt(pesinat)}:
- gerekli kredi: ${fmt(m.kredi)} TL
- gerekli aylık taksit: ${fmt(m.taksit)} TL (${vade_ay} ay, aylık faiz %${(aylik_faiz*100).toFixed(2)})`);
    return;
  }
  if (!taksit) { _help(); process.exitCode = 1; return; }
  console.log(renderBudget({ pesinat, taksit, vade_ay, aylik_faiz }));
}

function _help() {
  console.log(`kullanım:
  node finansman.mjs --pesinat 800000 --taksit 25000 --vade 24 --faiz 0.0349
  node finansman.mjs --pesinat 800000 --hedef 1200000 --vade 24 --faiz 0.0349
`);
}

if (process.argv[1] && process.argv[1].endsWith('finansman.mjs')) {
  await runCli(process.argv.slice(2));
}
