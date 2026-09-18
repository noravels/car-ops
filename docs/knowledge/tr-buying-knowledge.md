# TR İkinci El Araç Alım Bilgi Tabanı

Bu doküman, değerlendirme raporlarının (A–H blokları) arkasındaki alan
bilgisidir. Kaynaklar: ekşi sözlük "ikinci el araba alırken dikkat edilmesi
gerekenler" başlığı, DonanımHaber/DonanımArşivi forumları, r/GarajTurkiye ve
r/UsedCars checklists, sahibinden güvenli alışveriş rehberi, MASFED uyarıları.

Her sinyal üç tiptedir:
- `[OTO]` — script/veri ile otomatik kontrol edilebilir (tramer, fiyat, ilan metni)
- `[AGENT]` — agent'ın yargısı gereken (açıklama dili, tutarlılık)
- `[İNSAN]` — yalnızca fiziksel inceleme/test sürüşü (rapora checklist olarak basılır)

---

## 1. Kayıt ve geçmiş sorgulama

### 1.1 Tramer / SBM hasar kayıtları `[OTO]`
- Kayıtlar 2003'ten beri SBM'de; plaka değil **şasi (VIN) bazlıdır** — plaka
  değişse de kayıt kalır. Pert/ağır hasar kaydı kalıcıdır.
- Kayıttan görülmeyen şey: sigortasız/anlaşmalı tamirler. **Tramer temiz ≠
  kazasız.** Bu yüzden ekspertiz şarttır (`[İNSAN]`).
- **Tutar tek başına anlam ifade etmez; tutar + yıl birlikte anlamlıdır.**
  2018'deki 20.000 TL'lik hasar, 2025'teki 50.000 TL'lik hasardan ağır
  olabilir. Normalizasyon kuralı: hasar yılındaki asgari ücret / TÜFE / USD
  çapasıyla bugünün parasına çevir (`tramer-normalize.mjs`). Forum pratiği:
  "2015'te asgari ücret 950 TL iken 4.000 TL hasar ≈ 4 asgari ücret ≈ bugün
  ~120.000 TL şiddeti."
