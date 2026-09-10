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

  extractSerialNumeric(serialNo) {
    if (!serialNo) return Infinity;
    const str = String(serialNo).trim();
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : Infinity;
  },

  sortTicketsBySerial(tickets) {
    if (!Array.isArray(tickets)) return [];
    return [...tickets].sort((a, b) => {
      const numA = this.extractSerialNumeric(a.serialNo);
      const numB = this.extractSerialNumeric(b.serialNo);
      if (numA !== numB) {
        return numA - numB; // Küçükten büyüğe (ascending)
      }
      return String(a.serialNo || '').localeCompare(String(b.serialNo || ''), undefined, { numeric: true });
    });
  },

  async loadTickets() {
    try {
      const raw = await window.dbGetAll('job_tickets') || [];
      this.activeTickets = this.sortTicketsBySerial(raw);
      this.updateMetrics();
      this.renderTable();
    } catch (err) {
      console.error('İş fişleri yüklenemedi:', err);
    }
  },

  updateMetrics() {
    const tickets = this.activeTickets || [];
    const total = tickets.length;
    const beklemede = tickets.filter(t => t.stage === 'beklemede').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const kesim = tickets.filter(t => t.stage === 'kesim').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const saya = tickets.filter(t => t.stage === 'saya').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const montaj = tickets.filter(t => t.stage === 'montaj').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const paketleme = tickets.filter(t => t.stage === 'paketleme').reduce((sum, t) => sum + (Number(t.totalPairs) || 0), 0);
    const bitti = tickets.filter(t => t.stage === 'tamamlandi').length;

    const elTotal = document.getElementById('metric-jt-total');
    const elBeklemede = document.getElementById('metric-jt-beklemede');
    const elKesim = document.getElementById('metric-jt-kesim');
    const elSaya = document.getElementById('metric-jt-saya');
    const elMontaj = document.getElementById('metric-jt-montaj');
    const elPaket = document.getElementById('metric-jt-paket');
    const elBitti = document.getElementById('metric-jt-bitti');

    if (elTotal) elTotal.textContent = total;
    if (elBeklemede) elBeklemede.textContent = beklemede + ' Çift';
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

    let filtered = this.sortTicketsBySerial(this.activeTickets || []);

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
      beklemede: { text: '⏳ Beklemede', class: 'stage-beklemede' },
      kesim: { text: '✂️ Kesimde', class: 'stage-kesim' },
      saya: { text: '🧵 Sayada', class: 'stage-saya' },
      montaj: { text: '🔨 Montajda', class: 'stage-montaj' },
      paketleme: { text: '📦 Paketlemede', class: 'stage-paket' },
      tamamlandi: { text: '✅ Bitti', class: 'stage-done' }
    };

    tbody.innerHTML = filtered.map(t => {
      const stageInfo = stageNames[t.stage] || { text: t.stage, class: 'stage-beklemede' };
      const dateStr = t.deliveryDate ? t.deliveryDate.split('-').reverse().join('.') : '-';
      const sizeSummary = this.formatSizeSummary(t.sizes);
      const ticketId = String(t.id);

      return `
        <tr class="jt-row">
          <td>
            <span class="jt-serial-badge">${escapeHtml(t.serialNo || '№ -')}</span>
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${escapeHtml(t.customer || '-')}</div>
            ${t.emboss ? `<div style="font-size: 11px; color: #6366f1; margin-top: 3px; font-weight: 600;">🏷️ Klişe: ${escapeHtml(t.emboss)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 13.5px;">${escapeHtml(t.modelCode || '-')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
              <span>${escapeHtml(t.leather || '-')}</span>
              <span style="margin: 0 4px; color: #cbd5e1;">•</span>
              <span>Taban: ${escapeHtml(t.sole || '-')}</span>
            </div>
          </td>
          <td>
            ${t.lastNo && t.lastNo !== '-' ? `<span class="jt-last-badge">${escapeHtml(t.lastNo)}</span>` : `<span style="color: #94a3b8; font-size: 12px;">-</span>`}
          </td>
          <td>
            <div style="font-weight: 800; font-size: 13.5px; color: #0f172a;">${Number(t.totalPairs) || 0} Çift</div>
            <div style="font-size: 10.5px; color: #64748b; font-family: monospace; margin-top: 3px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sizeSummary}">${sizeSummary}</div>
          </td>
          <td>
            <div class="stage-dropdown-wrap">
              <select class="jt-stage-select ${stageInfo.class}" onchange="window.JobTickets.changeStage('${ticketId}', this.value)">
                <option value="beklemede" ${t.stage === 'beklemede' ? 'selected' : ''}>⏳ Beklemede</option>
                <option value="kesim" ${t.stage === 'kesim' ? 'selected' : ''}>✂️ Kesimde</option>
                <option value="saya" ${t.stage === 'saya' ? 'selected' : ''}>🧵 Sayada</option>
                <option value="montaj" ${t.stage === 'montaj' ? 'selected' : ''}>🔨 Montajda</option>
                <option value="paketleme" ${t.stage === 'paketleme' ? 'selected' : ''}>📦 Paketlemede</option>
                <option value="tamamlandi" ${t.stage === 'tamamlandi' ? 'selected' : ''}>✅ Tamamlandı</option>
              </select>
            </div>
          </td>
          <td>
            <span style="font-size: 11.5px; font-weight: 600; color: #475569; font-family: monospace;">${dateStr}</span>
          </td>
          <td style="text-align: center;">
            <div class="actions-cell" style="justify-content: center; gap: 4px;">
              <button class="btn btn-sm btn-primary" onclick="window.JobTickets.printA5Ticket('${ticketId}', 1)" title="İş Takip Fişini Yazdır (1/3 A4)" style="padding: 5px 8px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: #0284c7; border-color: #0284c7; border-radius: 6px; cursor: pointer;">
                🖨️ Fiş Yazdır
              </button>
              <button class="btn btn-sm btn-secondary" onclick="window.JobTickets.printA5Ticket('${ticketId}', 3)" title="A4 Sayfaya 3 Kopya Doldurarak Yazdır" style="padding: 5px 6px; font-size: 10.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; border-radius: 6px; cursor: pointer; color: #334155; border: 1px solid #cbd5e1; background: #f8fafc;">
                📄 3'lü A4
              </button>
              <button class="btn-icon info" title="Düzenle" onclick="window.JobTickets.openModal('${ticketId}')" style="width: 28px; height: 28px; border-radius: 6px;">✏️</button>
              <button class="btn-icon danger" title="Sil" onclick="window.JobTickets.deleteTicket('${ticketId}')" style="width: 28px; height: 28px; border-radius: 6px;">🗑️</button>
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
      kadin: [36, 37, 38, 39, 40, 41, 42],
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
              <input type="number" class="jt-size-val-input" data-size="${sz}" value="${val}" min="0" placeholder="" style="width: 100%; text-align: center; padding: 6px 2px; font-size: 12px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-input); background: #ffffff; color: var(--text-primary);">
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
        document.getElementById('jt-stage').value = ticket.stage || 'beklemede';
        document.getElementById('jt-total-pairs').value = ticket.totalPairs || 0;

        const sizeType = ticket.sizeType || 'kadin';
        const typeSelect = document.getElementById('jt-size-range-type');
        if (typeSelect) typeSelect.value = sizeType;

        this.renderSizeGridInputs(sizeType, ticket.sizes || {});

        const printBtn = document.getElementById('jt-print-btn');
        const print3Btn = document.getElementById('jt-print-3-btn');
        if (printBtn) {
          printBtn.style.display = 'inline-block';
          printBtn.onclick = () => this.printA5Ticket(id, 1);
        }
        if (print3Btn) {
          print3Btn.style.display = 'inline-block';
          print3Btn.onclick = () => this.printA5Ticket(id, 3);
        }
      }
    } else {
      if (title) title.textContent = 'Yeni İş Takip Fişi Kes 📋';

      // Otomatik yeni seri numarası önerisi (bir önceki kaydın bir sonraki numarası)
      document.getElementById('jt-serial-no').value = this.getNextSerialNo();
      document.getElementById('jt-stage').value = 'beklemede';
      
      const typeSelect = document.getElementById('jt-size-range-type');
      const sizeType = typeSelect ? typeSelect.value : 'kadin';
      this.renderSizeGridInputs(sizeType, {});

      const printBtn = document.getElementById('jt-print-btn');
      const print3Btn = document.getElementById('jt-print-3-btn');
      if (printBtn) printBtn.style.display = 'none';
      if (print3Btn) print3Btn.style.display = 'none';
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
      stage: document.getElementById('jt-stage').value || 'beklemede',
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
   * BİREBİR ORİJİNAL ATÖLYE İŞ TAKİP FİŞİ (1/3 A4 FORMATI)
   * Referans: Kullanıcının paylaştığı orijinal matbaa baskılı iş refakat fişi
   * Sol Taraf: Seri No, Müşteri, Teslim Tarihi, 6 Kolonlu Malzeme Tablosu,
   *           36-42 Numara Dağılımı, Toplam Çift, Kesici/Sayacı/Kalfa İmzaları,
   *           KLİŞE, AMBALAJ, SİPARİŞ VEREN, NOT
   * Sağ Taraf: 4 Adet Delikli / Koparmalı Kupon (Kalfa, Sayacı, Klişe [Asortili], Kesici)
   * Boyut: 196mm genişlik x 92mm yükseklik (Dikey A4'ün tam 1/3'ü)
   * ========================================================================= */
  async printA5Ticket(id, copyCount = 1) {
    try {
      let ticket = (this.activeTickets && this.activeTickets.find(t => String(t.id) === String(id)));
      if (!ticket) {
        ticket = await window.dbGet('job_tickets', id);
      }
      if (!ticket) {
        if (window.showToast) window.showToast('Yazdırılacak iş fişi bulunamadı!', 'error');
        return;
      }

      let printArea = document.getElementById('job-ticket-print-area');
      if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'job-ticket-print-area';
        document.body.appendChild(printArea);
      }

      const esc = (s) => (window.escapeHtml ? window.escapeHtml(s) : String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      const companyName = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim';
      const deliveryDateStr = ticket.deliveryDate ? ticket.deliveryDate.split('-').reverse().join('.') : '';
      const sizes = ticket.sizes || {};

      // Determine sizeKeys intelligently from actual sizes present
      const presentSizeNumbers = Object.keys(sizes)
        .map(k => parseInt(k, 10))
        .filter(n => !isNaN(n) && Number(sizes[n]) > 0)
        .sort((a, b) => a - b);

      let sizeKeys = [];
      if (presentSizeNumbers.length > 0) {
        const minSz = presentSizeNumbers[0];
        const maxSz = presentSizeNumbers[presentSizeNumbers.length - 1];
        if (minSz >= 35 && maxSz <= 42) {
          sizeKeys = ['36','37','38','39','40','41','42'];
        } else if (minSz >= 39 && maxSz <= 45) {
          sizeKeys = ['39','40','41','42','43','44','45'];
        } else if (maxSz <= 35) {
          sizeKeys = ['26','27','28','29','30','31','32','33','34','35'];
        } else {
          for (let s = minSz; s <= maxSz; s++) {
            sizeKeys.push(String(s));
          }
        }
      } else {
        if (ticket.sizeType === 'erkek') {
          sizeKeys = ['39','40','41','42','43','44','45'];
        } else if (ticket.sizeType === 'cocuk') {
          sizeKeys = ['26','27','28','29','30','31','32','33','34','35'];
        } else {
          sizeKeys = ['36','37','38','39','40','41','42'];
        }
      }

      // Calculate exact total sum of all size cells
      let sumOfSizes = 0;
      sizeKeys.forEach(k => {
        const val = parseInt(sizes[k], 10);
        if (!isNaN(val) && val > 0) sumOfSizes += val;
      });
      Object.keys(sizes).forEach(k => {
        if (!sizeKeys.includes(String(k))) {
          const val = parseInt(sizes[k], 10);
          if (!isNaN(val) && val > 0) sumOfSizes += val;
        }
      });
      const displayTotalPairs = Number(ticket.totalPairs) || sumOfSizes || 0;

      // Clean red serial number for stamps
      const rawSerial = String(ticket.serialNo || '').trim();
      const cleanSerial = rawSerial.replace(/^№\s*/, '') || '00001';

      // Build main size headers & values
      const mainSizeHeaderHtml = sizeKeys.map(k => `<th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 9.5px; font-weight: 800; width: ${Math.floor(56 / sizeKeys.length)}mm;">${k}</th>`).join('');
      const mainSizeQtyHtml = sizeKeys.map(k => `<td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1px 0; text-align: center; font-weight: 900; font-size: 11.5px; font-family: 'Courier New', monospace;">${sizes[k] !== undefined && sizes[k] !== '' ? sizes[k] : ''}</td>`).join('');

      // Build mini size headers & values for Klişe coupon
      const kliseSizeHeaderHtml = sizeKeys.map(k => `<th style="border: 0.5px solid #000; padding: 0; text-align: center; font-size: 6.5px; font-weight: 700;">${k}</th>`).join('');
      const kliseSizeQtyHtml = sizeKeys.map(k => `<td style="border: 0.5px solid #000; padding: 0; text-align: center; font-size: 7px; font-weight: 800; font-family: 'Courier New', monospace;">${sizes[k] || ''}</td>`).join('');

      // Watermark helper
      const watermarkHtml = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-12deg); font-family: 'Brush Script MT', cursive, serif; font-size: 20px; color: rgba(0, 0, 0, 0.06); pointer-events: none; user-select: none; z-index: 0;">${esc(companyName || 'Sipil')}</div>`;

      // Helper to generate a single authentic job ticket
      const renderSingleTicket = (copyIdx) => `
        <div class="a5-job-ticket-card" style="width: 196mm; min-width: 196mm; max-width: 196mm; height: 92mm; min-height: 92mm; max-height: 92mm; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; border: 1.5px solid #000; box-sizing: border-box; display: flex; flex-direction: row; margin: 0 auto; padding: 0; overflow: hidden; page-break-inside: avoid; break-inside: avoid; position: relative;">
          
          <!-- ================= SOL ANA FİŞ BÖLÜMÜ (128mm) ================= -->
          <div style="width: 128mm; min-width: 128mm; max-width: 128mm; height: 100%; display: flex; flex-direction: column; border-right: 1.5px dashed #000; box-sizing: border-box;">
            
            <!-- 1. Üst Satır: Seri No, Müşteri, Teslim Tarihi (9mm) -->
            <div style="height: 9mm; display: flex; flex-direction: row; border-bottom: 1px solid #000; box-sizing: border-box;">
              <!-- Seri No -->
              <div style="width: 28mm; min-width: 28mm; max-width: 28mm; border-right: 1px solid #000; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; box-sizing: border-box;">
                <div style="display: flex; flex-direction: column; line-height: 1.05; flex-shrink: 0;">
                  <span style="font-size: 9.5px; font-weight: 800; letter-spacing: -0.2px;">Seri No:</span>
                  <span style="font-size: 6.5px; font-style: italic; color: #555; font-family: 'Brush Script MT', cursive, serif;">${esc(companyName || 'Sipil Comfort')}</span>
                </div>
                <span style="color: #c00; font-family: 'Courier New', monospace; font-size: 14px; font-weight: 900; letter-spacing: 0.5px; flex-shrink: 0;">${cleanSerial}</span>
              </div>
              
              <!-- Müşteri -->
              <div style="flex: 1; min-width: 0; border-right: 1px solid #000; height: 100%; display: flex; align-items: center; padding: 0 5px; gap: 4px; box-sizing: border-box; overflow: hidden;">
                <span style="font-size: 10.5px; font-weight: 800; white-space: nowrap; flex-shrink: 0;">Müşteri :</span>
                <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(ticket.customer || '')}</span>
              </div>
              
              <!-- Teslim Tarihi (Genişletildi, Asla Taşmaz) -->
              <div style="width: 52mm; min-width: 52mm; max-width: 52mm; height: 100%; display: flex; align-items: center; padding: 0 5px; gap: 5px; box-sizing: border-box; overflow: hidden;">
                <span style="font-size: 9.5px; font-weight: 800; white-space: nowrap; flex-shrink: 0;">Teslim Tarihi :</span>
                <span style="font-size: 11.5px; font-weight: 900; white-space: nowrap; flex-shrink: 0; font-family: monospace;">${deliveryDateStr}</span>
              </div>
            </div>

            <!-- 2. Model & Malzeme Özellikleri Tablosu (31mm) -->
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; box-sizing: border-box;">
              <thead>
                <tr>
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 10px; font-weight: 800; width: 22mm; height: 5mm; background: #fff;">Model</th>
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 10px; font-weight: 800; width: 34mm; height: 5mm; background: #fff;">Deri</th>
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 10px; font-weight: 800; width: 18mm; height: 5mm; background: #fff;">Astar</th>
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 10px; font-weight: 800; width: 18mm; height: 5mm; background: #fff;">İp</th>
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 10px; font-weight: 800; width: 18mm; height: 5mm; background: #fff;">Kalıp</th>
                  <th style="border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 10px; font-weight: 800; width: 18mm; height: 5mm; background: #fff;">Taban</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; height: 26mm; position: relative;">
                    ${watermarkHtml}
                    <span style="font-size: 12.5px; font-weight: 900; position: relative; z-index: 1;">${esc(ticket.modelCode || '')}</span>
                  </td>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; height: 26mm; position: relative;">
                    ${watermarkHtml}
                    <span style="font-size: 11.5px; font-weight: 800; position: relative; z-index: 1;">${esc(ticket.leather || '')}</span>
                  </td>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; height: 26mm; font-size: 10.5px; font-weight: 700;">
                    ${esc(ticket.lining || '')}
                  </td>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; height: 26mm; font-size: 10.5px; font-weight: 700;">
                    ${esc(ticket.thread || '')}
                  </td>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; height: 26mm; font-size: 11.5px; font-weight: 800;">
                    ${esc(ticket.lastNo || '')}
                  </td>
                  <td style="border-bottom: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; height: 26mm; font-size: 10.5px; font-weight: 700;">
                    ${esc(ticket.sole || '')}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- 3. Numara Dağılımı ve Ustalar Tablosu (25.5mm) -->
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; box-sizing: border-box;">
              <thead>
                <tr>
                  ${mainSizeHeaderHtml}
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 9.5px; font-weight: 800; width: 14mm; height: 5mm; background: #fff;">Toplam</th>
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 9.5px; font-weight: 800; width: 19mm; height: 5mm; background: #fff;">Kesici</th>
                  <th style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 9.5px; font-weight: 800; width: 19mm; height: 5mm; background: #fff;">Sayacı</th>
                  <th style="border-bottom: 1px solid #000; padding: 1.5px 0; text-align: center; font-size: 9.5px; font-weight: 800; width: 20mm; height: 5mm; background: #fff;">Kalfa</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  ${mainSizeQtyHtml}
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1px 0; text-align: center; vertical-align: middle; font-weight: 900; font-size: 13px; background: #fafafa; height: 20.5mm;">
                    ${displayTotalPairs}
                  </td>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1px 2px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; height: 20.5mm;">
                    ${esc(ticket.cutter || '')}
                  </td>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 1px 2px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; height: 20.5mm;">
                    ${esc(ticket.stitcher || '')}
                  </td>
                  <td style="border-bottom: 1px solid #000; padding: 1px 2px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; height: 20.5mm;">
                    ${esc(ticket.assembler || '')}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- 4. Alt Açıklamalar Grid: KLİŞE, AMBALAJ, SİPARİŞ VEREN, NOT (27mm) -->
            <div style="height: 27mm; display: flex; flex-direction: row; box-sizing: border-box;">
              <!-- Sol: Klişe & Ambalaj -->
              <div style="width: 56mm; min-width: 56mm; max-width: 56mm; border-right: 1px solid #000; display: flex; flex-direction: column; box-sizing: border-box;">
                <div style="height: 13.5mm; border-bottom: 1px solid #000; display: flex; align-items: center; padding: 0 4px; gap: 4px; box-sizing: border-box; overflow: hidden;">
                  <strong style="font-size: 9.5px; min-width: 38px;">KLİŞE :</strong>
                  <span style="font-weight: 800; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(ticket.emboss || ticket.customer || '')}</span>
                </div>
                <div style="height: 13.5mm; display: flex; align-items: center; padding: 0 4px; gap: 4px; box-sizing: border-box; overflow: hidden;">
                  <strong style="font-size: 9.5px; min-width: 50px;">AMBALAJ:</strong>
                  <span style="font-weight: 700; font-size: 9.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(ticket.packaging || '')}</span>
                </div>
              </div>

              <!-- Orta: Sipariş Veren -->
              <div style="width: 33mm; min-width: 33mm; max-width: 33mm; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: flex-start; padding: 2px 4px; box-sizing: border-box; overflow: hidden;">
                <div style="font-weight: 800; font-size: 9px; line-height: 1.1; margin-bottom: 2px;">SİPARİŞ VEREN</div>
                <div style="font-size: 9.5px; font-weight: 700; word-break: break-word;">${esc(ticket.orderPlacer || '')}</div>
              </div>

              <!-- Sağ: Not -->
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding: 2px 5px; box-sizing: border-box; overflow: hidden;">
                <div style="font-weight: 800; font-size: 9.5px; line-height: 1.1; margin-bottom: 2px;">NOT :</div>
                <div style="font-size: 9px; line-height: 1.25; word-break: break-word;">${esc(ticket.notes || '')}</div>
              </div>
            </div>

          </div>

          <!-- ================= SAĞ 4 KOPARMALI KUPON BÖLÜMÜ (68mm) ================= -->
          <div style="width: 68mm; min-width: 68mm; max-width: 68mm; height: 100%; display: flex; flex-direction: row; box-sizing: border-box;">
            
            <!-- 1. KUPON: KALFA (15mm) -->
            <div style="width: 15mm; min-width: 15mm; max-width: 15mm; height: 92mm; position: relative; border-right: 1px dashed #000; box-sizing: border-box; overflow: hidden;">
              <div style="width: 92mm; height: 15mm; position: absolute; top: 0; left: 0; transform-origin: 0 0; transform: rotate(90deg) translateY(-15mm); box-sizing: border-box; display: flex; flex-direction: column; background: #fff;">
                <!-- Satır 1: Kalfa & Seri No -->
                <div style="display: flex; flex-direction: row; height: 5mm; border-bottom: 0.75px solid #000; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-weight: 900; font-size: 9px;">Kalfa</div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; box-sizing: border-box;">
                    <span style="font-size: 7.5px; font-weight: 700;">Seri No</span>
                    <span style="color: #c00; font-family: 'Courier New', monospace; font-weight: 900; font-size: 10px;">${cleanSerial}</span>
                  </div>
                </div>
                <!-- Satır 2: Model & Deri -->
                <div style="display: flex; flex-direction: row; height: 5mm; border-bottom: 0.75px solid #000; align-items: center; position: relative; box-sizing: border-box;">
                  ${watermarkHtml}
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Model:</span>
                    <b style="font-size: 8px;">${esc(ticket.modelCode || '')}</b>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Deri:</span>
                    <span style="font-weight: 800; font-size: 8px;">${esc(ticket.leather || '')}</span>
                  </div>
                </div>
                <!-- Satır 3: Çift & Müşteri -->
                <div style="display: flex; flex-direction: row; height: 5mm; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Çift:</span>
                    <b style="font-size: 9px; font-family: 'Courier New', monospace;">${displayTotalPairs}</b>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Müşteri:</span>
                    <span style="font-weight: 700; font-size: 7.5px;">${esc(ticket.customer || '')}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. KUPON: SAYACI (15mm) -->
            <div style="width: 15mm; min-width: 15mm; max-width: 15mm; height: 92mm; position: relative; border-right: 1px dashed #000; box-sizing: border-box; overflow: hidden;">
              <div style="width: 92mm; height: 15mm; position: absolute; top: 0; left: 0; transform-origin: 0 0; transform: rotate(90deg) translateY(-15mm); box-sizing: border-box; display: flex; flex-direction: column; background: #fff;">
                <!-- Satır 1: Sayacı & Seri No -->
                <div style="display: flex; flex-direction: row; height: 5mm; border-bottom: 0.75px solid #000; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-weight: 900; font-size: 9px;">Sayacı</div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; box-sizing: border-box;">
                    <span style="font-size: 7.5px; font-weight: 700;">Seri No</span>
                    <span style="color: #c00; font-family: 'Courier New', monospace; font-weight: 900; font-size: 10px;">${cleanSerial}</span>
                  </div>
                </div>
                <!-- Satır 2: Model & Deri -->
                <div style="display: flex; flex-direction: row; height: 5mm; border-bottom: 0.75px solid #000; align-items: center; position: relative; box-sizing: border-box;">
                  ${watermarkHtml}
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Model:</span>
                    <b style="font-size: 8px;">${esc(ticket.modelCode || '')}</b>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Deri:</span>
                    <span style="font-weight: 800; font-size: 8px;">${esc(ticket.leather || '')}</span>
                  </div>
                </div>
                <!-- Satır 3: Çift & Müşteri -->
                <div style="display: flex; flex-direction: row; height: 5mm; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Çift:</span>
                    <b style="font-size: 9px; font-family: 'Courier New', monospace;">${displayTotalPairs}</b>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Müşteri:</span>
                    <span style="font-weight: 700; font-size: 7.5px;">${esc(ticket.customer || '')}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. KUPON: KLİŞE / KESİCİSİ (23mm, Asorti Cetvelli) -->
            <div style="width: 23mm; min-width: 23mm; max-width: 23mm; height: 92mm; position: relative; border-right: 1px dashed #000; box-sizing: border-box; overflow: hidden;">
              <div style="width: 92mm; height: 23mm; position: absolute; top: 0; left: 0; transform-origin: 0 0; transform: rotate(90deg) translateY(-23mm); box-sizing: border-box; display: flex; flex-direction: column; background: #fff;">
                <!-- Satır 1: Klişe & Seri No (4.5mm) -->
                <div style="display: flex; flex-direction: row; height: 4.5mm; border-bottom: 0.75px solid #000; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-weight: 900; font-size: 8.5px;">Klişe</div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; box-sizing: border-box;">
                    <span style="font-size: 7.5px; font-weight: 700;">Seri No</span>
                    <span style="color: #c00; font-family: 'Courier New', monospace; font-weight: 900; font-size: 10px;">${cleanSerial}</span>
                  </div>
                </div>
                <!-- Satır 2: Model & Astar (4.5mm) -->
                <div style="display: flex; flex-direction: row; height: 4.5mm; border-bottom: 0.75px solid #000; align-items: center; position: relative; box-sizing: border-box;">
                  ${watermarkHtml}
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Model:</span>
                    <b style="font-size: 8px;">${esc(ticket.modelCode || '')}</b>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Astar:</span>
                    <span style="font-weight: 700; font-size: 8px;">${esc(ticket.lining || '')}</span>
                  </div>
                </div>
                <!-- Satır 3: Kesicisi & Müşteri (4.5mm) -->
                <div style="display: flex; flex-direction: row; height: 4.5mm; border-bottom: 0.75px solid #000; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Kesicisi:</span>
                    <span style="font-weight: 700; font-size: 7.5px;">${esc(ticket.cutter || '')}</span>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Müşteri:</span>
                    <span style="font-weight: 700; font-size: 7.5px;">${esc(ticket.customer || '')}</span>
                  </div>
                </div>
                <!-- Satır 4: Asorti Cetveli Tablosu (9.5mm) -->
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed; height: 9.5mm; margin: 0; box-sizing: border-box;">
                  <thead>
                    <tr>
                      ${kliseSizeHeaderHtml}
                      <th style="border: 0.5px solid #000; padding: 0; text-align: center; font-size: 6.5px; font-weight: 800; width: 15%;">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      ${kliseSizeQtyHtml}
                      <td style="border: 0.5px solid #000; padding: 0; text-align: center; font-size: 7px; font-weight: 900; background: #fafafa;">${displayTotalPairs}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 4. KUPON: KESİCİ (15mm) -->
            <div style="width: 15mm; min-width: 15mm; max-width: 15mm; height: 92mm; position: relative; box-sizing: border-box; overflow: hidden;">
              <div style="width: 92mm; height: 15mm; position: absolute; top: 0; left: 0; transform-origin: 0 0; transform: rotate(90deg) translateY(-15mm); box-sizing: border-box; display: flex; flex-direction: column; background: #fff;">
                <!-- Satır 1: Kesici & Seri No -->
                <div style="display: flex; flex-direction: row; height: 5mm; border-bottom: 0.75px solid #000; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-weight: 900; font-size: 9px;">Kesici</div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; box-sizing: border-box;">
                    <span style="font-size: 7.5px; font-weight: 700;">Seri No</span>
                    <span style="color: #c00; font-family: 'Courier New', monospace; font-weight: 900; font-size: 10px;">${cleanSerial}</span>
                  </div>
                </div>
                <!-- Satır 2: Model & Deri -->
                <div style="display: flex; flex-direction: row; height: 5mm; border-bottom: 0.75px solid #000; align-items: center; position: relative; box-sizing: border-box;">
                  ${watermarkHtml}
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Model:</span>
                    <b style="font-size: 8px;">${esc(ticket.modelCode || '')}</b>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap; position: relative; z-index: 1;">
                    <span style="font-weight: 700; margin-right: 2px;">Deri:</span>
                    <span style="font-weight: 800; font-size: 8px;">${esc(ticket.leather || '')}</span>
                  </div>
                </div>
                <!-- Satır 3: Çift & Müşteri -->
                <div style="display: flex; flex-direction: row; height: 5mm; align-items: center; box-sizing: border-box;">
                  <div style="width: 48%; border-right: 0.75px solid #000; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Çift:</span>
                    <b style="font-size: 9px; font-family: 'Courier New', monospace;">${displayTotalPairs}</b>
                  </div>
                  <div style="width: 52%; height: 100%; display: flex; align-items: center; padding: 0 4px; font-size: 7.5px; overflow: hidden; white-space: nowrap;">
                    <span style="font-weight: 700; margin-right: 2px;">Müşteri:</span>
                    <span style="font-weight: 700; font-size: 7.5px;">${esc(ticket.customer || '')}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      `;

      // Build cut guide divider
      const cutGuideHtml = `
        <div class="ticket-cut-guide" style="width: 196mm; margin: 3.5mm auto; display: flex; align-items: center; justify-content: center; gap: 8px; color: #888; font-size: 9px; font-family: sans-serif; box-sizing: border-box;">
          <span style="font-size: 11px;">✂</span>
          <span style="flex: 1; border-bottom: 1.2px dashed #999;"></span>
          <span style="font-weight: 700; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.5px; color: #666;">1/3 A4 Kesim Çizgisi</span>
          <span style="flex: 1; border-bottom: 1.2px dashed #999;"></span>
          <span style="font-size: 11px;">✂</span>
        </div>
      `;

      let ticketsHtml = '';
      if (copyCount === 3) {
        ticketsHtml = `
          ${renderSingleTicket(1)}
          ${cutGuideHtml}
          ${renderSingleTicket(2)}
          ${cutGuideHtml}
          ${renderSingleTicket(3)}
        `;
      } else {
        ticketsHtml = `
          ${renderSingleTicket(1)}
          ${cutGuideHtml}
        `;
      }

      printArea.innerHTML = ticketsHtml;

      // Set @page to A4 portrait with safe printer margins (Dikey A4, 1/3 A4 şerit boyutu)
      let pageStyle = document.getElementById('dynamic-print-page-style');
      if (!pageStyle) {
        pageStyle = document.createElement('style');
        pageStyle.id = 'dynamic-print-page-style';
        document.head.appendChild(pageStyle);
      }
      pageStyle.innerHTML = '@page { size: A4 portrait !important; margin: 4mm 6mm !important; } @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }';

      document.body.classList.add('printing-job-ticket');
      const cleanup = () => {
        document.body.classList.remove('printing-job-ticket');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(() => {
        window.print();
        setTimeout(cleanup, 2500);
      }, 150);
    } catch (err) {
      console.error('printA5Ticket error:', err);
      if (window.showToast) window.showToast('Yazdırma hatası: ' + err.message, 'error');
    }
  }
};

window.JobTickets = JobTickets;
