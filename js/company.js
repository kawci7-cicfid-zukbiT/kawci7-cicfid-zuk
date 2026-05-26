// ====================================================================
// COMPANY.JS - Private Company Database
// ====================================================================
// ====================================================================
// STATE COMPANY
// ====================================================================
var CompanyState = {
    companyId:   null,
    companyName: null,
    role:        null,
    joinedAt:    null,
    expiresAt:   null,

    load: function() {
        try {
            var s = JSON.parse(localStorage.getItem('wvtr_company') || 'null');
            if (!s) return false;
            if (s.expiresAt && new Date(s.expiresAt) < new Date()) { this.clear(); return false; }
            this.companyId = s.companyId; this.companyName = s.companyName;
            this.role = s.role; this.joinedAt = s.joinedAt; this.expiresAt = s.expiresAt;
            return true;
        } catch(e) { return false; }
    },
    save: function() {
        localStorage.setItem('wvtr_company', JSON.stringify({
            companyId: this.companyId, companyName: this.companyName,
            role: this.role, joinedAt: this.joinedAt, expiresAt: this.expiresAt
        }));
    },
    clear: function() {
        this.companyId = this.companyName = this.role = this.joinedAt = this.expiresAt = null;
        localStorage.removeItem('wvtr_company');
    },
    isActive: function() {
        if (!this.companyId) return false;
        if (this.expiresAt && new Date(this.expiresAt) < new Date()) { this.clear(); return false; }
        return true;
    },
    daysLeft: function() {
        if (!this.expiresAt) return null;
        return Math.max(0, Math.ceil((new Date(this.expiresAt) - new Date()) / 86400000));
    }
};

// ====================================================================
// CODICE ACCESSO
// ====================================================================
function generateCompanyCode(durationDays) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    var expiresAt = null;
    if (durationDays === 30)  expiresAt = new Date(Date.now() + 30  * 86400000).toISOString();
    if (durationDays === 180) expiresAt = new Date(Date.now() + 180 * 86400000).toISOString();
    return { code: code, expiresAt: expiresAt };
}

// ====================================================================
// FIRESTORE HELPERS
// ====================================================================
function compCol(sub) {
    return window.fbCollection(window.communityDB, 'companies', CompanyState.companyId, sub);
}

async function saveCompanyMaterial(mat) {
    if (!CompanyState.isActive() || !window.communityDB) return { success: false, error: 'Not in a company' };
    try {
        var payload = {
            name: mat.name, family: mat.family || 'Other',
            testMethodWVTR: mat.testMethodWVTR || '', testMethodOTR: mat.testMethodOTR || '',
            isMetallized: mat.isMetallized || false,
            hygroscopicBetaWVTR: mat.hygroscopicBetaWVTR || 0, hygroscopicRefRHWVTR: mat.hygroscopicRefRHWVTR || 50,
            hygroscopicBetaOTR: mat.hygroscopicBetaOTR || 0, hygroscopicRefRHOTR: mat.hygroscopicRefRHOTR || 50,
            wvtrValues: mat.wvtrValues || [], otrValues: mat.otrValues || [],
            validConditions: mat.validConditions || [],
            company: mat.company || '', tdsLink: mat.tdsLink || '',
            supplierEmail: mat.supplierEmail || '',
            sharedBy: window.getOrCreateUserId(), updatedAt: new Date().toISOString()
        };
        if (mat._companyDocId) {
            await window.fbUpdateDoc(window.fbDoc(window.communityDB, 'companies', CompanyState.companyId, 'materials', mat._companyDocId), payload);
            return { success: true, id: mat._companyDocId };
        } else {
            payload.createdAt = new Date().toISOString();
            var docRef = await window.fbAddDoc(compCol('materials'), payload);
            return { success: true, id: docRef.id };
        }
    } catch(e) { return { success: false, error: e.message }; }
}

async function loadCompanyMaterials() {
    if (!CompanyState.isActive() || !window.communityDB) return [];
    try {
        var snap = await window.fbGetDocs(window.fbQuery(compCol('materials'), window.fbOrderBy('createdAt', 'desc')));
        var mats = [];
        snap.forEach(function(d) {
            var data = d.data();
            mats.push(Object.assign({}, data, {
                id: 'co_' + d.id, _companyDocId: d.id,
                isCompany: true, isCommunity: false,
                reliabilityVotes: data.reliabilityVotes || { up: 0, down: 0 },
                usageCount: data.usageCount || 0
            }));
        });
        return mats;
    } catch(e) { console.warn('loadCompanyMaterials error:', e); return []; }
}

async function saveCompanyLaminate(lam) {
    if (!CompanyState.isActive() || !window.communityDB) return { success: false, error: 'Not in a company' };
    try {
        var payload = {
            name: lam.name, total: lam.total, totalThickness: lam.totalThickness,
            humidity: lam.humidity, temperature: lam.temperature, mode: lam.mode,
            recyclable: lam.recyclable, monoStructure: lam.monoStructure,
            layerCount: lam.layerCount, layers: lam.layers || [],
            sharedBy: window.getOrCreateUserId(), updatedAt: new Date().toISOString()
        };
        if (lam._companyLamId) {
            await window.fbUpdateDoc(window.fbDoc(window.communityDB, 'companies', CompanyState.companyId, 'laminates', lam._companyLamId), payload);
            return { success: true, id: lam._companyLamId };
        } else {
            payload.createdAt = new Date().toISOString();
            var docRef = await window.fbAddDoc(compCol('laminates'), payload);
            return { success: true, id: docRef.id };
        }
    } catch(e) { return { success: false, error: e.message }; }
}

async function loadCompanyLaminates() {
    if (!CompanyState.isActive() || !window.communityDB) return [];
    try {
        var snap = await window.fbGetDocs(window.fbQuery(compCol('laminates'), window.fbOrderBy('createdAt', 'desc')));
        var lams = [];
        snap.forEach(function(d) {
            var data = d.data();
            lams.push(Object.assign({}, data, { id: 'col_' + d.id, _companyLamId: d.id, isCompany: true }));
        });
        return lams;
    } catch(e) { console.warn('loadCompanyLaminates error:', e); return []; }
}

