# Potokuadrat PoC — Client Gallery satu halaman

Tanggal: 2026-11-12
Status: disetujui 2026-11-12; direvisi 2026-11-13 (cache thumbnail + strip metadata)
Induk: [2026-10-30-potokuadrat-client-gallery-design.md](2026-10-30-potokuadrat-client-gallery-design.md)

## 1. Intent

Membuktikan satu hal pada data Drive asli: klien dapat membuka satu halaman,
melihat grid foto yang cepat, memfilter, menandai favorit, membuka lightbox, dan
mengunduh file asli — tanpa Postgres, worker, auth, atau build step.

PoC ini bukan arsitektur produksi. Ia menjawab dua asumsi paling berisiko dari
spec induk (§9): service account dapat membaca folder yang di-share, dan grid
foto dapat tampil cepat.

## 2. Hasil pengukuran (2026-11-12)

Dijalankan langsung terhadap folder `1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ`:

- 269 file, semuanya `image/jpeg`, total 1,9 GB, flat tanpa subfolder, 6000×4000.
- `files.list` 20 entri: ~540 ms.
- `thumbnailLink` dapat di-resize dengan sufiks `=s400` / `=s1600`; hasil JPEG
  50 KB / 350 KB.
- 16 thumbnail paralel (list + fetch): 1,2 detik total.
- URL thumbnail tetap merespons tanpa header `Authorization`.
- Unduh asli 8 MB via `alt=media`: byte pertama 1,9 dtk, total 7,5 dtk.

Konsekuensi: PoC tidak memerlukan `sharp`, penyimpanan turunan, maupun SDK
`googleapis`.

### 2.1 Cache thumbnail dan format (2026-11-13)

- Thumbnail diambil sekali per file, dibersihkan dari metadata, lalu disimpan di
  `poc/.cache/thumbs/`. Cache hit ~1,4 ms; 20 thumbnail dingin paralel 1,2 detik.
- Cache 269 foto 400px: 14 MB (~52 KB/foto).
- Folder uji kedua berisi JPEG, HEIC, dan ARW asli 23,8 MB (TIFF, Sony ILCE-6400).
- Drive menyediakan `thumbnailLink` untuk ketiganya, sampai resolusi penuh:

| Format | `=s400` | `=s1600` | `=s2048` | Penuh |
|---|---|---|---|---|
| JPEG | 18 KB, ~650 ms | 111 KB | 162 KB | 6000×4000, 4,8 MB |
| HEIC | 50 KB, 416 ms | 386 KB | 550 KB | 5712×4284, 2,2 MB |
| ARW | 27 KB, 577 ms | 236 KB | 348 KB | 6024×4024, 1,9 MB |

- Thumbnail membawa EXIF dan XMP (Artist, Copyright, DateTimeOriginal). Tidak ada GPS
  di sampel. Filter segmen membuang `APP1` (EXIF+XMP), `APP13` (IPTC), dan `COM`
  tanpa decode; 356.729 → 355.968 byte, dimensi tetap, `exiv2` bersih.
- `thumbnailLink` kedaluwarsa dalam hitungan jam dan mengembalikan HTML, bukan
  gambar; menyimpannya di disk menghilangkan masalah ini dari klien.
- MIME tidak seragam: ARW dilaporkan `image/arw` (tetap diawali `image/`), sebagian
  RAW lain bisa `application/octet-stream` dan butuh cadangan ekstensi.

## 3. Scope

Termasuk:

- Server Node tanpa dependensi: token service account, daftar folder, proxy unduh.
- Satu halaman klien: grid, filter, favorit, lightbox, unduh.
- Konfigurasi lewat env dengan default ke key dan folder yang sudah diuji.

Tidak termasuk:

- Postgres, worker, antrean job.
- Auth pengguna, share mode, magic link, expiry.
- Analytics, branding per share, halaman fotografer.
- Turunan WebP lokal (`sharp`), zip, unduhan massal terarsip.
- Rekursi subfolder (folder uji flat).
- UI multi-bahasa; teks Inggris sesuai spec induk §17.

Catatan revisi 2026-11-13: HEIC dan RAW sudah diuji pada folder terpisah dan
ditangani lewat thumbnail Drive; lihat §2.1. Unduhan web 2048px sudah tersedia.
Yang belum: rekursi subfolder, watermark, dan toggle strip metadata (§8).

## 4. Arsitektur

Satu proses, tiga berkas:

```
poc/server.mjs   HTTP server + Drive client (node:http, node:crypto, fetch)
poc/index.html   struktur + CSS
poc/app.js       logika klien (modul, fungsi murni + wiring DOM)
```

Alur: server menandatangani JWT RS256 dengan `private_key` service account,
menukarnya di `oauth2.googleapis.com/token`, lalu memanggil Drive REST.
Daftar folder di-cache 60 detik di memori. Browser memuat thumbnail dari server
Potokuadrat; server mengambilkan `thumbnailLink` sekali, membuang metadatanya, dan
menyimpannya di cache disk. URL Drive tidak pernah sampai ke browser.

Endpoint:

