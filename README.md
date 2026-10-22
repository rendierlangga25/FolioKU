# FolioKu: Portofolio Online Berlangganan (React + Vite + Tailwind + Supabase)

- Landing page `/` (hero, contoh, harga, metode pembayaran, FAQ), `/demo` (contoh interaktif)
- Daftar `/daftar`, masuk `/masuk`, lupa password `/reset`
- Dashboard pelanggan `/app` (edit portofolio, langganan, riwayat bayar)
- Portofolio publik tiap pelanggan: `/u/username`
- Panel owner `/owner`: ringkasan, paket & harga, **pesanan (setujui/tolak)**, **metode pembayaran**, pelanggan, pengaturan landing
- **Pembayaran manual tanpa payment gateway**: QRIS, e-wallet, transfer bank (akun diatur sendiri oleh owner)

## 1. Database (Supabase > SQL Editor), jalankan berurutan, masing-masing SEKALI
1. `database/schema.sql` (hanya jika database masih kosong)
2. `database/update-2.sql` (hanya jika belum pernah)
3. `database/update-3-saas.sql`
4. `database/update-4-pembayaran-manual.sql`
5. `database/update-5-balas-pesan-dan-ringkasan.sql`
6. **`database/update-6-masukan.sql`** (baru: tabel Saran & Masukan dari landing page)

Authentication > Providers > Email: pastikan **Allow new users to sign up** AKTIF.
Authentication > URL Configuration: isi **Site URL** dengan domain websitemu (contoh `https://portofolio-vif8.vercel.app`) dan tambahkan `https://portofolio-vif8.vercel.app/**` di **Redirect URLs**. Jika tidak, link konfirmasi email akan mengarah ke `localhost:3000`.

## 2. Deploy (Vercel)
Upload isi folder ke GitHub (tanpa node_modules/dist), import ke Vercel. Environment Variables yang dibutuhkan hanya:
`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (lihat `.env.example`). Tidak perlu key payment gateway apa pun.
Opsional: `VITE_SITE_URL` (mis. `https://domainmu.com`) untuk memaksa domain yang dipakai di link email; jika kosong otomatis memakai domain yang sedang dibuka.

## 3. Mengatur pembayaran (login sebagai owner)
1. **Owner > Metode Pembayaran**: ubah contoh yang ada atau tambah baru (QRIS, GoPay, DANA, BCA, dst). Isi nama, atas nama, nomor, upload gambar QRIS, petunjuk, lalu centang **Aktif**. Hanya yang aktif tampil ke pelanggan.
2. **Owner > Paket & Harga**: atur harga dan lama aktif (kosong = Lifetime).
3. **Owner > Pengaturan Landing**: isi WhatsApp/email bantuan dan perkiraan waktu verifikasi.

## 4. Alur pembayaran
Pelanggan pilih paket > sistem membuat nominal unik (harga + 3 digit) > pelanggan bayar tepat nominal > upload bukti > pesanan masuk **Owner > Pesanan** (tab "Perlu dicek") > kamu cek uang masuk di aplikasi GoPay Merchant/mutasi bank > klik **Setujui** (langganan langsung aktif) atau **Tolak** (dengan alasan).
Jangan menyetujui hanya dari gambar bukti. Selalu cocokkan dengan uang yang benar-benar masuk, karena bukti bisa dipalsukan.

## Catatan
- Kode Midtrans lama disimpan di folder `opsional-midtrans/` (tidak dipakai).
- Templat Syarat/Privasi (`src/pages/landing/Legal.jsx`) bersifat umum. Sesuaikan, termasuk kebijakan refund.