async function deleteCompanyMaterial(docId) {
    if (!CompanyState.isActive() || !window.communityDB) return;
    try {
        var { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await deleteDoc(window.fbDoc(window.communityDB, 'companies', CompanyState.companyId, 'materials', docId));
    } catch(e) { console.warn('deleteCompanyMaterial error:', e); }
}

async function deleteCompanyLaminate(docId) {
    if (!CompanyState.isActive() || !window.communityDB) return;
    try {
        var { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await deleteDoc(window.fbDoc(window.communityDB, 'companies', CompanyState.companyId, 'laminates', docId));
    } catch(e) { console.warn('deleteCompanyLaminate error:', e); }
}

// ====================================================================
// CREA / JOIN COMPANY
// ====================================================================
async function createCompany(companyName, durationDays) {
    if (!window.communityDB) { alert('Database not connected'); return; }
    var gen = generateCompanyCode(durationDays);
    var companyId = 'co_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7).toUpperCase();
    try {
        var { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await setDoc(window.fbDoc(window.communityDB, 'companies', companyId), {
            name: companyName, code: gen.code, expiresAt: gen.expiresAt,
            createdAt: new Date().toISOString(), createdBy: window.getOrCreateUserId()
        });
        CompanyState.companyId = companyId; CompanyState.companyName = companyName;
        CompanyState.role = 'admin'; CompanyState.joinedAt = new Date().toISOString();
        CompanyState.expiresAt = gen.expiresAt; CompanyState.save();
        showCompanyCreatedModal(companyName, gen.code, gen.expiresAt);
    } catch(e) { alert('Error creating company: ' + e.message); }
}

async function joinCompany(inputCode) {
    if (!window.communityDB) { alert('Database not connected'); return; }
    var cleanCode = inputCode.trim().toUpperCase().replace(/\s/g, '');
    try {
        var { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        var snap = await getDocs(query(collection(window.communityDB, 'companies'), where('code', '==', cleanCode)));
        if (snap.empty) { alert('Code not found. Check and try again.'); return; }
        var d = snap.docs[0]; var data = d.data();
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) { alert('This access code has expired.'); return; }
        CompanyState.companyId = d.id; CompanyState.companyName = data.name;
        CompanyState.role = 'member'; CompanyState.joinedAt = new Date().toISOString();
        CompanyState.expiresAt = data.expiresAt || null; CompanyState.save();
        Modal.close();
        showCompanyToast('Joined <strong>' + data.name + '</strong> successfully!', '#15803d');
        setTimeout(function() { render(); }, 400);
    } catch(e) { alert('Error joining company: ' + e.message); }
}

// ====================================================================
// MODAL PRINCIPALE
// ====================================================================
function showCompanyModal() {
    var isActive = CompanyState.isActive();
    var daysLeft = CompanyState.daysLeft();
    var body = '';

    body += '<div style="background:#fef3c7;border:2px solid #fcd34d;border-radius:10px;padding:0.85rem 1rem;margin-bottom:1.25rem">' +
        '<div style="display:flex;gap:0.5rem;align-items:flex-start"><span style="font-size:1.1rem;flex-shrink:0">⚠️</span>' +
        '<div><div style="font-size:0.82rem;font-weight:700;color:#92400e;margin-bottom:0.3rem">Important Disclaimer</div>' +
        '<div style="font-size:0.75rem;color:#78350f;line-height:1.55">This database accepts only packaging material technical parameters (WVTR, OTR, thickness, test conditions). Please do not submit confidential, commercial, or personal data.</div>' +
        '</div></div></div>';

    if (isActive) {
        var expiryLabel = daysLeft === null ? '<span style="color:#16a34a;font-weight:600">Never expires</span>'
            : daysLeft > 0 ? '<span style="color:#d97706;font-weight:600">' + daysLeft + ' days left</span>'
            : '<span style="color:#dc2626;font-weight:600">Expired</span>';
        body += '<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:1rem;margin-bottom:1rem">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
            '<strong style="font-size:0.92rem;color:#0f172a">' + CompanyState.companyName + '</strong>' +
            '<span class="badge badge-green" style="margin-left:auto">' + CompanyState.role + '</span></div>' +
            '<div style="font-size:0.75rem;color:#64748b">Access: ' + expiryLabel + '</div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.75rem">' +
            '<button class="btn btn-outline" onclick="Modal.close();State.tab=\'mat-company\';renderNav();renderContent()" style="font-size:0.82rem">Materials Company</button>' +
            '<button class="btn btn-outline" onclick="Modal.close();State.tab=\'lam-company\';renderNav();renderContent()" style="font-size:0.82rem">Laminates Company</button>' +
            '</div>' +
            // DOPO (mostra codice inline + bottone manage):
(CompanyState.role === 'admin' ? 
    '<div id="co-code-preview" style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:10px;padding:0.85rem;margin-bottom:0.6rem;text-align:center">' +
    '<div style="font-size:0.65rem;font-weight:700;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.4rem">Your Access Code</div>' +
    '<div id="co-code-value" style="font-family:monospace;font-size:1.1rem;font-weight:800;letter-spacing:0.12em;color:#0f172a;margin-bottom:0.5rem">Loading...</div>' +
    '<button onclick="copyCompanyCode(document.getElementById(\'co-code-value\').textContent)" class="btn btn-sm btn-outline">Copy</button>' +
    '</div>' +
    '<button class="btn btn-outline btn-full" onclick="showCompanyCodeManager()" style="font-size:0.82rem;margin-bottom:0.5rem">Manage / Regenerate Code</button>' 
: '') +
            '<button class="btn btn-danger btn-full" onclick="leaveCompany()" style="font-size:0.82rem">Leave Company</button>';
    } else {
        body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">' +
            '<div style="border:1.5px solid var(--border);border-radius:10px;padding:1rem">' +
            '<div style="font-weight:700;font-size:0.88rem;margin-bottom:0.3rem">Join a Company</div>' +
            '<div style="font-size:0.72rem;color:var(--text-light);margin-bottom:0.75rem">Enter the access code from your admin.</div>' +
            '<input type="text" id="co-join-code" class="form-input" placeholder="XXXX-XXXX-XXXX-XXXX" style="font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.5rem" oninput="this.value=this.value.toUpperCase()">' +
            '<button class="btn btn-primary btn-full" onclick="joinCompany(document.getElementById(\'co-join-code\').value)" style="font-size:0.82rem">Join</button></div>' +
            '<div style="border:1.5px solid var(--border);border-radius:10px;padding:1rem">' +
            '<div style="font-weight:700;font-size:0.88rem;margin-bottom:0.3rem">Create Company DB</div>' +
            '<div style="font-size:0.72rem;color:var(--text-light);margin-bottom:0.75rem">Create a private space for your team.</div>' +
            '<input type="text" id="co-create-name" class="form-input" placeholder="Company name" style="margin-bottom:0.5rem">' +
            '<select id="co-create-duration" class="form-input" style="margin-bottom:0.75rem"><option value="30">30 days</option><option value="180">180 days</option><option value="0">Forever</option></select>' +
            '<button class="btn btn-success btn-full" onclick="createCompanyFromModal()" style="font-size:0.82rem">Create</button></div></div>';
    }
    Modal.open('Company Database', body, function() { return true; });
    var footer = document.getElementById('modal-footer');
    if (footer) footer.style.display = 'none';

if (CompanyState.isActive() && CompanyState.role === 'admin') {
        setTimeout(loadAndShowCompanyCode, 150);
    }
}

function createCompanyFromModal() {
    var name = (document.getElementById('co-create-name')?.value || '').trim();
    var dur  = parseInt(document.getElementById('co-create-duration')?.value || '0');
    if (!name) { alert('Enter a company name'); return; }
    Modal.close();
    createCompany(name, dur || null);
}

function showCompanyCreatedModal(name, code, expiresAt) {
    var expiryStr = expiresAt ? 'Expires: ' + new Date(expiresAt).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) : 'Never expires';
    var body = '<div style="text-align:center;margin-bottom:1.25rem"><div style="font-size:2rem;margin-bottom:0.5rem"></div>' +
        '<div style="font-size:1rem;font-weight:700;color:#0f172a">Company created!</div>' +
        '<div style="font-size:0.78rem;color:#64748b;margin-top:0.25rem">' + name + '</div></div>' +
        '<div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:10px;padding:1.25rem;text-align:center;margin-bottom:1rem">' +
        '<div style="font-size:0.7rem;font-weight:700;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.5rem">Access Code</div>' +
        '<div style="font-family:monospace;font-size:1.5rem;font-weight:800;letter-spacing:0.12em;color:#0f172a;margin-bottom:0.5rem">' + code + '</div>' +
        '<div style="font-size:0.72rem;color:#94a3b8">' + expiryStr + '</div>' +
        '<button onclick="copyCompanyCode(\'' + code + '\')" class="btn btn-outline" style="margin-top:0.75rem;font-size:0.78rem">Copy Code</button></div>' +
        '<div style="background:#fef3c7;border-radius:8px;padding:0.75rem;font-size:0.75rem;color:#78350f;line-height:1.5">Share this code with your colleagues. Store it safely — you can regenerate it from settings.</div>';
    Modal.open('Company Created', body, function() { return true; });
    var footer = document.getElementById('modal-footer');
    if (footer) footer.style.display = 'none';
}

function copyCompanyCode(code) {
    navigator.clipboard.writeText(code).then(function() { showCompanyToast('Code copied!', '#15803d'); })
        .catch(function() { prompt('Copy this code:', code); });
}

async function showCompanyCodeManager() {
    if (!CompanyState.isActive() || !window.communityDB) return;
    try {
        var snap = await window.fbGetDoc(window.fbDoc(window.communityDB, 'companies', CompanyState.companyId));
        if (!snap.exists()) { alert('Company not found'); return; }
        var data = snap.data();
        var code = data.code || '—';
        var expStr = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : 'Never';
        var body = '<div style="margin-bottom:1rem">' +
            '<div style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:0.4rem">Current Code</div>' +
            '<div style="display:flex;align-items:center;gap:0.5rem;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:0.75rem">' +
            '<span style="font-family:monospace;font-size:1.1rem;font-weight:700;letter-spacing:0.1em;flex:1">' + code + '</span>' +
            '<button onclick="copyCompanyCode(\'' + code + '\')" class="btn btn-sm btn-outline">Copy</button></div>' +
            '<div style="font-size:0.72rem;color:#94a3b8;margin-top:0.3rem">Expires: ' + expStr + '</div></div>' +
            '<div style="border-top:1px solid var(--border);padding-top:1rem">' +
            '<div style="font-size:0.82rem;font-weight:600;margin-bottom:0.5rem">Generate New Code</div>' +
            '<select id="co-regen-duration" class="form-input" style="margin-bottom:0.5rem"><option value="30">30 days</option><option value="180">180 days</option><option value="0">Forever</option></select>' +
            '<div style="background:#fee2e2;border-radius:6px;padding:0.5rem 0.7rem;font-size:0.72rem;color:#7f1d1d;margin-bottom:0.75rem">Generating a new code will invalidate the old one immediately.</div>' +
            '<button class="btn btn-warning btn-full" onclick="regenerateCompanyCode()" style="font-size:0.82rem">Generate New Code</button></div>';
        Modal.open('Manage Access Code', body, function() { return true; });
        var footer = document.getElementById('modal-footer');
        if (footer) footer.style.display = 'none';
    } catch(e) { alert('Error: ' + e.message); }
}

async function regenerateCompanyCode() {
    if (!CompanyState.isActive() || CompanyState.role !== 'admin') return;
    var dur = parseInt(document.getElementById('co-regen-duration')?.value || '0');
    if (!confirm('This will invalidate the current code. Continue?')) return;
    var gen = generateCompanyCode(dur || null);
    try {
        await window.fbUpdateDoc(window.fbDoc(window.communityDB, 'companies', CompanyState.companyId), { code: gen.code, expiresAt: gen.expiresAt });
        CompanyState.expiresAt = gen.expiresAt; CompanyState.save();
        Modal.close();
        showCompanyCreatedModal(CompanyState.companyName, gen.code, gen.expiresAt);
    } catch(e) { alert('Error: ' + e.message); }
}

// ====================================================================
// PAGE: MATERIALS COMPANY — stessa UI di Materials DB
// ====================================================================
var _companyMats = [];
var _coMatSearch = '';
var _coMatFilter = { company:'', perf:'', method:'', family:'', type:'' };

function renderCompanyMaterialsPage() {
    if (!CompanyState.isActive()) return _renderCompanyGate();
    var currentLabel = State.mode === 'wvtr' ? 'WVTR' : 'OTR';
    var currentUnit  = State.mode === 'wvtr' ? 'g/m2·day' : 'cc/m2·day';
    return '<div style="padding:0.25rem 0">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px">' +
        '<div>' +
        '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b">Private · ' + CompanyState.companyName + '</div>' +
        '<div style="font-size:1rem;font-weight:700;color:#0f172a">Materials Company <span class="badge badge-blue" id="co-mat-badge">...</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn btn-sm btn-primary" onclick="showAddCompanyMaterial()">+ Add Material</button>' +
        '<button class="btn btn-sm btn-outline" onclick="showCompanyModal()">Settings</button>' +
        '</div></div>' +
        _companyDisclaimer() +
        '<div class="card" style="margin-bottom:0.75rem">' +
        '<div style="font-size:0.75rem;font-weight:600;color:var(--text-light);margin-bottom:0.6rem">Filters</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:0.6rem">' +
        '<div class="form-group" style="margin:0"><label>Supplier</label><select class="form-input" id="co-mf-company" onchange="coMatApplyFilters()" style="font-size:0.78rem"><option value="">All suppliers</option></select></div>' +
        '<div class="form-group" style="margin:0"><label>' + currentLabel + ' level</label><select class="form-input" id="co-mf-perf" onchange="coMatApplyFilters()" style="font-size:0.78rem"><option value="">Any</option><option value="ultra">&lt;0.1</option><option value="high">&lt;1</option><option value="med">&lt;10</option><option value="low">&gt;10</option></select></div>' +
        '<div class="form-group" style="margin:0"><label>Test method</label><select class="form-input" id="co-mf-method" onchange="coMatApplyFilters()" style="font-size:0.78rem"><option value="">All methods</option></select></div>' +
        '<div class="form-group" style="margin:0"><label>Family</label><select class="form-input" id="co-mf-family" onchange="coMatApplyFilters()" style="font-size:0.78rem"><option value="">All families</option></select></div>' +
        '</div></div>' +
        '<div style="position:relative;margin-bottom:0.75rem">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--text-light);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<input type="text" class="form-input" id="co-mat-search" style="padding-left:32px;font-size:0.82rem" placeholder="Search by name, supplier, value..." value="" oninput="coMatApplyFilters()"></div>' +
        '<div style="font-size:0.75rem;color:var(--text-light);margin-bottom:0.5rem;display:flex;justify-content:space-between">' +
        '<span id="co-mat-result-label">Loading...</span><span>' + currentLabel + ' mode · ' + currentUnit + '</span></div>' +
        '<div id="co-mat-list" style="display:flex;flex-direction:column;gap:6px"><div class="empty-state"><p>Loading...</p></div></div>' +
        '</div>';
}

async function initCompanyMaterialsPage() {
    _companyMats = await loadCompanyMaterials();
    // Popola filtri dinamici
    var companies = {}, methods = {}, families = {};
    _companyMats.forEach(function(m) {
        if (m.company && m.company.trim()) companies[m.company.trim()] = true;
        var tm = State.mode === 'wvtr' ? (m.testMethodWVTR||'') : (m.testMethodOTR||'');
        if (tm) methods[tm.trim()] = true;
        if (m.family) families[m.family] = true;
    });
    var compSel = document.getElementById('co-mf-company');
    var methSel = document.getElementById('co-mf-method');
    var famSel  = document.getElementById('co-mf-family');
    if (compSel) Object.keys(companies).sort().forEach(function(c){ compSel.innerHTML += '<option value="'+c+'">'+c+'</option>'; });
    if (methSel) Object.keys(methods).sort().forEach(function(m){ methSel.innerHTML += '<option value="'+m+'">'+m+'</option>'; });
    if (famSel)  Object.keys(families).sort().forEach(function(f){ famSel.innerHTML += '<option value="'+f+'">'+f+'</option>'; });
    var badge = document.getElementById('co-mat-badge');
    if (badge) badge.textContent = _companyMats.length;
    coMatApplyFilters();
}
function coMatApplyFilters() {
    var q       = (document.getElementById('co-mat-search')?.value || '').trim().toLowerCase();
    var fc      = document.getElementById('co-mf-company')?.value || '';
    var fperf   = document.getElementById('co-mf-perf')?.value || '';
    var fmethod = document.getElementById('co-mf-method')?.value || '';
    var ffamily = document.getElementById('co-mf-family')?.value || '';

    var filtered = _companyMats.filter(function(m) {
        if (fc) { var hay = ((m.company||'') + ' ' + (m.name||'')).toLowerCase(); if (hay.indexOf(fc.toLowerCase()) < 0) return false; }
        if (fperf) {
            var val = State.mode === 'wvtr' ? (m.wvtrValues&&m.wvtrValues[0]?m.wvtrValues[0].value:null) : (m.otrValues&&m.otrValues[0]?m.otrValues[0].value:null);
            if (val === null) return false;
            if (fperf==='ultra' && !(val < 0.1)) return false;
            if (fperf==='high'  && !(val < 1))   return false;
            if (fperf==='med'   && !(val < 10))  return false;
            if (fperf==='low'   && !(val >= 10)) return false;
        }
        if (fmethod) { var tm = State.mode==='wvtr'?(m.testMethodWVTR||''):(m.testMethodOTR||''); if (tm.trim() !== fmethod) return false; }
        if (ffamily && m.family !== ffamily) return false;
        if (q) {
            var hay2 = (m.name+' '+(m.family||'')+' '+(m.company||'')).toLowerCase();
            if (hay2.indexOf(q) < 0) return false;
        }
        return true;
    });
    filtered.sort(function(a,b){ return a.name.localeCompare(b.name); });

    var listEl  = document.getElementById('co-mat-list');
    var labelEl = document.getElementById('co-mat-result-label');
    if (labelEl) labelEl.innerHTML = 'Showing <strong>' + filtered.length + '</strong> of ' + _companyMats.length + ' materials';
    if (!listEl) return;
    if (filtered.length === 0) { listEl.innerHTML = '<div class="empty-state"><p>No materials match these filters</p></div>'; return; }
    listEl.innerHTML = filtered.map(function(m){ return _coMatCardHTML(m, q); }).join('');
}

function _coMatCardHTML(m, q) {
    var currentUnit = State.mode === 'wvtr' ? 'g/m2·day' : 'cc/m2·day';
    var vals = State.mode === 'wvtr' ? (m.wvtrValues || []) : (m.otrValues || []);
    var arrOk = Engine.validateArrhenius(m).valid;
    var idStr = String(m.id);

    function hl(str) {
        if (!q || !str) return str || '';
        var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')','gi');
        return String(str).replace(re,'<mark style="background:#fef08a;color:#713f12;padding:0 2px;border-radius:2px">$1</mark>');
    }

    var tags = '';
    if (m.isMetallized) tags += '<span class="badge badge-yellow" style="font-size:0.65rem">Metallized</span> ';
    for (var t=0; t<vals.length; t++) {
        var cond = (m.validConditions && m.validConditions[t]) ? m.validConditions[t] : {temperature:'?',humidity:'?'};
        var v = vals[t] || {value:'?',thickness:'?'};
        tags += '<span class="mat-tag">'+Engine.getUnits().label+': <strong>'+v.value+'</strong> '+currentUnit+' · '+v.thickness+'µm · '+cond.temperature+'°C/'+cond.humidity+'%</span>';
    }

    var canEdit = CompanyState.role === 'admin' || m.sharedBy === window.getOrCreateUserId();
    var currentTM = State.mode === 'wvtr' ? (m.testMethodWVTR||'') : (m.testMethodOTR||'');

    return '<div class="material-item" onclick="this.classList.toggle(\'expanded\')">' +
        '<div class="mat-header">' +
        '<h3><span>' + hl(m.name) + '</span>' +
        '<span class="badge badge-blue" style="font-size:0.65rem">Company</span>' +
        '<span style="font-weight:400;color:var(--text-light);font-size:0.72rem">[' + (m.family||'?') + ']</span>' +
        (arrOk ? '<span class="badge badge-green">Arrhenius</span>' : '') +
        '</h3>' +
        '<svg class="chevron" style="margin-left:auto;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="mat-body"><div class="mat-body-content">' +
        '<div class="mat-tags">' + tags + '</div>' +
        '<div class="mat-info">' +
        (currentTM ? '<div class="mat-info-item"><strong>Test standard</strong><span class="mat-testmethod">' + currentTM + '</span></div>' : '') +
        (m.company ? '<div class="mat-info-item"><strong>Supplier</strong><span>' + hl(m.company) + '</span></div>' : '') +
        (m.tdsLink ? '<div class="mat-info-item"><strong>TDS</strong><a href="' + m.tdsLink + '" target="_blank" onclick="event.stopPropagation()">View</a></div>' : '') +
        '</div>' +
        '<div class="mat-actions">' +
        (canEdit ? '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();showEditCompanyMaterial(\'' + m._companyDocId + '\')">Edit</button>' : '') +
        (canEdit ? '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();removeCompanyMaterial(\'' + m._companyDocId + '\')">Delete</button>' : '') +
        '</div>' +
        '</div></div></div>';
}

function showAddCompanyMaterial() {
    _showCompanyMatModal(null);
}

function showEditCompanyMaterial(docId) {
    var mat = _companyMats.find(function(m){ return m._companyDocId === docId; });
    _showCompanyMatModal(mat);
}

function _showCompanyMatModal(mat) {
    var currentMode  = State.mode;
    var currentLabel = currentMode === 'wvtr' ? 'WVTR' : 'OTR';
    var currentUnit  = currentMode === 'wvtr' ? 'g/m²·day' : 'cc/m²·day';
    var currentValues = currentMode === 'wvtr'
        ? (mat ? mat.wvtrValues  : [{value:'',thickness:''}])
        : (mat ? mat.otrValues   : [{value:'',thickness:''}]);
    var conds = mat ? (mat.validConditions || []) : [{temperature:'',humidity:''}];

    var familyOpts = '<option value="">Select family...</option>';
    for (var fam in POLYMER_FAMILIES) {
        familyOpts += '<option value="'+fam+'"'+(mat&&mat.family===fam?' selected':'')+'>'+fam+'</option>';
    }

    var metallizedCheck = mat && mat.isMetallized ? 'checked' : '';
    var metallizedHTML =
        '<div style="margin:0.5rem 0;padding:0.4rem 0.6rem;background:var(--warning-light);border-radius:6px;display:flex;align-items:center;gap:0.4rem">' +
        '<input type="checkbox" id="co-mf-metallized" '+metallizedCheck+'>' +
        '<label for="co-mf-metallized" style="font-size:0.75rem;color:var(--text-light);margin:0;cursor:pointer">' +
        '<strong>Metallized/Coated film</strong> – Barrier independent of substrate thickness</label></div>';

    var betaWVTR  = mat ? (mat.hygroscopicBetaWVTR  || '') : '';
    var refRHWVTR = mat ? (mat.hygroscopicRefRHWVTR || 50) : 50;
    var betaOTR   = mat ? (mat.hygroscopicBetaOTR   || '') : '';
    var refRHOTR  = mat ? (mat.hygroscopicRefRHOTR  || 50) : 50;
    var betaVal   = currentMode === 'wvtr' ? betaWVTR  : betaOTR;
    var refRHVal  = currentMode === 'wvtr' ? refRHWVTR : refRHOTR;
    var betaId    = currentMode === 'wvtr' ? 'co-mf-beta-wvtr'  : 'co-mf-beta-otr';
    var refRHId   = currentMode === 'wvtr' ? 'co-mf-refrh-wvtr' : 'co-mf-refrh-otr';

    var hygroHTML =
        '<div class="form-group" style="margin-top:0.8rem">' +
        '<label>Hygroscopic Properties ('+currentLabel+')</label>' +
        '<div class="grid grid-2" style="gap:0.5rem">' +
        '<div class="form-group" style="margin:0"><label>β Coefficient (%/RH)</label>' +
        '<input type="number" step="0.001" class="form-input" id="'+betaId+'" value="'+betaVal+'" placeholder="0.034"></div>' +
        '<div class="form-group" style="margin:0"><label>Reference RH (%)</label>' +
        '<input type="number" class="form-input" id="'+refRHId+'" value="'+refRHVal+'" placeholder="50"></div>' +
        '</div></div>';

    // Test method
    var ctmWVTR = ['','ASTM F1249','ISO 15106-3','ASTM E96','JIS K7129','MOCON PERMATRAN','DIN 53122','Custom/Other'];
    var ctmOTR  = ['','ASTM D3985','ISO 15106-2','JIS K7126','MOCON OXTRAN','Custom/Other'];
    var ctm = currentMode === 'wvtr' ? ctmWVTR : ctmOTR;
    var currentTM = currentMode === 'wvtr' ? (mat ? mat.testMethodWVTR||'' : '') : (mat ? mat.testMethodOTR||'' : '');
    var isCustomTM = currentTM && ctm.indexOf(currentTM) < 0;
    var testMethodBlock =
        '<div class="form-group" id="co-mf-testmethod-group">' +
        '<label>Test Method for '+currentLabel+'</label>' +
        '<select class="form-input" id="co-mf-testmethod-select" onchange="onCoTestMethodSelectChange(this)">' +
        (function(){
            var o = '<option value="">Select or enter method...</option>';
            for(var t=0; t<ctm.length; t++){
                var s = (currentTM === ctm[t]) ? ' selected' : '';
                o += '<option value="'+ctm[t]+'"'+s+'>'+(ctm[t]||'-- Select --')+'</option>';
            }
            o += '<option value="_custom" style="font-weight:600">+ Enter custom method...</option>';
            return o;
        })() +
        '</select>' +
        '<input type="text" class="form-input" id="co-mf-testmethod-custom" value="'+(isCustomTM?currentTM:'')+'" placeholder="Enter custom method..." style="display:'+(isCustomTM?'block':'none')+';margin-top:0.3rem">' +
        '</div>';

    // Existing rows
    var rowsHTML = '';
    for (var r = 0; r < currentValues.length; r++) {
        var v = currentValues[r] || {value:'',thickness:''};
        var c = conds[r] || {temperature:'',humidity:''};
        rowsHTML +=
            '<div class="wvtr-row-form" style="grid-template-columns:1fr 1fr">' +
            '<div style="display:flex;gap:0.4rem">' +
            '<div class="form-group" style="margin:0;flex:1"><label>'+currentLabel+' Value</label><input type="number" step="any" class="form-input co-mf-val" value="'+(v.value||'')+'" placeholder="0"></div>' +
            '<div class="form-group" style="margin:0;flex:1"><label>Thickness (µm)</label><input type="number" step="any" class="form-input co-mf-thick" value="'+(v.thickness||'')+'" placeholder="0"></div>' +
            '</div>' +
            '<div style="display:flex;gap:0.4rem">' +
            '<div class="form-group" style="margin:0;flex:1"><label>Temp (°C)</label><input type="number" step="any" class="form-input co-mf-temp" value="'+(c.temperature||'')+'" placeholder="23"></div>' +
            '<div class="form-group" style="margin:0;flex:1"><label>Humidity (%)</label><input type="number" step="any" class="form-input co-mf-hum" value="'+(c.humidity||'')+'" placeholder="50"></div>' +
            '</div></div>';
    }

    var body =
        '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:0.6rem;margin-bottom:1rem;font-size:0.72rem;color:#78350f">Only share technical data. No confidential information.</div>' +
        '<div class="form-group"><label>Name *</label><input type="text" class="form-input" id="co-mat-name" value="'+(mat?mat.name:'')+'"></div>' +
        '<div class="form-group"><label>Material Family</label><select class="form-input" id="co-mat-family">'+familyOpts+'</select></div>' +
        '<div class="form-group"><label>Company / Supplier</label><input type="text" class="form-input" id="co-mat-company" value="'+(mat?mat.company||'':'')+'" placeholder="e.g. DuPont"></div>' +
        '<div class="form-group"><label>Contact Email <span style="font-size:0.68rem;color:var(--text-light);font-weight:400">(enables Contact Supplier button)</span></label>' +
        '<input type="email" class="form-input" id="co-mat-email" value="'+(mat&&mat.supplierEmail?mat.supplierEmail:'')+'" placeholder="supplier@company.com"></div>' +
        '<div class="form-group"><label>TDS Link (optional)</label><input type="url" class="form-input" id="co-mat-tds" value="'+(mat?mat.tdsLink||'':'')+'" placeholder="https://..."></div>' +
        metallizedHTML + hygroHTML + testMethodBlock +
        '<div style="margin:0.5rem 0;padding:0.4rem 0.6rem;background:var(--primary-light);border-radius:6px;font-size:0.75rem"><strong>'+currentLabel+'</strong> · '+currentUnit+'</div>' +
        '<div id="co-mat-rows">'+rowsHTML+'</div>' +
        '<button class="btn btn-outline btn-full" style="margin-top:0.4rem" onclick="coAddMatRow()">+ Add Condition</button>';

    Modal.open(mat ? 'Edit Company Material' : 'Add Company Material', body, function() {
        var name = document.getElementById('co-mat-name')?.value.trim();
        if (!name) { alert('Enter material name'); return false; }

        var family       = document.getElementById('co-mat-family')?.value;
        var company      = document.getElementById('co-mat-company')?.value.trim();
        var tdsLink      = document.getElementById('co-mat-tds')?.value.trim();
        var supplierEmail= document.getElementById('co-mat-email')?.value.trim();
        var isMetallized = document.getElementById('co-mf-metallized')?.checked || false;

        // Test method
        var tmSelect = document.getElementById('co-mf-testmethod-select');
        var tmCustom = document.getElementById('co-mf-testmethod-custom');
        var testMethodValue = '';
        if (tmSelect && tmSelect.value && tmSelect.value !== '_custom') testMethodValue = tmSelect.value;
        if (tmCustom && tmCustom.style.display !== 'none' && tmCustom.value.trim()) testMethodValue = tmCustom.value.trim();
        var testMethodWVTR = currentMode === 'wvtr' ? testMethodValue : (mat ? mat.testMethodWVTR||'' : '');
        var testMethodOTR  = currentMode === 'otr'  ? testMethodValue : (mat ? mat.testMethodOTR||'' : '');

        // Hygroscopic
        var betaElVal  = parseFloat(document.getElementById(betaId)?.value)  || 0;
        var refRHElVal = parseFloat(document.getElementById(refRHId)?.value) || 50;

        var allVal   = document.querySelectorAll('.co-mf-val');
        var allThick = document.querySelectorAll('.co-mf-thick');
        var allTemp  = document.querySelectorAll('.co-mf-temp');
        var allHum   = document.querySelectorAll('.co-mf-hum');
        var valuesArr = [], condsArr = [];
        for (var i = 0; i < allVal.length; i++) {
            var val   = parseFloat(allVal[i].value);
            var thick = parseFloat(allThick[i].value);
            var temp  = parseFloat(allTemp[i].value);
            var hum   = parseFloat(allHum[i].value);
            if (isNaN(val)||val<0)    { alert('Invalid value in row '+(i+1)); return false; }
            if (isNaN(thick)||thick<=0){ alert('Thickness must be > 0 in row '+(i+1)); return false; }
            if (isNaN(temp))           { alert('Temperature required in row '+(i+1)); return false; }
            if (isNaN(hum))            { alert('Humidity required in row '+(i+1)); return false; }
            valuesArr.push({value:val, thickness:thick});
            condsArr.push({temperature:temp, humidity:hum});
        }

        var matData = {
            name: name, family: family || getFamily(name),
            company: company, tdsLink: tdsLink, supplierEmail: supplierEmail,
            isMetallized: isMetallized,
            testMethodWVTR: testMethodWVTR, testMethodOTR: testMethodOTR,
            hygroscopicBetaWVTR:  currentMode==='wvtr' ? betaElVal  : (mat?mat.hygroscopicBetaWVTR||0:0),
            hygroscopicRefRHWVTR: currentMode==='wvtr' ? refRHElVal : (mat?mat.hygroscopicRefRHWVTR||50:50),
            hygroscopicBetaOTR:   currentMode==='otr'  ? betaElVal  : (mat?mat.hygroscopicBetaOTR||0:0),
            hygroscopicRefRHOTR:  currentMode==='otr'  ? refRHElVal : (mat?mat.hygroscopicRefRHOTR||50:50),
            wvtrValues: currentMode==='wvtr' ? valuesArr : (mat&&mat.wvtrValues?mat.wvtrValues:[]),
            otrValues:  currentMode==='otr'  ? valuesArr : (mat&&mat.otrValues?mat.otrValues:[]),
            validConditions: condsArr,
            reliabilityVotes: mat ? mat.reliabilityVotes||{up:0,down:0} : {up:0,down:0}
        };
        if (mat) matData._companyDocId = mat._companyDocId;

        saveCompanyMaterial(matData).then(function(res) {
            if (res.success) {
                showCompanyToast('<strong>' + name + '</strong> ' + (mat ? 'updated' : 'added') + '!', '#15803d');
                initCompanyMaterialsPage();
            } else { alert('Error: ' + res.error); }
        });
        return true;
    });

    // Footer visibile per il Save
    var footer = document.getElementById('modal-footer');
    if (footer) footer.style.display = '';

    // Custom test method handler
    setTimeout(function(){
        var tmSelect2 = document.getElementById('co-mf-testmethod-select');
        var tmCustom2 = document.getElementById('co-mf-testmethod-custom');
        if(!tmSelect2 || !tmCustom2) return;
        if(isCustomTM){ tmCustom2.style.display='block'; tmSelect2.value=''; }
    }, 50);
}

// Handler test method per company modal
function onCoTestMethodSelectChange(select) {
    var customInput = document.getElementById('co-mf-testmethod-custom');
    if (!customInput) return;
    if (select.value === '_custom') { customInput.style.display='block'; customInput.focus(); select.value=''; }
    else customInput.style.display = 'none';
}

function coAddMatRow() {
    var currentLabel = State.mode === 'wvtr' ? 'WVTR' : 'OTR';
    document.getElementById('co-mat-rows').insertAdjacentHTML('beforeend',
        '<div class="wvtr-row-form" style="grid-template-columns:1fr 1fr;animation:fadeIn 0.2s ease">' +
        '<div style="display:flex;gap:0.4rem">' +
        '<div class="form-group" style="margin:0;flex:1"><label>'+currentLabel+' Value</label><input type="number" step="any" class="form-input co-mf-val" placeholder="0"></div>' +
        '<div class="form-group" style="margin:0;flex:1"><label>Thickness (µm)</label><input type="number" step="any" class="form-input co-mf-thick" placeholder="0"></div>' +
        '</div><div style="display:flex;gap:0.4rem">' +
        '<div class="form-group" style="margin:0;flex:1"><label>Temp (°C)</label><input type="number" step="any" class="form-input co-mf-temp" placeholder="23"></div>' +
        '<div class="form-group" style="margin:0;flex:1"><label>Humidity (%)</label><input type="number" step="any" class="form-input co-mf-hum" placeholder="50"></div>' +
        '</div></div>');
}

// ====================================================================
// PAGE: LAMINATES COMPANY — stessa UI di Laminates DB
// ====================================================================
var _companyLams = [];

function renderCompanyLaminatesPage() {
    if (!CompanyState.isActive()) return _renderCompanyGate();
    var unit = getUnit();
    return '<div style="padding:0.25rem 0">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px">' +
        '<div>' +
        '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b">Private · ' + CompanyState.companyName + '</div>' +
        '<div style="font-size:1rem;font-weight:700;color:#0f172a">Laminates Company <span class="badge badge-purple" id="co-lam-badge">...</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-sm btn-outline" onclick="showCompanyModal()">Settings</button>' +
        '</div></div>' +
        _companyDisclaimer() +
        '<div id="co-lam-list"><div class="empty-state"><p>Loading...</p></div></div>' +
        '</div>';
}

async function initCompanyLaminatesPage() {
    _companyLams = await loadCompanyLaminates();
    var badge = document.getElementById('co-lam-badge');
    if (badge) badge.textContent = _companyLams.length;
    _renderCompanyLamList();
}

function _renderCompanyLamList() {
    var listEl = document.getElementById('co-lam-list');
    if (!listEl) return;
    var unit = getUnit();
    var filteredLams = _companyLams.filter(function(l){ return l.mode === State.mode; });
    if (filteredLams.length === 0) {
        listEl.innerHTML = '<div class="card"><div class="empty-state"><p>No ' + State.mode.toUpperCase() + ' laminates shared yet.<br><small style="color:var(--text-light)">Save a calculation in the Calculator tab and share it here.</small></p></div></div>';
        return;
    }
    var colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
    var html = '<div class="card"><h2>Company Laminates <span class="badge badge-purple">'+filteredLams.length+'</span></h2><div class="grid grid-2">';
    filteredLams.forEach(function(l, i) {
        var canDelete = CompanyState.role === 'admin' || l.sharedBy === window.getOrCreateUserId();
        var layerNames = '';
        if (l.layers && l.layers.length) {
            layerNames = l.layers.map(function(ly) {
                var mat = DB.materials.find(function(m){ return String(m.id) === String(ly.mid); });
                return mat ? mat.name + '(' + ly.thick + 'µm)' : '?';
            }).join(' / ');
        }
        html += '<div style="border:1.5px solid var(--border);border-radius:10px;padding:.85rem;border-top:4px solid '+colors[i%colors.length]+'">' +
            '<div style="font-weight:600;font-size:.85rem;margin-bottom:.35rem">'+l.name+'</div>' +
            '<div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">' +
            '<div><div style="font-size:.65rem;color:var(--text-light)">'+(l.mode||State.mode).toUpperCase()+'</div><div style="font-size:1.2rem;font-weight:700;color:var(--primary)">'+(l.total?l.total.toFixed(5):'—')+'</div><div style="font-size:.65rem;color:var(--text-light)">'+unit+'</div></div>' +
            '<div><div style="font-size:.65rem;color:var(--text-light)">Thickness</div><div style="font-weight:600">'+(l.totalThickness||0).toFixed(0)+' um</div></div>' +
            '<div><div style="font-size:.65rem;color:var(--text-light)">Conditions</div><div style="font-weight:600">'+(l.temperature||'?')+'°C / '+(l.humidity||'?')+'%</div></div>' +
            '<div><div style="font-size:.65rem;color:var(--text-light)">Recyclable</div><span class="sustainability-flag '+(l.recyclable?'yes':'no')+'">'+(l.recyclable?'Yes':'No')+'</span></div>' +
            '</div>' +
            (layerNames ? '<div style="font-size:0.68rem;color:#94a3b8;margin-top:0.4rem;word-break:break-word">'+layerNames+'</div>' : '') +
            '<div style="margin-top:.45rem;display:flex;gap:0.4rem;justify-content:flex-end">' +
            '<button class="btn btn-sm btn-outline" onclick="loadCompanyLaminateInCalc(\'' + String(l.id) + '\')">Load in Calc</button>' +
            (canDelete ? '<button class="btn btn-sm btn-danger" onclick="removeCompanyLaminate(\'' + l._companyLamId + '\')">Delete</button>' : '') +
            '</div></div>';
    });
    html += '</div></div>';
    if (filteredLams.length >= 2) {
        html += '<div class="card" style="margin-top:1rem"><h2>Company Laminates Comparison</h2><div class="chart-container"><canvas id="coLamChart"></canvas></div></div>';
    }
    listEl.innerHTML = html;
    if (filteredLams.length >= 2) setTimeout(function(){ _drawCoLamChart(filteredLams); }, 150);
}

function _drawCoLamChart(filteredLams) {
    var canvas = document.getElementById('coLamChart'); if (!canvas) return;
    destroyChart('coLam');
    var ctx = canvas.getContext('2d');
    var unit = getUnit();
    var labels = filteredLams.map(function(l){ return l.name; });
    var vals   = filteredLams.map(function(l){ return l.total || 0; });
    var colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
    chartInstances.coLam = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: (State.mode||'wvtr').toUpperCase(), data: vals, backgroundColor: colors, borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: unit } } } }
    });
}

