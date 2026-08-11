import { createClient } from '@supabase/supabase-js';

// 1. Supabase Initialization
const DEFAULT_SUPABASE_URL = 'https://eojfpequxoxunmxejquy.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_4ZGyINuBEt8X5TMYtRgqyg_Qy8O6IZG';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

let supabase = null;

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

// 2. State variables
let companyName = '';
let productsList = []; // raw product objects from DB
let groupedProducts = {}; // modelCode -> array of products (different colors)
let cart = [];
let activeProduct = null; // currently selected model's products array
let clientContact = null;
let discountRate = 0;

// 3. Elements
const elCompany = document.getElementById('lbl-catalog-company');
const elContainer = document.getElementById('catalog-products-container');
const elCartCount = document.getElementById('lbl-cart-count');

const modalOpt = document.getElementById('product-options-modal');
const modalCart = document.getElementById('cart-modal');

const optTitle = document.getElementById('opt-modal-title');
const optImg = document.getElementById('opt-modal-img');
const optCode = document.getElementById('opt-modal-code');
const optBadges = document.getElementById('opt-modal-badges');
const optPrice = document.getElementById('opt-modal-price');
const optColorSelect = document.getElementById('opt-color-select');
const optSizesTbody = document.getElementById('opt-sizes-tbody');
const optTotalQty = document.getElementById('opt-total-qty');

const cartItemsList = document.getElementById('cart-items-list');
const cartGrandTotal = document.getElementById('cart-grand-total');

// 4. Load Catalog on Start
async function initCatalog() {
  const params = new URLSearchParams(window.location.search);
  companyName = params.get('w');

  if (!companyName) {
    elContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-danger);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">⚠️</span>
        <h3>Hatalı Katalog Bağlantısı</h3>
        <p style="font-size: 13px; margin-top: 6px;">Katalog linki eksik veya hatalı. Lütfen size linki gönderen atölye ile iletişime geçin.</p>
      </div>
    `;
    return;
  }

  elCompany.textContent = companyName;

  // Initialize Supabase Client dynamically with the company RLS header
  try {
    if (supabaseUrl && supabaseKey && supabaseUrl !== '') {
      const companyB64 = btoa(unescape(encodeURIComponent(companyName)));
      supabase = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            'x-company-id': companyB64
          }
        }
      });
    }
  } catch (e) {
    console.error('Supabase initialization failed in catalog:', e);
  }

  if (!supabase) {
    elContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-warning);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">🔌</span>
        <h3>Bulut Veritabanı Bağlantısı Yok</h3>
        <p style="font-size: 13px; margin-top: 6px;">Bu atölye için aktif bir Supabase bağlantısı tanımlanmamış.</p>
      </div>
    `;
    return;
  }

  try {
    // Fetch products
    const { data: rows, error } = await supabase
      .from('products')
      .select('*')
      .eq('data->>_ownerCompany', companyName);

    if (error) throw error;

    productsList = (rows || []).map(row => {
      const item = { ...row.data };
      item.id = Number(row.id);
      return item;
    });

    // Fetch client details if clientId is provided (c parameter)
    const clientId = params.get('c');
    if (clientId) {
      try {
        const { data: contactRow, error: contactErr } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', parseInt(clientId))
          .maybeSingle();

        if (contactErr) throw contactErr;

        if (contactRow) {
          clientContact = { ...contactRow.data, id: Number(contactRow.id) };
          discountRate = clientContact.discountRate || 0;
          console.log(`B2B Client identified: ${clientContact.name} with discount: %${discountRate}`);
          
          // Display B2B Custom greetings in B2B title
          const catalogTitlePar = document.querySelector('.catalog-title p');
          if (catalogTitlePar) {
            catalogTitlePar.innerHTML = `Sayın <strong>${escapeHtml(clientContact.name)}</strong> için Özel B2B Sipariş Portalı ${discountRate > 0 ? `(<span style="color: #10b981; font-weight: 700;">%${discountRate} İskontolu</span>)` : ''}`;
          }
        }
      } catch (e) {
        console.warn('Could not load B2B client custom details:', e);
      }
    }

    if (productsList.length === 0) {
      elContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #9ca3af;">
          <span style="font-size: 3rem; display: block; margin-bottom: 12px;">👡</span>
          <h3>Katalogda Ürün Bulunmuyor</h3>
          <p style="font-size: 13px; margin-top: 6px;">Bu atölye henüz kataloğa ürün eklememiş.</p>
        </div>
      `;
      return;
    }

    // Group products by modelCode
    groupedProducts = {};
    productsList.forEach(p => {
      const code = p.modelCode || 'KODSUZ';
      if (!groupedProducts[code]) {
        groupedProducts[code] = [];
      }
      groupedProducts[code].push(p);
    });

    renderCatalog();
  } catch (err) {
    console.error(err);
    elContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--color-danger);">
        <span style="font-size: 3rem; display: block; margin-bottom: 12px;">❌</span>
        <h3>Katalog Yüklenemedi</h3>
        <p style="font-size: 13px; margin-top: 6px;">Veri çekme hatası: ${err.message}</p>
      </div>
    `;
  }
}

