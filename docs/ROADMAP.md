# car-ops Yol Haritası

## Faz A — Tek ilan analizi (MVP)

1. `paste-listing.mjs` — stdin'den HTML al → `providers/` ayrıştırıcı →
   `data/listings/<id>.md`
2. `providers/base.md` — provider arayüz sözleşmesi
3. `providers/sahibinden.mjs` — sahibinden.com ilan ayrıştırıcı
   (URL → agent browser veya paste HTML → ListingRecord)
4. `tramer-normalize.mjs` — TÜFE/USD normalizasyonu + şiddet sınıflaması
5. `market-compare.mjs` — aynı model-yıl-km bandı ilan medyanı vs ilan fiyatı
6. `seller-signals.mjs` — fiyat geçmişi davranış sinyalleri
7. `modes/tr/arac.md` — A–H rapor prompt'u + `modes/_shared.md` çekirdek
8. Rapor çıktısı: `reports/NNN-<slug>.md`

## Faz B — Watchlist + snapshot

1. `watchlist.yml` (kullanıcı katmanı) — izlenen ilan URL'leri + model sorguları
2. `snapshot.mjs` — watchlist'teki her ilanın anlık görünümünü jsonl'e append
   (writer lock ile); cron'la düzenli çalışır
3. `watch-report.mjs` — fiyat düşüşü / silinen ilan tespiti, rapora not düşer
4. Snapshot verisi Faz A raporlarına satıcı-davranış girdisi olur

## Sonraki fazlar

- Ekspertiz raporu resmi/foto ayrıştırma (OCR)
- ekspertiz.com / cardata gibi değerleme servis entegrasyonları
- Yeni marketler: `modes/<xx>/` + provider (arabam.com ikinci TR provider)
- Tramer normalize çapası otomatik TÜİK/TCMB güncellemesi (cron)

## Yapılanlar (2026-09-18)

- ✅ `providers/sahibinden.mjs` — regex çekirdek; erişim kullanıcının Chrome debug
  profili (CDP 9222) üzerinden; rate limit → `providers/rate-guard.mjs`
- ✅ `providers/arabam.mjs` — liste satırı ayrıştırıcı; üstü çizili eski fiyat →
  fiyat düşüşü kaydı; şehir+ilçe; bireysel/galeri ayrımı
- ✅ `providers/vavacars.mjs` — kurumsal kanal; "boyasız, değişensiz, tramersiz"
  etiketi ve "Özel İndirim: N₺" → tramer + fiyat düşüşü girdisi
- ✅ `market-scan.mjs` — çok kaynaklı dedupe, yıl bazlı medyan, bütçe adayları,
  markdown rapor (`data/market/*.json` → `.md`)
- ✅ `finansman.mjs` — peşinat + taksit + vade + aylık faiz → araç üst limiti;
  ters hesap; banka vs galeri finansmanı senaryoları
- ✅ İlk üç rapor: `reports/001-003` (AutoExus Egea Cross, sahibinden 2024 Urban,
  çok-kaynaklı piyasa taraması + aday listesi)

## Bekleyen

- ⏳ **otokocikinciel.com** — provider yazıldı (stokta Egea Cross yok); il filtresi JS
  tabanlı olduğu için süzme rapor aşamasında
- ⏳ sahibinden **ilan açıklaması okuma** — finansman beyanları alındı (12 ay vade,
  kredi kartı 3-6-9-12 taksit); daha geniş ilan setinde sürdürülecek
- ⏳ arabam.com detay sayfası ayrıştırıcısında "Boya, Değişen ve Tramer" sekmesi
  otomatikleştirilecek (şu an agent tıklaması ile okunuyor)

## Çok-kullanıcılı yapı (2026-09-18)

Proje artık "başka biri de kurabilir" hâlinde:

| Parça | Dosya | İşlev |
|---|---|---|
| Konum çözümleme | `location.mjs` + `config/locations/tr-provinces.json` | 81 il, kara komşuluğu, feribot bağlantıları, plaka kodları; "X ili + 1/2 çevre" |
| Intake akışı | `modes/intake.md` | Sorularla profili doldurur (`config/profile.yml`), varsayım uydurmaz |
| Arama akışı | `modes/ara.md` | Konum → URL → toplama → tarama → aday raporu → watchlist |
| Arama URL üretici | `search-urls.mjs` + `config/search-params.json` | Provider başına parametre şeması; doğrulanmamış parametre açıkça işaretli |
| Kurulum kontrolü | `doctor.mjs` | Eksik profil alanları, şablon içeriği, eksik dosyalar |
| Profil şablonu | `templates/profile.template.yml` | Kullanıcı kopyalayıp doldurur |
| Market tanımları | `config/markets.yml` | TR tam; yeni market iskeleti (para birimi, konum modeli, provider listesi) |
| Kurulum rehberi | `docs/KURULUM.md` | Sıfırdan kurulum + sorun giderme tablosu |

Test sayısı: 78 (konum 9, arama URL 7, doctor 6, diğer çekirdek 56).

## Bekleyen (çok-kullanıcılı)

- AGENTS.md akış tablosunun güncellenmesi (korunan dosya — kullanıcı onayı gerekiyor)
- Yeni market örneği (ör. `modes/pl/` + provider) ile soyutlamanın gerçek testi
- `search-params.json` parametrelerinin sahada doğrulanması (agent browser ile tek tek)


