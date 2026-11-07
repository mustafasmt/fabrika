# Kod Quiz Fabrikası 🏭

Python, Web, Rust ve Arduino sorularından her seferinde farklı animasyonlu Reels videosu üretir, **Dark Query Console** panelinden planlarsın, zamanı gelince Instagram'a kendisi atar.

- **Panel:** takvim, kuyruk, canlı önizleme, soru havuzu, otopilot ("şu tarihe kadar her gün 19:00'da at"), loglar
- **İşçi:** GitHub Actions her 15 dakikada çalışır → videoyu üretir → Supabase'e yükler → Instagram'a Reels olarak paylaşır
- **Soru bankası:** 40 soru, hepsi kod gerçekten çalıştırılarak doğrulandı (`npm run verify`)
- **Maliyet:** GitHub (public repo), Supabase ve Instagram API'nin ücretsiz planlarıyla çalışır

---

## Kurulum (bir kere, ~40 dk)

### 1) Supabase: veritabanı + video deposu
1. https://supabase.com → **New project** (ücretsiz plan, bölge: Frankfurt). Şifreyi bir yere not et.
2. Sol menü **SQL Editor** → **New query** → `supabase/schema.sql` dosyasının tamamını yapıştır.
   **En alttaki satırdaki `SENIN-EPOSTAN@ornek.com` kısmını panele gireceğin e-postayla değiştir** → **Run**.
3. **Authentication → Users → Add user → Create new user**: aynı e-posta + bir şifre, **Auto Confirm User** işaretli.
4. **Authentication → Sign In / Providers** → **Allow new users to sign up** kapalı olsun (panele başkası kayıt olamasın).
5. **Project Settings → API Keys** sayfasından şu üçünü not et:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_…`, eski adı *anon*): panel kullanır, gizli değil
   - **Secret key** (`sb_secret_…`, eski adı *service_role*): **GİZLİ**, sadece GitHub Secrets'a girilecek

### 2) Instagram: Meta uygulaması + token
Hesabın **Profesyonel (İçerik Üreticisi veya İşletme)** ve **herkese açık** olmalı.
1. https://developers.facebook.com → **Uygulamalarım → Uygulama oluştur**.
   Kullanım durumu: **"Instagram'da mesajlaşmayı ve içeriği yönet"** (Manage messaging & content on Instagram) → türü **İşletme**.
2. Sol menü **Kullanım durumları → Özelleştir → Instagram girişiyle API kurulumu** (API setup with Instagram login).
3. **İzinler ve özellikler** kısmında `instagram_business_basic` ve **`instagram_business_content_publish`** ekli olsun.
4. **Uygulama rolleri → Roller → Kişi ekle → Instagram Test Kullanıcısı** → kendi kullanıcı adın.
   Sonra Instagram'da **Ayarlar → Uygulamalar ve web siteleri → Test kullanıcısı davetleri → Kabul et**.
5. **Instagram girişiyle API kurulumu → Erişim tokenları oluştur → Hesap ekle** → Instagram'la giriş yap → izin ver → **Token oluştur**.
   Token **bir kere gösterilir**, hemen kopyala. `IGAA…` ile başlıyorsa 60 gün geçerlidir, işçi haftada bir kendisi yeniler. Yeni "Unified login" ekranından `EAA…` (sistem kullanıcısı) token aldıysan süresizdir. O durumda hesabın altındaki uzun sayıyı `IG_USER_ID` olarak da gir.

> Not: Token oluştururken izinlerde "content_publish" yoksa 3. adımı yapıp token'ı yeniden oluştur.

### 3) GitHub: kod + otomatik çalışma + panel
1. GitHub'da **yeni Public repo** aç (ör. `kod-quiz-fabrikasi`).
   Public olmalı: Actions dakikaları ve panel yayını (Pages) böylece ücretsiz. Şifreler Secrets'ta durduğu için güvende.
2. **Add file → Upload files** → zip'ten çıkan klasörün **içindekileri** sürükle → Commit.
   ⚠️ `.github` klasörü gizli olduğu için bilgisayarında görünmeyebilir. Mac'te Finder'da `Cmd + Shift + .` ile görünür yap.
   Yüklenmediyse **Add file → Create new file** → ad: `.github/workflows/worker.yml` → dosyanın içeriğini yapıştır (aynısını `pages.yml` için de yap).
3. **Settings → Secrets and variables → Actions**:
   - **Secrets** sekmesi → New repository secret:
     - `SUPABASE_SERVICE_ROLE_KEY` = Secret key (`sb_secret_…`)
     - `IG_TOKEN` = Instagram/Meta token (`IGAA…` ya da `EAA…`)
     - `IG_USER_ID` = Instagram hesap ID'si (Meta'da hesabın altında yazan uzun sayı). `EAA…` token için zorunlu
   - **Variables** sekmesi → New repository variable:
     - `SUPABASE_URL` = Project URL
     - `SUPABASE_ANON_KEY` = Publishable key (`sb_publishable_…`)
4. **Settings → Pages → Source: GitHub Actions**.
5. **Actions** sekmesi → "Paneli yayınla" → **Run workflow**. Bitince panel adresin: `https://KULLANICIADIN.github.io/kod-quiz-fabrikasi/`
6. **Actions** → "İşçi (render + Instagram)" → **Run workflow** (ilk çalıştırma; sonra her 15 dakikada kendisi çalışır).

