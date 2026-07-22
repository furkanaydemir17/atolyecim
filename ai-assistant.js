import { escapeHtml } from './utils.js';

const AiAssistant = {
  isThinking: false,

  navigateToPage(pageName) {
    const item = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (item) {
      item.click();
      return true;
    }
    return false;
  },

  init() {
    this.bindEvents();
    this.updateBadge();
    this.renderWelcome();
  },

  bindEvents() {
    const chatForm = document.getElementById('ai-chat-form');
    if (chatForm && !chatForm._bound) {
      chatForm._bound = true;
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('ai-chat-input');
        if (!input || !input.value.trim() || this.isThinking) return;
        const query = input.value.trim();
        input.value = '';
        this.ask(query);
      });
    }

    // Suggestion buttons
    document.querySelectorAll('.ai-suggest-btn').forEach(btn => {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', () => {
          if (this.isThinking) return;
          const query = btn.getAttribute('data-query') || btn.textContent.trim();
          this.ask(query);
        });
      }
    });
  },

  updateBadge() {
    const badge = document.getElementById('ai-mode-badge');
    if (!badge) return;
    badge.textContent = '⚡ Yerel Yapay Zeka (Aktif)';
    badge.className = 'db-status-badge local';
    badge.style.background = 'rgba(99, 102, 241, 0.15)';
    badge.style.color = 'var(--text-accent)';
    badge.style.border = '1px solid var(--border-card)';
  },

  renderWelcome() {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;
    container.innerHTML = `
      <div class="ai-msg-bubble assistant" style="display: flex; gap: 10px; align-items: flex-start; max-width: 85%;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: 0 0 10px rgba(99,102,241,0.3);">🤖</div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-card); border-radius: 0 16px 16px 16px; padding: 12px 16px; line-height: 1.5; font-size: 0.92rem; color: var(--text-primary);">
          Selam Patron! Atölyecim Yerel Yapay Zeka Asistanı hizmetinde. 👋 <br><br>
          Veritabanındaki tüm bilgilere bu sohbet panelinden anında erişebilirsin.
          <br><br>
          **Neler Sorabilirsin?**<br>
          • 📦 *"tüm stoklarımı göster"* veya *"Comfort EVA ne kadar var?"*<br>
          • 💰 *"tüm cariler"* veya *"Özkan Ayakkabı bakiye"*<br>
          • 📋 *"tüm siparişler"* veya *"üretim raporu"*<br>
          • 👟 *"ürün listesi"* (Katalog fiyatları)<br>
          • ⚠️ *"kritik stok limitleri"* (Eksilen malzemeler)<br><br>
          Hızlı butonları kullanabilir ya da dilediğin soruyu yazabilirsin!
        </div>
      </div>
    `;
  },

  addMessage(sender, htmlContent) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    const isAssistant = sender === 'assistant';
    const alignStyle = isAssistant ? 'align-self: flex-start;' : 'align-self: flex-end; flex-direction: row-reverse;';
    const bgStyle = isAssistant ? 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-card); border-radius: 0 16px 16px 16px;' : 'background: var(--accent-gradient); border-radius: 16px 0 16px 16px; color: #fff;';
    const icon = isAssistant ? '🤖' : '👤';
    const iconBg = isAssistant ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.15)';

    const bubbleHtml = `
      <div class="ai-msg-bubble ${sender}" style="display: flex; gap: 10px; align-items: flex-start; max-width: 85%; ${alignStyle}">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: 0 0 10px rgba(99,102,241,0.2);">${icon}</div>
        <div style="${bgStyle} padding: 12px 16px; line-height: 1.5; font-size: 0.92rem;">
          ${htmlContent}
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', bubbleHtml);
    container.scrollTop = container.scrollHeight;
  },

  formatResponse(text) {
    let formatted = escapeHtml(text);
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  },

  async ask(query) {
    if (this.isThinking) return;
    this.isThinking = true;

    // Add user message
    this.addMessage('user', escapeHtml(query));

    // Add typing indicator
    const container = document.getElementById('ai-chat-messages');
    const indicatorId = 'ai-typing-indicator';
    const indicatorHtml = `
      <div id="${indicatorId}" style="display: flex; gap: 10px; align-items: flex-start; max-width: 85%; align-self: flex-start;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">🤖</div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-card); border-radius: 0 16px 16px 16px; padding: 12px 16px; font-style: italic; color: var(--text-muted);">
          Düşünüyor...
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', indicatorHtml);
    container.scrollTop = container.scrollHeight;

    try {
      const responseHtml = await this.queryLocal(query);

      // Remove indicator
      const indicator = document.getElementById(indicatorId);
      if (indicator) indicator.remove();

      this.addMessage('assistant', responseHtml);
    } catch (err) {
      console.error('AI Error:', err);
      const indicator = document.getElementById(indicatorId);
      if (indicator) indicator.remove();
      this.addMessage('assistant', `<span style="color:var(--color-danger);">Yanıt oluşturulurken bir hata oluştu: ${escapeHtml(err.message)}</span>`);
    } finally {
      this.isThinking = false;
    }
  },

  async queryLocal(query) {
    const q = query.toLowerCase().trim();

    // 1. PAGE NAVIGATION TRIGGERS (göster / aç / git / yönlendir)
    if (q.includes('göster') || q.includes('aç') || q.includes('git') || q.includes('yönlendir') || q.includes('paneli') || q.includes('ekranı')) {
      if (q.includes('yönetici') || q.includes('ayarlar') || q.includes('yönetim')) {
        const navigated = this.navigateToPage('manager');
        if (navigated) return 'Başarıyla **Yönetici Paneline** yönlendirildiniz. ⚙️';
      }
      if (q.includes('admin') || q.includes('süper admin')) {
        const navigated = this.navigateToPage('admin');
        if (navigated) return 'Başarıyla **Süper Admin Paneline** yönlendirildiniz. 👑';
      }
      if (q.includes('kontrol') || q.includes('dashboard') || q.includes('ana sayfa') || q.includes('ana menü')) {
        const navigated = this.navigateToPage('dashboard');
        if (navigated) return 'Başarıyla **Kontrol Paneline** yönlendirildiniz. 📊';
      }
      if (q.includes('cari') || q.includes('müşteri')) {
        const navigated = this.navigateToPage('contacts');
        if (navigated) return 'Başarıyla **Cari Hesaplar** sayfasına yönlendirildiniz. 👥';
      }
      if (q.includes('sipariş')) {
        const navigated = this.navigateToPage('orders');
        if (navigated) return 'Başarıyla **Siparişler** sayfasına yönlendirildiniz. 📋';
      }
      if (q.includes('ürün') || q.includes('model')) {
        const navigated = this.navigateToPage('products');
        if (navigated) return 'Başarıyla **Ürünler & Modeller** sayfasına yönlendirildiniz. 👟';
      }
      if (q.includes('barkod') || q.includes('kamera') || q.includes('tara')) {
        const navigated = this.navigateToPage('barcode');
        if (navigated) return 'Başarıyla **Barkod Okutma** sayfasına yönlendirildiniz. 📷';
      }
      if (q.includes('silinen') || q.includes('çöp') || q.includes('geri dönüşüm')) {
        const navigated = this.navigateToPage('recycle');
        if (navigated) return 'Başarıyla **Son Silinenler / Geri Dönüşüm** kutusuna yönlendirildiniz. 🗑️';
      }
      if (q.includes('stok') || q.includes('envanter')) {
        if (q.includes('taban')) {
          const navigated = this.navigateToPage('stock-sole');
          if (navigated) return 'Başarıyla **Taban Stokları** sayfasına yönlendirildiniz. 👟';
        }
        if (q.includes('aksesuar')) {
          const navigated = this.navigateToPage('stock-accessory');
          if (navigated) return 'Başarıyla **Aksesuar Stokları** sayfasına yönlendirildiniz. 💍';
        }
        if (q.includes('deri')) {
          const navigated = this.navigateToPage('stock-leather');
          if (navigated) return 'Başarıyla **Deri Stokları** sayfasına yönlendirildiniz. 👜';
        }
        if (q.includes('ham') || q.includes('madde')) {
          const navigated = this.navigateToPage('stock-raw');
          if (navigated) return 'Başarıyla **Ham Madde Stokları** sayfasına yönlendirildiniz. 📦';
        }
      }
    }

    // 2. ACTION / MODAL TRIGGERS (ekle / oluştur / yeni / gir)
    if (q.includes('ekle') || q.includes('oluştur') || q.includes('yeni') || q.includes('gir') || q.includes('tanımla')) {
      if (q.includes('stok') || q.includes('taban') || q.includes('aksesuar') || q.includes('deri') || q.includes('ham')) {
        let type = 'sole';
        let typeText = 'Taban';
        if (q.includes('aksesuar')) { type = 'accessory'; typeText = 'Aksesuar'; }
        else if (q.includes('deri')) { type = 'leather'; typeText = 'Deri'; }
        else if (q.includes('ham') || q.includes('madde')) { type = 'raw'; typeText = 'Ham Madde'; }
        
        this.navigateToPage('stock-' + type);
        if (window.Stocks && typeof window.Stocks.openModal === 'function') {
          setTimeout(() => window.Stocks.openModal(type), 150);
          return `Sizin için **Stoklarım > ${typeText} Stokları** sayfasını açtım ve **Yeni ${typeText} Ekle** penceresini başlattım! 👟`;
        }
      }
      if (q.includes('cari') || q.includes('müşteri') || q.includes('tedarikçi')) {
        this.navigateToPage('contacts');
        if (window.Contacts && typeof window.Contacts.openModal === 'function') {
          setTimeout(() => window.Contacts.openModal(), 150);
          return 'Sizin için **Cari Hesaplar** sayfasını açtım ve **Yeni Cari Ekle** formunu başlattım! 👥';
        }
      }
      if (q.includes('sipariş')) {
        this.navigateToPage('orders');
        if (window.Orders && typeof window.Orders.openModal === 'function') {
          setTimeout(() => window.Orders.openModal(), 150);
          return 'Sizin için **Siparişler** sayfasını açtım ve **Yeni Sipariş Ekle** formunu başlattım! 📋';
        }
      }
      if (q.includes('ürün') || q.includes('model')) {
        this.navigateToPage('products');
        if (window.Products && typeof window.Products.openModal === 'function') {
          setTimeout(() => window.Products.openModal(), 150);
          return 'Sizin için **Ürünler & Modeller** sayfasını açtım ve **Yeni Ürün Ekle** formunu başlattım! 👟';
        }
      }
    }

    const stocks = await dbGetAll('stocks');
    const contacts = await dbGetAll('contacts');
    const orders = await dbGetAll('orders');
    const products = await dbGetAll('products');
    const transactions = await dbGetAll('transactions');

    // Helper: calculate balance for a contact
    const getContactBalance = (contactId) => {
      const txs = transactions.filter(t => t.contactId === contactId && !t.isPackaging);
      let bal = 0;
      txs.forEach(t => {
        const amt = Number(t.amount || 0);
        if (t.type === 'alacak') { bal += amt; }       // Receivable: adds to balance (customer owes us)
        else if (t.type === 'tahsilat') { bal -= amt; }  // Collection: reduces balance (customer paid)
        else if (t.type === 'borc') { bal -= amt; }      // Debt: we owe them (reduces our net)
        else if (t.type === 'odeme') { bal += amt; }     // Payment: we paid (reduces what we owe)
      });
      return bal;
    };

    // 1. Check specific contact match
    let matchedContact = null;
    for (const c of contacts) {
      if (q.includes(c.name.toLowerCase())) {
        matchedContact = c;
        break;
      }
    }
    if (matchedContact) {
      const bal = getContactBalance(matchedContact.id);
      const balText = bal > 0 
        ? `<strong style="color:var(--color-success);">₺${bal.toLocaleString('tr-TR', {minimumFractionDigits:2})} Alacaklıyız</strong>` 
        : bal < 0 
          ? `<strong style="color:var(--color-danger);">₺${Math.abs(bal).toLocaleString('tr-TR', {minimumFractionDigits:2})} Borçluyuz</strong>`
          : 'Bakiye dengede (₺0,00)';
      return `
        <strong>👤 Cari Hesap Detay Raporu: ${escapeHtml(matchedContact.name)}</strong><br><br>
        • 📞 **Telefon:** ${escapeHtml(matchedContact.phone || '-')}<br>
        • 📍 **Adres:** ${escapeHtml(matchedContact.address || '-')}<br>
        • ⚖️ **Güncel Bakiye:** ${balText}<br>
      `;
    }

    // 2. Check specific stock name match
    let matchedStockName = null;
    const uniqueStockNames = [...new Set(stocks.map(s => s.name.toLowerCase()))];
    for (const name of uniqueStockNames) {
      if (q.includes(name)) {
        matchedStockName = name;
        break;
      }
    }
    if (matchedStockName) {
      const matchingItems = stocks.filter(s => s.name.toLowerCase() === matchedStockName);
      const totalQty = matchingItems.reduce((acc, item) => acc + Number(item.qty || 0), 0);
      let html = `<strong>📦 Stok Arama Sonucu: "${escapeHtml(matchingItems[0].name)}"</strong><br>`;
      html += `• Toplam Mevcut: <strong>${totalQty} ${matchingItems[0].unit || 'Birim'}</strong><br><br>`;
      html += '<strong>Beden / Renk Detayları:</strong><br>';
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-top:5px;">';
      matchingItems.forEach(item => {
        const detail = item.size ? ` Beden: ${item.size}` : '';
        const color = item.color ? `, Renk: ${item.color}` : '';
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);"><td style="padding:4px 0;">${escapeHtml(detail)}${escapeHtml(color)}</td><td style="text-align:right; font-weight:700;">${item.qty} ${item.unit}</td></tr>`;
      });
      html += '</table>';
      return html;
    }

    // 3. "tüm stoklar" / "stok listesi"
    if ((q.includes('tüm') || q.includes('hepsi') || q.includes('listele') || q.includes('göster')) && q.includes('stok')) {
      if (stocks.length === 0) return 'Atölyede kayıtlı herhangi bir stok bulunmamaktadır.';
      const grouped = { sole: [], accessory: [], leather: [], raw: [] };
      stocks.forEach(s => {
        if (grouped[s.type]) grouped[s.type].push(s);
      });
      const typeTitles = { sole: 'Tabanlar', accessory: 'Aksesuarlar', leather: 'Deriler', raw: 'Ham Maddeler' };
      let html = '<strong>📋 Tüm Stok Listesi (Genel Durum):</strong><br><br>';
      for (const key in grouped) {
        if (grouped[key].length === 0) continue;
        html += `<strong>🔹 ${typeTitles[key]} (${grouped[key].length} Kalem):</strong><br>`;
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:12px; margin-top:4px;">';
        grouped[key].forEach(s => {
          const detail = s.size ? ` (${s.size})` : '';
          const colorDetail = s.color ? ` - ${s.color}` : '';
          html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);"><td style="padding:4px 0;">${escapeHtml(s.name)}${escapeHtml(detail)}${escapeHtml(colorDetail)}</td><td style="text-align:right; font-weight:700;">${s.qty} ${s.unit}</td></tr>`;
        });
        html += '</table>';
      }
      return html;
    }

    // 4. "kritik stok" / "limit"
    if (q.includes('limit') || q.includes('kritik')) {
      const critical = stocks.filter(s => Number(s.qty || 0) <= Number(s.limit || 0));
      if (critical.length === 0) {
        return 'Sistemde kritik limitin altında herhangi bir stok kalemi bulunmuyor. Her şey yolunda patron! 👍';
      }
      let html = '<strong>⚠️ Kritik Limit Altındaki Stok Kalemleri:</strong><br><br>';
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-top:5px;">';
      html += '<tr style="border-bottom:1px solid var(--border-card); text-align:left; color:var(--text-muted);"><th style="padding:6px 0;">Malzeme</th><th style="text-align:right;">Mevcut</th><th style="text-align:right;">Kritik Limit</th></tr>';
      critical.forEach(s => {
        const typeText = s.type === 'sole' ? 'Taban' : s.type === 'accessory' ? 'Aksesuar' : s.type === 'leather' ? 'Deri' : 'Ham Madde';
        const detail = s.size ? ` (${s.size})` : '';
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);"><td style="padding:6px 0;">${escapeHtml(s.name)}${escapeHtml(detail)} <span style="font-size:0.75rem; color:var(--text-muted);">[${typeText}]</span></td><td style="text-align:right; color:var(--color-danger); font-weight:700;">${s.qty}</td><td style="text-align:right; color:var(--text-muted);">${s.limit}</td></tr>`;
      });
      html += '</table>';
      return html;
    }

    // 5. "tüm cariler" / "müşteriler"
    if ((q.includes('tüm') || q.includes('hepsi') || q.includes('listele') || q.includes('göster')) && (q.includes('cari') || q.includes('müşteri') || q.includes('tedarikçi'))) {
      if (contacts.length === 0) return 'Atölyede kayıtlı cari hesap bulunmamaktadır.';
      let html = '<strong>👥 Tüm Cari Hesap Listesi ve Bakiyeler:</strong><br><br>';
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">';
      contacts.forEach(c => {
        const bal = getContactBalance(c.id);
        const color = bal > 0 ? 'var(--color-success)' : bal < 0 ? 'var(--color-danger)' : 'var(--text-muted)';
        const typeText = bal > 0 ? 'Alacak' : bal < 0 ? 'Borç' : 'Dengede';
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);"><td style="padding:6px 0;">${escapeHtml(c.name)}</td><td style="text-align:right; color:${color}; font-weight:700;">${typeText}: ₺${Math.abs(bal).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td></tr>`;
      });
      html += '</table>';
      return html;
    }

    // 6. "alacak" / "borç" / "bakiye" general summary
    if (q.includes('alacak') || q.includes('borç') || q.includes('bakiye') || q.includes('ekstre')) {
      let totalReceivable = 0;
      let totalPayable = 0;
      contacts.forEach(c => {
        const bal = getContactBalance(c.id);
        if (bal > 0) totalReceivable += bal;
        else if (bal < 0) totalPayable += Math.abs(bal);
      });
      return `
        <strong>💰 Genel Borç / Alacak Dengesi:</strong><br><br>
        • Toplam Alacağımız (Müşterilerden): <strong style="color:var(--color-success);">₺${totalReceivable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong><br>
        • Toplam Borcumuz (Tedarikçilere): <strong style="color:var(--color-danger);">₺${totalPayable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong><br><br>
        Detaylı liste için *"tüm cariler"* yazabilirsiniz.
      `;
    }

    // 7. "tüm siparişler" / "sipariş listesi"
    if (q.includes('sipariş') || q.includes('üretim') || q.includes('durum')) {
      if (orders.length === 0) return 'Sistemde kayıtlı sipariş bulunmamaktadır.';
      const active = orders.filter(o => o.status === 'beklemede');
      const completed = orders.filter(o => o.status === 'tamamlandi');
      const cancelled = orders.filter(o => o.status === 'iptal');

      let html = '<strong>📋 Sipariş Durum Analiz Raporu:</strong><br><br>';
      html += `• ⏳ **Üretimdeki Aktif Siparişler:** ${active.length} sipariş<br>`;
      html += `• ✅ **Tamamlanan / Teslim Edilen:** ${completed.length} sipariş<br>`;
      html += `• ❌ **İptal Edilen:** ${cancelled.length} sipariş<br><br>`;

      if (orders.length > 0) {
        html += '<strong>Sipariş Listesi (En Son 10 Kayıt):</strong><br>';
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-top:5px;">';
        orders.slice(-10).forEach(o => {
          const client = contacts.find(c => c.id === o.contactId);
          const cName = client ? client.name : 'Bilinmeyen Müşteri';
          const statusText = o.status === 'beklemede' ? '⏳ Üretimde' : o.status === 'tamamlandi' ? '✅ Teslim Edildi' : '❌ İptal';
          html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);"><td style="padding:6px 0;"><strong>${escapeHtml(o.modelCode)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">[${escapeHtml(cName)}]</span></td><td style="text-align:right;">${o.totalPair} Çift (${statusText})</td></tr>`;
        });
        html += '</table>';
      }
      return html;
    }

    // 8. "ürünler" / "modeller" / "katalog"
    if (q.includes('ürün') || q.includes('model') || q.includes('katalog') || q.includes('fiyat')) {
      if (products.length === 0) return 'Ürün kataloğunda henüz kayıtlı bir ürün bulunmuyor.';
      let html = '<strong>👟 Ürün Katalog ve Fiyat Listesi:</strong><br><br>';
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">';
      products.forEach(p => {
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);"><td style="padding:6px 0;"><strong>${escapeHtml(p.modelCode)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${escapeHtml(p.category || 'Kategori Yok')})</span></td><td style="text-align:right; font-weight:700; color:var(--text-accent);">₺${Number(p.price || 0).toLocaleString('tr-TR', {minimumFractionDigits:2})}</td></tr>`;
      });
      html += '</table>';
      return html;
    }

    // 9. General summary / help / welcome
    if (q.includes('özet') || q.includes('bugün') || q.includes('atölye') || q.includes('yardım') || q.includes('merhaba') || q.includes('selam')) {
      return `
        <strong>🤖 Atölyecim Yerel Akıllı Asistanı</strong><br><br>
        Uygulama içerisindeki her türlü bilgiye doğrudan bu sohbet panelinden ulaşabilirsiniz. <br><br>
        **Sorabileceğiniz Hızlı Şablonlar:**<br>
        • 📦 *"tüm stoklarımı göster"* - Tüm envanteri listeler.<br>
        • 💰 *"tüm cariler"* - Müşteri borç/alacak bakiyelerini döker.<br>
        • 📋 *"tüm siparişler"* - Siparişlerin üretim süreçlerini raporlar.<br>
        • 👟 *"ürün listesi"* - Kayıtlı modelleri fiyatlarıyla getirir.<br>
        • 🔍 Bir stok adı yazarak (Örn: *"Comfort EVA"*) kalan çift adedini sorgulayabilirsiniz.<br>
        • Bir cari ismi yazarak (Örn: *"Özkan Ayakkabı"*) güncel bakiyeyi öğrenebilirsiniz.
      `;
    }

    return 'Üzgünüm, sorunuzu yerel modda tam olarak eşleştiremedim. Tüm envanteri sorgulamak için **"tüm stoklar"**, cari bakiyeleri için **"tüm cariler"**, sipariş durumları için **"tüm siparişler"** yazabilirsiniz.';
  }
};

window.AiAssistant = AiAssistant;
export default AiAssistant;
