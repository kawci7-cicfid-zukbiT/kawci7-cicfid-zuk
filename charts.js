
// ====================================================================
// 📊 CHARTS.JS - All chart drawing functions
// ====================================================================

// ====================================================================
// 🏠 HOME DEMO CHARTS
// ====================================================================
function initDemoCharts() {
  if (typeof Chart === 'undefined') return;
  var canvas1 = document.getElementById('demoChart1');
  var canvas2 = document.getElementById('demoChart2');
  if (!canvas1 || !canvas2) return;

  destroyChart('demo1');
  destroyChart('demo2');

  var unit  = getUnit();
  var label = getLabel();

  chartInstances.demo1 = new Chart(canvas1.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['20°C', '25°C', '30°C', '38°C', '50°C'],
      datasets: [
        { label: 'EVOH 100μm', data: [0.05, 0.08, 0.12, 0.15, 0.40],
          borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'LDPE 100μm', data: [0.8, 1.0, 1.3, 1.5, 2.8],
          borderColor: '#22c55e', fill: false, borderDash: [4, 3],
          tension: 0.4, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: label + ' (' + unit + ')' } }
      }
    }
  });

  chartInstances.demo2 = new Chart(canvas2.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['PET', 'EVOH', 'LDPE'],
      datasets: [{ data: [15, 70, 15], backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } },
      cutout: '65%'
    }
  });
}

