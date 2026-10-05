# Berau Palm Oil Mill - Oil Sounding Tank

Versi desain baru dengan History di bagian paling bawah.

## Struktur
- `index.html` tampilan utama
- `styles.css` desain
- `app.js` perhitungan + Excel + History Supabase
- `tank.png` ilustrasi tank
- `data/ST 1.xlsx` sampai `ST 4.xlsx` kalibrasi
- `data/density.xlsx` density + correction factor
- `supabase-config.js` koneksi Supabase

## Rumus utama
Untuk ullage/dipp, semakin besar ullage maka volume minyak semakin kecil.
Jika dipp berada di antara dua titik kalibrasi:

`Volume Oil = Volume Dasar - (Selisih Ullage × L/cm)`

Massa sebelum factor:

`Volume Oil (L) × Density / 1000`

VMT:

`Massa × Correction Factor`

## Supabase
Isi `supabase-config.js` dengan URL project dan publishable/anon key. Jangan gunakan service_role key.
