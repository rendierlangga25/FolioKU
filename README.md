# RAXER ERP

ERP operasional armada: landing page, daftar/login (ingat saya, lupa password), akses fitur per user yang diatur owner, input driver (dengan draft & foto dokumen), dan panel owner (ARMADA + ringkasan).

Stack: React + Vite, Supabase (Auth, Postgres, Storage), deploy Vercel. OCR KM memakai Tesseract.js di browser, dibaca dari foto yang sudah dipotong ke kotak bidik.

## Coba cepat (mode demo)
```
npm install
npm run dev
```
Tanpa env Supabase, aplikasi jalan di mode demo (data di browser).
Developer `owner@raxer.test / owner123`, driver `driver@raxer.test / driver123`.

## Pasang dengan Supabase
1. Buat project di supabase.com.
2. SQL Editor → tempel & jalankan `supabase/schema.sql`.
   **Sudah punya database dari versi sebelumnya?** Jangan jalankan ulang schema — cukup jalankan `supabase/migrations/2026-10-revisi-driver.sql` (menambah kolom foto & tabel daftar tujuan, data lama aman).
3. Authentication → URL Configuration: isi **Site URL** dengan domain Vercel Anda dan tambahkan `https://DOMAIN/reset-password` ke Redirect URLs (untuk lupa password).
4. Salin `.env.example` → `.env.local`, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
5. `npm run dev` untuk lokal, atau push ke GitHub → import ke Vercel dan isi dua env yang sama.
6. **Daftar pertama = OWNER.** Daftar akun owner lebih dulu, baru bagikan link ke driver. Driver baru belum punya akses sampai owner mencentang fitur di menu *USER*.

Opsional: Authentication → Providers → Email → matikan "Confirm email" bila tidak ingin verifikasi email. Email bawaan Supabase terbatas jumlah kirimnya; untuk produksi pasang SMTP sendiri.

## Alur driver (Operasional › Driver)
- **Tujuan**: dropdown yang juga bisa diketik manual. Daftar dikelola owner di *Master Data › Daftar tujuan*; tujuan baru yang diketik driver otomatis masuk daftar setelah data dikirim.
- **Foto KM** (awal, saat isi BBM, akhir): tombol **Kamera** membuka kamera dengan *kotak bidik* — foto otomatis terpotong & ter-zoom ke angka ODO. **Galeri** membuka editor geser/zoom dengan kotak yang sama. Angka KM dibaca otomatis (OCR) dari foto yang sudah dipotong dan selalu bisa dikoreksi.
- **Draft**: KM isi BBM & KM akhir tak bisa diisi saat masih di jalan, jadi form bisa **Simpan sementara** (tersimpan otomatis di HP, termasuk foto). Data baru masuk database saat **Kirim data**, setelah semua wajib lengkap. Tol & parkir opsional dan tidak menahan pengiriman.
- **Dokumen**: foto bukti serah terima customer (wajib), foto surat jalan bertanda tangan (wajib), foto + keterangan kendala (opsional).
- Kamera langsung butuh HTTPS (Vercel otomatis) atau `localhost`; bila izin kamera ditolak, tersedia Galeri / kamera bawaan HP.

## Menu
- **LOGISTIC › DRIVER** — satu menu dengan dua tab: **INPUT** (perjalanan, draft, foto KM, dokumen) dan **RIWAYAT** (input milik sendiri; OWNER, LEADER, SPV, ADMIN & MANAGER melihat semua driver dengan filter nama driver & plat). Database lama: jalankan `supabase/migrations/2026-10-revisi-9-riwayat-leader.sql`, lalu `2026-10-revisi-10-sisa-bbm-setting.sql`.
- **Foto sisa bar bensin** — opsional di tab INPUT (bagian Dokumen). Di tab RIWAYAT tampil di sisi kanan kartu; ketuk → LIHAT / UPLOAD (geser & zoom, seperti foto profil) / HAPUS. Yang bisa mengubah: pembuat input & developer.
- **MASTER DATA › RIWAYAT UNTUK SEMUA USER** — saklar: bila aktif, semua user melihat riwayat seluruh driver.
- Istilah "Owner" di tampilan diganti **DEVELOPER** (nilai peran di database tetap `owner`).
- **LOADING DOCK** (menu baru, izin `LOADING DOCK` diberikan owner di menu *USER*) — tiga tab:
  - **INTERNAL**: kategori **REGULER** (nomor SO + nama perusahaan + foto loading = bukti SO sudah di-loading), **OTOMOTIF** dan **MOVESTOCK** (nama expedisi + nama perusahaan + foto loading). Tanggal tercatat otomatis hari ini.
  - **EKSTERNAL**: tanggal (otomatis hari ini, paling atas, bisa diubah), nama expedisi, nama perusahaan, foto loading, dan foto SJ yang sudah ditandatangani.
  - **RIWAYAT**: semua upload, dengan filter tanggal, Internal/Eksternal, kategori (untuk Internal), nama perusahaan, dan nama expedisi (untuk Eksternal). Foto dibuka lewat tombol LIHAT FOTO; developer bisa menghapus upload.
  - Nama perusahaan & nama expedisi: dropdown yang juga bisa diketik manual; nama baru otomatis tersimpan ke daftar. Developer mengelola daftarnya di **MASTER DATA › DAFTAR PERUSAHAAN / DAFTAR EXPEDISI** (tambah, ganti nama, sembunyikan, hapus).
  - Database lama: jalankan `supabase/migrations/2026-10-revisi-11-loading-dock.sql`.
