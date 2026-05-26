// ====================================================================
// 🚀 APP.JS - Navigation, render orchestration, helpers, usage tracking
// ====================================================================

// ====================================================================
// 🧮 FORMATTING HELPERS
// ====================================================================
function rStr(v) {
  if (v === Infinity) return '∞';
  if (v == null) return '-';
  return formatWithSigFigs(v, getDisplayPrecision());
}
function getUnit()  { return Engine.getUnits().value; }
function getLabel() { return Engine.getUnits().label; }

function countSigFigs(value) {
  if (value === null || value === undefined || value === '') return 2;
  var str    = String(value).trim().toLowerCase().replace(/^[+\-]/, '').replace(/e[+\-]?\d+$/, '').replace(/[a-z\/°%\s]/g, '');
  var digits = str.replace('.', '').replace(/^0+/, '');
  if (digits === '' || digits === '0') return 1;
  if (str.indexOf('.') === -1) {
    digits = digits.replace(/0+$/, '');
    if (digits === '') digits = '1';
  }
  return Math.min(Math.max(digits.length, 2), 6);
}

function formatWithSigFigs(value, sigFigs) {
  if (value === null || value === undefined) return '-';
  if (value === Infinity) return '∞';
  if (value === 0) return '0';
  var sign  = value < 0 ? '-' : '';
  value     = Math.abs(value);
  var magnitude = Math.floor(Math.log10(value));
  var factor    = Math.pow(10, sigFigs - 1 - magnitude);
  var rounded   = Math.round(value * factor) / factor;
  if (rounded < 0.001 || rounded >= 10000) return sign + rounded.toExponential(sigFigs - 1);
  var str = rounded.toString();
  if (str.indexOf('.') === -1 && sigFigs > str.replace('.', '').length)
    return sign + rounded.toFixed(sigFigs - Math.floor(Math.log10(rounded)) - 1);
  return sign + str;
}

function formatChartValue(value, sigFigs, unit) {
  if (value === null || value === undefined) return '-';
  if (value === Infinity) return '∞';
  var sf        = sigFigs || getDisplayPrecision();
  var formatted = formatWithSigFigs(value, sf);
  return unit ? formatted + ' ' + unit : formatted;
}

function getDisplayPrecision() {
  var precisions = [];
  if (State.layers) {
    for (var i = 0; i < State.layers.length; i++) {
      var l = State.layers[i];
      if (l.thick && l.thick > 0) precisions.push(countSigFigs(l.thick));
      if (l.mid) {
        var mat = DB.materials.find(function(m) { return m.id === l.mid; });
        if (mat) {
          var vals = State.mode === 'wvtr' ? mat.wvtrValues : mat.otrValues;
          if (vals) {
            for (var v = 0; v < vals.length; v++) {
              if (vals[v] && vals[v].value != null) precisions.push(countSigFigs(vals[v].value));
            }
          }
        }
      }
    }
  }
  var slIds = ['sl-weight', 'sl-area', 'sl-rate', 'sl-temp', 'sl-rh-ext'];
  for (var s = 0; s < slIds.length; s++) {
    var el = document.getElementById(slIds[s]);
    if (el && el.value) precisions.push(countSigFigs(el.value));
  }
  if (precisions.length === 0) return 3;
  var min = precisions[0];
  for (var p = 1; p < precisions.length; p++) if (precisions[p] < min) min = precisions[p];
  return min;
}

// ====================================================================
// 🗺️ NAVIGATION
// ====================================================================
function renderNav() {
  var html = '';
  for (var t = 0; t < TABS.length; t++) {
    var cls = State.tab === TABS[t].id ? 'active' : '';
    html += '<button class="nav-tab ' + cls + '" data-tab="' + TABS[t].id + '">' + TABS[t].label + '</button>';
  }
  document.getElementById('nav-tabs').innerHTML = html;
  var btns = document.querySelectorAll('.nav-tab');
  for (var b = 0; b < btns.length; b++) {
    btns[b].onclick = (function(tabId) {
      return function() { State.tab = tabId; renderNav(); renderContent(); postNavRender(); };
    })(btns[b].dataset.tab);
  }
}

function setMode(mode) {
  State.mode               = mode;
  Engine.mode              = mode;
  State.selectedTestMethod = '';
  State.calcResult         = null;
  State.calcError          = null;
  State.compareIds         = [];
  var radios = document.querySelectorAll('input[name="mode"]');
  for (var r = 0; r < radios.length; r++) radios[r].checked = radios[r].value === mode;
  DB.saveState(State);
  renderNav();
  renderContent();
  postNavRender();
}

