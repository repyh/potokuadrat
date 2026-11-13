# Potokuadrat — Client Gallery di atas Google Drive

Tanggal: 2026-10-30
Status: disetujui 2026-10-30; direvisi 2026-11-13 (§6, §7, §9, §10, §11, §12, §17, §18, §19, §20, §21, §22, §23, §24)

Revisi 2026-11-13: pipeline turunan lokal ditunda ke v2. Pengukuran pada folder uji
menunjukkan Drive sendiri menghasilkan thumbnail untuk JPEG, HEIC, dan RAW sampai
resolusi penuh, sehingga v1 tidak memuat `sharp`, `exiftool`, maupun `libheif`.
Lihat §10.

Revisi implementasi 2026-11-13: dokumen ini dipindahkan ke repo implementasi,
`docs/specs/`. Nama produk tetap Potokuadrat. Backend menjadi Postgres self-hosted
(Supabase dihapus), design system sendiri menggantikan shadcn/ui, autentikasi memakai
Better Auth, dan unduhan zip masuk v1. Lihat ADR di `docs/adr/` dan §24.

## 1. Intent dan alasan

Fotografer dan organisasi dokumentasi sudah menyimpan foto mentah di Google Drive,
tetapi Drive bukan etalase: link-nya tidak profesional, thumbnail lambat dan kecil,
tidak ada filter atau seleksi, tidak ada kontrol akses, dan tidak ada branding.

Potokuadrat adalah aplikasi web **client gallery** yang self-hosted dan open source:
Drive tetap menjadi sumber penyimpanan asli, sementara Potokuadrat menyediakan
pengalaman melihat, memilih, dan mengunduh yang cepat dan berlabel brand fotografer.

Yang dibangun adalah perangkat lunak, bukan layanan. Satu instalasi melayani satu
organisasi.

## 2. Goals

- Fotografer menghubungkan folder Google Drive dan membuat album dari satu atau
  beberapa folder sekaligus.
- Klien membuka satu link, melihat grid foto yang cepat dan responsif di ponsel,
  memfilter, menandai favorit, dan mengunduh dalam kualitas pilihan.
- Album dapat dibagikan ke banyak klien dengan pengaturan akses berbeda per share.
- Fotografer dapat membranding halaman klien dan melihat analytics dasar.
- Berjalan di satu VPS dengan Docker Compose, tanpa layanan berbayar tambahan.

## 3. Non-goals

- Marketing, CRM, scheduling, kontrak, invoice, toko/cetak.
- Editing foto, retouching, atau penyimpanan file asli di server Potokuadrat.
- Alur proofing: klien tidak mengirim daftar pilihan balik ke fotografer, tidak ada
  status approval, tidak ada notifikasi seleksi.
- Video.
- Multi-tenant SaaS, billing, atau isolasi antar-organisasi.
- Watermark (kandidat v2).
- Sinkronisasi dua arah ke Drive; Potokuadrat hanya membaca.

## 4. Anti-goals

- Menjadi pengganti Drive atau tempat backup.
- Menyalin seluruh Drive pengguna.
- Menyimpan file asli dalam jangka panjang.
- Mengunci pengguna pada penyedia storage tertentu.

## 5. Pengguna dan peran

- **Admin organisasi** — mengelola pengguna, koneksi Drive, branding default, dan
  semua album.
- **Fotografer (member)** — membuat dan mengelola album miliknya, mengirim share.
- **Klien** — tanpa akun. Identitas hanya berupa email pada mode magic link.

## 6. Domain

- **Organization** — satu per instalasi; menyimpan nama, logo, warna, pengaturan
  default, dan kebijakan metadata thumbnail (`strip_metadata`, default aktif). SMTP
  tidak disimpan di sini; lihat §16.
- **User** — anggota organisasi; email, password hash, peran.
- **DriveFolder** — folder Drive yang dibagikan ke service account dan terdaftar di
  Potokuadrat; menyimpan Drive folder ID, nama, dan pemilik (user).
- **Album** — kumpulan foto untuk satu event; terdiri dari satu atau lebih DriveFolder;
  punya judul, slug, cover, status indexing.
- **Photo** — satu file gambar di Drive; menyimpan Drive file ID, nama, ukuran, dimensi,
  EXIF terpilih, urutan, dan status thumbnail (`pending`/`ready`/`failed`).
