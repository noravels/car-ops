# car-ops — AI İkinci El Araç Değerlendirme Sistemi

career-ops'un agentic desenini ikinci el araba pazarına uyarlayan, yerel çalışan
ve insan-son-karar prensipli araç analiz pipeline'ı.

## Ne yapar

- İlan URL'si ver → tramer, fiyat, satıcı davranışı ve piyasa karşılaştırmasından
  oluşan yapılandırılmış A–H raporu al.
- İzleme listesindeki ilanların fiyat geçmişini düzenli snapshot'la; satıcının
  "düzenli fiyat indirmiş" gibi davranış sinyallerini biriktir.
- Açıklamadaki iddiaları (ör. "tramer temiz") dış kayıtlarla çapraz kontrol et;
  çelişkiyi red-flag olarak raporla.

## Temel prensipler (career-ops ile aynı)

- **Local-first**: her şey makinede, hesap yok, sunucu yok.
- **AI-agnostic**: mantık `modes/*.md` prompt dosyalarında; Hermes ve Codex
  birinci sınıf desteklenir (bkz. `AGENTS.md`, `CODEX.md`, `OPENCODE.md`).
- **Human-in-the-loop**: sistem hiçbir zaman alım-satım yapmaz; karar her zaman
  kullanıcıdadır.

## Durum

İnşaat aşamasında. Faz A (tek ilan analizi) ve Faz B (watchlist + snapshot)
iskeleti için bkz. `docs/ROADMAP.md`.
