# Veri Toplama Rehberi — Genel Araba Bilgisi ve İlan Verisi

Bu doküman, car-ops'un "özellik saydığında model öner" yeteneğini besleyen **katalog
veri bankasının** nasıl doldurulacağını anlatır. İki tür veri vardır ve ikisi
karıştırılmaz:

| Katman | Ne içerir | Kaynak | Nerede saklanır |
|---|---|---|---|
| **observed** | Toplanan ilanlardan GÖZLENEN dağılımlar (fiyat/yıl/km aralıkları, yakıt/vites/kasa oranları, ilan sayısı) | `providers/*` ile toplanan ilanlar | `data/catalog/catalog.json` |
| **taxonomy** | Marka/model/seri sınıflaması + ilan hacmi | sahibinden/arabam kategori yapısı | `data/catalog/taxonomy/*.json` |
| **specs** | Teknik özellik özeti (kasa, yakıt, vites, yıl, fiyat aralığı, motor/paket sayısı) | Oto360 (JATO Dynamics lisanslı) | `data/catalog/specs/*.json` |

**Altın kural:** hiçbir teknik özellik uydurulmaz. Bir alan gözlemlenmediyse
öneri çıktısında "belirsiz" olarak görünür.

---

## 1. Marka envanteri (taxonomy)

Sahibinden otomobil kategorisi, markaları **ilan sayısıyla** listeler.

- Sayfa: `https://www.sahibinden.com/kategori/otomobil`
- Çıkarılacak: `marka adı (ilan sayısı)` çiftleri
- Kaydet: `data/catalog/taxonomy/brands-tr.json`

```bash
node catalog.mjs --learn-taxonomy data/catalog/taxonomy/brands-tr.json
```

Örnek (2026-09-18 alındı): 99 marka; BMW 27.777, Audi 16.196, Citroen 9.556, Dacia 3.681, Alfa Romeo 732 …

## 2. Model/seri envanteri (marka bazında)

Her marka sayfası (`https://www.sahibinden.com/<marka-slug>`, ör. `/fiat`) o markanın
**serilerini ve seri altı varyantlarını** ilan sayılarıyla listeler.

- Çıkarılacak: seri adı + ilan sayısı (+ varsa model yolu)
- Kaydet: `data/catalog/taxonomy/<marka>-models.json`
- İşle:

```bash
node catalog.mjs --learn-taxonomy data/catalog/taxonomy/fiat-models.json
```

## 3. Teknik özellik özeti (specs)

Sahibinden Oto360, sıfır araç teknik verisini JATO Dynamics'ten alır ve model
başına özet sayfa sunar:

- URL deseni: `https://www.sahibinden.com/oto360/sifir-araclar/<marka>-<model>-fiyat-listesi`
  (ör. `fiat-egea-cross-fiyat-listesi`, `fiat-egea-fiyat-listesi`)
- Sayfadan okunacak alanlar: **Marka, Model, Kasa Tipi, Yıl, Vites, Yakıt/Motor Tipi,
  fiyat aralığı (TL), "toplam N farklı motor ve paket seçeneği"**
- Ayrıca sayfa altındaki "Diğer <marka> Modelleri" listesi, o markanın **güncel
  model envanterini** verir (taxonomy'yi doğrulamak için kullanılır).
- Kaydet: `data/catalog/specs/<marka>-<model>.json`

Örnek kayıt:

```json
{
  "make": "Fiat", "model": "Egea Cross",
  "body": "SUV", "fuel": "Dizel", "gearbox": "Otomatik", "year": 2026,
  "price_min_try": 1890900, "price_max_try": 1999900, "variant_count": 4,
  "source": "sahibinden.com/oto360/sifir-araclar/fiat-egea-cross-fiyat-listesi",
  "license": "JATO Dynamics", "fetched_at": "2026-09-18"
}
```

```bash
node catalog.mjs --learn-specs data/catalog/specs     # klasördeki tüm .json
```

> Lisans notu: Oto360 teknik verisi JATO Dynamics telifli; kaynak ve lisans alanları
> kayıtta tutulur, raporlarda kaynak belirtilir.

## 4. İlan verisi (observed) — asıl büyüme buradan

Model önerisinin gücü, **çok modelden ilan görmekten** gelir. Çapraz marka taraması:

```bash
# Örnek: bütçe altı, otomatik, 2021+ SUV/crossover — tek URL, çok model
node search-urls.mjs --kasa suv --vites otomatik --max 1260000 --yil-min 2021
```

Çıkan URL'i agent browser ile 2-3 sayfa dolaş, satırları çıkar:

sahibinden liste satır hücreleri: `[.., Marka, Model(seri), Varyant, Başlık, Yıl, KM, Fiyat, Tarih, İl/İlçe, ..]`

Kaydet → `data/market/<tarama-adı>.json`, sonra:

```bash
node catalog.mjs --learn data/market/<tarama-adı>.json
```

**Filtre gereği bilinen alanlar:** tarama URL'inde filtre uygulandıysa (ör. `a6=32466`
otomatik), o alan ilan kaydına **filtre garanti ettiği için** yazılabilir. Kayda
`attribute_source` alanı ekle (ör. `"sahibinden filtre: a6=32466 (otomatik)"`) — böylece
özelliğin tahmin değil filtre kaynaklı olduğu izlenebilir kalır.

