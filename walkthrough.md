# 🚀 YENİ İMALAT VE SİPARİŞ ÖZELLİKLERİ WALKTHROUGH

Atölyecim ERP sisteminde ayakkabı imalat sektörünün ihtiyaçları doğrultusunda 6 kritik geliştirme yapılmış ve Vercel deploy sorunları giderilerek hepsi canlıya alınmıştır.

---

## 🛠️ Yapılan Değişiklikler

### 1. Sipariş Girişinde Ürün Çoğaltma Fixi
- Sipariş girildiğinde arka planda otomatik olarak `products` tablosuna mükerrer yeni ürün satırı açma mantığı kaldırıldı.
- Siparişler artık ürün kataloğunu kirletmez; model kodunu ve renk dağılımını kendi bünyesinde güvenle saklar.

### 2. Multi-Tenant Bildirim İzolasyonu
- Supabase Realtime ve Push bildirim sunucusuna katı atölye/firma izolasyonu (`workshop_id` & `_ownerCompany`) getirildi.
- Her atölye sadece kendi personeli tarafından girilen siparişleri ve bildirimleri görür. Başka firmaların bildirimleri kesinlikle karışmaz.

### 3. Hızlı Asorti Doldurma Butonları
- Sipariş giriş ekranında renk grubu alanlarına tek tıkla asorti doldurmayı sağlayan butonlar eklendi:
  - **Kadın (8 Çift):** 36:1, 37:2, 38:2, 39:2, 40:1
  - **Kadın (12'li):** 35:1, 36:2, 37:2, 38:3, 39:2, 40:1, 41:1
  - **Erkek (8 Çift):** 40:1, 41:2, 42:2, 43:2, 44:1
  - **Erkek (12'li):** 39:1, 40:2, 41:2, 42:3, 43:2, 44:1, 45:1
  - **Çocuk (10'lu):** 26-35 arası 1'er çift

### 4. Satış Faturası -> "Teslim Fişi" Dönüşümü
- Yazdırılabilir A4 şablonundaki mavi "FATURA" başlığı kaldırıldı; kurumsal ve temiz **"TESLİM FİŞİ"** formatına dönüştürüldü.
- Vergi dairesi/vergi no zorunluluğu kaldırıldı; yerine serbestçe doldurulabilir **"BİLGİ & SEVKİYAT NOTU"** (ambar, şoför, plaka vb.) alanı eklendi.
- Varsayılan KDV oranı `%0 (Net)` olarak ayarlandı.

### 5. İş Takip Fişlerine Bölme Sihirbazı
- Siparişler tablosundaki satırlara **"Fişlere Böl (🏭)"** butonu eklendi.
- Büyük siparişler (örneğin 300 çift), seçilen parti boyutuna göre (12'li, 24'lü vb.) ardışık seri numaralı İş Takip Fişlerine otomatik olarak bölünerek A5 çıktısına hazır hale getirilir.

### 6. Gelişmiş Ayakkabı Reçetesi (BOM) & Canlı Maliyet Motoru
- Malzeme Reçetesi (BOM) modalına tek tıkla uygulanabilir hazır ayakkabı şablonları eklendi:
  - *Erkek Klasik Kösele*, *Kadın Stiletto*, *Sneaker / Spor*, *Kışlık Bot*, *Sandalet*
- Reçeteye eklenen her malzemenin birim fiyatı ve sarfiyat miktarına göre çift başı canlı maliyeti hesaplanarak en üstteki özet panelinde anlık olarak gösterilir.

---

## 🧪 Test ve Doğrulama Sonuçları
- Tüm backend ve frontend kodları başarıyla derlendi (Vite build passed).
- Vercel üzerindeki takım scope'u (`team_A52tA2Gp8uHqMG2SWPOil0AJ`) uyumsuzluğu manuel deploy ile aşıldı ve en güncel sürüm **[https://atolyecim.vercel.app](https://atolyecim.vercel.app)** adresinde yayına alındı.
- Canlı site üzerinde "FATURA" ibarelerinin tamamen "TESLİM FİŞİ"ne dönüştüğü doğrulanmıştır.