// ====================================================================
// SHARE FROM CALCULATOR — Save to General or Company
// ====================================================================
function saveLaminateWithChoice() {
    var name = State.laminateName.trim();
    if (!name) { alert('Enter a laminate name first'); return; }
    if (!State.calcResult || State.calcResult.total <= 0) { alert('Calculate first'); return; }

    var tt = 0;
    State.layers.forEach(function(l){ tt += (l.thick||0); });
    var rec = Engine.checkRecyclability(State.layers, DB.materials);
    var lamData = {
        name: name, total: State.calcResult.total, totalThickness: tt,
        humidity: State.selCond.humidity, temperature: State.selCond.temperature,
        mode: State.mode, recyclable: rec.recyclable, monoStructure: rec.monoStructure,
        layerCount: State.layers.length, layers: JSON.parse(JSON.stringify(State.layers))
    };

    // Salva in General DB
    DB.addLam(lamData);
    State.laminateName = '';
    var nameEl = document.getElementById('lam-name'); if (nameEl) nameEl.value = '';
    var btn = document.getElementById('save-btn-general'); if (btn) btn.disabled = true;
    var fb = document.getElementById('save-feedback');
    if (fb) { fb.innerHTML = '<div class="alert alert-success" style="margin-top:.5rem">Saved to General DB!</div>'; setTimeout(function(){ fb.innerHTML=''; }, 3000); }
}

