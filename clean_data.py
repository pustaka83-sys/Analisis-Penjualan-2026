#!/usr/bin/env python3
"""
clean_data.py — Membersihkan Penjualan 2026.csv tanpa mengubah raw data.
Output: Penjualan 2026_clean.csv
"""

import csv
import sys

INPUT = 'Penjualan 2026.csv'
OUTPUT = 'Penjualan 2026_clean.csv'

BULAN_MAP = {
    '1': 'Jan', '01': 'Jan',
    '2': 'Feb', '02': 'Feb',
    '3': 'Mar', '03': 'Mar',
    '4': 'Apr', '04': 'Apr',
    '5': 'May', '05': 'May',
    '6': 'Jun', '06': 'Jun',
    '7': 'Jul', '07': 'Jul',
    '8': 'Agu', '08': 'Agu',
    '9': 'Sep', '09': 'Sep',
    '10': 'Okt',
    '11': 'Nov',
    '12': 'Des',
}


def parse_rp(val):
    """Parse 'Rp. 200.000' ke float."""
    if not val or not val.strip():
        return 0.0
    s = val.replace('Rp.', '').replace('Rp', '').strip()
    s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0.0


def diskon_persen(harga, qty, total):
    """Hitung diskon % dari selisih harga wajar vs total."""
    expected = harga * qty
    if expected <= 0 or total <= 0:
        return 0.0
    d = (1 - total / expected) * 100
    return round(d, 1) if d > 0 else 0.0


def main():
    with open(INPUT, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    original_count = len(rows)
    cleaned = []
    dropped_empty = 0

    for r in rows:
        nota = r['No Nota'].strip()
        kditem = r['Kditem'].strip()

        # Step 1: Drop baris kosong total
        if not nota and not kditem:
            dropped_empty += 1
            continue

        # Step 3: Bulan dari Tgl jika kosong (handle - dan / sebagai separator)
        if not r['Bulan'].strip() or r['Bulan'].strip() == '0':
            tgl = r['Tgl']
            parts = tgl.replace('/', '-').split('-')
            if len(parts) >= 2:
                month_num = parts[1].lstrip('0') or '0'
                r['Bulan'] = BULAN_MAP.get(month_num, '')

        # Step 3: Platform dari Jns Bayar jika kosong
        if not r['Platform'].strip():
            jns_bayar = r['Jns Bayar'].strip().lower()
            if jns_bayar == 'shopee':
                r['Platform'] = 'Shopee'

        # Step 4: Fix Kditem='1'
        if kditem == '1':
            r['Kditem'] = 'SIP000001'

        cleaned.append(r)

    # Step 5: Tambah kolom Diskon_Persen
    fieldnames = list(fieldnames) + ['Diskon_Persen']
    for r in cleaned:
        harga = parse_rp(r['Harga'])
        qty = float(r['Qty Jual']) if r['Qty Jual'].strip() else 0
        total = parse_rp(r['Total'])
        r['Diskon_Persen'] = str(diskon_persen(harga, qty, total))

    # Tulis output
    with open(OUTPUT, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(cleaned)

    print(f'Raw data:          {original_count} baris')
    print(f'Dropped (kosong):  {dropped_empty} baris')
    print(f'Output bersih:     {len(cleaned)} baris')
    print(f'File output:       {OUTPUT}')


if __name__ == '__main__':
    main()
