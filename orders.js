import { escapeHtml, bindOnce, trToAscii, safeAdd, safeSub, generateId } from './utils.js';

// Format any Turkish phone number to international format (905XXXXXXXXX)
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

function openWhatsAppPrompt(waUrl, titleText, bodyText) {
  // Detect if user is on mobile
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.25s ease;';

  const content = document.createElement('div');
  content.style.cssText = 'background:var(--bg-card,#1a1a2e);border:1px solid var(--border-card,#2a2a4a);border-radius:20px;padding:28px 24px;max-width:420px;width:92%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.5);transform:scale(0.9);transition:transform 0.25s ease;';

  // QR code via Google Charts API (free, no library needed)
  const qrCodeUrl = `https://chart.googleapis.com/chart?chs=220x220&cht=qr&chl=${encodeURIComponent(waUrl)}&choe=UTF-8`;

  if (isMobile) {
    // On mobile, just show a button that opens WhatsApp directly
    content.innerHTML = `
      <div style="font-size:40px;margin-bottom:12px;">💬</div>
      <h3 style="margin:0 0 8px;color:var(--text-primary,#fff);font-size:18px;">${titleText}</h3>
      <p style="color:var(--text-secondary,#aaa);font-size:13px;line-height:1.5;margin-bottom:22px;">${bodyText}</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button id="btn-wa-prompt-cancel" class="btn btn-ghost" style="padding:10px 22px;border-radius:10px;">Kapat</button>
        <a id="btn-wa-prompt-ok" href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding:10px 22px;background:#25D366;border-color:#25D366;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border-radius:10px;font-weight:600;">WhatsApp'tan Gönder 💬</a>
      </div>
    `;
  } else {
    // On desktop, show QR code so user can scan with phone
    content.innerHTML = `
      <div style="font-size:40px;margin-bottom:8px;">📱</div>
      <h3 style="margin:0 0 6px;color:var(--text-primary,#fff);font-size:18px;">${titleText}</h3>
      <p style="color:var(--text-secondary,#aaa);font-size:13px;line-height:1.5;margin-bottom:16px;">${bodyText}</p>
      <div style="background:#fff;border-radius:14px;padding:16px;display:inline-block;margin-bottom:16px;">
        <img src="${qrCodeUrl}" alt="WhatsApp QR Kod" width="200" height="200" style="display:block;border-radius:6px;" />
      </div>
      <p style="color:#25D366;font-size:12px;font-weight:600;margin:0 0 16px;">📷 Telefonunuzun kamerasıyla QR kodu okutun<br><span style="color:var(--text-secondary,#888);font-weight:400;">WhatsApp direkt telefonunuzda açılacak!</span></p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button id="btn-wa-prompt-cancel" class="btn btn-ghost" style="padding:10px 22px;border-radius:10px;">Kapat</button>
        <a id="btn-wa-prompt-ok" href="${waUrl}" target="_blank" rel="noopener noreferrer" style="padding:10px 18px;background:transparent;border:1px solid var(--border-card,#2a2a4a);color:var(--text-secondary,#aaa);text-decoration:none;display:inline-flex;align-items:center;gap:6px;border-radius:10px;font-size:12px;">veya WhatsApp Web'den Aç</a>
      </div>
    `;
  }

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    content.style.transform = 'scale(1)';
  });

  const close = () => {
    overlay.style.opacity = '0';
    content.style.transform = 'scale(0.9)';
    setTimeout(() => overlay.remove(), 250);
  };

  overlay.querySelector('#btn-wa-prompt-cancel').addEventListener('click', close);
  const okBtn = overlay.querySelector('#btn-wa-prompt-ok');
  if (okBtn) okBtn.addEventListener('click', () => setTimeout(close, 400));
}

