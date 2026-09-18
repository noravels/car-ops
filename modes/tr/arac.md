# TR Market — Araç Değerlendirme (A–H Rapor)

`modes/_shared.md` kuralları + `docs/knowledge/tr-buying-knowledge.md` bilgi
tabanıyla birlikte okunur. Rapor dili Türkçe.

## Girdiler

1. `data/listings/<id>.md` — provider çıktısı (ListingRecord)
2. `data/snapshots/<id>.jsonl` — fiyat geçmişi (Faz B; yoksa bu bloklar
   "veri yok" der, uydurmaz)
3. Tramer/SBM sorgu çıktısı (kullanıcı yapıştırır veya agent browser'dan
   okur) — `data/listings/<id>-tramer.json`
4. `config/profile.yml` — kullanıcı bütçe/risk tercihleri

## A — Araç Özeti ve Beyanlar

Marka/model/yıl/km/fiyat/satıcı özeti. İlandaki doğrulanabilir iddialar
`claims` listesinden madde madde; her birinin karşısına kayıt sonucu
(doğrulandı / çelişki / doğrulanamıyor). Satıcının "X" yazdığı piyasanın
"Y" dediği her nokta burada görünür olmalı.

## B — Km ve Kullanım Tutarlılığı

- Muayene km dizisi (varsa): yıllara göre km artış eğrisi; düşüş = kırmızı
  bayrak.
- Beyan km vs yaş ortalaması (yılda ~15–20 bin km TR ortalaması) sapması.
- İç yıpranma beyanı yoksa [İNSAN] checklist'e devret, burada not düşme.

## C — Tramer (Normalize)

`tramer-normalize.mjs` çıktısıyla her kayıt:
`2018 / 20.000 TL → ~X TL (bugünün parası) → şiddet: orta`.
Tablo sütunları: yıl, nominal, normalize, şiddet, not (eksper raporlu mu,
cam/çalınma hariç tutulmuş mu). Toplam normalize hasar / ilan fiyatı oranı
da verilir. Nominal karşılaştırma cümlesi kurma.

## D — Fiyat vs Piyasa

- Aynı model-yıl-km (±%20 km) bandındaki ilanların medyanı ve aralığı;
  ilanın bant içi konumu (% sapma).
- Snapshot varsa: fiyat geçmişi grafiği (metin tablo), TL ve USD eşdeğeri,
  düşüş sayısı/oranı, ilan yaşı.
- Piyasa medyanının %25 altı → G bloğuna "yem fiyatı" notu.

## E — Satıcı Profili ve Davranışı

Bireysel/galeri/yetkili tespiti + kanıtı. Hesap yaşı, ilan davranışı,
site-dışı çekme denemeleri, "acil" kalıpları. Faz B snapshot sinyalleri:
düzenli indirim → acil satıcı (pazarlık kozu F'ye taşınır); sil-yeniden-
yayın şüphesi.

## F — Pazarlık Stratejisi

Koz sıralaması: (1) snapshot fiyat düşüşleri, (2) doğrulanamayan alanlar,
(3) normalize tramer kayıtları, (4) piyasa bandı konumu. Her koz için örnek
cümle. Hedef bant: config/profile.yml bütçesi + D bloğu bandı. Kapor
koşulları hatırlatması (tutanaklı, yüzyüze).

## G — Red-Flag Özeti

İki bölüm: **hard** (pert/ağır şase, km sadeleme kanıtı, dolandırıcılık
kalıbı, foto çelişkisi, IBAN/kişi uyumsuzluğu) ve **soft** (açıklama dili
kalıpları, modifiye, tek cümlelik açıklama, yeni hesap). Hard red-flag
varsa H skoru 3.0'ın altına iner; birden fazlaysa öneri "yaklaşma".

## H — Tavsiye ve Fiziksel İnceleme Checklist

1–5 skor (bütünsel; `modes/_shared.md` tablosu).

**Ardından iki zorunlu blok — her raporda, atlanamaz:**

**Neden alınmalı (artılar):** Madde madde, her biri kanıt/kaynak referanslı
(ör. "ekspertiz raporu ilanda mevcut", "km dizisi tutarlı", "piyasa medyanının
%13 altı", "gerçek fiyat düşüşü belgeli"). Genel geçer övgü yazılmaz.

**Neden alınmamalı (eksiler):** Madde madde, aynı disiplinle. Doğrulanamayan
her alan, her çelişki, her belirsizlik burada yazılır — "ama muhtemelen
sorun yoktur" gibi yumuşatma yasak. Belirsizlik "belirsizlik" olarak yazılır.

İki blok dengeli uzunlukta olur; birinde 5 madde varsa diğerinde de karşılığı
aranır. Negatif yazmamak için sebep uydurma yok, pozitif yazmamak için de
saklama yok. Sonunda tek satır **net duruş**: "al", "şu koşulla al",
"vazgeç" — gerekçesiyle.

Sonra `[İNSAN]` checklist'in bu araca özelleştirilmiş hâli: beyan edilen
boya/değişen parçaların neresine bakılacak, hangi testler (soğuk start,
yokuş tutma, çekme testi), model-bilinen sorunlar (agent araştırması eklerse
kaynakla).

## Rapor iskeleti

```
# Araç Raporu NNN — <marka model yıl>
**URL:** ... | **Tarih:** ... | **Market:** tr | **Skor:** x.x/5

## A — ... (bloklar)
...
## H — Tavsiye
...
**Kontrol:** `node --test tests/` | Veri: data/listings/<id>.md
```
