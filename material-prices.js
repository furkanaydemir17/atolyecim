/* =========================================
   ATÖLYECİM — Malzeme Fiyat Listesi & Tedarikçi Fiyat Havuzu Modülü
   ========================================= */

import { escapeHtml, generateId } from './utils.js';

const BUILT_IN_CATEGORIES = [
  { id: 'deri', label: 'Deri & Astarlık', icon: '🥩' },
  { id: 'taban', label: 'Taban & Ökçe', icon: '👟' },
  { id: 'aksesuar', label: 'Aksesuar & Toka', icon: '⛓️' },
  { id: 'kimyasal', label: 'Kimyasal & İlaç', icon: '🧪' },
  { id: 'ambalaj', label: 'Kutu & Ambalaj', icon: '📦' },
  { id: 'kalip', label: 'Kalıp & Bıçak', icon: '🔨' }
];

export const MaterialPrices = {
  currentFilterCategory: 'all',
  currentView: 'suppliers', // 'suppliers' or 'comparison'
  searchQuery: '',
  suppliers: [],
  prices: [],
  customCategories: [],
  expandedSuppliers: new Set(),

  toggleSupplierExpand(supplierId) {
    const id = Number(supplierId);
    if (this.expandedSuppliers.has(id)) {
      this.expandedSuppliers.delete(id);
    } else {
      this.expandedSuppliers.add(id);
    }
    this.renderList();
  },

  expandAllSuppliers() {
    this.suppliers.forEach(s => this.expandedSuppliers.add(Number(s.id)));
    this.renderList();
  },

  collapseAllSuppliers() {
    this.expandedSuppliers.clear();
    this.renderList();
  },

  async init() {
    this.loadCustomCategories();
    this.bindEvents();
  },

  loadCustomCategories() {
    try {
      const saved = localStorage.getItem('atolyecim_custom_material_categories');
      this.customCategories = saved ? JSON.parse(saved) : [];
    } catch (e) {
      this.customCategories = [];
    }
  },

  saveCustomCategories() {
    try {
      localStorage.setItem('atolyecim_custom_material_categories', JSON.stringify(this.customCategories));
    } catch (e) {
      console.warn('Failed to save custom categories:', e);
    }
  },

  getAllCategories() {
    return [...BUILT_IN_CATEGORIES, ...this.customCategories];
  },

  getCategoryInfo(catId) {
    const all = this.getAllCategories();
    return all.find(c => c.id === catId) || { id: catId, label: catId || 'Genel', icon: '🏷️' };
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('search-material-prices');
    if (searchInput && !searchInput._bound) {
      searchInput._bound = true;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderList();
      });
    }

    // View Switcher (Suppliers vs Comparison)
    const btnViewSuppliers = document.getElementById('btn-view-suppliers');
    const btnViewComparison = document.getElementById('btn-view-comparison');
    if (btnViewSuppliers && !btnViewSuppliers._bound) {
      btnViewSuppliers._bound = true;
      btnViewSuppliers.addEventListener('click', () => {
        this.currentView = 'suppliers';
        btnViewSuppliers.classList.add('active');
        btnViewComparison?.classList.remove('active');
        this.renderList();
      });
    }
    if (btnViewComparison && !btnViewComparison._bound) {
      btnViewComparison._bound = true;
      btnViewComparison.addEventListener('click', () => {
        this.currentView = 'comparison';
        btnViewComparison.classList.add('active');
        btnViewSuppliers?.classList.remove('active');
        this.renderList();
      });
    }

    // Action Buttons
    const btnAddSupplier = document.getElementById('btn-add-material-supplier');
    if (btnAddSupplier && !btnAddSupplier._bound) {
      btnAddSupplier._bound = true;
      btnAddSupplier.addEventListener('click', () => this.openSupplierModal());
    }

    const btnAddPrice = document.getElementById('btn-add-material-price');
    if (btnAddPrice && !btnAddPrice._bound) {
      btnAddPrice._bound = true;
      btnAddPrice.addEventListener('click', () => this.openPriceModal());
    }

    const btnAddCustomCat = document.getElementById('btn-add-custom-category');
    if (btnAddCustomCat && !btnAddCustomCat._bound) {
      btnAddCustomCat._bound = true;
      btnAddCustomCat.addEventListener('click', () => this.openCustomCategoryModal());
    }

    // Modal Forms
    const supplierForm = document.getElementById('material-supplier-form');
    if (supplierForm && !supplierForm._bound) {
      supplierForm._bound = true;
      supplierForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveSupplier();
      });
    }

    const priceForm = document.getElementById('material-price-form');
    if (priceForm && !priceForm._bound) {
      priceForm._bound = true;
      priceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.savePrice();
      });
    }

    const customCatForm = document.getElementById('custom-category-form');
    if (customCatForm && !customCatForm._bound) {
      customCatForm._bound = true;
      customCatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCustomCategory();
      });
    }
  },

  async loadData() {
    try {
      this.suppliers = await window.dbGetAll('material_suppliers') || [];
      this.prices = await window.dbGetAll('material_prices') || [];
    } catch (e) {
      console.error('Error loading material prices data:', e);
      this.suppliers = [];
      this.prices = [];
    }
  },

  async render() {
    await this.loadData();
    this.renderKPIs();
    this.renderCategoryChips();
    this.renderList();
  },

  renderKPIs() {
    const totalSuppliersEl = document.getElementById('kpi-mp-total-suppliers');
    const totalMaterialsEl = document.getElementById('kpi-mp-total-materials');
    const lastUpdateEl = document.getElementById('kpi-mp-last-update');
    const priceChangesEl = document.getElementById('kpi-mp-price-changes');

    if (totalSuppliersEl) totalSuppliersEl.textContent = this.suppliers.length;

    // Distinct materials count
    const distinctMaterials = new Set(this.prices.map(p => (p.materialName || '').toLowerCase().trim()));
    if (totalMaterialsEl) totalMaterialsEl.textContent = distinctMaterials.size;

    // Last updated price
    if (lastUpdateEl) {
      if (this.prices.length > 0) {
        const sorted = [...this.prices].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
        const latest = sorted[0];
        const dateStr = latest.updatedAt ? new Date(latest.updatedAt).toLocaleDateString('tr-TR') : '-';
        lastUpdateEl.textContent = `${latest.materialName || '-'} (${dateStr})`;
      } else {
        lastUpdateEl.textContent = '-';
      }
    }

    // Price changes count
    if (priceChangesEl) {
      const changedCount = this.prices.filter(p => Array.isArray(p.priceHistory) && p.priceHistory.length > 0).length;
      priceChangesEl.textContent = `${changedCount} Kalem Fiyat Geçmişi`;
    }
  },

  renderCategoryChips() {
    const container = document.getElementById('mp-category-chips');
    if (!container) return;

    const allCategories = this.getAllCategories();
    const activeCat = this.currentFilterCategory;

    let html = `
      <button type="button" class="filter-btn ${activeCat === 'all' ? 'active' : ''}" onclick="window.MaterialPrices.setCategoryFilter('all')">
        Tüm Kategoriler (${this.prices.length})
      </button>
    `;

    allCategories.forEach(cat => {
      const count = this.prices.filter(p => p.category === cat.id).length;
      html += `
        <button type="button" class="filter-btn ${activeCat === cat.id ? 'active' : ''}" onclick="window.MaterialPrices.setCategoryFilter('${cat.id}')">
          <span>${cat.icon}</span> ${escapeHtml(cat.label)} (${count})
        </button>
      `;
    });

    container.innerHTML = html;
  },

  setCategoryFilter(catId) {
    this.currentFilterCategory = catId;
    this.renderCategoryChips();
    this.renderList();
  },

  renderList() {
    const container = document.getElementById('material-prices-content-area');
    if (!container) return;

    if (this.currentView === 'comparison') {
      this.renderComparisonView(container);
    } else {
      this.renderSuppliersView(container);
    }
  },

  renderSuppliersView(container) {
    let filteredSuppliers = [...this.suppliers];

    if (this.currentFilterCategory !== 'all') {
      filteredSuppliers = filteredSuppliers.filter(s => s.category === this.currentFilterCategory);
    }

    if (this.searchQuery) {
      filteredSuppliers = filteredSuppliers.filter(s => {
        const nameMatch = (s.name || '').toLowerCase().includes(this.searchQuery);
        const personMatch = (s.contactPerson || '').toLowerCase().includes(this.searchQuery);
        const cityMatch = (s.city || '').toLowerCase().includes(this.searchQuery);
        
        // Also check if any of supplier's materials match search query
        const hasMatchingMaterial = this.prices.some(p => 
          p.supplierId === s.id && 
          ((p.materialName || '').toLowerCase().includes(this.searchQuery) || (p.notes || '').toLowerCase().includes(this.searchQuery))
        );

        return nameMatch || personMatch || cityMatch || hasMatchingMaterial;
      });
    }

    if (filteredSuppliers.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px; text-align: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🏢</div>
          <h3 style="color: #0f172a; margin-bottom: 8px;">Henüz Tedarikçi Firma Eklenmemiş</h3>
          <p style="color: #64748b; font-size: 13px; max-width: 450px; margin: 0 auto 16px auto;">
            Malzeme aldığınız dericileri, tabancıları, tokacıları veya kimyacıları ekleyerek fiyat takibine hemen başlayabilirsiniz.
          </p>
          <button type="button" class="btn btn-primary" onclick="window.MaterialPrices.openSupplierModal()">
            ➕ Yeni Tedarikçi Firma Ekle
          </button>
        </div>
      `;
      return;
    }

    const allExpanded = filteredSuppliers.length > 0 && filteredSuppliers.every(s => this.expandedSuppliers.has(Number(s.id)) || Boolean(this.searchQuery));

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
        <div style="font-size: 13px; font-weight: 700; color: #475569;">
          🏢 Toplam <strong>${filteredSuppliers.length}</strong> Tedarikçi Firma <span style="font-size: 11.5px; color: #94a3b8; font-weight: 500; margin-left: 6px;">(Detayları görmek için firmaya tıklayın)</span>
        </div>
        <div style="display: flex; gap: 8px;">
          ${allExpanded ? `
            <button type="button" class="btn btn-sm btn-ghost" onclick="window.MaterialPrices.collapseAllSuppliers()" style="font-size: 12px; font-weight: 700; color: #475569; border-color: #cbd5e1; background: #ffffff;">
              📁 Tümünü Kapat
            </button>
          ` : `
            <button type="button" class="btn btn-sm btn-ghost" onclick="window.MaterialPrices.expandAllSuppliers()" style="font-size: 12px; font-weight: 700; color: #0284c7; border-color: #bae6fd; background: #f0f9ff;">
              📂 Tümünü Aç
            </button>
          `}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    filteredSuppliers.forEach(sup => {
      const catInfo = this.getCategoryInfo(sup.category);
      const supplierPrices = this.prices.filter(p => p.supplierId === sup.id);
      const isExpanded = this.expandedSuppliers.has(Number(sup.id)) || Boolean(this.searchQuery);

      html += `
        <div class="card" style="padding: 0; background: #ffffff; border: 1px solid ${isExpanded ? '#93c5fd' : '#e2e8f0'}; border-radius: 12px; box-shadow: ${isExpanded ? '0 4px 12px rgba(2,132,199,0.08)' : '0 1px 3px rgba(0,0,0,0.03)'}; transition: all 0.2s; overflow: hidden;">
          
          <!-- Accordion Header (Click to Open/Close) -->
          <div onclick="window.MaterialPrices.toggleSupplierExpand(${sup.id})" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 14px 18px; cursor: pointer; background: ${isExpanded ? '#f8fafc' : '#ffffff'}; border-bottom: ${isExpanded ? '1px solid #e2e8f0' : 'none'}; user-select: none;">
            
            <div style="display: flex; align-items: center; gap: 12px; min-width: 260px; flex: 1;">
              <!-- Expand Icon Indicator -->
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: ${isExpanded ? '#0284c7' : '#f1f5f9'}; color: ${isExpanded ? '#ffffff' : '#64748b'}; font-size: 11px; font-weight: 800; transition: all 0.2s; flex-shrink: 0;">
                ${isExpanded ? '▼' : '▶'}
              </span>

              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <h3 style="margin: 0; color: #0f172a; font-size: 1.12rem; font-weight: 800;">${escapeHtml(sup.name)}</h3>
                  <span style="display: inline-flex; align-items: center; gap: 4px; background: #ffffff; color: #334155; padding: 2px 8px; border-radius: 16px; font-size: 11px; font-weight: 700; border: 1px solid #e2e8f0;">
                    <span>${catInfo.icon}</span> ${escapeHtml(catInfo.label)}
                  </span>
                  ${sup.city ? `<span style="color: #64748b; font-size: 11.5px; background: #f8fafc; padding: 2px 6px; border-radius: 6px; border: 1px solid #f1f5f9;">📍 ${escapeHtml(sup.city)}</span>` : ''}
                  ${supplierPrices.length > 0 ? `
                    <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">
                      📦 ${supplierPrices.length} Malzeme Kayıtlı
                    </span>
                  ` : `
                    <span style="background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                      0 Malzeme
                    </span>
                  `}
                </div>
                
                <div style="display: flex; gap: 14px; margin-top: 4px; font-size: 11.5px; color: #475569; flex-wrap: wrap;">
                  ${sup.contactPerson ? `<span>👤 <strong>${escapeHtml(sup.contactPerson)}</strong></span>` : ''}
                  ${sup.phone ? `<span>📞 <strong>${escapeHtml(sup.phone)}</strong></span>` : ''}
                  ${sup.notes ? `<span style="color: #64748b; font-style: italic;">📝 ${escapeHtml(sup.notes)}</span>` : ''}
                </div>
              </div>
            </div>

            <!-- Supplier Action Buttons (e.stopPropagation prevents toggle when clicking buttons) -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;" onclick="event.stopPropagation()">
              ${sup.phone ? `
                <button type="button" class="btn btn-sm btn-ghost" onclick="window.MaterialPrices.openWhatsAppChat('${escapeHtml(sup.phone)}', '${escapeHtml(sup.name)}')" title="WhatsApp ile İletişime Geç" style="color: #059669; border-color: #a7f3d0; background: #ecfdf5; font-weight: 700; font-size: 11px; padding: 4px 8px;">
                  📲 WhatsApp
                </button>
              ` : ''}
              <button type="button" class="btn btn-sm btn-secondary" onclick="window.MaterialPrices.openPriceModal(null, ${sup.id})" style="font-weight: 700; font-size: 11px; padding: 4px 8px;">
                ➕ Malzeme Ekle
              </button>
              <button type="button" class="btn-icon info" onclick="window.MaterialPrices.openSupplierModal(${sup.id})" title="Firmayı Düzenle" style="padding: 4px 6px;">✏️</button>
              <button type="button" class="btn-icon danger" onclick="window.MaterialPrices.deleteSupplier(${sup.id})" title="Firmayı Sil" style="padding: 4px 6px;">🗑️</button>
              
              <button type="button" class="btn btn-sm" onclick="window.MaterialPrices.toggleSupplierExpand(${sup.id})" style="font-size: 11px; font-weight: 700; background: ${isExpanded ? '#f1f5f9' : '#0284c7'}; color: ${isExpanded ? '#334155' : '#ffffff'}; border: 1px solid ${isExpanded ? '#cbd5e1' : '#0284c7'}; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                ${isExpanded ? '▲ Gizle' : '▼ Malzemeleri Gör'}
              </button>
            </div>
          </div>

          <!-- Supplier Materials Table (Expanded State) -->
          ${isExpanded ? `
            <div style="padding: 16px 18px; background: #ffffff;">
              ${supplierPrices.length === 0 ? `
                <div style="padding: 14px; text-align: center; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; color: #64748b; font-size: 12.5px;">
                  Bu firmaya ait henüz malzeme fiyatı girilmemiş. <a href="javascript:void(0)" onclick="window.MaterialPrices.openPriceModal(null, ${sup.id})" style="color: #0284c7; font-weight: 700; text-decoration: underline;">Hemen ilk malzemeyi ekleyin</a>.
                </div>
              ` : `
                <div class="table-container" style="box-shadow: none; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <table class="data-table" style="margin: 0; font-size: 13px;">
                    <thead>
                      <tr style="background: #f8fafc;">
                        <th style="font-weight: 700; color: #475569;">Malzeme Adı</th>
                        <th style="font-weight: 700; color: #475569;">Kategori</th>
                        <th style="font-weight: 700; color: #475569;">Birim</th>
                        <th style="font-weight: 700; color: #475569; text-align: right;">Birim Fiyat</th>
                        <th style="font-weight: 700; color: #475569; text-align: center;">Zam / Fiyat Değişimi</th>
                        <th style="font-weight: 700; color: #475569;">Son Güncelleme</th>
                        <th style="font-weight: 700; color: #475569; text-align: right;">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${supplierPrices.map(pr => {
                        const prCat = this.getCategoryInfo(pr.category);
                        const history = Array.isArray(pr.priceHistory) ? pr.priceHistory : [];
                        let historyBadge = `<span style="color: #94a3b8; font-size: 11px;">İlk Fiyat</span>`;

                        if (history.length > 0) {
                          const latestChange = history[history.length - 1];
                          const changePct = latestChange.changePercent;
                          if (changePct > 0) {
                            historyBadge = `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 2px 7px; border-radius: 12px; font-weight: 800; font-size: 11px;">📈 +%${changePct} Zam</span>`;
                          } else if (changePct < 0) {
                            historyBadge = `<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 2px 7px; border-radius: 12px; font-weight: 800; font-size: 11px;">📉 %${Math.abs(changePct)} İndirim</span>`;
                          }
                        }

                        const sym = pr.currency === 'USD' ? '$' : (pr.currency === 'EUR' ? '€' : '₺');
                        const formattedPrice = `${sym}${Number(pr.unitPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
                        const dateStr = pr.updatedAt ? new Date(pr.updatedAt).toLocaleDateString('tr-TR') : (pr.createdAt ? new Date(pr.createdAt).toLocaleDateString('tr-TR') : '-');

                        return `
                          <tr>
                            <td>
                              <strong style="color: #0f172a; font-size: 13.5px;">${escapeHtml(pr.materialName)}</strong>
                              ${pr.notes ? `<div style="font-size: 11px; color: #64748b;">${escapeHtml(pr.notes)}</div>` : ''}
                            </td>
                            <td>
                              <span style="font-size: 11.5px; color: #334155;">${prCat.icon} ${escapeHtml(prCat.label)}</span>
                            </td>
                            <td>
                              <span style="font-weight: 600; color: #475569; text-transform: uppercase; font-size: 11px;">${escapeHtml(pr.unit || 'Adet')}</span>
                            </td>
                            <td style="text-align: right;">
                              <strong style="font-size: 14px; color: #0f172a; font-family: monospace;">${formattedPrice}</strong>
                            </td>
                            <td style="text-align: center;">
                              ${historyBadge}
                              ${history.length > 0 ? `
                                <button type="button" class="btn btn-sm btn-ghost" onclick="window.MaterialPrices.openPriceHistoryModal(${pr.id})" style="padding: 1px 6px; font-size: 10.5px; margin-left: 4px; border: none; text-decoration: underline; color: #0284c7; cursor: pointer;">
                                  Tarihçe (${history.length})
                                </button>
                              ` : ''}
                            </td>
                            <td style="font-size: 12px; color: #64748b;">
                              ${dateStr}
                            </td>
                            <td style="text-align: right;">
                              <div class="actions-cell" style="justify-content: flex-end;">
                                <button type="button" class="btn-icon success" onclick="window.MaterialPrices.generateWhatsAppInquiry(${pr.id})" title="Tedarikçiye WhatsApp ile Malzeme Sor" style="color: #059669; background: #ecfdf5; border-color: #a7f3d0;">📲</button>
                                <button type="button" class="btn-icon info" onclick="window.MaterialPrices.openPriceModal(${pr.id})" title="Fiyatı Düzenle">✏️</button>
                                <button type="button" class="btn-icon danger" onclick="window.MaterialPrices.deletePrice(${pr.id})" title="Fiyatı Sil">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  renderComparisonView(container) {
    let filteredPrices = [...this.prices];

    if (this.currentFilterCategory !== 'all') {
      filteredPrices = filteredPrices.filter(p => p.category === this.currentFilterCategory);
    }

    if (this.searchQuery) {
      filteredPrices = filteredPrices.filter(p => 
        (p.materialName || '').toLowerCase().includes(this.searchQuery) ||
        (p.supplierName || '').toLowerCase().includes(this.searchQuery) ||
        (p.notes || '').toLowerCase().includes(this.searchQuery)
      );
    }

    if (filteredPrices.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px 20px; text-align: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="font-size: 3rem; margin-bottom: 12px;">⚖️</div>
          <h3 style="color: #0f172a; margin-bottom: 8px;">Karşılaştırılacak Malzeme Bulunamadı</h3>
          <p style="color: #64748b; font-size: 13px; max-width: 450px; margin: 0 auto 16px auto;">
            Arama kriterinize uygun malzeme fiyatı bulunamadı veya henüz fiyat girişi yapılmadı.
          </p>
        </div>
      `;
      return;
    }

    // Group prices by normalized material name
    const grouped = {};
    filteredPrices.forEach(p => {
      const normName = (p.materialName || '').trim().toLowerCase();
      if (!grouped[normName]) {
        grouped[normName] = {
          displayName: p.materialName,
          category: p.category,
          unit: p.unit,
          items: []
        };
      }
      grouped[normName].items.push(p);
    });

    let html = `<div style="display: flex; flex-direction: column; gap: 16px;">`;

    Object.values(grouped).forEach(group => {
      // Sort items by unit price (cheapest first)
      const sortedItems = [...group.items].sort((a, b) => (Number(a.unitPrice) || 0) - (Number(b.unitPrice) || 0));
      const catInfo = this.getCategoryInfo(group.category);

      html += `
        <div class="card" style="padding: 16px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">${escapeHtml(group.displayName)}</h4>
              <span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 12px; font-weight: 700; border: 1px solid #e2e8f0;">
                ${catInfo.icon} ${escapeHtml(catInfo.label)}
              </span>
              <span style="font-size: 11px; color: #64748b; font-weight: 600;">Birim: ${escapeHtml(group.unit || 'Adet')}</span>
            </div>
            <span style="font-size: 12px; font-weight: 700; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 3px 10px; border-radius: 20px;">
              ${sortedItems.length} Tedarikçide Mevcut
            </span>
          </div>

          <div class="table-container" style="box-shadow: none; border: 1px solid #e2e8f0; border-radius: 8px;">
            <table class="data-table" style="margin: 0; font-size: 13px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="font-weight: 700; color: #475569;">Tedarikçi Firma</th>
                  <th style="font-weight: 700; color: #475569; text-align: right;">Birim Fiyat</th>
                  <th style="font-weight: 700; color: #475569; text-align: center;">Fiyat Avantajı</th>
                  <th style="font-weight: 700; color: #475569;">Son Güncelleme</th>
                  <th style="font-weight: 700; color: #475569; text-align: right;">Hızlı Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                ${sortedItems.map((item, idx) => {
                  const sym = item.currency === 'USD' ? '$' : (item.currency === 'EUR' ? '€' : '₺');
                  const formattedPrice = `${sym}${Number(item.unitPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
                  const isBestPrice = idx === 0 && sortedItems.length > 1;
                  const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('tr-TR') : (item.createdAt ? new Date(item.createdAt).toLocaleDateString('tr-TR') : '-');

                  return `
                    <tr style="${isBestPrice ? 'background: #f0fdf4;' : ''}">
                      <td>
                        <strong style="color: #0f172a;">${escapeHtml(item.supplierName || 'Bilinmeyen Firma')}</strong>
                        ${isBestPrice ? `<span style="margin-left: 6px; background: #22c55e; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">🏆 EN UCUZ</span>` : ''}
                      </td>
                      <td style="text-align: right;">
                        <strong style="font-size: 14px; color: ${isBestPrice ? '#15803d' : '#0f172a'}; font-family: monospace;">${formattedPrice}</strong>
                      </td>
                      <td style="text-align: center;">
                        ${idx === 0 ? `
                          <span style="color: #15803d; font-weight: 700; font-size: 12px;">En İyi Fiyat</span>
                        ` : `
                          <span style="color: #d97706; font-size: 11.5px; font-weight: 600;">+%${Math.round(((item.unitPrice - sortedItems[0].unitPrice) / sortedItems[0].unitPrice) * 100)} daha pahalı</span>
                        `}
                      </td>
                      <td style="font-size: 12px; color: #64748b;">${dateStr}</td>
                      <td style="text-align: right;">
                        <div class="actions-cell" style="justify-content: flex-end;">
                          <button type="button" class="btn btn-sm btn-ghost" onclick="window.MaterialPrices.generateWhatsAppInquiry(${item.id})" style="color: #059669; border-color: #a7f3d0; background: #ecfdf5; font-weight: 700; padding: 3px 8px; font-size: 11px;">
                            📲 Sipariş Ver
                          </button>
                          <button type="button" class="btn-icon info" onclick="window.MaterialPrices.openPriceModal(${item.id})" title="Fiyatı Düzenle">✏️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  /* --- Supplier CRUD --- */
  openSupplierModal(supplierId = null) {
    const form = document.getElementById('material-supplier-form');
    if (form) form.reset();

    const titleEl = document.getElementById('material-supplier-modal-title');
    const idInput = document.getElementById('mp-supplier-id');
    const catSelect = document.getElementById('mp-supplier-category');

    // Populate category dropdown
    if (catSelect) {
      const allCats = this.getAllCategories();
      catSelect.innerHTML = allCats.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.label)}</option>`).join('');
    }

    if (supplierId) {
      const sup = this.suppliers.find(s => s.id === supplierId);
      if (sup) {
        if (titleEl) titleEl.textContent = 'Tedarikçi Firmayı Düzenle';
        if (idInput) idInput.value = sup.id;
        document.getElementById('mp-supplier-name').value = sup.name || '';
        if (catSelect) catSelect.value = sup.category || 'deri';
        document.getElementById('mp-supplier-person').value = sup.contactPerson || '';
        document.getElementById('mp-supplier-phone').value = sup.phone || '';
        document.getElementById('mp-supplier-city').value = sup.city || '';
        document.getElementById('mp-supplier-notes').value = sup.notes || '';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Yeni Tedarikçi Firma Ekle';
      if (idInput) idInput.value = '';
    }

    window.openModalById('material-supplier-modal');
  },

  async saveSupplier() {
    const idInput = document.getElementById('mp-supplier-id');
    const supplierId = idInput && idInput.value ? parseInt(idInput.value, 10) : null;
    const name = document.getElementById('mp-supplier-name').value.trim();
    const category = document.getElementById('mp-supplier-category').value;
    const contactPerson = document.getElementById('mp-supplier-person').value.trim();
    const phone = document.getElementById('mp-supplier-phone').value.trim();
    const city = document.getElementById('mp-supplier-city').value.trim();
    const notes = document.getElementById('mp-supplier-notes').value.trim();

    if (!name) {
      window.showToast('Lütfen tedarikçi firma adını girin!', 'error');
      return;
    }

    const supplierData = {
      name,
      category,
      contactPerson,
      phone,
      city,
      notes,
      updatedAt: new Date().toISOString()
    };

    try {
      if (supplierId) {
        supplierData.id = supplierId;
        await window.dbUpdate('material_suppliers', supplierData);
        
        // Also update supplierName on related prices
        const relatedPrices = this.prices.filter(p => p.supplierId === supplierId);
        for (const pr of relatedPrices) {
          pr.supplierName = name;
          await window.dbUpdate('material_prices', pr);
        }

        window.showToast('Tedarikçi firma başarıyla güncellendi!', 'success');
      } else {
        supplierData.createdAt = new Date().toISOString();
        await window.dbAdd('material_suppliers', supplierData);
        window.showToast('Yeni tedarikçi firma başarıyla eklendi!', 'success');
      }

      window.closeModalById('material-supplier-modal');
      await this.render();
    } catch (e) {
      console.error('Save supplier error:', e);
      window.showToast('Tedarikçi kaydedilirken hata oluştu: ' + e.message, 'error');
    }
  },

  async deleteSupplier(supplierId) {
    const sup = this.suppliers.find(s => s.id === supplierId);
    if (!sup) return;

    const supplierPrices = this.prices.filter(p => p.supplierId === supplierId);
    const msg = supplierPrices.length > 0 
      ? `"${sup.name}" firmasını ve firmaya ait ${supplierPrices.length} adet malzeme fiyatını silmek istediğinizden emin misiniz?`
      : `"${sup.name}" tedarikçi firmasını silmek istediğinizden emin misiniz?`;

    if (confirm(msg)) {
      try {
        await window.dbDelete('material_suppliers', supplierId);
        for (const pr of supplierPrices) {
          await window.dbDelete('material_prices', pr.id);
        }
        window.showToast('Tedarikçi firma ve fiyatları silindi.', 'info');
        await this.render();
      } catch (e) {
        window.showToast('Silme hatası: ' + e.message, 'error');
      }
    }
  },

  /* --- Material Price CRUD --- */
  openPriceModal(priceId = null, defaultSupplierId = null) {
    const form = document.getElementById('material-price-form');
    if (form) form.reset();

    const titleEl = document.getElementById('material-price-modal-title');
    const idInput = document.getElementById('mp-price-id');
    const supplierSelect = document.getElementById('mp-price-supplier-id');
    const catSelect = document.getElementById('mp-price-category');

    // Populate supplier select
    if (supplierSelect) {
      if (this.suppliers.length === 0) {
        supplierSelect.innerHTML = '<option value="">Önce bir tedarikçi firma ekleyin</option>';
      } else {
        supplierSelect.innerHTML = '<option value="">Tedarikçi Firma Seçiniz</option>' + 
          this.suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      }
    }

    // Populate category select
    if (catSelect) {
      const allCats = this.getAllCategories();
      catSelect.innerHTML = allCats.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.label)}</option>`).join('');
    }

    if (priceId) {
      const pr = this.prices.find(p => p.id === priceId);
      if (pr) {
        if (titleEl) titleEl.textContent = 'Malzeme Fiyatını Düzenle';
        if (idInput) idInput.value = pr.id;
        if (supplierSelect) supplierSelect.value = pr.supplierId || '';
        document.getElementById('mp-price-material-name').value = pr.materialName || '';
        if (catSelect) catSelect.value = pr.category || 'deri';
        document.getElementById('mp-price-unit').value = pr.unit || 'dm²';
        document.getElementById('mp-price-amount').value = pr.unitPrice || '';
        document.getElementById('mp-price-currency').value = pr.currency || 'TRY';
        document.getElementById('mp-price-notes').value = pr.notes || '';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Yeni Malzeme Fiyatı Ekle';
      if (idInput) idInput.value = '';
      if (defaultSupplierId && supplierSelect) {
        supplierSelect.value = defaultSupplierId;
      }
    }

    window.openModalById('material-price-modal');
  },

  async savePrice() {
    const idInput = document.getElementById('mp-price-id');
    const priceId = idInput && idInput.value ? parseInt(idInput.value, 10) : null;
    const supplierId = parseInt(document.getElementById('mp-price-supplier-id').value, 10);
    const materialName = document.getElementById('mp-price-material-name').value.trim();
    const category = document.getElementById('mp-price-category').value;
    const unit = document.getElementById('mp-price-unit').value;
    const unitPrice = parseFloat(document.getElementById('mp-price-amount').value) || 0;
    const currency = document.getElementById('mp-price-currency').value || 'TRY';
    const notes = document.getElementById('mp-price-notes').value.trim();

    if (!supplierId) {
      window.showToast('Lütfen bir tedarikçi firma seçin!', 'error');
      return;
    }
    if (!materialName) {
      window.showToast('Lütfen malzeme adını girin!', 'error');
      return;
    }
    if (unitPrice <= 0) {
      window.showToast('Lütfen geçerli bir birim fiyat girin!', 'error');
      return;
    }

    const supplier = this.suppliers.find(s => s.id === supplierId);
    const supplierName = supplier ? supplier.name : 'Tedarikçi';

    const priceData = {
      supplierId,
      supplierName,
      materialName,
      category,
      unit,
      unitPrice,
      currency,
      notes,
      updatedAt: new Date().toISOString()
    };

    try {
      if (priceId) {
        const existing = this.prices.find(p => p.id === priceId);
        let history = Array.isArray(existing?.priceHistory) ? [...existing.priceHistory] : [];

        // Check if price changed -> Record to history
        if (existing && (existing.unitPrice !== unitPrice || existing.currency !== currency)) {
          const oldPrice = Number(existing.unitPrice) || 0;
          const changePct = oldPrice > 0 ? Math.round(((unitPrice - oldPrice) / oldPrice) * 100) : 0;

          history.push({
            oldPrice: existing.unitPrice,
            newPrice: unitPrice,
            oldCurrency: existing.currency || 'TRY',
            newCurrency: currency,
            changePercent: changePct,
            date: new Date().toISOString()
          });
        }

        priceData.id = priceId;
        priceData.createdAt = existing?.createdAt || new Date().toISOString();
        priceData.priceHistory = history;

        await window.dbUpdate('material_prices', priceData);
        window.showToast('Malzeme fiyatı güncellendi!', 'success');
      } else {
        priceData.createdAt = new Date().toISOString();
        priceData.priceHistory = [];
        await window.dbAdd('material_prices', priceData);
        window.showToast('Yeni malzeme fiyatı başarıyla eklendi!', 'success');
      }

      window.closeModalById('material-price-modal');
      await this.render();
    } catch (e) {
      console.error('Save price error:', e);
      window.showToast('Fiyat kaydedilirken hata oluştu: ' + e.message, 'error');
    }
  },

  async deletePrice(priceId) {
    const pr = this.prices.find(p => p.id === priceId);
    if (!pr) return;

    if (confirm(`"${pr.materialName}" malzeme fiyatını silmek istediğinizden emin misiniz?`)) {
      try {
        await window.dbDelete('material_prices', priceId);
        window.showToast('Malzeme fiyatı silindi.', 'info');
        await this.render();
      } catch (e) {
        window.showToast('Silme hatası: ' + e.message, 'error');
      }
    }
  },

  /* --- Price History Modal --- */
  openPriceHistoryModal(priceId) {
    const pr = this.prices.find(p => p.id === priceId);
    if (!pr) return;

    const modalTitle = document.getElementById('price-history-modal-title');
    const listContainer = document.getElementById('price-history-timeline');

    if (modalTitle) {
      modalTitle.textContent = `${pr.materialName} — Fiyat Değişim & Zam Geçmişi`;
    }

    const history = Array.isArray(pr.priceHistory) ? pr.priceHistory : [];

    if (!listContainer) return;

    if (history.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #64748b; font-size: 13px;">
          Bu malzeme için henüz geçmiş bir fiyat değişimi kaydı bulunmuyor. Fiyatı güncellediğinizde tüm zam ve indirim oranları burada listelenir.
        </div>
      `;
    } else {
      const sym = pr.currency === 'USD' ? '$' : (pr.currency === 'EUR' ? '€' : '₺');
      let html = `<div style="display: flex; flex-direction: column; gap: 10px;">`;

      [...history].reverse().forEach((item, idx) => {
        const isZam = item.changePercent > 0;
        const isIndirim = item.changePercent < 0;
        const badgeBg = isZam ? '#fef2f2' : (isIndirim ? '#ecfdf5' : '#f1f5f9');
        const badgeColor = isZam ? '#dc2626' : (isIndirim ? '#059669' : '#475569');
        const badgeText = isZam ? `📈 +%${item.changePercent} Zam` : (isIndirim ? `📉 %${Math.abs(item.changePercent)} İndirim` : 'Fiyat Güncellendi');
        const dateStr = item.date ? new Date(item.date).toLocaleString('tr-TR') : '-';

        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 12px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">
                  ${badgeText}
                </span>
                <span style="font-size: 12px; color: #64748b;">${dateStr}</span>
              </div>
              <div style="margin-top: 6px; font-size: 13px; color: #334155;">
                Eski Fiyat: <del style="color: #94a3b8;">${sym}${Number(item.oldPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</del> → 
                <strong style="color: #0f172a; font-size: 14px;">${sym}${Number(item.newPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: #64748b;">Tedarikçi:</span>
              <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${escapeHtml(pr.supplierName)}</div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      listContainer.innerHTML = html;
    }

    window.openModalById('price-history-modal');
  },

  /* --- Custom Category Management --- */
  openCustomCategoryModal() {
    const form = document.getElementById('custom-category-form');
    if (form) form.reset();
    window.openModalById('custom-category-modal');
  },

  saveCustomCategory() {
    const nameInput = document.getElementById('custom-cat-name');
    const iconInput = document.getElementById('custom-cat-icon');

    const label = nameInput?.value?.trim();
    const icon = iconInput?.value?.trim() || '🏷️';

    if (!label) {
      window.showToast('Lütfen kategori adını girin!', 'error');
      return;
    }

    const id = 'custom_' + Date.now();
    this.customCategories.push({ id, label, icon });
    this.saveCustomCategories();

    window.showToast(`"${label}" kategorisi başarıyla eklendi!`, 'success');
    window.closeModalById('custom-category-modal');
    this.renderCategoryChips();
  },

  /* --- WhatsApp Communication --- */
  openWhatsAppChat(phone, supplierName) {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('90') ? cleanPhone : (cleanPhone.startsWith('0') ? '9' + cleanPhone : '90' + cleanPhone);
    const msg = `Merhaba ${supplierName}, hayırlı işler. Atölyemiz için malzeme tedariki konusunda görüşmek istiyoruz.`;
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },

  generateWhatsAppInquiry(priceId) {
    const pr = this.prices.find(p => p.id === priceId);
    if (!pr) return;

    const supplier = this.suppliers.find(s => s.id === pr.supplierId);
    if (!supplier || !supplier.phone) {
      window.showToast('Bu tedarikçi için kayıtlı telefon numarası bulunamadı!', 'warning');
      return;
    }

    const cleanPhone = supplier.phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('90') ? cleanPhone : (cleanPhone.startsWith('0') ? '9' + cleanPhone : '90' + cleanPhone);
    const sym = pr.currency === 'USD' ? '$' : (pr.currency === 'EUR' ? '€' : '₺');
    const priceStr = `${sym}${Number(pr.unitPrice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / ${pr.unit || 'Adet'}`;

    const msg = `Selam ${supplier.name}, hayırlı işler.\n"${pr.materialName}" için listenizdeki güncel birim fiyat: ${priceStr}.\nBu malzemeden sipariş oluşturmak istiyoruz. Güncel stok ve termin bilginizi paylaşabilir misiniz?`;
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }
};

// Bind to window for global inline onclick handlers
window.MaterialPrices = MaterialPrices;
