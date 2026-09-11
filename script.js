/* =========================================================
   Dashboard Penjualan 2026 - script.js
   Vanilla JavaScript + Chart.js
   Logika dibagi jadi modul-modul modular & mudah dibaca.
   ========================================================= */

'use strict';

/* ---------------- Konfigurasi ---------------- */
const CSV_URL = 'Penjualan 2026_clean.csv';

/* Indeks kolom pada CSV (lihat header file):
   0 No Nota | 1 Tgl | 5 Gudang | 6 Nm. Pelanggan | 7 Status Plg.
   8 Platform | 9 Kditem | 10 Nama Buku | 11 Qty Jual | 13 Harga | 14 Total | 15 Jns Bayar
   Catatan: kolom Gudang/Status/Platform hanya terisi Jan-Jun, kosong di Jul-Agu. */
const COL = { nota: 0, region: 5, customer: 6, type: 7, platform: 8, kditem: 9, name: 10, qty: 11, harga: 13, total: 14, payment: 15 };

/* Palet warna tetap agar dashboard konsisten & mudah dibedakan */
const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#14b8a6', '#3b82f6', '#f97316', '#84cc16',
  '#06b6d4', '#d946ef', '#64748b'
];

const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

/* ---------------- State global ---------------- */
let allRecords = [];      // seluruh baris dari CSV (sudah dinormalisasi)
let filtered = [];        // baris hasil filter aktif
let charts = {};          // objek untuk menyimpan instance Chart (untuk destroy saat update)
const filters = { region: '', category: '', type: '', channel: '' };

const $ = (id) => document.getElementById(id);

/* ---------------- CSV parser sederhana (vanilla) ----------------
   Pecah baris CSV menghormati tanda kutip "..." supaya koma dalam nama tidak merusak kolom. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push(row); }
  return rows;
}

/* Ubah string harga/uang seperti "Rp. 200.000" atau "40000" menjadi angka */
function parseMoney(value) {
  if (value == null) return 0;
  const n = String(value).replace(/[^0-9.,-]/g, '');
  const num = parseFloat(n.replace(/\./g, '').replace(',', '.')) || 0;
  return num;
}

