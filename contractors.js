/* =========================================
   ATÖLYECİM — Fason Takip & Asorti Şablonları Modülü
   ========================================= */

import { escapeHtml, bindOnce, generateId, formatMoney } from './utils.js';

console.log('[contractors.js] Module loaded ✓');

const symbols = { TRY: '₺', USD: '$', EUR: '€' };

function formatMultiCurrency(balances) {
  if (!balances) return '₺0,00';
  const parts = [];
  // Sort currencies to show TRY first, then USD, then EUR
  const order = ['TRY', 'USD', 'EUR'];
  order.forEach(curr => {
    const amt = parseFloat(balances[curr] || 0);
    if (Math.abs(amt) > 0.009) {
      parts.push(formatMoney(amt, symbols[curr] || curr));
    }
  });
  return parts.length > 0 ? parts.join(' | ') : '₺0,00';
}

// Global scope bindings for page navigation
const Contractors = {
  activeContractorId: null,

  async render() {
    console.log('[Contractors] render() called');
    try {
      await this.loadContractors();
    } catch(err) {
      console.error('[Contractors] render error:', err);
    }
  },

  async loadContractors() {
    const tableBody = document.getElementById('contractors-tbody');
    const emptyState = document.getElementById('contractors-empty');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    try {
      let contractors = await window.dbGetAll('contractors');
      const jobs = await window.dbGetAll('contractor_jobs');
      const txs = await window.dbGetAll('contractor_transactions');

      const searchVal = document.getElementById('search-contractors')?.value?.toLowerCase().trim() || '';
      if (searchVal) {
        contractors = contractors.filter(c => {
          const roleNames = {
            sayaci: 'Sayacı (Dikiş)',
            montajci: 'Montajcı (Taban/Kalıp)',
            kesimci: 'Kesimci (Kesim)',
            fason_kesim: 'Fason Kesim Atölyesi',
            fason_saya: 'Fason Saya Atölyesi',
            fason_taban: 'Fason Taban/Montaj Atölyesi',
            fason_paket: 'Paketleme/Temizlik'
          };
          const roleName = (roleNames[c.role] || c.role || '').toLowerCase();
          
          return (c.name || '').toLowerCase().includes(searchVal) ||
                 (c.phone || '').toLowerCase().includes(searchVal) ||
                 roleName.includes(searchVal);
        });
      }

      if (!contractors || contractors.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      contractors.forEach(c => {
        // Calculate dynamic balances per contractor
        const cJobs = jobs.filter(j => j.contractorId === c.id);
        const cTxs = txs.filter(t => t.contractorId === c.id);

        const balances = { TRY: 0, USD: 0, EUR: 0 };
        const hakedis = { TRY: 0, USD: 0, EUR: 0 };
        const odenen = { TRY: 0, USD: 0, EUR: 0 };

        // Process jobs (hakedis)
        cJobs.forEach(j => {
          const totalLabor = parseFloat(j.qty || 0) * parseFloat(j.laborPrice || 0);
          const curr = j.currency || 'TRY';
          hakedis[curr] = (hakedis[curr] || 0) + totalLabor;
          balances[curr] = (balances[curr] || 0) + totalLabor; // Increases what we owe the contractor
        });

        // Process transactions (payments/hakedis adjustments)
        cTxs.forEach(t => {
          const amt = parseFloat(t.amount || 0);
          const curr = t.currency || 'TRY';
          if (t.type === 'odeme') {
            odenen[curr] = (odenen[curr] || 0) + amt;
            balances[curr] = (balances[curr] || 0) - amt; // Decreases what we owe
          } else if (t.type === 'hakedis') {
            hakedis[curr] = (hakedis[curr] || 0) + amt;
            balances[curr] = (balances[curr] || 0) + amt;
          }
        });

        const roleNames = {
          sayaci: 'Sayacı (Dikiş)',
          montajci: 'Montajcı (Taban/Kalıp)',
          kesimci: 'Kesimci (Kesim)',
          fason_paket: 'Paketleme/Temizlik',
          diger: 'Diğer'
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(c.name)}</div>
          </td>
          <td>
            <span class="category-badge badge-tedarikci" style="background: rgba(99,102,241,0.1); color: var(--text-accent);">${roleNames[c.role] || 'Fason'}</span>
          </td>
          <td>${escapeHtml(c.phone || '-')}</td>
          <td style="font-weight: 600;">${formatMultiCurrency(hakedis)}</td>
          <td style="font-weight: 600; color: var(--color-success);">${formatMultiCurrency(odenen)}</td>
          <td style="font-weight: 800; color: ${this.hasNegativeBalance(balances) ? 'var(--color-success)' : 'var(--color-danger)'};">
            ${formatMultiCurrency(balances)}
          </td>
          <td>
            <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
              <button class="btn-icon success btn-c-wa" data-id="${c.id}" title="Ustayla WhatsApp'ta Görüş" style="color: #25d366; background: rgba(37,211,102,0.12); border: 1px solid rgba(37,211,102,0.25); cursor: pointer; padding: 4px 6px;">📲</button>
              <button class="btn btn-sm btn-secondary btn-c-ledger" data-id="${c.id}" style="padding: 4px 10px;">📊 Ekstre</button>
              <button class="btn btn-sm btn-ghost btn-c-delete" data-id="${c.id}" style="color: var(--color-danger); border-color: rgba(239,68,68,0.2); padding: 4px 8px;">Sil</button>
            </div>
          </td>
        `;

        tableBody.appendChild(tr);
      });

      this.bindTableEvents();

    } catch (err) {
      console.error('Load contractors error:', err);
    }
  },

  hasNegativeBalance(balances) {
    // If we have negative balance, it means we overpaid (good for contractor, success color for us)
    return Object.values(balances).some(v => v < -0.01);
  },

  async calculateBalance(contractorId) {
    const jobs = await window.dbGetAll('contractor_jobs');
    const txs = await window.dbGetAll('contractor_transactions');
    const cJobs = jobs.filter(j => j.contractorId === contractorId);
    const cTxs = txs.filter(t => t.contractorId === contractorId);
    
    let total = 0;
    cJobs.forEach(j => total += (parseFloat(j.qty || 0) * parseFloat(j.laborPrice || 0)));
    cTxs.forEach(t => {
      if (t.type === 'odeme') total -= parseFloat(t.amount || 0);
      else if (t.type === 'hakedis') total += parseFloat(t.amount || 0);
    });
    return total;
  },

  bindTableEvents() {
    document.querySelectorAll('.btn-c-wa').forEach(btn => {
      bindOnce(btn, 'click', async () => {
        const id = parseInt(btn.dataset.id);
        const cont = await window.dbGet('contractors', id);
        if (cont && window.WhatsAppManager) {
          const compName = window.WhatsAppManager.getCompanyName();
          let balanceText = '';
          if (this.calculateBalance) {
            const bal = await this.calculateBalance(id);
            balanceText = `\n📊 *Güncel Hakediş Bakiyesi:* ${bal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`;
          }
          const msg = `👞 *${compName.toUpperCase()} — FASON BİLGİLENDİRME*\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `👤 *Usta / Fasoncu:* ${cont.name}${balanceText}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `_İyi çalışmalar dileriz._`;
          window.WhatsAppManager.openModal({
            title: '🧵 Fasoncu WhatsApp İletişim',
            phone: cont.phone || '',
            recipientName: cont.name,
            defaultTemplateKey: 'cont_info',
            templates: [{ key: 'cont_info', label: '💬 Genel Bilgi / Bakiye' }],
            templateTexts: { cont_info: msg },
            data: cont
          });
        }
      }, 'btn_c_wa_' + btn.dataset.id);
    });

    document.querySelectorAll('.btn-c-ledger').forEach(btn => {
      bindOnce(btn, 'click', () => {
        const id = parseInt(btn.dataset.id);
        this.openLedgerModal(id);
      }, 'btn_c_ledger_' + btn.dataset.id);
    });

    document.querySelectorAll('.btn-c-delete').forEach(btn => {
      bindOnce(btn, 'click', async () => {
        const id = parseInt(btn.dataset.id);
        if (confirm('Bu fason ustasını silmek istediğinizden emin misiniz? Tüm iş geçmişi ve hakediş hareketleri silinecektir!')) {
          await this.deleteContractor(id);
        }
      }, 'btn_c_delete_' + btn.dataset.id);
    });
  },

  async deleteContractor(id) {
    try {
      // Cascade delete jobs and transactions in parallel
      const [jobs, txs] = await Promise.all([
        window.dbGetAll('contractor_jobs'),
        window.dbGetAll('contractor_transactions')
      ]);

      const targetJobIds = jobs.filter(job => job.contractorId === id).map(j => j.id);
      const targetTxIds = txs.filter(tx => tx.contractorId === id).map(t => t.id);

      await Promise.all([
        window.dbDelete('contractors', id),
        targetJobIds.length > 0 ? (window.dbDeleteMany ? window.dbDeleteMany('contractor_jobs', targetJobIds) : Promise.all(targetJobIds.map(jid => window.dbDelete('contractor_jobs', jid)))) : Promise.resolve(),
        targetTxIds.length > 0 ? (window.dbDeleteMany ? window.dbDeleteMany('contractor_transactions', targetTxIds) : Promise.all(targetTxIds.map(tid => window.dbDelete('contractor_transactions', tid)))) : Promise.resolve()
      ]);

      window.showToast('Fason usta ve tüm kayıtları silindi.', 'success');
      await this.loadContractors();
    } catch (err) {
      console.error(err);
      window.showToast('Silme işlemi başarısız.', 'error');
    }
  },

  async openLedgerModal(id) {
    this.activeContractorId = id;
    const modal = document.getElementById('contractor-ledger-modal');
    if (!modal) return;

    try {
      const c = await window.dbGet('contractors', id);
      if (!c) return;

      document.getElementById('contractor-ledger-title').textContent = `${c.name} - Hesap Ekstresi 🧵`;

      const jobs = await window.dbGetAll('contractor_jobs');
      const txs = await window.dbGetAll('contractor_transactions');

      const cJobs = jobs.filter(j => j.contractorId === id);
      const cTxs = txs.filter(t => t.contractorId === id);

      // Combine jobs and payments chronologically
      const ledgerEntries = [];

      cJobs.forEach(j => {
        ledgerEntries.push({
          id: j.id,
          type: 'job',
          date: j.date || new Date().toISOString().split('T')[0],
          description: `İş Verildi: ${j.modelCode} (${j.qty} Çift - Birim: ${formatMoney(j.laborPrice, j.currency)})`,
          hakedis: parseFloat(j.qty || 0) * parseFloat(j.laborPrice || 0),
          odenen: 0,
          currency: j.currency || 'TRY',
          rawDate: j.date || ''
        });
      });

      cTxs.forEach(t => {
        ledgerEntries.push({
          id: t.id,
          type: 'tx',
          date: t.date || new Date().toISOString().split('T')[0],
          description: t.description || (t.type === 'odeme' ? 'Ödeme yapıldı' : 'Hakediş ayarı'),
          hakedis: t.type === 'hakedis' ? parseFloat(t.amount || 0) : 0,
          odenen: t.type === 'odeme' ? parseFloat(t.amount || 0) : 0,
          currency: t.currency || 'TRY',
          rawDate: t.date || ''
        });
      });

      // Sort by date
      ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate totals and running balances
      const totalHakedis = { TRY: 0, USD: 0, EUR: 0 };
      const totalOdenen = { TRY: 0, USD: 0, EUR: 0 };
      const runningBalance = { TRY: 0, USD: 0, EUR: 0 };

      const tbody = document.getElementById('c-ledger-tbody');
      const emptyState = document.getElementById('c-ledger-empty');
      tbody.innerHTML = '';

      if (ledgerEntries.length === 0) {
        emptyState.style.display = 'block';
      } else {
        emptyState.style.display = 'none';

        ledgerEntries.forEach(entry => {
          const curr = entry.currency || 'TRY';
          totalHakedis[curr] = (totalHakedis[curr] || 0) + entry.hakedis;
          totalOdenen[curr] = (totalOdenen[curr] || 0) + entry.odenen;
          
          runningBalance[curr] = (runningBalance[curr] || 0) + entry.hakedis - entry.odenen;

          const tr = document.createElement('tr');
          const isPayment = entry.type === 'tx' && entry.odenen > 0;
          const isJob = entry.type === 'job';

          const dateFormatted = entry.date.split('-').reverse().join('.');
          const hakedisStr = entry.hakedis > 0 ? formatMoney(entry.hakedis, curr) : '-';
          const odenenStr = entry.odenen > 0 ? formatMoney(entry.odenen, curr) : '-';
          const balanceStr = formatMoney(runningBalance[curr], curr);

          tr.innerHTML = `
            <td>${dateFormatted}</td>
            <td>
              <div style="font-weight: 500; font-size: 0.9rem;">
                ${isJob ? '📦 ' : '💵 '}${escapeHtml(entry.description)}
              </div>
            </td>
            <td style="text-align: right; font-weight: 600;">${hakedisStr}</td>
            <td style="text-align: right; font-weight: 600; color: var(--color-success);">${odenenStr}</td>
            <td style="text-align: right; font-weight: 700; color: ${runningBalance[curr] >= 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
              ${balanceStr}
            </td>
            <td style="text-align: center;">
              <button class="btn-icon danger btn-delete-ledger-entry" data-id="${entry.id}" data-type="${entry.type}" title="Sil" style="font-size: 1rem; border: none; background: transparent; cursor: pointer; color: var(--color-danger);">&times;</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Render summary cards
      document.getElementById('c-ledger-total-hakedis').textContent = formatMultiCurrency(totalHakedis);
      document.getElementById('c-ledger-total-odenen').textContent = formatMultiCurrency(totalOdenen);
      document.getElementById('c-ledger-balance').textContent = formatMultiCurrency(runningBalance);

      // Bind delete events
      document.querySelectorAll('.btn-delete-ledger-entry').forEach(btn => {
        bindOnce(btn, 'click', async () => {
          if (confirm('Bu hareketi silmek istediğinizden emin misiniz?')) {
            await this.deleteLedgerEntry(parseInt(btn.dataset.id), btn.dataset.type);
          }
        }, 'btn_delete_l_' + btn.dataset.type + '_' + btn.dataset.id);
      });

      // Bind Print Button
      const printBtn = document.getElementById('btn-c-ledger-print');
      if (printBtn) {
        printBtn.onclick = () => {
          this.printLedger(c, ledgerEntries);
        };
      }

      // Bind WhatsApp Share Button in Ledger Modal
      const waBtn = document.getElementById('btn-c-ledger-whatsapp');
      if (waBtn) {
        waBtn.onclick = () => {
          if (window.WhatsAppManager) {
            const compName = window.WhatsAppManager.getCompanyName();
            const formatCurrencies = (obj) => {
              const parts = [];
              const symbols = { TRY: '₺', USD: '$', EUR: '€' };
              for (const [curr, amt] of Object.entries(obj)) {
                if (amt !== 0) parts.push(`${symbols[curr] || curr}${amt.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
              }
              return parts.length > 0 ? parts.join(' + ') : '₺0,00';
            };
            const totalHakedisStr = formatCurrencies(totalHakedis);
            const totalOdenenStr = formatCurrencies(totalOdenen);
            const balanceStr = formatCurrencies(runningBalance);

            const msg = `📑 *${compName.toUpperCase()} — USTA HESAP EKSTRESİ*\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 *Usta / Fasoncu:* ${c.name}\n` +
              `📈 *Toplam Hakediş:* ${totalHakedisStr}\n` +
              `💵 *Toplam Ödenen:* ${totalOdenenStr}\n` +
              `📊 *Kalan Hakediş Bakiyesi:* ${balanceStr}\n` +
              `━━━━━━━━━━━━━━━━━━━━━\n` +
              `ℹ️ _Detaylı iş ve ödeme dökümü yukarıdaki gibidir. Hayırlı işler dileriz._`;

            window.WhatsAppManager.openModal({
              title: '📑 Fason Ekstre WhatsApp Bildirimi',
              phone: c.phone || '',
              recipientName: c.name,
              defaultTemplateKey: 'ledger_summary',
              templates: [{ key: 'ledger_summary', label: '📊 Ekstre Özeti' }],
              templateTexts: { ledger_summary: msg },
              data: c
            });
          }
        };
      }

      modal.style.display = 'flex';
      requestAnimationFrame(() => modal.classList.add('show'));

    } catch (err) {
      console.error(err);
      window.showToast('Ekstre yüklenirken hata oluştu.', 'error');
    }
  },

  printLedger(c, entries) {
    const printArea = document.getElementById('ledger-print-area');
    if (!printArea) return;

    const companyName = localStorage.getItem('atolyecim_auth_company') || 'Atölyecim Master';
    const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Calculate totals
    const totalHakedis = {};
    const totalOdenen = {};
    const balance = {};

    const rowHtml = entries.map(entry => {
      const curr = entry.currency || 'TRY';
      totalHakedis[curr] = (totalHakedis[curr] || 0) + entry.hakedis;
      totalOdenen[curr] = (totalOdenen[curr] || 0) + entry.odenen;
      balance[curr] = (balance[curr] || 0) + entry.hakedis - entry.odenen;

      const dateFormatted = entry.date.split('-').reverse().join('.');
      const hakedisStr = entry.hakedis > 0 ? '₺' + entry.hakedis.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-';
      const odenenStr = entry.odenen > 0 ? '₺' + entry.odenen.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-';
      const balanceStr = '₺' + balance[curr].toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 5px; text-align: left;">${dateFormatted}</td>
          <td style="padding: 8px 5px; text-align: left; max-width: 300px; word-wrap: break-word;">${escapeHtml(entry.description)}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: 600;">${hakedisStr}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: 600; color: #10b981;">${odenenStr}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: 700; color: ${balance[curr] >= 0 ? '#ef4444' : '#10b981'}">${balanceStr}</td>
        </tr>
      `;
    }).join('');

    // Format summary balances
    const formatCurrenciesSummary = (obj) => {
      const parts = [];
      const symbols = { TRY: '₺', USD: '$', EUR: '€' };
      for (const [code, val] of Object.entries(obj)) {
        if (val !== 0) {
          parts.push(`${symbols[code] || code}${val.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
        }
      }
      return parts.length > 0 ? parts.join(' | ') : '₺0,00';
    };

    const totalHakedisStr = formatCurrenciesSummary(totalHakedis);
    const totalOdenenStr = formatCurrenciesSummary(totalOdenen);
    const totalBalanceStr = formatCurrenciesSummary(balance);

    printArea.innerHTML = `
      <div style="padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; background: #fff;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;">
          <div>
            <h2 style="font-weight: 800; font-size: 1.15rem; color: #0f172a; margin: 0 0 3px 0;">${escapeHtml(companyName)}</h2>
            <p style="font-size: 9.5px; color: #475569; margin: 0;">Ayakkabı İmalat & Fason İşçilik Ekstresi (A5)</p>
          </div>
          <div style="text-align: right;">
            <h1 style="font-weight: 800; font-size: 1.15rem; color: #0284c7; margin: 0 0 3px 0;">FASON HESAP EKSTRESİ</h1>
            <p style="font-size: 9.5px; margin: 0; color: #64748b;"><strong>Tarih:</strong> ${dateStr}</p>
          </div>
        </div>

        <!-- Subcontractor Section -->
        <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Fason Usta / Firma:</span>
              <p style="font-size: 11.5px; font-weight: 700; color: #0f172a; margin: 2px 0 0 0;">${escapeHtml(c.name)}</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 9.5px; color: #475569;"><strong>Alan:</strong> ${escapeHtml(c.role || '-')}</span>
              <span style="margin-left: 10px; font-size: 9.5px; color: #475569;"><strong>Tel:</strong> ${escapeHtml(c.phone || '-')}</span>
            </div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5px;">
          <thead>
            <tr style="border-bottom: 1.5px solid #0f172a; text-align: left; font-weight: 700; background: #f1f5f9;">
              <th style="padding: 5px 4px; width: 16%;">Tarih</th>
              <th style="padding: 5px 4px; width: 44%;">İş Açıklaması / Detay</th>
              <th style="padding: 5px 4px; width: 14%; text-align: right;">Hakediş</th>
              <th style="padding: 5px 4px; width: 13%; text-align: right;">Ödenen</th>
              <th style="padding: 5px 4px; width: 13%; text-align: right;">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${rowHtml}
          </tbody>
        </table>

        <!-- Summary & Balance -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
          <div style="width: 240px; font-size: 10px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
              <span>Toplam Hakediş:</span>
              <span style="font-weight: 600;">${totalHakedisStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
              <span>Toplam Ödenen:</span>
              <span style="font-weight: 600; color: #10b981;">${totalOdenenStr}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 11px; color: #0f172a;">
              <span>Kalan Alacak:</span>
              <span style="color: #ef4444;">${totalBalanceStr}</span>
            </div>
          </div>
        </div>

        <!-- Signature Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; text-align: center; font-size: 9.5px;">
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; margin: 0 20px;">
            <p style="font-weight: 700; margin: 0 0 2px 0;">Yetkili İmza</p>
            <p style="color: #64748b; margin: 0;">${escapeHtml(companyName)}</p>
          </div>
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; margin: 0 20px;">
            <p style="font-weight: 700; margin: 0 0 2px 0;">Fason Usta / Firma</p>
            <p style="color: #64748b; margin: 0;">İmza / Kaşe</p>
          </div>
        </div>
      </div>
    `;

    // Trigger Print Dialog
    document.body.classList.add('printing-ledger');
    window.print();
    document.body.classList.remove('printing-ledger');
  },

  async deleteLedgerEntry(id, type) {
    try {
      if (type === 'job') {
        await window.dbDelete('contractor_jobs', id);
      } else {
        await window.dbDelete('contractor_transactions', id);
      }
      window.showToast('İşlem silindi.', 'success');
      await this.openLedgerModal(this.activeContractorId);
      await this.loadContractors();
    } catch (err) {
      console.error(err);
    }
  },

  openJobModal(contractorId) {
    const modal = document.getElementById('contractor-job-modal');
    if (!modal) return;
    document.getElementById('contractor-job-form').reset();
    document.getElementById('job-contractor-id').value = contractorId;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  },

  openPaymentModal(contractorId) {
    const modal = document.getElementById('contractor-payment-modal');
    if (!modal) return;
    document.getElementById('contractor-payment-form').reset();
    document.getElementById('payment-contractor-id').value = contractorId;
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));
  }
};

// bindEvents — called from app.js loadApp() after DOM is ready
Contractors.bindEvents = function() {
  if (this._eventsBound) return;
  this._eventsBound = true;

  // Bind contractor save
  const contractorForm = document.getElementById('contractor-form');
  if (contractorForm) {
    contractorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('contractor-id').value;
      const name = document.getElementById('contractor-name').value.trim();
      const role = document.getElementById('contractor-role').value;
      const phone = document.getElementById('contractor-phone').value.trim();

      if (!name || !role) return;

      const data = { name, role, phone };
      try {
        if (id) {
          data.id = parseInt(id);
          await window.dbUpdate('contractors', data);
        } else {
          await window.dbAdd('contractors', data);
        }
        window.showToast('Fason usta bilgileri kaydedildi.', 'success');
        const modal = document.getElementById('contractor-modal');
        if (modal) {
          modal.classList.remove('show');
          setTimeout(() => { modal.style.display = 'none'; }, 250);
        }
        await Contractors.loadContractors();
      } catch (err) {
        console.error(err);
        window.showToast('Hata oluştu, kaydedilemedi.', 'error');
      }
    });
  }

  // Add contractor button click
  const btnAddC = document.getElementById('btn-add-contractor');
  if (btnAddC) {
    btnAddC.addEventListener('click', () => {
      document.getElementById('contractor-form').reset();
      document.getElementById('contractor-id').value = '';
      document.getElementById('contractor-modal-title').textContent = 'Fason Usta Ekle';
      const modal = document.getElementById('contractor-modal');
      if (modal) {
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('show'));
      }
    });
  }

  // Contractor Job submit
  const jobForm = document.getElementById('contractor-job-form');
  if (jobForm) {
    jobForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const contractorId = parseInt(document.getElementById('job-contractor-id').value);
      const modelCode = document.getElementById('job-model-code').value.trim().toUpperCase();
      const qty = parseInt(document.getElementById('job-qty').value);
      const laborPrice = parseFloat(document.getElementById('job-price').value);
      const currency = document.getElementById('job-currency').value;
      const description = document.getElementById('job-description').value.trim();

      if (!contractorId || !modelCode || !qty || !laborPrice) return;

      const jobData = {
        contractorId,
        modelCode,
        qty,
        laborPrice,
        currency,
        description: description || `Fason İş: ${modelCode} (${qty} Çift)`,
        date: new Date().toISOString().split('T')[0]
      };

      try {
        const addedJob = await window.dbAdd('contractor_jobs', jobData);
        window.showToast('İş ataması/hakediş başarıyla kaydedildi.', 'success');
        const modal = document.getElementById('contractor-job-modal');
        if (modal) {
          modal.classList.remove('show');
          setTimeout(() => { modal.style.display = 'none'; }, 250);
        }
        // Refresh details modal & main table
        await Contractors.openLedgerModal(contractorId);
        await Contractors.loadContractors();

        // Trigger WhatsApp notification modal
        if (window.WhatsAppManager) {
          window.WhatsAppManager.openForContractorJob(addedJob?.id || jobData.id);
        }
      } catch (err) {
        console.error(err);
        window.showToast('Hakediş kaydedilemedi.', 'error');
      }
    });
  }

  // Contractor Payment submit
  const payForm = document.getElementById('contractor-payment-form');
  if (payForm) {
    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const contractorId = parseInt(document.getElementById('payment-contractor-id').value);
      const amount = parseFloat(document.getElementById('payment-amount').value);
      const currency = document.getElementById('payment-currency').value;
      const description = document.getElementById('payment-description').value.trim();

      if (!contractorId || !amount || !description) return;

      const txData = {
        contractorId,
        amount,
        currency,
        type: 'odeme',
        description,
        date: new Date().toISOString().split('T')[0]
      };

      try {
        const addedTx = await window.dbAdd('contractor_transactions', txData);
        window.showToast('Ödeme kaydı başarıyla eklendi.', 'success');
        const modal = document.getElementById('contractor-payment-modal');
        if (modal) {
          modal.classList.remove('show');
          setTimeout(() => { modal.style.display = 'none'; }, 250);
        }
        await Contractors.openLedgerModal(contractorId);
        await Contractors.loadContractors();

        // Trigger WhatsApp notification modal
        if (window.WhatsAppManager) {
          window.WhatsAppManager.openForContractorPayment(addedTx?.id || txData.id);
        }
      } catch (err) {
        console.error(err);
        window.showToast('Ödeme kaydedilemedi.', 'error');
      }
    });
  }

  // Bind ledger modal action buttons
  const btnAddJob = document.getElementById('btn-c-ledger-add-job');
  if (btnAddJob) {
    bindOnce(btnAddJob, 'click', () => {
      if (Contractors.activeContractorId) {
        Contractors.openJobModal(Contractors.activeContractorId);
      }
    });
  }

  const btnAddPay = document.getElementById('btn-c-ledger-add-pay');
  if (btnAddPay) {
    bindOnce(btnAddPay, 'click', () => {
      if (Contractors.activeContractorId) {
        Contractors.openPaymentModal(Contractors.activeContractorId);
      }
    });
  }

  // Bind Search Input
  const searchInput = document.getElementById('search-contractors');
  if (searchInput) {
    bindOnce(searchInput, 'input', () => {
      Contractors.loadContractors();
    });
  }
};

window.Contractors = Contractors;


/* =========================================
   ASORTİ ŞABLONLARI YÖNETİCİSİ (1. Seçenek)
   ========================================= */

async function loadAssortments() {
  const tbody = document.getElementById('assortments-tbody');
  const emptyState = document.getElementById('assortments-empty');

  try {
    const list = await window.dbGetAll('assortments');

    // Always update order form selectors regardless of page
    const selectors = [
      document.getElementById('quick-order-asorti-select'),
      ...document.querySelectorAll('.color-group-asorti-select')
    ];

    selectors.forEach(sel => {
      if (!sel) return;
      const currVal = sel.value;
      sel.innerHTML = '<option value="">Şablon Seçin</option>';
      list.forEach(as => {
        const option = document.createElement('option');
        option.value = as.id;
        option.textContent = as.name;
        sel.appendChild(option);
      });
      sel.value = currVal;
    });

    // Update table only if we are on the assortments page
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    list.forEach(as => {
      let sizeSummary = [];
      let totalQty = 0;
      for (let s = 36; s <= 45; s++) {
        const qty = parseInt(as.sizes[s] || 0);
        if (qty > 0) {
          sizeSummary.push(`${s}:${qty}`);
          totalQty += qty;
        }
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: var(--text-accent);">${escapeHtml(as.name)}</strong></td>
        <td style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">${sizeSummary.join(', ')}</td>
        <td style="font-weight: 700;">${totalQty} Çift</td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-sm btn-ghost btn-as-delete" data-id="${as.id}" style="color: var(--color-danger); border-color: rgba(239,68,68,0.2); padding: 4px 8px;">Sil</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind delete events
    document.querySelectorAll('.btn-as-delete').forEach(btn => {
      bindOnce(btn, 'click', async () => {
        const id = parseInt(btn.dataset.id);
        if (confirm('Bu asorti şablonunu silmek istediğinizden emin misiniz?')) {
          await window.dbDelete('assortments', id);
          window.showToast('Asorti şablonu silindi.', 'success');
          await loadAssortments();
        }
      }, 'btn_as_delete_' + btn.dataset.id);
    });

  } catch (err) {
    console.error('Load assortments error:', err);
  }
}

function initAssortmentsManager() {
  loadAssortments();

  const form = document.getElementById('assortment-form');
  if (form && !form._bound) {
    form._bound = true;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('as-name').value.trim();
      if (!name) return;

      const sizes = {};
      let totalQty = 0;
      form.querySelectorAll('.as-size-qty').forEach(input => {
        const size = input.dataset.size;
        const qty = parseInt(input.value) || 0;
        sizes[size] = qty;
        totalQty += qty;
      });

      if (totalQty === 0) {
        window.showToast('Lütfen en az bir numara için adet girin!', 'error');
        return;
      }

      try {
        await window.dbAdd('assortments', { name, sizes });
        window.showToast('Asorti şablonu başarıyla tanımlandı! 📦', 'success');
        form.reset();
        await loadAssortments();
      } catch (err) {
        console.error(err);
        window.showToast('Şablon kaydedilemedi.', 'error');
      }
    });
  }

  // Quick Order Asorti apply button trigger
  const btnQuickApply = document.getElementById('btn-quick-apply-asorti');
  if (btnQuickApply && !btnQuickApply._bound) {
    btnQuickApply._bound = true;
    btnQuickApply.addEventListener('click', async () => {
      const select = document.getElementById('quick-order-asorti-select');
      const qtyInput = document.getElementById('quick-order-asorti-qty');
      if (!select || !qtyInput) return;

      const asId = select.value;
      const koliQty = parseInt(qtyInput.value) || 1;

      if (!asId) {
        window.showToast('Lütfen önce bir asorti şablonu seçin!', 'error');
        return;
      }

      try {
        const as = await window.dbGet('assortments', parseInt(asId));
        if (!as) return;

        // Populate quick matrix inputs
        const matrixContainer = document.getElementById('quick-order-matrix');
        if (!matrixContainer) return;

        matrixContainer.querySelectorAll('.quick-size-input').forEach(input => {
          const size = input.dataset.size;
          const templateVal = parseInt(as.sizes[size] || 0);
          input.value = templateVal * koliQty;
        });

        // Trigger manual preview recalc in orders.js
        const event = new Event('input', { bubbles: true });
        const triggerInput = matrixContainer.querySelector('.quick-size-input');
        if (triggerInput) triggerInput.dispatchEvent(event);

        window.showToast('Şablon başarıyla uygulandı.', 'success');
      } catch (err) {
        console.error(err);
      }
    });
  }
}

// Attach to window for global activation
window.Contractors = Contractors;
window.initAssortmentsManager = initAssortmentsManager;
window.loadAssortments = loadAssortments;
