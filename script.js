// ═══════════════════════════════════════════════════════
// GreenCore — Greenhouse Automation Dashboard
// script.js
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════
// STATE
// ═══════════════════════════════════
let crops = [], selectedColor = '#4ade80', startTime = Date.now(), alertCount = 0, activeCropId = null;

// PRE-LOADED CROPS FROM CONFIG TABLE
const PRESET_CROPS = [
  { name: 'Tomato',      type: 'Vegetable', stage: 'Flowering',  tTemp: 24, tHum: 65, tCO2: 900,  zone: 'Zone-1', color: '#f87171' },
  { name: 'Lettuce',     type: 'Vegetable', stage: 'Seedling',   tTemp: 21, tHum: 65, tCO2: 800,  zone: 'Zone-2', color: '#4ade80' },
  { name: 'Cucumber',    type: 'Vegetable', stage: 'Vegetative', tTemp: 25, tHum: 70, tCO2: 950,  zone: 'Zone-3', color: '#2dd4bf' },
  { name: 'Bell Pepper', type: 'Vegetable', stage: 'Flowering',  tTemp: 23, tHum: 60, tCO2: 900,  zone: 'Zone-4', color: '#fb923c' },
  { name: 'Strawberry',  type: 'Fruit',     stage: 'Fruiting',   tTemp: 22, tHum: 75, tCO2: 850,  zone: 'Zone-5', color: '#f472b6' },
  { name: 'Cherry',      type: 'Fruit',     stage: 'Vegetative', tTemp: 20, tHum: 60, tCO2: 800,  zone: 'Zone-6', color: '#a78bfa' },
  { name: 'Watermelon',  type: 'Fruit',     stage: 'Flowering',  tTemp: 27, tHum: 70, tCO2: 1000, zone: 'Zone-7', color: '#fbbf24' },
  { name: 'Rose',        type: 'Flower',    stage: 'Seedling',   tTemp: 24, tHum: 65, tCO2: 900,  zone: 'Zone-8', color: '#e879f9' },
  { name: 'Gerbera',     type: 'Flower',    stage: 'Flowering',  tTemp: 22, tHum: 70, tCO2: 850,  zone: 'Zone-9', color: '#60a5fa' },
];

const cropDevices = {}, cropHistory = {}, cropLogs = {};
const HIST = 45, CPTS = 40;
const EMOJIS = { Vegetable: '🥦', Fruit: '🍅', Herb: '🌿', 'Leafy Green': '🥬', Flower: '🌸', 'Root Crop': '🥕', Grain: '🌾' };

let env = { temp: 24.3, hum: 68, co2: 820, light: 540 };
let gCtrl = { hvac: true, irr: true, light: false, co2: true };
let envTick = 0;

// Pre-fill cData with a wavy initial history so chart isn't flat from the start
let cData = {
  temp: Array.from({ length: CPTS }, (_, i) => 24 + Math.sin(i * 0.4) * 4 + Math.sin(i * 0.15) * 2 + (Math.random() - .5) * 1.5),
  hum:  Array.from({ length: CPTS }, (_, i) => 68 + Math.sin(i * 0.35 + 1) * 10 + Math.sin(i * 0.2 + 0.5) * 5 + (Math.random() - .5) * 2),
  co2:  Array.from({ length: CPTS }, (_, i) => 82 + Math.sin(i * 0.3 + 2) * 8 + Math.sin(i * 0.12) * 4 + (Math.random() - .5) * 2),
};

let spCtx = {};