function saveLaminateToCompany() {
    if (!CompanyState.isActive()) { showCompanyModal(); return; }
    var name = State.laminateName.trim();
    if (!name) { alert('Enter a laminate name first'); return; }
    if (!State.calcResult || State.calcResult.total <= 0) { alert('Calculate first'); return; }

    var tt = 0;
    State.layers.forEach(function(l){ tt += (l.thick||0); });
    var rec = Engine.checkRecyclability(State.layers, DB.materials);
    saveCompanyLaminate({
        name: name, total: State.calcResult.total, totalThickness: tt,
        humidity: State.selCond?.humidity || 0, temperature: State.selCond?.temperature || 0,
        mode: State.mode, recyclable: rec.recyclable, monoStructure: rec.monoStructure,
        layerCount: State.layers.length, layers: JSON.parse(JSON.stringify(State.layers))
    }).then(function(res) {
        if (res.success) {
            var fb = document.getElementById('save-feedback');
            if (fb) { fb.innerHTML = '<div class="alert alert-success" style="margin-top:.5rem">Saved to Company DB!</div>'; setTimeout(function(){ fb.innerHTML=''; }, 3000); }
        } else { alert('Error: ' + res.error); }
    });
}

// ====================================================================
// LOAD COMPANY LAMINATE IN CALC
// ====================================================================
function loadCompanyLaminateInCalc(lamId) {
    var lam = _companyLams.find(function(l){ return String(l.id) === String(lamId); });
    if (!lam) return;
    State.layers       = JSON.parse(JSON.stringify(lam.layers || [{mid:null,thick:0}]));
    State.laminateName = lam.name;
    State.selCond      = { temperature: lam.temperature, humidity: lam.humidity };
    State.calcResult   = { total: lam.total, layers: [], error: null };
    State.tab = 'calc';
    renderNav(); renderContent();
    showCompanyToast('Laminate <strong>' + lam.name + '</strong> loaded!', '#8b5cf6');
}

