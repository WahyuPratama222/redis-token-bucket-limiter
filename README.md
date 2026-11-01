<div align="center">
  <h1>🪣 Redis Token Bucket Limiter</h1>

  <p>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
    <img src="https://img.shields.io/badge/Lua-2C2D72?style=for-the-badge&logo=lua&logoColor=white" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
    <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" />
  </p>

  <p>
    <strong>Eksperimen distributed rate limiter (token bucket) dengan Redis + Lua di NestJS</strong>
  </p>
</div>

---

## 🌟 Overview

Proyek riset kecil untuk menjawab satu pertanyaan: **kenapa rate limiter yang "baca lalu tulis" bocor saat ada lebih dari satu server, dan bagaimana Redis + Lua memperbaikinya?**

Repo ini menjalankan **dua server NestJS** di depan **satu Redis**, lalu membandingkan dua implementasi token bucket dengan aturan yang sama persis:

- **Naif**: perintah Redis biasa (`HMGET`, hitung di aplikasi, `HSET`).
- **Lua**: seluruh logika dijalankan atomik di dalam Redis lewat satu script.

Sebuah decorator `@RateLimit()` dan guard juga disertakan sebagai contoh pemakaian di route nyata.

---

## 🔬 Masalahnya

Pada versi naif, ada dua sumber bug saat dua server bekerja bersamaan:

1. **Race condition.** Ada celah antara membaca dan menulis token.

| Langkah | Server A         | Server B         |
| ------- | ---------------- | ---------------- |
| 1       | baca tokens = 1  | baca tokens = 1  |
| 2       | hitung → lolos   | hitung → lolos   |
| 3       | tulis tokens = 0 | tulis tokens = 0 |

Dua request lolos padahal hanya ada satu token.

2. **Jam yang berbeda.** Refill dihitung dari `Date.now()` di tiap server, sehingga selisih jam antarserver ikut memengaruhi hasil.

## 💡 Solusinya

Seluruh langkah (baca, refill, ambil token, tulis ulang) dijalankan dalam **satu script Lua**. Redis mengeksekusi script tanpa interupsi, jadi tidak ada celah di antara baca dan tulis. Waktu diambil dari `redis.call('TIME')`, sehingga semua server memakai jam yang sama. Script didaftarkan sekali lewat `defineCommand` ioredis, dan pemanggilan berikutnya hanya mengirim hash-nya (`EVALSHA`).

---

## 📊 Hasil Eksperimen

Setiap ronde mengirim 100 request paralel (bergantian ke server A dan B) ke bucket berkapasitas 5.

| Implementasi | Request yang lolos (dari 100)        |
| ------------ | ------------------------------------ |
| Naif         | 11 (dan 100 pada beban yang sangat rapat) |
| Lua          | **5**, selalu tepat                  |

> Angka naif bervariasi tiap ronde karena bergantung pada waktu. Yang konsisten: naif meloloskan lebih dari kapasitas, Lua tidak pernah.

Jalankan sendiri:

```bash
# 5 rounds against the production compose (default)
./scripts/compare.sh 5

# against the dev compose instead
COMPOSE_FILE=docker-compose.dev.yml ./scripts/compare.sh 3
```

---

## 🛠️ Tech Stack

| Kategori         | Teknologi                          |
| ---------------- | ---------------------------------- |
| Framework        | NestJS 12 (TypeScript), Node.js 22 |
| Redis client     | ioredis                            |
| Penyimpanan      | Redis 7 + Lua script               |
| Linter           | oxlint                             |
| Containerization | Docker, Docker Compose             |
| CI/CD            | GitHub Actions → GHCR              |

---

## ⚙️ Environment Configuration

Copy `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

| Variabel                          | Deskripsi                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `APP_A_PORT` / `APP_B_PORT`       | Port host untuk server A dan B (default `3001` dan `3002`)                                              |
| `REDIS_PORT`                      | Port host Redis, hanya untuk compose dev                                                                |
| `TRUST_PROXY`                     | `true` hanya jika aplikasi berjalan di belakang reverse proxy yang kamu kendalikan (default `false`)    |
| `PORT` / `REDIS_URL`              | Hanya dibaca saat aplikasi dijalankan di luar Docker (`node --env-file=.env dist/main`)                 |

> ⚠️ **Soal `TRUST_PROXY`:** jika menyala tanpa proxy sungguhan di depan aplikasi, klien bisa memalsukan header `X-Forwarded-For` dan lolos dari limiter. Biarkan `false` kecuali ada proxy.

---

## 🚀 Cara Menjalankan

Kedua mode memakai port host yang sama (`3001`, `3002`). Jalankan **satu mode saja**, atau `docker compose down` dulu sebelum berpindah.

### Mode A — Docker Development (build lokal)

```bash
git clone https://github.com/WahyuPratama222/redis-token-bucket-limiter.git
cd redis-token-bucket-limiter
cp .env.example .env

