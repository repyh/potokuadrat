# Potokuadrat — Use Case, Class, dan Sequence Diagram

Tanggal: 2026-11-18
Sumber: `docs/specs/2026-10-30-potokuadrat-client-gallery-design.md`
Struktur kode: `docs/ARCHITECTURE.md`, `docs/WORKFLOW.md`

Dokumen ini menurunkan spesifikasi menjadi tiga kelompok diagram: **use case** (siapa
melakukan apa), **class** (entitas domain dan modul server), dan **sequence** (urutan
pesan untuk alur yang mudah salah). Semua diagram memakai Mermaid sehingga ikut
ter-review bersama kode. Diagram menggambarkan **desain v1**; selisih dengan kode yang
sudah ada dicatat di §5.

## Daftar diagram

| ID | Jenis | Isi |
| --- | --- | --- |
| UC | Use case | Aktor, batas sistem, dan seluruh use case v1 |
| CD-01 | Class | Model domain persisten (tabel Postgres §18) |
| CD-02 | Class | Modul server, port, dan ketergantungannya |
| SQ-01 | Sequence | Daftarkan folder, buat album, indexing, progres |
| SQ-02 | Sequence | Buat share dan terbitkan magic link |
| SQ-03 | Sequence | Klien membuka share dan resolusi akses |
| SQ-04 | Sequence | Grid + thumbnail: cache miss, strip metadata, ETag |
| SQ-05 | Sequence | Favorit: sesi magic link vs localStorage |
| SQ-06 | Sequence | Unduhan: file asli, web 2048px, dan zip stream |
| SQ-07 | Sequence | Re-index: upsert, tombstone `missing`, subset beku |

---

## 1. Use case diagram

Aktor manusia: **Admin organisasi**, **Fotografer (member)**, **Klien** (tanpa akun).
Aktor sistem: **Service account Drive** (akses baca), **Worker pg-boss**, dan **SMTP**.

```mermaid
flowchart LR
  admin(["Admin organisasi"])
  photographer(["Fotografer (member)"])
  client(["Klien (tanpa akun)"])
  drive[("Service account Drive")]
  smtp[("SMTP")]
  worker(["Worker pg-boss"])

  subgraph system["Potokuadrat"]
    direction TB

    subgraph adm["Administrasi instalasi"]
      ucSetup(["UC-01 Menyelesaikan setup awal"])
      ucUsers(["UC-02 Mengelola user dan undangan"])
      ucPolicy(["UC-03 Mengatur branding dan kebijakan metadata organisasi"])
      ucOversee(["UC-04 Mengawasi semua album dan share"])
    end

    subgraph alb["Pengelolaan album"]
      ucFolder(["UC-05 Mendaftarkan DriveFolder"])
      ucAlbum(["UC-06 Membuat album dari satu atau beberapa folder"])
      ucProgress(["UC-07 Melihat progres indexing"])
      ucReorder(["UC-08 Mengatur cover dan urutan foto"])
      ucReindex(["UC-09 Melakukan re-index album"])
    end

    subgraph shr["Pengelolaan share"]
      ucShare(["UC-10 Membuat share dengan mode akses"])
      ucSubset(["UC-11 Memilih subset foto share"])
      ucBrand(["UC-12 Mengatur branding override share"])
      ucInvite(["UC-13 Mengundang penerima magic link"])
      ucSend(["UC-14 Mengirim link share"])
      ucRevoke(["UC-15 Menonaktifkan atau menghapus share"])
      ucAnalytics(["UC-16 Melihat analytics share"])
    end

    subgraph gal["Galeri klien"]
      ucOpen(["UC-17 Membuka halaman share"])
      ucAuth(["UC-18 Membuktikan akses (password atau magic link)"])
      ucGrid(["UC-19 Melihat grid dan lightbox"])
      ucFilter(["UC-20 Memfilter dan mengurutkan foto"])
      ucFav(["UC-21 Menandai favorit"])
      ucDownload(["UC-22 Mengunduh foto"])
      ucZip(["UC-23 Mengunduh banyak foto sebagai zip"])
    end

    subgraph bg["Latar belakang"]
      ucIndex(["UC-24 Mengindeks album"])
      ucWarm(["UC-25 Memanaskan cache thumbnail"])
      ucEmail(["UC-26 Mengirim email"])
      ucCleanup(["UC-27 Membersihkan cache dan analytics kedaluwarsa"])
      ucThumb(["UC-28 Menyajikan thumbnail dari cache atau Drive"])
    end
  end

  admin --> ucSetup
  admin --> ucUsers
  admin --> ucPolicy
  admin --> ucOversee

  photographer --> ucFolder
  photographer --> ucAlbum
  photographer --> ucProgress
  photographer --> ucReorder
  photographer --> ucReindex
  photographer --> ucShare
  photographer --> ucSubset
  photographer --> ucBrand
  photographer --> ucInvite
  photographer --> ucSend
  photographer --> ucRevoke
  photographer --> ucAnalytics

  client --> ucOpen
  client --> ucGrid
  client --> ucFilter
  client --> ucFav
  client --> ucDownload
  client --> ucZip

  ucOpen -.->|"extend: mode password / magic link"| ucAuth
  ucGrid -.->|"include"| ucThumb
  ucAlbum -.->|"include"| ucIndex
  ucReindex -.->|"include"| ucIndex
  ucIndex -.->|"include"| ucWarm
  ucInvite -.->|"include"| ucEmail
  ucSend -.->|"include"| ucEmail
  ucZip -.->|"include"| ucDownload
  ucDownload -.->|"include"| ucThumb

  ucIndex --> drive
  ucWarm --> drive
  ucThumb --> drive
  ucEmail --> smtp

  worker --> ucIndex
  worker --> ucWarm
  worker --> ucEmail
  worker --> ucCleanup
```

