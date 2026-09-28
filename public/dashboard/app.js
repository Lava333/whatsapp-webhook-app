/**
 * app.js — WhatsApp Business Dashboard
 * Tabs: Overview | Clients | Messages | Analytics
 * Auto-refreshes every 30s.
 */

// ─── Chart.js defaults ───────────────────────────────────────
Chart.defaults.color = '#6b7394';
Chart.defaults.borderColor = '#252c4a';
Chart.defaults.font.family = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

// ─── Global state ─────────────────────────────────────────────
let dailyChart = null, typeChart = null, dailyClientsChart = null, weeklyChart = null;

// Messages tab state
let allMessages = [], filteredMessages = [], msgPage = 0;
const MSG_PAGE_SIZE = 20;

// Clients tab state
let clientPage = 0;
const CLIENT_PAGE_SIZE = 12;
let totalClients = 0;

// ─── Tab routing ──────────────────────────────────────────────
const TAB_TITLES = {
  overview:  ['Overview',      'Real-time WhatsApp message metrics'],
  clients:   ['Clients',       'Messages received, segregated by client'],
  messages:  ['Messages',      'Full message log'],
  analytics: ['Analytics',     'Time-series trends and breakdowns'],
  send:      ['Send Message',  'Compose and send WhatsApp messages'],
};

function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === `tab-${tab}`));
  const [title, sub] = TAB_TITLES[tab] || ['Dashboard', ''];
  document.getElementById('tab-title').textContent = title;
  document.getElementById('tab-subtitle').textContent = sub;
  if (tab === 'clients')   loadClients();
  if (tab === 'messages')  loadMessages();
  if (tab === 'analytics') loadAnalyticsCharts();
  if (tab === 'send')      loadSentHistory();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); switchTab(el.dataset.tab); });
});

// ─── Fetch helper ─────────────────────────────────────────────
async function api(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── HTML helpers ─────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtTime(dt) {
  if (!dt) return '—';
  return new Date(dt + 'Z').toLocaleString();
}
function fmtTimeShort(dt) {
  if (!dt) return '—';
  const d = new Date(dt + 'Z');
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1)   return 'Just now';
  if (diff < 60)  return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  return `${Math.floor(diff/1440)}d ago`;
}
function initials(name, phone) {
  if (name) return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return phone.slice(-2);
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────

async function loadSummary() {
  const { data: s } = await api('/api/stats/summary');

  // Hero banner
  document.getElementById('hero-clients').textContent      = s.totalClients.toLocaleString();
  document.getElementById('hero-today-clients').textContent = s.todayClients.toLocaleString();
  document.getElementById('hero-new-clients').textContent   = s.newClientsToday.toLocaleString();

  // Metric cards
  document.getElementById('card-total').textContent    = s.total.toLocaleString();
  document.getElementById('card-clients').textContent  = s.totalClients.toLocaleString();
  document.getElementById('card-today').textContent    = s.todayMessages.toLocaleString();
  document.getElementById('card-inbound').textContent  = s.inbound.toLocaleString();
  document.getElementById('card-outbound').textContent = s.outbound.toLocaleString();

  // Sidebar badge
  document.getElementById('nav-client-count').textContent = s.totalClients;

  // Type chart
  renderTypeChart(s.byType);
}

async function loadDailyChart() {
  const { data } = await api('/api/stats/daily?days=30');
  const labels   = data.map(d => { const dt = new Date(d.day+'T00:00:00'); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}); });
  const inbound  = data.map(d => Number(d.inbound));
  const outbound = data.map(d => Number(d.outbound));

  if (dailyChart) {
    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = inbound;
    dailyChart.data.datasets[1].data = outbound;
    dailyChart.update(); return;
  }
  const ctx = document.getElementById('chart-daily').getContext('2d');
  dailyChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label:'Inbound',  data:inbound,  backgroundColor:'rgba(37,211,102,.7)',  borderColor:'#25D366', borderWidth:1, borderRadius:4 },
      { label:'Outbound', data:outbound, backgroundColor:'rgba(74,158,255,.7)',  borderColor:'#4a9eff', borderWidth:1, borderRadius:4 },
    ]},
    options: { responsive:true, plugins:{ legend:{position:'top'}, tooltip:{mode:'index',intersect:false} },
               scales:{ x:{stacked:true,grid:{color:'#252c4a'}}, y:{stacked:true,grid:{color:'#252c4a'},beginAtZero:true,ticks:{precision:0}} } },
  });
}