- **Share** — satu pengiriman album ke satu audiens; punya mode akses, subset foto,
  expiry, izin unduh, slug, branding override, dan override kebijakan metadata
  (`strip_metadata` null = ikut organisasi).
- **ClientSession** — sesi klien setelah magic link ditukar; terikat email dan share.
- **Favorite** — foto yang ditandai klien; disimpan di server untuk sesi beridentitas,
  di localStorage untuk link anonim.
- **DownloadEvent / ViewEvent** — catatan analytics.

Satu album boleh punya banyak share. Share adalah unit kontrol akses, bukan album.

## 7. Alur utama

### Fotografer

1. Admin membuat service account dan menambahkan kuncinya ke konfigurasi server.
2. Fotografer membagikan folder Drive ke email service account (Viewer), atau
   memindahkan folder ke Shared Drive tempat service account menjadi anggota.
3. Di Potokuadrat, fotografer menambahkan folder lewat daftar `sharedWithMe` dan Shared
   Drives yang terlihat oleh service account, atau dengan menempel URL folder Drive.
   Keduanya wajib; tempel URL adalah jalur cadangan ketika folder tidak muncul di
   daftar (mis. kebijakan Workspace).
4. Fotografer membuat album, memilih satu atau beberapa folder, dan menyimpan.
5. Album masuk status `indexing`; worker membaca daftar file dan menyimpan metadata.
   Tidak ada file asli yang diunduh. Setelah metadata siap, cache thumbnail
   dipanaskan di latar belakang.
6. Setelah selesai, fotografer mengatur cover, urutan, dan membuat share.
7. Fotografer mengirim link (salin manual atau email via SMTP).

### Klien

1. Membuka link share.
2. Sesuai mode: langsung masuk, memasukkan password, atau menukar magic link.
3. Melihat grid, memfilter, menandai favorit, membuka lightbox.
4. Mengunduh semua atau hanya favorit, pada kualitas yang diizinkan.

## 8. Mode akses share

- **Public** — siapa pun dengan URL. Slug acak, tidak dapat ditebak.
- **Password** — slug + password; password disimpan sebagai hash, sesi via cookie
  bertanda tangan.
- **Magic link** — share memiliki daftar email penerima; setiap email menerima link
  bertoken sekali pakai yang ditukar menjadi sesi klien. Favorit dan riwayat unduhan
  terikat ke email tersebut.

Semua mode mendukung: expiry, nonaktifkan unduhan, batasi kualitas unduhan, dan
subset foto.

## 9. Integrasi Google Drive

**Keputusan: service account sebagai jalur utama.** Alasan: Google Picker dengan
scope `drive.file` tidak memberi akses ke file yang sudah ada di dalam folder yang
dipilih, sedangkan scope `drive.readonly` bersifat restricted dan menuntut verifikasi
serta security assessment tahunan. Service account membaca folder yang dibagikan
kepadanya tanpa consent screen dan tanpa verifikasi, dan bekerja untuk akun Gmail
pribadi maupun Workspace.

- Scope yang diminta: `drive.readonly` pada service account. Scope ini tidak melewati
  OAuth consent karena bukan user flow.
- Kunci service account disimpan di secret/env server, tidak pernah dikirim ke browser.
- Pembatasan laju: batas konkurensi unduhan per service account (default 4), backoff
  eksponensial pada 429/5xx, dan kuota query Drive dipantau.
- File asli tidak diunduh saat indexing. Server hanya mengambil thumbnail dari
  `thumbnailLink` sesuai kebutuhan, menyimpannya di cache sementara, dan menghapusnya
  tanpa menyentuh file asli. Unduhan asli selalu di-proxy saat klien memintanya.
- Pembaruan album: tombol "re-index" membaca ulang folder; file baru ditambahkan,
  file yang hilang ditandai.
- Kegagalan akses (folder di-unshare, akun dihapus) membuat album menampilkan status
  tidak tersedia, bukan error mentah.

**Batasan yang diterima:** album terikat pada akses Drive pemiliknya. Tidak ada
transfer kepemilikan file. Jalan keluar v1: admin dapat mengarahkan ulang album ke
folder lain dan melakukan re-index; favorit dan analytics lama tidak dapat dipetakan
ke file baru.

## 10. Pipeline gambar

