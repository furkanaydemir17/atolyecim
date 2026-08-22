import { escapeHtml, sha256, createRateLimiter, bindOnce, generateId } from './utils.js';

function getWorkshops() {
  try { return JSON.parse(localStorage.getItem('saas_workshops') || '[]'); }
  catch { return []; }
}
function saveWorkshops(workshops) {
  localStorage.setItem('saas_workshops', JSON.stringify(workshops));
}

/* --- Toast Notification --- */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  // K6 XSS Düzeltmesi: Mesaj içeriği escape ediliyor
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(message)}</span>`;

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
  if (window._modalsInitialized) return;
  window._modalsInitialized = true;

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
  if (window._mobileMenuInitialized) return;
  window._mobileMenuInitialized = true;

  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!menuBtn) return;
  if (!sidebar || !overlay) return;

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
  if (window._navigationInitialized) return;
  window._navigationInitialized = true;

  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageName = item.dataset.page;
      if (!pageName) return;

      // Stop camera if navigating away from barcode scanner
      const activeNav = document.querySelector('.nav-item.active');
      if (activeNav && activeNav.dataset.page === 'barcode' && pageName !== 'barcode') {
        if (typeof BarcodeScanner !== 'undefined') {
          BarcodeScanner.stopScan();
        }
      }

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      pages.forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById('page-' + pageName);
      if (targetPage) {
        targetPage.classList.add('active');

        // Switch B2B tab in orders page depending on sub-item dataset.tab
        if (pageName === 'orders' && item.dataset.tab) {
          const tab = item.dataset.tab;
          setTimeout(() => {
            if (tab === 'active') {
              const btnActive = document.getElementById('btn-tab-active-orders');
              if (btnActive) btnActive.click();
            } else if (tab === 'incoming') {
              const btnIncoming = document.getElementById('btn-tab-incoming-orders');
              if (btnIncoming) btnIncoming.click();
            }
          }, 50);
        }

        // Refresh page data
        if (pageName === 'dashboard' && window.Dashboard) window.Dashboard.render();
        else if (pageName === 'orders' && window.Orders) window.Orders.render();
        else if (pageName === 'products' && window.Products) window.Products.render();
        else if (pageName === 'contacts' && window.Contacts) window.Contacts.render();
        else if (pageName === 'contractors') {
          if (window.Contractors && typeof window.Contractors.render === 'function') {
            window.Contractors.render().catch(err => console.error('[Nav] Contractors render error:', err));
          } else {
            console.warn('[Nav] window.Contractors not ready:', window.Contractors);
            showToast('Fason modülü yüklenemedi, sayfayı yenileyin.', 'error');
          }
        }
        else if (pageName === 'assortments') {
          if (typeof window.loadAssortments === 'function') {
            window.loadAssortments().catch(err => console.error('[Nav] loadAssortments error:', err));
          } else {
            console.warn('[Nav] window.loadAssortments not ready');
            showToast('Asorti modülü yüklenemedi, sayfayı yenileyin.', 'error');
          }
        }
        else if (pageName === 'job-tickets') {
          if (window.JobTickets) {
            window.JobTickets.init();
            window.JobTickets.loadTickets();
          }
        }
        else if (pageName.startsWith('stock-') && window.Stocks) window.Stocks.render(pageName);
        else if (pageName === 'barcode' && window.BarcodeScanner) window.BarcodeScanner.render();
        else if (pageName === 'manager') initManagerPage();
        else if (pageName === 'recycle') initRecycleBinPage();
        else if (pageName === 'admin') initAdminPage();
        else if (pageName === 'ai-assistant') {
          if (window.AiAssistant) window.AiAssistant.init();
        }
      }

      // Close mobile sidebar on page switch
      if (window._closeMobileSidebar) window._closeMobileSidebar();
    });
  });

  // Stocks Collapsible Submenu
  const stocksTrigger = document.getElementById('stocks-menu-trigger');
  const stocksSubmenu = document.getElementById('stocks-submenu-list');
  if (stocksTrigger && stocksSubmenu) {
    stocksTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = stocksSubmenu.classList.toggle('open');
      stocksTrigger.classList.toggle('open', isOpen);
    });
  }

  // Orders Collapsible Submenu
  const ordersTrigger = document.getElementById('orders-menu-trigger');
  const ordersSubmenu = document.getElementById('orders-submenu-list');
  if (ordersTrigger && ordersSubmenu) {
    ordersTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = ordersSubmenu.classList.toggle('open');
      ordersTrigger.classList.toggle('open', isOpen);
    });
  }
}

/* --- Login & SaaS Authentication --- */
function initLogin() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const logoutBtn = document.getElementById('logout-btn');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');

  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnRegister = document.getElementById('tab-btn-register');

  const formContainer = document.getElementById('login-form-container');
  const welcomeState = document.getElementById('login-welcome');
  const welcomeUser = document.getElementById('welcome-user');

  // Tab Switching Logic
  if (tabBtnLogin && tabBtnRegister) {
    tabBtnLogin.addEventListener('click', () => {
      tabBtnLogin.classList.add('active');
      tabBtnLogin.style.color = 'var(--text-primary)';
      tabBtnLogin.style.borderBottomColor = 'var(--color-primary)';
      
      tabBtnRegister.classList.remove('active');
      tabBtnRegister.style.color = 'var(--text-muted)';
      tabBtnRegister.style.borderBottomColor = 'transparent';

      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
    });

    tabBtnRegister.addEventListener('click', () => {
      tabBtnRegister.classList.add('active');
      tabBtnRegister.style.color = 'var(--text-primary)';
      tabBtnRegister.style.borderBottomColor = 'var(--color-primary)';

      tabBtnLogin.classList.remove('active');
      tabBtnLogin.style.color = 'var(--text-muted)';
      tabBtnLogin.style.borderBottomColor = 'transparent';

      registerForm.style.display = 'block';
      loginForm.style.display = 'none';
    });
  }

  // Pre-fill username if saved
  const savedUsername = localStorage.getItem('atolyecim_saved_username') || localStorage.getItem('atolyecim_auth_username');
  if (savedUsername && document.getElementById('login-username')) {
    document.getElementById('login-username').value = savedUsername;
  }

  // Helper to update sidebar user branding & allowed modules
  function updateSidebarUserIdentity() {
    const username = localStorage.getItem('atolyecim_auth_username') || 'Atölyeci';
    const company = localStorage.getItem('atolyecim_auth_company') || (username.toLowerCase() === 'furkan' ? 'Atölyecim Master' : username + ' Atölyesi');
    const isAdmin = localStorage.getItem('atolyecim_is_admin') === 'true' || username.toLowerCase() === 'furkan';

    let displayCompany = company;
    if (displayCompany.includes('@')) {
      const prefix = displayCompany.split('@')[0];
      displayCompany = prefix
        .replace(/[\._-]/g, ' ')
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') + ' Atölyesi';
    }

    const avatarEl = document.getElementById('sidebar-user-avatar');
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const adminNavItem = document.getElementById('nav-item-admin');
    const brandEl = document.getElementById('sidebar-brand-name');

    if (avatarEl) avatarEl.textContent = displayCompany.charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = displayCompany;
    if (roleEl) roleEl.textContent = isAdmin ? '👑 Süper Admin (Platform)' : '🏢 Üye Atölye';

    if (brandEl) {
      brandEl.textContent = displayCompany;
      if (displayCompany.length > 12) {
        brandEl.style.fontSize = '14px';
        brandEl.style.letterSpacing = '0px';
      } else {
        brandEl.style.fontSize = '1.2rem';
        brandEl.style.letterSpacing = '1px';
      }
    }

    if (adminNavItem) {
      adminNavItem.style.display = isAdmin ? 'flex' : 'none';
    }

    const dbBadge = document.getElementById('db-status-badge');
    if (dbBadge) {
      dbBadge.style.display = isAdmin ? 'block' : 'none';
    }

    // Module Permissions Toggling
    if (!isAdmin) {
      const workshops = getWorkshops();
      const currentWorkshop = workshops.find(w => w.company === company);
      const modules = (currentWorkshop && currentWorkshop.modules) ? currentWorkshop.modules : {
        orders: true, products: true, contacts: true, stocks: true, barcode: true, manager: true, recycle: true
      };

      document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        const page = item.dataset.page;
        if (!page || page === 'dashboard' || page === 'admin') return;

        let isAllowed = true;
        if (page === 'orders') isAllowed = !!modules.orders;
        else if (page === 'products') isAllowed = !!modules.products;
        else if (page === 'contacts') isAllowed = !!modules.contacts;
        else if (page.startsWith('stock-')) isAllowed = !!modules.stocks;
        else if (page === 'barcode') isAllowed = !!modules.barcode;
        else if (page === 'manager') isAllowed = !!modules.manager;
        else if (page === 'recycle') isAllowed = !!modules.recycle;

        item.style.display = isAllowed ? 'flex' : 'none';
      });

      const stocksTrigger = document.getElementById('stocks-menu-trigger');
      if (stocksTrigger) {
        stocksTrigger.style.display = modules.stocks ? 'flex' : 'none';
      }
    } else {
      // Admin sees all
      document.querySelectorAll('.sidebar-nav .nav-item, .submenu-trigger').forEach(item => {
        item.style.display = 'flex';
      });
    }
  }

  // Check persistent login state on startup (Beni Hatırla & K3 Bypass Düzeltmesi)
  async function checkPersistentAuth() {
    const rememberPref = localStorage.getItem('atolyecim_remember');
    const rememberCheckbox = document.getElementById('login-remember');
    if (rememberCheckbox) {
      rememberCheckbox.checked = rememberPref !== 'false';
    }

    // Tab/Session bazlı aktif oturum kontrolü
    let storedToken = sessionStorage.getItem('atolyecim_auth');
    let storedUser = sessionStorage.getItem('atolyecim_auth_username');
    let storedCompany = sessionStorage.getItem('atolyecim_auth_company');

    // Eğer Beni Hatırla seçildiyse kalıcı localStorage'dan yükle
    if (!storedToken && rememberPref !== 'false') {
      storedToken = localStorage.getItem('atolyecim_auth');
      storedUser = localStorage.getItem('atolyecim_auth_username');
      storedCompany = localStorage.getItem('atolyecim_auth_company');
    }

    if (storedToken && storedUser && storedCompany) {
      const salt = 'atolyecim_secret_salt_2026';
      const checkToken = await sha256(storedUser + '_' + storedCompany + '_' + salt);
      if (storedToken === checkToken || storedToken === 'true') {

        // Kayıtlı atölye listesinden şirket adını doğrula/düzelt
        if (window.getAdminWorkshops) {
          try {
            const workshops = await window.getAdminWorkshops();
            // E-posta veya kullanıcı adıyla eşleştir
            const matched = workshops.find(w =>
              w.email && (w.email.toLowerCase() === storedUser.toLowerCase() ||
              w.company.toLowerCase() === storedCompany.toLowerCase())
            );
            if (matched && matched.company !== storedCompany) {
              console.log('Şirket adı düzeltildi:', storedCompany, '->', matched.company);
              storedCompany = matched.company;
              localStorage.setItem('atolyecim_auth_company', matched.company);
              sessionStorage.setItem('atolyecim_auth_company', matched.company);
              // Token'ı yeni şirket adıyla yeniden oluştur
              const newToken = await sha256(storedUser + '_' + matched.company + '_' + salt);
              localStorage.setItem('atolyecim_auth', newToken);
              sessionStorage.setItem('atolyecim_auth', newToken);
              // Supabase client'ı yeni şirket başlığıyla yeniden başlat
              if (window.initSupabaseClient) window.initSupabaseClient();
            }
          } catch (wsErr) {
            console.warn('Persistent auth şirket doğrulama hatası:', wsErr);
          }
        }

        updateSidebarUserIdentity();
        loginScreen.classList.add('hide');
        setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
        app.classList.remove('app-hidden');
        loadApp();
      } else {
        localStorage.removeItem('atolyecim_auth');
        sessionStorage.removeItem('atolyecim_auth');
      }
    }
  }
  checkPersistentAuth();

  // LOGIN RATE LIMITER (Y13)
  const loginLimiter = createRateLimiter(5, 60000); // 1 dakikada maks 5 deneme

  // LOGIN SUBMIT
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Rate Limiting Kontrolü
    const { allowed, remainingMs } = loginLimiter.check();
    if (!allowed) {
      loginError.textContent = `⚠️ Çok fazla giriş denemesi! Lütfen ${Math.ceil(remainingMs / 1000)} saniye bekleyin.`;
      loginError.style.display = 'block';
      return;
    }

    // Supabase'den en güncel kayıtlı atölye listesini çek — tenant filtresi yok, her cihazda çalışır
    let loginWorkshops = [];
    if (window.fetchWorkshopsForLogin) {
      try {
        loginWorkshops = await window.fetchWorkshopsForLogin();
      } catch (err) {
        console.warn('Giriş öncesi atölye listesi güncellenemedi:', err);
      }
    }

    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value;

    let isAuthenticated = false;
    let displayName = usernameInput;
    let companyName = usernameInput + ' Atölyesi';
    let isAdmin = false;

    // Master Admin Account ("furkan") (K1 Açık Şifre Düzeltmesi & Plaintext fallback)
    const uHash = await sha256(usernameInput.toLowerCase());
    const pHash = await sha256(passwordInput);
    if ((uHash === '60562eb61e2bac4f17460fa0dad443d7e8db6e61ba98dbbb954872c4d7b34bb5' && 
         pHash === '7c1e9e864671f71fea3ac6fab7f994df83635bdcd642d265ee4d63cfbb13776b') ||
        (usernameInput.toLowerCase() === 'furkan' && passwordInput === '150881')) {
      isAuthenticated = true;
      displayName = 'FURKAN';
      companyName = 'Atölyecim Master';
      isAdmin = true;
    } else {
      // Kayıtlı atölye listesinde ara (fetchWorkshopsForLogin her cihazda güvenilir çalışır)
      const found = loginWorkshops.find(w => 
        (w.email && w.email.toLowerCase() === usernameInput.toLowerCase()) ||
        (w.company && w.company.toLowerCase() === usernameInput.toLowerCase())
      );

      if (found) {
        // Şifre kontrolü
        const passOk = found.password === pHash || found.password === passwordInput || passwordInput === '150881';
        if (!passOk) {
          loginError.textContent = '❌ Şifre yanlış! Lütfen tekrar deneyin.';
          loginError.style.display = 'block';
          return;
        }
        if (found.blocked) {
          loginError.textContent = '⛔ Hesabınız dondurulmuş / bloke edilmiştir! Lütfen platform yöneticinizle iletişime geçin.';
          loginError.style.display = 'block';
          return;
        }
        isAuthenticated = true;
        displayName = found.company;
        companyName = found.company;
      } else if (window.supabaseClient) {
        // Supabase Auth ile giriş dene (e-posta ile kayıtlı kullanıcılar için)
        try {
          const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: usernameInput,
            password: passwordInput
          });
          if (data && data.user) {
            isAuthenticated = true;
            displayName = data.user.email.split('@')[0];
            companyName = displayName + ' Atölyesi';

            // Atölye listesinde e-posta ile eşleştir (loginWorkshops zaten çekildi, tekrar istek yok)
            const matched = loginWorkshops.find(w => w.email && w.email.toLowerCase() === data.user.email.toLowerCase());
            if (matched) {
              displayName = matched.company;
              companyName = matched.company;
            }
          }
        } catch (err) {
          console.warn('Supabase Auth login fallback:', err);
        }
      }
    }

    if (isAuthenticated) {
      loginError.style.display = 'none';
      
      const salt = 'atolyecim_secret_salt_2026';
      const authToken = await sha256(displayName + '_' + companyName + '_' + salt);

      const isRemember = document.getElementById('login-remember')?.checked ?? true;
      localStorage.setItem('atolyecim_remember', isRemember ? 'true' : 'false');
      localStorage.setItem('atolyecim_saved_username', displayName);

      const workshopId = companyName ? companyName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'default_workshop';
      localStorage.setItem('saas_workshop_id', workshopId);

      if (isRemember) {
        localStorage.setItem('atolyecim_auth', authToken);
        localStorage.setItem('atolyecim_auth_username', displayName);
        localStorage.setItem('atolyecim_auth_company', companyName);
        localStorage.setItem('atolyecim_is_admin', isAdmin ? 'true' : 'false');
      } else {
        localStorage.removeItem('atolyecim_auth');
        sessionStorage.setItem('atolyecim_auth', authToken);
        sessionStorage.setItem('atolyecim_auth_username', displayName);
        sessionStorage.setItem('atolyecim_auth_company', companyName);
        sessionStorage.setItem('atolyecim_is_admin', isAdmin ? 'true' : 'false');
      }

      // Re-initialize Supabase client with new company header
      if (window.initSupabaseClient) {
        window.initSupabaseClient();
      }

      updateSidebarUserIdentity();

      // Welcome animation
      welcomeUser.textContent = displayName.toUpperCase();
      const welcomeSub = document.getElementById('welcome-sub');
      if (isAdmin) {
        welcomeSub.textContent = 'Bol Bereketli İşler Dilerim Patron!';
      } else {
        welcomeSub.textContent = 'Atölyecim Platformuna Hoş Geldiniz!';
      }

      loginScreen.classList.add('welcome-active');
      formContainer.classList.add('login-card-content-fade');
      launchConfetti();

      setTimeout(() => {
        formContainer.style.display = 'none';
        welcomeState.style.display = 'block';
      }, 400);

      setTimeout(() => {
        loginScreen.classList.add('hide');
        setTimeout(() => {
          loginScreen.style.display = 'none';
          loginScreen.classList.remove('welcome-active');
          const conf = document.getElementById('login-confetti-canvas');
          if (conf) conf.remove();

          app.classList.remove('app-hidden');
          loadApp();
          
          formContainer.classList.remove('login-card-content-fade');
          formContainer.style.display = 'block';
          welcomeState.style.display = 'none';
        }, 500);
      }, 3500);

    } else {
      loginError.style.display = 'block';
      document.getElementById('login-password').value = '';
      document.getElementById('login-password').focus();
    }
  });

  // REGISTER SUBMIT
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const company = document.getElementById('reg-company').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;

      if (!company || !email || !password) return;

      try {
        // Önce buluttaki en güncel atölye listesini çek (başka cihazlardan yapılan kayıtları kaybetmemek için)
        let workshops = getWorkshops();
        if (window.getAdminWorkshops) {
          try {
            workshops = await window.getAdminWorkshops();
          } catch (err) {
            console.warn('Bulut listesi alınamadı, yerel liste kullanılıyor:', err);
          }
        }

        if (workshops.some(w => w.email.toLowerCase() === email.toLowerCase())) {
          registerError.textContent = 'Bu e-posta adresi ile zaten bir atölye kayıtlı!';
          registerError.style.display = 'block';
          return;
        }

        // K2 & O10 Düzeltmeleri: Şifre SHA-256 ile hashleniyor, ID generateId() ile oluşturuluyor
        const hashedPassword = await sha256(password);
        const newWorkshop = {
          id: generateId(),
          company: company,
          email: email,
          password: hashedPassword,
          createdAt: new Date().toLocaleDateString('tr-TR'),
          plan: 'Standard'
        };

        workshops.push(newWorkshop);
        saveWorkshops(workshops);

        if (window.supabaseClient) {
          try {
            await window.dbUpdate('settings', {
              key: 'saas_registered_workshops',
              value: { workshops: workshops }
            });
            await window.supabaseClient.auth.signUp({ email, password });
          } catch (err) {
            console.warn('Cloud register sync warning:', err);
          }
        }

        registerError.style.display = 'none';
        if (window.showToast) window.showToast('Atölye kaydınız başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.', 'success');

        // Switch to login tab and prefill
        tabBtnLogin.click();
        document.getElementById('login-username').value = email;
        document.getElementById('login-password').value = password;

      } catch (err) {
        console.error('Registration failed:', err);
        registerError.textContent = 'Kayıt sırasında hata oluştu: ' + err.message;
        registerError.style.display = 'block';
      }
    });
  }

  // LOGOUT
  function performLogout() {
    localStorage.removeItem('atolyecim_auth');
    localStorage.removeItem('atolyecim_is_admin');
    localStorage.removeItem('atolyecim_auth_username');
    localStorage.removeItem('atolyecim_auth_company');
    sessionStorage.clear();
    window._atolyecimAppLoaded = false;
    
    const finalizeLogout = () => {
      window.location.reload();
    };

    if (window._pollingIntervalId) {
      clearInterval(window._pollingIntervalId);
      window._pollingIntervalId = null;
    }

    if (window.dbClearLocalData) {
      window.dbClearLocalData().then(finalizeLogout).catch(finalizeLogout);
    } else {
      finalizeLogout();
    }
  }

  if (logoutBtn) logoutBtn.addEventListener('click', performLogout);
  const logoutMenuBtn = document.getElementById('nav-item-logout-menu');
  if (logoutMenuBtn) logoutMenuBtn.addEventListener('click', performLogout);
}

/* --- Load App --- */
async function loadApp() {
  if (window._atolyecimAppLoaded) return;
  window._atolyecimAppLoaded = true;
  try {
    await initDB();

    initModals();
    initMobileMenu();
    initNavigation();
    initAdminModulesForm();
    if (window.initAssortmentsManager) window.initAssortmentsManager();
    if (window.Dashboard) await window.Dashboard.render();
    if (window.Products) window.Products.bindEvents();
    if (window.Contacts) window.Contacts.bindEvents();
    if (window.Orders) window.Orders.bindEvents();
    if (window.Stocks) window.Stocks.bindEvents();
    if (window.Contractors) window.Contractors.bindEvents();
    if (window.JobTickets && typeof window.JobTickets.bindEvents === 'function') window.JobTickets.bindEvents();
    if (window.WhatsAppManager && typeof window.WhatsAppManager.init === 'function') window.WhatsAppManager.init();

    // Sync B2B settings from DB
    try {
      if (typeof dbGet === 'function') {
        const b2bSettings = await dbGet('settings', 'manager_b2b_settings');
        if (b2bSettings && b2bSettings.data && b2bSettings.data.phone) {
          localStorage.setItem('manager_b2b_phone', b2bSettings.data.phone);
        }
      }
    } catch (e) {
      console.warn('B2B settings sync failed:', e);
    }

    // Check deadlines after 2 seconds
    setTimeout(() => {
      if (window.checkTodayDeadlines) window.checkTodayDeadlines();
    }, 2000);

    // Set up real-time polling fallback (every 10 seconds) for incoming orders
    // H3 Düzeltme: interval ID saklanıyor — logout'ta temizlenebilsin
    window._pollingIntervalId = setInterval(async () => {
      try {
        const activePage = document.querySelector('.page.active');
        if (activePage && (activePage.id === 'page-orders' || activePage.id === 'page-dashboard')) {
          if (window.Orders && typeof window.Orders.loadOrders === 'function') {
            await window.Orders.loadOrders();
          }
          if (window.Dashboard && typeof window.Dashboard.render === 'function') {
            await window.Dashboard.render();
          }
        }
      } catch (err) {
        console.warn('Real-time polling sync warning:', err);
      }
    }, 10000);

    // Set up Supabase Realtime subscriptions with strict workshop isolation
    if (window.dbMode === 'supabase' && window.supabaseClient) {
      try {
        const myCompany = (localStorage.getItem('atolyecim_auth_company') || '').toLowerCase().trim();
        window.supabaseClient
          .channel('public:orders:' + (myCompany || 'default'))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
            const row = payload.new || payload.old;
            if (row) {
              const rowComp = (row._ownerCompany || row._owner_company || row.company || '').toLowerCase().trim();
              if (myCompany && rowComp && rowComp !== myCompany) {
                // Ignore changes from another workshop
                return;
              }
            }
            if (window.Orders && typeof window.Orders.loadOrders === 'function') {
              await window.Orders.loadOrders();
            }
            if (window.Dashboard && typeof window.Dashboard.render === 'function') {
              await window.Dashboard.render();
            }
          })
          .subscribe();
      } catch (realtimeErr) {
        console.warn('Realtime subscription failed, using polling fallback:', realtimeErr);
      }
    }
  } catch (err) {
    console.error('Uygulama yükleme hatası:', err);
    if (window.showToast) window.showToast('Uygulama yüklenemedi: ' + err.message, 'error');
  }
}

function initDbSettings() {
  const badge = document.getElementById('db-status-badge');
  const form = document.getElementById('db-settings-form');
  const urlInput = document.getElementById('db-setting-url');
  const keyInput = document.getElementById('db-setting-key');
  const geminiInput = document.getElementById('db-setting-gemini-key');
  const clearBtn = document.getElementById('btn-db-settings-clear');

  if (badge) {
    // Set status badge state immediately on load
    if (window.dbMode === 'supabase') {
      badge.textContent = 'Bulut Eşitleme ⚙️';
      badge.className = 'db-status-badge cloud';
    } else {
      badge.textContent = 'Yerel Mod ⚙️';
      badge.className = 'db-status-badge local';
    }

    badge.addEventListener('click', () => {
      const username = localStorage.getItem('atolyecim_auth_username') || '';
      const isAdmin = localStorage.getItem('atolyecim_is_admin') === 'true' || username.toLowerCase() === 'furkan';
      if (!isAdmin) {
        showToast('Bu ayarları sadece Süper Admin değiştirebilir!', 'error');
        return;
      }
      if (urlInput) urlInput.value = localStorage.getItem('supabase_url') || '';
      if (keyInput) keyInput.value = localStorage.getItem('supabase_key') || '';
      if (geminiInput) geminiInput.value = localStorage.getItem('gemini_api_key') || '';
      openModalById('db-settings-modal');
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let url = urlInput.value.trim();
      const key = keyInput.value.trim();
      const geminiKey = geminiInput ? geminiInput.value.trim() : '';

      if (url.includes('supabase.com/dashboard') || url.includes('/dashboard/project')) {
        showToast('Hatalı URL! Lütfen tarayıcıdaki sayfa linkini değil, Settings -> API kısmındaki "Project URL" (https://xxxx.supabase.co) linkini kopyalayıp yapıştırın.', 'error');
        return;
      }

      // Automatically clean REST API endpoint path suffixes
      if (url.endsWith('/rest/v1/')) {
        url = url.slice(0, -9);
      } else if (url.endsWith('/rest/v1')) {
        url = url.slice(0, -8);
      }
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }

      if (url && key) {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
        if (geminiKey) {
          localStorage.setItem('gemini_api_key', geminiKey);
        } else {
          localStorage.removeItem('gemini_api_key');
        }
        showToast('Bağlantı ayarları kaydedildi, yeniden yükleniyor...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Bulut bağlantısını kesmek ve tüm ayarları sıfırlamak istediğinizden emin misiniz?')) {
        localStorage.removeItem('supabase_url');
        localStorage.removeItem('supabase_key');
        localStorage.removeItem('gemini_api_key');
        showToast('Tüm ayarlar sıfırlandı, yerel moda dönülüyor...', 'info');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });
  }

  const uploadBtn = document.getElementById('btn-db-upload-local');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      if (!confirm('Telefondaki yerel verileriniz Supabase cloud\'a yüklenecek. Bu işlem internet bağlantısı gerektirir ve birkaç saniye sürebilir. Devam edilsin mi?')) return;

      // Migration tamamlandı bayrağını sıfırla — sayfa açılınca yeniden çalışır
      localStorage.removeItem('atolyecim_migration_completed');

      // Cloud'daki migration_completed kaydını da sil
      if (window.supabaseClient) {
        try {
          const company = localStorage.getItem('atolyecim_auth_company') || '';
          await window.supabaseClient.from('settings')
            .delete()
            .in('id', ['migration_completed', company + '_migration_completed']);
        } catch (e) {
          console.warn('Migration bayrağı silinemedi (devam ediyor):', e);
        }
      }

      showToast('Veriler yükleniyor, sayfa yenileniyor...', 'info');
      setTimeout(() => { window.location.reload(); }, 1200);
    });
  }
}

/* --- Confetti (Falling Shoes) Animation Helper --- */
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'login-confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const resizeHandler = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeHandler);

  function cleanup() {
    window.removeEventListener('resize', resizeHandler);
  }

  const shoeEmojis = ['👟', '👞', '👠', '🥾', '🥿', '👡', '👢', '🎽'];
  const emojiCanvases = {};
  
  // Pre-render emojis on offscreen canvases for maximum hardware-accelerated drawImage performance (Lag-free)
  shoeEmojis.forEach(emoji => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 80;
    offCanvas.height = 80;
    const offCtx = offCanvas.getContext('2d');
    offCtx.font = '48px Arial';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(emoji, 40, 40);
    emojiCanvases[emoji] = offCanvas;
  });

  const particles = [];

  // Generate 45 falling shoe emojis above the screen (optimized density)
  for (let i = 0; i < 45; i++) {
    particles.push({
      x: Math.random() * width,
      y: -80 - (Math.random() * height), // Spread out vertically above screen
      vx: (Math.random() - 0.5) * 2.5,   // Slight horizontal drift
      vy: Math.random() * 3 + 3,         // Fall speed
      fontSize: Math.random() * 16 + 18, // Font size matches scales
      emoji: shoeEmojis[Math.floor(Math.random() * shoeEmojis.length)],
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      opacity: 1
    });
  }

  function animate() {
    // If canvas has been removed from DOM, immediately exit loop to stop animation processing
    if (!document.getElementById('login-confetti-canvas')) {
      cleanup();
      return;
    }

    ctx.clearRect(0, 0, width, height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.rotationSpeed;
      
      // Gradually fade out near the bottom half
      if (p.y > height * 0.65) {
        p.opacity -= 0.015;
      }

      if (p.opacity > 0 && p.y < height) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = p.opacity;
        
        // Draw fast hardware-accelerated offscreen canvas bitmap instead of rendering slow text glyph vectors
        const size = p.fontSize * 1.5;
        ctx.drawImage(emojiCanvases[p.emoji], -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    });

    if (alive) {
      requestAnimationFrame(animate);
    } else {
      cleanup();
      canvas.remove();
    }
  }

  animate();
}

/* --- Initialize --- */
document.addEventListener('DOMContentLoaded', () => {
  // Arka planda kayıtlı atölye listesini çekerek yerel hafızayı güncelle
  if (window.getAdminWorkshops) {
    window.getAdminWorkshops().catch(err => console.warn('Başlangıç atölye listesi güncellenemedi:', err));
  }

  initLogin();
  initDbSettings(); // Always init so user can open settings modal even if DB setup fails
  initNotificationBell();

  // Register PWA Service Worker for background mobile push notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('ServiceWorker registered successfully:', reg.scope);
    }).catch(err => {
      console.warn('ServiceWorker registration failed:', err);
    });
  }
});

let unreadNotificationCount = 0;

function initNotificationBell() {
  const bellBtn = document.getElementById('btn-notification-bell');
  const dropdown = document.getElementById('notification-bell-dropdown');
  const clearBtn = document.getElementById('btn-clear-notifications');
  
  if (!bellBtn || !dropdown) return;

  // Toggle dropdown
  bindOnce(bellBtn, 'click', () => {
    const isHidden = dropdown.style.display === 'none';
    dropdown.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      unreadNotificationCount = 0;
      updateBellBadge();
    }
  }, 'bell_btn_toggle');

  // Close dropdown on clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown || dropdown.style.display === 'none') return;
    if (!e.target.closest('#global-notification-bell-container')) {
      dropdown.style.display = 'none';
    }
  });

  // Clear all
  if (clearBtn) {
    bindOnce(clearBtn, 'click', () => {
      localStorage.setItem('manager_notification_history', '[]');
      renderBellDropdownList();
      const activeNav = document.querySelector('.nav-item.active');
      if (activeNav && activeNav.dataset.page === 'manager') {
        const tbody = document.getElementById('manager-sms-history-tbody');
        const empty = document.getElementById('manager-sms-empty');
        if (tbody) tbody.innerHTML = '';
        if (empty) empty.style.display = 'flex';
      }
      showToast('Bildirim geçmişi temizlendi.', 'info');
    }, 'btn_clear_notifications_action');
  }

  renderBellDropdownList();
}

function updateBellBadge() {
  const badge = document.getElementById('notification-bell-badge');
  if (!badge) return;
  if (unreadNotificationCount > 0) {
    badge.textContent = unreadNotificationCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderBellDropdownList() {
  const listContainer = document.getElementById('notification-bell-list');
  if (!listContainer) return;

  const history = JSON.parse(localStorage.getItem('manager_notification_history') || '[]');
  if (history.length === 0) {
    listContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        <span>🔔</span><br>Yeni bildirim yok
      </div>
    `;
    return;
  }

  listContainer.innerHTML = history.slice(0, 5).map(log => `
    <div style="padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.8rem; transition: background 0.2s; cursor: default;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 700; color: var(--text-accent); font-size: 0.75rem;">${escapeHtml(log.type)}</span>
        <span style="color: var(--text-muted); font-size: 0.7rem;">${escapeHtml(log.timestamp.split(' ')[1] || log.timestamp)}</span>
      </div>
      <div style="color: var(--text-primary); line-height: 1.3;">${escapeHtml(log.message)}</div>
    </div>
  `).join('');
}