function renderTypeChart(byType) {
  const COLORS = ['#25D366','#4a9eff','#f5a623','#e95b5b','#a855f7','#f97316','#06b6d4'];
  const labels = byType.map(t => t.message_type);
  const counts = byType.map(t => Number(t.count));
  if (typeChart) { typeChart.data.labels=labels; typeChart.data.datasets[0].data=counts; typeChart.data.datasets[0].backgroundColor=COLORS.slice(0,labels.length); typeChart.update(); return; }
  const ctx = document.getElementById('chart-type').getContext('2d');
  typeChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets:[{ data:counts, backgroundColor:COLORS.slice(0,labels.length), borderColor:'#13172a', borderWidth:3 }] },
    options: { responsive:true, cutout:'65%', plugins:{ legend:{position:'bottom',labels:{boxWidth:12,padding:14}} } },
  });
}

async function loadTopClients() {
  const { data } = await api('/api/clients?limit=5&sortBy=message_count&sortDir=DESC');
  const tbody = document.getElementById('top-clients-tbody');
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No clients yet</td></tr>'; return; }
  tbody.innerHTML = data.map((c, i) => `
    <tr onclick="openClientDrawer('${esc(c.sender_phone)}','${esc(c.sender_name||c.sender_phone)}')">
      <td style="color:var(--muted)">${i+1}</td>
      <td><strong>${esc(c.sender_name || '—')}</strong></td>
      <td style="color:var(--muted);font-family:monospace">${esc(c.sender_phone)}</td>
      <td><strong style="color:var(--accent)">${Number(c.message_count).toLocaleString()}</strong></td>
      <td style="color:var(--muted);font-size:.78rem">${fmtTimeShort(c.last_message)}</td>
      <td><span class="badge badge-in">Active</span></td>
    </tr>`).join('');
}

// ─── CLIENTS TAB ──────────────────────────────────────────────

async function loadClients() {
  const search  = document.getElementById('client-search').value;
  const sortBy  = document.getElementById('client-sort').value;
  const offset  = clientPage * CLIENT_PAGE_SIZE;

  const { data, total } = await api(
    `/api/clients?search=${encodeURIComponent(search)}&sortBy=${sortBy}&sortDir=DESC&limit=${CLIENT_PAGE_SIZE}&offset=${offset}`
  );
  totalClients = total;
  document.getElementById('clients-count-chip').textContent = total;

  const grid = document.getElementById('client-grid');
  if (!data.length) { grid.innerHTML = '<div class="empty">No clients found</div>'; return; }

  grid.innerHTML = data.map(c => `
    <div class="client-card" onclick="openClientDrawer('${esc(c.sender_phone)}','${esc(c.sender_name||c.sender_phone)}')">
      <div class="client-card-top">
        <div class="client-avatar">${esc(initials(c.sender_name, c.sender_phone))}</div>
        <div>
          <div class="client-name">${esc(c.sender_name || 'Unknown')}</div>
          <div class="client-phone">${esc(c.sender_phone)}</div>
        </div>
      </div>
      <div class="client-stats">
        <div class="client-stat">
          <div class="client-stat-val" style="color:var(--accent)">${Number(c.message_count)}</div>
          <div class="client-stat-lbl">Messages</div>
        </div>
        <div class="client-stat">
          <div class="client-stat-val" style="color:var(--blue)">${Number(c.text_count)}</div>
          <div class="client-stat-lbl">Text</div>
        </div>
        <div class="client-stat">
          <div class="client-stat-val" style="color:var(--yellow)">${Number(c.image_count)+Number(c.audio_count)+Number(c.video_count)}</div>
          <div class="client-stat-lbl">Media</div>
        </div>
      </div>
      <div class="client-last-msg">
        ${c.last_type && c.last_type !== 'text' ? `<span class="badge-type">${esc(c.last_type)}</span> ` : ''}${esc(c.last_body || '—')}
      </div>
      <div class="client-last-time">${fmtTimeShort(c.last_message)}</div>
    </div>`).join('');

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE));
  document.getElementById('client-page-info').textContent = `Page ${clientPage+1} of ${totalPages}`;
  document.getElementById('client-prev').disabled = clientPage === 0;
  document.getElementById('client-next').disabled = clientPage+1 >= totalPages;
}

