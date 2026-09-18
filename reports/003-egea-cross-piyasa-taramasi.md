# Araç Raporu 003 — Egea Cross Çok-Kaynaklı Piyasa Taraması ve Aday Listesi

**Tarih:** 2026-09-18 | **Market:** tr | **Kapsam:** 5 kaynak, 37 tekil ilan
**Bütçe çerçevesi:** peşinat 800.000 TL + aylık 25–30.000 TL × 24 ay (aylık faiz %3,4 varsayımı → **araç üst limiti ≈ 1.260.000 TL**)
**Veri:** `data/market/egea-cross-2026-09-18.json` · Tarama çıktısı: `data/market/egea-cross-2026-09-18.md`

## Kaynaklar ve erişim durumu

| Kaynak | İlan | Erişim |
|---|---|---|
| arabam.com | 20 | ✅ senin Chrome oturumunla açıldı (Cloudflare geçildi) |
| sahibinden.com | 9 | ⚠️ rate limit sonrası kısmi (10 ilan listesi alındı, detaylar gecikmeli) |
| vava.cars | 4 | ✅ kurumsal, ekspertizli; indirim tutarı bile görünüyor |
| tr.autoexus.com | 2 | ✅ (EUR fiyatlı) |
| otonomi.com | 2 | ✅ |

> **Kaynak gerçeği:** sahıbinden'in bot bloğu "rate limit" (15 dk'lık blok). Yavaş tempo
> (20–30 sn/ilan) ve `providers/rate-guard.mjs` ile yönetiliyor; detay okuma sırası
> ertelendi. arabam.com + vavacars kurumsal kanal olduğu için veri kalitesi daha yüksek.

## Piyasa özeti

- **Genel medyan: 1.165.000 TL** (≈ 23.907 USD @ 48,73)
- Yıl bazında medyanlar:

| Yıl | Adet | Medyan | Min | Max | Medyan km |
|---|---|---|---|---|---|
| 2021 | 1 | 1.220.000 | 1.220.000 | 1.220.000 | 68.000 |
| 2022 | 5 | 1.145.000 | 762.947 | 1.345.900 | 65.317 |
| 2023 | 18 | 1.165.000 | 1.015.000 | 1.600.000 | 46.000 |
| 2024 | 7 | 1.050.000 | 995.000 | 1.650.000 | 42.500 |
| 2025 | 5 | 1.250.900 | 1.185.000 | 1.640.000 | 14.835 |
| 2026 | 1 | 1.725.000 | 1.725.000 | 1.725.000 | 6.001 |

2023 modelde arz yoğun (18 ilan) → **pazarlık gücü alıcıda**; 2024 modelin medyanı
2023'ten düşük çıktı (km dağılımı farklı) → 2024'ler bu aralıkta iyi değer.

## Bütçeye uyan adaylar (fiyat ≤ 1.260.000 TL)

Taksit hesabı: 800.000 TL peşinat, 24 ay, aylık %3,4 (banka bandı).

| # | Araç | Km | Fiyat | Medyana oran | Kaynak/Şehir | Kredi | Aylık taksit |
|---|---|---|---|---|---|---|---|
| 1 | 2023 Urban | 26.000 | 1.015.000 | %87,1 | arabam / Ankara Sincan | 215.000 | 13.248 TL |
| 2 | 2023 Street | 7.200 | 1.165.000 | %100 | sahibinden / Çanakkale **expertiz raporlu** | 365.000 | 22.492 TL |
| 3 | 2024 Urban | 15.000 | 1.050.000 | %90,1 | sahibinden / Gaziantep (Rapor 002) | 250.000 | 15.405 TL |
| 4 | 2024 Street | 42.500 | 1.025.000 | %88,0 | arabam / Kayseri **17.500 TL indirim** | 225.000 | 13.865 TL |
| 5 | 2025 Urban | 17.771 | 1.185.000 | %101,7 | vava.cars **boyasız-değişensiz-tramersiz** | 385.000 | 23.724 TL |
| 6 | 2025 Urban | 8.288 | 1.198.000 | %102,8 | vava.cars **17.000₺ indirim + temiz** | 398.000 | 24.525 TL |
| 7 | 2023 Urban | 20.000 | 1.149.900 | %98,7 | arabam / Kayseri | 349.900 | 21.561 TL |
| 8 | 2023 Urban | 10.400 | 1.165.000 | %100 | arabam / İzmir Dikili ("NOKTA hatasız") | 365.000 | 22.492 TL |

Şüpheli ucuz olarak işaretlenen: `tr.autoexus.com` 2022 / 6.350 km / 762.947 TL
(medyanın %65,5'i) — Rapor 002'de gördüğümüz "yem fiyatı" profili; **görmeden para yok**.

## Taksit çerçevesi hakkında not (dürüst sınır)

Bütçe hesabı **aylık %3,4 faiz varsayımıyla** yapıldı — bu, banka ihtiyaç kredisi üst
bandına yakın temkinli bir varsayımdır. **Galeri kendi finansmanında faiz ilan
açıklamasında yazılıysa o oran esas alınır**; ilanda +senin belirttiğin gibi "265 bin
peşin 36 ay vade" tipi beyanlar oluyor. Bu raporda **hiçbir faiz oranı uydurulmadı**;
yalnızca gözlenen parametrelerle hesap yapıldı. Adaya gidildiğinde:
1. İlan açıklamasındaki finansman beyanı okunur (varsa).
2. Galerinin kendi finansman teklifi ve banka teklifi karşılaştırılır.
3. %3,5 aylık üstü her teklif için vade kısaltma / kurum değiştirme önerilir (`finansman.mjs` kuralı).

## Öncelik sıralaması (öneri — karar insanda)

1. **#1 (2023 Urban / 26.000 km / 1.015.000 — Ankara Sincan)**: medyanın %13 altı, km makul,
   servis bakımlı beyanı var. Taksit 13,2 bin → bütçenin çok altında, 36 aya da yer var.
   Görülmeye değer; SBM sorgusu + ekspertiz şart.
2. **#4 (2024 Street / 42.500 km / 1.025.000 — Kayseri)**: ilanda **gerçek fiyat düşüşü**
   (1.042.500 → 1.025.000). Satıcı indirim yapmış → pazarlık kozu elimizde.
3. **#2 (2023 Street / 7.200 km / 1.165.000 — Çanakkale)**: **ekspertiz raporu ilanda var**,
   km çok düşük. Ekspertiz doğrulanırsa en düşük riskli aday.
4. **#6 (2025 Urban / 8.288 km / 1.198.000 — vava.cars)**: kurumsal kanal,
   "boyasız-değişensiz-tramersiz" beyanı + 17.000₺ indirim. Kurumsal satıcı olduğu için
   gizli ayıp hakları (3 ay / 5.000 km satıcı garantisi) uygulanır.

## Atılacak adımlar

- [ ] #1 ve #4 için sahibinden/arabam detay sayfası okunup A–H raporu yazılması
- [ ] #2'nin ekspertiz raporu görseli/PDF'i incelenmesi (değişen-boyanan doğrulama)
- [ ] #6 için vava.cars detay sayfası + garanti koşulları
- [ ] Watchlist'e bu 4 aday → günlük snapshot (fiyat düşerse sinyal)
- [ ] SBM/tramer sorgusu: aday ilanların plakaları alındığında çalıştırma