## 5. Öneri üretme

```bash
# Özellik say → model öner
node catalog.mjs --suggest --max 1260000 --vites otomatik --kasa SUV --yil-min 2021 --km-max 120000

# Katalog durumu
node catalog.mjs --stats
```

Çıktı: model listesi, uyum yüzdesi, **kaç ilana dayandığı**, hangi kriterlerin
gözlemlenmediği (belirsiz), medyan fiyat/yıl aralığı ve varsa teknik veri kaynağı.

`--suggest` kriterleri: `--max --min --vites --yakit --kasa --renk --satici --yil-min
--km-max --il --hp-min`

## 6. Katalog bakımı

- Aynı ilan iki kez öğrenilmez (kaynak+ilan no veya model+yıl+km+fiyat ile tekilleştirme).
- Katalogdan **kayıt silinmez**; bilgi birikir. Yanlış kayıt varsa `data/catalog/catalog.json`
  içinde ilgili modelin `observed` bloğu elle düzeltilebilir (dosya kullanıcı katmanında).
- Hangi modelin teknik verisi eksik: `node catalog.mjs --stats` + `specsCoverage()` çıktısı.


---

## 7. Provider durumu ve toplama yöntemleri (2026-09-18 ölçümü)

| Provider | Durum | Toplama yöntemi | Not |
|---|---|---|---|
| **sahibinden.com** | ✅ Çalışıyor | `?pagingSize=50&pagingOffset=N` + gerçek filtre parametreleri (bkz. §8) | Bot korumalı: **20 sn/ sayfa** tempoyla git; hızlı gezinme "olağan dışı erişim" bloğu tetikler |
| **arabam.com** | ✅ Çalışıyor | `?currency=TL&maxPrice=…&take=50&page=N&sorting=startedAt.desc` | `currency=TL` yoksa fiyat filtresi **sessizce yok sayılır**; hücrede iki fiyat varsa ilki eski (üstü çizili) fiyattır → `price_drop_try` |
| **vava.cars** | ✅ Çalışıyor | `https://tr.vava.cars/buy/cars/` + "N tane daha göster" düğmesi | Kartlar **en zengin**: hasar etiketi ("Boyasız, değişensiz, tramersiz"), kasa, yakıt, vites, plaka, fiyat |
| **carvak.com** (eski kavak) | ✅ Çalışıyor | `/tr/satilik-arac/<marka>` (marka/model/yıl yolları); kart çıkarımı **loose-price** deseni ister | Kart: `Volkswagen • Polo | 2023 • 122.222 km • 1.0 TSI Life • Otomatik | ₺ | 1.278.000` — ₺ ayrı span'da olduğu için `normalizeCardText` birleştirir. 16 markada 68/68 kart ayrıştı. Sayfalama deseni yok |
| **ikinciyeni.com** | ⚠️ API bekliyor | `POST https://apigw.ikinciyeni.com/ListedVehicles` | Uç açık ve JSON döner ama filtre gövdesi şeması bilinmiyor (denenen 12 gövde → `totalCount: 0`). Şema, sayfada filtre etkileşimi sırasında `fetch` kancasıyla yakalanmalı |
| **otokocikinciel.com** | ⚠️ Kısmi | `/ikinci-el/<marka>/<model>` sayfaları açılıyor ama ilanlar JS ile geliyor | Stok az; model sayfası "stok yok" durumunu metin olarak veriyor |
| **otomerkezi.net** | ⚠️ Kısmi | `/ikinci-el` | Liste JS ile; `trinkoto.com` (grup sitesi) **ücretsiz değerleme** servisi sunuyor — Oto360 alternatifi olabilir |

