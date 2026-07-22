import { escapeHtml, bindOnce, safeAdd, safeSub, generateId } from './utils.js';


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

    // File inputs preview binding
    const photoInput = document.getElementById('product-photo');
    if (photoInput && !photoInput._bound) {
      photoInput._bound = true;
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const previewBox = document.getElementById('product-photo-preview-box');
        if (file && previewBox) {
          this.resizeAndBase64(file).then(base64 => {
            previewBox.innerHTML = `<img src="${base64}" alt="Önizleme">`;
            previewBox.dataset.base64 = base64;
          }).catch(err => {
            console.error(err);
            showToast('Fotoğraf yükleme/sıkıştırma hatası!', 'error');
          });
        }
      });
    }

    const accPhotoInput = document.getElementById('product-accessory-photo');
    if (accPhotoInput && !accPhotoInput._bound) {
      accPhotoInput._bound = true;
      accPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const previewBox = document.getElementById('product-accessory-photo-preview-box');
        if (file && previewBox) {
          this.resizeAndBase64(file).then(base64 => {
            previewBox.innerHTML = `<img src="${base64}" alt="Önizleme">`;
            previewBox.dataset.base64 = base64;
          }).catch(err => {
            console.error(err);
            showToast('Aksesuar fotoğrafı yükleme/sıkıştırma hatası!', 'error');
          });
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

    if (!tbody) return;

    if (products.length === 0) {
      if (table) table.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (table) table.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = products.map(p => {
      // Badges mapping
      const catLower = (p.category || '').toLowerCase();
      let categoryClass = 'badge-ayakkabi';
      if (catLower.includes('sandalet')) categoryClass = 'badge-sandalet';
      else if (catLower.includes('terlik')) categoryClass = 'badge-terlik';
      else if (catLower.includes('babet')) categoryClass = 'badge-babet';
      else if (catLower.includes('ayakkabı')) categoryClass = 'badge-ayakkabi';
      else if (catLower.includes('espadril')) categoryClass = 'badge-espadril';
      else if (catLower.includes('bot')) categoryClass = 'badge-bot';

      const modelPhotoHtml = p.photo 
        ? `<img class="table-thumbnail" src="${p.photo}" alt="Model" onclick="window.Products.showImageZoom('${p.photo}')" style="cursor:zoom-in;">`
        : `<div class="table-thumbnail-placeholder">👟</div>`;

      const accPhotoHtml = p.accessoryPhoto 
        ? `<img class="table-thumbnail" src="${p.accessoryPhoto}" alt="Aksesuar" onclick="window.Products.showImageZoom('${p.accessoryPhoto}')" style="cursor:zoom-in;">`
        : `<div class="table-thumbnail-placeholder">📸</div>`;

      // Leather sub-elements display
      const leatherParts = [];
      if (p.leatherLining) leatherParts.push(`Astar: ${p.leatherLining}`);
      if (p.leatherUpper) leatherParts.push(`Yüz: ${p.leatherUpper}`);
      if (p.leatherType) leatherParts.push(`Tür: ${p.leatherType}`);
      const leatherText = leatherParts.length > 0 ? leatherParts.join(' / ') : '-';

      return `
        <tr>
          <td>${modelPhotoHtml}</td>
          <td>
            <strong>${this.escape(p.modelCode || 'KODSUZ')}</strong>
            ${p.barcode ? `<div class="barcode-subtext" style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">📟 ${this.escape(p.barcode)}</div>` : ''}
          </td>
          <td><span class="category-badge ${categoryClass}">${this.escape(p.category || '-')}</span></td>
          <td>${this.escape(p.size || '-')}</td>
          <td>${this.escape(p.color || '-')}</td>
          <td><span style="background: rgba(99,102,241,0.06); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${this.escape(p.soleMaterial || '-')}</span></td>
          <td style="font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escape(leatherText)}">${this.escape(leatherText)}</td>
          <td>${accPhotoHtml}</td>
          <td>₺${Number(p.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon warning" title="Reçete (BOM)" onclick="Recipes.openModal(${p.id})">🛠️</button>
              <button class="btn-icon info" title="Düzenle" onclick="Products.openModal(${p.id})">✏️</button>
              <button class="btn-icon danger" title="Sil" onclick="Products.deleteProduct(${p.id})">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openModal(id = null) {
    this.editingId = id;
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');

    form.reset();
    document.getElementById('product-id').value = '';
    
    // Clear preview boxes
    const photoPreview = document.getElementById('product-photo-preview-box');
    const accPhotoPreview = document.getElementById('product-accessory-photo-preview-box');
    
    if (photoPreview) {
      photoPreview.innerHTML = '<span class="placeholder">📸</span>';
      delete photoPreview.dataset.base64;
    }
    if (accPhotoPreview) {
      accPhotoPreview.innerHTML = '<span class="placeholder">📸</span>';
      delete accPhotoPreview.dataset.base64;
    }

    if (id) {
      title.textContent = 'Ürünü Düzenle';
      dbGet('products', id).then(p => {
        if (p) {
          document.getElementById('product-id').value = p.id;
          document.getElementById('product-code').value = p.modelCode || '';
          document.getElementById('product-category').value = p.category || '';
          
          const sizeEl = document.getElementById('product-size');
          if (sizeEl) sizeEl.value = p.size || '';
          
          const colorEl = document.getElementById('product-color');
          if (colorEl) colorEl.value = p.color || '';
          
          document.getElementById('product-sole-material').value = p.soleMaterial || '';
          document.getElementById('product-leather-lining').value = p.leatherLining || '';
          document.getElementById('product-leather-upper').value = p.leatherUpper || '';
          document.getElementById('product-leather-type').value = p.leatherType || '';
          document.getElementById('product-price').value = p.price || 0;
          
          const barcodeEl = document.getElementById('product-barcode');
          if (barcodeEl) barcodeEl.value = p.barcode || '';
          
          if (p.photo && photoPreview) {
            photoPreview.innerHTML = `<img src="${p.photo}" alt="Önizleme">`;
            photoPreview.dataset.base64 = p.photo;
          }
          if (p.accessoryPhoto && accPhotoPreview) {
            accPhotoPreview.innerHTML = `<img src="${p.accessoryPhoto}" alt="Önizleme">`;
            accPhotoPreview.dataset.base64 = p.accessoryPhoto;
          }
        }
      });
    } else {
      title.textContent = 'Yeni Ürün Ekle';
    }

    openModalById('product-modal');
  },

  async saveProduct() {
    const id = document.getElementById('product-id').value;
    
    const photoPreview = document.getElementById('product-photo-preview-box');
    const accPhotoPreview = document.getElementById('product-accessory-photo-preview-box');
    
    const photo = photoPreview ? photoPreview.dataset.base64 || '' : '';
    const accessoryPhoto = accPhotoPreview ? accPhotoPreview.dataset.base64 || '' : '';

    const sizeEl = document.getElementById('product-size');
    const colorEl = document.getElementById('product-color');
    const barcodeEl = document.getElementById('product-barcode');

    const data = {
      modelCode: document.getElementById('product-code').value.trim(),
      category: document.getElementById('product-category').value,
      size: sizeEl ? sizeEl.value.trim() : '',
      color: colorEl ? colorEl.value.trim() : '',
      soleMaterial: document.getElementById('product-sole-material').value,
      leatherLining: document.getElementById('product-leather-lining').value.trim(),
      leatherUpper: document.getElementById('product-leather-upper').value.trim(),
      leatherType: document.getElementById('product-leather-type').value.trim(),
      price: parseFloat(document.getElementById('product-price').value) || 0,
      barcode: barcodeEl ? barcodeEl.value.trim() : '',
      photo,
      accessoryPhoto
    };

    if (!data.modelCode || !data.category) {
      showToast('Model kodu ve kategori zorunludur!', 'error');
      return;
    }

    // O1 Düzeltme: Fiyat kontrolü
    if (data.price <= 0) {
      showToast('Ürün fiyatı sıfır veya negatif olamaz!', 'error');
      return;
    }

    // Y6 Düzeltme: Barkod benzersizlik kontrolü
    if (data.barcode) {
      const allProducts = await dbGetAll('products');
      const duplicate = allProducts.find(p => p.barcode === data.barcode && p.id !== (id ? parseInt(id) : null));
      if (duplicate) {
        showToast('Bu barkod başka bir üründe zaten kullanılıyor!', 'error');
        return;
      }
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
      if (window.Dashboard && typeof window.Dashboard.render === 'function') await window.Dashboard.render();
    } catch (err) {
      showToast('Bir hata oluştu: ' + err.message, 'error');
    }
  },

  async deleteProduct(id) {
    try {
      // K10 Düzeltme: Aktif sipariş kontrolü
      const allOrders = await dbGetAll('orders');
      const linkedOrders = allOrders.filter(o => o.productId === id || (o.colors && o.colors.some(c => c.productId === id)));
      if (linkedOrders.length > 0) {
        showToast(`Bu ürünün ${linkedOrders.length} aktif siparişi var. Önce siparişleri silin veya iptal edin.`, 'error');
        return;
      }

      if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) return;

      // Reçeteyi sil
      const recipes = await dbGetAll('recipes');
      const linkedRecipe = recipes.find(r => r.productId === id);
      if (linkedRecipe) {
        await dbDelete('recipes', linkedRecipe.productId);
      }

      await dbDelete('products', id);
      showToast('Ürün silindi.', 'info');
      await this.loadProducts();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      showToast('Silme hatası: ' + err.message, 'error');
    }
  },

  resizeAndBase64(file, maxW = 800, maxH = 800) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxW) {
              height *= maxW / width;
              width = maxW;
            }
          } else {
            if (height > maxH) {
              width *= maxH / height;
              height = maxH;
            }
          }
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          
          // Şeffaf PNG'ler için beyaz arka plan (siyah arkaplan olmasını önler)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  showImageZoom(base64) {
    let zoomModal = document.getElementById('image-zoom-modal');
    if (!zoomModal) {
      zoomModal = document.createElement('div');
      zoomModal.id = 'image-zoom-modal';
      zoomModal.style.position = 'fixed';
      zoomModal.style.inset = '0';
      zoomModal.style.background = 'rgba(0,0,0,0.85)';
      zoomModal.style.display = 'flex';
      zoomModal.style.alignItems = 'center';
      zoomModal.style.justifyContent = 'center';
      zoomModal.style.zIndex = '99999';
      zoomModal.style.cursor = 'zoom-out';
      zoomModal.addEventListener('click', () => {
        zoomModal.style.display = 'none';
      });
      document.body.appendChild(zoomModal);
    }
    // H5 Düzeltme: innerHTML yerine img elementi oluşturulup src güvenli şekilde atanıyor
    zoomModal.innerHTML = '';
    const img = document.createElement('img');
    img.src = base64;
    img.style.cssText = 'max-width:90%; max-height:90%; border-radius:8px; box-shadow: 0 4px 20px rgba(0,0,0,0.8); object-fit:contain;';
    zoomModal.appendChild(img);
    zoomModal.style.display = 'flex';
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.Products = Products;
