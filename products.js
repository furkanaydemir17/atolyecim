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

    // Manuel Taban Ekle butonu toggle dinleyicisi
    const toggleSoleBtn = document.getElementById('btn-toggle-manual-sole');
    if (toggleSoleBtn && !toggleSoleBtn._bound) {
      toggleSoleBtn._bound = true;
      toggleSoleBtn.addEventListener('click', () => {
        const container = document.getElementById('product-sole-container');
        const input = document.getElementById('product-sole-material');
        if (container) {
          const isHidden = container.style.display === 'none' || !container.style.display;
          container.style.display = isHidden ? 'flex' : 'none';
          toggleSoleBtn.textContent = isHidden ? '✕ Tabanı Gizle' : '👟 + Taban Ekle';
          if (isHidden && input) input.focus();
        }
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

    // Search Input
    const searchInput = document.getElementById('search-products');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', () => {
        this.loadProducts();
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

    const searchVal = document.getElementById('search-products')?.value?.toLowerCase().trim() || '';
    if (searchVal) {
      products = products.filter(p => 
        (p.modelCode || '').toLowerCase().includes(searchVal) ||
        (p.color || '').toLowerCase().includes(searchVal) ||
        (p.soleMaterial || '').toLowerCase().includes(searchVal) ||
        (p.barcode || '').toLowerCase().includes(searchVal) ||
        (p.leatherUpper || '').toLowerCase().includes(searchVal) ||
        (p.leatherLining || '').toLowerCase().includes(searchVal)
      );
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

    if (table) table.style.display = '';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = products.map(p => {
      const modelPhotoHtml = p.photo 
        ? `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
             <img class="table-thumbnail" src="${p.photo}" alt="Model" onclick="window.Products.showImageZoom('${p.photo}')" style="cursor:zoom-in;">
             <button type="button" class="btn btn-sm btn-ghost" onclick="window.Products.promptChangePhoto(${p.id}, 'photo')" title="Model Fotoğrafını Değiştir" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-card); color: var(--text-accent); display: flex; align-items: center; gap: 2px; background: rgba(99,102,241,0.08); cursor: pointer; white-space: nowrap;">
               📷 Değiştir
             </button>
           </div>`
        : `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
             <div class="table-thumbnail-placeholder" onclick="window.Products.promptChangePhoto(${p.id}, 'photo')" style="cursor:pointer;" title="Fotoğraf Ekle">👟</div>
             <button type="button" class="btn btn-sm btn-ghost" onclick="window.Products.promptChangePhoto(${p.id}, 'photo')" title="Fotoğraf Ekle" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.25); color: var(--color-success); display: flex; align-items: center; gap: 2px; background: rgba(16,185,129,0.08); cursor: pointer; white-space: nowrap;">
               + Foto Ekle
             </button>
           </div>`;

      const accPhotoHtml = p.accessoryPhoto 
        ? `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
             <img class="table-thumbnail" src="${p.accessoryPhoto}" alt="Aksesuar" onclick="window.Products.showImageZoom('${p.accessoryPhoto}')" style="cursor:zoom-in;">
             <button type="button" class="btn btn-sm btn-ghost" onclick="window.Products.promptChangePhoto(${p.id}, 'accessoryPhoto')" title="Aksesuar Fotoğrafını Değiştir" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-card); color: var(--text-accent); display: flex; align-items: center; gap: 2px; background: rgba(99,102,241,0.08); cursor: pointer; white-space: nowrap;">
               📷 Değiştir
             </button>
           </div>`
        : `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
             <div class="table-thumbnail-placeholder" onclick="window.Products.promptChangePhoto(${p.id}, 'accessoryPhoto')" style="cursor:pointer;" title="Aksesuar Fotoğrafı Ekle">📸</div>
             <button type="button" class="btn btn-sm btn-ghost" onclick="window.Products.promptChangePhoto(${p.id}, 'accessoryPhoto')" title="Aksesuar Ekle" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-card); color: var(--text-muted); display: flex; align-items: center; gap: 2px; background: rgba(255,255,255,0.03); cursor: pointer; white-space: nowrap;">
               + Ekle
             </button>
           </div>`;

      // Leather sub-elements display
      const leatherParts = [];
      if (p.leatherLining) leatherParts.push(`Astar: ${p.leatherLining}`);
      if (p.leatherUpper) leatherParts.push(`Yüz: ${p.leatherUpper}`);
      if (p.leatherType) leatherParts.push(`Tür: ${p.leatherType}`);
      const leatherText = leatherParts.length > 0 ? leatherParts.join(' / ') : '-';

      return `
        <tr class="ledger-row-item">
          <td data-label="Fotoğraf">${modelPhotoHtml}</td>
          <td data-label="Model Kodu">
            <strong style="color: #0f172a; font-size: 13.5px;">${this.escape(p.modelCode || 'KODSUZ')}</strong>
            ${p.barcode ? `<div class="barcode-subtext" style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">📟 ${this.escape(p.barcode)}</div>` : ''}
          </td>
          <td data-label="Renk">${this.escape(p.color || '-')}</td>
          <td data-label="Taban"><span style="background: rgba(99,102,241,0.06); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${this.escape(p.soleMaterial || '-')}</span></td>
          <td data-label="Deri (Astar / Yüz / Tür)" style="font-size: 0.85rem; max-width: 220px;" title="${this.escape(leatherText)}">${this.escape(leatherText)}</td>
          <td data-label="Aksesuar">${accPhotoHtml}</td>
          <td data-label="İşlemler">
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

    const soleInput = document.getElementById('product-sole-material');

    if (id) {
      title.textContent = 'Model Düzenle ✏️';

      dbGet('products', id).then(p => {
        if (p) {
          document.getElementById('product-id').value = p.id;
          document.getElementById('product-code').value = p.modelCode || '';
          
          const colorEl = document.getElementById('product-color');
          if (colorEl) colorEl.value = p.color || '';
          
          if (soleInput) soleInput.value = p.soleMaterial || '';

          document.getElementById('product-leather-lining').value = p.leatherLining || '';
          document.getElementById('product-leather-upper').value = p.leatherUpper || '';
          document.getElementById('product-leather-type').value = p.leatherType || '';
          
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
      title.textContent = 'Yeni Model Ekle 👟';
      if (soleInput) soleInput.value = '';
    }

    openModalById('product-modal');
  },

  async saveProduct() {
    const idEl = document.getElementById('product-id');
    const id = idEl ? idEl.value : '';
    
    const photoPreview = document.getElementById('product-photo-preview-box');
    const accPhotoPreview = document.getElementById('product-accessory-photo-preview-box');
    
    const photo = photoPreview ? (photoPreview.dataset.base64 || '') : '';
    const accessoryPhoto = accPhotoPreview ? (accPhotoPreview.dataset.base64 || '') : '';

    const modelCodeEl = document.getElementById('product-code');
    const modelCode = modelCodeEl ? modelCodeEl.value.trim() : '';
    const colorEl = document.getElementById('product-color');
    const color = colorEl ? colorEl.value.trim() : '';
    const soleInput = document.getElementById('product-sole-material');
    const soleMaterial = soleInput ? soleInput.value.trim() : '';

    const leatherLiningEl = document.getElementById('product-leather-lining');
    const leatherLining = leatherLiningEl ? leatherLiningEl.value.trim() : '';
    const leatherUpperEl = document.getElementById('product-leather-upper');
    const leatherUpper = leatherUpperEl ? leatherUpperEl.value.trim() : '';
    const leatherTypeEl = document.getElementById('product-leather-type');
    const leatherType = leatherTypeEl ? leatherTypeEl.value.trim() : '';
    const barcodeEl = document.getElementById('product-barcode');
    const barcode = barcodeEl ? barcodeEl.value.trim() : '';

    if (!modelCode) {
      showToast('Lütfen model kodunu girin!', 'error');
      return;
    }

    const data = {
      modelCode,
      category: 'Ayakkabı',
      size: '',
      color,
      soleMaterial,
      leatherLining,
      leatherUpper,
      leatherType,
      price: 0,
      currency: 'TRY',
      barcode,
      photo,
      accessoryPhoto
    };

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
        showToast('Model başarıyla güncellendi! ✅', 'success');
      } else {
        await dbAdd('products', data);
        showToast('Yeni model başarıyla eklendi! 👟', 'success');
      }

      closeModalById('product-modal');
      await this.loadProducts();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      console.error('saveProduct error:', err);
      showToast('Bir hata oluştu: ' + err.message, 'error');
    }
  },

  async deleteProduct(id) {
    try {
      const allOrders = await dbGetAll('orders');
      const linkedOrders = allOrders.filter(o => o.productId === id || (o.colors && o.colors.some(c => c.productId === id)));
      
      let confirmMsg = 'Bu modeli silmek istediğinizden emin misiniz?';
      if (linkedOrders.length > 0) {
        confirmMsg = `Bu modelle ilişkili ${linkedOrders.length} adet sipariş kaydı bulunmaktadır.\n\nModeli katalogdan silmek mevcut siparişlerinizi ve iş takip fişlerinizi ETKİLEMEZ (siparişleriniz korunur).\n\nBu modeli ürün kataloğunuzdan silmek istediğinize emin misiniz?`;
      }

      if (!confirm(confirmMsg)) return;

      // Reçeteyi sil
      const recipes = await dbGetAll('recipes');
      const linkedRecipe = recipes.find(r => r.productId === id);
      if (linkedRecipe) {
        await dbDelete('recipes', linkedRecipe.productId);
      }

      await dbDelete('products', id);
      showToast('Model katalogdan başarıyla silindi.', 'info');
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

  async promptChangePhoto(productId, photoType = 'photo') {
    const product = await dbGet('products', productId);
    if (!product) {
      showToast('Ürün bulunamadı!', 'error');
      return;
    }

    // Geçici dinamik dosya seçici oluştur
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        if (fileInput.parentNode) document.body.removeChild(fileInput);
        return;
      }

      showToast('Fotoğraf işleniyor ve yükleniyor...', 'info');
      try {
        const base64 = await this.resizeAndBase64(file);
        if (photoType === 'accessoryPhoto') {
          product.accessoryPhoto = base64;
        } else {
          product.photo = base64;
        }

        await dbUpdate('products', product);
        showToast('Fotoğraf başarıyla güncellendi! 📸', 'success');
        await this.loadProducts();
      } catch (err) {
        console.error(err);
        showToast('Fotoğraf güncellenirken hata oluştu: ' + err.message, 'error');
      } finally {
        if (fileInput.parentNode) {
          document.body.removeChild(fileInput);
        }
      }
    };

    fileInput.click();
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.Products = Products;
