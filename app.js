let rows = [];
let densityRows = [];
let activeTank = 1;
let currentCalculation = null;
let historyDateFilter = localDateString();
const tanks = [1, 2, 3, 4];
const HISTORY_KEY = "oilSoundingHistoryV1";
const SUPABASE_CONFIG = window.SUPABASE_CONFIG || { url: "", anonKey: "" };
const CLOUD_HISTORY_ENABLED = Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
const tankState = {
  1: { ullage: 0, t1: 0, t2: 0, t3: 0 },
  2: { ullage: 0, t1: 0, t2: 0, t3: 0 },
  3: { ullage: 0, t1: 0, t2: 0, t3: 0 },
  4: { ullage: 0, t1: 0, t2: 0, t3: 0 }
};

const $ = id => document.getElementById(id);

function fmt(n, d = 3) {
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "-";
}

function numeric(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (v == null || v === "") return NaN;
  const s = String(v).trim().replace(/\s/g, "");
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return Number(s.replace(/\./g, "").replace(",", "."));
}

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localTimeString(date = new Date()) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
}

function getLocalHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    data.forEach(r => {
      if (!r.signature) r.signature = [r.date, r.tank, r.ullage, r.t1, r.t2, r.t3].join("|");
    });
    return data;
  } catch {
    return [];
  }
}

function setLocalHistory(data) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
}