- **REPORT › REPORT LOGISTIC** — khusus developer (owner). Form sederhana: *Pilih Kategori Report*, kendaraan, driver, sumber foto, tipe tanggal (Semua / Tahunan / Bulanan / Rentang), lalu **Unduh**. Kategori:
  - **Data Pengiriman**, **Rekap Biaya Logistic** (per armada, driver, bulan, komponen), **Performa Driver & Armada**, **Loading Dock**, **Master Data** → file **Excel (.xlsx)** bergaya sama dengan ekspor tabel (header navy, baris TOTAL berumus SUM, format Rp/tanggal, filter kolom). Total Bea di sini = BBM + Toll + Parkir + Parkir Cash + Kuli Bongkar + Security (tidak bergantung kolom yang di-hide di tabel).
  - **Backup Seluruh Data** → ZIP: `excel/RAXER-DATA-LENGKAP.xlsx` + `json/<tabel>.json` (isi mentah, termasuk path foto) + `BACA-DULU.txt`. Data dibaca per 1000 baris sampai habis, jadi tidak terpotong. Foto tidak ikut.
  - **Foto Bukti (ZIP berfolder)** → `PENGIRIMAN / 2026 / 10 OKTOBER / B 9075 PCR - DUTRO / 2026-10-05 - CEPI & RANTA - ADM SUNTER (a1b2c3) / 1 KM AWAL.jpg` dan `LOADING DOCK / 2026 / 10 OKTOBER / INTERNAL - REGULER / …`. Tombol *Periksa Foto* menampilkan jumlah & perkiraan ukuran dulu; hasil dipecah jadi beberapa ZIP (≤ 200 MB per file); foto gagal dilewati dan dicatat di `_GAGAL.txt`; `_DAFTAR FOTO.csv` berisi daftar semua foto.
  - **Status penyimpanan** (di halaman yang sama): meteran database & foto, tren foto per bulan, tabel terbesar, perkiraan kapan penuh. Bila ≥ 80% muncul banner **HAMPIR PENUH**, ≥ 95% **KRITIS** (plus titik merah di menu) — hanya untuk akun OWNER. Batas bawaan = paket gratis Supabase (500 MB database, 1 GB foto); setelah upgrade ubah lewat *Atur Batas & Peringatan*.
  - Database lama: jalankan `supabase/migrations/2026-10-revisi-16-report-storage.sql` (fungsi `storage_usage()` & `set_storage_limits()`, khusus owner).
- **LOGISTIC › ARMADA** — (dulu *Database Driver*) tabel seluruh data + ringkasan, bisa diedit/dihapus owner.
- **PROFIL** — terbuka untuk semua user. Tab **PROFIL**: foto (kamera/galeri), nama lengkap, ID karyawan, departemen, jabatan, lencana & border tier, bar XP, lencana efisien, riwayat tier per tahun. Tab **PERFORMA**: peringkat KM/L per bulan semua driver (klik untuk lihat profil), juara tiap bulan. Data karyawan diisi owner di *MASTER DATA › Nama driver › ikon profil*; akun user ditautkan ke driver di menu *USER › Data driver terkait*.
- **USER** — (dulu *Pengguna & Akses*) atur akses fitur tiap pengguna.
- Semua tulisan menu dan judul ditampilkan HURUF KAPITAL. Kolom KM/L di tabel tidak menampilkan angka per driver; itu hanya ada di tab Ringkasan.
- **LOGISTIC › BIAYA LOGISTIC** — tabel biaya semua pengiriman: Tanggal, Driver 1/2, No Plat, Tujuan, KM Awal/Isi/Akhir, Jarak, KM/L, BBM, Toll, Parkir, Parkir Cash, Kuli Bongkar, Security, Total Bea, Ritase (jumlah tujuan dalam 1 pengiriman), No Kartu. Kolom bisa di-hide/diurut lewat **Atur kolom** (tersimpan per perangkat); tab **Ringkasan** berisi tabel per No Plat & per Driver, ikut menyesuaikan kolom yang di-hide. Aktifkan per pengguna di *USER*.
- Huruf seluruh aplikasi: Calibri (Carlito sebagai pengganti otomatis di perangkat tanpa Calibri).

## Rumus
- Total jarak = KM akhir − KM awal
- Liter = Rp BBM ÷ harga per liter (harga tersimpan per input)
- KM/liter = jarak ÷ liter
- Jarak, BBM, liter **dan KM/liter** dibagi 2 bila ada 2 driver; 1 driver tidak dibagi. Contoh: KM/L mobil 5,36 → per driver 2,68 (`src/lib/calc.js`)
- Tes: `npm run test:calc` (rumus) dan `npm run test:lib` (crop foto, OCR, aturan kelengkapan)

## XP, tier, dan peringkat (`src/lib/tiers.js`, `src/lib/rank.js`)
- 5 XP per pengiriman selesai (tiap driver yang ikut). 100 XP = naik 1 tier = 20 pengiriman; target ±1 tier per 23 hari (≈1 pengiriman/hari kerja).
- 12 tier: Bronze, Silver, Gold, Platinum, Diamond, Crown, Ace, Ace Master, Ace Dominator, Conqueror, Mythic, Immortal. Border & tampilan profil berubah per tier. Direset 1 Januari; riwayat tahun lalu tetap tampil (dihitung dari data pengiriman).
- Peringkat efisiensi = total jarak ÷ total liter BBM (nilai penuh, tidak dibagi 2 driver), minimal 3 pengiriman sebulan. Peringkat 1 mendapat lencana "KM/L #1" (bulan berjalan = sementara).
- **Database lama:** jalankan `supabase/migrations/2026-10-revisi-profil.sql` (kolom profil, tautan akun→driver, fungsi statistik).
