
// Doğrudan Destek Sayfasına Gitme (Aşağı kaydırma yapmadan anında tepeye açılır)
function navigateToSupportPage(tab = 'new') {
  // Modal varsa kapat
  const modal = document.getElementById('support-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }

  // Sayfaları değiştir
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));

  const supportPage = document.getElementById('page-support');
  if (supportPage) {
    supportPage.classList.add('active');
  }

  // Sol menüyü aktif yap
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(n => n.classList.remove('active'));
  const navSupport = document.getElementById('nav-item-support');
  if (navSupport) {
    navSupport.classList.add('active');
  }

  // Tepeye sıfırla (aşağı iniş yok!)
  window.scrollTo(0, 0);
  const content = document.getElementById('content');
  if (content) content.scrollTo(0, 0);

  // İlgili sekmeye geç
  switchPageSupportTab(tab);

  // Mobil menüyü kapat
  if (window._closeMobileSidebar) window._closeMobileSidebar();
}

window.navigateToSupportPage = navigateToSupportPage;
window.openSupportModal = navigateToSupportPage;

/**
 * support.js - Atölyecim Destek, Hata ve Görüş Bildirimi Sistemi
 * Müşteri atölyelerin bildirimlerini global ayarlarda toplar, Süper Admin paneline iletir.
 * Hem tam sayfa (#page-support) hem de açılır modal (#support-modal) desteğine sahiptir.
 */

// Helper: Escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global biletleri veritabanından çek (settings tablosunda global_support_tickets)
async function fetchSupportTickets() {
  try {
    if (window.dbGet) {
      const res = await window.dbGet('settings', 'global_support_tickets');
      if (res && res.value && Array.isArray(res.value.tickets)) {
        return res.value.tickets;
      }
    }
  } catch (e) {
    console.warn('[Support] fetchSupportTickets warning:', e);
  }
  // Fallback: localStorage
  try {
    const local = localStorage.getItem('atolyecim_support_tickets');
    if (local) return JSON.parse(local);
  } catch (_) {}
  return [];
}

// Biletleri veritabanına kaydet
async function saveSupportTickets(tickets) {
  try {
    localStorage.setItem('atolyecim_support_tickets', JSON.stringify(tickets));
    if (window.dbUpdate) {
      await window.dbUpdate('settings', {
        key: 'global_support_tickets',
        value: {
          tickets: tickets,
          lastUpdated: new Date().toISOString()
        }
      });
    }
  } catch (e) {
    console.error('[Support] saveSupportTickets error:', e);
    throw e;
  }
}

// Kategori rozeti
function getCategoryBadge(category) {
  switch (category) {
    case 'bug':
      return '<span class="category-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-weight: 700;">🐞 Hata Bildirimi</span>';
    case 'suggestion':
      return '<span class="category-badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; font-weight: 700;">💡 Görüş & Öneri</span>';
    case 'question':
      return '<span class="category-badge" style="background: rgba(59, 130, 246, 0.15); color: #2563eb; font-weight: 700;">❓ Soru & Yardım</span>';
    default:
      return '<span class="category-badge" style="background: rgba(100, 116, 139, 0.15); color: #475569; font-weight: 700;">📝 Diğer</span>';
  }
}

// Durum rozeti
function getStatusBadge(status) {
  switch (status) {
    case 'resolved':
      return '<span class="category-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">✅ Çözüldü</span>';
    case 'closed':
      return '<span class="category-badge" style="background: rgba(100, 116, 139, 0.15); color: #64748b; font-weight: 700;">🔒 Kapatıldı</span>';
    case 'open':
    default:
      return '<span class="category-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-weight: 700;">⏳ Açık / Bekliyor</span>';
  }
}

// Destek Modalı Açma
function openSupportModal(tab = 'new') {
  const modal = document.getElementById('support-modal');
  if (!modal) return;

  const currentCompany = localStorage.getItem('atolyecim_auth_company') || 'Atölyem';
  const currentUser = localStorage.getItem('atolyecim_auth_username') || '';
  const senderEl = document.getElementById('ticket-sender-info');
  if (senderEl) {
    senderEl.textContent = `${currentCompany} (${currentUser})`;
  }

  modal.style.display = 'flex';
  switchSupportTab(tab);
}

// Destek Modalı Kapatma
function closeSupportModal() {
  const modal = document.getElementById('support-modal');
  if (modal) modal.style.display = 'none';
}