function postNavRender() {
  setTimeout(function() {
    if (State.tab === 'home')        initHomeAnimations();
    if (State.tab === 'calc'        && State.calcResult) postCalcRender();
    if (State.tab === 'arrhenius')   postArrheniusRender();
    if (State.tab === 'sensitivity') postSensitivityRender();
    if (State.tab === 'compare')     postCompareRender();
    if (State.tab === 'laminates'   && DB.laminates.length >= 2) drawLamChart();
    if (State.tab === 'materials')   matApplyFilters();
  }, 150);
}

function renderContent() {
  var c = document.getElementById('app-content');
  try {
    switch (State.tab) {
      case 'home':        c.innerHTML = renderHome();        break;
      case 'calc':        c.innerHTML = renderCalc();        break;
      case 'arrhenius':   c.innerHTML = renderArrhenius();   break;
      case 'sensitivity': c.innerHTML = renderSensitivity(); break;
      case 'compare':     c.innerHTML = renderCompare();     break;
      case 'shelflife':   c.innerHTML = renderShelfLife();   break;
      case 'materials':   c.innerHTML = renderMaterials();   break;
      case 'laminates':   c.innerHTML = renderLaminates();   break;
      case 'mat-company': c.innerHTML = renderCompanyMaterialsPage(); setTimeout(initCompanyMaterialsPage, 100); break;
      case 'lam-company': c.innerHTML = renderCompanyLaminatesPage(); setTimeout(initCompanyLaminatesPage, 100); break;
      default:            c.innerHTML = renderHome();
    }
  } catch (e) {
    console.error('Render error:', e);
    c.innerHTML = '<div class="alert alert-error"><strong>Render Error:</strong> ' + e.message + '</div>';
  }
}

function render() {
  renderNav();
  renderContent();
  requestAnimationFrame(function() {
    if (State.tab === 'home') initHomeAnimations();
    postNavRender();
  });
}

function nav(tab) {
  State.tab = tab;
  renderNav();
  renderContent();
  if (tab !== 'home') { destroyChart('demo1'); destroyChart('demo2'); }
  requestAnimationFrame(function() {
    if (tab === 'home')        initHomeAnimations();
    if (tab === 'calc'        && State.calcResult) postCalcRender();
    if (tab === 'arrhenius')   postArrheniusRender();
    if (tab === 'sensitivity') postSensitivityRender();
    if (tab === 'compare')     postCompareRender();
    if (tab === 'laminates'   && DB.laminates.length >= 2) drawLamChart();
  });
}

// ====================================================================
// 🔄 CALC ACTIONS
// ====================================================================
function clearProject() {
  if (!confirm('Cancel current calculation and clear all layers?')) return;
  State.layers       = [{ mid: null, thick: 0 }];
  State.selCond      = null;
  State.laminateName = '';
  State.calcResult   = null;
  State.calcError    = null;
  DB.saveState(State);
  render();
}

function onCondSelect() {
  var sel = document.getElementById('sel-cond');
  if (sel && sel.value) {
    var parts     = sel.value.split('|');
    State.selCond = { temperature: parseFloat(parts[0]), humidity: parseFloat(parts[1]) };
  } else {
    State.selCond = null;
  }
  DB.saveState(State);
  if (State.autoCalc) doCalcSilent(); else renderContent();
}

function passesTestMethodFilter(mat) {
  if (!State.selectedTestMethod) return true;
  var tm = State.mode === 'wvtr' ? (mat.testMethodWVTR || '') : (mat.testMethodOTR || '');
  if (!tm) return false;
  return tm.trim().toLowerCase() === State.selectedTestMethod.trim().toLowerCase();
}

function onTestMethodFilterChange(value) {
  State.selectedTestMethod = value || '';
  DB.saveState(State);
  renderContent();
}

function onLayerChange(i, field, val) {
  if (field === 'mid') {
    if (val !== '') {
      State.layers[i].mid = !isNaN(val) ? parseFloat(val) : val;
      recordMaterialUsage(val);
    } else {
      State.layers[i].mid = null;
    }
  } else {
    State.layers[i].thick = parseFloat(val) || 0;
  }
  DB.saveState(State);
  if (State.autoCalc) doCalcSilent(); else renderContent();
}

function addLayer() {
  State.layers.push({ mid: null, thick: 0 });
  DB.saveState(State);
  renderContent();
}