// Render Products Grid
function renderCatalog() {
  elContainer.innerHTML = Object.keys(groupedProducts).map(modelCode => {
    const products = groupedProducts[modelCode];
    // Find representative product (preferably one with a photo)
    const rep = products.find(p => p.photo) || products[0];

    const categoryBadge = rep.category ? `<span class="info-badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">${escapeHtml(rep.category)}</span>` : '';
    const soleBadge = rep.soleMaterial ? `<span class="info-badge">${escapeHtml(rep.soleMaterial)}</span>` : '';
    
    // List available colors
    const colorsList = products.map(p => escapeHtml(p.color)).join(', ');

    return `
      <div class="product-card">
        <div class="product-img-container">
          ${rep.photo 
            ? `<img src="${rep.photo}" class="product-img" alt="${escapeHtml(modelCode)}">`
            : `<span class="product-img-placeholder">👟</span>`
          }
        </div>
        <div class="product-details">
          <h3>${escapeHtml(modelCode)}</h3>
          <div class="product-info-row">
            ${categoryBadge}
            ${soleBadge}
          </div>
          <p style="font-size: 11.5px; color: #9ca3af; margin: 0 0 14px 0; line-height: 1.4;">
            <strong>Renkler:</strong> ${colorsList}
          </p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
            <div style="display: flex; flex-direction: column;">
              ${discountRate > 0 
                ? `<span class="product-price-original" style="text-decoration: line-through; color: #9ca3af; font-size: 0.75rem; line-height: 1;">₺${Number(rep.price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                   <span class="product-price" style="color: #10b981; font-weight: 800; font-size: 1.1rem; margin-top: 2px;">₺${Number((rep.price || 0) * (1 - discountRate / 100)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>`
                : `<span class="product-price">₺${Number(rep.price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>`
              }
            </div>
            <button type="button" class="btn btn-primary btn-sm btn-select-product" onclick="window.selectProduct('${escapeHtml(modelCode)}')">
              Sipariş Ver
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Select Product (Opens Options Modal)
function selectProduct(modelCode) {
  activeProduct = groupedProducts[modelCode];
  if (!activeProduct || activeProduct.length === 0) return;

  const rep = activeProduct.find(p => p.photo) || activeProduct[0];

  optTitle.textContent = `${modelCode} - Sipariş Yapılandır`;
  optCode.textContent = modelCode;
  
  if (rep.photo) {
    optImg.src = rep.photo;
    optImg.style.display = 'block';
  } else {
    optImg.style.display = 'none';
  }

  // Badges
  optBadges.innerHTML = `
    ${rep.category ? `<span class="info-badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">${escapeHtml(rep.category)}</span>` : ''}
    ${rep.soleMaterial ? `<span class="info-badge">${escapeHtml(rep.soleMaterial)}</span>` : ''}
  `;

  // Colors dropdown
  optColorSelect.innerHTML = activeProduct.map(p => `<option value="${p.id}">${escapeHtml(p.color)}</option>`).join('');

  // Update sizes table depending on color
  optColorSelect.onchange = () => {
    updateSizesForm();
  };

  updateSizesForm();
  openModal(modalOpt);
}

// Update sizes input grid depending on selected product (color)
function updateSizesForm() {
  const productId = parseInt(optColorSelect.value);
  const p = activeProduct.find(prod => prod.id === productId);
  if (!p) return;

  if (discountRate > 0) {
    const origPrice = Number(p.price || 0);
    const discPrice = origPrice * (1 - discountRate / 100);
    optPrice.innerHTML = `
      <span style="text-decoration: line-through; color: #9ca3af; font-size: 0.8rem; margin-right: 6px;">₺${origPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
      <span style="color: #10b981; font-weight: 800;">₺${discPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
    `;
  } else {
    optPrice.textContent = `₺${Number(p.price || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  }

  // Parse size ranges (e.g. 40-44)
  let sizes = [];
  const range = p.size || '36-44';
  const parts = range.split('-');
  if (parts.length === 2) {
    const min = parseInt(parts[0]);
    const max = parseInt(parts[1]);
    if (!isNaN(min) && !isNaN(max) && min <= max && min >= 20 && max <= 55) {
      for (let s = min; s <= max; s++) {
        sizes.push(s.toString());
      }
    }
  }

  if (sizes.length === 0) {
    sizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44'];
  }

  optSizesTbody.innerHTML = sizes.map(sz => `
    <tr class="size-input-row">
      <td style="font-weight: 700; color: var(--text-accent);">${sz}</td>
      <td>
        <input type="number" class="txt-size-qty" data-size="${sz}" min="0" value="0" style="width: 80px;">
      </td>
    </tr>
  `).join('');

  optTotalQty.textContent = '0 Çift';

  // Listen inputs for total
  optSizesTbody.querySelectorAll('.txt-size-qty').forEach(input => {
    input.addEventListener('input', () => {
      recalcSizesTotal();
    });
  });
}

function recalcSizesTotal() {
  let total = 0;
  optSizesTbody.querySelectorAll('.txt-size-qty').forEach(input => {
    total += parseInt(input.value) || 0;
  });
  optTotalQty.textContent = `${total} Çift`;
}

// Add Options to Cart
function addToCart() {
  const productId = parseInt(optColorSelect.value);
  const p = activeProduct.find(prod => prod.id === productId);
  if (!p) return;

  const sizesData = [];
  let itemTotal = 0;

  optSizesTbody.querySelectorAll('.txt-size-qty').forEach(input => {
    const qty = parseInt(input.value) || 0;
    if (qty > 0) {
      sizesData.push({
        size: input.dataset.size,
        qty: qty
      });
      itemTotal += qty;
    }
  });

  if (itemTotal === 0) {
    alert('Lütfen en az bir beden için adet girin!');
    return;
  }

  // Check duplicate in cart
  const duplicateIndex = cart.findIndex(c => c.productId === productId);
  if (duplicateIndex > -1) {
    // Add sizes together
    sizesData.forEach(s => {
      const match = cart[duplicateIndex].sizes.find(sz => sz.size === s.size);
      if (match) {
        match.qty += s.qty;
      } else {
        cart[duplicateIndex].sizes.push(s);
      }
    });
    cart[duplicateIndex].qty += itemTotal;
  } else {
    cart.push({
      id: Date.now().toString(),
      productId: p.id,
      modelCode: p.modelCode,
      color: p.color,
      price: discountRate > 0 ? (p.price || 0) * (1 - discountRate / 100) : (p.price || 0),
      originalPrice: p.price || 0,
      sizes: sizesData,
      qty: itemTotal
    });
  }

  updateCartBadge();
  closeModal(modalOpt);
  showToastMessage(`Sepete Eklendi: ${p.modelCode} (${p.color}) - ${itemTotal} Çift`);
}

function updateCartBadge() {
  let total = 0;
  cart.forEach(c => total += c.qty);
  elCartCount.textContent = total;
}

// Render Cart Modal
function renderCart() {
  if (cart.length === 0) {
    cartItemsList.innerHTML = `
      <div style="padding: 30px; text-align: center; color: #9ca3af;">
        <span>🛒</span> Sepetiniz boş.
      </div>
    `;
    cartGrandTotal.textContent = '0 Çift';
    return;
  }

  cartItemsList.innerHTML = cart.map(item => {
    const sizesDesc = item.sizes.map(s => `${s.size}:${s.qty}`).join(', ');
    return `
      <div class="cart-item">
        <div class="cart-item-details">
          <h4>${escapeHtml(item.modelCode)} (${escapeHtml(item.color)})</h4>
          <p>${escapeHtml(sizesDesc)}</p>
        </div>
        <div class="cart-item-actions">
          <strong style="color: var(--accent-primary); font-size: 0.9rem;">${item.qty} Çift</strong>
          <button type="button" class="btn-icon danger" onclick="window.removeFromCart('${item.id}')" style="cursor: pointer;">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  let grandTotal = 0;
  cart.forEach(c => grandTotal += c.qty);
  cartGrandTotal.textContent = `${grandTotal} Çift`;
}

function removeFromCart(cartId) {
  cart = cart.filter(c => c.id !== cartId);
  updateCartBadge();
  renderCart();
}

// Submit Order (Submit to Supabase + WhatsApp redirect)
async function submitOrder(e) {
  e.preventDefault();
  if (cart.length === 0) {
    alert('Sepetiniz boş!');
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-order');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '⏳ Siparişiniz Gönderiliyor...';
  const buyerName = document.getElementById('txt-buyer-name').value.trim();
  const buyerPhone = document.getElementById('txt-buyer-phone').value.trim();
  const buyerNote = document.getElementById('txt-buyer-note').value.trim();

  try {
    // 1. Fetch B2B WhatsApp Phone setting from Supabase
    let b2bPhone = '';
    const { data: phoneRow } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'manager_b2b_settings')
      .maybeSingle();

    if (phoneRow && phoneRow.data && phoneRow.data.phone) {
      let rawPhone = phoneRow.data.phone.replace(/\D/g, '');
      if (rawPhone.startsWith('0')) {
        rawPhone = rawPhone.substring(1);
      }
      if (rawPhone.length === 10) {
        b2bPhone = '90' + rawPhone;
      } else {
        b2bPhone = rawPhone;
      }
    }

    // 2. Combine sepet into orders (grouping by modelCode)
    const modelGrouped = {};
    cart.forEach(item => {
      const code = item.modelCode;
      if (!modelGrouped[code]) {
        modelGrouped[code] = [];
      }
      modelGrouped[code].push(item);
    });

    // Save order IDs locally
    const myOrders = JSON.parse(localStorage.getItem('my_catalog_orders') || '[]');

    // Write separate order records for different modelCodes
    for (const code in modelGrouped) {
      const items = modelGrouped[code];
      const colorsForDb = items.map(item => ({
        productId: item.productId,
        color: item.color,
        qty: item.qty,
        sizes: item.sizes
      }));

      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      const repPrice = items[0].price;
      const randomId = Math.floor(100000 + Math.random() * 900000);

      // Check push subscription
      let clientPushEndpoint = '';
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            clientPushEndpoint = sub.endpoint;
          }
        }
      } catch (e) {
        console.warn('Could not read client subscription endpoint:', e);
      }

      const orderObj = {
        id: randomId,
        contactId: clientContact ? clientContact.id : 0,
        customerName: clientContact ? clientContact.name : buyerName,
        customerPhone: clientContact ? clientContact.phone : buyerPhone,
        modelCode: code,
        price: repPrice,
        qty: totalQty,
        colors: colorsForDb,
        status: 'gelen',
        date: new Date().toISOString(),
        deadline: new Date().toISOString(),
        note: buyerNote,
        _ownerCompany: companyName,
        clientPushEndpoint: clientPushEndpoint
      };

      // Insert order to database
      const { error } = await supabase
        .from('orders')
        .insert({
          id: randomId,
          data: orderObj
        });

      if (error) throw error;
      myOrders.push(randomId);
    }

    localStorage.setItem('my_catalog_orders', JSON.stringify(myOrders));

    // 3. Format WhatsApp Message
    let waText = `*ATÖLYECİM B2B SİPARİŞİ* 👟\n`;
    waText += `*Alıcı Atölye:* ${companyName}\n`;
    waText += `*Gönderen Firma:* ${clientContact ? clientContact.name : buyerName}\n`;
    if (clientContact) {
      waText += `*Müşteri Hesabı:* Kayıtlı Cari Müşteri\n`;
      if (discountRate > 0) {
        waText += `*Uygulanan İskonto:* %${discountRate}\n`;
      }
    }
    waText += `*Tarih:* ${new Date().toLocaleDateString('tr-TR')}\n`;
    waText += `---------------------------\n\n`;

    let totalPairs = 0;
    let totalCost = 0;
    cart.forEach(item => {
      waText += `*Model:* ${item.modelCode} (${item.color})\n`;
      const sizeList = item.sizes.map(s => `${s.size} Nmr: ${s.qty} Ad`).join(', ');
      waText += `└ _Bedenler:_ ${sizeList}\n`;
      const originalPriceText = discountRate > 0 ? ` (~₺${item.originalPrice.toFixed(2)}~)` : '';
      waText += `└ *Birim Fiyat:* ₺${item.price.toFixed(2)}${originalPriceText}\n`;
      waText += `└ *Miktar:* ${item.qty} Çift\n\n`;
      totalPairs += item.qty;
      totalCost += item.qty * item.price;
    });

    waText += `---------------------------\n`;
    waText += `*GENEL TOPLAM:* *${totalPairs} Çift*\n`;
    waText += `*TOPLAM TUTAR:* *₺${totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) }*\n`;
    if (buyerNote) {
      waText += `*Sipariş Notu:* ${buyerNote}\n`;
    }

    // Clear sepet
    cart = [];
    updateCartBadge();
    closeModal(modalCart);
    document.getElementById('cart-checkout-form').reset();

    // 4. Open WhatsApp Success modal (Universal Redirect)
    const encodedText = encodeURIComponent(waText);
    let waUrl = '';

    if (b2bPhone) {
      const formattedPhone = formatPhone(b2bPhone);
      waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
    } else {
      waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    const modalSuccess = document.getElementById('checkout-success-modal');
    const btnSuccessOk = document.getElementById('btn-success-ok');
    
    if (modalSuccess && btnSuccessOk) {
      openModal(modalSuccess);
      btnSuccessOk.onclick = () => {
        window.open(waUrl, '_blank');
        closeModal(modalSuccess);
        initCatalog();
      };
    } else {
      window.open(waUrl, '_blank');
      initCatalog();
    }

  } catch (err) {
    console.error(err);
    alert('Sipariş gönderilirken veritabanı hatası oluştu: ' + err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '✔️ Siparişi WhatsApp ve Panel Üzerinden Gönder';
  }
}

// 5. Modal Helpers
function openModal(modal) {
  if (modal) {
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  }
}

function closeModal(modal) {
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 250);
  }
}

// Escape Html helper
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToastMessage(msg) {
  const toast = document.getElementById('catalog-toast');
  if (toast) {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }
}

// 6. Client Orders History Render
async function renderClientOrders() {
  const listEl = document.getElementById('client-orders-list');
  if (!listEl) return;

  const myOrders = JSON.parse(localStorage.getItem('my_catalog_orders') || '[]');
  if (myOrders.length === 0) {
    listEl.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #9ca3af;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 10px;">📋</span>
        Henüz geçmiş siparişiniz bulunmuyor.
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #9ca3af;">
      ⏳ Sipariş durumları güncelleniyor...
    </div>
  `;

  try {
    const { data: rows, error } = await supabase
      .from('orders')
      .select('*')
      .in('id', myOrders);

    if (error) throw error;

    const fetchedOrders = (rows || []).map(r => {
      const item = { ...r.data };
      item.id = Number(r.id);
      return item;
    });

    if (fetchedOrders.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #9ca3af;">
          Sipariş kaydı veritabanında bulunamadı.
        </div>
      `;
      return;
    }

    // Sort by date desc
    fetchedOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    listEl.innerHTML = fetchedOrders.map(o => {
      const orderDate = o.date ? new Date(o.date).toLocaleDateString('tr-TR') : '-';
      
      let statusText = 'Onay Bekliyor';
      let statusColor = '#3b82f6'; // Blue
      if (o.status === 'beklemede') {
        statusText = 'Üretimde (Aktif)';
        statusColor = '#f59e0b'; // Yellow/Orange
      } else if (o.status === 'tamamlandi') {
        statusText = 'Teslim Edildi';
        statusColor = '#10b981'; // Green
      } else if (o.status === 'iptal') {
        statusText = 'İptal Edildi';
        statusColor = '#ef4444'; // Red
      }

      const colorsDesc = (o.colors || []).map(c => {
        let sizeInfo = '';
        if (c.sizes && c.sizes.length > 0) {
          sizeInfo = c.sizes.map(s => `${s.size}:${s.qty}`).join(', ');
          sizeInfo = ` [${sizeInfo}]`;
        }
        return `${escapeHtml(c.color)}: ${c.qty} Çift${sizeInfo}`;
      }).join(' | ');

      return `
        <div style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span style="font-size: 0.8rem; color: #9ca3af;">Sipariş No: <strong>#${o.id}</strong></span>
              <span style="font-size: 0.75rem; color: #6b7280; margin-left: 10px;">${orderDate}</span>
            </div>
            <span style="font-size: 11px; font-weight: 700; background: ${statusColor}1A; color: ${statusColor}; padding: 3px 8px; border-radius: 9999px; border: 1px solid ${statusColor}33;">
              ${statusText}
            </span>
          </div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 4px;">
            Model: ${escapeHtml(o.modelCode)}
          </div>
          <div style="font-size: 0.8rem; color: #d1d5db; line-height: 1.4;">
            ${escapeHtml(colorsDesc)}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.85rem; border-top: 1px dashed rgba(255,255,255,0.03); padding-top: 8px;">
            <span style="color: #9ca3af;">Toplam: <strong>${o.qty} Çift</strong></span>
            <span style="color: #10b981; font-weight: 800;">₺${Number(o.price * o.qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    listEl.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--color-danger);">
        Durumlar güncellenemedi: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

// 7. Bind UI Events
const modalClientOrders = document.getElementById('client-orders-modal');

document.getElementById('btn-close-opt-modal').onclick = () => closeModal(modalOpt);
document.getElementById('btn-close-cart-modal').onclick = () => closeModal(modalCart);
document.getElementById('btn-open-cart').onclick = () => {
  renderCart();
  openModal(modalCart);
};
document.getElementById('btn-add-to-cart').onclick = addToCart;
document.getElementById('cart-checkout-form').onsubmit = submitOrder;

// Open/Close Client Orders Modals
const btnOpenOrders = document.getElementById('btn-open-orders');
if (btnOpenOrders) {
  btnOpenOrders.onclick = () => {
    renderClientOrders();
    openModal(modalClientOrders);
  };
}

const btnCloseOrders = document.getElementById('btn-close-client-orders-modal');
if (btnCloseOrders) btnCloseOrders.onclick = () => closeModal(modalClientOrders);

const btnCloseOrdersBottom = document.getElementById('btn-close-client-orders-modal-bottom');
if (btnCloseOrdersBottom) btnCloseOrdersBottom.onclick = () => closeModal(modalClientOrders);

// Global bindings
window.selectProduct = selectProduct;
window.removeFromCart = removeFromCart;

// Register Service Worker for Catalog
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    console.log('ServiceWorker registered in catalog successfully:', reg.scope);
  }).catch(err => {
    console.warn('ServiceWorker registration failed in catalog:', err);
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function checkClientPushState() {
  const btn = document.getElementById('btn-push-bell');
  if (!btn) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    btn.style.display = 'none';
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      btn.style.background = 'rgba(16, 185, 129, 0.1)';
      btn.style.color = '#10b981';
      btn.style.borderColor = 'rgba(16, 185, 129, 0.2)';
      btn.title = 'Anlık Bildirimler Açık 🟢 (Kapatmak için tıklayın)';
    } else {
      btn.style.background = 'rgba(245, 158, 11, 0.1)';
      btn.style.color = '#f59e0b';
      btn.style.borderColor = 'rgba(245, 158, 11, 0.2)';
      btn.title = 'Anlık Bildirimleri Aç 🔔';
    }
  } catch (err) {
    console.warn(err);
  }
}

async function toggleClientPush() {
  const btn = document.getElementById('btn-push-bell');
  if (!btn) return;
  btn.disabled = true;
  
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    
    if (sub) {
      await sub.unsubscribe();
      if (supabase) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
      alert('Bildirim aboneliği kapatıldı.');
    } else {
      const VAPID_PUBLIC_KEY = "BG1947QNf0x6COBkxo4HX129RGPSMnWgdNq453kRFVV4CSaPYojaFBG95Tm9DMetWkdqR2PxiL0pWQZt4rwoXZk";
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Bildirim izni reddedildi. Ayarlarınızdan bildirimlere izin vermeniz gerekir.');
        btn.disabled = false;
        return;
      }
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      const subscriptionData = {
        endpoint: newSub.endpoint,
        keys: JSON.parse(JSON.stringify(newSub.toJSON().keys)),
        workshop_id: companyName || 'default_workshop',
        user_type: 'client'
      };
      
      if (supabase) {
        await supabase
          .from('push_subscriptions')
          .insert([subscriptionData]);
      }
      
      alert('Harika! Siparişiniz onaylandığında veya durum değişiminde anlık bildirim alacaksınız. 🔔');
    }
    await checkClientPushState();
  } catch (err) {
    console.error(err);
    alert('Abonelik hatası: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

// Bind Bell Button Events
const btnPushBell = document.getElementById('btn-push-bell');
if (btnPushBell) {
  btnPushBell.onclick = toggleClientPush;
  setTimeout(checkClientPushState, 1000);
}

// Start Catalog
initCatalog();
