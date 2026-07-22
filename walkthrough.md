# 🏁 Atölyecim ERP — PC'den Telefone Anlık Bildirim (ntfy.sh) Entegrasyonu Walkthrough

Bu güncelleme ile PC'de yapılan veri değişikliklerinin (yeni sipariş, stok eksikliği vb.) telefona anında ve arka planda push bildirimi olarak iletilebilmesi için **ntfy.sh** anlık bildirim köprüsü entegre edilmiştir.

## 🚀 Canlı Sürüm
- **Üretim URL'si:** [atolyecim.vercel.app](https://atolyecim.vercel.app)
- **Alt URL:** [atolyecim-3nr47cuoc-atoelyecim.vercel.app](https://atolyecim-3nr47cuoc-atoelyecim.vercel.app)

---

## 🛠️ Neler Yapıldı?

### 1. ntfy.sh HTTP Push Entegrasyonu (`app.js`)
- PC'de veya herhangi bir cihazda `sendNotificationAlert` tetiklendiğinde, sistem arka planda `ntfy.sh` sunucularına bir `POST` isteği gönderir.
- **Benzersiz Konu Kodlaması:** Her atölyenin bildirimleri kendine özel kalsın diye, Supabase veritabanı URL'sinin SHA-256 hash'inden elde edilen benzersiz 16 karakterli bir konu (topic) kodu (`atolyecim_<unique_hash>`) oluşturuldu.

### 2. Yönetici Arayüzü Rehberi (`index.html`)
- Yönetici paneline **"📱 Telefondan Anlık Bildirim Alma (ntfy)"** rehber kartı eklendi.
- Kart içerisinde, kullanıcının telefonuna kuracağı ntfy uygulamasında abone olması gereken benzersiz konu kodu anlık olarak hesaplanıp gösterilmektedir.

---

## 🧪 Doğrulama ve Derleme Sonuçları

Vite derleme testi başarıyla sonuçlandı:
```bash
vite v6.4.3 building for production...
transforming...
✓ 54 modules transformed.
rendering chunks...
computing gzip size...
dist/assets/manifest-BSozu0f4.json    0.65 kB │ gzip:  0.32 kB
dist/index.html                     116.08 kB │ gzip: 20.80 kB
dist/assets/index-B7Ti-LSL.css       35.73 kB │ gzip:  7.61 kB
dist/assets/index-BfeOCp6n.js       355.49 kB │ gzip: 92.48 kB
✓ built in 5.07s
```