Catatan use case:

- **UC-21 Favorit** punya dua wujud: baris `favorites` untuk sesi magic link, dan
  `localStorage` untuk share public/password. Hanya sesi beridentitas yang dihitung di
  analytics (§22).
- **UC-22** mencakup dua kualitas, `original` dan `web`; keduanya tunduk pada
  `allow_download` dan `allowed_qualities`.
- **UC-01** hanya dapat dijangkau selama belum ada user; setelah itu `/setup`
  mengarah ke `/login` (§24).
- **UC-24/25/26/27** tidak dipanggil pengguna secara langsung; dipicu oleh Server
  Action atau route handler melalui `pg-boss`.

---

## 2. Class diagram

### CD-01 — Model domain persisten

Bentuk kelas mengikuti tabel di §18 dan schema Drizzle di `src/server/db/schema/`.

```mermaid
classDiagram
  direction LR

  class Organization {
    +uuid id
    +string name
    +string title
    +string logo
    +string accent
    +bool footerEnabled
    +bool stripMetadata
  }

  class User {
    +string id
    +string email
    +string name
    +string role
    +string passwordHash
  }

  class Session {
    +string id
    +string userId
    +datetime expiresAt
  }

  class DriveFolder {
    +uuid id
    +string driveFolderId
    +string name
    +string ownerUserId
    +bool recursive
    +datetime lastIndexedAt
  }

  class Album {
    +uuid id
    +string slug
    +string title
    +AlbumStatus status
    +uuid coverPhotoId
    +string ownerUserId
    +jsonb branding
  }

  class AlbumFolder {
    +uuid albumId
    +uuid driveFolderId
    +int position
  }

  class Photo {
    +uuid id
    +uuid albumId
    +string driveFileId
    +string name
    +string mimeType
    +int width
    +int height
    +bigint bytes
    +jsonb exif
    +int sortIndex
    +ThumbStatus thumbStatus
    +datetime missingAt
    +string error
  }

  class Share {
    +uuid id
    +uuid albumId
    +string slug
    +ShareMode mode
    +string passwordHash
    +datetime expiresAt
    +bool allowDownload
    +DownloadQuality[] allowedQualities
    +jsonb branding
    +bool stripMetadata
  }

  class SharePhoto {
    +uuid shareId
    +uuid photoId
  }

  class ShareRecipient {
    +uuid id
    +uuid shareId
    +string email
    +string tokenHash
    +datetime expiresAt
    +datetime usedAt
  }

  class ClientSession {
    +uuid id
    +uuid shareId
    +string email
    +datetime expiresAt
  }

  class Favorite {
    +uuid clientSessionId
    +uuid photoId
  }

  class ViewEvent {
    +uuid id
    +uuid shareId
    +uuid photoId
    +string visitorHash
    +datetime createdAt
  }

  class DownloadEvent {
    +uuid id
    +uuid shareId
    +uuid photoId
    +DownloadQuality quality
    +string visitorHash
    +datetime createdAt
  }

  class AlbumStatus {
    <<enumeration>>
    indexing
    ready
    failed
  }

  class ThumbStatus {
    <<enumeration>>
    pending
    ready
    failed
  }

  class ShareMode {
    <<enumeration>>
    public
    password
    magic_link
  }

  class DownloadQuality {
    <<enumeration>>
    original
    web
  }

  Organization "1" --> "0..*" User : berisi
  User "1" --> "0..*" Session : login
  User "1" --> "0..*" DriveFolder : memiliki
  User "1" --> "0..*" Album : memiliki

  Album "1" --> "0..*" AlbumFolder
  DriveFolder "1" --> "0..*" AlbumFolder
  Album "1" --> "0..*" Photo : berisi
  Album "1" --> "0..*" Share : dibagikan

  Share "1" --> "0..*" SharePhoto
  Photo "1" --> "0..*" SharePhoto
  Share "1" --> "0..*" ShareRecipient : mengundang
  Share "1" --> "0..*" ClientSession : menerbitkan

  ClientSession "1" --> "0..*" Favorite
  Photo "1" --> "0..*" Favorite

  Share "1" --> "0..*" ViewEvent
  Share "1" --> "0..*" DownloadEvent
  Photo "0..1" --> "0..*" ViewEvent
  Photo "0..1" --> "0..*" DownloadEvent

  Album ..> AlbumStatus
  Photo ..> ThumbStatus
  Share ..> ShareMode
  Share ..> DownloadQuality

  note for SharePhoto "Tanpa baris berarti share mencakup seluruh album dan mengikuti re-index. Dengan baris, subsetnya beku."
  note for Photo "Re-index tidak menghapus baris. File yang hilang diberi missingAt dan disembunyikan dari klien."
  note for Share "stripMetadata null berarti ikut organisasi. Password disimpan sebagai hash. Favorit anonim tidak masuk tabel Favorite."
```

