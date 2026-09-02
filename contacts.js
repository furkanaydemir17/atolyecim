import { escapeHtml, bindOnce, safeAdd, safeSub, generateId, csvSafe, downloadBlob } from './utils.js';

function formatPhone(raw) {
  let phone = (raw || '').replace(/\D/g, '');
  // Remove all leading zeros (e.g. 0546... or 0090... -> 546... or 90...)
  while (phone.startsWith('0')) {
    phone = phone.substring(1);
  }
  // Now check if it is already 12 digits starting with 90
  if (phone.startsWith('90') && phone.length === 12) {
    return phone;
  }
  // If it is 10 digits starting with 5, prefix with 90
  if (phone.length === 10 && phone.startsWith('5')) {
    return '90' + phone;
  }
  return phone;
}

const Contacts = {
  currentFilter: 'all',
  currentLedgerContactId: null,

  async render() {
    this.bindEvents();
    await this.loadContacts();
  },

  bindEvents() {
    // Add contact buttons
    const addBtn = document.getElementById('add-contact-btn');
    const addEmptyBtn = document.getElementById('add-contact-empty-btn');
    if (addBtn && !addBtn._bound) {
      addBtn._bound = true;
      addBtn.addEventListener('click', () => this.openModal());
    }
    if (addEmptyBtn && !addEmptyBtn._bound) {
      addEmptyBtn._bound = true;
      addEmptyBtn.addEventListener('click', () => this.openModal());
    }

    // Contact form
    const form = document.getElementById('contact-form');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveContact();
      });
    }

    // Transaction form
    const txForm = document.getElementById('transaction-form');
    if (txForm && !txForm._bound) {
      txForm._bound = true;
      txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveTransaction();
      });
    }

    // Filters
    const filterBar = document.getElementById('contact-filters');
    if (filterBar && !filterBar._bound) {
      filterBar._bound = true;
      filterBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.currentFilter = e.target.dataset.filter;
          this.loadContacts();
        }
      });
    }

    // Search Input
    const searchInput = document.getElementById('search-contacts');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', () => {
        this.loadContacts();
      });
    }

    // PDF Import bindings
    const btnImportPdf = document.getElementById('btn-ledger-import-pdf');
    const fileInputPdf = document.getElementById('ledger-pdf-file-input');
    if (btnImportPdf && fileInputPdf && !btnImportPdf._bound) {
      btnImportPdf._bound = true;
      btnImportPdf.addEventListener('click', () => {
        fileInputPdf.click();
      });

      fileInputPdf.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast('PDF belgesi yükleniyor ve okunuyor...', 'info');

        try {
          const arrayBuffer = await file.arrayBuffer();
          // Configure PDF.js worker first
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
          }
          const pdfText = await extractTextFromPDF(arrayBuffer);
          if (!pdfText.trim()) {
            throw new Error('PDF içerisinden metin okunamadı. Lütfen taranmış resim (OCR olmayan) yerine dijital bir PDF belgesi yükleyin.');
          }

          showToast('Yapay Zeka ekstre hareketlerini analiz ediyor...', 'info');
          const parsedTxs = await parseTransactionsWithGemini(pdfText);
          
          if (parsedTxs.length === 0) {
            showToast('PDF içerisinde herhangi bir cari hareket bulunamadı.', 'warning');
            return;
          }

          // Open review modal
          openPdfReviewModal(parsedTxs);
        } catch (err) {
          console.error(err);
          showToast('Hata: ' + err.message, 'error');
        } finally {
          fileInputPdf.value = ''; // Reset
        }
      });
    }

    // Dynamic Item Row Button and KDV rate changes
    const btnAddRow = document.getElementById('btn-tx-add-item-row');
    if (btnAddRow && !btnAddRow._bound) {
      btnAddRow._bound = true;
      btnAddRow.addEventListener('click', () => {
        this.addTxItemRow();
      });
    }

    const kdvRateSelect = document.getElementById('tx-kdv-rate');
    if (kdvRateSelect && !kdvRateSelect._bound) {
      kdvRateSelect._bound = true;
      kdvRateSelect.addEventListener('change', () => {
        this.calculateTxTotals();
      });
    }
  },

  async loadContacts() {
    let contacts = await dbGetAll('contacts');
    const transactions = await dbGetAll('transactions');

    if (this.currentFilter !== 'all') {
      contacts = contacts.filter(c => c.type === this.currentFilter || c.type === 'ikisi');
    }

    const searchVal = document.getElementById('search-contacts')?.value?.toLowerCase().trim() || '';
    if (searchVal) {
      contacts = contacts.filter(c => 
        (c.name || '').toLowerCase().includes(searchVal) ||
        (c.phone || '').toLowerCase().includes(searchVal) ||
        (c.company || '').toLowerCase().includes(searchVal) ||
        (c.address || '').toLowerCase().includes(searchVal)
      );
    }

    // Calculate balances grouped by contact and currency
    const balances = {};
    contacts.forEach(c => {
      balances[c.id] = {
        TRY: { receivable: 0, payable: 0 },
        USD: { receivable: 0, payable: 0 },
        EUR: { receivable: 0, payable: 0 }
      };
    });

    transactions.forEach(tx => {
      if (!balances[tx.contactId]) return;
      if (tx.isPackaging) return;
      const curr = tx.currency || 'TRY';
      if (!balances[tx.contactId][curr]) {
        balances[tx.contactId][curr] = { receivable: 0, payable: 0 };
      }
      if (tx.type === 'alacak') balances[tx.contactId][curr].receivable += tx.amount;
      else if (tx.type === 'borc') balances[tx.contactId][curr].payable += tx.amount;
      else if (tx.type === 'tahsilat') balances[tx.contactId][curr].receivable -= tx.amount;
      else if (tx.type === 'odeme') balances[tx.contactId][curr].payable -= tx.amount;
    });

    const tbody = document.getElementById('contacts-tbody');
    const emptyState = document.getElementById('contacts-empty');
    const table = document.getElementById('contacts-table');

    if (contacts.length === 0) {
      if (table) table.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (table) table.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    const symbols = { TRY: '₺', USD: '$', EUR: '€' };

    tbody.innerHTML = contacts.map(c => {
      const contactBal = balances[c.id] || { TRY: { receivable: 0, payable: 0 } };
      
      // Helper to format currency rows in table columns
      const formatBalanceCol = (field) => {
        const parts = [];
        for (const [code, val] of Object.entries(contactBal)) {
          let amt = 0;
          if (field === 'receivable') amt = val.receivable;
          else if (field === 'payable') amt = val.payable;
          else if (field === 'net') amt = val.receivable - val.payable;

          if (amt !== 0) {
            const sym = symbols[code] || code;
            parts.push(`<div style="white-space: nowrap;">${sym}${amt.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>`);
          }
        }
        return parts.length > 0 ? parts.join('') : '<div>₺0,00</div>';
      };

      const getNetClass = () => {
        let hasPositive = false;
        let hasNegative = false;
        for (const val of Object.values(contactBal)) {
          const net = val.receivable - val.payable;
          if (net > 0) hasPositive = true;
          if (net < 0) hasNegative = true;
        }
        if (hasPositive && hasNegative) return 'money-neutral';
        if (hasPositive) return 'money-positive';
        if (hasNegative) return 'money-negative';
        return 'money-neutral';
      };

      const typeLabel = c.type === 'musteri' ? 'Müşteri' : c.type === 'tedarikci' ? 'Tedarikçi' : 'Müşteri + Tedarikçi';
      const typeClass = c.type === 'musteri' ? 'badge-musteri' : c.type === 'tedarikci' ? 'badge-tedarikci' : 'badge-ikisi';
      const netClass = getNetClass();

      return `
        <tr onclick="Contacts.openLedgerModal(${c.id})" style="cursor: pointer;" class="contact-row-clickable" title="Cari Ekstreyi Görüntülemek İçin Tıklayın">
          <td style="font-weight: 700; color: var(--text-primary);">
            ${this.escape(c.name)}
          </td>
          <td><span class="category-badge ${typeClass}">${typeLabel}</span></td>
          <td>${this.escape(c.phone || '-')}</td>
          <td class="money-positive">${formatBalanceCol('receivable')}</td>
          <td class="money-negative">${formatBalanceCol('payable')}</td>
          <td class="${netClass}">${formatBalanceCol('net')}</td>
          <td onclick="event.stopPropagation();">
            <div class="actions-cell">
              <button type="button" class="btn-icon success" title="İşlem Ekle" onclick="event.stopPropagation(); Contacts.openTransactionModal(${c.id})">💰</button>
              <button type="button" class="btn-icon info" title="Düzenle" onclick="event.stopPropagation(); Contacts.openModal(${c.id})">✏️</button>
              <button type="button" class="btn-icon danger" title="Sil" onclick="event.stopPropagation(); Contacts.deleteContact(${c.id})">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openModal(id = null) {
    const modal = document.getElementById('contact-modal');
    const title = document.getElementById('contact-modal-title');
    const form = document.getElementById('contact-form');

    form.reset();
    document.getElementById('contact-id').value = '';
    document.getElementById('contact-discount-rate').value = 0;

    if (id) {
      title.textContent = 'Cari Düzenle';
      dbGet('contacts', id).then(c => {
        if (c) {
          document.getElementById('contact-id').value = c.id;
          document.getElementById('contact-name').value = c.name;
          document.getElementById('contact-type').value = c.type;
          document.getElementById('contact-phone').value = c.phone || '';
          document.getElementById('contact-address').value = c.address || '';
          document.getElementById('contact-discount-rate').value = c.discountRate || 0;
        }
      });
    } else {
      title.textContent = 'Yeni Cari Ekle';
    }

    openModalById('contact-modal');
  },

  async saveContact() {
    const id = document.getElementById('contact-id').value;
    const data = {
      name: document.getElementById('contact-name').value.trim(),
      type: document.getElementById('contact-type').value,
      phone: document.getElementById('contact-phone').value.trim(),
      address: document.getElementById('contact-address').value.trim(),
      discountRate: parseInt(document.getElementById('contact-discount-rate').value) || 0
    };

    if (!data.name || !data.type) {
      showToast('Ad ve tür zorunludur!', 'error');
      return;
    }

    // O2 Düzeltme: Telefon format kontrolü
    if (data.phone && !/^[0-9+\-\s()]{7,15}$/.test(data.phone)) {
      showToast('Geçersiz telefon numarası formatı!', 'error');
      return;
    }

    try {
      if (id) {
        data.id = parseInt(id);
        await dbUpdate('contacts', data);
        showToast('Cari hesap güncellendi!', 'success');
      } else {
        await dbAdd('contacts', data);
        showToast('Cari hesap eklendi!', 'success');
      }

      closeModalById('contact-modal');
      await this.loadContacts();
      if (this.currentLedgerContactId && id && parseInt(id) === this.currentLedgerContactId) {
        await this.openLedgerModal(this.currentLedgerContactId);
      }
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  openTransactionModal(contactId, txId = null) {
    const form = document.getElementById('transaction-form');
    form.reset();
    document.getElementById('tx-contact-id').value = contactId;
    document.getElementById('tx-id').value = txId || '';
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('tx-is-packaging').checked = false;
    document.getElementById('tx-currency').value = 'TRY';

    const tbody = document.getElementById('tx-items-tbody');
    if (tbody) tbody.innerHTML = '';
    
    const kdvSelect = document.getElementById('tx-kdv-rate');
    if (kdvSelect) kdvSelect.value = '10';

    const invoiceNoInput = document.getElementById('tx-invoice-no');
    if (invoiceNoInput) invoiceNoInput.value = '';

    const subtotalEl = document.getElementById('tx-subtotal-display');
    const grandtotalEl = document.getElementById('tx-grandtotal-display');
    if (subtotalEl) subtotalEl.textContent = '0.00';
    if (grandtotalEl) grandtotalEl.textContent = '0.00';

    const titleEl = document.getElementById('transaction-modal-title');
    const submitBtn = form.querySelector('button[type="submit"]');

    if (txId) {
      titleEl.textContent = 'İşlemi Düzenle';
      if (submitBtn) submitBtn.textContent = 'İşlemi Güncelle';

      dbGet('transactions', txId).then(tx => {
        if (tx) {
          document.getElementById('tx-type').value = tx.type;
          document.getElementById('tx-amount').value = tx.amount;
          document.getElementById('tx-description').value = tx.description || '';
          document.getElementById('tx-date').value = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];
          document.getElementById('tx-is-packaging').checked = !!tx.isPackaging;
          document.getElementById('tx-currency').value = tx.currency || 'TRY';

          if (invoiceNoInput) invoiceNoInput.value = tx.invoiceNo || '';
          if (kdvSelect) kdvSelect.value = tx.kdvRate !== undefined ? tx.kdvRate.toString() : '10';

          if (tx.items && tx.items.length > 0) {
            tx.items.forEach(item => {
              this.addTxItemRow(item);
            });
          }
        }
      });
    } else {
      titleEl.textContent = 'İşlem Ekle';
      if (submitBtn) submitBtn.textContent = 'İşlemi Kaydet';

      dbGet('contacts', contactId).then(c => {
        if (c) {
          titleEl.textContent = c.name + ' — İşlem Ekle';
        }
      });
    }

    openModalById('transaction-modal');
  },

  async saveTransaction() {
    const contactId = parseInt(document.getElementById('tx-contact-id').value);
    const txId = document.getElementById('tx-id').value;
    const dateInput = document.getElementById('tx-date').value;
    
    // Collect dynamic item rows
    const items = [];
    const tbody = document.getElementById('tx-items-tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => {
        const stok = row.querySelector('.tx-item-stok')?.value.trim() || '';
        const name = row.querySelector('.tx-item-name')?.value.trim() || '';
        const color = row.querySelector('.tx-item-color')?.value.trim() || '';
        const qty = parseFloat(String(row.querySelector('.tx-item-qty')?.value || '0').replace(',', '.')) || 0;
        const unit = row.querySelector('.tx-item-unit')?.value.trim() || '';
        const price = parseFloat(String(row.querySelector('.tx-item-price')?.value || '0').replace(',', '.')) || 0;
        const discount = parseFloat(String(row.querySelector('.tx-item-discount')?.value || '0').replace(',', '.')) || 0;
        const total = qty * price * (1 - discount / 100);

        if (stok || name || color || qty > 0) {
          items.push({
            stokCode: stok,
            name,
            color,
            qty,
            unit,
            price,
            discount,
            total
          });
        }
      });
    }

    const data = {
      contactId: contactId,
      type: document.getElementById('tx-type').value,
      amount: parseFloat(document.getElementById('tx-amount').value) || 0,
      currency: document.getElementById('tx-currency').value || 'TRY',
      description: document.getElementById('tx-description').value.trim(),
      date: dateInput ? new Date(dateInput).toISOString() : new Date().toISOString(),
      isPackaging: document.getElementById('tx-is-packaging').checked,
      
      invoiceNo: document.getElementById('tx-invoice-no')?.value.trim() || '',
      items,
      kdvRate: parseFloat(document.getElementById('tx-kdv-rate')?.value) || 0
    };

    if (!data.amount || data.amount <= 0) {
      showToast('Geçerli bir tutar giriniz!', 'error');
      return;
    }

    try {
      if (txId) {
        data.id = parseInt(txId);
        // Preserve orderId reference if it was linked to an order
        const oldTx = await dbGet('transactions', data.id);
        if (oldTx && oldTx.orderId) {
          data.orderId = oldTx.orderId;
        }
        await dbUpdate('transactions', data);
        showToast('İşlem kaydı güncellendi!', 'success');
      } else {
        await dbAdd('transactions', data);
        const typeLabels = { alacak: 'Satış / Teslim Fişi', borc: 'Alış Fişi / Gider', tahsilat: 'Tahsilat', odeme: 'Ödeme' };
        showToast(`${typeLabels[data.type]} kaydı eklendi!`, 'success');
      }

      closeModalById('transaction-modal');
      await this.loadContacts();
      if (contactId) {
        await this.openLedgerModal(contactId);
      }
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  // Helper Methods for Transaction Detailed Items
  addTxItemRow(item = {}) {
    const tbody = document.getElementById('tx-items-tbody');
    if (!tbody) return;

    const rowId = 'tx-item-row-' + Math.random().toString(36).substr(2, 9);
    
    // Default values
    const stok = item.stokCode || '';
    const tanim = item.name || '';
    const renk = item.color || '';
    const miktar = item.qty !== undefined ? item.qty : '';
    const birim = item.unit || 'Çift';
    const fiyat = item.price !== undefined ? item.price : '';
    const iskonto = item.discount !== undefined ? item.discount : 0;
    const numMiktar = parseFloat(String(miktar).replace(',', '.')) || 0;
    const numFiyat = parseFloat(String(fiyat).replace(',', '.')) || 0;
    const numIskonto = parseFloat(String(iskonto).replace(',', '.')) || 0;
    const total = item.total !== undefined ? item.total : (numMiktar * numFiyat * (1 - numIskonto / 100));

    const html = `
      <tr id="${rowId}" style="border-bottom: 1px solid var(--border-card);">
        <td style="padding: 4px;"><input type="text" class="tx-inline-input tx-item-stok" value="${escapeHtml(stok)}" placeholder=""></td>
        <td style="padding: 4px;"><input type="text" class="tx-inline-input tx-item-name" value="${escapeHtml(tanim)}" placeholder=""></td>
        <td style="padding: 4px;"><input type="text" class="tx-inline-input tx-item-color" value="${escapeHtml(renk)}" placeholder=""></td>
        <td style="padding: 4px;"><input type="text" inputmode="decimal" class="tx-inline-input tx-item-qty" value="${miktar !== '' ? miktar : ''}" style="text-align: right;" placeholder=""></td>
        <td style="padding: 4px;"><input type="text" class="tx-inline-input tx-item-unit" value="${escapeHtml(birim)}" placeholder=""></td>
        <td style="padding: 4px;"><input type="text" inputmode="decimal" class="tx-inline-input tx-item-price" value="${fiyat !== '' ? fiyat : ''}" style="text-align: right;" placeholder=""></td>
        <td style="padding: 4px;"><input type="text" inputmode="decimal" class="tx-inline-input tx-item-discount" value="${iskonto !== '' && iskonto !== 0 ? iskonto : ''}" style="text-align: right;" placeholder=""></td>
        <td style="padding: 4px; text-align: right; font-weight: 600; color: var(--text-primary);" class="tx-item-total-cell">${Number(total || 0).toFixed(2)}</td>
        <td style="padding: 4px; text-align: center;">
          <button type="button" class="btn-icon danger" onclick="Contacts.removeTxItemRow('${rowId}')" style="font-size: 1.1rem; border: none; background: transparent; cursor: pointer; color: var(--color-danger); line-height: 1; padding: 2px;">&times;</button>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', html);
    
    // Add input event listeners to input elements in this row
    const row = document.getElementById(rowId);
    if (row) {
      row.querySelectorAll('.tx-inline-input').forEach(input => {
        input.addEventListener('input', () => this.calculateTxTotals());
      });
    }
    
    this.calculateTxTotals();
  },

  removeTxItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
      row.remove();
    }
    this.calculateTxTotals();
  },

  calculateTxTotals() {
    const tbody = document.getElementById('tx-items-tbody');
    if (!tbody) return;

    let totalQty = 0;
    let subtotal = 0;

    tbody.querySelectorAll('tr').forEach(row => {
      const qtyInput = row.querySelector('.tx-item-qty');
      const priceInput = row.querySelector('.tx-item-price');
      const discInput = row.querySelector('.tx-item-discount');
      const totalCell = row.querySelector('.tx-item-total-cell');

      const qty = parseFloat(String(qtyInput?.value || '0').replace(',', '.')) || 0;
      const price = parseFloat(String(priceInput?.value || '0').replace(',', '.')) || 0;
      const disc = parseFloat(String(discInput?.value || '0').replace(',', '.')) || 0;

      const netPrice = price * (1 - disc / 100);
      const total = qty * netPrice;

      totalQty += qty;
      subtotal += total;

      if (totalCell) {
        totalCell.textContent = total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    });

    const kdvRate = parseFloat(document.getElementById('tx-kdv-rate')?.value) || 0;
    const kdvAmount = subtotal * (kdvRate / 100);
    const grandTotal = subtotal + kdvAmount;

    const subtotalEl = document.getElementById('tx-subtotal-display');
    const grandtotalEl = document.getElementById('tx-grandtotal-display');
    const amountInput = document.getElementById('tx-amount');

    if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (grandtotalEl) grandtotalEl.textContent = grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    if (grandTotal > 0 && amountInput) {
      amountInput.value = grandTotal.toFixed(2);
    }
  },

  resolveTxItems(tx, ordersMap) {
    if (tx.items && tx.items.length > 0) {
      return tx.items;
    }
    if (tx.orderId && ordersMap && ordersMap[tx.orderId]) {
      const order = ordersMap[tx.orderId];
      if (order.colors && order.colors.length > 0) {
        const resolved = [];
        order.colors.forEach(cg => {
          let sizeDetail = '';
          if (cg.sizes && cg.sizes.length > 0) {
            sizeDetail = cg.sizes.map(s => `${s.size} Nmr: ${s.qty} Ad.`).join(', ');
          }
          resolved.push({
            stokCode: order.modelCode || '-',
            name: order.modelCode + (sizeDetail ? ` (${sizeDetail})` : ''),
            color: cg.color || '-',
            qty: cg.qty || 0,
            unit: 'Çift',
            price: order.price || 0,
            discount: 0,
            total: cg.qty * order.price
          });
        });
        return resolved;
      }
    }
    return null;
  },

  toggleTxDetailRow(txId) {
    const el = document.getElementById(`tx-detail-row-${txId}`);
    if (el) {
      const isHidden = el.style.display === 'none';
      el.style.display = isHidden ? 'table-row' : 'none';
    }
  },

  async deleteContact(id) {
    try {
      // K9 Düzeltme: Bağlı siparişlerin kontrolü ve uyarısı
      const allOrders = await dbGetAll('orders');
      const linkedOrders = allOrders.filter(o => o.contactId === id);
      if (linkedOrders.length > 0) {
        if (!confirm(`Bu carinin ${linkedOrders.length} adet siparişi bulunmaktadır. Cariyi sildiğinizde TÜM bağlı siparişler de kalıcı olarak silinecektir. Devam etmek istiyor musunuz?`)) {
          return;
        }
        for (const order of linkedOrders) {
          if (order.status !== 'iptal' && order.colors) {
            if (window.Orders && typeof window.Orders.adjustStockForColors === 'function') {
              await window.Orders.adjustStockForColors(order.colors, 'restore');
            }
          }
        }
        if (window.dbDeleteMany) {
          await window.dbDeleteMany('orders', linkedOrders.map(o => o.id));
        } else {
          await Promise.all(linkedOrders.map(o => dbDelete('orders', o.id)));
        }
      } else {
        if (!confirm('Bu cari hesabı ve tüm işlem geçmişini silmek istediğinizden emin misiniz?')) return;
      }

      // Delete related transactions in parallel batch
      const transactions = await dbGetByIndex('transactions', 'contactId', id);
      if (transactions.length > 0) {
        if (window.dbDeleteMany) {
          await window.dbDeleteMany('transactions', transactions.map(t => t.id));
        } else {
          await Promise.all(transactions.map(tx => dbDelete('transactions', tx.id)));
        }
      }

      await dbDelete('contacts', id);
      showToast('Cari hesap silindi.', 'info');
      await this.loadContacts();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      showToast('Silme hatası: ' + err.message, 'error');
    }
  },

  async openLedgerModal(contactId) {
    try {
      this.currentLedgerContactId = contactId;
      const contact = await dbGet('contacts', contactId);
      if (!contact) {
        showToast('Cari bulunamadı!', 'error');
        return;
      }

      const allOrders = await dbGetAll('orders');
      const ordersMap = {};
      allOrders.forEach(o => {
        ordersMap[o.id] = o;
      });

      // Configure B2B Panel visibility and actions
      const b2bPanel = document.getElementById('ledger-b2b-container');
      if (b2bPanel) {
        if (contact.type === 'tedarikci') {
          b2bPanel.style.display = 'none';
        } else {
          b2bPanel.style.display = 'none'; // Hidden by user request
          
          const discountRate = contact.discountRate || 0;
          const discountBadge = document.getElementById('ledger-b2b-discount-badge');
          if (discountBadge) {
            discountBadge.textContent = `%${discountRate} İskontolu`;
            discountBadge.style.display = discountRate > 0 ? 'inline-block' : 'none';
          }
          
          const company = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
          const b2bUrl = `${window.location.origin}/catalog.html?w=${encodeURIComponent(company)}&c=${contact.id}`;
          
          const btnCopy = document.getElementById('btn-ledger-copy-b2b');
          if (btnCopy) {
            const newBtn = btnCopy.cloneNode(true);
            btnCopy.parentNode.replaceChild(newBtn, btnCopy);
            newBtn.addEventListener('click', () => {
              navigator.clipboard.writeText(b2bUrl).then(() => {
                showToast('Müşteriye özel B2B Sipariş linki kopyalandı! 📋', 'success');
              }).catch(() => {
                showToast('Kopyalama başarısız!', 'error');
              });
            });
          }
          
          const btnShare = document.getElementById('btn-ledger-share-b2b');
          if (btnShare) {
            const newBtn = btnShare.cloneNode(true);
            btnShare.parentNode.replaceChild(newBtn, btnShare);
            newBtn.addEventListener('click', () => {
              const msg = `Sayın *${contact.name}*,\nSize özel hazırladığımız B2B sipariş kataloğu bağlantımız aşağıdadır. Bu link üzerinden güncel modellerimizi inceleyebilir ve siparişinizi doğrudan oluşturabilirsiniz:\n\n🔗 ${b2bUrl}`;
              let cleanPhone = (contact.phone || '').replace(/\D/g, '');
              if (!cleanPhone) {
                const userInput = prompt(`"${contact.name}" müşterisinin kayıtlı telefon numarası bulunamadı. Lütfen B2B kataloğunu paylaşmak istediğiniz numarayı girin (Örn: 05551234567):`, '');
                if (!userInput) return;
                cleanPhone = userInput.replace(/\D/g, '');
                
                // Auto-save back to contact card
                if (cleanPhone) {
                  contact.phone = userInput.trim();
                  dbUpdate('contacts', contact).then(() => {
                    showToast('Telefon numarası müşteri kartına kaydedildi! 💾', 'info');
                  }).catch(e => console.error(e));
                }
              }
              const formattedPhone = formatPhone(cleanPhone);
              const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
              window.open(waLink, '_blank');
            });
          }
        }
      }

      const transactions = await dbGetByIndex('transactions', 'contactId', contactId);
      
      // Split standard and packaging transactions
      const standardTx = transactions.filter(tx => !tx.isPackaging);
      const packagingTx = transactions.filter(tx => tx.isPackaging);

      // Sort both by date ascending (oldest first)
      standardTx.sort((a, b) => new Date(a.date) - new Date(b.date));
      packagingTx.sort((a, b) => new Date(a.date) - new Date(b.date));

      document.getElementById('contact-ledger-title').textContent = `${contact.name.toUpperCase()} CARİ EKSTRESİ`;

      // Group totals by currency
      const currencyTotals = {
        TRY: { receivable: 0, payable: 0 },
        USD: { receivable: 0, payable: 0 },
        EUR: { receivable: 0, payable: 0 }
      };

      standardTx.forEach(tx => {
        const curr = tx.currency || 'TRY';
        if (!currencyTotals[curr]) {
          currencyTotals[curr] = { receivable: 0, payable: 0 };
        }
        if (tx.type === 'alacak') currencyTotals[curr].receivable += tx.amount;
        else if (tx.type === 'borc') currencyTotals[curr].payable += tx.amount;
        else if (tx.type === 'tahsilat') currencyTotals[curr].receivable -= tx.amount;
        else if (tx.type === 'odeme') currencyTotals[curr].payable -= tx.amount;
      });

      const symbols = { TRY: '₺', USD: '$', EUR: '€' };

      const formatLedgerTotal = (field) => {
        const parts = [];
        for (const [code, val] of Object.entries(currencyTotals)) {
          const amt = val[field];
          if (amt !== 0) {
            parts.push(`${symbols[code] || code}${amt.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
          }
        }
        return parts.length > 0 ? parts.join(' | ') : '₺0,00';
      };

      const formatLedgerNet = () => {
        const parts = [];
        for (const [code, val] of Object.entries(currencyTotals)) {
          const net = val.receivable - val.payable;
          if (net !== 0) {
            let suffix = '';
            if (net > 0) suffix = ' (Alacaklıyız)';
            else if (net < 0) suffix = ' (Borçluyuz)';
            parts.push(`${symbols[code] || code}${Math.abs(net).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${suffix}`);
          }
        }
        return parts.length > 0 ? parts.join(' | ') : '₺0,00 (Dengede)';
      };

      document.getElementById('ledger-receivable').textContent = formatLedgerTotal('receivable');
      document.getElementById('ledger-payable').textContent = formatLedgerTotal('payable');
      
      const netEl = document.getElementById('ledger-net');
      netEl.textContent = formatLedgerNet();
      netEl.style.color = 'var(--text-accent)';

      // Populate Standard Ledger Table
      const tbody = document.getElementById('ledger-tbody');
      const emptyState = document.getElementById('ledger-empty');

      if (standardTx.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
      } else {
        emptyState.style.display = 'none';
        
        const cumulativeBalances = { TRY: 0, USD: 0, EUR: 0 };
        const totalRows = standardTx.length;

        tbody.innerHTML = standardTx.map((tx, idx) => {
          const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
          const curr = tx.currency || 'TRY';
          const txSymbol = symbols[curr] || '₺';

          let debit = 0;  // Borçlu
          let credit = 0; // Alacaklı

          if (tx.type === 'alacak') {
            debit = tx.amount;
          } else if (tx.type === 'tahsilat') {
            credit = tx.amount;
          } else if (tx.type === 'borc') {
            credit = tx.amount;
          } else if (tx.type === 'odeme') {
            debit = tx.amount;
          }

          if (!cumulativeBalances[curr]) {
            cumulativeBalances[curr] = 0;
          }
          cumulativeBalances[curr] += (debit - credit);
          const balanceForThisRow = cumulativeBalances[curr];

          const debitStr = debit > 0 ? `${txSymbol}${debit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '';
          const creditStr = credit > 0 ? `${txSymbol}${credit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '';

          let bakiyeBorcStr = '';
          let bakiyeAlacakStr = '';
          let cellStyleClass = '';

          if (balanceForThisRow > 0) {
            bakiyeBorcStr = `${txSymbol}${balanceForThisRow.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
            if (idx === totalRows - 1) {
              cellStyleClass = 'final-debit-cell';
            }
          } else if (balanceForThisRow < 0) {
            bakiyeAlacakStr = `${txSymbol}${Math.abs(balanceForThisRow).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
            if (idx === totalRows - 1) {
              cellStyleClass = 'final-credit-cell';
            }
          }

          const isLastRow = idx === totalRows - 1 ? 'class="final-balance-row"' : '';

          // Fiş tipi etiketleri
          const typeLabels = {
            alacak: 'Satış / Teslim Fişi',
            borc: 'Alış Fişi / Gider',
            tahsilat: 'Tahsilat',
            odeme: 'Ödeme'
          };
          const typeLabel = typeLabels[tx.type] || tx.type;
          const invoiceNo = tx.invoiceNo || '-';

          // Resolve sub-table items
          const txItems = this.resolveTxItems(tx, ordersMap);
          let itemsHtml = '';
          if (txItems && txItems.length > 0) {
            let totalQty = 0;
            let subtotal = 0;
            const itemsRows = txItems.map(item => {
              const qty = Number(item.qty) || 0;
              const price = Number(item.price) || 0;
              const discount = Number(item.discount) || 0;
              const netPrice = price * (1 - discount / 100);
              const total = qty * netPrice;
              
              totalQty += qty;
              subtotal += total;

              return `
                <tr style="border-bottom: 1px solid rgba(99,102,241,0.2); transition: background 0.15s;">
                  <td style="padding: 7px 10px; color: #94a3b8; font-family: monospace; font-size: 0.8rem; border-right: 1px solid rgba(99,102,241,0.15);">${escapeHtml(item.stokCode || '-')}</td>
                  <td style="padding: 7px 10px; color: #e2e8f0; font-weight: 600; border-right: 1px solid rgba(99,102,241,0.15);">${escapeHtml(item.name || '-')}</td>
                  <td style="padding: 7px 10px; border-right: 1px solid rgba(99,102,241,0.15);">
                    <span style="background: rgba(99,102,241,0.2); color: #a78bfa; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${escapeHtml(item.color || '-')}</span>
                  </td>
                  <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #f1f5f9; font-size: 0.9rem; border-right: 1px solid rgba(99,102,241,0.15);">${qty}</td>
                  <td style="padding: 7px 10px; color: #94a3b8; font-size: 0.78rem; border-right: 1px solid rgba(99,102,241,0.15);">${escapeHtml(item.unit || 'Çift')}</td>
                  <td style="padding: 7px 10px; text-align: right; color: #cbd5e1; border-right: 1px solid rgba(99,102,241,0.15);">${txSymbol}${price.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                  <td style="padding: 7px 10px; text-align: right; border-right: 1px solid rgba(99,102,241,0.15);">
                    ${discount > 0 ? `<span style="background: rgba(239,68,68,0.15); color: #f87171; padding: 2px 6px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">%${discount}</span>` : `<span style="color: #52525b;">-</span>`}
                  </td>
                  <td style="padding: 7px 10px; text-align: right; color: #cbd5e1; border-right: 1px solid rgba(99,102,241,0.15);">${txSymbol}${netPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                  <td style="padding: 7px 10px; text-align: right; font-weight: 700; color: #818cf8; font-size: 0.88rem;">${txSymbol}${total.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
                </tr>
              `;
            }).join('');

            const kdvRate = tx.kdvRate !== undefined ? tx.kdvRate : 10;
            const kdvAmount = subtotal * (kdvRate / 100);
            const grandTotal = subtotal + kdvAmount;

            itemsHtml = `
              <div style="padding: 14px 16px; background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%); border-radius: 8px; border: 1px solid rgba(99,102,241,0.35); border-left: 4px solid #6366f1; overflow-x: auto; margin-top: 6px; margin-bottom: 6px; box-shadow: 0 2px 12px rgba(99,102,241,0.1);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                  <span style="font-size: 0.75rem; font-weight: 700; color: #a78bfa; text-transform: uppercase; letter-spacing: 1px;">📋 Fiş Detayları</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left; min-width: 700px;">
                  <thead>
                    <tr style="background: rgba(99,102,241,0.2); border-bottom: 2px solid rgba(99,102,241,0.4);">
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-right: 1px solid rgba(99,102,241,0.2);">Stok Kodu</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-right: 1px solid rgba(99,102,241,0.2);">Ürün Tanımı</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-right: 1px solid rgba(99,102,241,0.2);">Renk</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-right: 1px solid rgba(99,102,241,0.2);">Miktar</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-right: 1px solid rgba(99,102,241,0.2);">Birim</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-right: 1px solid rgba(99,102,241,0.2);">Fiyat</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-right: 1px solid rgba(99,102,241,0.2);">İskonto</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; border-right: 1px solid rgba(99,102,241,0.2);">Net Fiyat</th>
                      <th style="padding: 8px 10px; color: #c4b5fd; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRows}
                  </tbody>
                </table>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <div style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px; padding: 10px 14px; min-width: 230px; font-size: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #a1a1aa;">
                      <span>Miktar Toplamları:</span>
                      <span style="font-weight: 700; color: #e4e4e7;">${totalQty} adet</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #a1a1aa;">
                      <span>Fiş Toplamı:</span>
                      <span style="font-weight: 700; color: #e4e4e7;">${txSymbol}${subtotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #a1a1aa; padding-bottom: 8px; border-bottom: 1px dashed rgba(99,102,241,0.4);">
                      <span>KDV Toplamı (%${kdvRate}):</span>
                      <span style="font-weight: 700; color: #e4e4e7;">${txSymbol}${kdvAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 0.9rem;">
                      <span style="color: #a78bfa;">Genel Toplam:</span>
                      <span style="color: #818cf8;">${txSymbol}${grandTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          } else {
            itemsHtml = `
              <div style="padding: 10px 15px; background: #f8fafc; border-radius: 6px; border: 1px solid var(--border-card); font-size: 0.85rem; color: var(--text-primary); word-break: break-word; white-space: normal; margin-top: 5px; margin-bottom: 5px;">
                <strong style="color: var(--text-secondary);">Genel Açıklama:</strong> ${escapeHtml(tx.description || 'Herhangi bir detay veya genel açıklama girilmemiş.')}
              </div>
            `;
          }

          return `
            <tr ${isLastRow} onclick="Contacts.toggleTxDetailRow(${tx.id})" style="cursor: pointer;" class="ledger-row-item">
              <td data-label="Tarih">${dateStr}</td>
              <td data-label="Evrak No" style="font-weight: 700; color: var(--text-accent);">${escapeHtml(invoiceNo)}</td>
              <td data-label="İşlem Türü"><span class="ledger-type-badge type-${tx.type}">${typeLabel}</span></td>
              <td data-label="Açıklama" style="font-weight: 500;" title="${this.escape(tx.description || '')}">${this.escape(tx.description || '-')}</td>
              <td data-label="Borçlu" style="text-align: right; font-weight: 600;">${debitStr || '-'}</td>
              <td data-label="Alacaklı" style="text-align: right; font-weight: 600;">${creditStr || '-'}</td>
              <td data-label="B. Borçlu" class="${cellStyleClass}" style="text-align: right; font-weight: 700; color: #ef4444;">${bakiyeBorcStr || '-'}</td>
              <td data-label="B. Alacaklı" class="${cellStyleClass}" style="text-align: right; font-weight: 700; color: #10b981;">${bakiyeAlacakStr || '-'}</td>
              <td data-label="İşlemler" style="text-align: center; white-space: nowrap;" onclick="event.stopPropagation();">
                <button class="btn-icon info" title="İşlemi Düzenle" onclick="Contacts.openTransactionModal(${contactId}, ${tx.id})">✏️</button>
                <button class="btn-icon danger" title="İşlemi Sil" onclick="Contacts.deleteTransaction(${tx.id}, ${contactId})">🗑️</button>
              </td>
            </tr>
            <tr id="tx-detail-row-${tx.id}" style="display: none; background: #f8fafc;" class="tx-detail-expanded-row">
              <td colspan="9" style="padding: 10px 15px;">
                ${itemsHtml}
              </td>
            </tr>
          `;
        }).join('');
      }

      // Populate Packaging Table (Kutu & Koli Takibi)
      const pTbody = document.getElementById('ledger-packaging-tbody');
      const pEmptyState = document.getElementById('ledger-packaging-empty');

      if (packagingTx.length === 0) {
        pTbody.innerHTML = '';
        pEmptyState.style.display = 'block';
      } else {
        pEmptyState.style.display = 'none';
        pTbody.innerHTML = packagingTx.map(tx => {
          const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
          const txSymbol = symbols[tx.currency || 'TRY'] || '₺';
          return `
            <tr>
              <td>${dateStr}</td>
              <td style="font-weight: 500;">${this.escape(tx.description || '-')}</td>
              <td style="text-align: right; font-weight: 700; color: var(--text-primary);">${txSymbol}${tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
              <td style="text-align: center; white-space: nowrap;">
                <button class="btn-icon info" title="İşlemi Düzenle" onclick="Contacts.openTransactionModal(${contactId}, ${tx.id})">✏️</button>
                <button class="btn-icon danger" title="İşlemi Sil" onclick="Contacts.deleteTransaction(${tx.id}, ${contactId})">🗑️</button>
              </td>
            </tr>
          `;
        }).join('');
      }

      // Bind Edit Contact Buttons (Header & Footer)
      const editHeaderBtn = document.getElementById('btn-ledger-edit-contact');
      if (editHeaderBtn) {
        editHeaderBtn.onclick = () => this.openModal(contactId);
      }
      const editFooterBtn = document.getElementById('btn-ledger-footer-edit-contact');
      if (editFooterBtn) {
        editFooterBtn.onclick = () => this.openModal(contactId);
      }

      // Bind Add Transaction Button
      const addTxBtn = document.getElementById('btn-ledger-add-tx');
      if (addTxBtn) {
        addTxBtn.onclick = () => this.openTransactionModal(contactId);
      }

      // Bind export button
      const exportBtn = document.getElementById('btn-ledger-export');
      if (exportBtn) {
        const newExportBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
        newExportBtn.addEventListener('click', () => {
          this.exportLedgerToCSV(contact.name, standardTx, packagingTx);
        });
      }

      // Bind Print Button
      const printBtn = document.getElementById('btn-ledger-print');
      if (printBtn) {
        printBtn.onclick = async () => {
          await this.printLedger(contact, standardTx);
        };
      }

      // Bind WhatsApp Share Button
      const shareBtn = document.getElementById('btn-ledger-share-whatsapp');
      if (shareBtn) {
        shareBtn.onclick = () => {
          this.shareLedgerOnWhatsApp(contact, standardTx, netBalance);
        };
      }

      openModalById('contact-ledger-modal');
    } catch (err) {
      showToast('Ekstre yüklenemedi: ' + err.message, 'error');
    }
  },

  async printLedger(contact, transactions) {
    const printArea = document.getElementById('ledger-print-area');
    if (!printArea) return;

    const companyName = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
    const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let allOrders = [];
    try {
      allOrders = await dbGetAll('orders');
    } catch (e) {
      console.warn('Orders could not be fetched for print:', e);
    }
    const ordersMap = {};
    allOrders.forEach(o => {
      ordersMap[o.id] = o;
    });

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;
    
    // Sort transactions by date ascending for chronological order in print
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    const symbols = { TRY: '₺', USD: '$', EUR: '€' };

    let balance = 0;
    const rows = [];

    for (const tx of sortedTxs) {
      const amount = Number(tx.amount) || 0;
      const curr = tx.currency || 'TRY';
      const txSymbol = symbols[curr] || '₺';
      
      let debit = 0;
      let credit = 0;
      
      if (tx.type === 'alacak' || tx.type === 'odeme') {
        debit = amount;
        totalDebit += amount;
      } else if (tx.type === 'tahsilat' || tx.type === 'borc') {
        credit = amount;
        totalCredit += amount;
      }

      balance += (debit - credit);

      const dateFormated = new Date(tx.date).toLocaleDateString('tr-TR');
      const debitStr = debit > 0 ? txSymbol + debit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
      const creditStr = credit > 0 ? txSymbol + credit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
      
      const balanceType = balance >= 0 ? '(B)' : '(A)';
      const balanceStr = txSymbol + Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + balanceType;

      const typeLabels = {
        alacak: 'Satış / Teslim Fişi',
        borc: 'Alış Fişi / Gider',
        tahsilat: 'Tahsilat',
        odeme: 'Ödeme'
      };
      const typeLabel = typeLabels[tx.type] || tx.type;
      const invoiceNo = tx.invoiceNo || '-';

      // Render main transaction row
      rows.push(`
        <tr style="border-bottom: 1px solid #cbd5e1; font-weight: 500;">
          <td style="padding: 8px 5px; text-align: left;">${dateFormated}</td>
          <td style="padding: 8px 5px; text-align: left; font-weight: bold; color: #1e293b;">${escapeHtml(invoiceNo)}</td>
          <td style="padding: 8px 5px; text-align: left; color: #475569;">${typeLabel}</td>
          <td style="padding: 8px 5px; text-align: left; color: #475569; max-width: 250px; word-wrap: break-word;">${this.escape(tx.description || '')}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: bold; color: #1e293b;">${debitStr}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: bold; color: #1e293b;">${creditStr}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: bold; color: #0f172a;">${balanceStr}</td>
        </tr>
      `);

      // Render details sub-table if there are items
      const txItems = this.resolveTxItems(tx, ordersMap);
      if (txItems && txItems.length > 0) {
        let totalQty = 0;
        let subtotal = 0;

        const detailRows = txItems.map(item => {
          const qty = Number(item.qty) || 0;
          const price = Number(item.price) || 0;
          const discount = Number(item.discount) || 0;
          const netPrice = price * (1 - discount / 100);
          const total = qty * netPrice;
          
          totalQty += qty;
          subtotal += total;

          return `
            <tr style="border-bottom: 1px dashed #cbd5e1;">
              <td style="padding: 4px;">${escapeHtml(item.stokCode || '-')}</td>
              <td style="padding: 4px;">${escapeHtml(item.name || '-')}</td>
              <td style="padding: 4px;">${escapeHtml(item.color || '-')}</td>
              <td style="padding: 4px; text-align: right; font-weight: bold; color: #1e293b;">${qty}</td>
              <td style="padding: 4px;">${escapeHtml(item.unit || 'Çift')}</td>
              <td style="padding: 4px; text-align: right;">${txSymbol}${price.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
              <td style="padding: 4px; text-align: right;">%${discount}</td>
              <td style="padding: 4px; text-align: right;">${txSymbol}${netPrice.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
              <td style="padding: 4px; text-align: right; font-weight: bold; color: #0f172a;">${txSymbol}${total.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</td>
            </tr>
          `;
        }).join('');

        const kdvRate = tx.kdvRate !== undefined ? tx.kdvRate : 10;
        const kdvAmount = subtotal * (kdvRate / 100);
        const grandTotal = subtotal + kdvAmount;

        rows.push(`
          <tr style="background: #f8fafc; font-size: 10px;">
            <td colspan="7" style="padding: 6px 15px; border-left: 3px solid #6366f1;">
              <table style="width: 100%; border-collapse: collapse; margin: 5px 0; color: #475569;">
                <thead>
                  <tr style="border-bottom: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; text-align: left;">
                    <th style="padding: 4px;">Stok</th>
                    <th style="padding: 4px;">Tanım</th>
                    <th style="padding: 4px;">Renk</th>
                    <th style="padding: 4px; text-align: right;">Miktar</th>
                    <th style="padding: 4px;">Birim</th>
                    <th style="padding: 4px; text-align: right;">Fiyat Kur</th>
                    <th style="padding: 4px; text-align: right;">İskonto</th>
                    <th style="padding: 4px; text-align: right;">Net Fiyat</th>
                    <th style="padding: 4px; text-align: right;">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  ${detailRows}
                </tbody>
              </table>
              <div style="display: flex; justify-content: flex-end; margin-top: 5px; font-size: 10px;">
                <div style="width: 180px; border-top: 1px solid #cbd5e1; padding-top: 4px; color: #475569;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Miktar Toplamı:</span>
                    <span style="font-weight: bold; color: #0f172a;">${totalQty}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Fiş Toplamı:</span>
                    <span style="font-weight: bold; color: #0f172a;">${txSymbol}${subtotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>KDV Toplamı (${kdvRate}%):</span>
                    <span style="font-weight: bold; color: #0f172a;">${txSymbol}${kdvAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: bold; color: #0284c7; margin-top: 3px; border-top: 1px dashed #cbd5e1; padding-top: 3px;">
                    <span>Genel Toplam:</span>
                    <span>${txSymbol}${grandTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `);
      }
    }

    const rowHtml = rows.join('');

    const netBalance = totalDebit - totalCredit;
    const netBalanceType = netBalance >= 0 ? 'Borçlu (B)' : 'Alacaklı (A)';
    const netBalanceStr = '₺' + Math.abs(netBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' (' + netBalanceType + ')';

    // Inject A5 Portrait @page CSS dynamically
    let pageStyle = document.getElementById('dynamic-print-page-style');
    if (!pageStyle) {
      pageStyle = document.createElement('style');
      pageStyle.id = 'dynamic-print-page-style';
      document.head.appendChild(pageStyle);
    }
    pageStyle.innerHTML = '@page { size: A5 portrait !important; margin: 6mm 8mm !important; }';

    printArea.innerHTML = `
      <div style="width: 100%; box-sizing: border-box; background: #fff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <h2 style="font-weight: 800; font-size: 1.3rem; color: #0f172a; margin: 0 0 3px 0; letter-spacing: -0.02em;">${this.escape(companyName)}</h2>
            <p style="font-size: 11px; color: #475569; margin: 0; font-weight: 500;">Ayakkabı İmalat & Toptan Satış Cari Ekstresi</p>
          </div>
          <div style="text-align: right;">
            <h1 style="font-weight: 800; font-size: 1.3rem; color: #0284c7; margin: 0 0 3px 0; letter-spacing: 0.02em;">HESAP EKSTRESİ</h1>
            <p style="font-size: 11px; margin: 0; color: #64748b;"><strong>Tarih:</strong> ${dateStr}</p>
          </div>
        </div>

        <!-- Customer Section -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 4px; border: 1px solid #cbd5e1; margin-bottom: 14px; font-size: 11.5px; color: #0f172a;">
          <div>
            <span style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Cari Müşteri / Firma:</span>
            <p style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin: 2px 0 0 0;">${this.escape(contact.name)}</p>
            <p style="margin: 2px 0 0 0; color: #475569; font-size: 11px;"><strong>Tel:</strong> ${this.escape(contact.phone || 'Kayıtlı Değil')}</p>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Bakiye Durumu:</span>
            <p style="margin: 2px 0 0 0; font-size: 13.5px; font-weight: 800; color: ${netBalance >= 0 ? '#ef4444' : '#10b981'};">${netBalanceStr}</p>
            <p style="margin: 2px 0 0 0; color: #475569; font-size: 11px;"><strong>Para Birimi:</strong> TRY (₺)</p>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px;">
          <thead>
            <tr style="border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; text-align: left; font-weight: 700; background: #f1f5f9;">
              <th style="padding: 7px 4px; width: 14%; color: #0f172a;">Tarih</th>
              <th style="padding: 7px 4px; width: 14%; color: #0f172a;">Evrak No</th>
              <th style="padding: 7px 4px; width: 16%; color: #0f172a;">İşlem Türü</th>
              <th style="padding: 7px 4px; width: 26%; color: #0f172a;">Açıklama</th>
              <th style="padding: 7px 4px; width: 10%; text-align: right; color: #0f172a;">Borç</th>
              <th style="padding: 7px 4px; width: 10%; text-align: right; color: #0f172a;">Alacak</th>
              <th style="padding: 7px 4px; width: 10%; text-align: right; color: #0f172a;">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${rowHtml}
          </tbody>
        </table>

        <!-- Summary & Balance -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
          <div style="width: 270px; font-size: 11.5px; background: #f8fafc; padding: 10px 14px; border-radius: 4px; border: 1.5px solid #cbd5e1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #475569;">
              <span>Toplam Borç (Satış/Ödeme):</span>
              <span style="font-weight: 700; color: #0f172a;">₺${totalDebit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">
              <span>Toplam Alacak (Tahsilat/Alış):</span>
              <span style="font-weight: 700; color: #0f172a;">₺${totalCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 13px; color: ${netBalance >= 0 ? '#ef4444' : '#10b981'}; padding-top: 2px;">
              <span>Net Bakiye:</span>
              <span>${netBalanceStr}</span>
            </div>
          </div>
        </div>

        <!-- Footer / Signatures -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px; text-align: center; font-size: 11px;">
          <div style="border-top: 1px dashed #94a3b8; padding-top: 8px; margin: 0 15px;">
            <p style="font-weight: 700; margin: 0 0 3px 0; color: #0f172a;">Düzenleyen Yetkili</p>
            <p style="color: #64748b; margin: 0; font-size: 10px;">${this.escape(companyName)}</p>
          </div>
          <div style="border-top: 1px dashed #94a3b8; padding-top: 8px; margin: 0 15px;">
            <p style="font-weight: 700; margin: 0 0 3px 0; color: #0f172a;">Teslim Alan / Cari</p>
            <p style="color: #64748b; margin: 0; font-size: 10px;">${this.escape(contact.name)}</p>
          </div>
        </div>
      </div>
    `;

    document.body.classList.add('printing-ledger');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-ledger');
    }, 300);
  },

  async deleteTransaction(txId, contactId) {
    if (!confirm('Bu işlem kaydını silmek istediğinizden emin misiniz?')) return;
    try {
      await dbDelete('transactions', txId);
      showToast('İşlem kaydı silindi.', 'info');
      await this.openLedgerModal(contactId);
      await this.loadContacts();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  shareLedgerOnWhatsApp(contact, standardTx, netBalance) {
    const today = new Date().toLocaleDateString('tr-TR');
    
    // Group totals by currency
    const currencyTotals = {};
    standardTx.forEach(tx => {
      const curr = tx.currency || 'TRY';
      if (!currencyTotals[curr]) {
        currencyTotals[curr] = { debit: 0, credit: 0 };
      }
      let debit = 0;
      let credit = 0;
      if (tx.type === 'alacak') debit = tx.amount;
      else if (tx.type === 'tahsilat') credit = tx.amount;
      else if (tx.type === 'borc') credit = tx.amount;
      else if (tx.type === 'odeme') debit = tx.amount;
      
      currencyTotals[curr].debit += debit;
      currencyTotals[curr].credit += credit;
    });

    const symbols = { TRY: '₺', USD: '$', EUR: '€' };

    const debitParts = [];
    const creditParts = [];
    const netParts = [];

    for (const [code, val] of Object.entries(currencyTotals)) {
      const sym = symbols[code] || code;
      const net = val.debit - val.credit;
      
      if (val.debit > 0) debitParts.push(`${sym}${val.debit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
      if (val.credit > 0) creditParts.push(`${sym}${val.credit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
      if (net !== 0) {
        let suffix = net > 0 ? ' Alacaklıyız (Borcunuz)' : ' Borçluyuz (Alacağınız)';
        netParts.push(`${sym}${Math.abs(net).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${suffix}`);
      }
    }

    const debitText = debitParts.length > 0 ? debitParts.join(' | ') : '₺0,00';
    const creditText = creditParts.length > 0 ? creditParts.join(' | ') : '₺0,00';
    const balanceText = netParts.length > 0 ? netParts.join(' | ') : '₺0,00 (Hesap Dengede)';

    // Build last 5 transactions summary
    const recentTx = standardTx.slice(-5).map(tx => {
      const txDate = new Date(tx.date).toLocaleDateString('tr-TR');
      const sym = symbols[tx.currency || 'TRY'] || '₺';
      let typeLabel = '';
      if (tx.type === 'alacak') typeLabel = 'Mal Satışı 📦';
      else if (tx.type === 'tahsilat') typeLabel = 'Tahsilat 💵';
      else if (tx.type === 'borc') typeLabel = 'Mal Alışı 📥';
      else if (tx.type === 'odeme') typeLabel = 'Ödeme 💳';

      const desc = tx.description ? ` (${tx.description})` : '';
      return `• ${txDate} | ${typeLabel}${desc}: ${sym}${tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }).join('\n');

    const msg = `*📂 CARİ HESAP EKSTRESİ — ${contact.name.toUpperCase()}*
----------------------------------------
*Tarih:* ${today}

*📊 HESAP ÖZETİ*
• Toplam Borçlandırılan: ${debitText}
• Toplam Ödenen/Tahsil Edilen: ${creditText}
• *Net Bakiye:* *${balanceText}*

${recentTx ? `*📝 SON 5 İŞLEM HAREKETİ*\n${recentTx}\n` : ''}
----------------------------------------
_Atölyecim ERP ile oluşturulmuştur._`;

    if (window.WhatsAppManager) {
      window.WhatsAppManager.openForContact(contact.id, msg);
      return;
    }

    let cleanPhone = (contact.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 10) {
      formattedPhone = '90' + cleanPhone;
    }

    const waUrl = formattedPhone 
      ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  },

  exportLedgerToCSV(contactName, standardTx, packagingTx) {
    if ((standardTx || []).length === 0 && (packagingTx || []).length === 0) {
      showToast('Dışa aktarılacak işlem kaydı bulunamadı!', 'error');
      return;
    }

    let csvContent = "\uFEFF";
    csvContent += `"${contactName.toUpperCase()} CARİ EKSTRESİ"\n\n`;

    const symbols = { TRY: '₺', USD: '$', EUR: '€' };

    if (standardTx && standardTx.length > 0) {
      csvContent += "HESAP EKSTRESİ HAREKETLERİ\n";
      csvContent += "TARİH;AÇIKLAMA;DÖVİZ;BORÇLU;ALACAKLI;BAKİYE BORÇLU;BAKİYE ALACAKLI\n";
      
      const cumulativeBalances = { TRY: 0, USD: 0, EUR: 0 };
      standardTx.forEach(tx => {
        const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
        const desc = csvSafe(tx.description || '-');
        const curr = tx.currency || 'TRY';
        
        let debit = 0;
        let credit = 0;

        if (tx.type === 'alacak') debit = tx.amount;
        else if (tx.type === 'tahsilat') credit = tx.amount;
        else if (tx.type === 'borc') credit = tx.amount;
        else if (tx.type === 'odeme') debit = tx.amount;

        if (!cumulativeBalances[curr]) cumulativeBalances[curr] = 0;
        cumulativeBalances[curr] += (debit - credit);
        const balanceForThisRow = cumulativeBalances[curr];

        const debitStr = debit > 0 ? debit.toFixed(2) : '';
        const creditStr = credit > 0 ? credit.toFixed(2) : '';

        let bakiyeBorcStr = '';
        let bakiyeAlacakStr = '';

        if (balanceForThisRow > 0) {
          bakiyeBorcStr = balanceForThisRow.toFixed(2);
        } else if (balanceForThisRow < 0) {
          bakiyeAlacakStr = Math.abs(balanceForThisRow).toFixed(2);
        }

        csvContent += `${dateStr};${desc};${curr};${debitStr};${creditStr};${bakiyeBorcStr};${bakiyeAlacakStr}\n`;
      });
      csvContent += "\n";
    }

    if (packagingTx && packagingTx.length > 0) {
      csvContent += "KUTU & KOLİ TAKİP DETAYLARI\n";
      csvContent += "TARİH;AÇIKLAMA;DÖVİZ;BORÇLU\n";
      
      packagingTx.forEach(tx => {
        const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
        const desc = csvSafe(tx.description || '-');
        const curr = tx.currency || 'TRY';
        const amountStr = tx.amount.toFixed(2);
        csvContent += `${dateStr};${desc};${curr};${amountStr}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${contactName.replace(/\s+/g, '_')}_Ekstre_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.csv`;
    downloadBlob(blob, filename);
    showToast('Ekstre Excel dosyası başarıyla indirildi!', 'success');
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.Contacts = Contacts;

// --- PDF Import & Gemini Extraction Helpers ---

async function extractTextFromPDF(arrayBuffer) {
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

async function parseTransactionsWithGemini(pdfText) {
  // Priority: 1) User's own localStorage key, 2) Master key from Vite env var, 3) Local regex parser
  let apiKey = localStorage.getItem('gemini_api_key');
  if (apiKey) apiKey = apiKey.replace(/['"\[\]\s]/g, '');

  // Master key baked into the build by Vercel env var
  if (!apiKey) {
    const masterKey = import.meta.env.VITE_MASTER_GEMINI_KEY;
    if (masterKey) apiKey = masterKey.trim();
  }

  // If no key available, fall back to local smart parser
  if (!apiKey) {
    console.info('No Gemini API key found, using local parser.');
    return parseLocalTurkishStatement(pdfText);
  }

  try {
    const prompt = `Aşağıdaki metin bir cari hesabın ekstre/hesap dökümü PDF belgesinden çıkarılmıştır.
Her işlem satırını tespit et ve JSON olarak döndür.

AÇIKLAMA KURALLARI (çok önemli):
- description alanı maksimum 60 karakter olmalı
- Hesap numarası, IBAN, banka kodu, şube kodu, müşteri numarası GİRME
- Sadece işlemin ne olduğunu yaz: "Mal Alımı Faturası", "Nakit Tahsilat", "EFT Ödemesi", "Havale Geliri", "Borç Dekontu" gibi
- Tarih bilgisini açıklamaya tekrar yazma
- Anlamsız kod ve rakam dizilerini açıklamaya koyma

DİĞER KURALLAR:
- type: "alacak" (satış/gelir), "borc" (alış/fatura), "tahsilat" (müşteriden nakit/havale), "odeme" (tedarikçiye ödeme)
- currency: "TRY", "USD", "EUR" (belirtilmemişse TRY)
- date: YYYY-MM-DD formatı
- amount: sadece sayı (nokta ondalık ayraç)

Sadece JSON döndür:
{"transactions":[{"date":"2024-01-15","description":"Mal Alımı Faturası","amount":1500.00,"type":"borc","currency":"TRY"}]}

Ekstre metni:
${pdfText}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) {
      console.warn('Gemini API failed, falling back to local parser');
      return parseLocalTurkishStatement(pdfText);
    }

    const resData = await response.json();
    const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return parseLocalTurkishStatement(pdfText);

    try {
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      const txs = parsed.transactions || [];
      // Clean up descriptions - remove account numbers, IBANs, codes
      return txs.map(tx => ({
        ...tx,
        description: cleanDescription(tx.description || '')
      }));
    } catch (e) {
      return parseLocalTurkishStatement(pdfText);
    }
  } catch (err) {
    console.warn('Gemini call error, using local parser:', err);
    return parseLocalTurkishStatement(pdfText);
  }
}

function cleanDescription(desc) {
  return desc
    // Remove IBAN patterns: TR followed by 24 digits
    .replace(/TR\d{24}/gi, '')
    // Remove long digit sequences (account nos, ref codes > 6 digits)
    .replace(/\b\d{7,}\b/g, '')
    // Remove common bank/EFT codes in uppercase (e.g. "TRFM", "EFT", "GCD")
    .replace(/\b[A-Z]{2,6}\d+[A-Z0-9]*\b/g, '')
    // Remove slashes between codes
    .replace(/\/+/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
    // Truncate to 60 chars
    .substring(0, 60)
    .trim() || 'Ekstre İşlemi';
}

function parseLocalTurkishStatement(text) {
  const transactions = [];
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 3);

  // Turkish date pattern: DD.MM.YYYY or DD/MM/YYYY or YYYY-MM-DD
  const dateRegex = /(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{2}-\d{2})/;
  // Amount pattern: 1.234,56 or 1234,56 or 1234.56
  const amountRegex = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g;

  // Keywords for transaction type detection
  const debitKeywords    = ['borç', 'fatura', 'alış', 'mal alım', 'gider', 'ödeme', 'havale çıkış', 'eft çıkış'];
  const creditKeywords   = ['alacak', 'satış', 'mal satış', 'gelir', 'tahsilat', 'havale giriş', 'eft giriş', 'nakit giriş', 'virman'];
  const paymentKeywords  = ['ödeme', 'transfer', 'çıkış', 'virman çıkış'];
  const collectionKeywords = ['tahsilat', 'giriş', 'virman giriş', 'nakit'];

  // Currency detection
  const currencyMap = { '$': 'USD', '€': 'EUR', '₺': 'TRY', 'usd': 'USD', 'eur': 'EUR', 'try': 'TRY', 'tl': 'TRY', '£': 'GBP' };

  function detectCurrency(str) {
    const lower = str.toLowerCase();
    for (const [sym, cur] of Object.entries(currencyMap)) {
      if (lower.includes(sym)) return cur;
    }
    return 'TRY';
  }

  function detectType(desc) {
    const d = desc.toLowerCase();
    if (collectionKeywords.some(k => d.includes(k))) return 'tahsilat';
    if (paymentKeywords.some(k => d.includes(k))) return 'odeme';
    if (creditKeywords.some(k => d.includes(k))) return 'alacak';
    if (debitKeywords.some(k => d.includes(k))) return 'borc';
    return 'alacak'; // default
  }

  function parseDate(raw) {
    if (!raw) return new Date().toISOString().split('T')[0];
    // DD.MM.YYYY or DD/MM/YYYY
    const m1 = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m1) {
      const [, d, mo, y] = m1;
      const year = y.length === 2 ? '20' + y : y;
      return `${year}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    // YYYY-MM-DD
    const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return raw;
    return new Date().toISOString().split('T')[0];
  }

  function parseAmount(raw) {
    if (!raw) return 0;
    // 1.234,56 format (Turkish)
    if (raw.includes(',') && raw.includes('.')) {
      const lastComma = raw.lastIndexOf(',');
      const lastDot = raw.lastIndexOf('.');
      if (lastComma > lastDot) {
        // Turkish: 1.234,56
        return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        // English: 1,234.56
        return parseFloat(raw.replace(/,/g, '')) || 0;
      }
    }
    if (raw.includes(',')) return parseFloat(raw.replace(',', '.')) || 0;
    return parseFloat(raw) || 0;
  }

  // Try to parse line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    // Find all amounts in this line
    const amounts = [];
    let m;
    amountRegex.lastIndex = 0;
    while ((m = amountRegex.exec(line)) !== null) {
      const val = parseAmount(m[1]);
      if (val > 0) amounts.push({ raw: m[1], val, index: m.index });
    }
    if (amounts.length === 0) continue;

    const dateStr = parseDate(dateMatch[1]);
    const currency = detectCurrency(line);

    // Remove date and amounts from description
    let desc = line
      .replace(dateRegex, '')
      .replace(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g, '')
      .replace(/[₺$€£]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!desc || desc.length < 2) desc = 'Ekstre İşlemi';

    const type = detectType(desc);
    // Use last amount as primary (usually balance/net amount in statements)
    const amount = amounts[amounts.length - 1].val;

    transactions.push({ date: dateStr, description: desc, amount, type, currency });
  }

  // If no structured lines found, try a fallback block parser
  if (transactions.length === 0) {
    const fullText = lines.join(' ');
    amountRegex.lastIndex = 0;
    let fm;
    while ((fm = amountRegex.exec(fullText)) !== null) {
      const val = parseAmount(fm[1]);
      if (val > 0 && val > 10) {
        transactions.push({
          date: new Date().toISOString().split('T')[0],
          description: 'Ekstre Satırı (Manuel kontrol edin)',
          amount: val,
          type: 'alacak',
          currency: 'TRY'
        });
      }
    }
  }

  return transactions;
}

let parsedTransactions = []; // Holds current parsed items for review

function openPdfReviewModal(transactions) {
  parsedTransactions = transactions;
  
  const tbody = document.getElementById('pdf-import-review-tbody');
  if (!tbody) return;

  tbody.innerHTML = parsedTransactions.map((tx, idx) => `
    <tr class="pdf-row" data-index="${idx}">
      <td style="text-align:center;"><input type="checkbox" class="chk-pdf-row" data-index="${idx}" checked style="transform: scale(1.2); cursor: pointer;"></td>
      <td><input type="date" class="txt-pdf-date" value="${tx.date || new Date().toISOString().split('T')[0]}" style="background: #ffffff; border: 1px solid var(--border-input); border-radius: 4px; color: var(--text-primary); width:125px; padding: 4px 6px; font-size:12px;"></td>
      <td><input type="text" class="txt-pdf-desc" value="${escapeHtml(tx.description || 'Ekstre Satırı')}" style="background: #ffffff; border: 1px solid var(--border-input); border-radius: 4px; color: var(--text-primary); width:95%; padding: 4px 6px; font-size:12px;"></td>
      <td>
        <select class="sel-pdf-type" style="background: #ffffff; border: 1px solid var(--border-input); border-radius: 4px; color: var(--text-primary); width:100px; padding: 4px 6px; font-size:12px;">
          <option value="alacak" ${tx.type === 'alacak' ? 'selected' : ''}>Alacak</option>
          <option value="borc" ${tx.type === 'borc' ? 'selected' : ''}>Borç</option>
          <option value="tahsilat" ${tx.type === 'tahsilat' ? 'selected' : ''}>Tahsilat</option>
          <option value="odeme" ${tx.type === 'odeme' ? 'selected' : ''}>Ödeme</option>
        </select>
      </td>
      <td>
        <select class="sel-pdf-curr" style="background: #ffffff; border: 1px solid var(--border-input); border-radius: 4px; color: var(--text-primary); width:65px; padding: 4px 6px; font-size:12px;">
          <option value="TRY" ${tx.currency === 'TRY' ? 'selected' : ''}>TRY</option>
          <option value="USD" ${tx.currency === 'USD' ? 'selected' : ''}>USD</option>
          <option value="EUR" ${tx.currency === 'EUR' ? 'selected' : ''}>EUR</option>
        </select>
      </td>
      <td><input type="number" class="txt-pdf-amount" value="${tx.amount || 0}" step="0.01" style="background: #ffffff; border: 1px solid var(--border-input); border-radius: 4px; color: var(--text-primary); text-align:right; width:85px; padding: 4px 6px; font-size:12px; font-weight:700;"></td>
    </tr>
  `).join('');

  recalcPdfCount();

  // Listeners for checkbox selects
  tbody.querySelectorAll('.chk-pdf-row').forEach(chk => {
    chk.addEventListener('change', () => recalcPdfCount());
  });

  // Select all checkbox handler
  const chkAll = document.getElementById('chk-pdf-select-all');
  if (chkAll) {
    chkAll.checked = true;
    chkAll.onchange = () => {
      tbody.querySelectorAll('.chk-pdf-row').forEach(chk => {
        chk.checked = chkAll.checked;
      });
      recalcPdfCount();
    };
  }

  // Bind submit button
  const btnSubmit = document.getElementById('btn-pdf-import-submit');
  if (btnSubmit) {
    const newSubmitBtn = btnSubmit.cloneNode(true);
    btnSubmit.parentNode.replaceChild(newSubmitBtn, btnSubmit);
    newSubmitBtn.addEventListener('click', async () => {
      newSubmitBtn.disabled = true;
      newSubmitBtn.textContent = '⏳ Kaydediliyor...';
      try {
        const rows = tbody.querySelectorAll('.pdf-row');
        let saveCount = 0;

        for (const row of rows) {
          const idx = parseInt(row.getAttribute('data-index'));
          const isChecked = row.querySelector('.chk-pdf-row').checked;
          if (isChecked) {
            const date = row.querySelector('.txt-pdf-date').value;
            const description = row.querySelector('.txt-pdf-desc').value.trim();
            const type = row.querySelector('.sel-pdf-type').value;
            const currency = row.querySelector('.sel-pdf-curr').value;
            const amount = parseFloat(row.querySelector('.txt-pdf-amount').value) || 0;

            await dbAdd('transactions', {
              contactId: Contacts.currentLedgerContactId,
              date,
              description,
              type,
              currency,
              amount,
              isPackaging: false
            });
            saveCount++;
          }
        }

        showToast(`${saveCount} adet ekstre işlemi başarıyla cari hesaba kaydedildi! 🎉`, 'success');
        closeModalById('pdf-import-review-modal');
        
        // Refresh contacts list and ledger modal
        await Contacts.loadContacts();
        await Contacts.openLedgerModal(Contacts.currentLedgerContactId);
      } catch (err) {
        showToast('Hata: ' + err.message, 'error');
      } finally {
        newSubmitBtn.disabled = false;
        newSubmitBtn.textContent = 'Onayla ve Kaydet';
      }
    });
  }

  openModalById('pdf-import-review-modal');
}

function recalcPdfCount() {
  const tbody = document.getElementById('pdf-import-review-tbody');
  const lbl = document.getElementById('lbl-pdf-import-count');
  if (!tbody || !lbl) return;

  let count = 0;
  tbody.querySelectorAll('.chk-pdf-row').forEach(chk => {
    if (chk.checked) count++;
  });
  lbl.textContent = count;
}
