/* =========================================
   ATÖLYECİM — Ana Uygulama
   ========================================= */

/* --- Toast Notification --- */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

/* --- Modal Helpers --- */
function openModalById(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  }
}

function closeModalById(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 250);
  }
}

/* --- Init Modal Close Buttons --- */
function initModals() {
  // Close buttons
  document.querySelectorAll('.modal-close, .btn-ghost[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
      if (modalId) closeModalById(modalId);
    });
  });

  // Click outside to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModalById(overlay.id);
    });
  });

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.show').forEach(m => closeModalById(m.id));
    }
  });
}

/* --- Mobile Menu --- */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!menuBtn) return;

  function toggleSidebar() {
    const isOpen = sidebar.classList.toggle('open');
    menuBtn.classList.toggle('active', isOpen);
    overlay.classList.toggle('show', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    menuBtn.classList.remove('active');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  menuBtn.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Expose for navigation
  window._closeMobileSidebar = closeSidebar;
}

/* --- Navigation --- */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageName = item.dataset.page;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      pages.forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById('page-' + pageName);
      if (targetPage) {
        targetPage.classList.add('active');

        // Refresh page data
        if (pageName === 'dashboard') Dashboard.render();
        else if (pageName === 'products') Products.render();
        else if (pageName === 'contacts') Contacts.render();
      }

      // Close mobile sidebar on page switch
      if (window._closeMobileSidebar) window._closeMobileSidebar();
    });
  });
}

/* --- Login --- */
function initLogin() {
  const loginForm = document.getElementById('login-form');
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const logoutBtn = document.getElementById('logout-btn');
  const loginError = document.getElementById('login-error');

  // Check if already logged in
  if (sessionStorage.getItem('atolyecim_auth') === 'true') {
    loginScreen.classList.add('hide');
    setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
    app.classList.remove('app-hidden');
    loadApp();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (username === 'admin' && password === '1234') {
      loginError.style.display = 'none';
      sessionStorage.setItem('atolyecim_auth', 'true');

      loginScreen.classList.add('hide');
      setTimeout(() => {
        loginScreen.style.display = 'none';
        app.classList.remove('app-hidden');
        loadApp();
      }, 500);
    } else {
      loginError.style.display = 'block';
      document.getElementById('login-password').value = '';
      document.getElementById('login-password').focus();
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('atolyecim_auth');
    loginScreen.style.display = 'flex';
    loginScreen.classList.remove('hide');
    app.classList.add('app-hidden');
    document.getElementById('login-form').reset();
    loginError.style.display = 'none';
  });
}

/* --- Load App --- */
async function loadApp() {
  try {
    await initDB();
    initModals();
    initMobileMenu();
    initNavigation();
    await Dashboard.render();
    Products.bindEvents();
    Contacts.bindEvents();
  } catch (err) {
    console.error('Uygulama yükleme hatası:', err);
    showToast('Uygulama yüklenemedi: ' + err.message, 'error');
  }
}

/* --- Initialize --- */
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
});