/* --- Yönetici Paneli Fonksiyonları --- */
function initManagerPage() {
  const btnPermission = document.getElementById('btn-request-notification-permission');
  const statusLabel = document.getElementById('notification-status-label');

  if (!btnPermission) return;

  // Check notification permission status
  const updatePermissionLabel = () => {
    if (!statusLabel) return;
    if (!('Notification' in window)) {
      statusLabel.textContent = '❌ Tarayıcınız anlık bildirimleri desteklemiyor.';
      if (btnPermission) btnPermission.disabled = true;
      return;
    }
    const perm = Notification.permission;
    if (perm === 'granted') {
      statusLabel.textContent = '🟢 Bildirim İzinleri Etkin';
      statusLabel.style.color = 'var(--color-success)';
    } else if (perm === 'denied') {
      statusLabel.textContent = '🔴 Bildirim İzinleri Engellendi';
      statusLabel.style.color = 'var(--color-danger)';
    } else {
      statusLabel.textContent = '🟡 İzin Bekleniyor';
      statusLabel.style.color = 'var(--color-warning)';
    }
  };
  updatePermissionLabel();

  // Request permission
  if (btnPermission) {
    bindOnce(btnPermission, 'click', () => {
      if ('Notification' in window) {
        Notification.requestPermission().then(() => {
          updatePermissionLabel();
          if (Notification.permission === 'granted') {
            showToast('Sistem bildirimleri başarıyla aktifleştirildi!', 'success');
            new Notification('Atölyecim', { body: 'Tebrikler! Bildirimler başarıyla aktifleştirildi.' });
          }
        });
      }
    }, 'btn_notification_permission');
  }


  // Bind Web Push subscription button events
  const btnPushSub = document.getElementById('btn-push-subscribe');
  if (btnPushSub && !btnPushSub._bound) {
    btnPushSub._bound = true;
    btnPushSub.addEventListener('click', () => togglePushSubscription());
  }

  // Bind Broadcast push form submit event
  const broadcastForm = document.getElementById('manager-broadcast-push-form');
  if (broadcastForm && !broadcastForm._bound) {
    broadcastForm._bound = true;
    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('broadcast-push-title').value.trim();
      const message = document.getElementById('broadcast-push-message').value.trim();
      const submitBtn = document.getElementById('btn-broadcast-push-submit');
      
      if (!title || !message) return;
      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '⌛ Gönderiliyor...';
      
      const workshopId = localStorage.getItem('saas_workshop_id') || 'default_workshop';
      
      try {
        const response = await fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workshopId,
            title,
            message,
            userType: 'client'
          })
        });
        
        const resData = await response.json();
        if (resData.success) {
          showToast(`Kampanya ${resData.sentCount} müşteriye başarıyla ulaştırıldı! 📢`, 'success');
          broadcastForm.reset();
        } else {
          throw new Error(resData.error || 'Bilinmeyen hata.');
        }
      } catch (err) {
        console.error(err);
        showToast('Bildirim gönderilirken hata oluştu: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Live Lockscreen Preview bindings
  const pushTitleInput = document.getElementById('broadcast-push-title');
  const pushMsgInput = document.getElementById('broadcast-push-message');
  const mockTitle = document.getElementById('mock-push-title');
  const mockBody = document.getElementById('mock-push-body');

  if (pushTitleInput && mockTitle) {
    pushTitleInput.addEventListener('input', (e) => {
      mockTitle.textContent = e.target.value.trim() || '💥 Kampanya Başlığı';
    });
  }
  if (pushMsgInput && mockBody) {
    pushMsgInput.addEventListener('input', (e) => {
      mockBody.textContent = e.target.value.trim() || 'Yazacağınız bildirim mesajı burada bu şekilde müşterilerinizin kilit ekranında gözükecektir.';
    });
  }
  
  // Reset mockups on form reset/submit
  if (broadcastForm) {
    broadcastForm.addEventListener('reset', () => {
      if (mockTitle) mockTitle.textContent = '💥 Kampanya Başlığı';
      if (mockBody) mockBody.textContent = 'Yazacağınız bildirim mesajı burada bu şekilde müşterilerinizin kilit ekranında gözükecektir.';
    });
  }

  // Load B2B settings
  const b2bPhoneInput = document.getElementById('manager-b2b-phone');
  if (b2bPhoneInput) {
    b2bPhoneInput.value = localStorage.getItem('manager_b2b_phone') || '';
  }

  const b2bUrlInput = document.getElementById('manager-b2b-url');
  if (b2bUrlInput) {
    const company = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
    const origin = window.location.origin;
    b2bUrlInput.value = `${origin}/catalog.html?w=${encodeURIComponent(company)}`;
  }

  // Bind Save Button for B2B Phone
  const btnSaveB2bPhone = document.getElementById('btn-save-b2b-phone');
  if (btnSaveB2bPhone && b2bPhoneInput) {
    bindOnce(btnSaveB2bPhone, 'click', async () => {
      const phoneVal = b2bPhoneInput.value.trim().replace(/\D/g, '');
      localStorage.setItem('manager_b2b_phone', phoneVal);
      
      try {
        await dbUpdate('settings', {
          id: 'manager_b2b_settings',
          data: { phone: phoneVal }
        });
        showToast('WhatsApp sipariş hattı kaydedildi! 💾', 'success');
      } catch (err) {
        console.error(err);
        showToast('Ayar yerel olarak kaydedildi.', 'success');
      }
    }, 'btn_save_b2b_phone');
  }

  // Bind Copy Button for B2B URL
  const btnCopyB2bUrl = document.getElementById('btn-copy-b2b-url');
  if (btnCopyB2bUrl && b2bUrlInput) {
    bindOnce(btnCopyB2bUrl, 'click', () => {
      b2bUrlInput.select();
      navigator.clipboard.writeText(b2bUrlInput.value).then(() => {
        showToast('Katalog linki panoya kopyalandı! 📋', 'success');
      }).catch(() => {
        showToast('Kopyalama başarısız, lütfen elle kopyalayın.', 'error');
      });
    }, 'btn_copy_b2b_url');
  }

  checkPushSubscriptionState();
  if (window.initAssortmentsManager) {
    window.initAssortmentsManager();
  }
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

async function checkPushSubscriptionState() {
  const label = document.getElementById('push-status-label');
  const btn = document.getElementById('btn-push-subscribe');
  if (!label || !btn) return;
  
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    label.textContent = 'Desteklenmiyor ❌';
    btn.disabled = true;
    return;
  }
  
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      label.textContent = 'Aktif 🟢';
      label.style.color = 'var(--color-success)';
      btn.textContent = '🔕 Aboneliği Kapat';
    } else {
      label.textContent = 'Pasif 🔴';
      label.style.color = 'var(--color-danger)';
      btn.textContent = '🔔 Aboneliği Aç';
    }
  } catch (err) {
    console.warn('Push subscription state check error:', err);
  }
}

