# Game Analytic

Dashboard internal Kosong Interactive untuk riset pasar game mobile: menemukan game baru dan
yang sedang naik daun, serta memantau pergerakan rating, jumlah rating, dan peringkat chart dari
waktu ke waktu.

> **Ini sinyal riset, bukan data resmi.** Data diambil secara sampel, bukan seluruh katalog
> store. Trend Score adalah skor internal kita sendiri, bukan label dari store, dan angka install
> Google Play selalu berupa rentang, bukan jumlah unduhan pasti.

## Isi dashboard

| Halaman | Isi |
|---|---|
| **Overview** | Ringkasan: jumlah game yang dipantau, game yang baru ditemukan, game trending, dan kesegaran data per sumber |
| **Trending Games** | Semua game diurutkan berdasarkan Trend Score, dengan filter rating/skor, sort, dan pagination |
| **New Releases** | Game dengan tanggal rilis dari store dalam 7, 30, atau 90 hari terakhir |
| **Game Detail** | Metrik, grafik riwayat (rating, jumlah rating, rank chart), rincian Trend Score, dan tabel snapshot sumber |

Semua halaman butuh login (email + password lewat Supabase Auth). Filter bisa dipilih untuk
**Indonesia** dan **Global (US store)**. Store tidak punya data global, jadi "Global" memakai
store Amerika Serikat sebagai proxy.

## Sumber data

| Sumber | Cara ambil | Yang diambil |
|---|---|---|
| **Apple App Store** | iTunes Search API resmi dari Apple | Hasil pencarian untuk kata kunci seed: `puzzle`, `idle`, `match 3` |
| **Google Play** | Scraper open-source [`@mradex77/google-play-scraper`](https://www.npmjs.com/package/@mradex77/google-play-scraper), dibungkus adapter supaya bisa diganti | Chart **Top Free** kategori Game |

Untuk setiap negara (`id` dan `us`), tiap sumber mengambil hingga 10 game per seed atau chart.
Seed-nya ada di `config/discovery-seeds/` dan daftar negaranya di `config/countries/`.

Yang disimpan per game: metadata (judul, developer, kategori, tanggal rilis, ikon, link store) dan
**snapshot** angka (rating, jumlah rating, jumlah review, rentang install, harga, versi), plus posisi
di chart. Snapshot baru hanya ditulis kalau ada angka yang berubah, atau sekali sehari sebagai
heartbeat, supaya database tidak dipenuhi data yang sama.

Batasan saat ini:
- Apple belum punya data chart, jadi komponen "rank gain" dari Trend Score kosong untuk game Apple.
- Discovery cenderung menangkap game yang sudah populer, sehingga halaman New Releases masih sepi.

## Jadwal pengumpulan data

Collector berjalan di **GitHub Actions** (`.github/workflows/collect.yml`), **setiap 6 jam** pada
menit ke-17: pukul 00:17, 06:17, 12:17, dan 18:17 **UTC** (07:17, 13:17, 19:17, dan 01:17 WIB).
GitHub tidak menjamin ketepatan jadwal, jadi run bisa telat beberapa menit atau lebih.

- Bisa dijalankan manual dari tab **Actions → Scheduled collection → Run workflow**.
- Aman dijalankan ulang (idempoten). Data yang tidak berubah tidak ditulis dua kali.
- Setiap run tercatat di tabel `collector_runs`, termasuk error dan item yang dilewati, dan
  kesegarannya tampil di panel **Data coverage** di Overview.
- Butuh repository secret `DATABASE_URL` (Settings → Secrets and variables → Actions).

Dashboard hanya **membaca** database. Membuka halaman tidak pernah memicu pengambilan data.

## Trend Score

`trend_score_v1` bernilai 0–100 dan dihitung dari riwayat snapshot kita sendiri, dibandingkan
dengan game lain di store dan negara yang sama:

| Komponen | Bobot |
|---|---:|
| Kenaikan rank chart (7 hari) | 30% |
| Laju review (7 hari) | 25% |
| Laju jumlah rating (7 hari) | 15% |
| Pertambahan jumlah negara | 15% |
| Seberapa baru game ditemukan | 10% |
| Momentum rating (7 hari) | 5% |

Komponen yang belum bisa diukur tidak dihitung sebagai nol, melainkan dikeluarkan dan bobot
sisanya diskalakan ulang. Skor baru muncul setelah ada sekitar **3,5 hari** riwayat. Setiap skor
bisa ditelusuri sampai ke snapshot sumbernya di halaman Game Detail.

## Struktur repo

```text
apps/web/              Dashboard Next.js (App Router) dan login
apps/collector/        CLI collector yang dijalankan terjadwal
packages/collectors/   Adapter Apple dan Google Play
packages/db/           Skema, migrasi, repository, dan query (Drizzle + PostgreSQL)
packages/analytics/    Perhitungan velocity dan Trend Score (fungsi murni)
packages/shared/       Tipe dan skema Zod bersama
config/                Negara aktif dan seed discovery
docs/                  Rencana MVP, setup Supabase, dan panduan deploy
```

Stack: Next.js, TypeScript, Tailwind CSS, Apache ECharts, Supabase PostgreSQL, Drizzle ORM,
npm workspaces, dan Turborepo.

## Menjalankan di lokal

Butuh Node.js 22.12 atau lebih baru (`.nvmrc` memilih 22.23.3) dan npm 10+.

```bash
nvm use
npm install
```

Salin `.env.example` di root repo menjadi `.env.local`, lalu isi nilainya. Satu file ini dipakai
dashboard maupun collector. Jangan pernah commit `.env.local`.

| Variabel | Untuk apa |
|---|---|
| `DATABASE_URL` | Koneksi PostgreSQL Supabase (server-only) |
| `DIRECT_URL` | Opsional, koneksi langsung untuk migrasi |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase, untuk login |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key Supabase, untuk login |
| `TEST_DATABASE_URL` | Opsional, database sekali pakai untuk integration test |

Jalankan dashboard di `http://localhost:3000`:

```bash
npm run dev:web
```

Akun login dibuat di dashboard Supabase: **Authentication → Users → Add user**. Pendaftaran
publik sebaiknya dimatikan. Tidak ada tabel user sendiri di aplikasi ini.

Menjalankan collector secara manual (`--dry-run` hanya mengambil dan menghitung, tanpa menulis
ke database):

```bash
npm run discover --workspace @analytic-dashboard/collector -- --dry-run
npm run discover --workspace @analytic-dashboard/collector -- --source google_play --country us
```

Migrasi database:

```bash
npm run db:migrate
npm run db:verify
```

Pemeriksaan lengkap (lint, typecheck, test, build):

```bash
npm run check
```

Smoke test ke store sungguhan dijalankan manual, terpisah dari CI:

```bash
npm run smoke:apple --workspace @analytic-dashboard/collectors
npm run smoke:google-play --workspace @analytic-dashboard/collectors
```

## Dokumentasi lain

- `docs/MVP_IMPLEMENTATION_PLAN.md`: ruang lingkup produk, arsitektur, dan fase pengerjaan
- `docs/SUPABASE_SETUP.md`: setup Supabase
- `docs/DEPLOYMENT_VERCEL.md`: deploy dashboard ke Vercel
- `docs/CLAUDE_HANDOFF.md`: status terkini untuk agent berikutnya
