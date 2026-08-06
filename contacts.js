import { escapeHtml, bindOnce, safeAdd, safeSub, generateId, csvSafe, downloadBlob } from './utils.js';


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
  },

  async loadContacts() {
    let contacts = await dbGetAll('contacts');
    const transactions = await dbGetAll('transactions');

    if (this.currentFilter !== 'all') {
      contacts = contacts.filter(c => c.type === this.currentFilter || c.type === 'ikisi');
    }

    // Calculate balances from transactions
    const balances = {};
    contacts.forEach(c => { balances[c.id] = { receivable: 0, payable: 0 }; });

    transactions.forEach(tx => {
      if (!balances[tx.contactId]) return;
      if (tx.isPackaging) return; // Y8 Düzeltme: Paketleme işlemleri cari bakiyesini etkilemez
      if (tx.type === 'alacak') balances[tx.contactId].receivable += tx.amount;
      else if (tx.type === 'borc') balances[tx.contactId].payable += tx.amount;
      else if (tx.type === 'tahsilat') balances[tx.contactId].receivable -= tx.amount;
      else if (tx.type === 'odeme') balances[tx.contactId].payable -= tx.amount;
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

    tbody.innerHTML = contacts.map(c => {
      const bal = balances[c.id] || { receivable: 0, payable: 0 };
      const net = bal.receivable - bal.payable;
      const typeLabel = c.type === 'musteri' ? 'Müşteri' : c.type === 'tedarikci' ? 'Tedarikçi' : 'Müşteri + Tedarikçi';
      const typeClass = c.type === 'musteri' ? 'badge-musteri' : c.type === 'tedarikci' ? 'badge-tedarikci' : 'badge-ikisi';
      const netClass = net > 0 ? 'money-positive' : net < 0 ? 'money-negative' : 'money-neutral';

      return `
        <tr>
          <td style="cursor: pointer; color: var(--color-primary);" onclick="Contacts.openLedgerModal(${c.id})" title="Cari Ekstreyi Görüntüle">
            <strong>📁 ${this.escape(c.name)}</strong>
          </td>
          <td><span class="category-badge ${typeClass}">${typeLabel}</span></td>
          <td>${this.escape(c.phone || '-')}</td>
          <td class="money-positive">₺${bal.receivable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td class="money-negative">₺${bal.payable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td class="${netClass}">₺${net.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
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

    if (id) {
      title.textContent = 'Cari Düzenle';
      dbGet('contacts', id).then(c => {
        if (c) {
          document.getElementById('contact-id').value = c.id;
          document.getElementById('contact-name').value = c.name;
          document.getElementById('contact-type').value = c.type;
          document.getElementById('contact-phone').value = c.phone || '';
          document.getElementById('contact-address').value = c.address || '';
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
      address: document.getElementById('contact-address').value.trim()
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

  openTransactionModal(contactId) {
    const form = document.getElementById('transaction-form');
    form.reset();
    document.getElementById('tx-contact-id').value = contactId;
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('tx-is-packaging').checked = false;

    // Get contact name for title
    dbGet('contacts', contactId).then(c => {
      if (c) {
        document.getElementById('transaction-modal-title').textContent = c.name + ' — İşlem Ekle';
      }
    });

    openModalById('transaction-modal');
  },

  async saveTransaction() {
    const contactId = parseInt(document.getElementById('tx-contact-id').value);
    const dateInput = document.getElementById('tx-date').value;
    const data = {
      contactId: contactId,
      type: document.getElementById('tx-type').value,
      amount: parseFloat(document.getElementById('tx-amount').value) || 0,
      description: document.getElementById('tx-description').value.trim(),
      date: dateInput ? new Date(dateInput).toISOString() : new Date().toISOString(),
      isPackaging: document.getElementById('tx-is-packaging').checked
    };

    if (!data.amount || data.amount <= 0) {
      showToast('Geçerli bir tutar giriniz!', 'error');
      return;
    }

    try {
      await dbAdd('transactions', data);
      const typeLabels = { alacak: 'Alacak', borc: 'Borç', tahsilat: 'Tahsilat', odeme: 'Ödeme' };
      showToast(`${typeLabels[data.type]} kaydı eklendi!`, 'success');

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

      const transactions = await dbGetByIndex('transactions', 'contactId', contactId);
      
      // Split standard and packaging transactions
      const standardTx = transactions.filter(tx => !tx.isPackaging);
      const packagingTx = transactions.filter(tx => tx.isPackaging);

      // Sort both by date ascending (oldest first)
      standardTx.sort((a, b) => new Date(a.date) - new Date(b.date));
      packagingTx.sort((a, b) => new Date(a.date) - new Date(b.date));

      document.getElementById('contact-ledger-title').textContent = `${contact.name.toUpperCase()} CARİ EKSTRESİ`;

      // Calculate totals
      let totalReceivable = 0;
      let totalPayable = 0;

      // We calculate overall totals from standard transactions
      standardTx.forEach(tx => {
        if (tx.type === 'alacak') totalReceivable += tx.amount;
        else if (tx.type === 'borc') totalPayable += tx.amount;
        else if (tx.type === 'tahsilat') totalReceivable -= tx.amount;
        else if (tx.type === 'odeme') totalPayable -= tx.amount;
      });

      const netBalance = totalReceivable - totalPayable;

      document.getElementById('ledger-receivable').textContent = `₺${totalReceivable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
      document.getElementById('ledger-payable').textContent = `₺${totalPayable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
      
      const netEl = document.getElementById('ledger-net');
      netEl.textContent = `₺${Math.abs(netBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
      if (netBalance > 0) {
        netEl.textContent += ' (Alacaklıyız)';
        netEl.style.color = 'var(--color-success)';
      } else if (netBalance < 0) {
        netEl.textContent += ' (Borçluyuz)';
        netEl.style.color = 'var(--color-danger)';
      } else {
        netEl.textContent += ' (Dengede)';
        netEl.style.color = 'var(--color-info)';
      }

      // Populate Standard Ledger Table
      const tbody = document.getElementById('ledger-tbody');
      const emptyState = document.getElementById('ledger-empty');

      if (standardTx.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
      } else {
        emptyState.style.display = 'none';
        
        let cumulativeBalance = 0;
        const totalRows = standardTx.length;

        tbody.innerHTML = standardTx.map((tx, idx) => {
          const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
          
          let debit = 0;  // Borçlu
          let credit = 0; // Alacaklı

          if (tx.type === 'alacak') {
            debit = tx.amount;
          } else if (tx.type === 'tahsilat') {
            credit = tx.amount;
          } else if (tx.type === 'borc') {
            credit = tx.amount; // Supplier credit
          } else if (tx.type === 'odeme') {
            debit = tx.amount;  // Supplier debit
          }

          cumulativeBalance += (debit - credit);

          const debitStr = debit > 0 ? `₺${debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '';
          const creditStr = credit > 0 ? `₺${credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '';

          let bakiyeBorcStr = '';
          let bakiyeAlacakStr = '';
          let cellStyleClass = '';

          if (cumulativeBalance > 0) {
            bakiyeBorcStr = `₺${cumulativeBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
            if (idx === totalRows - 1) {
              cellStyleClass = 'final-debit-cell';
            }
          } else if (cumulativeBalance < 0) {
            bakiyeAlacakStr = `₺${Math.abs(cumulativeBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
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
              <td style="text-align: center;">
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
          return `
            <tr>
              <td>${dateStr}</td>
              <td style="font-weight: 500;">${this.escape(tx.description || '-')}</td>
              <td style="text-align: right; font-weight: 700; color: var(--text-primary);">₺${tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              <td style="text-align: center;">
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
    
    // Calculate total standard debit/credit
    let totalDebit = 0;  // What they owe us
    let totalCredit = 0; // What they paid us / we owe them
    
    standardTx.forEach(tx => {
      let debit = 0;
      let credit = 0;
      if (tx.type === 'alacak') debit = tx.amount;
      else if (tx.type === 'tahsilat') credit = tx.amount;
      else if (tx.type === 'borc') credit = tx.amount;
      else if (tx.type === 'odeme') debit = tx.amount;
      
      totalDebit += debit;
      totalCredit += credit;
    });

    let balanceText = '';
    if (netBalance > 0) {
      balanceText = `₺${netBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} Alacaklıyız (Borcunuz)`;
    } else if (netBalance < 0) {
      balanceText = `₺${Math.abs(netBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} Borçluyuz (Alacağınız)`;
    } else {
      balanceText = '₺0,00 (Hesap Dengede)';
    }

    // Build last 5 transactions summary
    const recentTx = standardTx.slice(-5).map(tx => {
      const txDate = new Date(tx.date).toLocaleDateString('tr-TR');
      let typeLabel = '';
      if (tx.type === 'alacak') typeLabel = 'Mal Satışı 📦';
      else if (tx.type === 'tahsilat') typeLabel = 'Tahsilat 💵';
      else if (tx.type === 'borc') typeLabel = 'Mal Alışı 📥';
      else if (tx.type === 'odeme') typeLabel = 'Ödeme 💳';

      const desc = tx.description ? ` (${tx.description})` : '';
      return `• ${txDate} | ${typeLabel}${desc}: ₺${tx.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
    }).join('\n');

    const msg = `*📂 CARİ HESAP EKSTRESİ — ${contact.name.toUpperCase()}*
----------------------------------------
*Tarih:* ${today}

*📊 HESAP ÖZETİ*
• Toplam Borçlandırılan: ₺${totalDebit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
• Toplam Ödenen/Tahsil Edilen: ₺${totalCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
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
      // PC: Go directly to WhatsApp Web
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

    // UTF-8 BOM to ensure Turkish characters are correctly read by Excel
    let csvContent = "\uFEFF";
    
    // Title
    csvContent += `"${contactName.toUpperCase()} CARİ EKSTRESİ"\n\n`;

    if (standardTx && standardTx.length > 0) {
      csvContent += "HESAP EKSTRESİ HAREKETLERİ\n";
      csvContent += "TARİH;AÇIKLAMA;BORÇLU;ALACAKLI;BAKİYE BORÇLU;BAKİYE ALACAKLI\n";
      
      let cumulativeBalance = 0;
      standardTx.forEach(tx => {
        const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
        // Y9 Düzeltme: csvSafe ile tırnak/noktalı virgül kaçırma
        const desc = csvSafe(tx.description || '-');
        
        let debit = 0;
        let credit = 0;

        if (tx.type === 'alacak') debit = tx.amount;
        else if (tx.type === 'tahsilat') credit = tx.amount;
        else if (tx.type === 'borc') credit = tx.amount;
        else if (tx.type === 'odeme') debit = tx.amount;

        cumulativeBalance += (debit - credit);

        const debitStr = debit > 0 ? debit.toFixed(2) : '';
        const creditStr = credit > 0 ? credit.toFixed(2) : '';

        let bakiyeBorcStr = '';
        let bakiyeAlacakStr = '';

        if (cumulativeBalance > 0) {
          bakiyeBorcStr = cumulativeBalance.toFixed(2);
        } else if (cumulativeBalance < 0) {
          bakiyeAlacakStr = Math.abs(cumulativeBalance).toFixed(2);
        }

        csvContent += `${dateStr};${desc};${debitStr};${creditStr};${bakiyeBorcStr};${bakiyeAlacakStr}\n`;
      });
      csvContent += "\n";
    }

    if (packagingTx && packagingTx.length > 0) {
      csvContent += "KUTU & KOLİ TAKİP DETAYLARI\n";
      csvContent += "TARİH;AÇIKLAMA;BORÇLU\n";
      
      packagingTx.forEach(tx => {
        const dateStr = new Date(tx.date).toLocaleDateString('tr-TR');
        const desc = csvSafe(tx.description || '-');
        const amountStr = tx.amount.toFixed(2);
        csvContent += `${dateStr};${desc};${amountStr}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${contactName.replace(/\s+/g, '_')}_Ekstre_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.csv`;
    // O6 Düzeltme: downloadBlob bellek sızıntısını önler
    downloadBlob(blob, filename);
    showToast('Ekstre Excel dosyası başarıyla indirildi!', 'success');
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.Contacts = Contacts;
