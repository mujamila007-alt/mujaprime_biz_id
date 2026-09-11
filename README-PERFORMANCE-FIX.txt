MUJA PRIME PERFORMANCE V4

Perbaikan utama:
1. Vercel Functions dipaksa ke region sin1 agar dekat dengan Neon Singapore.
2. CREATE TABLE/CREATE INDEX tidak lagi dijalankan pada setiap cold start API. Schema hanya dipulihkan bila tabel benar-benar belum ada.
3. Dashboard admin memakai satu multiQuery, bukan enam request API terpisah.
4. Bukti pembayaran base64 tidak ikut dimuat pada daftar pesanan/dashboard. Bukti diambil hanya ketika tombol Lihat ditekan.
5. Foto profil tidak ikut dikirim ke dashboard.
6. Beranda memuat produk paralel dengan sinkronisasi akun, jadi katalog tidak menunggu query akun.
7. Error pesanan tidak lagi tampak seperti kondisi kosong.

Setelah deploy, lakukan Ctrl+F5 sekali.
