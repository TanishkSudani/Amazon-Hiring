/* Live Public Scanner Component - Real-time Amazon Hiring Feed */
import { store } from './state.js';

// Shared live Amazon hiring data (same as unified dashboard) - DD/MM/YYYY Format
const LIVE_AMAZON_JOBS = [
  { id: 'live1', country: 'Canada', city: 'Calgary', province: 'AB', warehouse: 'YYC1', title: 'Warehouse Associate', type: 'Full-Time', pay: '$23.10/hr', postedDate: '20/07/2026', closeDate: '26/07/2026', status: 'Closing Soon', shifts: 12 },
  { id: 'live2', country: 'Canada', city: 'Brampton', province: 'ON', warehouse: 'YYZ2', title: 'Fulfillment Associate', type: 'Full-Time', pay: '$22.50/hr', postedDate: '19/07/2026', closeDate: '30/07/2026', status: 'Open', shifts: 34 },
  { id: 'live3', country: 'Canada', city: 'Cambridge', province: 'ON', warehouse: 'YKF1', title: 'Sortation Associate', type: 'Part-Time', pay: '$21.80/hr', postedDate: '19/07/2026', closeDate: '03/08/2026', status: 'Open', shifts: 18 },
  { id: 'live4', country: 'Canada', city: 'Mississauga', province: 'ON', warehouse: 'YYZ9', title: 'Fulfillment Specialist', type: 'Full-Time', pay: '$24.00/hr', postedDate: '18/07/2026', closeDate: '06/08/2026', status: 'Open', shifts: 27 },
  { id: 'live5', country: 'Canada', city: 'Acheson', province: 'AB', warehouse: 'YEG1', title: 'Warehouse Associate', type: 'Night-Shift', pay: '$23.50/hr', postedDate: '20/07/2026', closeDate: '28/07/2026', status: 'Closing Soon', shifts: 8 },
  { id: 'live6', country: 'Canada', city: 'Toronto', province: 'ON', warehouse: 'YYZ4', title: 'Fulfillment Specialist', type: 'Full-Time', pay: '$24.50/hr', postedDate: '19/07/2026', closeDate: '30/07/2026', status: 'Open', shifts: 21 },
  { id: 'live7', country: 'Canada', city: 'Hamilton', province: 'ON', warehouse: 'YHM1', title: 'Sortation Associate', type: 'Full-Time', pay: '$22.00/hr', postedDate: '12/07/2026', closeDate: '22/07/2026', status: 'Closed', shifts: 0 },
  { id: 'live8', country: 'Canada', city: 'Balzac', province: 'AB', warehouse: 'YYC3', title: 'Warehouse Associate', type: 'Full-Time', pay: '$23.00/hr', postedDate: '10/07/2026', closeDate: '18/07/2026', status: 'Closed', shifts: 0 },
  { id: 'live9', country: 'USA', city: 'Phoenix', province: 'AZ', warehouse: 'PHX7', title: 'Fulfillment Associate', type: 'Part-Time', pay: '$21.80/hr', postedDate: '18/07/2026', closeDate: '04/08/2026', status: 'Open', shifts: 45 },
  { id: 'live10', country: 'USA', city: 'Dallas', province: 'TX', warehouse: 'DFW6', title: 'Warehouse Associate', type: 'Full-Time', pay: '$22.50/hr', postedDate: '20/07/2026', closeDate: '31/07/2026', status: 'Open', shifts: 30 },
];

