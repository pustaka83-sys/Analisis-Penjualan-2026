import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# --- Config ---
st.set_page_config(page_title="Dashboard Penjualan 2026", layout="wide")

PALETTE = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
    '#10b981', '#14b8a6', '#3b82f6', '#f97316', '#84cc16',
    '#06b6d4', '#d946ef', '#64748b'
]

BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
         'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

MONEY_FMT = lambda v: f"Rp {v:,.0f}".replace(",", ".")

# --- Category classifier (ported from JS) ---
PREFIX_MAP = {
    'ALQ': 'Al-Quran', 'BI': 'Bimbingan Islam', 'PRN': 'Parenting',
    'KSH': 'Kisah', 'ANK': 'Anak', 'PST': 'Poster', 'BAI': 'Bundling Ayah Ibu'
}
KW_RULES = [
    ('TADABBUR', 'Al-Quran'), ('AL-QURAN', 'Al-Quran'), ('ALQURAN', 'Al-Quran'),
    ('JUZ AMMA', 'Al-Quran'), ('SURAH', 'Al-Quran'), ('FAMI BI SYAUQIN', 'Al-Quran'),
    ('HADITS', 'Al-Quran'), ('MENGHAFAL', 'Al-Quran'), ('PUASA', 'Al-Quran'),
    ('RAMADHAN', 'Al-Quran'), ('BERIBADAH', 'Al-Quran'), ('PETA', 'Al-Quran'),
    ('SIRAH', 'Bimbingan Islam'), ('KISAH', 'Kisah'), ('NABI', 'Anak'),
    ('KUTTAB', 'Bimbingan Islam'), ('FALSAFAH', 'Bimbingan Islam'), ('KITABATI', 'Bimbingan Islam'),
    ('PENDIDIKAN', 'Bimbingan Islam'), ('SAMPAH', 'Bimbingan Islam'), ('KENABIAN', 'Bimbingan Islam'),
    ('MENDIDIK', 'Bimbingan Islam'), ('MEMBACA', 'Bimbingan Islam'), ('ILMU', 'Bimbingan Islam'),
    ('UMRAH', 'Bimbingan Islam'), ('PARENTING', 'Parenting'), ('IBU', 'Parenting'),
    ('AYAH', 'Parenting'), ('ANAKKU', 'Parenting'), ('KELUARGA', 'Parenting'),
    ('SEKOLAH', 'Parenting'), ('RUMAHKU', 'Parenting'), ('BERBUAT BAIK', 'Anak'),
    ('POSTER', 'Poster'), ('MODUL', 'Lainnya'),
]

def classify_category(row):
    s = (str(row.get('Kditem', '')) + ' ' + str(row.get('Nama Buku', ''))).upper()
    if 'BUNDLING' in s or s.startswith('BDL'):
        return 'Bundling'
    for prefix, cat in PREFIX_MAP.items():
        if s.startswith(prefix):
            return cat
    for kw, cat in KW_RULES:
        if kw in s:
            return cat
    return 'Lainnya'

def parse_money(val):
    if pd.isna(val):
        return 0.0
    s = str(val).replace('Rp.', '').replace('Rp', '').replace('.', '').replace(',', '.').strip()
    try:
        return float(s)
    except ValueError:
        return 0.0

def parse_date(val):
    try:
        return pd.to_datetime(val, dayfirst=True)
    except Exception:
        return pd.NaT

# --- Load & prepare data ---
@st.cache_data
def load_data():
    df = pd.read_csv('Penjualan 2026_clean.csv')
    df['Revenue'] = df['Total'].apply(parse_money)
    df['Harga_num'] = df['Harga'].apply(parse_money)
    df['Qty'] = pd.to_numeric(df['Qty Jual'], errors='coerce').fillna(0)
    df['Diskon'] = pd.to_numeric(df.get('Diskon_Persen', 0), errors='coerce').fillna(0)
    df['Tanggal_dt'] = df['Tgl'].apply(parse_date)
    df['Bulan_key'] = df['Tanggal_dt'].dt.to_period('M').astype(str)
    df['Bulan_label'] = df['Bulan_key'].apply(
        lambda x: f"{BULAN[int(x.split('-')[1])-1]} {x.split('-')[0]}" if pd.notna(x) and int(x.split('-')[1]) <= 12 else x
    )
    df['Kategori'] = df.apply(classify_category, axis=1)
    return df