function rmLayer(i) {
  if (State.layers.length <= 1) return;
  State.layers.splice(i, 1);
  DB.saveState(State);
  renderContent();
}

function toggleAutoCalc() { State.autoCalc = !State.autoCalc; renderContent(); }

function doCalc() {
  if (!State.selCond) { State.calcError = 'Select conditions first'; State.calcResult = null; renderContent(); return; }
  if (!State.layers.every(function(l) { return l.mid !== null && l.thick > 0; })) {
    State.calcError = 'Complete all layers'; State.calcResult = null; renderContent(); return;
  }
  var common = Engine.findCommonConditions(State.layers, DB.materials);
  if (common.error) { State.calcError = common.error; State.calcResult = null; renderContent(); return; }
  var result = Engine.calcTotal(State.layers, DB.materials, State.selCond);
  if (result.error) { State.calcError = result.error; State.calcResult = null; }
  else { State.calcResult = result; State.calcError = null; }
  renderContent();
  if (State.calcResult && !State.calcResult.error) setTimeout(postCalcRender, 150);
}

function doCalcSilent() {
  if (!State.selCond) return;
  if (!State.layers.every(function(l) { return l.mid !== null && l.thick > 0; })) return;
  var common = Engine.findCommonConditions(State.layers, DB.materials);
  if (common.error) return;
  var result = Engine.calcTotal(State.layers, DB.materials, State.selCond);
  if (!result.error) {
    State.calcResult = result; State.calcError = null;
    renderContent();
    setTimeout(postCalcRender, 150);
  }
}

function postCalcRender() {
  drawBarChart();
  drawLaminateCurveChart();
  drawHygroscopicTimeChart();
}

function doSaveLam() {
  var name = State.laminateName.trim();
  if (!name) { alert('Enter a name'); return; }
  if (!State.calcResult || State.calcResult.total <= 0) { alert('Calculate first'); return; }
  var tt = 0;
  for (var i = 0; i < State.layers.length; i++) tt += (State.layers[i].thick || 0);
  var rec = Engine.checkRecyclability(State.layers, DB.materials);
  DB.addLam({
    name:           name,
    total:          State.calcResult.total,
    totalThickness: tt,
    humidity:       State.selCond.humidity,
    temperature:    State.selCond.temperature,
    mode:           State.mode,
    recyclable:     rec.recyclable,
    monoStructure:  rec.monoStructure,
    layerCount:     State.layers.length,
    layers:         JSON.parse(JSON.stringify(State.layers))
  });
  State.laminateName = '';
  var nameEl = document.getElementById('lam-name'); if (nameEl) nameEl.value = '';
  var btn    = document.getElementById('save-btn');  if (btn)    btn.disabled = true;
  var fb     = document.getElementById('save-feedback');
  if (fb) fb.innerHTML = '<div class="alert alert-success" style="margin-top:.5rem">Saved!</div>';
  setTimeout(function() { var f = document.getElementById('save-feedback'); if (f) f.innerHTML = ''; }, 3000);
}

function updateSaveBtn() {
  var btn = document.getElementById('save-btn');
  if (btn) btn.disabled = State.laminateName.trim() === '';
}

// ====================================================================
// 📊 SENSITIVITY ACTIONS
// ====================================================================
function onSensChange() {
  State.sensLayerIdx = parseInt(document.getElementById('sens-layer') ? document.getElementById('sens-layer').value : '0');
  drawSensitivityChart();
}

function postSensitivityRender() {
  if (State.layers.some(function(l) { return l.mid !== null; }))
    setTimeout(function() { drawSensitivityChart(); doOptimize(); }, 100);
}