**Kural (kalıcı):** bot duvarını aşmaya çalışılmaz. Erişim kullanıcının gerçek Chrome oturumu (CDP) üzerinden, insan temposuyla yapılır; API şeması bilinmiyorsa **tahmin edilmez**, yakalanır.

## 8. Toplanan veri setleri (2026-09-18)

| Dosya | Kaynak | Adet | Kapsam |
|---|---|---|---|
| `data/market/tr-sahibinden-genis-2026-09-18.json` | sahibinden | 454 | otomobil + arazi-suv-pickup, ≤1.5M TL ve ≤700K TL bantları |
| `data/market/tr-arabam-genis-2026-09-18.json` | arabam | 599 | otomobil ≤1.5M TL (12 sayfa) |
| `data/market/tr-vavacars-genis-2026-09-18.json` | vava.cars | 29 | kurumsal stok, hasar etiketli |
| `data/market/tr-suv-crossover-scan-2026-09-18.json` | sahibinden | 151 | SUV/crossover, otomatik, ≤1.26M |
| `data/market/egea-cross-2026-09-18.json` | 5 kaynak | 38 | Egea Cross aday havuzu |

Katalog (2026-09-18): **318 model, 1.271 ilan örneği, 99 marka sınıflaması, 2 teknik özellik kaydı.**

## 9. Katalogun değerlemeyi beslemesi

Katalog artık ilan **örneklerini kalıcı** tutar (`observed.samples`), bu yüzden değerleme karşılaştırma seti doğrudan katalogdan alınabilir:

```bash
node valuation-cli.mjs --katalog --fiyat 1015000 --marka "Fiat" --model "Egea Cross" \
  --motor "1.4 Fire" --yil 2023 --km 26000 --tramer 38000 --tramer-yil 2023 --boyali 2 --degisen 1
```

- Örnekler `source`, `variant`, `body`, `fuel`, `gearbox`, `city` alanlarını taşır → motor ailesi filtresi ve çelişen yakıt sınıfı dışlama katalogdan beslenen sette de çalışır.
- Model başına üst sınır 2000 örnek (`MAX_SAMPLES`); aşılırsa en yeni örnekler tutulur.
- Düzeltme: örnekler dosyaya yazılmayınca istatistikler her yüklemede son partiden hesaplanıyordu (Clio: 67 ilan görülmüş, sayı 3 görünüyordu) → `observed.samples` kalıcılığı ile giderildi; regresyon testi `tests/catalog-specs.test.mjs` içinde.

## 10. Bant genişletme (değerleme)

Katı bant (yıl ±1, km ±%35) sonrası örneklem 4'ün altındaysa otomatik genişletilir: **km ±%60 → yıl ±2**. Genişletme raporda `bant genişletildi:` olarak yazılır; motor ailesi filtresi her durumda korunur.


---

## 11. Yeni provider'lar (2026-09-18 keşfi ve doğrulaması)

İzmir çevresinden başlanarak ulusal kurumsal galeri siteleri tarandı:

| Provider | Erişim | Kart alanları | Toplanan |
|---|---|---|---|
| **renewturkiye.com** | ✅ | marka model · varyant · yıl · km · yakıt · vites · fiyat (21 kart/sayfa) | 63 ilan (İzmir/İstanbul/Ankara) |
| **otoplus.com** | ✅ | marka · yıl · varyant · fiyat (**km yok**) | 72 ilan (yalnızca İstanbul şehir sayfası + genel liste) |
| **otofora.com** | ✅ | yıl + marka model varyant · fiyat · yakıt · kasa · vites (İzmir merkezli) | 10 ilan |
| **otosor.com.tr** | ✅ | marka model varyant · **peşin fiyat** · taksit · vites · km · yıl | `?page=N` çalışıyor (20 kart/sayfa); peşin fiyat ile taksit ayrı okunur |
| **spoticar.com.tr** | ✅ | marka model · varyant · km · yakıt · yıl · vites · fiyat (**boşluklu binlik**: `1 550 000 TL`) | 54 ilan, 5 şehir sayfası doğrulandı |
| **otosistem.com** | ⚠️ | — | Galeri rehberi (İzmir 810 galeri); ilan kartı yok, dizin olarak değerli |