// ====================================================================
// 🏠 HOME ANIMATIONS & COUNT-UP
// ====================================================================
function initHomeAnimations() {
  if (State.tab !== 'home') return;

  if (window.communityDB) updateTop3UI();

  async function updateTop3UI() {
    var top3      = await refreshGlobalRankings();
    var container = document.getElementById('top3-ranking');
    if (!container) return;
    if (top3.length === 0) {
      container.innerHTML =
        '<div style="padding:1.5rem;text-align:center;color:#94a3b8;font-size:0.82rem">Start calculating to see rankings</div>';
    } else {
      var medals = ['01', '02', '03'];
      container.innerHTML = top3.map(function(m, idx) {
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

  var featuresSection = document.getElementById('featuresSection');
  if (featuresSection) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.querySelectorAll('.feature-card').forEach(function(c, i) {
            setTimeout(function() { c.classList.add('visible'); }, i * 100);
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    observer.observe(featuresSection);
  }

  initDemoCharts();
  initCountUp();

  document.querySelectorAll('.progress-fill').forEach(function(bar) {
    bar.style.animation = 'progressGrow 1.2s ease-out forwards';
  });
}

function initCountUp() {
  var counters = document.querySelectorAll('.count-up');
  counters.forEach(function(counter) {
    var target   = parseInt(counter.dataset.target);
    var steps    = 30;
    var increment = target / steps;
    var current  = 0;
    var animate  = function() {
      current += increment;
      if (current < target) { counter.textContent = Math.floor(current); requestAnimationFrame(animate); }
      else counter.textContent = target;
    };
    setTimeout(animate, 300 + Array.from(counters).indexOf(counter) * 150);
  });
}

// ====================================================================
// 📐 CALC - BAR CHART (resistance contribution)
// ====================================================================
function drawBarChart() {
  var canvas = document.getElementById('barChart');
  if (!canvas || !State.calcResult || !State.calcResult.layers) return;
  destroyChart('bar');
  var ctx    = canvas.getContext('2d');
  var labels = [], barData = [], colors = [];
  for (var i = 0; i < State.calcResult.layers.length; i++) {
    var layer = State.calcResult.layers[i];
    labels.push('L' + (i + 1));
    barData.push(parseFloat(layer.resistancePct.toFixed(1)));
    colors.push(LAYER_COLORS[i % LAYER_COLORS.length]);
  }
  var prec = getDisplayPrecision();
  chartInstances.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Resistance %',
        data:  barData,
        backgroundColor: colors.map(function(c) { return c + 'cc'; }),
        borderColor: colors,
        borderWidth: 2, borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          callbacks: {
            label: function(context) {
              var layer = State.calcResult.layers[context.dataIndex];
              return [
                layer.materialName,
                'Resistance: ' + formatWithSigFigs(context.parsed.y, prec) + '%',
                'R = '         + formatWithSigFigs(layer.resistance, prec)
              ];
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, max: 100,
             title: { display: true, text: '% of Total Resistance' },
             ticks: { callback: function(v) { return formatChartValue(v, prec, '%'); } } },
        x: { title: { display: true, text: 'Layer' } }
      }
    }
  });
}

// ====================================================================
// 🌡️ CALC - LAMINATE CURVE CHART (WVTR/OTR vs Temperature)
// ====================================================================
function drawLaminateCurveChart() {
  var canvas = document.getElementById('lamCurveChart');
  if (!canvas || !State.calcResult) return;
  destroyChart('lamCurve');

  var unit             = getUnit();
  var datasets         = [];
  var allTemps         = [];
  var selectedHumidity = State.selCond ? State.selCond.humidity : null;

  for (var i = 0; i < State.layers.length; i++) {
    var layer = State.layers[i];
    if (layer.mid === null || layer.thick <= 0) continue;
    var mat = null;
    for (var m = 0; m < DB.materials.length; m++) {
      if (DB.materials[m].id === layer.mid) { mat = DB.materials[m]; break; }
    }
    if (!mat) continue;

    var color = LAYER_COLORS[i % LAYER_COLORS.length];
    var vals  = Engine.getValues(mat);
    var grouped = {};
    for (var j = 0; j < vals.length; j++) {
      var cond = mat.validConditions[j];
      if (!cond) continue;
      if (selectedHumidity !== null && cond.humidity !== selectedHumidity) continue;
      var key = cond.temperature + '|' + cond.humidity;
      if (!grouped[key]) grouped[key] = { values: [], thicknesses: [], cond: cond };
      grouped[key].values.push(vals[j].value);
      grouped[key].thicknesses.push(vals[j].thickness);
    }

    var dataPoints = [];
    for (var key in grouped) {
      var g       = grouped[key];
      var avgVal  = g.values.reduce(function(a, b) { return a + b; }, 0) / g.values.length;
      var avgThick = g.thicknesses.reduce(function(a, b) { return a + b; }, 0) / g.thicknesses.length;
      var product = avgVal * avgThick;
      var res     = layer.thick / product;
      var trans   = res > 0 ? 1 / res : 0;
      dataPoints.push({ x: g.cond.temperature, y: trans });
      allTemps.push(g.cond.temperature);
    }

    if (dataPoints.length > 0) {
      datasets.push({ label: mat.name, data: dataPoints,
        borderColor: color, backgroundColor: color, borderWidth: 2,
        showLine: true, type: 'scatter', order: 2, pointRadius: 5, pointHoverRadius: 7 });
    }

    var p = Engine.calcArrheniusParams(mat);
    if (p.valid && dataPoints.length > 0) {
      var tMin2 = dataPoints[0].x, tMax2 = dataPoints[0].x;
      for (var dp = 0; dp < dataPoints.length; dp++) {
        if (dataPoints[dp].x < tMin2) tMin2 = dataPoints[dp].x;
        if (dataPoints[dp].x > tMax2) tMax2 = dataPoints[dp].x;
      }
      tMin2 -= 10; tMax2 += 10;
      var curveData = [];
      for (var tt = tMin2; tt <= tMax2; tt += 0.5) {
        var transMat = Engine.predict(p.A, p.Ea, tt);
        var prod2    = transMat * Engine.getValues(mat)[0].thickness;
        var res2     = layer.thick / prod2;
        curveData.push({ x: tt, y: res2 > 0 ? 1 / res2 : 0 });
        allTemps.push(tt);
      }
      if (curveData.length > 0) {
        datasets.push({ label: mat.name + ' (Fit)', data: curveData,
          borderColor: color, backgroundColor: 'transparent',
          borderWidth: 1.5, borderDash: [5, 3], pointRadius: 0,
          type: 'line', order: 1, showLine: true });
      }
    }
  }

  // Laminate total curve
  var laminateCurve = [];
  if (allTemps.length > 0) {
    var tMin3 = Math.min.apply(null, allTemps) - 5;
    var tMax3 = Math.max.apply(null, allTemps) + 5;
    for (var t3 = tMin3; t3 <= tMax3; t3 += 0.5) {
      var totalR = 0, valid = true;
      for (var li = 0; li < State.layers.length; li++) {
        var ly = State.layers[li];
        if (ly.mid === null || ly.thick <= 0) { valid = false; break; }
        var mt = null;
        for (var mi = 0; mi < DB.materials.length; mi++) {
          if (DB.materials[mi].id === ly.mid) { mt = DB.materials[mi]; break; }
        }
        if (!mt) { valid = false; break; }
        var condIdx = -1;
        for (var ci = 0; ci < mt.validConditions.length; ci++) {
          if (Math.abs(mt.validConditions[ci].temperature - t3) < 0.01 &&
              (selectedHumidity === null || mt.validConditions[ci].humidity === selectedHumidity)) {
            condIdx = ci; break;
          }
        }
        if (condIdx >= 0) {
          var wv = Engine.getValues(mt)[condIdx];
          if (!wv || wv.value <= 0.00001) { valid = false; break; }
          totalR += ly.thick / (wv.value * wv.thickness);
        } else {
          var pp = Engine.calcArrheniusParams(mt);
          var hasHumData = mt.validConditions.some(function(cc) {
            return selectedHumidity === null || cc.humidity === selectedHumidity;
          });
          if (pp.valid && hasHumData) {
            var transMat2 = Engine.predict(pp.A, pp.Ea, t3);
            var prod3     = transMat2 * Engine.getValues(mt)[0].thickness;
            totalR += ly.thick / prod3;
          } else { valid = false; break; }
        }
      }
      if (valid && totalR > 0) laminateCurve.push({ x: t3, y: 1 / totalR });
    }
  }

  if (laminateCurve.length > 0) {
    datasets.push({ label: '▶ LAMINATE TOTAL', data: laminateCurve,
      borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)',
      borderWidth: 2.5, pointRadius: 0, type: 'line', fill: false, order: 0 });
  }

  if (State.selCond && State.calcResult && State.calcResult.total > 0 && !State.calcResult.isBarrier) {
    datasets.push({ label: '▶ Calculated @ ' + State.selCond.temperature + '°C',
      data: [{ x: State.selCond.temperature, y: State.calcResult.total }],
      borderColor: '#dc2626', backgroundColor: '#dc2626', borderWidth: 3,
      pointRadius: 8, pointHoverRadius: 10, pointBackgroundColor: '#fff',
      pointBorderColor: '#dc2626', type: 'scatter', showLine: false, order: -1 });
  }

  if (datasets.length === 0) return;

  var ctx2 = canvas.getContext('2d');
  chartInstances.lamCurve = new Chart(ctx2, {
    type: 'line',
    data: { datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: function(item) { return !item.dataset.label.includes('Calculated'); },
          callbacks: {
            label: function(ctx) {
              var lbl  = ctx.dataset.label || '';
              var prec = getDisplayPrecision();
              if (lbl.includes('LAMINATE TOTAL')) return '▶ LAMINATE: ' + formatWithSigFigs(ctx.parsed.y, prec) + ' ' + getUnit();
              if (lbl.includes('(Fit)')) return lbl;
              return lbl + ': ' + formatWithSigFigs(ctx.parsed.y, prec) + ' ' + getUnit();
            }
          }
        }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Temperature (°C)', font: { size: 10, weight: '600' } },
             grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } },
        y: { title: { display: true, text: getLabel() + ' (' + unit + ')', font: { size: 10, weight: '600' } },
             beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' },
             ticks: { font: { size: 9 }, callback: function(v) { return formatWithSigFigs(v, getDisplayPrecision()); } } }
      }
    }
  });

  var legendEl = document.getElementById('lamCurveLegend');
  if (legendEl) {
    var html = '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;margin-top:0.8rem;">';
    for (var d = 0; d < datasets.length; d++) {
      var ds  = datasets[d];
      var txt = ds.label || '';
      if (txt.indexOf('Calculated') >= 0 || txt.indexOf('(Fit)') >= 0) continue;
      var col = ds.borderColor || ds.backgroundColor;
      if (!txt || !col) continue;
      html += '<div style="display:flex;align-items:center;gap:0.4rem;background:#fff;padding:0.35rem 0.6rem;border-radius:6px;border:1px solid var(--border);font-size:0.75rem;font-weight:500;color:var(--text);">' +
              '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + col + ';flex-shrink:0;"></span>' +
              '<span>' + txt + '</span></div>';
    }
    html += '</div>';
    legendEl.innerHTML = html;
  }
}