function doOptimize() {
  var target     = parseFloat(document.getElementById('opt-target') ? document.getElementById('opt-target').value : '0.5');
  var barrierIdx = parseInt(document.getElementById('opt-layer') ? document.getElementById('opt-layer').value : '0');
  var resEl      = document.getElementById('opt-result'); if (!resEl) return;
  var common     = Engine.findCommonConditions(State.layers, DB.materials);
  var condition  = State.selCond || (common.conditions && common.conditions[0]);

  if (!condition || !State.layers.every(function(l) { return l.mid !== null && l.thick > 0; })) {
    resEl.innerHTML = '<div class="alert alert-info">Configure and calculate first</div>'; return;
  }

  var barrierLayer = State.layers[barrierIdx];
  var barrierMat   = DB.materials.find(function(m) { return m.id === barrierLayer.mid; });
  if (barrierMat && barrierMat.isMetallized) {
    resEl.innerHTML =
      '<div class="alert alert-warning" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;font-size:0.76rem">' +
      '<svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
      '<span><strong>Optimization not applicable:</strong> For metallized/coated films, barrier performance is independent of substrate thickness.</span>' +
      '</div>';
    return;
  }

  var result = Engine.optimizeForTarget(State.layers, DB.materials, condition, target, barrierIdx);
  if (result.error) { resEl.innerHTML = '<div class="alert alert-warning">' + result.error + '</div>'; return; }
  var mat = null;
  for (var m = 0; m < DB.materials.length; m++)
    if (DB.materials[m].id === State.layers[barrierIdx].mid) { mat = DB.materials[m]; break; }
  var current = State.layers[barrierIdx].thick;
  resEl.innerHTML =
    '<div class="alert alert-success" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;font-size:0.76rem">' +
    '<span>To achieve <strong>target ' + getLabel() + ' ≤ ' + target + ' ' + getUnit() + '</strong> @ ' +
    condition.temperature + '°C/' + condition.humidity + '%:</span>' +
    '<span><strong>' + (mat ? mat.name : 'Layer ' + (barrierIdx + 1)) + '</strong> min: ' +
    '<span style="color:var(--primary);font-weight:700">' + result.thickness.toFixed(1) + ' um</span></span>' +
    '<span style="color:var(--text-light);font-size:0.7rem">(' + current + '→' + result.thickness.toFixed(1) +
    'um, ' + (result.thickness < current ? '✓ Savings' : '⚠ Increase needed') + ')</span>' +
    '</div>';
}

// ====================================================================
// 🔀 COMPARE ACTIONS
// ====================================================================
function toggleCompare(id) {
  var idx = State.compareIds.indexOf(id);
  if (idx >= 0) State.compareIds.splice(idx, 1);
  else if (State.compareIds.length < 3) State.compareIds.push(id);
  renderContent();
  postCompareRender();
}

function postCompareRender() {
  if (State.compareIds.length < 1) return;
  var selected = [];
  for (var i = 0; i < DB.laminates.length; i++)
    if (State.compareIds.indexOf(DB.laminates[i].id) >= 0) selected.push(DB.laminates[i]);
  var unit    = getUnit();
  var tableEl = document.getElementById('compare-table');
  if (tableEl && selected.length > 0) {
    var modeLabel = (selected[0].mode || State.mode).toUpperCase();
    var th = '<thead><tr><th>Parameter</th>';
    for (var i = 0; i < selected.length; i++) th += '<th>' + selected[i].name + '</th>';
    th += '</tr></thead>';
    var body = '<tbody>';
    body += '<tr><td><strong>' + modeLabel + '</strong></td>';
    for (var i = 0; i < selected.length; i++) body += '<td>' + selected[i].total.toFixed(4) + ' ' + unit + '</td>';
    body += '</tr>';
    body += '<tr><td><strong>Thickness</strong></td>';
    for (var i = 0; i < selected.length; i++) body += '<td>' + selected[i].totalThickness.toFixed(0) + ' um</td>';
    body += '</tr>';
    body += '<tr><td><strong>Conditions</strong></td>';
    for (var i = 0; i < selected.length; i++) body += '<td>' + selected[i].temperature + '°C / ' + selected[i].humidity + '%</td>';
    body += '</tr>';
    body += '<tr><td><strong>Recyclable</strong></td>';
    for (var i = 0; i < selected.length; i++)
      body += '<td><span class="sustainability-flag ' + (selected[i].recyclable ? 'yes' : 'no') + '">' +
              (selected[i].recyclable ? 'Yes' : 'No') + '</span></td>';
    body += '</tr></tbody>';
    tableEl.innerHTML = '<div class="card"><h2>Comparison Table</h2><table class="cond-table">' + th + body + '</table></div>';
  }
  if (selected.length >= 2) {
    var canvas = document.getElementById('compareChart'); if (!canvas) return;
    destroyChart('compare');
    var ctx        = canvas.getContext('2d');
    var modeLabel2 = (selected[0].mode || State.mode).toUpperCase();
    var labels     = [], vals = [], colors = [];
    for (var i = 0; i < selected.length; i++) {
      labels.push(selected[i].name);
      vals.push(selected[i].total);
      colors.push(LAYER_COLORS[i % LAYER_COLORS.length]);
    }
    chartInstances.compare = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: modeLabel2, data: vals, backgroundColor: colors, borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } },
                 scales: { y: { beginAtZero: true, title: { display: true, text: unit } },
                           x: { title: { display: true, text: 'Laminates' } } } }
    });
  }
}