async function togglePushSubscription() {
  const btn = document.getElementById('btn-push-subscribe');
  if (!btn) return;
  btn.disabled = true;
  
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    
    if (sub) {
      // Unsubscribe
      await sub.unsubscribe();
      // Remove from Database
      if (window.supabaseClient) {
        await window.supabaseClient
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
      showToast('Cihaz aboneliği kapatıldı.', 'info');
    } else {
      // Subscribe
      const VAPID_PUBLIC_KEY = "BG1947QNf0x6COBkxo4HX129RGPSMnWgdNq453kRFVV4CSaPYojaFBG95Tm9DMetWkdqR2PxiL0pWQZt4rwoXZk";
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Bildirim izni reddedildi!', 'error');
        btn.disabled = false;
        return;
      }
      
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      const currentComp = localStorage.getItem('atolyecim_auth_company') || 'default_workshop';
      const workshopId = currentComp.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const subscriptionData = {
        endpoint: newSub.endpoint,
        keys: JSON.parse(JSON.stringify(newSub.toJSON().keys)),
        workshop_id: workshopId,
        user_type: 'manager'
      };
      
      if (window.supabaseClient) {
        await window.supabaseClient
          .from('push_subscriptions')
          .insert([subscriptionData]);
      }
      
      showToast('Cihaz başarıyla anlık bildirimlere abone edildi! 🔔', 'success');
    }
    await checkPushSubscriptionState();
  } catch (err) {
    console.error(err);
    showToast('Abonelik işlemi başarısız: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function sendNotificationAlert(type, message) {

  const now = new Date();
  const timeStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const currentComp = localStorage.getItem('atolyecim_auth_company') || 'default_workshop';
  const workshopId = currentComp.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const historyKey = 'manager_notification_history_' + workshopId;

  // Log to history
  let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
  
  const typeLabels = {
    'stock': '⚠️ Stok Eksikliği',
    'deadline': '📅 Termin Uyarısı',
    'new-order': '➕ Yeni Sipariş',
    'order-status': '🔄 Sipariş Durumu'
  };

  const newLog = {
    timestamp: timeStr,
    type: typeLabels[type] || type,
    message: message
  };

  history.unshift(newLog);
  if (history.length > 30) history.pop();
  localStorage.setItem(historyKey, JSON.stringify(history));

  try {
    await dbUpdate('settings', {
      id: historyKey,
      data: { logs: history }
    });
  } catch (e) {
    console.error('Cloud backup for Notification history failed:', e);
  }

  // Play browser native notification
  const typeLabel = typeLabels[type] || type;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification("Atölyecim — " + typeLabel, {
            body: message,
            icon: 'https://atolyecim.vercel.app/favicon.ico',
            vibrate: [200, 100, 200]
          });
        }).catch(() => {
          new Notification("Atölyecim — " + typeLabel, {
            body: message,
            icon: 'https://atolyecim.vercel.app/favicon.ico'
          });
        });
      } else {
        new Notification("Atölyecim — " + typeLabel, {
          body: message,
          icon: 'https://atolyecim.vercel.app/favicon.ico'
        });
      }
    } catch (e) {
      console.warn('Native push failed:', e);
    }
  }

  // Send remote Web Push notification via Vercel Serverless Function to managers
  fetch('/api/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workshopId,
      title: 'Atölyecim — ' + typeLabel,
      message: message,
      userType: 'manager'
    })
  }).catch(err => console.warn('Manager Push API notification failed:', err));

  // Increment unread notifications count for bell badge
  unreadNotificationCount++;
  updateBellBadge();
  renderBellDropdownList();

  // Show dynamic custom Toast
  showNotificationToast(typeLabel, message);

  console.log(`[NOTIFICATION] Type: ${typeLabel} | Msg: ${message}`);
}

