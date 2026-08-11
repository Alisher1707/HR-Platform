# Demo muhiti — `demo.hr.itlive.uz`

Bu hujjat production HR Platformning to'liq mustaqil, sotuv/prezentatsiya uchun mo'ljallangan demo nusxasini tavsiflaydi. Demo production ma'lumotlariga, sirlariga (secrets) va serverlariga hech qanday aloqasi yo'q.

## Demo loginlar

| Rol | Email | Parol |
|---|---|---|
| Super Admin | `demo.admin@hr.itlive.uz` | `DemoAdmin2026!` |
| HR Manager | `demo.hr@hr.itlive.uz` | `DemoHR2026!` |

## Izolyatsiya (nima production bilan bog'lanmagan)

- **Alohida baza**: `hr_demo` (production'da `hr_platform`) — alohida Docker konteynerda (`hr_demo_db`), alohida portda.
- **Alohida sirlar**: `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — production'nikidan butunlay farqli qiymatlar, serverdagi `/root/hr-demo/.env` faylida saqlanadi (git'ga kirmaydi).
- **Alohida konteynerlar**: `hr_demo_backend`, `hr_demo_frontend`, `hr_demo_db` — production'ning `hr_platform_*` konteynerlaridan mustaqil, alohida Docker tarmog'ida (`hr_demo_network`).
- **Faqat soxta ma'lumot**: barcha xodim/nomzod/davomat/onboarding/jarima ma'lumotlari `npm run seed:demo` tomonidan yaratiladi — production'dan hech qanday yozuv ko'chirilmagan va ko'chirilmaydi.
- **Real tashqi integratsiya yo'q**: loyihada email/SMS/to'lov xizmatlariga ulanish umuman mavjud emas (tekshirildi) — demo uchun "mock" qilinadigan hech narsa yo'q. Yagona tashqi aloqa nuqtasi — Hikvision kamera webhook'i (`/api/v1/devices/:token/events`) — demoda haqiqiy kamera bo'lmagani uchun bu funksiya sinovdan o'tkazilmaydi; Davomat bo'limi to'liq qo'lda kiritilgan (seed qilingan) tarixiy ma'lumotlar bilan ishlaydi, xuddi ilovaning o'zidagi "Qo'lda davomat yaratish" funksiyasi kabi.

## "DEMO REJIMI" belgisi

Demo build `VITE_DEMO_MODE=true` bilan qurilganda, har bir sahifada pastki markazda kichik "DEMO REJIMI" belgisi ko'rinadi (`apps/frontend/src/components/ui/DemoBadge.jsx`). Bu belgi faqat demo build'da paydo bo'ladi — production build'da (`VITE_DEMO_MODE` o'rnatilmagan) hech qanday ta'siri yo'q.

## Demo ma'lumotlarini yaratish — `npm run seed:demo`

`apps/backend/src/db/seed-demo.js` — quyidagilarni yaratadi:

- 2 ta demo foydalanuvchi (yuqoridagi jadval).
- ~26 ta xodim (turli filial/bo'lim/lavozim/holat bilan, avtomatik "Shartnoma imzolandi" arizasi bilan).
- ~9 ta nomzod — Lead doskasining barcha 5 ustunida (Yangi Arizalar, Suhbat/Qabul, Sinov Muddati, Rad etildi).
- 3 ta ish jadvali: Moslashuvchan (haftalik, dam kunlari bilan), Gibrid (smena limiti 10 soat), Erkin (smena limiti 12 soat) — xodimlar biriktirilgan.
- So'nggi 14 ish kunlik davomat tarixi — vaqtida/kech qolgan/erta ketgan/smena-limitidan oshgan holatlarning barchasi bilan.
- 2 ta Onboarding rejasi, biriktirishlar va Kutilmoqda/Qabul qilingan/Qaytarilgan holatlarining barchasi.
- Jarima turlari va siyosatlari (namuna sifatida — hozircha xodimga qo'llangan real jarima jadvali ilovada mavjud emas).

**MUHIM**: bu skript ishga tushganda avval **BARCHA** biznes jadvallarini (`TRUNCATE ... CASCADE`) tozalaydi — faqat demo bazasiga qarshi ishlatilishi kerak, **hech qachon production `DATABASE_URL` bilan ishga tushirilmasin**. Xavfsiz, istalgancha qayta ishga tushirish mumkin (har safar demoni toza holatga qaytaradi).

```bash
docker compose exec backend npm run migrate     # sxema joriy holatga
docker compose exec backend npm run seed:demo   # ma'lumotlarni toza holatga qaytarish
```

## Demoni yangilash

Demo `main` branch'ga har push'da AVTOMATIK yangilanmaydi (bu ataylab qilingan — taqdimot paytida kutilmagan o'zgarish bo'lmasligi uchun). Yangilash kerak bo'lganda, serverda:

```bash
ssh root@158.220.111.34
cd /root/hr-demo
./refresh-demo.sh
```

Bu skript: `git pull` → konteynerlarni qayta quradi → migratsiyalarni ishga tushiradi → `seed:demo` bilan ma'lumotlarni qayta to'ldiradi.

## `demo.hr.itlive.uz`ga ulash (DNS + SSL)

1. **DNS**: `itlive.uz` domenini boshqaradigan joyda (registrar yoki Cloudflare) A yozuv qo'shing:
   - Host: `demo.hr` (yoki to'liq `demo.hr.itlive.uz`, panelga qarab)
   - Qiymat: `158.220.111.34`
   - Tarqalishini kuting (odatda bir necha daqiqadan bir necha soatgacha).
2. **SSL**: DNS tarqalgach, serverda:
   ```bash
   certbot --nginx -d demo.hr.itlive.uz
   ```
   Bu `hr.itlive.uz` uchun ishlatilgan xuddi shu usul — nginx konfiguratsiyasini avtomatik SSL bilan yangilaydi.

## Ishga tushirish uchun kerakli env o'zgaruvchilar

`/root/hr-demo/.env` (serverda, git'ga kirmaydi):
```
POSTGRES_PASSWORD=<production'nikidan farqli>
JWT_ACCESS_SECRET=<production'nikidan farqli>
JWT_REFRESH_SECRET=<production'nikidan farqli>
```

`docker-compose.yml`da frontend build argumentlari:
```yaml
frontend:
  build:
    args:
      VITE_API_URL: /api/v1
      VITE_DEMO_MODE: "true"
```
