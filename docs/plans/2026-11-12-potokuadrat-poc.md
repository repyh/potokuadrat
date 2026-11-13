# Potokuadrat PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu halaman client gallery yang membaca folder Google Drive asli lewat service account, dengan grid, filter, favorit, lightbox, dan unduhan asli — tanpa dependensi.

**Architecture:** Satu proses Node (`node:http`, `node:crypto`, `fetch`) yang menandatangani JWT service account, mendaftar isi folder, dan mem-proxy unduhan. Browser memuat thumbnail langsung dari Drive. Logika filter/favorit ada di modul klien terpisah agar dapat diuji dengan `node --test`.

**Tech Stack:** Node ≥ 22 (ESM, `fetch`, `node:test`), HTML/CSS/JS tanpa framework. Nol dependensi npm.

**Spec:** `docs/specs/2026-11-12-potokuadrat-poc-design.md`

## Global Constraints

- Nol dependensi npm. Hanya modul bawaan Node.
- Kunci service account tidak boleh dikirim ke klien, ditulis ke log, atau masuk repo.
  Default path: `$HOME/secrets/juno-470503-f4317bf3f970.json`.
- Folder default: `1XtiPMDZ5FWFJv8IqWNjnZDqwJD9LmURQ`.
- Endpoint unduhan hanya menerima file ID yang ada di daftar album yang di-cache.
- Teks UI dalam bahasa Inggris. Tanpa i18n framework.
- Semua kode baru berada di `poc/`.
- Setiap respons API memakai `Content-Type: application/json; charset=utf-8`.

## File Structure

- `poc/server.mjs` — JWT/token, Drive client, HTTP handler, static file, download proxy.
- `poc/app.js` — fungsi murni (`filterPhotos`, `naturalCompare`, `formatBytes`, `pickThumb`) + wiring DOM.
- `poc/index.html` — struktur dan CSS satu halaman.
- `poc/server.test.mjs` — tes server dengan stub Drive.
- `poc/app.test.mjs` — tes fungsi murni klien.
- `poc/README.md` — cara menjalankan dan batasan.

## Review Focus

- Kebocoran kunci service account ke browser, JSON, atau log.
- Endpoint unduhan menjadi proxy Drive terbuka untuk ID sembarang.
- Nama file dari Drive berisi `"` atau CR/LF merusak header `Content-Disposition`.
- Paginasi `files.list` terlewat sehingga sebagian foto hilang tanpa pesan.
- URL thumbnail kedaluwarsa saat halaman dibiarkan terbuka; gambar rusak harus jatuh ke placeholder, bukan halaman kosong.

---

### Task 1: JWT service account

**Files:**
- Create: `poc/server.mjs`
- Create: `poc/server.test.mjs`

**Interfaces:**
- Produces: `b64url(input: Buffer | string): string`; `makeAssertion(sa: { client_email: string, private_key: string }, now?: number): string`.

- [ ] **Step 1: Write the failing test**

```js
// poc/server.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { b64url, makeAssertion } from './server.mjs';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const sa = { client_email: 'poc@example.iam.gserviceaccount.com', private_key: privateKey };

test('b64url has no padding or unsafe characters', () => {
  assert.equal(b64url('a?b~c'), 'YT9ifmM');
});

test('makeAssertion produces a three-part RS256 JWT with drive.readonly scope', () => {
  const [header, claim, sig] = makeAssertion(sa, 1_700_000_000_000).split('.');
  assert.equal(header.split('.').length, 1);
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const decoded = JSON.parse(Buffer.from(claim, 'base64url'));
  assert.equal(decoded.iss, sa.client_email);
  assert.equal(decoded.scope, 'https://www.googleapis.com/auth/drive.readonly');
  assert.equal(decoded.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(decoded.exp - decoded.iat, 3600);
  assert.ok(sig.length > 100);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test poc/server.test.mjs`
Expected: FAIL — `Cannot find module './server.mjs'`.

- [ ] **Step 3: Implement `b64url` and `makeAssertion`**

