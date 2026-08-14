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
        <tr>
          <td style="cursor: pointer; color: var(--color-primary);" onclick="Contacts.openLedgerModal(${c.id})" title="Cari Ekstreyi Görüntüle">
            <strong>📁 ${this.escape(c.name)}</strong>
          </td>
          <td><span class="category-badge ${typeClass}">${typeLabel}</span></td>
          <td>${this.escape(c.phone || '-')}</td>
          <td class="money-positive">${formatBalanceCol('receivable')}</td>
          <td class="money-negative">${formatBalanceCol('payable')}</td>
          <td class="${netClass}">${formatBalanceCol('net')}</td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon success" title="İşlem Ekle" onclick="Contacts.openTransactionModal(${c.id})">💰</button>
              <button class="btn-icon info" title="Düzenle" onclick="Contacts.openModal(${c.id})">✏️</button>
              <button class="btn-icon danger" title="Sil" onclick="Contacts.deleteContact(${c.id})">🗑️</button>
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
    const data = {
      contactId: contactId,
      type: document.getElementById('tx-type').value,
      amount: parseFloat(document.getElementById('tx-amount').value) || 0,
      currency: document.getElementById('tx-currency').value || 'TRY',
      description: document.getElementById('tx-description').value.trim(),
      date: dateInput ? new Date(dateInput).toISOString() : new Date().toISOString(),
      isPackaging: document.getElementById('tx-is-packaging').checked
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
        const typeLabels = { alacak: 'Alacak', borc: 'Borç', tahsilat: 'Tahsilat', odeme: 'Ödeme' };
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
          await dbDelete('orders', order.id);
        }
      } else {
        if (!confirm('Bu cari hesabı ve tüm işlem geçmişini silmek istediğinizden emin misiniz?')) return;
      }

      // Delete related transactions
      const transactions = await dbGetByIndex('transactions', 'contactId', id);
      for (const tx of transactions) {
        await dbDelete('transactions', tx.id);
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

          return `
            <tr ${isLastRow}>
              <td>${dateStr}</td>
              <td style="font-weight: 500;">${this.escape(tx.description || '-')}</td>
              <td style="text-align: right; font-weight: 600;">${debitStr}</td>
              <td style="text-align: right; font-weight: 600;">${creditStr}</td>
              <td class="${cellStyleClass}" style="text-align: right; font-weight: 700; color: #ef4444;">${bakiyeBorcStr}</td>
              <td class="${cellStyleClass}" style="text-align: right; font-weight: 700; color: #10b981;">${bakiyeAlacakStr}</td>
              <td style="text-align: center; white-space: nowrap;">
                <button class="btn-icon info" title="İşlemi Düzenle" onclick="Contacts.openTransactionModal(${contactId}, ${tx.id})">✏️</button>
                <button class="btn-icon danger" title="İşlemi Sil" onclick="Contacts.deleteTransaction(${tx.id}, ${contactId})">🗑️</button>
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
        printBtn.onclick = () => {
          this.printLedger(contact, standardTx);
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

  printLedger(contact, transactions) {
    const printArea = document.getElementById('ledger-print-area');
    if (!printArea) return;

    const companyName = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
    const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;
    
    // Sort transactions by date ascending for chronological order in print
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    let balance = 0;
    const rowHtml = sortedTxs.map(tx => {
      const amount = Number(tx.amount) || 0;
      
      let debit = 0;
      let credit = 0;
      
      if (tx.type === 'borc' || tx.type === 'odeme') {
        debit = amount;
        totalDebit += amount;
        balance -= amount;
      } else if (tx.type === 'alacak' || tx.type === 'tahsilat') {
        credit = amount;
        totalCredit += amount;
        balance += amount;
      }

      const dateFormated = new Date(tx.date).toLocaleDateString('tr-TR');
      const debitStr = debit > 0 ? '₺' + debit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-';
      const creditStr = credit > 0 ? '₺' + credit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-';
      
      const balanceType = balance >= 0 ? '(A)' : '(B)';
      const balanceStr = '₺' + Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + balanceType;

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 5px; text-align: left;">${dateFormated}</td>
          <td style="padding: 8px 5px; text-align: left; max-width: 300px; word-wrap: break-word;">${this.escape(tx.description || '')}</td>
          <td style="padding: 8px 5px; text-align: right;">${debitStr}</td>
          <td style="padding: 8px 5px; text-align: right;">${creditStr}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: 600;">${balanceStr}</td>
        </tr>
      `;
    }).join('');

    const netBalance = totalCredit - totalDebit;
    const netBalanceType = netBalance >= 0 ? 'Alacaklı' : 'Borçlu';
    const netBalanceStr = '₺' + Math.abs(netBalance).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' (' + netBalanceType + ')';

    printArea.innerHTML = `
      <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <h2 style="font-weight: 800; font-size: 1.4rem; color: #0f172a; margin: 0 0 6px 0;">${this.escape(companyName)}</h2>
            <p style="font-size: 11px; color: #475569; margin: 0;">Ayakkabı İmalat & Toptan Satış Cari Ekstresi</p>
          </div>
          <div style="text-align: right;">
            <h1 style="font-weight: 800; font-size: 1.5rem; color: #0284c7; margin: 0 0 6px 0;">HESAP EKSTRESİ</h1>
            <p style="font-size: 11px; margin: 0; color: #64748b;"><strong>Yazdırma Tarihi:</strong> ${dateStr}</p>
          </div>
        </div>

        <!-- Customer Section -->
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
          <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-weight: 700; text-transform: uppercase;">Müşteri / Cari Bilgileri</h3>
          <p style="font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">${this.escape(contact.name)}</p>
          <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Telefon:</strong> ${this.escape(contact.phone || 'Kayıtlı Değil')}</p>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 2px solid #0f172a; text-align: left; font-weight: 700; background: #f1f5f9;">
              <th style="padding: 8px 5px; width: 15%;">Tarih</th>
              <th style="padding: 8px 5px; width: 45%;">Açıklama</th>
              <th style="padding: 8px 5px; width: 13%; text-align: right;">Borç (Ödeme)</th>
              <th style="padding: 8px 5px; width: 13%; text-align: right;">Alacak (Satış)</th>
              <th style="padding: 8px 5px; width: 14%; text-align: right;">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${rowHtml}
          </tbody>
        </table>

        <!-- Summary & Balance -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
          <div style="width: 300px; font-size: 12px; background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #475569;">
              <span>Toplam Borç (Bizim):</span>
              <span>₺${totalDebit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              <span>Toplam Alacak (Müşteri):</span>
              <span>₺${totalCredit.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; color: #0f172a;">
              <span>Net Bakiye:</span>
              <span style="color: ${netBalance >= 0 ? '#10b981' : '#ef4444'};">${netBalanceStr}</span>
            </div>
          </div>
        </div>

        <!-- Signature Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; text-align: center; font-size: 11px;">
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin: 0 40px;">
            <p style="font-weight: 700; margin: 0 0 4px 0;">Yetkili İmza</p>
            <p style="color: #64748b; margin: 0;">${this.escape(companyName)}</p>
          </div>
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin: 0 40px;">
            <p style="font-weight: 700; margin: 0 0 4px 0;">Müşteri / Temsilci</p>
            <p style="color: #64748b; margin: 0;">İmza / Kaşe</p>
          </div>
        </div>
      </div>
    `;

    // Trigger Print Dialog
    document.body.classList.add('printing-ledger');
    window.print();
    document.body.classList.remove('printing-ledger');
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

    let cleanPhone = (contact.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    let formattedPhone = cleanPhone;
    if (cleanPhone.length === 10) {
      formattedPhone = '90' + cleanPhone;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    let waUrl = '';

    if (isMobile) {
      if (formattedPhone) {
        waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
      } else {
        waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      }
    } else {
      if (formattedPhone) {
        waUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`;
      } else {
        waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      }
    }
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
      <td><input type="date" class="txt-pdf-date" value="${tx.date || new Date().toISOString().split('T')[0]}" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-card); border-radius: 4px; color:#fff; width:125px; padding: 2px 4px; font-size:12px;"></td>
      <td><input type="text" class="txt-pdf-desc" value="${escapeHtml(tx.description || 'Ekstre Satırı')}" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-card); border-radius: 4px; color:#fff; width:95%; padding: 2px 4px; font-size:12px;"></td>
      <td>
        <select class="sel-pdf-type" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-card); border-radius: 4px; color:#fff; width:100px; padding: 2px; font-size:12px;">
          <option value="alacak" ${tx.type === 'alacak' ? 'selected' : ''}>Alacak</option>
          <option value="borc" ${tx.type === 'borc' ? 'selected' : ''}>Borç</option>
          <option value="tahsilat" ${tx.type === 'tahsilat' ? 'selected' : ''}>Tahsilat</option>
          <option value="odeme" ${tx.type === 'odeme' ? 'selected' : ''}>Ödeme</option>
        </select>
      </td>
      <td>
        <select class="sel-pdf-curr" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-card); border-radius: 4px; color:#fff; width:60px; padding: 2px; font-size:12px;">
          <option value="TRY" ${tx.currency === 'TRY' ? 'selected' : ''}>TRY</option>
          <option value="USD" ${tx.currency === 'USD' ? 'selected' : ''}>USD</option>
          <option value="EUR" ${tx.currency === 'EUR' ? 'selected' : ''}>EUR</option>
        </select>
      </td>
      <td><input type="number" class="txt-pdf-amount" value="${tx.amount || 0}" step="0.01" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-card); border-radius: 4px; color:#fff; text-align:right; width:80px; padding: 2px 4px; font-size:12px;"></td>
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