async function removeCompanyMaterial(docId) {
    if (!confirm('Remove this material from the company database?')) return;
    await deleteCompanyMaterial(docId);
    showCompanyToast('Material removed', '#64748b');
    initCompanyMaterialsPage();
}

async function removeCompanyLaminate(docId) {
    if (!confirm('Remove this laminate from the company database?')) return;
    await deleteCompanyLaminate(docId);
    showCompanyToast('Laminate removed', '#64748b');
    initCompanyLaminatesPage();
}

function leaveCompany() {
    if (!confirm('Leave ' + CompanyState.companyName + '? Your local data is not affected.')) return;
    CompanyState.clear();
    Modal.close();
    DB.materials = DB.materials.filter(function(m){ return !m.isCompany; });
    showCompanyToast('You have left the company database.', '#64748b');
    setTimeout(function(){ render(); }, 400);
}

// ====================================================================
// HELPERS UI
// ====================================================================
function _renderCompanyGate() {
    return '<div class="card"><div class="empty-state"><p>You are not in a company database.</p>' +
        '<button class="btn btn-primary" onclick="showCompanyModal()">Join or Create Company</button></div></div>';
}

function _expiryBadge(daysLeft) {
    if (daysLeft === null) return '<span class="badge badge-green">Forever</span>';
    if (daysLeft > 30)    return '<span class="badge badge-green">' + daysLeft + 'd left</span>';
    if (daysLeft > 0)     return '<span class="badge badge-yellow">' + daysLeft + 'd left</span>';
    return '<span class="badge badge-red">Expired</span>';
}

