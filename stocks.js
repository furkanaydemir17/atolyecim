import { escapeHtml, bindOnce, trToAscii, safeAdd, safeSub, generateId } from './utils.js';

const Stocks = {
  currentType: 'sole', // sole, accessory, leather, raw
  editingId: null,

  async render(pageName) {
    // pageName is 'stock-sole', 'stock-accessory', etc.
    this.currentType = pageName.replace('stock-', '');
    this.bindEvents();
    await this.loadStocks();
  },

  bindEvents() {
    // Add stock buttons
    const addSoleBtn = document.getElementById('add-sole-btn');
    const addAccessoryBtn = document.getElementById('add-accessory-btn');
    const addLeatherBtn = document.getElementById('add-leather-btn');
    const addRawBtn = document.getElementById('add-raw-btn');

    if (addSoleBtn && !addSoleBtn._bound) {
      addSoleBtn._bound = true;
      addSoleBtn.addEventListener('click', () => this.openModal('sole'));
    }
    if (addAccessoryBtn && !addAccessoryBtn._bound) {
      addAccessoryBtn._bound = true;
      addAccessoryBtn.addEventListener('click', () => this.openModal('accessory'));
    }
    if (addLeatherBtn && !addLeatherBtn._bound) {
      addLeatherBtn._bound = true;
      addLeatherBtn.addEventListener('click', () => this.openModal('leather'));
    }
    if (addRawBtn && !addRawBtn._bound) {
      addRawBtn._bound = true;
      addRawBtn.addEventListener('click', () => this.openModal('raw'));
    }

    // Modal size row button
    const addSoleSizeBtn = document.getElementById('add-sole-size-row-btn');
    if (addSoleSizeBtn && !addSoleSizeBtn._bound) {
      addSoleSizeBtn._bound = true;
      addSoleSizeBtn.addEventListener('click', () => this.addSoleSizeRow());
    }

    // Bind Search Input for current stock type
    const searchInput = document.getElementById(`search-stock-${this.currentType}`);
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', () => {
        this.loadStocks();
      });
    }

    // Form submit
    const form = document.getElementById('stock-form');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveStock();
      });
    }
  },

  addSoleSizeRow(size = '', qty = '', color = '', limit = '') {
    const list = document.getElementById('sole-size-rows-list');
    if (!list) return;

    const rowId = 'sole-row-' + Math.random().toString(36).substr(2, 9);
    const html = `
      <div class="sole-size-row" id="${rowId}" style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px; width: 100%;">
        <input type="text" class="sole-size-input" placeholder="No" value="${escapeHtml(size)}" required style="flex: 1.1; min-width: 0; padding: 6px 8px; font-size: 0.85rem; background: var(--bg-input); border: 1px solid var(--border-input); border-radius: var(--radius-sm); color: var(--text-primary); outline: none;">
        <input type="number" class="sole-qty-input" placeholder="Adet" value="${qty}" required style="flex: 1.1; min-width: 0; padding: 6px 8px; font-size: 0.85rem; background: var(--bg-input); border: 1px solid var(--border-input); border-radius: var(--radius-sm); color: var(--text-primary); outline: none;">
        <input type="text" class="sole-color-input" placeholder="Renk" value="${escapeHtml(color)}" required style="flex: 1.3; min-width: 0; padding: 6px 8px; font-size: 0.85rem; background: var(--bg-input); border: 1px solid var(--border-input); border-radius: var(--radius-sm); color: var(--text-primary); outline: none;">
        <input type="number" class="sole-limit-input" placeholder="Limit" value="${limit}" required style="flex: 1.3; min-width: 0; padding: 6px 8px; font-size: 0.85rem; background: var(--bg-input); border: 1px solid var(--border-input); border-radius: var(--radius-sm); color: var(--text-primary); outline: none;">
        <button type="button" class="btn-icon danger remove-sole-size-row-btn" onclick="document.getElementById('${rowId}').remove()" style="padding: 4px; font-size: 1.1rem; border: none; background: transparent; cursor: pointer; color: var(--color-danger); line-height: 1; flex-shrink: 0;">&times;</button>
      </div>
    `;
    list.insertAdjacentHTML('beforeend', html);
  },

  async loadStocks() {
    const type = this.currentType;
    let stocks = await dbGetByIndex('stocks', 'type', type);

    const searchInputId = `search-stock-${type}`;
    const searchVal = document.getElementById(searchInputId)?.value?.toLowerCase().trim() || '';
    if (searchVal) {
      stocks = stocks.filter(s => 
        (s.name || '').toLowerCase().includes(searchVal) ||
        (s.code || '').toLowerCase().includes(searchVal) ||
        (s.color || '').toLowerCase().includes(searchVal) ||
        (s.size || '').toLowerCase().includes(searchVal) ||
        (s.supplier || '').toLowerCase().includes(searchVal)
      );
    }

    const tbody = document.getElementById(`stock-${type}-tbody`);
    const emptyState = document.getElementById(`stock-${type}-empty`);
    const table = document.getElementById(`stock-${type}-table`);

    if (!tbody) return;

    if (stocks.length === 0) {
      if (table) table.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (table) table.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    // Special grouping layout for soles
    if (type === 'sole') {
      const grouped = {};
      stocks.forEach(s => {
        if (!grouped[s.name]) {
          grouped[s.name] = {
            name: s.name,
            totalQty: 0,
            items: []
          };
        }
        grouped[s.name].totalQty = safeAdd(grouped[s.name].totalQty, Number(s.qty || 0));
        grouped[s.name].items.push(s);
      });

      tbody.innerHTML = Object.keys(grouped).map(name => {
        const group = grouped[name];
        const safeName = trToAscii(name).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const detailRowId = `sole-detail-${safeName}`;
        const arrowId = `sole-arrow-${safeName}`;

        const itemsHtml = group.items.map(s => {
          const isCritical = Number(s.qty || 0) <= Number(s.limit || 0);
          const qtyStyle = isCritical ? 'color: var(--color-danger); font-weight:700;' : 'color: var(--color-success); font-weight:700;';
          return `
            <li style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: var(--radius-sm); font-size: 0.88rem; margin-bottom: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
              <span>• <strong style="color: #0f172a;">${escapeHtml(s.size || '-')} Beden</strong> — <span style="${qtyStyle}">${s.qty} Çift</span> — Renk: <span style="font-weight: 600; color: #334155;">${escapeHtml(s.color || '-')}</span> <span style="color: var(--text-muted); font-size: 0.8rem;">(Kritik Limit: ${s.limit || 0} Çift)</span></span>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn-icon info" title="Düzenle" onclick="Stocks.openModal('sole', ${s.id})" style="padding: 2px 4px; font-size: 11px; cursor:pointer;">✏️</button>
                <button type="button" class="btn-icon danger" title="Sil" onclick="Stocks.deleteStock(${s.id})" style="padding: 2px 4px; font-size: 11px; cursor:pointer;">🗑️</button>
              </div>
            </li>
          `;
        }).join('');

        return `
          <tr style="cursor: pointer;" onclick="Stocks.toggleRow('${name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
            <td style="text-align: center; width: 40px;">
              <span id="${arrowId}" style="display: inline-block; transition: transform 0.2s;">▶</span>
            </td>
            <td><strong>${escapeHtml(group.name)}</strong></td>
            <td><strong>${group.totalQty} Çift</strong></td>
            <td>
              <div class="actions-cell" onclick="event.stopPropagation();">
                <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Detaylar için tıklayın</span>
              </div>
            </td>
          </tr>
          <tr id="${detailRowId}" style="display: none; background: #f8fafc;">
            <td colspan="4" style="padding: 10px 20px;">
              <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px;">
                ${itemsHtml}
              </ul>
            </td>
          </tr>
        `;
      }).join('');
      return;
    }

    tbody.innerHTML = stocks.map(s => {
      const isCritical = s.qty <= (s.limit || 0);
      const qtyClass = isCritical ? 'money-negative' : 'money-positive';
      const qtyStyle = isCritical ? 'color: var(--color-danger); font-weight: 600;' : 'color: var(--color-success);';

      let rowHtml = '';

      if (type === 'accessory') {
        rowHtml = `
          <tr>
            <td><strong>${this.escape(s.name)}</strong></td>
            <td class="${qtyClass}" style="${qtyStyle}">${s.qty} ${this.escape(s.unit || 'Adet')}</td>
            <td>${s.limit || 0} ${this.escape(s.unit || 'Adet')}</td>
            <td>${this.escape(s.supplier || s.location || '-')}</td>
        `;
      } else if (type === 'leather') {
        rowHtml = `
          <tr>
            <td><strong>${this.escape(s.name)}</strong></td>
            <td>${this.escape(s.color || '-')}</td>
            <td class="${qtyClass}" style="${qtyStyle}">${s.qty} ${this.escape(s.unit || 'm²')}</td>
            <td>${this.escape(s.size || '-')}</td>
            <td>${s.limit || 0} ${this.escape(s.unit || 'm²')}</td>
        `;
      } else { // raw
        rowHtml = `
          <tr>
            <td><strong>${this.escape(s.name)}</strong></td>
            <td class="${qtyClass}" style="${qtyStyle}">${s.qty} ${this.escape(s.unit || 'Litre')}</td>
            <td>${this.escape(s.unit || 'Litre')}</td>
            <td>${s.limit || 0} ${this.escape(s.unit || 'Litre')}</td>
            <td>${this.escape(s.location || '-')}</td>
        `;
      }

      rowHtml += `
            <td>
              <div class="actions-cell">
                <button class="btn-icon info" title="Düzenle" onclick="Stocks.openModal('${type}', ${s.id})">✏️</button>
                <button class="btn-icon danger" title="Sil" onclick="Stocks.deleteStock(${s.id})">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      return rowHtml;
    }).join('');
  },

  toggleRow(name) {
    const safeName = trToAscii(name).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const el = document.getElementById(`sole-detail-${safeName}`);
    const arrow = document.getElementById(`sole-arrow-${safeName}`);
    if (el) {
      const isHidden = el.style.display === 'none';
      el.style.display = isHidden ? 'table-row' : 'none';
      if (arrow) {
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    }
  },

  configureModal(type, isEdit = false) {
    const title = document.getElementById('stock-modal-title');
    const sizeGroup = document.querySelector('.val-size-group');
    const sizeLabel = sizeGroup?.querySelector('label');
    const sizeInput = sizeGroup?.querySelector('input');
    const colorGroup = document.querySelector('.val-color-group');
    const extraGroup = document.querySelector('.val-extra-group');
    const extraLabel = document.getElementById('stock-extra-label');
    const extraInput = document.getElementById('stock-extra');
    const unitSelect = document.getElementById('stock-unit');

    const dynamicRow1 = document.getElementById('stock-dynamic-row-1');
    const qtyInput = document.getElementById('stock-qty');
    const qtyGroup = qtyInput ? qtyInput.closest('.form-group') : null;
    const limitInput = document.getElementById('stock-limit');
    const limitGroup = limitInput ? limitInput.closest('.form-group') : null;
    const multiSizeContainer = document.getElementById('sole-multi-size-container');

    // Reset default displays & required attributes
    if (qtyInput) qtyInput.required = true;
    if (limitInput) limitInput.required = true;
    if (sizeGroup) sizeGroup.style.display = 'block';
    if (colorGroup) colorGroup.style.display = 'block';
    if (extraGroup) extraGroup.style.display = 'block';
    if (dynamicRow1) dynamicRow1.style.display = 'flex';
    if (qtyGroup) qtyGroup.style.display = 'block';
    if (limitGroup) limitGroup.style.display = 'block';
    if (multiSizeContainer) multiSizeContainer.style.display = 'none';
    if (unitSelect) unitSelect.disabled = false;

    const typeTitles = {
      sole: 'Taban',
      accessory: 'Aksesuar',
      leather: 'Deri',
      raw: 'Ham Madde'
    };

    title.textContent = `${typeTitles[type]} ${isEdit ? 'Düzenle' : 'Ekle'}`;
    document.getElementById('stock-type-field').value = type;

    if (type === 'sole') {
      // Sole always hides Depo Rafı (shelf location)
      if (extraGroup) extraGroup.style.display = 'none';
      if (unitSelect) {
        unitSelect.value = 'Çift';
        unitSelect.disabled = true;
      }

      if (!isEdit) {
        // Hides single size/qty inputs for bulk size input
        if (dynamicRow1) dynamicRow1.style.display = 'none';
        if (qtyGroup) qtyGroup.style.display = 'none';
        if (limitGroup) limitGroup.style.display = 'none';
        if (qtyInput) qtyInput.required = false;
        if (limitInput) limitInput.required = false;
        if (multiSizeContainer) {
          multiSizeContainer.style.display = 'block';
          const list = document.getElementById('sole-size-rows-list');
          if (list) {
            list.innerHTML = '';
            this.addSoleSizeRow('', '', '', '');
          }
        }
      } else {
        // Edit mode works like standard single size edit
        if (sizeLabel && sizeInput) {
          sizeLabel.textContent = 'Beden';
          sizeInput.placeholder = '';
        }
      }
    } else if (type === 'accessory') {
      if (sizeGroup) sizeGroup.style.display = 'none';
      if (colorGroup) colorGroup.style.display = 'none';
      if (extraLabel && extraInput) {
        extraLabel.textContent = 'Tedarikçi';
        extraInput.placeholder = '';
      }
      if (unitSelect) {
        unitSelect.value = 'Adet';
        unitSelect.disabled = true;
      }
    } else if (type === 'leather') {
      if (sizeLabel && sizeInput) {
        sizeLabel.textContent = 'Kalite Sınıfı';
        sizeInput.placeholder = '';
      }
      if (extraGroup) extraGroup.style.display = 'none';
      if (unitSelect) {
        unitSelect.value = 'm²';
        unitSelect.disabled = true;
      }
    } else if (type === 'raw') {
      if (sizeGroup) sizeGroup.style.display = 'none';
      if (colorGroup) colorGroup.style.display = 'none';
      if (extraLabel && extraInput) {
        extraLabel.textContent = 'Depo Alanı';
        extraInput.placeholder = '';
      }
    }
  },

  openModal(type, id = null) {
    this.editingId = id;
    const form = document.getElementById('stock-form');
    if (form) form.reset();

    const unitSelect = document.getElementById('stock-unit');
    if (unitSelect) unitSelect.disabled = false;

    this.configureModal(type, !!id);

    if (id) {
      dbGet('stocks', id).then(s => {
        if (s) {
          document.getElementById('stock-id').value = s.id;
          document.getElementById('stock-name').value = s.name;
          document.getElementById('stock-qty').value = s.qty;
          document.getElementById('stock-limit').value = s.limit || 0;
          if (unitSelect) unitSelect.value = s.unit || 'Çift';

          if (type === 'sole') {
            const sizeInput = document.getElementById('stock-size');
            const colorInput = document.getElementById('stock-color');
            if (sizeInput) sizeInput.value = s.size || '';
            if (colorInput) colorInput.value = s.color || '';
          } else if (type === 'accessory') {
            const extraInput = document.getElementById('stock-extra');
            if (extraInput) extraInput.value = s.supplier || '';
          } else if (type === 'leather') {
            const sizeInput = document.getElementById('stock-size');
            const colorInput = document.getElementById('stock-color');
            if (sizeInput) sizeInput.value = s.size || '';
            if (colorInput) colorInput.value = s.color || '';
          } else if (type === 'raw') {
            const extraInput = document.getElementById('stock-extra');
            if (extraInput) extraInput.value = s.location || '';
          }
        }
      });
    } else {
      document.getElementById('stock-id').value = '';
    }

    openModalById('stock-modal');
  },

  async saveStock() {
    const id = document.getElementById('stock-id').value;
    const type = document.getElementById('stock-type-field').value;
    const unitSelect = document.getElementById('stock-unit');

    // Multi size sole add handler
    if (type === 'sole' && !id) {
      const name = document.getElementById('stock-name').value.trim();
      if (!name) {
        showToast('Taban modeli adı zorunludur!', 'error');
        return;
      }

      const rows = document.querySelectorAll('#sole-size-rows-list .sole-size-row');
      if (rows.length === 0) {
        showToast('En az bir numara/beden eklemelisiniz!', 'error');
        return;
      }

      const itemsToSave = [];
      let validationError = false;

      rows.forEach(row => {
        const size = row.querySelector('.sole-size-input').value.trim();
        const qty = parseFloat(row.querySelector('.sole-qty-input').value) || 0;
        const color = row.querySelector('.sole-color-input').value.trim();
        const limit = parseFloat(row.querySelector('.sole-limit-input').value) || 0;

        if (!size || !color) {
          showToast('Beden ve Renk alanları zorunludur!', 'error');
          validationError = true;
          return;
        }

        if (qty < 0 || limit < 0) {
          showToast('Miktar ve Kritik Limit negatif olamaz!', 'error');
          validationError = true;
          return;
        }

        itemsToSave.push({
          type: 'sole',
          name: name,
          size: size,
          qty: qty,
          color: color,
          limit: limit,
          unit: 'Çift',
          location: '' // Shelf removed
        });
      });

      if (validationError) return;

      try {
        for (const item of itemsToSave) {
          await dbAdd('stocks', item);
        }
        showToast('Taban stokları başarıyla eklendi!', 'success');
        closeModalById('stock-modal');
        await this.loadStocks();
        if (window.Dashboard && typeof window.Dashboard.render === 'function') {
          await window.Dashboard.render();
        }
      } catch (err) {
        showToast('Hata: ' + err.message, 'error');
      }
      return;
    }

    // Standard single-item handler
    const data = {
      type: type,
      name: document.getElementById('stock-name').value.trim(),
      qty: parseFloat(document.getElementById('stock-qty').value) || 0,
      limit: parseFloat(document.getElementById('stock-limit').value) || 0,
      unit: unitSelect.value
    };

    if (!data.name) {
      showToast('Stok adı zorunludur!', 'error');
      return;
    }

    if (data.qty < 0 || data.limit < 0) {
      showToast('Stok miktarı veya kritik limit negatif olamaz!', 'error');
      return;
    }

    if (type === 'sole') {
      const sizeInput = document.getElementById('stock-size');
      const colorInput = document.getElementById('stock-color');
      data.size = sizeInput ? sizeInput.value.trim() : '';
      data.color = colorInput ? colorInput.value.trim() : '';
      data.location = ''; // Shelf removed
    } else if (type === 'accessory') {
      const extraInput = document.getElementById('stock-extra');
      data.supplier = extraInput ? extraInput.value.trim() : '';
    } else if (type === 'leather') {
      const sizeInput = document.getElementById('stock-size');
      const colorInput = document.getElementById('stock-color');
      data.size = sizeInput ? sizeInput.value.trim() : '';
      data.color = colorInput ? colorInput.value.trim() : '';
    } else if (type === 'raw') {
      const extraInput = document.getElementById('stock-extra');
      data.location = extraInput ? extraInput.value.trim() : '';
    }

    try {
      if (id) {
        data.id = parseInt(id);
        await dbUpdate('stocks', data);
        showToast('Stok kaydı güncellendi!', 'success');
      } else {
        await dbAdd('stocks', data);
        showToast('Stok kaydı başarıyla eklendi!', 'success');
      }

      closeModalById('stock-modal');
      await this.loadStocks();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  async deleteStock(id) {
    try {
      const recipes = await dbGetAll('recipes');
      const isUsed = recipes.some(r => r.materials && r.materials.some(m => m.stockId === id));
      if (isUsed) {
        if (!confirm('Dikkat! Bu stok kalemi bazı ürün reçetelerinde (BOM) kullanılmaktadır. Yine de silmek istediğinizden emin misiniz?')) {
          return;
        }
      } else {
        if (!confirm('Bu stok kaydını silmek istediğinizden emin misiniz?')) return;
      }

      await dbDelete('stocks', id);
      showToast('Stok kaydı silindi.', 'info');
      await this.loadStocks();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (err) {
      showToast('Silme hatası: ' + err.message, 'error');
    }
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.Stocks = Stocks;
export default Stocks;