// ====================================================================
// 💧 CALC - HYGROSCOPIC TIME CHART
// ====================================================================
function drawHygroscopicTimeChart() {
  var canvas    = document.getElementById('hygroTimeChart');
  var hygroCard = document.getElementById('hygro-card');
  if (!canvas) return;
  destroyChart('hygroTime');

  var currentMode = State.mode || 'wvtr';
  var betaKey     = currentMode === 'wvtr' ? 'hygroscopicBetaWVTR' : 'hygroscopicBetaOTR';
  var refKey      = currentMode === 'wvtr' ? 'hygroscopicRefRHWVTR' : 'hygroscopicRefRHOTR';

  var hasHygro = State.layers.some(function(l) {
    if (l.mid === null) return false;
    var mat = DB.materials.find(function(m) { return m.id === l.mid; });
    if (!mat) return false;
    return (mat[betaKey] || mat.hygroscopicBeta || 0) > 0;
  });
  if (!hasHygro || !State.selCond) { if (hygroCard) hygroCard.style.display = 'none'; return; }

  var extRH      = State.selCond.humidity;
  var allSameRH  = true;
  for (var li2 = 0; li2 < State.layers.length; li2++) {
    var layer2 = State.layers[li2];
    if (!layer2.mid || layer2.thick <= 0) continue;
    var mat2 = DB.materials.find(function(m) { return m.id === layer2.mid; });
    if (!mat2 || !(mat2[betaKey] || 0)) continue;
    if (mat2.validConditions && mat2.validConditions.length > 0) {
      var bestCond = mat2.validConditions[0];
      var minD     = Math.abs(mat2.validConditions[0].temperature - State.selCond.temperature);
      for (var ci3 = 0; ci3 < mat2.validConditions.length; ci3++) {
        var d2 = Math.abs(mat2.validConditions[ci3].temperature - State.selCond.temperature);
        if (d2 < minD) { minD = d2; bestCond = mat2.validConditions[ci3]; }
      }
      if (Math.abs(bestCond.humidity - extRH) > 2) { allSameRH = false; break; }
    } else { allSameRH = false; break; }
  }
  if (allSameRH) { if (hygroCard) hygroCard.style.display = 'none'; return; }
  if (hygroCard) hygroCard.style.display = 'block';

  var diffusivityMap = {
    EVOH: 1.0e-14, PET: 3.0e-13, Nylon: 1.5e-12, PA: 1.5e-12,
    PVA:  2.0e-12, PP:  3.0e-11, PE:   8.0e-11,  default: 1.0e-12
  };

  var fixedResistance = 0;
  var hygroLayers     = [];
  for (var li = 0; li < State.layers.length; li++) {
    var layer = State.layers[li];
    if (!layer.mid || layer.thick <= 0) continue;
    var mat = DB.materials.find(function(m) { return m.id === layer.mid; });
    if (!mat) continue;
    var vals = Engine.getValues(mat);
    var idx  = -1;
    for (var ci = 0; ci < mat.validConditions.length; ci++) {
      if (Math.abs(mat.validConditions[ci].temperature - State.selCond.temperature) < 0.01 &&
          Math.abs(mat.validConditions[ci].humidity    - State.selCond.humidity)    < 0.01) { idx = ci; break; }
    }
    if (idx < 0) continue;
    var wd = vals[idx];
    if (!wd || wd.value <= 0.00001) continue;

    var modeBeta = mat[betaKey] || mat.hygroscopicBeta || 0;
    var modeRefRH = mat[refKey] || mat.hygroscopicRefRH || 50;

    if (modeBeta > 0) {
      var D_base = diffusivityMap[mat.family] || diffusivityMap['default'];
      var T_K    = State.selCond.temperature + 273.15;
      var Ea_h   = 45000, R_h = 8.314;
      var D_corr = D_base * Math.exp(-(Ea_h / R_h) * (1 / T_K - 1 / 298.15));
      var L_m    = layer.thick * 1e-6;
      var tau    = (Math.pow(L_m, 2) / (6 * D_corr)) / 86400;
      tau       /= (1 + (extRH / 100) * 1.5);

      var matTestRH = modeRefRH;
      if (mat.validConditions && mat.validConditions.length > 0) {
        var bm = mat.validConditions[0];
        var mD = Math.abs(mat.validConditions[0].temperature - State.selCond.temperature);
        for (var ci2 = 0; ci2 < mat.validConditions.length; ci2++) {
          var dif = Math.abs(mat.validConditions[ci2].temperature - State.selCond.temperature);
          if (dif < mD) { mD = dif; bm = mat.validConditions[ci2]; }
        }
        matTestRH = bm.humidity;
      }
      hygroLayers.push({ mat: mat, thickness: layer.thick, refValue: wd.value,
                         refThick: wd.thickness, beta: modeBeta, refRH: matTestRH, tau: tau });
    } else {
      var product = wd.value * wd.thickness;
      fixedResistance += layer.thick / product;
    }
  }

  var timePoints = [], wvtrPoints = [];
  if (hygroLayers.length === 0) {
    var baseWVTR = fixedResistance > 0.000001 ? 1 / fixedResistance : 0.000001;
    timePoints   = [0, 10, 20, 30];
    wvtrPoints   = [baseWVTR, baseWVTR, baseWVTR, baseWVTR];
  } else {
    var maxTau   = 0;
    for (var h = 0; h < hygroLayers.length; h++) if (hygroLayers[h].tau > maxTau) maxTau = hygroLayers[h].tau;
    var satTime  = Math.min(300, Math.ceil(maxTau * 3));
    if (satTime < 10) satTime = 10;
    var step     = Math.max(1, Math.floor(satTime / 30));
    for (var t = 0; t <= satTime; t += step) {
      var totalR = fixedResistance;
      for (var hi = 0; hi < hygroLayers.length; hi++) {
        var hl       = hygroLayers[hi];
        var rhAvg    = hl.refRH + (extRH - hl.refRH) * (1 - Math.exp(-t / hl.tau));
        var corrF    = Math.exp(hl.beta * (rhAvg - hl.refRH));
        var baseR    = hl.thickness / (hl.refValue * hl.refThick);
        totalR      += baseR / corrF;
      }
      timePoints.push(t);
      wvtrPoints.push(totalR > 0.000001 ? 1 / totalR : 0.000001);
    }
  }

  var initialWVTR  = wvtrPoints[0];
  var finalWVTR    = wvtrPoints[wvtrPoints.length - 1];
  var increasePct  = initialWVTR > 0 ? ((finalWVTR - initialWVTR) / initialWVTR * 100).toFixed(1) : 0;
  var yMax         = Math.max(initialWVTR, finalWVTR) * 1.5;
  if (yMax < 0.1) yMax = 0.1;

  var ctx = canvas.getContext('2d');
  chartInstances.hygroTime = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timePoints,
      datasets: [
        { label: 'Effective ' + getLabel() + ' (hygroscopic)',
          data: wvtrPoints, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)',
          fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
        { label: 'Initial (t=0)',
          data: new Array(timePoints.length).fill(initialWVTR),
          borderColor: '#22c55e', borderDash: [4, 3], pointRadius: 0, borderWidth: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 9 } } },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var prec = getDisplayPrecision();
              return ctx.dataset.label + ': ' + formatWithSigFigs(ctx.parsed.y, prec) + ' ' + getUnit();
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Days', font: { size: 10 } }, grid: { display: false } },
        y: { title: { display: true, text: getLabel() + ' (' + getUnit() + ')', font: { size: 10 } },
             beginAtZero: true, suggestedMax: yMax,
             ticks: { callback: function(v) { return formatWithSigFigs(v, getDisplayPrecision()); } } }
      }
    }
  });
}