function clientPageChange(dir) { clientPage += dir; loadClients(); }

// ─── Client drawer ────────────────────────────────────────────

async function openClientDrawer(phone, name) {
  document.getElementById('drawer-name').textContent  = name;
  document.getElementById('drawer-phone').textContent = phone;
  document.getElementById('client-drawer').style.display = 'block';
  document.getElementById('drawer-messages').innerHTML = '<div class="empty">Loading...</div>';
  document.getElementById('drawer-stats').innerHTML = '';

  const { data, total } = await api(`/api/clients/${encodeURIComponent(phone)}/messages?limit=50`);

  // Stats row
  const types = {};
  data.forEach(m => { types[m.message_type] = (types[m.message_type]||0)+1; });
  document.getElementById('drawer-stats').innerHTML = `
    <div class="drawer-stat"><div class="drawer-stat-val">${total}</div><div class="drawer-stat-lbl">Total Messages</div></div>
    ${Object.entries(types).map(([t,n])=>`<div class="drawer-stat"><div class="drawer-stat-val" style="color:var(--blue)">${n}</div><div class="drawer-stat-lbl">${t}</div></div>`).join('')}
  `;

  // Message list
  document.getElementById('drawer-messages').innerHTML = data.length ? `
    <table class="data-table">
      <thead><tr><th>Type</th><th>Message</th><th>Dir</th><th>Time</th></tr></thead>
      <tbody>${data.map(m=>`
        <tr>
          <td><span class="badge-type">${esc(m.message_type)}</span></td>
          <td><div class="msg-body" title="${esc(m.body)}">${esc(m.body||'—')}</div></td>
          <td><span class="badge ${m.direction==='inbound'?'badge-in':'badge-out'}">${m.direction==='inbound'?'↙':'↗'}</span></td>
          <td style="color:var(--muted);font-size:.75rem;white-space:nowrap">${fmtTime(m.created_at)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<div class="empty">No messages found</div>';

  document.getElementById('client-drawer').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function closeDrawer() { document.getElementById('client-drawer').style.display = 'none'; }

// ─── MESSAGES TAB ─────────────────────────────────────────────

async function loadMessages() {
  const { data, total } = await api('/api/messages?limit=200');
  allMessages = data;
  document.getElementById('msg-count-chip').textContent = `${total.toLocaleString()} total`;
  applyMsgFilter();
}

function applyMsgFilter() {
  const q = document.getElementById('msg-search').value.toLowerCase();
  filteredMessages = q
    ? allMessages.filter(m => (m.sender_phone||'').includes(q)||(m.sender_name||'').toLowerCase().includes(q)||(m.body||'').toLowerCase().includes(q))
    : allMessages;
  msgPage = 0;
  renderMsgTable();
}

function renderMsgTable() {
  const start = msgPage * MSG_PAGE_SIZE;
  const page  = filteredMessages.slice(start, start + MSG_PAGE_SIZE);
  const tbody = document.getElementById('messages-tbody');
  tbody.innerHTML = page.length ? page.map((m,i)=>`
    <tr onclick="switchTab('clients');setTimeout(()=>openClientDrawer('${esc(m.sender_phone)}','${esc(m.sender_name||m.sender_phone)}'),100)">
      <td style="color:var(--muted)">${start+i+1}</td>
      <td>${m.sender_name?`<strong>${esc(m.sender_name)}</strong><br/>`:''}
          <small style="color:var(--muted);font-family:monospace">${esc(m.sender_phone)}</small></td>
      <td><span class="badge-type">${esc(m.message_type)}</span></td>
      <td><div class="msg-body" title="${esc(m.body)}">${esc(m.body||'—')}</div></td>
      <td><span class="badge ${m.direction==='inbound'?'badge-in':'badge-out'}">${m.direction==='inbound'?'↙ In':'↗ Out'}</span></td>
      <td style="color:var(--muted);font-size:.75rem;white-space:nowrap">${fmtTime(m.created_at)}</td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="empty">No messages yet — send a WhatsApp message to your test number!</td></tr>';

  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / MSG_PAGE_SIZE));
  document.getElementById('msg-page-info').textContent = `Page ${msgPage+1} of ${totalPages}`;
  document.getElementById('msg-prev').disabled = msgPage === 0;
  document.getElementById('msg-next').disabled = msgPage+1 >= totalPages;
}

function msgPageChange(dir) { msgPage += dir; renderMsgTable(); }

// ─── ANALYTICS TAB ────────────────────────────────────────────

async function loadAnalyticsCharts() {
  const [daily, weekly] = await Promise.all([
    api('/api/stats/daily?days=30'),
    api('/api/stats/weekly?weeks=12'),
  ]);

  // Daily + unique clients chart
  const dLabels  = daily.data.map(d => { const dt=new Date(d.day+'T00:00:00'); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}); });
  const dInbound = daily.data.map(d => Number(d.inbound));
  const dClients = daily.data.map(d => Number(d.unique_clients));

  if (dailyClientsChart) {
    dailyClientsChart.data.labels=dLabels;
    dailyClientsChart.data.datasets[0].data=dInbound;
    dailyClientsChart.data.datasets[1].data=dClients;
    dailyClientsChart.update();
  } else {
    const ctx = document.getElementById('chart-daily-clients').getContext('2d');
    dailyClientsChart = new Chart(ctx, {
      type:'bar',
      data:{ labels:dLabels, datasets:[
        { label:'Messages', data:dInbound, backgroundColor:'rgba(37,211,102,.6)', borderColor:'#25D366', borderRadius:4, yAxisID:'y' },
        { label:'Unique Clients', data:dClients, type:'line', borderColor:'#f5a623', backgroundColor:'rgba(245,166,35,.1)', fill:true, tension:.4, pointBackgroundColor:'#f5a623', yAxisID:'y1' },
      ]},
      options:{ responsive:true, interaction:{mode:'index',intersect:false},
        plugins:{ legend:{position:'top'} },
        scales:{
          x:{ grid:{color:'#252c4a'} },
          y:{ grid:{color:'#252c4a'}, beginAtZero:true, ticks:{precision:0}, title:{display:true,text:'Messages'} },
          y1:{ position:'right', grid:{drawOnChartArea:false}, beginAtZero:true, ticks:{precision:0}, title:{display:true,text:'Clients'} },
        },
      },
    });
  }

  // Weekly trend
  const wLabels  = weekly.data.map(d => d.week);
  const wIn      = weekly.data.map(d => Number(d.inbound));
  const wOut     = weekly.data.map(d => Number(d.outbound));
  const wClients = weekly.data.map(d => Number(d.unique_clients));

  if (weeklyChart) {
    weeklyChart.data.labels=wLabels;
    weeklyChart.data.datasets[0].data=wIn;
    weeklyChart.data.datasets[1].data=wOut;
    weeklyChart.data.datasets[2].data=wClients;
    weeklyChart.update();
  } else {
    const ctx2 = document.getElementById('chart-weekly').getContext('2d');
    weeklyChart = new Chart(ctx2, {
      type:'line',
      data:{ labels:wLabels, datasets:[
        { label:'Inbound',  data:wIn,  borderColor:'#25D366', backgroundColor:'rgba(37,211,102,.08)', fill:true, tension:.4, pointBackgroundColor:'#25D366' },
        { label:'Outbound', data:wOut, borderColor:'#4a9eff', backgroundColor:'rgba(74,158,255,.08)', fill:true, tension:.4, pointBackgroundColor:'#4a9eff' },
        { label:'Clients',  data:wClients, borderColor:'#f5a623', backgroundColor:'transparent', tension:.4, pointBackgroundColor:'#f5a623', borderDash:[4,3] },
      ]},
      options:{ responsive:true, plugins:{ legend:{position:'top'}, tooltip:{mode:'index',intersect:false} },
        scales:{ x:{grid:{color:'#252c4a'}}, y:{grid:{color:'#252c4a'},beginAtZero:true,ticks:{precision:0}} } },
    });
  }
}

// ─── Full refresh ─────────────────────────────────────────────

async function refreshAll() {
  try {
    await Promise.all([loadSummary(), loadDailyChart(), loadTopClients()]);
    document.getElementById('sidebar-last-updated').textContent =
      `Updated ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    console.error('Refresh error:', e);
    document.getElementById('sidebar-last-updated').textContent = 'Update failed';
  }
}

// ─── Boot ─────────────────────────────────────────────────────
refreshAll();
setInterval(refreshAll, 30000);

// ══════════════════════════════════════════════════════════════
// SEND MESSAGE TAB
// ══════════════════════════════════════════════════════════════

// Track last client phone for quick-fill
let _lastClientPhone = null;

// ── Char counter ──────────────────────────────────────────────
function updateCharCount() {
  const len = (document.getElementById('send-message').value || '').length;
  const el  = document.getElementById('send-char-count');
  el.textContent = `${len} / 4096`;
  el.style.color = len > 3800 ? '#e95b5b' : 'var(--muted)';
}

// ── Quick reply templates ─────────────────────────────────────
function insertQuick(text) {
  document.getElementById('send-message').value = text;
  updateCharCount();
  document.getElementById('send-message').focus();
}

// ── Fill phone from last interacted client ────────────────────
function fillLastClient() {
  if (_lastClientPhone) {
    document.getElementById('send-phone').value = _lastClientPhone;
    showSendResult('info', `📋 Filled phone: ${_lastClientPhone}`);
  } else {
    showSendResult('error', 'No client selected yet. Click a client first.');
  }
}

// Override openClientDrawer to track last phone
const _origOpenClientDrawer = openClientDrawer;
async function openClientDrawer(phone, name) {
  _lastClientPhone = phone;
  return _origOpenClientDrawer(phone, name);
}

// ── Show result banner ────────────────────────────────────────
function showSendResult(type, msg) {
  const el = document.getElementById('send-result');
  el.style.display = 'block';
  el.className = `send-result send-result-${type}`;
  el.innerHTML = msg;
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// ── Send Message ──────────────────────────────────────────────
async function sendMessage() {
  const phone   = (document.getElementById('send-phone').value || '').trim();
  const message = (document.getElementById('send-message').value || '').trim();
  const btn     = document.getElementById('btn-send');
  const btnText = document.getElementById('btn-send-text');

  // Client-side validation
  if (!phone) { showSendResult('error', '❌ Please enter a phone number.'); return; }
  if (!message) { showSendResult('error', '❌ Please enter a message.'); return; }

  // Loading state
  btn.disabled = true;
  btnText.textContent = '⏳ Sending…';
  document.getElementById('send-result').style.display = 'none';

  try {
    const res  = await fetch('/api/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ to: phone, message }),
    });
    const data = await res.json();

    if (data.success) {
      showSendResult('success',
        `✅ Message sent to <strong>${esc(data.to)}</strong>!<br/>
         <small style="color:var(--muted)">ID: ${esc(data.messageId || '—')}</small>`
      );
      // Clear message field, keep phone for follow-ups
      document.getElementById('send-message').value = '';
      updateCharCount();
      // Refresh sent history
      loadSentHistory();
    } else {
      showSendResult('error', `❌ Failed: ${esc(data.error)}`);
    }
  } catch (err) {
    showSendResult('error', `❌ Network error: ${esc(err.message)}`);
  } finally {
    btn.disabled = false;
    btnText.textContent = '📤 Send Message';
  }
}

// ── Sent History ──────────────────────────────────────────────
async function loadSentHistory() {
  try {
    const { data, total } = await api('/api/messages?limit=50&offset=0');
    const sent = data.filter(m => m.direction === 'outbound');

    document.getElementById('sent-count-chip').textContent = sent.length;

    const tbody = document.getElementById('sent-tbody');
    if (!sent.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No sent messages yet — send your first message above!</td></tr>';
      return;
    }

    tbody.innerHTML = sent.map((m, i) => `
      <tr onclick="document.getElementById('send-phone').value='${esc(m.sender_phone)}';switchTab('send')">
        <td style="color:var(--muted)">${i + 1}</td>
        <td>
          ${m.sender_name ? `<strong>${esc(m.sender_name)}</strong><br/>` : ''}
          <small style="color:var(--muted);font-family:monospace">${esc(m.sender_phone)}</small>
        </td>
        <td><div class="msg-body" title="${esc(m.body)}">${esc(m.body || '—')}</div></td>
        <td style="color:var(--muted);font-size:.75rem;white-space:nowrap">${fmtTime(m.created_at)}</td>
      </tr>`).join('');
  } catch (err) {
    console.error('loadSentHistory error:', err);
  }
}

// ── Allow Ctrl+Enter to send ──────────────────────────────────
document.getElementById('send-message')?.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') sendMessage();
});