`b64url` uses `Buffer.from(input).toString('base64')` then strips `=`, maps `+`→`-`, `/`→`_`.
`makeAssertion` builds header and claim (`iat` = seconds from `now`, `exp` = `iat + 3600`), signs `header.claim` with `createSign('RSA-SHA256')` and `sa.private_key`, returns all three segments joined by `.`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test poc/server.test.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add poc/server.mjs poc/server.test.mjs
git commit -m "feat(poc): sign service-account JWTs without dependencies"
```

---

### Task 2: Album listing and gallery endpoint

**Files:**
- Modify: `poc/server.mjs`
- Modify: `poc/server.test.mjs`

**Interfaces:**
- Consumes: `makeAssertion`, `b64url`.
- Produces:
  - `createDriveClient({ keyFile, folderId, fetchImpl? }): { getAlbum(): Promise<Album>, openOriginal(id: string): Promise<Response> }`
  - `Album = { id: string, title: string, photos: Photo[] }`
  - `Photo = { id: string, name: string, width: number, height: number, size: number, thumb: string, preview: string }`
  - `createGalleryServer({ drive, rootDir }): import('node:http').Server` (not listening)
  - Gallery cache: 60 s TTL, concurrent callers share one in-flight promise.

- [ ] **Step 1: Write the failing tests**

```js
// appended to poc/server.test.mjs
function stubFetch(pages) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const u = new URL(url);
    if (u.pathname.endsWith('/token')) return json({ access_token: 'tkn', expires_in: 3600 });
    if (u.pathname.endsWith('/files')) {
      const page = pages.shift() ?? { files: [] };
      return json(page);
    }
    if (u.pathname === '/drive/v3/files/folder-1') {
      return json({ id: 'folder-1', name: '0104 Akreditasi LAM INFOKOM' });
    }
    throw new Error(`unexpected call ${url}`);
  };
  impl.calls = calls;
  return impl;
}
const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

test('listImages follows pagination, filters non-images, dedupes and sorts naturally', async () => {
  const drive = createDriveClient({
    keyFile: sa,
    folderId: 'folder-1',
    fetchImpl: stubFetch([
      { nextPageToken: 'p2', files: [
        { id: 'b', name: 'TOP10.jpg', mimeType: 'image/jpeg', size: '100', thumbnailLink: 'https://lh3/x=s220', imageMediaMetadata: { width: 6000, height: 4000 } },
        { id: 'v', name: 'clip.mp4', mimeType: 'video/mp4', size: '9' },
      ] },
      { files: [
        { id: 'a', name: 'TOP2.jpg', mimeType: 'image/jpeg', size: '200', thumbnailLink: 'https://lh3/y=s220', imageMediaMetadata: { width: 4000, height: 6000 } },
        { id: 'b', name: 'TOP10.jpg', mimeType: 'image/jpeg', size: '100', thumbnailLink: 'https://lh3/x=s220', imageMediaMetadata: { width: 6000, height: 4000 } },
      ] },
    ]),
  });
  const album = await drive.getAlbum();
  assert.equal(album.title, '0104 Akreditasi LAM INFOKOM');
  assert.deepEqual(album.photos.map((p) => p.name), ['TOP2.jpg', 'TOP10.jpg']);
  assert.equal(album.photos[0].thumb, 'https://lh3/y=s400');
  assert.equal(album.photos[0].preview, 'https://lh3/y=s1600');
  assert.equal(album.photos[0].orientation, 'portrait');
});

