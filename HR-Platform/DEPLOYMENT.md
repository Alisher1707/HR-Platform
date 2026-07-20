# Deployment (Contabo + GitHub Actions)

## 1. Serverda birinchi marta sozlash (qo'lda, bir marta)

```bash
ssh root@<SERVER_IP>
mkdir -p /root/HR-Platform
cd /root/HR-Platform
git clone https://github.com/itliveacademycompany/HR-Platform.git .

cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
# .env fayllardagi JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DATABASE_URL,
# VITE_API_URL qiymatlarini production uchun to'g'rilang

docker-compose up -d --build
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
```

## 2. GitHub repo Secrets (Settings > Secrets and variables > Actions)

| Secret | Qiymat |
|---|---|
| `SERVER_HOST` | Contabo server IP manzili |
| `SERVER_USER` | SSH foydalanuvchi (masalan `root`) |
| `SERVER_SSH_KEY` | GitHub Actions uchun ajratilgan SSH **private** key (parolasiz) |
| `SERVER_PORT` | SSH porti (odatda `22`, kerak bo'lmasa qo'shmasa ham bo'ladi) |
| `DEPLOY_PATH` | Serverdagi loyiha papkasi, masalan `/root/HR-Platform` |

SSH key generatsiya qilish va serverga qo'shish:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./deploy_key -N ""
cat deploy_key.pub   # buni serverdagi ~/.ssh/authorized_keys ga qo'shing
cat deploy_key       # buni SERVER_SSH_KEY sekretiga qo'ying
```

## 3. Workflow qanday ishlaydi

`.github/workflows/deploy.yml`:

1. **build** — `main`ga har push/PR'da backend va frontend dependencies o'rnatiladi, frontend build qilinadi (compile xatolarini ushlash uchun).
2. **deploy** — faqat `main`ga push bo'lganda, `build` muvaffaqiyatli o'tgandan keyin ishga tushadi: serverga SSH orqali ulanib, `git reset --hard origin/main`, `docker-compose up -d --build` va migratsiyalarni bajaradi.

Endi shunchaki `main` branchga push qilsangiz, avtomatik deploy bo'ladi.