// ====================================================================
// 🌍 MATERIAL WEB SEARCH
// ====================================================================
function searchMaterialWeb(matName) {
  var encoded = encodeURIComponent(matName);
  Modal.open('Search Online: ' + matName,
    '<div style="margin-bottom:1rem">' +
    '<p style="font-size:.82rem;color:var(--text-light);margin-bottom:1rem">Search for WVTR/OTR datasheets and technical data:</p>' +
    '<div class="grid grid-2" style="gap:.75rem">' +
    '<a href="https://scholar.google.com/scholar?q=' + encoded + '+WVTR+OTR+datasheet" target="_blank" class="btn btn-primary" style="text-decoration:none;justify-content:center">Google Scholar</a>' +
    '<a href="https://www.google.com/search?q=' + encoded + '+WVTR+permeability" target="_blank" class="btn btn-outline" style="text-decoration:none;justify-content:center">Google Search</a>' +
    '<a href="https://www.matweb.com/search/Search.aspx?stext=' + encoded + '" target="_blank" class="btn btn-outline" style="text-decoration:none;justify-content:center">MatWeb</a>' +
    '<a href="https://omnexus.specialchem.com/search?q=' + encoded + '" target="_blank" class="btn btn-outline" style="text-decoration:none;justify-content:center">Omnexus</a>' +
    '</div></div>' +
    '<div class="alert alert-info"><svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
    '<div><strong>When you find the data:</strong><br>1. Copy WVTR, OTR, temperature and humidity<br>2. Return to this app<br>3. Click "Add Material"<br>4. Paste the values</div></div>',
    function() { return true; }
  );
}

// ====================================================================
// 🏷️ VERIFIED BADGE HELPER
// ====================================================================
function isVerifiedMaterial(mat) {
  if (!window.VERIFIED_MATERIALS) return null;
  return window.VERIFIED_MATERIALS[mat.name] || null;
}

// ====================================================================
// 🔢 COMMUNITY COUNT
// ====================================================================
function getCommunityCount() {
  return DB.materials.filter(function(m) { return m.isCommunity || String(m.id).startsWith('fb_'); }).length;
}

// ====================================================================
// 🎭 MODAL
// ====================================================================
var Modal = {
  open: function(title, body, onSave) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML    = body;
    document.getElementById('modal-footer').innerHTML  =
      '<button class="btn btn-outline" onclick="Modal.close()">Cancel</button>' +
      '<button class="btn btn-primary" id="modal-save-btn">Save</button>';
    document.getElementById('modal-save-btn').onclick = function() { if (onSave()) Modal.close(); };
    document.getElementById('modal-overlay').classList.add('active');
  },
  close: function() { document.getElementById('modal-overlay').classList.remove('active'); }
};

// ====================================================================
// 🔄 ADS REFRESH
// ====================================================================
window.refreshAds = function() {
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
};