**Kart ayrıştırma tuzakları (düzeltildi ve teste bağlandı):**
- `Peugeot 2008 / 3008 / 5008` → model adı yıl sanılıyordu. Yıl artık önce **tek başına duran yıl segmentinden** alınır; modele gömülü 4 haneli sayılar Peugeot ailesi için yıl sayılmaz.
- `₺130.743 x 12 ay` → taksit tutarı ana fiyat sanılıyordu. Yalnızca `x N ay` ile takip edilen tutarlar elenir; `₺` önekli ana fiyat korunur.
- `0 KM` beyanı → km istatistiğini bozmasın diye km=null yapılır ve `notes` alanına gerekçe yazılır.
- `Istanbul / İstanbul` ikilemi → şehir adları normalize edilir.
- **Binlik ayırıcı boşluk olabilir** (`1 550 000 TL`) → `parseTrNumber` nokta/boşluk/NBSP destekler. Ayrıca `toLowerCase()` Türkçe **'İ'** harfini 2 kod noktasına çevirdiği için konum hesaplarında indeks kayar (km konumu orijinal metinden bulunur).
- **Kırıntı kartlar**: çıkarıcı yalnızca fiyat bloğunu kart sanabilir → metin `₺/TL` ile başlıyorsa atlanır.

## 12. Coğrafi tarama (İzmir çevresi → İstanbul/Ankara)

Repo verisi: **İzmir'in komşuları Manisa, Aydın, Balıkesir** (`config/locations/tr-provinces.json`).

`geo-urls.mjs` provider başına **doğrulanmış** şehir URL'lerini üretir; doğrulanmamış desende URL üretilmez (sessiz filtresiz arama tuzağı — arabam `cityId=34` yok sayılıyordu):

```bash
node geo-urls.mjs --iller "İzmir,Manisa,Aydın" --providerlar sahibinden,arabam,renewturkiye
```

| Provider | Şehir mekanizması | Örnek | Durum |
|---|---|---|---|
| sahibinden | `address_city=<plaka, sıfırsız>` | `?address_city=35` | ✅ doğrulandı |
| arabam | yol: `/ikinci-el/<slug>` | `/ikinci-el/aydin` | ✅ doğrulandı (şehir sayfasında km kolonu yok) |
| renewturkiye | yol: `/otomobil/<slug>` | `/otomobil/manisa` | ✅ doğrulandı |
| otoplus | yol: `/<slug>-ikinci-el-araba` | `istanbul-ikinci-el-araba?sayfa=N` | ✅ sadece İstanbul |
| otosor | yol: `/araclar/<slug>-ikinci-el-araba` | — | ⚠️ statik blok |
| vavacars / otokoc / carvak / ikinciyeni | URL ile taşınmıyor | — | URL üretilmez |

**Toplanan coğrafi veri (2026-09-18):**

| Dosya | Kaynak | Adet | İller |
|---|---|---|---|
| `data/market/tr-geo-sahibinden-2026-09-18.json` | sahibinden | 507 | İzmir 102, Manisa 102, Aydın 101, İstanbul 101, Ankara 101 |
| `data/market/tr-geo-arabam-2026-09-18.json` | arabam | 499 | İzmir 99, Manisa 100, Aydın 100, İstanbul 100, Ankara 100 |
| `data/market/tr-yeni-providerlar-2026-09-18.json` | renew/otoplus/otofora | 145 | İzmir 31, İstanbul 68, Ankara 21 |


---

## 13. Generic provider ve provider entegrasyon testleri (2026-09-18)

### 13.1 Tarif tabanlı provider

Yeni bir site eklemek için KOD yazılmaz; `config/providers-generic.json`'a **tarif** yazılır:

```json
"otosor": {
  "label": "Otosor",
  "homepage": "https://www.otosor.com.tr",
  "listing_url": "https://www.otosor.com.tr/araclar/izmir-ikinci-el-araba",
  "extraction": "text-pattern",
  "geo": { "mode": "path", "template": "https://www.otosor.com.tr/araclar/{slug}-ikinci-el-araba", "verified": false },
  "pacing_seconds": 8,
  "verified": "pending",
  "notes": "Desen var ama liste statik blok; sayfalama JS ile."
}
```

