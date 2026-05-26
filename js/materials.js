// ====================================================================
// 🧪 MATERIALS.JS - Materials DB page, modals, filters, voting,
//                   community sync, trash, usage tracking, initApp
// Dependencies: engine.js, app.js, render.js
// ====================================================================

// ====================================================================
// 🗑️ SOFT DELETE / TRASH
// ====================================================================
var _matTrash = [];

function softDeleteMat(matId) {
    var idx = DB.materials.findIndex(function(m){ return String(m.id) === String(matId); });
    if(idx < 0) return;
    var mat = DB.materials[idx];
    _matTrash.push(mat);
    DB.materials.splice(idx, 1);
    DB.save();
    matApplyFilters();
    showTrashNotification(mat);
}

function restoreFromTrash(matId) {
    var idx = _matTrash.findIndex(function(m){ return String(m.id) === String(matId); });
    if(idx < 0) return;
    var mat = _matTrash[idx];
    _matTrash.splice(idx, 1);
    DB.materials.push(mat);
    DB.save();
    matApplyFilters();
}

function showTrashNotification(mat) {
    var old = document.getElementById('trash-toast');
    if(old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'trash-toast';
    toast.style.cssText = [
        'position:fixed','bottom:1.5rem','left:50%','transform:translateX(-50%)',
        'background:#0f172a','color:#fff','padding:0.75rem 1.25rem',
        'border-radius:10px','font-size:0.82rem','display:flex',
        'align-items:center','gap:1rem','z-index:9999',
        'box-shadow:0 8px 24px rgba(0,0,0,0.3)','animation:fadeIn 0.2s ease'
    ].join(';');
    toast.innerHTML =
        '<span>🗑️ <strong>' + mat.name + '</strong> moved to trash</span>' +
        '<button onclick="restoreFromTrash(\'' + String(mat.id) + '\');this.closest(\'#trash-toast\').remove()" ' +
        'style="background:var(--primary);color:#fff;border:none;padding:0.3rem 0.75rem;border-radius:6px;cursor:pointer;font-size:0.78rem;font-weight:600">Undo</button>' +
        '<button onclick="this.closest(\'#trash-toast\').remove()" ' +
        'style="background:transparent;color:rgba(255,255,255,0.5);border:none;cursor:pointer;font-size:1rem;padding:0 0.25rem">✕</button>';
    document.body.appendChild(toast);
    setTimeout(function(){ if(toast.parentNode) toast.remove(); }, 6000);
}

function showTrashPanel() {
    if(_matTrash.length === 0) { alert('The trash is empty.'); return; }
    var body = '<div style="font-size:0.8rem;color:var(--text-light);margin-bottom:0.75rem">Items in trash are recovered to your local database only.</div>';
    body += _matTrash.map(function(m) {
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid var(--border)">' +
            '<span style="font-size:0.85rem;font-weight:500">' + m.name + '</span>' +
            '<button class="btn btn-sm btn-success" onclick="restoreFromTrash(\'' + String(m.id) + '\');Modal.close();matApplyFilters()">↩ Restore</button>' +
            '</div>';
    }).join('');
    Modal.open('🗑️ Trash (' + _matTrash.length + ' items)', body, function(){ return true; });
}

// ====================================================================
// 📬 CONTACT SUPPLIER
// ====================================================================
function contactSupplier(matName, company, email) {
    if(!email) {
        alert('No supplier email available for this material.\nAdd it by editing the material and filling in the Contact Email field.');
        return;
    }
    var subject = encodeURIComponent('Technical Data Request – ' + matName + ' (WVTR/OTR)');
    var body = encodeURIComponent(
        'Dear ' + (company || 'Supplier') + ',\n\n' +
        'I am contacting you regarding the material "' + matName + '".\n\n' +
        'I would appreciate receiving the following technical data:\n' +
        '- WVTR (Water Vapor Transmission Rate) per ASTM F1249 / ISO 15106\n' +
        '- OTR (Oxygen Transmission Rate) per ASTM D3985 / ISO 15106-2\n' +
        '- Test conditions (temperature, relative humidity, thickness)\n\n' +
        'Thank you for your time.\n\nBest regards'
    );
    window.location.href = 'mailto:' + email + '?subject=' + subject + '&body=' + body;
}

// ====================================================================
// 🌍 SHARE / UPDATE WITH COMMUNITY
// ====================================================================
async function shareToCommunity(matId) {
    var mat = DB.materials.find(function(m){ return String(m.id) === String(matId); });
    if(!mat) return;
    if(!window.communityDB) { alert('⚠️ Database not connected. Try again later.'); return; }
    var btn = event && event.target ? event.target : null;
    if(btn) { btn.disabled = true; btn.textContent = '⏳...'; }
    try {
        mat.author = mat.author || 'Community';
        var result = await window.saveToCommunity(mat);
        if(result.success) {
            mat.firebaseDocId = result.id;
            mat.isCommunity = true;
            mat._communitySourceId = String(mat.id);
            DB.save();
            matApplyFilters();
        }
    } catch(e) { alert('❌ Unexpected error: ' + e.message); }
    finally { if(btn) { btn.disabled=false; btn.textContent = mat.firebaseDocId ? '🔄 Update community' : '🌍 Share with community'; } }
}

function submitToFirebaseById(matId) { shareToCommunity(matId); }

// ====================================================================
// ✅ VERIFIED BADGE
// ====================================================================
function isVerifiedMaterial(mat) {
    if(!window.VERIFIED_MATERIALS) return null;
    return window.VERIFIED_MATERIALS[mat.name] || null;
}

// ====================================================================
// 👍 RELIABILITY VOTING — ✅ FIX: DB non sparisce dopo il voto
// ====================================================================
async function voteReliability(matId, voteType) {
    var matIdStr = String(matId);
    var currentVote = hasUserVoted(matIdStr);
    var mat = DB.materials.find(function(m){ return String(m.id) === matIdStr; });
    if(!mat) return;
    if(!mat.reliabilityVotes) mat.reliabilityVotes = { up: 0, down: 0 };
    var firebaseUpdate = {};
    var needsSync = mat.firebaseDocId && window.communityDB && mat.isCommunity === true;

    if(currentVote) {
        mat.reliabilityVotes[currentVote] = Math.max(0, (mat.reliabilityVotes[currentVote] || 0) - 1);
        if(needsSync) firebaseUpdate["reliabilityVotes." + currentVote] = window.fbIncrement(-1);
        if(currentVote === voteType) {
            recordUserVote(matIdStr, null);
            DB.save();
            // ✅ FIX: usa matApplyFilters se siamo nella tab materiali, altrimenti renderContent
            if(State.tab === 'materials') { matApplyFilters(); } else { renderContent(); }
            if(needsSync) {
                try { const ref = window.fbDoc(window.communityDB,"materials",mat.firebaseDocId); await window.fbUpdateDoc(ref, firebaseUpdate); } catch(e) {}
            }
            return;
        }
    }

    mat.reliabilityVotes[voteType] = (mat.reliabilityVotes[voteType] || 0) + 1;
    recordUserVote(matIdStr, voteType);
    if(needsSync) firebaseUpdate["reliabilityVotes." + voteType] = window.fbIncrement(1);
    DB.save();
    // ✅ FIX: stessa logica qui
    if(State.tab === 'materials') { matApplyFilters(); } else { renderContent(); }
    if(needsSync && Object.keys(firebaseUpdate).length > 0) {
        try { const ref = window.fbDoc(window.communityDB,"materials",mat.firebaseDocId); await window.fbUpdateDoc(ref, firebaseUpdate); } catch(e) {}
    }
}

function hasUserVoted(matId) {
    try { var votes = JSON.parse(localStorage.getItem('wvtr_user_votes') || '{}'); return votes[String(matId)] || null; }
    catch(e) { return null; }
}

function recordUserVote(matId, voteType) {
    try {
        var votes = JSON.parse(localStorage.getItem('wvtr_user_votes') || '{}');
        if(voteType) votes[String(matId)] = voteType;
        else delete votes[String(matId)];
        localStorage.setItem('wvtr_user_votes', JSON.stringify(votes));
    } catch(e) {}
}

function getReliabilityScore(mat) {
    if(!mat.reliabilityVotes) return 50;
    var up = mat.reliabilityVotes.up || 0;
    var down = mat.reliabilityVotes.down || 0;
    var total = up + down;
    if(total === 0) return 50;
    return Math.round((up / total) * 100);
}

// ====================================================================
// 📊 MATERIAL USAGE TRACKING
// ====================================================================
function getMonthlyStats() {
    var now = new Date();
    var currentMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    var stats = JSON.parse(localStorage.getItem('wvtr_monthly_stats') || '{}');
    if(stats.month !== currentMonth && stats.counts) {
        stats.prevTop3 = Object.entries(stats.counts)
            .sort(function(a,b){ return b[1]-a[1]; }).slice(0,3)
            .map(function(e){ return { id: String(e[0]), count: e[1] }; });
        stats.counts = {};
    }
    stats.month  = currentMonth;
    stats.counts = stats.counts || {};
    return stats;
}

async function recordMaterialUsage(matId) {
    if(!matId) return;
    var activeLayers = State.layers.filter(function(l){ return l.mid !== null; });
    if(activeLayers.length !== 1) return;
    var currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0');
    var mat = DB.materials.find(function(m){ return String(m.id) === String(matId); });
    if(mat) {
        mat.usageCount    = (mat.usageCount || 0) + 1;
        mat.lastUsageMonth = currentMonth;
    }
    if(window.communityDB && mat && mat.firebaseDocId) {
        try {
            const ref = window.fbDoc(window.communityDB, "materials", mat.firebaseDocId);
            await window.fbUpdateDoc(ref, { usageCount: window.fbIncrement(1), lastUsageMonth: currentMonth });
        } catch(e) { console.warn("⚠️ Firebase usage sync failed:", e); }
    }
    if(State.tab === 'home') {
        setTimeout(function(){ if(typeof updateTop3UI === 'function') updateTop3UI(); }, 200);
    }
}

function getTop3Materials() {
    var currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0');
    var candidates = DB.materials.filter(function(m){ return m.lastUsageMonth === currentMonth && (m.usageCount || 0) > 0; });
    if(candidates.length === 0) {
        var stats = getMonthlyStats();
        var counts = stats.counts || {};
        return Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; }).slice(0,3).map(function(e, idx){
            var mat = DB.materials.find(function(m){ return String(m.id) === String(e[0]); });
            return mat ? { name:mat.name, company:mat.company||null, count:e[1], icon:['🥇','🥈','🥉'][idx] } : null;
        }).filter(Boolean);
    }
    candidates.sort(function(a,b){ return (b.usageCount||0)-(a.usageCount||0); });
    return candidates.slice(0,3).map(function(mat,idx){
        return { name:mat.name, company:mat.company||null, count:mat.usageCount||0, icon:['🥇','🥈','🥉'][idx] };
    });
}