// Modal Sekme Değiştirme
function switchSupportTab(tab) {
  const tabNewBtn = document.getElementById('tab-btn-new-ticket');
  const tabListBtn = document.getElementById('tab-btn-my-tickets');
  const viewNew = document.getElementById('support-tab-new');
  const viewList = document.getElementById('support-tab-list');

  if (tab === 'new') {
    if (tabNewBtn) {
      tabNewBtn.classList.add('active');
      tabNewBtn.style.color = '#3b82f6';
      tabNewBtn.style.borderBottom = '2px solid #3b82f6';
    }
    if (tabListBtn) {
      tabListBtn.classList.remove('active');
      tabListBtn.style.color = '#64748b';
      tabListBtn.style.borderBottom = '2px solid transparent';
    }
    if (viewNew) viewNew.style.display = 'block';
    if (viewList) viewList.style.display = 'none';
  } else {
    if (tabListBtn) {
      tabListBtn.classList.add('active');
      tabListBtn.style.color = '#3b82f6';
      tabListBtn.style.borderBottom = '2px solid #3b82f6';
    }
    if (tabNewBtn) {
      tabNewBtn.classList.remove('active');
      tabNewBtn.style.color = '#64748b';
      tabNewBtn.style.borderBottom = '2px solid transparent';
    }
    if (viewNew) viewNew.style.display = 'none';
    if (viewList) viewList.style.display = 'block';
    renderMyTickets();
  }
}

// Tam Sayfa (#page-support) Sekme Değiştirme
function switchPageSupportTab(tab) {
  const btnList = document.getElementById('btn-page-tab-list');
  const btnNew = document.getElementById('btn-page-tab-new');
  const viewList = document.getElementById('page-support-view-list');
  const viewNew = document.getElementById('page-support-view-new');

  if (tab === 'new') {
    if (btnNew) {
      btnNew.classList.add('active');
      btnNew.style.color = '#3b82f6';
      btnNew.style.borderBottom = '3px solid #3b82f6';
    }
    if (btnList) {
      btnList.classList.remove('active');
      btnList.style.color = '#64748b';
      btnList.style.borderBottom = '3px solid transparent';
    }
    if (viewNew) viewNew.style.display = 'block';
    if (viewList) viewList.style.display = 'none';

    // Sender bilgisi güncelle
    const senderInfo = document.getElementById('page-ticket-sender-info');
    if (senderInfo) {
      const currentCompany = localStorage.getItem('atolyecim_auth_company') || 'Atölyem';
      const currentUser = localStorage.getItem('atolyecim_auth_username') || '';
      senderInfo.textContent = `${currentCompany} (${currentUser})`;
    }
  } else {
    if (btnList) {
      btnList.classList.add('active');
      btnList.style.color = '#3b82f6';
      btnList.style.borderBottom = '3px solid #3b82f6';
    }
    if (btnNew) {
      btnNew.classList.remove('active');
      btnNew.style.color = '#64748b';
      btnNew.style.borderBottom = '3px solid transparent';
    }
    if (viewList) viewList.style.display = 'block';
    if (viewNew) viewNew.style.display = 'none';
    renderMyTickets();
  }
}