// ═══════════════════════════════════
// CLOCK
// ═══════════════════════════════════
function tickClock() {
  document.getElementById('clockEl').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const u = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('statUptime').textContent =
    `${pad(Math.floor(u / 3600))}:${pad(Math.floor((u % 3600) / 60))}:${pad(u % 60)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
setInterval(tickClock, 1000);
tickClock();

// ═══════════════════════════════════
// ENV SIMULATION
// ═══════════════════════════════════
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function tickEnv() {
  envTick++;

  // Sine-wave oscillation: each metric has its own frequency + phase + noise
  const baseTemp  = 24 + Math.sin(envTick * 0.18) * 4 + Math.sin(envTick * 0.07 + 1) * 1.5;
  env.temp  = clamp(baseTemp  + (Math.random() - .5) * 1.2 + (gCtrl.hvac  ? -0.5 : 0.8),   15, 38);

  const baseHum   = 67 + Math.sin(envTick * 0.14 + 2) * 12 + Math.sin(envTick * 0.28 + 0.5) * 3;
  env.hum   = clamp(baseHum   + (Math.random() - .5) * 2   + (gCtrl.irr   ? 0.3 : -0.5),   30, 95);

  const baseCO2   = 820 + Math.sin(envTick * 0.11 + 1.5) * 80 + Math.sin(envTick * 0.22 + 3) * 30;
  env.co2   = clamp(baseCO2   + (Math.random() - .5) * 20  + (gCtrl.co2   ? 5 : -8),       350, 1800);

  const baseLight = 500 + Math.sin(envTick * 0.2 + 1) * 200 + Math.sin(envTick * 0.45) * 60;
  env.light = clamp(baseLight + (Math.random() - .5) * 30  + (gCtrl.light ? 80 : -30),       0, 1000);

  function sc(v, lo, hi) {
    return v < lo || v > hi ? (v < lo * 0.85 || v > hi * 1.15 ? 'alert' : 'warn') : 'ok';
  }

  setMet('sTemp',  env.temp.toFixed(1) + '°C',       'sTempB',  env.temp,  15,   38,   sc(env.temp,  18, 28));
  setMet('sHum',   env.hum.toFixed(0) + '%',          'sHumB',   env.hum,   30,   95,   sc(env.hum,   50, 80));
  setMet('sCO2',   Math.round(env.co2) + ' ppm',      'sCO2B',   env.co2,  350, 1800,   sc(env.co2,  600, 1200));
  setMet('sLight', Math.round(env.light),              'sLightB', env.light,  0, 1000,   sc(env.light, 200, 800));

  cData.temp.push(env.temp);
  cData.hum.push(env.hum);
  cData.co2.push(env.co2 / 10);
  if (cData.temp.length > CPTS) { cData.temp.shift(); cData.hum.shift(); cData.co2.shift(); }

  drawEnvChart();

  crops.forEach(c => {
    if (!cropHistory[c.id]) initHistory(c.id);
    const h = cropHistory[c.id];
    h.temp.push(env.temp + (Math.random() - .5) * .5);  if (h.temp.length > HIST) h.temp.shift();
    h.hum.push(env.hum  + (Math.random() - .5) * 1);    if (h.hum.length  > HIST) h.hum.shift();
    h.co2.push(env.co2  + (Math.random() - .5) * 10);   if (h.co2.length  > HIST) h.co2.shift();

    c.growth     = Math.min(100, c.growth + Math.random() * .02);
    c.waterLevel = Math.max(0, c.waterLevel - Math.random() * .05 + (cropDevices[c.id] && cropDevices[c.id].pump ? .25 : 0));

    const stress = Math.abs(env.temp - c.tTemp) / 5 + Math.abs(env.hum - c.tHum) / 30;
    c.health     = clamp(c.health - stress * .01 + (c.waterLevel > 20 ? .01 : -.05), 0, 100);
  });

  updateDashCards();
  updateStats();
  checkAlerts();
  if (activeCropId) refreshCropPage();
}
setInterval(tickEnv, 1200);

// ─── Load preset crops on startup ───
function loadPresetCrops() {
  PRESET_CROPS.forEach((p, i) => {
    const crop = {
      id:         Date.now() + i,
      name:       p.name,
      type:       p.type,
      stage:      p.stage,
      zone:       p.zone,
      color:      p.color,
      tTemp:      p.tTemp,
      tHum:       p.tHum,
      tCO2:       p.tCO2,
      health:     75 + Math.random() * 20,
      growth:     15 + Math.random() * 60,
      waterLevel: 45 + Math.random() * 45,
      addedAt:    'preloaded',
    };
    crops.push(crop);
    initHistory(crop.id);
    initDevices(crop.id);
    addLog(crop.id, '#4ade80', 'Crop zone loaded from configuration');
  });
  renderCropGrid();
  updateStats();
}
setTimeout(loadPresetCrops, 200);

function setMet(vi, v, bi, raw, mn, mx, cls) {
  const e = document.getElementById(vi); if (!e) return;
  e.textContent = v;
  e.className = 'met-val ' + cls;
  const b = document.getElementById(bi);
  if (b) b.style.width = clamp((raw - mn) / (mx - mn) * 100, 0, 100) + '%';
}

// ═══════════════════════════════════
// ENV CHART
// ═══════════════════════════════════
let envCvs, envCtx2;

function initEnvChart() {
  envCvs = document.getElementById('envChart');
  envCtx2 = envCvs.getContext('2d');
  envCvs.width = envCvs.offsetWidth;
  envCvs.height = 160;
}

function drawEnvChart() {
  if (!envCtx2) return;
  const W = envCvs.width, H = envCvs.height;
  envCtx2.clearRect(0, 0, W, H);

  // Grid lines
  envCtx2.strokeStyle = 'rgba(255,255,255,0.04)';
  envCtx2.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = H * i / 4;
    envCtx2.beginPath();
    envCtx2.moveTo(0, y);
    envCtx2.lineTo(W, y);
    envCtx2.stroke();
  }

  function drawLine(data, col, mn, mx) {
    if (data.length < 2) return;
    envCtx2.beginPath();
    envCtx2.strokeStyle = col;
    envCtx2.lineWidth = 2;
    envCtx2.shadowColor = col;
    envCtx2.shadowBlur = 7;
    data.forEach((v, i) => {
      const x = (i / (CPTS - 1)) * W;
      const y = H - ((v - mn) / (mx - mn)) * (H * .8) - H * .1;
      i ? envCtx2.lineTo(x, y) : envCtx2.moveTo(x, y);
    });
    envCtx2.stroke();
    envCtx2.shadowBlur = 0;

    // Gradient fill
    envCtx2.beginPath();
    data.forEach((v, i) => {
      const x = (i / (CPTS - 1)) * W;
      const y = H - ((v - mn) / (mx - mn)) * (H * .8) - H * .1;
      i ? envCtx2.lineTo(x, y) : envCtx2.moveTo(x, y);
    });
    envCtx2.lineTo(W, H);
    envCtx2.lineTo(0, H);
    envCtx2.closePath();

    const g = envCtx2.createLinearGradient(0, 0, 0, H);
    const r  = parseInt(col.slice(1, 3), 16);
    const g2 = parseInt(col.slice(3, 5), 16);
    const b  = parseInt(col.slice(5, 7), 16);
    g.addColorStop(0, `rgba(${r},${g2},${b},0.15)`);
    g.addColorStop(1, `rgba(${r},${g2},${b},0)`);
    envCtx2.fillStyle = g;
    envCtx2.fill();
  }

  // Dynamic min/max so waves fill the chart vertically
  const tMin = Math.min(...cData.temp) - 2, tMax = Math.max(...cData.temp) + 2;
  const hMin = Math.min(...cData.hum)  - 3, hMax = Math.max(...cData.hum)  + 3;
  const cMin = Math.min(...cData.co2)  - 2, cMax = Math.max(...cData.co2)  + 2;
  drawLine(cData.temp, '#4ade80', tMin, tMax);
  drawLine(cData.hum,  '#60a5fa', hMin, hMax);
  drawLine(cData.co2,  '#2dd4bf', cMin, cMax);
}

window.addEventListener('resize', () => {
  if (envCvs) { envCvs.width = envCvs.offsetWidth; drawEnvChart(); }
});
setTimeout(initEnvChart, 100);

// ═══════════════════════════════════
// CROP HELPERS
// ═══════════════════════════════════
function initHistory(id) {
  cropHistory[id] = {
    temp: Array.from({ length: HIST }, () => env.temp + (Math.random() - .5) * 2),
    hum:  Array.from({ length: HIST }, () => env.hum  + (Math.random() - .5) * 5),
    co2:  Array.from({ length: HIST }, () => env.co2  + (Math.random() - .5) * 30),
  };
}

function initDevices(id) {
  cropDevices[id] = { fan: false, heat: false, hum: false, co2: true, pump: false };
}

function addLog(id, color, text) {
  if (!cropLogs[id]) cropLogs[id] = [];
  cropLogs[id].unshift({ time: new Date().toLocaleTimeString('en-GB', { hour12: false }), text, color });
  if (cropLogs[id].length > 50) cropLogs[id].pop();
}

function statusInfo(c) {
  const d = Math.abs(env.temp - c.tTemp) + Math.abs(env.hum - c.tHum) / 10 + Math.abs(env.co2 - c.tCO2) / 100;
  if (d > 8) return ['Critical', 's-crit'];
  if (d > 3) return ['Warning',  's-warn'];
  return ['Optimal', 's-ok'];
}

function hc(c)   { return c.health > 75 ? '#4ade80' : c.health > 50 ? '#fbbf24' : '#f87171'; }
function tc(c)   { return Math.abs(env.temp - c.tTemp) > 4 ? 'var(--red)'  : Math.abs(env.temp - c.tTemp) > 2 ? 'var(--amber)' : 'var(--green)'; }
function huc(c)  { return Math.abs(env.hum  - c.tHum)  > 15 ? 'var(--red)' : Math.abs(env.hum  - c.tHum)  > 7 ? 'var(--amber)' : 'var(--blue)'; }
function co2c(c) { return Math.abs(env.co2  - c.tCO2)  > 300 ? 'var(--red)' : Math.abs(env.co2 - c.tCO2)  > 150 ? 'var(--amber)' : 'var(--teal)'; }

function growthNote(g)  { return g < 30 ? 'Early stage' : g < 60 ? 'Growing well' : g < 90 ? 'Nearly ready' : 'Ready to harvest!'; }
function healthNote(h)  { return h > 80 ? 'Excellent condition' : h > 60 ? 'Good — monitor' : 'Needs attention!'; }
function waterNote(w)   { return w > 60 ? 'Well hydrated' : w > 30 ? 'Adequate' : 'Low — needs water soon'; }

// ═══════════════════════════════════
// MODAL
// ═══════════════════════════════════
function openModal() {
  document.getElementById('iZone').value = 'Zone-' + (crops.length + 1);
  document.getElementById('addModal').classList.add('open');
}
function closeModal() {
  document.getElementById('addModal').classList.remove('open');
}
document.getElementById('addModal').addEventListener('click', e => {
  if (e.target === document.getElementById('addModal')) closeModal();
});
function pickColor(el) {
  document.querySelectorAll('.col-opt').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  selectedColor = el.dataset.c;
}

function addCrop() {
  const name = document.getElementById('iName').value.trim();
  if (!name) { document.getElementById('iName').style.borderColor = 'var(--red)'; return; }
  document.getElementById('iName').style.borderColor = '';

  const crop = {
    id:         Date.now(),
    name,
    type:       document.getElementById('iType').value,
    stage:      document.getElementById('iStage').value,
    zone:       document.getElementById('iZone').value || 'Zone-1',
    color:      selectedColor,
    tTemp:      parseFloat(document.getElementById('iTemp').value)  || 22,
    tHum:       parseFloat(document.getElementById('iHum').value)   || 65,
    tCO2:       parseFloat(document.getElementById('iCO2').value)   || 800,
    health:     70 + Math.random() * 30,
    growth:     10 + Math.random() * 50,
    waterLevel: 40 + Math.random() * 50,
    addedAt:    new Date().toLocaleTimeString('en-GB', { hour12: false }),
  };

  crops.push(crop);
  initHistory(crop.id);
  initDevices(crop.id);
  addLog(crop.id, '#4ade80', 'Crop zone created');
  renderCropGrid();
  closeModal();
  document.getElementById('iName').value = '';
}

// ═══════════════════════════════════
// DASHBOARD CROP GRID
// ═══════════════════════════════════
function renderCropGrid() {
  const grid = document.getElementById('cropGrid');
  document.getElementById('cropCountEl').textContent = `${crops.length} crop${crops.length !== 1 ? 's' : ''}`;

  if (crops.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><div class="empty-text">No crops yet.<br>Click "+ Add Crop" to begin.</div></div>`;
    return;
  }

  const empty = grid.querySelector('.empty-state');
  if (empty) empty.remove();

  crops.forEach(c => {
    if (!document.getElementById('cc-' + c.id)) {
      const d = document.createElement('div');
      d.innerHTML = makeCCHtml(c);
      grid.appendChild(d.firstElementChild);
    }
  });

  grid.querySelectorAll('.crop-card').forEach(el => {
    if (!crops.find(c => 'cc-' + c.id === el.id)) el.remove();
  });
}

