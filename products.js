/* =========================================
   ATÖLYECİM — Ürünler Modülü
   ========================================= */

const Products = {
  currentFilter: 'all',
  editingId: null,

  async render() {
    this.bindEvents();
    await this.loadProducts();
  },

  bindEvents() {
    // Add product buttons
    const addBtn = document.getElementById('add-product-btn');
    const addEmptyBtn = document.getElementById('add-product-empty-btn');
    if (addBtn && !addBtn._bound) {
      addBtn._bound = true;
      addBtn.addEventListener('click', () => this.openModal());
    }
    if (addEmptyBtn && !addEmptyBtn._bound) {
      addEmptyBtn._bound = true;
      addEmptyBtn.addEventListener('click', () => this.openModal());
    }

    // Product form
    const form = document.getElementById('product-form');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }

    // Filters
    const filterBar = document.getElementById('product-filters');
    if (filterBar && !filterBar._bound) {
      filterBar._bound = true;
      filterBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
          filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.currentFilter = e.target.dataset.filter;
          this.loadProducts();
        }
      });
    }
  },

  async loadProducts() {
    let products = await dbGetAll('products');

    if (this.currentFilter !== 'all') {
      products = products.filter(p => p.category === this.currentFilter);
    }

    const tbody = document.getElementById('products-tbody');
    const emptyState = document.getElementById('products-empty');
    const table = document.getElementById('products-table');

    if (products.length === 0) {
      if (table) table.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (table) table.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = products.map(p => {
      const categoryClass = p.category === 'Erkek' ? 'badge-erkek' : p.category === 'Kadın' ? 'badge-kadin' : 'badge-cocuk';
      const stageLabels = { kesim: '✂️ Kesim', saya: '🪡 Saya', montaj: '🔨 Montaj', paketleme: '📦 Paketleme' };
      const stageClass = 'stage-' + p.stage;
      return `
        <tr>
          <td><strong>${this.escape(p.modelName)}</strong></td>
          <td><span class="category-badge ${categoryClass}">${p.category}</span></td>
          <td>${this.escape(p.size || '-')}</td>
          <td>${this.escape(p.color || '-')}</td>
          <td>₺${Number(p.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td>${p.quantity}</td>
          <td><span class="stage-badge ${stageClass}">${stageLabels[p.stage] || p.stage}</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon info" title="Düzenle" onclick="Products.openModal(${p.id})">✏️</button>
              <button class="btn-icon danger" title="Sil" onclick="Products.deleteProduct(${p.id})">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openModal(id = null) {
    this.editingId = id;
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');

    form.reset();
    document.getElementById('product-id').value = '';

    if (id) {
      title.textContent = 'Ürünü Düzenle';
      dbGet('products', id).then(p => {
        if (p) {
          document.getElementById('product-id').value = p.id;
          document.getElementById('product-name').value = p.modelName;
          document.getElementById('product-category').value = p.category;
          document.getElementById('product-size').value = p.size || '';
          document.getElementById('product-color').value = p.color || '';
          document.getElementById('product-price').value = p.price;
          document.getElementById('product-quantity').value = p.quantity;
          document.getElementById('product-stage').value = p.stage || 'kesim';
        }
      });
    } else {
      title.textContent = 'Yeni Ürün Ekle';
    }

    openModalById('product-modal');
  },

  async saveProduct() {
    const id = document.getElementById('product-id').value;
    const data = {
      modelName: document.getElementById('product-name').value.trim(),
      category: document.getElementById('product-category').value,
      size: document.getElementById('product-size').value.trim(),
      color: document.getElementById('product-color').value.trim(),
      price: parseFloat(document.getElementById('product-price').value) || 0,
      quantity: parseInt(document.getElementById('product-quantity').value) || 0,
      stage: document.getElementById('product-stage').value
    };

    if (!data.modelName || !data.category) {
      showToast('Model adı ve kategori zorunludur!', 'error');
      return;
    }

    try {
      if (id) {
        data.id = parseInt(id);
        await dbUpdate('products', data);
        showToast('Ürün güncellendi!', 'success');
      } else {
        await dbAdd('products', data);
        showToast('Ürün başarıyla eklendi!', 'success');
      }

      closeModalById('product-modal');
      await this.loadProducts();
      await Dashboard.render();
    } catch (err) {
      showToast('Bir hata oluştu: ' + err.message, 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;

    try {
      await dbDelete('products', id);
      showToast('Ürün silindi.', 'info');
      await this.loadProducts();
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
