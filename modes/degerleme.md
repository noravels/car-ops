# Değerleme Akışı — "Bu araba bu parayı eder mi?"

Bu akış, bir ilanın fiyatının **adil değere** göre nerede durduğunu hesaplar ve
riskleri işaretler. Hedef soru: *"Araba buldum, fiyat iyi mi? Motoru/özellikleri
istenen kriterlere uyuyor mu?"*

## Kullanım

```bash
node valuation-cli.mjs \
  --fiyat 1015000 --marka "Fiat" --model "Egea Cross" --yil 2023 --km 26000 \
  --tramer 38000 --tramer-yil 2023 --boyali 2 --degisen 1 --ekspertiz yok \
  --aciklama "HATASIZ BOYASIZ DEĞİŞENSİZDİR ..." \
  --data data/market/egea-cross-2026-09-18.json \
  --oto360 "Piyasa Ortalaması 950.000 - 980.000 TL" \
  --out reports/004-degerleme.md
```

Kısaltmalar: `npm run degerleme`.

## Katmanlar

| Katman | Ne yapar | Kaynak |
|---|---|---|
| 1. Baz değer | Karşılaştırma medyanı (yıl ±1, km ±%35) + Oto360 bandı ortası | bizim ilan verimiz / Oto360 |
| 2. Durum düzeltmesi | Normalize tramer şiddeti, boyalı/değişen parça, km sapması | katsayı dosyası (etiketli) |
| 3. Karar | Adil değere göre sapma → 5 bant | onaylı eşikler |
| 4. Flag'ler | Fiyat ve kayıt uyumsuzlukları | kurallar |

## Oto360 Araç Değerleme (ücretsiz baz servis)

- Sayfa: `https://www.sahibinden.com/oto360/arac-degerleme/alirken`
- Son 30 günün ilan verisiyle **istatistiksel model**; çıktı 5 bant:
  Düşük / Ortalama Altı / **Piyasa Ortalaması** / Ortalama Üstü / Yüksek.
- **Kendi beyanı:** "Hesaplamada aracın boya, hasar durumu ve ek donanım
  özellikleri gözetilmemiştir." → temiz araç varsayar. Bu yüzden car-ops'un
  durum düzeltmesi katmanı bu servisin üzerine eklenir.
- **Otomasyon durumu (dürüst sınır):** değerleme formu URL parametresiyle
  sorgulanamıyor (JS tabanlı, sayfa S-Aracım kaydı üzerinden sonuç gösteriyor).
  Bu yüzden:
  - agent browser'da formu doldurup bandı alır (1 araç = 1 sorgu, insan temposu), **veya**
  - kullanıcı Oto360'tan aldığı bandı `--oto360 "<metin>"` ile yapıştırır.
  - Hiçbiri yoksa: `--oto360` verilmez, rapor "tek kaynak (kendi setimiz)"
    uyarısını ve düşük güveni yazar. **Uydurma bant yazılmaz.**

## Katsayılar ve kalibrasyon

- Dosya: `data/catalog/factors.json` (`status: varsayım|kestirim`).
- Şu anki durum: **varsayım** (temkinli; piyasa teamülü + bizim gözlemimizin
  ihtiyatlı hali). Raporda "varsayım" olarak etiketlenir.
- Otomatik kalibrasyon: bir model için gözlemlenen ilan sayısı ≥ 20 olduğunda
  aynı setten tramer/boya/km–fiyat ilişkisi regresyonla kestirilir, katsayılar
  `kestirim` olarak yazılır ve raporlar bunu belirtir.
- Varsayım katsayıları (mevcut): tramer küçük −%2 / orta −%6 / ağır −%12 /
  pert −%35; her boyalı panel −%1,5 (üst sınır −%12); her değişen parça −%4
  (üst sınır −%20); km medyan üstü her 10.000 km −%0,5, altı +%0,3 (üst sınır ±%10).

## Karar bantları (kullanıcı onaylı)

| Sapma | Etiket | Ne yapılır |
|---|---|---|
| ≤ −%25 | 🔴 Şüpheli ucuz | pert/şasi sorgusu, bağımsız ekspertiz, kaporo yok |
| −%25 … −%10 | 🟡 Piyasa altı | tramer/boya beyanı + ekspertiz doğrulaması |
| ±%10 | ⚪ Piyasa değerinde | pazarlık payı bant içinde |
| +%10 … +%25 | 🟡 Pahalı | gerekçe iste (donanım, km, bakım) |
| ≥ +%25 | 🔴 Belirgin pahalı | farkı açıklayan kanıt yoksa ilerleme |

## Flag kuralları

- `suspicious_cheap` / `below_market` / `expensive` / `very_expensive`: fiyat sapması.
- `tramer_not_priced`: orta/ağır tramer var ama fiyat piyasa üstü → hasar fiyata yansımamış.
- `pert_record`: normalize hasar ≥ araç değerinin %70'i → karar "alınmaz".
- `no_expertise_cheap`: piyasa altı + ekspertiz yok → ucuzluğun nedeni kanıtsız.
- `km_outlier`: km, set medyanından ±%30 dışında.
- `claim_conflict`: ilan "hatasız/boyasız/değişensiz" diyor ama kayıtta boyalı/değişen var
  (Türkçe büyük harf I/İ normalizasyonu ile aranır).
- `source_divergence`: iki baz kaynağı %15+ ayrışıyor.
- `low_sample`: karşılaştırma örneklemi < 5 → aralık genişletilir.

## Katalogla ilişkisi

- Özellik sayıp **model önermek** için: `node catalog.mjs --suggest --max ... --vites ... --kasa ...`
- Seçilen modelin **fiyatı iyi mi** sorusu için: bu akış (`valuation-cli.mjs`).
- Katalog büyüdükçe (daha çok ilan → daha çok model) her ikisi de keskinleşir;
  aynı `data/market/*.json` dosyaları hem öneriyi hem karşılaştırma setini besler.