// Kullanıcının kendi taleplerini render et (Hem modal hem tam sayfa için)
async function renderMyTickets() {
  const modalContainer = document.getElementById('my-tickets-container');
  const modalEmpty = document.getElementById('my-tickets-empty');
  const modalCount = document.getElementById('my-tickets-count');

  const pageContainer = document.getElementById('page-my-tickets-container');
  const pageEmpty = document.getElementById('page-my-tickets-empty');
  const pageCount = document.getElementById('page-tab-tickets-count');

  const statTotal = document.getElementById('page-support-stat-total');
  const statOpen = document.getElementById('page-support-stat-open');
  const statResolved = document.getElementById('page-support-stat-resolved');

  const currentCompany = localStorage.getItem('atolyecim_auth_company') || '';
  const tickets = await fetchSupportTickets();
  const myTickets = tickets.filter(t => t.company === currentCompany);

  const openCount = myTickets.filter(t => t.status === 'open').length;
  const resolvedCount = myTickets.filter(t => t.status === 'resolved').length;

  if (modalCount) modalCount.textContent = myTickets.length;
  if (pageCount) pageCount.textContent = myTickets.length;

  if (statTotal) statTotal.textContent = myTickets.length;
  if (statOpen) statOpen.textContent = openCount;
  if (statResolved) statResolved.textContent = resolvedCount;

  const cardsHtml = myTickets.map(t => {
    const hasAdminReply = t.adminNote && t.adminNote.trim().length > 0;
    return `
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); transition: transform 0.15s ease;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${getCategoryBadge(t.category)}
            <span style="font-size: 12px; color: #94a3b8;">📅 ${escapeHtml(t.createdAt || '')}</span>
          </div>
          <div>
            ${getStatusBadge(t.status)}
          </div>
        </div>

        <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #1e293b;">${escapeHtml(t.title)}</h4>
        <p style="margin: 0 0 12px 0; font-size: 13.5px; color: #475569; line-height: 1.5; white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">${escapeHtml(t.message)}</p>

        ${hasAdminReply ? `
          <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 14px; border-radius: 8px; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; font-size: 13px; color: #15803d; display: flex; align-items: center; gap: 6px;">
                <span>👑</span> Yönetici Yanıtı:
              </span>
              ${t.resolvedAt ? `<span style="font-size: 11px; color: #16a34a; font-weight: 600;">${escapeHtml(t.resolvedAt)}</span>` : ''}
            </div>
            <div style="font-size: 13px; color: #166534; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(t.adminNote)}</div>
          </div>
        ` : `
          <div style="background: #f8fafc; padding: 8px 14px; border-radius: 6px; font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 8px;">
            <span>⏳</span> Talebiniz sistem yöneticimiz tarafından sıraya alındı, inceleniyor.
          </div>
        `}
      </div>
    `;
  }).join('');

  // Update modal view
  if (modalContainer) {
    if (myTickets.length === 0) {
      modalContainer.innerHTML = '';
      if (modalEmpty) modalEmpty.style.display = 'block';
    } else {
      if (modalEmpty) modalEmpty.style.display = 'none';
      modalContainer.innerHTML = cardsHtml;
    }
  }

  // Update full page view
  if (pageContainer) {
    if (myTickets.length === 0) {
      pageContainer.innerHTML = '';
      if (pageEmpty) pageEmpty.style.display = 'block';
    } else {
      if (pageEmpty) pageEmpty.style.display = 'none';
      pageContainer.innerHTML = cardsHtml;
    }
  }
}

// Süper Admin Paneli Biletlerini Render Et
let currentAdminFilter = 'all';

