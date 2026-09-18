# car-ops — Yerel Çalışan İkinci El Araç Karar Sistemi

**"Kocaeli ve çevresinde araba arıyorum, peşinatım 800 bin, ayda 30 bin ödeyebilirim"**
dediğinde ilanları toplayan, piyasa medyanını çıkaran ve her adayı **neden alınmalı /
neden alınmamalı** diye raporlayan yerel araç arayış sistemi.

career-ops'un agentic desenleriyle (prompt dosyaları, veri sözleşmesi, insan-son-karar)
ikinci el araç pazarı için yazılmıştır. Hesap yok, sunucu yok, bağımlılık yok.

## Ne yapar

| Yetenek | Açıklama |
|---|---|
| **Konum bazlı arama** | "X ili ve çevresi" → il + komşu iller (radius 1/2) + feribot bağlantıları; plaka kodlu site filtreleri |
| **Çok kaynaklı tarama** | sahibinden, arabam.com, vavacars, otokoc ikinci el — tek medyanda birleşir |
| **Piyasa medyanı** | Yıl bazlı medyan/min/max/km; medyanın %25+ altındaki ilan "şüpheli ucuz" işaretlenir |
| **Bütçe hesabı** | Peşinat + aylık taksit + vade + faiz → araç üst limiti; banka vs galeri finansmanı şeritleri |
| **Tramer enflasyon normalizasyonu** | 2018'deki 20.000 TL ile 2025'teki 50.000 TL karşılaştırılamaz → TÜFE/USD ile bugüne çevrilir |
| **Fiyat geçmişi sinyali** | İlan fiyatını izler; düzenli indiren satıcıyı "acil satıcı" olarak işaretler; TL mi USD mi gerçek indirim ayırır |
| **Beyan-kayıt çelişkisi** | "Hatаsız" yazan ilanın yapısal alanı "1 değişen, 2 boyalı" diyorsa rapor bunu red-flag olarak yazar |
| **Artı/eksi raporu** | Her araç için A–H blokları + **Neden alınmalı / Neden alınmamalı** + net duruş |
| **Watchlist** | Onayladığın adayları takibe alır; fiyat düşünce davranış karnesi üretir |

## Hızlı başlangıç

```bash
git clone https://github.com/noravels/car-ops.git && cd car-ops
cp templates/profile.template.yml config/profile.yml   # profilini doldur
node doctor.mjs                                        # kurulum kontrolü

node location.mjs --il Kocaeli --cevre 1
node search-urls.mjs --make Fiat --model "Egea Cross" --il Kocaeli --cevre 1 \
  --max 1200000 --yil-min 2022 --km-max 120000
```

Sonra agent'ı aç ve şunu söyle:

> "Kocaeli ve çevresinde araba arıyorum; profilimdeki bütçeyle uygun ilanları bul,
> piyasa medyanını çıkar, adayları artı/eksileriyle raporla."

Detaylı kurulum: [`docs/KURULUM.md`](docs/KURULUM.md)

## Desteklenen CLI'lar

Mantık `modes/*.md` prompt dosyalarında olduğu için herhangi bir AI kodlama CLI'ı
ile çalışır. Birinci sınıf test edilenler:

| CLI | Giriş | Kullanım |
|---|---|---|
| **Hermes Agent** | `AGENTS.md` | bu depoyu açıp sohbet et |
| **Codex** | `CODEX.md` | `codex` / `codex exec "..."` |
| **OpenCode** | `OPENCODE.md` | `opencode` / `opencode run "..."` |

## Nasıl çalışır (mimari)

```
profil + niyet ──► modes/intake.md ──► config/profile.yml
                        │
        location.mjs ────┤  "X ili + çevre" → il listesi + plaka kodları
   search-urls.mjs ─────┤  provider URL'leri (filtreler site destekliyorsa URL'de)
                        ▼
      agent browser ──► providers/*.mjs ──► data/market/*.json
                        │
     market-scan.mjs ───┤  dedupe + yıl medyanı + bütçe adayları
  tramer-normalize.mjs ─┤  TÜFE/USD normalizasyonu (2018 tramer ≠ 2025 tramer)
   seller-signals.mjs ──┤  fiyat düşüşü / kur etkisi / yeniden yayın şüphesi
                        ▼
     modes/tr/arac.md ──► reports/NNN-*.md (A–H + artı/eksi + net duruş)
                        ▼
   watchlist.yml + snapshot-cli.mjs ──► data/snapshots/*.jsonl (fiyat takibi)
```

