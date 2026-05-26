// ====================================================================
// 🧪 SHELFLIFE.JS - Shelf Life Engine: PRODUCTS_DB + SL object
// ====================================================================
// Dependencies: engine.js, app.js, render.js, chart.js (optional)
// Features: Moisture/Oxygen degradation, Arrhenius/Q10, Logistics Chain
// ====================================================================

// ====================================================================
// 🥐 PRODUCTS DATABASE - Predefined food templates
// ====================================================================
const PRODUCTS_DB = {
  biscuits: {
    name: "Biscuits / Crackers", type: "moisture",
    M_init: 3, M_crit: 6, GAB: { M_m: 0.045, C: 12.5, K: 0.85 }, Ea: 60000
  },
  coffee: {
    name: "Ground Coffee", type: "moisture",
    M_init: 3, M_crit: 5, GAB: { M_m: 0.035, C: 15.0, K: 0.88 }, Ea: 55000
  },
  pasta: {
    name: "Dried Pasta", type: "moisture",
    M_init: 10, M_crit: 14, GAB: { M_m: 0.055, C: 10.0, K: 0.92 }, Ea: 45000
  },
  milk_powder: {
    name: "Milk Powder", type: "moisture",
    M_init: 2.5, M_crit: 4, GAB: { M_m: 0.028, C: 18.0, K: 0.82 }, Ea: 50000
  },
  chips: {
    name: "Potato Chips (Fried)", type: "otx",
    fat_kg: 0.3, O2_crit: 400, Ea: 85000, Q10: 2.5
  },
  nuts: {
    name: "Nuts / Seeds", type: "otx",
    fat_kg: 0.6, O2_crit: 600, Ea: 75000, Q10: 2.2
  },
  oils: {
    name: "Cooking Oils", type: "otx",
    fat_kg: 1.0, O2_crit: 800, Ea: 80000, Q10: 2.0
  },
  custom: {
    name: "Custom Product", type: "moisture",
    M_init: 5, M_crit: 10, GAB: { M_m: 0.04, C: 10, K: 0.8 }, Ea: 50000
  }
};