Tarifi `providers/generic.mjs` uygular; çıkarım `lib/card-parse.mjs` ile yapılır (fiyat merkezli, taksit/model-yılı tuzakları çözülmüş).

**Kurallar:**
- `verified` üç durumdan biri: `verified | pending | blocked`. `extraction: none|api` iken `verified` olamaz (çelişki testi var).
- `extraction: table` olan tariflerde **`table_layout` zorunlu**: kolon düzeni doğrulanmadan tablo ayrıştırılmaz (sahibinden ve arabam'ın kolon düzenleri farklıdır — bu, entegrasyon kontrolünde yakalanan gerçek bir hataydı).
- `geo` doğrulanmadıysa `geoUrl()` **null** döner; sessizce filtresiz arama yapılmaz.

### 13.2 Entegrasyon kontrolü — `provider-check.mjs`

```bash
npm run check:providers                      # çevrimdışı: tarif doğrulama + capability matrisi + fixture
npm run check:providers:live -- --idler renewturkiye,otoplus   # CDP üzerinden canlı (Chromium debug)
node provider-check.mjs --from-dump data/provider-dumps/2026-09-18.json   # DOM dökümüyle kontrol
```

Durumlar: `ok` (≥3 satır ve ≥%60 ayrıştı), `empty` (sayfa liste vermedi — JS/API ile geliyor olabilir), `low-parse` (kartlar var ama ayrışmıyor → ayrıştırıcı/tarif güncellenmeli), `error`.

**Bu makinedeki CDP gerçeği (2026-09-19'da çözüldü):** Chrome 9222'de dinliyor ama **HTTP uçları 403 "Connection rejected"** veriyor
(`/json/version`, `/json/list`, `/`) — sanılanın aksine bir proxy değil, Chrome'un kendi kısıtı. Buna karşılık
**`GET /devtools/browser` + `Upgrade: websocket` → 101** kabul ediliyor (UUID gerekmiyor).
`lib/cdp.mjs` bu yüzden HTTP keşfini bırakıp **doğrudan WS'e bağlanıyor** ve sekmeleri `Target.getTargets` /
`Target.createTarget` ile buluyor. Ek düzeltmeler:
- `Page.navigate` bazı sitelerde asılı kalıyor → hedef **doğrudan URL ile** oluşturulur (`Target.createTarget({url})`).
- Yavaş siteler için registry'de `live_wait_ms` alanı (ör. otomerkezi 18 sn).
- Hâlâ `--from-dump` yolu var: taze sekmede yüklenmeyen siteler (ör. otomerkezi) için.

**Canlı kontrol sonucu (2026-09-19):** 10 sağlayıcı · 9 `ok` · 1 `empty` (gerekçeli).

### 13.3 Test paketleri (update sonrası çalıştır)

```bash
npm test                 # 198 test: birim + sözleşme + fixture (ağ gerekmez)
npm run test:providers   # yalnızca provider sözleşme/fixture testleri
npm run check:all        # npm test + check:providers
```

- `tests/providers/contract.test.mjs`: her provider kimlik/çıkarım/durum/geo sözleşmesine uyar; fixture kartlarının ≥%80'i ayrışmalı; tablo düzeni yanlışsa **açıkça hata** verir.
- `tests/fixtures/provider-cards.json`: canlı toplanmış GERÇEK kart metinleri (site değişirse test kırılır → fark edilir).
- `tests/card-parse.test.mjs`: tuzak vakaları (Peugeot 2008 yıl, taksit-fiyat, 0 KM, iki kelimeli model, ₺ önek/sonek).
- `data/provider-checks/`: her kontrolün JSON raporu (hangi sağlayıcı o gün kaç satır verdi).

### 13.4 Son kontrol sonucu (2026-09-18, gerçek Chrome dökümü)

| provider | mod | kayıt | ayrışan | durum |
|---|---|---|---|---|
| renewturkiye | text-pattern | 21 | 21 | ✅ |
| otoplus | text-pattern | 12 | 12 | ✅ |
| otofora | text-pattern | 12 | 10 | ✅ |
| vavacars | text-pattern | 12 | 12 | ✅ |
| sahibinden | table | 50 | 50 | ✅ |
| arabam | table | 50 | 50 | ✅ |
| otosor / spoticar / otokoc | — | 0 | 0 | ⚠️ empty (beklenen: liste JS/API ile) |