Aturan yang tidak terlihat di diagram:

- Indeks unik: `(album_id, drive_file_id)` pada `photos`, `shares.slug`, `albums.slug`,
  `drive_folders.drive_folder_id`, `(share_id, email)` pada `share_recipients`.
- `albums.cover_photo_id` sengaja bukan foreign key; validasinya di application layer.
- Cache thumbnail **tidak** punya tabel: ia hidup di disk sebagai
  `<drive_file_id>-<width>-<mode>.jpg` dan boleh dihapus kapan saja (§18).
- Deduplikasi antar album tidak dilakukan di v1.

### CD-02 — Modul server dan port

Kelas di bawah adalah unit yang benar-benar dipakai route handler, Server Action, dan
worker. `..>` berarti "bergantung pada", bukan pewarisan.

```mermaid
classDiagram
  direction TB

  class RouteHandlers {
    <<adapter>>
    +shareRoute(slug)
    +thumbRoute(slug,photoId,w)
    +downloadRoute(slug,photoId,quality)
    +zipRoute(slug,quality,scope)
    +favoritesRoute(slug)
    +magicRoute(slug)
    +adminAlbumsRoute()
    +adminSharesRoute()
  }

  class ServerActions {
    <<adapter>>
    +createAlbumAction()
    +updateAlbumAction()
    +createShareAction()
    +sendShareEmailAction()
    +updateOrganizationAction()
  }

  class AlbumService {
    <<service>>
    +list(ownerUserId)
    +create(ownerUserId,input)
    +detail(albumId)
    +reindex(albumId,mode)
    +update(ownerUserId,albumId,input)
    +remove(ownerUserId,albumId)
    +setCover(ownerUserId,albumId,photoId)
  }

  class ShareAdminService {
    <<service>>
    +list(ownerUserId,albumId)
    +create(ownerUserId,albumId,input)
    +update(ownerUserId,shareId,input)
    +remove(ownerUserId,shareId)
    +setPhotos(ownerUserId,shareId,photoIds)
    +addRecipient(ownerUserId,shareId,email)
    +reissueMagicLink(ownerUserId,shareId,recipientId)
  }

  class ShareGallery {
    <<module>>
    +parsePhotoQuery(searchParams)
    +listShareGallery(repository,request,slug,searchParams)
    +listFavorites(repository,request,slug)
    +encodePhotoCursor(cursor)
  }

  class ShareRequestContext {
    <<module>>
    +authorizeShareRequest(repository,request,share)
    +resolveShareRequest(repository,request,slug)
  }

  class FavoritesService {
    <<module>>
    +favoriteSession(share,sessionId)
    +addFavorite(repository,request,slug,photoId)
    +removeFavorite(repository,request,slug,photoId)
  }

  class ShareMedia {
    <<module>>
    +resolveShareMedia(repository,slug,photoId,options)
  }

  class SharePolicy {
    <<module>>
    +isShareActive(share,now)
    +canDownload(share,quality)
    +resolveStripMetadata(share,orgDefault)
    +resolveShareAccess(share,now,authorized)
  }

  class ArchiveService {
    <<module>>
    +buildArchivePlan(photos,quality)
    +prepareShareArchive(repository,request,slug,params,drive)
  }

  class AuthSession {
    <<module>>
    +getSession()
    +requireUser()
    +requireAdmin()
  }

  class RateLimiter {
    +consume(key)
  }

  class ShareCookie {
    <<module>>
    +createShareCookieValue(shareId,payload)
    +verifyShareCookieValue(shareId,raw)
  }

  class DriveClient {
    <<interface>>
    +getFolder(folderId)
    +listSharedFolders()
    +listSharedDrives()
    +listImages(folderId,options)
    +getFile(fileId)
    +fetchThumbnail(fileId,thumbnailLink,width)
    +openOriginal(fileId)
  }

  class ThumbnailCache {
    <<interface>>
    +get(photo,width,mode)
    +enforceLimits()
  }

  class JpegStripper {
    <<module>>
    +stripJpegMetadata(buffer)
  }

  class AlbumRepository {
    <<interface>>
    +listAlbums(ownerUserId)
    +ensureDriveFolders(ownerUserId,folders)
    +createAlbum(input)
    +getAlbum(albumId)
    +getAlbumFolders(albumId)
    +upsertPhotos(albumId,rows)
    +markMissingPhotos(albumId,seenIds)
    +markFoldersIndexed(folderIds,at)
    +setStatus(albumId,status)
    +countProgress(albumId)
  }

  class ShareRepository {
    <<interface>>
    +findBySlug(slug)
    +getSharePhoto(share,photoId)
    +listSharePhotos(share,options)
    +listShareArchivePhotos(share,options)
    +consumeRecipient(shareId,tokenHash)
    +findOrCreateClientSession(shareId,email,expiresAt)
    +findClientSession(shareId,sessionId)
    +addFavorite(share,sessionId,photoId)
    +removeFavorite(sessionId,photoId)
    +listFavoritePhotoIds(share,sessionId)
  }

  class JobQueue {
    <<module>>
    +enqueueIndexAlbum(albumId,mode)
  }

  class Worker {
    <<process>>
    +startWorkers()
    +handleIndexAlbum(job)
  }

  RouteHandlers ..> ShareGallery
  RouteHandlers ..> ShareMedia
  RouteHandlers ..> ShareRequestContext
  RouteHandlers ..> FavoritesService
  RouteHandlers ..> ArchiveService
  RouteHandlers ..> AuthSession
  RouteHandlers ..> ShareCookie
  RouteHandlers ..> RateLimiter
  RouteHandlers ..> ShareRepository
  RouteHandlers ..> AlbumService

  ServerActions ..> AlbumService
  ServerActions ..> ShareAdminService
  ServerActions ..> JobQueue
  ServerActions ..> AuthSession

  AlbumService ..> AlbumRepository
  AlbumService ..> DriveClient
  AlbumService ..> JobQueue

  ShareAdminService ..> ShareRepository
  ShareAdminService ..> SharePolicy

  ShareGallery ..> ShareRepository
  ShareGallery ..> SharePolicy
  ShareGallery ..> ShareRequestContext
  ShareMedia ..> ShareRepository
  ShareMedia ..> SharePolicy
  ShareMedia ..> ShareCookie
  ShareRequestContext ..> ShareRepository
  ShareRequestContext ..> SharePolicy
  ShareRequestContext ..> ShareCookie
  FavoritesService ..> ShareRequestContext
  FavoritesService ..> ShareRepository

  ArchiveService ..> ShareRepository
  ArchiveService ..> DriveClient
  ArchiveService ..> ThumbnailCache
  ArchiveService ..> SharePolicy

  Worker ..> JobQueue
  Worker ..> AlbumRepository
  Worker ..> DriveClient

  ThumbnailCache ..> DriveClient
  ThumbnailCache ..> JpegStripper
  DriveClient ..> ThumbnailCache : fetchThumbnail memakai cache
```