async function refreshGlobalRankings() {
    var currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0');
    if(window.communityDB) {
        try {
            var q = window.fbQuery(window.fbCollection(window.communityDB,"materials"), window.fbOrderBy("usageCount","desc"));
            var snapshot = await window.fbGetDocs(q);
            var globalTop = [];
            snapshot.forEach(function(d){
                var data = d.data();
                if(data.lastUsageMonth === currentMonth && (data.usageCount||0) > 0) {
                    globalTop.push({ name:data.name, company:data.company||null, count:data.usageCount||0, firebaseDocId:d.id });
                }
            });
            if(globalTop.length > 0) {
                globalTop.forEach(function(item){
                    var localMat = DB.materials.find(function(m){ return m.firebaseDocId === item.firebaseDocId; });
                    if(localMat) { localMat.usageCount = item.count; localMat.lastUsageMonth = currentMonth; }
                });
                return globalTop.slice(0,3).map(function(m,idx){ return Object.assign({},m,{icon:['🥇','🥈','🥉'][idx]}); });
            }
        } catch(e) { console.warn("⚠️ Firebase ranking failed:", e); }
    }
    return getTop3Materials();
}

async function updateTop3UI() {
    var top3 = await refreshGlobalRankings();
    var container = document.getElementById('top3-ranking');
    if(!container) return;
    if(top3.length === 0) {
        container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#94a3b8;font-size:0.82rem">Start calculating to see rankings</div>';
    } else {
        var medals = ['01','02','03'];
        container.innerHTML = top3.map(function(m, idx){
            return '<div style="display:flex;align-items:center;gap:1rem;padding:0.85rem 1.5rem;border-bottom:1px solid #f8fafc">' +
                '<div style="font-size:0.72rem;font-weight:700;color:#cbd5e1;font-family:monospace;width:20px;flex-shrink:0">' + medals[idx] + '</div>' +
                '<div style="flex:1;min-width:0">' +
                '<div style="font-size:0.85rem;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + m.name + '</div>' +
                '<div style="font-size:0.72rem;color:#94a3b8;margin-top:0.1rem">' + (m.company || 'Community · ' + m.count + ' uses') + '</div>' +
                '</div>' +
                '<div style="font-size:0.72rem;font-weight:700;color:#2563eb">' + m.count + '</div>' +
                '</div>';
        }).join('');
    }
}
window.updateTop3UI = updateTop3UI;