function makeCCHtml(c) {
  const [st, sc] = statusInfo(c);
  return `<div class="crop-card" id="cc-${c.id}" onclick="openCropPage(${c.id})">
    <div class="cc-accent" style="background:${c.color}"></div>
    <div class="cc-body">
      <div class="cc-top">
        <div>
          <div class="cc-name">${c.name}</div>
          <div class="cc-meta">${c.type} · ${c.zone} · ${c.stage}</div>
        </div>
        <div class="${sc} status-pill" data-st>${st}</div>
      </div>
      <div class="mini-mets">
        <div class="mm"><div class="mm-lbl">Temp</div><div class="mm-val" data-t style="color:${tc(c)}">${env.temp.toFixed(1)}°</div></div>
        <div class="mm"><div class="mm-lbl">Hum</div><div class="mm-val" data-h style="color:${huc(c)}">${env.hum.toFixed(0)}%</div></div>
        <div class="mm"><div class="mm-lbl">CO₂</div><div class="mm-val" data-c style="color:${co2c(c)}">${Math.round(env.co2)}</div></div>
      </div>
      <div class="bar-row">
        <div class="bar-lbl"><span>Health</span><span data-hv>${c.health.toFixed(0)}%</span></div>
        <div class="mini-bar"><div class="mini-bar-fill" data-hb style="width:${c.health}%;background:${hc(c)}"></div></div>
      </div>
      <div class="bar-row">
        <div class="bar-lbl"><span>Water</span><span data-wv>${c.waterLevel.toFixed(0)}%</span></div>
        <div class="mini-bar"><div class="mini-bar-fill" data-wb style="width:${c.waterLevel}%;background:var(--blue)"></div></div>
      </div>
      <div class="cc-footer"><span>Added ${c.addedAt}</span><span class="hint">Tap for details →</span></div>
    </div>
  </div>`;
}

