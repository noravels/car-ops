# Intake — Kullanıcıyı Tanıma Akışı

Amaç: "X ilinde araba arıyorum" diyen bir kullanıcıdan gereken bilgileri **sorarak**
toplamak ve `config/profile.yml` (kullanıcı katmanı) dosyasına yazmak. Hiçbir bilgi
varsayılmaz, hiçbir alan uydurulmaz.

## Ne zaman çalışır

- İlk kullanımda (profil boşsa) — `node doctor.mjs` bunu söyler.
- Kullanıcı yeni bir arama niyeti belirttiğinde ve profilde eksik alan varsa.
- Kullanıcı "bütçem değişti", "artık otomatik vites istiyorum" gibi güncelleme verdiğinde.

## Sorulacak alanlar (hepsi bir kez, sonra profile.yml'den okunur)

1. **Konum:** Hangi ilde veya hangi ilin çevresinde arıyorsun?
   - Çevre genişliği: sadece il mi, komşu iller mi (1 çevre), komşunun komşusu mu (2 çevre)?
   - Feribot/boğaz bağlantılı iller (ör. İstanbul ↔ Bursa) dahil edilsin mi?
2. **Bütçe biçimi:** Peşin mi alacaksın, kredi mi?
   - Peşin ise: toplam bütçe üst sınırı.
   - Kredi ise: peşinat + aylık ödeyebileceğin tutar + vade (ay) + kabul ettiğin
     **aylık faiz üst sınırı**. (Faiz oranı ilan açıklamasında yazıyorsa o esas alınır;
     aksi halde varsayım kullanılmaz, kullanıcıdan oran istenmez — hesap iki şeritte sunulur.)
3. **Araç niyeti:** Marka/model belirli mi, yoksa "şu segment/özellikte ne varsa" mı?
   - Belirliyse: marka + model + (varsa) donanım/varyant.
   - Değilse: kasa tipi (hatchback/sedan/Crossover/SUV), vites, yakıt, segment.
4. **Kabul edilebilir sınırlar:** yıl alt sınırı, km üst sınırı, vites, yakıt.
5. **Risk toleransı:** değişen parça / boyalı parça / tramer şiddeti sınırları.
   - `low` = değişensiz-boyasız tercih, tramer şiddeti "küçük" üstünde eleme
   - `medium` = 1 değişen veya 2 boyalıya kadar kabul
   - `high` = ağır hasar hariç, fiyat telafi ediyorsa kabul
6. **Zorunlu/olmasa olmaz:** ör. "otomatik vites şart", "bagaj hacmi", "LPG uyumu".
7. **Satıcı tercihi (varsa):** sadece bireysel / sadece galeri / kurumsal platform dahil.
8. **Bildirim tercihi:** fiyat düşünce haber ver mi? (watchlist + snapshot)

## Soru sorma kuralları

- Bir turda en fazla 4 soru; kullanıcı sıkılırsa kalan alanlar `bilinmiyor` kalır.
- Her soruda **makul varsayılanı öner** (ör. "İstanbul + 1 çevre il uygun mu?").
- Kullanıcı "sen karar ver" derse: risk toleransı `low`, çevre `1`, bütçe biçimi
  elimizdeki tek rakamdan türetilir — ve bu **varsayım** olarak profile.yml'e yazılır.
- ASLA faiz oranı, piyasa fiyatı veya tramer tutarı icat edilmez.

## Çıktı: config/profile.yml

```yaml
# Kullanıcı katmanı — sistem güncellemesi dokunmaz
location:
  province: Kocaeli
  radius: 1              # 0 = sadece il, 1 = komşu iller, 2 = 2 çevre
  include_ferry: true
budget:
  mode: kredi            # pesin | kredi
  down_payment_try: 800000
  monthly_max_try: 30000
  months: 24
  monthly_rate_max: 0.035
vehicle_target:
  make: Fiat
  model: Egea Cross
  or_segment: null       # model belirsizse kasa/segment
limits:
  year_min: 2022
  km_max: 120000
  gearbox: any
  fuel: any
risk:
  tolerance: low
  max_changed_parts: 0
  max_painted_parts: 1
must_have: []
seller_preference: any   # any | bireysel | galeri | kurumsal
notify:
  watchlist: true
```

## Intake sonrası

1. `node doctor.mjs` ile profilin eksiksiz olduğunu doğrula.
2. `modes/ara.md` akışını başlat (arama URL'leri → toplama → tarama → rapor).
3. Kullanıcıya ne yapıldığını **kısa** bildir: kaç kaynak, kaç ilan, medyan, adaylar.