// ====================================================================
// 🧪 ARRHENIUS - TEMPERATURE CHART
// ====================================================================
function drawArrTempChart(mat, r, isCustomEa) {
  destroyChart('arrTemp');
  var canvas = document.getElementById('arrTempCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  var ctx    = canvas.getContext('2d');
  var vals   = Engine.getValues(mat);
  var dataPoints = [];
  if (mat.validConditions && vals) {
    for (var i = 0; i < mat.validConditions.length; i++) {
      var cond = mat.validConditions[i], val = vals[i];
      if (cond && cond.temperature != null && val && val.value != null && val.value > 0)
        dataPoints.push({ x: cond.temperature, y: val.value });
    }
  }

  var datasets = [{
    label: 'Measured data', data: dataPoints,
    borderColor: '#ef4444', backgroundColor: '#ef4444',
    borderWidth: 0, pointRadius: 6, pointHoverRadius: 8, type: 'scatter', order: 1
  }];

  if (r && !r.error && r.A && r.Ea) {
    var curveData = [];
    var tMin4 = (r.minTemp || 20) - 10, tMax4 = (r.maxTemp || 50) + 10;
    for (var t = tMin4; t <= tMax4; t += 0.5) {
      var w = Engine.predict(r.A, r.Ea, t);
      if (w > 0 && isFinite(w)) curveData.push({ x: t, y: w });
    }
    datasets.push({ label: 'Arrhenius fit', data: curveData,
      borderColor: '#3b82f6', backgroundColor: 'transparent',
      borderWidth: 2, pointRadius: 0, type: 'line', order: 0 });
    if (r.targetTempC != null && r.predicted != null) {
      datasets.push({ label: 'Target: ' + r.targetTempC + ' → ' + r.predicted.toFixed(4),
        data: [{ x: r.targetTempC, y: r.predicted }],
        borderColor: '#22c55e', backgroundColor: '#22c55e',
        borderWidth: 0, pointRadius: 8, pointHoverRadius: 10, type: 'scatter', order: 0 });
    }
  }

  var isMobile = window.innerWidth < 480;
  var dpr      = Math.min(window.devicePixelRatio || 1, 2);
  chartInstances.arrTemp = new Chart(ctx, {
    type: 'line',
    data: { datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: dpr,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: isMobile ? 10 : 12, font: { size: isMobile ? 9 : 10 }, padding: isMobile ? 8 : 12 } },
        tooltip: { callbacks: { label: function(context) {
          var label = (context.dataset.label || '') + ': ';
          if (context.parsed.y !== null) label += context.parsed.y.toFixed(4) + ' ' + getUnit();
          return label;
        }}}
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Temperature (°C)', font: { size: isMobile ? 10 : 11 } },
             ticks: { font: { size: isMobile ? 9 : 10 } }, grid: { display: !isMobile } },
        y: { title: { display: true, text: getLabel() + ' (' + getUnit() + ')', font: { size: isMobile ? 10 : 11 } },
             beginAtZero: true, ticks: { font: { size: isMobile ? 9 : 10 }, callback: function(v) { return v.toFixed(3); } },
             grid: { display: !isMobile } }
      }
    }
  });
}

