# car-ops — Yapılacaklar

Her madde: **ne biliniyor → sonraki adım → kabul kriteri**. Durum etiketleri:
`açık` · `devam` · `bloklu` · `bitti`. Kapanan madde silinmez, "bitti" olarak işaretlenir
ve hangi commit'te kapandığı yazılır.

---

## P1 — CDP soket keşfi (provider-check --live doğrudan çalışsın)

**Durum:** `açık` · 2026-09-18

**Ne biliniyor:**
- Hermes browser katmanı `BU_CDP_URL=http://127.0.0.1:9222` ile çalışıyor ve sekmeleri görebiliyor.
- Aynı portta Chrome dinliyor (`lsof`: Google, fd 107u, `127.0.0.1:9222 LISTEN`).
- Ama saf HTTP istekleri **her yolda 404**: `/json/version`, `/json`, `/json/list`, `/json/new`, `/devtools/inspector.html`.
- Bu yüzden `node provider-check.mjs --live` tarayıcı sürümünü okuyup sekme açamıyor; şu an `--from-dump` ile (gerçek Chrome'dan alınan DOM dökümü) kontrol yapılıyor.
- Tahminler: (a) 9222 bir proxy/pipe köprüsü, gerçek DevTools başka portta; (b) Chrome `--remote-debugging-pipe` ile açılmış; (c) HTTP uçları `--remote-debugging-origins` ile kısıtlı.

**Sonraki adım:**
1. Chrome sürecinin tam komut satırını oku (`ps -Ao pid,command | grep -i chrome` — `--remote-debugging-*` bayraklarını ara).
2. Tüm dinleyen TCP portlarını `/json/version` ile tara (şablon: `provider-check.mjs` içindeki `cdpAvailable`); Chrome'a ait olanı bul.
3. Bulunamazsa: Chrome'u bilerek `--remote-debugging-port=<port> --remote-allow-origins=*` ile ayrı profilde açıp `CAROPS_CDP_URL` ile script'e ver.
4. `--live` sonucunu `--from-dump` sonucuyla karşılaştır (aynı sayı gelmeli).

**Kabul kriteri:** ✅ **KARŞILANDI** (2026-09-19) — `npm run check:providers:live` agent aracı olmadan 10 sağlayıcıyı kontrol etti; 9'u `ok` (sahibinden 21, arabam 20, renewturkiye 21, vavacars 18, otosor 12, otoplus 12, otofora 12, carvak 9, spoticar 11 satır), 1'i (`otomerkezi`) `empty` + gerekçe. Rapor `data/provider-checks/<tarih>-live.json`.

**ÇÖZÜM:** Chrome 9222'de dinliyor ama **HTTP uçları 403 "Connection rejected"** döndürüyordu (`/json/version`, `/json/list`);
buna karşılık **`/devtools/browser` yolunda WebSocket el sıkışması 101** ile kabul ediliyor (UUID gerekmiyor).
`lib/cdp.mjs` artık HTTP keşfine güvenmiyor: sırayla HTTP → doğrudan WS dener, hedefleri `Target.*` ile bulur.
Ayrıca bazı sitelerde `Page.navigate` asılı kaldığı için hedef doğrudan URL ile oluşturuluyor (`Target.createTarget({url})`).

**Kalan sınır:** `otomerkezi` taze CDP sekmesinde gövde 0 döndürüyor (oturum/sekme davranışı). Bu sağlayıcı için
doğrulama `--from-dump` veya agent akışıyla yapılır; registry notunda yazılı.

---

## P2 — carvak ve ikinciyeni API şemaları (`pending` → `verified`)

**Durum:** `devam` — **carvak BİTTİ** (2026-09-19), ikinciyeni açık

**carvak ÇÖZÜMÜ (API'ye gerek kalmadan):** Liste API'de değil, DOM'da bulundu. Kart biçimi:
`Volkswagen • Polo | 2023 • 122.222 km • 1.0 TSI Life • Otomatik | ₺ | 1.278.000`.
Fiyat ile ₺ **ayrı span**'da olduğu için standart fiyat deseni kartı bulamıyordu; iki düzeltme yapıldı:
(a) `normalizeCardText` para birimi ile tutarı birleştirir ("₺ | 1.278.000" → "₺ 1.278.000") ve `•` ayırıcıyı boşluğa çevirir,
(b) varyant yıl/km ile aynı segmentte geldiğinde `stripVariantNoise` temizler ("2023 122.222 km 1.0 TSI Life Otomatik" → "1.0 TSI Life").
Sonuç: 16 marka sayfasından **68/68 kart (%100) ayrıştı**, `verified`; katalog 424 model / 2428 ilan.
Sayfalama deseni hâlâ yok (marka/model/yıl yolları kullanılıyor).

**ikinciyeni (`bloklu`, neden belgelendi):** İstek şeması **yakalandı** — `tools/capture-api.mjs` (CDP `Network` alanı) ile:
`POST apigw.ikinciyeni.com/ListedVehicles` gövdesi `{page,pageSize,sortingType,endedVehicles,isFavorite,filter:{brands,fuelTypes,gearTypes,colors,locations,isAuction,isListing,auctionListFilterIds}}`.
Ancak hem sitenin kendi çağrısı hem 8 gövde varyasyonu **`totalCount: 0`** döndürüyor ve sayfa ilan render etmiyor → envanter herkese açık değil (giriş/şube şartı).
Çözüm yolu: kullanıcı giriş yaptığı oturumda aynı araç çalıştırılır; şema registry'de `api_call` olarak kayıtlı.
- ikinciyeni: `POST https://apigw.ikinciyeni.com/ListedVehicles` açık ve JSON döndürüyor (`{data:{vehiclesList,totalCount,brands,...}}`) ama 12 farklı gövde denemesinde `totalCount: 0` → filtre gövdesi şeması bilinmiyor.

**Sonraki adım:** Sayfada **gezinmeden** `fetch`/`XHR.open` kancası kur (`window.__cap`), sonra filtre etkileşimini tetikle (marka seç, "Ara"/sayfalama) ve yakalanan istek gövdesini oku. Şema yakalanınca `extraction: "api"` tarifini `verified`'a çevir.

**Kabul kriteri:** İki sağlayıcıdan da ≥20 ilan, `lib/card-parse.mjs` alanlarıyla (marka/model/yıl/km/fiyat) normalize edilmiş halde katalogda.

---

## P3 — JS ile gelen liste siteleri (spoticar, otokoc, otomerkezi)

**Durum:** `bitti` (2/3) · 2026-09-19 · **spoticar ✅ · otomerkezi ✅ · otokoc açık**

**Çözüm:** Liste DOM'daydı; engel **ayrıştırıcı** ve **çıkarıcı** deseniydi:
- spoticar binlik ayırıcı olarak **boşluk** kullanıyor (`1 550 000 TL`, `114 066 km`) → `parseTrNumber` nokta/boşluk/NBSP desteği.
- Çıkarıcı, kart içindeki **fiyat bloğu kırıntılarını** da kart sanıyordu (`₺ 1.378.750 | ₺130.743 x 12 ay | …`) → çıkarıcı başında `^(₺|TL)` koruması + `npm run check:providers` fixture oranı ile doğrulama.
- İki sinsi hata düzeltildi: `toLowerCase()` Türkçe **'İ'** harfini 2 kod noktasına çevirdiği için km konumu kayıyordu (indeks artık orijinal metinden) ve `\s` binlik ayırıcı sayesinde **"2023 122.222 km"** tek sayı sanılıyordu (lookbehind + pencere düzeltmesi).

**Sonuç:** spoticar 5 şehirde doğrulandı (11'er kart), otomerkezi sayfalama çalışıyor (14-15 kart/sayfa), toplam 203 yeni ilan kataloğa girdi.
**Açık kalan: otokoc — `bloklu`.** Cloudflare challenge (`cdn-cgi/challenge-platform/.../jsd/oneshot`) sunuyor; kullanıcının kendi Chrome'unda da liste render edilmiyor (gövde ~1,2 KB, yalnız menü). Proje kuralı gereği bot duvarı aşılmaz → kapsam dışı.

---

## P4 — otosor statik blok

**Durum:** `bitti` · 2026-09-19

**Yanlış teşhis düzeltildi:** "statik blok" değildi — sayfalama (`?page=N`) çalışıyor ve farklı kartlar dönüyor. İlk gözlemde 8 kart görünmesinin nedeni, eski çıkarıcının kart metnini bulamamasıydı (fiyat deseni). Şimdi: İzmir/İstanbul/Ankara 20 kart/sayfa, Manisa/Aydın 8 kart/sayfa; 3 sayfa × 5 il toplandı → 149 ilan (120 kırıntı elendi).
**Ders:** "erişilemiyor" sonucundan önce çıkarıcı desenini ve binlik ayırıcı biçimini doğrula.

---

## P5 — Oto360 Araç Değerleme otomasyonu

**Durum:** `devam` (otomasyon `bloklu`, referans akışı bitti) · 2026-09-19

**Otomasyon denemesi (neden bloklu):** Değerleme sayfası taze oturumda **form render etmiyor** (`select: 0`, `formVar: false`),
bantlar görünüyor ama "Araç Değerle" tıklaması ve **girişli oturum** gerekiyor. Sayfa "Giriş Yap" gösteriyor. Yani sadece
script ile sorgu mümkün değil; giriş yapılmış oturumda `tools/capture-api.mjs` ile değerleme isteği yakalanıp bağlanabilir.

**Biten kısım — `valuation-ref.mjs`:** bant yapıştırılıp **tarihli referans** olarak saklanıyor; bant yoksa kayıt yapılmaz
(uydurma yasak). Değerleme CLI'sı `--oto360 @data/valuations/<dosya>.json` ile bu kaydı kullanıyor.

```bash
npm run degerleme:ref -- --kaydet --marka Fiat --model "Egea Cross" --yil 2023 --km 26000 --bant "<5 bant metni>"
npm run degerleme:ref -- --listele
node valuation-cli.mjs --katalog ... --oto360 @data/valuations/2026-09-18-fiat-egea-cross-2023.json
```

**Kanıt:** kullanıcının kendi S-Aracım aracından okunan gerçek bant kaydedildi (piyasa ortalaması 950.000–980.000 TL,
orta 965.000 TL) ve değerlemede referans olarak kullanıldı.

**Ne biliniyor:** Değerleme sayfası 5 bantlı aralık veriyor (Düşük/Ortalama Altı/**Piyasa Ortalaması**/Ortalama Üstü/Yüksek) ve "boya/hasar gözetilmez" diyor. Form JS tabanlı, URL parametresiyle sorgulanamıyor; sayfa S-Aracım kaydı üzerinden sonuç gösteriyor.

**Sonraki adım:** Giriş yapılmış oturumda form alanlarını (marka/model/yıl/yakıt/vites/kasa/km) haritalayıp her araç için sorgu akışını yaz; ya da kullanıcı bandı yapıştırmaya devam etsin (`--oto360`). **Alternatif:** `trinkoto.com` (otomerkezi grubu) ücretsiz değerleme sunuyor — Oto360'a yedek kaynak olabilir.

**Kabul kriteri:** Bir araç için sorgu agent dışında (script ile) yapılıp bant `data/valuations/` altına tarihli kaydediliyor.

---

## P6 — Değerleme katsayılarının kalibrasyonu (`varsayım` → `kestirim`)

**Durum:** `bitti` · commit `calibrate.mjs` (2026-09-19, bu commit) · rapor: `docs/KALIBRASYON.md`

**Sonuç:** 18 model / 813 ilan örnekleminden regresyon: **km −%1,20 / 10.000 km**, **yıl +%5,07/yıl**, medyan R² 0,837.
Kalite filtresi (R² ≥ 0,35, km işareti negatif) 2 modeli dışladı. `factors.json` → `status: kestirim`.
Tramer/boya/değişen katsayıları ilan verisinde hasar alanı olmadığı için `varsayım` kaldı (dosyada gerekçeli).
Yıl katsayısı değerlemeye bağlandı: bant genişlediğinde karşılaştırmalar konu aracın yılına normalize edilir.

**Ne biliniyor:** `data/catalog/factors.json` şu an `status: varsayım` (tramer küçük −%2 / orta −%6 / ağır −%12 / pert −%35; her boyalı panel −%1,5; her değişen parça −%4; km ±%10 tavan). Kalibrasyon eşiği: **model başına 20+ ilan**. 2026-09-18 itibarıyla 27 model bu eşiği geçti (Clio 67, Egea Cross 63, Corolla 48…).

**Sonraki adım:** `catalog.mjs`'e `--kalibre` modu ekle: 20+ örnekli modellerde fiyat ~ (yıl, km, hasar/boya işaretleri, motor) regresyonu koş; katsayıları `sample_size` ile birlikte `factors.json`'a yaz ve `status: kestirim` yap. Katsayı kaynağı raporda görünmeli.

**Kabul kriteri:** En az 5 model için `kestirim` katsayı üretiliyor; raporlar "varsayım" yerine "kendi verimizden kestirim (n=…)" yazıyor ve eski varsayım değerleriyle karşılaştırma rapora düşüyor.

---

## P7 — Karşılaştırma çıktısı (HTML + PDF)

**Durum:** `bitti` · 2026-09-19

**Çözüm:** `report-export.mjs` — aday listesi (`data/candidates/<dosya>.json`) + katalog → **tek komutla** karşılaştırma sayfası.
Tablo, değerleme motorunun kendisini kullanır (raporların elle kopyalanması değil): adil değer, sapma, karar bandı,
kırmızı bayraklar, güven + aday başına tam Bluebook bloğu. Sıralama sapma artan (en iyi fırsat önce).

```bash
npm run rapor          # reports/karsilastirma.html + .md
npm run rapor:pdf      # Chrome headless ile reports/karsilastirma.pdf
```

**Not:** headless Chrome PDF'i yazdıktan sonra bazen kapanmıyor → `scripts/print-pdf.mjs` süreci arka planda başlatıp
dosyayı bekler ve profil süreçlerini temizler (3 sn'de bitiyor). HTML ayrıca Cmd/Ctrl+P ile de yazdırılabilir.
**Kabul kriteri karşılandı:** 5 aday tek komutla karşılaştırıldı (R005 −%12 … R004 +%11,5).

---

## P8 — Kasa bilgisinin yanlış modele yazılması (veri kalitesi)

**Durum:** `bitti` (2026-09-19, bu commit)

**Çözüm:** Model + sonek birleştirme (`C3` + `AirCross` → **C3 Aircross**, `Sandero` + `Stepway`, `Egea` + `Cross`,
`Range` + `Rover`) ve kasa tespitinin yalnızca **segment başında** aranması. Ayrıca ayrı segmentteki varyant
artık yakalanıyor (motor bilgisi kazanımı).
Bu sırada iki ek hata bulundu ve düzeltildi: **indirim etiketi ("Özel İndirim: 15.000₺") araç fiyatı sanılıyordu**
(1.450.000 → 15.000) ve varyant sanılıyordu → fiyat artık kartın sonundaki tutar, indirim/kampanya etiketleri elenir.
Araç: `reparse.mjs` (ham kartlı veri setlerini yeni ayrıştırıcıyla yeniden işler). Katalog yeniden kuruldu:
**321 model / 2360 ilan** (birleşen modeller tek çatı altında).

**Ne biliniyor:** Kasa tipi ilan **kart metninden** türetiliyor; varyant satırında geçen "SUV"
kelimesi yanlış modele yazılabiliyor (ör. `Citroen C3 Aircross` kartı → model `C3`, kasa `SUV`).
Öneri listesinde "C3 = SUV" görünebiliyor.

**Sonraki adım:** Kasa bilgisini yalnızca (a) ilanın ayrı kasa alanından, (b) Oto360 teknik
verisinden al; kart metninden türetme yalnızca varyantın kendisi kasa adıysa yapılsın
(`Aircross`, `Cross`, `SUV` eki model adının parçasıysa modele yazılmalı).

**Kabul kriteri:** `catalog.mjs --suggest --kasa SUV` çıktısında kasa bilgisi yalnızca
doğrulanabilir modellerde görünür; yanlış atıf testi kırılır.

## P9 — Public repoda kişisel finansal bilgi (KARAR BEKLİYOR)

**Durum:** `bloklu` (kullanıcı kararı bekleniyor) · 2026-09-19

**Ne biliniyor:** `noravels/car-ops` **PUBLIC** (anonim klonla doğrulandı). Raporlarda
kullanıcının bütçe çerçevesi yazılı:
`reports/003` "peşinat 800.000 TL + aylık 25–30.000 TL × 24 ay", `reports/008`
"25-30k/ay sınırına yakın durmak istemiyorsun".

**Seçenekler (kullanıcı onayı olmadan uygulanmadı):**
1. Repoyu private yap (kod aynı kalır, en hızlı).
2. Raporlardaki bütçeyi genelleştir ("örnek bütçe çerçevesi") — repo public kalsın.
3. `reports/` + `watchlist.yml` `.gitignore`'a alınsın, örnekler `examples/` altına taşınsın.

**Kabul kriteri:** Kullanıcı bir seçenek seçer ve uygulanır; `git log`'da karar görünür olur.
Not: geçmiş commit'lerde de bu bilgiler var — private yapmak geçmişi de kapatır, diğer
seçenekler yalnızca yeni commit'leri temizler (geçmiş için `git filter-repo` gerekir).

## Bilinen sınırlar (todo değil, tasarım sınırı)

- **Sahibinden bot koruması:** sayfa başına ~20 sn; hızlı gezinme "olağan dışı erişim" bloğu tetikler. Aşılmaya çalışılmaz.
- **arabam şehir sayfasında km kolonu yok** → o kayıtlarda `km: null` (uydurma yok).
- **otoplus kartında km yok** → `km: null`, `notes` alanında gerekçe.
- **vava.cars'ta "Sonraki" tıklaması yeni kart getirmiyor** → tek sayfa + "N tane daha göster" ile 29 kart.
- **Balıkesir** İzmir'in komşusu (repo verisi) ama henüz taranmadı; istenirse `geo-urls.mjs --iller` listesine eklenir.
- **arabam şehir filtresi marka/model ile birlikte çalışmaz** (canlı doğrulandı 2026-09-18:
  `/ikinci-el/izmir/fiat-egea` sonuçları Ankara/İstanbul) → model aramasında şehir "rapor süzmesi"
  olarak bildirilir, yok sayılan parametre üretilmez.