const Orders = {
  editingId: null,
  colorGroupCounter: 0,

  async render() {
    this.bindEvents();
    await this.loadOrders();
  },

  bindEvents() {
    // B2B Order Tabs switching
    const tabActiveOrders = document.getElementById('btn-tab-active-orders');
    const tabIncomingOrders = document.getElementById('btn-tab-incoming-orders');
    const containerActive = document.getElementById('orders-active-container');
    const containerIncoming = document.getElementById('orders-incoming-container');

    if (tabActiveOrders && !tabActiveOrders._bound) {
      tabActiveOrders._bound = true;
      tabActiveOrders.addEventListener('click', () => {
        tabActiveOrders.classList.add('active');
        if (tabIncomingOrders) tabIncomingOrders.classList.remove('active');
        if (containerActive) containerActive.style.display = 'block';
        if (containerIncoming) containerIncoming.style.display = 'none';
        this.activeTab = 'active';
      });
    }

    if (tabIncomingOrders && !tabIncomingOrders._bound) {
      tabIncomingOrders._bound = true;
      tabIncomingOrders.addEventListener('click', () => {
        tabIncomingOrders.classList.add('active');
        if (tabActiveOrders) tabActiveOrders.classList.remove('active');
        if (containerActive) containerActive.style.display = 'none';
        if (containerIncoming) containerIncoming.style.display = 'block';
        this.activeTab = 'incoming';
      });
    }

    // Approve form submission
    const approveForm = document.getElementById('incoming-order-approve-form');
    if (approveForm && !approveForm._bound) {
      approveForm._bound = true;
      approveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitApproval();
      });
    }

    // Add order buttons
    const addBtn = document.getElementById('add-order-btn');
    const addEmptyBtn = document.getElementById('add-order-empty-btn');
    const emailImportBtn = document.getElementById('btn-email-import-modal');
    const quickOrderBtn = document.getElementById('btn-quick-order-modal');

    if (addBtn && !addBtn._bound) {
      addBtn._bound = true;
      addBtn.addEventListener('click', () => this.openModal());
    }
    if (addEmptyBtn && !addEmptyBtn._bound) {
      addEmptyBtn._bound = true;
      addEmptyBtn.addEventListener('click', () => this.openModal());
    }
    if (emailImportBtn && !emailImportBtn._bound) {
      emailImportBtn._bound = true;
      emailImportBtn.addEventListener('click', () => this.openEmailImportModal());
    }
    if (quickOrderBtn && !quickOrderBtn._bound) {
      quickOrderBtn._bound = true;
      quickOrderBtn.addEventListener('click', () => this.openQuickOrderModal());
    }

    // Search Input
    const searchInput = document.getElementById('search-orders');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', () => {
        this.loadOrders();
      });
    }

    // Order form submit
    const form = document.getElementById('order-form');
    if (form && !form._bound) {
      form._bound = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveOrder();
      });
    }

    // Model code input listener (manual type with suggestions)
    const modelCodeInput = document.getElementById('order-model-code');
    if (modelCodeInput && !modelCodeInput._bound) {
      modelCodeInput._bound = true;
      modelCodeInput.addEventListener('input', async (e) => {
        const mCode = e.target.value.trim();
        await this.updateAvailableColorsList(mCode);
      });
    }

    // Add color group button
    const addColorGroupBtn = document.getElementById('btn-order-add-color-group');
    if (addColorGroupBtn && !addColorGroupBtn._bound) {
      addColorGroupBtn._bound = true;
      addColorGroupBtn.addEventListener('click', () => {
        this.addColorGroup();
      });
    }

    // Event delegation for color groups container
    const groupsContainer = document.getElementById('order-color-groups-container');
    if (groupsContainer && !groupsContainer._bound) {
      groupsContainer._bound = true;
      groupsContainer.addEventListener('click', (e) => {
        // Remove entire color group
        if (e.target.classList.contains('btn-remove-color-group') || e.target.closest('.btn-remove-color-group')) {
          const group = e.target.closest('.color-group-card');
          if (group) {
            group.remove();
            this.recalcGrandTotal();
          }
        }
        // Add size row within a color group
        if (e.target.classList.contains('btn-add-size-row') || e.target.closest('.btn-add-size-row')) {
          const group = e.target.closest('.color-group-card');
          if (group) {
            this.addSizeRow(group);
          }
        }
        // Remove size row
        if (e.target.classList.contains('btn-remove-size-row') || e.target.closest('.btn-remove-size-row')) {
          const row = e.target.closest('.size-row');
          const group = e.target.closest('.color-group-card');
          if (row) {
            row.remove();
            if (group) this.recalcGroupTotal(group);
          }
        }
      });

      // Listen for input changes to recalculate totals
      groupsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('size-qty-input')) {
          const group = e.target.closest('.color-group-card');
          if (group) this.recalcGroupTotal(group);
        }
      });
    }
  },

  async updateAvailableColorsList(mCode) {
    let datalist = document.getElementById('order-colors-list');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'order-colors-list';
      document.body.appendChild(datalist);
    }
    
    if (!mCode) {
      datalist.innerHTML = '';
      return;
    }
    
    const products = await dbGetAll('products');
    const matches = products.filter(p => (p.modelCode || '').toLowerCase() === mCode.toLowerCase());
    
    datalist.innerHTML = matches.map(p => `<option value="${this.escape(p.color)}">`).join('');
    
    // Auto-fill price if price field is empty
    const priceInput = document.getElementById('order-price');
    if (priceInput && !priceInput.value && matches.length > 0) {
      priceInput.value = matches[0].price || 0;
    }
  },

  /**
   * Adds a new color group card to the container.
   * Each group = 1 color + multiple size/qty rows + subtotal
   */
  addColorGroup(colorName = '', sizeRows = []) {
    const container = document.getElementById('order-color-groups-container');
    if (!container) return;

    this.colorGroupCounter++;
    const groupId = `color-group-${this.colorGroupCounter}`;

    const group = document.createElement('div');
    group.className = 'color-group-card';
    group.id = groupId;
    group.style.cssText = 'background: rgba(99,102,241,0.04); border: 1px solid rgba(99,102,241,0.15); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; position: relative;';

    group.innerHTML = `
      <!-- Color Group Header -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-accent); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">RENK:</span>
            <input type="text" list="order-colors-list" class="color-group-name" placeholder="Renk adı yazın" value="${this.escape(colorName)}" 
              style="flex: 1; margin-bottom: 0; padding: 7px 12px; font-weight: 600; font-size: 0.9rem; border-radius: 6px;" required>
          </div>
          <button type="button" class="btn-icon danger btn-remove-color-group" style="flex-shrink: 0; height: 34px; width: 34px; font-size: 16px;" title="Renk Grubunu Sil">&times;</button>
        </div>

        <!-- Hızlı Asorti Butonları (Tek Tıkla Seri Doldur) -->
        <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center; background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
          <span style="font-size: 10.5px; font-weight: 700; color: var(--text-secondary); margin-right: 4px;">⚡ HIZLI DOLDUR:</span>
          <button type="button" class="btn btn-sm btn-quick-asorti" data-type="kadin8" style="padding: 3px 8px; font-size: 11px; border-radius: 4px; background: rgba(99,102,241,0.15); color: var(--text-accent); border: 1px solid rgba(99,102,241,0.3); font-weight: 600;">👠 Kadın (8 Çift)</button>
          <button type="button" class="btn btn-sm btn-quick-asorti" data-type="kadin12" style="padding: 3px 8px; font-size: 11px; border-radius: 4px; background: rgba(99,102,241,0.15); color: var(--text-accent); border: 1px solid rgba(99,102,241,0.3); font-weight: 600;">👠 Kadın (12'li)</button>
          <button type="button" class="btn btn-sm btn-quick-asorti" data-type="erkek8" style="padding: 3px 8px; font-size: 11px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); font-weight: 600;">👞 Erkek (8 Çift)</button>
          <button type="button" class="btn btn-sm btn-quick-asorti" data-type="erkek12" style="padding: 3px 8px; font-size: 11px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); font-weight: 600;">👞 Erkek (12'li)</button>
          <button type="button" class="btn btn-sm btn-quick-asorti" data-type="cocuk" style="padding: 3px 8px; font-size: 11px; border-radius: 4px; background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); font-weight: 600;">🧒 Çocuk (10'lu)</button>
        </div>
        
        <!-- Özel Asorti Şablonu & Koli Çarpanı -->
        <div class="asorti-helper-row" style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.02); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
          <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">📦 ŞABLON / KOLİ:</span>
          <select class="color-group-asorti-select" style="flex: 2; padding: 4px 6px; font-size: 11px; border-radius: 4px; height: 28px;">
            <option value="">Kayıtlı Şablon Seçin</option>
          </select>
          <input type="number" class="color-group-asorti-qty" value="1" min="1" placeholder="Koli" style="width: 50px; padding: 4px 6px; font-size: 11px; text-align: center; border-radius: 4px; height: 28px; margin-bottom: 0;">
          <button type="button" class="btn btn-sm btn-apply-asorti" style="padding: 4px 8px; font-size: 11px; height: 28px; font-weight: 600; background: var(--accent-primary); border-color: var(--accent-primary);">Uygula</button>
        </div>
      </div>

      <!-- Size/Qty Table Header -->
      <div style="display: flex; gap: 8px; margin-bottom: 4px; font-size: 0.7rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; padding-left: 4px;">
        <span style="flex: 1; text-align: center;">Asorti (Numara)</span>
        <span style="flex: 1; text-align: center;">Toplam Adet</span>
        <span style="width: 34px;"></span>
      </div>

      <!-- Size Rows Container -->
      <div class="size-rows-container" style="display: flex; flex-direction: column; gap: 5px;">
        <!-- Dynamic size rows will be inserted here -->
      </div>

      <!-- Add Size Row Button -->
      <button type="button" class="btn btn-sm btn-add-size-row" style="margin-top: 8px; padding: 4px 10px; font-size: 0.72rem; background: rgba(99,102,241,0.1); color: var(--text-accent); border: 1px dashed rgba(99,102,241,0.3); border-radius: 6px; cursor: pointer; width: 100%;">
        + Manuel Numara Ekle
      </button>

      <!-- Subtotal -->
      <div class="color-group-subtotal" style="margin-top: 10px; padding: 6px 10px; background: rgba(99,102,241,0.08); border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 0.85rem; color: var(--text-accent);">
        <span>Toplam</span>
        <span class="color-group-total-value">0 Çift</span>
      </div>
    `;

    container.appendChild(group);

    // Bind Quick Asorti Preset Buttons
    group.querySelectorAll('.btn-quick-asorti').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const rowsContainer = group.querySelector('.size-rows-container');
        if (!rowsContainer) return;
        rowsContainer.innerHTML = '';

        const presets = {
          kadin8: [{ size: '36', qty: '1' }, { size: '37', qty: '2' }, { size: '38', qty: '2' }, { size: '39', qty: '2' }, { size: '40', qty: '1' }],
          kadin12: [{ size: '35', qty: '1' }, { size: '36', qty: '2' }, { size: '37', qty: '2' }, { size: '38', qty: '3' }, { size: '39', qty: '2' }, { size: '40', qty: '1' }, { size: '41', qty: '1' }],
          erkek8: [{ size: '40', qty: '1' }, { size: '41', qty: '2' }, { size: '42', qty: '2' }, { size: '43', qty: '2' }, { size: '44', qty: '1' }],
          erkek12: [{ size: '39', qty: '1' }, { size: '40', qty: '2' }, { size: '41', qty: '2' }, { size: '42', qty: '3' }, { size: '43', qty: '2' }, { size: '44', qty: '1' }, { size: '45', qty: '1' }],
          cocuk: [{ size: '26', qty: '1' }, { size: '27', qty: '1' }, { size: '28', qty: '1' }, { size: '29', qty: '1' }, { size: '30', qty: '1' }, { size: '31', qty: '1' }, { size: '32', qty: '1' }, { size: '33', qty: '1' }, { size: '34', qty: '1' }, { size: '35', qty: '1' }]
        };

        const chosen = presets[type] || presets.kadin8;
        chosen.forEach(item => this.addSizeRow(group, item.size, item.qty));
        this.recalcGrandTotal();
        if (window.showToast) window.showToast('Hızlı asorti şablonu uygulandı! ⚡', 'success');
      });
    });

    // Populate assortment templates select in the group
    const asortiSelect = group.querySelector('.color-group-asorti-select');
    if (asortiSelect) {
      window.dbGetAll('assortments').then(list => {
        list.forEach(as => {
          const option = document.createElement('option');
          option.value = as.id;
          option.textContent = as.name;
          asortiSelect.appendChild(option);
        });
      });
    }

    // Bind Apply button click
    const btnApply = group.querySelector('.btn-apply-asorti');
    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        const asId = asortiSelect.value;
        const qtyVal = parseInt(group.querySelector('.color-group-asorti-qty').value) || 1;
        if (!asId) {
          if (window.showToast) window.showToast('Lütfen önce bir asorti şablonu seçin!', 'error');
          return;
        }

        try {
          const as = await window.dbGet('assortments', parseInt(asId));
          if (!as) return;

          // Clear existing size rows
          const rowsContainer = group.querySelector('.size-rows-container');
          if (rowsContainer) rowsContainer.innerHTML = '';

          // Add sizes from template
          for (let s = 36; s <= 45; s++) {
            const templateQty = parseInt(as.sizes[s] || 0);
            if (templateQty > 0) {
              this.addSizeRow(group, s.toString(), (templateQty * qtyVal).toString());
            }
          }

          this.recalcGrandTotal();
          if (window.showToast) window.showToast('Şablon başarıyla uygulandı.', 'success');
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Pre-populate size rows if provided, or default to Kadın 8'li if completely new
    if (sizeRows.length > 0) {
      sizeRows.forEach(sr => this.addSizeRow(group, sr.size, sr.qty));
    } else {
      // Auto-prefill default Kadın 36-40 so user does not need to click anything
      const defaultSizes = [{ size: '36', qty: '1' }, { size: '37', qty: '2' }, { size: '38', qty: '2' }, { size: '39', qty: '2' }, { size: '40', qty: '1' }];
      defaultSizes.forEach(sr => this.addSizeRow(group, sr.size, sr.qty));
    }

    this.recalcGrandTotal();
    return group;
  },

  /**
   * Adds a numara/adet row inside a color group
   */
  addSizeRow(groupElement, size = '', qty = '') {
    const container = groupElement.querySelector('.size-rows-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'size-row';
    row.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    row.innerHTML = `
      <input type="text" class="size-number-input" placeholder="No" value="${this.escape(size)}" 
        style="flex: 1; margin-bottom: 0; padding: 7px 10px; text-align: center; font-weight: 600; font-size: 0.9rem; border-radius: 6px;" required>
      <input type="number" class="size-qty-input" placeholder="Adet" min="1" value="${qty}" 
        style="flex: 1; margin-bottom: 0; padding: 7px 10px; text-align: center; font-size: 0.9rem; border-radius: 6px;" required>
      <button type="button" class="btn-icon danger btn-remove-size-row" style="flex-shrink: 0; height: 32px; width: 32px; font-size: 14px;" title="Satırı Sil">&times;</button>
    `;

    container.appendChild(row);
    this.recalcGroupTotal(groupElement);
  },

  /**
   * Recalculates the subtotal of a single color group
   */
  recalcGroupTotal(groupElement) {
    const qtyInputs = groupElement.querySelectorAll('.size-qty-input');
    let total = 0;
    qtyInputs.forEach(input => {
      total += parseInt(input.value) || 0;
    });
    const totalDisplay = groupElement.querySelector('.color-group-total-value');
    if (totalDisplay) totalDisplay.textContent = `${total} Çift`;
    this.recalcGrandTotal();
  },

  /**
   * Recalculates the grand total across all color groups
   */
  recalcGrandTotal() {
    const container = document.getElementById('order-color-groups-container');
    if (!container) return;

    let grandTotal = 0;
    container.querySelectorAll('.color-group-card').forEach(group => {
      group.querySelectorAll('.size-qty-input').forEach(input => {
        grandTotal += parseInt(input.value) || 0;
      });
    });

    const grandTotalDisplay = document.getElementById('order-grand-total-value');
    if (grandTotalDisplay) grandTotalDisplay.textContent = `${grandTotal} Çift`;
  },

  /**
   * Collects all data from the color groups UI
   * Returns: { colors: [{color, qty, sizes: [{size, qty}]}], totalQty }
   */
  collectColorGroupsData() {
    const container = document.getElementById('order-color-groups-container');
    if (!container) return { colors: [], totalQty: 0 };

    const colors = [];
    let totalQty = 0;

    container.querySelectorAll('.color-group-card').forEach(group => {
      const colorName = group.querySelector('.color-group-name').value.trim();
      if (!colorName) return;

      const sizes = [];
      let colorTotal = 0;

      group.querySelectorAll('.size-row').forEach(row => {
        const size = row.querySelector('.size-number-input').value.trim();
        const qty = parseInt(row.querySelector('.size-qty-input').value) || 0;
        if (size && qty > 0) {
          sizes.push({ size, qty });
          colorTotal += qty;
        }
      });

      if (sizes.length > 0) {
        colors.push({
          color: colorName,
          qty: colorTotal,
          sizes: sizes
        });
        totalQty += colorTotal;
      }
    });

    return { colors, totalQty };
  },

  async loadOrders() {
    const orders = await dbGetAll('orders');
    const contacts = await dbGetAll('contacts');

    const contactMap = {};
    contacts.forEach(c => contactMap[c.id] = c.name);

    // 1. Separate Active and Incoming Orders
    let filteredOrders = orders;
    const searchVal = document.getElementById('search-orders')?.value?.toLowerCase().trim() || '';
    if (searchVal) {
      filteredOrders = orders.filter(o => {
        const customerName = (contactMap[o.contactId] || '').toLowerCase();
        const modelCode = (o.modelCode || '').toLowerCase();
        const invoiceNo = (o.invoiceNo || '').toLowerCase();
        const idStr = String(o.id || '').toLowerCase();
        const colors = (o.colors || []).map(c => (c.color || '').toLowerCase()).join(' ');
        
        return customerName.includes(searchVal) ||
               modelCode.includes(searchVal) ||
               invoiceNo.includes(searchVal) ||
               idStr.includes(searchVal) ||
               colors.includes(searchVal);
      });
    }

    const activeOrders = filteredOrders.filter(o => o.status !== 'gelen');
    const incomingOrders = filteredOrders.filter(o => o.status === 'gelen');

    // 2. Update Incoming Orders tab badge and sidebar badge
    const badge = document.getElementById('incoming-orders-badge');
    const sidebarBadge = document.getElementById('sidebar-incoming-badge');
    
    if (incomingOrders.length > 0) {
      if (badge) {
        badge.textContent = incomingOrders.length;
        badge.style.display = 'inline-block';
      }
      if (sidebarBadge) {
        sidebarBadge.textContent = incomingOrders.length;
        sidebarBadge.style.display = 'inline-block';
      }
    } else {
      if (badge) badge.style.display = 'none';
      if (sidebarBadge) sidebarBadge.style.display = 'none';
    }

    // Trigger notification alert if new orders arrived
    if (window._prevIncomingCount !== undefined && incomingOrders.length > window._prevIncomingCount) {
      if (window.sendNotificationAlert) {
        window.sendNotificationAlert('new-order', `Katalogdan yeni bir sipariş geldi! (${incomingOrders.length} onay bekleyen)`);
      }
    }
    window._prevIncomingCount = incomingOrders.length;

    // 3. Render Active Orders
    const tbody = document.getElementById('orders-tbody');
    const emptyState = document.getElementById('orders-empty');
    const table = document.getElementById('orders-table');

    if (tbody) {
      if (activeOrders.length === 0) {
        if (table) table.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
      } else {
        if (table) table.style.display = 'table';
        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = activeOrders.map(o => {
          const customerName = contactMap[o.contactId] || 'Bilinmeyen Müşteri';
          const totalAmount = o.qty * o.price;
          const orderDate = o.date ? new Date(o.date).toLocaleDateString('tr-TR') : '-';
          const deadlineDate = o.deadline ? new Date(o.deadline).toLocaleDateString('tr-TR') : '-';

          const symbols = { TRY: '₺', USD: '$', EUR: '€' };
          const sym = symbols[o.currency || 'TRY'] || '₺';

          // Build status badge
          let statusBadge = '';
          if (o.status === 'beklemede') {
            statusBadge = '<span class="category-badge badge-tedarikci" style="background: var(--color-warning-bg); color: var(--color-warning);">Beklemede</span>';
          } else if (o.status === 'kargoda') {
            statusBadge = '<span class="category-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">Kargoda</span>';
          } else if (o.status === 'tamamlandi') {
            statusBadge = '<span class="category-badge badge-musteri" style="background: var(--color-success-bg); color: var(--color-success);">Tamamlandı</span>';
          } else { 
            statusBadge = '<span class="category-badge" style="background: var(--color-danger-bg); color: var(--color-danger);">İptal Edildi</span>';
          }

          // Render colors breakdown badges with size details
          const colorBadges = (o.colors || []).map(c => {
            let sizeInfo = '';
            if (c.sizes && c.sizes.length > 0) {
              sizeInfo = c.sizes.map(s => `${this.escape(s.size)}:${s.qty}`).join(', ');
              sizeInfo = ` [${sizeInfo}]`;
            }
            return `<span style="background: rgba(99, 102, 241, 0.08); color: var(--text-accent); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 500;">${this.escape(c.color)}: ${c.qty} Çift${sizeInfo}</span>`;
          }).join(' ');

          // Sub-details row
          const detailsText = `Klişe: ${o.klise || '-'} | Aks. Rengi: ${o.accessoryColor || '-'}`;

          return `
            <tr>
              <td><strong>#${o.id}</strong></td>
              <td>${this.escape(customerName)}</td>
              <td>
                <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 4px;">${this.escape(o.modelCode)}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">${colorBadges}</div>
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${this.escape(detailsText)}</div>
              </td>
              <td><strong>${o.qty} Çift</strong></td>
              <td>${sym}${o.price.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
              <td><strong>${sym}${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong></td>
              <td>
                <div style="font-size: 12px; font-weight: 500;">Sip: ${orderDate}</div>
                <div style="font-size: 12px; font-weight: 600; color: var(--color-warning); margin-top: 2px;">Ter: ${deadlineDate}</div>
              </td>
              <td>${statusBadge}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn-icon" style="background: rgba(99, 102, 241, 0.12); color: #818cf8; border-color: rgba(99, 102, 241, 0.25);" title="İmalat Fişlerine / Partilere Böl" onclick="Orders.openSplitModal(${o.id})">🏭</button>
                  <button class="btn-icon success" style="background: rgba(37, 211, 102, 0.1); color: #25d366; border-color: rgba(37, 211, 102, 0.2);" title="WhatsApp Bildirimi Gönder" onclick="Orders.sendWhatsAppNotification(${o.id})">💬</button>
                  <button class="btn-icon success" title="Teslim Fişi Oluştur" onclick="Orders.openInvoiceModal(${o.id})">🧾</button>
                  <button class="btn-icon warning" title="Koli Etiketi Yazdır" onclick="Orders.openLabelModal(${o.id})">🏷️</button>
                  <button class="btn-icon info" title="Durum Değiştir" onclick="Orders.openModal(${o.id})">✏️</button>
                  <button class="btn-icon danger" title="Sil" onclick="Orders.deleteOrder(${o.id})">🗑️</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 4. Render Incoming Orders (Gelen Siparişler)
    const incomingTbody = document.getElementById('incoming-orders-tbody');
    const incomingEmptyState = document.getElementById('incoming-orders-empty');
    const incomingTable = document.getElementById('incoming-orders-table');

    if (incomingTbody) {
      if (incomingOrders.length === 0) {
        if (incomingTable) incomingTable.style.display = 'none';
        if (incomingEmptyState) incomingEmptyState.style.display = 'block';
      } else {
        if (incomingTable) incomingTable.style.display = 'table';
        if (incomingEmptyState) incomingEmptyState.style.display = 'none';

        incomingTbody.innerHTML = incomingOrders.map(o => {
          const rawCustomer = o.customerName || 'Bilinmeyen Müşteri';
          const orderDate = o.date ? new Date(o.date).toLocaleDateString('tr-TR') : '-';

          // Render colors breakdown badges
          const colorBadges = (o.colors || []).map(c => {
            let sizeInfo = '';
            if (c.sizes && c.sizes.length > 0) {
              sizeInfo = c.sizes.map(s => `${this.escape(s.size)}:${s.qty}`).join(', ');
              sizeInfo = ` [${sizeInfo}]`;
            }
            return `<span style="background: rgba(99, 102, 241, 0.08); color: var(--text-accent); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 500;">${this.escape(c.color)}: ${c.qty} Çift${sizeInfo}</span>`;
          }).join(' ');

          return `
            <tr>
              <td>${orderDate}</td>
              <td style="font-weight: 600; color: var(--text-accent);">${this.escape(rawCustomer)}</td>
              <td>
                <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 4px;">${this.escape(o.modelCode)}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px;">${colorBadges}</div>
              </td>
              <td><strong>${o.qty} Çift</strong></td>
              <td>₺${(o.price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
              <td style="font-size: 12.5px; color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escape(o.note || '-')}">${this.escape(o.note || '-')}</td>
              <td>
                <div class="actions-cell">
                  <button class="btn btn-secondary btn-sm" onclick="Orders.openApproveModal('${o.id}')" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600; border-color: rgba(16, 185, 129, 0.2);" title="Siparişi Onayla">✔️ Onayla</button>
                  <button class="btn btn-secondary btn-sm" onclick="Orders.rejectIncomingOrder('${o.id}')" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-weight: 600; border-color: rgba(239, 68, 68, 0.2);" title="Siparişi Reddet">🗑️ Reddet</button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  async openModal(id = null) {
    this.editingId = id;
    this.colorGroupCounter = 0;
    const modal = document.getElementById('order-modal');
    const title = document.getElementById('order-modal-title');
    const form = document.getElementById('order-form');
    const groupsContainer = document.getElementById('order-color-groups-container');

    if (form) form.reset();
    const orderIdInput = document.getElementById('order-id');
    if (orderIdInput) orderIdInput.value = '';
    if (groupsContainer) groupsContainer.innerHTML = '';

    // Reset grand total
    const grandTotalDisplay = document.getElementById('order-grand-total-value');
    if (grandTotalDisplay) grandTotalDisplay.textContent = '0 Çift';

    // Populate customers (contacts musteri)
    const contacts = await dbGetAll('contacts');
    const customers = contacts.filter(c => c.type === 'musteri' || c.type === 'ikisi');
    const contactSelect = document.getElementById('order-contact-id');
    if (contactSelect) {
      contactSelect.innerHTML = '<option value="">Seçiniz</option>' + customers.map(c => `<option value="${c.id}">${this.escape(c.name)}</option>`).join('');
    }

    const addColorGroupBtn = document.getElementById('btn-order-add-color-group');

    if (id) {
      if (title) title.textContent = 'Sipariş Düzenle (Durum Güncelle)';
      dbGet('orders', id).then(async (o) => {
        if (o) {
          const orderIdInput = document.getElementById('order-id');
          if (orderIdInput) orderIdInput.value = o.id;
          if (contactSelect) contactSelect.value = o.contactId;
          const modelCodeInput = document.getElementById('order-model-code');
          if (modelCodeInput) modelCodeInput.value = o.modelCode || '';
          
          await this.updateAvailableColorsList(o.modelCode);

          // Load color groups with their sizes
          if (o.colors && o.colors.length > 0) {
            o.colors.forEach(c => {
              const sizeRows = c.sizes || [];
              this.addColorGroup(c.color, sizeRows);
            });
          }

          const priceInput = document.getElementById('order-price');
          if (priceInput) priceInput.value = o.price;
          const currencyInput = document.getElementById('order-currency');
          if (currencyInput) {
            currencyInput.value = o.currency || 'TRY';
            currencyInput.disabled = true;
          }
          const deadlineInput = document.getElementById('order-deadline');
          if (deadlineInput) deadlineInput.value = o.deadline || '';
          const kliseInput = document.getElementById('order-klise');
          if (kliseInput) kliseInput.value = o.klise || '';
          const accessoryColorInput = document.getElementById('order-accessory-color');
          if (accessoryColorInput) accessoryColorInput.value = o.accessoryColor || '';
          const statusInput = document.getElementById('order-status');
          if (statusInput) statusInput.value = o.status;

          // Disable fields during editing to prevent stock recalculation errors
          if (contactSelect) contactSelect.disabled = true;
          if (modelCodeInput) modelCodeInput.disabled = true;
          if (priceInput) priceInput.disabled = true;
          if (deadlineInput) deadlineInput.disabled = true;
          if (kliseInput) kliseInput.disabled = true;
          if (accessoryColorInput) accessoryColorInput.disabled = true;
          if (addColorGroupBtn) addColorGroupBtn.style.display = 'none';

          // Disable all input fields and buttons in groups
          setTimeout(() => {
            if (groupsContainer) {
              groupsContainer.querySelectorAll('input, button').forEach(el => el.disabled = true);
            }
          }, 50);
        }
      });
    } else {
      title.textContent = 'Yeni Sipariş Al';
      contactSelect.disabled = false;
      document.getElementById('order-model-code').disabled = false;
      document.getElementById('order-price').disabled = false;
      const currencyInput = document.getElementById('order-currency');
      if (currencyInput) {
        currencyInput.value = 'TRY';
        currencyInput.disabled = false;
      }
      document.getElementById('order-deadline').disabled = false;
      document.getElementById('order-klise').disabled = false;
      document.getElementById('order-accessory-color').disabled = false;
      document.getElementById('order-status').value = 'beklemede';
      if (addColorGroupBtn) addColorGroupBtn.style.display = 'inline-flex';
      
      // Start empty as requested (Komut vermeden açılmasın)
    }

    openModalById('order-modal');
  },

  async saveOrder() {
    const id = document.getElementById('order-id').value;
    const status = document.getElementById('order-status').value;

    try {
      if (id) {
        // Edit order (Status change)
        const orderId = parseInt(id);
        const o = await dbGet('orders', orderId);
        if (!o) throw new Error('Sipariş bulunamadı!');

        const oldStatus = o.status;
        const newStatus = status;

        if (oldStatus === newStatus) {
          closeModalById('order-modal');
          return;
        }

        // Handle Stock and Transaction changes if status changes
        if (newStatus === 'iptal') {
          if (oldStatus !== 'iptal') {
            // If status changes to cancelled, refund stock
            await this.adjustStockForColors(o.colors, 'restore');

            // Delete related transactions
            const txs = await dbGetAll('transactions');
            const relatedTxs = txs.filter(tx => tx.orderId === orderId);
            for (const tx of relatedTxs) {
              await dbDelete('transactions', tx.id);
            }
            showToast('Sipariş iptal edildi, stoklar geri yüklendi!', 'info');
          }
        } else if (oldStatus === 'iptal' && (newStatus === 'beklemede' || newStatus === 'tamamlandi' || newStatus === 'kargoda')) {
          // Re-deduct stock if changing back from cancel
          const isStockOk = await this.verifyAndDeductStockForColors(o.colors);
          if (!isStockOk) return; // verification fails, keep old status

          // Re-create transaction
          const amount = parseFloat((o.qty * o.price).toFixed(2));
          const tx = {
            contactId: o.contactId,
            type: 'alacak',
            amount: amount,
            description: `${o.modelCode} (${o.qty} Çift) Sipariş (Yeniden Aktif)`,
            orderId: orderId,
            date: new Date().toISOString()
          };
          await dbAdd('transactions', tx);
          showToast('Sipariş yeniden aktif edildi, stoklar düşüldü!', 'success');
        }

        o.status = newStatus;
        await dbUpdate('orders', o);

        // Trigger Order Status Notification
        if (window.sendNotificationAlert) {
          const statusLabels = {
            'beklemede': 'Beklemede',
            'kargoda': 'Kargoya Verildi',
            'tamamlandi': 'Tamamlandı',
            'iptal': 'İptal Edildi'
          };
          const label = statusLabels[newStatus] || newStatus;
          const msg = `#${o.id} nolu siparisin durumu guncellendi: ${label.toUpperCase()}. Model: ${o.modelCode}, Adet: ${o.qty} cift.`;
          window.sendNotificationAlert('order-status', msg);
        }

        // Send targeted Web Push notification to client
        if (o.contactId && o.contactId !== 0) {
          const statusLabelsTr = {
            'beklemede': 'İmalata Alındı (Üretimde)',
            'kargoda': 'Kargoya Verildi (Sevk Edildi)',
            'tamamlandi': 'Tamamlandı (Teslim Edildi)',
            'iptal': 'İptal Edildi'
          };
          const statusLabel = statusLabelsTr[newStatus] || newStatus;
          const workshopId = localStorage.getItem('saas_workshop_id') || 'default_workshop';
          fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workshopId,
              title: 'Sipariş Durumu Güncellendi! 👟',
              message: `#${o.id} nolu siparişinizin durumu güncellendi: ${statusLabel.toUpperCase()}. Model: ${o.modelCode}, Adet: ${o.qty} çift.`,
              userType: 'client',
              contactId: o.contactId
            })
          }).catch(err => console.warn('Client push status notification failed:', err));
        }

        // Send WhatsApp notification if status changed to 'kargoda' and customerPhone exists
        if (newStatus === 'kargoda' && o.customerPhone) {
          try {
            const formattedPhone = formatPhone(o.customerPhone);
            const waMsg = `Merhaba, #${o.id} nolu ${o.modelCode} model kodlu ${o.qty} çift siparişiniz kargoya verildi! 🚚`;
            const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(waMsg)}`;
            openWhatsAppPrompt(
              waUrl,
              'Sipariş Kargoya Verildi! 🚚',
              `#${o.id} nolu sipariş kargoya verildi. Müşterinize WhatsApp üzerinden kargo teslimat bildirimi göndermek ister misiniz?`
            );
          } catch (err) {
            console.error('WhatsApp notification failed:', err);
          }
        }

        showToast('Sipariş durumu güncellendi!', 'success');
      } else {
        // New Order
        const contactId = parseInt(document.getElementById('order-contact-id').value);
        const modelCode = document.getElementById('order-model-code').value.trim();
        const price = parseFloat(document.getElementById('order-price').value) || 0;
        const currency = document.getElementById('order-currency').value || 'TRY';
        const deadline = document.getElementById('order-deadline').value;
        const klise = document.getElementById('order-klise').value.trim();
        const accessoryColor = document.getElementById('order-accessory-color').value.trim();

        if (!contactId || !modelCode || price <= 0 || !deadline) {
          showToast('Lütfen tüm zorunlu alanları geçerli değerlerle doldurun!', 'error');
          return;
        }

        // Collect data from unified color groups
        const { colors: groupData, totalQty } = this.collectColorGroupsData();

        if (groupData.length === 0) {
          showToast('Lütfen en az bir adet renk grubu ve numara/adet ekleyin!', 'error');
          return;
        }

        // Process each color — match existing product without polluting catalog
        const products = await dbGetAll('products');
        const colorsForDb = [];
        
        for (const cg of groupData) {
          // Find matching product by model and color, or by model
          let match = products.find(p => 
            (p.modelCode || '').toLowerCase() === modelCode.toLowerCase() && 
            (p.color || '').toLowerCase() === cg.color.toLowerCase()
          );
          if (!match) {
            match = products.find(p => (p.modelCode || '').toLowerCase() === modelCode.toLowerCase());
          }

          colorsForDb.push({
            productId: match ? match.id : null,
            color: cg.color,
            qty: cg.qty,
            sizes: cg.sizes
          });
        }

        // Verify and deduct stock across all colors (non-blocking)
        const isStockOk = await this.verifyAndDeductStockForColors(colorsForDb);
        if (!isStockOk) return;

        // Add order record
        const orderData = {
          contactId,
          modelCode,
          colors: colorsForDb,
          qty: totalQty,
          price,
          currency,
          deadline,
          klise,
          accessoryColor,
          status,
          date: new Date().toISOString()
        };
        const orderId = await dbAdd('orders', orderData);

        // Trigger New Order SMS
        if (window.sendNotificationAlert) {
          const contactSelect = document.getElementById('order-contact-id');
          const customerName = contactSelect ? (contactSelect.options[contactSelect.selectedIndex]?.text || 'Bilinmeyen Müşteri') : 'Bilinmeyen Müşteri';
          const msg = `Yeni Siparis Alindi! Siparis ID: #${orderId}, Musteri: ${customerName}, Model: ${modelCode}, Toplam Adet: ${totalQty} cift. Bol bereketli isler dileriz.`;
          window.sendNotificationAlert('new-order', msg);
        }

        // Add transaction to contact
        const amount = parseFloat((totalQty * price).toFixed(2));
        const tx = {
          contactId,
          type: 'alacak',
          amount: amount,
          currency: currency,
          description: `${modelCode} — ${totalQty} Çift Çoklu Renk Sipariş`,
          orderId: orderId,
          date: new Date().toISOString()
        };
        await dbAdd('transactions', tx);

        showToast('Sipariş başarıyla alındı!', 'success');
      }

      closeModalById('order-modal');
      await this.loadOrders();
      if (window.Dashboard && typeof window.Dashboard.render === 'function') await window.Dashboard.render();
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  async verifyAndDeductStockForColors(colors) {
    const totalMaterialNeeds = {}; // key: stockId -> { id, name, reqQty, curQty, unit }
    const warnings = [];

    for (const c of colors) {
      if (!c.productId) continue;
      
      const recipe = await dbGet('recipes', c.productId);
      if (!recipe || !recipe.materials || recipe.materials.length === 0) {
        const p = await dbGet('products', c.productId);
        const nameDesc = p ? `${p.modelCode} (${p.color})` : `Ürün (ID: ${c.productId})`;
        warnings.push(`• ${nameDesc} için reçete (BOM) tanımlanmamış (Stok düşümü yapılmadı).`);
        continue;
      }

      for (const mat of recipe.materials) {
        const stock = await dbGet('stocks', mat.id);
        if (!stock) {
          warnings.push(`• Reçetedeki malzeme (ID: ${mat.id}) stokta bulunamadı.`);
          continue;
        }

        const reqQty = c.qty * mat.qty;
        if (!totalMaterialNeeds[mat.id]) {
          totalMaterialNeeds[mat.id] = {
            id: mat.id,
            name: stock.name,
            reqQty: 0,
            curQty: stock.qty,
            unit: stock.unit
          };
        }
        totalMaterialNeeds[mat.id].reqQty += reqQty;
      }
    }

    // Verify shortages and update stocks
    const stockItemsToUpdate = [];
    const shortageLines = [];

    for (const id in totalMaterialNeeds) {
      const need = totalMaterialNeeds[id];
      if (need.curQty < need.reqQty) {
        const missingAmt = safeSub(need.reqQty, need.curQty);
        shortageLines.push(`• ${need.name} (Elindeki Stok: ${need.curQty} ${need.unit}, Gereken Ek İhtiyaç: ${missingAmt} ${need.unit})`);
      }
    }

    if (shortageLines.length > 0) {
      const confirmMsg = `⚠️ Stok Yetersiz! Aşağıdaki kalemler eksiye düşecektir:\n\n${shortageLines.join('\n')}\n\nDevam etmek istiyor musunuz?`;
      if (!confirm(confirmMsg)) {
        return false;
      }
    }

    // Deduct stock after confirmation
    for (const id in totalMaterialNeeds) {
      const need = totalMaterialNeeds[id];
      const stock = await dbGet('stocks', need.id);
      if (stock) {
        stock.qty = safeSub(stock.qty, need.reqQty);
        stockItemsToUpdate.push(stock);
      }
    }

    // Save stock updates
    for (const stock of stockItemsToUpdate) {
      await dbUpdate('stocks', stock);
    }

    // Show warnings formatted
    if (warnings.length > 0) {
      alert(`⚠️ Sipariş Kaydedildi. Bazı uyarılar var:\n\n${warnings.join('\n')}`);
    }

    return true;
  },

  async adjustStockForColors(colors, action = 'restore') {
    for (const c of colors) {
      if (!c.productId) continue;
      const recipe = await dbGet('recipes', c.productId);
      if (!recipe || !recipe.materials) continue;

      for (const mat of recipe.materials) {
        const stock = await dbGet('stocks', mat.id);
        if (stock) {
          const amt = c.qty * mat.qty;
          if (action === 'restore') {
            stock.qty = safeAdd(stock.qty, amt);
          } else {
            // M3 Düzeltme: restore dışında (düşüm) miktar en az 0 olabilir
            stock.qty = Math.max(0, safeSub(stock.qty, amt));
          }
          await dbUpdate('stocks', stock);
        }
      }
    }
  },

  async deleteOrder(id) {
    if (!confirm('Bu siparişi silmek istediğinizden emin misiniz?')) return;

    try {
      const o = await dbGet('orders', id);
      if (o) {
        // K7 Düzeltme: İptal edilmemiş siparişlerin stokları silinirken geri yüklenir
        if (o.status !== 'iptal' && o.colors) {
          await this.adjustStockForColors(o.colors, 'restore');
        }

        // Y3 Düzeltme: Siparişe ait TÜM işlemler hızlıca silinir
        const txs = await dbGetAll('transactions');
        const relatedTxs = txs.filter(tx => tx.orderId === id);
        if (relatedTxs.length > 0) {
          if (window.dbDeleteMany) {
            await window.dbDeleteMany('transactions', relatedTxs.map(t => t.id));
          } else {
            await Promise.all(relatedTxs.map(tx => dbDelete('transactions', tx.id)));
          }
        }
        
        await dbDelete('orders', id);
        showToast('Sipariş kaydı silindi, stoklar güncellendi.', 'info');
        await this.loadOrders();
        
        if (window.Dashboard && typeof window.Dashboard.render === 'function') {
          await window.Dashboard.render();
        }
      }
    } catch (err) {
      showToast('Silme hatası: ' + err.message, 'error');
    }
  },

  async sendWhatsAppNotification(orderId) {
    if (window.WhatsAppManager && typeof window.WhatsAppManager.openForOrder === 'function') {
      window.WhatsAppManager.openForOrder(orderId);
      return;
    }
    showToast('WhatsApp yöneticisi yüklenemedi.', 'error');
  },

  async openInvoiceModal(orderId) {
    try {
      const order = await dbGet('orders', orderId);
      if (!order) {
        showToast('Sipariş bulunamadı!', 'error');
        return;
      }

      const contacts = await dbGetAll('contacts');
      const contact = contacts.find(c => c.id === order.contactId);
      const contactName = contact ? contact.name : 'Bilinmeyen Müşteri';
      const contactPhone = contact ? (contact.phone || '-') : '-';
      const contactAddress = contact ? (contact.address || '-') : '-';

      const mockInvNo = order.invoiceNo || 'TSL' + new Date().getFullYear() + String(order.id).padStart(4, '0');
      const mockInvDate = order.invoiceDate || new Date().toISOString().split('T')[0];

      const inputNo = document.getElementById('inv-input-no');
      const inputDate = document.getElementById('inv-input-date');
      const inputTaxOffice = document.getElementById('inv-input-tax-office');
      const selectKdv = document.getElementById('inv-input-kdv');

      inputNo.value = mockInvNo;
      inputDate.value = mockInvDate;
      inputTaxOffice.value = order.deliveryNote || 'Teslimat ambar / araç ile yapılmıştır.';
      if (selectKdv) selectKdv.value = '0'; // default Net / 0%

      // Update Preview fields
      const myCompany = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
      const companyNameEl = document.getElementById('invoice-company-name');
      const companyInfoEl = document.getElementById('invoice-company-info');
      if (companyNameEl) companyNameEl.textContent = myCompany.toUpperCase();
      if (companyInfoEl) {
        if (myCompany === 'Atölyecim Master') {
          companyInfoEl.innerHTML = 'Ayakkabı İmalat ve Toptan Satış Atölyesi<br>Güngören / İstanbul';
        } else {
          companyInfoEl.innerHTML = 'Ayakkabı İmalat ve Toptan Satış Atölyesi';
        }
      }

      const invNoPreview = document.getElementById('inv-no-preview');
      if (invNoPreview) invNoPreview.textContent = mockInvNo;
      
      const invDatePreview = document.getElementById('inv-date-preview');
      if (invDatePreview) invDatePreview.textContent = new Date(mockInvDate).toLocaleDateString('tr-TR');
      
      const invTaxOfficePreview = document.getElementById('inv-tax-office-preview');
      if (invTaxOfficePreview) invTaxOfficePreview.textContent = inputTaxOffice ? inputTaxOffice.value : '-';
      
      const invCustName = document.getElementById('inv-cust-name');
      if (invCustName) invCustName.textContent = contactName;
      
      const invCustPhone = document.getElementById('inv-cust-phone');
      if (invCustPhone) invCustPhone.textContent = `Tel: ${contactPhone}`;
      
      const invCustAddress = document.getElementById('inv-cust-address');
      if (invCustAddress) invCustAddress.textContent = contactAddress;

      // Render Table Rows
      const tbody = document.getElementById('inv-table-tbody');
      tbody.innerHTML = '';

      let subtotal = 0;
      const symbols = { TRY: '₺', USD: '$', EUR: '€' };
      const sym = symbols[order.currency || 'TRY'] || '₺';
      
      if (order.colors && order.colors.length > 0) {
        order.colors.forEach(c => {
          let sizeDetail = '';
          if (c.sizes && c.sizes.length > 0) {
            sizeDetail = c.sizes.map(s => `${this.escape(s.size)} Nmr: ${s.qty} Ad.`).join(', ');
          }
          const rowSubtotal = c.qty * order.price;
          subtotal += rowSubtotal;

          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid #e2e8f0';
          tr.innerHTML = `
            <td style="padding: 10px 5px;"><strong>${this.escape(order.modelCode)}</strong></td>
            <td style="padding: 10px 5px; color: #475569;">${this.escape(c.color)} ${sizeDetail ? `(${sizeDetail})` : ''}</td>
            <td style="padding: 10px 5px; text-align: right;">${c.qty} Çift</td>
            <td style="padding: 10px 5px; text-align: right;">${sym}${order.price.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
            <td style="padding: 10px 5px; text-align: right; font-weight: 600;">${sym}${rowSubtotal.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        // Fallback if no colors breakdown
        const rowSubtotal = order.qty * order.price;
        subtotal += rowSubtotal;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
          <td style="padding: 10px 5px;"><strong>${this.escape(order.modelCode)}</strong></td>
          <td style="padding: 10px 5px; color: #475569;">Standart Dağılım</td>
          <td style="padding: 10px 5px; text-align: right;">${order.qty} Çift</td>
          <td style="padding: 10px 5px; text-align: right;">${sym}${order.price.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
          <td style="padding: 10px 5px; text-align: right; font-weight: 600;">${sym}${rowSubtotal.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(tr);
      }

      // Calculations Function
      const recalcTotals = () => {
        const kdvPercent = parseFloat(selectKdv ? selectKdv.value : 0) || 0;
        const kdvAmount = (subtotal * kdvPercent) / 100;
        const grandtotal = subtotal + kdvAmount;

        const subEl = document.getElementById('inv-sum-subtotal');
        if (subEl) subEl.textContent = `${sym}${subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        const kdvPctEl = document.getElementById('inv-sum-kdv-percent');
        if (kdvPctEl) kdvPctEl.textContent = `%${kdvPercent}`;
        const kdvAmtEl = document.getElementById('inv-sum-kdv-amount');
        if (kdvAmtEl) kdvAmtEl.textContent = `${sym}${kdvAmount.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        const grandEl = document.getElementById('inv-sum-grandtotal');
        if (grandEl) grandEl.textContent = `${sym}${grandtotal.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      };

      recalcTotals();

      // Bind dynamic input changes to live preview
      const handleInput = (inputEl, previewId, placeholderText = '-') => {
        if (!inputEl) return;
        inputEl.oninput = () => {
          const target = document.getElementById(previewId);
          if (target) target.textContent = inputEl.value.trim() || placeholderText;
        };
      };

      if (inputNo) handleInput(inputNo, 'inv-no-preview');
      
      if (inputDate) {
        inputDate.onchange = () => {
          const val = inputDate.value;
          const target = document.getElementById('inv-date-preview');
          if (target) target.textContent = val ? new Date(val).toLocaleDateString('tr-TR') : '-';
        };
      }

      if (inputTaxOffice) handleInput(inputTaxOffice, 'inv-tax-office-preview');

      if (selectKdv) {
        selectKdv.onchange = () => {
          recalcTotals();
        };
      }

      // Bind Print button click
      const printBtn = document.getElementById('btn-invoice-print');
      printBtn.onclick = async () => {
        try {
          const actualInvNo = inputNo.value.trim() || mockInvNo;
          order.invoiceNo = actualInvNo;
          order.invoiceDate = inputDate.value || mockInvDate;
          await dbUpdate('orders', order);
          
          document.body.classList.add('printing-invoice');
          window.print();
          document.body.classList.remove('printing-invoice');
        } catch (e) {
          console.error('Invoice save failed:', e);
        }
      };

      openModalById('invoice-modal');
    } catch (err) {
      showToast('Teslim fişi yüklenemedi: ' + err.message, 'error');
    }
  },

  async openSplitModal(orderId) {
    try {
      const order = await dbGet('orders', orderId);
      if (!order) {
        showToast('Sipariş bulunamadı!', 'error');
        return;
      }

      let customerName = 'Bilinmeyen Müşteri';
      if (order.contactId) {
        const c = await dbGet('contacts', order.contactId);
        if (c) customerName = c.name;
      }

      document.getElementById('split-modal-model').textContent = order.modelCode || '-';
      document.getElementById('split-modal-customer').textContent = customerName;
      document.getElementById('split-modal-total-qty').textContent = `${order.qty} Çift`;

      const colorsSummaryEl = document.getElementById('split-modal-colors-summary');
      if (colorsSummaryEl) {
        if (order.colors && order.colors.length > 0) {
          colorsSummaryEl.innerHTML = '<strong>Renk ve Asorti Dağılımı:</strong><br>' + order.colors.map(c => {
            const sz = (c.sizes || []).map(s => `${s.size}:${s.qty}`).join(', ');
            return `• <strong>${c.color}:</strong> ${c.qty} Çift (${sz || 'Standart'})`;
          }).join('<br>');
        } else {
          colorsSummaryEl.textContent = `Toplam ${order.qty} Çift`;
        }
      }

      // Default next serial number from JobTickets
      let nextSerial = '№ 01885';
      if (window.JobTickets && typeof window.JobTickets.getNextSerialNo === 'function') {
        nextSerial = await window.JobTickets.getNextSerialNo();
      }
      document.getElementById('split-starting-ticket-no').value = nextSerial;
      document.getElementById('split-delivery-date').value = order.deadline || new Date().toISOString().split('T')[0];

      // Split presets
      let currentBatchSize = 24;
      const chips = document.querySelectorAll('.split-chip');
      const customRow = document.getElementById('split-custom-batch-row');
      const customInput = document.getElementById('split-custom-batch-input');

      const updatePreview = () => {
        let batchSize = currentBatchSize;
        if (batchSize === 'custom') {
          batchSize = parseInt(customInput.value) || 24;
        }
        if (batchSize <= 0) batchSize = 24;

        const totalQty = order.qty || 0;
        const numTickets = Math.ceil(totalQty / batchSize);
        document.getElementById('split-preview-ticket-count').textContent = numTickets;

        const previewContainer = document.getElementById('split-tickets-preview-list');
        previewContainer.innerHTML = '';

        let currentSerialNum = parseInt(document.getElementById('split-starting-ticket-no').value.replace(/\D/g, '')) || 1885;

        let remaining = totalQty;
        for (let i = 1; i <= numTickets; i++) {
          const ticketQty = Math.min(remaining, batchSize);
          remaining -= ticketQty;
          const serialStr = '№ ' + String(currentSerialNum + (i - 1)).padStart(5, '0');

          const row = document.createElement('div');
          row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; font-size: 11.5px;';
          row.innerHTML = `
            <span><strong style="color: var(--text-accent);">${serialStr}</strong> — Parti ${i}/${numTickets}</span>
            <span style="color: var(--text-muted);">${order.modelCode}</span>
            <strong style="color: var(--color-warning);">${ticketQty} Çift</strong>
          `;
          previewContainer.appendChild(row);
        }
      };

      chips.forEach(chip => {
        chip.onclick = () => {
          chips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const b = chip.dataset.batch;
          if (b === 'custom') {
            customRow.style.display = 'block';
            currentBatchSize = 'custom';
          } else {
            customRow.style.display = 'none';
            currentBatchSize = parseInt(b);
          }
          updatePreview();
        };
      });

      customInput.oninput = updatePreview;
      document.getElementById('split-starting-ticket-no').oninput = updatePreview;

      updatePreview();

      // Confirm Generation Button
      const confirmBtn = document.getElementById('btn-split-confirm-generate');
      confirmBtn.onclick = async () => {
        try {
          let batchSize = currentBatchSize;
          if (batchSize === 'custom') {
            batchSize = parseInt(customInput.value) || 24;
          }
          if (batchSize <= 0) batchSize = 24;

          const totalQty = order.qty || 0;
          const numTickets = Math.ceil(totalQty / batchSize);
          let startSerialNum = parseInt(document.getElementById('split-starting-ticket-no').value.replace(/\D/g, '')) || 1885;
          const deliveryDate = document.getElementById('split-delivery-date').value;

          // Pro-rate sizes across tickets if colors exist
          let remainingTotal = totalQty;
          for (let i = 1; i <= numTickets; i++) {
            const ticketQty = Math.min(remainingTotal, batchSize);
            remainingTotal -= ticketQty;
            const serialStr = '№ ' + String(startSerialNum + (i - 1)).padStart(5, '0');

            // Calculate sizes proportional to this batch
            const proRatedSizes = {};
            if (order.colors && order.colors.length > 0) {
              order.colors.forEach(c => {
                (c.sizes || []).forEach(s => {
                  const proportion = (s.qty / totalQty);
                  const alloc = Math.round(proportion * ticketQty) || 1;
                  proRatedSizes[s.size] = (proRatedSizes[s.size] || 0) + alloc;
                });
              });
            }

            const ticketData = {
              serialNo: serialStr,
              customer: customerName,
              modelCode: order.modelCode,
              leather: order.colors && order.colors[0] ? order.colors[0].color : 'Standart',
              sole: '-',
              mold: '-',
              gender: 'kadin',
              totalPairs: ticketQty,
              sizes: proRatedSizes,
              stage: 'kesim',
              orderId: order.id,
              deliveryDate: deliveryDate,
              createdAt: new Date().toISOString()
            };

            await dbAdd('job_tickets', ticketData);
          }

          showToast(`${numTickets} adet iş takip fişi başarıyla üretildi ve imalata alındı! 🚀`, 'success');
          closeModalById('order-split-modal');

          if (window.JobTickets && typeof window.JobTickets.loadTickets === 'function') {
            await window.JobTickets.loadTickets();
          }
        } catch (err) {
          console.error(err);
          showToast('Fişler oluşturulurken hata oluştu: ' + err.message, 'error');
        }
      };

      openModalById('order-split-modal');
    } catch (err) {
      console.error(err);
      showToast('Hata oluştu: ' + err.message, 'error');
    }
  },

  generateCode39SVG(text) {
    const Code39Map = {
      '0': '111221211', '1': '211211112', '2': '112211112', '3': '212211111',
      '4': '111221112', '5': '211221111', '6': '112221111', '7': '111211212',
      '8': '211211211', '9': '112211211', 'A': '211112112', 'B': '112112112',
      'C': '212112111', 'D': '111122112', 'E': '211122111', 'F': '112122111',
      'G': '111112212', 'H': '211112211', 'I': '112112211', 'J': '111122211',
      'K': '211111122', 'L': '112111122', 'M': '212111121', 'N': '111121122',
      'O': '211121121', 'P': '112121121', 'Q': '111111222', 'R': '211111221',
      'S': '112111221', 'T': '111121221', 'U': '221111112', 'V': '122111112',
      'W': '222111111', 'X': '121121112', 'Y': '221121111', 'Z': '122121111',
      '-': '121111212', '.': '221111211', ' ': '122111211', '*': '121121211',
      '$': '121212111', '/': '121211121', '+': '121112121', '%': '111212121'
    };
    
    const trMap = {
      'ç': 'C', 'Ç': 'C', 'ğ': 'G', 'Ğ': 'G', 'ı': 'I', 'İ': 'I',
      'ö': 'O', 'Ö': 'O', 'ş': 'S', 'Ş': 'S', 'ü': 'U', 'Ü': 'U'
    };
    let clean = text;
    for (let char in trMap) {
      clean = clean.replaceAll(char, trMap[char]);
    }
    const cleanText = '*' + clean.toUpperCase().replace(/[^0-9A-Z\-.\s$/+%]/g, '-') + '*';
    let svgContent = '';
    let x = 0;
    const narrowWidth = 1.5;
    const wideWidth = 3.5;
    const height = 40;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const pattern = Code39Map[char] || Code39Map['-'];
      for (let j = 0; j < 9; j++) {
        const isBar = (j % 2 === 0);
        const isWide = (pattern[j] === '2');
        const width = isWide ? wideWidth : narrowWidth;
        if (isBar) {
          svgContent += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="black" />`;
        }
        x += width;
      }
      x += narrowWidth; // Gap
    }
    
    return `<svg width="100%" height="100%" viewBox="0 0 ${x} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
  },

  async openLabelModal(orderId) {
    try {
      const order = await dbGet('orders', orderId);
      if (!order) {
        showToast('Sipariş bulunamadı!', 'error');
        return;
      }

      const contacts = await dbGetAll('contacts');
      const contact = contacts.find(c => c.id === order.contactId);
      const contactName = contact ? contact.name : 'Bilinmeyen Müşteri';
      const contactPhone = contact ? (contact.phone || '-') : '-';
      const contactAddress = contact ? (contact.address || '-') : '-';

      // Load persistent sender name
      let savedSender = localStorage.getItem('atolyecim_label_sender_name');
      if (!savedSender) savedSender = 'AYDEMİR AYAKKABI';
      
      // Select elements
      const inputSender = document.getElementById('label-input-sender');
      const inputReceiverName = document.getElementById('label-input-receiver-name');
      const inputReceiverPhone = document.getElementById('label-input-receiver-phone');
      const inputReceiverAddress = document.getElementById('label-input-receiver-address');
      const selectColor = document.getElementById('label-input-color-select');
      const inputKoliNo = document.getElementById('label-input-koli-no');
      const inputKoliTotal = document.getElementById('label-input-koli-total');
      const inputKlise = document.getElementById('label-input-klise');
      const inputAccessory = document.getElementById('label-input-accessory');
      const inputBarcode = document.getElementById('label-input-barcode');
      const inputNotes = document.getElementById('label-input-notes');

      // Populate Inputs
      inputSender.value = savedSender;
      inputReceiverName.value = contactName;
      inputReceiverPhone.value = contactPhone;
      inputReceiverAddress.value = contactAddress;
      inputKoliNo.value = 1;
      inputKoliTotal.value = 1;
      inputKlise.value = order.klise || '';
      inputAccessory.value = order.accessoryColor || '';
      inputNotes.value = '';

      // Populate Color Select
      selectColor.innerHTML = '';
      if (order.colors && order.colors.length > 0) {
        if (order.colors.length > 1) {
          selectColor.innerHTML += '<option value="all">Tüm Sipariş (Tek Koli)</option>';
        }
        order.colors.forEach(c => {
          selectColor.innerHTML += `<option value="${this.escape(c.color)}">${this.escape(c.color)}</option>`;
        });
      } else {
        selectColor.innerHTML += '<option value="standart">Standart</option>';
      }

      // Populate Barcode (default)
      const sanitizeBarcodeText = (txt) => {
        return trToAscii(txt).toUpperCase().replace(/[^0-9A-Z\-.\s$/+%]/g, '-');
      };
      
      const updateBarcodeDefault = () => {
        const colorVal = selectColor.value === 'all' ? 'HEPSI' : selectColor.value;
        const rawCode = `ORD-${order.id}-${colorVal}-${inputKoliNo.value}`;
        inputBarcode.value = sanitizeBarcodeText(rawCode);
      };

      updateBarcodeDefault();

      // Render sizes based on selection
      const sizeContainer = document.getElementById('label-size-inputs-container');
      
      const renderSizesForm = () => {
        sizeContainer.innerHTML = '';
        let sizesData = [];

        if (selectColor.value === 'all') {
          // Merge all colors sizes
          const merged = {};
          if (order.colors) {
            order.colors.forEach(c => {
              if (c.sizes) {
                c.sizes.forEach(s => {
                  merged[s.size] = (merged[s.size] || 0) + parseInt(s.qty || 0);
                });
              }
            });
          }
          sizesData = Object.keys(merged).map(sz => ({ size: sz, qty: merged[sz] }));
        } else if (order.colors) {
          // Specific color
          const colObj = order.colors.find(c => c.color === selectColor.value);
          if (colObj && colObj.sizes) {
            sizesData = colObj.sizes.map(s => ({ size: s.size, qty: s.qty }));
          }
        }

        if (sizesData.length === 0) {
          sizeContainer.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">Numara dağılımı bulunamadı.</span>';
          return;
        }

        sizesData.forEach(s => {
          const div = document.createElement('div');
          div.style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 45px;';
          div.innerHTML = `
            <span style="font-size: 11px; font-weight: bold; margin-bottom: 2px; color: var(--text-accent);">${this.escape(s.size)}</span>
            <input type="number" class="size-qty-input" data-size="${this.escape(s.size)}" min="0" value="${s.qty}" style="width: 100%; text-align: center; padding: 4px; border-radius: 4px; border: 1px solid var(--border-card); background: var(--bg-primary); color: var(--text-primary); font-size: 12px;">
          `;
          sizeContainer.appendChild(div);
        });

        // Add event listener to each size input to update preview
        sizeContainer.querySelectorAll('.size-qty-input').forEach(inp => {
          inp.oninput = () => {
            updatePreview();
          };
        });
      };

      // Function to build/render the preview layout
      const updatePreview = () => {
        // Save sender name in localStorage
        localStorage.setItem('atolyecim_label_sender_name', inputSender.value.trim());

        // Update basic preview fields
        document.getElementById('lbl-sender-preview').textContent = inputSender.value.trim() || '-';
        document.getElementById('lbl-receiver-name-preview').textContent = inputReceiverName.value.trim() || '-';
        document.getElementById('lbl-receiver-phone-preview').textContent = `TEL: ${inputReceiverPhone.value.trim() || '-'}`;
        document.getElementById('lbl-receiver-address-preview').textContent = inputReceiverAddress.value.trim() || '-';
        document.getElementById('lbl-koli-no-preview').textContent = `${inputKoliNo.value} / ${inputKoliTotal.value}`;
        
        document.getElementById('lbl-model-preview').textContent = order.modelCode || '-';
        document.getElementById('lbl-color-preview').textContent = selectColor.value === 'all' ? 'TÜM RENKLER' : selectColor.value.toUpperCase();
        
        document.getElementById('lbl-klise-preview').textContent = inputKlise.value.trim() || '-';
        document.getElementById('lbl-accessory-preview').textContent = inputAccessory.value.trim() || '-';
        
        document.getElementById('lbl-notes-preview').textContent = inputNotes.value.trim() || 'YOK';
        document.getElementById('lbl-date-preview').textContent = new Date().toLocaleDateString('tr-TR');

        // Render Size Table in preview
        const trHead = document.getElementById('lbl-size-tr-head');
        const trBody = document.getElementById('lbl-size-tr-body');
        trHead.innerHTML = '';
        trBody.innerHTML = '';

        let totalQty = 0;
        const sizeInputs = sizeContainer.querySelectorAll('.size-qty-input');
        if (sizeInputs.length > 0) {
          sizeInputs.forEach(inp => {
            const sz = inp.getAttribute('data-size');
            const qty = parseInt(inp.value) || 0;
            totalQty += qty;

            const th = document.createElement('th');
            th.style.padding = '4px 2px';
            th.style.border = '1px solid #000';
            th.style.color = '#000';
            th.textContent = sz;
            trHead.appendChild(th);

            const td = document.createElement('td');
            td.style.padding = '4px 2px';
            td.style.border = '1px solid #000';
            td.style.color = '#000';
            td.textContent = qty || '-';
            trBody.appendChild(td);
          });
        } else {
          trHead.innerHTML = '<th style="padding: 4px 2px; border:1px solid #000; color:#000;">Beden</th>';
          trBody.innerHTML = '<td style="padding: 4px 2px; border:1px solid #000; color:#000;">-</td>';
        }

        document.getElementById('lbl-total-qty-preview').textContent = `${totalQty} Çift`;

        // Render Barcode
        const barcodeVal = sanitizeBarcodeText(inputBarcode.value.trim()) || 'ORD-0';
        const svgBarcode = this.generateCode39SVG(barcodeVal);
        document.getElementById('lbl-barcode-svg-container').innerHTML = svgBarcode;
        document.getElementById('lbl-barcode-text-preview').textContent = `*${barcodeVal.toUpperCase()}*`;
      };

      // Set up listeners for configuration fields
      inputSender.oninput = updatePreview;
      inputReceiverName.oninput = updatePreview;
      inputReceiverPhone.oninput = updatePreview;
      inputReceiverAddress.oninput = updatePreview;
      
      inputKoliNo.oninput = () => {
        updateBarcodeDefault();
        updatePreview();
      };
      
      inputKoliTotal.oninput = updatePreview;
      inputKlise.oninput = updatePreview;
      inputAccessory.oninput = updatePreview;
      
      inputBarcode.oninput = () => {
        inputBarcode.value = sanitizeBarcodeText(inputBarcode.value);
        updatePreview();
      };
      
      inputNotes.oninput = updatePreview;

      selectColor.onchange = () => {
        renderSizesForm();
        updateBarcodeDefault();
        updatePreview();
      };

      // Initial render of sizes form & preview
      renderSizesForm();
      updatePreview();

      // Bind Print Button
      const printBtn = document.getElementById('btn-label-print');
      printBtn.onclick = () => {
        document.body.classList.add('printing-label');
        window.print();
        document.body.classList.remove('printing-label');
      };

      openModalById('label-modal');
    } catch (err) {
      showToast('Koli etiketi hazırlanamadı: ' + err.message, 'error');
    }
  },

  async openApproveModal(id) {
    try {
      const o = await dbGet('orders', id);
      if (!o) return;

      document.getElementById('approve-order-id').value = o.id;
      document.getElementById('approve-customer-raw').textContent = o.customerName || 'Bilinmeyen Müşteri';
      document.getElementById('approve-price').value = o.price || 0;
      document.getElementById('approve-deadline').value = new Date().toISOString().split('T')[0];
      document.getElementById('approve-new-contact-chk').checked = false;

      // Populate contacts select
      const contacts = await dbGetAll('contacts');
      const customers = contacts.filter(c => c.type === 'musteri' || c.type === 'ikisi');
      const select = document.getElementById('approve-contact-id');
      if (select) {
        select.innerHTML = '<option value="">Cari Seçiniz</option>' + customers.map(c => `<option value="${c.id}">${this.escape(c.name)}</option>`).join('');
      }

      openModalById('incoming-order-approve-modal');
    } catch (e) {
      showToast('Hata: ' + e.message, 'error');
    }
  },

  async rejectIncomingOrder(id) {
    if (!confirm('Bu gelen siparişi reddetmek ve silmek istediğinizden emin misiniz?')) return;
    try {
      await dbDelete('orders', id);
      showToast('Gelen sipariş reddedildi.', 'info');
      await this.loadOrders();
    } catch (e) {
      showToast('Hata: ' + e.message, 'error');
    }
  },

  async submitApproval() {
    const orderId = document.getElementById('approve-order-id').value;
    const select = document.getElementById('approve-contact-id');
    const newContactChk = document.getElementById('approve-new-contact-chk');
    const priceInput = document.getElementById('approve-price');
    const deadlineInput = document.getElementById('approve-deadline');

    if (!orderId) return;

    try {
      const o = await dbGet('orders', orderId);
      if (!o) throw new Error('Sipariş kaydı bulunamadı.');

      let contactId = null;

      if (newContactChk && newContactChk.checked) {
        // Auto-create contact
        const rawName = document.getElementById('approve-customer-raw').textContent.trim();
        const newContact = {
          name: rawName,
          type: 'musteri',
          phone: o.customerPhone || '',
          email: '',
          notes: 'B2B Katalog Sipariş Portalı üzerinden otomatik oluşturuldu.'
        };
        const newContactId = await dbAdd('contacts', newContact);
        contactId = newContactId;
      } else {
        if (!select || !select.value) {
          showToast('Lütfen eşleştirmek için bir Cari Kart seçin veya yeni kart oluşturma seçeneğini işaretleyin!', 'error');
          return;
        }
        const selectedValue = select.value;
        const parsed = parseInt(selectedValue);
        contactId = isNaN(parsed) || parsed.toString() !== selectedValue.trim() ? selectedValue : parsed;
      }

      const price = parseFloat(priceInput.value) || 0;
      const deadline = deadlineInput.value;

      if (price <= 0 || !deadline) {
        showToast('Lütfen fiyat ve termin tarihlerini eksiksiz doldurun!', 'error');
        return;
      }

      // Check stock and deduct (non-blocking)
      const isStockOk = await this.verifyAndDeductStockForColors(o.colors);
      if (!isStockOk) return; // User cancelled stock deduction warning, abort!

      // Update order status and activate it
      o.contactId = contactId;
      o.price = price;
      o.deadline = deadline;
      o.status = 'beklemede';
      o.date = new Date().toISOString(); // Set active order date to approval date

      await dbUpdate('orders', o);

      // Map B2B push subscription to contactId if clientPushEndpoint exists
      if (o.clientPushEndpoint && window.supabaseClient) {
        try {
          await window.supabaseClient
            .from('push_subscriptions')
            .update({ contact_id: contactId })
            .eq('endpoint', o.clientPushEndpoint);
        } catch (err) {
          console.warn('Failed to associate client push subscription with contact:', err);
        }
      }

      // Send push notification to the client
      const workshopId = localStorage.getItem('saas_workshop_id') || 'default_workshop';
      fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workshopId,
          title: 'Siparişiniz Onaylandı! 👟',
          message: `${o.modelCode} model kodlu ${o.qty} çift siparişiniz aktif imalata alındı.`,
          userType: 'client',
          contactId: contactId
        })
      }).catch(err => console.warn('Client push notification failed on approval:', err));

      // Add financial transaction to the customer
      const amount = parseFloat((o.qty * o.price).toFixed(2));
      const tx = {
        contactId: contactId,
        type: 'alacak',
        amount: amount,
        description: `${o.modelCode} — ${o.qty} Çift (Katalogdan Gelen Sipariş Onayı)`,
        orderId: o.id,
        date: new Date().toISOString()
      };
      await dbAdd('transactions', tx);
      closeModalById('incoming-order-approve-modal');
      showToast('Sipariş başarıyla onaylandı ve üretime alındı! 🚀', 'success');

      // Send WhatsApp approval notification if customerPhone exists (via user gesture modal)
      if (o.customerPhone) {
        try {
          const formattedPhone = formatPhone(o.customerPhone);
          const waMsg = `Merhaba, #${o.id} nolu ${o.modelCode} model kodlu ${o.qty} çift siparişiniz onaylandı ve imalata/hazırlanmaya alındı! 👟`;
          const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(waMsg)}`;
          openWhatsAppPrompt(
            waUrl,
            'Sipariş Onaylandı! 🚀',
            `#${o.id} nolu sipariş onaylandı. Müşterinize WhatsApp üzerinden sipariş onay/hazırlık bildirimi göndermek ister misiniz?`
          );
        } catch (err) {
          console.error('WhatsApp notification failed on approval:', err);
        }
      }

      await this.loadOrders();

      if (window.Dashboard && typeof window.Dashboard.render === 'function') {
        await window.Dashboard.render();
      }
    } catch (e) {
      showToast('Hata: ' + e.message, 'error');
    }
  },

  async openQuickOrderModal() {
    const form = document.getElementById('quick-order-form');
    if (form) form.reset();

    const contacts = await dbGetAll('contacts');
    const customers = contacts.filter(c => c.type === 'musteri');
    const contactSelect = document.getElementById('quick-order-contact-id');
    if (contactSelect) {
      contactSelect.innerHTML = '<option value="">Seçiniz</option>' + customers.map(c => `<option value="${c.id}">${this.escape(c.name)}</option>`).join('');
    }

    document.querySelectorAll('.quick-size-input').forEach(input => {
      input.value = '0';
    });
    const totalPreview = document.getElementById('quick-order-total-preview');
    if (totalPreview) totalPreview.textContent = 'TOPLAM: 0 çift';

    const modelInput = document.getElementById('quick-order-model-code');
    if (modelInput && !modelInput._quickBound) {
      modelInput._quickBound = true;
      modelInput.addEventListener('input', async (e) => {
        const mCode = e.target.value.trim();
        await this.updateQuickColorsList(mCode);
      });
    }

    const matrix = document.getElementById('quick-order-matrix');
    if (matrix && !matrix._bound) {
      matrix._bound = true;
      matrix.addEventListener('input', () => {
        let total = 0;
        document.querySelectorAll('.quick-size-input').forEach(input => {
          total += parseInt(input.value, 10) || 0;
        });
        const preview = document.getElementById('quick-order-total-preview');
        if (preview) preview.textContent = `TOPLAM: ${total} çift`;
      });
    }

    const deadlineInput = document.getElementById('quick-order-deadline');
    if (deadlineInput) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 15);
      deadlineInput.value = defaultDate.toISOString().split('T')[0];
    }

    const quickForm = document.getElementById('quick-order-form');
    if (quickForm && !quickForm._boundSubmit) {
      quickForm._boundSubmit = true;
      quickForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveQuickOrder();
      });
    }

    openModalById('quick-order-modal');
  },

  async updateQuickColorsList(mCode) {
    let datalist = document.getElementById('quick-colors-list');
    if (!datalist) return;
    if (!mCode) {
      datalist.innerHTML = '';
      return;
    }
    const products = await dbGetAll('products');
    const matches = products.filter(p => (p.modelCode || '').toLowerCase() === mCode.toLowerCase());
    datalist.innerHTML = matches.map(p => `<option value="${this.escape(p.color)}">`).join('');

    const priceInput = document.getElementById('quick-order-price');
    if (priceInput && !priceInput.value && matches.length > 0) {
      priceInput.value = matches[0].price || 0;
    }
  },

  async saveQuickOrder() {
    const contactId = parseInt(document.getElementById('quick-order-contact-id').value, 10);
    const modelCode = document.getElementById('quick-order-model-code').value.trim();
    const color = document.getElementById('quick-order-color').value.trim();
    const price = parseFloat(document.getElementById('quick-order-price').value) || 0;
    const currency = document.getElementById('quick-order-currency').value || 'TRY';
    const deadline = document.getElementById('quick-order-deadline').value;
    const klise = document.getElementById('quick-order-klise').value.trim();
    const accessoryColor = document.getElementById('quick-order-accessory').value.trim();

    if (!contactId || !modelCode || !color || price <= 0 || !deadline) {
      showToast('Lütfen tüm zorunlu alanları doldurun!', 'error');
      return;
    }

    const sizes = [];
    let totalQty = 0;
    document.querySelectorAll('.quick-size-input').forEach(input => {
      const size = input.dataset.size;
      const qty = parseInt(input.value, 10) || 0;
      if (qty > 0) {
        sizes.push({ size, qty });
        totalQty += qty;
      }
    });

    if (totalQty === 0) {
      showToast('Lütfen en az bir adet numara/adet girin!', 'error');
      return;
    }

    const products = await dbGetAll('products');
    let match = products.find(p => 
      (p.modelCode || '').toLowerCase() === modelCode.toLowerCase() && 
      (p.color || '').toLowerCase() === color.toLowerCase()
    );

    if (!match) {
      const templateProduct = products.find(p => (p.modelCode || '').toLowerCase() === modelCode.toLowerCase());
      const newProduct = {
        modelCode,
        color,
        category: templateProduct ? templateProduct.category : 'Ayakkabı',
        size: templateProduct ? templateProduct.size : '36-45',
        soleMaterial: templateProduct ? templateProduct.soleMaterial : '',
        leatherLining: templateProduct ? templateProduct.leatherLining : '',
        leatherUpper: templateProduct ? templateProduct.leatherUpper : '',
        leatherType: templateProduct ? templateProduct.leatherType : '',
        price,
        currency,
        barcode: '',
        photo: '',
        accessoryPhoto: ''
      };
      const newProductId = await dbAdd('products', newProduct);
      if (templateProduct) {
        const templateRecipe = await dbGet('recipes', templateProduct.id);
        if (templateRecipe) {
          const newRecipe = {
            productId: newProductId,
            materials: JSON.parse(JSON.stringify(templateRecipe.materials))
          };
          await dbAdd('recipes', newRecipe);
        }
      }
      match = { id: newProductId, color };
      showToast(`Yeni ürün otomatik kaydedildi: ${modelCode} (${color})`, 'info');
    }

    const colorsForDb = [{
      productId: match.id,
      color,
      qty: totalQty,
      sizes
    }];

    const isStockOk = await this.verifyAndDeductStockForColors(colorsForDb);
    if (!isStockOk) return;

    const orderData = {
      contactId,
      modelCode,
      colors: colorsForDb,
      qty: totalQty,
      price,
      currency,
      deadline,
      klise,
      accessoryColor,
      status: 'beklemede',
      date: new Date().toISOString()
    };

    const orderId = await dbAdd('orders', orderData);

    const amount = parseFloat((totalQty * price).toFixed(2));
    const tx = {
      contactId,
      type: 'alacak',
      amount,
      currency,
      description: `${modelCode} (${color}) — ${totalQty} Çift Hızlı Sipariş`,
      orderId,
      date: new Date().toISOString()
    };
    await dbAdd('transactions', tx);

    if (window.sendNotificationAlert) {
      const contactSelect = document.getElementById('quick-order-contact-id');
      const customerName = contactSelect.options[contactSelect.selectedIndex]?.text || 'Bilinmeyen Müşteri';
      window.sendNotificationAlert('new-order', `Hizli Siparis Alindi! Siparis ID: #${orderId}, Musteri: ${customerName}, Model: ${modelCode}, Toplam: ${totalQty} cift.`);
    }

    showToast('Hızlı sipariş başarıyla kaydedildi ve stoktan düşüldü!', 'success');
    closeModalById('quick-order-modal');
    await this.render();
    if (window.Dashboard && typeof window.Dashboard.render === 'function') {
      await window.Dashboard.render();
    }
  },

  async openEmailImportModal() {
    const textarea = document.getElementById('email-order-text');
    if (textarea) textarea.value = '';

    const resultCard = document.getElementById('email-parse-result-card');
    if (resultCard) resultCard.style.display = 'none';

    const contacts = await dbGetAll('contacts');
    const customers = contacts.filter(c => c.type === 'musteri');
    const contactSelect = document.getElementById('email-parsed-contact');
    if (contactSelect) {
      contactSelect.innerHTML = '<option value="">Seçiniz</option>' + customers.map(c => `<option value="${c.id}">${this.escape(c.name)}</option>`).join('');
    }

    const deadlineInput = document.getElementById('email-parsed-deadline');
    if (deadlineInput) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 15);
      deadlineInput.value = defaultDate.toISOString().split('T')[0];
    }

    const parseBtn = document.getElementById('btn-email-parse');
    if (parseBtn && !parseBtn._bound) {
      parseBtn._bound = true;
      parseBtn.addEventListener('click', () => this.parseEmailContent());
    }

    const samples = {
      'sample-1': `Konu: Sipariş Talebi - Ahmet Kundura\n\nMerhaba,\nA-102 model kodlu Siyah ayakkabıdan aşağıdaki numaralara göre sipariş vermek istiyoruz:\n\n38 numara: 5 çift\n39 numara: 10 çift\n40 numara: 8 çift\n41 numara: 2 çift\n\nEn kısa sürede teslim edilmesini rica ederiz.\n\nİyi çalışmalar,\nAhmet Kundura`,
      'sample-2': `Gönderen: Furkan Mağazacılık <furkan@email.com>\nTarih: 23 Temmuz 2026 14:20\n\nYeni sipariş:\nModel: M-420 Kahverengi\n\nDağılım:\n38 numara -> 3 çift\n40 numara -> 5 çift\n41 numara -> 5 çift\n42 numara -> 10 çift\n43 numara -> 2 çift\n\nSevk Adresi: İstanbul İstoç Depo\nBirim fiyatı 450 TL olarak anlaştığımız gibi.\n\nTeşekkürler.`,
      'sample-3': `Müşteri Adı: Ayakkabı Dünyası\nSipariş Detayı:\nModel: B-310 Beyaz\nAdetler:\n36: 10\n37: 15\n38: 15\n39: 10\n40: 5\n\nFiyat: 600 TL`
    };

    Object.entries(samples).forEach(([id, text]) => {
      const btn = document.getElementById(`btn-email-${id}`);
      if (btn && !btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', () => {
          if (textarea) textarea.value = text;
        });
      }
    });

    // PDF File upload handler
    const pdfInput = document.getElementById('email-pdf-file');
    if (pdfInput && !pdfInput._bound) {
      pdfInput._bound = true;
      pdfInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
          showToast('Lütfen geçerli bir PDF dosyası seçin!', 'error');
          return;
        }

        showToast('PDF yükleniyor ve okunuyor...', 'info');

        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = window['pdfjs-dist/build/pdf'];
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
          
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          let extractedText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items;
            let lastY = -1;
            let pageText = '';
            
            for (const item of textItems) {
              if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                pageText += '\n';
              }
              pageText += item.str + ' ';
              lastY = item.transform[5];
            }
            extractedText += pageText + '\n';
          }
          
          if (textarea) {
            textarea.value = extractedText.trim();
            showToast('PDF metni başarıyla okundu! Şimdi tarıyoruz...', 'success');
            this.parseEmailContent();
          }
        } catch (err) {
          console.error(err);
          showToast('PDF okunurken bir hata oluştu: ' + err.message, 'error');
        }
      });
    }

    const saveBtn = document.getElementById('btn-email-save-incoming');
    if (saveBtn && !saveBtn._bound) {
      saveBtn._bound = true;
      saveBtn.addEventListener('click', () => this.saveEmailParsedOrder());
    }

    openModalById('email-order-modal');
  },

  async parseEmailContent() {
    const text = document.getElementById('email-order-text').value.trim();
    if (!text) {
      showToast('Lütfen e-posta içeriğini yapıştırın!', 'error');
      return;
    }

    let matchedContactId = "";
    const contacts = await dbGetAll('contacts');
    const customers = contacts.filter(c => c.type === 'musteri');
    
    for (const c of customers) {
      const regex = new RegExp(c.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      if (regex.test(text)) {
        matchedContactId = c.id;
        break;
      }
    }

    let modelCode = "";
    const modelRegex = /(?:model(?:\s*kodu)?:?\s*|\b)([A-Z]{1,3}[-_\s]?[0-9]{2,4})\b/i;
    const modelMatch = text.match(modelRegex);
    if (modelMatch) {
      modelCode = modelMatch[1].toUpperCase().replace(/\s+/, '-');
    }

    let color = "Siyah";
    const colors = ["Siyah", "Beyaz", "Kahverengi", "Taba", "Lacivert", "Kırmızı", "Mavi", "Yeşil", "Gri", "Bej", "Bordo", "Vizon", "Taba"];
    for (const col of colors) {
      const colReg = new RegExp(`\\b${col}\\b`, 'i');
      if (colReg.test(text)) {
        color = col;
        break;
      }
    }

    let price = "";
    const priceRegex = /(?:birim\s*)?fiyat(?:ı|u)?:?\s*(\d+(?:[.,]\d+)?)\s*(?:tl|₺|lira)?|(\d+(?:[.,]\d+)?)\s*(?:tl|₺|lira)/i;
    const priceMatch = text.match(priceRegex);
    if (priceMatch) {
      price = parseFloat((priceMatch[1] || priceMatch[2]).replace(',', '.'));
    }

    const sizes = [];
    const tempMap = {};
    const lines = text.split(/\r?\n/);

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Skip header lines or pure price lines
      if (/^(gönderen|tarih|konu|sevk adresi|müşteri adı|sipariş detay)/i.test(line)) {
        continue;
      }
      if (/(birim fiyat|fiyatı|fiyat:)\s*\d+/i.test(line) && !/(3[5-9]|4[0-8])\s*[:->]/i.test(line)) {
        continue;
      }

      // Find all size and quantity patterns in line
      const sizeRegex = /\b(3[5-9]|4[0-8])\b(?:[^\d\n]*?)\b(\d{1,4})\b/g;
      let m;
      while ((m = sizeRegex.exec(line)) !== null) {
        const size = m[1];
        const qty = parseInt(m[2], 10);
        
        if (qty > 0 && qty < 5000 && !tempMap[size]) {
          if (qty >= 2020 && qty <= 2030) continue; // Skip years like 2026
          tempMap[size] = qty;
          sizes.push({ size, qty });
        }
      }
    }

    const contactSelect = document.getElementById('email-parsed-contact');
    if (contactSelect && matchedContactId) {
      contactSelect.value = matchedContactId;
    }

    const modelInput = document.getElementById('email-parsed-model');
    if (modelInput) {
      modelInput.value = modelCode;
    }

    const priceInput = document.getElementById('email-parsed-price');
    if (priceInput) {
      if (price) {
        priceInput.value = price;
      } else {
        const products = await dbGetAll('products');
        const prod = products.find(p => (p.modelCode || '').toLowerCase() === modelCode.toLowerCase());
        priceInput.value = prod ? prod.price : '';
      }
    }

    const previewDiv = document.getElementById('email-parsed-items-preview');
    if (previewDiv) {
      if (sizes.length === 0) {
        previewDiv.innerHTML = `<span style="color: var(--color-danger); font-weight: bold;">Hata: Numara/adet dağılımı ayrıştırılamadı. Lütfen kontrol edin!</span>`;
      } else {
        const total = sizes.reduce((acc, s) => acc + s.qty, 0);
        previewDiv.innerHTML = `
          <strong>Renk:</strong> <input type="text" id="email-parsed-color" value="${color}" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 2px 6px; color: var(--text-accent); font-weight: 700; width: 80px; text-align: center;"><br>
          <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
            ${sizes.map(s => `<span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;"><strong>${s.size}</strong>: ${s.qty} çift</span>`).join('')}
          </div>
          <div style="margin-top: 10px; font-weight: bold; color: var(--accent-primary);">Toplam: ${total} çift</div>
        `;
        previewDiv.tempSizes = sizes;
      }
    }

    const resultCard = document.getElementById('email-parse-result-card');
    if (resultCard) {
      resultCard.style.display = 'block';
    }
    showToast('E-posta başarıyla tarandı!', 'success');
  },

  async saveEmailParsedOrder() {
    const contactId = parseInt(document.getElementById('email-parsed-contact').value, 10);
    const modelCode = document.getElementById('email-parsed-model').value.trim();
    const price = parseFloat(document.getElementById('email-parsed-price').value) || 0;
    const deadline = document.getElementById('email-parsed-deadline').value;
    const color = document.getElementById('email-parsed-color')?.value?.trim() || 'Siyah';

    const previewDiv = document.getElementById('email-parsed-items-preview');
    const sizes = previewDiv ? previewDiv.tempSizes : [];

    if (!contactId || !modelCode || price <= 0 || !deadline || !sizes || sizes.length === 0) {
      showToast('Lütfen önizleme alanındaki tüm bilgileri eksiksiz doldurun ve geçerli numara dağılımı girildiğinden emin olun!', 'error');
      return;
    }

    const totalQty = sizes.reduce((acc, s) => acc + s.qty, 0);

    const incomingOrderData = {
      contactId,
      modelCode,
      colors: [{
        color,
        qty: totalQty,
        sizes
      }],
      qty: totalQty,
      price,
      deadline,
      status: 'gelen',
      date: new Date().toISOString()
    };

    await dbAdd('orders', incomingOrderData);

    showToast('Sipariş başarıyla "Gelen Siparişler" sekmesine eklendi!', 'success');
    closeModalById('email-order-modal');
    await this.render();
    
    const tabIncoming = document.getElementById('btn-tab-incoming-orders');
    if (tabIncoming) tabIncoming.click();
  },

  escape(str) {
    return escapeHtml(str);
  }
};

const Recipes = {
  currentProductId: null,
  currentMaterials: [],

  async openModal(productId) {
    this.currentProductId = productId;
    this.currentMaterials = [];

    const product = await dbGet('products', productId);
    if (!product) {
      showToast('Ürün bulunamadı!', 'error');
      return;
    }

    const titleEl = document.getElementById('recipe-modal-title');
    if (titleEl) titleEl.textContent = `${product.modelCode} — İmalat Reçetesi (BOM) & Maliyet Analizi`;
    document.getElementById('recipe-product-id').value = productId;

    // Reset manual form fields
    const typeSelect = document.getElementById('recipe-material-type');
    if (typeSelect) typeSelect.value = '';
    const nameInput = document.getElementById('recipe-material-name');
    if (nameInput) nameInput.value = '';
    const qtyInput = document.getElementById('recipe-material-qty');
    if (qtyInput) qtyInput.value = '';
    const unitSelect = document.getElementById('recipe-material-unit');
    if (unitSelect) unitSelect.value = 'çift';
    const priceInput = document.getElementById('recipe-material-unit-price');
    if (priceInput) priceInput.value = '';

    // Populate stock suggestions datalist
    await this.populateStockSuggestions();

    // Load existing recipe
    const recipe = await dbGet('recipes', productId);
    if (recipe && recipe.materials && Array.isArray(recipe.materials)) {
      this.currentMaterials = JSON.parse(JSON.stringify(recipe.materials));
    }

    this.bindEvents();
    await this.renderMaterialsTable();

    openModalById('recipe-modal');
  },

  async populateStockSuggestions() {
    const datalist = document.getElementById('recipe-stock-suggestions');
    if (!datalist) return;
    try {
      const stocks = await dbGetAll('stocks');
      datalist.innerHTML = stocks.map(s => `<option value="${this.escape(s.name)}" data-price="${s.price || 0}" data-unit="${s.unit || 'adet'}">`).join('');
    } catch (e) {
      console.warn('Stock suggestions load failed:', e);
    }
  },

  bindEvents() {
    // 1-Click BOM Templates
    const templateButtons = document.querySelectorAll('.btn-recipe-template');
    templateButtons.forEach(btn => {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', () => {
          const tName = btn.dataset.template;
          this.applyShoeTemplate(tName);
        });
      }
    });

    // Clear all button
    const clearBtn = document.getElementById('btn-recipe-clear-all');
    if (clearBtn && !clearBtn._bound) {
      clearBtn._bound = true;
      clearBtn.addEventListener('click', () => {
        if (this.currentMaterials.length === 0) return;
        if (confirm('Reçetedeki tüm malzemeleri temizlemek istediğinizden emin misiniz?')) {
          this.currentMaterials = [];
          this.renderMaterialsTable();
          showToast('Reçete listesi temizlendi.', 'info');
        }
      });
    }

    // Material Name Input Autocomplete Auto-fill unit & price
    const nameInput = document.getElementById('recipe-material-name');
    if (nameInput && !nameInput._bound) {
      nameInput._bound = true;
      nameInput.addEventListener('change', async (e) => {
        const val = e.target.value.trim();
        const stocks = await dbGetAll('stocks');
        const match = stocks.find(s => (s.name || '').toLowerCase() === val.toLowerCase());
        if (match) {
          const unitSelect = document.getElementById('recipe-material-unit');
          if (unitSelect && match.unit) unitSelect.value = match.unit;
          const priceInput = document.getElementById('recipe-material-unit-price');
          if (priceInput && match.price) priceInput.value = match.price;
        }
      });
    }

    // Material category change defaults
    const typeSelect = document.getElementById('recipe-material-type');
    if (typeSelect && !typeSelect._bound) {
      typeSelect._bound = true;
      typeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        const unitSelect = document.getElementById('recipe-material-unit');
        if (!unitSelect) return;
        if (type === 'leather' || type === 'lining') {
          unitSelect.value = 'dm²';
        } else if (type === 'chemical') {
          unitSelect.value = 'kg';
        } else if (type === 'sole') {
          unitSelect.value = 'çift';
        } else if (type === 'reinforcement') {
          unitSelect.value = 'takım';
        } else {
          unitSelect.value = 'adet';
        }
      });
    }

    // Add material form submit
    const addMatForm = document.getElementById('recipe-add-material-form');
    if (addMatForm && !addMatForm._bound) {
      addMatForm._bound = true;
      addMatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addMaterialItem();
      });
    }

    // Save recipe button
    const saveBtn = document.getElementById('btn-save-recipe');
    if (saveBtn && !saveBtn._bound) {
      saveBtn._bound = true;
      saveBtn.addEventListener('click', () => this.saveRecipe());
    }
  },

  applyShoeTemplate(templateKey) {
    const templates = {
      erkek_kosele: [
        { type: 'leather', name: 'Dana Vidala Yüzlük Deri', qty: 22, unit: 'dm²', price: 9.50 },
        { type: 'lining', name: 'Dana Meş Astar Deri', qty: 16, unit: 'dm²', price: 5.80 },
        { type: 'sole', name: 'Gön Kösele Taban', qty: 1, unit: 'çift', price: 140.00 },
        { type: 'sole', name: 'Klasik Ökçe & Lastik', qty: 1, unit: 'çift', price: 35.00 },
        { type: 'reinforcement', name: 'Termoplastik Fort & Bombe', qty: 1, unit: 'takım', price: 12.00 },
        { type: 'chemical', name: 'Poliüretan Yapıştırıcı & Solüsyon', qty: 0.08, unit: 'kg', price: 180.00 },
        { type: 'chemical', name: 'Deri Cila & Apre Boyası', qty: 0.03, unit: 'kg', price: 220.00 },
        { type: 'accessory', name: 'Mumlanmış Ayakkabı Bağcığı', qty: 1, unit: 'çift', price: 8.00 },
        { type: 'packaging', name: 'Lüks Klasik Ayakkabı Kutusu', qty: 1, unit: 'adet', price: 22.00 }
      ],
      kadin_topuklu: [
        { type: 'leather', name: 'Yumuşak Kuzu Rugan / Süet Deri', qty: 14, unit: 'dm²', price: 11.00 },
        { type: 'lining', name: 'Keçi Astar Derisi', qty: 11, unit: 'dm²', price: 6.50 },
        { type: 'sole', name: 'Jurdan / Neolit İnce Taban', qty: 1, unit: 'çift', price: 65.00 },
        { type: 'sole', name: 'Stiletto İnce Topuk & Çelik Bel', qty: 1, unit: 'çift', price: 45.00 },
        { type: 'sole', name: 'Poliüretan Ökçe Lastiği (Tapa)', qty: 1, unit: 'çift', price: 8.00 },
        { type: 'reinforcement', name: 'İnce Mikro Fort & Bombe', qty: 1, unit: 'takım', price: 10.00 },
        { type: 'chemical', name: 'Ayakkabı Yapıştırıcısı & İlaç', qty: 0.06, unit: 'kg', price: 180.00 },
        { type: 'packaging', name: 'Baskılı Kutu & İpek Kese', qty: 1, unit: 'takım', price: 28.00 }
      ],
      sneaker: [
        { type: 'leather', name: 'Flotter Dana Deri / Tekstil Kombin', qty: 18, unit: 'dm²', price: 8.80 },
        { type: 'lining', name: 'Hava Alan File / Meş Astar', qty: 14, unit: 'dm²', price: 3.50 },
        { type: 'sole', name: 'Hafif Eva / Kauçuk Spor Taban', qty: 1, unit: 'çift', price: 95.00 },
        { type: 'sole', name: 'Anatomik Memory Foam İç Tabanlık', qty: 1, unit: 'çift', price: 25.00 },
        { type: 'reinforcement', name: 'Kumaş Lamine Fort & Bombe', qty: 1, unit: 'takım', price: 11.00 },
        { type: 'chemical', name: 'Primer & PU Taban Yapıştırıcı', qty: 0.07, unit: 'kg', price: 190.00 },
        { type: 'accessory', name: 'Sneaker Yassı Bağcık', qty: 1, unit: 'çift', price: 6.50 },
        { type: 'packaging', name: 'Kraft Sneaker Kutusu & Pelur', qty: 1, unit: 'adet', price: 18.00 }
      ],
      bot: [
        { type: 'leather', name: 'Yağlı Hakiki Deri / Crazy Deri', qty: 32, unit: 'dm²', price: 10.50 },
        { type: 'lining', name: 'Sıcak Kürk Astar / Polar', qty: 24, unit: 'dm²', price: 4.80 },
        { type: 'sole', name: 'Kışlık Dişli Termo / Kauçuk Taban', qty: 1, unit: 'çift', price: 125.00 },
        { type: 'accessory', name: 'Metal Fermuar (Sağ & Sol)', qty: 1, unit: 'çift', price: 16.00 },
        { type: 'accessory', name: 'Kancalı Dağcı Bağcık & Kuşgözü', qty: 1, unit: 'takım', price: 14.00 },
        { type: 'reinforcement', name: 'Kalın Ağır Hizmet Fort & Bombe', qty: 1, unit: 'takım', price: 15.00 },
        { type: 'chemical', name: 'Su Geçirmezlik İlacı & Yapıştırıcı', qty: 0.09, unit: 'kg', price: 210.00 },
        { type: 'packaging', name: 'Büyük Boy Bot Kutusu', qty: 1, unit: 'adet', price: 25.00 }
      ],
      sandalet: [
        { type: 'leather', name: 'Bantlık Yüzlük Deri / Nubuk', qty: 9, unit: 'dm²', price: 9.00 },
        { type: 'lining', name: 'Yumuşak Bant Astarı', qty: 6, unit: 'dm²', price: 4.50 },
        { type: 'sole', name: 'Mantar / Eva Anatomik Taban', qty: 1, unit: 'çift', price: 75.00 },
        { type: 'accessory', name: 'Metal Ayar Tokası', qty: 2, unit: 'adet', price: 6.00 },
        { type: 'chemical', name: 'Kontak Yapıştırıcı', qty: 0.04, unit: 'kg', price: 180.00 },
        { type: 'packaging', name: 'Sandalet Kutusu', qty: 1, unit: 'adet', price: 15.00 }
      ]
    };

    const chosen = templates[templateKey];
    if (!chosen) return;

    this.currentMaterials = JSON.parse(JSON.stringify(chosen));
    this.renderMaterialsTable();
    showToast('Reçete şablonu uygulandı! Maliyetler hesaplandı. ⚡', 'success');
  },

  async addMaterialItem() {
    const type = document.getElementById('recipe-material-type').value;
    const name = document.getElementById('recipe-material-name').value.trim();
    const qty = parseFloat(document.getElementById('recipe-material-qty').value);
    const unit = document.getElementById('recipe-material-unit').value || 'adet';
    const price = parseFloat(document.getElementById('recipe-material-unit-price').value) || 0;

    if (!type || !name || isNaN(qty) || qty <= 0) {
      showToast('Lütfen kategori, malzeme adı ve geçerli sarfiyat miktarı girin!', 'error');
      return;
    }

    // Check if item already exists by name
    const existing = this.currentMaterials.find(m => (m.name || '').toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.qty = qty;
      existing.unit = unit;
      existing.price = price;
      existing.type = type;
      showToast('Mevcut malzeme güncellendi.', 'info');
    } else {
      this.currentMaterials.push({
        type: type,
        name: name,
        qty: qty,
        unit: unit,
        price: price
      });
      showToast('Yeni malzeme reçeteye eklendi.', 'success');
    }

    // Reset fields
    document.getElementById('recipe-material-name').value = '';
    document.getElementById('recipe-material-qty').value = '';
    document.getElementById('recipe-material-unit-price').value = '';

    await this.renderMaterialsTable();
  },

  async renderMaterialsTable() {
    const tbody = document.getElementById('recipe-materials-tbody');
    const empty = document.getElementById('recipe-materials-empty');
    const countEl = document.getElementById('recipe-material-count');

    if (!tbody) return;

    if (countEl) countEl.textContent = `${this.currentMaterials.length} Kalem Malzeme`;

    if (this.currentMaterials.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      this.updateCostSummary(0, 0, 0, 0);
      return;
    }

    if (empty) empty.style.display = 'none';

    const typeConfig = {
      leather: { label: '🥩 Yüzlük Deri', bg: 'rgba(236,72,153,0.1)', color: '#ec4899' },
      lining: { label: '🧵 Astar', bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
      sole: { label: '👟 Taban/Ökçe', bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
      reinforcement: { label: '🛡️ Fort/Bombe', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
      chemical: { label: '🧪 Kimyasal/İlaç', bg: 'rgba(14,165,233,0.1)', color: '#0ea5e9' },
      accessory: { label: '🪡 Aksesuar', bg: 'rgba(99,102,241,0.1)', color: 'var(--text-accent)' },
      packaging: { label: '📦 Ambalaj', bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
      raw: { label: 'Ham Madde', bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }
    };

    let sumLeather = 0;
    let sumSole = 0;
    let sumOther = 0;
    let grandTotal = 0;

    tbody.innerHTML = this.currentMaterials.map((m, idx) => {
      const cfg = typeConfig[m.type] || { label: m.type, bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' };
      const unitPrice = parseFloat(m.price) || 0;
      const rowCost = (m.qty * unitPrice);

      grandTotal += rowCost;
      if (m.type === 'leather' || m.type === 'lining') {
        sumLeather += rowCost;
      } else if (m.type === 'sole' || m.type === 'accessory') {
        sumSole += rowCost;
      } else {
        sumOther += rowCost;
      }

      return `
        <tr>
          <td>
            <span class="category-badge" style="background: ${cfg.bg}; color: ${cfg.color}; font-size: 11px; padding: 2px 6px;">
              ${cfg.label}
            </span>
          </td>
          <td><strong>${this.escape(m.name)}</strong></td>
          <td style="text-align: center; font-weight: 600;">${m.qty} ${this.escape(m.unit)}</td>
          <td style="text-align: right; color: var(--text-secondary);">₺${unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: 700; color: var(--color-warning);">₺${rowCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center;">
            <button class="btn-icon danger" type="button" title="Sil" onclick="Recipes.removeMaterialItem(${idx})">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    this.updateCostSummary(sumLeather, sumSole, sumOther, grandTotal);
  },

  updateCostSummary(leather, sole, other, grandTotal) {
    const format = (val) => `₺${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const badge = document.getElementById('recipe-total-cost-badge');
    if (badge) badge.textContent = format(grandTotal);

    const sumLeatherEl = document.getElementById('recipe-sum-leather');
    if (sumLeatherEl) sumLeatherEl.textContent = format(leather);

    const sumSoleEl = document.getElementById('recipe-sum-sole');
    if (sumSoleEl) sumSoleEl.textContent = format(sole);

    const sumOtherEl = document.getElementById('recipe-sum-other');
    if (sumOtherEl) sumOtherEl.textContent = format(other);

    const grandTotalEl = document.getElementById('recipe-sum-grand-total');
    if (grandTotalEl) grandTotalEl.textContent = format(grandTotal);
  },

  removeMaterialItem(index) {
    this.currentMaterials.splice(index, 1);
    this.renderMaterialsTable();
    showToast('Malzeme reçeteden çıkarıldı.', 'info');
  },

  async saveRecipe() {
    if (this.currentMaterials.length === 0) {
      if (!confirm('Reçetede malzeme kalmadı. Reçeteyi tamamen silmek istediğinizden emin misiniz?')) {
        return;
      }
    }

    try {
      const data = {
        productId: this.currentProductId,
        materials: this.currentMaterials
      };

      await dbUpdate('recipes', data);
      showToast('Reçete ve maliyet analizi başarıyla kaydedildi! 🛠️', 'success');
      closeModalById('recipe-modal');
    } catch (err) {
      showToast('Hata: ' + err.message, 'error');
    }
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.Orders = Orders;
window.Recipes = Recipes;