Catatan modul:

- Route handler tidak memuat aturan bisnis; ia memvalidasi input HTTP, memanggil satu
  use case, lalu memetakan hasil ke response (`docs/WORKFLOW.md`).
- **Binary selalu route handler**: thumbnail, unduhan asli, dan zip butuh streaming
  serta header (`Content-Disposition`, `ETag`, `Cache-Control`).
- Tidak ada `StorageService`. Cache thumbnail bersifat disk-local dan tidak butuh
  abstraksi driver (§17).
- `DriveClient` adalah satu-satunya tempat yang menyentuh `drive.readonly`; kunci
  service account tidak pernah keluar dari proses server.

---

## 3. Sequence diagram

### SQ-01 — Daftarkan folder, buat album, indexing

Mencakup UC-05, UC-06, UC-07, UC-24, dan UC-25. Indexing tidak mengunduh file asli;
worker hanya membaca metadata dan menyimpan baris `photos`.

```mermaid
sequenceDiagram
  autonumber
  actor F as Fotografer
  participant UI as Admin UI
  participant API as Route Handler /api/admin
  participant AS as AlbumService
  participant AR as AlbumRepository
  participant DC as DriveClient
  participant GD as Google Drive
  participant DB as Postgres
  participant Q as pg-boss
  participant W as Worker

  F->>UI: Buka pemilih folder Drive
  UI->>API: GET /api/admin/drive/folders
  API->>DC: listSharedFolders() dan listSharedDrives()
  DC->>GD: files.list sharedWithMe / drives
  GD-->>DC: daftar folder yang terlihat
  DC-->>API: DriveFolderOption[]
  API-->>UI: folder yang dapat dipilih

  F->>UI: Pilih satu atau beberapa folder, isi judul
  UI->>API: POST /api/admin/albums
  API->>AS: create(ownerUserId, input)
  AS->>DC: getFolder(folderId) untuk validasi akses
  alt folder tidak dapat diakses service account
    DC-->>AS: DriveError
    AS-->>API: AlbumValidationError
    API-->>UI: 400 dengan pesan yang dapat dibaca
  else folder valid
    AS->>AR: ensureDriveFolders + createAlbum(status=indexing)
    AR->>DB: INSERT albums, album_folders, drive_folders
    AS->>Q: send index-album (singletonKey=albumId)
    AS-->>API: AlbumSummary
    API-->>UI: 201 Created
  end

  loop sampai status ready atau failed
    UI->>API: GET /api/admin/albums/{id}
    API->>AR: getAlbumDetail + countProgress
    AR-->>API: status, selesai, gagal, total
    API-->>UI: progres indexing
  end

  Q->>W: index-album { albumId, mode }
  W->>AR: getAlbum + getAlbumFolders
  W->>AR: setStatus(albumId, indexing)
  loop setiap folder album
    W->>DC: listImages(folderId, recursive, modifiedAfter)
    DC->>GD: files.list dengan paginasi dan batas kedalaman
    GD-->>DC: file gambar
    DC-->>W: DrivePhoto[]
  end
  W->>AR: upsertPhotos(albumId, rows)
  AR->>DB: INSERT ... ON CONFLICT (album_id, drive_file_id)
  alt mode full
    W->>AR: markMissingPhotos(albumId, seenIds)
    AR->>DB: UPDATE photos SET missing_at
  end
  W->>AR: markFoldersIndexed + setStatus(ready)
  W->>Q: send warm-thumbnails (latar belakang)
  Note over W,Q: Kegagalan satu foto tidak menggagalkan album. Status thumb dicatat per baris.
```