// ====================================================================
// 📉 ARRHENIUS - LINEAR PLOT (ln vs 1/T)
// ====================================================================
function drawArrLinChart(mat, r, isCustomEa) {
  destroyChart('arrLin');
  var canvas = document.getElementById('arrLinCanvas');
  if (!canvas || typeof Chart === 'undefined') return;
  var ctx = canvas.getContext('2d');

  if (!r || !r.dataPoints || r.dataPoints.length < 2 || !r.A || !r.Ea) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Need 2+ valid data points', canvas.clientWidth / 2, 140);
    return;
  }

  var dps        = r.dataPoints;
  var dataPoints = [];
  for (var i = 0; i < dps.length; i++) {
    if (dps[i].T_K > 0 && dps[i].trans > 0)
      dataPoints.push({ x: 1 / dps[i].T_K, y: Math.log(dps[i].trans) });
  }
  if (dataPoints.length < 2) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Need 2+ valid data points', canvas.clientWidth / 2, canvas.clientHeight / 2);
    return;
  }

  var slope     = -r.Ea / Engine.R_GAS;
  var intercept = Math.log(r.A);
  var minX2 = dataPoints[0].x, maxX2 = dataPoints[0].x;
  for (var d = 0; d < dataPoints.length; d++) {
    if (dataPoints[d].x < minX2) minX2 = dataPoints[d].x;
    if (dataPoints[d].x > maxX2) maxX2 = dataPoints[d].x;
  }
  minX2 *= 0.98; maxX2 *= 1.02;

  var isMobile = window.innerWidth < 480;
  var dpr      = Math.min(window.devicePixelRatio || 1, 2);
  chartInstances.arrLin = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Experimental', data: dataPoints,
          borderColor: '#ef4444', backgroundColor: '#ef4444',
          borderWidth: 0, pointRadius: 6, pointHoverRadius: 8, type: 'scatter', order: 1 },
        { label: 'Linear fit' + (isCustomEa ? ' (custom Eₐ)' : ''),
          data: [{ x: minX2, y: slope * minX2 + intercept }, { x: maxX2, y: slope * maxX2 + intercept }],
          borderColor: '#3b82f6', backgroundColor: 'transparent',
          borderWidth: 2, pointRadius: 0, type: 'line', order: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: dpr,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: isMobile ? 10 : 12, font: { size: isMobile ? 9 : 10 }, padding: isMobile ? 8 : 12 } } },
      scales: {
        x: { type: 'linear', title: { display: true, text: '1/T (K⁻¹)', font: { size: isMobile ? 10 : 11 } },
             ticks: { font: { size: isMobile ? 9 : 10 }, maxRotation: isMobile ? 45 : 0 }, grid: { display: !isMobile } },
        y: { title: { display: true, text: 'ln(' + getLabel() + ')', font: { size: isMobile ? 10 : 11 } },
             ticks: { font: { size: isMobile ? 9 : 10 } }, grid: { display: !isMobile } }
      }
    }
  });
}