**Revisi 2026-11-13: pipeline turunan lokal ditunda ke v2.** Pengukuran pada folder
uji menunjukkan Drive menghasilkan thumbnail untuk JPEG, HEIC, dan RAW (ARW) sampai
resolusi penuh. v1 memakai jalur itu; `sharp`, `exiftool`, dan `libheif` tidak masuk
image v1.

### 10.1 v1 — thumbnail Drive + cache

1. Indexing: `files.list` per folder (paginasi), **rekursif ke subfolder** dengan
   batas kedalaman (default 5), deduplikasi berdasarkan Drive file ID, filter MIME
   gambar dengan cadangan ekstensi untuk RAW yang dilaporkan bukan `image/*`,
   simpan metadata. Tidak ada file asli yang diunduh.
2. Grid meminta `w=400`, lightbox `w=1600`, unduhan web `w=2048` dari endpoint
   thumbnail milik Potokuadrat. Browser tidak pernah menerima URL Drive.
3. Server mengambil `thumbnailLink` sekali per file, membuang metadata JPEG, lalu
   menyimpan hasilnya di cache disk. Cache bersifat sementara, boleh dihapus, dan
   dibangun ulang kapan saja.
4. Metadata yang dibuang: segmen `APP1` (EXIF dan XMP), `APP13` (IPTC), dan `COM`.
   Tidak ada decode atau re-encode, jadi piksel dan profil warna utuh. GPS di dalam
   EXIF ikut hilang. Filter segmen ini menangani JPEG, HEIC, dan RAW karena Drive
   mengembalikan ketiganya sebagai JPEG. Kebijakan ini default aktif dan dapat
   dimatikan; lihat §10.2.
5. Job idempoten dan dapat diulang; kegagalan satu foto tidak menggagalkan album.

Pengukuran 2026-11-13, satu VPS, lewat service account:

| Format | `=s400` | `=s1600` | `=s2048` | Resolusi penuh |
|---|---|---|---|---|
| JPEG 6000×4000 | 18–50 KB, ~650 ms | 111 KB, ~0,9 s | 162 KB | 6000×4000, 4,8 MB |
| HEIC 5712×4284 | 50 KB, 416 ms | 386 KB, 1,1 s | 550 KB | 5712×4284, 2,2 MB |
| ARW 6024×4024 (23,8 MB) | 27 KB, 577 ms | 236 KB, 1,6 s | 348 KB, 1,85 s | 6024×4024, 1,9 MB |

Cache 269 foto pada 400px: 14 MB (~52 KB/foto). RAW 3–8× lebih lambat daripada JPEG,
jadi cache dipanaskan setelah indexing, bukan ditunggu klien.

Batasan v1:

- Output selalu JPEG. Tidak ada WebP dan tidak ada kendali kualitas selain lebar.
- Permintaan pertama untuk ukuran besar lambat (ARW `=s0` 4,5 detik); setelah masuk
  cache, permintaan berikutnya ~1 ms.
- `thumbnailLink` kedaluwarsa dalam hitungan jam. Server selalu menyegarkannya lewat
  `files.get` dan tidak pernah mengirim URL itu ke browser.
- Dukungan format adalah milik Google. Kalau suatu format tidak punya thumbnail, foto
  ditandai `failed` dengan alasan; album tetap jalan.
- MIME tidak seragam antar kamera: ARW dilaporkan `image/arw`, sebagian RAW lain bisa
  `application/octet-stream`. Filter perlu cadangan berbasis ekstensi.

### 10.2 Toggle kebijakan metadata (v1)

Default: metadata dibuang. Kebijakan dapat dimatikan di dua tingkat:

- **Organisasi:** `strip_metadata` (default `true`), diatur admin.
- **Share:** `strip_metadata` nullable; `null` berarti ikut organisasi. Ini
  memungkinkan satu album dikirim ke klien dengan thumbnail bersih, sementara share
  lain ke penerbit atau arsip mempertahankan `Artist` dan `Copyright`.

Yang berubah saat dimatikan hanya **thumbnail dan cache**: server menyajikan JPEG
Drive apa adanya. Unduhan asli tidak pernah ditulis ulang dalam keadaan apa pun —
file asli selalu membawa metadata aslinya, terlepas dari toggle.

Implementasi:

- Cache menyimpan dua varian per file dan lebar: `<id>-<width>-clean.jpg` dan
  `<id>-<width>-raw.jpg`. Varian dipilih dari kebijakan efektif share saat request,
  sehingga dua share dengan kebijakan berbeda tidak saling meracuni.