async function cloudRequest(path, options = {}) {
  const headers = {
    apikey: SUPABASE_CONFIG.anonKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const res = await fetch(`${SUPABASE_CONFIG.url.replace(/\/$/, "")}/rest/v1/${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Supabase error ${res.status}`;
    try { const body = await res.json(); message = body.message || body.hint || body.error || message; } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function getHistory() {
  if (!CLOUD_HISTORY_ENABLED) return getLocalHistory();
  try {
    return await cloudRequest("sounding_history?select=*&order=date.desc,time.desc,created_at.desc");
  } catch (e) {
    console.error(e);
    showCloudStatus(`⚠️ Database tidak dapat diakses: ${e.message}. Menggunakan history lokal.`, false);
    return getLocalHistory();
  }
}

async function saveHistoryRecord(record) {
  if (!CLOUD_HISTORY_ENABLED) {
    const history = getLocalHistory();
    history.push(record);
    history.sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    setLocalHistory(history);
    return record;
  }
  const existing = await cloudRequest(`sounding_history?signature=eq.${encodeURIComponent(record.signature)}&select=*`);
  if (existing.length) return { existing: true, record: existing[0] };
  const inserted = await cloudRequest("sounding_history", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(record)
  });
  return { existing: false, record: inserted[0] };
}

async function deleteHistoryRecord(id) {
  if (!CLOUD_HISTORY_ENABLED) {
    setLocalHistory(getLocalHistory().filter(r => r.id !== id));
    return;
  }
  await cloudRequest(`sounding_history?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function clearHistoryRecords() {
  if (!CLOUD_HISTORY_ENABLED) {
    localStorage.removeItem(HISTORY_KEY);
    return;
  }
  await cloudRequest("sounding_history?id=not.is.null", { method: "DELETE" });
}

function showCloudStatus(message, ok = true) {
  const el = $("cloudStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("success", ok);
}

function setHistoryModeLabel() {
  const el = $("historyMode");
  if (!el) return;
  el.textContent = CLOUD_HISTORY_ENABLED ? "☁ History tersimpan online & dapat dilihat semua pengguna" : "💻 Mode lokal — isi supabase-config.js untuk history bersama";
  el.classList.toggle("cloud", CLOUD_HISTORY_ENABLED);
}

function buildTankTabs() {
  const el = $("tankTabs");
  el.innerHTML = tanks.map(n =>
    `<button class="tank-tab ${n === activeTank ? "active" : ""}" data-tank="${n}">ST ${n}</button>`
  ).join("");
  el.querySelectorAll(".tank-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTank(Number(btn.dataset.tank)));
  });
}

function readInputs() {
  return {
    ullage: Number($("ullage").value) || 0,
    t1: Number($("t1").value) || 0,
    t2: Number($("t2").value) || 0,
    t3: Number($("t3").value) || 0
  };
}

function writeInputs(state) {
  $("ullage").value = state.ullage;
  $("t1").value = state.t1;
  $("t2").value = state.t2;
  $("t3").value = state.t3;
}

function saveActiveTankState() {
  tankState[activeTank] = readInputs();
}

async function switchTank(n) {
  saveActiveTankState();
  activeTank = n;
  rows = [];
  buildTankTabs();
  $("tankTitle").textContent = `ST ${n} - Oil Sounding Tank ${n}`;
  writeInputs(tankState[n]);
  clearCalculated();
  $("calibrationBody").innerHTML = "";
  $("excelStatus").textContent = `Membaca data/ST ${n}.xlsx...`;
  await loadExcel(n);
}

async function loadExcel(tankNo) {
  try {
    const res = await fetch(`data/ST ${tankNo}.xlsx`, { cache: "no-store" });
    if (!res.ok) throw new Error(`File ST ${tankNo}.xlsx belum tersedia`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    if (!wb.SheetNames.length) throw new Error("Workbook tidak memiliki sheet");
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    rows = parseCalibrationSheet(raw);
    if (!rows.length) throw new Error("Kolom Ullage/Volume tidak terbaca dari Excel");
    renderTable();
    $("excelStatus").textContent = `✓ ST ${tankNo}.xlsx berhasil dibaca: ${rows.length} data kalibrasi`;
    resetTankMonitor();
  } catch (e) {
    rows = [];
    $("excelStatus").textContent = `✕ ${e.message}. Letakkan file tersebut di folder data.`;
    resetTankMonitor();
  }
}

const DEFAULT_DENSITY_ROWS = [
  [25,0.9052,0.9997564],[26,0.9046,0.9997912],[27,0.9040,0.9998260],[28,0.9033,0.9998608],[29,0.9027,0.9998956],[30,0.9021,0.9999304],
  [31,0.9014,0.9999652],[32,0.9008,1.0000000],[33,0.9001,1.0000348],[34,0.8995,1.0000696],[35,0.8989,1.0001044],[36,0.8982,1.0001392],
  [37,0.8975,1.0001740],[38,0.8969,1.0002088],[39,0.8962,1.0002436],[40,0.8956,1.0002784],[41,0.8950,1.0003132],[42,0.8943,1.0003480],
  [43,0.8937,1.0003828],[44,0.8930,1.0004176],[45,0.8923,1.0004524],[46,0.8916,1.0004872],[47,0.8910,1.0005220],[48,0.8903,1.0005568],
  [49,0.8896,1.0005916],[50,0.8890,1.0006264],[51,0.8884,1.0006612],[52,0.8878,1.0006960],[53,0.8871,1.0007308],[54,0.8865,1.0007656],
  [55,0.8858,1.0008004],[56,0.8851,1.0008352],[57,0.8845,1.0008700],[58,0.8839,1.0009048],[59,0.8832,1.0009396],[60,0.8826,1.0009744],
  [61,0.8820,1.0010092],[62,0.8814,1.0010440],[63,0.8808,1.0010788],[64,0.8802,1.0011136],[65,0.8796,1.0011484],[66,0.8790,1.0011832],
  [67,0.8784,1.0012180],[68,0.8878,1.0012528],[69,0.8872,1.0012876],[70,0.8766,1.0013224],[71,0.8760,1.0013572],[72,0.8754,1.0013920],
  [73,0.8748,1.0014268],[74,0.8742,1.0014616],[75,0.8736,1.0014964],[76,0.8730,1.0015312]
].map(([temperature,density,factor])=>({temperature,density,factor}));

async function loadDensity() {
  try {
    const candidates = [
      "./data/density.xlsx",
      "data/density.xlsx"
    ];
    let res = null;
    let usedPath = "";
    for (const path of candidates) {
      try {
        const r = await fetch(path, { cache: "no-store" });
        if (r.ok) { res = r; usedPath = path; break; }
      } catch (_) {}
    }
    if (!res) throw new Error("File density.xlsx tidak ditemukan");

    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const allRows = [];
    for (const sheetName of wb.SheetNames) {
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });
      allRows.push(...raw);
    }

    densityRows = parseDensitySheet(allRows);
    if (!densityRows.length) throw new Error("Data density di Excel tidak terbaca");

    renderDensityTable();
    $("densityStatus").textContent = `✓ density.xlsx terbaca (${densityRows.length} data)`;
    resetTankMonitor();
  } catch (e) {
    // Fallback supaya aplikasi tetap dapat menghitung walaupun GitHub Pages gagal
    // membaca file Excel karena cache/path. Nilainya berasal dari density.xlsx resmi.
    densityRows = DEFAULT_DENSITY_ROWS.slice();
    renderDensityTable();
    $("densityStatus").textContent = "✓ Tabel density siap digunakan (data standar)";
    console.warn("Excel density tidak terbaca, memakai tabel density bawaan:", e);
    resetTankMonitor();
  }
}

function parseDensitySheet(raw) {
  const found = [];
  for (let r = 0; r < raw.length; r++) {
    const row = raw[r] || [];
    for (let c = 0; c < row.length; c++) {
      const h1 = String(row[c] ?? "").trim().toLowerCase();
      if (!(h1.includes("temp") || h1.includes("suhu"))) continue;
      const h2 = String(row[c + 1] ?? "").trim().toLowerCase();
      const h3 = String(row[c + 2] ?? "").trim().toLowerCase();
      if (!(h2.includes("density") || h2.includes("densitas"))) continue;

      for (let rr = r + 1; rr < raw.length; rr++) {
        const a = raw[rr]?.[c];
        const b = raw[rr]?.[c + 1];
        const f = raw[rr]?.[c + 2];
        const t = numeric(a);
        const d = numeric(b);
        if (Number.isFinite(t) && Number.isFinite(d)) {
          found.push({
            temperature: t,
            density: d,
            factor: Number.isFinite(numeric(f)) ? numeric(f) : null
          });
        } else if (String(a ?? "").trim() && (String(a).toLowerCase().includes("temp") || String(a).toLowerCase().includes("suhu"))) {
          break;
        }
      }
    }
  }
  const unique = new Map();
  for (const item of found) unique.set(item.temperature, item);
  return [...unique.values()].sort((a,b)=>a.temperature-b.temperature);
}

function renderDensityTable() {
  const body = $("densityBody");
  if (!body) return;
  body.innerHTML = densityRows.map(r => `
    <tr>
      <td>${fmt(r.temperature, 0)}</td>
      <td>${fmt(r.density, 4)}</td>
      <td>${Number.isFinite(r.factor) ? fmt(r.factor, 7) : "-"}</td>
    </tr>
  `).join("");
}

function findDensity(temp) {
  if (!densityRows.length || !Number.isFinite(temp)) return null;
  let nearest = densityRows[0];
  let best = Math.abs(temp - nearest.temperature);
  for (const r of densityRows) {
    const d = Math.abs(temp - r.temperature);
    if (d < best) { best = d; nearest = r; }
  }
  return nearest;
}

function parseCalibrationSheet(raw) {
  const parsed = [];
  const headerRowsToCheck = Math.min(raw.length, 5);
  const ullageColumns = [];
  for (let r = 0; r < headerRowsToCheck; r++) {
    for (let c = 0; c < (raw[r] || []).length; c++) {
      if (String(raw[r][c] ?? "").trim().toLowerCase() === "ullage" && !ullageColumns.some(x => x.col === c)) {
        ullageColumns.push({ row: r, col: c });
      }
    }
  }
  for (const block of ullageColumns) {
    const c = block.col;
    for (let r = block.row + 2; r < raw.length; r++) {
      const u = numeric(raw[r]?.[c]);
      const v = numeric(raw[r]?.[c + 1]);
      if (Number.isFinite(u) && Number.isFinite(v)) parsed.push({ ullage: u, volume: v });
    }
  }
  const unique = new Map();
  for (const item of parsed) unique.set(item.ullage, item.volume);
  return [...unique.entries()].map(([ullage, volume]) => ({ ullage: Number(ullage), volume: Number(volume) })).sort((a,b)=>a.ullage-b.ullage);
}

function findVolume(u) {
  if (!rows.length || u < rows[0].ullage || u > rows[rows.length - 1].ullage) return null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].ullage === u) {
      const next = rows[i + 1] || null;
      const diff = next ? Math.abs((next.volume - rows[i].volume) / (next.ullage - rows[i].ullage)) : 0;
      return { volume: rows[i].volume, base: rows[i], next, diff };
    }
    if (i < rows.length - 1 && u > rows[i].ullage && u < rows[i + 1].ullage) {
      const a = rows[i], b = rows[i + 1];
      const step = (b.volume - a.volume) / (b.ullage - a.ullage);
      return { volume: a.volume + (u-a.ullage)*step, base:a, next:b, diff:Math.abs(step) };
    }
  }
  return null;
}

function renderTable() {
  $("calibrationBody").innerHTML = rows.map((r, i) => {
    const lcm = i < rows.length - 1 ? Math.abs((rows[i+1].volume-r.volume)/(rows[i+1].ullage-r.ullage)) : 0;
    return `<tr><td>${r.ullage}</td><td>${fmt(r.volume)}</td><td>${fmt(lcm)}</td></tr>`;
  }).join("");
}

function clearCalculated() {
  ["avgTemp","tableTemp","density","actualUllage","difference","litrePerCm","volumeCorrection","oilVolume","massBeforeFactor","vmt","factor"].forEach(id => { const el = $(id); if (el) el.textContent = "-"; });
  currentCalculation = null;
}

function calculate() {
  const u = Number($("ullage").value);
  const temps = [$("t1").value, $("t2").value, $("t3").value].map(Number);
  const validTemps = temps.filter(t => Number.isFinite(t) && t > 0);

  let avg = NaN;
  let densityData = null;

  // TEMPERATURE & DENSITY
  if (validTemps.length) {
    avg = validTemps.reduce((a, b) => a + b, 0) / validTemps.length;
    $("avgTemp").textContent = fmt(avg, 2);

    densityData = findDensity(avg);

    if (densityData) {
      $("tableTemp").textContent = fmt(densityData.temperature, 1);
      $("density").textContent = fmt(densityData.density, 4);
      $("factor").textContent = Number.isFinite(densityData.factor)
        ? fmt(densityData.factor, 7)
        : "-";
    } else {
      $("tableTemp").textContent = "-";
      $("density").textContent = "-";
      $("factor").textContent = "-";
    }
  } else {
    $("avgTemp").textContent = "-";
    $("tableTemp").textContent = "-";
    $("density").textContent = "-";
    $("factor").textContent = "-";
  }

  const clearVolume = () => {
    [
      "actualUllage",
      "baseUllage",
      "difference",
      "baseVolume",
      "litrePerCm",
      "volumeCorrection",
      "oilVolume",
      "massBeforeFactor",
      "vmt"
    ].forEach(id => {
      const el = $(id);
      if (el) el.textContent = "-";
    });
  };

  // VALIDASI ULLAGE & CALIBRATION
  if (!Number.isFinite(u) || u <= 0 || !rows.length) {
    clearVolume();
    currentCalculation = null;
    resetTankMonitor();
    return null;
  }

  const x = findVolume(u);

  if (!x) {
    clearVolume();
    currentCalculation = null;
    resetTankMonitor();
    return null;
  }

  // ULLAGE: semakin besar ullage, semakin sedikit volume oil.
  // findVolume() sudah mengambil volume berdasarkan tabel kalibrasi.
  const baseUllage = x.base.ullage;
  const difference = u - baseUllage;
  const litrePerCm = x.diff;
  const volumeCorrection = Math.abs(difference) * litrePerCm;
  const oilVolume = x.volume;

  [
    ["actualUllage", fmt(u, 1)],
    ["baseUllage", fmt(baseUllage, 1)],
    ["difference", fmt(difference, 1)],
    ["baseVolume", fmt(x.base.volume)],
    ["litrePerCm", fmt(litrePerCm)],
    ["volumeCorrection", fmt(volumeCorrection)],
    ["oilVolume", fmt(oilVolume)]
  ].forEach(([id, value]) => {
    const el = $(id);
    if (el) el.textContent = value;
  });

  // MASS & VMT
  let mass = NaN;
  let vmt = NaN;

  if (densityData && Number.isFinite(densityData.density)) {
    mass = oilVolume * densityData.density / 1000;

    if ($("massBeforeFactor")) {
      $("massBeforeFactor").textContent = fmt(mass);
    }

    if (Number.isFinite(densityData.factor)) {
      vmt = mass * densityData.factor;
      if ($("vmt")) $("vmt").textContent = fmt(vmt);
    } else {
      if ($("vmt")) $("vmt").textContent = "-";
    }
  } else {
    if ($("massBeforeFactor")) $("massBeforeFactor").textContent = "-";
    if ($("vmt")) $("vmt").textContent = "-";
  }

  currentCalculation = {
    tank: activeTank,
    ullage: u,
    t1: Number($("t1").value) || 0,
    t2: Number($("t2").value) || 0,
    t3: Number($("t3").value) || 0,
    avgTemp: Number.isFinite(avg) ? avg : null,
    tableTemp: densityData?.temperature ?? null,
    density: densityData?.density ?? null,
    factor: densityData?.factor ?? null,
    baseUllage,
    difference,
    baseVolume: x.base.volume,
    litrePerCm,
    volumeCorrection,
    oilVolume,
    massBeforeFactor: Number.isFinite(mass) ? mass : null,
    vmt: Number.isFinite(vmt) ? vmt : null
  };

  updateTankMonitor();
  return currentCalculation;
}

function historyInputSignature(calc, dateStr) {
  return [dateStr, calc.tank, calc.ullage, calc.t1, calc.t2, calc.t3].join("|");
}

let lastSavedSignature = null;

async function saveCurrentHistory() {
  const input = readInputs();
  const calc = currentCalculation;

  const calculationMatchesInput =
    calc &&
    calc.tank === activeTank &&
    calc.ullage === input.ullage &&
    calc.t1 === input.t1 &&
    calc.t2 === input.t2 &&
    calc.t3 === input.t3;

  if (!calculationMatchesInput) {
    alert("Klik tombol Hitung terlebih dahulu sebelum menyimpan ke history.");
    return;
  }

  if (!calc || !Number.isFinite(calc.ullage) || calc.ullage <= 0) {
    alert("Lengkapi Dipp/Ullage dan data sounding terlebih dahulu.");
    return;
  }
  if (!Number.isFinite(calc.vmt)) {
    alert("Perhitungan belum lengkap. Pastikan data temperature, density, dan calibration Excel sudah terbaca.");
    return;
  }

  const now = new Date();
  const dateStr = localDateString(now);
  const signature = historyInputSignature(calc, dateStr);
  const record = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2,8)}`,
    date: dateStr,
    time: localTimeString(now),
    signature,
    ...calc
  };

  try {
    const result = await saveHistoryRecord(record);
    renderHistory();
    if (result.existing) showSaveStatus("✓ Data ini sudah ada di history.", true);
    else showSaveStatus(CLOUD_HISTORY_ENABLED ? "✓ Tersimpan ke history online." : "✓ Tersimpan ke history lokal.", true);
  } catch (e) {
    console.error(e);
    showSaveStatus(`✕ Gagal menyimpan: ${e.message}`, false);
    alert(`Gagal menyimpan history ke database.\n\n${e.message}`);
  }
}

function showSaveStatus(message, ok = false) {
  const el = $("saveHistoryStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("success", ok);
  clearTimeout(showSaveStatus.timer);
  showSaveStatus.timer = setTimeout(() => { el.textContent = ""; el.classList.remove("success"); }, 3500);
}

async function renderHistory() {
  const all = await getHistory();
  const filtered = historyDateFilter ? all.filter(r => r.date === historyDateFilter) : all;
  const body = $("historyBody");
  const empty = $("historyEmpty");

  if (!filtered.length) {
    body.innerHTML = "";
    empty.classList.remove("hidden");
    $("historySummary").textContent = historyDateFilter ? `Tidak ada data pada ${formatDateDisplay(historyDateFilter)}.` : "Belum ada history sounding.";
    return;
  }
  empty.classList.add("hidden");

  const dates = [...new Set(filtered.map(r=>r.date))];
  $("historySummary").textContent = `${filtered.length} record${filtered.length > 1 ? "s" : ""} • ${historyDateFilter ? formatDateDisplay(historyDateFilter) : `${dates.length} hari`}`;

  body.innerHTML = filtered.map(r => `
    <tr>
      <td>${formatDateDisplay(r.date)}</td>
      <td>${r.time || "-"}</td>
      <td><b>ST ${r.tank}</b></td>
      <td>${fmt(Number(r.ullage),1)}</td>
      <td>${Number.isFinite(Number(r.avgTemp)) ? fmt(Number(r.avgTemp),2) : "-"}</td>
      <td>${Number.isFinite(Number(r.tableTemp)) ? fmt(Number(r.tableTemp),1) : "-"}</td>
      <td>${Number.isFinite(Number(r.density)) ? fmt(Number(r.density),4) : "-"}</td>
      <td>${Number.isFinite(Number(r.oilVolume)) ? fmt(Number(r.oilVolume)) : "-"}</td>
      <td><b>${Number.isFinite(Number(r.vmt)) ? fmt(Number(r.vmt)) : "-"}</b></td>
      <td><button class="history-delete" data-id="${r.id}">Hapus</button></td>
    </tr>
  `).join("");

  body.querySelectorAll(".history-delete").forEach(btn => btn.addEventListener("click", async () => await deleteHistory(btn.dataset.id)));
}

async function deleteHistory(id) {
  if (!confirm("Hapus record history ini?")) return;
  try {
    await deleteHistoryRecord(id);
    await renderHistory();
  } catch (e) {
    alert(`Gagal menghapus history.\n\n${e.message}`);
  }
}

async function clearAllHistory() {
  const all = await getHistory();
  const count = all.length;
  if (!count) return;
  if (confirm(`Hapus semua ${count} record history?`)) {
    try {
      await clearHistoryRecords();
      await renderHistory();
    } catch (e) {
      alert(`Gagal menghapus semua history.\n\n${e.message}`);
    }
  }
}

async function exportHistoryCSV() {
  const all = await getHistory();
  const data = historyDateFilter ? all.filter(r=>r.date===historyDateFilter) : all;
  if (!data.length) { alert("Tidak ada history untuk diexport."); return; }
  const headers = ["Tanggal","Jam","Tank","Dipp/Ullage (cm)","Temperature 1 (C)","Temperature 2 (C)","Temperature 3 (C)","Rata-rata Temperature (C)","Temperature Tabel (C)","Density","Ullage Dasar (cm)","Selisih (cm)","Volume Dasar (L)","Volume per cm (L/cm)","Koreksi Volume (L)","Volume Oil (L)","Volume x Density (MT)","Correction Factor","VMT (MT)"];
  const values = data.map(r=>[r.date,r.time,`ST ${r.tank}`,r.ullage,r.t1,r.t2,r.t3,r.avgTemp,r.tableTemp,r.density,r.baseUllage,r.difference,r.baseVolume,r.litrePerCm,r.volumeCorrection,r.oilVolume,r.massBeforeFactor,r.factor,r.vmt]);
  const csv = [headers,...values].map(row=>row.map(v=>`"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `History_Sounding_${historyDateFilter || "Semua"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


function exportCalibrationExcel() {
  if (!rows.length) { alert("Data kalibrasi belum tersedia."); return; }
  const data = rows.map((r, i) => ({
    "Ullage (cm)": r.ullage,
    "Volume (L)": r.volume,
    "L/cm": i < rows.length - 1 ? Math.abs((rows[i+1].volume-r.volume)/(rows[i+1].ullage-r.ullage)) : 0
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `ST ${activeTank}`);
  XLSX.writeFile(wb, `Kalibrasi_Ullage_ST_${activeTank}.xlsx`);
}

["ullage","t1","t2","t3"].forEach(id => {
  $(id).addEventListener("input", () => {
    saveActiveTankState();
    // Tidak menghitung otomatis. Hasil hanya muncul setelah tombol Hitung ditekan.
  });
});

$("saveHistoryBtn").addEventListener("click", saveCurrentHistory);
$("calculateBtn")?.addEventListener("click", calculate);
$("exportCalibrationBtn")?.addEventListener("click", exportCalibrationExcel);

$("historyDate").value = localDateString();
$("historyDate").addEventListener("change", e => { historyDateFilter = e.target.value || null; renderHistory(); });
$("showAllHistoryBtn").addEventListener("click", () => { historyDateFilter = null; $("historyDate").value = ""; renderHistory(); });
$("exportHistoryBtn").addEventListener("click", exportHistoryCSV);
$("clearHistoryBtn").addEventListener("click", clearAllHistory);


buildTankTabs();
writeInputs(tankState[1]);
setHistoryModeLabel();
renderHistory();
loadExcel(1);
loadDensity();

function updateTankMonitor() {
  const monitorUllage = document.getElementById("monitorUllage");
  const monitorTemp = document.getElementById("monitorTemp");
  const monitorDensity = document.getElementById("monitorDensity");
  const monitorMass = document.getElementById("monitorMass");
  const monitorVolume = document.getElementById("monitorVolume");

  if (!monitorUllage) return;

  monitorUllage.textContent =
    document.getElementById("actualUllage")?.textContent || "-";

  monitorTemp.textContent =
    document.getElementById("avgTemp")?.textContent || "-";

  monitorDensity.textContent =
    document.getElementById("density")?.textContent || "-";

  monitorMass.textContent =
    document.getElementById("vmt")?.textContent || "-";

  monitorVolume.textContent =
    document.getElementById("oilVolume")?.textContent || "-";

  document.getElementById("tankMonitor")?.classList.remove("is-empty");
}

function resetTankMonitor() {
  [
    "monitorUllage",
    "monitorTemp",
    "monitorDensity",
    "monitorMass",
    "monitorVolume"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "-";
  });

  document.getElementById("tankMonitor")?.classList.add("is-empty");
}

// Pastikan monitor selalu kosong saat aplikasi pertama kali dibuka.
resetTankMonitor();
