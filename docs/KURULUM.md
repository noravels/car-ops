# Kurulum — car-ops'u Kendi Araman İçin Kur

car-ops, ikinci el araç arayışını **senin bölgene ve bütçene göre** otomatikleştirir:
"Kocaeli ve çevresinde, peşinatım şu, aylık şunu ödeyebilirim" dersin; sistem ilanları
toplar, piyasa medyanını çıkarır, adayları artı/eksi listesiyle raporlar.

Hiçbir hesap, sunucu veya abonelik gerekmez. Her şey kendi bilgisayarında çalışır.

---

## 1. Gereksinimler

- **Node.js 20+** (`node --version` ile kontrol et)
- **Bir AI kodlama CLI'ı** — mantık prompt dosyalarında olduğu için hangisini
  kullanırsan çalışır:
  - Hermes Agent (bu depoyu açıp sohbet et)
  - Codex (`codex` veya headless: `codex exec "..."`)
  - OpenCode (`opencode run "..."`)
- **Tarayıcı erişimi** (agent'ın kendi browser'ı veya senin Chrome'un)

Kurulum adımı yok: `npm install` gerekmez, bağımlılık yoktur.

## 2. İlk kurulum

```bash
git clone https://github.com/noravels/car-ops.git
cd car-ops

# profil şablonunu kopyala ve doldur
cp templates/profile.template.yml config/profile.yml
$EDITOR config/profile.yml

# kurulum kontrolü
node doctor.mjs
```

`doctor.mjs` eksik alanları ve yapılacakları söyler. Örnek çıktı:

```
{ "ok": false, "missing": [], "warnings": ["konum eksik: il gir", "kredi modu: peşinat eksik"] }
```

## 3. Profilini doldur (kritik)

`config/profile.yml` **senin katmanın**; sistem güncellemeleri buraya dokunmaz.
En az şunlar gerekli:

```yaml
location:
  province: Kocaeli     # il adı veya plaka kodu ("41")
  radius: 1             # 0 = sadece il | 1 = komşu iller | 2 = 2 çevre
budget:
  mode: kredi           # pesin | kredi
  down_payment_try: 800000
  monthly_max_try: 30000
  months: 24
  monthly_rate_max: 0.035   # kabul ettiğin aylık faiz üst sınırı
vehicle_target:
  make: Fiat
  model: Egea Cross
limits:
  year_min: 2022
  km_max: 120000
risk:
  tolerance: low        # low | medium | high
```

> Profilde **yalnızca tercihlerin** olur. Tramer tutarı, ekspertiz sonucu, faiz
> oranı gibi doğrulanabilir bilgiler buraya yazılmaz — onlar ilandan/rapordan gelir.

## 4. Aramayı kur

Konum çözümlemesi (il + çevre):

```bash
node location.mjs --il Kocaeli --cevre 1 [--feribot 1]
```

Bu, il + komşu illeri ve plaka kodlarını verir. Feribot/boğaz bağlantılı iller
(ör. İstanbul ↔ Bursa) ayrıca listelenir.

Provider arama URL'leri:

```bash
node search-urls.mjs --make Fiat --model "Egea Cross" \
  --il Kocaeli --cevre 1 --max 1200000 --yil-min 2022 --km-max 120000
```

Çıktı: her site için hazır URL + süzme planı. Bazı siteler il filtresini URL'de
destekler (sahibinden, arabam), bazıları desteklemez (vavacars, otokoc) → onlarda
süzme rapor aşamasında yapılır ve bu açıkça yazılır.

Tüm filtreler (38 kanonik filtre: vites, yakıt, kasa, renk, satıcı tipi, takas,
ağır hasar, değişen/boyalı parça, motor hacmi/gücü, çekiş, koltuk/kapı, ilan tarihi,
anahtar kelime…) kullanılabilir. Hangi filtrenin hangi sitede nasıl uygulandığını görmek için:

```bash
node search-urls.mjs --matris
```

Doğrulanmamış parametre adları `config/filters.json`'da `verified: false` ile işaretlidir;
sistem bunları uydurmaz, rapor süzmesine düşürür ve planda "(doğrulanmadı)" diye belirtir.

## 5. Agent'a devret

Agent'ı aç ve şunu söyle:

> "Kocaeli ve çevresinde araba arıyorum; profilimdeki bütçeyle uygun ilanları
> bul, piyasa medyanını çıkar ve adayları artı/eksileriyle raporla."

Agent `AGENTS.md` → `modes/ara.md` akışını izler: URL'ler → ilan toplama →
piyasa taraması → aday raporları → watchlist.

Manuel ilerlemek istersen:

```bash
node market-scan.mjs --input data/market/<dosya>.json --cap 1260000 --usd 48.73 --out data/market/<dosya>.md
node snapshot-cli.mjs --id <ilan-id> --price 1015000 --km 26000
node watch-report.mjs
```

## 6. Bütçe hesabı (peşinat + taksit)

```bash
# "peşinatım 800k, ayda 30k ödeyebilirim" → hangi fiyata kadar araç alabilirim?
node finansman.mjs --pesinat 800000 --taksit 30000 --vade 24 --faiz 0.035

# "şu aracı istiyorum, taksiti ne olur?"
node finansman.mjs --pesinat 800000 --hedef 1200000 --vade 24 --faiz 0.035
```

Faiz oranı ilanda yazıyorsa o oran kullanılır; yazmıyorsa sistem **uydurmaz**,
senin belirlediğin üst sınırla hesap yapar ve iki şerit sunar (banka kredisi /
galeri finansmanı).

## 7. Veri nerede durur?

- `data/listings/` — kaydedilen ilanlar (markdown + JSON)
- `data/snapshots/` — fiyat zaman serisi (jsonl, append-only)
- `data/market/` — toplu tarama girdileri ve raporları
- `reports/` — A–H araç raporları
- `watchlist.yml` — takip listesi

Bunların hepsi **senin verin**: git'e commit etmek zorunda değilsin, sistem
güncellemesi bunlara dokunmaz.

## Sorun giderme

| Belirti | Neden / Çözüm |
|---|---|
| Sakıbından'da "Olağan dışı erişim" | Rate limit (~15 dk blok). Bekle, sonra 20–30 sn/ilan temposuyla devam et (`providers/rate-guard.mjs`). |
| Cloudflare "Bir dakika lütfen" | Otomatik erişim engellendi; kendi tarayıcından açıp agent'a bağlanmasını söyle ya da ilan HTML'ini paste moduna ver. |
| Tüm providerlar boş liste | Marka/model yolu hatalı olabilir; `config/filters.json` içindeki yol/parametre şemasını sitede doğrula. |
| `doctor.mjs` "unpersonalized" diyor | Profil hâlâ şablon içeriği taşıyor; doldur. |

## Filtre parametrelerini öğrenme (bloklanan siteler için)

Bazı siteler otomatik gezintiyi engeller, bu yüzden filtre parametre adlarını
sistem kendi kendine keşfedemez. Uydurmak yerine şu yolu izle:

1. Kendi tarayıcında siteyi aç, **tek bir filtre** uygula (ör. sadece "Otomatik vites").
2. Adres çubuğundaki URL'i kopyala.
3. Aracı çalıştır:

```bash
node learn-params.mjs --provider sahibinden \
  --base "https://www.sahibinden.com/fiat-egea-cross" \
  --filter gearbox --filtered "<vites filtrelenmiş URL>" \
  --filter fuel  --filtered "<yakıt filtrelenmiş URL>"
```

Araç iki URL'i karşılaştırır, farktan parametre adını (query) veya yol ekini (path)
çıkarır ve `config/filters.json` için yapıştırılabilir bir yama bastırır.
Fark yoksa filtreyi dürüstçe "rapor süzmesi" olarak önerir — parametre adı uydurulmaz.

## Diğer marketler

Şu an TR tam destekli. Başka bir ülke için:
1. `config/markets.yml`'e yeni market bloğu (para birimi, dil, konum modeli).
2. `config/locations/<ülke>-regions.json` (bölge/il/plz haritası).
3. `config/inflation/<ülke>-vpi.json` (enflasyon normalizasyonu için).
4. `modes/<dil>/` market sözlüğü (TR'de: tramer, ekspertiz, galeri, pert…).
5. `providers/<site>.mjs` + `config/search-params.json` kaydı.

Çekirdek (skorlama, tramer normalizasyonu, snapshot, rapor iskeleti) değişmez.