- `ETag` dan URL thumbnail menyertakan mode, sama seperti lebar; URL yang berbeda
  byte tidak boleh berbagi entri cache.
- Peringatan di UI admin: mematikan strip berarti GPS (bila ada di file) ikut
  terkirim ke browser lewat thumbnail. Default tetap aman.
- Toggle tidak mengubah file di Drive dan tidak berlaku untuk unduhan asli.

Alasan fitur ini ada: fotografer sering ingin `Artist`/`Copyright` tetap menempel
pada gambar yang dibagikan, sementara privasi menuntut default yang aman. Toggle
membuat keduanya eksplisit, bukan tersembunyi di kode.

### 10.3 v2 — turunan lokal (ditunda)

Dipakai hanya bila Drive berhenti menyediakan thumbnail untuk format yang dibutuhkan,
atau bila muncul kebutuhan WebP, watermark, atau kendali kualitas.

1. Unduh file asli (stream), baca EXIF, buat turunan, simpan, hapus file sementara.
2. Turunan: `thumb` 400px, `preview` 1600px, `web` 2048px — semuanya WebP.
3. Orientasi dinormalkan dari EXIF; GPS dan metadata sensitif dibuang.
4. Format: JPEG/PNG/WebP/TIFF via `sharp`; HEIC via `heif-convert`; RAW via preview
   JPEG yang diekstrak `exiftool` (`PreviewImage`, cadangan `JpgFromRaw`, lalu
   `ThumbnailImage`).
5. HEIC dan RAW berjalan di job dengan konkurensi lebih rendah.
6. Perkiraan penyimpanan turunan: ~600–700 MB per 1.000 foto.

Kalau v2 diaktifkan, modul gambar menjadi satu-satunya tempat yang berubah; domain,
API, dan UI tidak perlu tahu dari mana turunan berasal.

## 11. Antrean job

- `pg-boss` di atas Postgres, tanpa Redis.
- Job v1: `index-album`, `warm-thumbnails`, `send-magic-link`, `send-share-email`,
  `reindex-album`, `cleanup`.
- Job v2 (saat pipeline lokal diaktifkan): `process-photo`.
- Worker adalah proses terpisah dengan image yang sama. Untuk satu VPS, worker v1
  boleh menyatu ke proses app karena tugasnya hanya email, re-index, dan pemanasan
  cache.
- Progress indexing ditampilkan ke fotografer (jumlah selesai/gagal/total).

## 12. Unduhan

- Kualitas: **asli** (proxy stream dari Drive) dan **web** (JPEG 2048px dari
  `thumbnailLink`, tanpa turunan lokal). Fotografer dapat mematikan salah satunya per
  share. Keduanya hanya tersedia bila `allowed_qualities` share mengizinkannya.
- Cakupan: semua foto di share, atau hanya favorit.
- Unduhan banyak foto: zip dialirkan saat request (tanpa menyimpan zip), dengan batas
  konkurensi dan batas ukuran; untuk jumlah besar, unduhan per file tetap tersedia.
- Unduhan asli di-proxy dari Drive; server tidak menyimpan salinan.
- Unduhan web mengambil ulang thumbnail Drive jika cache sudah dibersihkan; ukurannya
  tidak dijamin identik dengan resolusi asli.

## 13. Filter dan urutan

- Filter: semua, favorit, dan orientasi (landscape/portrait). Tidak ada filter
  "sudah diunduh": riwayat unduhan anonim bersifat lokal dan tidak dapat dijadikan
  filter yang konsisten.
- Urutan: nama file (natural sort) atau tanggal EXIF; fotografer dapat mengatur
  urutan manual untuk cover dan beberapa foto teratas.

## 14. Branding

- Tingkat organisasi: logo, warna aksen, judul.
- Override per share: judul, logo, warna, pesan sambutan.
- Halaman klien tidak menampilkan merek Potokuadrat selain footer kecil yang dapat
  dimatikan.

## 15. Analytics

- Per share: jumlah kunjungan, pengunjung unik (hash IP + hari), foto dilihat,
  favorit, unduhan per kualitas.
- Tidak memakai cookie pihak ketiga atau layanan analytics eksternal.
- Retensi data analytics dapat dikonfigurasi; default 12 bulan.

## 16. Autentikasi dan email

