import { escapeHtml, bindOnce } from './utils.js';

let _audioCtx = null;
function getAudioContext() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

const BarcodeScanner = {
  html5QrCode: null,
  isScanning: false,

  async render() {
    this.bindEvents();
    this.renderHistory();
  },

  bindEvents() {
    const toggleBtn = document.getElementById('btn-toggle-scan');
    if (toggleBtn && !toggleBtn._bound) {
      toggleBtn._bound = true;
      toggleBtn.addEventListener('click', () => this.toggleScan());
    }

    const manualBtn = document.getElementById('btn-manual-scan');
    if (manualBtn && !manualBtn._bound) {
      manualBtn._bound = true;
      manualBtn.addEventListener('click', () => {
        const input = document.getElementById('barcode-manual');
        if (input && input.value.trim()) {
          this.processBarcode(input.value.trim());
          input.value = '';
        } else {
          showToast('Lütfen geçerli bir barkod girin!', 'warning');
        }
      });
    }

    // File uploader events
    const triggerFileBtn = document.getElementById('btn-trigger-file-select');
    const fileInput = document.getElementById('barcode-file');
    if (triggerFileBtn && fileInput && !triggerFileBtn._bound) {
      triggerFileBtn._bound = true;
      triggerFileBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.scanFile(e.target.files[0]);
          e.target.value = ''; // Reset file input
        }
      });
    }
  },

  async toggleScan() {
    if (this.isScanning) {
      await this.stopScan();
    } else {
      await this.startScan();
    }
  },

  async startScan() {
    const container = document.getElementById('scanner-reader');
    if (!container) return;

    const toggleBtn = document.getElementById('btn-toggle-scan');
    const placeholder = document.getElementById('scanner-placeholder');

    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode("scanner-reader");
      }

      // Configure wide scan area for industrial 1D barcodes and activate all formats
      const formats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF
      ];

      const config = {
        fps: 20, // High scanning frequency
        qrbox: (width, height) => {
          const boxWidth = Math.min(width, height) * 0.85;
          const boxHeight = boxWidth * 0.35; // Perfect wide box for 1D barcodes
          return { width: boxWidth, height: boxHeight };
        },
        formatsToSupport: formats,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      if (placeholder) placeholder.style.display = 'none';

      await this.html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => this.onScanSuccess(decodedText),
        (errorMessage) => {
          // Silent frame read failures
        }
      );

      this.isScanning = true;
      if (toggleBtn) {
        toggleBtn.textContent = 'Taramayı Durdur';
        toggleBtn.className = 'btn btn-danger';
      }
      showToast('Kamera aktif, tarama yapabilirsiniz.', 'success');

    } catch (err) {
      console.error('Kamera başlatılamadı:', err);
      showToast('Kameraya erişim izni verilemedi!', 'error');
      if (placeholder) placeholder.style.display = 'flex';
    }
  },

  async stopScan() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.isScanning = false;
        
        const toggleBtn = document.getElementById('btn-toggle-scan');
        const placeholder = document.getElementById('scanner-placeholder');

        if (toggleBtn) {
          toggleBtn.textContent = 'Taramayı Başlat';
          toggleBtn.className = 'btn btn-primary';
        }
        if (placeholder) placeholder.style.display = 'flex';
      } catch (err) {
        console.error('Kamera durdurulamadı:', err);
      }
    }
  },

  async scanFile(file) {
    if (!file) return;

    if (!this.html5QrCode) {
      this.html5QrCode = new Html5Qrcode("scanner-reader");
    }

    showToast('Görsel analiz ediliyor...', 'info');

    try {
      // Decode barcode from image file
      const decodedText = await this.html5QrCode.scanFile(file, true);
      this.playBeep();
      this.processBarcode(decodedText);
    } catch (err) {
      console.error('Dosyadan okuma başarısız:', err);
      showToast('Görselde geçerli bir barkod okunamadı!', 'error');
    }
  },

  onScanSuccess(decodedText) {
    this.playBeep();
    this.stopScan();
    this.processBarcode(decodedText);
  },

  playBeep() {
    try {
      const ctx = getAudioContext();
      // Resume context if suspended (browser security)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('Ses çalınamadı:', e);
    }
  },

  cleanup() {
    this.stopScan();
    if (_audioCtx) {
      _audioCtx.close().catch(() => {});
      _audioCtx = null;
    }
  },

  async processBarcode(barcode) {
    const products = await dbGetAll('products');
    const product = products.find(p => p.barcode === barcode);

    const historyList = document.querySelector('.scan-history-list');
    if (!historyList) return;

    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    let cardHtml = '';
    if (product) {
      cardHtml = `
        <div class="scan-result-card success" style="margin-bottom:12px;">
          <div class="scan-result-header">
            <span class="scan-time">${escapeHtml(time)}</span>
            <span class="scan-badge success">Bulundu</span>
          </div>
          <div class="scan-result-body" style="display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap;">
            ${product.photo ? `<div><img src="${(product.photo || '').replace(/"/g, '&quot;')}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; cursor: zoom-in; border: 1px solid var(--border-card);" onclick="window.Products.showImageZoom(this.src)"></div>` : ''}
            <div style="flex: 1;">
              <h4>${this.escape(product.modelCode)}</h4>
              <p><strong>Barkod:</strong> ${this.escape(barcode)}</p>
              <p><strong>Kategori:</strong> ${this.escape(product.category || '-')} | <strong>Beden:</strong> ${this.escape(product.size || '-')}</p>
              <p><strong>Renk:</strong> ${this.escape(product.color || '-')} | <strong>Taban:</strong> ${this.escape(product.soleMaterial || '-')}</p>
              <p><strong>Astar:</strong> ${this.escape(product.leatherLining || '-')} | <strong>Yüz:</strong> ${this.escape(product.leatherUpper || '-')}</p>
              <p><strong>Fiyat:</strong> ₺${Number(product.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      `;
      showToast(`Ürün bulundu: ${product.modelCode}`, 'success');
    } else {
      cardHtml = `
        <div class="scan-result-card danger" style="margin-bottom:12px;">
          <div class="scan-result-header">
            <span class="scan-time">${escapeHtml(time)}</span>
            <span class="scan-badge danger">Bulunamadı</span>
          </div>
          <div class="scan-result-body">
            <p><strong>Barkod:</strong> ${this.escape(barcode)}</p>
            <p class="error-desc">Bu barkoda ait kayıtlı bir ürün bulunamadı. Ürünler sayfasından yeni ürün ekleyip barkod tanımlayabilirsiniz.</p>
          </div>
        </div>
      `;
      showToast('Kayıtlı ürün bulunamadı!', 'error');
    }

    const emptyState = historyList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    historyList.insertAdjacentHTML('afterbegin', cardHtml);

    const items = historyList.querySelectorAll('.scan-result-card');
    if (items.length > 5) {
      items[items.length - 1].remove();
    }
  },

  renderHistory() {
    const historyList = document.querySelector('.scan-history-list');
    if (historyList) {
      historyList.innerHTML = `
        <div class="empty-state">
          <span>📟</span>
          <p>Henüz barkod okutulmadı</p>
        </div>
      `;
    }
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.BarcodeScanner = BarcodeScanner;
export default BarcodeScanner;
