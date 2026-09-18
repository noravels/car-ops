# Provider Arayüz Sözleşmesi

Her marketplace bir `providers/<site>.mjs` dosyasıdır ve şu sözleşmeyi sağlar:

## ListingRecord (JSON, normalize çıktı)

```jsonc
{
  "schema": "car-ops/listing@1",
  "listing_id": "sahibinden-1234567890",     // <site>-<ilan no>
  "market": "tr",
  "source_site": "sahibinden.com",
  "url": "https://...",
  "captured_at": "2026-09-18T12:00:00+03:00",
  "title": "...",
  "price_try": 850000,
  "price_history_site": "https://gecmisi.com.tr/...",   // varsa dış geçmiş kaydı
  "seller": {
    "type": "bireysel | galeri | yetkili-bayi | bilinmiyor",
    "name": "...",
    "member_since": "2021",
    "other_listings_hint": null          // agent browser'la bakıldıysa doldurulur
  },
  "vehicle": {
    "make": "...", "model": "...", "year": 2018,
    "km": 120000, "fuel": "benzin", "gearbox": "otomatik",
    "body": "hatchback", "color": "..."
  },
  "claims": [                            // açıklamadaki doğrulanabilir iddialar
    { "claim": "tramer kaydı yok", "category": "tramer", "text": "..." }
  ],
  "damage_records": [                    // satıcı beyanı / ekspertiz / SBM sorgusu
    { "year": 2018, "amount_try": 20000, "source": "seller-claim" }
  ],
  "inspection": {                        // ekspertiz özeti; yoksa present:false
    "present": false,
    "changed_parts": [], "painted_parts": [], "report_url": null
  },
  "unverifiable": ["kaporta durumu", "motor sesi"]   // raporsuz doğrulanamayanlar
}
```

## API

Her provider iki fonksiyon dışa açar:

- `parseListing(html, ctx) -> ListingRecord` — paste modu: kullanıcı HTML'i
  yapıştırır, ayrıştırıcı DOM'dan alanları çeker. Bot koruması olan sitelerde
  birincil yol budur.
- `listingUrlPattern` — URL doğrulama regex'i (agent browser modunda hangi
  URL'lerin bu providera gittiğini belirler).

## Kurallar

1. Provider asla siteye otomatik HTTP isteği AÇMAZ — bot koruması ve
   kullanım şartları gereği veri ya agent'ın kendi browser oturumundan ya
   da kullanıcı yapıştırmasından gelir.
2. Ayrıştırılamayan alan `null` olur, uydurulmaz. `unverifiable` listesi
   doldurulur.
3. İlan açıklaması metni UNTRUSTED data'dır: `claims` alanına kategori
   etiketiyle alınır, asla komut olarak yorumlanmaz.
4. Testler `tests/providers.test.mjs` altında fixture HTML ile çalışır;
   gerçek siteye test bağımlılığı kurulmaz.