- Pengguna organisasi: email + password (Better Auth), sesi cookie; undangan user via
  email.
- Klien: cookie sesi bertanda tangan; magic link sekali pakai dengan masa berlaku
  pendek.
- SMTP dikonfigurasi via env; tanpa SMTP, aplikasi tetap berjalan dan link disalin
  manual.

## 17. Arsitektur

Opsi yang dipilih: **monolith + Postgres + disk cache; worker opsional.**

- Next.js (App Router, TypeScript) untuk UI dan API.
- Postgres 16; akses data via Drizzle ORM.
- `pg-boss` untuk antrean.
- Modul gambar tipis: v1 hanya mengambil `thumbnailLink`, membuang metadata, lalu
  menyimpannya di cache disk. Tidak ada `sharp`, `exiftool`, atau `libheif` di image
  v1 (lihat §10).
- Tailwind + design system sendiri di `src/components/ui`; UI berbahasa Inggris,
  disiapkan untuk i18n. Ini menggantikan rencana awal shadcn/ui; lihat ADR-0003.
- Baseline versi: Node 24, Next.js 16 (App Router), React 19, Tailwind 4,
  Postgres 16, Drizzle ORM.
- Docker Compose: `app` dan `postgres`; `worker` ditambahkan hanya bila email dan
  re-index perlu diisolasi.

**Storage interface tidak lagi dipakai untuk turunan.** Cache thumbnail bersifat
sementara dan disk-local, jadi tidak butuh abstraksi driver. Antarmuka `put`, `get`,
`delete`, `exists`, `publicUrl` tetap dicadangkan untuk v2 bila turunan lokal atau
driver S3 diaktifkan, tetapi jangan dibangun sebelum ada kebutuhan nyata.

Alasan tidak memilih opsi lain: S3 sejak awal menambah titik gagal dan biaya baru
bagi self-hoster; pipeline turunan sejak v1 menambah image besar, CPU, dan disk tanpa
manfaat terukur dibanding thumbnail Drive; memisahkan API dan pemroses ke bahasa
berbeda menaikkan biaya kontribusi tanpa manfaat untuk skala satu organisasi.

## 18. Skema data (garis besar)

- `organizations` (name, logo, accent, strip_metadata boolean default true),
  `users`, `sessions`
- `drive_folders` (drive_folder_id, name, owner_user_id)
- `albums` (slug, title, status, cover_photo_id, owner_user_id, branding jsonb)
- `album_folders` (album_id, drive_folder_id)
- `photos` (album_id, drive_file_id, name, width, height, bytes, exif jsonb,
  sort_index, thumb_status, error)
- `shares` (album_id, slug, mode, password_hash, expires_at, allow_download,
  allowed_qualities, branding jsonb, strip_metadata boolean null)
- `share_photos` (share_id, photo_id) — kosong berarti seluruh album
- `share_recipients` (share_id, email, token_hash, used_at)
- `client_sessions` (share_id, email, expires_at)
- `favorites` (client_session_id, photo_id)
- `view_events`, `download_events`
- `jobs` (dikelola pg-boss)

Indeks unik pada `(album_id, drive_file_id)`, `shares.slug`, `albums.slug`.

Catatan perilaku:

- **Deduplikasi antar album:** tidak dilakukan di v1. File yang sama di dua album
  diproses dan disimpan dua kali. Ini disengaja agar skema tetap sederhana; dapat
  diubah nanti ke tabel `drive_files` global.
- **Cache thumbnail tidak masuk database.** Isinya hanya turunan Drive yang dapat
  dibangun ulang, disimpan di disk dengan nama `<drive_file_id>-<width>-<mode>.jpg`
  (`clean` atau `raw`). Ukuran cache dibatasi dan di-evict; tidak ada backup untuk
  cache. Kebijakan efektif share menentukan `mode`, jadi dua share tidak berbagi
  byte yang berbeda arti.
- **Foto hilang saat re-index:** baris foto tidak dihapus, melainkan ditandai
  `missing` dan disembunyikan dari klien. Favorit dan riwayat unduhan lama tetap
  utuh.
- **Share dengan subset (`share_photos`):** daftarnya beku. Foto baru dari re-index
  hanya otomatis masuk ke share album-penuh (yang `share_photos`-nya kosong).

## 19. Non-functional

- **Skala acuan:** 1.000+ foto per album; puluhan album aktif; puluhan klien
  bersamaan. Satu VPS 2 vCPU / 4 GB cukup untuk penggunaan normal.