function updateDashCards() {
  crops.forEach(c => {
    const el = document.getElementById('cc-' + c.id); if (!el) return;
    const [st, sc] = statusInfo(c);
    el.querySelector('[data-st]').className = `${sc} status-pill`;
    el.querySelector('[data-st]').textContent = st;
    el.querySelector('[data-t]').textContent = env.temp.toFixed(1) + '°';
    el.querySelector('[data-t]').style.color = tc(c);
    el.querySelector('[data-h]').textContent = env.hum.toFixed(0) + '%';
    el.querySelector('[data-h]').style.color = huc(c);
    el.querySelector('[data-c]').textContent = Math.round(env.co2);
    el.querySelector('[data-c]').style.color = co2c(c);
    el.querySelector('[data-hv]').textContent = c.health.toFixed(0) + '%';
    el.querySelector('[data-hb]').style.width = c.health + '%';
    el.querySelector('[data-hb]').style.background = hc(c);
    el.querySelector('[data-wv]').textContent = c.waterLevel.toFixed(0) + '%';
    el.querySelector('[data-wb]').style.width = c.waterLevel + '%';
  });
}

// ═══════════════════════════════════
// STATS & ALERTS
// ═══════════════════════════════════
function updateStats() {
  document.getElementById('statCrops').textContent  = crops.length;
  document.getElementById('statHealth').textContent = crops.length
    ? (crops.reduce((s, c) => s + c.health, 0) / crops.length).toFixed(0) + '%'
    : '—';
  document.getElementById('statAlerts').textContent = alertCount;
}

function checkAlerts() {
  const a = [];
  if (env.temp > 32)  a.push(`High temp: ${env.temp.toFixed(1)}°C`);
  if (env.hum  > 88)  a.push(`Humidity: ${env.hum.toFixed(0)}%`);
  if (env.co2  > 1500) a.push(`CO₂ spike: ${Math.round(env.co2)} ppm`);
  crops.forEach(c => { if (c.health < 30) a.push(`${c.name}: Low health`); });
  alertCount = a.length;

  const bar = document.getElementById('alertBar');
  if (a.length) {
    bar.classList.add('show');
    document.getElementById('alertTxt').textContent = a[0] + (a.length > 1 ? ` (+${a.length - 1} more)` : '');
  } else {
    bar.classList.remove('show');
  }
}

function dashToggle(btn, k) {
  btn.classList.toggle('active');
  gCtrl[k] = btn.classList.contains('active');
}

// ═══════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════
function openCropPage(cropId) {
  const c = crops.find(x => x.id === cropId); if (!c) return;
  activeCropId = cropId;
  addLog(cropId, '#4ade80', 'Opened crop detail page');
  document.getElementById('cpHdrName').textContent = c.name;
  buildCropPage(c);
  // Slide: dashboard slides left, crop page slides in from right
  document.getElementById('dashPage').classList.add('slide-out');
  document.getElementById('cropPage').classList.add('slide-in');
  document.body.style.overflow = 'hidden';
  setTimeout(() => initSparklines(c), 150);
}

function goBack() {
  document.getElementById('dashPage').classList.remove('slide-out');
  document.getElementById('cropPage').classList.remove('slide-in');
  activeCropId = null;
  spCtx = {};
}

