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
| **carvak.com** (eski kavak) | ⚠️ API bekliyor | Liste DOM'da yok; `carvak.com/advanced-search-api/public/v2/...` (NestJS) | Uç yolları bilinmiyor: sayfa filtresini tetikleyip `fetch`/XHR kancasıyla yakalanmalı. kavak.com → carvak.com'a yönleniyor |
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