function _companyDisclaimer() {
    return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:0.5rem 0.85rem;margin-bottom:1rem;font-size:0.72rem;color:#78350f;display:flex;gap:0.5rem;align-items:center">' +
        '<span style="flex-shrink:0">⚠️</span>' +
        '<span>Technical packaging data only.</span></div>';
}

function showCompanyToast(html, bg) {
    var old = document.getElementById('co-toast'); if(old) old.remove();
    var t = document.createElement('div');
    t.id = 'co-toast';
    t.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:' + bg + ';color:#fff;padding:0.75rem 1.25rem;border-radius:10px;font-size:0.82rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.25);animation:fadeIn 0.2s ease';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, 4000);
}
function loadAndShowCompanyCode() {
    var codeEl = document.getElementById('co-code-value');
    if (!codeEl || !CompanyState.isActive() || !window.communityDB) return;
    window.fbGetDoc(window.fbDoc(window.communityDB, 'companies', CompanyState.companyId))
        .then(function(snap) {
            if (snap.exists()) {
                var data = snap.data();
                codeEl.textContent = data.code || '—';
            } else {
                codeEl.textContent = 'Not found';
            }
        })
        .catch(function() { codeEl.textContent = 'Error loading'; });
}
// ====================================================================
// INIT
// ====================================================================
CompanyState.load();