df = load_data()

# --- Sidebar filters ---
st.sidebar.header("Filter Data")

region_list = ['Semua'] + sorted(df['Gudang'].dropna().unique().tolist())
cat_list = ['Semua'] + sorted(df['Kategori'].dropna().unique().tolist())
type_list = ['Semua'] + sorted(df['Status Plg.'].dropna().unique().tolist())
channel_list = ['Semua'] + sorted(df['Platform'].dropna().unique().tolist())

region = st.sidebar.selectbox("Region / Gudang", region_list)
category = st.sidebar.selectbox("Kategori Produk", cat_list)
cust_type = st.sidebar.selectbox("Tipe Pelanggan", type_list)
channel = st.sidebar.selectbox("Sales Channel", channel_list)

if st.sidebar.button("Reset Semua Filter"):
    region, category, cust_type, channel = 'Semua', 'Semua', 'Semua', 'Semua'
    st.rerun()

# Apply filters
filtered = df.copy()
if region != 'Semua':
    filtered = filtered[filtered['Gudang'] == region]
if category != 'Semua':
    filtered = filtered[filtered['Kategori'] == category]
if cust_type != 'Semua':
    filtered = filtered[filtered['Status Plg.'] == cust_type]
if channel != 'Semua':
    filtered = filtered[filtered['Platform'] == channel]

# --- Header ---
st.title("Dashboard Penjualan 2026")
total_rev = filtered['Revenue'].sum()
st.caption(f"{len(filtered):,} baris data · Revenue {MONEY_FMT(total_rev)}")

# --- KPI Cards ---
k1, k2, k3, k4 = st.columns(4)
k1.metric("Total Revenue", MONEY_FMT(filtered['Revenue'].sum()))
k2.metric("Total Transaksi", f"{filtered['No Nota'].nunique():,}")
k3.metric("Total Qty Terjual", f"{int(filtered['Qty'].sum()):,}")
disc_vals = filtered.loc[filtered['Diskon'] > 0, 'Diskon']
avg_disc = (disc_vals.mean() * 100) if len(disc_vals) > 0 else 0
k4.metric("Avg Discount", f"{avg_disc:.1f}%")

st.divider()

# --- Charts ---
# 1. Sales Trend
st.subheader("Sales Trend")
trend = filtered.groupby('Bulan_key').agg(Revenue=('Revenue', 'sum')).reset_index()
trend = trend.sort_values('Bulan_key')
trend['Label'] = trend['Bulan_key'].apply(
    lambda x: f"{BULAN[int(x.split('-')[1])-1]} {x.split('-')[0]}"
)
fig_trend = px.line(trend, x='Label', y='Revenue', markers=True,
                    color_discrete_sequence=['#6366f1'])
fig_trend.update_traces(fill='tozeroy', fillcolor='rgba(99,102,241,0.15)')
fig_trend.update_layout(yaxis_tickformat=',.0f', xaxis_title='', yaxis_title='Revenue (Rp)',
                        height=350, margin=dict(t=10, b=10))
st.plotly_chart(fig_trend, use_container_width=True)

# 2. Revenue per Region + Revenue per Kategori
c1, c2 = st.columns(2)

with c1:
    st.subheader("Revenue per Region")
    region_data = filtered.groupby('Gudang')['Revenue'].sum().reset_index().sort_values('Revenue', ascending=False)
    fig_r = px.bar(region_data, x='Gudang', y='Revenue', color='Gudang',
                   color_discrete_sequence=PALETTE)
    fig_r.update_layout(showlegend=False, yaxis_tickformat=',.0f', height=350, margin=dict(t=10, b=10))
    st.plotly_chart(fig_r, use_container_width=True)

with c2:
    st.subheader("Revenue per Kategori Produk")
    cat_data = filtered.groupby('Kategori')['Revenue'].sum().reset_index().sort_values('Revenue', ascending=False)
    fig_c = px.pie(cat_data, names='Kategori', values='Revenue', color_discrete_sequence=PALETTE)
    fig_c.update_traces(textposition='inside', textinfo='percent+label')
    fig_c.update_layout(height=350, margin=dict(t=10, b=10))
    st.plotly_chart(fig_c, use_container_width=True)

# 3. Sales per Channel + Customer Type
c3, c4 = st.columns(2)