// ═══════════════════════════════════
// BUILD CROP DETAIL PAGE
// ═══════════════════════════════════
function buildCropPage(c) {
  const emoji = EMOJIS[c.type] || '🌱';
  const [st, sc] = statusInfo(c);

  document.getElementById('cpBody').innerHTML = `
    <!-- HERO -->
    <div class="cp-hero" style="border-left:4px solid ${c.color}">
      <div class="cp-hero-glow" style="background:${c.color}"></div>
      <div class="cp-hero-row">
        <div class="cp-hero-left">
          <div class="cp-emoji">${emoji}</div>
          <div>
            <div class="cp-name" style="color:${c.color}">${c.name}</div>
            <div class="cp-meta-txt">Zone ${c.zone} · Added ${c.addedAt}</div>
            <div class="cp-badges">
              <span class="cp-badge bd-type">${c.type}</span>
              <span class="cp-badge bd-zone">${c.zone}</span>
              <span class="cp-badge bd-stage">${c.stage}</span>
            </div>
          </div>
        </div>
        <div class="${sc} status-pill" id="cpStatusEl" style="font-size:0.75rem;padding:7px 16px;">${st}</div>
      </div>
    </div>

    <!-- LIVE SENSORS -->
    <div class="cp-sec">Live Sensor Readings</div>
    <div class="sensor-grid">
      <div class="sensor-card" onclick="showSensorChart(${c.id},'temp')">
        <div class="sc-stripe" style="background:#f87171"></div>
        <div class="sc-icon">🌡</div>
        <div class="sc-label">Temperature</div>
        <div class="sc-value" id="sv-temp" style="color:#f87171">${env.temp.toFixed(1)}°C</div>
        <div class="sc-tgt">Target ${c.tTemp}°C <span class="sc-diff" id="sd-temp"></span></div>
        <div class="sc-spark"><canvas class="spark" id="sp-temp"></canvas></div>
      </div>
      <div class="sensor-card" onclick="showSensorChart(${c.id},'hum')">
        <div class="sc-stripe" style="background:#60a5fa"></div>
        <div class="sc-icon">💧</div>
        <div class="sc-label">Humidity</div>
        <div class="sc-value" id="sv-hum" style="color:#60a5fa">${env.hum.toFixed(0)}%</div>
        <div class="sc-tgt">Target ${c.tHum}% <span class="sc-diff" id="sd-hum"></span></div>
        <div class="sc-spark"><canvas class="spark" id="sp-hum"></canvas></div>
      </div>
      <div class="sensor-card" onclick="showSensorChart(${c.id},'co2')">
        <div class="sc-stripe" style="background:#2dd4bf"></div>
        <div class="sc-icon">🌿</div>
        <div class="sc-label">CO₂ Level</div>
        <div class="sc-value" id="sv-co2" style="color:#2dd4bf">${Math.round(env.co2)} ppm</div>
        <div class="sc-tgt">Target ${c.tCO2} ppm <span class="sc-diff" id="sd-co2"></span></div>
        <div class="sc-spark"><canvas class="spark" id="sp-co2"></canvas></div>
      </div>
    </div>

    <!-- PLANT STATUS -->
    <div class="cp-sec">Plant Status</div>
    <div class="sb-grid">
      <div class="sb-card">
        <div class="sb-top"><div class="sb-lbl">🌱 Growth</div><div class="sb-val" id="sv-gr" style="color:${c.color}">${c.growth.toFixed(1)}%</div></div>
        <div class="sb-bar"><div class="sb-fill" id="sb-grb" style="width:${c.growth}%;background:${c.color}"></div></div>
        <div class="sb-note" id="sn-gr">${growthNote(c.growth)}</div>
      </div>
      <div class="sb-card">
        <div class="sb-top"><div class="sb-lbl">❤ Health</div><div class="sb-val" id="sv-hl" style="color:${hc(c)}">${c.health.toFixed(1)}%</div></div>
        <div class="sb-bar"><div class="sb-fill" id="sb-hlb" style="width:${c.health}%;background:${hc(c)}"></div></div>
        <div class="sb-note" id="sn-hl">${healthNote(c.health)}</div>
      </div>
      <div class="sb-card">
        <div class="sb-top"><div class="sb-lbl">💧 Water</div><div class="sb-val" id="sv-wl" style="color:#60a5fa">${c.waterLevel.toFixed(1)}%</div></div>
        <div class="sb-bar"><div class="sb-fill" id="sb-wlb" style="width:${c.waterLevel}%;background:#60a5fa"></div></div>
        <div class="sb-note" id="sn-wl">${waterNote(c.waterLevel)}</div>
      </div>
    </div>

    <!-- CONTROL SYSTEM ACTIONS -->
    <div class="cp-sec">Control System Actions</div>
    <div class="dev-grid">
      ${devCardHtml(c.id, 'fan',  '🌀', 'Cooling Fan',   'Reduces temperature & improves air circulation', 'fan',  false)}
      ${devCardHtml(c.id, 'heat', '🔥', 'Heater',        'Raises ambient temp during cold cycles',         'heat', false)}
      ${devCardHtml(c.id, 'hum',  '💧', 'Humidifier',    'Maintains moisture for optimal transpiration',   'hum',  false)}
      ${devCardHtml(c.id, 'co2',  '🌿', 'CO₂ Injector', 'Enriches atmosphere to boost photosynthesis',    'co2',  true)}
      ${devCardHtml(c.id, 'pump', '⛽', 'Water Pump',    'Drives drip irrigation & nutrient delivery',     'pump', false)}
    </div>

    <!-- QUICK ACTIONS -->
    <div class="cp-sec">Quick Actions</div>
    <div class="qa-row">
      <button class="qa-btn water" onclick="cpWater(${c.id})">💧 Water Now</button>
      <button class="qa-btn fert"  onclick="cpFertilize(${c.id})">🌿 Fertilize</button>
      <button class="qa-btn del"   onclick="cpDelete(${c.id})">✕ Remove Crop</button>
    </div>

    <!-- ACTIVITY LOG -->
    <div class="cp-sec">Activity Log</div>
    <div class="act-log">
      <div class="act-list" id="actList-${c.id}"></div>
    </div>
  `;

  renderLog(c.id);
}

// ─── Device card HTML ───
function devCardHtml(cropId, key, icon, name, desc, cls, startOn) {
  const on = cropDevices[cropId] ? cropDevices[cropId][key] : startOn;
  return `<div class="dev-card ${cls}${on ? ' on' : ''}" id="dev-${cropId}-${key}">
    <div class="dc-top">
      <div class="dc-icon">${icon}</div>
      <label class="tgl ${cls}">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="toggleDev(${cropId},'${key}',this)">
        <div class="tgl-track"></div>
        <div class="tgl-thumb"></div>
      </label>
    </div>
    <div class="dc-name">${name}</div>
    <div class="dc-desc">${desc}</div>
    <div class="dc-status">
      <div class="dc-dot"></div>
      <span class="dc-stat-txt" id="dstat-${cropId}-${key}">${on ? liveDevText(key) : 'Idle — standby'}</span>
    </div>
  </div>`;
}

function liveDevText(k) {
  return {
    fan:  `Cooling — ${env.temp.toFixed(1)}°C`,
    heat: `Heating — ${env.temp.toFixed(1)}°C`,
    hum:  `Misting — ${env.hum.toFixed(0)}%`,
    co2:  `Injecting — ${Math.round(env.co2)} ppm`,
    pump: 'Pumping — irrigation active',
  }[k] || 'Running';
}