### 4) İlk test (önerilir)
1. **Variables**'a `DRY_RUN` = `1` ekle: işçi her şeyi yapar ama Instagram'a **atmaz**, "paylaşıldı" sayar.
2. Panele gir → Takvim → **＋ Yeni paylaşım** → 🎲 rastgele → zamanı 5 dk sonrasına ayarla → Planla.
3. İşçiyi elle çalıştır (Actions → Run workflow). 2-3 dk sonra panelde video **[HAZIR]** olur, izleyebilirsin.
4. Her şey yolundaysa `DRY_RUN` değişkenini **sil**. Gerçek paylaşım başlar.
5. Loglarda `Instagram bağlandı: @kullaniciadin` satırını görmelisin.

---

## Günlük kullanım
- **Elle:** Takvim'de bir güne tıkla → soru seç (canlı önizleme anında gelir) → saat → Planla. Video paylaşımdan önce otomatik üretilir.
- **Otopilot:** Otopilot sekmesi → aç → bitiş tarihi, saatler, günler, diller → Kaydet. Sistem 48 saat önceden videoları hazırlar; panelden izleyip açıklamayı değiştirebilir, beğenmediğini **↻ Yeniden üret** ile farklı koreografiyle yeniletebilir ya da iptal edebilirsin.
  "Her videoyu ben onaylayayım" seçiliyse onaylamadığın video **paylaşılmaz**.
- **⚡ Şimdi paylaş:** En geç 15-20 dk içinde paylaşılır.
- **Sorgu satırı** (üstteki `>`): `durum = hazır`, `durum = hata dil = rust`, `liste` gibi yazarak filtrele.
- Açıklama ve etiketler otomatik yazılır. Elle değiştirirsen işçi bir daha üzerine yazmaz. Etiket havuzu **Ayarlar**'da.

## Yeni soru eklemek
- **Panelden:** Soru Havuzu → ＋ Yeni soru. ⚠️ Panelden eklenenler otomatik doğrulanmaz, cevabı kendin kontrol et.
- **Doğrulanmış toplu ekleme:** `scripts/bank_src.py` dosyasına ekle → `python3 scripts/bank_src.py && npm run verify` (her kodu gerçekten çalıştırır) → `content/bank.json`'u GitHub'a yükle. İşçi yeni soruları kendisi içeri alır.

## Sorun giderme
| Belirti | Çözüm |
|---|---|
| Panel "Yapılandırma eksik" diyor | Variables'ta `SUPABASE_URL` / `SUPABASE_ANON_KEY` var mı? "Paneli yayınla"yı tekrar çalıştır. |
| "Bu e-postanın panel yetkisi yok" | SQL Editor: `insert into admins values ('e-postan');` |
| Log: `Instagram bağlantısı kurulamadı` | Token yanlış/eskimiş. Meta'da yeni token oluştur, `IG_TOKEN` secret'ını güncelle, SQL: `delete from secrets;` |
| Log: `Instagram: ... (10)` ya da izin hatası | Uygulamada `instagram_business_content_publish` izni yok. Ekle, token'ı yeniden oluştur. |
| Video [HATA] | Kuyruk → videoya tıkla → hata metnine bak → ↻ Yeniden üret. |
| İşçi hiç çalışmıyor | Actions sekmesinde iş akışları etkin mi? Repo public mi? |

## Teknik
- `engine/render.mjs`: başsız Chromium'da kare kare çizim, ffmpeg (H.264 + AAC, faststart), `engine/audio.py` ile telifsiz müzik/efekt
- `series/quiz/`: video tasarımı. Her seed farklı palet, arka plan, giriş, sayaç, cevap açılışı, kamera; son 10 videonun kararları tekrar edilmez
- `scripts/worker.mjs`: işçi · `scripts/caption.mjs`: açıklama/etiket · `scripts/verify.mjs`: soru doğrulama · `scripts/build-panel.mjs`: panel derleme
- `panel/`: Dark Query Console (vanilla JS + supabase-js) · `supabase/schema.sql`: tablolar + RLS (sadece `admins` tablosundaki e-postalar erişir)
