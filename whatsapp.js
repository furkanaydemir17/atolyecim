/**
 * ATÖLYECİM ERP - Evrensel WhatsApp İletişim & Şablon Motoru
 * İş Takip Fişleri, Siparişler, Fasoncular ve Cari Hesaplar için Ortak WhatsApp Merkezi
 */
import { escapeHtml } from './utils.js';

export const WhatsAppManager = {
  currentData: null,
  currentType: null,
  currentPhone: '',
  currentName: '',
  templates: {},

  init() {
    const modal = document.getElementById('whatsapp-modal');
    if (!modal) return;

    // Send Button
    const btnSend = document.getElementById('btn-wa-send-now');
    if (btnSend && !btnSend._bound) {
      btnSend._bound = true;
      btnSend.addEventListener('click', () => this.sendMessage());
    }

    // Copy Button
    const btnCopy = document.getElementById('btn-wa-copy-text');
    if (btnCopy && !btnCopy._bound) {
      btnCopy._bound = true;
      btnCopy.addEventListener('click', () => this.copyMessage());
    }

    // Template selection buttons container
    const templateTabs = document.getElementById('wa-template-tabs');
    if (templateTabs && !templateTabs._bound) {
      templateTabs._bound = true;
      templateTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.wa-tab-btn');
        if (btn && btn.dataset.template) {
          templateTabs.querySelectorAll('.wa-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.applyTemplate(btn.dataset.template);
        }
      });
    }

    // Auto-update message when dynamic inputs change
    const phoneInput = document.getElementById('wa-recipient-phone');
    if (phoneInput && !phoneInput._bound) {
      phoneInput._bound = true;
      phoneInput.addEventListener('input', (e) => {
        this.currentPhone = e.target.value;
      });
    }
  },

  /**
   * Telefon numarasını WhatsApp standardına (905xxxxxxxxx) dönüştürür
   */
  formatPhone(raw) {
    if (!raw) return '';
    let digits = String(raw).replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.substring(1);
    
    // Türkiye numaraları için düzeltmeler
    if (digits.startsWith('05')) {
      digits = '90' + digits.substring(1);
    } else if (digits.startsWith('5') && digits.length === 10) {
      digits = '90' + digits;
    }
    return digits;
  },

  getCompanyName() {
    return localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Ayakkabı İmalat';
  },

  /**
   * ==========================================
   * 1. İŞ TAKİP FİŞİ (JOB TICKET) WHATSAPP
   * ==========================================
   */
  async openForJobTicket(ticketId) {
    let ticket = null;
    if (window.JobTickets && window.JobTickets.activeTickets) {
      ticket = window.JobTickets.activeTickets.find(t => String(t.id) === String(ticketId));
    }
    if (!ticket && window.dbGet) {
      ticket = await window.dbGet('job_tickets', ticketId);
    }
    if (!ticket) {
      if (window.showToast) window.showToast('İş fişi bulunamadı!', 'error');
      return;
    }

    // Cari telefonunu bulmaya çalış
    let phone = '';
    if (ticket.customer && window.dbGetAll) {
      try {
        const contacts = await window.dbGetAll('contacts');
        const c = contacts.find(item => item.name && item.name.toLowerCase() === ticket.customer.toLowerCase());
        if (c && c.phone) phone = c.phone;
      } catch (e) {
        console.warn('Contact phone lookup:', e);
      }
    }

    const stageNames = {
      kesim: '✂️ KESİM AŞAMASINDA',
      saya: '🧵 SAYA DİKİMİNDE',
      montaj: '🔨 MONTAJ / KALFA AŞAMASINDA',
      paketleme: '📦 PAKETLEMEDE',
      tamamlandi: '✅ İMALAT TAMAMLANDI / HAZIR'
    };

    const stageTitle = stageNames[ticket.stage] || '🔄 İMALATTA';
    const compName = this.getCompanyName();
    const dateStr = ticket.deliveryDate ? ticket.deliveryDate.split('-').reverse().join('.') : 'Belirtilmedi';
    
    // Numara detay özeti
    let sizeDetails = '';
    if (ticket.sizes && typeof ticket.sizes === 'object') {
      const parts = [];
      for (const [sz, qty] of Object.entries(ticket.sizes)) {
        if (Number(qty) > 0) parts.push(`${sz}:${qty}`);
      }
      if (parts.length > 0) sizeDetails = `\n📊 *Numara Dağılımı:* ${parts.join(', ')}`;
    }

    const templates = {
      jt_stage: `👟 *${compName.toUpperCase()} — İMALAT BİLDİRİMİ*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *İş Takip Fişi:* ${ticket.serialNo || '№ 00000'}\n` +
        `👤 *Müşteri:* ${ticket.customer || '-'}\n` +
        `👞 *Model Kodu:* ${ticket.modelCode || '-'}\n` +
        `🎨 *Deri / Renk:* ${ticket.leather || '-'}\n` +
        `📦 *Toplam Miktar:* ${ticket.totalPairs || 0} Çift${sizeDetails}\n\n` +
        `📍 *Mevcut Durum:* ${stageTitle}\n` +
        `📅 *Planlanan Teslim:* ${dateStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `ℹ️ _Siparişiniz atölyemizde özenle hazırlanmaktadır. Bilgilerinize sunarız._`,

      jt_ready: `🎉 *${compName.toUpperCase()} — SİPARİŞİNİZ HAZIR!*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *İş Fişi No:* ${ticket.serialNo || '№ 00000'}\n` +
        `👤 *Sayın:* ${ticket.customer || '-'}\n` +
        `👞 *Model:* ${ticket.modelCode || '-'} (${ticket.leather || '-'})\n` +
        `📦 *Miktar:* ${ticket.totalPairs || 0} Çift\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ *İmalat ve kalite kontrol işlemleri tamamlanmış olup ürünleriniz sevkiyata hazırdır.*\n\n` +
        `🚚 Teslimat / kargo detayları için lütfen bizimle iletişime geçiniz.`
    };

    this.openModal({
      title: '📋 İş Takip Fişi WhatsApp Bildirimi',
      phone: phone,
      recipientName: ticket.customer || 'Müşteri',
      defaultTemplateKey: ticket.stage === 'tamamlandi' ? 'jt_ready' : 'jt_stage',
      templates: [
        { key: 'jt_stage', label: '✂️ Aşama Durumu' },
        { key: 'jt_ready', label: '✅ Sipariş Hazır / Bitti' }
      ],
      templateTexts: templates,
      data: ticket
    });
  },

  /**
   * ==========================================
   * 2. SİPARİŞ (ORDER) WHATSAPP
   * ==========================================
   */
  async openForOrder(orderId) {
    let order = null;
    if (window.Orders && window.Orders.activeOrders) {
      order = window.Orders.activeOrders.find(o => String(o.id) === String(orderId));
    }
    if (!order && window.dbGet) {
      order = await window.dbGet('orders', orderId);
    }
    if (!order) {
      if (window.showToast) window.showToast('Sipariş bulunamadı!', 'error');
      return;
    }

    let phone = order.customerPhone || '';
    if (!phone && order.contactId && window.dbGet) {
      try {
        const c = await window.dbGet('contacts', order.contactId);
        if (c && c.phone) phone = c.phone;
      } catch (e) {
        console.warn('Contact phone:', e);
      }
    }

    const compName = this.getCompanyName();
    const totalAmount = order.totalAmount || (order.qty * order.price) || 0;
    const currency = order.currency || '₺';

    let colorSummary = '';
    if (order.colors && order.colors.length > 0) {
      colorSummary = '\n' + order.colors.map(c => `  ▫️ ${c.color}: ${c.qty} Çift`).join('\n');
    }

    const templates = {
      order_received: `🛍️ *${compName.toUpperCase()} — SİPARİŞ ONAYI*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Sipariş No:* #${order.id}\n` +
        `👤 *Sayın:* ${order.customerName || order.customer || '-'}\n` +
        `👞 *Model:* ${order.modelCode || order.productName || '-'}\n` +
        `📦 *Toplam Çift:* ${order.qty || order.totalQty || 0} Çift${colorSummary}\n` +
        `💰 *Tutar:* ${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ _Siparişiniz sistemimize kaydedilmiş ve imalat sırasına alınmıştır. Bizi tercih ettiğiniz için teşekkür ederiz._`,

      order_shipping: `🚚 *${compName.toUpperCase()} — KARGO / SEVKİYAT BİLDİRİMİ*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Sipariş No:* #${order.id}\n` +
        `👤 *Alıcı:* ${order.customerName || order.customer || '-'}\n` +
        `👞 *Model:* ${order.modelCode || '-'}\n` +
        `📦 *Miktar:* ${order.qty || 0} Çift\n` +
        `🚚 *Kargo Firması:* ${order.shippingCompany || 'Yurtiçi Kargo / Ambar'}\n` +
        `🔖 *Takip No:* ${order.trackingNumber || '-'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 _Siparişiniz kargoya verilmiştir. En kısa sürede tarafınıza ulaşacaktır._`
    };

    this.openModal({
      title: '🛍️ Sipariş WhatsApp Bildirimi',
      phone: phone,
      recipientName: order.customerName || order.customer || 'Müşteri',
      defaultTemplateKey: order.status === 'kargoda' ? 'order_shipping' : 'order_received',
      templates: [
        { key: 'order_received', label: '📋 Sipariş Onayı' },
        { key: 'order_shipping', label: '🚚 Kargo / Sevkiyat' }
      ],
      templateTexts: templates,
      data: order
    });
  },

  /**
   * ==========================================
   * 3. FASON İŞ & ÖDEME (CONTRACTORS) WHATSAPP
   * ==========================================
   */
  async openForContractorJob(jobId) {
    let job = null;
    if (window.dbGet) {
      job = await window.dbGet('contractor_jobs', jobId);
    }
    if (!job) {
      if (window.showToast) window.showToast('Fason iş kaydı bulunamadı!', 'error');
      return;
    }

    let phone = '';
    let contractorName = 'Usta';
    if (job.contractorId && window.dbGet) {
      try {
        const cont = await window.dbGet('contractors', job.contractorId);
        if (cont) {
          contractorName = cont.name;
          phone = cont.phone || '';
        }
      } catch (e) {}
    }

    const compName = this.getCompanyName();
    const dateStr = job.date ? job.date.split('T')[0].split('-').reverse().join('.') : '';
    const totalEarnings = (job.qty * job.unitPrice) || 0;

    const msg = `🧵 *${compName.toUpperCase()} — FASON İŞ TESLİMATI*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Usta / Fasoncu:* ${contractorName}\n` +
      `👞 *Model Kodu:* ${job.modelCode || '-'}\n` +
      `⚙️ *İşlem / Aşama:* ${job.stage || 'Saya Dikişi'}\n` +
      `📦 *Teslim Edilen:* ${job.qty || 0} Çift\n` +
      `💰 *Birim Fiyat:* ${(job.unitPrice || 0).toFixed(2)} ₺ (Toplam: ${totalEarnings.toFixed(2)} ₺)\n` +
      `📅 *Teslim Tarihi:* ${dateStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Açıklama / Not:* ${job.description || 'İş teslim edilmiştir.'}\n\n` +
      `_Kolay gelsin, hayırlı işler._`;

    this.openModal({
      title: '🧵 Fason İş Teslim WhatsApp Bildirimi',
      phone: phone,
      recipientName: contractorName,
      defaultTemplateKey: 'job_delivery',
      templates: [
        { key: 'job_delivery', label: '📦 İş Teslimatı' }
      ],
      templateTexts: { job_delivery: msg },
      data: job
    });
  },

  async openForContractorPayment(paymentId) {
    let p = null;
    if (window.dbGet) {
      p = await window.dbGet('contractor_transactions', paymentId);
    }
    if (!p) {
      if (window.showToast) window.showToast('Ödeme kaydı bulunamadı!', 'error');
      return;
    }

    let phone = '';
    let contractorName = 'Usta';
    let balance = 0;
    if (p.contractorId && window.dbGet) {
      try {
        const cont = await window.dbGet('contractors', p.contractorId);
        if (cont) {
          contractorName = cont.name;
          phone = cont.phone || '';
        }
        if (window.Contractors && window.Contractors.calculateBalance) {
          balance = await window.Contractors.calculateBalance(p.contractorId);
        }
      } catch (e) {}
    }

    const compName = this.getCompanyName();
    const dateStr = p.date ? p.date.split('T')[0].split('-').reverse().join('.') : '';

    const msg = `💰 *${compName.toUpperCase()} — HAKEDİŞ / ÖDEME BİLDİRİMİ*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Sayın:* ${contractorName}\n` +
      `💵 *Ödenen Tutar:* ${(p.amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺\n` +
      `📌 *İşlem Türü:* ${p.type === 'avans' ? 'Avans Ödemesi' : 'Hakediş Ödemesi'}\n` +
      `📅 *Tarih:* ${dateStr}\n` +
      `📊 *Kalan Hakediş Bakiyesi:* ${balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Not:* ${p.description || 'Hesabınıza aktarılmıştır.'}\n\n` +
      `_Hayırlı ve bereketli olsun._`;

    this.openModal({
      title: '💰 Fasoncu Ödeme WhatsApp Bildirimi',
      phone: phone,
      recipientName: contractorName,
      defaultTemplateKey: 'payment_sent',
      templates: [
        { key: 'payment_sent', label: '💵 Ödeme / Avans' }
      ],
      templateTexts: { payment_sent: msg },
      data: p
    });
  },

  /**
   * ==========================================
   * 4. CARİ HESAP EKSTRE & BAKİYE WHATSAPP
   * ==========================================
   */
  async openForContact(contactId, customText = '') {
    let contact = null;
    if (window.dbGet) {
      contact = await window.dbGet('contacts', contactId);
    }
    if (!contact) {
      if (window.showToast) window.showToast('Cari hesap bulunamadı!', 'error');
      return;
    }

    const compName = this.getCompanyName();
    let balanceText = '';
    if (window.Contacts && window.Contacts.getContactBalance) {
      const bal = await window.Contacts.getContactBalance(contact.id);
      if (bal > 0) balanceText = `\n📊 *Güncel Bakiye:* ${bal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ (Borçlu)`;
      else if (bal < 0) balanceText = `\n📊 *Güncel Bakiye:* ${Math.abs(bal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ (Alacaklı)`;
      else balanceText = `\n📊 *Güncel Bakiye:* 0.00 ₺ (Hesap Denk)`;
    }

    const defaultMsg = customText || (
      `📑 *${compName.toUpperCase()} — HESAP MUTABAKAT BİLDİRİMİ*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Sayın:* ${contact.name}\n` +
      `🏢 *Firma / Cari:* ${contact.company || contact.name}${balanceText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `ℹ️ _Cari hesap mutabakatı ve güncel hesap hareketleri ekstre detayı yukarıdaki gibidir._\n\n` +
      `Sorularınız ve ödeme detayları için lütfen bizimle iletişime geçiniz.`
    );

    this.openModal({
      title: '📑 Cari Hesap WhatsApp Bildirimi',
      phone: contact.phone || '',
      recipientName: contact.name,
      defaultTemplateKey: 'statement',
      templates: [
        { key: 'statement', label: '📊 Hesap Ekstresi / Bakiye' }
      ],
      templateTexts: { statement: defaultMsg },
      data: contact
    });
  },

  /**
   * ==========================================
   * MODAL ARAYÜZ YÖNETİMİ & TETİKLEYİCİLER
   * ==========================================
   */
  openModal({ title, phone, recipientName, defaultTemplateKey, templates, templateTexts, data }) {
    this.currentData = data;
    this.currentPhone = phone || '';
    this.currentName = recipientName || '';
    this.templates = templateTexts || {};

    const modal = document.getElementById('whatsapp-modal');
    const titleEl = document.getElementById('wa-modal-title');
    const nameEl = document.getElementById('wa-recipient-name');
    const phoneInput = document.getElementById('wa-recipient-phone');
    const tabsContainer = document.getElementById('wa-template-tabs');
    const messageArea = document.getElementById('wa-message-content');

    if (!modal) return;

    if (titleEl) titleEl.textContent = title || '📲 WhatsApp Bildirim Merkezi';
    if (nameEl) nameEl.textContent = recipientName || 'Alıcı';
    if (phoneInput) phoneInput.value = phone || '';

    // Render template tab buttons
    if (tabsContainer && templates && templates.length > 0) {
      tabsContainer.innerHTML = templates.map((t, idx) => {
        const isAct = t.key === defaultTemplateKey || (idx === 0 && !defaultTemplateKey);
        return `<button type="button" class="wa-tab-btn ${isAct ? 'active' : ''}" data-template="${t.key}">${t.label}</button>`;
      }).join('');
    } else if (tabsContainer) {
      tabsContainer.innerHTML = '';
    }

    // Apply default template text
    const activeKey = defaultTemplateKey || (templates && templates[0] ? templates[0].key : Object.keys(templateTexts)[0]);
    if (messageArea && this.templates[activeKey]) {
      messageArea.value = this.templates[activeKey];
    } else if (messageArea) {
      messageArea.value = '';
    }

    if (window.openModalById) {
      window.openModalById('whatsapp-modal');
    }
  },

  applyTemplate(templateKey) {
    const messageArea = document.getElementById('wa-message-content');
    if (messageArea && this.templates[templateKey]) {
      messageArea.value = this.templates[templateKey];
    }
  },

  sendMessage() {
    const phoneInput = document.getElementById('wa-recipient-phone');
    const messageArea = document.getElementById('wa-message-content');
    
    let rawPhone = phoneInput ? phoneInput.value.trim() : this.currentPhone;
    const message = messageArea ? messageArea.value.trim() : '';

    if (!message) {
      if (window.showToast) window.showToast('Lütfen gönderilecek mesajı boş bırakmayın!', 'error');
      return;
    }

    const formattedPhone = this.formatPhone(rawPhone);
    const encodedText = encodeURIComponent(message);

    let waUrl = '';
    if (formattedPhone) {
      // Direct message link with phone number
      waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
    } else {
      // General share link if no phone specified
      waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    window.open(waUrl, '_blank');
    if (window.showToast) window.showToast('WhatsApp açılıyor... 🚀', 'success');
    if (window.closeModalById) window.closeModalById('whatsapp-modal');
  },

  copyMessage() {
    const messageArea = document.getElementById('wa-message-content');
    if (!messageArea || !messageArea.value) return;

    navigator.clipboard.writeText(messageArea.value).then(() => {
      if (window.showToast) window.showToast('Mesaj metni panoya kopyalandı! 📋', 'success');
    }).catch(() => {
      if (window.showToast) window.showToast('Kopyalama başarısız!', 'error');
    });
  }
};

window.WhatsAppManager = WhatsAppManager;
