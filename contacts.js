/* =========================================
   ATÖLYECİM — Cari Hesaplar Modülü
   ========================================= */

const Contacts = {
  currentFilter: 'all',

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
      contacts = contacts.filter(c => c.type === this.currentFilter);
    }

    // Calculate balances from transactions
    const balances = {};
    contacts.forEach(c => { balances[c.id] = { receivable: 0, payable: 0 }; });

    transactions.forEach(tx => {
      if (!balances[tx.contactId]) return;
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
      const typeLabel = c.type === 'musteri' ? 'Müşteri' : 'Tedarikçi';
      const typeClass = c.type === 'musteri' ? 'badge-musteri' : 'badge-tedarikci';
      const netClass = net > 0 ? 'money-positive' : net < 0 ? 'money-negative' : 'money-neutral';

      return `
        <tr>
          <td><strong>${this.escape(c.name)}</strong></td>
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
      await Dashboard.render();
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  openTransactionModal(contactId) {
    const form = document.getElementById('transaction-form');
    form.reset();
    document.getElementById('tx-contact-id').value = contactId;

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
    const data = {
      contactId: contactId,
      type: document.getElementById('tx-type').value,
      amount: parseFloat(document.getElementById('tx-amount').value) || 0,
      description: document.getElementById('tx-description').value.trim(),
      date: new Date().toISOString()
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
      await Dashboard.render();
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  async deleteContact(id) {
    if (!confirm('Bu cari hesabı ve tüm işlem geçmişini silmek istediğinizden emin misiniz?')) return;

    try {
      // Delete related transactions
      const transactions = await dbGetByIndex('transactions', 'contactId', id);
      for (const tx of transactions) {
        await dbDelete('transactions', tx.id);
      }

      await dbDelete('contacts', id);
      showToast('Cari hesap silindi.', 'info');
      await this.loadContacts();
      await Dashboard.render();
    } catch (err) {
      showToast('Silme hatası: ' + err.message, 'error');
    }
  },

  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
