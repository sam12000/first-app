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
  if (gng.includes('GO ✅') && !gng.includes('NO')) badge.classList.add('go');
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

function openModal(id) {
  document.getElementById(id).classList.add('open');
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

  const gngCls = (d.goNoGo || '').includes('GO ✅') && !(d.goNoGo || '').includes('NO')
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
