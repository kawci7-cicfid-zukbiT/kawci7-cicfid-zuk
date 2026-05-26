// ====================================================================
// NAV PATCH — sostituisce renderNav() e aggiunge il sub-nav
// Incolla questo in home_patch.js oppure in un nuovo file nav.js
// caricato DOPO app.js in index.html
// ====================================================================

// Struttura navigazione a due livelli
var NAV_GROUPS = [
  { id: 'home', label: 'Home', tabs: [] },
  {
    id: 'analysis', label: 'Analysis',
    tabs: [
      { id: 'calc',        label: 'Calculator' },
      { id: 'sensitivity', label: 'Sensitivity' },
      { id: 'shelflife',   label: 'Shelf Life' },
      { id: 'arrhenius',   label: 'Arrhenius' },
      { id: 'compare',    label: 'Compare' }
    ]
  },
  {
    id: 'community', label: 'Community Database',
    tabs: [
      { id: 'materials',  label: 'Materials' },
      { id: 'laminates',  label: 'Laminates' }
    ]
  },
  {
    id: 'company', label: 'Company Database',
    tabs: [
      { id: 'mat-company', label: 'Materials' },
      { id: 'lam-company', label: 'Laminates' }
    ]
  }
];

// Trova il gruppo attivo dal tab corrente
function getActiveGroup() {
  if (State.tab === 'home') return 'home';
  for (var i = 0; i < NAV_GROUPS.length; i++) {
    var g = NAV_GROUPS[i];
    for (var j = 0; j < g.tabs.length; j++) {
      if (g.tabs[j].id === State.tab) return g.id;
    }
  }
  return 'analysis';
}

// Override renderNav
function renderNav() {
  var activeGroup = getActiveGroup();

  // Top nav — 4 voci
  var topHtml = '';
  for (var i = 0; i < NAV_GROUPS.length; i++) {
    var g = NAV_GROUPS[i];
    var isActive = g.id === activeGroup;
    topHtml += '<button class="nav-tab' + (isActive ? ' active' : '') +
      '" data-group="' + g.id + '" onclick="onGroupClick(\'' + g.id + '\')">' +
      (g.id === 'company' && CompanyState.isActive()
        ? '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:4px"></span>'
        : '') +
      g.label + '</button>';
  }
  document.getElementById('nav-tabs').innerHTML = topHtml;

  // Sub-nav — tab del gruppo attivo
  var subEl = document.getElementById('nav-subtabs');
  if (!subEl) return;

  var activeGroupObj = NAV_GROUPS.find(function(g){ return g.id === activeGroup; });
  if (!activeGroupObj || activeGroupObj.tabs.length === 0) {
    subEl.style.display = 'none';
    return;
  }

  subEl.style.display = 'flex';
  var subHtml = '';
  for (var j = 0; j < activeGroupObj.tabs.length; j++) {
    var tab = activeGroupObj.tabs[j];
    var isTabActive = State.tab === tab.id;
    subHtml += '<button class="nav-subtab' + (isTabActive ? ' active' : '') +
      '" onclick="onSubTabClick(\'' + tab.id + '\')">' + tab.label + '</button>';
  }
  subEl.innerHTML = subHtml;
}

function onGroupClick(groupId) {
  if (groupId === 'home') {
    State.tab = 'home';
    renderNav();
    renderContent();
    postNavRender();
    return;
  }
  var g = NAV_GROUPS.find(function(g){ return g.id === groupId; });
  if (!g || g.tabs.length === 0) return;
  // Se il tab corrente è già in questo gruppo, non cambiare
  var alreadyIn = g.tabs.some(function(t){ return t.id === State.tab; });
  if (!alreadyIn) {
    State.tab = g.tabs[0].id;
  }
  renderNav();
  renderContent();
  postNavRender();
}

function onSubTabClick(tabId) {
  State.tab = tabId;
  renderNav();
  renderContent();
  postNavRender();
}