- Şiddet sınıflaması normalize tutarın araç değerine oranıyla yapılır:
  küçük sürtme / orta / ağır / pert (onarım > araç değerinin ~%70'i).
- Sorgulanabilir alanlar: hasar geçmişi (tarih+tutar+tür), değişen parça
  (eksper raporlu kazalar için), kaskosuz dönem, plaka/tescil değişimi,
  trafiğe çıkış tarihi.
- Ekspert raporlu kazalarda parça detayı (PARCA sorgusu) hangi parçaların
  değiştiğini verir: kaporta kozmetiği vs **şase/podye/direk** hasarını ayır.
  Şase-direk hasarı varsa risk en üst düzeydedir — boyalı/değişen kaporta
  önemsizdir, mekanik ve iskelet önemlidir.

### 1.2 Ekspertiz raporu `[İNSAN] + [OTO]`
- Bağımsız, kurumsal ekspertiz seçilir; **satıcının "tanıdığı ekspertiz"e
  gidilmez** — alıcı seçer.
- İlanda rapor varsa: değişen/boyanan parçalar ilan metniyle ve tramer
  kayıtlarıyla çapraz kontrol edilir (`[OTO]`).
- Raporsuz ilan: fiziksel durum alanları "doğrulanamayan" olarak listelenir,
  rapor bloğu not düşer. Alıcıya "kendi seçtiğin ekspertize götürmeden
  kaparo/ödeme yok" hatırlatması basılır.

### 1.3 Muayene, vergi, ceza `[OTO]`
- TÜVTÜRK muayene geçerlilik tarihi; MTV ve trafik cezası borcu.
- Muayene km kayıtları yıllar boyunca izlenerek **km sadeleme tespiti**
  yapılabilir: km düşüşü = kırmızı bayrak.
- Muayenesi yeni yapılmış + modifiyeli araç şüphesi: "dekor (air/alçaltma)
  için muayeneyi bilerek bitmeye yakın bıraktım" taktiği forumda
  anlatılıyor — muayene tarihi ilan tarihiyle birlikte yorumlanır `[AGENT]`.

### 1.4 Hukuki durum `[OTO] + [İNSAN]`
- Ruhsat üzerindeki şase/motor no ile araç üzerindeki numaralar birebir
  eşleşmeli (`[İNSAN]`) — çalınmış araç riski.
- Ruhsat gerçek sahibinin adına mı, vekâletle mi satılıyor? Vekâleten
  satışta kimlik + vekâletname aslı kontrolü.
- Haciz/rehin sorgulaması, rent-a-car sicili (kiralık filo geçmişi).
- **Gizli ayıp hakları** (rapora hatırlatma bloğu): galeri/işletmeden alınan
  araçta satış sonrası **3 ay veya 5.000 km** motor/şanzıman/elektrik satıcı
  garantisi (Tüketicinin Korunması Hakkında Kanun); şahıstan alımda Borçlar
  Kanunu "ayıba karşı tekeffül" — bilerek gizlenen kusurda 2 yıla kadar
  sorumluluk; kusur tespit edilince satıcıya **noter kanalıyla ihbar** kanıt
  başlangıcıdır.
- Yedek anahtar, bakım kitabı/ekipman varlığı ilan ve görüşmede sorulur.

## 2. İlan metni ve satıcı davranışı

### 2.1 Açıklama dili sinyalleri `[AGENT]`
Uzak dur işaretleri (ekşi/forum konsensüsü):
- "bebekler bebeği", "araçlarımız sınıf bir araçtır", "diksiyonu düzgündür",
  "kara şimşek" gibi süslü-boş kalıplar.
- Performans övüngesi: "250 km/s'yi rahat görüyor", "yer uçağı".
- "Almıcaksanız aramayın", "saçma soru sormayın" — satıcı profili riski.
- İki cümleyle geçiştirme: "detaylar için arayınız", "fiyat konuşulur",
  "neden sattığımı mesajda anlatırım" — fotoğrafı başka yerden alınmış
  sahte ilanların klasik kalıbı.
- Aşırı detaylı ve soru bırakmayan açıklama genelde güven sinyalidir; ama
  kopyala-yapıştır şablonu olup olmadığı aynı metnin tırnak içinde site içi
  aramasıyla kontrol edilir `[OTO]`.

### 2.2 Fiyat sinyalleri `[OTO]`
- **Piyasa medyanının %25–40 altındaki fiyat "fırsat" değil "yem"dir.**
  Aynı model-yıl-donanım için 8–10 ilan yan yana bakılır.
- "İhtiyaçtan acil", "yurt dışına çıkıyorum", "tapu/noter hazır" cümleleri
  düşük fiyatı meşrulaştırma kalıbıdır; gerçek acil satışta fotoğraf, evrak
  ve yüz yüze görüsmе talebi normaldir, sadece fiyat düşmez.
- Kur gerçekliği: TL bazlı fiyat artışları kur artışının altında kaldıysa
  fiilen indirim vardır; TL sabitse kur karşılığı düşmüştür. Snapshot
  karnelemede USD eşdeğeri ayrıca tutulur.

### 2.3 Satıcı profili ve platform davranışı `[OTO]`
- Yeni üyelik + tek ilan + değerlendirmesiz hesap = risk.
- Aynı profilde birden çok şehirde alakasız emtialar = toplayıcı/çalınmış
  hesap şüphesi.
- Platform dışına çekme baskısı ("WhatsApp'tan yaz", "şimdi ara") — ilk
  sorular site içi mesajdan sorulmalı; site içi mesaj kanıt olur.
- Tersine görsel arama: ilan fotoğrafları başka ilan/stok fotoğrafta
  çıkıyorsa sahte ilan `[OTO]` (agent browser ile).
- İlan geçmişi davranışı (bizim snapshot sistemi): düzenli fiyat indirme =
  aciliyet/panik satışı → pazarlık kozu; sil-yeniden-yayın tespiti (aynı
  araç, yeni ilan no, fiyat değişmiş) ilan "tazeleme" taktiğini ortaya
  çıkarır.

### 2.4 Dolandırıcılık kalıpları (hard red-flag) `[AGENT]`
- Görmeden/EFT ile kaporo talebi; "emanetçiye bırakacağım", "kargo ile
  ruhsat-anahtar", "güvenli ödeme linki", QR/kısa link.
- USDT/Papara/paravan hesap; IBAN sahibinin ilandaki isimle uyuşmaması.
- "Şehir dışındayım, komşum anahtarı verir" hikâyeleri; sürekli ertelenen
  buluşma.
- Ödeme disiplini: para **noterde, son imzadan önce**, satıcının kendi adına
  olan hesabına/havuz hesabına; açıklamada plaka + satış bedeli yazar.
- Buluşma: nötr ve gündüz; ekspertiz/noter çevresi tercih edilir; yanına
  biri alınır. "Kaçırırsın" baskısına karar anında uyulmaz — piyasa hep
  benzer araçla doludur.

## 3. Fiziksel inceleme (rapor basılan [İNSAN] checklist)

- Gündüz, yağmursuz, araç temizken; randevudan 15 dk önce gel (hazırlığı gör).
- Kaporta: yansıma hattı sürekliliği, panel aralığı eşitliği, kapı fitili/
  menteşe/cam kenarı boya izleri, mıknatıs testi (macun), çamurluk ağızları
  ve marşpiyel pası.
- **Tavan veya bagaj boyalıysa takla/devrilme şüphesi** — sorgula.
- Alt takım: el feneriyle alt; yeni undersealing kokusu = pas gizleme.
- Lastik: DOT hafta/yıl üretim tarihi, dört lastik eşitliği, aşınma deseni
  (dengesiz = süspansiyon/aksiyon sorunu); jant-kaliper boyaması + abartılı
  egzoz = "galeri paketi" / hor kullanım riski.
- Modifiye: varex, çakar, merceksiz fara xenon, sonradan air süspansiyon,
  "faça" değişimler (jsv direksiyon, çakma sparco vb.) — hem muayene derdi
  hem kullanım profili sinyali; nadir spor modeller hariç elenir.
- İç/direksiyon/vites topuzu/koltuk yıpranması vs beyan km tutarlılığı.
- Tüm elektrikler tek tek (cam, klima, ısıtma, ışıklar); amortisör sallama
  testi; otomatik viteste yokuş tutma testi.
- Soğuk start: satıcı önceden ısıtmışsa sorgula; ilk 5 saniye sesleri
  (tıkırtı=zincir, şakırtı=yağ basıncı, ıslık=kayış), rölanti stabilitesi.
- Test sürüşü: farklı zemin, fren (pedal 4 cm'den fazla inmemeli), düz
  yolda direksiyon bırakma (çekme testi), viraj sesleri, 20–50 km/h ile
  duvar boyunca yankı dinleme.
- Motor/şanzıman değişmişse: hangi servis, hangi tarih, çıkma mı sandık mı
  — evrakla doğrula; garantisi varsa aktarım şartlarını sor.

## 4. Pazarlık ve karar

- Pazarlık kozları sıraya konur: fiyat geçmişi (düşüş sayısı+oranı), ilan
  yaşı, benzer ilan arzı, ekspertiz bulguları, doğrulanamayan alanlar.
- "Para kimdeyse güç ondadır": alıcı acele etmez; her ilan için B-planı
  aracı vardır. Karar eşiği: içinde sinmeyen tek sabit red-flag bile
  "vazgeç" demeye yeter.
- Kaporo zorunluysa: yüzyüze, tutanaklı, satıcı kimliği ve resmi satış
  adımı yazılı; asla görmeden/uzaktan değil.

## 5. A–H blok eşlemesi

| Blok | İçerik | Beslenen sinyaller |
|---|---|---|
| A | Araç özeti + beyanlar | ilan verisi |
| B | Km ve kullanım tutarlılığı | muayene km dizisi, yıpranma çelişkileri |
| C | Tramer (normalize edilmiş) | SBM kayıtları, TÜFE/USD/asgari ücret çapası |
| D | Fiyat vs piyasa | aynı model-yıl-km medyanı, USD eşdeğeri, ilan geçmişi |
| E | Satıcı profili ve davranışı | hesap yaşı, davranış sinyalleri, bireysel/galeri |
| F | Pazarlık stratejisi | E+D+C kozları, doğrulanamayan alanlar |
| G | Red-flag özeti | 2.4 kalıpları + pert/şase + çelişkiler |
| H | 1–5 tavsiye + [İNSAN] checklist | bu dokümanın 3. bölümü |

## Kaynaklar

- ekşi sözlük: ikinci el araba alırken dikkat edilmesi gerekenler
  (https://eksisozluk.com/ikinci-el-araba-alirken-dikkat-edilmesi-gerekenler--138736201)
- DonanımHaber: İkinci el araç alırken en çok yapılan 7 hata
  (https://forum.donanimhaber.com/ikinci-el-arac-alirken-en-cok-yapilan-7-hata-sahadan-gozlemler--163081271)
- DonanımArşivi: Araba ilanı bakarken dikkat edilecekler
  (https://forum.donanimarsivi.com/konu/araba-ilani-bakarken-dikkat-edilmesi-gerekenler-neler.1254557/)
- r/GarajTurkiye: Dolandırılmadan araba nasıl alınır
- r/UsedCars + r/VINvestigators: inspection checklists (soğuk start, aşama
  bazlı kontrol)
- Sahibinden güvenli alışveriş rehberi; MASFED dijital bilgi kontrolü uyarısı
- SBM/tramer sorgu kanalları: e-Devlet (kendi araç), SBM web/SMS 5664
  (plaka/şasi), acente sorgusu