### SQ-02 — Buat share dan terbitkan magic link

Mencakup UC-10 sampai UC-14. Share adalah unit kontrol akses; album tidak pernah
diakses langsung oleh klien.

```mermaid
sequenceDiagram
  autonumber
  actor F as Fotografer
  participant UI as Admin UI
  participant API as Route Handler /api/admin/shares
  participant SA as ShareAdminService
  participant SR as ShareRepository
  participant DB as Postgres
  participant Q as pg-boss
  participant SMTP as SMTP

  F->>UI: Isi mode akses, expiry, izin unduh, subset foto
  UI->>API: POST /api/admin/shares
  API->>SA: create(ownerUserId, albumId, input)
  SA->>SA: validasi mode, expiry, allowedQualities
  SA->>SA: hash password bila mode=password
  SA->>SR: insert share (slug 128-bit, strip_metadata null=ikut organisasi)
  SR->>DB: INSERT shares, share_photos bila subset dipilih
  alt mode=magic_link
    loop setiap email penerima
      SA->>SR: addRecipient(shareId, email)
      SR->>DB: INSERT share_recipients (token_hash, expires_at)
      SA-->>UI: IssuedMagicLink yang bisa disalin
    end
  else mode lain
    SA-->>UI: ShareDetail dengan slug
  end
  UI-->>F: Tampilkan link untuk disalin

  opt email dikirim
    F->>UI: Kirim link ke penerima
    UI->>API: POST /api/admin/shares/{id}/send
    API->>Q: send-magic-link / send-share-email
    Q->>SMTP: Kirim email dengan tautan bertoken
    SMTP-->>Q: hasil pengiriman
    Note over Q,SMTP: Tanpa SMTP, aplikasi tetap berjalan dan link disalin manual.
  end
```

