# car-ops Komut Referansı

## Faz A — tek ilan analizi

1. İlan verisini topla (sırayla dene):
   a. Agent browser'ı ile ilan URL'sini aç, ana alanları oku
      (`providers/base.md` ListingRecord alanları).
   b. Bot koruması engellerse: kullanıcıdan ilan sayfasını browser'da açıp
      HTML'i kopyalamasını iste → `node paste-listing.mjs < kayit.html`
   2. Kayıt: `node paste-listing.mjs --out data/listings/<id>.md` (veya
      agent ListingRecord JSON'unu doğrudan yazılır).
3. Tramer sorgusu: kullanıcı e-Devlet/SBM çıktısını paylaşır veya plaka ile
   SBM web sorgusu agent browser'ından okunur (ücretli sorguda kullanıcı
   onayı zorunlu) → `data/listings/<id>-tramer.json`
4. Normalize: `node tramer-normalize.mjs data/listings/<id>-tramer.json`
5. Rapor: `modes/tr/arac.md` prompt'unu izleyerek A–H bloklarını üret,
   `reports/NNN-<slug>.md` olarak yaz. NNN = bir sonraki boş numara
   (`ls reports/`).

## Faz B — watchlist ve snapshot

- `node snapshot-cli.mjs --id <id> --price <TL> [--km N] [--usd N] [--status aktif|kapandi]` —
  agent browser'dan okuduğu anlık değeri `data/snapshots/<id>.jsonl`'e append
  eder (aynı gün fiyat değişmediyse satır yazmaz); cron'la düzenli çalışır.
- `node watch-report.mjs` — snapshot farklarından düşüş/çıkarma/sinyal raporu.
- İlan kaydı watchlist'e yalnızca kullanıcı onayıyla eklenir.

## Testler

`node --test tests/` — tüm paket. Yeni özellik = önce test.