function toggleDev(cropId, key, chk) {
  if (!cropDevices[cropId]) return;
  cropDevices[cropId][key] = chk.checked;
  const card = document.getElementById(`dev-${cropId}-${key}`);
  const stat = document.getElementById(`dstat-${cropId}-${key}`);
  const cols = { fan: '#60a5fa', heat: '#f87171', hum: '#2dd4bf', co2: '#4ade80', pump: '#fbbf24' };
  if (chk.checked) {
    card.classList.add('on');
    stat.textContent = liveDevText(key);
    addLog(cropId, cols[key] || '#4ade80', `${key.charAt(0).toUpperCase() + key.slice(1)} turned ON`);
  } else {
    card.classList.remove('on');
    stat.textContent = 'Idle — standby';
    addLog(cropId, '#7a9a7a', `${key.charAt(0).toUpperCase() + key.slice(1)} turned OFF`);
  }
  renderLog(cropId);
}

// ═══════════════════════════════════
// SPARKLINES
// ═══════════════════════════════════
function initSparklines(c) {
  ['temp', 'hum', 'co2'].forEach(m => {
    const cv = document.getElementById('sp-' + m); if (!cv) return;
    cv.width = cv.offsetWidth || 300;
    cv.height = 46;
    spCtx[m] = cv.getContext('2d');
  });
}

function drawSpark(ctx, data, hex) {
  if (!ctx || data.length < 2) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const sy = v => H - ((v - mn) / rng) * (H * .8) - H * .1;

  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * W;
    i ? ctx.lineTo(x, sy(v)) : ctx.moveTo(x, sy(v));
  });
  ctx.strokeStyle = hex;
  ctx.lineWidth = 2;
  ctx.shadowColor = hex;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  const g  = ctx.createLinearGradient(0, 0, 0, H);
  const r  = parseInt(hex.slice(1, 3), 16);
  const g2 = parseInt(hex.slice(3, 5), 16);
  const b  = parseInt(hex.slice(5, 7), 16);
  g.addColorStop(0, `rgba(${r},${g2},${b},0.25)`);
  g.addColorStop(1, `rgba(${r},${g2},${b},0)`);
  ctx.fillStyle = g;
  ctx.fill();
}

// ═══════════════════════════════════
// REFRESH CROP PAGE (every tick)
// ═══════════════════════════════════
function refreshCropPage() {
  const c = crops.find(x => x.id === activeCropId); if (!c) return;
  const h = cropHistory[c.id]; if (!h) return;

  // Sparklines
  drawSpark(spCtx['temp'], h.temp, '#f87171');
  drawSpark(spCtx['hum'],  h.hum,  '#60a5fa');
  drawSpark(spCtx['co2'],  h.co2,  '#2dd4bf');

  // Live values
  const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  s('sv-temp', env.temp.toFixed(1) + '°C');
  s('sv-hum',  env.hum.toFixed(0)  + '%');
  s('sv-co2',  Math.round(env.co2) + ' ppm');

  // Diffs
  function setDiff(id, val, unit, thresh) {
    const e = document.getElementById(id); if (!e) return;
    const n = parseFloat(val);
    e.textContent = (n >= 0 ? '+' : '') + val + unit;
    e.style.cssText = `padding:2px 8px;border-radius:3px;font-size:0.58rem;font-weight:700;` +
      `background:${Math.abs(n) < thresh ? 'rgba(74,222,128,0.15)' : Math.abs(n) < thresh * 2 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)'};` +
      `color:${Math.abs(n) < thresh ? '#4ade80' : Math.abs(n) < thresh * 2 ? '#fbbf24' : '#f87171'};`;
  }
  setDiff('sd-temp', (env.temp - c.tTemp).toFixed(1),          '°',    2);
  setDiff('sd-hum',  (env.hum  - c.tHum).toFixed(0),           '%',    8);
  setDiff('sd-co2',  String(Math.round(env.co2 - c.tCO2)),     ' ppm', 100);

  // Progress
  const hcol = hc(c);
  s('sv-gr', c.growth.toFixed(1) + '%');
  s('sv-hl', c.health.toFixed(1) + '%');
  s('sv-wl', c.waterLevel.toFixed(1) + '%');
  s('sn-gr', growthNote(c.growth));
  s('sn-hl', healthNote(c.health));
  s('sn-wl', waterNote(c.waterLevel));

  const sb = (id, w, bg) => {
    const e = document.getElementById(id);
    if (e) { e.style.width = w + '%'; if (bg) e.style.background = bg; }
  };
  sb('sb-grb', c.growth,     c.color);
  sb('sb-hlb', c.health,     hcol);
  sb('sb-wlb', c.waterLevel, '#60a5fa');
  document.getElementById('sv-hl').style.color = hcol;

  // Status pill
  const [st, sc] = statusInfo(c);
  const sp = document.getElementById('cpStatusEl');
  if (sp) { sp.className = `${sc} status-pill`; sp.style.cssText = 'font-size:0.75rem;padding:7px 16px;'; sp.textContent = st; }

  // Device live text
  ['fan', 'heat', 'hum', 'co2', 'pump'].forEach(k => {
    if (cropDevices[c.id] && cropDevices[c.id][k]) {
      const e = document.getElementById(`dstat-${c.id}-${k}`);
      if (e) e.textContent = liveDevText(k);
    }
  });
}

// ═══════════════════════════════════
// QUICK ACTIONS
// ═══════════════════════════════════
function cpWater(id) {
  const c = crops.find(x => x.id === id);
  if (c) { c.waterLevel = Math.min(100, c.waterLevel + 20); addLog(id, '#60a5fa', 'Manual irrigation — +20% water'); renderLog(id); }
}

function cpFertilize(id) {
  const c = crops.find(x => x.id === id);
  if (c) { c.health = Math.min(100, c.health + 10); addLog(id, '#4ade80', 'Fertilizer applied — +10% health'); renderLog(id); }
}

