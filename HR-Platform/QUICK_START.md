# ⚡ Quick Start Guide - HR Platform

Bu qo'llanma loyihani **5 daqiqada** ishga tushirish uchun.

---

## 🎯 Tez Yo'l (Docker)

### 1. Talablar

- ✅ **Docker** va **Docker Compose** o'rnatilgan bo'lishi kerak
- ✅ **Git** o'rnatilgan bo'lishi kerak

### 2. Loyihani Clone Qiling

```bash
git clone <your-repo-url>
cd HR-Platform
```

### 3. Environment Fayllarini Yarating

**Backend:**
```bash
cd apps/backend
cp .env.example .env
```

**Muhim:** `.env` faylidagi `JWT_ACCESS_SECRET` va `JWT_REFRESH_SECRET` ni o'zgartiring (32+ belgi):

```env
JWT_ACCESS_SECRET=your_very_long_secret_key_here_min_32_chars_abc123
JWT_REFRESH_SECRET=your_another_long_secret_key_here_min_32_chars_xyz789
```

**Frontend:**
```bash
cd apps/frontend
cp .env.example .env
```

### 4. Docker bilan Ishga Tushiring

Root papkadan:

```bash
docker-compose up -d
```

**Wait** 30-60 soniya (PostgreSQL tayyor bo'lishi uchun)

### 5. Database Sozlash

```bash
# Migrationlar
docker-compose exec backend pnpm migrate

# SUPER_ADMIN yaratish
docker-compose exec backend pnpm seed
```

### 6. Brauzerda Oching

**Frontend:** http://localhost:5173

**Birinchi kirish:** `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (`.env.example`) — `pnpm seed` shu qiymatlar bilan hisob yaratadi, qattiq kodlangan standart parol yo'q.

**Backend API:** http://localhost:5000/api/v1

---

## 🛠️ Local Development (Docker'siz)

### 1. Talablar

- ✅ Node.js 20+
- ✅ pnpm 8+
- ✅ PostgreSQL 16+

### 2. PostgreSQL Sozlash

```bash
# PostgreSQL ishga tushiring va database yarating
createdb hr_platform
```

### 3. Dependencies O'rnatish

```bash
# Root papkadan
pnpm install
```

### 4. Environment Sozlash

Backend `.env`:
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/hr_platform
JWT_ACCESS_SECRET=your_secret_here_min_32_characters_long
JWT_REFRESH_SECRET=your_another_secret_here_min_32_characters_long
```

### 5. Database Migrationlari

```bash
cd apps/backend
pnpm migrate
pnpm seed
```

### 6. Ishga Tushirish

**Option A: Ikkala server parallel (Root papkadan)**
```bash
pnpm dev
```

**Option B: Alohida terminalda**

Terminal 1 - Backend:
```bash
cd apps/backend
pnpm dev
```

Terminal 2 - Frontend:
```bash
cd apps/frontend
pnpm dev
```

### 7. Brauzerda Ochish

- Frontend: http://localhost:5173
- Backend: http://localhost:5000/api/v1

---

## 🧪 Test Qilish

### 1. Health Check

```bash
curl http://localhost:5000/health
```

### 2. Login Test

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$SEED_ADMIN_EMAIL"'",
    "password": "'"$SEED_ADMIN_PASSWORD"'"
  }'
```

Agar `accessToken` qaytsa - hammasi ishlayapti! ✅

---

## 📂 Loyiha Tuzilmasi

```
HR-Platform/
├── apps/
│   ├── backend/          # Node.js API (Port 5000)
│   │   ├── src/
│   │   │   ├── modules/  # Auth, Invite, Employees, Applications
│   │   │   ├── db/       # Migrations, Seed
│   │   │   └── app.js    # Entry point
│   │   └── package.json
│   │
│   └── frontend/         # React SPA (Port 5173)
│       ├── src/
│       │   ├── pages/    # Login, Dashboard, Kanban
│       │   ├── store/    # Zustand (auth, theme)
│       │   └── services/ # API calls
│       └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## 🎨 Features

### ✅ Authentication
- JWT (Access + Refresh tokens)
- Role-based access (SUPER_ADMIN, ADMIN, HR)

### ✅ Invite System
- Token-based registration
- Expiration after 7 days

### ✅ Employee Management
- CRUD operations
- Auto-create application on employee creation

### ✅ Kanban Board
- 3 columns: KELDI → QOSHILDI → SHARTNOMA
- Drag & Drop (Frontend: to be implemented)
- Audit log

### ✅ Theme
- Light/Dark mode
- Persistent in localStorage

---

## 📊 User Roles

| Role | Permissions |
|------|------------|
| **SUPER_ADMIN** | Tizimni to'liq boshqarish, invite yaratish |
| **ADMIN** | Ishchi qo'shish, ma'lumotlarni tahrirlash |
| **HR** | Kanban boshqarish, status o'zgartirish |
| **EMPLOYEE** | (Kelajak uchun) |

---

## 🔧 Troubleshooting

### Port band bo'lsa:

Backend (5000) yoki Frontend (5173) porti band bo'lsa:

```bash
# Backend portni o'zgartirish
# apps/backend/.env da:
PORT=5001

# Frontend portni o'zgartirish
# apps/frontend/vite.config.js da:
server: { port: 5174 }
```

### Docker xatolik bersa:

```bash
# Hamma containerlarni to'xtatish
docker-compose down

# Volumelarni tozalash
docker-compose down -v

# Qaytadan ishga tushirish
docker-compose up -d --build
```

### Database ulanish xatosi:

1. PostgreSQL ishga tushganligini tekshiring:
```bash
docker-compose logs postgres
```

2. Database URL to'g'riligini tekshiring (`.env`)

### Migration xatosi:

Agar jadvallar allaqachon mavjud bo'lsa:

```bash
# PostgreSQL ga kiring
docker-compose exec postgres psql -U postgres -d hr_platform

# Barcha jadvallarni o'chirish (EHTIYOTKORLIK!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Qayta migration
docker-compose exec backend pnpm migrate
docker-compose exec backend pnpm seed
```

---

## 📚 Keyingi Qadamlar

1. ✅ [README.md](./README.md) - To'liq dokumentatsiya
2. ✅ [API_TESTING.md](./API_TESTING.md) - API test qilish
3. ✅ [CONTRIBUTING.md](./CONTRIBUTING.md) - Hissa qo'shish
4. ✅ Frontend sahifalarni yaratish (Login, Kanban, Dashboard)

---

## ❓ Yordam Kerakmi?

- 📖 [Full Documentation](./README.md)
- 🐛 [GitHub Issues](https://github.com/yourrepo/issues)
- 📧 Email: support@hrplatform.com

---

<div align="center">

**🎉 Muvaffaqiyatli ishga tushdi! 🎉**

Endi brauzerda **http://localhost:5173** ga o'ting!

</div>
