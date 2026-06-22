/* =========================================
   ATÖLYECİM — Dashboard Modülü
   ========================================= */

const Dashboard = {
  async render() {
    await this.updateFinancialCards();
    await this.renderCategoryChart();
    await this.updateStagesWidget();
    await this.updateWeeklyProgress();
    this.updateDate();
    this.bindEvents();
  },

  updateDate() {
    const el = document.getElementById('header-date');
    if (!el) return;
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.textContent = now.toLocaleDateString('tr-TR', options);
  },

  async updateFinancialCards() {
    const transactions = await dbGetAll('transactions');
    const products = await dbGetAll('products');

    let totalReceivable = 0;
    let totalPayable = 0;

    transactions.forEach(tx => {
      if (tx.type === 'alacak') totalReceivable += tx.amount;
      else if (tx.type === 'borc') totalPayable += tx.amount;
      else if (tx.type === 'tahsilat') totalReceivable -= tx.amount;
      else if (tx.type === 'odeme') totalPayable -= tx.amount;
    });

    const netBalance = totalReceivable - totalPayable;

    this.animateValue('total-receivable', totalReceivable);
    this.animateValue('total-payable', totalPayable);
    this.animateValue('net-balance', netBalance);

    const totalProductsEl = document.getElementById('total-products');
    if (totalProductsEl) {
      totalProductsEl.textContent = products.length;
    }
  },

  animateValue(elementId, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const formatted = '₺' + targetValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    el.textContent = formatted;

    if (elementId === 'net-balance') {
      el.className = 'stat-value';
      if (targetValue > 0) el.style.color = 'var(--color-success)';
      else if (targetValue < 0) el.style.color = 'var(--color-danger)';
      else el.style.color = 'var(--color-info)';
    }
  },

  async renderCategoryChart() {
    const products = await dbGetAll('products');
    const canvas = document.getElementById('category-chart');
    const legend = document.getElementById('chart-legend');
    const emptyState = document.getElementById('chart-empty');

    if (!canvas || !legend) return;

    const counts = { 'Erkek': 0, 'Kadın': 0, 'Çocuk': 0 };
    products.forEach(p => {
      if (counts.hasOwnProperty(p.category)) counts[p.category]++;
    });

    const total = counts['Erkek'] + counts['Kadın'] + counts['Çocuk'];

    if (total === 0) {
      canvas.style.display = 'none';
      legend.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    canvas.style.display = 'block';
    legend.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    const colors = {
      'Erkek': { fill: '#3b82f6', label: '👔 Erkek' },
      'Kadın': { fill: '#ec4899', label: '👠 Kadın' },
      'Çocuk': { fill: '#fbbf24', label: '🧒 Çocuk' }
    };

    // Draw donut chart
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = 110;
    const innerRadius = 70;
    let startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, size, size);

    const categories = ['Erkek', 'Kadın', 'Çocuk'];
    categories.forEach(cat => {
      const value = counts[cat];
      if (value === 0) return;
      const sliceAngle = (value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius, startAngle, endAngle);
      ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[cat].fill;
      ctx.fill();

      startAngle = endAngle;
    });

    // Center text
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 8);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('Toplam', cx, cy + 16);

    // Update legend
    legend.innerHTML = categories.map(cat => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${colors[cat].fill}"></div>
        <span class="legend-label">${colors[cat].label}</span>
        <span class="legend-value">${counts[cat]}</span>
      </div>
    `).join('');
  },

  async updateStagesWidget() {
    const products = await dbGetAll('products');
    const stages = ['kesim', 'saya', 'montaj', 'paketleme'];
    const stageCounts = {};
    stages.forEach(s => stageCounts[s] = 0);

    products.forEach(p => {
      if (stageCounts.hasOwnProperty(p.stage)) stageCounts[p.stage]++;
    });

    const total = products.length || 1;

    stages.forEach(stage => {
      const bar = document.getElementById('stage-bar-' + stage);
      const count = document.getElementById('stage-count-' + stage);
      if (bar) {
        const pct = (stageCounts[stage] / total) * 100;
        setTimeout(() => { bar.style.width = pct + '%'; }, 100);
      }
      if (count) count.textContent = stageCounts[stage];
    });
  },

  async updateWeeklyProgress() {
    const savedTarget = await getSetting('weeklyTarget');
    const savedCompleted = await getSetting('weeklyCompleted');

    const target = savedTarget || 100;
    const completed = savedCompleted || 0;
    const pct = Math.min((completed / target) * 100, 100);

    const targetInput = document.getElementById('weekly-target-input');
    const fillBar = document.getElementById('weekly-progress-fill');
    const completedEl = document.getElementById('weekly-completed');
    const targetDisplay = document.getElementById('weekly-target-display');
    const pctEl = document.getElementById('weekly-percentage');

    if (targetInput) targetInput.value = target;
    if (completedEl) completedEl.textContent = completed;
    if (targetDisplay) targetDisplay.textContent = target;
    if (pctEl) pctEl.textContent = `(%${Math.round(pct)})`;
    if (fillBar) {
      setTimeout(() => { fillBar.style.width = pct + '%'; }, 100);
    }
  },

  bindEvents() {
    const setBtn = document.getElementById('set-weekly-target');
    if (setBtn && !setBtn._bound) {
      setBtn._bound = true;
      setBtn.addEventListener('click', async () => {
        const input = document.getElementById('weekly-target-input');
        const val = parseInt(input.value);
        if (val > 0) {
          await setSetting('weeklyTarget', val);
          await this.updateWeeklyProgress();
          showToast('Haftalık hedef güncellendi!', 'success');
        }
      });
    }
  }
};
