import { escapeHtml } from './utils.js';

const AiAssistant = {
  isThinking: false,
  isOpen: false,
  recognition: null,
  isListening: false,

  init() {
    this.bindEvents();
    this.initSpeechRecognition();
    this.renderWelcome();
  },

  bindEvents() {
    // Global delegation for opening the AI drawer from any button
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('#btn-top-ai-assistant, #btn-floating-ai-assistant, .btn-top-ai-assistant, .ai-floating-trigger, [data-open-ai]');
      if (openBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleDrawer(true);
      }

      const closeBtn = e.target.closest('#btn-ai-close-drawer, #ai-drawer-overlay');
      if (closeBtn) {
        e.preventDefault();
        this.toggleDrawer(false);
      }
    });

    const clearBtn = document.getElementById('btn-ai-clear-chat');
    if (clearBtn && !clearBtn._bound) {
      clearBtn._bound = true;
      clearBtn.addEventListener('click', () => {
        const container = document.getElementById('ai-drawer-chat-messages');
        if (container) container.innerHTML = '';
        this.renderWelcome();
        showToast('Sohbet geçmişi temizlendi.', 'info');
      });
    }

    // 3. Drawer Chat Form
    const drawerForm = document.getElementById('ai-drawer-chat-form');
    if (drawerForm && !drawerForm._bound) {
      drawerForm._bound = true;
      drawerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('ai-drawer-input');
        if (!input || !input.value.trim() || this.isThinking) return;
        const query = input.value.trim();
        input.value = '';
        this.ask(query);
      });
    }

    // 4. In-page Legacy Chat Form (if open)
    const pageForm = document.getElementById('ai-chat-form');
    if (pageForm && !pageForm._bound) {
      pageForm._bound = true;
      pageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('ai-chat-input');
        if (!input || !input.value.trim() || this.isThinking) return;
        const query = input.value.trim();
        input.value = '';
        this.ask(query);
      });
    }

    // 5. Quick Suggestion Buttons
    document.querySelectorAll('.ai-quick-chip, .ai-suggest-btn').forEach(btn => {
      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', () => {
          if (this.isThinking) return;
          const query = btn.getAttribute('data-query') || btn.textContent.trim();
          this.ask(query);
        });
      }
    });

    // 6. Global Keyboard Shortcuts (Ctrl+K or Ctrl+Space)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'Space')) {
        e.preventDefault();
        this.toggleDrawer();
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.toggleDrawer(false);
      }
    });

    // 7. Voice Recognition Button
    const voiceBtn = document.getElementById('btn-ai-voice-input');
    if (voiceBtn && !voiceBtn._bound) {
      voiceBtn._bound = true;
      voiceBtn.addEventListener('click', () => this.toggleSpeech());
    }
  },

  toggleDrawer(forceState) {
    const drawer = document.getElementById('ai-copilot-drawer');
    const overlay = document.getElementById('ai-drawer-overlay');
    if (!drawer || !overlay) return;

    this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;

    if (this.isOpen) {
      overlay.classList.add('open');
      drawer.classList.add('open');
      const input = document.getElementById('ai-drawer-input');
      if (input) setTimeout(() => input.focus(), 250);
    } else {
      overlay.classList.remove('open');
      drawer.classList.remove('open');
      if (this.isListening) this.stopSpeech();
    }
  },

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'tr-TR';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        const btn = document.getElementById('btn-ai-voice-input');
        if (btn) btn.classList.add('listening');
        showToast('🎙️ Dinliyorum... Konuşun', 'info');
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const input = document.getElementById('ai-drawer-input');
          if (input) input.value = transcript;
          this.ask(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech error:', event.error);
        this.stopSpeech();
        showToast('Ses algılanamadı veya mikrofon izni verilmedi.', 'warning');
      };

      this.recognition.onend = () => {
        this.stopSpeech();
      };
    }
  },

  toggleSpeech() {
    if (!this.recognition) {
      showToast('Tarayıcınız ses tanıma özelliğini desteklemiyor. Lütfen Chrome veya Edge kullanın.', 'warning');
      return;
    }
    if (this.isListening) {
      this.stopSpeech();
    } else {
      try {
        this.recognition.start();
      } catch (e) {
        this.stopSpeech();
      }
    }
  },

  stopSpeech() {
    this.isListening = false;
    const btn = document.getElementById('btn-ai-voice-input');
    if (btn) btn.classList.remove('listening');
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
  },

  navigateToPage(pageName, callback) {
    const item = document.querySelector(`.nav-item[data-page="${pageName}"], .nav-sub-item[data-page="${pageName}"]`);
    if (item) {
      item.click();
      if (typeof callback === 'function') setTimeout(callback, 200);
      return true;
    }
    return false;
  },

  renderWelcome() {
    const containers = [
      document.getElementById('ai-drawer-chat-messages'),
      document.getElementById('ai-chat-messages')
    ].filter(Boolean);

    const welcomeHtml = `
      <div class="ai-msg-bubble assistant" style="display: flex; gap: 10px; align-items: flex-start; max-width: 90%;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #0f172a, #334155); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">🤖</div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0 14px 14px 14px; padding: 12px 14px; line-height: 1.5; font-size: 0.88rem; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <strong>Selam Patron! Atölyecim AI Copilot hazır. 👋</strong><br><br>
          Atölyendeki tüm siparişleri, stok durumunu, cari hesap bakiyelerini ve fason üretim aşamalarını anlık olarak analiz edebilirim.<br><br>
          <strong>Hızlı İşlemler:</strong><br>
          • 📊 <em>"günlük brifing"</em> veya <em>"atölye özeti"</em><br>
          • ⚠️ <em>"kritik stoklar"</em> veya <em>"biten malzemeler"</em><br>
          • ⏳ <em>"geciken siparişler"</em> veya <em>"yaklaşan teslimatlar"</em><br>
          • 💰 <em>"alacak borç dengesi"</em> veya <em>"Ahmet Kundura bakiye"</em><br>
          • ✂️ <em>"kesim ve sayadaki işler"</em><br>
          • 💬 <em>"[Müşteri Adı] için WhatsApp hatırlatması yaz"</em><br><br>
          Mikrofonla konuşabilir veya yukarıdaki hazır etiketlere tıklayabilirsiniz!
        </div>
      </div>
    `;

    containers.forEach(c => {
      c.innerHTML = welcomeHtml;
    });
  },

  addMessage(sender, htmlContent) {
    const containers = [
      document.getElementById('ai-drawer-chat-messages'),
      document.getElementById('ai-chat-messages')
    ].filter(Boolean);

    const isAssistant = sender === 'assistant';
    const alignStyle = isAssistant ? 'align-self: flex-start;' : 'align-self: flex-end; flex-direction: row-reverse;';
    const bgStyle = isAssistant 
      ? 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0 14px 14px 14px; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.04);' 
      : 'background: #0f172a; border-radius: 14px 0 14px 14px; color: #ffffff; box-shadow: 0 2px 6px rgba(15,23,42,0.15);';
    const icon = isAssistant ? '🤖' : '👤';
    const iconBg = isAssistant ? 'linear-gradient(135deg, #0f172a, #334155)' : '#3b82f6';

    const bubbleHtml = `
      <div class="ai-msg-bubble ${sender}" style="display: flex; gap: 10px; align-items: flex-start; max-width: 90%; margin-bottom: 12px; ${alignStyle}">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${iconBg}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">${icon}</div>
        <div style="${bgStyle} padding: 12px 14px; line-height: 1.5; font-size: 0.88rem;">
          ${htmlContent}
        </div>
      </div>
    `;

    containers.forEach(c => {
      c.insertAdjacentHTML('beforeend', bubbleHtml);
      c.scrollTop = c.scrollHeight;
    });
  },

  async ask(query) {
    if (this.isThinking || !query.trim()) return;
    this.isThinking = true;

    // Add user message
    this.addMessage('user', escapeHtml(query));

    // Add typing indicator
    const indicatorId = 'ai-typing-indicator';
    const indicatorHtml = `
      <div id="${indicatorId}" style="display: flex; gap: 10px; align-items: flex-start; max-width: 90%; align-self: flex-start; margin-bottom: 12px;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;">🤖</div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0 14px 14px 14px; padding: 10px 14px; font-style: italic; color: #64748b; font-size: 0.85rem;">
          Atölye verileri analiz ediliyor... ⚡
        </div>
      </div>
    `;

    [document.getElementById('ai-drawer-chat-messages'), document.getElementById('ai-chat-messages')].filter(Boolean).forEach(c => {
      c.insertAdjacentHTML('beforeend', indicatorHtml);
      c.scrollTop = c.scrollHeight;
    });

    try {
      const responseHtml = await this.queryLocal(query);

      document.querySelectorAll(`#${indicatorId}`).forEach(el => el.remove());
      this.addMessage('assistant', responseHtml);
    } catch (err) {
      console.error('AI query error:', err);
      document.querySelectorAll(`#${indicatorId}`).forEach(el => el.remove());
      this.addMessage('assistant', `<span style="color:#ef4444; font-weight:700;">Hata oluştu: ${escapeHtml(err.message)}</span>`);
    } finally {
      this.isThinking = false;
    }
  },

  async queryLocal(query) {
    const q = query.toLowerCase().trim();

    // Fetch live tables from IndexedDB
    const stocks = await dbGetAll('stocks');
    const contacts = await dbGetAll('contacts');
    const orders = await dbGetAll('orders');
    const products = await dbGetAll('products');
    const transactions = await dbGetAll('transactions');
    const jobTickets = await dbGetAll('job_tickets');
    const contractors = await dbGetAll('contractors');
    const recipes = await dbGetAll('recipes');

    // Helper: calculate balance for a contact
    const getContactBalance = (contactId) => {
      const txs = transactions.filter(t => t.contactId === contactId && !t.isPackaging);
      let bal = 0;
      txs.forEach(t => {
        const amt = Number(t.amount || 0);
        if (t.type === 'alacak') bal += amt;
        else if (t.type === 'tahsilat') bal -= amt;
        else if (t.type === 'borc') bal -= amt;
        else if (t.type === 'odeme') bal += amt;
      });
      return bal;
    };

    // 1. ACTION & PAGE TRIGGERS (ekle, oluştur, yeni, aç, git)
    if (q.includes('ekle') || q.includes('oluştur') || q.includes('yeni') || q.includes('gir') || q.includes('tanımla')) {
      if (q.includes('sipariş')) {
        this.navigateToPage('orders', () => {
          if (window.Orders && typeof window.Orders.openModal === 'function') window.Orders.openModal();
        });
        return `
          Sizin için <strong>Siparişler</strong> sayfasını açtım ve <strong>Yeni Sipariş Formunu</strong> başlattım! 📋
          <div class="ai-action-btn-row">
            <button class="ai-action-btn" onclick="Orders.openModal()">📋 Sipariş Formunu Aç</button>
            <button class="ai-action-btn" onclick="Orders.openEmailImportModal()">✉️ E-posta Siparişi Al</button>
          </div>
        `;
      }
      if (q.includes('cari') || q.includes('müşteri') || q.includes('tedarikçi')) {
        this.navigateToPage('contacts', () => {
          if (window.Contacts && typeof window.Contacts.openModal === 'function') window.Contacts.openModal();
        });
        return `
          Sizin için <strong>Cari Hesaplar</strong> sayfasını açtım ve <strong>Yeni Cari Ekle</strong> formunu başlattım! 👥
          <div class="ai-action-btn-row">
            <button class="ai-action-btn" onclick="Contacts.openModal()">➕ Yeni Cari Ekle</button>
          </div>
        `;
      }
      if (q.includes('stok') || q.includes('taban') || q.includes('deri') || q.includes('aksesuar') || q.includes('ham')) {
        let type = 'sole';
        let label = 'Taban';
        if (q.includes('aksesuar')) { type = 'accessory'; label = 'Aksesuar'; }
        else if (q.includes('deri')) { type = 'leather'; label = 'Deri'; }
        else if (q.includes('ham') || q.includes('madde')) { type = 'raw'; label = 'Ham Madde'; }

        this.navigateToPage('stock-' + type, () => {
          if (window.Stocks && typeof window.Stocks.openModal === 'function') window.Stocks.openModal(type);
        });
        return `
          Sizin için <strong>${label} Stokları</strong> sayfasını açtım ve <strong>Yeni ${label} Girişi</strong> formunu başlattım! 📦
        `;
      }
      if (q.includes('iş fişi') || q.includes('takip fişi') || q.includes('fiş')) {
        this.navigateToPage('job-tickets', () => {
          const btn = document.getElementById('btn-add-job-ticket');
          if (btn) btn.click();
        });
        return `Sizin için <strong>İş Takip Fişleri</strong> sayfasını açtım ve yeni fiş kesme formunu başlattım! 📋`;
      }
    }

    // 2. WHATSAPP MESAJI OLUŞTURMA TALEP EDİLDİYSE
    if (q.includes('whatsapp') || q.includes('mesaj') || q.includes('hatırlat') || q.includes('yaz')) {
      for (const c of contacts) {
        if (q.includes(c.name.toLowerCase())) {
          const bal = getContactBalance(c.id);
          const phone = (c.phone || '').replace(/\D/g, '');
          const msg = `Sayın ${c.name}, Atölyecim ERP sistemimizdeki güncel bakiye durumunuz ${bal > 0 ? `₺${bal.toLocaleString('tr-TR', {minimumFractionDigits:2})} alacak bakiyesidir` : `₺${Math.abs(bal).toLocaleString('tr-TR', {minimumFractionDigits:2})} borç bakiyesidir`}. Detaylı ekstre ve sipariş durumunuz için bilgi alabilirsiniz. İyi çalışmalar dileriz.`;
          const waUrl = phone ? `https://wa.me/90${phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;

          return `
            <strong>💬 ${escapeHtml(c.name)} İçin Hazırlanan WhatsApp Mesajı:</strong><br><br>
            <div style="background:#f1f5f9; border-left:3px solid #25d366; padding:10px; border-radius:4px; font-size:0.85rem; margin-bottom:8px;">
              "${escapeHtml(msg)}"
            </div>
            <div class="ai-action-btn-row">
              <a href="${waUrl}" target="_blank" class="ai-action-btn wa" style="text-decoration:none;">📲 WhatsApp'tan Gönder</a>
            </div>
          `;
        }
      }
    }

    // 3. GÜNLÜK BRİFİNG & ATÖLYE GENEL ÖZETİ
    if (q.includes('brifing') || q.includes('özet') || q.includes('durum') || q.includes('bugün') || q.includes('rapor') || q.includes('genel')) {
      const activeOrders = orders.filter(o => o.status === 'beklemede');
      const incomingOrders = orders.filter(o => o.status === 'gelen');
      const totalPairsInProd = activeOrders.reduce((sum, o) => sum + (o.qty || o.totalPair || 0), 0);
      
      let totalReceivable = 0;
      let totalPayable = 0;
      contacts.forEach(c => {
        const bal = getContactBalance(c.id);
        if (bal > 0) totalReceivable += bal;
        else if (bal < 0) totalPayable += Math.abs(bal);
      });

      const criticalStocks = stocks.filter(s => Number(s.qty || 0) <= Number(s.limit || 0));
      const activeTickets = jobTickets.filter(t => t.stage !== 'tamamlandi');

      return `
        <strong>📊 Günlük Atölye Yönetici Brifingi:</strong><br><br>
        • 📋 <strong>Aktif İmalat:</strong> ${activeOrders.length} Sipariş (${totalPairsInProd} Çift)<br>
        • 📥 <strong>Onay Bekleyen Gelenler:</strong> ${incomingOrders.length} Sipariş<br>
        • ✂️ <strong>Atölyedeki İş Fişleri:</strong> ${activeTickets.length} Fiş Aşamada<br>
        • ⚠️ <strong>Kritik Seviyedeki Malzemeler:</strong> <span style="color:${criticalStocks.length > 0 ? '#ef4444' : '#10b981'}; font-weight:700;">${criticalStocks.length} Kalem</span><br>
        • 💰 <strong>Toplam Alacağımız:</strong> <strong style="color:#059669;">₺${totalReceivable.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong><br>
        • 💳 <strong>Toplam Borcumuz:</strong> <strong style="color:#ef4444;">₺${totalPayable.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong><br><br>
        <div class="ai-action-btn-row">
          <button class="ai-action-btn" onclick="AiAssistant.ask('Kritik ve biten malzemeleri listele')">⚠️ Kritik Stokları Gör</button>
          <button class="ai-action-btn" onclick="AiAssistant.ask('Termini yaklaşan ve geciken siparişler hangileri?')">⏳ Terminleri İncele</button>
        </div>
      `;
    }

    // 4. TERMİN VE GECİKEN SİPARİŞLER ANALİZİ
    if (q.includes('termin') || q.includes('gecik') || q.includes('teslimat') || q.includes('acil')) {
      const activeOrders = orders.filter(o => o.status === 'beklemede' && o.deadline);
      const today = new Date().toISOString().split('T')[0];

      const delayed = [];
      const upcoming = [];

      activeOrders.forEach(o => {
        const diffDays = Math.round((new Date(o.deadline) - new Date(today)) / (1000 * 60 * 60 * 24));
        const client = contacts.find(c => c.id === o.contactId);
        const itemInfo = {
          id: o.id,
          modelCode: o.modelCode,
          qty: o.qty || o.totalPair || 0,
          customerName: client ? client.name : 'Müşteri',
          deadline: o.deadline,
          diffDays
        };

        if (diffDays < 0) delayed.push(itemInfo);
        else if (diffDays <= 7) upcoming.push(itemInfo);
      });

      let html = '<strong>⏳ Sipariş Termin & Aciliyet Analizi:</strong><br><br>';

      if (delayed.length > 0) {
        html += `<strong style="color:#ef4444;">🚨 GECİKEN SİPARİŞLER (${delayed.length} Adet):</strong><br>`;
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin:6px 0 12px 0;">';
        delayed.forEach(d => {
          html += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;"><strong>${escapeHtml(d.modelCode)}</strong> (${escapeHtml(d.customerName)})</td><td style="text-align:right; color:#ef4444; font-weight:700;">${Math.abs(d.diffDays)} gün gecikti (${d.qty} çift)</td></tr>`;
        });
        html += '</table>';
      } else {
        html += '✅ Gecikmiş sipariş bulunmuyor, tüm üretim zamanında ilerliyor!<br><br>';
      }

      if (upcoming.length > 0) {
        html += `<strong style="color:#f59e0b;">⚠️ BU HAFTA TESLİM EDİLECEKLER (${upcoming.length} Adet):</strong><br>`;
        html += '<table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:6px;">';
        upcoming.forEach(u => {
          html += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;"><strong>${escapeHtml(u.modelCode)}</strong> (${escapeHtml(u.customerName)})</td><td style="text-align:right; font-weight:700; color:#3b82f6;">${u.diffDays === 0 ? 'Bugün!' : `${u.diffDays} gün kaldı`} (${u.qty} çift)</td></tr>`;
        });
        html += '</table>';
      }

      return html;
    }

    // 5. KRİTİK VE TÜKENEN STOKLAR
    if (q.includes('kritik') || q.includes('limit') || q.includes('biten') || q.includes('azalan') || q.includes('eksik')) {
      const critical = stocks.filter(s => Number(s.qty || 0) <= Number(s.limit || 0));
      if (critical.length === 0) {
        return 'Sistemde kritik limitin altında herhangi bir stok kalemi bulunmuyor. Malzeme durumunuz eksiksiz patron! 👍';
      }

      let html = `<strong>⚠️ Kritik & Biten Malzeme Raporu (${critical.length} Kalem):</strong><br><br>`;
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.82rem;">';
      html += '<tr style="border-bottom:1px solid #cbd5e1; color:#64748b; text-align:left;"><th style="padding:4px 0;">Malzeme Adı</th><th style="text-align:right;">Kalan</th><th style="text-align:right;">Limit</th></tr>';
      
      critical.forEach(s => {
        const isOut = Number(s.qty || 0) <= 0;
        const color = isOut ? '#ef4444' : '#f59e0b';
        const detail = s.size ? ` (${s.size})` : '';
        html += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">${escapeHtml(s.name)}${escapeHtml(detail)}</td><td style="text-align:right; font-weight:800; color:${color};">${s.qty} ${s.unit || 'Çift'}</td><td style="text-align:right; color:#94a3b8;">${s.limit}</td></tr>`;
      });
      html += '</table>';

      return html;
    }

    // 6. İMALAT VE FASON AŞAMALARI
    if (q.includes('kesim') || q.includes('saya') || q.includes('montaj') || q.includes('paket') || q.includes('imalat') || q.includes('fason')) {
      const activeTickets = jobTickets.filter(t => t.stage !== 'tamamlandi');
      const stageCounts = { kesim: 0, saya: 0, montaj: 0, paketleme: 0 };
      const stagePairs = { kesim: 0, saya: 0, montaj: 0, paketleme: 0 };

      activeTickets.forEach(t => {
        const st = t.stage || 'kesim';
        if (stageCounts[st] !== undefined) {
          stageCounts[st]++;
          stagePairs[st] += (t.totalPair || t.qty || 0);
        }
      });

      return `
        <strong>🧵 İmalat ve Atölye Aşamaları Durumu:</strong><br><br>
        • ✂️ <strong>Kesim Aşamasında:</strong> ${stageCounts.kesim} Fiş (${stagePairs.kesim} Çift)<br>
        • 🪡 <strong>Saya Dikişte:</strong> ${stageCounts.saya} Fiş (${stagePairs.saya} Çift)<br>
        • 🔨 <strong>Taban Montajda:</strong> ${stageCounts.montaj} Fiş (${stagePairs.montaj} Çift)<br>
        • 📦 <strong>Kutu / Paketlemede:</strong> ${stageCounts.paketleme} Fiş (${stagePairs.paketleme} Çift)<br><br>
        Toplam aktif fiş sayısı: <strong>${activeTickets.length} adet</strong>
        <div class="ai-action-btn-row">
          <button class="ai-action-btn" onclick="window.AiAssistant.navigateToPage('job-tickets')">📋 İş Fişlerini Aç</button>
          <button class="ai-action-btn" onclick="window.AiAssistant.navigateToPage('contractors')">🧵 Fason Takibini Aç</button>
        </div>
      `;
    }

    // 7. SPECIFIC CONTACT SEARCH (CARİ SORGULAMA)
    let matchedContact = null;
    for (const c of contacts) {
      if (q.includes(c.name.toLowerCase())) {
        matchedContact = c;
        break;
      }
    }
    if (matchedContact) {
      const bal = getContactBalance(matchedContact.id);
      const phone = (matchedContact.phone || '').replace(/\D/g, '');
      const balColor = bal > 0 ? '#059669' : bal < 0 ? '#ef4444' : '#64748b';
      const balText = bal > 0 ? `₺${bal.toLocaleString('tr-TR', {minimumFractionDigits:2})} Alacaklıyız` : bal < 0 ? `₺${Math.abs(bal).toLocaleString('tr-TR', {minimumFractionDigits:2})} Borçluyuz` : 'Bakiye Dengede (₺0,00)';

      const clientOrders = orders.filter(o => o.contactId === matchedContact.id);

      return `
        <strong>👤 Cari Hesap Özeti: ${escapeHtml(matchedContact.name)}</strong><br><br>
        • 📞 <strong>Telefon:</strong> ${escapeHtml(matchedContact.phone || '-')}<br>
        • ⚖️ <strong>Güncel Bakiye:</strong> <strong style="color:${balColor}; font-size:1rem;">${balText}</strong><br>
        • 📋 <strong>Kayıtlı Siparişler:</strong> ${clientOrders.length} Sipariş<br><br>
        <div class="ai-action-btn-row">
          <button class="ai-action-btn" onclick="Contacts.openLedgerModal(${matchedContact.id})">📜 Ekstre İncele</button>
          ${phone ? `<a href="https://wa.me/90${phone.replace(/^0/, '')}" target="_blank" class="ai-action-btn wa" style="text-decoration:none;">📲 WhatsApp</a>` : ''}
        </div>
      `;
    }

    // 8. SPECIFIC STOCK SEARCH
    let matchedStock = null;
    for (const s of stocks) {
      if (q.includes((s.name || '').toLowerCase())) {
        matchedStock = s;
        break;
      }
    }
    if (matchedStock) {
      const sameItems = stocks.filter(s => s.name.toLowerCase() === matchedStock.name.toLowerCase());
      const totalQ = sameItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);

      let html = `<strong>📦 Stok Bilgisi: "${escapeHtml(matchedStock.name)}"</strong><br><br>`;
      html += `• Toplam Mevcut: <strong style="color:#0f172a; font-size:1rem;">${totalQ} ${matchedStock.unit || 'Çift'}</strong><br>`;
      html += `• Kritik Limit: ${matchedStock.limit || 0}<br><br>`;
      html += '<strong>Beden / Renk Detayları:</strong><br>';
      html += '<table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:4px;">';
      sameItems.forEach(it => {
        html += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">Beden: ${escapeHtml(it.size || '-')} | Renk: ${escapeHtml(it.color || '-')}</td><td style="text-align:right; font-weight:700;">${it.qty} ${it.unit}</td></tr>`;
      });
      html += '</table>';
      return html;
    }

    // 9. CARİLER LİSTESİ VEYA BAKİYE ÖZETİ
    if (q.includes('cari') || q.includes('müşteri') || q.includes('alacak') || q.includes('borç')) {
      let totalReceivable = 0;
      let totalPayable = 0;
      contacts.forEach(c => {
        const bal = getContactBalance(c.id);
        if (bal > 0) totalReceivable += bal;
        else if (bal < 0) totalPayable += Math.abs(bal);
      });

      return `
        <strong>💰 Cari Hesaplar Genel Dengesi:</strong><br><br>
        • 🟢 <strong>Toplam Alacak:</strong> <strong style="color:#059669;">₺${totalReceivable.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong><br>
        • 🔴 <strong>Toplam Borç:</strong> <strong style="color:#ef4444;">₺${totalPayable.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong><br>
        • ⚖️ <strong>Net Durum:</strong> <strong>₺${(totalReceivable - totalPayable).toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong><br><br>
        Detaylı liste veya belirli bir cari için <em>"[Müşteri Adı] bakiye"</em> yazabilirsiniz.
        <div class="ai-action-btn-row">
          <button class="ai-action-btn" onclick="window.AiAssistant.navigateToPage('contacts')">👥 Cari Hesapları Aç</button>
        </div>
      `;
    }

    // Default fallback intelligence
    return `
      <strong>🤖 Atölyecim AI Copilot:</strong><br><br>
      Sorunuzu doğrudan veritabanındaki kayıtlarla analiz ettim. Size yardımcı olabileceğim bazı konular:<br><br>
      • 📊 <em>"günlük brifing"</em> -> Tüm atölye özetini döker.<br>
      • ⚠️ <em>"kritik stoklar"</em> -> Biten ve azalan malzemeleri listeler.<br>
      • ⏳ <em>"geciken siparişler"</em> -> Acil teslimatları listeler.<br>
      • 💰 <em>"alacak borç dengesi"</em> -> Finansal durumu özetler.<br>
      • 🔍 Model, cari veya malzeme ismi yazarak doğrudan detay alabilirsiniz.
    `;
  },

  escape(str) {
    return escapeHtml(str);
  }
};

window.AiAssistant = AiAssistant;
window.openAiAssistant = () => AiAssistant.toggleDrawer(true);
window.closeAiAssistant = () => AiAssistant.toggleDrawer(false);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AiAssistant.init());
} else {
  AiAssistant.init();
}

export default AiAssistant;