// ====================================================================
// 📦 SL OBJECT - All shelf life logic (unified & cleaned)
// ====================================================================
const SL = {
  // Internal state
  _barrierSource: 'calc',      // 'calc' | 'db' | 'company'
  _manualOverride: false,      // User override flag
  _currentMode: null,          // Cache for mode detection

  // ------------------------------------------------------------------
  // 🔀 UI TOGGLES - Single source of truth
  // ------------------------------------------------------------------

  /** Toggle manual override for barrier rate */
  toggleManualOverride(checked) {
  this._manualOverride = !!checked;
  const panel = document.getElementById('sl-panel-manual');
  if (panel) panel.style.display = checked ? 'block' : 'none';

  // Blocca/sblocca i pulsanti sorgente
  ['calc', 'db', 'company'].forEach(key => {
    const btn = document.getElementById('sl-src-btn-' + key);
    if (!btn) return;
    btn.disabled = checked;
    btn.style.opacity = checked ? '0.35' : '1';
    btn.style.cursor = checked ? 'not-allowed' : 'pointer';
  });

  // Nascondi tutti i pannelli sorgente quando override è attivo
  ['calc', 'db', 'company'].forEach(p => {
    const el = document.getElementById('sl-panel-' + p);
    if (el) el.style.display = checked ? 'none' : (p === this._barrierSource ? 'block' : 'none');
  });

  if (checked) {
    this.onManualRateChange();
  } else {
    // Ripristina il pannello attivo
    this.setBarrierSource(this._barrierSource);
  }
},

  /** Set barrier rate source: 'calc' | 'db' | 'company' */
  setBarrierSource(src) {
    if (!['calc', 'db', 'company'].includes(src)) return;
    this._barrierSource = src;
    
    // Update button styles
    ['calc', 'db', 'company'].forEach(key => {
      const btn = document.getElementById(`sl-src-btn-${key}`);
      if (!btn) return;
      if (key === src) {
        btn.className = 'btn btn-sm';
        btn.style.cssText = 'background:var(--primary);color:#fff;border:none;font-size:0.75rem';
      } else {
        btn.className = 'btn btn-sm btn-outline';
        btn.style.cssText = 'font-size:0.75rem';
        if (key === 'company' && !(typeof CompanyState !== 'undefined' && CompanyState.isActive && CompanyState.isActive())) {
          btn.style.opacity = '0.5';
          btn.disabled = true;
        }
      }
    });

    // Show/hide panels
    ['calc', 'db', 'company'].forEach(p => {
      const el = document.getElementById(`sl-panel-${p}`);
      if (el) el.style.display = (p === src) ? 'block' : 'none';
    });

    // Load community laminates if needed
    if (src === 'db') {
      this._loadCommunityLaminatesIntoSelect();
    }
    // Load company laminates if needed
    if (src === 'company' && typeof CompanyState !== 'undefined' && CompanyState.isActive && CompanyState.isActive()) {
      this._loadCompanyLaminatesIntoSelect();
    }

    // Update summary
    if (src === 'calc' && !this._manualOverride) {
      const rate = parseFloat(State.calcResult?.total || 0);
      this._updateRateSummary(rate > 0 ? rate.toFixed(6) : '-');
    }
  },

  /** Toggle packaging geometry mode: 'auto' | 'manual' */
  togglePkgMode() {
    const mode = document.querySelector('input[name="pkg-geom"]:checked')?.value || 'auto';
    const geomSel = document.getElementById('geom-selector');
    const dimsSel = document.getElementById('dims-selector');
    const manInp  = document.getElementById('manual-area-input');
    
    if (mode === 'auto') {
      if (geomSel) geomSel.style.display = 'grid';
      if (dimsSel) dimsSel.style.display = 'block';
      if (manInp)  manInp.style.display  = 'none';
      this.onShapeChange();
    } else {
      if (geomSel) geomSel.style.display = 'none';
      if (dimsSel) dimsSel.style.display = 'none';
      if (manInp)  manInp.style.display  = 'block';
    }
  },

  /** Handle shape selection change */
  onShapeChange() {
    const sel = document.getElementById('sl-shape');
    if (!sel) return;
    const type = sel.value;
    
    const pouchDims  = document.getElementById('dims-pouch');
    const bottleDims = document.getElementById('dims-bottle');
    
    if (type === 'bottle') {
      if (pouchDims)  pouchDims.style.display  = 'none';
      if (bottleDims) bottleDims.style.display = 'grid';
    } else {
      if (pouchDims)  pouchDims.style.display  = 'grid';
      if (bottleDims) bottleDims.style.display = 'none';
    }
    this.calcArea();
  },

  /** Handle package type change (updates labels & defaults) */
  onPkgChange() {
    const sel = document.getElementById('sl-shape');
    if (!sel) return;
    const type = sel.value;
    
    // Toggle bottle/pouch dimensions
    const pouchDims  = document.getElementById('dims-pouch');
    const bottleDims = document.getElementById('dims-bottle');
    if (type === 'bottle') {
      if (pouchDims)  pouchDims.style.display  = 'none';
      if (bottleDims) bottleDims.style.display = 'grid';
    } else {
      if (pouchDims)  pouchDims.style.display  = 'grid';
      if (bottleDims) bottleDims.style.display = 'none';
    }

    // Update dimension labels and defaults
    const configs = {
      flat:     { w: 12, h: 17, d: 0,  l1: 'Width (cm)', l2: 'Height (cm)', l3: 'Depth/Gusset (cm)' },
      standup:  { w: 13, h: 22, d: 0,  l1: 'Width (cm)', l2: 'Height (cm)', l3: 'Gusset/Depth (cm)' },
      flow:     { w: 20, h: 12, d: 0,  l1: 'Fin Seal Length (cm)', l2: 'Web Width (cm)', l3: '—' },
      box:      { w: 10, h: 15, d: 5,  l1: 'Length (cm)', l2: 'Height (cm)', l3: 'Depth (cm)' },
      cylinder: { w: 0,  h: 12, d: 10, l1: '—', l2: 'Height (cm)', l3: 'Diameter (cm)' },
      tray:     { w: 15, h: 10, d: 3,  l1: 'Length (cm)', l2: 'Width (cm)', l3: 'Depth (cm)' },
      bottle:   { w: 0,  h: 0,  d: 0,  l1: '—', l2: '—', l3: '—' }
    };
    const cfg = configs[type] || configs.flat;
    
    if (pouchDims && pouchDims.style.display !== 'none') {
      const labels = pouchDims.querySelectorAll('label');
      ['sl-w', 'sl-h', 'sl-d'].forEach((id, i) => {
        const inp = document.getElementById(id);
        if (inp) inp.value = [cfg.w, cfg.h, cfg.d][i];
        if (labels[i]) labels[i].textContent = [cfg.l1, cfg.l2, cfg.l3][i];
      });
    }
    this.calcArea();
  },

  // ------------------------------------------------------------------
  // 📐 AREA CALCULATION
  // ------------------------------------------------------------------

  /** Calculate effective packaging area in m² */
  calcArea() {
    const mode = document.querySelector('input[name="pkg-geom"]:checked')?.value || 'auto';
    let area = 0;

    if (mode === 'manual') {
      area = parseFloat(document.getElementById('sl-area-manual')?.value) || 0;
    } else {
      const type = document.getElementById('sl-shape')?.value || 'flat';
      const margin = parseFloat(document.getElementById('sl-margin')?.value) || 0;

      if (type === 'bottle') {
        // Complex bottle geometry calculation
        const R_body     = parseFloat(document.getElementById('sl-bottle-body-r')?.value) || 3.5;
        const H_body     = parseFloat(document.getElementById('sl-bottle-body-h')?.value) || 16;
        const R_neck     = parseFloat(document.getElementById('sl-bottle-neck-r')?.value) || 1.2;
        const H_neck     = parseFloat(document.getElementById('sl-bottle-neck-h')?.value) || 4;
        const H_shoulder = parseFloat(document.getElementById('sl-bottle-shoulder-h')?.value) || 2.5;

        const areaBodyLat = 2 * Math.PI * R_body * H_body;
        const areaNeckLat = 2 * Math.PI * R_neck * H_neck;
        const slantH = Math.sqrt(Math.pow(R_body - R_neck, 2) + Math.pow(H_shoulder, 2));
        const areaShould = Math.PI * (R_body + R_neck) * slantH;
        const areaBottom = Math.PI * Math.pow(R_body, 2);
        const marginFactor = 1 + (margin / 100);

        area = (areaBodyLat + areaNeckLat + areaShould + areaBottom) * marginFactor / 10000;
      } else {
        // Standard shapes
        const w = parseFloat(document.getElementById('sl-w')?.value) || 0;
        const h = parseFloat(document.getElementById('sl-h')?.value) || 0;
        const d = parseFloat(document.getElementById('sl-d')?.value) || 0;
        
        const wT = w + margin * 2, hT = h + margin * 2, dT = d + margin * 2;
        let areaCm2 = 0;

        switch(type) {
          case 'flat':     areaCm2 = 2 * wT * hT; break;
          case 'standup':  areaCm2 = 2 * wT * hT * 1.3; break;
          case 'flow':     areaCm2 = wT * hT * 2.2; break;
          case 'box':      areaCm2 = 2 * (wT * hT + wT * dT + hT * dT); break;
          case 'cylinder': areaCm2 = 2 * Math.PI * (d/2) * (d/2 + hT); break;
          case 'tray':     areaCm2 = (wT * hT) + 2 * (wT * dT) + 2 * (hT * dT); break;
          default:         areaCm2 = 2 * wT * hT;
        }
        area = areaCm2 / 10000; // cm² → m²
      }
    }

    // Update display
    const display = document.getElementById('sl-area-display');
    const hidden  = document.getElementById('sl-area');
    if (display) display.textContent = area.toFixed(4) + ' m²';
    if (hidden)  hidden.value = area.toFixed(4);
  },

  /** Update area when manual input changes */
  updateManualArea() {
    const val = document.getElementById('sl-area-manual')?.value || '0';
    const display = document.getElementById('sl-area-display');
    const hidden  = document.getElementById('sl-area');
    if (display) display.textContent = val + ' m²';
    if (hidden)  hidden.value = val;
  },

  // ------------------------------------------------------------------
  // 🎯 PRODUCT & SAFE ZONE
  // ------------------------------------------------------------------

  /** Handle product template change */
  onProductChange() {
    const prodKey = document.getElementById('sl-product')?.value;
    const prod = PRODUCTS_DB[prodKey];
    if (!prod) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    
    if (prod.type === 'moisture') {
      set('sl-minit', prod.M_init);
      set('sl-mcrit', prod.M_crit);
      set('sl-ea', prod.Ea ? (prod.Ea / 1000).toFixed(1) : '');
    } else {
      set('sl-minit', '');
      set('sl-mcrit', '');
      set('sl-ea', prod.Ea ? (prod.Ea / 1000).toFixed(1) : '');
    }
    this.drawSafeZone();
  },

  /** Draw moisture safe zone visualization */
  drawSafeZone() {
    const init = parseFloat(document.getElementById('sl-minit')?.value) || 0;
    const crit = parseFloat(document.getElementById('sl-mcrit')?.value) || 0;
    
    const vLabel = document.getElementById('sl-mcrit-val');
    const bar    = document.getElementById('sl-safe-green');
    const marker = document.getElementById('sl-safe-now');
    
    if (!vLabel || !bar || !marker) return;
    
    vLabel.textContent = crit + '%';
    const max = Math.max(crit * 1.5, 20);
    bar.style.width = (crit / max * 100) + '%';
    marker.style.left = (init / max * 100) + '%';
  },

  // ------------------------------------------------------------------
  // 🔥 THERMAL ACCELERATION (Ea / Q10)
  // ------------------------------------------------------------------

  /** Handle Ea input - disable Q10 when Ea is set */
  onEaInput() {
    const ea = document.getElementById('sl-ea')?.value;
    const q10 = document.getElementById('sl-q10');
    const hint = document.getElementById('sl-ea-q10-hint');
    if (!q10 || !hint) return;
    
    if (ea && parseFloat(ea) > 0) {
      q10.disabled = true;
      q10.style.opacity = '0.4';
      q10.value = '';
      hint.textContent = 'Eₐ set — Q₁₀ disabled.';
    } else {
      q10.disabled = false;
      q10.style.opacity = '1';
      hint.textContent = 'Leave empty to use product default.';
    }
  },

  /** Handle Q10 input - disable Ea when Q10 is set */
  onQ10Input() {
    const q10 = document.getElementById('sl-q10')?.value;
    const ea = document.getElementById('sl-ea');
    const hint = document.getElementById('sl-ea-q10-hint');
    if (!ea || !hint) return;
    
    if (q10 && parseFloat(q10) > 0) {
      ea.disabled = true;
      ea.style.opacity = '0.4';
      ea.value = '';
      hint.textContent = 'Q₁₀ set — Eₐ disabled.';
    } else {
      ea.disabled = false;
      ea.style.opacity = '1';
      hint.textContent = 'Leave empty to use product default.';
    }
  },

  // ------------------------------------------------------------------
  // 🚚 LOGISTICS CHAIN MODE
  // ------------------------------------------------------------------

  /** Toggle between single condition and logistics chain */
  toggleCond(mode) {
    const singleDiv = document.getElementById('sl-cond-single');
    const chainDiv  = document.getElementById('sl-cond-chain');
    const btnSingle = document.getElementById('btn-single');
    const btnChain  = document.getElementById('btn-chain');
    
    if (singleDiv) singleDiv.style.display = (mode === 'single') ? 'block' : 'none';
    if (chainDiv)  chainDiv.style.display  = (mode === 'chain')  ? 'block' : 'none';
    
    const setActive = (btn, active) => {
      if (!btn) return;
      btn.style.background = active ? 'var(--primary)' : 'var(--bg)';
      btn.style.color = active ? '#fff' : 'var(--text-light)';
    };
    setActive(btnSingle, mode === 'single');
    setActive(btnChain, mode === 'chain');
  },

  /** Add a new row to the logistics chain table */
  addChainRow() {
    const tbody = document.getElementById('sl-chain-rows');
    if (!tbody) return;
    
    tbody.insertAdjacentHTML('beforeend', `
    <tr style="background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04);animation:fadeIn 0.2s ease">
      <td style="padding:0.5rem">
        <input type="text" value="Storage" 
          style="width:100%;padding:0.55rem 0.6rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;background:#fafbfc">
      </td>
      <td style="padding:0.5rem">
        <input type="number" value="22" class="sl-ct" 
          style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center">
      </td>
      <td style="padding:0.5rem">
        <input type="number" value="60" class="sl-cr" 
          style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center">
      </td>
      <td style="padding:0.5rem">
        <input type="number" value="30" class="sl-cd" 
          style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center">
      </td>
      <td style="padding:0.5rem;text-align:center">
        <span style="cursor:pointer;color:var(--danger);font-size:1.2rem;line-height:1" 
          onclick="this.closest('tr').remove()">✕</span>
      </td>
    </tr>`);
  },

  // ------------------------------------------------------------------
  // 🧮 MATHEMATICAL CORE
  // ------------------------------------------------------------------

  /** Solve GAB equation for water activity (binary search) */
  solveGAB(M, params) {
    if (!params?.M_m || !params?.C || !params?.K) return 0.5;
    let low = 0.01, high = 0.99;
    
    for (let i = 0; i < 50; i++) {
      const aw = (low + high) / 2;
      const denom = (1 - params.K * aw) * (1 - params.K * aw + params.C * params.K * aw);
      if (denom === 0) break;
      const Mc = (params.M_m * params.C * params.K * aw) / denom;
      if (Mc < M) low = aw; else high = aw;
    }
    return (low + high) / 2;
  },

  /** Get the active barrier rate (manual override or calculated) */
  _getActiveRate() {
    if (this._manualOverride) {
      return parseFloat(document.getElementById('sl-rate-manual')?.value || 0);
    }
    return parseFloat(State.calcResult?.total || 0);
  },

  /** Update the active rate summary display */
  _updateRateSummary(rateStr) {
    const el = document.getElementById('sl-active-rate');
    const unit = (State.mode || 'wvtr') === 'wvtr' ? 'g/m²·day' : 'cc/m²·day';
    if (el) el.textContent = rateStr + ' ' + unit;
  },
  onManualRateChange() {
    const rate = parseFloat(document.getElementById('sl-rate-manual')?.value) || 0;
    this._updateRateSummary(rate > 0 ? rate.toFixed(6) : '-');
  },

  // ------------------------------------------------------------------
  // 🎯 MAIN CALCULATION ENGINE
  // ------------------------------------------------------------------

  /** Execute shelf life calculation */
  calculate() {
    const prodKey = document.getElementById('sl-product')?.value;
    const prod = PRODUCTS_DB[prodKey];
    if (!prod) { alert('⚠️ Select a product type first'); return; }

    // 1. Get barrier rate
    const rateInput = this._getActiveRate();
    if (rateInput <= 0) {
      alert('No valid rate. Select a laminate or enter manually.');
      return;
    }

    // 2. Area & Weight
    const A = parseFloat(document.getElementById('sl-area')?.value) || 0.1;
    const W = parseFloat(document.getElementById('sl-weight')?.value) || 100;

    // 3. Storage conditions (single or chain)
    let T_store = 25, RH_out = 65;
    const isChain = document.getElementById('sl-cond-chain')?.style.display !== 'none';
    
    if (isChain) {
      let totD = 0, wT = 0, wRH = 0;
      document.querySelectorAll('#sl-chain-rows tr').forEach(r => {
        const d = parseFloat(r.querySelector('.sl-cd')?.value) || 0;
        wT  += (parseFloat(r.querySelector('.sl-ct')?.value) || 0) * d;
        wRH += (parseFloat(r.querySelector('.sl-cr')?.value) || 0) * d;
        totD += d;
      });
      if (totD > 0) {
        T_store = wT / totD;
        RH_out  = wRH / totD;
      }
    } else {
      T_store = parseFloat(document.getElementById('sl-temp')?.value) || 25;
      RH_out  = parseFloat(document.getElementById('sl-rh-ext')?.value) || 65;
    }

    // 4. Thermal acceleration (Arrhenius or Q10)
    const Ea_val = parseFloat(document.getElementById('sl-ea')?.value) || (prod.Ea ? prod.Ea / 1000 : 60);
    const Q10_val = parseFloat(document.getElementById('sl-q10')?.value) || (prod.Q10 || 2.0);
    const Ea_J = Ea_val * 1000;
    
    const eaRaw   = document.getElementById('sl-ea')?.value;
const q10Raw  = document.getElementById('sl-q10')?.value;
const eaNum   = parseFloat(eaRaw);
const q10Num  = parseFloat(q10Raw);

// Se l'utente ha inserito Ea valido (e Q10 non è esplicitamente attivo) → Arrhenius
// Altrimenti → Q10 (con fallback a prod.Q10 o 2.0)
let accel = 1;
if (!isNaN(eaNum) && eaNum > 0 && !(q10Num > 0)) {
  const Ea_use = eaNum * 1000;
  accel = Math.exp(-(Ea_use / 8.314) * (1 / (T_store + 273.15) - 1 / 298.15));
} else {
  const q10Use = (q10Num > 0) ? q10Num : (prod.Q10 || 2.0);
  accel = Math.pow(q10Use, (T_store - 25) / 10);
}

    // 5. Hygroscopic correction (if materials have beta coefficient)
    let hygroFactor = 1;
const hygroMsg = [];

if (!this._manualOverride && State.layers?.length && State.selCond) {
      for (const layer of State.layers) {
        if (!layer.mid) continue;
        const mat = DB.materials?.find(m => m.id === layer.mid);
        if (!mat) continue;
        
        const isWVTR = (State.mode || 'wvtr') === 'wvtr';
        const beta = isWVTR ? (mat.hygroscopicBetaWVTR || 0) : (mat.hygroscopicBetaOTR || 0);
        if (beta <= 0) continue;
        
        // Find closest test condition
        let testRH = 50;
        if (mat.validConditions?.length > 0) {
          let bestCond = mat.validConditions[0];
          let minDiff = Math.abs(mat.validConditions[0].temperature - T_store);
          for (const cond of mat.validConditions) {
            const diff = Math.abs(cond.temperature - T_store);
            if (diff < minDiff) { minDiff = diff; bestCond = cond; }
          }
          testRH = bestCond.humidity;
        }
        
        const rhDiff = RH_out - testRH;
        const factor = Math.exp(beta * rhDiff);
        
        if (Math.abs(rhDiff) > 2) {
          hygroFactor *= factor;
          hygroMsg.push(`${mat.name}: ×${factor.toFixed(2)} @ ${RH_out.toFixed(0)}% RH vs ${testRH}% RH test`);
        } else {
          hygroMsg.push(`${mat.name}: ⚠ hygroscopic (β=${beta}) — calculated at test RH (${testRH}%), no correction`);
        }
      }
    }

    const effectiveRate = rateInput * accel * hygroFactor;

    // 6. Run simulation
    const result = {
      days: 0, history: [], mode: State.mode, type: prod.type,
      hygroWarning: hygroMsg.length ? { message: 'Hygroscopic correction applied', details: hygroMsg } : null,
      isChain
    };

    if (prod.type === 'moisture') {
      // Moisture ingress simulation
      const M_crit = parseFloat(document.getElementById('sl-mcrit')?.value) || prod.M_crit;
      const M_init = parseFloat(document.getElementById('sl-minit')?.value) || prod.M_init;
      
      if (M_crit <= M_init) { alert('⚠️ Critical moisture must be > initial'); return; }
      
      const T_test_std = 23;
      const Psat_std = 0.61094 * Math.exp((17.625 * T_test_std) / (T_test_std + 243.04)) * 1000;
      const dP_std = Psat_std * 0.50;
      const Psat = 0.61094 * Math.exp((17.625 * T_store) / (T_store + 243.04)) * 1000;
      
      let M = M_init, t = 0;
      result.history = [{ t: 0, M, quality: 100 }];
      
      while (M < M_crit && t < 5000) {
        const aw = this.solveGAB(M / 100, prod.GAB);
        const RH_in = aw * 100;
        const dP = Psat * Math.max((RH_out - RH_in), 1) / 100;
        const dM = (effectiveRate * (dP / dP_std) * A) / W * 100;
        
        M += dM; t++;
        result.history.push({
          t,
          M: Math.min(M, M_crit),
          quality: Math.max(0, 100 - ((M - M_init) / (M_crit - M_init)) * 100)
        });
      }
      result.days = t;
      result.M_crit = M_crit;
      result.M_init = M_init;
      
    } else {
      // Oxygen transmission / oxidation simulation
      const fatKg = prod.fat_kg || 0.3;
      const O2_crit = prod.O2_crit || 400;
      const totalO2 = O2_crit * fatKg;
      const dayO2 = effectiveRate * A * 0.21; // 21% O2 in air
      
      if (dayO2 <= 0) {
        result.days = Infinity;
      } else {
        const days = totalO2 / dayO2;
        for (let d = 0; d <= Math.min(days * 1.2, 3650); d += 5) {
          result.history.push({
            t: d,
            quality: Math.max(0, 100 - ((dayO2 * d) / totalO2) * 100)
          });
        }
        result.days = Math.round(days);
      }
      result.type = 'otx';
    }

    this.renderResult(result);
  },

  // ------------------------------------------------------------------
  // 📊 RESULT RENDERING & CHARTS
  // ------------------------------------------------------------------

  /** Render the main result panel */
  renderResult(res) {
    const panel = document.getElementById('sl-result-panel');
    if (!panel) return;
    
    const months = res.days / 30.44;
    const years = res.days / 365.25;
    const unit = res.mode === 'wvtr' ? 'Moisture Gain' : 'Lipid Oxidation';
    const daysStr = isFinite(res.days) 
      ? (typeof formatWithSigFigs === 'function' ? formatWithSigFigs(res.days, typeof getDisplayPrecision === 'function' ? getDisplayPrecision() : 3) : res.days.toFixed(1))
      : '∞';

    panel.innerHTML = `
    <div style="animation:fadeIn 0.3s ease">
      <div style="text-align:center;padding:1.25rem;background:linear-gradient(135deg,var(--primary-light),#e0f2fe);border-radius:12px;margin-bottom:1rem">
        <div style="font-size:2.2rem;font-weight:800;color:var(--primary);line-height:1.2">${daysStr} Days</div>
        <div style="font-size:0.85rem;color:var(--text-light);margin-top:0.4rem;font-weight:500">
          ≈ ${months.toFixed(1)} Months · ≈ ${years.toFixed(2)} Years
        </div>
        <span class="badge badge-blue" style="margin-top:0.5rem">${unit}</span>
      </div>
    </div>`;

    // Hygroscopic warning
    if (res.hygroWarning) {
      panel.innerHTML += `
      <div class="alert alert-warning" style="margin-top:0.5rem;font-size:0.75rem;
        background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #fcd34d;
        border-radius:8px;padding:0.6rem 0.8rem">
        <strong style="font-weight:700">⚠️ ${res.hygroWarning.message}</strong><br>
        ${res.hygroWarning.details.map(d => 
          `<span style="display:block;margin-top:0.2rem;color:#92400e;font-weight:500">• ${d}</span>`
        ).join('')}
      </div>`;
    }

    // Trigger chart rendering
    const chartsContainer = document.getElementById('sl-charts-container');
    if (chartsContainer) {
      chartsContainer.style.display = 'block';
      requestAnimationFrame(() => { setTimeout(() => this.drawCharts(res), 100); });
    }
    
    const logisticsContainer = document.getElementById('sl-logistics-charts');
    if (logisticsContainer) {
      logisticsContainer.style.display = res.isChain ? 'block' : 'none';
      if (res.isChain) {
        requestAnimationFrame(() => { setTimeout(() => this.drawLogisticsCharts(res), 150); });
      }
    }
  },

  /** Draw main charts: Quality Decay + Temp Sensitivity */
  drawCharts(res) {
    // Cleanup existing charts
    if (typeof destroyChart === 'function') {
      destroyChart('slDecay');
      destroyChart('slTemp');
    }

    // Quality Decay Chart
    const ctx1 = document.getElementById('slDecayChart')?.getContext('2d');
    if (ctx1 && res.history?.length > 1 && typeof Chart !== 'undefined') {
      if (!window.chartInstances) window.chartInstances = {};
      window.chartInstances.slDecay = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: res.history.map(h => h.t),
          datasets: [
            {
              label: 'Quality (%)',
              data: res.history.map(h => h.quality),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,0.1)',
              fill: true,
              tension: 0.35,
              pointRadius: 2,
              borderWidth: 2
            },
            {
              label: 'Critical (0%)',
              data: new Array(res.history.length).fill(0),
              borderColor: '#ef4444',
              borderDash: [6, 4],
              borderWidth: 2,
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } }
          },
          scales: {
            x: { title: { display: true, text: 'Days' }, ticks: { font: { size: 9 } } },
            y: {
              beginAtZero: true,
              max: 100,
              title: { display: true, text: 'Quality %' },
              ticks: { font: { size: 9 }, callback: v => v + '%' }
            }
          }
        }
      });
    }

    // Temperature Sensitivity Chart
    const ctx2 = document.getElementById('slTempChart')?.getContext('2d');
    if (ctx2 && typeof Chart !== 'undefined') {
      const Ea_kJ = parseFloat(document.getElementById('sl-ea')?.value) || 60;
      const Q10 = parseFloat(document.getElementById('sl-q10')?.value) || 2.0;
      const A = parseFloat(document.getElementById('sl-area')?.value) || 0.1;
      const W = parseFloat(document.getElementById('sl-weight')?.value) || 100;
      
      const baseRate = this._getActiveRate() || 0.5;
      const temps = Array.from({ length: 36 }, (_, i) => 15 + i);
      
      const daysArr = temps.map(T => {
        const eaIn = document.getElementById('sl-ea')?.value;
        const eaDis = document.getElementById('sl-ea')?.disabled;
        let acc = 1;
        
        const eaNum2 = parseFloat(eaIn);
const q10Num2 = parseFloat(document.getElementById('sl-q10')?.value);
if (!isNaN(eaNum2) && eaNum2 > 0 && !(q10Num2 > 0)) {
  acc = Math.exp(-(eaNum2 * 1000 / 8.314) * (1 / (T + 273.15) - 1 / 298.15));
} else {
  acc = Math.pow((q10Num2 > 0 ? q10Num2 : Q10), (T - 25) / 10);
}
        
        const rate = baseRate * acc;
        if (res.type === 'moisture') {
          return ((res.M_crit || 8) - (res.M_init || 3)) / 100 * W / (rate * A);
        } else {
          const prod = PRODUCTS_DB[document.getElementById('sl-product')?.value];
          return ((prod?.O2_crit || 400) * (prod?.fat_kg || 0.3) * 0.21) / (rate * A);
        }
      });

      if (!window.chartInstances) window.chartInstances = {};
      window.chartInstances.slTemp = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: temps,
          datasets: [{
            label: 'Shelf Life vs Temp',
            data: daysArr,
            borderColor: '#8b5cf6',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: 'Storage °C' } },
            y: { title: { display: true, text: 'Days' } }
          }
        }
      });
    }
  },

  /** Draw logistics chain charts */
  drawLogisticsCharts(res) {
    if (typeof destroyChart === 'function') {
      destroyChart('slChain');
      destroyChart('slCumulative');
      destroyChart('slStepImpact');
      destroyChart('slMoistureAcc');
    }

    const rows = document.querySelectorAll('#sl-chain-rows tr');
    if (!rows.length) return;

    // Conditions Chart (Temp + RH per step)
    const ctx1 = document.getElementById('slChainChart')?.getContext('2d');
    if (ctx1 && typeof Chart !== 'undefined') {
      const labels = [], temps = [], rhs = [];
      rows.forEach(r => {
        labels.push(r.querySelector('input[type="text"]')?.value || 'Step');
        temps.push(parseFloat(r.querySelector('.sl-ct')?.value) || 0);
        rhs.push(parseFloat(r.querySelector('.sl-cr')?.value) || 0);
      });

      if (!window.chartInstances) window.chartInstances = {};
      window.chartInstances.slChain = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Temperature (°C)', data: temps, backgroundColor: 'rgba(59,130,246,0.7)', yAxisID: 'y' },
            { label: 'RH (%)', data: rhs, backgroundColor: 'rgba(239,68,68,0.7)', yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } } },
          scales: {
            y: { position: 'left', title: { display: true, text: '°C' } },
            y1: { position: 'right', title: { display: true, text: 'RH %' } }
          }
        }
      });
    }

    this.drawStepImpactChart(res);
    if (res?.type === 'moisture') this.drawMoistureAccumulationChart(res);

    // Cumulative Timeline Chart
    const ctx2 = document.getElementById('slCumulativeChart')?.getContext('2d');
    if (ctx2 && typeof Chart !== 'undefined') {
      let cum = 0;
      const cumDays = [], cumLabels = [];
      rows.forEach((r, i) => {
        const d = parseFloat(r.querySelector('.sl-cd')?.value) || 0;
        cum += d;
        cumDays.push(cum);
        cumLabels.push(r.querySelector('input[type="text"]')?.value || `Step ${i + 1}`);
      });

      if (!window.chartInstances) window.chartInstances = {};
      window.chartInstances.slCumulative = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: cumLabels,
          datasets: [{
            label: 'Cumulative Days',
            data: cumDays,
            borderColor: '#16a34a',
            fill: true,
            tension: 0.3,
            pointRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { title: { display: true, text: 'Days' } } }
        }
      });
    }
  },

  /** Draw step impact chart (% of shelf life consumed per logistics step) */
  drawStepImpactChart(res) {
    if (typeof destroyChart === 'function') destroyChart('slStepImpact');
    
    const canvas = document.getElementById('slStepImpactChart');
    if (!canvas || !res || typeof Chart === 'undefined') return;
    
    const ctx = canvas.getContext('2d');
    const rows = document.querySelectorAll('#sl-chain-rows tr');
    if (!rows.length) return;

    const A = parseFloat(document.getElementById('sl-area')?.value) || 0.1;
    const W = parseFloat(document.getElementById('sl-weight')?.value) || 100;
    const prodKey = document.getElementById('sl-product')?.value;
    const prod = PRODUCTS_DB[prodKey];
    if (!prod) return;

    // Calculate total allowed transfer
    let totalAllowed = 0;
    if (prod.type === 'moisture') {
      const Mc = parseFloat(document.getElementById('sl-mcrit')?.value) || prod.M_crit;
      const Mi = parseFloat(document.getElementById('sl-minit')?.value) || prod.M_init;
      totalAllowed = (Mc - Mi) / 100 * W;
    } else {
      totalAllowed = (prod.O2_crit || 400) * (prod.fat_kg || 0.3);
    }

    const baseRate = this._getActiveRate() || 0.5;
    if (!baseRate || baseRate <= 0) return;

    const labels = [], consumptionPct = [], details = [];
    let cumConsumed = 0;

    rows.forEach((r, idx) => {
      const name = r.querySelector('input[type="text"]')?.value || `Step ${idx + 1}`;
      const T = parseFloat(r.querySelector('.sl-ct')?.value) || 25;
      const RH = parseFloat(r.querySelector('.sl-cr')?.value) || 65;
      const days = parseFloat(r.querySelector('.sl-cd')?.value) || 1;
      
      const Ea_kJ = parseFloat(document.getElementById('sl-ea')?.value) || 60;
      const Q10 = parseFloat(document.getElementById('sl-q10')?.value) || 2.0;
      const eaIn = document.getElementById('sl-ea')?.value;
      const eaDis = document.getElementById('sl-ea')?.disabled;
      
      let accel = 1;
const eaNum2 = parseFloat(eaIn);
const q10Num2 = parseFloat(document.getElementById('sl-q10')?.value);
if (!isNaN(eaNum2) && eaNum2 > 0 && !(q10Num2 > 0)) {
  accel = Math.exp(-(eaNum2 * 1000 / 8.314) * (1 / (T + 273.15) - 1 / 298.15));
} else {
  accel = Math.pow((q10Num2 > 0 ? q10Num2 : Q10), (T - 25) / 10);
}

      // Hygroscopic factor for this step
      let hygroFactor = 1;
      if (State.layers) {
  for (const layer of State.layers) {
          if (!layer.mid) continue;
          const mat = DB.materials?.find(m => m.id === layer.mid);
          if (!mat) continue;
          const beta = ((State.mode || 'wvtr') === 'wvtr') 
            ? (mat.hygroscopicBetaWVTR || 0) 
            : (mat.hygroscopicBetaOTR || 0);
          if (beta > 0) {
            let testRH = 50;
            if (mat.validConditions?.length) {
              let best = mat.validConditions[0], minD = Math.abs(mat.validConditions[0].temperature - T);
              for (const c of mat.validConditions) {
                const d2 = Math.abs(c.temperature - T);
                if (d2 < minD) { minD = d2; best = c; }
              }
              testRH = best.humidity;
            }
            hygroFactor *= Math.exp(beta * (RH - testRH));
          }
        }
      }

      const effRate = baseRate * accel * hygroFactor;
      const transferred = effRate * A * days * (res.type === 'otx' ? 0.21 : 1);
      const pct = totalAllowed > 0 ? (transferred / totalAllowed) * 100 : 0;
      
      labels.push(name);
      consumptionPct.push(parseFloat(pct.toFixed(1)));
      cumConsumed += pct;
      details.push({ name, T, RH, days, pct: pct.toFixed(1), cumulative: cumConsumed.toFixed(1) });
    });

    const colors = consumptionPct.map(p => 
      p >= 30 ? 'rgba(239,68,68,0.85)' : 
      p >= 15 ? 'rgba(245,158,11,0.85)' : 
      'rgba(59,130,246,0.7)'
    );

    if (!window.chartInstances) window.chartInstances = {};
    window.chartInstances.slStepImpact = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Consumed (%)',
          data: consumptionPct,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const d = details[ctx.dataIndex];
                return `${d.name}: ${d.pct}% (Cum: ${d.cumulative}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: '% of Total Shelf Life' },
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });
  },

  /** Draw moisture accumulation chart (for moisture-type products) */
  drawMoistureAccumulationChart(res) {
    if (typeof destroyChart === 'function') destroyChart('slMoistureAcc');
    
    const canvas = document.getElementById('slMoistureAccChart');
    if (!canvas || !res || res.type !== 'moisture' || typeof Chart === 'undefined') return;
    
    const ctx = canvas.getContext('2d');
    const rows = document.querySelectorAll('#sl-chain-rows tr');
    if (!rows.length) return;

    const prodKey = document.getElementById('sl-product')?.value;
    const prod = PRODUCTS_DB[prodKey];
    if (!prod || prod.type !== 'moisture') return;

    const M_crit = parseFloat(document.getElementById('sl-mcrit')?.value) || prod.M_crit;
    const M_init = parseFloat(document.getElementById('sl-minit')?.value) || prod.M_init;
    const A = parseFloat(document.getElementById('sl-area')?.value) || 0.1;
    const W = parseFloat(document.getElementById('sl-weight')?.value) || 100;
    
    let baseRate = this._getActiveRate();
    if (!baseRate || baseRate <= 0) baseRate = 0.5;

    const T_test_std = 23;
    const Psat_std = 0.61094 * Math.exp((17.625 * T_test_std) / (T_test_std + 243.04)) * 1000;
    const dP_std = Psat_std * 0.50;

    const labels = [], moisturePoints = [], pointDetails = [];
    let M_current = M_init, dayCounter = 0;

    rows.forEach((r, idx) => {
      const name = r.querySelector('input[type="text"]')?.value || `Step ${idx + 1}`;
      const T = parseFloat(r.querySelector('.sl-ct')?.value) || 25;
      const RH_out = parseFloat(r.querySelector('.sl-cr')?.value) || 65;
      const days = parseFloat(r.querySelector('.sl-cd')?.value) || 1;
      
      const Psat = 0.61094 * Math.exp((17.625 * T) / (T + 243.04)) * 1000;
      const Ea_kJ = parseFloat(document.getElementById('sl-ea')?.value) || 60;
      const Q10 = parseFloat(document.getElementById('sl-q10')?.value) || 2.0;
      const eaIn = document.getElementById('sl-ea')?.value;
      const eaDis = document.getElementById('sl-ea')?.disabled;
      
      let accel = 1;
const eaNum2 = parseFloat(eaIn);
const q10Num2 = parseFloat(document.getElementById('sl-q10')?.value);
if (!isNaN(eaNum2) && eaNum2 > 0 && !(q10Num2 > 0)) {
  accel = Math.exp(-(eaNum2 * 1000 / 8.314) * (1 / (T + 273.15) - 1 / 298.15));
} else {
  accel = Math.pow((q10Num2 > 0 ? q10Num2 : Q10), (T - 25) / 10);
}

      // Hygroscopic factor
      let hygroFactor = 1;
      if (State.layers) {
  for (const layer of State.layers) {
          if (!layer.mid) continue;
          const mat = DB.materials?.find(m => m.id === layer.mid);
          if (!mat) continue;
          const beta = mat.hygroscopicBetaWVTR || 0;
          const refRH = mat.hygroscopicRefRHWVTR || 50;
          if (beta > 0) hygroFactor *= Math.exp(beta * (RH_out - refRH));
        }
      }

      const effRate = baseRate * accel * hygroFactor;
      const step = Math.max(1, Math.floor(days / 8));
      
      for (let d = 0; d < days; d++) {
        const aw_cur = Math.min(0.99, Math.max(0.01, M_current / M_crit * 0.85));
        const RH_in = aw_cur * 100;
        const dP = Psat * Math.max((RH_out - RH_in), 1) / 100;
        const dM = (effRate * (dP / dP_std) * A) / W * 100;
        
        M_current = Math.min(M_current + dM, M_crit * 1.5);
        dayCounter++;
        
        if (d % step === 0 || d === days - 1) {
          labels.push(`${name}+${d + 1}d`);
          moisturePoints.push(parseFloat(M_current.toFixed(2)));
          pointDetails.push({ day: dayCounter, M: M_current, step: name });
        }
      }
      labels.push(name);
      moisturePoints.push(parseFloat(M_current.toFixed(2)));
      pointDetails.push({ day: dayCounter, M: M_current, step: name, isEnd: true });
    });

    const maxMoisture = moisturePoints.length > 0 ? Math.max(...moisturePoints) : M_crit;
    
    try {
      if (!window.chartInstances) window.chartInstances = {};
      window.chartInstances.slMoistureAcc = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Internal Moisture (%)',
              data: moisturePoints,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,0.2)',
              fill: true,
              tension: 0.35,
              pointRadius: ctx => pointDetails[ctx.dataIndex]?.isEnd ? 5 : 3,
              pointHoverRadius: 7,
              pointBackgroundColor: ctx => moisturePoints[ctx.dataIndex] >= M_crit ? '#ef4444' : '#3b82f6',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              borderWidth: 2.5
            },
            {
              label: 'Critical Limit',
              data: new Array(labels.length).fill(M_crit),
              borderColor: '#ef4444',
              borderDash: [6, 4],
              borderWidth: 2.5,
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 }, padding: 10 } },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const val = ctx.parsed.y;
                  const detail = pointDetails[ctx.dataIndex];
                  const status = val >= M_crit ? ' 🔴 ABOVE LIMIT' : 
                                val >= M_crit * 0.9 ? ' 🟡 WARNING' : ' 🟢 Safe';
                  return [
                    ` ${ctx.dataset.label}: ${val.toFixed(2)}%${status}`,
                    ` Day ${detail?.day || ctx.dataIndex}`,
                    ` Step: ${detail?.step || ''}`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Logistics Chain Progress', font: { size: 10 } },
              ticks: { font: { size: 8 }, maxRotation: 45 },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              max: Math.max(M_crit * 1.3, maxMoisture * 1.1),
              title: { display: true, text: 'Moisture Content (%)', font: { size: 10 } },
              ticks: { callback: v => v.toFixed(1) + '%', font: { size: 9 } },
              grid: { color: 'rgba(0,0,0,0.04)' }
            }
          }
        }
      });
    } catch (e) {
      console.error('❌ Moisture Accumulation chart error:', e);
    }
  },

  // ------------------------------------------------------------------
  // 📄 PDF EXPORT
  // ------------------------------------------------------------------

 async exportToPDF(event) {
    const PDFLib = window.jspdf?.jsPDF || window.jspdf?.default || window.jsPDF;
    if (typeof PDFLib !== 'function') { alert('PDF library missing. Reload page.'); return; }
    if (typeof html2canvas !== 'function') { alert('Chart library missing. Reload page.'); return; }

    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Generating PDF...'; }

    try {
      // ── Gather data ──────────────────────────────────────────────
      const lamName   = State?.laminateName || 'Unnamed Laminate';
      const prodKey   = document.getElementById('sl-product')?.value;
      const prod      = PRODUCTS_DB[prodKey];
      const A         = parseFloat(document.getElementById('sl-area')?.value)   || 0.1;
      const W         = parseFloat(document.getElementById('sl-weight')?.value) || 100;
      const M_crit    = parseFloat(document.getElementById('sl-mcrit')?.value)  || (prod?.M_crit || 6);
      const M_init    = parseFloat(document.getElementById('sl-minit')?.value)  || (prod?.M_init || 3);
      const T_store   = parseFloat(document.getElementById('sl-temp')?.value)   || 25;
      const RH_ext    = parseFloat(document.getElementById('sl-rh-ext')?.value) || 65;
      const Ea        = parseFloat(document.getElementById('sl-ea')?.value)     || 60;
      const Q10       = parseFloat(document.getElementById('sl-q10')?.value)    || 2.0;
      const isChain   = document.getElementById('sl-cond-chain')?.style.display !== 'none';
      const mode      = State?.mode || 'wvtr';
      const unit      = mode === 'wvtr' ? 'g/m²/day' : 'cc/m²/day';
      const modeLabel = mode === 'wvtr' ? 'WVTR' : 'OTR';
      const genDate   = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
      const genISO    = new Date().toISOString().slice(0, 10);

      // Laminate layers
      const layers = (State?.layers || []).filter(l => l?.mid != null);
      const layerRows = layers.map(l => {
        const m   = DB?.materials?.find(x => x?.id === l.mid);
        const res = State?.calcResult?.layers?.find(r => r?.layerIndex === layers.indexOf(l));
        return {
          name:      m ? m.name : '—',
          thick:     l.thick || 0,
          family:    m?.family || '—',
          wvtr:      m ? (Engine.getValues(m)?.[0]?.value ?? '—') : '—',
          resPct:    res ? res.resistancePct?.toFixed(1) + '%' : '—',
          isBarrier: res?.isBarrier || false
        };
      });

      // Shelf life result
      const slPanel   = document.getElementById('sl-result-panel');
      const slDaysEl  = slPanel?.querySelector('[style*="2.2rem"]');
      const slDaysStr = slDaysEl?.textContent?.replace('Days','').trim() || '—';

      // ── PDF init ─────────────────────────────────────────────────
      const pdf = new PDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const PW = 210, PH = 297, ML = 15, MR = 15, CW = PW - ML - MR;
      const C = {
        blue:    [37,  99,  235],
        blueDark:[30,  64,  175],
        blueLight:[239,246,255],
        green:   [22,  163, 74],
        greenL:  [240, 253, 244],
        amber:   [217, 119, 6],
        amberL:  [255, 251, 235],
        red:     [220, 38,  38],
        redL:    [254, 242, 242],
        slate:   [71,  85,  105],
        slateL:  [248, 250, 252],
        border:  [226, 232, 240],
        white:   [255, 255, 255],
        black:   [15,  23,  42]
      };
      let y = 0;
      let pageNum = 0;

      const safe = s => String(s || '').replace(/[^\x20-\x7E]/g, '');

      const drawFooter = () => {
        pdf.setFillColor(...C.blueDark);
        pdf.rect(0, PH - 10, PW, 10, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.white);
        pdf.text('WVTR/OTR Shelf Life Calculator  |  wvtr-otr-calculator.com  |  For R&D use only', ML, PH - 3.5);
        pdf.text('Page ' + pdf.internal.getNumberOfPages(), PW - MR, PH - 3.5, { align: 'right' });
        pdf.setTextColor(...C.black);
      };

      const newPage = () => {
        if (pageNum > 0) drawFooter();
        pdf.addPage();
        pageNum++;
        y = ML;
      };

      const sectionTitle = (title, color = C.blue) => {
        y += 4;
        pdf.setFillColor(...color);
        pdf.rect(ML, y, 3, 6, 'F');
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...color);
        pdf.text(safe(title), ML + 5, y + 4.5);
        pdf.setTextColor(...C.black);
        y += 10;
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.3);
        pdf.line(ML, y - 2, PW - MR, y - 2);
        y += 2;
      };

      const kpiBox = (x, bw, bh, label, value, unit2, color, colorL) => {
        pdf.setFillColor(...colorL);
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(x, y, bw, bh, 2, 2, 'FD');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.slate);
        pdf.text(safe(label), x + bw / 2, y + 5, { align: 'center' });
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...color);
        pdf.text(safe(value), x + bw / 2, y + 13, { align: 'center' });
        pdf.setFontSize(6.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.slate);
        pdf.text(safe(unit2), x + bw / 2, y + 18, { align: 'center' });
        pdf.setTextColor(...C.black);
      };

      const tableHeader = (cols, x, colWidths, rowH = 7) => {
        pdf.setFillColor(...C.blue);
        let cx = x;
        cols.forEach((col, i) => {
          pdf.rect(cx, y, colWidths[i], rowH, 'F');
          cx += colWidths[i];
        });
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...C.white);
        cx = x;
        cols.forEach((col, i) => {
          pdf.text(safe(col), cx + 2, y + 4.8);
          cx += colWidths[i];
        });
        pdf.setTextColor(...C.black);
        y += rowH;
      };

      const tableRow = (cells, x, colWidths, rowH = 6.5, bgColor = null) => {
        if (bgColor) { pdf.setFillColor(...bgColor); let cx2=x; colWidths.forEach(w=>{ pdf.rect(cx2,y,w,rowH,'F'); cx2+=w; }); }
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.2);
        let cx = x;
        colWidths.forEach((w, i) => {
          pdf.rect(cx, y, w, rowH, 'S');
          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...C.black);
          const txt = safe(cells[i] || '—');
          pdf.text(txt, cx + 2, y + 4.5);
          cx += w;
        });
        y += rowH;
      };

      // ═══════════════════════════════════════════════════
      // PAGE 1 — COVER
      // ═══════════════════════════════════════════════════
      pageNum++;

      // Header gradient band
      pdf.setFillColor(...C.blueDark);
      pdf.rect(0, 0, PW, 55, 'F');
      pdf.setFillColor(...C.blue);
      pdf.rect(0, 40, PW, 18, 'F');

      // Title
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...C.white);
      pdf.text('Shelf Life Analysis Report', ML, 22);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(186, 210, 255);
      pdf.text(safe(lamName), ML, 32);

      // Badge
      pdf.setFillColor(...C.white);
      pdf.roundedRect(PW - MR - 38, 8, 38, 10, 2, 2, 'F');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...C.blue);
      pdf.text(modeLabel + ' Mode', PW - MR - 19, 14.5, { align: 'center' });

      // Date strip
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...C.white);
      pdf.text('Generated: ' + genDate + '  |  ' + (isChain ? 'Logistics Chain Mode' : 'Single Condition Mode'), ML, 50);
      pdf.setTextColor(...C.black);

      y = 65;

      // ── KPI boxes ────────────────────────────────────────
      const kpiW = (CW - 9) / 4;
      const kpiH = 22;
      kpiBox(ML,          kpiW, kpiH, 'SHELF LIFE',   slDaysStr,            'Days',      C.blue,  C.blueLight);
      kpiBox(ML+kpiW+3,   kpiW, kpiH, 'TEMPERATURE',  T_store.toFixed(1)+'°C', 'Storage', C.amber, C.amberL);
      kpiBox(ML+kpiW*2+6, kpiW, kpiH, 'SURFACE AREA', A.toFixed(4),         'm²',        C.green, C.greenL);
      kpiBox(ML+kpiW*3+9, kpiW, kpiH, 'PRODUCT',      safe(prod?.name?.split(' ')[0] || '—'), safe(prod?.type === 'moisture' ? 'Moisture' : 'Oxidation'), C.slate, C.slateL);
      y += kpiH + 8;

      // ── Laminate structure ────────────────────────────────
      sectionTitle('Laminate Structure');
      if (layerRows.length > 0) {
        const lCols = ['Layer', 'Material', 'Family', 'Thickness (µm)', modeLabel + ' ref', 'Resistance %'];
        const lW    = [12, 55, 22, 28, 28, 25];
        tableHeader(lCols, ML, lW);
        layerRows.forEach((lr, idx) => {
          const bg = idx % 2 === 0 ? C.slateL : C.white;
          tableRow(['L' + (idx+1), lr.name, lr.family, lr.thick + ' µm', String(lr.wvtr), lr.resPct], ML, lW, 6.5, bg);
        });
        y += 4;
      } else {
        pdf.setFontSize(8.5);
        pdf.setTextColor(...C.slate);
        pdf.text('No laminate layers available. Run a calculation in the Calculator tab first.', ML, y + 4);
        pdf.setTextColor(...C.black);
        y += 10;
      }

      // ── Input parameters ──────────────────────────────────
      sectionTitle('Input Parameters');
      const pCols = ['Parameter', 'Value', 'Parameter', 'Value'];
      const pW    = [45, 35, 45, 35];
      tableHeader(pCols, ML, pW);
      const params = [
        ['Product Template', safe(prod?.name || '—'),      'Package Weight', W + ' g'],
        ['Initial Moisture', M_init + ' %',                'Critical Moisture', M_crit + ' %'],
        ['Storage Temp',     T_store.toFixed(1) + ' °C',   'External RH', RH_ext.toFixed(0) + ' %'],
        ['Activation Energy',Ea + ' kJ/mol',               'Q₁₀ Factor', Q10.toFixed(2)],
        ['Barrier Rate',     (State?.calcResult?.total ? State.calcResult.total.toFixed(6) : '—') + ' ' + unit, 'Condition Mode', isChain ? 'Logistics Chain' : 'Single'],
      ];
      params.forEach((row, idx) => {
        tableRow(row, ML, pW, 6.5, idx % 2 === 0 ? C.slateL : C.white);
      });
      y += 4;

      // ── Methodology summary ────────────────────────────────
      if (y > PH - 60) { newPage(); } else { y += 2; }
      sectionTitle('Methodology Summary');
      const methodLines = prod?.type === 'moisture'
        ? [
            'Moisture ingress is simulated day-by-day using the GAB (Guggenheim-Anderson-de Boer) sorption isotherm.',
            'At each time step, internal water activity aW is computed from current moisture M. The driving force dP',
            'equals Psat(T) x max(RHext - RHin, 1) / 100. Daily increment: dM = WVTR_eff x (dP/dP_ref) x A / W x 100.',
            'Simulation stops when M reaches M_crit. Thermal scaling via Arrhenius or Q10 rule.'
          ]
        : [
            'Oxygen shelf life uses a zero-order oxidative model: t = (fat_kg x O2_crit) / (OTR x A x 0.21).',
            'O2_crit is expressed in cc O2 / kg fat. OTR in cc/m2/day. Factor 0.21 = volumetric fraction of O2 in air.',
            'Degradation is modeled as linear until the total allowable O2 threshold is reached.',
            'Thermal scaling via Arrhenius or Q10 rule applied to effective barrier rate.'
          ];
      methodLines.forEach(line => {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.slate);
        pdf.text(safe(line), ML, y);
        y += 5;
      });
      pdf.setTextColor(...C.black);
      y += 3;

      // ── QR code (text-based placeholder) ──────────────────
      if (y < PH - 40) {
        pdf.setFillColor(...C.slateL);
        pdf.setDrawColor(...C.border);
        pdf.roundedRect(ML, y, 50, 22, 2, 2, 'FD');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...C.blue);
        pdf.text('Access the tool online:', ML + 2, y + 5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.slate);
        pdf.text('wvtr-otr-calculator.com', ML + 2, y + 10);
        pdf.text('Free | R&D Use Only | No Registration', ML + 2, y + 15);
        pdf.text('ASTM F1249 / ISO 15106 compliant methodology', ML + 2, y + 20);
        pdf.setTextColor(...C.black);
        y += 28;
      }

      drawFooter();

      // ═══════════════════════════════════════════════════
      // PAGES 2+ — CHARTS
      // ═══════════════════════════════════════════════════
      const chartConfigs = [
        { id: 'slDecayChart',       title: 'Quality Decay Over Time',         desc: 'Product quality (%) vs storage days. Reaches 0% at end of shelf life.' },
        { id: 'slTempChart',        title: 'Shelf Life vs Storage Temperature',desc: 'Predicted shelf life across temperature range 15–50°C.' },
        { id: 'slChainChart',       title: 'Logistics Chain Conditions',       desc: 'Temperature (°C) and relative humidity (%) profile per supply chain step.' },
        { id: 'slStepImpactChart',  title: 'Shelf Life Consumed per Step',     desc: 'Percentage of total shelf life budget consumed in each logistics phase.' },
        { id: 'slMoistureAccChart', title: 'Moisture Accumulation (Chain)',    desc: 'Internal product moisture content progression through the logistics chain.' },
        { id: 'slCumulativeChart',  title: 'Cumulative Timeline',              desc: 'Accumulated days across the full supply chain.' }
      ];

      for (let ci = 0; ci < chartConfigs.length; ci++) {
        const cfg    = chartConfigs[ci];
        const canvas = document.getElementById(cfg.id);
        if (!canvas || canvas.offsetParent === null || canvas.width === 0) continue;

        newPage();
        sectionTitle(cfg.title);

        // Description box
        pdf.setFillColor(...C.slateL);
        pdf.setDrawColor(...C.border);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(ML, y, CW, 8, 1, 1, 'FD');
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.slate);
        pdf.text(safe(cfg.desc), ML + 3, y + 5.2);
        pdf.setTextColor(...C.black);
        y += 12;

        try {
          const cc  = await html2canvas(canvas, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false });
          const img = cc.toDataURL('image/png');
          const maxH = PH - y - 30;
          const h   = Math.min(CW * (cc.height / cc.width), maxH);
          // Chart frame
          pdf.setFillColor(...C.white);
          pdf.setDrawColor(...C.border);
          pdf.setLineWidth(0.4);
          pdf.roundedRect(ML - 1, y - 1, CW + 2, h + 2, 2, 2, 'FD');
          pdf.addImage(img, 'PNG', ML, y, CW, h);
          y += h + 6;
        } catch (e) {
          pdf.setFontSize(8);
          pdf.setTextColor(...C.slate);
          pdf.text('Chart not available for this configuration.', ML, y + 5);
          pdf.setTextColor(...C.black);
          y += 12;
        }

        drawFooter();
      }

      // ═══════════════════════════════════════════════════
      // FINAL PAGE — DISCLAIMER
      // ═══════════════════════════════════════════════════
      newPage();
      sectionTitle('Important Disclaimer & Model Limitations', C.red);

      const disclaimerSections = [
        {
          title: 'For Research & Development Use Only',
          body: 'This report and the underlying calculations are intended exclusively for internal R&D screening, packaging concept development, and educational purposes. Results must not be used as the sole basis for commercial shelf-life labeling, regulatory submissions, or product safety declarations.'
        },
        {
          title: 'Laboratory Validation Required',
          body: 'All predictive model outputs require independent validation through accredited laboratory testing. Relevant standards include: ASTM F1249 / ISO 15106-3 (Water Vapor Transmission), ASTM D3985 / ISO 15106-2 (Oxygen Transmission), ISO 18787 (Water Activity), and ICH Q1A(R2) (Stability Testing).'
        },
        {
          title: 'Model Assumptions & Known Limitations',
          body: 'The model assumes: (1) steady-state gas permeation through defect-free films; (2) ideal series resistance combination of laminate layers; (3) uniform, constant storage conditions; (4) no seal degradation, pinholes, or mechanical damage; (5) homogeneous product moisture distribution. Real-world performance may deviate significantly due to package geometry, seal integrity, humidity cycling, and supply chain variability.'
        },
        {
          title: 'Hygroscopic Correction',
          body: 'Hygroscopic correction (exponential beta coefficient) is applied only when material-specific beta values are present in the database and when manualoverride mode is disabled. Without beta coefficients, materials are modeled as humidity-independent, which may produce optimistic estimates in high-humidity environments.'
        },
        {
          title: 'Regulatory Compliance',
          body: 'This tool does not constitute regulatory advice. Commercial shelf-life declarations must comply with applicable regulations including EU Regulation 1169/2011 (food labeling), FDA 21 CFR Part 101 (US), and any applicable sector-specific guidelines. Consult a qualified food scientist or regulatory specialist before product launch.'
        }
      ];

      disclaimerSections.forEach((sec, idx) => {
        if (y > PH - 45) { newPage(); }
        // Section header
        pdf.setFillColor(...C.redL);
        pdf.setDrawColor(...C.red);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(ML, y, CW, 7, 1, 1, 'FD');
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...C.red);
        pdf.text(safe(sec.title), ML + 3, y + 4.8);
        pdf.setTextColor(...C.black);
        y += 9;
        // Body
        const bodyLines = pdf.splitTextToSize(safe(sec.body), CW - 4);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...C.slate);
        bodyLines.forEach(line => {
          if (y > PH - 20) { newPage(); }
          pdf.text(line, ML + 2, y);
          y += 4.5;
        });
        pdf.setTextColor(...C.black);
        y += 5;
      });

      // Final stamp box
      if (y > PH - 25) { newPage(); }
      pdf.setFillColor(...C.blueDark);
      pdf.roundedRect(ML, y, CW, 14, 2, 2, 'F');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...C.white);
      pdf.text('Report generated on ' + genDate + '  |  WVTR/OTR Calculator  |  wvtr-otr-calculator.com', ML + CW/2, y + 5.5, { align: 'center' });
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(186, 210, 255);
      pdf.text('Methodology aligned with ASTM F1249, ASTM D3985, ISO 15106, ISO 18787, ICH Q1A(R2)', ML + CW/2, y + 10.5, { align: 'center' });
      pdf.setTextColor(...C.black);

      drawFooter();

      // ── Save ─────────────────────────────────────────────
      const safeName = lamName.replace(/[^a-z0-9]+/gi, '_').slice(0, 30) || 'Report';
      pdf.save('ShelfLife_' + safeName + '_' + genISO + '.pdf');

    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF generation failed. Check console for details.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:middle;margin-right:0.4rem"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export Full Report (PDF)';
      }
    }
  },

  // ------------------------------------------------------------------
  // 🗄️ LAMINATE SOURCE HANDLERS
  // ------------------------------------------------------------------

  /** Handle laminate source dropdown change */
  async onLaminateSourceChange(val) {
    if (!val) return;

    if (val === '__load_co__') {
      const coLams = await loadCompanyLaminates();
      const sel = document.getElementById('sl-laminate-pick');
      if (!sel) return;
      const grp = sel.querySelector('optgroup[label="Company Laminates"]');
      if (grp) {
        grp.innerHTML = coLams.map(l =>
          `<option value="co_${l._companyLamId}">${l.name} (${l.total.toFixed(5)})</option>`
        ).join('');
      }
      return;
    }

    let lam = null;
    if (val.startsWith('gen_')) {
      const id = val.replace('gen_', '');
      lam = DB.laminates?.find(l => String(l.id) === String(id));
    } else if (val.startsWith('co_')) {
      const docId = val.replace('co_', '');
      const coLams = await loadCompanyLaminates();
      lam = coLams?.find(l => l._companyLamId === docId);
    }

    if (!lam) return;
    this._applyLaminateToState(lam);
  },

  /** Load company laminates into select dropdown */
  async _loadCompanyLaminatesIntoSelect() {
    const sel = document.getElementById('sl-co-lam-pick');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">Loading...</option>';
    try {
      const lams = await loadCompanyLaminates();
      const modeLabel = (State.mode || 'wvtr') === 'wvtr' ? 'WVTR' : 'OTR';
      const filtered = lams.filter(l => l.mode === State.mode);
      sel.innerHTML = filtered.length === 0
        ? `<option value="">No ${State.mode.toUpperCase()} laminates in company DB</option>`
        : '<option value="">Select a laminate...</option>' +
          filtered.map(l => `<option value="${l._companyLamId}">${l.name} (${l.total ? l.total.toFixed(5) : '?'} ${modeLabel})</option>`).join('');
    } catch(e) {
      sel.innerHTML = '<option value="">Error loading</option>';
      console.warn('Failed to load company laminates:', e);
    }
  },

  /** Handle DB laminate selection */
  onDBLaminatePick(val) {
    if (!val) return;
    const lam = DB.laminates?.find(l => String(l.id) === String(val));
    if (lam) { this._applyLaminateToState(lam); return; }
    // Prova anche nei laminati community
    if (window.loadFromCommunity) {
      loadFromCommunity().then(mats => {
        // community mats non sono laminati, skip
      });
    }
  },
  async _loadCommunityLaminatesIntoSelect() {
    var sel = document.getElementById('sl-db-lam-pick');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading...</option>';
    try {
      var allLams = (DB.laminates || []).filter(function(l) { return !l.mode || l.mode === State.mode; });
      var modeLabel = (State.mode || 'wvtr') === 'wvtr' ? 'WVTR' : 'OTR';
      if (allLams.length === 0) {
        sel.innerHTML = '<option value="">No ' + modeLabel + ' laminates saved yet</option>';
      } else {
        sel.innerHTML = '<option value="">Select a laminate...</option>' +
          allLams.map(function(l) {
            return '<option value="' + l.id + '">' + l.name + ' (' + (l.total ? l.total.toFixed(5) : '?') + ' ' + modeLabel + ')</option>';
          }).join('');
      }
    } catch(e) {
      sel.innerHTML = '<option value="">Error loading</option>';
    }
  },
  /** Handle Company laminate selection */
  async onCompanyLaminatePick(val) {
    if (!val) return;
    try {
      const lams = await loadCompanyLaminates();
      const lam = lams?.find(l => l._companyLamId === val);
      if (!lam) return;
      this._applyLaminateToState(lam);
    } catch(e) {
      console.warn('Company laminate pick error:', e);
    }
  },

  /** Apply laminate data to State */
  _applyLaminateToState(lam) {
    State.layers = JSON.parse(JSON.stringify(lam.layers || []));
    State.selCond = { 
      temperature: lam.temperature || 23, 
      humidity: lam.humidity || 50 
    };
    State.calcResult = { total: lam.total, layers: [], error: null };
    State.laminateName = lam.name;
    this._updateRateSummary(lam.total ? lam.total.toFixed(6) : '-');
  }
};

// ====================================================================
// 📋 RENDER FUNCTIONS
// ====================================================================

/** Render the main Shelf Life page */
function renderShelfLife() {
  const modeLabel = (State.mode || 'wvtr') === 'wvtr' ? 'WVTR' : 'OTR';
  const unit = (State.mode || 'wvtr') === 'wvtr' ? 'g/m²·day' : 'cc/m²·day';
  const currentRate = (State.calcResult?.total) ? State.calcResult.total.toFixed(6) : '';

  // Laminate info
  let laminateName = State.laminateName || '';
  let structureStr = '';
  if (State.layers?.length) {
    const layers = State.layers
      .filter(l => l.mid !== null && l.thick > 0)
      .map(l => {
        const mat = DB.materials?.find(m => m.id === l.mid);
        return mat ? `${mat.name} (${l.thick}µm)` : null;
      })
      .filter(Boolean);
    structureStr = layers.join(' / ') || 'No valid layers';
  }

  // Product options
  let prodOpts = '';
  for (const k in PRODUCTS_DB) {
    prodOpts += `<option value="${k}">${PRODUCTS_DB[k].name}</option>`;
  }
const companyActive = typeof CompanyState !== 'undefined' && CompanyState.isActive && CompanyState.isActive();
  return `
  <div class="grid grid-2" style="gap:1.2rem;align-items:start">
    
    <!-- === FORM INPUT (left column) === -->
    <div class="card" style="padding:0">
      
      <!-- Header -->
      <div style="padding:1rem;background:var(--bg);border-bottom:1px solid var(--border)">
        <h2 style="margin:0;font-size:1rem;display:flex;align-items:center;gap:0.4rem">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Advanced Shelf Life Engine
        </h2>
      </div>

      <!-- STEP 1: BARRIER RATE SOURCE (unified - no duplicates) -->
      <div style="padding:1rem;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;color:var(--primary);font-weight:600;font-size:0.85rem">
          ▼ 1. Barrier Rate Source
        </div>

        <!-- Source selector buttons -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem;margin-bottom:0.75rem">
          <button id="sl-src-btn-calc" class="btn btn-sm" onclick="SL.setBarrierSource('calc')" 
            style="font-size:0.75rem;background:var(--primary);color:#fff;border:none">From Calculator</button>
          <button id="sl-src-btn-db" class="btn btn-sm btn-outline" onclick="SL.setBarrierSource('db')" 
            style="font-size:0.75rem">From Community DB</button>
          <button id="sl-src-btn-company" class="btn btn-sm btn-outline" onclick="SL.setBarrierSource('company')" 
            style="font-size:0.75rem${companyActive ? '' : ';opacity:0.5;cursor:not-allowed'}"
            ${companyActive ? '' : 'disabled'}>From Company DB</button>
        </div>

        <!-- Panel: From Calculator -->
        <div id="sl-panel-calc">
          <div style="background:#fff;border:1px solid var(--border);border-radius:6px;padding:0.6rem;font-size:0.75rem">
            <div style="font-weight:700;margin-bottom:0.15rem">${laminateName || 'No laminate calculated'}</div>
            <div style="color:var(--text-light);word-break:break-word;margin-bottom:0.3rem;min-height:1.2em">${structureStr || '—'}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>Calculated ${modeLabel}:</span>
              <strong style="color:var(--primary)">${currentRate || '-'} ${unit}</strong>
            </div>
          </div>
        </div>
<!-- Panel: Laminate DB -->
        <div id="sl-panel-db" style="display:none">
          <div class="form-group" style="margin:0">
            <label style="font-size:0.75rem;font-weight:600">Select from Community DB</label>
            <select class="form-input" id="sl-db-lam-pick" onchange="SL.onDBLaminatePick(this.value)" style="font-size:0.78rem">
              <option value="">Loading...</option>
            </select>
          </div>
        </div>

        <!-- Panel: Company DB -->
        <div id="sl-panel-company" style="display:none">
          ${(typeof CompanyState !== 'undefined' && CompanyState.isActive && CompanyState.isActive())
            ? '<div class="form-group" style="margin:0"><label style="font-size:0.75rem;font-weight:600">Select from Company Laminates</label><select class="form-input" id="sl-co-lam-pick" onchange="SL.onCompanyLaminatePick(this.value)" style="font-size:0.78rem"><option value="">Loading...</option></select></div>'
            : '<div style="font-size:0.75rem;color:var(--text-light);padding:0.4rem 0">Join a company to access company laminates. <a href="#" onclick="showCompanyModal();return false" style="color:var(--primary)">Join now</a></div>'
          }
        </div>

        <!-- Manual override toggle -->
        <div style="margin-top:0.8rem;padding-top:0.6rem;border-top:1px dashed var(--border)">
          <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.75rem;color:var(--text-light)">
            <input type="checkbox" id="sl-manual-toggle" onchange="SL.toggleManualOverride(this.checked)">
            Override with manual ${modeLabel} value
          </label>
        </div>

        <!-- Manual input panel -->
        <div id="sl-panel-manual" style="display:none;margin-top:0.5rem;background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:0.6rem">
          <div style="font-size:0.72rem;font-weight:600;color:var(--text-light);margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em">
            Manual input
          </div>
          <div class="grid grid-2" style="gap:0.5rem">
            <div class="form-group" style="margin:0">
              <label>${modeLabel} Value (${unit})</label>
              <input type="number" id="sl-rate-manual" value="0.5" step="any" class="form-input" oninput="SL.onManualRateChange()">
            </div>
            <div class="form-group" style="margin:0">
              <label>Test Temperature (°C)</label>
              <input type="number" id="sl-rate-temp" value="23" class="form-input">
            </div>
            <div class="form-group" style="margin:0;grid-column:1/-1">
              <label>Test Humidity (%RH)</label>
              <input type="number" id="sl-rate-hum" value="50" class="form-input">
            </div>
          </div>
        </div>

        <!-- Active rate summary (always visible) -->
        <div style="margin-top:0.8rem;background:var(--primary-light);border-radius:6px;padding:0.5rem 0.75rem;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.75rem;font-weight:600">Active ${modeLabel}:</span>
          <strong id="sl-active-rate" style="color:var(--primary);font-size:0.9rem">${currentRate || '-'} ${unit}</strong>
        </div>
      </div>

      <!-- STEP 2: THERMAL ACCELERATION -->
      <div style="padding:1rem;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;color:var(--primary);font-weight:600;font-size:0.85rem">
          ▼ 2. Thermal Acceleration
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.75rem">
          <div class="grid grid-2" style="gap:0.5rem;align-items:start">
            <div class="form-group" style="margin:0">
              <label>Activation Energy Eₐ (kJ/mol)</label>
              <div style="display:flex;gap:0.4rem;align-items:center">
  <input type="number" id="sl-ea" value="" step="0.1" class="form-input" 
    placeholder="Auto or 60" oninput="SL.onEaInput()" style="flex:1">
</div>
            </div>
            <div class="form-group" style="margin:0">
              <label>Q₁₀ Factor</label>
              <input type="number" id="sl-q10" value="" step="0.1" class="form-input" placeholder="Auto or 2.0" oninput="SL.onQ10Input()">
            </div>
          </div>
          <div style="font-size:0.65rem;color:var(--text-light);margin-top:0.3rem" id="sl-ea-q10-hint">
            Leave empty to use product default.
          </div>
        </div>
      </div>

      <!-- STEP 3: PACKAGING DIMENSIONS -->
      <div style="padding:1rem;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;color:var(--warning);font-weight:600;font-size:0.85rem">
          ▼ 3. Packaging Dimensions
        </div>
        <div style="margin-bottom:0.5rem">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.8rem;font-weight:500">
            <input type="radio" name="pkg-geom" value="auto" checked onchange="SL.togglePkgMode()">
            Calculate from shape
          </label>
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.8rem;font-weight:500;margin-top:0.2rem">
            <input type="radio" name="pkg-geom" value="manual" onchange="SL.togglePkgMode()">
            Enter area manually
          </label>
        </div>
        
        <!-- Geometry selector -->
        <div id="geom-selector" class="grid grid-2" style="margin-top:0.5rem;gap:0.4rem;align-items:start">
          <div class="form-group" style="margin:0">
            <label>Shape Type</label>
            <select class="form-input" id="sl-shape" onchange="SL.onPkgChange()">
              <option value="flat">Flat Pouch</option>
              <option value="standup">Stand-Up Pouch</option>
              <option value="flow">Flow Pack</option>
              <option value="box">Rectangular Box</option>
              <option value="cylinder">Cylindrical Jar</option>
              <option value="tray">Tray with Lid</option>
              <option value="bottle">Bottle</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label>Welding Margin (cm)</label>
            <input type="number" id="sl-margin" value="2" step="0.5" class="form-input" onchange="SL.calcArea()">
          </div>
        </div>
        
        <!-- Dimension inputs -->
        <div id="dims-selector" style="margin-top:0.4rem">
          <div id="dims-pouch" class="grid grid-2" style="gap:0.4rem">
            <div class="form-group" style="margin:0"><label>Width L (cm)</label><input type="number" id="sl-w" value="12" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
            <div class="form-group" style="margin:0"><label>Height H (cm)</label><input type="number" id="sl-h" value="17" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
            <div class="form-group" style="margin:0"><label>Depth / Diameter (cm)</label><input type="number" id="sl-d" value="0" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
          </div>
          <div id="dims-bottle" class="grid grid-2" style="gap:0.4rem;display:none">
            <div class="form-group" style="margin:0"><label>Body Radius (cm)</label><input type="number" id="sl-bottle-body-r" value="3.5" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
            <div class="form-group" style="margin:0"><label>Body Height (cm)</label><input type="number" id="sl-bottle-body-h" value="16" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
            <div class="form-group" style="margin:0"><label>Neck Radius (cm)</label><input type="number" id="sl-bottle-neck-r" value="1.2" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
            <div class="form-group" style="margin:0"><label>Neck Height (cm)</label><input type="number" id="sl-bottle-neck-h" value="4" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
            <div class="form-group" style="margin:0;grid-column:1/-1"><label>Shoulder Height (cm)</label><input type="number" id="sl-bottle-shoulder-h" value="2.5" step="0.1" class="form-input" oninput="SL.calcArea()"></div>
          </div>
        </div>
        
        <!-- Manual area input -->
        <div id="manual-area-input" style="display:none;margin-top:0.5rem">
          <div class="form-group" style="margin:0">
            <label>Total Surface Area (m²)</label>
            <input type="number" id="sl-area-manual" value="0.0408" step="0.001" class="form-input" oninput="SL.updateManualArea()">
          </div>
        </div>
        
        <!-- Area summary -->
        <div style="margin-top:0.5rem;display:flex;justify-content:space-between;align-items:center;background:var(--primary-light);padding:0.4rem;border-radius:6px">
          <span style="font-size:0.75rem;font-weight:500">→ Effective Area:</span>
          <strong id="sl-area-display" style="color:var(--primary)">0.0408 m²</strong>
        </div>
        <input type="hidden" id="sl-area" value="0.0408">
      </div>

      <!-- STEP 4: PRODUCT -->
      <div style="padding:1rem;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;color:var(--purple);font-weight:600;font-size:0.85rem">
          ▼ 4. Product
        </div>
        <div class="form-group" style="margin:0">
          <label>Food Template</label>
          <select id="sl-product" class="form-input" onchange="SL.onProductChange(this.value)">${prodOpts}</select>
        </div>
        <div class="grid grid-2" style="gap:0.5rem;margin-top:0.5rem">
          <div class="form-group" style="margin:0"><label>Weight (g)</label><input type="number" id="sl-weight" value="100" class="form-input"></div>
          <div class="form-group" style="margin:0"><label>Initial Moisture (%)</label><input type="number" id="sl-minit" value="3" class="form-input" oninput="SL.drawSafeZone()"></div>
          <div class="form-group" style="margin:0"><label>Critical Moisture (%)</label><input type="number" id="sl-mcrit" value="6" class="form-input" oninput="SL.drawSafeZone()"></div>
        </div>
        <div style="margin-top:0.8rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.2rem">
            <span style="font-size:0.7rem;font-weight:600">Moisture Limit</span>
            <span id="sl-mcrit-val" style="font-size:0.7rem;color:var(--text-light)">6%</span>
          </div>
          <div style="position:relative;height:20px;background:#e2e8f0;border-radius:4px;overflow:hidden">
            <div id="sl-safe-green" style="position:absolute;left:0;top:0;bottom:0;background:var(--success);width:33%"></div>
            <div id="sl-safe-now" style="position:absolute;left:16%;top:-2px;bottom:-2px;width:2px;background:#fff;z-index:2"></div>
            <div id="sl-safe-crit" style="position:absolute;right:0;top:-2px;bottom:-2px;width:2px;background:var(--danger);z-index:2"></div>
          </div>
        </div>
      </div>

      <!-- STEP 5: STORAGE & CALCULATE -->
      <div style="padding:1rem">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;color:var(--primary);font-weight:600;font-size:0.85rem">
          ▼ 5. Storage Conditions
        </div>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
          <button class="btn btn-sm" id="btn-single" style="flex:1;background:var(--primary);color:#fff" onclick="SL.toggleCond('single')">Single Condition</button>
          <button class="btn btn-sm" id="btn-chain" style="flex:1;background:var(--bg);color:var(--text-light)" onclick="SL.toggleCond('chain')">Logistics Chain</button>
        </div>
        
        <!-- Single condition inputs -->
        <div id="sl-cond-single">
          <div class="grid grid-2" style="gap:0.5rem">
            <div class="form-group" style="margin:0"><label>Storage Temp (°C)</label><input type="number" id="sl-temp" value="25" class="form-input"></div>
            <div class="form-group" style="margin:0"><label>External RH (%)</label><input type="number" id="sl-rh-ext" value="65" class="form-input"></div>
          </div>
        </div>
        
        <!-- Logistics chain table -->
        <div id="sl-cond-chain" style="display:none">
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:separate;border-spacing:0 5px;font-size:0.9rem">
              <thead>
                <tr>
                  <th style="padding:0.6rem 0.5rem;text-align:left;font-weight:600;width:35%">Step</th>
                  <th style="padding:0.6rem 0.3rem;text-align:center;font-weight:600;width:18%">°C</th>
                  <th style="padding:0.6rem 0.3rem;text-align:center;font-weight:600;width:18%">RH%</th>
                  <th style="padding:0.6rem 0.3rem;text-align:center;font-weight:600;width:18%">Days</th>
                  <th style="padding:0.6rem 0.3rem;width:40px"></th>
                </tr>
              </thead>
              <tbody id="sl-chain-rows">
                <tr style="background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                  <td style="padding:0.5rem"><input type="text" value="Factory" style="width:100%;padding:0.55rem 0.6rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;background:#fafbfc"></td>
                  <td style="padding:0.5rem"><input type="number" value="22" class="sl-ct" style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center"></td>
                  <td style="padding:0.5rem"><input type="number" value="50" class="sl-cr" style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center"></td>
                  <td style="padding:0.5rem"><input type="number" value="2" class="sl-cd" style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center"></td>
                  <td style="padding:0.5rem;text-align:center"><span style="cursor:pointer;color:var(--danger);font-size:1.2rem;line-height:1" onclick="this.closest('tr').remove()">✕</span></td>
                </tr>
                <tr style="background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                  <td style="padding:0.5rem"><input type="text" value="Transit" style="width:100%;padding:0.55rem 0.6rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;background:#fafbfc"></td>
                  <td style="padding:0.5rem"><input type="number" value="35" class="sl-ct" style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center"></td>
                  <td style="padding:0.5rem"><input type="number" value="85" class="sl-cr" style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center"></td>
                  <td style="padding:0.5rem"><input type="number" value="14" class="sl-cd" style="width:100%;padding:0.55rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.9rem;text-align:center"></td>
                  <td style="padding:0.5rem;text-align:center"><span style="cursor:pointer;color:var(--danger);font-size:1.2rem;line-height:1" onclick="this.closest('tr').remove()">✕</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <button class="btn btn-outline btn-full" style="margin-top:0.6rem;padding:0.6rem;font-size:0.85rem" onclick="SL.addChainRow()">+ Add Step</button>
        </div>
        
        <button class="btn btn-danger btn-full" onclick="SL.calculate()" style="margin-top:1rem;padding:0.8rem;font-size:0.9rem">
          ▶ Calculate Shelf Life
        </button>
      </div>
    </div>

    <!-- === RESULTS AREA (right column - sticky) === -->
    <div style="position:sticky;top:1rem;height:fit-content">
      <div class="card" id="sl-result-panel">
        <div style="text-align:center;padding:2rem;color:var(--text-light)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;margin-bottom:0.5rem;opacity:0.3">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>Configure parameters and calculate to see predictions</p>
        </div>
      </div>
      
      <!-- Charts containers (shown after calculation) -->
      <div id="sl-charts-container" style="display:none;margin-top:1rem">
        <div class="card" style="margin-bottom:1rem">
          <h3 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem">Quality Decay Over Time</h3>
          <div class="chart-mini" style="height:260px"><canvas id="slDecayChart"></canvas></div>
        </div>
        <div class="card">
          <h3 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem">Shelf Life vs Temperature</h3>
          <div class="chart-mini" style="height:260px"><canvas id="slTempChart"></canvas></div>
        </div>
      </div>
      
      <!-- Logistics charts (shown only for chain mode) -->
      <div id="sl-logistics-charts" style="display:none;margin-top:0.8rem">
        <div class="card"><h3 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem">Logistics Conditions</h3><div class="chart-mini" style="height:220px"><canvas id="slChainChart"></canvas></div></div>
        <div class="card" style="margin-top:0.5rem"><h3 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem">Shelf Life Consumed per Step</h3><div class="chart-mini" style="height:280px"><canvas id="slStepImpactChart"></canvas></div></div>
        <div class="card" style="margin-top:0.5rem"><h3 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem">Moisture Accumulation</h3><div class="chart-mini" style="height:260px"><canvas id="slMoistureAccChart"></canvas></div></div>
        <div class="card" style="margin-top:0.5rem"><h3 style="font-size:0.9rem;font-weight:600;margin-bottom:0.5rem">Timeline</h3><div class="chart-mini" style="height:200px"><canvas id="slCumulativeChart"></canvas></div></div>
      </div>
    </div>
  </div>

<script>
    setTimeout(function() {
      var btn = document.getElementById('sl-src-btn-company');
      if (btn && typeof CompanyState !== 'undefined' && CompanyState.isActive && CompanyState.isActive()) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }, 500);
  </script>
  
  <!-- EXPORT BUTTON (full width) -->
  <div class="card" style="margin-top:1.2rem;text-align:center">
    <button class="btn btn-primary btn-full" onclick="SL.exportToPDF(event)" style="padding:0.7rem;font-size:0.85rem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:middle;margin-right:0.4rem">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export Full Report (PDF)
    </button>
    <p style="font-size:0.7rem;color:var(--text-light);margin-top:0.4rem">
      Includes: laminate structure, parameters, results & all charts
    </p>
  </div>

  ${renderShelfLifeMethodology()}
  `;
}

/** Render methodology section (static content) */
function renderShelfLifeMethodology() {
return `
<div class="card" style="margin-top:1rem; border-left:4px solid var(--primary); background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
<div style="padding:1.2rem 1.5rem;">
<h2 style="font-family:Georgia, 'Times New Roman', serif; font-size:1.3rem; color:var(--text); border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:1.2rem;">
Mechanics of Shelf-Life Prediction
</h2>
<div style="font-size:0.95rem; line-height:1.8; color:#334155; font-family:Georgia, 'Times New Roman', serif;">

<p>Predicting the exact day a food or pharmaceutical product becomes unusable is one of the most critical challenges in packaging engineering. A package is not a static shield; it is a dynamic, semi-permeable membrane. Molecules of water vapor and oxygen are constantly bombarded against the outer wall, slowly shifting the internal equilibrium of the ecosystem. To calculate shelf life, this software pairs the material's barrier values (WVTR/OTR) with the chemical degradation kinetics of the product.</p>

<h3 style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; font-size:1.1rem; color:var(--primary-dark); margin-top:1.5rem; font-weight:700;">Moisture ingress & Dynamic equilibrium</h3>
<p>Unlike simple models that assume moisture enters a package at a constant, unvarying speed, the real physical world is non-linear. The velocity of moisture transport depends entirely on the chemical potential gradient—the difference between the relative humidity outside (RH<sub>ext</sub>) and the changing water activity inside the food matrix (a<sub>w</sub>).</p>

<div style="background:var(--primary-light); padding:0.8rem 1rem; border-radius:8px; border-left:3px solid var(--primary); margin:1rem 0; font-family:sans-serif; font-size:0.9rem;">
<strong>The Thermodynamic Principle:</strong> As a dry product (like a biscuit or milk powder) absorbs water vapor, its internal water activity (a<sub>w</sub>) climbs. It becomes progressively less "thirsty." This collapses the driving force gradient, causing moisture transport to start very rapidly and then naturally flatten out into an asymptotic curve.
</div>

<h4 style="margin:1.2rem 0 0.5rem 0; font-family:sans-serif; font-size:0.95rem; color:var(--text);">The Mathematical Equation:</h4>
<div style="background:#f8fafc; padding:1.1rem; border-radius:6px; font-family:monospace; font-size:0.95rem; text-align:center; border:1px dashed var(--border); margin-bottom:1rem; color:#0f172a;">
Daily loop: M(t+1) = M(t) + WVTR<sub>eff</sub> × (dP / dP<sub>ref</sub>) × A / W × 100<br><br>
where dP = P<sub>sat</sub>(T) × max(RH<sub>ext</sub> − RH<sub>in</sub>, 1) / 100<br>
and RH<sub>in</sub> = GAB(M(t)) × 100
</div>
<p>To accurately compute this, the calculator integrates the GAB (Guggenheim-Anderson-de Boer) Sorption Isotherm Model. This standard converting matrix translates raw moisture percentages into Water Activity, predicting the exact mathematical threshold where crispness turns into texture loss, or where microbial spore germination begins.</p>
<div style="background:var(--warning-light); padding:0.7rem 1rem; border-radius:8px; border-left:3px solid var(--warning); margin:0.8rem 0; font-family:sans-serif; font-size:0.85rem;">
<strong>Note on the model:</strong> The calculator uses a day-by-day numerical simulation rather than a closed-form equation. At each time step, the internal water activity aᵥ is computed via the GAB isotherm from the current moisture M, the driving pressure differential dP is derived from the difference between external RH and internal aᵥ, and the daily moisture increment dM is accumulated until M reaches M_crit. This approach is more accurate than a static analytical formula because it correctly captures the declining driving force as the product absorbs moisture.
</div>

<div style="background:#f0fdf4; padding:1rem; border-radius:8px; border-left:3px solid var(--success); margin:1.2rem 0; font-family:sans-serif; font-size:0.9rem;">
<strong style="color:#16a34a; font-size:0.95rem;">📊 Moisture Calculation Example:</strong><br>
Imagine a <strong>200g bag of dry crackers</strong> with a surface area of <strong>0.05 m²</strong>, protected by a film with a real WVTR of <strong>1.0 g/m²·day</strong>. The storage warehouse is at <strong>75% RH</strong>.
<ul>
  <li><strong>The Product Limits:</strong> The product starts at 2% moisture (a<sub>w</sub> = 0.15) and becomes soggy/unacceptable at 4% moisture (a<sub>w</sub> = 0.45). This allows a total safe mass increase of <strong>4.0 grams of water</strong>.</li>
  <li><strong>The Calculation Loop:</strong> At Day 1, the driving force is high: (0.75 - 0.15) = 0.60. Water rushes in at 0.03 g/day.</li>
  <li>By Day 100, the product has absorbed water, and its internal a<sub>w</sub> has risen to 0.40. Now, the driving force drops to (0.75 - 0.40) = 0.35. The infiltration rate slows down significantly.</li>
  <li>By factoring in this falling driving force, the system calculates an accurate shelf life (e.g., <strong>148 days</strong>) instead of an erroneous linear guess.</li>
</ul>
</div>

<h3 style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; font-size:1.1rem; color:var(--primary-dark); margin-top:2rem; font-weight:700;">Oxygen ingress & oxidative degradation</h3>
<p>For products dense in unsaturated lipids (fried snacks, nuts, premium oils, coffee), oxygen is the primary catalyst for failure. Unlike moisture, oxygen ingress typically operates under a steady-state kinetic model. Because active lipids consume oxygen molecules almost immediately upon entry, the internal oxygen concentration is often modeled close to 0%, keeping the driving pressure gradient constant.</p>

<div style="background:var(--warning-light); padding:0.8rem 1rem; border-radius:8px; border-left:3px solid var(--warning); margin:1rem 0; font-family:sans-serif; font-size:0.9rem;">
<strong>Info:</strong> The system applies a zero-order oxidative model. The degradation rate remains linear until the total accumulated volume of oxygen hits a critical chemical mass threshold that triggers rancidity and off-flavors.
</div>

<h4 style="margin:1.2rem 0 0.5rem 0; font-family:sans-serif; font-size:0.95rem; color:var(--text);">The Mathematical Equation:</h4>
<div style="background:#f8fafc; padding:1.1rem; border-radius:6px; font-family:monospace; font-size:0.95rem; text-align:center; border:1px dashed var(--border); margin-bottom:1rem; color:#0f172a;">
t<sub>shelf_life</sub> = (fat_kg × O2_crit) / (OTR × A × 0.21)<br><br>
where O2_crit is in cc O₂ / kg fat, OTR in cc/m²·day,<br>
A in m², and 0.21 is the volumetric fraction of O₂ in air
</div>
<p><em>Note on advanced chemical behaviors:</em> In real industrial settings, lipid oxidation follows an autocatalytic pathway—moving slowly during an initial induction phase before accelerating violently via free-radical chain reactions. Because a zero-order model simplifies this into a steady average, this tool provides a highly reliable conservative baseline, perfect for fast-moving goods or early-stage packaging iterations.</p>

<div style="background:#f0fdf4; padding:1rem; border-radius:8px; border-left:3px solid var(--success); margin:1.2rem 0; font-family:sans-serif; font-size:0.9rem;">
<strong style="color:#16a34a; font-size:0.95rem;"> Oxygen Calculation Example:</strong><br>
Let's analyze a <strong>100g pack of roasted peanuts</strong> containing <strong>50g of pure fat</strong>. The bag surface area is <strong>0.04 m²</strong>, and the laminate OTR is <strong>20 cc/m²·day</strong>.
<ul>
  <li><strong>The Degradation Target:</strong> Literature states that peanuts become rancid when they absorb <strong>2.0 mg of O₂ per gram of fat</strong>. Total allowable oxygen capacity = 50g &times; 2.0 mg = <strong>100 mg of O₂</strong>.</li>
  <li><strong>Gas-to-Mass Translation:</strong> The film allows 20 cc/m²·day × 0.04 m² × 0.21 = <strong>0.168 cc of O₂/day</strong> into the package. The calculation works entirely in volumes, consistent with the O2_crit threshold expressed in cc/kg.</li>
  <li><strong>Final Computation:</strong> Shelf life = (0.05 kg × 400 cc/kg) / (20 cc/m²·day × 0.04 m² × 0.21) = 20 / 0.168 = <strong>119 Days</strong></li>
</ul>
</div>

<h3 style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; font-size:1.1rem; color:var(--primary-dark); margin-top:2rem; font-weight:700;"> Temperature: the Arrhenius accelerator</h3>
<p>Thermal energy acts as a major catalyst for degradation. When a package enters a warm storage depot, the gas molecules gain kinetic energy and pass through the polymer matrix much faster. To scale shelf life across varying global supply chains, the calculator processes two distinct thermodynamic architectures:</p>

<table style="width:100%; border-collapse:collapse; margin:1rem 0; font-family:sans-serif; font-size:0.88rem;">
  <thead>
    <tr style="background:#f1f5f9; border-bottom:2px solid var(--border);">
      <th style="padding:0.6rem; text-align:left; width:25%;">Thermal Model</th>
      <th style="padding:0.6rem; text-align:left; width:45%;">Operational Mechanics</th>
      <th style="padding:0.6rem; text-align:left; width:30%;">Engineering Application</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:0.6rem; font-weight:bold; color:var(--primary-dark);">Q<sub>10</sub> Rule</td>
      <td>Assumes chemical degradation velocity multiplies by a fixed coefficient (typically 2.0x to 3.0x) for every step-increase of 10°C.</td>
      <td>Ideal for rapid, high-velocity estimations in common commercial supply chains.</td>
    </tr>
    <tr>
      <td style="padding:0.6rem; font-weight:bold; color:var(--purple);">Arrhenius Equation</td>
      <td>Calculates exact exponential degradation profiles based on the material's specific Activation Energy (E<sub>a</sub>) and the universal gas constant (R).</td>
      <td>Used for highly accurate scientific simulations across tropical or extreme climates.</td>
    </tr>
  </tbody>
</table>

<h3 style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; font-size:1.1rem; color:var(--primary-dark); margin-top:2rem; font-weight:700;">Environmental humidity feedback on the barrier</h3>
<p>If your design includes highly sensitive polymers like EVOH or Nylon, the barrier values themselves change dynamically as a function of environmental humidity. When storage conditions diverge from laboratory baseline parameters, the software re-scales the active barrier resistance using an exponential sensitivity multiplier:</p>

<div style="background:#f8fafc; padding:1.1rem; border-radius:6px; font-family:monospace; font-size:0.95rem; text-align:center; border:1px dashed var(--border); margin:1rem 0; color:#0f172a;">
Barrier<sub>corrected</sub> = Barrier<sub>baseline</sub> &times; e<sup>&beta; &times; (RH<sub>storage</sub> - RH<sub>reference</sub>)</sup>
</div>

<p>This integration ensures that if an EVOH pouch is shipped to an environment at 85% RH, its calculated barrier decreases automatically, preventing dangerous miscalculations in product stability forecasting.</p>

<h3 style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; font-size:1.1rem; color:var(--primary-dark); margin-top:2rem; font-weight:700;">Scientific standards alignment matrix</h3>
<p>The mathematical models and boundary conditions embedded within this system align directly with international testing protocols:</p>
<p style="margin-left:1.2rem; color:var(--text-light); font-size:0.88rem; font-family:sans-serif;">
• <strong>Permeation Metrics:</strong> ASTM F1249 / ISO 15106-3 (Water Vapor), ASTM D3985 / ISO 15106-2 (Oxygen Concentration)<br>
• <strong>Sorption Thermodyamics:</strong> ISO 18787 (Water Activity Assessment), GAB Model Protocols (Van den Berg & Bruin)<br>
• <strong>Stability Guidelines:</strong> ICH Q1A(R2) Standard Protocol for Accelerated Food and Drug Stability Testing
</p>

<div style="margin-top:2rem; padding:0.9rem; background:var(--bg); border-radius:8px; font-size:0.88rem; color:var(--text-light); border-left:4px solid var(--primary); font-family:sans-serif;">
<strong>Industrial Protocol Disclaimer: </strong> This computational module is built to accelerate exploratory R&D and packaging concept optimization. Predictive modeling does not bypass regulatory legal frameworks. Final legal shelf-life validations and commercial packaging claims must always be verified by real-time physical chamber testing in compliance with local food safety codes (e.g., FDA 21 CFR or EU 1169/2011).
</div>

</div>
</div>
</div>
`;
}