### SQ-03 — Klien membuka share dan resolusi akses

Mencakup UC-17, UC-18, dan UC-19 (first paint). Halaman galeri adalah Server
Component; penukaran password/magic link adalah route handler.

```mermaid
sequenceDiagram
  autonumber
  actor K as Klien
  participant B as Browser
  participant Page as Server Component /s/[slug]
  participant API as Route Handler /api/share/[slug]
  participant SR as ShareRepository
  participant DB as Postgres
  participant P as SharePolicy
  participant C as ShareCookie
  participant L as RateLimiter

  K->>B: Buka tautan share
  B->>Page: GET /s/{slug}
  Page->>SR: findBySlug(slug)
  SR->>DB: SELECT shares WHERE slug
  SR-->>Page: ShareRecord atau null

  alt share tidak ditemukan
    Page-->>B: 404
  else share ditemukan
    Page->>C: verifyShareCookieValue(shareId, cookie)
    C-->>Page: payload atau null
    Page->>SR: findClientSession(shareId, sessionId) bila mode magic link
    SR-->>Page: sesi hidup atau null
    Page->>P: resolveShareAccess(share, now, authorized)
    P-->>Page: ok / expired / password_required / magic_link_required

    alt expired
      Page-->>B: 410 Share expired
    else password_required
      Page-->>B: Form password (GalleryState.access=password_required)
      K->>B: Masukkan password
      B->>API: POST /api/share/{slug}/access
      API->>L: consume(clientKey)
      alt melewati batas
        L-->>API: tolak
        API-->>B: 429 Retry-After
      else
        API->>SR: findBySlug + verifikasi hash password
        API-->>B: Set-Cookie bertanda tangan
        B->>Page: GET /s/{slug} (request baru)
      end
    else magic_link_required
      Page-->>B: Halaman "periksa email" (GalleryState.access=magic_link_required)
      K->>B: Buka tautan dari email
      B->>API: POST /api/share/{slug}/magic { token }
      API->>L: consume(clientKey)
      API->>SR: consumeRecipient(shareId, tokenHash)
      alt token tidak valid atau sudah dipakai
        SR-->>API: null
        API-->>B: 401
      else token valid
        API->>SR: findOrCreateClientSession(shareId, email, expiresAt)
        SR->>DB: INSERT atau pakai ulang client_sessions
        API-->>B: Set-Cookie berisi sessionId
        B->>Page: GET /s/{slug} (request baru)
      end
    else ok
      Page->>P: resolveStripMetadata + canDownload
      Page->>SR: listShareGallery(share, filter, cursor)
      SR->>DB: SELECT foto album yang tidak missing dan ada di subset
      SR-->>Page: foto halaman pertama + cursor
      opt mode magic link
        Page->>SR: listFavorites(share, sessionId)
        SR-->>Page: photoId favorit tersimpan
      end
      Page-->>B: HTML galeri, branding efektif, policy share
    end
  end
```

### SQ-04 — Grid dan thumbnail: cache miss, strip, ETag

Mencakup UC-19, UC-25, dan UC-28. Browser tidak pernah menerima URL Drive; hanya
`/s/{slug}/thumb/{photoId}?w=...` milik Potokuadrat.

```mermaid
sequenceDiagram
  autonumber
  actor K as Klien
  participant B as Browser
  participant T as Thumb Route /s/[slug]/thumb
  participant M as ShareMedia
  participant P as SharePolicy
  participant TC as ThumbnailCache
  participant DC as DriveClient
  participant GD as Google Drive
  participant FS as Disk cache

  K->>B: Scroll grid
  B->>T: GET /s/{slug}/thumb/{photoId}?w=400
  T->>M: resolveShareMedia(repository, slug, photoId, authorize)
  M->>P: resolveShareAccess + cek share/photo
  P-->>M: ok
  M-->>T: share + photo
  T->>P: resolveStripMetadata(share, organization.stripMetadata)
  P-->>T: mode = clean atau raw

  T->>TC: get(photo, width=400, mode)
  TC->>FS: baca {driveFileId}-400-{mode}.jpg
  alt cache hit
    FS-->>TC: byte + etag
  else cache miss
    TC->>DC: getFile(driveFileId)
    DC->>GD: files.get fields=thumbnailLink
    GD-->>DC: thumbnailLink yang masih segar
    TC->>DC: fetchThumbnail(fileId, thumbnailLink, 400)
    DC->>GD: GET thumbnailLink=s400
    GD-->>DC: JPEG 400px
    alt mode=clean
      TC->>TC: stripJpegMetadata (buang APP1, APP13, COM)
    end
    TC->>FS: tulis atomik ke file cache
    TC-->>T: byte + etag baru
  end

  alt If-None-Match cocok
    T-->>B: 304 Not Modified
  else
    T-->>B: 200 image/jpeg, ETag, Cache-Control immutable
  end
  B->>B: render dari srcset w=400/800, lazy loading
  Note over T,GD: URL thumbnail kedaluwarsa dalam hitungan jam, jadi server selalu menyegarkan lewat files.get dan tidak pernah mengirimkannya ke browser.
```