// ====================================================================
// 📥 EXTERNAL MATERIALS DB LOADER
// ====================================================================
async function loadExternalMaterialsDB() {
  try {
    var res  = await fetch('materials.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var externalMats = Array.isArray(data) ? data : (data.materials || []);
    if (!externalMats.length) return;
    var addedCount = 0;
    for (var ei = 0; ei < externalMats.length; ei++) {
      var em = externalMats[ei];
      if (!em || !em.name) continue;
      var existingById = DB.materials.find(function(m) {
        return typeof m.id === 'number' && typeof em.id === 'number' && m.id === em.id;
      });
      if (existingById) {
        if (em.hygroscopicRefRHWVTR !== undefined) {
          existingById.hygroscopicRefRHWVTR = em.hygroscopicRefRHWVTR;
          existingById.hygroscopicRefRHOTR  = em.hygroscopicRefRHOTR;
          existingById.hygroscopicBetaWVTR  = em.hygroscopicBetaWVTR;
          existingById.hygroscopicBetaOTR   = em.hygroscopicBetaOTR;
        }
        continue;
      }
      var existingByName = DB.materials.find(function(m) {
        return m.name.toLowerCase() === em.name.toLowerCase();
      });
      if (existingByName) {
        if (em.hygroscopicRefRHWVTR !== undefined) {
          existingByName.hygroscopicRefRHWVTR = em.hygroscopicRefRHWVTR;
          existingByName.hygroscopicRefRHOTR  = em.hygroscopicRefRHOTR;
          existingByName.hygroscopicBetaWVTR  = em.hygroscopicBetaWVTR;
          existingByName.hygroscopicBetaOTR   = em.hygroscopicBetaOTR;
        }
        continue;
      }
      var numericIds = DB.materials.map(function(m) { return typeof m.id === 'number' ? m.id : 0; }).filter(function(id) { return id > 0; });
      var maxId      = numericIds.length ? Math.max.apply(null, numericIds) : 0;
      em.id          = maxId + 1 + addedCount;
      em.family      = em.family || getFamily(em.name);
      em.isMetallized = em.isMetallized || false;
      if (!em.reliabilityVotes) em.reliabilityVotes = { up: 0, down: 0 };
      em.company       = em.company       || '';
      em.tdsLink       = em.tdsLink       || '';
      em.testMethodWVTR = em.testMethodWVTR || '';
      em.testMethodOTR  = em.testMethodOTR  || '';
      DB.materials.push(em);
      addedCount++;
    }
    DB.save();
    render();
  } catch (e) { console.log('ℹ️ materials.json not loaded:', e.message); }
}

// ====================================================================
// 🚀 INIT APP
// ====================================================================
async function initApp() {
  console.log('🚀 App starting...');

  var retries = 0;
  while (!window.communityDB && retries < 50) {
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
    retries++;
  }

  try {
    DB.load();
    console.log('📦 Local materials:', DB.materials.length);
    console.log('📦 Local laminates:', DB.laminates.length);

    var savedState = DB.loadState();
    if (savedState) {
      if (savedState.layers)  State.layers  = savedState.layers;
      if (savedState.selCond) State.selCond = savedState.selCond;
      if (savedState.mode)    { State.mode = savedState.mode; Engine.mode = savedState.mode; }
    }

    await loadExternalMaterialsDB();

    if (window.communityDB) {
      var fbMats = await window.loadFromCommunity();
      for (var fi = 0; fi < fbMats.length; fi++) {
        var fm = fbMats[fi];
        if (!fm || !fm.name) continue;

        var localMat = DB.materials.find(function(m) {
          return fm.firebaseDocId && m.firebaseDocId === fm.firebaseDocId;
        });
        if (!localMat) {
          localMat = DB.materials.find(function(m) {
            return m.name.trim().toLowerCase() === fm.name.trim().toLowerCase();
          });
        }
        if (localMat) {
          localMat.firebaseDocId    = fm.firebaseDocId || localMat.firebaseDocId;
          localMat.isCommunity      = true;
          localMat.reliabilityVotes = fm.reliabilityVotes || localMat.reliabilityVotes;
          localMat.usageCount       = fm.usageCount       || localMat.usageCount;
          localMat.author           = fm.author           || localMat.author;
        } else {
          DB.materials.push(Object.assign({}, fm, {
            id:          'fb_' + fm.firebaseDocId,
            isCommunity: true
          }));
        }
      }
    }

    DB.deduplicateMaterials();

    if (window.loadLaminatesFromCloud) {
      var cloudLams = await window.loadLaminatesFromCloud();
      if (cloudLams.length > 0) {
        var existingCloudIds = new Set(DB.laminates.map(function(l) { return l._cloudId; }).filter(Boolean));
        for (var ci = 0; ci < cloudLams.length; ci++) {
          var cl = cloudLams[ci];
          if (!existingCloudIds.has(cl._cloudId) && !DB.laminates.some(function(l) { return l.id === cl.id; }))
            DB.laminates.push(cl);
        }
        DB.save();
      }
    }

    console.log('🎨 Rendering...');
    render();

  } catch (e) {
    console.error('❌ Init error:', e);
    DB.materials = DEFAULT_MATERIALS.slice();
    DB.laminates = DEFAULT_LAMINATES.slice();
    render();
  }
}

// ====================================================================
// 🏭 MAT SOURCE CHANGE (Calculator)
// ====================================================================
function onMatSourceChange(val) {
  State.matSource = val || 'general';
  DB.materials = DB.materials.filter(function(m) { return !m.isCompany; });
  if (val === 'company') {
    loadCompanyMaterials().then(function(mats) {
      mats.forEach(function(m) { DB.materials.push(m); });
      renderContent();
    });
  } else {
    renderContent();
  }
}