async function renderAdminTickets(filter) {
  if (filter) currentAdminFilter = filter;
  const tbody = document.getElementById('admin-tickets-tbody');
  const emptyEl = document.getElementById('admin-tickets-empty');
  if (!tbody) return;

  const tickets = await fetchSupportTickets();
  const totalCount = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'open');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  // Sayaçları ve metrikleri güncelle
  const countAllEl = document.getElementById('count-ticket-all');
  const countOpenEl = document.getElementById('count-ticket-open');
  const countResolvedEl = document.getElementById('count-ticket-resolved');
  const badgeEl = document.getElementById('admin-tickets-count-badge');
  const statCardEl = document.getElementById('admin-stat-tickets');
  const sidebarBadge = document.getElementById('sidebar-admin-tickets-badge');

  // Admin üst uyarı kutusu
  const topAlert = document.getElementById('admin-tickets-top-alert');
  const topAlertCount = document.getElementById('admin-alert-tickets-count');
  if (topAlert) {
    if (openTickets.length > 0) {
      topAlert.style.display = 'flex';
      if (topAlertCount) topAlertCount.textContent = openTickets.length;
    } else {
      topAlert.style.display = 'none';
    }
  }

  if (countAllEl) countAllEl.textContent = totalCount;
  if (countOpenEl) countOpenEl.textContent = openTickets.length;
  if (countResolvedEl) countResolvedEl.textContent = resolvedTickets.length;
  if (badgeEl) badgeEl.textContent = openTickets.length;
  if (statCardEl) statCardEl.textContent = openTickets.length;
  if (sidebarBadge) {
    sidebarBadge.textContent = openTickets.length;
    sidebarBadge.style.display = openTickets.length > 0 ? 'inline-block' : 'none';
  }

  // Filtreleme
  let filtered = tickets;
  if (currentAdminFilter === 'open') {
    filtered = openTickets;
  } else if (currentAdminFilter === 'resolved') {
    filtered = resolvedTickets;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = filtered.map(t => {
    const idEsc = (t.id || '').replace(/'/g, "\\'");
    const isResolved = t.status === 'resolved';
    const hasNote = t.adminNote && t.adminNote.trim().length > 0;

    return `
      <tr style="transition: background 0.15s ease;">
        <td style="padding: 12px 16px; font-size: 12px; color: var(--text-muted); white-space: nowrap;">
          ${escapeHtml(t.createdAt || '')}
        </td>
        <td style="padding: 12px 16px;">
          <div style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            <span>🏭</span> ${escapeHtml(t.company || 'Atölye')}
          </div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace; margin-top: 2px;">
            ${escapeHtml(t.userEmail || '')}
          </div>
        </td>
        <td style="padding: 12px 16px;">
          ${getCategoryBadge(t.category)}
        </td>
        <td style="padding: 12px 16px; max-width: 320px;">
          <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; margin-bottom: 2px;">
            ${escapeHtml(t.title)}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${escapeHtml(t.message)}
          </div>
          ${hasNote ? `
            <div style="font-size: 11px; color: #10b981; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
              <span>💬 Yanıt:</span> <span style="font-style: italic;">${escapeHtml(t.adminNote.substring(0, 50))}${t.adminNote.length > 50 ? '...' : ''}</span>
            </div>
          ` : ''}
        </td>
        <td style="padding: 12px 16px; white-space: nowrap;">
          ${getStatusBadge(t.status)}
        </td>
        <td style="padding: 12px 16px; text-align: right; white-space: nowrap;">
          <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
            <button type="button" class="btn btn-sm btn-primary" onclick="window.openAdminTicketModal('${idEsc}')" style="padding: 5px 10px; font-size: 12px; border-radius: 6px; background: #3b82f6; color: white;" title="İncele ve Yanıtla">
              🔍 İncele / Yanıtla
            </button>
            ${!isResolved ? `
              <button type="button" class="btn btn-sm" onclick="window.quickResolveTicket('${idEsc}')" style="padding: 5px 10px; font-size: 12px; border-radius: 6px; background: #10b981; color: white; font-weight: 600;" title="Hızlı Çözüldü İşaretle">
                ✅ Çöz
              </button>
            ` : ''}
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.deleteSupportTicket('${idEsc}')" style="color: #ef4444; padding: 5px 8px;" title="Sil">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Süper Admin Ticket Detay Modalı Aç
async function openAdminTicketModal(ticketId) {
  const modal = document.getElementById('admin-ticket-modal');
  if (!modal) return;

  const tickets = await fetchSupportTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) {
    if (window.showToast) window.showToast('Bildirim bulunamadı!', 'error');
    return;
  }

  document.getElementById('adm-modal-id').textContent = `ID: ${ticket.id}`;
  document.getElementById('adm-ticket-category-badge').innerHTML = getCategoryBadge(ticket.category);
  document.getElementById('adm-ticket-date').textContent = ticket.createdAt || '';
  document.getElementById('adm-ticket-company').textContent = ticket.company || 'Atölye';
  document.getElementById('adm-ticket-user').textContent = ticket.userEmail || '';
  document.getElementById('adm-ticket-subject').textContent = ticket.title;
  document.getElementById('adm-ticket-body').textContent = ticket.message;

  document.getElementById('adm-reply-ticket-id').value = ticket.id;
  document.getElementById('adm-ticket-status-select').value = ticket.status || 'open';
  document.getElementById('adm-ticket-note-input').value = ticket.adminNote || '';

  modal.style.display = 'flex';
}

function closeAdminTicketModal() {
  const modal = document.getElementById('admin-ticket-modal');
  if (modal) modal.style.display = 'none';
}

// Süper Admin Hızlı Çözüm
async function quickResolveTicket(ticketId) {
  try {
    const tickets = await fetchSupportTickets();
    const index = tickets.findIndex(t => t.id === ticketId);
    if (index === -1) return;

    tickets[index].status = 'resolved';
    tickets[index].resolvedAt = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (!tickets[index].adminNote) {
      tickets[index].adminNote = 'Talebiniz incelenmiş ve çözüme kavuşturulmuştur. Teşekkür ederiz.';
    }

    await saveSupportTickets(tickets);
    if (window.showToast) window.showToast('Talep çözüldü olarak işaretlendi! ✅', 'success');
    renderAdminTickets();
    renderMyTickets();
  } catch (err) {
    console.error('[Support] quickResolve error:', err);
    if (window.showToast) window.showToast('İşlem başarısız!', 'error');
  }
}

// Süper Admin Bilet Silme
async function deleteSupportTicket(ticketId) {
  if (!confirm('Bu bildirim kaydını kalıcı olarak silmek istediğinize emin misiniz?')) return;
  try {
    let tickets = await fetchSupportTickets();
    tickets = tickets.filter(t => t.id !== ticketId);
    await saveSupportTickets(tickets);
    if (window.showToast) window.showToast('Bildirim kaydı silindi! 🗑️', 'info');
    closeAdminTicketModal();
    renderAdminTickets();
    renderMyTickets();
  } catch (err) {
    console.error('[Support] delete error:', err);
    if (window.showToast) window.showToast('Silinemedi!', 'error');
  }
}

// Ortak Talep Gönderme Fonksiyonu
async function handleTicketSubmission(category, title, message) {
  const company = localStorage.getItem('atolyecim_auth_company') || 'Atölyem';
  const userEmail = localStorage.getItem('atolyecim_auth_username') || 'kullanici';

  const newTicket = {
    id: 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    company: company,
    userEmail: userEmail,
    category: category,
    title: title,
    message: message,
    status: 'open',
    adminNote: '',
    createdAt: new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    resolvedAt: null
  };

  const existingTickets = await fetchSupportTickets();
  existingTickets.unshift(newTicket);
  await saveSupportTickets(existingTickets);

  if (window.showToast) {
    window.showToast('✅ Bildiriminiz yöneticimize iletildi. Teşekkür ederiz!', 'success');
  }

  // Hem sayfa hem modal listesini güncelle
  renderMyTickets();
  if (window.renderAdminTickets) window.renderAdminTickets();
}

// Başlatıcı ve Olay Dinleyicileri
function initSupport() {
  // Yüzen buton
  const floatBtn = document.getElementById('floating-support-btn');
  if (floatBtn && !floatBtn._bound) {
    floatBtn._bound = true;
    floatBtn.addEventListener('click', () => openSupportModal('new'));
  }

  // Modalı kapatma butonları
  const closeBtn = document.getElementById('btn-close-support-modal');
  if (closeBtn && !closeBtn._bound) {
    closeBtn._bound = true;
    closeBtn.addEventListener('click', closeSupportModal);
  }

  const cancelBtn = document.getElementById('btn-cancel-ticket');
  if (cancelBtn && !cancelBtn._bound) {
    cancelBtn._bound = true;
    cancelBtn.addEventListener('click', closeSupportModal);
  }

  // Modal Sekmeleri
  const tabNew = document.getElementById('tab-btn-new-ticket');
  if (tabNew && !tabNew._bound) {
    tabNew._bound = true;
    tabNew.addEventListener('click', () => switchSupportTab('new'));
  }

  const tabList = document.getElementById('tab-btn-my-tickets');
  if (tabList && !tabList._bound) {
    tabList._bound = true;
    tabList.addEventListener('click', () => switchSupportTab('list'));
  }

  // Tam Sayfa (#page-support) Sekmeleri
  const btnPageTabList = document.getElementById('btn-page-tab-list');
  if (btnPageTabList && !btnPageTabList._bound) {
    btnPageTabList._bound = true;
    btnPageTabList.addEventListener('click', () => switchPageSupportTab('list'));
  }

  const btnPageTabNew = document.getElementById('btn-page-tab-new');
  if (btnPageTabNew && !btnPageTabNew._bound) {
    btnPageTabNew._bound = true;
    btnPageTabNew.addEventListener('click', () => switchPageSupportTab('new'));
  }

  // Modal Bilet Gönderme Formu
  const modalForm = document.getElementById('support-ticket-form');
  if (modalForm && !modalForm._bound) {
    modalForm._bound = true;
    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-ticket');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const category = document.getElementById('ticket-category').value;
        const title = document.getElementById('ticket-title').value.trim();
        const message = document.getElementById('ticket-message').value.trim();

        await handleTicketSubmission(category, title, message);
        modalForm.reset();
        switchSupportTab('list');
      } catch (err) {
        console.error('[Support] submit error:', err);
        if (window.showToast) window.showToast('Bildirim gönderilemedi!', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Tam Sayfa Bilet Gönderme Formu
  const pageForm = document.getElementById('page-support-ticket-form');
  if (pageForm && !pageForm._bound) {
    pageForm._bound = true;
    pageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-page-submit-ticket');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const category = document.getElementById('page-ticket-category').value;
        const title = document.getElementById('page-ticket-title').value.trim();
        const message = document.getElementById('page-ticket-message').value.trim();

        await handleTicketSubmission(category, title, message);
        pageForm.reset();
        switchPageSupportTab('list');
      } catch (err) {
        console.error('[Support] page submit error:', err);
        if (window.showToast) window.showToast('Bildirim gönderilemedi!', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Süper Admin Yanıt Formu
  const adminForm = document.getElementById('admin-ticket-reply-form');
  if (adminForm && !adminForm._bound) {
    adminForm._bound = true;
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ticketId = document.getElementById('adm-reply-ticket-id').value;
      const status = document.getElementById('adm-ticket-status-select').value;
      const adminNote = document.getElementById('adm-ticket-note-input').value.trim();

      try {
        const tickets = await fetchSupportTickets();
        const index = tickets.findIndex(t => t.id === ticketId);
        if (index === -1) return;

        tickets[index].status = status;
        tickets[index].adminNote = adminNote;
        if (status === 'resolved' && !tickets[index].resolvedAt) {
          tickets[index].resolvedAt = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        await saveSupportTickets(tickets);
        if (window.showToast) window.showToast('Yanıtınız ve talep durumu kaydedildi! 💾', 'success');
        closeAdminTicketModal();
        renderAdminTickets();
        renderMyTickets();
      } catch (err) {
        console.error('[Support] admin reply save error:', err);
        if (window.showToast) window.showToast('Kaydedilemedi!', 'error');
      }
    });
  }

  // Süper Admin modal kapatma
  const closeAdminBtn = document.getElementById('btn-close-admin-ticket-modal');
  if (closeAdminBtn && !closeAdminBtn._bound) {
    closeAdminBtn._bound = true;
    closeAdminBtn.addEventListener('click', closeAdminTicketModal);
  }

  const cancelAdminBtn = document.getElementById('btn-adm-cancel-reply');
  if (cancelAdminBtn && !cancelAdminBtn._bound) {
    cancelAdminBtn._bound = true;
    cancelAdminBtn.addEventListener('click', closeAdminTicketModal);
  }

  const deleteAdminBtn = document.getElementById('btn-adm-delete-ticket');
  if (deleteAdminBtn && !deleteAdminBtn._bound) {
    deleteAdminBtn._bound = true;
    deleteAdminBtn.addEventListener('click', () => {
      const ticketId = document.getElementById('adm-reply-ticket-id').value;
      if (ticketId) deleteSupportTicket(ticketId);
    });
  }

  // Filtre Butonları
  const filterBtns = document.querySelectorAll('.ticket-filter-btn');
  filterBtns.forEach(btn => {
    if (!btn._bound) {
      btn._bound = true;
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.getAttribute('data-filter') || 'all';
        renderAdminTickets(f);
      });
    }
  });

  // Yenile butonu
  const refreshBtn = document.getElementById('btn-refresh-admin-tickets');
  if (refreshBtn && !refreshBtn._bound) {
    refreshBtn._bound = true;
    refreshBtn.addEventListener('click', () => {
      renderAdminTickets();
      if (window.showToast) window.showToast('Talepler güncellendi 🔄', 'info');
    });
  }

  // İlk veri yüklemesi
  renderMyTickets();
}

// Window bindings
window.Support = {
  fetchSupportTickets,
  saveSupportTickets,
  openSupportModal,
  closeSupportModal,
  switchSupportTab,
  switchPageSupportTab,
  renderMyTickets,
  renderAdminTickets,
  openAdminTicketModal,
  closeAdminTicketModal,
  quickResolveTicket,
  deleteSupportTicket,
  initSupport
};

window.openSupportModal = openSupportModal;
window.closeSupportModal = closeSupportModal;
window.switchPageSupportTab = switchPageSupportTab;
window.renderMyTickets = renderMyTickets;
window.renderAdminTickets = renderAdminTickets;
window.openAdminTicketModal = openAdminTicketModal;
window.closeAdminTicketModal = closeAdminTicketModal;
window.quickResolveTicket = quickResolveTicket;
window.deleteSupportTicket = deleteSupportTicket;
window.initSupport = initSupport;

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupport);
} else {
  initSupport();
}
