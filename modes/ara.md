# Ara — Konum Bazlı İlan Bulma Akışı

Tetikleyici: *"X ilinde veya çevresinde araba arıyorum"* (veya profil güncellemesi).
Girdi: `config/profile.yml`. Çıktı: piyasa taraması + aday listesi + (istenirse)
aday başına A–H raporu.

## Adım 0 — Profil kontrolü

```
node doctor.mjs
```
Eksik alan varsa `modes/intake.md` akışına dön. Profilsiz arama yapılmaz
(il/çevre ve bütçe bilinmeden süzme anlamsız olur).

## Adım 1 — Konum çözümleme

```
node location.mjs --il "Kocaeli" --cevre 1
```
Çıktı: il + komşu iller + plaka kodları + (varsa) feribot bağlantılı iller.
- `radius 0` = sadece il, `1` = komşu iller (varsayılan), `2` = 2 çevre.
- `--feribot 1` ile boğaz/feribot bağlantılı iller dahil edilir.

## Adım 2 — Arama URL'leri

```
node search-urls.mjs --make Fiat --model "Egea Cross" --il Kocaeli --cevre 1 \
  --max 1200000 --yil-min 2022 --km-max 120000
```
Her provider için URL + süzme planı üretir. Filtre eşlemesi **provider sınıflarında**
(`providers/base.mjs` + `config/filters.json`) tanımlıdır; hiçbir filtre sessizce düşmez —
her filtre ya URL'de (query/path), ya rapor süzmesinde, ya da açıkça "desteklenmiyor" olarak bildirilir.

Hangi filtrenin nerede uygulandığını görmek için:

```
node search-urls.mjs --matris
```

Filtre stratejileri üç türlüdür:
- **URL query** (ör. sahibinden `price_max`, arabam `maxPrice` + `currency=TL`)
- **Yol eki** (ör. arabam `fiat-egea-cross-otomatik-benzin` — vites ve yakıt yola gömülür)
- **Rapor süzmesi** (postfilter) — vavacars/otokoc filtreleri JS tabanlı olduğu için
  ve sahibinden'in doğrulanmamış alanları (vites, yakıt, kasa, renk, satıcı, takas…)
  için. Bu durumda liste alınır, süzme `market-scan.mjs` aşamasında yapılır.

## Adım 3 — İlan toplama (agent browser)

Her URL için:
1. Agent browser ile sayfayı aç (rate limit'e saygılı: 20–30 sn/ilan; `providers/rate-guard.mjs`).
2. Liste satırlarını provider ayrıştırıcısıyla oku:
   - `providers/sahibinden.mjs`, `providers/arabam.mjs`,
     `providers/vavacars.mjs`, `providers/otokoc.mjs`
3. Sonuçları normalize JSON olarak biriktir (şema: `providers/base.md` ListingRecord).
4. Bot duvarı/rate limit çıkarsa: `isRateLimited()` ile tespit et, `backoffSchedule()`
   uyarınca bekle; alternatif kaynağa geç (kesintisiz ilerleme).

Toplanan dosya: `data/market/<market>-<tarih>.json`

## Adım 4 — Piyasa taraması

```
node market-scan.mjs --input data/market/<dosya>.json \
  --cap <bütçe üst limiti> --usd <güncel kur> --out data/market/<dosya>.md
```
- Tekilleştirme, yıl bazlı medyan, kaynak dağılımı.
- `--cap`: bütçe üst limiti. Kredi senaryosunda `finansman.mjs` ile hesaplanır:
  ```
  node finansman.mjs --pesinat 800000 --taksit 30000 --vade 24 --faiz 0.035
  ```
- Medyanın %25'inden fazla altındaki ilanlar **"şüpheli ucuz"** işaretlenir.

## Adım 5 — Aday raporları

Seçilen adaylar için `modes/<market>/arac.md` (TR: `modes/tr/arac.md`) A–H raporu
yazılır. Rapor **zorunlu olarak** "Neden alınmalı" ve "Neden alınmamalı" bloklarını
içerir (`modes/_shared.md` denge kuralı).

## Adım 6 — Watchlist ve takip

Onaylanan adaylar `watchlist.yml`'e eklenir ve ilk snapshot alınır:
```
node snapshot-cli.mjs --id <ilan-id> --price <TL> --km <km> --status aktif
node watch-report.mjs
```
Günlük/haftalık snapshot ile `seller-signals.mjs` davranış sinyali üretir:
düzenli indirim → acil satıcı (pazarlık kozu), sil-yeniden-yayın şüphesi.

## Çok kaynaklı doğrulama kuralı

Tek kaynağa bağlı kalınmaz: aynı araç birden fazla platformda olabilir; ayrıca
kaynaklardan biri engellenirse (rate limit/Cloudflare) diğerleri akışı sürdürür.
Aday karşılaştırmasında medyan **tüm kaynakların** birleşiminden hesaplanır.

## Sınırlar (dürüst notlar)

- Piyasa medyanı yalnızca **toplanan ilanlara** dayanır; örneklem küçükse rapor bunu söyler.
- Kredi/faiz oranı ilanda yazmıyorsa **varsayım yapılmaz**; hesap kullanıcının
  belirttiği üst sınırla iki şeritte sunulur.
- Tramer/ekspertiz bilgisi kaynakta yoksa "bilinmiyor" yazılır; tahmin edilmez.
- Hiçbir adımda satıcıyla iletişim kurulmaz, kaporo verilmez (HITL garantisi).
