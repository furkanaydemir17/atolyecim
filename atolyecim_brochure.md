# Atölyecim ERP — Kurumsal Tanıtım Broşürü

Atölyecim ERP; ayakkabı üretim atölyelerinin sipariş, stok, reçete ve cari hesap süreçlerini tek bir platformdan yönetmelerini sağlayan, modern ve bulut tabanlı bir kurumsal kaynak planlama (ERP) yazılımıdır.

---

## 📊 1. Temel Modüller ve Özellikler

### 1.1 Executive Dashboard (Ana Panel)
- **Zaman Bazlı Raporlama:** 1, 3, 6 ve 12 aylık periyot filtreleriyle ciro, alacak/borç dengesi, toplam sipariş ve satılan çift adedi.
- **Canlı Grafikler (Canvas):** En çok satan ilk 10 model kodunun dikey çubuk grafikle ve sipariş durumlarının donut grafikle anlık takibi.
- **Model Performans Tablosu:** Dereceli sıralamayla en karlı modeller, adetler, ciro payları ve oran barları.

### 1.2 Detaylı Sipariş & İmalat Yönetimi
- **Çoklu Renk & Varyant Girişi:** Müşteri bazlı renk, model ve numara (asorti) dağılımıyla sipariş alma.
- **Üretim & Kargo Takibi:** Siparişlerin imalattan sevkiyata kadar tüm aşamalarını yönetebilme.

### 1.3 Stok ve Reçete Yönetimi
- **Malzeme Reçeteleri (Recipe):** Ürünler için taban, astar, saya vb. sarf malzeme reçeteleri oluşturma.
- **Otomatik Düşüm:** Sipariş girildiğinde hammaddelerin stoktan otomatik düşülmesi ve yetersiz stok uyarıları.

### 1.4 Cari Hesap Defteri (Ledger)
- **Hesap Detayları:** Müşteri ve tedarikçilerin borç, alacak, ödeme ve tahsilat hareketlerini listeleyen finansal defter.
- **Otomatik Bakiye:** Her carinin net bakiyesini anlık hesaplama.

---

## ✉️ 2. Akıllı Otomasyon Entegrasyonları

### 2.1 E-posta Sipariş Otomasyonu (Email-to-Order)
- Müşteriden gelen sipariş maillerini doğrudan kopyalayıp yapıştırarak sistemin akıllı Regex motoruyla taramasını sağlayabilirsiniz.
- Sistem müşteri adını, modeli, renk ve numara/adet dağılımlarını anında analiz eder ve tek tıkla "Gelen Siparişler" sekmesine kaydeder.

### 2.2 Hızlı Sipariş Girişi (Ekspres Panel)
- Telefonda veya atölyede yüz yüze hızlı sipariş almak için tasarlanmış ekspres matris formudur.
- 36'dan 45 numaraya kadar olan adetleri yan yana yazarak 10 saniyede sipariş oluşturup anında stoktan düşebilirsiniz.

### 2.3 WhatsApp Entegrasyonu
- Siparişler onaylandığında veya kargoya verildiğinde müşterilere tek tıkla otomatik WhatsApp durum bilgilendirmesi atabilirsiniz.

---

## 🔒 3. Güvenlik ve Altyapı Mimari Tablosu

| Özellik | Teknik Detay | Faydası |
| :--- | :--- | :--- |
| **Çoklu Kiracı (Multi-Tenant)** | Supabase Row Level Security (RLS) seviyesinde veri izolasyonu. | Her atölyenin verileri tamamen kendine aittir, asla diğer firmalarla karışmaz. |
| **Veri Şifreleme** | SHA-256 tabanlı oturum anahtarları ve şifreleme. | Şifreler ve oturumlar en yüksek kriptografik standartlarla korunur. |
| **Offline Çalışma (PWA)** | Service Worker (`sw.js`) ve IndexedDB yerel yedekleme. | İnternet kesilse bile uygulama açılmaya ve sipariş kaydetmeye devam eder. |

---

## 🚀 Sonuç
Atölyecim ERP, ayakkabı imalat sektörünün dijitalleşmesini sağlayarak kağıt-kalem veya Excel karmaşasına son verir, üretiminizi tam kontrol altında tutar.
