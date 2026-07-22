/* =========================================
   ATÖLYECİM — Dashboard Modülü (Premium ERP)
   ========================================= */

const Dashboard = {
  currentPeriod: 'all',

  async render() {
    this.updateGreetingAndDate();
    await this.updateFinancialCards();
    await this.updateOrderStatsCards();
    await this.updateModelAnalytics();
    await this.updateDonutChart();
    await this.updateInventoryStats();
    await this.updateWeeklyProgress();
    this.bindEvents();
  },

  /* ─── Greeting & Date ─── */
  updateGreetingAndDate() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'İyi günler 👋';
    if (hour >= 5 && hour < 12) greeting = 'Günaydın 🌅';
    else if (hour >= 12 && hour < 18) greeting = 'İyi öğleden sonralar ☀️';
    else if (hour >= 18 && hour < 22) greeting = 'İyi akşamlar 🌆';
    else greeting = 'İyi geceler 🌙';

    const greetEl = document.getElementById('db-greeting');
    if (greetEl) greetEl.textContent = greeting;

    const dateEl = document.getElementById('header-date');
    if (dateEl) {
      const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('tr-TR', opts);
    }
  },

  /* ─── Order Status Cards ─── */
  async updateOrderStatsCards() {
    try {
      const orders = await dbGetAll('orders');
      const cutoff = this._getCutoff();

      const filtered = cutoff > 0
        ? orders.filter(o => {
            const t = new Date(o.date || o.createdAt || 0).getTime();
            return t >= cutoff;
          })
        : orders;

      this._setText('total-orders-stat', filtered.length);
      this._setText('pending-orders-stat',   filtered.filter(o => o.status === 'beklemede').length);
      this._setText('completed-orders-stat', filtered.filter(o => o.status === 'tamamlandi').length);
      this._setText('kargoda-orders-stat',   filtered.filter(o => o.status === 'kargoda').length);
      this._setText('iptal-orders-stat',     filtered.filter(o => o.status === 'iptal').length);
      this._setText('donut-total-label', orders.length);
      this._setText('kpi-orders-label', this._periodLabel());
    } catch (err) {
      console.warn('Sipariş istatistikleri yüklenemedi:', err);
    }
  },

  /* ─── Financial Cards ─── */
  async updateFinancialCards() {
    try {
      const transactions = await dbGetAll('transactions');
      let totalReceivable = 0;
      let totalPayable = 0;

      transactions.filter(tx => !tx.isPackaging).forEach(tx => {
        if (tx.type === 'alacak')        totalReceivable += Number(tx.amount) || 0;
        else if (tx.type === 'borc')     totalPayable    += Number(tx.amount) || 0;
        else if (tx.type === 'tahsilat') totalReceivable -= Number(tx.amount) || 0;
        else if (tx.type === 'odeme')    totalPayable    -= Number(tx.amount) || 0;
      });

      const netBalance = totalReceivable - totalPayable;

      this._setMoney('total-receivable', totalReceivable);
      this._setMoney('total-payable', totalPayable);
      this._setMoney('net-balance', netBalance);

      const netEl = document.getElementById('net-balance');
      if (netEl) {
        netEl.style.color = netBalance > 0
          ? 'var(--color-success)'
          : netBalance < 0 ? 'var(--color-danger)' : 'var(--color-info)';
      }
    } catch (err) {
      console.warn('Finansal kartlar güncellenemedi:', err);
    }
  },

  /* ─── Inventory Stats ─── */
  async updateInventoryStats() {
    try {
      const products = await dbGetAll('products');
      this._setText('total-products', products.length);

      let lowStock = 0;
      products.forEach(p => {
        if (!p.sizes) return;
        const sizes = typeof p.sizes === 'string' ? JSON.parse(p.sizes) : p.sizes;
        const hasLow = Object.values(sizes).some(q => Number(q) <= 5 && Number(q) >= 0);
        if (hasLow) lowStock++;
      });
      this._setText('low-stock-count', lowStock);
    } catch (err) {
      console.warn('Stok istatistikleri yüklenemedi:', err);
    }
  },

  /* ─── Model Analytics ─── */
  async updateModelAnalytics() {
    try {
      const orders = await dbGetAll('orders');
      const cutoff = this._getCutoff();

      const validOrders = orders.filter(o => {
        if (!o || o.status === 'iptal') return false;
        if (cutoff > 0) {
          const t = new Date(o.date || o.createdAt || 0).getTime();
          if (t < cutoff) return false;
        }
        return true;
      });

      const modelMap = {};
      let totalQty = 0;
      let totalRevenue = 0;

      validOrders.forEach(o => {
        const code = (o.modelCode || 'KODSUZ').toUpperCase().trim();
        const qty  = Number(o.qty) || 0;
        const rev  = qty * (Number(o.price) || 0);
        if (!modelMap[code]) modelMap[code] = { modelCode: code, qty: 0, revenue: 0 };
        modelMap[code].qty += qty;
        modelMap[code].revenue += rev;
        totalQty += qty;
        totalRevenue += rev;
      });

      const sorted = Object.values(modelMap).sort((a, b) => b.qty - a.qty);

      this._setText('analytics-period-qty', `${totalQty.toLocaleString('tr-TR')} Çift`);
      const revEl = document.getElementById('analytics-period-revenue');
      if (revEl) revEl.textContent = `\u20BA${totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      this._setText('analytics-model-count', `${sorted.length} Model`);
      this._setText('analytics-top-model', sorted.length > 0 ? sorted[0].modelCode : '\u2014');
      this._setText('kpi-revenue-trend', this._periodLabel());
      this._setText('kpi-qty-label', `${totalQty.toLocaleString('tr-TR')} adet toplam`);

      this._renderBarChart(sorted.slice(0, 10));
      this._renderModelTable(sorted, totalQty, totalRevenue);
    } catch (err) {
      console.warn('Model satış analizi güncellenemedi:', err);
    }
  },

  /* ─── Bar Chart Canvas ─── */
  _renderBarChart(models) {
    const canvas = document.getElementById('model-bar-chart');
    const empty  = document.getElementById('model-bar-empty');
    if (!canvas) return;

    if (models.length === 0) {
      canvas.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }
    canvas.style.display = 'block';
    if (empty) empty.style.display = 'none';

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement ? (canvas.parentElement.clientWidth || 600) : 600;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const padL = 48, padR = 16, padT = 16, padB = 40;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const maxQty = models[0].qty || 1;
    const barGap = 8;
    const barW = Math.max(10, (chartW - barGap * (models.length - 1)) / models.length);

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padT + chartH - (i / 4) * chartH;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,0.7)';
      ctx.font = '10px Inter,sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.round((i / 4) * maxQty), padL - 6, y);
    }

    // Bars
    models.forEach((m, i) => {
      const x = padL + i * (barW + barGap);
      const bH = (m.qty / maxQty) * chartH;
      const y = padT + chartH - bH;

      const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
      grad.addColorStop(0, 'rgba(99,102,241,0.95)');
      grad.addColorStop(1, 'rgba(139,92,246,0.4)');
      ctx.fillStyle = grad;

      const r = Math.min(4, barW / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, padT + chartH);
      ctx.lineTo(x, padT + chartH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();

      // Value label
      if (bH > 18) {
        ctx.fillStyle = 'rgba(248,250,252,0.85)';
        ctx.font = 'bold 11px Inter,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(m.qty, x + barW / 2, y - 2);
      }

      // X label
      ctx.fillStyle = 'rgba(148,163,184,0.8)';
      ctx.font = '9px Inter,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const lbl = m.modelCode.length > 8 ? m.modelCode.substring(0, 7) + '\u2026' : m.modelCode;
      ctx.fillText(lbl, x + barW / 2, padT + chartH + 6);
    });
  },

  /* ─── Donut Chart ─── */
  async updateDonutChart() {
    try {
      const orders = await dbGetAll('orders');
      const canvas = document.getElementById('category-chart');
      const legend = document.getElementById('chart-legend');
      const emptyEl = document.getElementById('chart-empty');
      if (!canvas) return;

      const statusCfg = [
        { key: 'beklemede',  label: 'Beklemede',  color: '#f59e0b' },
        { key: 'tamamlandi', label: 'Tamamlanan', color: '#10b981' },
        { key: 'kargoda',    label: 'Kargoda',    color: '#6366f1' },
        { key: 'iptal',      label: '\u0130ptal',  color: '#ef4444' },
      ];

      const counts = {};
      statusCfg.forEach(s => { counts[s.key] = 0; });
      orders.forEach(o => {
        if (o.status && counts[o.status] !== undefined) counts[o.status]++;
        else counts['beklemede'] = (counts['beklemede'] || 0) + 1;
      });

      const total = orders.length;
      this._setText('donut-total-label', total);

      if (total === 0) {
        canvas.style.display = 'none';
        if (legend) legend.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        return;
      }
      canvas.style.display = 'block';
      if (legend) legend.style.display = 'flex';
      if (emptyEl) emptyEl.style.display = 'none';

      const dpr = window.devicePixelRatio || 1;
      const size = 180;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2, cy = size / 2;
      const outerR = 78, innerR = 52;
      let startA = -Math.PI / 2;

      statusCfg.forEach(s => {
        const val = counts[s.key];
        if (!val) return;
        const sliceA = (val / total) * 2 * Math.PI;
        const endA = startA + sliceA;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startA, endA);
        ctx.arc(cx, cy, innerR, endA, startA, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        startA = endA;
      });

      if (legend) {
        legend.className = 'db-legend';
        legend.innerHTML = statusCfg.map(s => {
          const cnt = counts[s.key];
          if (!cnt) return '';
          const pct = ((cnt / total) * 100).toFixed(0);
          return `
            <div class="db-legend-item">
              <div class="db-legend-dot" style="background:${s.color}"></div>
              <span class="db-legend-label">${s.label}</span>
              <span class="db-legend-value">${cnt} <small style="color:var(--text-muted);font-weight:400">(${pct}%)</small></span>
            </div>`;
        }).join('');
      }
    } catch (err) {
      console.warn('Donut chart güncellenemedi:', err);
    }
  },

  /* ─── Model Table ─── */
  _renderModelTable(sorted, totalQty) {
    const tbody = document.getElementById('analytics-models-tbody');
    if (!tbody) return;

    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">Seçili dönemde sipariş verisi bulunamadı.</td></tr>`;
      return;
    }

    const maxQty = sorted[0].qty || 1;
    tbody.innerHTML = sorted.map((m, i) => {
      const pct    = totalQty > 0 ? ((m.qty / totalQty) * 100).toFixed(1) : '0';
      const barPct = Math.min((m.qty / maxQty) * 100, 100);
      let rankClass = '', rankLabel = `#${i + 1}`;
      if (i === 0) { rankClass = 'db-rank-1'; rankLabel = '\uD83E\uDD47'; }
      else if (i === 1) { rankClass = 'db-rank-2'; rankLabel = '\uD83E\uDD48'; }
      else if (i === 2) { rankClass = 'db-rank-3'; rankLabel = '\uD83E\uDD49'; }

      return `
        <tr>
          <td><span class="db-rank ${rankClass}">${rankLabel}</span></td>
          <td><strong>${m.modelCode}</strong></td>
          <td style="text-align:center;color:var(--accent-primary);font-weight:700">${m.qty.toLocaleString('tr-TR')} çift</td>
          <td style="text-align:right;color:#10b981;font-weight:700">\u20BA${m.revenue.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td style="text-align:center;color:var(--text-muted);font-weight:600">%${pct}</td>
          <td><div class="db-mini-bar-wrap"><div class="db-mini-bar" style="width:${barPct}%"></div></div></td>
        </tr>`;
    }).join('');
  },

  /* ─── Weekly Progress ─── */
  async updateWeeklyProgress() {
    try {
      const target    = (await getSetting('weeklyTarget'))    || 100;
      const completed = (await getSetting('weeklyCompleted')) || 0;
      const pct = Math.min((completed / target) * 100, 100);

      const ti = document.getElementById('weekly-target-input');
      const fb = document.getElementById('weekly-progress-fill');
      const ce = document.getElementById('weekly-completed');
      const td = document.getElementById('weekly-target-display');
      const pe = document.getElementById('weekly-percentage');

      if (ti) ti.value = target;
      if (ce) ce.textContent = completed;
      if (td) td.textContent = target;
      if (pe) pe.textContent = `%${Math.round(pct)}`;
      if (fb) setTimeout(() => { fb.style.width = pct + '%'; }, 150);
    } catch (err) {
      console.warn('Haftalık hedef güncellenemedi:', err);
    }
  },

  /* ─── Events ─── */
  bindEvents() {
    // KPI Card Click Navigation
    const cards = {
      '.kpi-receivable': 'contacts',
      '.kpi-payable': 'contacts',
      '.kpi-revenue': 'contacts',
      '.kpi-orders': 'orders',
      '.kpi-qty': 'orders'
    };

    Object.entries(cards).forEach(([selector, pageName]) => {
      const cardEl = document.querySelector(selector);
      if (cardEl && !cardEl._clickBound) {
        cardEl._clickBound = true;
        cardEl.addEventListener('click', () => {
          const navItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
          if (navItem) {
            navItem.click();
          }
        });
      }
    });

    const setBtn = document.getElementById('set-weekly-target');
    if (setBtn && !setBtn._dashBound) {
      setBtn._dashBound = true;
      setBtn.addEventListener('click', async () => {
        const input = document.getElementById('weekly-target-input');
        const val = parseInt(input.value, 10);
        if (val > 0) {
          await setSetting('weeklyTarget', val);
          await this.updateWeeklyProgress();
          showToast('Haftalık hedef güncellendi!', 'success');
        }
      });
    }

    const periodGroup = document.getElementById('analytics-period-selector');
    if (periodGroup && !periodGroup._dashBound) {
      periodGroup._dashBound = true;
      periodGroup.querySelectorAll('.db-period-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          periodGroup.querySelectorAll('.db-period-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentPeriod = btn.dataset.period || 'all';
          await this.updateOrderStatsCards();
          await this.updateModelAnalytics();
        });
      });
    }
  },

  /* ─── Helpers ─── */
  _getCutoff() {
    const now = Date.now();
    if (this.currentPeriod === '1m')  return now - 30  * 86400000;
    if (this.currentPeriod === '3m')  return now - 90  * 86400000;
    if (this.currentPeriod === '6m')  return now - 180 * 86400000;
    if (this.currentPeriod === '12m') return now - 365 * 86400000;
    return 0;
  },
  _periodLabel() {
    const map = { 'all': 'T\u00fcm zamanlar', '1m': 'Son 1 ay', '3m': 'Son 3 ay', '6m': 'Son 6 ay', '12m': 'Son 1 y\u0131l' };
    return map[this.currentPeriod] || '';
  },
  _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; },
  _setMoney(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = '\u20BA' + Math.abs(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
};

window.Dashboard = Dashboard;