- **Kinerja:** halaman galeri merespons < 1 detik untuk 100 foto pertama; grid
  memakai lazy loading dan `srcset`. Thumbnail 400px disajikan dari cache dengan
  header immutable: 20 thumbnail dingin paralel 1,2 detik, cache hit ~1,4 ms. RAW
  lebih lambat saat pemanasan (400px ~0,6 detik per foto) sehingga cache dipanaskan
  setelah indexing.
- **Keamanan:** kunci SA dan password tidak pernah ke klien; rate limit pada login,
  password share, dan magic link; slug 128-bit; cookie `HttpOnly`, `Secure`,
  `SameSite=Lax`; header keamanan standar.
- **Privasi:** default `strip_metadata = true`; thumbnail Drive membawa EXIF dan XMP
  (author, copyright, tanggal) dan keduanya dibuang sebelum cache dan sebelum dikirim
  ke klien. GPS ikut hilang. Bila admin mematikan kebijakan itu untuk organisasi atau
  share, thumbnail dikirim apa adanya dan UI wajib memperingatkan; unduhan asli
  selalu apa adanya karena server tidak pernah menulis ulang file asli. Tidak ada
  analytics pihak ketiga; data klien minimal (email hanya bila mode magic link).
- **Disk:** cache thumbnail dibatasi (default 5 GB atau 200.000 file) dengan eviction
  LRU; menghapus cache tidak kehilangan data.
- **Backup:** Postgres adalah sumber kebenaran metadata; cache thumbnail dapat
  dibangun ulang dari Drive. Dokumentasi menyertakan perintah backup dan restore.
- **Lisensi:** AGPL-3.0 (default; dapat diubah sebelum rilis).

## 20. Risiko dan batasan yang diketahui

- **Ketergantungan Drive:** kuota dan kebijakan Google dapat berubah; ToS Drive tidak
  secara eksplisit melarang pola ini, tetapi bukan jaminan.
- **Ketergantungan pembuatan thumbnail Drive:** v1 mengandalkan `thumbnailLink` untuk
  JPEG, HEIC, dan RAW. Format yang tidak didukung Google, atau perubahan kebijakan,
  membuat foto tampil `failed`. Jalan keluar: aktifkan pipeline v2 (§10.3) di satu
  modul tanpa mengubah domain.
- **Kunci SA:** kebocoran berarti akses baca ke semua folder yang dibagikan.
- **Kepemilikan album:** bergantung pada akses Drive fotografer.
- **Bandwidth:** indexing tidak lagi mengunduh file asli; bandwidth hanya terpakai
  saat klien meminta unduhan asli atau saat cache thumbnail dingin.
- **Disk:** cache thumbnail tumbuh tanpa batas bila eviction tidak berjalan; perlu
  batas ukuran dan pemantauan.
- **Toggle metadata dimatikan:** thumbnail dapat membawa GPS dan identitas fotografer.
  Risikonya disengaja dan eksplisit, tetapi salah konfigurasi berarti kebocoran
  lokasi. Mitigasi: default aman, peringatan di UI admin, dan audit log perubahan
  kebijakan.

## 21. Yang diserahkan ke builder

- Bentuk API dan kontrak internal.
- Detail skema, migrasi, dan indeks tambahan.
- Komponen UI, tata letak, dan aksesibilitas.
- Strategi caching (ETag, CDN opsional) dan tuning ukuran thumbnail serta batas cache.
- Format zip dan batas ukuran konkret.

## 22. Keputusan yang diambil di dokumen ini

- Service account, bukan OAuth/Picker, sebagai jalur utama Drive.
- Foto saja, tanpa video.
- Seleksi hanya di sisi klien; tanpa alur proofing.
- Tiga mode akses per share; banyak share per album.
- Antrean job dan pembuatan turunan saat indexing. *(Dicabut 2026-11-13: turunan
  lokal pindah ke v2, lihat §10 dan §23.)*
- Kualitas unduh: asli dan web-size.
- Monolith + worker + Postgres + disk lokal, dengan storage interface. *(Direvisi
  2026-11-13: worker opsional, storage interface tidak dipakai untuk cache, lihat
  §17.)*
- AGPL-3.0, UI Inggris dengan struktur i18n.

Keputusan tambahan setelah builder check:

