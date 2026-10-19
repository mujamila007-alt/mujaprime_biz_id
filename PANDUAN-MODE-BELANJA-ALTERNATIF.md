# MODE ALTERNATIF MUJA PRIME (tanpa Firebase)

Website utama dan semua data Firestore TIDAK DIHAPUS. File asli `index.html`, `admin.html`, `api/db.js`, dan konfigurasi database tetap ada.

## A. Tentukan link situs alternatif (WAJIB)

Buka file `mulai-membeli.html`. Cari baris ini di bagian bawah:

```js
const LINK_SITUS_ALTERNATIF = "";
```

Ganti dengan HTTPS situs tujuan kamu, misalnya:

```js
const LINK_SITUS_ALTERNATIF = "https://contoh-tokoku.com";
```

**Jangan pakai URL milik MUJA PRIME sendiri** dan jangan deploy sebelum URL ini diatur. Tombol akan nonaktif bila URL belum diisi atau salah. Link contoh di atas bukan situs nyata yang dijamin ada.

## B. Mode sementara AKTIF (default berkas ini)

Di `vercel.json` terdapat pengaturan `routes` sebagai berikut:

```json
"routes": [
  {
    "src": "^/(?:$|index(?:-old)?\\.html$|detail-produk\\.html$|list-produk(?:-2)?\\.html$|(?:semua-produk|payment|akun-saya|tukar-point|top-pembeli|user-join)(?:/.*)?$)",
    "dest": "/mulai-membeli.html"
  }
]
```

Saat AKTIF, halaman utama dan halaman belanja umum menampilkan `mulai-membeli.html` tanpa menjalankan kode Firestore toko tersebut. URL browser tetap situs MUJA PRIME. Admin tidak diubah. URL seperti `/api/db` tidak diarahkan.

## C. Setelah kuota harian pulih: Mode NONAKTIF

1. Buka `vercel.json`.
2. Pada properti `routes` -> `src`, ganti seluruh teks nilai `src` menjadi:

```json
"src": "^/__mode_toko_nonaktif__$"
```

3. Simpan, commit ke GitHub, tunggu Vercel berstatus **Ready**.
4. Buka web MUJA PRIME. Halaman utamanya akan tampil dari file `index.html` seperti sebelumnya.

**Untuk mengaktifkan lagi**, ganti `src` ke pola panjang seperti pada bagian B di atas (salin dari panduan ini). Jangan mengubah `dest`.

Tidak ada panel admin yang perlu dibuka untuk mengganti mode ini. Setiap perubahan `vercel.json` harus di-deploy ulang.

## D. Cara pemasangan tercepat (patch)

ZIP PATCH berisi `vercel.json`, `mulai-membeli.html`, dan panduan ini saja.

1. Simpan salinan `vercel.json` asli jika diperlukan.
2. Ekstrak ZIP PATCH dan taruh semua berkas di root repository (selevel `index.html`).
3. Isi `LINK_SITUS_ALTERNATIF` sesuai bagian A.
4. Commit dan push ke GitHub yang terhubung ke Vercel.
5. Uji `https://www.mujaprime.biz.id/` dan tombol "Mulai Membeli" setelah deploy selesai.

**Yang berubah:** Routing pengunjung ke halaman statis yang tidak mengakses Firebase, bukan penambahan/pemulihan jatah Firestore.

**Batasan:** Mode ini manual. Setelah kuota reset, mode TIDAK berubah sendiri; matikan lewat `vercel.json` dan deploy lagi. Alamat halaman admin dan endpoint API tetap ada. Seseorang yang mengakses API langsung masih bisa menimbulkan reads; gunakan kontrol server-side/rate limit jika perlu. Service worker lama biasanya memakai strategi network-first untuk halaman, namun jika masih melihat cache lama, refresh paksa Ctrl+Shift+R. Pastikan komputer online.