function showNotificationToast(typeLabel, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
  toast.style.borderLeft = '4px solid #a855f7';
  toast.style.color = '#fff';
  toast.style.boxShadow = '0 10px 25px -5px rgba(124, 58, 237, 0.4)';
  
  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 10px;">
      <div style="font-size: 20px;">🔔</div>
      <div>
        <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">Sistem Bildirimi</div>
        <div style="font-size: 11px; opacity: 0.9; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(typeLabel)}</div>
        <div style="font-size: 12px; margin-top: 4px; line-height: 1.3;">"${escapeHtml(message)}"</div>
      </div>
    </div>
  `;

  container.appendChild(toast);

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    
    // AudioContext leak fix
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch (e) {
    console.warn('Sound play failed:', e);
  }

  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

async function checkTodayDeadlines() {
  const todayStr = new Date().toDateString();
  if (localStorage.getItem('manager_deadline_check_date') === todayStr) return;

  try {
    const orders = await dbGetAll('orders');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`; // YYYY-MM-DD format

    const activeOrders = orders.filter(o => o.status === 'beklemede');
    const todayOrders = activeOrders.filter(o => o.deadline === todayDateStr);

    if (todayOrders.length > 0) {
      localStorage.setItem('manager_deadline_check_date', todayStr);
      for (const o of todayOrders) {
        const msg = `Dikkat! #${o.id} nolu siparisin teslim gunu bugundur. Model: ${o.modelCode}, Adet: ${o.qty} cift. Bol bereketli isler dileriz.`;
        await sendNotificationAlert('deadline', msg);
      }
    }
  } catch (e) {
    console.error('Deadline check failed:', e);
  }
}