function parseNum(value) {
  return parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

/* Normalisasi tanggal "1-1-2026" atau "1/7/2026" menjadi Date */
function parseDate(value) {
  const parts = String(value || '').replace(/\//g, '-').split('-');
  if (parts.length < 3) return null;
  const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  return isNaN(d) ? null : d;
}

/* ---------------- Klasifikasi kategori produk ----------------
   CSV tidak punya kolom kategori bersih, maka kategori disimpulkan
   dari Kditem & Nama Buku via aturan kata kunci (bukan data dummy). */
function classifyCategory(record) {
  const s = (record.kditem + ' ' + record.name).toUpperCase();
  if (s.indexOf('BUNDLING') !== -1 || s.startsWith('BDL')) return 'Bundling';
  const prefixMap = { ALQ: 'Al-Quran', BI: 'Bimbingan Islam', PRN: 'Parenting', KSH: 'Kisah', ANK: 'Anak', PST: 'Poster', BAI: 'Bundling Ayah Ibu' };
  for (const k in prefixMap) if (s.startsWith(k)) return prefixMap[k];
  const kw = [
    ['TADABBUR', 'Al-Quran'], ['AL-QURAN', 'Al-Quran'], ['ALQURAN', 'Al-Quran'],
    ['JUZ AMMA', 'Al-Quran'], ['SURAH', 'Al-Quran'], ['FAMI BI SYAUQIN', 'Al-Quran'],
    ['HADITS', 'Al-Quran'], ['MENGHAFAL', 'Al-Quran'], ['PUASA', 'Al-Quran'],
    ['RAMADHAN', 'Al-Quran'], ['BERIBADAH', 'Al-Quran'], ['PETA', 'Al-Quran'],
    ['SIRAH', 'Bimbingan Islam'], ['KISAH', 'Kisah'], ['NABI', 'Anak'],
    ['KUTTAB', 'Bimbingan Islam'], ['FALSAFAH', 'Bimbingan Islam'], ['KITABATI', 'Bimbingan Islam'],
    ['PENDIDIKAN', 'Bimbingan Islam'], ['SAMPAH', 'Bimbingan Islam'], ['KENABIAN', 'Bimbingan Islam'],
    ['MENDIDIK', 'Bimbingan Islam'], ['MEMBACA', 'Bimbingan Islam'], ['ILMU', 'Bimbingan Islam'],
    ['UMRAH', 'Bimbingan Islam'], ['PARENTING', 'Parenting'], ['IBU', 'Parenting'],
    ['AYAH', 'Parenting'], ['ANAKKU', 'Parenting'], ['KELUARGA', 'Parenting'],
    ['SEKOLAH', 'Parenting'], ['RUMAHKU', 'Parenting'], ['BERBUAT BAIK', 'Anak'],
    ['POSTER', 'Poster'], ['MODUL', 'Lainnya']
  ];
  for (const [k, v] of kw) if (s.indexOf(k) !== -1) return v;
  return 'Lainnya';
}

/* ---------------- Normalisasi seluruh baris CSV ---------------- */
function normalize(rows) {
  const records = [];
  for (const r of rows) {
    const nota = (r[COL.nota] || '').trim();
    const name = (r[COL.name] || '').trim();
    if (nota === 'No Nota' || name === 'Nama Buku') continue; // lewati baris header
    const record = {
      nota,
      date: parseDate(r[1]),
      region: (r[COL.region] || '').trim(),
      customer: (r[COL.customer] || '').trim(),
      type: (r[COL.type] || '').trim(),
      channel: (r[COL.platform] || '').trim(),
      kditem: (r[COL.kditem] || '').trim(),
      name: (r[COL.name] || '').trim(),
      qty: parseNum(r[COL.qty]) || 0,
      harga: parseMoney(r[COL.harga]),
      total: parseMoney(r[COL.total]),
      payment: (r[COL.payment] || '').trim()
    };
    /* Jika kolom Total kosong/0, gunakan harga × qty sebagai cadangan */
    if (!record.total) record.total = record.harga * record.qty;
    /* Potongan: proporsi selisih harga wajar vs total (>= 0) */
    const raw = record.harga * record.qty;
    record.discount = raw > 0 ? Math.max(0, 1 - record.total / raw) : 0;
    record.category = classifyCategory(record);
    if (record.name) records.push(record);
  }
  return records;
}

/* ---------------- Filter ---------------- */
function applyFilters() {
  filtered = allRecords.filter((r) =>
    (!filters.region || r.region === filters.region) &&
    (!filters.category || r.category === filters.category) &&
    (!filters.type || r.type === filters.type) &&
    (!filters.channel || r.channel === filters.channel)
  );
  renderAll();
}

/* Isi pilihan dropdown filter dari data unik di CSV */
function populateFilters() {
  const unique = (fn) => [...new Set(allRecords.map(fn).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  fillSelect('filter-region', unique((r) => r.region));
  fillSelect('filter-category', unique((r) => r.category));
  fillSelect('filter-customer', unique((r) => r.type));
  fillSelect('filter-channel', unique((r) => r.channel));
}

function fillSelect(id, values) {
  const sel = $(id);
  values.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function bindFilters() {
  ['region', 'category', 'customer', 'channel'].forEach((key) => {
    $(`filter-${key}`).addEventListener('change', (e) => {
      filters[key === 'customer' ? 'type' : key] = e.target.value;
      $('btn-reset').classList.toggle('hidden', !Object.values(filters).some(Boolean));
      applyFilters();
    });
  });
  $('btn-reset').addEventListener('click', () => {
    Object.keys(filters).forEach((k) => (filters[k] = ''));
    ['region', 'category', 'customer', 'channel'].forEach((id) => ($(`filter-${id}`).value = ''));
    $('btn-reset').classList.add('hidden');
    applyFilters();
  });
}

/* ---------------- Rendering KPI ---------------- */
function renderKPIs() {
  const revenue = filtered.reduce((s, r) => s + r.total, 0);
  const qty = filtered.reduce((s, r) => s + r.qty, 0);
  const notaCount = new Set(filtered.map((r) => gkey(r))).size;
  const discounts = filtered.filter((r) => r.discount > 0).map((r) => r.discount);
  const avgDisc = discounts.length ? (discounts.reduce((a, b) => a + b, 0) / discounts.length) * 100 : 0;

  $('kpi-revenue').textContent = money.format(revenue);
  $('kpi-transactions').textContent = notaCount.toLocaleString('id-ID');
  $('kpi-qty').textContent = qty.toLocaleString('id-ID');
  $('kpi-discount').textContent = avgDisc.toFixed(1) + '%';
}

/* Kunci transaksi unik: pakai No Nota; jika kosong, periode untuk hitungan kasar */
function gkey(r) {
  return r.nota || (r.date ? `periode-${r.date.getTime()}` : 'kosong');
}

/* ---------------- Bantuan aggregation ---------------- */
/* Kumpulkan data berpasangan [label, value] dari callback pencatat */
function aggregate(groupBy, valueOf) {
  const map = new Map();
  for (const r of filtered) {
    const key = groupBy(r) || 'Tanpa Label';
    map.set(key, (map.get(key) || 0) + valueOf(r));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function groupByMonth(r) {
  return r.date ? `${String(r.date.getMonth() + 1).padStart(2, '0')}-${r.date.getFullYear()}` : null;
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function monthLabel(key) {
  const [m, y] = key.split('-');
  return `${BULAN[+m - 1]} ${y}`;
}

/* ---------------- Chart helpers ---------------- */
function createChart(id, config) {
  if (charts[id]) { charts[id].destroy(); }
  const ctx = $(id);
  ctx.closest('.chart-wrapper')?.classList.add('loading');
  charts[id] = new Chart(ctx, config);
  requestAnimationFrame(() => ctx.closest('.chart-wrapper')?.classList.remove('loading'));
}

/* ------------- 1. Sales Trend (baris demi bulan) ------------- */
function renderTrend() {
  const data = aggregate(groupByMonth, (r) => r.total)
    .filter(([k]) => k)
    .sort((a, b) => a[0].localeCompare(b[0]));
  createChart('chart-trend', {
    type: 'line',
    data: {
      labels: data.map(([k]) => monthLabel(k)),
      datasets: [{
        label: 'Revenue',
        data: data.map(([, v]) => v),
        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)',
        fill: true, tension: 0.35, pointRadius: 4, borderWidth: 2
      }]
    },
    options: chartOpts((v) => money.format(v).replace('Rp', 'Rp '), false)
  });
}

/* ------------- 2. Revenue per Region ------------- */
function renderRegion() {
  const data = aggregate((r) => r.region, (r) => r.total);
  createChart('chart-region', {
    type: 'bar',
    data: {
      labels: data.map(([k]) => k),
      datasets: [{ label: 'Revenue', data: data.map(([, v]) => v), backgroundColor: PALETTE, borderRadius: 6 }]
    },
    options: chartOpts((v) => money.format(v).replace('Rp', 'Rp '), true)
  });
}

/* ------------- 3. Revenue per Kategori Produk ------------- */
function renderCategory() {
  const data = aggregate((r) => r.category, (r) => r.total);
  createChart('chart-category', {
    type: 'doughnut',
    data: { labels: data.map(([k]) => k), datasets: [{ data: data.map(([, v]) => v), backgroundColor: PALETTE }] },
    options: baseOpts()
  });
}

/* ------------- 4. Sales per Sales Channel (platform) ------------- */
function renderChannel() {
  const data = aggregate((r) => r.channel, (r) => r.total);
  createChart('chart-channel', {
    type: 'pie',
    data: { labels: data.map(([k]) => k), datasets: [{ data: data.map(([, v]) => v), backgroundColor: PALETTE }] },
    options: baseOpts()
  });
}

/* ------------- 5. Distribusi Tipe Pelanggan ------------- */
function renderCustomerType() {
  const data = aggregate((r) => r.type, (r) => r.total);
  createChart('chart-customer', {
    type: 'doughnut',
    data: { labels: data.map(([k]) => k), datasets: [{ data: data.map(([, v]) => v), backgroundColor: PALETTE }] },
    options: baseOpts()
  });
}

/* ------------- 6. Penggunaan Metode Pembayaran ------------- */
function renderPayment() {
  const data = aggregate((r) => r.payment, (r) => r.total);
  createChart('chart-payment', {
    type: 'bar',
    data: {
      labels: data.map(([k]) => k),
      datasets: [{ label: 'Revenue', data: data.map(([, v]) => v), backgroundColor: PALETTE, borderRadius: 6 }]
    },
    options: chartOpts((v) => money.format(v).replace('Rp', 'Rp '), true)
  });
}

/* ------------- 7. Sales per Sales Representative -------------
   CSV tidak memuat kolom sales rep, maka dipakai pelanggan utama
   sebagai proksi volume penjualan per tenaga penjualan. */
function renderRep() {
  const grouped = new Map();
  for (const r of filtered) {
    const key = r.customer || 'Tanpa Nama';
    const g = grouped.get(key) || { revenue: 0, count: 0 };
    g.revenue += r.total;
    g.count += 1;
    grouped.set(key, g);
  }
  const data = [...grouped.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 12);
  createChart('chart-platform', {
    type: 'bar',
    data: {
      labels: data.map(([k]) => k),
      datasets: [{ label: 'Total Penjualan', data: data.map(([, v]) => v.revenue), backgroundColor: '#14b8a6', borderRadius: 6 }]
    },
    options: chartOpts((v) => money.format(v).replace('Rp', 'Rp '), true)
  });
}

/* ------------- 8. Discount vs Sales (Scatter) ------------- */
function renderScatter() {
  const pts = filtered.filter((r) => r.total > 0).map((r) => ({ x: r.discount * 100, y: r.total }));
  createChart('chart-scatter', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Transaksi',
        data: pts,
        backgroundColor: 'rgba(139,92,246,0.6)', borderColor: '#8b5cf6', pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#475569' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = ctx.raw;
              return `Diskon ${p.x.toFixed(1)}% · ${money.format(p.y)}`;
            }
          }
        }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Diskon (%)' }, grid: { color: '#eef2f7' } },
        y: { title: { display: true, text: 'Revenue (Rp)' }, grid: { color: '#eef2f7' } }
      }
    }
  });
}

/* ------------- 9. Top 10 Produk Revenue Tertinggi ------------- */
function renderTop10() {
  const data = aggregate((r) => r.name, (r) => r.total).slice(0, 10);
  createChart('chart-top10', {
    type: 'bar',
    data: {
      labels: data.map(([k]) => k),
      datasets: [{ label: 'Revenue', data: data.map(([, v]) => v), backgroundColor: '#f59e0b', borderRadius: 6 }]
    },
    options: chartOpts((v) => money.format(v).replace('Rp', 'Rp '), true)
  });
}

/* ------------- 10. Quantity Sold per Kategori ------------- */
function renderQtyCategory() {
  const data = aggregate((r) => r.category, (r) => r.qty);
  createChart('chart-qty-category', {
    type: 'bar',
    data: {
      labels: data.map(([k]) => k),
      datasets: [{ label: 'Kuantitas', data: data.map(([, v]) => v), backgroundColor: '#10b981', borderRadius: 6 }]
    },
    options: chartOpts((v) => v.toLocaleString('id-ID'), true)
  });
}

/* ---------------- Opsi chart umum ---------------- */
function baseOpts() {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: '#475569', boxWidth: 12 } } }
  };
}