### Tasarım ilkeleri

- **Local-first:** her şey senin makinen ve dosyaların. Sunucu yok.
- **AI-agnostic:** beyin prompt dosyalarında; tek bir modele bağlı değil.
- **Human-in-the-loop:** sistem satıcıyla iletişim kurmaz, teklif vermez, kaporo
  yatırmaz. Değerlendirir ve önerir; kararı sen verirsin.
- **Kanıt disiplini:** kayıt yokluğu temizlik değildir; doğrulanamayan her alan
  eksiler hanesine yazılır. Faiz oranı, tramer tutarı, piyasa fiyatı **uydurulmaz**.
- **Denge kuralı:** her rapor hem "neden alınmalı" hem "neden alınmamalı" bloğunu
  içerir; sistem satış değil karar aracıdır.

## Sitelerin erişim gerçekliği

| Site | Durum | Not |
|---|---|---|
| sahibinden | ⚠️ rate limit | "Olağan dışı erişim" = ~15 dk blok; 20–30 sn/ilan temposu + `rate-guard.mjs` |
| arabam.com | ⚠️ Cloudflare | kendi tarayıcınla açıp agent'a bağlayınca çalışıyor |
| vavacars | ✅ | kurumsal; indirim tutarı + parça durum raporu yayınlıyor |
| otokoc ikinci el | ✅ | kurumsal; koşulsuz iade + garanti |
| gecmisi.com.tr | ✅ | ilan no ile fiyat geçmişi |
| otonomi / autoexus | ✅ | alternatif kaynaklar |

Engellenen sitede sistem durmaz: diğer kaynaklardan devam eder, engel bilgisini
rapora yazar.

## Testler

```bash
node --test tests/      # 78 test: tramer normalize, konum, arama URL'leri,
                        # satıcı sinyalleri, providerlar, finansman, doctor
```

Geliştirme TDD ile yapılır: önce test, sonra implementasyon.

## Lisans / sorumluluk

Yerel değerlendirme aracıdır; yatırım/alım tavsiyesi değildir. İlan verisi
doğrulanmamış beyan içerebilir — karar öncesi bağımsız ekspertiz ve resmî kayıt
sorgusu (SBM/tramer, TÜVTÜRK, haciz-rehin) şarttır.


## Hızlı kullanım

```bash
# 1) Özellik say → model öner
node catalog.mjs --suggest --max 1260000 --vites otomatik --kasa SUV --yil-min 2021

# 2) Bulunan aracın fiyatı iyi mi? (Bluebook değerlemesi)
node valuation-cli.mjs --fiyat 1198000 --marka "Fiat" --model "Egea Cross" --motor "1.4 Fire" \
  --yil 2025 --km 8288 --ekspertiz var --data data/market/egea-cross-2026-09-18.json

# 3) Katalog durumu
node catalog.mjs --stats
```

Değerleme katmanları, karar bantları ve flag kuralları: `modes/degerleme.md`.
Katalog verisinin nasıl büyütüleceği: `docs/VERI-TOPLAMA.md`.


# 4) Şehir bazlı arama URL'leri (doğrulanmış desenler)
node geo-urls.mjs --iller "İzmir,Manisa,Aydın" --providerlar sahibinden,arabam,renewturkiye


## Provider bakımı

```bash
npm run provider:defter                    # kayıtlı siteler ve doğrulama durumları
npm test                                   # birim + provider sözleşme/fixture testleri
npm run check:providers                    # entegrasyon: tarif doğrulama + fixture ayrıştırma
node provider-check.mjs --from-dump <dump>  # gerçek Chrome dökümüyle entegrasyon kontrolü
node geo-urls.mjs --iller "İzmir,Manisa,Aydın"   # şehir bazlı doğrulanmış URL'ler
```

Yeni site eklemek: `config/providers-generic.json`'a tarif yaz (URL, sayfalama, `extraction`, `geo`, `verified`, `notes`).
Tablo kazıyan sitelerde `table_layout` zorunlu. Ayrıntı: `docs/VERI-TOPLAMA.md` §13.

Açık işler ve bilinen sınırlar: `docs/TODO.md`.

## Değerleme katsayıları ve veri bakımı

```bash
node calibrate.mjs --min 20            # katsayı kestirimi (kendi ilan verimizden)
node calibrate.mjs --yaz --rapor docs/KALIBRASYON.md   # factors.json'a yaz (status: kestirim)
node reparse.mjs --data data/market/<dosya>.json --yaz  # ham kartları yeni ayrıştırıcıyla işle
```