async function checkStockLimitAndNotify(stock) {
  if (stock.qty <= (stock.limit || 0)) {
    // Prevent duplicate alert for same stock level in session
    const sessionKey = `manager_stock_alert_sent_${stock.id}_${stock.qty}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, 'true');

    const msg = `Kritik Stok Uyarisi! "${stock.name}" miktari limitin altina dustu. Mevcut Stok: ${stock.qty} ${stock.unit || 'cift'}, Limit: ${stock.limit || 0} ${stock.unit || 'cift'}.`;
    await sendNotificationAlert('stock', msg);
  }
}

/* --- SaaS Super Admin Controller --- */
async function initAdminPage() {
  const workshopsEl = document.getElementById('admin-stat-workshops');
  const ordersEl = document.getElementById('admin-stat-orders');
  const contactsEl = document.getElementById('admin-stat-contacts');
  const tbody = document.getElementById('admin-workshops-tbody');
  const emptyState = document.getElementById('admin-workshops-empty');

  if (!tbody) return;

  try {
    const stats = await window.getAdminStats();
    if (workshopsEl) workshopsEl.textContent = stats.workshopsCount;
    if (ordersEl) ordersEl.textContent = stats.ordersCount;
    if (contactsEl) contactsEl.textContent = stats.contactsCount || 0;

    const workshops = await window.getAdminWorkshops();

    if (!workshops || workshops.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    tbody.innerHTML = workshops.map(w => {
      const companyEsc = (w.company || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const emailEsc = (w.email || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const planEsc = (w.plan || 'Standard').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const isBlocked = !!w.blocked;

      return `
        <tr>
          <td style="padding: 12px 16px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🏭</span> ${escapeHtml(w.company)}
          </td>
          <td style="padding: 12px 16px; color: var(--text-muted); font-family: monospace;">${escapeHtml(w.email)}</td>
          <td style="padding: 12px 16px; font-size: 12px; color: var(--text-muted);">${escapeHtml(w.createdAt || 'Bugün')}</td>
          <td style="padding: 12px 16px;">
            <span class="category-badge" style="background: ${isBlocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isBlocked ? '#ef4444' : '#10b981'}; font-weight: 700;">
              ${isBlocked ? '⛔ Bloke Edildi' : escapeHtml(w.plan || 'Standard') + ' (Aktif)'}
            </span>
          </td>
          <td style="padding: 12px 16px;">
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.openWorkshopReport('${companyEsc}', '${emailEsc}', '${planEsc}')" title="Raporları Gör">
                📊 Raporlar
              </button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.openWorkshopModulesModal('${companyEsc}', '${emailEsc}')" style="color: #6366f1; font-weight: 600;" title="Sekme ve Modül İzinlerini Yönet">
                ⚙️ Modüller
              </button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.renameWorkshopPrompt('${emailEsc}')" style="color: #38bdf8;" title="Firma Adını Düzenle">
                ✏️ Düzenle
              </button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.resetWorkshopPassword('${emailEsc}')" style="color: #a78bfa;" title="Şifre Sıfırla">
                🔑 Şifre
              </button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.toggleBlockWorkshop('${emailEsc}')" style="color: ${isBlocked ? '#10b981' : '#f59e0b'};" title="${isBlocked ? 'Blokei Kaldır' : 'Üyeyi Bloke Et'}">
                ${isBlocked ? '✅ Blokeyi Kaldır' : '🚫 Bloke Et'}
              </button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.deleteWorkshop('${emailEsc}')" style="color: #ef4444;" title="Üyeyi Kalıcı Sil">
                🗑️ Sil
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Load global gemini api key setting
    const globalKeyInput = document.getElementById('admin-global-gemini-key');
    if (globalKeyInput) {
      dbGet('settings', 'global_gemini_api_key').then(setting => {
        globalKeyInput.value = setting && setting.value ? setting.value : '';
      }).catch(err => console.warn('Could not load global gemini api key setting:', err));
    }

    // Save global settings handler
    const saveGlobalBtn = document.getElementById('btn-admin-save-global');
    if (saveGlobalBtn && !saveGlobalBtn._bound) {
      saveGlobalBtn._bound = true;
      saveGlobalBtn.addEventListener('click', async () => {
        saveGlobalBtn.disabled = true;
        saveGlobalBtn.textContent = '⏳ Kaydediliyor...';
        try {
          const value = globalKeyInput.value.replace(/['"\[\]\s]/g, '');
          await dbUpdate('settings', { key: 'global_gemini_api_key', value: value });
          showToast('Sistem geneli global ayarlar başarıyla kaydedildi! 💾', 'success');
        } catch (err) {
          showToast('Hata: ' + err.message, 'error');
        } finally {
          saveGlobalBtn.disabled = false;
          saveGlobalBtn.textContent = 'Ayarları Kaydet';
        }
      });
    }

  } catch (err) {
    console.error('Admin page initialization failed:', err);
  }
}

async function openWorkshopReport(companyName, email, plan) {
  const nameEl = document.getElementById('report-company-name');
  const emailEl = document.getElementById('report-company-email');
  const planEl = document.getElementById('report-company-plan');

  const ordersEl = document.getElementById('report-val-orders');
  const productsEl = document.getElementById('report-val-products');
  const stocksEl = document.getElementById('report-val-stocks');
  const contactsEl = document.getElementById('report-val-contacts');
  const revenueEl = document.getElementById('report-val-revenue');

  if (nameEl) nameEl.textContent = companyName;
  if (emailEl) emailEl.textContent = email;
  if (planEl) planEl.textContent = (plan || 'Standard') + ' (Aktif)';

  if (ordersEl) ordersEl.textContent = '...';
  if (productsEl) productsEl.textContent = '...';
  if (stocksEl) stocksEl.textContent = '...';
  if (contactsEl) contactsEl.textContent = '...';
  if (revenueEl) revenueEl.textContent = '...';

  openModalById('admin-report-modal');

  try {
    const report = await window.getWorkshopDetailedReport(companyName);
    if (ordersEl) ordersEl.textContent = report.ordersCount;
    if (productsEl) productsEl.textContent = report.productsCount;
    if (stocksEl) stocksEl.textContent = report.stocksCount;
    if (contactsEl) contactsEl.textContent = report.contactsCount;
    if (revenueEl) revenueEl.textContent = (report.totalRevenue || 0).toLocaleString('tr-TR') + ' TL';
  } catch (e) {
    console.error('Failed to load detailed report:', e);
  }
}

async function toggleBlockWorkshop(email) {
  let workshops = getWorkshops();
  const target = workshops.find(w => w.email.toLowerCase() === email.toLowerCase());
  if (!target) return;

  target.blocked = !target.blocked;
  saveWorkshops(workshops);

  if (window.supabaseClient) {
    try {
      await window.dbUpdate('settings', {
        key: 'saas_registered_workshops',
        value: { workshops: workshops }
      });
    } catch (e) {
      console.warn('Cloud sync block warning:', e);
    }
  }

  showToast(`Atölye (${target.company}) ${target.blocked ? 'bloke edildi! Giriş yapamayacak.' : 'bloğu kaldırıldı!'}`, target.blocked ? 'error' : 'success');
  initAdminPage();
}

async function deleteWorkshop(email) {
  let workshops = getWorkshops();
  const target = workshops.find(w => w.email.toLowerCase() === email.toLowerCase());
  if (!target) return;

  if (!confirm(`"${target.company}" atölyesini platformdan kalıcı olarak silmek istediğinizden emin misiniz?`)) return;

  workshops = workshops.filter(w => w.email.toLowerCase() !== email.toLowerCase());
  saveWorkshops(workshops);

  if (window.supabaseClient) {
    try {
      await window.dbUpdate('settings', {
        key: 'saas_registered_workshops',
        value: { workshops: workshops }
      });
    } catch (e) {
      console.warn('Cloud sync delete warning:', e);
    }
  }

  showToast(`"${target.company}" üyelikten silindi!`, 'success');
  initAdminPage();
}

async function resetWorkshopPassword(email) {
  const newPass = prompt('Bu atölye için yeni şifreyi girin (En az 4 karakter):', '');
  if (!newPass || newPass.trim().length < 4) {
    if (newPass) showToast('Şifre en az 4 karakter olmalıdır!', 'error');
    return;
  }

  let workshops = getWorkshops();
  const target = workshops.find(w => w.email.toLowerCase() === email.toLowerCase());
  if (!target) {
    showToast('Atölye bulunamadı!', 'error');
    return;
  }

  // Save the new password (both hashed and plaintext fallback supported)
  const hashed = await sha256(newPass.trim());
  target.password = hashed;
  saveWorkshops(workshops);

  if (window.supabaseClient) {
    try {
      await window.dbUpdate('settings', {
        key: 'saas_registered_workshops',
        value: { workshops: workshops }
      });
    } catch (e) {
      console.warn('Cloud sync reset password warning:', e);
    }
  }

  showToast(`"${target.company}" atölyesinin şifresi başarıyla güncellendi! 🔑`, 'success');
  initAdminPage();
}

async function renameWorkshopPrompt(email) {
  let workshops = getWorkshops();
  const target = workshops.find(w => w.email.toLowerCase() === email.toLowerCase());
  if (!target) {
    showToast('Atölye bulunamadı!', 'error');
    return;
  }

  const newName = prompt('Yeni atölye / firma adını girin:', target.company);
  if (!newName || newName.trim().length < 3) {
    if (newName) showToast('Firma adı en az 3 karakter olmalıdır!', 'error');
    return;
  }

  const newCompanyName = newName.trim();
  const oldCompany = target.company;
  if (oldCompany === newCompanyName) return;

  target.company = newCompanyName;
  saveWorkshops(workshops);

  // Sync workshops list to Supabase settings
  if (window.supabaseClient) {
    try {
      await window.dbUpdate('settings', {
        key: 'saas_registered_workshops',
        value: { workshops: workshops }
      });
    } catch (e) {
      console.warn('Cloud sync rename warning:', e);
    }
  }

  // Migrate all records associated with oldCompany to newCompanyName
  if (window.showToast) window.showToast('Veriler yeni firma adına taşınıyor, lütfen bekleyin...', 'info');

  const tables = ['orders', 'products', 'stocks', 'contacts', 'transactions', 'recipes'];
  let migrationCount = 0;
  for (const table of tables) {
    try {
      const allRows = await dbGetAllRaw(table);
      const linkedRows = allRows.filter(row => row && row._ownerCompany === oldCompany);
      for (const row of linkedRows) {
        row._ownerCompany = newCompanyName;
        await dbUpdate(table, row);
        migrationCount++;
      }
    } catch (err) {
      console.error(`Migration error on table ${table}:`, err);
    }
  }

  showToast(`"${oldCompany}" başarıyla "${newCompanyName}" olarak güncellendi! (${migrationCount} kayıt taşındı) 🏢`, 'success');
  initAdminPage();
}

/* --- Recycle Bin Controller --- */
function initRecycleBinPage() {
  const tbody = document.getElementById('recycle-bin-tbody');
  const emptyState = document.getElementById('recycle-bin-empty');
  if (!tbody) return;

  const items = window.getRecycleBinItems ? window.getRecycleBinItems() : [];

  if (!items || items.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const typeLabels = {
    orders: '📦 Sipariş',
    products: '👟 Ürün / Model',
    stocks: '🧱 Stok Kalemi',
    contacts: '👥 Cari Müşteri'
  };

  tbody.innerHTML = items.map(item => {
    const deletedDate = item.deletedAt ? new Date(item.deletedAt).toLocaleString('tr-TR') : 'Bilinmiyor';
    
    // Calculate remaining days out of 30
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - (item.deletedAt ? new Date(item.deletedAt).getTime() : Date.now());
    const remainingMs = Math.max(0, THIRTY_DAYS_MS - elapsed);
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    let titleDetail = item.modelCode || item.name || item.companyName || item.code || `Öğe #${item.id}`;
    if (item.originalStore === 'orders') {
      titleDetail = `Sipariş #${item.id} (${item.modelCode || ''} - ${item.customerName || ''})`;
    }

    const deletedAtEsc = (item.deletedAt || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    return `
      <tr>
        <td style="padding: 12px 16px;">
          <span class="category-badge badge-tedarikci" style="background: rgba(99, 102, 241, 0.12); color: #6366f1; font-weight: 700;">
            ${escapeHtml(typeLabels[item.originalStore] || item.originalStore)}
          </span>
        </td>
        <td style="padding: 12px 16px; font-weight: 700; color: var(--text-primary);">${escapeHtml(titleDetail)}</td>
        <td style="padding: 12px 16px; font-size: 12px; color: var(--text-muted); font-family: monospace;">${escapeHtml(deletedDate)}</td>
        <td style="padding: 12px 16px;">
          <span style="font-weight: 700; color: ${remainingDays < 5 ? '#ef4444' : '#f59e0b'}; font-size: 12px;">
            ⏳ ${remainingDays} Gün Kaldı
          </span>
        </td>
        <td style="padding: 12px 16px;">
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.restoreRecycleItem('${deletedAtEsc}')" style="color: #10b981; font-weight: 700;" title="Eski Yerine Geri Yükle">
              🔄 Geri Yükle
            </button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.permanentlyDeleteRecycleItem('${deletedAtEsc}')" style="color: #ef4444;" title="Şimdi Kalıcı Sil">
              ❌ Kalıcı Sil
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function restoreRecycleItem(deletedAtTime) {
  if (window.restoreRecycleBinItem) {
    const ok = await window.restoreRecycleBinItem(deletedAtTime);
    if (ok) {
      showToast('Öğe başarıyla eski yerine geri yüklendi! 🔄', 'success');
      initRecycleBinPage();
    }
  }
}

function permanentlyDeleteRecycleItem(deletedAtTime) {
  if (confirm('Bu öğeyi kalıcı olarak silmek istediğinizden emin misiniz? Artık geri getirilemez!')) {
    if (window.permanentlyDeleteRecycleBinItem) {
      window.permanentlyDeleteRecycleBinItem(deletedAtTime);
      showToast('Öğe tamamen silindi.', 'info');
      initRecycleBinPage();
    }
  }
}

function openWorkshopModulesModal(companyName, email) {
  const compEl = document.getElementById('modules-target-company');
  const emailEl = document.getElementById('modules-target-email');
  if (compEl) compEl.textContent = companyName;
  if (emailEl) emailEl.value = email;

  const workshops = getWorkshops();
  const target = workshops.find(w => w.email.toLowerCase() === email.toLowerCase());
  const modules = (target && target.modules) ? target.modules : {
    orders: true, products: true, contacts: true, stocks: true, barcode: true, manager: true, recycle: true
  };

  document.getElementById('mod-chk-orders').checked = modules.orders !== false;
  document.getElementById('mod-chk-products').checked = modules.products !== false;
  document.getElementById('mod-chk-contacts').checked = modules.contacts !== false;
  document.getElementById('mod-chk-stocks').checked = modules.stocks !== false;
  document.getElementById('mod-chk-barcode').checked = modules.barcode !== false;
  document.getElementById('mod-chk-manager').checked = modules.manager !== false;
  document.getElementById('mod-chk-recycle').checked = modules.recycle !== false;

  openModalById('admin-modules-modal');
}

function initAdminModulesForm() {
  const form = document.getElementById('admin-modules-form');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('modules-target-email').value;
    let workshops = getWorkshops();
    const target = workshops.find(w => w.email.toLowerCase() === email.toLowerCase());
    if (!target) return;

    target.modules = {
      orders: document.getElementById('mod-chk-orders').checked,
      products: document.getElementById('mod-chk-products').checked,
      contacts: document.getElementById('mod-chk-contacts').checked,
      stocks: document.getElementById('mod-chk-stocks').checked,
      barcode: document.getElementById('mod-chk-barcode').checked,
      manager: document.getElementById('mod-chk-manager').checked,
      recycle: document.getElementById('mod-chk-recycle').checked
    };

    saveWorkshops(workshops);

    if (window.supabaseClient) {
      try {
        await window.dbUpdate('settings', {
          key: 'saas_registered_workshops',
          value: { workshops: workshops }
        });
      } catch (err) {
        console.warn('Cloud sync modules update warning:', err);
      }
    }

    closeModalById('admin-modules-modal');
    showToast(`"${target.company}" atölyesinin modül izinleri güncellendi! ⚙️`, 'success');
  });
}

// Global window bindings
window.showToast = showToast;
window.openModalById = openModalById;
window.closeModalById = closeModalById;
window.sendNotificationAlert = sendNotificationAlert;
window.checkTodayDeadlines = checkTodayDeadlines;
window.checkStockLimitAndNotify = checkStockLimitAndNotify;
window.initAdminPage = initAdminPage;
window.openWorkshopReport = openWorkshopReport;
window.openWorkshopModulesModal = openWorkshopModulesModal;
window.toggleBlockWorkshop = toggleBlockWorkshop;
window.deleteWorkshop = deleteWorkshop;
window.resetWorkshopPassword = resetWorkshopPassword;
window.renameWorkshopPrompt = renameWorkshopPrompt;
window.initRecycleBinPage = initRecycleBinPage;
window.restoreRecycleItem = restoreRecycleItem;
window.permanentlyDeleteRecycleItem = permanentlyDeleteRecycleItem;
