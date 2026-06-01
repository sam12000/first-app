/* ── État global ──────────────────────────────────────────────────── */
let state = {
  campaigns: [],
  tests: [],
  anomalies: [],
  dashboard: {},
  activeCampaignId: '',
  currentPage: 'dashboard'
};

/* ── Init ─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupCampaignFilter();
  await loadAll();
  navigate('dashboard');
});

async function loadAll() {
  await Promise.all([
    loadCampaigns(),
    loadTests(),
    loadAnomalies(),
    loadDashboard()
  ]);
}

/* ── Navigation ───────────────────────────────────────────────────── */
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.page);
    });
  });
}

function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const titles = { dashboard: 'Dashboard', campaigns: 'Campagnes QA', tests: 'Cas de tests', anomalies: 'Anomalies', report: 'Rapport qualité' };
  document.getElementById('page-title').textContent = titles[page] || page;
  if (page === 'dashboard') renderDashboard();
  if (page === 'campaigns') renderCampaigns();
  if (page === 'tests') renderTests();
  if (page === 'anomalies') renderAnomalies();
  if (page === 'report') renderReport();
  if (page === 'settings') loadSettings();
}

/* ── Filtre campagne global ───────────────────────────────────────── */
function setupCampaignFilter() {
  document.getElementById('campaign-filter').addEventListener('change', async e => {
    state.activeCampaignId = e.target.value;
    updateEnvBadge();
    await loadDashboard();
    const page = state.currentPage;
    if (page === 'dashboard') renderDashboard();
    if (page === 'tests') renderTests();
    if (page === 'anomalies') renderAnomalies();
    if (page === 'report') renderReport();
  });
}

function updateEnvBadge() {
  const badge = document.getElementById('env-badge');
  if (!state.activeCampaignId) { badge.textContent = '–'; return; }
  const c = state.campaigns.find(c => c.id === state.activeCampaignId);
  badge.textContent = c ? c.env : '–';
}

function populateCampaignSelects() {
  const sel = document.getElementById('campaign-filter');
  const current = sel.value;
  sel.innerHTML = '<option value="">Toutes les campagnes</option>';
  state.campaigns.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = `${c.id} – ${c.name}`;
    sel.appendChild(o);
  });
  sel.value = current;
  // Modales
  ['test-campaign', 'anomaly-campaign'].forEach(id => {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = '';
    state.campaigns.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = `${c.id} – ${c.name}`;
      s.appendChild(o);
    });
  });
}

/* ── API Helpers ──────────────────────────────────────────────────── */
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  return r.json();
}

/* ── Load ─────────────────────────────────────────────────────────── */
async function loadCampaigns() {
  state.campaigns = await api('GET', '/api/campaigns');
  populateCampaignSelects();
}
async function loadTests() {
  const url = state.activeCampaignId ? `/api/tests?campaignId=${state.activeCampaignId}` : '/api/tests';
  state.tests = await api('GET', url);
}
async function loadAnomalies() {
  const url = state.activeCampaignId ? `/api/anomalies?campaignId=${state.activeCampaignId}` : '/api/anomalies';
  state.anomalies = await api('GET', url);
}
async function loadDashboard() {
  const url = state.activeCampaignId ? `/api/dashboard?campaignId=${state.activeCampaignId}` : '/api/dashboard';
  state.dashboard = await api('GET', url);
}

/* ── DASHBOARD ────────────────────────────────────────────────────── */
function renderDashboard() {
  const d = state.dashboard;
  document.getElementById('kpi-total').textContent = d.total ?? '–';
  document.getElementById('kpi-ok').textContent = d.ok ?? '–';
  document.getElementById('kpi-ko').textContent = d.ko ?? '–';
  document.getElementById('kpi-blocked').textContent = d.blocked ?? '–';
  document.getElementById('kpi-bugs').textContent = d.openBugs ?? '–';
  document.getElementById('kpi-coverage').textContent = d.coverage != null ? `${d.coverage}%` : '–';

  document.getElementById('progress-pct').textContent = `${d.coverage ?? 0}%`;
  document.getElementById('progress-bar').style.width = `${d.coverage ?? 0}%`;

  const sb = document.getElementById('status-breakdown');
  sb.innerHTML = `
    <span class="status-pill todo">À faire : ${d.todo ?? 0}</span>
    <span class="status-pill progress">En cours : ${d.inProgress ?? 0}</span>
    <span class="status-pill ok">OK : ${d.ok ?? 0}</span>
    <span class="status-pill ko">KO : ${d.ko ?? 0}</span>
    <span class="status-pill blocked">Bloqué : ${d.blocked ?? 0}</span>
  `;

  const badge = document.getElementById('gonogo-badge');
  const gng = d.goNoGo ?? 'EN ATTENTE';
  badge.textContent = gng;
  badge.className = 'gonogo-badge';
  if (gng.includes('GO') && !gng.includes('NO')) badge.classList.add('go');
  else if (gng.includes('NO GO')) badge.classList.add('nogo');
  else if (gng.includes('CONDITIONNEL')) badge.classList.add('cond');

  const criteria = document.getElementById('gonogo-criteria');
  criteria.innerHTML = `
    Couverture : <strong>${d.coverage ?? 0}%</strong><br>
    Tests KO : <strong>${d.ko ?? 0}</strong> · Bloqués : <strong>${d.blocked ?? 0}</strong><br>
    Anomalies critiques ouvertes : <strong>${d.criticalBugs ?? 0}</strong>
  `;
}

