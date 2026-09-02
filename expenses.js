/* =========================================
   ATÖLYECİM — Harcamalarım & Gider Takip Modülü
   ========================================= */

import { escapeHtml, generateId } from './utils.js';

export const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Atölye Kirası', icon: '🏢' },
  { id: 'utility', label: 'Elektrik / Su / Doğalgaz', icon: '⚡' },
  { id: 'salary', label: 'Personel & Usta Haftalığı', icon: '👥' },
  { id: 'shipping', label: 'Nakliye & Kargo', icon: '🚚' },
  { id: 'food', label: 'Yemek & Mutfak', icon: '🍽️' },
  { id: 'maintenance', label: 'Makine Bakım & Tamir', icon: '🛠️' },
  { id: 'tax', label: 'Vergi & SGK & Muhasebe', icon: '🏛️' },
  { id: 'supplies', label: 'Ambalaj & Sarf Malzeme', icon: '📦' },
  { id: 'other', label: 'Diğer Harcamalar', icon: '🏷️' }
];

export const Expenses = {
  currentCategory: 'all',
  currentPeriod: 'all', // 'all', 'today', 'this_week', 'this_month', 'pending'
  currentPaymentMethod: 'all',
  searchQuery: '',
  expenses: [],

  async init() {
    this.bindEvents();
  },

  getCategoryInfo(catId) {
    return EXPENSE_CATEGORIES.find(c => c.id === catId) || { id: catId, label: 'Genel Gider', icon: '💸' };
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('search-expenses');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderList();
      });
    }

    // Add expense button
    const btnAdd = document.getElementById('btn-add-expense');
    if (btnAdd && !btnAdd._bound) {
      btnAdd._bound = true;
      btnAdd.addEventListener('click', () => this.openModal());
    }

    // Form submit
    const form = document.getElementById('expense-form');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveExpense();
      });
    }

    // Export & WhatsApp Share
    const btnExport = document.getElementById('btn-expenses-export');
    if (btnExport && !btnExport._bound) {
      btnExport._bound = true;
      btnExport.addEventListener('click', () => this.exportCSV());
    }
  },

  async loadData() {
    try {
      this.expenses = await window.dbGetAll('expenses') || [];
      // Sort newest first
      this.expenses.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } catch (e) {
      console.error('Error loading expenses:', e);
      this.expenses = [];
    }
  },

  async render() {
    await this.loadData();
    this.renderKPIs();
    this.renderCategoryChips();
    this.renderPeriodButtons();
    this.renderList();
  },

  renderKPIs() {
    const totalMonthEl = document.getElementById('kpi-exp-month');
    const totalWeekEl = document.getElementById('kpi-exp-week');
    const totalTodayEl = document.getElementById('kpi-exp-today');
    const totalPendingEl = document.getElementById('kpi-exp-pending');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Start of this week (Monday)
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthSum = 0;
    let weekSum = 0;
    let todaySum = 0;
    let pendingSum = 0;
    let pendingCount = 0;

    this.expenses.forEach(exp => {
      const expDate = new Date(exp.date);
      const amount = Number(exp.amount) || 0;

      if (exp.status === 'pending') {
        pendingSum += amount;
        pendingCount++;
      } else {
        // Only count paid expenses for real spent KPIs
        if (expDate >= startOfMonth) {
          monthSum += amount;
        }
        if (expDate >= monday) {
          weekSum += amount;
        }
        if (exp.date === todayStr) {
          todaySum += amount;
        }
      }
    });

    if (totalMonthEl) totalMonthEl.textContent = `₺${monthSum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalWeekEl) totalWeekEl.textContent = `₺${weekSum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalTodayEl) totalTodayEl.textContent = `₺${todaySum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalPendingEl) totalPendingEl.textContent = `₺${pendingSum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pendingCount} Adet)`;
  },

  renderCategoryChips() {
    const container = document.getElementById('expenses-category-chips');
    if (!container) return;

    let html = `
      <button type="button" class="filter-btn ${this.currentCategory === 'all' ? 'active' : ''}" onclick="window.Expenses.setCategoryFilter('all')">
        Tüm Kategoriler (${this.expenses.length})
      </button>
    `;

    EXPENSE_CATEGORIES.forEach(cat => {
      const count = this.expenses.filter(e => e.category === cat.id).length;
      if (count > 0 || cat.id === this.currentCategory) {
        html += `
          <button type="button" class="filter-btn ${this.currentCategory === cat.id ? 'active' : ''}" onclick="window.Expenses.setCategoryFilter('${cat.id}')">
            <span>${cat.icon}</span> ${escapeHtml(cat.label)} (${count})
          </button>
        `;
      }
    });

    container.innerHTML = html;
  },

  renderPeriodButtons() {
    const container = document.getElementById('expenses-period-filters');
    if (!container) return;

    const periods = [
      { id: 'all', label: 'Tüm Zamanlar' },
      { id: 'this_month', label: '📅 Bu Ay' },
      { id: 'this_week', label: '⚡ Bu Hafta' },
      { id: 'today', label: '☀️ Bugün' },
      { id: 'pending', label: '⏳ Bekleyen Ödemeler' }
    ];

    container.innerHTML = periods.map(p => `
      <button type="button" class="filter-btn ${this.currentPeriod === p.id ? 'active' : ''}" onclick="window.Expenses.setPeriodFilter('${p.id}')">
        ${p.label}
      </button>
    `).join('');
  },

  setCategoryFilter(catId) {
    this.currentCategory = catId;
    this.renderCategoryChips();
    this.renderList();
  },

  setPeriodFilter(periodId) {
    this.currentPeriod = periodId;
    this.renderPeriodButtons();
    this.renderList();
  },

  getFilteredExpenses() {
    let list = [...this.expenses];

    // Category filter
    if (this.currentCategory !== 'all') {
      list = list.filter(e => e.category === this.currentCategory);
    }

    // Period filter
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (this.currentPeriod === 'today') {
      list = list.filter(e => e.date === todayStr);
    } else if (this.currentPeriod === 'this_week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);
      list = list.filter(e => new Date(e.date) >= monday);
    } else if (this.currentPeriod === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter(e => new Date(e.date) >= startOfMonth);
    } else if (this.currentPeriod === 'pending') {
      list = list.filter(e => e.status === 'pending');
    }

    // Search query filter
    if (this.searchQuery) {
      list = list.filter(e => 
        (e.title || '').toLowerCase().includes(this.searchQuery) ||
        (e.notes || '').toLowerCase().includes(this.searchQuery) ||
        (e.receiptNo || '').toLowerCase().includes(this.searchQuery) ||
        (e.supplierOrPayee || '').toLowerCase().includes(this.searchQuery)
      );
    }

    return list;
  },

  renderList() {
    const tbody = document.getElementById('expenses-table-tbody');
    const emptyState = document.getElementById('expenses-empty-state');
    const tableContainer = document.getElementById('expenses-table-container');
    const totalCountEl = document.getElementById('expenses-filtered-count');
    const totalAmountEl = document.getElementById('expenses-filtered-amount');

    const filtered = this.getFilteredExpenses();

    let totalSum = 0;
    filtered.forEach(e => totalSum += (Number(e.amount) || 0));

    if (totalCountEl) totalCountEl.textContent = `${filtered.length} Kayıt`;
    if (totalAmountEl) totalAmountEl.textContent = `₺${totalSum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (tableContainer) tableContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (tableContainer) tableContainer.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = filtered.map(exp => {
      const cat = this.getCategoryInfo(exp.category);
      const dateFormatted = exp.date ? exp.date.split('-').reverse().join('.') : '-';
      const sym = exp.currency === 'USD' ? '$' : (exp.currency === 'EUR' ? '€' : '₺');
      const amountFormatted = `${sym}${Number(exp.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const isPending = exp.status === 'pending';
      const statusBadge = isPending 
        ? `<span style="background: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 12px; font-weight: 700; font-size: 11px;">⏳ Beklemede</span>`
        : `<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 12px; font-weight: 700; font-size: 11px;">✅ Ödendi</span>`;

      const methodLabels = {
        cash: '💵 Nakit / Elden',
        credit_card: '💳 Kredi Kartı',
        bank: '🏦 Banka / Havale',
        check: '📑 Çek / Senet'
      };
      const methodLabel = methodLabels[exp.paymentMethod] || '💵 Nakit';

      return `
        <tr class="ledger-row-item">
          <td data-label="Tarih" style="font-weight: 600; color: #475569; font-size: 12.5px;">${dateFormatted}</td>
          <td data-label="Kategori">
            <span style="display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 14px; font-size: 11px; font-weight: 700; border: 1px solid #e2e8f0;">
              <span>${cat.icon}</span> ${escapeHtml(cat.label)}
            </span>
          </td>
          <td data-label="Harcama Başlığı / Açıklama">
            <div style="font-weight: 700; color: #0f172a; font-size: 13.5px;">${escapeHtml(exp.title || '-')}</div>
            ${exp.supplierOrPayee ? `<div style="font-size: 11.5px; color: #64748b;">Kişi/Firma: <strong>${escapeHtml(exp.supplierOrPayee)}</strong></div>` : ''}
            ${exp.notes ? `<div style="font-size: 11px; color: #94a3b8; font-style: italic;">${escapeHtml(exp.notes)}</div>` : ''}
          </td>
          <td data-label="Ödeme Yöntemi" style="font-size: 12px; color: #475569;">${methodLabel}</td>
          <td data-label="Ödeme Durumu">${statusBadge}</td>
          <td data-label="Tutar" style="text-align: right;">
            <strong style="font-size: 14.5px; color: #0f172a; font-family: monospace;">${amountFormatted}</strong>
          </td>
          <td data-label="İşlemler" style="text-align: center; white-space: nowrap;">
            <div class="actions-cell" style="justify-content: center;">
              <button type="button" class="btn-icon info" onclick="window.Expenses.openModal(${exp.id})" title="Harcamayı Düzenle">✏️</button>
              <button type="button" class="btn-icon danger" onclick="window.Expenses.deleteExpense(${exp.id})" title="Harcamayı Sil">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openModal(id = null) {
    const form = document.getElementById('expense-form');
    if (form) form.reset();

    const titleEl = document.getElementById('expense-modal-title');
    const idEl = document.getElementById('expense-id');
    const dateEl = document.getElementById('expense-date');

    // Default to today
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    if (id) {
      const exp = this.expenses.find(e => Number(e.id) === Number(id));
      if (exp) {
        if (titleEl) titleEl.textContent = 'Harcama Kaydını Düzenle ✏️';
        if (idEl) idEl.value = exp.id;
        document.getElementById('expense-title').value = exp.title || '';
        document.getElementById('expense-category').value = exp.category || 'other';
        document.getElementById('expense-amount').value = exp.amount || '';
        document.getElementById('expense-currency').value = exp.currency || 'TRY';
        if (dateEl && exp.date) dateEl.value = exp.date;
        document.getElementById('expense-payment-method').value = exp.paymentMethod || 'cash';
        document.getElementById('expense-status').value = exp.status || 'paid';
        document.getElementById('expense-supplier').value = exp.supplierOrPayee || '';
        document.getElementById('expense-receipt-no').value = exp.receiptNo || '';
        document.getElementById('expense-notes').value = exp.notes || '';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Yeni Harcama / Masraf Ekle 💸';
      if (idEl) idEl.value = '';
    }

    window.openModalById('expense-modal');
  },

  async saveExpense() {
    const id = document.getElementById('expense-id').value;
    const title = document.getElementById('expense-title').value.trim();
    const category = document.getElementById('expense-category').value;
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const currency = document.getElementById('expense-currency').value || 'TRY';
    const date = document.getElementById('expense-date').value;
    const paymentMethod = document.getElementById('expense-payment-method').value;
    const status = document.getElementById('expense-status').value;
    const supplierOrPayee = document.getElementById('expense-supplier').value.trim();
    const receiptNo = document.getElementById('expense-receipt-no').value.trim();
    const notes = document.getElementById('expense-notes').value.trim();

    if (!title) {
      window.showToast('Lütfen harcama başlığını yazın!', 'error');
      return;
    }
    if (amount <= 0) {
      window.showToast('Lütfen geçerli bir tutar girin!', 'error');
      return;
    }

    const payload = {
      title,
      category,
      amount,
      currency,
      date: date || new Date().toISOString().split('T')[0],
      paymentMethod,
      status,
      supplierOrPayee,
      receiptNo,
      notes,
      updatedAt: new Date().toISOString()
    };

    try {
      if (id) {
        payload.id = Number(id);
        await window.dbUpdate('expenses', payload);
        window.showToast('Harcama kaydı güncellendi! ✅', 'success');
      } else {
        payload.createdAt = new Date().toISOString();
        await window.dbAdd('expenses', payload);
        window.showToast('Yeni harcama başarıyla kaydedildi! 💸', 'success');
      }

      window.closeModalById('expense-modal');
      await this.render();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (e) {
      console.error('Error saving expense:', e);
      window.showToast('Harcama kaydedilirken hata oluştu: ' + e.message, 'error');
    }
  },

  async deleteExpense(id) {
    if (!confirm('Bu harcama kaydını silmek istediğinizden emin misiniz?')) return;
    try {
      await window.dbDelete('expenses', Number(id));
      window.showToast('Harcama kaydı silindi.', 'info');
      await this.render();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (e) {
      console.error('Error deleting expense:', e);
      window.showToast('Silme hatası: ' + e.message, 'error');
    }
  },

  sendExpenseWhatsApp(id) {
    const exp = this.expenses.find(e => Number(e.id) === Number(id));
    if (!exp) return;

    const company = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim';
    const cat = this.getCategoryInfo(exp.category);
    const sym = exp.currency === 'USD' ? '$' : (exp.currency === 'EUR' ? '€' : '₺');
    const dateFormatted = exp.date ? exp.date.split('-').reverse().join('.') : '-';

    const msg = `💸 *${company.toUpperCase()} — HARCAMA BİLDİRİMİ*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *Açıklama:* ${exp.title}\n` +
      `🏷️ *Kategori:* ${cat.icon} ${cat.label}\n` +
      `💰 *Tutar:* ${sym}${Number(exp.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}\n` +
      `📅 *Tarih:* ${dateFormatted}\n` +
      `💳 *Ödeme:* ${exp.paymentMethod || 'Nakit'} (${exp.status === 'pending' ? 'Beklemede' : 'Ödendi'})\n` +
      (exp.supplierOrPayee ? `👤 *Kişi/Firma:* ${exp.supplierOrPayee}\n` : '') +
      (exp.notes ? `📝 *Not:* ${exp.notes}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  },

  shareWhatsAppSummary() {
    const company = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim';
    const filtered = this.getFilteredExpenses();
    const today = new Date().toLocaleDateString('tr-TR');

    let totalAmount = 0;
    const catTotals = {};

    filtered.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      totalAmount += amt;
      const cat = this.getCategoryInfo(exp.category);
      catTotals[cat.label] = (catTotals[cat.label] || 0) + amt;
    });

    let breakdownText = '';
    for (const [cLabel, cTotal] of Object.entries(catTotals)) {
      breakdownText += `• ${cLabel}: ₺${cTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}\n`;
    }

    const msg = `📊 *${company.toUpperCase()} — GİDER & HARCAMA ÖZETİ*\n` +
      `📅 *Tarih:* ${today}\n` +
      `📋 *Toplam Harcama Kalemi:* ${filtered.length} Adet\n` +
      `💰 *TOPLAM HARCAMA:* ₺${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏷️ *Kategori Dağılımı:*\n` +
      breakdownText +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `ℹ️ _Atölyecim ERP Sistemi üzerinden oluşturulmuştur._`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  },

  exportCSV() {
    const filtered = this.getFilteredExpenses();
    if (filtered.length === 0) {
      window.showToast('Dışa aktarılacak harcama kaydı bulunamadı.', 'warning');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Tarih;Kategori;Harcama Başlığı;Kişi/Firma;Ödeme Yöntemi;Durum;Tutar;Para Birimi;Fiş No;Notlar\r\n';

    filtered.forEach(exp => {
      const cat = this.getCategoryInfo(exp.category);
      const row = [
        exp.date || '',
        cat.label,
        `"${(exp.title || '').replace(/"/g, '""')}"`,
        `"${(exp.supplierOrPayee || '').replace(/"/g, '""')}"`,
        exp.paymentMethod || 'cash',
        exp.status === 'pending' ? 'Beklemede' : 'Ödendi',
        Number(exp.amount || 0).toFixed(2),
        exp.currency || 'TRY',
        `"${(exp.receiptNo || '').replace(/"/g, '""')}"`,
        `"${(exp.notes || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(';') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Harcamalarim_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.showToast('Harcama listesi Excel/CSV olarak indirildi! 📊', 'success');
  }
};

// Global window binding
window.Expenses = Expenses;
