# 📋 Atölyecim ERP — Gelecek Oturum Yapılacaklar ve Geliştirme Haritası

## 📌 1. E-posta İle Gelen Sipariş Otomasyonu (Email-to-Order Integration) [/]
- **Durum:** İşlemde ⏳
- **Amaç:** E-posta ile gelen siparişlerin tek tıkla sisteme düşmesi.
- **Detaylar:**
  - E-posta içeriğini/sipariş metnini veya e-posta entegrasyonu (webhook / e-posta ayrıştırıcı) ile okuyup "Gelen Siparişler" sekmesine aktarma.
  - Tıpkı katalog/WhatsApp siparişlerinde olduğu gibi tek tıkla onaylandığında stokların düşmesi, borç/alacak hesabının yazılması ve imalat sürecine girmesi.

---

## 📌 2. Telefonla ve Yüz Yüze (Atölyeden) Gelen Siparişler İçin Hızlı Giriş & Fikirler [/]
- **Durum:** İşlemde ⏳
- **Sorun:** Telefonda konuşurken veya müşteri atölyedeyken uzun uzun sipariş formu doldurmak vakit alıyor.
- **Önerilen Çözüm ve Otomasyon Fikirleri:**
  1. **Atölye Banko QR Kodu (Kiosk / Müşteri Kendi Seçsin):**
     - Atölyeye gelen müşteri masadaki QR kodu telefonuyla okutur.
     - Direkt katalog açılır, müşteri modelini ve adetlerini seçip "Siparişi Gönder" der. Sipariş saniyesinde paneline "Gelen Sipariş" olarak düşer.
  2. **10 Saniyelik Hızlı Sipariş Modalı (Fast Order Express):**
     - Sadece Müşteri Seç + Model Kodu Seç + Adet Gir şeklinde 3 tıklamalık hızlı modal.
     - Barkod okuyucu desteği: Ürünün kutu/örnek barkodunu okutunca direkt adedi girip kaydedebilme.
  3. **Şablon / Sık Verilen Siparişler (Favori Siparişler):**
     - Müşterinin sürekli aldığı 100-200 çiftlik standart serileri "Tek Tıkla Tekrarla" butonuyla anında oluşturma.

---

## 📌 3. Ürün Ekleme/Düzenleme Ekranına Renk Seçeneklerini Geri Ekleme [x]
- **Durum:** Tamamlandı ✅
- **Detaylar:**
  - Ürün eklerken ve düzenlerken renk varyantı/seçeneği alanları yeniden aktif edildi.
  - WhatsApp ve katalog siparişlerinde renk matrisi geri getirildi.

---

## 📌 4. Giriş Ekranına "Beni Hatırla" (Remember Me) Özelliği [x]
- **Durum:** Tamamlandı ✅
- **Detaylar:**
  - Giriş formuna "Beni Hatırla" seçeneği eklendi.
  - Oturum anahtarları LocalStorage üzerinde güvenli şekilde saklanıp otomatik giriş yapılması sağlandı.

---

## 📌 5. Gelişmiş Göz Alıcı Ana Panel (Executive Dashboard & Satış Analizleri) [x]
- **Durum:** Tamamlandı ✅
- **Detaylar:**
  - 1-3-6-12 aylık periyot filtreli dinamik analizler eklendi.
  - Canlı Canvas çubuk grafik (Bar Chart), donut grafik (Donut Chart) ve dereceli model performans tablosu eklendi.
  - Bilgi kartlarına tıklanarak ilgili sayfalara hızlı yönlendirme sağlandı.
  - Mobil ekranlarda yazı taşması ve kayması tamamen düzeltildi.
  - Tüm güncellemeler başarıyla Vercel üretimine (`https://atolyecim.vercel.app`) aktarıldı.

---

## 📌 6. Sistem Genelinde Kod Denetimi ve Hata Giderme (Code Audit & Auto-Fix)
- **Amaç:** Sistemdeki tüm dosyaları tarayarak gizli hata, bug, performans veya güvenlik zafiyetlerini (XSS, memory leak vb.) tespit edip düzeltmek.
- **Detaylar:**
  - Tüm JS, CSS ve HTML dosyalarının otomatik statik analizi.
  - Hata, bug ve uyumsuzlukların giderilmesi.

---

## 📌 7. Sistem Tanıtım & Kurumsal Broşür (PDF / Tanıtım Dokümanı)
- **Amaç:** Potansiyel müşterilere veya workshop üyelerine gösterilmek üzere uygulamanın özelliklerini, yeteneklerini ve veritabanı yapısını anlatan şık bir tanıtım PDF'i / broşürü hazırlamak.
- **Detaylar:**
  - Özellikler listesi, ekran görüntüleri/mockup linkleri ve mimari yapının anlatılması.
  - PDF veya PDF olarak çıktı alınabilecek şık bir HTML/Markdown dökümanının hazırlanması.
