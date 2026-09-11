# Dashboard Penjualan 2026

Aplikasi web statis untuk analisis dan visualisasi data penjualan tahun 2026. Data diambil dari file CSV lokal, tanpa data dummy — semua angka berasal dari dataset asli.

## Fitur

- **KPI Cards**: total revenue, total transaksi, total qty terjual, rata-rata diskon.
- **10+ visualisasi Chart.js**: tren bulanan, revenue per region, revenue per kategori produk, sales per sales channel, distribusi tipe pelanggan, metode pembayaran, scatter diskon vs sales, top 10 produk, qty per kategori, dll.
- **Filter interaktif**: region/gudang, kategori produk, tipe pelanggan, sales channel. Semua chart dan KPI ter-update otomatis.

## Teknologi

- HTML + CSS (Tailwind CSS via CDN + `style.css`)
- Vanilla JavaScript, tanpa framework
- Chart.js 4 via CDN
- Python 3 (hanya untuk skrip pembersihan data)

## Struktur File

| File | Fungsi |
|---|---|
| `index.html` | Halaman utama dashboard |
| `script.js` | Logika aplikasi: parse CSV, normalisasi, filter, render chart |
| `style.css` | Styling tambahan di luar Tailwind |
| `Penjualan 2026_clean.csv` | Dataset yang dipakai aplikasi (hasil pembersihan) |
| `Penjualan 2026.csv` | Dataset mentah/raw |
| `clean_data.py` | Skrip pembersihan data raw → clean |

## Cara Menjalankan

Aplikasi mengambil CSV via `fetch()`, sehingga tidak bisa dibuka langsung sebagai file (`file://`). Jalankan HTTP server sederhana di folder project:

```bash
cd "Analisis-Penjualan-2026"
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080` di browser.

Untuk menghentikan server: `pkill -f "http.server 8080"`.

## Alur Data

1. **Pembersihan** (`clean_data.py`): memproses `Penjualan 2026.csv` → `Penjualan 2026_clean.csv`.
   - Drop baris kosong total.
   - Isi kolom `Bulan` dari `Tgl` jika kosong.
   - Isi `Platform` dari `Jns Bayar` jika kosong (mis. Shopee).
   - Fix `Kditem` = `'1'` → `'SIP000001'`.
   - Tambah kolom `Diskon_Persen`.
2. **Loading** (`script.js`): `init()` mengambil CSV, `parseCSV()` memecah baris, `normalize()` membangun record.
3. **Filter & Render**: `applyFilters()` memfilter data, `renderAll()` menggambar ulang semua KPI dan chart.

### Struktur Kolom CSV

Indeks kolom di-hardcode di `script.js:16` (`COL`):

| Indeks | Kolom |
|---|---|
| 0 | No Nota |
| 1 | Tgl |
| 5 | Gudang |
| 6 | Nm. Pelanggan |
| 7 | Status Plg. |
| 8 | Platform |
| 9 | Kditem |
| 10 | Nama Buku |
| 11 | Qty Jual |
| 13 | Harga |
| 14 | Total |
| 15 | Jns Bayar |

Catatan: kolom Gudang/Status/Platform hanya terisi Jan–Jun, kosong di Jul–Agu.

## Kategori Produk

CSV tidak punya kolom kategori bersih. `classifyCategory()` di `script.js:85` menyimpulkan kategori dari `Kditem` + `Nama Buku` via aturan kata kunci (mis. `ALQ` → Al-Quran, `BI` → Bimbingan Islam, `PRN` → Parenting). Jika tidak cocok, masuk kategori `Lainnya`.

## Mengganti Dataset

Karena path CSV hardcoded di `script.js:10` (`CSV_URL`), penyebabnya:

```js
const CSV_URL = 'Penjualan 2026_clean.csv';
```

Ganti file `Penjualan 2026_clean.csv` dengan dataset baru, atau ganti nilai `CSV_URL`.

Jika dataset baru, pastikan:
- Struktur kolom sama persis dengan tabel di atas (posisi kolom berpengaruh pada `COL`).
- Isi `Kditem` dan `Nama Buku` mengikuti pola lama agar klasifikasi kategori tetap akurat.
- Sudah bersih (atau jalankan ulang `clean_data.py` terhadap raw baru).

### Alternatif: Google Sheets

Publikasikan sheet sebagai CSV (File → Share → Publish to web → format CSV), lalu set `CSV_URL` ke URL publish (`https://docs.google.com/spreadsheets/d/e/<ID>/pub?output=csv`). URL publish mendukung CORS sehingga `fetch()` tetap jalan. Data ter-refresh tiap halaman dibuka; dibutuhkan internet. Kolom sheet harus sama urutannya dengan CSV saat ini.

## Keterbatasan

- Struktur kolom CSV bersifat tetap (indeks hardcoded).
- Klasifikasi kategori berbasis kata kunci, bukan kolom kategori asli.
- Butuh koneksi internet untuk CDN Tailwind dan Chart.js.
- Tidak ada fitur upload dataset lewat aplikasi (belum).