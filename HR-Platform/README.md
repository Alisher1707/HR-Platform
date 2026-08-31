# 🏢 HR Platform - Recruiting Management System

> **Modern HR platformasi** - Admin tomonidan ishchi qo'shish va HR tomonidan Kanban doskasida arizalarni boshqarish tizimi.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Mundarija

- [Loyiha Haqida](#-loyiha-haqida)
- [Texnologiyalar](#-texnologiyalar)
- [Arxitektura](#-arxitektura)
- [Ishga Tushirish](#-ishga-tushirish)
- [API Endpoints](#-api-endpoints)
- [Foydalanuvchi Rollari](#-foydalanuvchi-rollari)
- [Database Schema](#-database-schema)
- [Environment Variables](#-environment-variables)

---

## 🎯 Loyiha Haqida

**HR Platform** - bu zamonaviy ishga qabul qilish tizimi bo'lib, quyidagi asosiy funksiyalarga ega:

- ✅ **Role-based Access Control** - SUPER_ADMIN, ADMIN, HR, EMPLOYEE rollari
- ✅ **Invite Link System** - Token orqali xavfsiz registratsiya
- ✅ **Kanban Board** - Drag & Drop bilan arizalarni boshqarish
- ✅ **Light/Dark Theme** - Ko'z uchun qulay interfeys
- ✅ **Audit Log** - Barcha o'zgarishlar tarixi
- ✅ **JWT Authentication** - Access + Refresh token strategiyasi
- ✅ **Responsive Design** - Barcha qurilmalar uchun

---

## 🛠️ Texnologiyalar

### Backend
| Texnologiya | Versiya | Vazifasi |
|------------|---------|----------|
| **Node.js** | 20+ | Runtime environment |
| **Express** | 4.18+ | Web framework |
| **PostgreSQL** | 16+ | Database |
| **JWT** | 9.0+ | Authentication |
| **Bcrypt** | 5.1+ | Password hashing |
| **Joi** | 17.11+ | Validation |
| **Helmet** | 7.1+ | Security headers |

### Frontend
| Texnologiya | Versiya | Vazifasi |
|------------|---------|----------|
| **React** | 18.2+ | UI Library |
| **Vite** | 5.0+ | Build tool |
| **React Router** | 6.21+ | Routing |
| **Zustand** | 4.4+ | State management |
| **@dnd-kit** | 6.1+ | Drag & Drop |
| **Axios** | 1.6+ | HTTP client |
| **React Query** | 5.14+ | Server state |

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **pnpm** - Package manager

---

## 🏗️ Arxitektura

```
HR-Platform/
├── apps/
│   ├── backend/              # Node.js API
│   │   ├── src/
│   │   │   ├── config/       # Database, env, constants
│   │   │   ├── modules/      # Auth, Invite, Employees, Applications
│   │   │   ├── shared/       # Middleware, utils
│   │   │   ├── db/           # Migrations, seed
│   │   │   └── app.js        # Express app
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── frontend/             # React SPA
│       ├── src/
│       │   ├── components/   # UI components
│       │   ├── pages/        # Auth, Admin, HR pages
│       │   ├── services/     # API services
│       │   ├── store/        # Zustand stores
│       │   ├── hooks/        # Custom hooks
│       │   └── assets/       # Styles, images
│       ├── Dockerfile
│       └── package.json
│
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

**Yondashuv:** Modular Monolith → Kelajakda Microservices ga o'tish mumkin

---

## 🚀 Ishga Tushirish

### 1️⃣ Talablar

- **Node.js** 20+
- **pnpm** 8+
- **PostgreSQL** 16+ (yoki Docker)
- **Git**

### 2️⃣ Loyihani Clone Qilish

```bash
git clone <repository-url>
cd HR-Platform
```

### 3️⃣ Environment Fayllarini Sozlash

**Backend:**
```bash
cd apps/backend
cp .env.example .env
# .env faylini tahrirlab, JWT secretlarni o'zgartiring
```

**Frontend:**
```bash
cd apps/frontend
cp .env.example .env
```

### 4️⃣ Docker bilan Ishga Tushirish (Tavsiya Etiladi)

```bash
# Root papkadan
docker-compose up -d

# Loglarni ko'rish
docker-compose logs -f

# Database migrationlarni ishga tushirish
docker-compose exec backend pnpm migrate

# SUPER_ADMIN yaratish
docker-compose exec backend pnpm seed
```

**Brauzerda ochish:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api/v1
- Health Check: http://localhost:5000/health

**Birinchi kirish:**
`pnpm seed` ishga tushirilganda `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (va HR uchun `SEED_HR_EMAIL`/`SEED_HR_PASSWORD`) muhit o'zgaruvchilaridan olinadi — qattiq kodlangan standart parol endi YO'Q (`.env.example`ga qarang). Har bir muhit (dev/demo/prod) uchun o'zingiz alohida, kuchli parol tanlang.

⚠️ **MUHIM:** bu faqat ilk `SUPER_ADMIN`/`HR` hisoblarini yaratadi — parolni keyinroq almashtirish uchun `PATCH /api/v1/auth/password` ishlating.

---

### 5️⃣ Docker'siz Ishga Tushirish

**A) Dependencies Install:**
```bash
# Root papkadan
pnpm install
```

**B) PostgreSQL Sozlash:**
```bash
# PostgreSQL ishga tushiring
createdb hr_platform
```

**C) Backend Ishga Tushirish:**
```bash
cd apps/backend

# Migrationlar
pnpm migrate

# Seed data
pnpm seed

# Development server
pnpm dev
```

**D) Frontend Ishga Tushirish (yangi terminal):**
```bash
cd apps/frontend
pnpm dev
```

---

## 📡 API Endpoints

### Base URL: `/api/v1`

#### 🔐 Authentication

| Method | Endpoint | Tavsif | Auth |
|--------|----------|--------|------|
| POST | `/auth/login` | Tizimga kirish | Public |
| POST | `/auth/register` | Ro'yxatdan o'tish (token bilan) | Public |
| POST | `/auth/refresh` | Token yangilash | Cookie |
| POST | `/auth/logout` | Chiqish | JWT |
| GET | `/auth/me` | Joriy foydalanuvchi | JWT |

#### 📨 Invites (Taklif Havolalari)

| Method | Endpoint | Tavsif | Auth |
|--------|----------|--------|------|
| POST | `/invites` | Yangi havola yaratish | SUPER_ADMIN |
| GET | `/invites` | Barcha havolalar | SUPER_ADMIN |
| GET | `/invites/validate/:token` | Token tekshirish | Public |
| DELETE | `/invites/:id` | Havolani o'chirish | SUPER_ADMIN |

#### 👥 Employees (Ishchilar)

| Method | Endpoint | Tavsif | Auth |
|--------|----------|--------|------|
| POST | `/employees` | Yangi ishchi qo'shish | ADMIN |
| GET | `/employees` | Barcha ishchilar | ADMIN, HR |
| GET | `/employees/:id` | Bitta ishchi | ADMIN, HR |
| PUT | `/employees/:id` | Ma'lumot yangilash | ADMIN |
| DELETE | `/employees/:id` | Ishchini o'chirish | ADMIN |

#### 📊 Applications (Arizalar / Kanban)

| Method | Endpoint | Tavsif | Auth |
|--------|----------|--------|------|
| GET | `/applications` | Barcha arizalar | HR, ADMIN |
| GET | `/applications/:id` | Bitta ariza | HR, ADMIN |
| PATCH | `/applications/:id/status` | Status o'zgartirish | HR |
| PATCH | `/applications/:id/order` | Tartib o'zgartirish | HR |
| PUT | `/applications/:id` | Ma'lumot yangilash | HR |
| GET | `/applications/:id/history` | O'zgarishlar tarixi | HR, ADMIN |

---

## 👤 Foydalanuvchi Rollari

### 1. SUPER_ADMIN
- Tizimni to'liq boshqaradi
- Admin havolalar yaratadi
- Barcha ma'lumotlarni ko'radi

### 2. ADMIN
- Yangi ishchilarni qo'shadi
- Ishchilar ma'lumotlarini tahrirlaydi
- Arizalarni ko'radi (faqat o'qish)

### 3. HR
- Kanban doskasida arizalarni boshqaradi
- Status o'zgartiradi (KELDI → QOSHILDI → SHARTNOMA)
- Ishchilarga HR tayinlaydi
- Izohlar qo'shadi

### 4. EMPLOYEE
- (Kelajak uchun saqlanadi)

---

## 🗄️ Database Schema

### `users` - Foydalanuvchilar
```sql
- id: UUID
- email: VARCHAR(255) UNIQUE
- password_hash: VARCHAR(255)
- role: ENUM (SUPER_ADMIN, ADMIN, HR, EMPLOYEE)
- first_name, last_name: VARCHAR(100)
- is_active: BOOLEAN
- created_at, updated_at: TIMESTAMPTZ
```

### `invites` - Taklif Havolalari
```sql
- id: UUID
- token: VARCHAR(64) UNIQUE
- created_by: UUID → users(id)
- used_by: UUID → users(id)
- expires_at: TIMESTAMPTZ
- used_at: TIMESTAMPTZ
- is_active: BOOLEAN
```

### `employees` - Ishchilar
```sql
- id: UUID
- first_name, last_name: VARCHAR(100)
- phone: VARCHAR(20)
- address: TEXT
- birth_date: DATE
- experience: SMALLINT (yillar)
- created_by: UUID → users(id)
```

### `applications` - Arizalar (Kanban)
```sql
- id: UUID
- employee_id: UUID → employees(id)
- status: ENUM (KELDI, QOSHILDI, SHARTNOMA)
- position: VARCHAR(200)
- notes: TEXT
- order_index: INTEGER
- assigned_to: UUID → users(id)
```

### `application_history` - Audit Log
```sql
- id: UUID
- application_id: UUID → applications(id)
- changed_by: UUID → users(id)
- old_status, new_status: ENUM
- comment: TEXT
- changed_at: TIMESTAMPTZ
```

---

## 🔧 Environment Variables

### Backend (`.env`)

```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/hr_platform

# JWT (32+ characters required)
JWT_ACCESS_SECRET=your_super_secret_access_key_minimum_32_characters_long
JWT_REFRESH_SECRET=your_super_secret_refresh_key_minimum_32_characters_long
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Invite
INVITE_TOKEN_EXPIRES_DAYS=7
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 📝 Scripts

### Root Level
```bash
pnpm dev              # Backend + Frontend parallel ishga tushirish
pnpm dev:backend      # Faqat backend
pnpm dev:frontend     # Faqat frontend
pnpm build            # Barcha loyihalarni build qilish
```

### Backend
```bash
pnpm dev              # Development server (--watch mode)
pnpm start            # Production server
pnpm migrate          # SQL migrationlarni ishga tushirish
pnpm seed             # SUPER_ADMIN yaratish
```

### Frontend
```bash
pnpm dev              # Development server (HMR)
pnpm build            # Production build
pnpm preview          # Build'ni preview qilish
```

---

## 🐳 Docker Commands

```bash
# Barcha servicesni ishga tushirish
docker-compose up -d

# Loglarni ko'rish
docker-compose logs -f

# To'xtatish
docker-compose down

# Volumelar bilan birga o'chirish
docker-compose down -v

# Rebuild qilish
docker-compose build --no-cache

# Bitta service'ni restart qilish
docker-compose restart backend
```

---

## 🔒 Xavfsizlik

- ✅ **JWT** - Access (15 min) + Refresh (7 days) token
- ✅ **Bcrypt** - Password hashing (12 salt rounds)
- ✅ **Helmet** - Security HTTP headers
- ✅ **Rate Limiting** - Brute-force hujumlardan himoya
- ✅ **CORS** - Cross-origin himoya
- ✅ **httpOnly Cookies** - XSS himoya
- ✅ **Input Validation** - Joi validation
- ✅ **SQL Injection Protection** - Parameterized queries

---

## 🎨 Theme Sistema

Loyiha **Light** va **Dark** rejimlarni qo'llab-quvvatlaydi:

- CSS Variables orqali amalga oshirilgan
- `localStorage` da saqlanadi
- `data-theme` atributi orqali boshqariladi
- Zustand store bilan integratsiya

**Toggle Theme:**
```javascript
import { useThemeStore } from '@/store/themeStore';

const { theme, toggleTheme } = useThemeStore();
```

---

## 📦 Production Deployment

### Build

```bash
# Frontend build
cd apps/frontend
pnpm build

# Backend (o'zgarishsiz, Node.js runtime kerak)
cd apps/backend
```

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🚧 Kelajakdagi Kengaytmalar

**v2.0 Rejasi:**
- ✉️ Email bildirishnomalar (Nodemailer)
- 📎 CV file upload (Multer + S3/Minio)
- 📊 Dashboard statistikasi
- 🔍 Advanced qidiruv va filtrlash
- 👤 Ishchi profili sahifasi
- ✅ Tasks moduli
- 🔄 Real-time yangilanishlar (Socket.io)

**v3.0 Rejasi:**
- 💼 To'liq EMPLOYEE moduli (ish vaqti, maosh)
- 📈 Hisobotlar va eksport (PDF/Excel)
- 🏢 Ko'p filial qo'llab-quvvatlash
- 📱 Mobile app (React Native)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**HR Platform Team**

- 📧 Email: support@hrplatform.com
- 🌐 Website: https://hrplatform.com

---

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/)
- [React](https://reactjs.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [@dnd-kit](https://dndkit.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)

---

<div align="center">

**⭐ Agar loyiha yoqsa, star bering! ⭐**

Made with ❤️ by HR Platform Team

</div>
