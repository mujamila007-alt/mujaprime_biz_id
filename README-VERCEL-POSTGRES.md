# Muja Prime - Vercel + PostgreSQL

Versi ini sudah tidak memakai Firebase/Firestore sebagai database aplikasi.

## Arsitektur

- Frontend: HTML, CSS, JavaScript
- Hosting: Vercel
- Backend: Vercel Functions (`/api/*`)
- Database: PostgreSQL melalui Neon Native Integration di Vercel
- Admin session: cookie HttpOnly dari Vercel Function
- AI: Vercel Function `/api/ai`, API key tidak disimpan di browser

> Catatan: Neon adalah database PostgreSQL yang terintegrasi native di Vercel Marketplace. Database bukan file yang disimpan di deployment Vercel.

## Yang sudah diubah

- Semua file `.php` menjadi `.html` atau `.json`.
- Parameter `?id=` dan `?group=` dibaca dengan `URLSearchParams`.
- Firebase SDK dan konfigurasi Firebase dihapus.
- `firebase-config.js` sekarang hanya compatibility layer lokal. Namanya dipertahankan agar ratusan pemanggilan JavaScript lama tidak perlu ditulis ulang. File tersebut TIDAK menghubungi Firebase.
- Semua operasi data diarahkan ke `/api/db`.
- Firestore `serverTimestamp`, `increment`, `arrayUnion`, batch, transaction, dan polling pengganti `onSnapshot` didukung.
- Password admin tidak lagi berada di `admin.html`.
- Groq API key tidak lagi berada di frontend.
- URL `.php` lama mendapat redirect melalui `vercel.json`.

## Collection lama yang didukung

1. access_tokens
2. ai_chat_logs
3. app_installs
4. app_stats
5. collection_items
6. deleted_accounts
7. email_logs
8. leaderboard
9. manual_members
10. orders
11. poin_products
12. poin_redeems
13. products
14. registered_emails
15. registrations
16. sections
17. settings
18. user_poins

Semua disimpan di PostgreSQL pada tabel `muja_documents` menggunakan kolom `JSONB`. Document ID Firestore tetap dipertahankan.

## 1. Buat database dari Vercel

1. Buka project di Vercel.
2. Buka Marketplace/Storage/Database.
3. Pilih Neon Postgres.
4. Pilih Create New Neon Account / database baru.
5. Hubungkan ke project ini.
6. Pastikan environment variable `DATABASE_URL` tersedia di project Vercel.

Tabel akan dibuat otomatis ketika `/api/db` pertama kali dipanggil. File `schema.sql` juga disediakan jika ingin membuat tabel manual.

## 2. Environment Variables wajib

Tambahkan di Vercel Project Settings -> Environment Variables:

```env
DATABASE_URL=...               # biasanya dibuat otomatis oleh integrasi Neon
ADMIN_EMAIL=alamat-admin-anda
ADMIN_PASSWORD=password-kuat-baru
AUTH_SECRET=random-secret-minimal-32-karakter
GROQ_API_KEY=api-key-groq-baru
```

Jangan upload `.env` atau Service Account ke GitHub.

Karena Groq key lama pernah tersimpan di source browser, revoke key lama dan buat key baru.

## 3. Migrasi data Firestore lama

Kode aplikasi sudah tidak membutuhkan Firebase. Namun isi data lama tetap harus dipindahkan sekali dari Firestore ke PostgreSQL.

### Persiapan

1. Dari Firebase Console, buka Project Settings -> Service Accounts.
2. Generate New Private Key.
3. Simpan sebagai contoh `serviceAccountKey.json` di komputer Anda.
4. JANGAN upload file tersebut ke GitHub atau Vercel.
5. Ambil `DATABASE_URL` dari Neon/Vercel.

### Windows PowerShell

Di folder project:

```powershell
npm install
$env:DATABASE_URL="postgresql://..."
$env:FIREBASE_SERVICE_ACCOUNT_FILE="C:\path\serviceAccountKey.json"
npm run migrate:firestore
```

Script akan membaca 18 collection Firestore dan melakukan upsert ke PostgreSQL dengan document ID yang sama.

Jika migrasi selesai, output akan menampilkan jumlah dokumen tiap collection dan total dokumen.

## 4. Deploy

Setelah environment variables terisi:

```bash
vercel --prod
```

Atau push project ke GitHub lalu deploy melalui dashboard Vercel.

## 5. Pengujian setelah deploy

Periksa:

- Beranda menampilkan produk.
- `detail-produk.html?id=...` menampilkan detail produk.
- `list-produk.html?group=...` dan `list-produk-2.html?group=...` berfungsi.
- Registrasi akun dapat membaca/menyimpan data.
- Pembayaran membuat `orders` dan `access_tokens`.
- Halaman status dapat memakai access token satu kali.
- Poin bertambah dan Tukar Poin berjalan.
- `admin.html` meminta password server-side.
- `/adminuser-aktif/` login dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`.
- AI chat bekerja setelah `GROQ_API_KEY` diisi.
- Buka `/api/health`. Jika database tersambung, respons berisi `"ok": true` dan `"database": "postgresql"`.

## Catatan keamanan

Admin login sudah dipindahkan ke server-side session. Model akun pelanggan yang lama masih menggunakan email/WhatsApp dan localStorage tanpa password pelanggan. Migrasi ini mempertahankan perilaku tersebut agar aplikasi tidak rusak. Jika dibutuhkan, tahap berikutnya sebaiknya menambahkan autentikasi pelanggan berbasis OTP/email magic link agar perubahan poin dan data akun dapat diberi otorisasi yang lebih ketat.