/* ── CAMPAGNES ────────────────────────────────────────────────────── */
function renderCampaigns() {
  const tbody = document.getElementById('campaigns-tbody');
  tbody.innerHTML = state.campaigns.length ? '' : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">Aucune campagne. Créez-en une !</td></tr>';
  state.campaigns.forEach(c => {
    const types = (c.types || []).map(t => `<span class="badge">${t}</span>`).join(' ');
    const statusCls = c.status === 'En cours' ? 'badge-progress' : c.status === 'Terminée' ? 'badge-ok' : '';
    tbody.innerHTML += `
      <tr>
        <td><code>${c.id}</code></td>
        <td><strong>${c.name}</strong>${c.description ? `<br><small style="color:var(--text-muted)">${c.description}</small>` : ''}</td>
        <td><span class="badge badge-env">${c.env}</span></td>
        <td>${types}</td>
        <td><span class="badge ${statusCls}">${c.status}</span></td>
        <td>${c.createdAt}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editCampaign('${c.id}')">✏️ Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCampaign('${c.id}')">🗑️</button>
        </td>
      </tr>`;
  });
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

async function saveCampaign(e) {
  e.preventDefault();
  const id = document.getElementById('campaign-id').value;
  const types = [...document.querySelectorAll('#form-campaign .checkbox-group input:checked')].map(i => i.value);
  const data = {
    name: document.getElementById('campaign-name').value,
    description: document.getElementById('campaign-desc').value,
    env: document.getElementById('campaign-env').value,
    status: document.getElementById('campaign-status').value,
    types
  };
  if (id) {
    await api('PUT', `/api/campaigns/${id}`, data);
    toast('Campagne mise à jour ✅');
  } else {
    await api('POST', '/api/campaigns', data);
    toast('Campagne créée ✅');
  }
  closeModal('modal-campaign');
  await loadCampaigns();
  renderCampaigns();
}

function editCampaign(id) {
  const c = state.campaigns.find(x => x.id === id);
  if (!c) return;
  document.getElementById('campaign-id').value = c.id;
  document.getElementById('campaign-name').value = c.name;
  document.getElementById('campaign-desc').value = c.description || '';
  document.getElementById('campaign-env').value = c.env;
  document.getElementById('campaign-status').value = c.status;
  document.querySelectorAll('#form-campaign .checkbox-group input').forEach(cb => {
    cb.checked = (c.types || []).includes(cb.value);
  });
  document.getElementById('modal-campaign-title').textContent = 'Modifier la campagne';
  openModal('modal-campaign');
}

async function deleteCampaign(id) {
  if (!confirm('Supprimer cette campagne ?')) return;
  await api('DELETE', `/api/campaigns/${id}`);
  toast('Campagne supprimée');
  await loadCampaigns();
  renderCampaigns();
}

// Reset form quand on ouvre "nouvelle campagne"
document.querySelector('[onclick="openModal(\'modal-campaign\')"]')?.addEventListener('click', () => {
  document.getElementById('form-campaign').reset();
  document.getElementById('campaign-id').value = '';
  document.getElementById('modal-campaign-title').textContent = 'Nouvelle campagne';
});

/* ── TESTS ────────────────────────────────────────────────────────── */
async function renderTests() {
  await loadTests();
  const filterStatus = document.getElementById('test-filter-status').value;
  const filterPriority = document.getElementById('test-filter-priority').value;
  let list = state.tests;
  if (filterStatus) list = list.filter(t => t.status === filterStatus);
  if (filterPriority) list = list.filter(t => t.priority === filterPriority);

  const container = document.getElementById('tests-list');
  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">Aucun cas de test. Créez-en un !</div>';
    return;
  }
  container.innerHTML = list.map(t => {
    const statusCls = { OK: 'ok', KO: 'ko', 'Bloqué': 'blocked', 'En cours': 'progress' }[t.status] || '';
    const badgeCls = { OK: 'badge-ok', KO: 'badge-ko', 'Bloqué': 'badge-blocked', 'En cours': 'badge-progress' }[t.status] || '';
    const prioCls = { P0: 'badge-p0', P1: 'badge-p1', P2: 'badge-p2' }[t.priority] || '';
    return `
      <div class="test-card ${statusCls}">
        <div class="test-card-header">
          <span class="test-id">${t.id}</span>
          <span class="test-title">${t.title}</span>
          <span class="badge ${badgeCls}">${t.status}</span>
          <span class="badge ${prioCls}">${t.priority}</span>
        </div>
        <div class="test-card-body">
          ${t.precondition ? `<div class="test-field"><label>Précondition</label>${t.precondition}</div>` : ''}
          <div class="test-field" style="grid-column:1/-1"><label>Étapes</label><pre style="white-space:pre-wrap;font-family:inherit">${t.steps || '–'}</pre></div>
          <div class="test-field"><label>Résultat attendu</label>${t.expected || '–'}</div>
          <div class="test-field"><label>Résultat obtenu</label>${t.obtained || '<em>Non renseigné</em>'}</div>
        </div>
        <div class="test-card-actions">
          <button class="btn btn-sm btn-secondary" onclick="editTest('${t.id}')">✏️ Modifier</button>
          <select class="btn btn-sm btn-secondary" style="padding:4px 8px" onchange="quickUpdateTestStatus('${t.id}', this.value)">
            <option value="">Changer statut…</option>
            <option>À faire</option><option>En cours</option><option>OK</option><option>KO</option><option>Bloqué</option>
          </select>
          <button class="btn btn-sm btn-danger" onclick="deleteTest('${t.id}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

async function quickUpdateTestStatus(id, status) {
  if (!status) return;
  await api('PUT', `/api/tests/${id}`, { status });
  toast(`Statut → ${status}`);
  await loadDashboard();
  renderTests();
  if (state.currentPage === 'dashboard') renderDashboard();
}

async function saveTest(e) {
  e.preventDefault();
  const id = document.getElementById('test-id').value;
  const data = {
    campaignId: document.getElementById('test-campaign').value,
    title: document.getElementById('test-title').value,
    priority: document.getElementById('test-priority').value,
    status: document.getElementById('test-status').value,
    precondition: document.getElementById('test-precondition').value,
    steps: document.getElementById('test-steps').value,
    expected: document.getElementById('test-expected').value,
    obtained: document.getElementById('test-obtained').value
  };
  if (id) {
    await api('PUT', `/api/tests/${id}`, data);
    toast('Test mis à jour ✅');
  } else {
    await api('POST', '/api/tests', data);
    toast('Test créé ✅');
  }
  closeModal('modal-test');
  await loadDashboard();
  renderTests();
}

function editTest(id) {
  const t = state.tests.find(x => x.id === id);
  if (!t) return;
  document.getElementById('test-id').value = t.id;
  document.getElementById('test-title').value = t.title;
  document.getElementById('test-priority').value = t.priority;
  document.getElementById('test-status').value = t.status;
  document.getElementById('test-campaign').value = t.campaignId;
  document.getElementById('test-precondition').value = t.precondition || '';
  document.getElementById('test-steps').value = t.steps || '';
  document.getElementById('test-expected').value = t.expected || '';
  document.getElementById('test-obtained').value = t.obtained || '';
  document.getElementById('modal-test-title').textContent = 'Modifier le cas de test';
  openModal('modal-test');
}

async function deleteTest(id) {
  if (!confirm('Supprimer ce cas de test ?')) return;
  await api('DELETE', `/api/tests/${id}`);
  toast('Test supprimé');
  await loadDashboard();
  renderTests();
}

/* ── ANOMALIES ────────────────────────────────────────────────────── */
async function renderAnomalies() {
  await loadAnomalies();
  const filterStatus = document.getElementById('anomaly-filter-status').value;
  const filterSeverity = document.getElementById('anomaly-filter-severity').value;
  let list = state.anomalies;
  if (filterStatus) list = list.filter(a => a.status === filterStatus);
  if (filterSeverity) list = list.filter(a => a.severity === filterSeverity);

  const container = document.getElementById('anomalies-list');
  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">Aucune anomalie enregistrée 🎉</div>';
    return;
  }
  container.innerHTML = list.map(a => {
    const cardCls = a.status === 'Résolu' || a.status === 'Fermé' ? 'resolved' : a.status === 'En cours' ? 'progress' : '';
    const sevCls = { Bloquante: 'badge-bloq', Critique: 'badge-crit', Majeure: 'badge-major', Mineure: 'badge-minor' }[a.severity] || '';
    const stCls = { Ouvert: 'badge-open', Résolu: 'badge-resolved', Fermé: 'badge-resolved' }[a.status] || '';
    const prioCls = { P0: 'badge-p0', P1: 'badge-p1', P2: 'badge-p2' }[a.priority] || '';
    return `
      <div class="anomaly-card ${cardCls}">
        <div class="anomaly-header">
          <span class="anomaly-id">${a.id}</span>
          <span class="anomaly-title">${a.title}</span>
          <span class="badge ${sevCls}">${a.severity}</span>
          <span class="badge ${prioCls}">${a.priority}</span>
          <span class="badge ${stCls}">${a.status}</span>
        </div>
        <div class="anomaly-body">
          <strong>Description :</strong> ${a.description}<br>
          ${a.steps ? `<strong>Reproduction :</strong> <pre style="white-space:pre-wrap;font-family:inherit;margin:4px 0">${a.steps}</pre>` : ''}
          ${a.expected ? `<strong>Attendu :</strong> ${a.expected}<br>` : ''}
          ${a.obtained ? `<strong>Obtenu :</strong> ${a.obtained}<br>` : ''}
          ${a.cause ? `<strong>Cause probable :</strong> ${a.cause}` : ''}
        </div>
        <div class="anomaly-footer">
          <button class="btn btn-sm btn-secondary" onclick="editAnomaly('${a.id}')">✏️ Modifier</button>
          <select class="btn btn-sm btn-secondary" style="padding:4px 8px" onchange="quickUpdateAnomalyStatus('${a.id}', this.value)">
            <option value="">Changer statut…</option>
            <option>Ouvert</option><option>En cours</option><option>Résolu</option><option>Fermé</option>
          </select>
          <button class="btn btn-sm btn-jira" onclick="exportJira('${a.id}')">📋 Export Jira</button>
          <button class="btn btn-sm btn-danger" onclick="deleteAnomaly('${a.id}')">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

async function quickUpdateAnomalyStatus(id, status) {
  if (!status) return;
  await api('PUT', `/api/anomalies/${id}`, { status });
  toast(`Statut → ${status}`);
  await loadDashboard();
  renderAnomalies();
}

async function saveAnomaly(e) {
  e.preventDefault();
  const id = document.getElementById('anomaly-id').value;
  const data = {
    campaignId: document.getElementById('anomaly-campaign').value,
    title: document.getElementById('anomaly-title').value,
    description: document.getElementById('anomaly-desc').value,
    severity: document.getElementById('anomaly-severity').value,
    priority: document.getElementById('anomaly-priority').value,
    status: document.getElementById('anomaly-status').value,
    steps: document.getElementById('anomaly-steps').value,
    expected: document.getElementById('anomaly-expected').value,
    obtained: document.getElementById('anomaly-obtained').value,
    cause: document.getElementById('anomaly-cause').value,
    linkedTest: document.getElementById('anomaly-linked').value
  };
  if (id) {
    await api('PUT', `/api/anomalies/${id}`, data);
    toast('Anomalie mise à jour ✅');
  } else {
    await api('POST', '/api/anomalies', data);
    toast('Anomalie créée ✅');
  }
  closeModal('modal-anomaly');
  await loadDashboard();
  renderAnomalies();
}

function editAnomaly(id) {
  const a = state.anomalies.find(x => x.id === id);
  if (!a) return;
  document.getElementById('anomaly-id').value = a.id;
  document.getElementById('anomaly-title').value = a.title;
  document.getElementById('anomaly-campaign').value = a.campaignId;
  document.getElementById('anomaly-desc').value = a.description || '';
  document.getElementById('anomaly-severity').value = a.severity;
  document.getElementById('anomaly-priority').value = a.priority;
  document.getElementById('anomaly-status').value = a.status;
  document.getElementById('anomaly-steps').value = a.steps || '';
  document.getElementById('anomaly-expected').value = a.expected || '';
  document.getElementById('anomaly-obtained').value = a.obtained || '';
  document.getElementById('anomaly-cause').value = a.cause || '';
  document.getElementById('anomaly-linked').value = a.linkedTest || '';
  document.getElementById('modal-anomaly-title').textContent = 'Modifier l\'anomalie';
  openModal('modal-anomaly');
}

async function deleteAnomaly(id) {
  if (!confirm('Supprimer cette anomalie ?')) return;
  await api('DELETE', `/api/anomalies/${id}`);
  toast('Anomalie supprimée');
  await loadDashboard();
  renderAnomalies();
}

async function exportJira(id) {
  const data = await api('GET', `/api/anomalies/${id}/jira`);
  const json = JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(json).then(() => toast('Format Jira copié dans le presse-papiers 📋'));
}

/* ── RAPPORT ──────────────────────────────────────────────────────── */
async function renderReport() {
  await Promise.all([loadTests(), loadAnomalies(), loadDashboard()]);
  const d = state.dashboard;
  const campaign = state.activeCampaignId
    ? state.campaigns.find(c => c.id === state.activeCampaignId)
    : null;

  const topBugs = [...state.anomalies]
    .filter(a => a.status !== 'Fermé')
    .sort((a, b) => {
      const sevOrder = { Bloquante: 0, Critique: 1, Majeure: 2, Mineure: 3 };
      return (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
    })
    .slice(0, 5);

  const risks = [];
  if ((d.ko || 0) > 0) risks.push(`${d.ko} test(s) KO non résolus`);
  if ((d.blocked || 0) > 0) risks.push(`${d.blocked} test(s) bloqués impactant la couverture`);
  if ((d.criticalBugs || 0) > 0) risks.push(`${d.criticalBugs} anomalie(s) bloquante(s)/critique(s) ouverte(s)`);
  if ((d.coverage || 0) < 80) risks.push(`Couverture insuffisante : ${d.coverage}% (seuil recommandé : 80%)`);

  const gngCls = (d.goNoGo || '').includes('GO') && !(d.goNoGo || '').includes('NO')
    ? 'go' : (d.goNoGo || '').includes('NO GO') ? 'nogo' : 'cond';
  const bgColor = { go: 'rgba(16,185,129,0.15)', nogo: 'rgba(239,68,68,0.15)', cond: 'rgba(245,158,11,0.15)' }[gngCls];
  const txtColor = { go: 'var(--success)', nogo: 'var(--danger)', cond: 'var(--warning)' }[gngCls];

  document.getElementById('report-content').innerHTML = `
    <div class="report-section">
      <h2>📊 Rapport qualité — ${campaign ? campaign.name : 'Toutes campagnes'}</h2>
      <p style="color:var(--text-muted);font-size:13px">Généré le ${new Date().toLocaleDateString('fr-FR')} · Données fictives à des fins QA</p>
    </div>

    <div class="report-section">
      <h2>1. Résumé exécutif</h2>
      ${campaign ? `<p style="margin-bottom:12px"><strong>Campagne :</strong> ${campaign.name} · <strong>Environnement :</strong> ${campaign.env} · <strong>Types :</strong> ${(campaign.types || []).join(', ')}</p>` : ''}
      <div class="report-kpi-row">
        <div class="report-kpi-item"><div class="val">${d.total ?? 0}</div><div class="lbl">Total tests</div></div>
        <div class="report-kpi-item"><div class="val" style="color:var(--success)">${d.ok ?? 0}</div><div class="lbl">OK</div></div>
        <div class="report-kpi-item"><div class="val" style="color:var(--danger)">${d.ko ?? 0}</div><div class="lbl">KO</div></div>
        <div class="report-kpi-item"><div class="val" style="color:var(--warning)">${d.blocked ?? 0}</div><div class="lbl">Bloqués</div></div>
        <div class="report-kpi-item"><div class="val" style="color:var(--info)">${d.openBugs ?? 0}</div><div class="lbl">Anomalies ouvertes</div></div>
        <div class="report-kpi-item"><div class="val" style="color:var(--purple)">${d.coverage ?? 0}%</div><div class="lbl">Couverture</div></div>
      </div>
    </div>

    <div class="report-section">
      <h2>2. Top anomalies</h2>
      ${topBugs.length ? `
        <table class="report-table">
          <thead><tr><th>ID</th><th>Titre</th><th>Sévérité</th><th>Priorité</th><th>Statut</th></tr></thead>
          <tbody>
            ${topBugs.map(a => `<tr><td><code>${a.id}</code></td><td>${a.title}</td><td>${a.severity}</td><td>${a.priority}</td><td>${a.status}</td></tr>`).join('')}
          </tbody>
        </table>` : '<p style="color:var(--success)">✅ Aucune anomalie ouverte.</p>'}
    </div>

    <div class="report-section">
      <h2>3. Risques identifiés</h2>
      ${risks.length
        ? risks.map(r => `<div class="risk-item">⚠️ ${r}</div>`).join('')
        : '<p style="color:var(--success)">✅ Aucun risque majeur identifié.</p>'}
    </div>

    <div class="report-section">
      <h2>4. Décision Go / No Go</h2>
      <div class="gonogo-big" style="background:${bgColor};color:${txtColor}">${d.goNoGo ?? 'EN ATTENTE'}</div>
      <div style="margin-top:12px;font-size:13px;color:var(--text-muted)">
        <strong>Critères appliqués :</strong><br>
        • GO si couverture ≥ 80%, aucun test KO, aucun test bloqué, aucune anomalie bloquante/critique<br>
        • CONDITIONNEL si couverture ≥ 50% sans anomalie critique<br>
        • NO GO si anomalie critique ouverte ou plus de 20% de tests KO/bloqués
      </div>
    </div>`;
}

/* ── Print ────────────────────────────────────────────────────────── */
function printReport() {
  window.print();
}

/* ── Toast ────────────────────────────────────────────────────────── */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ════════════════════════════════════════════════════════════════════
   PARAMÉTRAGE
   ════════════════════════════════════════════════════════════════════ */

let cfgData = {};

async function loadSettings() {
  const [project, environments, users, testTypes, severities, customFields, releases, workflow, integrations, aiSettings] = await Promise.all([
    api('GET', '/api/config/project'),
    api('GET', '/api/config/environments'),
    api('GET', '/api/config/users'),
    api('GET', '/api/config/test-types'),
    api('GET', '/api/config/severities'),
    api('GET', '/api/config/custom-fields'),
    api('GET', '/api/config/releases'),
    api('GET', '/api/config/workflow'),
    api('GET', '/api/config/integrations'),
    api('GET', '/api/config/ai')
  ]);
  cfgData = { project, environments, users, testTypes, severities, customFields, releases, workflow, integrations, aiSettings };
  renderAllSettings();
}

function renderAllSettings() {
  renderProjectForm();
  renderEnvTable();
  renderUsersGrid();
  renderTestTypesList();
  renderSeveritiesList();
  renderCFTable('test');
  renderReleases();
  renderWorkflow();
  renderIntegrations();
  renderAISettings();
}

// ── Onglets settings ──────────────────────────────────────────────────────────
document.querySelectorAll('.stab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.stab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panelId = `stab-${btn.dataset.stab}`;
    document.getElementById(panelId)?.classList.add('active');
  });
});

// ── PROJET ────────────────────────────────────────────────────────────────────
function renderProjectForm() {
  const p = cfgData.project || {};
  document.getElementById('proj-name').value    = p.name || '';
  document.getElementById('proj-version').value = p.version || '';
  document.getElementById('proj-desc').value    = p.description || '';
  document.getElementById('proj-url').value     = p.url || '';
  document.getElementById('proj-team').value    = p.team || '';
  document.getElementById('proj-owner').value   = p.owner || '';
  document.getElementById('proj-start').value   = p.startDate || '';
  document.getElementById('proj-end').value     = p.endDate || '';
}

async function saveProject(e) {
  e.preventDefault();
  await api('PUT', '/api/config/project', {
    name: document.getElementById('proj-name').value,
    version: document.getElementById('proj-version').value,
    description: document.getElementById('proj-desc').value,
    url: document.getElementById('proj-url').value,
    team: document.getElementById('proj-team').value,
    owner: document.getElementById('proj-owner').value,
    startDate: document.getElementById('proj-start').value,
    endDate: document.getElementById('proj-end').value
  });
  toast('Projet enregistré ✅');
}

// ── ENVIRONNEMENTS ────────────────────────────────────────────────────────────
function renderEnvTable() {
  const tbody = document.getElementById('env-tbody');
  const envs = cfgData.environments || [];
  tbody.innerHTML = envs.map(e => `
    <tr>
      <td><span class="badge badge-env">${e.name}</span></td>
      <td><a href="${e.url}" target="_blank" class="int-url" style="font-size:12px">${e.url}</a></td>
      <td><span class="badge">${e.auth}</span></td>
      <td><span class="badge ${e.status === 'Actif' ? 'badge-ok' : e.status === 'Lecture seule' ? 'badge-blocked' : ''}">${e.status}</span></td>
      <td style="color:var(--text-muted);font-size:12px">${e.notes || '–'}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editEnv('${e.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteEnv('${e.id}')">🗑️</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Aucun environnement</td></tr>';
}

async function saveEnv(e) {
  e.preventDefault();
  const id = document.getElementById('env-id').value;
  const data = {
    name: document.getElementById('env-name').value,
    url: document.getElementById('env-url').value,
    auth: document.getElementById('env-auth').value,
    status: document.getElementById('env-status').value,
    notes: document.getElementById('env-notes').value
  };
  if (id) { await api('PUT', `/api/config/environments/${id}`, data); toast('Environnement modifié ✅'); }
  else     { await api('POST', '/api/config/environments', data);     toast('Environnement ajouté ✅'); }
  closeModal('modal-env');
  cfgData.environments = await api('GET', '/api/config/environments');
  renderEnvTable();
}

function editEnv(id) {
  const e = cfgData.environments.find(x => x.id === id);
  if (!e) return;
  document.getElementById('env-id').value     = e.id;
  document.getElementById('env-name').value   = e.name;
  document.getElementById('env-url').value    = e.url;
  document.getElementById('env-auth').value   = e.auth;
  document.getElementById('env-status').value = e.status;
  document.getElementById('env-notes').value  = e.notes || '';
  document.getElementById('modal-env-title').textContent = 'Modifier l\'environnement';
  openModal('modal-env');
}

async function deleteEnv(id) {
  if (!confirm('Supprimer cet environnement ?')) return;
  await api('DELETE', `/api/config/environments/${id}`);
  toast('Environnement supprimé');
  cfgData.environments = await api('GET', '/api/config/environments');
  renderEnvTable();
}

// ── UTILISATEURS ─────────────────────────────────────────────────────────────
const roleColors = { 'QA Lead': '#6366f1', 'QA Engineer': '#10b981', 'Dev': '#3b82f6', 'PO': '#f59e0b', 'Observer': '#64748b' };

function renderUsersGrid() {
  const grid = document.getElementById('users-grid');
  grid.innerHTML = (cfgData.users || []).map(u => `
    <div class="user-card">
      <div class="user-avatar" style="background:${roleColors[u.role] || '#6366f1'}">${u.avatar}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-email">${u.email}</div>
        <span class="badge" style="margin-top:4px;background:${roleColors[u.role]}22;color:${roleColors[u.role]}">${u.role}</span>
        <span class="badge ${u.status === 'Actif' ? 'badge-ok' : ''}" style="margin-left:4px">${u.status}</span>
      </div>
      <div class="user-actions">
        <button class="btn btn-sm btn-secondary" title="Modifier" onclick="editUser('${u.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" title="Supprimer" onclick="deleteUser('${u.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById('user-id').value;
  const data = {
    name:   document.getElementById('user-name').value,
    email:  document.getElementById('user-email').value,
    role:   document.getElementById('user-role').value,
    status: document.getElementById('user-status').value
  };
  if (id) { await api('PUT', `/api/config/users/${id}`, data); toast('Utilisateur modifié ✅'); }
  else     { await api('POST', '/api/config/users', data);     toast('Utilisateur ajouté ✅'); }
  closeModal('modal-user');
  cfgData.users = await api('GET', '/api/config/users');
  renderUsersGrid();
}

function editUser(id) {
  const u = cfgData.users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('user-id').value     = u.id;
  document.getElementById('user-name').value   = u.name;
  document.getElementById('user-email').value  = u.email;
  document.getElementById('user-role').value   = u.role;
  document.getElementById('user-status').value = u.status;
  document.getElementById('modal-user-title').textContent = 'Modifier l\'utilisateur';
  openModal('modal-user');
}

async function deleteUser(id) {
  if (!confirm('Supprimer cet utilisateur ?')) return;
  await api('DELETE', `/api/config/users/${id}`);
  toast('Utilisateur supprimé');
  cfgData.users = await api('GET', '/api/config/users');
  renderUsersGrid();
}

// ── TYPES DE TESTS ────────────────────────────────────────────────────────────
function renderTestTypesList() {
  const list = document.getElementById('test-types-list');
  list.innerHTML = (cfgData.testTypes || []).map(t => `
    <div class="tt-item" style="border-left-color:${t.color}">
      <span class="tt-icon">${t.icon}</span>
      <div class="tt-info">
        <div class="tt-name">${t.name}</div>
        <div class="tt-desc">${t.description}</div>
      </div>
      <div class="tt-actions">
        <label class="toggle" title="${t.active ? 'Désactiver' : 'Activer'}">
          <input type="checkbox" ${t.active ? 'checked' : ''} onchange="toggleTestType('${t.id}', this.checked)" />
          <span class="toggle-slider"></span>
        </label>
        <button class="btn btn-sm btn-danger" onclick="deleteTestType('${t.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

async function saveTestType(e) {
  e.preventDefault();
  const id = document.getElementById('tt-id').value;
  const data = {
    name: document.getElementById('tt-name').value,
    icon: document.getElementById('tt-icon').value || '🧪',
    color: document.getElementById('tt-color').value,
    description: document.getElementById('tt-desc').value,
    active: true
  };
  if (id) { await api('PUT', `/api/config/test-types/${id}`, data); }
  else    { await api('POST', '/api/config/test-types', data); toast('Type de test ajouté ✅'); }
  closeModal('modal-test-type');
  cfgData.testTypes = await api('GET', '/api/config/test-types');
  renderTestTypesList();
}

async function toggleTestType(id, active) {
  await api('PUT', `/api/config/test-types/${id}`, { active });
  toast(active ? 'Type activé' : 'Type désactivé');
  cfgData.testTypes = await api('GET', '/api/config/test-types');
}

async function deleteTestType(id) {
  if (!confirm('Supprimer ce type de test ?')) return;
  await api('DELETE', `/api/config/test-types/${id}`);
  toast('Type supprimé');
  cfgData.testTypes = await api('GET', '/api/config/test-types');
  renderTestTypesList();
}

// ── SÉVÉRITÉS ─────────────────────────────────────────────────────────────────
function renderSeveritiesList() {
  const list = document.getElementById('severities-list');
  list.innerHTML = (cfgData.severities || []).sort((a,b) => a.level - b.level).map(s => `
    <div class="sev-item">
      <span class="sev-dot" style="background:${s.color}"></span>
      <div class="sev-info">
        <div class="sev-name">${s.name}</div>
        <div class="sev-meta">Niveau ${s.level} · SLA : <strong>${s.sla}</strong> · ${s.description}</div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteSeverity('${s.id}')">🗑️</button>
    </div>`).join('');

  const plist = document.getElementById('priorities-list');
  plist.innerHTML = (cfgData.severities || []).map((s, i) => `
    <div class="sev-item">
      <span class="sev-dot" style="background:${s.color}"></span>
      <div class="sev-info">
        <div class="sev-name">P${i} — ${s.name}</div>
        <div class="sev-meta">SLA prise en charge : <strong>${s.sla}</strong></div>
      </div>
    </div>`).join('');
}

async function saveSeverity(e) {
  e.preventDefault();
  const id = document.getElementById('sev-id').value;
  const data = {
    name: document.getElementById('sev-name').value,
    color: document.getElementById('sev-color').value,
    level: parseInt(document.getElementById('sev-level').value),
    sla: document.getElementById('sev-sla').value,
    description: document.getElementById('sev-desc').value
  };
  if (id) await api('PUT', `/api/config/severities/${id}`, data);
  else    { await api('POST', '/api/config/severities', data); toast('Sévérité ajoutée ✅'); }
  closeModal('modal-severity');
  cfgData.severities = await api('GET', '/api/config/severities');
  renderSeveritiesList();
}

async function deleteSeverity(id) {
  if (!confirm('Supprimer cette sévérité ?')) return;
  await api('DELETE', `/api/config/severities/${id}`);
  toast('Sévérité supprimée');
  cfgData.severities = await api('GET', '/api/config/severities');
  renderSeveritiesList();
}

// ── CHAMPS PERSONNALISÉS ──────────────────────────────────────────────────────
let cfFilter = 'test';

function filterCF(entity, btn) {
  cfFilter = entity;
  document.querySelectorAll('.cf-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCFTable(entity);
}

function renderCFTable(entity) {
  const tbody = document.getElementById('cf-tbody');
  const fields = (cfgData.customFields || []).filter(f => f.entity === entity);
  tbody.innerHTML = fields.map(f => `
    <tr>
      <td><strong>${f.name}</strong></td>
      <td><span class="badge">${f.type}</span></td>
      <td><span class="badge badge-env">${f.entity === 'test' ? 'Test' : 'Anomalie'}</span></td>
      <td>${f.required ? '✅ Oui' : '–'}</td>
      <td style="font-size:11px;color:var(--text-muted)">${(f.options||[]).join(', ') || '–'}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${f.active ? 'checked' : ''} onchange="toggleCF('${f.id}', this.checked)" />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteCF('${f.id}')">🗑️</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:16px">Aucun champ personnalisé sur les ${entity === 'test' ? 'tests' : 'anomalies'}</td></tr>`;
}

function toggleCFOptions() {
  const type = document.getElementById('cf-type').value;
  document.getElementById('cf-options-group').style.display = type === 'select' ? 'block' : 'none';
}

async function saveCF(e) {
  e.preventDefault();
  const id = document.getElementById('cf-id').value;
  const type = document.getElementById('cf-type').value;
  const optStr = document.getElementById('cf-options').value;
  const data = {
    name: document.getElementById('cf-name').value,
    type,
    entity: document.getElementById('cf-entity').value,
    required: document.getElementById('cf-required').value === 'true',
    options: type === 'select' ? optStr.split(',').map(s => s.trim()).filter(Boolean) : [],
    active: true
  };
  if (id) await api('PUT', `/api/config/custom-fields/${id}`, data);
  else    { await api('POST', '/api/config/custom-fields', data); toast('Champ ajouté ✅'); }
  closeModal('modal-cf');
  cfgData.customFields = await api('GET', '/api/config/custom-fields');
  renderCFTable(cfFilter);
}

async function toggleCF(id, active) {
  await api('PUT', `/api/config/custom-fields/${id}`, { active });
  cfgData.customFields = await api('GET', '/api/config/custom-fields');
}

async function deleteCF(id) {
  if (!confirm('Supprimer ce champ ?')) return;
  await api('DELETE', `/api/config/custom-fields/${id}`);
  toast('Champ supprimé');
  cfgData.customFields = await api('GET', '/api/config/custom-fields');
  renderCFTable(cfFilter);
}

// ── RELEASES & CYCLES ─────────────────────────────────────────────────────────
function renderReleases() {
  const list = document.getElementById('releases-list');
  const statusCls = { 'En cours': 'badge-progress', 'Terminée': 'badge-ok', 'Planifiée': '' };
  list.innerHTML = (cfgData.releases || []).map(r => `
    <div class="release-item">
      <div class="release-header" onclick="toggleRelease('${r.id}')">
        <span style="font-size:18px">🚀</span>
        <span class="release-name">${r.name}</span>
        <span class="badge badge-env">${r.version}</span>
        <span class="badge ${statusCls[r.status]||''}">${r.status}</span>
        <span style="font-size:12px;color:var(--text-muted)">${r.startDate} → ${r.endDate}</span>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteRelease('${r.id}')">🗑️</button>
      </div>
      <div class="release-cycles" id="cycles-${r.id}" style="display:none">
        ${(r.cycles||[]).map(c => `
          <div class="cycle-item">
            <span style="color:var(--text-muted);font-size:11px">📅</span>
            <span class="cycle-name">${c.name}</span>
            <span class="badge">${c.status}</span>
            <span style="font-size:11px;color:var(--text-muted)">${c.startDate} → ${c.endDate}</span>
            <button class="btn btn-sm btn-danger" onclick="deleteCycle('${r.id}','${c.id}')">🗑️</button>
          </div>`).join('')}
        <button class="btn btn-sm btn-secondary add-cycle-btn" onclick="addCycle('${r.id}')">+ Ajouter un cycle</button>
      </div>
    </div>`).join('') || '<p style="color:var(--text-muted);text-align:center;padding:20px">Aucune release définie</p>';
}

function toggleRelease(id) {
  const el = document.getElementById(`cycles-${id}`);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveRelease(e) {
  e.preventDefault();
  const data = {
    name:      document.getElementById('rel-name').value,
    version:   document.getElementById('rel-version').value,
    startDate: document.getElementById('rel-start').value,
    endDate:   document.getElementById('rel-end').value,
    status:    document.getElementById('rel-status').value
  };
  await api('POST', '/api/config/releases', data);
  toast('Release créée ✅');
  closeModal('modal-release');
  cfgData.releases = await api('GET', '/api/config/releases');
  renderReleases();
}

async function deleteRelease(id) {
  if (!confirm('Supprimer cette release ?')) return;
  await api('DELETE', `/api/config/releases/${id}`);
  toast('Release supprimée');
  cfgData.releases = await api('GET', '/api/config/releases');
  renderReleases();
}

async function addCycle(releaseId) {
  const name = prompt('Nom du cycle :');
  if (!name) return;
  const start = prompt('Date début (YYYY-MM-DD) :');
  const end   = prompt('Date fin (YYYY-MM-DD) :');
  await api('POST', `/api/config/releases/${releaseId}/cycles`, { name, startDate: start, endDate: end, status: 'Planifié' });
  toast('Cycle ajouté ✅');
  cfgData.releases = await api('GET', '/api/config/releases');
  renderReleases();
  document.getElementById(`cycles-${releaseId}`).style.display = 'block';
}

async function deleteCycle(releaseId, cycleId) {
  if (!confirm('Supprimer ce cycle ?')) return;
  await api('DELETE', `/api/config/releases/${releaseId}/cycles/${cycleId}`);
  toast('Cycle supprimé');
  cfgData.releases = await api('GET', '/api/config/releases');
  renderReleases();
}

// ── WORKFLOW ──────────────────────────────────────────────────────────────────
function renderWorkflow() {
  const wf = cfgData.workflow || {};

  const renderStatus = (statuses, containerId) => {
    document.getElementById(containerId).innerHTML = (statuses || []).map(s => `
      <div class="ws-item">
        <span class="ws-dot" style="background:${s.color}"></span>
        <span class="ws-name">${s.name}</span>
        ${s.initial ? '<span class="ws-badge">Initial</span>' : ''}
        ${s.final   ? '<span class="ws-badge">Final</span>'   : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteWStatus('${s.id}','${containerId}')">🗑️</button>
      </div>`).join('');
  };

  renderStatus(wf.testStatuses,    'wf-test-statuses');
  renderStatus(wf.anomalyStatuses, 'wf-anomaly-statuses');

  document.getElementById('wf-transitions').innerHTML = (wf.transitions || []).map(t => `
    <tr>
      <td><span class="badge badge-progress">${t.from}</span></td>
      <td><span class="badge badge-ok">${t.to}</span></td>
      <td>${(t.roles || []).map(r => `<span class="badge">${r}</span>`).join(' ')}</td>
    </tr>`).join('');
}

async function saveWStatus(e) {
  e.preventDefault();
  const entity = document.getElementById('wstatus-entity').value;
  const data = {
    name: document.getElementById('ws-name').value,
    color: document.getElementById('ws-color').value,
    initial: document.getElementById('ws-initial').value === 'true',
    final:   document.getElementById('ws-final').value   === 'true'
  };
  const url = entity === 'test' ? '/api/config/workflow/test-statuses' : '/api/config/workflow/anomaly-statuses';
  await api('POST', url, data);
  toast('Statut ajouté ✅');
  closeModal('modal-wstatus');
  cfgData.workflow = await api('GET', '/api/config/workflow');
  renderWorkflow();
}

async function deleteWStatus(id, containerId) {
  if (!confirm('Supprimer ce statut ?')) return;
  const isTest = containerId === 'wf-test-statuses';
  await api('DELETE', `/api/config/workflow/${isTest ? 'test' : 'anomaly'}-statuses/${id}`);
  toast('Statut supprimé');
  cfgData.workflow = await api('GET', '/api/config/workflow');
  renderWorkflow();
}

// ── INTÉGRATIONS ──────────────────────────────────────────────────────────────
function renderIntegrations() {
  const grid = document.getElementById('integrations-grid');
  grid.innerHTML = (cfgData.integrations || []).map(int => {
    const connected = int.status === 'Connecté';
    return `
      <div class="int-card">
        <div class="int-header">
          <span class="int-icon">${int.icon}</span>
          <div>
            <div class="int-name">${int.name}</div>
            <span class="badge ${connected ? 'badge-ok' : 'badge-ko'}">${int.status}</span>
          </div>
        </div>
        <div class="int-body">
          ${int.url ? `<div>🔗 <a href="${int.url}" target="_blank" class="int-url">${int.url}</a></div>` : '<div style="color:var(--text-muted)">Non configuré</div>'}
          ${int.project ? `<div>📁 Projet : <strong>${int.project}</strong></div>` : ''}
          ${int.apiKey  ? `<div>🔑 API Key : <code>${int.apiKey}</code></div>` : ''}
          <div style="margin-top:6px;color:var(--primary)">↕️ ${int.sync}</div>
        </div>
        <div class="int-actions">
          <button class="btn btn-sm ${connected ? 'btn-danger' : 'btn-primary'}" onclick="toggleIntegration('${int.id}', ${connected})">
            ${connected ? '🔌 Déconnecter' : '🔗 Connecter'}
          </button>
          ${connected ? `<button class="btn btn-sm btn-secondary" onclick="testIntegration('${int.id}')">🧪 Tester</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function toggleIntegration(id, isConnected) {
  await api('PUT', `/api/config/integrations/${id}`, { status: isConnected ? 'Déconnecté' : 'Connecté' });
  toast(isConnected ? 'Intégration déconnectée' : 'Intégration connectée ✅');
  cfgData.integrations = await api('GET', '/api/config/integrations');
  renderIntegrations();
}

function testIntegration(id) {
  const int = cfgData.integrations.find(x => x.id === id);
  toast(`🧪 Test de connexion ${int?.name}… OK ✅`);
}

// ── IA ────────────────────────────────────────────────────────────────────────
const aiFeatureLabels = {
  autoGenerateTests:    { label: '✨ Génération auto de tests',      desc: 'Crée des cas de tests depuis une exigence' },
  smartPrioritization:  { label: '🎯 Priorisation intelligente',     desc: 'Suggère les tests à exécuter en priorité' },
  anomalySuggestion:    { label: '🐛 Suggestion d\'anomalies',       desc: 'Détecte les patterns d\'anomalies' },
  goNoGoPrediction:     { label: '🚦 Prédiction Go/No Go',           desc: 'Prédit la décision basée sur les métriques' },
  naturalLanguageSteps: { label: '📝 Steps en langage naturel',      desc: 'Traduit les exigences en étapes de test' },
  duplicateDetection:   { label: '🔍 Détection de doublons',         desc: 'Identifie les tests et anomalies en doublon' },
  coverageAnalysis:     { label: '📊 Analyse de couverture',         desc: 'Évalue la couverture fonctionnelle' },
  riskScoring:          { label: '⚠️ Score de risque',               desc: 'Calcule un score de risque par fonctionnalité' }
};

function renderAISettings() {
  const ai = cfgData.aiSettings || {};
  document.getElementById('ai-model').value      = ai.model || 'claude-sonnet';
  document.getElementById('ai-lang').value       = ai.language || 'fr';
  document.getElementById('ai-url').value        = ai.contextUrl || '';
  document.getElementById('ai-confidence').value = ai.minConfidenceScore ?? 75;
  document.getElementById('ai-max').value        = ai.maxSuggestionsPerRun ?? 10;
  document.getElementById('ai-enabled').checked  = ai.enabled !== false;
  document.getElementById('ai-auto-gen').checked = ai.autoGenerateOnRequirement === true;

  const featList = document.getElementById('ai-features-list');
  featList.innerHTML = Object.entries(aiFeatureLabels).map(([key, info]) => `
    <div class="ai-feature-item">
      <div>
        <div class="ai-feature-name">${info.label}</div>
        <div class="ai-feature-desc">${info.desc}</div>
      </div>
      <label class="toggle">
        <input type="checkbox" ${(ai.features||{})[key] ? 'checked' : ''} onchange="toggleAIFeature('${key}', this.checked)" />
        <span class="toggle-slider"></span>
      </label>
    </div>`).join('');
}

async function toggleAIFeature(key, val) {
  await api('PUT', '/api/config/ai', { features: { [key]: val } });
  toast(`Fonctionnalité IA ${val ? 'activée' : 'désactivée'}`);
}

async function saveAI(e) {
  e.preventDefault();
  await api('PUT', '/api/config/ai', {
    model:                    document.getElementById('ai-model').value,
    language:                 document.getElementById('ai-lang').value,
    contextUrl:               document.getElementById('ai-url').value,
    minConfidenceScore:       parseInt(document.getElementById('ai-confidence').value),
    maxSuggestionsPerRun:     parseInt(document.getElementById('ai-max').value),
    enabled:                  document.getElementById('ai-enabled').checked,
    autoGenerateOnRequirement:document.getElementById('ai-auto-gen').checked
  });
  toast('Configuration IA enregistrée ✅');
}

async function generateAITests() {
  const req = document.getElementById('ai-requirement').value.trim();
  if (!req) { toast('⚠️ Décrivez d\'abord une exigence'); return; }
  const count = parseInt(document.getElementById('ai-count').value);
  const results = document.getElementById('ai-results');
  results.innerHTML = '<div class="ai-loading">✨ Génération en cours…</div>';
  const data = await api('POST', '/api/ai/generate-tests', { requirement: req, count });
  if (!data.suggestions?.length) { results.innerHTML = '<div class="ai-loading">Aucune suggestion générée.</div>'; return; }
  results.innerHTML = data.suggestions.map((s, i) => `
    <div class="ai-result-card">
      <div class="ai-result-header">
        <span class="ai-result-title">${s.title}</span>
        <span class="ai-confidence">✅ ${s.confidence}%</span>
        <span class="badge ${s.priority === 'P0' ? 'badge-p0' : s.priority === 'P1' ? 'badge-p1' : 'badge-p2'}">${s.priority}</span>
      </div>
      <div class="ai-result-body">
        <strong>Étapes :</strong><pre style="white-space:pre-wrap;font-family:inherit;margin:4px 0">${s.steps}</pre>
        <strong>Résultat attendu :</strong> ${s.expected}
      </div>
      <div class="ai-result-actions">
        <button class="btn btn-sm btn-primary" onclick="importAITest(${i})">⬇️ Importer dans les tests</button>
      </div>
    </div>`).join('');
  window._aiSuggestions = data.suggestions;
}

async function importAITest(idx) {
  const s = window._aiSuggestions[idx];
  if (!s) return;
  const campaigns = await api('GET', '/api/campaigns');
  const campaignId = state.activeCampaignId || (campaigns[0]?.id ?? '');
  if (!campaignId) { toast('⚠️ Sélectionnez d\'abord une campagne'); return; }
  await api('POST', '/api/tests', {
    campaignId, title: s.title, priority: s.priority, status: s.status,
    steps: s.steps, expected: s.expected, obtained: '', precondition: ''
  });
  toast(`Test importé ✅ — ${s.title}`);
}

// ── Modale wstatus helper ─────────────────────────────────────────────────────
function openModal(id, extra) {
  if (id === 'modal-wstatus' && extra) {
    document.getElementById('wstatus-entity').value = extra;
    document.getElementById('modal-wstatus-title').textContent = extra === 'test' ? 'Nouveau statut — Test' : 'Nouveau statut — Anomalie';
    document.getElementById('form-wstatus').reset();
  }
  document.getElementById(id).classList.add('open');
}

/* ── Reset modales à l'ouverture ──────────────────────────────────── */
document.querySelectorAll('[onclick^="openModal"]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
    const form = document.querySelector(`#${modalId} form`);
    if (form) {
      form.reset();
      const hiddenId = form.querySelector('input[type="hidden"]');
      if (hiddenId) hiddenId.value = '';
    }
    // Retitrer
    const titleEl = document.getElementById(`modal-${modalId.replace('modal-', '')}-title`);
    if (titleEl) {
      const map = { 'modal-campaign': 'Nouvelle campagne', 'modal-test': 'Nouveau cas de test', 'modal-anomaly': 'Nouvelle anomalie' };
      titleEl.textContent = map[modalId] || 'Nouveau';
    }
    populateCampaignSelects();
    // Pré-sélectionner la campagne active
    if (state.activeCampaignId) {
      ['test-campaign', 'anomaly-campaign'].forEach(id => {
        const s = document.getElementById(id);
        if (s) s.value = state.activeCampaignId;
      });
    }
  });
});

/* ── Fermer modale en cliquant overlay ───────────────────────────── */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

