/**
 * ATÖLYECİM - Ayakkabı İmalat & İş Takip Fişi Modülü (Job Tickets)
 * Fotoğraftaki Kuponlu Refakat Fişi Şablonuna Birebir Uygun
 */
import { escapeHtml, bindOnce, generateId } from './utils.js';

export const JobTickets = {
  activeTickets: [],
  currentFilter: 'all',
  editingId: null,

  init() {
    // Navigation & Buttons binding
    const btnAdd = document.getElementById('btn-add-job-ticket');
    if (btnAdd && !btnAdd._bound) {
      btnAdd._bound = true;
      btnAdd.addEventListener('click', () => this.openModal());
    }

    const form = document.getElementById('job-ticket-form');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveTicket();
      });
    }

    // Filter Buttons
    const filterContainer = document.getElementById('job-ticket-filters');
    if (filterContainer && !filterContainer._bound) {
      filterContainer._bound = true;
      filterContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (btn) {
          filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentFilter = btn.dataset.stage || 'all';
          this.renderTable();
        }
      });
    }

    // Search Input
    const searchInput = document.getElementById('search-job-tickets');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', () => this.renderTable());
    }

    // Size range type toggle (Kadın 35-41 / Erkek 39-45)
    const sizeTypeSelect = document.getElementById('jt-size-range-type');
    if (sizeTypeSelect && !sizeTypeSelect._bound) {
      sizeTypeSelect._bound = true;
      sizeTypeSelect.addEventListener('change', (e) => {
        this.renderSizeGridInputs(e.target.value);
      });
    }

    // Dynamic Size inputs automatic sum calculation
    const gridContainer = document.getElementById('jt-size-grid-inputs');
    if (gridContainer && !gridContainer._bound) {
      gridContainer._bound = true;
      gridContainer.addEventListener('input', () => {
        this.calcTotalQty();
      });
    }

    // Quick auto-fill from existing products
    const modelInput = document.getElementById('jt-model');
    if (modelInput && !modelInput._bound) {
      modelInput._bound = true;
      modelInput.addEventListener('change', async () => {
        const val = modelInput.value.trim();
        if (val) {
          try {
            const products = await window.dbGetAll('products');
            const p = products.find(prod => prod.modelCode && prod.modelCode.toLowerCase() === val.toLowerCase());
            if (p) {
              if (p.soleMaterial && !document.getElementById('jt-sole').value) {
                document.getElementById('jt-sole').value = p.soleMaterial;
              }
              if (p.leatherType && !document.getElementById('jt-leather').value) {
                document.getElementById('jt-leather').value = p.leatherType;
              }
              if (p.leatherLining && !document.getElementById('jt-lining').value) {
                document.getElementById('jt-lining').value = p.leatherLining;
              }
            }
          } catch (e) {
            console.warn('Auto-fill warning:', e);
          }
        }
      });
    }
  },

  async loadTickets() {
    try {
      this.activeTickets = await window.dbGetAll('job_tickets') || [];
      this.updateMetrics();
      this.renderTable();
    } catch (err) {
      console.error('İş fişleri yüklenemedi:', err);
    }
  },

  updateMetrics() {
    const tickets = this.activeTickets || [];
    const total = tickets.length;
    const kesim = tickets.filter(t => t.stage === 'kesim').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const saya = tickets.filter(t => t.stage === 'saya').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const montaj = tickets.filter(t => t.stage === 'montaj').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const paketleme = tickets.filter(t => t.stage === 'paketleme').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const bitti = tickets.filter(t => t.stage === 'tamamlandi').length;

    const elTotal = document.getElementById('metric-jt-total');
    const elKesim = document.getElementById('metric-jt-kesim');
    const elSaya = document.getElementById('metric-jt-saya');
    const elMontaj = document.getElementById('metric-jt-montaj');
    const elPaket = document.getElementById('metric-jt-paket');
    const elBitti = document.getElementById('metric-jt-bitti');

    if (elTotal) elTotal.textContent = total;
    if (elKesim) elKesim.textContent = kesim + ' Çift';
    if (elSaya) elSaya.textContent = saya + ' Çift';
    if (elMontaj) elMontaj.textContent = montaj + ' Çift';
    if (elPaket) elPaket.textContent = paketleme + ' Çift';
    if (elBitti) elBitti.textContent = bitti;
  },

  renderTable() {
    const tbody = document.getElementById('job-tickets-tbody');
    const emptyState = document.getElementById('job-tickets-empty');
    if (!tbody) return;

    const searchInput = document.getElementById('search-job-tickets');
    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let filtered = this.activeTickets || [];

    // Stage filter
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(t => t.stage === this.currentFilter);
    }

    // Search filter
    if (search) {
      filtered = filtered.filter(t => 
        (t.serialNo && String(t.serialNo).toLowerCase().includes(search)) ||
        (t.customer && String(t.customer).toLowerCase().includes(search)) ||
        (t.modelCode && String(t.modelCode).toLowerCase().includes(search)) ||
        (t.leather && String(t.leather).toLowerCase().includes(search)) ||
        (t.lastNo && String(t.lastNo).toLowerCase().includes(search)) ||
        (t.stitcher && String(t.stitcher).toLowerCase().includes(search)) ||
        (t.cutter && String(t.cutter).toLowerCase().includes(search)) ||
        (t.assembler && String(t.assembler).toLowerCase().includes(search))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const stageNames = {
      kesim: { text: '✂️ Kesimde', class: 'stage-badge stage-kesim' },
      saya: { text: '🧵 Sayada', class: 'stage-badge stage-saya' },
      montaj: { text: '🔨 Montajda', class: 'stage-badge stage-montaj' },
      paketleme: { text: '📦 Paketlemede', class: 'stage-badge stage-paket' },
      tamamlandi: { text: '✅ Bitti', class: 'stage-badge stage-done' }
    };

    tbody.innerHTML = filtered.map(t => {
      const stageInfo = stageNames[t.stage] || { text: t.stage, class: 'stage-badge' };
      const dateStr = t.deliveryDate ? t.deliveryDate.split('-').reverse().join('.') : '-';
      const sizeSummary = this.formatSizeSummary(t.sizes);
      const ticketId = String(t.id);

      return `
        <tr>
          <td>
            <strong style="color: #ef4444; font-size: 13px; letter-spacing: 0.5px;">${escapeHtml(t.serialNo || '№ -')}</strong>
          </td>
          <td>
            <strong>${escapeHtml(t.customer || '-')}</strong>
            ${t.emboss ? `<div style="font-size: 11px; color: var(--text-accent);">Klişe: ${escapeHtml(t.emboss)}</div>` : ''}
          </td>
          <td>
            <span style="font-weight: 700; color: #fff;">${escapeHtml(t.modelCode || '-')}</span>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(t.leather || '-')} | Taban: ${escapeHtml(t.sole || '-')}</div>
          </td>
          <td>
            <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(t.lastNo || '-')}</span>
          </td>
          <td>
            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${Number(t.totalPairs) || 0} Çift</div>
            <div style="font-size: 10.5px; color: var(--text-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sizeSummary}</div>
          </td>
          <td>
            <div class="stage-dropdown-wrap">
              <select class="jt-stage-select ${stageInfo.class}" onchange="window.JobTickets.changeStage('${ticketId}', this.value)" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                <option value="kesim" ${t.stage === 'kesim' ? 'selected' : ''}>✂️ Kesimde</option>
                <option value="saya" ${t.stage === 'saya' ? 'selected' : ''}>🧵 Sayada</option>
                <option value="montaj" ${t.stage === 'montaj' ? 'selected' : ''}>🔨 Montajda</option>
                <option value="paketleme" ${t.stage === 'paketleme' ? 'selected' : ''}>📦 Paketlemede</option>
                <option value="tamamlandi" ${t.stage === 'tamamlandi' ? 'selected' : ''}>✅ Tamamlandı</option>
              </select>
            </div>
          </td>
          <td>${dateStr}</td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon success" onclick="window.WhatsAppManager && window.WhatsAppManager.openForJobTicket('${ticketId}')" title="Müşteriye WhatsApp Bildirimi Gönder" style="color: #25d366; background: rgba(37,211,102,0.12); border: 1px solid rgba(37,211,102,0.25); cursor: pointer; padding: 4px 6px; font-size: 13px;">📲</button>
              <button class="btn btn-sm btn-primary" onclick="window.JobTickets.printA5Ticket('${ticketId}')" title="A5 İmalat Fişini Yazdır" style="padding: 4px 8px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: #0284c7; border-color: #0284c7; cursor: pointer;">
                🖨️ A5 Fiş
              </button>
              <button class="btn-icon info" title="Düzenle" onclick="window.JobTickets.openModal('${ticketId}')">✏️</button>
              <button class="btn-icon danger" title="Sil" onclick="window.JobTickets.deleteTicket('${ticketId}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  formatSizeSummary(sizesObj) {
    if (!sizesObj || typeof sizesObj !== 'object') return '-';
    const parts = [];
    for (const [sz, qty] of Object.entries(sizesObj)) {
      if (Number(qty) > 0) {
        parts.push(`${sz}:${qty}`);
      }
    }
    return parts.length > 0 ? parts.join(', ') : '-';
  },

  renderSizeGridInputs(type = 'kadin', currentSizes = {}) {
    const container = document.getElementById('jt-size-grid-inputs');
    if (!container) return;

    const sizeRanges = {
      kadin: [35, 36, 37, 38, 39, 40, 41],
      erkek: [39, 40, 41, 42, 43, 44, 45],
      cocuk: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35]
    };

    const sizes = sizeRanges[type] || sizeRanges.kadin;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(${sizes.length}, 1fr); gap: 6px; text-align: center;">
        ${sizes.map(sz => {
          const val = currentSizes[sz] !== undefined ? currentSizes[sz] : '';
          return `
            <div>
              <label style="font-size: 11px; font-weight: 700; color: var(--text-accent); display: block; margin-bottom: 3px;">${sz}</label>
              <input type="number" class="jt-size-val-input" data-size="${sz}" value="${val}" min="0" placeholder="" style="width: 100%; text-align: center; padding: 6px 2px; font-size: 12px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-card); background: var(--bg-card); color: #fff;">
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.calcTotalQty();
  },

  calcTotalQty() {
    let total = 0;
    const inputs = document.querySelectorAll('.jt-size-val-input');
    inputs.forEach(inp => {
      const val = parseInt(inp.value, 10);
      if (!isNaN(val) && val > 0) {
        total += val;
      }
    });

    const totalEl = document.getElementById('jt-total-pairs');
    if (totalEl) totalEl.value = total;
  },

  getNextSerialNo() {
    const lastTickets = this.activeTickets || [];
    if (lastTickets.length === 0) return '№ 00001';

    let bestPrefix = '№ ';
    let maxNumber = 0;
    let padLength = 5;

    for (const t of lastTickets) {
      const s = String(t.serialNo || '').trim();
      const match = s.match(/^(.*?)(\d+)([^\d]*)$/);
      if (match) {
        const pfx = match[1];
        const numStr = match[2];
        const numVal = parseInt(numStr, 10);
        if (numVal > maxNumber) {
          maxNumber = numVal;
          bestPrefix = pfx;
          padLength = Math.max(padLength, numStr.length);
        }
      }
    }

    if (maxNumber > 0) {
      const nextNum = maxNumber + 1;
      const padded = String(nextNum).padStart(padLength, '0');
      return `${bestPrefix}${padded}`;
    }

    return '№ 00001';
  },

  async openModal(id = null) {
    this.editingId = id;
    const modal = document.getElementById('job-ticket-modal');
    const title = document.getElementById('job-ticket-modal-title');
    const form = document.getElementById('job-ticket-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('jt-id').value = '';

    if (id) {
      if (title) title.textContent = 'İş Takip Fişi Düzenle ✏️';
      let ticket = (this.activeTickets && this.activeTickets.find(t => String(t.id) === String(id)));
      if (!ticket) {
        ticket = await window.dbGet('job_tickets', id);
      }
      if (ticket) {
        document.getElementById('jt-id').value = ticket.id;
        document.getElementById('jt-serial-no').value = ticket.serialNo || '';
        document.getElementById('jt-customer').value = ticket.customer || '';
        document.getElementById('jt-delivery-date').value = ticket.deliveryDate || '';
        document.getElementById('jt-model').value = ticket.modelCode || '';
        document.getElementById('jt-leather').value = ticket.leather || '';
        document.getElementById('jt-lining').value = ticket.lining || '';
        document.getElementById('jt-thread').value = ticket.thread || '';
        document.getElementById('jt-last-no').value = ticket.lastNo || '';
        document.getElementById('jt-sole').value = ticket.sole || '';
        document.getElementById('jt-cutter').value = ticket.cutter || '';
        document.getElementById('jt-stitcher').value = ticket.stitcher || '';
        document.getElementById('jt-assembler').value = ticket.assembler || '';
        document.getElementById('jt-emboss').value = ticket.emboss || '';
        document.getElementById('jt-order-placer').value = ticket.orderPlacer || '';
        document.getElementById('jt-notes').value = ticket.notes || '';
        document.getElementById('jt-packaging').value = ticket.packaging || '';
        document.getElementById('jt-stage').value = ticket.stage || 'kesim';
        document.getElementById('jt-total-pairs').value = ticket.totalPairs || 0;

        const sizeType = ticket.sizeType || 'kadin';
        const typeSelect = document.getElementById('jt-size-range-type');
        if (typeSelect) typeSelect.value = sizeType;

        this.renderSizeGridInputs(sizeType, ticket.sizes || {});
      }
    } else {
      if (title) title.textContent = 'Yeni İş Takip Fişi Kes 📋';

      // Otomatik yeni seri numarası önerisi (bir önceki kaydın bir sonraki numarası)
      document.getElementById('jt-serial-no').value = this.getNextSerialNo();
      
      const typeSelect = document.getElementById('jt-size-range-type');
      const sizeType = typeSelect ? typeSelect.value : 'kadin';
      this.renderSizeGridInputs(sizeType, {});
    }

    if (window.openModalById) window.openModalById('job-ticket-modal');
  },

  async saveTicket() {
    const id = document.getElementById('jt-id').value;

    // Collect sizes grid
    const sizes = {};
    const sizeInputs = document.querySelectorAll('.jt-size-val-input');
    sizeInputs.forEach(inp => {
      const sz = inp.dataset.size;
      const val = parseInt(inp.value, 10);
      if (!isNaN(val) && val > 0) {
        sizes[sz] = val;
      }
    });

    const totalPairs = parseInt(document.getElementById('jt-total-pairs').value, 10) || 0;

    const data = {
      serialNo: document.getElementById('jt-serial-no').value.trim() || '№ 00001',
      customer: document.getElementById('jt-customer').value.trim(),
      deliveryDate: document.getElementById('jt-delivery-date').value,
      modelCode: document.getElementById('jt-model').value.trim(),
      leather: document.getElementById('jt-leather').value.trim(),
      lining: document.getElementById('jt-lining').value.trim(),
      thread: document.getElementById('jt-thread').value.trim(),
      lastNo: document.getElementById('jt-last-no').value.trim(),
      sole: document.getElementById('jt-sole').value.trim(),
      cutter: document.getElementById('jt-cutter').value.trim(),
      stitcher: document.getElementById('jt-stitcher').value.trim(),
      assembler: document.getElementById('jt-assembler').value.trim(),
      emboss: document.getElementById('jt-emboss').value.trim(),
      orderPlacer: document.getElementById('jt-order-placer').value.trim(),
      notes: document.getElementById('jt-notes').value.trim(),
      packaging: document.getElementById('jt-packaging').value.trim(),
      stage: document.getElementById('jt-stage').value || 'kesim',
      sizeType: document.getElementById('jt-size-range-type').value || 'kadin',
      sizes,
      totalPairs,
      updatedAt: new Date().toISOString()
    };

    if (!data.customer && !data.modelCode) {
      if (window.showToast) window.showToast('Müşteri veya Model Kodu zorunludur!', 'error');
      return;
    }

    try {
      if (id) {
        data.id = parseInt(id, 10) || id;
        await window.dbUpdate('job_tickets', data);
        if (window.showToast) window.showToast('İş takip fişi güncellendi.', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        await window.dbAdd('job_tickets', data);
        if (window.showToast) window.showToast('Yeni iş takip fişi oluşturuldu!', 'success');
      }

      if (window.closeModalById) window.closeModalById('job-ticket-modal');
      await this.loadTickets();
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Kayıt hatası: ' + err.message, 'error');
    }
  },

  async changeStage(id, newStage) {
    try {
      let ticket = (this.activeTickets && this.activeTickets.find(t => String(t.id) === String(id)));
      if (!ticket) {
        ticket = await window.dbGet('job_tickets', id);
      }
      if (ticket) {
        ticket.stage = newStage;
        ticket.updatedAt = new Date().toISOString();
        await window.dbUpdate('job_tickets', ticket);
        if (window.showToast) window.showToast(`İş aşaması güncellendi.`, 'success');
        await this.loadTickets();
      } else {
        if (window.showToast) window.showToast('İş fişi bulunamadı!', 'error');
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Aşama değiştirilemedi: ' + err.message, 'error');
    }
  },

  async deleteTicket(id) {
    if (!confirm('Bu iş takip fişini silmek istediğinizden emin misiniz?')) return;
    try {
      await window.dbDelete('job_tickets', id);
      if (window.showToast) window.showToast('İş takip fişi silindi.', 'info');
      await this.loadTickets();
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Silme hatası: ' + err.message, 'error');
    }
  },

  /* =========================================================================
   * BİREBİR FOTOĞRAFTAKİ ŞABLON — A5 YAZICI ÇIKTISI (KUPONLU REFAKAT FİŞİ)
   * Sıralama: 1. Kesim, 2. Şilte (Astar + Renk), 3. Saya, 4. Montaj
   * ========================================================================= */
  async printA5Ticket(id) {
    try {
      let ticket = (this.activeTickets && this.activeTickets.find(t => String(t.id) === String(id)));
      if (!ticket) {
        ticket = await window.dbGet('job_tickets', id);
      }
      if (!ticket) {
        if (window.showToast) window.showToast('Yazdırılacak iş fişi bulunamadı!', 'error');
        return;
      }

      const printArea = document.getElementById('job-ticket-print-area');
      if (!printArea) {
        console.error('job-ticket-print-area element not found');
        return;
      }

      const companyName = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
      const deliveryDateStr = ticket.deliveryDate ? ticket.deliveryDate.split('-').reverse().join('.') : '';
      const sizes = ticket.sizes || {};

      const sizeKeys = ['35','36','37','38','39','40','41'];
      if (ticket.sizeType === 'erkek') {
        sizeKeys.splice(0, sizeKeys.length, '39','40','41','42','43','44','45');
      } else if (ticket.sizeType === 'cocuk') {
        sizeKeys.splice(0, sizeKeys.length, '26','27','28','29','30','31','32','33','34','35');
      }

      // Build main size cells & coupon size cells
      const mainSizeHeaderHtml = sizeKeys.map((k, idx) => `<th style="border: 1px solid #000; border-top: none; ${idx === 0 ? 'border-left: none;' : ''} padding: 2px 1px; text-align: center; font-weight: 700; font-size: 10px;">${k}</th>`).join('');
      const mainSizeQtyHtml = sizeKeys.map((k, idx) => `<td style="border: 1px solid #000; ${idx === 0 ? 'border-left: none;' : ''} padding: 2px 1px; text-align: center; font-weight: 800; font-size: 12px; font-family: 'Courier New', monospace;">${sizes[k] !== undefined && sizes[k] !== '' ? sizes[k] : ''}</td>`).join('');

      const couponSizeHeaderHtml = sizeKeys.map(k => `<th style="border: 0.5px solid #000; padding: 1px 0.5px; font-size: 7.5px; text-align: center;">${k}</th>`).join('');
      const couponSizeQtyHtml = sizeKeys.map(k => `<td style="border: 0.5px solid #000; padding: 1px 0.5px; font-size: 8px; font-weight: 700; text-align: center;">${sizes[k] || ''}</td>`).join('');

      printArea.innerHTML = `
        <div class="a5-job-ticket-wrapper" style="width: 202mm; max-width: 202mm; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; border: 1.5px solid #000; box-sizing: border-box; display: flex; flex-direction: row; margin: 0 auto; overflow: hidden; padding: 0;">
          
          <!-- ================= SOL ANA FİŞ BÖLÜMÜ (SIKIŞTIRILMIŞ & BİTİŞİK) ================= -->
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; border-right: 2px dashed #000; box-sizing: border-box;">
            
            <!-- Üst Bilgi Satırı (Seri No, Müşteri, Teslim Tarihi) -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 4px 8px; border-bottom: 1.5px solid #000; box-sizing: border-box;">
              <div style="display: flex; align-items: baseline; gap: 4px;">
                <span style="font-size: 11px; font-weight: 700;">Seri No :</span>
                <span style="font-size: 16px; font-weight: 900; color: #c00; font-family: 'Courier New', monospace; letter-spacing: 0.5px;">${escapeHtml(ticket.serialNo || '№ 00000')}</span>
              </div>
              <div style="display: flex; align-items: baseline; gap: 4px;">
                <span style="font-size: 12px; font-weight: 700;">Müşteri :</span>
                <span style="font-size: 14px; font-weight: 900; text-decoration: underline; text-underline-offset: 2px;">${escapeHtml(ticket.customer || '')}</span>
              </div>
              <div style="display: flex; align-items: baseline; gap: 4px;">
                <span style="font-size: 11px; font-weight: 700;">Teslim Tarihi :</span>
                <span style="font-size: 12px; font-weight: 800;">${deliveryDateStr}</span>
              </div>
            </div>

            <!-- Model & Malzeme Özellikleri Tablosu (Bitişik) -->
            <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 11px; border: none; border-bottom: 1px solid #000;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="border: 1px solid #000; border-top: none; border-left: none; padding: 3px 4px; width: 17%; text-align: center; font-weight: 700;">Model</th>
                  <th style="border: 1px solid #000; border-top: none; padding: 3px 4px; width: 23%; text-align: center; font-weight: 700;">Deri</th>
                  <th style="border: 1px solid #000; border-top: none; padding: 3px 4px; width: 20%; text-align: center; font-weight: 700;">Astar</th>
                  <th style="border: 1px solid #000; border-top: none; padding: 3px 4px; width: 12%; text-align: center; font-weight: 700;">İp</th>
                  <th style="border: 1px solid #000; border-top: none; padding: 3px 4px; width: 14%; text-align: center; font-weight: 700;">Kalıp</th>
                  <th style="border: 1px solid #000; border-top: none; border-right: none; padding: 3px 4px; width: 14%; text-align: center; font-weight: 700;">Taban</th>
                </tr>
              </thead>
              <tbody>
                <tr style="height: 28px;">
                  <td style="border: 1px solid #000; border-left: none; padding: 3px 4px; text-align: center; font-weight: 800; font-size: 13px;">${escapeHtml(ticket.modelCode || '')}</td>
                  <td style="border: 1px solid #000; padding: 3px 4px; text-align: center; font-weight: 700; font-size: 12px;">${escapeHtml(ticket.leather || '')}</td>
                  <td style="border: 1px solid #000; padding: 3px 4px; text-align: center; font-weight: 600; font-size: 11px;">${escapeHtml(ticket.lining || '')}</td>
                  <td style="border: 1px solid #000; padding: 3px 4px; text-align: center; font-weight: 600; font-size: 11px;">${escapeHtml(ticket.thread || '')}</td>
                  <td style="border: 1px solid #000; padding: 3px 4px; text-align: center; font-weight: 800; font-size: 12px;">${escapeHtml(ticket.lastNo || '')}</td>
                  <td style="border: 1px solid #000; border-right: none; padding: 3px 4px; text-align: center; font-weight: 700; font-size: 12px;">${escapeHtml(ticket.sole || '')}</td>
                </tr>
              </tbody>
            </table>

            <!-- Asorti / Numara Cetveli & Usta İsimleri Tablosu (Bitişik) -->
            <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 10.5px; border: none; border-bottom: 1.5px solid #000;">
              <thead>
                <tr style="background: #f0f0f0;">
                  ${mainSizeHeaderHtml}
                  <th style="border: 1px solid #000; border-top: none; padding: 3px 2px; width: 44px; text-align: center; font-weight: 800;">Toplam</th>
                  <th style="border: 1px solid #000; border-top: none; padding: 3px 2px; width: 66px; text-align: center; font-weight: 700;">Kesici</th>
                  <th style="border: 1px solid #000; border-top: none; padding: 3px 2px; width: 66px; text-align: center; font-weight: 700;">Sayacı</th>
                  <th style="border: 1px solid #000; border-top: none; border-right: none; padding: 3px 2px; width: 66px; text-align: center; font-weight: 700;">Kalfa</th>
                </tr>
              </thead>
              <tbody>
                <tr style="height: 30px;">
                  ${mainSizeQtyHtml}
                  <td style="border: 1px solid #000; padding: 3px 2px; text-align: center; font-weight: 900; font-size: 14px; background: #fafafa;">${ticket.totalPairs || 0}</td>
                  <td style="border: 1px solid #000; padding: 3px 2px; text-align: center; font-weight: 700; font-size: 11px;">${escapeHtml(ticket.cutter || '')}</td>
                  <td style="border: 1px solid #000; padding: 3px 2px; text-align: center; font-weight: 700; font-size: 11px;">${escapeHtml(ticket.stitcher || '')}</td>
                  <td style="border: 1px solid #000; border-right: none; padding: 3px 2px; text-align: center; font-weight: 700; font-size: 11px;">${escapeHtml(ticket.assembler || '')}</td>
                </tr>
              </tbody>
            </table>

            <!-- Alt Açıklama & Klişe Bölümü (Doğrudan Tablonun Altında) -->
            <div style="padding: 5px 8px; font-size: 10.5px; line-height: 1.35; box-sizing: border-box;">
              <div style="display: grid; grid-template-columns: 1.2fr 1fr 1.5fr; gap: 8px; margin-bottom: 4px;">
                <div><strong>KLİŞE :</strong> <span style="font-weight: 800; font-size: 11.5px;">${escapeHtml(ticket.emboss || ticket.customer || '')}</span></div>
                <div><strong>SİPARİŞ VEREN :</strong> <span>${escapeHtml(ticket.orderPlacer || '')}</span></div>
                <div><strong>NOT :</strong> <span>${escapeHtml(ticket.notes || '')}</span></div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div><strong>AMBALAJ :</strong> <span>${escapeHtml(ticket.packaging || 'Standart Kutu / Koli')}</span></div>
                <div style="font-size: 8.5px; color: #555; font-style: italic;">${escapeHtml(companyName)} İmalat Takip Sistemi</div>
              </div>
            </div>

          </div>

          <!-- ================= SAĞ KESİKLİ KOÇAN / 4 KUPON BÖLÜMÜ ================= -->
          <div style="width: 78mm; min-width: 78mm; max-width: 78mm; display: flex; flex-direction: row; background: #fafafa; box-sizing: border-box;">
            
            <!-- 1. KUPON: KESİM -->
            <div style="flex: 1; border-right: 1px dashed #555; padding: 4px 3px; display: flex; flex-direction: column; justify-content: space-between; font-size: 8.5px; line-height: 1.2; box-sizing: border-box;">
              <div>
                <div style="text-align: center; font-weight: 900; font-size: 9.5px; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 3px; background: #eee;">KESİM</div>
                <div><strong>Seri:</strong> <span style="color: #c00; font-weight: 800;">${escapeHtml(ticket.serialNo || '')}</span></div>
                <div><strong>Müşteri:</strong> ${escapeHtml(ticket.customer || '')}</div>
                <div><strong>Model:</strong> <b>${escapeHtml(ticket.modelCode || '')}</b></div>
                <div><strong>Deri:</strong> ${escapeHtml(ticket.leather || '')}</div>
                <div style="margin-top: 3px; font-weight: 800; font-size: 9px;">Çift: ${ticket.totalPairs || 0}</div>
              </div>
              <div style="border-top: 0.5px solid #888; padding-top: 2px; font-size: 8px; text-align: center; color: #444;">
                Kesim Paraf
              </div>
            </div>

            <!-- 2. KUPON: ŞİLTE (Astar + Renk) -->
            <div style="flex: 1.3; border-right: 1px dashed #555; padding: 4px 3px; display: flex; flex-direction: column; justify-content: space-between; font-size: 8.5px; line-height: 1.2; box-sizing: border-box;">
              <div>
                <div style="text-align: center; font-weight: 900; font-size: 9.5px; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 3px; background: #eee;">ŞİLTE</div>
                <div><strong>Seri:</strong> <span style="color: #c00; font-weight: 800;">${escapeHtml(ticket.serialNo || '')}</span></div>
                <div><strong>Müşteri:</strong> ${escapeHtml(ticket.customer || '')}</div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 2px; margin-bottom: 2px;">
                  <thead><tr>${couponSizeHeaderHtml}</tr></thead>
                  <tbody><tr>${couponSizeQtyHtml}</tr></tbody>
                </table>
                <div><strong>Astar:</strong> ${escapeHtml(ticket.lining || '-')}</div>
                <div><strong>Renk:</strong> ${escapeHtml(ticket.leather || '-')}</div>
                <div style="margin-top: 1px; font-weight: 800; font-size: 9px;">Çift: ${ticket.totalPairs || 0}</div>
              </div>
              <div style="border-top: 0.5px solid #888; padding-top: 2px; font-size: 8px; text-align: center; color: #444;">
                Şilte Paraf
              </div>
            </div>

            <!-- 3. KUPON: SAYA -->
            <div style="flex: 1; border-right: 1px dashed #555; padding: 4px 3px; display: flex; flex-direction: column; justify-content: space-between; font-size: 8.5px; line-height: 1.2; box-sizing: border-box;">
              <div>
                <div style="text-align: center; font-weight: 900; font-size: 9.5px; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 3px; background: #eee;">SAYA</div>
                <div><strong>Seri:</strong> <span style="color: #c00; font-weight: 800;">${escapeHtml(ticket.serialNo || '')}</span></div>
                <div><strong>Müşteri:</strong> ${escapeHtml(ticket.customer || '')}</div>
                <div><strong>Model:</strong> <b>${escapeHtml(ticket.modelCode || '')}</b></div>
                <div><strong>Deri:</strong> ${escapeHtml(ticket.leather || '')}</div>
                <div><strong>Astar:</strong> ${escapeHtml(ticket.lining || '')}</div>
                <div><strong>İp:</strong> ${escapeHtml(ticket.thread || '')}</div>
                <div style="margin-top: 3px; font-weight: 800; font-size: 9px;">Çift: ${ticket.totalPairs || 0}</div>
              </div>
              <div style="border-top: 0.5px solid #888; padding-top: 2px; font-size: 8px; text-align: center; color: #444;">
                Saya Paraf
              </div>
            </div>

            <!-- 4. KUPON: MONTAJ (KALFA) -->
            <div style="flex: 1; padding: 4px 3px; display: flex; flex-direction: column; justify-content: space-between; font-size: 8.5px; line-height: 1.2; box-sizing: border-box;">
              <div>
                <div style="text-align: center; font-weight: 900; font-size: 9.5px; border-bottom: 1px solid #000; padding-bottom: 1px; margin-bottom: 3px; background: #eee;">MONTAJ</div>
                <div><strong>Seri:</strong> <span style="color: #c00; font-weight: 800;">${escapeHtml(ticket.serialNo || '')}</span></div>
                <div><strong>Müşteri:</strong> ${escapeHtml(ticket.customer || '')}</div>
                <div><strong>Model:</strong> <b>${escapeHtml(ticket.modelCode || '')}</b></div>
                <div><strong>Deri:</strong> ${escapeHtml(ticket.leather || '')}</div>
                <div><strong>Kalıp:</strong> ${escapeHtml(ticket.lastNo || '')}</div>
                <div><strong>Taban:</strong> ${escapeHtml(ticket.sole || '')}</div>
                <div style="margin-top: 3px; font-weight: 800; font-size: 9px;">Çift: ${ticket.totalPairs || 0}</div>
              </div>
              <div style="border-top: 0.5px solid #888; padding-top: 2px; font-size: 8px; text-align: center; color: #444;">
                Montaj Paraf
              </div>
            </div>

          </div>

        </div>
      `;

      document.body.classList.add('printing-job-ticket');
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          document.body.classList.remove('printing-job-ticket');
        }, 1500);
      }, 100);
    } catch (err) {
      console.error('printA5Ticket error:', err);
      if (window.showToast) window.showToast('Yazdırma hatası: ' + err.message, 'error');
    }
  }
};

window.JobTickets = JobTickets;