function clearArrCanvas(id) {
  var c = document.getElementById(id);
  if (!c) return;
  destroyChart(id.replace('Canvas', ''));
  var ctx   = c.getContext('2d');
  var dpr   = window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio;
  var width = c.clientWidth || 500, height = c.clientHeight || 280;
  c.width = width * dpr; c.height = height * dpr;
  c.style.width = width + 'px'; c.style.height = height + 'px';
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#94a3b8'; ctx.font = window.innerWidth < 480 ? '11px sans-serif' : '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Select a multi-temp material', width / 2, height / 2);
}

// ====================================================================
// 📏 SENSITIVITY CHART
// ====================================================================
function drawSensitivityChart() {
  var canvas = document.getElementById('sensChart');
  if (!canvas) return;
  destroyChart('sens');

  var layerIdx = State.sensLayerIdx;
  var tMin     = parseFloat(document.getElementById('sens-tmin') ? document.getElementById('sens-tmin').value : '10');
  var tMax     = parseFloat(document.getElementById('sens-tmax') ? document.getElementById('sens-tmax').value : '500');

  if (!State.layers || State.layers.length === 0) { showSensitivityEmpty('Add layers in Calculator first'); return; }
  var common    = Engine.findCommonConditions(State.layers, DB.materials);
  if (common.error) { showSensitivityEmpty(common.error); return; }
  var condition = State.selCond || (common.conditions && common.conditions[0]) || { temperature: 25, humidity: 50 };
  var targetLayer = State.layers[layerIdx];
  if (!targetLayer || targetLayer.mid === null) { showSensitivityEmpty('Select a valid layer to vary'); return; }

  var result = Engine.calcSensitivityCurve(State.layers, DB.materials, condition, layerIdx, tMin, tMax, 80);
  if (result.error || !result.points || result.points.length === 0) { showSensitivityEmpty(result.error || 'No valid data points'); return; }
  if (result.points.every(function(p) { return p.total === 0; })) { showSensitivityEmpty('All calculated values are zero'); return; }

  var ctx    = canvas.getContext('2d');
  var labels = result.points.map(function(p) { return p.thickness.toFixed(0); });
  var vals   = result.points.map(function(p) { return parseFloat(p.total.toFixed(6)); });

  chartInstances.sens = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{ label: getLabel() + ' vs Layer ' + (layerIdx + 1) + ' thickness',
        data: vals, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Layer thickness (µm)' } },
        y: { title: { display: true, text: 'Total ' + getLabel() + ' (' + getUnit() + ')' },
             beginAtZero: true,
             ticks: { callback: function(v) { return v < 0.01 ? v.toExponential(2) : v.toFixed(4); } } }
      }
    }
  });
}