// ====================================================================
// 🃏 MATERIAL CARD HTML
// ====================================================================
function matCardHTML(m, q) {
    var isUserMat = !DEFAULT_MATERIALS.some(function(d){ return d.id === m.id; });
    var isComm    = !!(m.isCommunity || (m.id && String(m.id).startsWith('fb_')));
    var verified  = isVerifiedMaterial(m);
    var relScore  = getReliabilityScore(m);
    var userVote  = hasUserVoted(m.id);
    Engine.mode = State.mode;
var vals = State.mode === 'wvtr' ? (m.wvtrValues || []) : (m.otrValues || []);
    var arrOk     = Engine.validateArrhenius(m).valid;
    var currentUnit = getUnit();
    var idStr     = String(m.id);

    function hl(str) {
        if(!q || !str) return str || '';
        var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')','gi');
        return String(str).replace(re,'<mark style="background:#fef08a;color:#713f12;padding:0 2px;border-radius:2px">$1</mark>');
    }

    var tags = '';
    if(m.isMetallized) tags += '<span class="badge badge-yellow" style="font-size:0.65rem">⚙️ Metallized</span> ';
    for(var t=0; t<vals.length; t++){
        var cond = (m.validConditions && m.validConditions[t]) ? m.validConditions[t] : {temperature:'?',humidity:'?'};
        var v = vals[t] || {value:'?',thickness:'?'};
        tags += '<span class="mat-tag">'+Engine.getUnits().label+': <strong>'+v.value+'</strong> '+currentUnit+' · '+v.thickness+'µm · '+cond.temperature+'°C/'+cond.humidity+'%</span>';
    }

    var shareLabel = m.firebaseDocId ? '🔄 Update community' : '🌍 Share with community';
    var hasEmail   = !!(m.supplierEmail && m.supplierEmail.trim());

    var btns =
        '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();showMatModal(\'' + idStr + '\')">✏️ Edit</button>' +
        '<button class="btn btn-sm btn-danger"  onclick="event.stopPropagation();softDeleteMat(\'' + idStr + '\')">🗑️ Delete</button>' +
        '<button class="btn btn-sm ' + (m.firebaseDocId ? 'btn-success' : 'btn-primary') + '" ' +
            'onclick="event.stopPropagation();submitToFirebaseById(\'' + idStr + '\')">' + shareLabel + '</button>' +
        '<button class="btn btn-sm btn-outline" ' +
            (hasEmail ? '' : 'style="opacity:0.4;cursor:not-allowed" title="No supplier email — edit material to add it" ') +
            'onclick="event.stopPropagation();' +
            (hasEmail ? 'contactSupplier(\'' + (m.name||'').replace(/'/g,"\\'") + '\',\'' + (m.company||'').replace(/'/g,"\\'") + '\',\'' + (m.supplierEmail||'').replace(/'/g,"\\'") + '\')' : '') +
            '">📧 Contact supplier</button>';

    var upStyle   = userVote === 'up'   ? 'background:var(--success-light);border-color:var(--success);color:var(--success)' : '';
    var downStyle = userVote === 'down' ? 'background:var(--danger-light);border-color:var(--danger);color:var(--danger)' : '';
    var currentTM = State.mode === 'wvtr' ? (m.testMethodWVTR||'') : (m.testMethodOTR||'');

    return '<div class="material-item' + (verified ? ' verified-item' : '') + '" onclick="this.classList.toggle(\'expanded\')">' +

        '<div class="mat-header">' +
            '<h3>' +
                '<span>' + hl(m.name) + '</span>' +
                (isComm    ? '<span class="mat-comm-badge">🌍 Community</span>' : '') +
                (verified  ? '<span class="badge-verified" title="Verified by ' + verified.by + '">✅ Verified</span>' : '') +
                '<span style="font-weight:400;color:var(--text-light);font-size:0.72rem">[' + (m.family||'?') + ']</span>' +
                (arrOk     ? '<span class="badge badge-green">✓ Arrhenius</span>' : '') +
            '</h3>' +
            '<svg class="chevron" style="margin-left:auto;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +

        '<div class="mat-body"><div class="mat-body-content">' +
            '<div class="mat-tags">' + tags + '</div>' +
            '<div class="mat-info">' +
                (currentTM ? '<div class="mat-info-item"><strong>Test standard</strong><span class="mat-testmethod">' + currentTM + '</span></div>' : '') +
                (m.company ? '<div class="mat-info-item"><strong>Supplier</strong><span>' + hl(m.company) + '</span></div>' : '') +
                (m.supplierEmail ? '<div class="mat-info-item"><strong>Email</strong><span style="color:var(--primary)">' + m.supplierEmail + '</span></div>' : '') +
                (m.tdsLink ? '<div class="mat-info-item"><strong>TDS</strong><a href="' + m.tdsLink + '" target="_blank" onclick="event.stopPropagation()">View →</a></div>' : '') +
            '</div>' +
            '<div class="mat-actions">' + btns + '</div>' +
            '<div class="mat-voting">' +
                '<div class="mat-voting-label">' +
                    '<span>Community reliability</span>' +
                    '<span class="reliability-badge ' + (relScore>=70?'high':relScore>=40?'medium':'low') + '">' + relScore + '%</span>' +
                '</div>' +
                '<div class="mat-voting-buttons">' +
                    '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();voteReliability(\'' + idStr + '\',\'up\')"   style="' + upStyle   + '" title="' + (userVote==='up'  ?'Remove vote':'Reliable')   + '">👍</button>' +
                    '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();voteReliability(\'' + idStr + '\',\'down\')" style="' + downStyle + '" title="' + (userVote==='down'?'Remove vote':'Unreliable') + '">👎</button>' +
                '</div>' +
            '</div>' +
        '</div></div></div>';
}

// ====================================================================
// 🔍 FILTER + RENDER LIST
// ====================================================================
function matApplyFilters() {
    Engine.mode = State.mode;
    var q       = ((document.getElementById('mat-search')  ? document.getElementById('mat-search').value  : State.searchQuery) || '').trim().toLowerCase();
    var fc      = (document.getElementById('mf-company')   ? document.getElementById('mf-company').value  : '');
    var fperf   = (document.getElementById('mf-perf')      ? document.getElementById('mf-perf').value     : '');
    var fmethod = (document.getElementById('mf-method')    ? document.getElementById('mf-method').value   : '');
    var ffamily = (document.getElementById('mf-family')    ? document.getElementById('mf-family').value   : '');
    var ftype   = (document.getElementById('mf-type')      ? document.getElementById('mf-type').value     : '');

    var chipsEl = document.getElementById('mf-chips');
    if(chipsEl) {
        var chips = [];
        if(fc)      chips.push({ label:'Supplier: '+fc,              clear:"document.getElementById('mf-company').value='';matApplyFilters()" });
        if(fperf)   chips.push({ label:State.mode.toUpperCase()+': '+fperf, clear:"document.getElementById('mf-perf').value='';matApplyFilters()" });
        if(fmethod) chips.push({ label:'Method: '+fmethod,           clear:"document.getElementById('mf-method').value='';matApplyFilters()" });
        if(ffamily) chips.push({ label:'Family: '+ffamily,           clear:"document.getElementById('mf-family').value='';matApplyFilters()" });
        if(ftype)   chips.push({ label:'Type: '+ftype,               clear:"document.getElementById('mf-type').value='';matApplyFilters()" });
        chipsEl.innerHTML = chips.map(function(c){
            return '<span onclick="' + c.clear + '" style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;background:var(--primary-light);color:var(--primary);font-size:0.72rem;font-weight:600;cursor:pointer">✕ ' + c.label + '</span>';
        }).join('');
    }

    var filtered = DB.materials.filter(function(m) {
        if(fc) { var hay = ((m.company||'')+' '+(m.name||'')).toLowerCase(); if(hay.indexOf(fc.toLowerCase()) < 0) return false; }
        if(fperf) {
            var val = State.mode === 'wvtr' ? ((m.wvtrValues&&m.wvtrValues[0])?m.wvtrValues[0].value:null) : ((m.otrValues&&m.otrValues[0])?m.otrValues[0].value:null);
            if(val === null) return false;
            if(fperf==='ultra' && !(val < 0.1))  return false;
            if(fperf==='high'  && !(val < 1))    return false;
            if(fperf==='med'   && !(val < 10))   return false;
            if(fperf==='low'   && !(val >= 10))  return false;
        }
        if(fmethod) { var tm = State.mode==='wvtr'?(m.testMethodWVTR||''):(m.testMethodOTR||''); if(tm.trim() !== fmethod) return false; }
        if(ffamily && m.family !== ffamily) return false;
        if(ftype==='community' && !m.isCommunity) return false;
        if(ftype==='verified'  && !isVerifiedMaterial(m)) return false;
        if(ftype==='metallized'&& !m.isMetallized) return false;
        if(ftype==='arrhenius' && !Engine.validateArrhenius(m).valid) return false;
        if(q) {
            var numRe = /^\s*(wvtr|otr)\s*(<=|>=|<|>|=)\s*([\d.]+)\s*$/i;
            var nm = q.match(numRe);
            if(nm) {
                var type2=nm[1].toLowerCase(), op=nm[2], thresh=parseFloat(nm[3]);
                var vals2 = type2==='wvtr'?(m.wvtrValues||[]):(m.otrValues||[]);
                var found2 = vals2.some(function(v){
                    if(op==='<')  return v.value < thresh;
                    if(op==='>')  return v.value > thresh;
                    if(op==='<=') return v.value <= thresh;
                    if(op==='>=') return v.value >= thresh;
                    if(op==='=')  return v.value == thresh;
                    return false;
                });
                if(!found2) return false;
            } else {
                var hay2 = (m.name+' '+(m.family||'')+' '+(m.company||'')+' '+(m.testMethodWVTR||'')+' '+(m.testMethodOTR||'')).toLowerCase();
                if(hay2.indexOf(q) < 0) return false;
            }
        }
        return true;
    });

    filtered.sort(function(a,b){ return a.name.localeCompare(b.name); });

    var listEl  = document.getElementById('mat-list');
    var labelEl = document.getElementById('mat-result-label');
    if(labelEl) labelEl.innerHTML = 'Showing <strong>' + filtered.length + '</strong> of ' + DB.materials.length + ' materials';
    if(!listEl) return;
    if(filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;margin-bottom:0.5rem;opacity:0.3"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg><p>No materials match these filters</p></div>';
        return;
    }
    listEl.innerHTML = filtered.map(function(m){ return matCardHTML(m, q); }).join('');
}

function onMatSearch(val) {
    State.searchQuery = val || '';
    matApplyFilters();
    setTimeout(function(){
        var input = document.getElementById('mat-search');
        if(input){ input.focus(); input.setSelectionRange(val.length, val.length); }
    }, 10);
}

// ====================================================================
// 📄 RENDER MATERIALS PAGE
// ====================================================================
function renderMaterials() {
    Engine.mode = State.mode;
    var currentLabel = State.mode === 'wvtr' ? 'WVTR' : 'OTR';
    var currentUnit  = State.mode === 'wvtr' ? 'g/m²·day' : 'cc/m²·day';

    var companies={}, methods={}, families={};
    DB.materials.forEach(function(m){
        if(m.company && m.company.trim()) companies[m.company.trim()] = true;
        var tm = State.mode==='wvtr'?(m.testMethodWVTR||''):(m.testMethodOTR||'');
        if(tm) methods[tm.trim()] = true;
        if(m.family) families[m.family] = true;
    });

    var compOpts = Object.keys(companies).sort().map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
    var methOpts = Object.keys(methods).sort().map(function(m){ return '<option value="'+m+'">'+m+'</option>'; }).join('');
    var famOpts  = Object.keys(families).sort().map(function(f){ return '<option value="'+f+'">'+f+'</option>'; }).join('');

    return '<div style="padding:0.25rem 0">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px">' +
            '<div style="font-size:1rem;font-weight:600">Materials <span class="badge badge-blue">' + DB.materials.length + '</span></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
                '<button class="btn btn-sm btn-primary"  onclick="showMatModal()">+ Add material</button>' +
                '<button class="btn btn-sm btn-outline"  onclick="showBulkImport()">Import CSV</button>' +
                '<button class="btn btn-sm btn-outline"  onclick="showTrashPanel()" title="View deleted materials" style="' + (_matTrash.length > 0 ? 'border-color:var(--danger);color:var(--danger)' : '') + '">' +
                    '🗑️ Trash' + (_matTrash.length > 0 ? ' <span class="badge badge-red">'+_matTrash.length+'</span>' : '') +
                '</button>' +
            '</div>' +
        '</div>' +

        '<div class="card" style="margin-bottom:0.75rem">' +
            '<div style="font-size:0.75rem;font-weight:600;color:var(--text-light);margin-bottom:0.6rem">Filters</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:0.6rem">' +
                '<div class="form-group" style="margin:0"><label>Supplier / brand</label>' +
                    '<select class="form-input" id="mf-company" onchange="matApplyFilters()" style="font-size:0.78rem"><option value="">All suppliers</option>' + compOpts + '</select></div>' +
                '<div class="form-group" style="margin:0"><label>' + currentLabel + ' level</label>' +
                    '<select class="form-input" id="mf-perf" onchange="matApplyFilters()" style="font-size:0.78rem">' +
                    '<option value="">Any</option><option value="ultra">&lt; 0.1 ' + currentUnit + '</option>' +
                    '<option value="high">&lt; 1 ' + currentUnit + '</option><option value="med">&lt; 10 ' + currentUnit + '</option>' +
                    '<option value="low">&gt; 10 ' + currentUnit + '</option></select></div>' +
                '<div class="form-group" style="margin:0"><label>Test method</label>' +
                    '<select class="form-input" id="mf-method" onchange="matApplyFilters()" style="font-size:0.78rem"><option value="">All methods</option>' + methOpts + '</select></div>' +
                '<div class="form-group" style="margin:0"><label>Family</label>' +
                    '<select class="form-input" id="mf-family" onchange="matApplyFilters()" style="font-size:0.78rem"><option value="">All families</option>' + famOpts + '</select></div>' +
                '<div class="form-group" style="margin:0"><label>Type</label>' +
                    '<select class="form-input" id="mf-type" onchange="matApplyFilters()" style="font-size:0.78rem">' +
                    '<option value="">All types</option><option value="community">Community only</option>' +
                    '<option value="verified">Verified only</option><option value="metallized">Metallized only</option>' +
                    '<option value="arrhenius">Arrhenius ready</option></select></div>' +
            '</div>' +
           '<div id="mf-chips" style="display:flex;flex-wrap:wrap;gap:5px"></div>' +
        '</div>' +

        '<div class="search-input" style="position:relative;margin-bottom:0.75rem">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--text-light);pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
            '<input type="text" class="form-input" id="mat-search" style="padding-left:32px;font-size:0.82rem" ' +
                'placeholder="Search by name, supplier, value (e.g. wvtr &lt; 2, otr &gt; 500)…" ' +
                'value="' + State.searchQuery + '" oninput="onMatSearch(this.value)">' +
        '</div>' +

        '<div style="background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:1rem 1.25rem;margin-bottom:0.75rem;box-shadow:0 2px 8px rgba(0,0,0,0.06)">' +
            '<div style="font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;font-size:0.68rem;margin-bottom:0.65rem;display:flex;align-items:center;gap:0.4rem">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:#2563eb"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
                'Badge Guide' +
           '</div>' +
'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
    '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.75rem;background:#f5f3ff;border-radius:8px;border-left:3px solid #7c3aed">' +
        '<span class="badge badge-purple" style="flex-shrink:0;white-space:nowrap">🌍 Community</span>' +
        '<span style="color:#374151;font-size:0.72rem;line-height:1.4">User-submitted data.</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.75rem;background:#f0fdf4;border-radius:8px;border-left:3px solid #16a34a">' +
        '<span class="badge badge-green" style="flex-shrink:0;white-space:nowrap">✅ Verified</span>' +
        '<span style="color:#374151;font-size:0.72rem;line-height:1.4">Certified Materials</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.75rem;background:#fefce8;border-radius:8px;border-left:3px solid #d97706">' +
        '<span class="badge badge-yellow" style="flex-shrink:0;white-space:nowrap">⚙️ Metallized</span>' +
        '<span style="color:#374151;font-size:0.72rem;line-height:1.4">Barrier independent of thickness.</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.75rem;background:#f0fdf4;border-radius:8px;border-left:3px solid #16a34a">' +
        '<span class="badge badge-green" style="flex-shrink:0;white-space:nowrap">✓ Arrhenius</span>' +
        '<span style="color:#374151;font-size:0.72rem;line-height:1.4">≥ 2 temperatures at constant RH.</span>' +
    '</div>' +
            '</div>' +
        '</div>' +

        '<div style="font-size:0.75rem;color:var(--text-light);margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center">' +
            '<span id="mat-result-label">Showing <strong>' + DB.materials.length + '</strong> materials</span>' +
            '<span>' + currentLabel + ' mode · ' + currentUnit + '</span>' +
        '</div>' +
        '<div id="mat-list" style="display:flex;flex-direction:column;gap:6px"></div>' +
    '</div>';
}

// ====================================================================
// ✏️ ADD / EDIT MATERIAL MODAL — ✅ FIX: Alert timing corretto
// ====================================================================
function showMatModal(editId) {
    var mat = null;
    if(editId !== undefined && editId !== null) {
        for(var i=0; i<DB.materials.length; i++) {
            if(String(DB.materials[i].id) === String(editId)){ mat = DB.materials[i]; break; }
        }
    }

    var isDefaultMat = false;
    var isCommMat    = false;
    if(mat) {
        for(var di=0; di<DEFAULT_MATERIALS.length; di++) {
            if(DEFAULT_MATERIALS[di].id == mat.id){ isDefaultMat = true; break; }
        }
        isCommMat = !!(mat.isCommunity || (mat.id && String(mat.id).startsWith('fb_')));
    }
    var isReadOnly = isDefaultMat || isCommMat;

    // ✅ AVViso inline per materiali read-only (visibile vicino a Save)
    var saveWarningHTML = '';
    if(isReadOnly) {
        saveWarningHTML = 
            '<div style="margin:1rem 0 0.5rem 0;padding:0.75rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;display:flex;gap:0.5rem;align-items:flex-start">' +
            '<span style="font-size:1.1rem;flex-shrink:0">⚠️</span>' +
            '<div style="font-size:0.78rem;color:#991b1b;line-height:1.5">' +
            '<strong>Warning: This measurement cannot be edited or deleted after saving.</strong><br>' +
            'Please double-check all values before confirming. If you need corrections later, contact support at the bottom of the Home page.' +
            '</div></div>';
    }
    var currentMode  = State.mode;
    var currentLabel = currentMode === 'wvtr' ? 'WVTR' : 'OTR';
    var currentUnit  = currentMode === 'wvtr' ? 'g/m²·day' : 'cc/m²·day';
    var currentValues = currentMode === 'wvtr'
        ? (mat ? mat.wvtrValues : [{value:'',thickness:''}])
        : (mat ? mat.otrValues  : [{value:'',thickness:''}]);
    var conds = mat ? mat.validConditions : [{temperature:'',humidity:''}];

    var familyOpts = '<option value="">Select family...</option>';
    for(var fam in POLYMER_FAMILIES){
        var selected = (mat && mat.family === fam) ? ' selected' : '';
        familyOpts += '<option value="'+fam+'"'+selected+'>'+fam+'</option>';
    }

    var metallizedCheck = mat && mat.isMetallized ? 'checked' : '';
    var RO      = isReadOnly ? ' disabled readonly style="opacity:0.6;cursor:not-allowed;background:#f1f5f9"' : '';
    var ROcheck = isReadOnly ? ' disabled style="opacity:0.6;cursor:not-allowed"' : '';

    var readOnlyBanner = '';
    if(isReadOnly) {
        var sourceLabel = isCommMat ? '🌍 Community material' : '📦 Built-in material';
        readOnlyBanner =
            '<div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #fcd34d;border-radius:8px;padding:0.65rem 0.9rem;margin-bottom:0.9rem;display:flex;gap:0.5rem;align-items:flex-start">' +
            '<span style="font-size:1rem;flex-shrink:0">🔒</span>' +
            '<div><div style="font-size:0.82rem;font-weight:700;color:#92400e">Read-Only: '+sourceLabel+'</div>' +
            '<div style="font-size:0.72rem;color:#a16207;margin-top:0.2rem">Existing data is protected. You can only <strong>add new test conditions</strong> at the bottom.</div>' +
            '</div></div>';
    }

    var metallizedHTML =
        '<div style="margin:0.5rem 0;padding:0.4rem 0.6rem;background:var(--warning-light);border-radius:6px;display:flex;align-items:center;gap:0.4rem">' +
        '<input type="checkbox" id="mf-metallized" '+metallizedCheck+ROcheck+'>' +
        '<label for="mf-metallized" style="font-size:0.75rem;color:var(--text-light);margin:0;cursor:'+(isReadOnly?'not-allowed':'pointer')+'">' +
        '<strong>Metallized/Coated film</strong> – Barrier independent of substrate thickness</label></div>';

    var hygroHTML = '';
    if(!isReadOnly) {
        var betaId  = currentMode === 'wvtr' ? 'mf-beta-wvtr' : 'mf-beta-otr';
        var refRHId = currentMode === 'wvtr' ? 'mf-refrh-wvtr' : 'mf-refrh-otr';
        hygroHTML =
            '<div class="form-group" style="margin-top:0.8rem">' +
            '<label>Hygroscopic Properties ('+currentLabel+')</label>' +
            '<div class="grid grid-2" style="gap:0.5rem">' +
            '<div class="form-group" style="margin:0"><label>β Coefficient (%/RH)</label>' +
            '<input type="number" step="0.001" class="form-input" id="'+betaId+'" value="'+(mat && mat[betaId] ? mat[betaId] : '')+'" placeholder="0.034"'+RO+'></div>' +
            '<div class="form-group" style="margin:0"><label>Reference RH (%)</label>' +
            '<input type="number" class="form-input" id="'+refRHId+'" value="'+(mat && mat[refRHId] ? mat[refRHId] : 50)+'" placeholder="50"'+RO+'></div>' +
            '</div></div>';
    }

    var ctmWVTR = ['','ASTM F1249','ISO 15106-3','ASTM E96','JIS K7129','MOCON PERMATRAN','DIN 53122','Custom/Other'];
    var ctmOTR  = ['','ASTM D3985','ISO 15106-2','JIS K7126','MOCON OXTRAN','Custom/Other'];
    var ctm = currentMode === 'wvtr' ? ctmWVTR : ctmOTR;
    var currentTM = currentMode === 'wvtr' ? (mat ? mat.testMethodWVTR : '') : (mat ? mat.testMethodOTR : '');
    var isCustomTM = currentTM && ctm.indexOf(currentTM) < 0;
    var testMethodBlock =
        '<div class="form-group" id="mf-testmethod-group">' +
        '<label>Test Method for '+currentLabel+'</label>' +
        '<select class="form-input" id="mf-testmethod-select" onchange="onTestMethodSelectChange(this)"'+RO+'>' +
        (function(){
            var o='<option value="">Select or enter method...</option>';
            for(var t=0;t<ctm.length;t++){
                var s=(currentTM===ctm[t])?' selected':'';
                o+='<option value="'+ctm[t]+'"'+s+'>'+(ctm[t]||'-- Select --')+'</option>';
            }
            if(!isReadOnly) o+='<option value="_custom" style="font-weight:600">+ Enter custom method...</option>';
            return o;
        })() +
        '</select>' +
        '<input type="text" class="form-input" id="mf-testmethod-custom" value="'+(isCustomTM?currentTM:'')+'" placeholder="Enter custom method..." style="display:'+(isCustomTM?'block':'none')+';margin-top:0.3rem"'+RO+'>' +
        '</div>';

    var rowsHTML = '';
    for(var r=0; r<currentValues.length; r++){
        var v = currentValues[r] || {value:'',thickness:''};
        var c = conds[r] || {temperature:'',humidity:''};
        var rowRO = isReadOnly ? ' disabled readonly style="opacity:0.65;cursor:not-allowed;background:#f1f5f9"' : '';
        rowsHTML +=
            '<div class="wvtr-row-form" style="grid-template-columns:1fr 1fr;'+(isReadOnly?'background:#f8fafc;border-radius:6px;padding:0.3rem 0.5rem;border:1px solid #e2e8f0;':'')+'">'+
            '<div style="display:flex;gap:0.4rem">' +
            '<div class="form-group" style="margin:0;flex:1"><label>'+currentLabel+' Value</label><input type="number" step="any" class="form-input mf-val"   value="'+(v.value||'')+'"       placeholder="0"  '+rowRO+'></div>' +
            '<div class="form-group" style="margin:0;flex:1"><label>Thickness (µm)</label>     <input type="number" step="any" class="form-input mf-thick" value="'+(v.thickness||'')+'"   placeholder="0"  '+rowRO+'></div>' +
            '</div>' +
            '<div style="display:flex;gap:0.4rem">' +
            '<div class="form-group" style="margin:0;flex:1"><label>Temp (°C)</label>          <input type="number" step="any" class="form-input mf-temp"  value="'+(c.temperature||'')+'" placeholder="23" '+rowRO+'></div>' +
            '<div class="form-group" style="margin:0;flex:1"><label>Humidity (%)</label>        <input type="number" step="any" class="form-input mf-hum"   value="'+(c.humidity||'')+'"   placeholder="50" '+rowRO+'></div>' +
            '</div>' +
            '</div>';
    }

    var addCondStyle = isReadOnly
        ? 'style="margin-top:0.75rem;border:2px solid var(--primary);background:var(--primary-light);color:var(--primary);font-weight:700"'
        : 'style="margin-top:0.4rem"';
    // ✅ Costruisci il body del modal in una variabile (più sicuro)
    var modalBody = 
        readOnlyBanner +
        '<div class="form-group"><label>Name *</label><input type="text" class="form-input" id="mf-name" value="'+(mat?mat.name:'')+'"'+RO+'></div>' +
        '<div class="form-group"><label>Material Family</label><select class="form-input" id="mf-family"'+RO+'>'+familyOpts+'</select></div>' +
        '<div class="form-group"><label>Company Name</label><input type="text" class="form-input" id="mf-company" value="'+(mat?mat.company||'':'')+'" placeholder="e.g. DuPont, 3M..."'+RO+'></div>' +
        '<div class="form-group"><label>Contact Email <span style="font-size:0.68rem;color:var(--text-light);font-weight:400">(enables Contact Supplier button)</span></label><input type="email" class="form-input" id="mf-email" value="'+(mat&&mat.supplierEmail?mat.supplierEmail:'')+'" placeholder="supplier@company.com"></div>' +
        '<div class="form-group"><label>TDS Link (optional)</label><input type="url" class="form-input" id="mf-tdslink" value="'+(mat?mat.tdsLink||'':'')+'" placeholder="https://..."'+RO+'></div>' +
        metallizedHTML + hygroHTML + testMethodBlock +
        '<div style="margin:0.5rem 0;padding:0.4rem 0.6rem;background:var(--primary-light);border-radius:6px;display:flex;align-items:center;gap:0.4rem"><span style="font-size:0.75rem;color:var(--text-light)"><strong>'+currentLabel+'</strong> • Unit: '+currentUnit+'</span></div>' +
        (isReadOnly && currentValues.length > 0 ? '<div style="font-size:0.72rem;font-weight:600;color:var(--text-light);letter-spacing:0.06em;text-transform:uppercase;margin:0.5rem 0 0.3rem 0">Existing data (read-only)</div>' : '') +
        '<div id="mf-rows">'+rowsHTML+'</div>' +
        (isReadOnly ? '<div style="margin-top:0.9rem;padding-top:0.75rem;border-top:2px dashed var(--primary);"><div style="font-size:0.72rem;font-weight:600;color:var(--primary);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.4rem">Add New Condition</div>' : '') +
        '<button class="btn btn-outline btn-full" '+addCondStyle+' onclick="addMatRow()">'+(isReadOnly?'+ Add New Condition (allowed)':'+ Add Condition')+'</button>' +
        (isReadOnly ? '</div>' : '') +
        saveWarningHTML; // ✅ Avviso inline aggiunto qui

    // ✅ Chiamata corretta a Modal.open (3 argomenti: title, body, callback)
    Modal.open(
        editId !== undefined ? 'Edit Material' : 'Add Material',
        modalBody,
        function(){
            // === VALIDAZIONE ===
            var name = document.getElementById('mf-name').value.trim();
            if(!name){ alert('Enter material name'); return false; }
            var family = document.getElementById('mf-family').value;
            var company = document.getElementById('mf-company').value.trim();
            var tdsLink = document.getElementById('mf-tdslink').value.trim();
            if(tdsLink && !tdsLink.startsWith('http')){ alert('TDS Link must start with http:// or https://'); return false; }

            var testMethodWVTR = mat ? mat.testMethodWVTR : '';
            var testMethodOTR = mat ? mat.testMethodOTR : '';
            if(!isReadOnly){
                var tmSelect = document.getElementById('mf-testmethod-select');
                var tmCustom = document.getElementById('mf-testmethod-custom');
                var testMethodValue = '';
                if(tmSelect && tmSelect.value && tmSelect.value !== '_custom') testMethodValue = tmSelect.value;
                if(tmCustom && tmCustom.style && tmCustom.style.display !== 'none' && tmCustom.value.trim()) testMethodValue = tmCustom.value.trim();
                if(currentMode === 'wvtr') testMethodWVTR = testMethodValue;
                else testMethodOTR = testMethodValue;
            }
            var isMetallized = document.getElementById('mf-metallized') ? document.getElementById('mf-metallized').checked : false;

            // === RACCOLTA VALORI ===
            var allValInputs = document.querySelectorAll('.mf-val');
            var allThickInputs = document.querySelectorAll('.mf-thick');
            var allTempInputs = document.querySelectorAll('.mf-temp');
            var allHumInputs = document.querySelectorAll('.mf-hum');
            var existingCount = isReadOnly ? currentValues.length : 0;
            var valuesArray = [];
            var conditionsArray = [];

            for(var i=0; i<allValInputs.length; i++){
                if(isReadOnly && i < existingCount){ valuesArray.push(currentValues[i]); conditionsArray.push(conds[i]); continue; }
                var val = parseFloat(allValInputs[i].value);
                var thick = parseFloat(allThickInputs[i].value);
                var temp = parseFloat(allTempInputs[i].value);
                var hum = parseFloat(allHumInputs[i].value);
                if(isNaN(val)||val<0){ alert(currentLabel+' value invalid in row '+(i+1)); return false; }
                if(isNaN(thick)||thick<=0){ alert('Thickness must be > 0 in row '+(i+1)); return false; }
                if(isNaN(temp)){ alert('Temperature required in row '+(i+1)); return false; }
                if(isNaN(hum)){ alert('Humidity required in row '+(i+1)); return false; }
                valuesArray.push({value:val,thickness:thick});
                conditionsArray.push({temperature:temp,humidity:hum});
            }
            if(isReadOnly && valuesArray.length === existingCount){
                alert('ℹ️ No new conditions added. Use "+ Add New Condition" to extend this material.');
                return false;
            }

            // === PREPARA DATI ===
            var finalFamily = family || getFamily(name);
            var betaId = currentMode==='wvtr'?'mf-beta-wvtr':'mf-beta-otr';
            var refRHId = currentMode==='wvtr'?'mf-refrh-wvtr':'mf-refrh-otr';
            var betaEl = document.getElementById(betaId);
            var refRHEl = document.getElementById(refRHId);
            var betaVal = betaEl ? (parseFloat(betaEl.value) || 0) : 0;
            var refRHVal = refRHEl ? (parseFloat(refRHEl.value) || 50) : 50;

            var matData = {
                name: name, family: finalFamily, company: company, tdsLink: tdsLink,
                supplierEmail: (document.getElementById('mf-email') ? document.getElementById('mf-email').value.trim() : ''),
                isMetallized: isMetallized,
                hygroscopicBetaWVTR: currentMode==='wvtr' ? betaVal : (mat?mat.hygroscopicBetaWVTR:0),
                hygroscopicRefRHWVTR: currentMode==='wvtr' ? refRHVal : (mat?mat.hygroscopicRefRHWVTR:50),
                hygroscopicBetaOTR: currentMode==='otr' ? betaVal : (mat?mat.hygroscopicBetaOTR:0),
                hygroscopicRefRHOTR: currentMode==='otr' ? refRHVal : (mat?mat.hygroscopicRefRHOTR:50),
                isHygroscopic: betaVal > 0, hygroscopicBeta: betaVal, hygroscopicRefRH: refRHVal,
                testMethodWVTR: testMethodWVTR, testMethodOTR: testMethodOTR,
                wvtrValues: currentMode==='wvtr' ? valuesArray : (mat&&mat.wvtrValues?mat.wvtrValues:[]),
                otrValues: currentMode==='otr' ? valuesArray : (mat&&mat.otrValues?mat.otrValues:[]),
                validConditions: conditionsArray
            };

            // === SALVATAGGIO (UNA SOLA VOLTA) ===
            if(editId !== null && editId !== undefined) DB.updateMat(editId, matData);
            else DB.addMat(matData);
            render();
            return true;
        }
    );
    setTimeout(function(){
        var tmSelect = document.getElementById('mf-testmethod-select');
        var tmCustom = document.getElementById('mf-testmethod-custom');
        if(!tmSelect || !tmCustom) return;
        if(isCustomTM){ tmCustom.style.display='block'; tmSelect.value=''; }
    }, 50);
}

function onTestMethodSelectChange(select) {
    var customInput = document.getElementById('mf-testmethod-custom');
    if(!customInput) return;
    if(select.value === '_custom'){ customInput.style.display='block'; customInput.focus(); select.value=''; }
    else customInput.style.display='none';
}

function addMatRow() {
    var currentMode  = State.mode;
    var currentLabel = currentMode === 'wvtr' ? 'WVTR' : 'OTR';
    document.getElementById('mf-rows').insertAdjacentHTML('beforeend',
        '<div class="wvtr-row-form" style="grid-template-columns:1fr 1fr;animation:fadeIn 0.2s ease;">' +
        '<div style="display:flex;gap:0.4rem">' +
        '<div class="form-group" style="margin:0;flex:1"><label>'+currentLabel+' Value</label><input type="number" step="any" class="form-input mf-val"   placeholder="0"></div>' +
        '<div class="form-group" style="margin:0;flex:1"><label>Thickness (µm)</label>     <input type="number" step="any" class="form-input mf-thick" placeholder="0"></div>' +
        '</div>' +
        '<div style="display:flex;gap:0.4rem">' +
        '<div class="form-group" style="margin:0;flex:1"><label>Temp (°C)</label>          <input type="number" step="any" class="form-input mf-temp"  placeholder="23"></div>' +
        '<div class="form-group" style="margin:0;flex:1"><label>Humidity (%)</label>        <input type="number" step="any" class="form-input mf-hum"   placeholder="50"></div>' +
        '</div>' +
        '</div>');
}

// ====================================================================
// 📥 BULK IMPORT
// ====================================================================
function showBulkImport() {
    Modal.open('Bulk Import (CSV)',
        '<p style="font-size:.78rem;color:var(--text-light);margin-bottom:.75rem">' +
        '<strong>CSV format:</strong><br>' +
        'Name,Family,TestMethod,IsMetallized,WVTR_Value,WVTR_Thickness,OTR_Value,OTR_Thickness,Temp1,Hum1[,Temp2,Hum2,...]<br><br>' +
        '<strong>Example:</strong><br>PET,PET,ASTM F1249,false,1.0,500,150,500,23,50,38,50<br>' +
        'Alu-PET,PET,,true,0.01,500,0.005,500,23,50</p>' +
        '<div class="import-area"><textarea id="bulk-data" placeholder="PET,PET,ASTM F1249,false,1.0,500,150,500,23,50,38,50"></textarea></div>' +
        '<p style="font-size:.7rem;color:var(--text-light);margin-top:.5rem">Or <a href="#" onclick="document.getElementById(\'bulk-file\').click();return false">upload JSON</a>' +
        '<input type="file" id="bulk-file" accept=".json" style="display:none" onchange="importFile(this)"></p>',
        function(){
            var data = document.getElementById('bulk-data').value.trim();
            if(!data){ alert('Paste data first'); return false; }
            try {
                var lines = data.split('\n').filter(function(l){ return l.trim(); });
                var count = 0;
                for(var li=0; li<lines.length; li++){
                    var cols = lines[li].split(/,\s*|\t/).map(function(s){ return s.trim(); });
                    if(cols.length < 10) continue;
                    var name        = cols[0];
                    var family      = cols[1] || getFamily(cols[0]);
                    var testMethod  = cols[2] || '';
                    var isMetallized= (cols[3]||'').toLowerCase() === 'true';
                    var wvtr = parseFloat(cols[4])||0; var wvtrT = parseFloat(cols[5])||0;
                    var otr  = parseFloat(cols[6])||0; var otrT  = parseFloat(cols[7])||0;
                    var validConditions = [];
                    for(var i=8; i<cols.length; i+=2){
                        var te=parseFloat(cols[i]); var h=parseFloat(cols[i+1]);
                        if(!isNaN(te)&&!isNaN(h)) validConditions.push({temperature:te,humidity:h});
                    }
                    if(name && validConditions.length > 0){
                        DB.addMat({ name:name, family:family, testMethod:testMethod, isMetallized:isMetallized,
                            wvtrValues:[{value:wvtr,thickness:wvtrT}], otrValues:[{value:otr,thickness:otrT}], validConditions:validConditions });
                        count++;
                    }
                }
                alert('Imported '+count+' materials'); render(); return true;
            } catch(e){ alert('Import error: '+e.message); return false; }
        }
    );
}

function importFile(input) {
    var file = input.files[0]; if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e){
        try {
            var data = JSON.parse(e.target.result);
            if(data.materials){ DB.importAll(JSON.stringify(data)); alert('Imported '+data.materials.length+' materials'); Modal.close(); render(); }
        } catch(err){ alert('File import error: '+err.message); }
    };
    reader.readAsText(file);
}

// ====================================================================
// 📥 EXTERNAL materials.json LOADER
// ====================================================================
async function loadExternalMaterialsDB() {
  try {
    var res = await fetch('materials.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var externalMats = Array.isArray(data) ? data : (data.materials || []);
    if (!externalMats.length) return;

    var existingByFirebaseId = {};
    var existingByName = {};
    for (var i = 0; i < DB.materials.length; i++) {
      var m = DB.materials[i];
      if (m.firebaseDocId) existingByFirebaseId[m.firebaseDocId] = m;
      existingByName[m.name.trim().toLowerCase()] = m;
    }

    var addedCount = 0;
    for (var ei = 0; ei < externalMats.length; ei++) {
      var em = externalMats[ei];
      if (!em || !em.name) continue;

      var nameLower = em.name.trim().toLowerCase();

      if (em.firebaseDocId && existingByFirebaseId[em.firebaseDocId]) {
        var existing = existingByFirebaseId[em.firebaseDocId];
        if (em.hygroscopicBetaWVTR !== undefined) {
          existing.hygroscopicBetaWVTR  = em.hygroscopicBetaWVTR;
          existing.hygroscopicRefRHWVTR = em.hygroscopicRefRHWVTR;
          existing.hygroscopicBetaOTR   = em.hygroscopicBetaOTR;
          existing.hygroscopicRefRHOTR  = em.hygroscopicRefRHOTR;
        }
        continue;
      }

      if (existingByName[nameLower]) {
        var existingN = existingByName[nameLower];
        if (em.firebaseDocId) existingN.firebaseDocId = em.firebaseDocId;
        if (em.hygroscopicBetaWVTR !== undefined) {
          existingN.hygroscopicBetaWVTR  = em.hygroscopicBetaWVTR;
          existingN.hygroscopicRefRHWVTR = em.hygroscopicRefRHWVTR;
          existingN.hygroscopicBetaOTR   = em.hygroscopicBetaOTR;
          existingN.hygroscopicRefRHOTR  = em.hygroscopicRefRHOTR;
        }
        continue;
      }

      var newMat = Object.assign({}, em);
      if (em.firebaseDocId) {
        var numericIds = DB.materials.map(function(m) {
          return typeof m.id === 'number' ? m.id : 0;
        });
        var maxId = numericIds.length ? Math.max.apply(null, numericIds) : 0;
        newMat.id = maxId + 1 + addedCount;
      }
      newMat.family           = em.family || getFamily(em.name);
      newMat.isMetallized     = em.isMetallized || false;
      newMat.reliabilityVotes = em.reliabilityVotes || { up: 0, down: 0 };

      DB.materials.push(newMat);
      existingByFirebaseId[newMat.firebaseDocId] = newMat;
      existingByName[nameLower] = newMat;
      addedCount++;
    }

    if (addedCount > 0) {
      DB.save();
      render();
      console.log('✅ materials.json: aggiunti ' + addedCount + ' materiali');
    }
  } catch (e) {
    console.log('ℹ️ materials.json non caricato:', e.message);
  }
}

// ====================================================================
// 🚀 APP INIT
// ====================================================================
