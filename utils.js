/* =========================================
   ATÖLYECİM — Ortak Yardımcı Fonksiyonlar (Utils)
   D1: Tekrarlanan escape() fonksiyonu tek yere taşındı
   D2: _bound pattern utility haline getirildi
   D3: trMap tek yere taşındı
   Y1: Para birimi işlemleri integer aritmetik (kuruş)
   ========================================= */

// --- XSS Koruması (K6) ---
const _escapeEl = document.createElement('div');

/**
 * HTML özel karakterlerini escape eder (XSS koruması).
 * Tek bir DOM elemanı yeniden kullanılır (O11 — performans düzeltmesi).
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  _escapeEl.textContent = String(str);
  return _escapeEl.innerHTML;
}

// --- Güvenli DOM Metin Ayarlama ---
/**
 * Bir DOM elemanının textContent'ini güvenli şekilde ayarlar.
 * innerHTML yerine kullanılmalıdır.
 * @param {HTMLElement} el
 * @param {string} text
 */
export function safeText(el, text) {
  if (el) el.textContent = text ?? '';
}

// --- Event Binding (D2) ---
/**
 * Bir DOM elemanına olay dinleyicisi ekler, tekrarlı bağlamayı önler.
 * _bound pattern'ını standartlaştırır.
 * @param {HTMLElement} el
 * @param {string} event
 * @param {Function} handler
 * @param {string} [key] — aynı elemana birden fazla farklı event bağlamak için
 */
export function bindOnce(el, event, handler, key) {
  if (!el) return;
  const flag = `_bound_${key || event}`;
  if (el[flag]) return;
  el[flag] = true;
  el.addEventListener(event, handler);
}

// --- Türkçe Karakter Dönüşümü (D3) ---
const TR_MAP = {
  'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
  'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
  'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
};

/**
 * Türkçe karakterleri ASCII karşılıklarına dönüştürür.
 * @param {string} str
 * @returns {string}
 */
export function trToAscii(str) {
  if (!str) return '';
  return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, ch => TR_MAP[ch] || ch);
}

// --- Para Birimi Yardımcıları (Y1 — Float Hassasiyet Düzeltmesi) ---
/**
 * Para miktarını kuruş cinsinden integer'a çevirir.
 * Float hassasiyet sorunlarını önler.
 * @param {number} amount — TL cinsinden (örn: 24.50)
 * @returns {number} — Kuruş cinsinden (örn: 2450)
 */
export function toKurus(amount) {
  return Math.round(parseFloat(amount || 0) * 100);
}

/**
 * Kuruş cinsinden integer'ı TL cinsinden float'a çevirir.
 * @param {number} kurus
 * @returns {number}
 */
export function fromKurus(kurus) {
  return (kurus || 0) / 100;
}

/**
 * Para tutarını güvenli şekilde toplar (kuruş bazlı).
 * @param {number} a — TL cinsinden
 * @param {number} b — TL cinsinden
 * @returns {number} — TL cinsinden
 */
export function safeAdd(a, b) {
  return fromKurus(toKurus(a) + toKurus(b));
}

/**
 * Para tutarını güvenli şekilde çıkarır (kuruş bazlı).
 * @param {number} a — TL cinsinden
 * @param {number} b — TL cinsinden
 * @returns {number} — TL cinsinden
 */
export function safeSub(a, b) {
  return fromKurus(toKurus(a) - toKurus(b));
}

/**
 * Para tutarını formatlı stringe çevirir.
 * @param {number} amount
 * @param {string} [currency='₺']
 * @returns {string}
 */
export function formatMoney(amount, currency = '₺') {
  const num = parseFloat(amount || 0);
  return `${currency}${num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// --- CSV Güvenli Çıktı (Y9) ---
/**
 * CSV hücresini güvenli şekilde formatlar (tırnak kaçışı ve newline koruması).
 * @param {*} value
 * @returns {string}
 */
export function csvSafe(value) {
  const str = String(value ?? '');
  // İçinde tırnak, noktalı virgül, virgül veya newline varsa tırnakla sar
  if (/[";,\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// --- SHA-256 Hash (K1, K2 — Şifre güvenliği) ---
/**
 * Verilen stringin SHA-256 hash'ini hesaplar.
 * @param {string} str
 * @returns {Promise<string>} — hex hash
 */
export async function sha256(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Rate Limiter (Y13) ---
/**
 * Basit bir rate limiter oluşturur.
 * @param {number} maxAttempts — izin verilen maksimum deneme
 * @param {number} windowMs — zaman penceresi (ms)
 * @returns {{ check: () => { allowed: boolean, remainingMs: number, attempts: number }, reset: () => void }}
 */
export function createRateLimiter(maxAttempts = 5, windowMs = 60000) {
  let attempts = [];
  return {
    check() {
      const now = Date.now();
      attempts = attempts.filter(t => now - t < windowMs);
      if (attempts.length >= maxAttempts) {
        const oldestInWindow = attempts[0];
        const remainingMs = windowMs - (now - oldestInWindow);
        return { allowed: false, remainingMs, attempts: attempts.length };
      }
      attempts.push(now);
      return { allowed: true, remainingMs: 0, attempts: attempts.length };
    },
    reset() {
      attempts = [];
    }
  };
}

// --- Güvenli ID Üretimi (O10 — Date.now çakışma riski) ---
let _idCounter = 0;
/**
 * Benzersiz bir ID üretir (Date.now + sayaç + rastgele).
 * @returns {string}
 */
export function generateId() {
  _idCounter++;
  const random = Math.random().toString(36).substring(2, 8);
  return `${Date.now()}_${_idCounter}_${random}`;
}

// --- URL Object Temizleyici (O6) ---
/**
 * Bir blob URL oluşturur, click tetikler ve ardından temizler.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Temizlik (O6 fix)
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}