function cpDelete(id) {
  if (!confirm('Remove this crop zone?')) return;
  crops = crops.filter(c => c.id !== id);
  renderCropGrid();
  updateStats();
  goBack();
}

function renderLog(id) {
  const el = document.getElementById('actList-' + id); if (!el) return;
  const logs = cropLogs[id] || [];
  el.innerHTML = logs.length === 0
    ? `<div class="act-item"><span class="act-text" style="color:var(--text-muted)">No activity yet.</span></div>`
    : logs.map(l =>
        `<div class="act-item">
          <div class="act-dot" style="background:${l.color}"></div>
          <span class="act-time">${l.time}</span>
          <span class="act-text">${l.text}</span>
        </div>`
      ).join('');
}

// ═══════════════════════════════════
// SENSOR CHART POPUP
// ═══════════════════════════════════
function showSensorChart(cropId, metric) {
  const c = crops.find(x => x.id === cropId); if (!c) return;
  const h = cropHistory[cropId]; if (!h) return;
  const data   = h[metric];
  const target = metric === 'temp' ? c.tTemp : metric === 'hum' ? c.tHum : c.tCO2;
  const unit   = metric === 'temp' ? '°C'    : metric === 'hum' ? '%'    : ' ppm';
  const col    = metric === 'temp' ? '#f87171' : metric === 'hum' ? '#60a5fa' : '#2dd4bf';
  const lbl    = metric === 'temp' ? 'Temperature' : metric === 'hum' ? 'Humidity' : 'CO₂';
  const cur    = data[data.length - 1];
  const mn = Math.min(...data), mx = Math.max(...data);
  const th = {
    lo: target - (metric === 'temp' ? 3 : metric === 'hum' ? 10 : 150),
    hi: target + (metric === 'temp' ? 3 : metric === 'hum' ? 10 : 150),
  };

  let ov = document.getElementById('sChartOv');
  if (!ov) { ov = document.createElement('div'); ov.id = 'sChartOv'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);z-index:400;display:flex;align-items:center;justify-content:center;';
  ov.onclick = e => { if (e.target === ov) ov.style.display = 'none'; };

  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.75rem;width:540px;max-width:96vw;position:relative;">
      <button onclick="document.getElementById('sChartOv').style.display='none'"
        style="position:absolute;top:1rem;right:1rem;width:30px;height:30px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text-dim);cursor:pointer;font-size:1rem;">✕</button>
      <div style="font-family:'Space Mono',monospace;font-size:0.58rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">${c.name} · ${lbl}</div>
      <div style="font-family:'Space Mono',monospace;font-size:2rem;font-weight:700;color:${col};margin-bottom:1.25rem;">${metric === 'temp' ? cur.toFixed(1) : Math.round(cur)}${unit}</div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:1rem;">
        <canvas id="sDetailCvs" style="width:100%;height:190px;display:block;"></canvas>
      </div>
      <div style="display:flex;gap:1.5rem;font-family:'Space Mono',monospace;font-size:0.62rem;flex-wrap:wrap;margin-bottom:1rem;">
        <span style="color:var(--text-dim)">Target: <b style="color:${col}">${target}${unit}</b></span>
        <span style="color:var(--text-dim)">Min: <b style="color:var(--text)">${metric === 'temp' ? mn.toFixed(1) : Math.round(mn)}${unit}</b></span>
        <span style="color:var(--text-dim)">Max: <b style="color:var(--text)">${metric === 'temp' ? mx.toFixed(1) : Math.round(mx)}${unit}</b></span>
      </div>
      <div style="display:flex;gap:1rem;font-family:'Space Mono',monospace;font-size:0.58rem;flex-wrap:wrap;">
        <span style="color:var(--text-dim);display:flex;align-items:center;gap:6px;"><span style="width:14px;height:4px;border-radius:2px;background:#4ade80;display:inline-block;"></span>Optimal</span>
        <span style="color:var(--text-dim);display:flex;align-items:center;gap:6px;"><span style="width:14px;height:4px;border-radius:2px;background:#f87171;display:inline-block;"></span>Too high</span>
        <span style="color:var(--text-dim);display:flex;align-items:center;gap:6px;"><span style="width:14px;height:4px;border-radius:2px;background:#60a5fa;display:inline-block;"></span>Cooling active</span>
      </div>
    </div>`;

  setTimeout(() => {
    const cv = document.getElementById('sDetailCvs');
    cv.width = cv.offsetWidth || 480;
    cv.height = 190;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const mn2 = Math.min(...data) - (metric === 'co2' ? 30 : 2);
    const mx2 = Math.max(...data) + (metric === 'co2' ? 30 : 2);
    const sy = v => H - ((v - mn2) / (mx2 - mn2)) * (H * .8) - H * .1;

    // Optimal zone
    ctx.fillStyle = 'rgba(74,222,128,0.05)';
    const y1 = sy(Math.min(th.hi, mx2));
    const y2 = sy(Math.max(th.lo, mn2));
    ctx.fillRect(0, y1, W, y2 - y1);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = H * i / 5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Target line
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(74,222,128,0.3)';
    ctx.lineWidth = 1.5;
    const ty = sy(target);
    ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(74,222,128,0.7)';
    ctx.font = '9px monospace';
    ctx.fillText('Target: ' + target + unit, 6, ty - 4);

    // Segmented colour line
    const mid = th.lo + (th.hi - th.lo) * .5;
    for (let i = 1; i < data.length; i++) {
      const x0 = ((i - 1) / (data.length - 1)) * W;
      const x1 =  (i       / (data.length - 1)) * W;
      const v  = data[i];
      const lc = v > th.hi ? '#f87171' : v > mid ? '#60a5fa' : v < th.lo ? '#60a5fa' : '#4ade80';
      ctx.beginPath();
      ctx.strokeStyle = lc;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = lc;
      ctx.shadowBlur = 6;
      ctx.moveTo(x0, sy(data[i - 1]));
      ctx.lineTo(x1, sy(v));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Live dot
    const lx = W, ly = sy(data[data.length - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, 60);
}

// ═══════════════════════════════════════════════════════
// SMART AUTO-CORRECTION ENGINE
// Checks every 30 minutes. No UI popups. Logs to activity only.
// ═══════════════════════════════════════════════════════
const activeAlarms   = {};
const ALARM_THRESH   = { temp: 4,   hum: 12,  co2: 200, water: 25 };
const CORRECT_SPEED  = { temp: 0.5, hum: 1.0, co2: 18,  water: 2  };
const AUTO_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function metricLabel(m) { return { temp: 'Temperature', hum: 'Humidity', co2: 'CO₂ Level', water: 'Water Level' }[m] || m; }
function fmtVal(m, v)   { return m === 'temp' ? v.toFixed(1) : Math.round(v); }

function autoActionLabel(metric, isHigh) {
  return ({
    'temp-high':  'Cooling Fan activated',
    'temp-low':   'Heater activated',
    'hum-high':   'Fan + Dehumidifier activated',
    'hum-low':    'Humidifier activated',
    'co2-high':   'CO₂ Injector paused',
    'co2-low':    'CO₂ Injector activated',
    'water-low':  'Water Pump activated',
  })[metric + '-' + (isHigh ? 'high' : 'low')] || 'System correction applied';
}

function runAutoCorrection() {
  const now = Date.now();
  crops.forEach(c => {
    const h = cropHistory[c.id]; if (!h) return;
    const curTemp  = h.temp.length  ? h.temp[h.temp.length - 1]  : env.temp;
    const curHum   = h.hum.length   ? h.hum[h.hum.length - 1]    : env.hum;
    const curCO2   = h.co2.length   ? h.co2[h.co2.length - 1]    : env.co2;
    const curWater = c.waterLevel;

    [
      { metric: 'temp',  current: curTemp,  target: c.tTemp, unit: '°C'   },
      { metric: 'hum',   current: curHum,   target: c.tHum,  unit: '%'    },
      { metric: 'co2',   current: curCO2,   target: c.tCO2,  unit: ' ppm' },
      { metric: 'water', current: curWater, target: 50,       unit: '%'    },
    ].forEach(({ metric, current, target, unit }) => {
      const key    = c.id + '-' + metric;
      const diff   = current - target;
      const isHigh = diff >   ALARM_THRESH[metric];
      const isLow  = diff < -(ALARM_THRESH[metric]);
      const lastT  = activeAlarms[key] || 0;
      const cooldownOk = (now - lastT) >= AUTO_INTERVAL_MS;

      if ((isHigh || isLow) && cooldownOk) {
        activeAlarms[key] = now;
        const dir = isHigh ? 'too high' : 'too low';
        addLog(c.id, '#fbbf24',
          `⚠ AUTO-ALARM: ${metricLabel(metric)} ${dir} (${fmtVal(metric, current)}${unit}, target ${target}${unit})`);
        autoCorrect(c, metric, isHigh);
        addLog(c.id, '#4ade80',
          `✓ AUTO-FIX: ${autoActionLabel(metric, isHigh)} — restoring to ${target}${unit}`);
        if (activeCropId === c.id) renderLog(c.id);

      } else if (!isHigh && !isLow && activeAlarms[key]) {
        delete activeAlarms[key];
        addLog(c.id, '#4ade80',
          `✓ RESOLVED: ${metricLabel(metric)} back to normal (${fmtVal(metric, current)}${unit})`);
        if (activeCropId === c.id) renderLog(c.id);
      }

      // Continuous gentle correction while out of range
      if (isHigh || isLow) autoCorrect(c, metric, isHigh);
    });
  });
}

function autoCorrect(crop, metric, isHigh) {
  const spd = CORRECT_SPEED[metric];
  const dev  = cropDevices[crop.id];
  const h    = cropHistory[crop.id];
  if (!dev || !h) return;

  if (metric === 'temp') {
    if (isHigh) { dev.fan = true;  dev.heat = false; h.temp = h.temp.map(v => Math.max(crop.tTemp - 0.5, v - spd * 0.25)); }
    else        { dev.heat = true; dev.fan = false;  h.temp = h.temp.map(v => Math.min(crop.tTemp + 0.5, v + spd * 0.25)); }
  } else if (metric === 'hum') {
    if (isHigh) { dev.fan = true;  h.hum = h.hum.map(v => Math.max(crop.tHum - 1, v - spd * 0.2)); }
    else        { dev.hum = true;  h.hum = h.hum.map(v => Math.min(crop.tHum + 1, v + spd * 0.2)); }
  } else if (metric === 'co2') {
    if (isHigh) { dev.co2 = false; h.co2 = h.co2.map(v => Math.max(crop.tCO2 - 10, v - spd * 0.4)); }
    else        { dev.co2 = true;  h.co2 = h.co2.map(v => Math.min(crop.tCO2 + 10, v + spd * 0.4)); }
  } else if (metric === 'water') {
    if (!isHigh) { dev.pump = true; crop.waterLevel = Math.min(100, crop.waterLevel + spd); }
  }

  // Sync device UI if on this crop's page
  if (activeCropId === crop.id) syncDeviceUI(crop.id);
}

function syncDeviceUI(cropId) {
  ['fan', 'heat', 'hum', 'co2', 'pump'].forEach(key => {
    const card = document.getElementById('dev-' + cropId + '-' + key);
    const chk  = card ? card.querySelector('input[type=checkbox]') : null;
    const stat = document.getElementById('dstat-' + cropId + '-' + key);
    if (!card || !chk) return;
    const on = cropDevices[cropId][key];
    chk.checked = on;
    if (on) { card.classList.add('on'); if (stat) stat.textContent = liveDevText(key); }
    else    { card.classList.remove('on'); if (stat) stat.textContent = 'Idle — standby'; }
  });
}

// Run auto-correction every ~3s; alarm log only fires after 30 min cooldown per metric per crop
setInterval(runAutoCorrection, 3600);
