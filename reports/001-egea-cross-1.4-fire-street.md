# Araç Raporu 001 — Fiat Egea Cross 1.4 Fire Street (2022)

**URL:** https://tr.autoexus.com/arabalar/satilik/fiat/egea-cross/1.4-fire-street/6686b57a9672aba4b9efbb06
**Tarih:** 2026-09-18 | **Market:** tr | **Kaynak:** tr.autoexus.com (AutoExus, aggregator)
**Skor:** 2.6/5 — fiyat şüpheli + hiçbir kayıt doğrulanamıyor; önce kayıt toplama, sonra karar.

## A — Araç Özeti ve Beyanlar

| Alan | Değer | Not |
|---|---|---|
| Marka/Model | Fiat Egea Cross 1.4 Fire Street | — |
| Yıl | 2022 (platformda "1.2022" veri hatası) | veri kalitesi zayıf |
| Km | 6.350 km | B bloğunda şüphe |
| Fiyat | 13.637 € (≈762.947 TL, @55.95 EUR/TRY) | D bloğu |
| Satıcı | Öztoprak Otomotiv (galeri), Esenler/İst. | yetki belgesi beyanlı |
| Ekspertiz | YOK | H bloğu checklist |

Beyanlar ve durumu:
- "1 önceki sahibi" (platform alanı) → doğrulanamıyor
- Tramer/hasar}}} beyanı YOK (ne temiz yazmış, ne kayıt var demiş)
- Yetki belgesi + taşıt kredisi + takas + k.k. 9 taksit → satış çabası sinyali

## B — Km ve Kullanım Tutarlılığı

- Muayene km dizisi: YOK (AutoExus sağlamıyor) → sadeleme kontrolü yapılamaz.
- 2022 çıkışlı, ~43 ay → yıllık ~1.800 km. Ya gerçek çok düşük kullanım ya
  km sorunu. **[İNSAN]**: TÜVTÜRK muayene km geçmişi sorgusu + servis kayıtları.

## C — Tramer (Normalize)

Tramer verisi YOK. Satıcıdan plaka ile SBM/5664 sorgusu istenmeli. Kayıt yokluğu
temizlik değildir; kayıt gelmeden skor bloke.

## D — Fiyat vs Piyasa

Karşılaştırılabilir 2022 Egea Cross ilanları (aynı gün, web):
| Kaynak | Varyant | Km | Fiyat | Satıcı |
|---|---|---|---|---|
| otonomi.com 91DC627E | 1.4 Fire Urban | 26.500 | 1.145.000 TL | Bireysel, garanti devam |
| otonomi.com 61f6F129 | 1.5 T4 Urban (hibrit DCT) | 87.000 | 1.345.900 TL | Galeri (AKİF) |

- Medyan (n=2): 1.245.450 TL
- **İlan fiyatı: 762.947 TL → medyanın −%38.7** → klasiğ "yem fiyatı" profili
  (medyan %25 altı kuralı ihlali).
- USD eşdeğeri: ~15.655 USD (48.73 USD/TRY, open-erapi 2026-09-18)
- Km de düşük bu ilanda: Egea Cross 1.4 Urban 26.500 km @1.145.000 TL ile
  kıyasla — 6.350 km düşük km ama fiyat çelişkisi yok değil, TEPKİ: bu ilanın
  düşük km beyanını doğrulamadan fiyatın fazla ucuzluğu garip.

## E — Satıcı Profili ve Davranışı

- Galerinin AutoExus portföyü ağırlıkla ticari araç (Boxer, Transit, Combo...);
  Egea Cross istisna gibi. Nötr ama bilgi.
- Snapshot: 1 kayıt (2026-09-18) — davranış sinyali yok; watchlist'e alındı.

## F — Pazarlık Stratejisi (öneri — karar insana aittir)

1. Tramer sorgusu dayat: satıcı plaka ile SBM çıkışı paylaşmalı; sen 5664 SMS
   ile de bağımsız doğrula.
2. Ekspertiz şart — kendin seçtiğin merkez.
3. Çapa: 1.145.000 TL (otonomi bireysel 1.4 Urban, garanti devam, 26.500 km,
   muayene 2027) ilan bu çapanın %33 altınday: ya gerçek barga (kilometre
   düşük kullanılabilir ama kanıt) ya problem. Çapanın %10-15 üstü teklif
   üst limit göster.
4. Muayene km dizisi ile 6.350 km doğrulama zorunlu.

## G — Red-Flag Özeti

Hard:
- Piyasa medyanı −%38.7 → "yem fiyatı" bandı
- Km şüphesi doğrulanamıyor (2022 / 6.350 km)
- Tramer kaydı hiç beyan edilmedi

Soft:
- Platform yıl veri hatası ("1.2022")
- Ekspertiz yok
- Satış yöntem kı sayımını fazla güçlü (kredi + 9 taksit + takas) — nötr ama
  "hızlı kaporo" talebinsin dikkatli ol.

H Blok etkisi: birden fazla hard flag + sıfır doğrulanabilir bilgi → score 2.6.

## H — Tavsiye ve Fiziksel İnceleme Checklist

Tavsiye: 1.245.450 TL medyan (±%10) bant hedef. Bu ilanda:
1. Satıcıdan TRAYMER sorgu çıktısını iste (plaka ile SBM).
2. Kendin seçtiğin ekspertiz merkezine götürmeyi şart koş.
3. TÜVTÜRK muayene km geçmişi: 6.350 km beyanını doğrula.
4. Yetki belge satıcı bilgisi + ruhsat kimliğini ilandaki adla karşılaştır.
5. Soğuk start + yokuş tutma + çekme testi + beyanın ("arka park sensörü"
   "sis farı") göle onayla.
6. Kaporo: sadece araç + evrak + rapor yoksa kaporo yok; para noter sırasında
   son imza öncesi satıcının adına.

Not: doğrulanamayan alanlar — kaporta durumu, motor durumu, şanzıman sesi,
tramer kaydı, muayene durumu.

**Kontrol:** `node --test tests/` | Veri: data/listings/autoexus-6686b57a9672aba4b9efbb06.md
| Snapshot: data/snapshots/autoexus-6686b57a9672aba4b9efbb06.jsonl