function chartOpts(tickCb, verticalBars) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#475569' } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label || ''}: ${money.format(ctx.raw)}` } }
    },
    scales: {
      x: {
        ticks: { color: '#64748b', maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        grid: { display: false }, border: { color: '#e2e8f0' }
      },
      y: {
        ticks: { color: '#64748b', callback: tickCb },
        grid: { color: '#eef2f7' }
      }
    }
  };
}

/* ---------------- Render semua ---------------- */
function renderAll() {
  renderKPIs();
  renderTrend();
  renderRegion();
  renderCategory();
  renderChannel();
  renderCustomerType();
  renderPayment();
  renderRep();
  renderScatter();
  renderTop10();
  renderQtyCategory();
}

/* ---------------- Inisialisasi ---------------- */
async function init() {
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    allRecords = normalize(rows);
    if (!allRecords.length) throw new Error('Tidak ada data valid di CSV');

    populateFilters();
    bindFilters();
    applyFilters();

    const totalRevenue = allRecords.reduce((s, r) => s + r.total, 0);
    $('subtitle').textContent = `${allRecords.length.toLocaleString('id-ID')} baris data · Revenue ${money.format(totalRevenue)}`;
    const st = $('data-status');
    st.classList.remove('animate-pulse'); $('status-dot').classList.remove('bg-amber-400');
    $('status-dot').classList.add('bg-emerald-400'); $('status-text').textContent = 'Data siap';
  } catch (err) {
    $('subtitle').textContent = 'Gagal memuat data: ' + (err.stack || err.message);
    $('status-dot').classList.remove('bg-amber-400'); $('status-dot').classList.add('bg-red-400');
    $('status-text').textContent = 'Error';
  }
}

document.addEventListener('DOMContentLoaded', init);