with c3:
    st.subheader("Sales per Sales Channel")
    ch_data = filtered.groupby('Platform')['Revenue'].sum().reset_index().sort_values('Revenue', ascending=False)
    fig_ch = px.pie(ch_data, names='Platform', values='Revenue', color_discrete_sequence=PALETTE)
    fig_ch.update_traces(textposition='inside', textinfo='percent+label')
    fig_ch.update_layout(height=350, margin=dict(t=10, b=10))
    st.plotly_chart(fig_ch, use_container_width=True)

with c4:
    st.subheader("Distribusi Tipe Pelanggan")
    ct_data = filtered.groupby('Status Plg.')['Revenue'].sum().reset_index().sort_values('Revenue', ascending=False)
    fig_ct = px.pie(ct_data, names='Status Plg.', values='Revenue', color_discrete_sequence=PALETTE)
    fig_ct.update_traces(textposition='inside', textinfo='percent+label')
    fig_ct.update_layout(height=350, margin=dict(t=10, b=10))
    st.plotly_chart(fig_ct, use_container_width=True)

# 4. Metode Pembayaran + Top 12 Customers
c5, c6 = st.columns(2)

with c5:
    st.subheader("Penggunaan Metode Pembayaran")
    pay_data = filtered.groupby('Jns Bayar')['Revenue'].sum().reset_index().sort_values('Revenue', ascending=False)
    fig_p = px.bar(pay_data, x='Jns Bayar', y='Revenue', color='Jns Bayar',
                   color_discrete_sequence=PALETTE)
    fig_p.update_layout(showlegend=False, yaxis_tickformat=',.0f', height=350, margin=dict(t=10, b=10))
    st.plotly_chart(fig_p, use_container_width=True)

with c6:
    st.subheader("Top Pelanggan by Revenue")
    cust_data = filtered.groupby('Nm. Pelanggan')['Revenue'].sum().reset_index().sort_values('Revenue', ascending=False).head(12)
    fig_cust = px.bar(cust_data, x='Nm. Pelanggan', y='Revenue', color_discrete_sequence=['#14b8a6'])
    fig_cust.update_layout(showlegend=False, yaxis_tickformat=',.0f', height=350, margin=dict(t=10, b=10))
    st.plotly_chart(fig_cust, use_container_width=True)

# 5. Discount vs Sales Scatter
st.subheader("Discount vs Sales (Scatter Plot)")
scatter_df = filtered[filtered['Revenue'] > 0][['Diskon', 'Revenue']].copy()
scatter_df['Diskon'] = scatter_df['Diskon'] * 100
fig_scatter = px.scatter(scatter_df, x='Diskon', y='Revenue', color_discrete_sequence=['#8b5cf6'],
                         opacity=0.6)
fig_scatter.update_layout(xaxis_title='Diskon (%)', yaxis_title='Revenue (Rp)',
                          yaxis_tickformat=',.0f', height=400, margin=dict(t=10, b=10))
st.plotly_chart(fig_scatter, use_container_width=True)

# 6. Top 10 Produk + Qty per Kategori
c7, c8 = st.columns(2)

with c7:
    st.subheader("Top 10 Produk Revenue Tertinggi")
    top10 = filtered.groupby('Nama Buku')['Revenue'].sum().reset_index().sort_values('Revenue', ascending=False).head(10)
    fig_t10 = px.bar(top10, x='Nama Buku', y='Revenue', color_discrete_sequence=['#f59e0b'])
    fig_t10.update_layout(showlegend=False, yaxis_tickformat=',.0f', height=400, margin=dict(t=10, b=10))
    st.plotly_chart(fig_t10, use_container_width=True)

with c8:
    st.subheader("Quantity Terjual per Kategori")
    qty_cat = filtered.groupby('Kategori')['Qty'].sum().reset_index().sort_values('Qty', ascending=False)
    fig_qc = px.bar(qty_cat, x='Kategori', y='Qty', color_discrete_sequence=['#10b981'])
    fig_qc.update_layout(showlegend=False, yaxis_tickformat=',.0f', height=400, margin=dict(t=10, b=10))
    st.plotly_chart(fig_qc, use_container_width=True)

# --- Footer ---
st.divider()
st.caption("Dashboard Penjualan 2026 — Data dari CSV, tanpa data dummy")