test('GET /api/gallery serves the album and caches for 60 seconds', async () => {
  let calls = 0;
  const drive = { getAlbum: async () => (calls++, { id: 'folder-1', title: 'A', photos: [] }) };
  const server = createGalleryServer({ drive, rootDir: new URL('.', import.meta.url) });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const first = await (await fetch(`${base}/api/gallery`)).json();
  await fetch(`${base}/api/gallery`);
  server.close();
  assert.equal(first.album.title, 'A');
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test poc/server.test.mjs`
Expected: FAIL — `createDriveClient is not a function`.

- [ ] **Step 3: Implement the Drive client and gallery route**

`getAlbum()` gets folder metadata (`files/:id?fields=id,name`), then paginates
`files?q='<id>' in parents and trashed=false&fields=nextPageToken,files(id,name,mimeType,size,thumbnailLink,imageMediaMetadata(width,height))&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`.
Keep `image/*`, dedupe by `id`, add `orientation` (`width >= height ? 'landscape' : 'portrait'`), rewrite `thumb`/`preview` by replacing a trailing `=s<number>` with `=s400`/`=s1600`, sort by `naturalCompare(name)`. Token cached until `expires_in - 60` seconds.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test poc/server.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add poc/server.mjs poc/server.test.mjs
git commit -m "feat(poc): list Drive folder and serve cached gallery JSON"
```

---

### Task 3: Original download proxy

**Files:**
- Modify: `poc/server.mjs`
- Modify: `poc/server.test.mjs`

**Interfaces:**
- Produces: `makeContentDisposition(filename: string): string`; route `GET /api/download/:id` → `400` for malformed id, `404` for id not in album, otherwise stream with `Content-Disposition` and `Content-Type` from Drive.

- [ ] **Step 1: Write the failing tests**

```js
test('makeContentDisposition escapes quotes and strips CR/LF', () => {
  assert.equal(makeContentDisposition('a"b\r\nc.jpg'), 'attachment; filename="a_b__c.jpg"');
});

test('download rejects malformed and unknown ids without calling Drive', async () => {
  const drive = {
    getAlbum: async () => ({ id: 'f', title: 'A', photos: [{ id: 'known123456', name: 'a.jpg' }] }),
    openOriginal: async () => { throw new Error('must not be called'); },
  };
  const server = createGalleryServer({ drive, rootDir: new URL('.', import.meta.url) });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/download/bad!id`)).status, 400);
  assert.equal((await fetch(`${base}/api/download/unknown12345`)).status, 404);
  server.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test poc/server.test.mjs`
Expected: FAIL — `makeContentDisposition is not a function`.

- [ ] **Step 3: Implement `makeContentDisposition` and the route**

Sanitize `[^A-Za-z0-9._ -]` to `_`, replace `[\r\n"]` first. Valid id: `/^[A-Za-z0-9_-]{10,}$/`. Look the photo up in `getAlbum()` (cached), not a free-form call. `openOriginal(id)` fetches `files/:id?alt=media&supportsAllDrives=true` and returns the raw `Response`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test poc/server.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add poc/server.mjs poc/server.test.mjs
git commit -m "feat(poc): proxy original downloads behind an allow-list"
```

---

### Task 4: Client filter and formatting logic

**Files:**
- Create: `poc/app.js`
- Create: `poc/app.test.mjs`

**Interfaces:**
- Produces: `filterPhotos(photos, filter, favorites): Photo[]` with `filter` in `'all' | 'favorites' | 'landscape' | 'portrait'` and `favorites: Set<string>`; `naturalCompare(a: string, b: string): number`; `formatBytes(bytes: number): string`; `pickThumb(photo, width: 400 | 800): string`.

- [ ] **Step 1: Write the failing tests**

```js
// poc/app.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPhotos, naturalCompare, formatBytes, pickThumb } from './app.js';

const photos = [
  { id: '1', name: 'TOP2.jpg', orientation: 'landscape', thumb: 'https://lh3/a=s400' },
  { id: '2', name: 'TOP10.jpg', orientation: 'portrait', thumb: 'https://lh3/b=s400' },
];

test('filterPhotos supports all, favorites, landscape and portrait', () => {
  assert.equal(filterPhotos(photos, 'all', new Set()).length, 2);
  assert.deepEqual(filterPhotos(photos, 'favorites', new Set(['2'])).map((p) => p.id), ['2']);
  assert.deepEqual(filterPhotos(photos, 'landscape', new Set()).map((p) => p.id), ['1']);
  assert.deepEqual(filterPhotos(photos, 'portrait', new Set()).map((p) => p.id), ['2']);
});

test('naturalCompare orders TOP2 before TOP10', () => {
  assert.ok(naturalCompare('TOP2.jpg', 'TOP10.jpg') < 0);
});

test('formatBytes is human readable', () => {
  assert.equal(formatBytes(8113091), '7.7 MB');
});

test('pickThumb swaps the Drive size suffix', () => {
  assert.equal(pickThumb({ thumb: 'https://lh3/a=s400' }, 800), 'https://lh3/a=s800');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test poc/app.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the four pure functions**

`naturalCompare` splits on digit runs (`/(\d+|\D+)/g`) and compares numeric chunks numerically. `filterPhotos` returns a new array. `formatBytes` uses MB with one decimal above 1e6. `pickThumb` replaces `=s\d+$`. DOM wiring goes under `if (typeof document !== 'undefined')` so Node can import the module.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test poc/app.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add poc/app.js poc/app.test.mjs
git commit -m "feat(poc): add testable client filter and formatting helpers"
```

---

### Task 5: Single page UI, static serving, docs

**Files:**
- Create: `poc/index.html`
- Create: `poc/README.md`
- Modify: `poc/server.mjs`
- Modify: `poc/server.test.mjs`

**Interfaces:**
- Consumes: `/api/gallery`, `/api/download/:id`, `app.js` exports.
- Produces: `GET /` and `GET /app.js` from `rootDir`; `GET /favicon.ico` → 204.

- [ ] **Step 1: Write the failing test**

```js
test('index page has gallery mount points and no key material', async () => {
  const drive = { getAlbum: async () => ({ id: 'f', title: 'A', photos: [] }) };
  const server = createGalleryServer({ drive, rootDir: new URL('.', import.meta.url) });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const html = await (await fetch(`${base}/`)).text();
  server.close();
  assert.match(html, /<title>Potokuadrat/);
  for (const id of ['gallery', 'lightbox', 'filters', 'status']) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /private_key|PRIVATE KEY/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test poc/server.test.mjs`
Expected: FAIL — `/` returns 404.

- [ ] **Step 3: Build the page**

`index.html`: dark, system font stack, accent `#f5c451`. Header with `#album-title`, `#album-count`, `#filters` chips (All, Favorites, Landscape, Portrait), `#download-favorites`. `#status` for loading/empty/error text. `#gallery` grid of `<figure><button class="photo">` with `<img loading="lazy" decoding="async" srcset>`, heart button. `<dialog id="lightbox">` with image, name, prev/next/close/download. Footer "Potokuadrat PoC".
`app.js` DOM wiring: fetch `/api/gallery` once, render, favorites in `localStorage` key `potokuadrat:favorites:<albumId>`, filter clicks, lightbox keyboard (ArrowLeft/ArrowRight/Escape), preload neighbours at `=s1600`, image `onerror` swaps to a neutral placeholder and `alt` text.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test poc/server.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Verify end to end against real Drive**

Run: `node poc/server.mjs` then
`curl -s localhost:3000/api/gallery | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.album.title,j.photos.length,j.photos[0].name)})"`
Expected: `0104 Akreditasi LAM INFOKOM 269 TOP00607.jpg` (atau nama pertama hasil sort).
Then `curl -sI localhost:3000/api/download/<id-dari-daftar>` and pastikan `content-disposition` dan `content-length` ada.
Open the page in a browser and confirm the first grid screen renders.

- [ ] **Step 6: Write `poc/README.md`**

Isi: cara jalan (`node poc/server.mjs`), env (`DRIVE_KEY_FILE`, `DRIVE_FOLDER_ID`, `PORT`), cara tes (`node --test poc/`), dan lima batasan PoC (tanpa auth, tanpa zip, thumbnail Drive sementara, tanpa rekursi, tanpa turunan lokal).

- [ ] **Step 7: Commit**

```bash
git add poc/index.html poc/app.js poc/server.mjs poc/server.test.mjs poc/README.md
git commit -m "feat(poc): single-page client gallery over Google Drive"
```

---

## Catatan sinkronisasi 2026-11-13

- Plan ini disimpan sebagai catatan asal PoC. Target implementasi ada di repo
  aplikasi: `src/server/drive/**` untuk server, `src/features/gallery/**` untuk
  klien.
- `poc/README.md` di repo asal masih menyebut route thumbnail hanya
  `400/800/1600`; endpoint sebenarnya sudah menerima `=s2048`. Perbaiki saat kode
  diport.
- Nama produk sudah menjadi Potokuadrat; path spec di repo ini adalah
  `docs/specs/2026-11-12-potokuadrat-poc-design.md`.