docker compose -f docker-compose.dev.yml up -d --build
```

Dua server berjalan di `http://localhost:3001` dan `http://localhost:3002`, keduanya memakai satu Redis. Setelah mengubah kode, jalankan lagi dengan `--build`.

```bash
docker compose -f docker-compose.dev.yml down
```

### Mode B — Docker Production (image dari GHCR)

Menjalankan image yang dibangun oleh CI, untuk memverifikasinya secara lokal.

```bash
docker compose pull
docker compose up -d
```

```bash
docker compose down
```

---

## 🔌 Endpoint

| Method | Endpoint              | Kegunaan                                                                                      |
| ------ | --------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/naive?user=user1`   | Limiter versi naif (kapasitas 5, isi ulang 1 token per 60 detik)                              |
| GET    | `/lua?user=user1`     | Limiter versi Lua (aturan sama persis dengan `/naive`)                                        |
| GET    | `/guarded`            | Contoh `@RateLimit({ capacity: 3, refillPerSec: 1 / 10 })` lewat guard, per route per IP      |

Respons sukses `200`, jika jatah habis `429 Too Many Requests`. Khusus `/guarded`, header berikut ikut dikirim:

| Header                  | Arti                                                                  |
| ----------------------- | --------------------------------------------------------------------- |
| `X-RateLimit-Limit`     | Kapasitas bucket                                                      |
| `X-RateLimit-Remaining` | Sisa jatah, dibulatkan ke bawah                                       |
| `Retry-After`           | Detik yang harus ditunggu (dibulatkan ke atas, minimal 1), saat `429` |

Memakai decorator pada route lain:

```typescript
@RateLimit({ capacity: 5, refillPerSec: 1 / 60 })
@Get('products')
products() {
  return [];
}
```

---

## 🧠 Catatan Desain

- **Fail-open.** Jika Redis mati, guard meloloskan request dan mencatat warning, supaya matinya limiter tidak mematikan API. Untuk endpoint sensitif (misalnya login), fail-closed lebih aman, dan perilaku ini perlu diubah.
- **Pembulatan yang jujur.** Token disimpan sebagai pecahan. `Remaining` dibulatkan ke bawah dan `Retry-After` ke atas, jadi header tidak pernah lebih optimistis dari kenyataan.
- **Identitas klien.** Kunci bucket `rl:<route>:<ip>`. Di belakang proxy, nyalakan `TRUST_PROXY` agar `req.ip` berisi IP klien asli, bukan IP proxy.
- **Kegagalan cepat.** Klien Redis memakai `maxRetriesPerRequest: 1`, jadi saat Redis mati request tidak menggantung lama sebelum jatuh ke jalur fail-open.

---

## 📁 Project Structure

```
redis-token-bucket-limiter/
├── .github/workflows/        # CI/CD (GitHub Actions)
├── scripts/
│   └── compare.sh            # Perbandingan naif vs Lua
├── src/
│   ├── limiter/
│   │   ├── naive/            # Limiter naif (HMGET + HSET)
│   │   ├── lua/              # Limiter Lua + script token bucket
│   │   ├── rate-limit/       # Decorator @RateLimit dan guard
│   │   ├── limiter.controller.ts
│   │   ├── limiter.module.ts
│   │   └── limiter.types.ts
│   ├── redis/                # Modul Redis global (ioredis)
│   ├── app.module.ts
│   └── main.ts
├── Dockerfile                # Image production
├── Dockerfile.dev            # Image development
├── docker-compose.yml        # Production (image dari GHCR)
├── docker-compose.dev.yml    # Development (build lokal)
└── .env.example
```

---

## ⚡ CI/CD

GitHub Actions menjalankan job `build-and-test` (install dependency, build, test) lalu `build-and-push`, yang mendorong image ke **GitHub Container Registry**:

```bash
docker pull ghcr.io/wahyupratama222/redis-token-bucket-limiter:latest
```

---

## 🛠️ Troubleshooting

### Perubahan kode tidak terlihat di container dev

Compose dev tidak memakai bind mount; kode disalin saat build. Jalankan ulang dengan build:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Limiter terasa tidak membatasi

Kemungkinan Redis tidak terjangkau dan guard sedang fail-open. Cek log aplikasi untuk baris `Rate limiter unavailable`.

### `port is already allocated`

Compose dev dan production memakai port host yang sama. Matikan salah satu dengan `docker compose down`, atau ubah `APP_A_PORT` dan `APP_B_PORT` di `.env`.

---

<div align="center">
  <sub>Dibuat dan dikembangkan oleh <strong>Wahyu Pratama</strong></sub>

<br /><br />

<a href="https://github.com/WahyuPratama222"><img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" /></a>
<a href="https://www.linkedin.com/in/wahyu-pratama-ptm"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" /></a>

</div>