### SQ-05 — Favorit: sesi magic link vs localStorage

Mencakup UC-21. Hanya sesi beridentitas yang menulis ke Postgres; share public dan
password menyimpan favorit di browser.

```mermaid
sequenceDiagram
  autonumber
  actor K as Klien
  participant B as Browser (feature/share)
  participant FAPI as Route Handler /api/share/[slug]/favorites
  participant SR as ShareRepository
  participant DB as Postgres

  K->>B: Tekan ikon hati pada foto
  alt mode public atau password
    B->>B: Simpan photoId di localStorage
    Note over B: Tidak ada analytics favorit untuk sesi anonim.
  else mode magic_link
    B->>FAPI: PUT /favorites/{photoId}
    FAPI->>SR: resolveShareRequest + favoriteSession
    alt sesi tidak hidup
      SR-->>FAPI: null
      FAPI-->>B: 401 A magic-link session is required
    else sesi hidup
      FAPI->>SR: addFavorite(share, sessionId, photoId)
      SR->>DB: INSERT favorites ON CONFLICT DO NOTHING
      SR-->>FAPI: photoId favorit terbaru
      FAPI-->>B: 200 daftar favorit terbaru
    end
  end

  Note over B,FAPI: Klien kembali lewat magic link baru. findOrCreateClientSession memakai ulang sesi hidup, jadi favorit tidak hilang.
  K->>B: Filter favorit
  B->>FAPI: GET /favorites
  FAPI->>SR: listFavoritePhotoIds(share, sessionId)
  SR->>DB: SELECT favorites JOIN photos yang masih terlihat
  SR-->>FAPI: photoId[]
  FAPI-->>B: daftar favorit, cache-control no-store
```

### SQ-06 — Unduhan: file asli, web 2048px, dan zip

Mencakup UC-22 dan UC-23. Tidak ada file asli yang disimpan; zip dialirkan saat
request dan tidak pernah ditulis ke disk.

```mermaid
sequenceDiagram
  autonumber
  actor K as Klien
  participant B as Browser
  participant D as Download Route /s/[slug]/download
  participant Z as Zip Route /api/share/[slug]/download.zip
  participant M as ShareMedia
  participant P as SharePolicy
  participant AR as ArchiveService
  participant TC as ThumbnailCache
  participant DC as DriveClient
  participant GD as Google Drive

  K->>B: Unduh satu foto, kualitas original
  B->>D: GET /s/{slug}/download/{photoId}?quality=original
  D->>M: resolveShareMedia + authorize
  D->>P: canDownload(share, original)
  alt tidak diizinkan
    P-->>D: false
    D-->>B: 403
  else diizinkan
    D->>DC: openOriginal(driveFileId)
    DC->>GD: files.get alt=media
    GD-->>DC: stream byte asli
    DC-->>D: Response body
    D-->>B: 200 stream + Content-Disposition, tanpa menulis ke disk
  end

  K->>B: Unduh kualitas web
  B->>D: GET ...?quality=web
  D->>P: canDownload(share, web)
  D->>TC: get(photo, 2048, mode)
  TC->>DC: fetch thumbnail bila cache miss
  DC->>GD: thumbnailLink=s2048
  GD-->>TC: JPEG 2048px
  TC-->>D: byte (sudah di-strip bila mode=clean)
  D-->>B: 200 image/jpeg

  K->>B: Unduh semua atau hanya favorit sebagai zip
  B->>Z: GET /download.zip?quality=...&scope=all|favorites&ids=...
  Z->>AR: prepareShareArchive(repository, request, slug, params, drive)
  AR->>M: resolveShareRequest
  AR->>AR: parseArchiveQuery + batas 500 foto / 2 GB
  alt melewati batas
    AR-->>Z: 413 ARCHIVE_TOO_LARGE
    Z-->>B: 413, unduhan per file tetap tersedia
  else dalam batas
    AR->>AR: buildArchivePlan + uniqueEntryNames
    AR->>GD: buka satu sumber per entri, lazy
    AR-->>Z: ReadableStream zip
    Z-->>B: 200 application/zip (stream, tanpa file sementara)
  end
```