function showSensitivityEmpty(msg) {
  var canvas = document.getElementById('sensChart');
  if (!canvas) return;
  var ctx  = canvas.getContext('2d');
  var dpr  = window.devicePixelRatio || 1;
  canvas.width  = canvas.clientWidth  * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = '#94a3b8'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(msg || 'No data', canvas.clientWidth / 2, canvas.clientHeight / 2);
}

// ====================================================================
// 📚 LAMINATES DB CHART
// ====================================================================
function drawLamChart() {
  if (DB.laminates.length < 2) return;
  var canvas = document.getElementById('lamChart'); if (!canvas) return;
  destroyChart('lam');
  var ctx    = canvas.getContext('2d');
  var labels = [], vals = [], colors = [];
  for (var i = 0; i < DB.laminates.length; i++) {
    labels.push(DB.laminates[i].name);
    vals.push(DB.laminates[i].total);
    colors.push(LAYER_COLORS[i % LAYER_COLORS.length]);
  }
  chartInstances.lam = new Chart(ctx, {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: (DB.laminates[0].mode || State.mode).toUpperCase(),
              data: vals, backgroundColor: colors, borderRadius: 6 }] },
    options: { responsive: true, plugins: { legend: { display: false } },
               scales: { y: { beginAtZero: true, title: { display: true, text: getUnit() } },
                         x: { title: { display: true, text: 'Laminates' } } } }
  });
}
