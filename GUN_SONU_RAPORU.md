# 🏆 Atölyecim ERP — Gün Sonu İşlem ve Geliştirme Raporu

**Son Güncelleme Tarihi:** 10 Eylül 2026  
**Canlı Sistem (Production):** [https://atolyecim.vercel.app](https://atolyecim.vercel.app)  
**GitHub Deposu:** [https://github.com/furkanaydemir17/atolyecim](https://github.com/furkanaydemir17/atolyecim)  
**Veritabanı:** Supabase Cloud (Canlı & Korunuyor)  
**Git Durumu:** `main` ve `master` dalları senkronize, çalışma ağacı temiz.

---

## 📌 10 Eylül 2026 — Yapılan Geliştirme ve İyileştirmeler

Bugün Atölyecim ERP sisteminde yazdırma süreçleri, fason/cari hesap ekstreleri ve atölye iş takip fişinin fiziksel orijinaline birebir uyarlanması üzerine kapsamlı geliştirmeler tamamlanmıştır:

---

### 1. 📅 Fason Takip & Cari Hesap Ekstrelerine Tarih Aralığı Filtresi
- **İhtiyaç:** Fason takip ve cari hesap ekstrelerinde belirli bir tarih aralığındaki hareketleri görebilme ve sadece o aralığı yazdırabilme ihtiyacı.
- **Yapılan İşlemler:**
  - Fason Takip ve Cari Hesap ekstre modallarına dinamik **"Başlangıç Tarihi"** ve **"Bitiş Tarihi"** seçicileri eklendi.
  - Seçilen tarih aralığına göre ekstre tablosu ve yazdırma çıktısı anında süzülüyor.
  - **Devreden Bakiye Otomasyonu:** Seçilen başlangıç tarihinden önceki tüm hareketlerin net toplamı otomatik hesaplanarak ekstre tablosunun en üstüne **"Önceki Dönemden Devreden Bakiye"** olarak eklendi. Böylece hesap geçmişi ve toplam bakiye doğruluğu korunarak yazdırma alınabiliyor.

---

### 2. 🖨️ Yazdırma Kenar Boşlukları ve Taşma Düzeltmesi
- **İhtiyaç:** Fason hesap ekstresi ve iş takip fişinin yazıcıdan çıkartılırken köşelerden kağıda sığmaması ve taşması.
- **Yapılan İşlemler:**
  - Yazıcı sayfa kenar boşlukları standartlaştırıldı (`@page { margin: 4mm 6mm; }`).
  - A5 formatı için genişlik `138mm`, A4 formatı için `196mm` olarak optimize edildi.
  - `-webkit-print-color-adjust: exact` ve `print-color-adjust: exact` ile renklerin solması engellendi.
  - Çıktılar standart yazıcılarda kenarlardan kırpılmadan ve sayfadan taşmadan tam oturacak şekilde ayarlandı.

---

### 3. 🎫 Orijinal Atölye İş Takip Fişi (1/3 A4 & 4 Koparılabilir Perfore Kupon)
- **İhtiyaç:** Kullanıcının atölyede kullandığı orijinal fiziksel fiş örneğine (1/3 A4) tam uyumlu, 4 koparılabilir kuponlu fiş tasarımı.
- **Yapılan İşlemler:**
  - Kullanıcının ilettiği fiziksel iş takip fişi referans alınarak 1/3 A4 ebatlarında (`196mm × 92mm`) birebir modellendi.
  - **Ana Fiş Bölümü (128mm):**
    - Kırmızı daktilo kaşe stili seri numarası (`1105`), Müşteri Adı ve Teslim Tarihi üst başlığı.
    - 6 sütunlu teknik detay tablosu: `MODEL`, `DERİ`, `ASTAR`, `DİKİŞ`, `KALIP`, `TABAN`.
    - 7 numaralı asorti dağılım tablosu: `36`, `37`, `38`, `39`, `40`, `41`, `42` ve `TOPLAM ÇİFT`.
    - Usta imza ve onay kutuları: `KESİCİ`, `SAYACI`, `KALFA`.
    - Alt kurumsal detaylar: `KLİŞE`, `AMBALAJ`, `SİPARİŞ VEREN`, `NOT` kutuları.
  - **4 Bölmeli Koparılabilir Kupon Alanı (68mm):**
    - Kesikli perfore çizgilerle ayrılmış 4 adet dikey kupon:
      1. **KALFA Kuponu (15mm)**
      2. **SAYACI Kuponu (15mm)**
      3. **KLİŞE Kuponu (23mm):** İçerisinde 36'dan 42'ye mini 8 sütunlu numara dağılım tablosu.
      4. **KESİCİ Kuponu (15mm)**
    - Kupon içerikleri 90 derece saat yönünde döndürülerek (`transform: rotate(90deg)`) hazırlandı. Fişten koparıldığında her biri düzgün okunabilir yatay mini kart haline geliyor.

---

### 4. 🎯 Kullanıcı Geri Bildirimlerine Göre Yapılan İnce Ayarlar
- **Teslim Tarihi Genişletildi:** Teslim tarihi hücresi `34mm`'den `52mm`'ye genişletildi, `flex-shrink: 0` ve `white-space: nowrap` eklenerek tarihin tek satırda net görünmesi sağlandı.
- **Alt Kesim Çizgisi Kaldırıldı:** Sayfa altındaki makas simgesi ve "1/3 A4 KESİM ÇİZGİSİ" ibaresi tamamen kaldırıldı.
- **Arkaplan Filigranları Temizlendi:** Fiş ve kupon arkaplanlarındaki "Atölyecim Master" filigranları ve yazıları temizlendi; bembeyaz, profesyonel ve sade bir zemin oluşturuldu.
- **3'lü A4 Yazdırma Seçeneği:** Kullanıcı ister tek fiş (1/3 A4) ister tek bir A4 kağıdına art arda 3 adet fiş basabilecek şekilde ("📄 3'lü A4") opsiyonel çıktı modu eklendi.

---

### 5. 🛡️ Veri Tabanı, Git ve Yayın Durumu
- **Supabase Cloud DB:** Tüm siparişler, fason hareketleri, kasalar ve fişler Supabase üzerinde güvenle saklanmaktadır.
- **Vite Production Build:** `npm run build` başarıyla derlendi.
- **GitHub Senkronizasyonu:** `main` ve `master` dalları son commitlerle eşitlendi ve pushlandı.
- **Vercel Canlı Yayın:** `https://atolyecim.vercel.app` adresinde tüm güncellemeler anlık olarak yayındadır.

---

<details>
<summary><b>📂 Önceki Güncellemeler Arşivi (3 Eylül 2026)</b></summary>

### 3 Eylül 2026 — Önceki İşlemler Özeti
1. **Siparişler Tablosu Akordiyon Tasarımı ve Kolon Sadeleştirmesi:** Toplam Çift, Fiyat ve Termin akordiyon içine taşındı; satır tıklanabilir yapıldı.
2. **Teslim Fişi ve Koli Etiketi Boş Sayfa Çıktı Hatasının Giderilmesi:** `@media print` ve `afterprint` zamanlamaları düzeltildi.
3. **Koli Etiketi A4 Çerçevesi:** Siyah kesim çerçevesi eklendi.
4. **Harcamalar Tutar Girişinde Nokta ve Virgül Desteği:** Hem nokta hem virgül girişleri normalize edildi.
5. **İş Takip Fişlerinin Küçükten Büyüğe Sıralanması:** Seri numarasına göre otomatik artan sıralama.
6. **İş Takip Fişine "Beklemede" Aşaması Eklenmesi:** Yeni aşama ve varsayılan durum entegre edildi.
7. **Aşama Açılır Kutusunun Genişletilmesi:** Görsel taşmalar engellendi.
8. **İş Takip Fişi Tablosunun Görsel Ayrıştırılması:** Satır sınırları ve istatistik kartları yenilendi.
9. **İş Takip Fişi Çıktısının 1/3 A4 Dikey Şerit Formatına Dönüştürülmesi.**
10. **Barkod Okutma Modülünün Sistemden Kaldırılması.**
11. **Fason Takip Modülünden WhatsApp'ın Kaldırılması.**
12. **Fason Tablosuna Doğrudan "Ödeme Yap" Butonu Eklenmesi.**

</details>
