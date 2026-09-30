# Game Analytic

Dashboard internal Kosong Interactive untuk riset pasar game: menemukan game baru dan yang sedang
naik daun, lalu memantau pergerakan rating, jumlah rating, peringkat chart, genre, dan mechanic dari
waktu ke waktu.

> **Ini sinyal riset, bukan data resmi.** Game dikumpulkan secara sampel, bukan seluruh katalog
> store. Trend Score adalah skor internal, bukan label dari store. Install Google Play selalu berupa
> rentang, bukan jumlah unduhan pasti. Label genre dan mechanic adalah inferensi, kecuali sudah
> dikonfirmasi manual.

## Fitur

| Halaman | Isi |
|---|---|
| **Overview** | Ringkasan game yang dipantau, **Game Opportunities** (arah riset berbasis bukti), game trending, dan kesegaran data |
| **Trending Games** | Game diurutkan berdasarkan Trend Score, dengan filter dan rincian komponen skor |
| **New Releases** | Game dengan tanggal rilis dari store dalam 7, 30, atau 90 hari terakhir |
| **Genres / Mechanics** | Sebaran game per genre, subgenre, mechanic, tema, dan mode multiplayer; klik label untuk melihat daftar lengkap game-nya |
| **Games** | Semua game yang dipantau, dengan filter (kategori, genre, mechanic, rilis, rating, momentum, status label) |
| ↳ **Watchlist** | Daftar pantauan bersama tim: status, catatan, dan pergerakan sejak game ditambahkan |
| ↳ **Compare** | Bandingkan hingga 4 game berdampingan, tetap dengan konteks store dan negaranya |
| **Game Detail** | Metrik, grafik riwayat, rincian Trend Score, label beserta bukti, dan Confirm/Reject manual |

Tekan **⌘K / Ctrl+K** di halaman mana pun untuk mencari game, developer, atau label.

Filter storefront: **Indonesia** dan **Global (US store)**. Store tidak punya data global, jadi
"Global" memakai store Amerika Serikat sebagai proxy. Semua halaman butuh login, dan akun dibuat
oleh admin (tidak ada pendaftaran publik).

## Cara kerja data

1. **Discovery.** Collector terjadwal (setiap 6 jam) mengambil game dari Apple App Store (iTunes
   Search API resmi, berdasarkan kata kunci genre) dan Google Play (chart kategori Game, lewat
   scraper open-source yang dibungkus adapter supaya bisa diganti).
2. **Snapshot.** Metadata dan angka setiap game disimpan. Snapshot baru hanya ditulis kalau ada
   yang berubah, ditambah satu heartbeat per hari.
3. **Klasifikasi.** Rule deterministik memberi label dari taxonomy yang diberi versi, lalu AI
   memperbaiki dan melengkapinya. Setiap label AI wajib mengutip teks dari listing store. Label
   manual selalu menang dan tidak pernah ditimpa otomatis.
4. **Scoring.** Trend Score dihitung dari riwayat snapshot kita sendiri.
5. **Riset.** Sekali sehari, setiap cohort genre dan mechanic (minimal 5 game) diberi Opportunity
   Score dan Research Confidence yang terpisah, lengkap dengan game pembanding, sinyal positif,
   dan risiko. Skor ini arah riset, bukan prediksi keberhasilan komersial.

Semua job aman dijalankan ulang. Dashboard hanya **membaca** database: membuka halaman atau mencari
tidak pernah memicu pengambilan data maupun job AI.

Batasan saat ini:
- Apple belum punya data chart, jadi komponen rank gain kosong untuk game Apple.
- Discovery cenderung menangkap game yang sudah populer, sehingga New Releases masih sepi.

## Trend Score

`trend_score_v1` bernilai 0–100, dan dibandingkan dengan game lain di store dan negara yang sama:

| Komponen | Bobot |
|---|---:|
| Kenaikan rank chart (7 hari) | 30% |
| Laju review (7 hari) | 25% |
| Laju jumlah rating (7 hari) | 15% |
| Pertambahan jumlah negara | 15% |
| Seberapa baru game ditemukan | 10% |
| Momentum rating (7 hari) | 5% |

Komponen yang belum bisa diukur tidak dihitung sebagai nol. Komponen itu dikeluarkan, lalu bobot
sisanya diskalakan ulang. Skor baru muncul setelah ada sekitar 3,5 hari riwayat, dan bisa
ditelusuri sampai ke snapshot sumbernya.

## Struktur repo

```text
apps/web/              Dashboard Next.js (App Router)
apps/collector/        Collector dan job klasifikasi terjadwal
packages/collectors/   Adapter Apple dan Google Play
packages/db/           Skema, migrasi, repository, dan query
packages/analytics/    Velocity dan Trend Score (fungsi murni)
packages/classifier/   Taxonomy, rule, dan provider AI
packages/shared/       Tipe dan skema bersama
config/                Negara, seed discovery, dan taxonomy (diberi versi)
docs/                  Rencana produk dan dokumentasi teknis
```

Stack: Next.js, TypeScript, Tailwind CSS, Apache ECharts, PostgreSQL (Supabase), Drizzle ORM, Zod,
npm workspaces, dan Turborepo.

## Pengembangan lokal

Butuh Node.js 22.12+ (lihat `.nvmrc`) dan npm 10+.

```bash
nvm use
npm install
```

Konfigurasi lokal ada di `.env.local` di root repo, dengan `.env.example` sebagai template. Minta
nilainya ke maintainer, dan jangan pernah commit file env.

```bash
npm run dev:web   # dashboard di http://localhost:3000
npm run check     # lint, typecheck, test, dan build
```

Perintah collector, migrasi, dan smoke test ada di `docs/OPERATIONS.md`.

## Dokumentasi

- `docs/MVP_IMPLEMENTATION_PLAN.md`: ruang lingkup produk, arsitektur, dan fase pengerjaan
- `docs/OPERATIONS.md`: perintah collector, migrasi, dan smoke test
- `docs/NEXT_DEVELOPMENT_PLAN.md`: roadmap berikutnya (riset otomatis, Steam)
- `docs/CLAUDE_HANDOFF.md`: status terkini dan perintah verifikasi