### SQ-07 — Re-index: upsert, tombstone, subset beku

Mencakup UC-09 dan UC-24. Re-index penuh menandai file yang hilang sebagai `missing`,
bukan menghapus baris; favorit dan riwayat unduhan tetap valid.

```mermaid
sequenceDiagram
  autonumber
  actor F as Fotografer
  participant UI as Admin UI
  participant API as Route Handler /api/admin/albums/[id]/reindex
  participant AS as AlbumService
  participant Q as pg-boss
  participant W as Worker
  participant AR as AlbumRepository
  participant DC as DriveClient
  participant GD as Google Drive
  participant DB as Postgres

  F->>UI: Tekan "Re-index"
  UI->>API: POST /api/admin/albums/{id}/reindex { mode }
  API->>AS: reindex(albumId, mode)
  AS->>AR: getAlbum(albumId)
  AS->>AR: setStatus(indexing)
  AS->>Q: send index-album (singletonKey=albumId)
  AS-->>API: true
  API-->>UI: 202 Accepted
  Q->>W: index-album

  W->>AR: getAlbumFolders
  alt semua folder punya lastIndexedAt dan mode=incremental
    W->>DC: listImages(modifiedAfter=lastIndexedAt)
    Note over W,DC: Tidak ada tombstone pada mode incremental.
  else mode=full atau ada folder belum pernah diindeks
    W->>DC: listImages(folderId) penuh
  end

  W->>AR: upsertPhotos(albumId, rows)
  AR->>DB: INSERT ... ON CONFLICT (album_id, drive_file_id) DO UPDATE
  opt mode=full
    W->>AR: markMissingPhotos(albumId, seenIds)
    AR->>DB: UPDATE photos SET missing_at=now() WHERE drive_file_id NOT IN seenIds
  end
  W->>AR: markFoldersIndexed + setStatus(ready)
  W->>Q: send warm-thumbnails

  Note over DB: Foto missing disembunyikan dari klien, tetapi baris, favorit, dan download_events tetap ada.
  Note over DB: Share dengan share_photos terisi bersifat beku. Foto baru hanya masuk ke share album-penuh.
```

---

## 4. Aturan lintas diagram

| Aturan | Diagram yang menegakkannya |
| --- | --- |
| Share adalah unit akses, bukan album | UC-10, SQ-03, SQ-04 |
| Kunci service account tidak pernah ke browser | CD-02, SQ-01, SQ-04 |
| Tidak ada URL Drive di response | SQ-04, SQ-06 |
| File asli tidak disimpan | SQ-06 |
| `missing` bukan delete | CD-01, SQ-07 |
| `strip_metadata` default aktif; override per share | CD-01, SQ-04, SQ-06 |
| Cache boleh dihapus dan dibangun ulang | CD-01, SQ-04, SQ-06 |
| Zip dialirkan, bukan diarsipkan ke disk | SQ-06 |
| Favorit anonim tidak masuk analytics | UC-21, SQ-05 |

---

## 5. Status implementasi

Diagram di atas adalah desain v1. Beberapa bagian sudah ada di repo, sebagian masih
mengikuti rencana §11:

| Bagian | Status |
| --- | --- |
| Schema domain, `AlbumService`, `ShareAdminService` | Ada di `src/server/**` |
| Akses share, cookie, rate limit, favorit | Ada di `src/server/shares/**` |
| Drive client, cache thumbnail, strip metadata | Ada di `src/server/drive/**` |
| Unduhan asli, web, dan zip | Ada di route `download` dan `download.zip` |
| Job `index-album` | Ada di `src/server/jobs/**` |
| Job `warm-thumbnails`, `send-magic-link`, `send-share-email`, `cleanup` | Direncanakan §11, belum ada di `src/server/jobs/**` |
| Endpoint analytics share (UC-16) | Direncanakan §15, belum ada route-nya |

Kalau job atau endpoint baru ditambahkan, perbarui §1, CD-02, dan sequence yang
bersangkutan agar dokumen ini tetap menjadi satu-satunya rujukan diagram.