- `GET /` → `index.html`
- `GET /app.js` → `app.js`
- `GET /api/gallery` → `{ album, photos[], fetchedAt }`; `thumb`/`preview` berupa
  path `/thumb/<id>?w=400|1600`
- `GET /thumb/:id?w=400|800|1600|2048` → JPEG dari cache, `immutable`, `ETag`,
  allow-list; `&download=1` menambahkan `Content-Disposition` dengan nama
  `<nama>-<lebar>.jpg`
- `GET /api/download/:id` → stream `alt=media`, `Content-Disposition: attachment`

## 5. Keputusan desain

- **Thumbnail Drive, bukan turunan lokal.** Ini yang membuat PoC jadi tiga
  berkas. Drive menyajikan JPEG untuk JPEG, HEIC, dan ARW, jadi tidak ada
  `sharp`/`heif-convert`/`exiftool`.
- **Thumbnail di-cache di disk dan dibersihkan metadatanya.** URL Drive yang
  sementara tidak lagi menjadi masalah, header immutable bisa dipasang, dan
  pembuangannya tidak butuh dependensi: filter segmen JPEG.
- **Unduhan asli diproxy.** `webContentLink` tidak dapat diakses browser anonim
  untuk file milik service account, jadi server yang mengalirkan.
- **ID unduhan divalidasi terhadap daftar album**, sehingga endpoint tidak
  menjadi proxy Drive terbuka.
- **`export` + `createGalleryServer(options)`** agar dapat diuji tanpa jaringan;
  server hanya listen saat dijalankan langsung.
- **Favorit di `localStorage`**, kunci per album, sesuai spec induk §8 untuk
  share anonim.
- **Tanpa zip.** Unduh favorit = beberapa unduhan berurutan.

## 6. Kriteria terima

- `node poc/server.mjs` lalu `http://localhost:3000` menampilkan 269 foto.
- Grid pertama tampil ≲2 detik setelah token hangat.
- Filter all/favorites/landscape/portrait bekerja; favorit bertahan setelah reload.
- Lightbox: panah, Esc, preload tetangga, tombol unduh.
- `GET /api/download/:id` mengembalikan file asli dengan nama dan ukuran sama.
- Unduhan web 2048px menghasilkan JPEG 2048×… dengan nama `<nama>-2048.jpg` dan tanpa
  metadata.
- Cache thumbnail: permintaan kedua tidak memanggil Drive, membalas `ETag` dan 304
  pada revalidasi, dan byte yang disajikan bebas EXIF/XMP.
- `node --test poc/` hijau tanpa kredensial Drive.

## 7. Risiko yang tersisa

- Kuota dan rate limit Drive per service account belum diuji pada beban besar.
- Dukungan thumbnail untuk format lain tetap milik Google; ARW sudah terbukti,
  format RAW lain belum.
- Cache tumbuh tanpa batas di PoC: 14 MB per 269 foto pada 400px. Produksi butuh
  batas ukuran dan eviction.
- RAW 3–8× lebih lambat saat pemanasan cache; album besar perlu pre-warm.
- Kunci service account berada di `~/secrets`, di luar repo; PoC tidak pernah
  mengirimnya ke browser.

## 8. Rencana: toggle strip metadata

**Status: belum diimplementasikan.** Bagian ini mencatat bentuk yang disepakati agar
tidak diimprovisasi saat dibangun.

PoC tidak punya share, jadi tingkatannya hanya satu: env. Produksi memakai dua
tingkat (organisasi + override share), lihat spec induk §10.2.

- `STRIP_EXIF=0` mematikan pembuangan metadata; default `1`.
- Berlaku hanya untuk thumbnail dan cache. Unduhan asli (`/api/download/:id`) tidak
  pernah ditulis ulang.
- Cache menyimpan dua varian: `<id>-<width>-clean.jpg` dan `<id>-<width>-raw.jpg`.
  Mode menjadi bagian dari kunci cache dan `ETag`, sehingga bytes bersih dan kotor
  tidak pernah berbagi entri.
- README wajib memuat peringatan: mode `raw` dapat mengirim GPS dan identitas
  fotografer ke browser.
- Tes: `STRIP_EXIF=0` menyajikan byte yang mengandung `APP1`; `STRIP_EXIF=1` tidak;
  keduanya tidak saling menimpa di cache; unduhan asli identik di kedua mode.

## 9. Status sinkronisasi 2026-11-13

- PoC sudah selesai dan menjadi **acuan port**, bukan kode yang dikirim apa adanya.
  Logikanya dipindahkan ke `src/server/drive/**` (JWT, paginasi, filter MIME,
  cache thumbnail, strip metadata, proxy unduh) dan diuji ulang dengan Vitest.
- Toggle strip metadata (§8) tetap belum ada di PoC. Di produksi fitur ini bagian
  dari v1 (spec induk §10.2), jadi statusnya "belum di PoC", bukan "opsional".
- Cache PoC menamai file `<id>-<width>.jpg` tanpa mode. Saat toggle dibangun,
  nama harus menjadi `<id>-<width>-<mode>.jpg` dan mode masuk ke kunci cache
  sekaligus `ETag`.
- Folder rekursif, watermark, dan zip tetap di luar PoC.