- Indexing rekursif ke subfolder, default aktif, dapat dimatikan per folder.
- Deduplikasi antar album tidak dilakukan di v1.
- Foto yang hilang saat re-index menjadi tombstone `missing`, bukan dihapus.
- Share dengan subset foto bersifat beku; share album-penuh mengikuti album.
- SMTP hanya lewat env; tidak ada pengaturan SMTP per organisasi.
- Favorit pada share anonim tidak dihitung di analytics; hanya sesi beridentitas
  (magic link) yang dihitung.
- Pemilihan folder: daftar `sharedWithMe` + Shared Drives, ditambah tempel URL.
- Format: JPEG/PNG/WebP/TIFF via `sharp`; HEIC via `heif-convert`; RAW via preview
  JPEG yang diekstrak `exiftool`. Unduhan asli selalu file aslinya. *(Diganti
  2026-11-13: ketiganya lewat thumbnail Drive, lihat §10.1.)*

## 23. Revisi 2026-11-13

Keputusan yang berubah setelah pengukuran thumbnail Drive:

- **Pipeline turunan lokal pindah ke v2.** v1 memakai `thumbnailLink` Drive untuk
  grid, lightbox, dan unduhan web. `sharp`, `exiftool`, dan `libheif` keluar dari
  image v1.
- **Unduhan web** memakai JPEG 2048px dari Drive, bukan turunan WebP lokal.
- **Indexing tidak mengunduh file asli**, hanya metadata.
- **Cache thumbnail menggantikan penyimpanan turunan**: disk-local, sementara,
  dibatasi dan di-evict, tidak di-backup, tidak butuh storage interface.
- **Privasi tetap terjaga** dengan filter segmen JPEG yang membuang EXIF dan XMP
  tanpa decode; terverifikasi pada thumbnail JPEG, HEIC, dan ARW.
- **Strip metadata dapat dimatikan** per organisasi atau per share (§10.2), dengan
  cache dua varian `clean`/`raw`. Default tetap bersih; unduhan asli tidak pernah
  ditulis ulang.
- **Worker menjadi opsional di v1** karena tidak ada pemrosesan gambar; job yang
  tersisa adalah email, re-index, pemanasan cache, dan cleanup.

Alasan: pengukuran pada 2026-11-13 menunjukkan Drive menyajikan thumbnail 400px
dalam ~50 ms (JPEG) sampai ~0,6 detik (RAW), 1600px dalam ~1–1,6 detik, dan 2048px
dalam ~1,8 detik, termasuk untuk ARW 23,8 MB dan HEIC. Cache 269 foto 400px hanya
14 MB. Pipeline lokal tidak memberi hasil yang lebih baik untuk kebutuhan v1, tetapi
menambah tiga dependensi sistem, CPU, dan 600–700 MB disk per 1.000 foto.

## 24. Revisi implementasi 2026-11-13

Keputusan yang mengikat implementasi, dicatat saat dokumen dipindahkan ke repo:

- **Nama produk: Potokuadrat.** Dokumen PoC dan spec sebelumnya memakai nama
  sementara "Potopoto"; semua rujukan sudah diseragamkan.
- **Backend Postgres self-hosted.** Supabase (Postgres terkelola, Auth, Storage)
  dihapus dari dependensi. Aplikasi berjalan di satu VPS dengan Docker Compose
  `app` + `postgres`, sesuai §2 dan §17. Autentikasi memakai Better Auth (§16).
  Lihat ADR-0002.
- **Design system sendiri.** shadcn/ui tidak dipakai; komponen berada di
  `src/components/ui` dan token visual di `src/app/globals.css`. §17 diamandemen.
  Lihat ADR-0003.
- **Zip masuk v1.** Unduhan banyak foto dialirkan sebagai zip sesuai §12, dengan
  batas konkurensi dan ukuran; di atas batas, unduhan per file tetap tersedia.
- **Rute publik.** `/` mengarah ke `/setup`; `/setup` hanya berfungsi saat belum ada
  user, setelah itu mengarah ke `/login`. Halaman share klien ada di `/s/<slug>`.
- **Branding tidak lagi dari `config.json`.** Sumber kebenaran adalah baris
  `organizations` (§14, §18); file konfigurasi statis hanya boleh menjadi nilai awal
  saat setup.
- **Baseline versi** dicatat di §17 agar dokumen dan lockfile tidak menyimpang.