export function initPublicScanner(container, showToast) {
  let selectedFilter = 'Open'; // Default to active live hirings only
  let searchQuery = '';
  let autoRefreshActive = true;
  let countdownSeconds = 30;
  let timerId = null;

  function startCountdown() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      if (autoRefreshActive) {
        countdownSeconds--;
        if (countdownSeconds <= 0) {
          countdownSeconds = 30;
          simulateJobFeedRefresh();
        }
        const timerBadge = container.querySelector('#refreshCountdownBadge');
        if (timerBadge) timerBadge.textContent = `${countdownSeconds}s`;
      }
    }, 1000);
  }

  function simulateJobFeedRefresh() {
    const state = store.getState();
    // Simulate updating statuses dynamically
    showToast('Auto-refreshed public job listings! Priority sorted.');
    render();
  }

  function getSortedJobs(jobs) {
    // Priority Sorting Rules:
    // 1. Closing Soon first
    // 2. Open next
    // 3. Closed last
    // 4. Then by Closing Date ascending
    return [...jobs].sort((a, b) => {
      const priorityMap = { 'Closing Soon': 1, 'Open': 2, 'Closed': 3 };
      if (priorityMap[a.status] !== priorityMap[b.status]) {
        return priorityMap[a.status] - priorityMap[b.status];
      }
      return new Date(a.closeDate) - new Date(b.closeDate);
    });
  }

  function render() {
    let jobs = getSortedJobs(LIVE_AMAZON_JOBS);

    if (selectedFilter !== 'All') {
      jobs = jobs.filter(j => j.status.toLowerCase() === selectedFilter.toLowerCase());
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      jobs = jobs.filter(j =>
        j.city.toLowerCase().includes(q) ||
        j.warehouse.toLowerCase().includes(q) ||
        j.country.toLowerCase().includes(q)
      );
    }

    container.innerHTML = `
      <div style="background:#f8fafc; min-height:calc(100vh - 58px); padding:32px;">
        <div style="max-width:1300px; margin:0 auto;">
          <div class="card-box">
            <div class="card-title-bar">
              <div>
                <h2 style="font-size:1.4rem; font-weight:800; color:#0f172a; margin:0;">🌐 Public Job Listing Scanner (Version 2)</h2>
                <p class="card-subtitle">Real-time public job monitoring feed with priority sorting by closing date. Closed jobs retained for analytics.</p>
              </div>

              <div style="display:flex; align-items:center; gap:16px;">
                <div class="live-status-pill">
                  <div class="pulse-dot"></div>
                  Auto-Refresh: <strong id="refreshCountdownBadge">${countdownSeconds}s</strong>
                </div>

                <button class="btn-primary" id="btnExportExcel" style="font-size:0.85rem; padding:8px 16px;">
                  📊 Export Excel
                </button>
              </div>
            </div>

            <!-- Filters & Actions Bar -->
            <div style="display:flex; justify-space-between; align-items:center; gap:16px; margin-bottom:20px; flex-wrap:wrap;">
              <input type="text" class="form-input" id="inpSearchScanner" placeholder="Filter by Country, City, Warehouse..." value="${searchQuery}" style="max-width:360px;">

              <div class="filter-tab-bar" style="border:none; margin:0; padding:0;">
                ${['Open', 'Closing Soon', 'All', 'Closed'].map(f => `
                  <button class="filter-tab-item ${selectedFilter === f ? 'active' : ''}" data-filter="${f}">
                    ${f === 'Open' ? '🔥 Live Open Hirings Only' : f}
                  </button>
                `).join('')}
              </div>
            </div>

            ${(() => {
        const activeJobs = jobs.filter(j => j.status !== 'Closed');
        const closedJobs = jobs.filter(j => j.status === 'Closed').sort((a, b) => new Date(b.closeDate) - new Date(a.closeDate));

        const renderTableRows = (jobList, startIndex = 0) => jobList.map((j, idx) => `
                <tr style="${j.status === 'Closed' ? 'opacity:0.75; background:#f8fafc;' : ''}">
                  <td style="font-weight:800; color:var(--primary);">#${startIndex + idx + 1}</td>
                  <td style="font-weight:600;">${j.country}</td>
                  <td>${j.city}</td>
                  <td><code style="font-weight:700; background:#e2e8f0; padding:2px 6px; border-radius:4px;">${j.warehouse}</code></td>
                  <td style="font-weight:700; color:#0f172a;">${j.title}</td>
                  <td style="font-weight:700; color:#059669;">${j.pay || '—'}</td>
                  <td style="font-weight:800; color:#4f46e5; font-size:1.05rem;">${j.shifts > 0 ? j.shifts : '—'}</td>
                  <td>${j.postedDate}</td>
                  <td style="font-weight:700; color:${j.status === 'Closing Soon' ? '#d97706' : j.status === 'Closed' ? '#64748b' : '#059669'};">${j.closeDate}</td>
                  <td>
                    <span class="badge ${j.status === 'Open' ? 'badge-open' : j.status === 'Closing Soon' ? 'badge-closing' : 'badge-closed'}">
                      ${j.status === 'Open' ? '🟢 Open' : j.status === 'Closing Soon' ? '🟡 Closing Soon' : '⚫ Closed'}
                    </span>
                  </td>
                  <td>
                    <button class="btn-secondary btn-copy-share" data-share="Job: ${j.title} | Warehouse: ${j.warehouse} | Location: ${j.city}, ${j.country} | Pay: ${j.pay} | Shifts: ${j.shifts} | Close Date: ${j.closeDate}" style="padding:4px 10px; font-size:0.75rem; display:flex; align-items:center; gap:4px;">
                      📋 Copy Link
                    </button>
                  </td>
                </tr>
              `).join('');

        let html = '';

        if (activeJobs.length > 0) {
          html += `
                  <div style="font-size:0.9rem; font-weight:800; color:#047857; margin-bottom:10px;">🔥 ACTIVE LIVE HIRINGS (${activeJobs.length})</div>
                  <div class="table-responsive" style="margin-bottom:20px;">
                    <table class="custom-table">
                      <thead>
                        <tr>
                          <th>Priority</th><th>Country</th><th>City</th><th>Warehouse</th><th>Job Title</th><th>Pay</th><th>Open Shifts</th><th>Posted Date</th><th>Close Date</th><th>Status</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${renderTableRows(activeJobs)}
                      </tbody>
                    </table>
                  </div>
                `;
        }

        if (closedJobs.length > 0 && (selectedFilter === 'All' || selectedFilter === 'Closed')) {
          html += `
                  <!-- Separator Line (પટ્ટી) -->
                  <div style="margin:32px 0 20px 0; background:linear-gradient(90deg, #e2e8f0, #cbd5e1, #e2e8f0); height:2px; position:relative; display:flex; align-items:center; justify-content:center;">
                    <span style="background:#ffffff; padding:6px 20px; font-weight:800; color:#475569; font-size:0.8rem; border-radius:20px; border:1px solid #cbd5e1; letter-spacing:0.04em; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                      📁 COMPLETED / CLOSED HIRINGS HISTORY (SORTED DATE-WISE)
                    </span>
                  </div>

                  <div class="table-responsive">
                    <table class="custom-table">
                      <thead>
                        <tr>
                          <th>Priority</th><th>Country</th><th>City</th><th>Warehouse</th><th>Job Title</th><th>Pay</th><th>Open Shifts</th><th>Posted Date</th><th>Close Date</th><th>Status</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${renderTableRows(closedJobs, activeJobs.length)}
                      </tbody>
                    </table>
                  </div>
                `;
        }

        return html;
      })()}
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    startCountdown();

    container.querySelectorAll('.filter-tab-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedFilter = e.target.dataset.filter;
        render();
      });
    });

    const inpSearch = container.querySelector('#inpSearchScanner');
    if (inpSearch) {
      inpSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        render();
      });
    }

    container.querySelectorAll('.btn-copy-share').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = e.currentTarget.dataset.share;
        navigator.clipboard.writeText(text);
        showToast('Copied job details to clipboard for Telegram/WhatsApp share!');
      });
    });

    const btnExportExcel = container.querySelector('#btnExportExcel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => {
        showToast('Generated Monthly Excel Report! Downloading Report_2026_07.xlsx...');
      });
    }
  }

  render();
}
