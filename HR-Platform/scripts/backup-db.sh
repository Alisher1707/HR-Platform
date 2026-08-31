#!/usr/bin/env bash
# =============================================
# Kunlik ma'lumotlar bazasi zaxira nusxasi (pg_dump)
# =============================================
# docker compose loyihasidagi "postgres" servisidan gzip'langan SQL dump
# oladi. 30 kundan eski nusxalarni avtomatik o'chiradi. Cron orqali har
# kuni ishga tushiriladi (server_setup.md ga qarang).
#
# Ishlatish:  ./backup-db.sh
# Talab qiladi: docker, docker compose (v2), loyiha ildizida ishga
# tushirilishi kerak (yoki PROJECT_DIR ni to'g'ri ko'rsating).

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/root/hr-platform-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_CONTAINER="${DB_CONTAINER:-hr_platform_db}"
DB_NAME="${DB_NAME:-hr_platform}"
DB_USER="${DB_USER:-postgres}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DUMP_FILE="${BACKUP_DIR}/hr_platform_${TIMESTAMP}.sql.gz"
ENC_FILE="${DUMP_FILE}.gpg"

# XAVFSIZLIK-AUDIT.md O-15: every backup is a full copy of every employee's
# PNFL, salary, and bcrypt password hash, written to plain .sql.gz on the
# server's disk (and to wherever it's copied off-site) — no encryption at
# rest at all. BACKUP_ENCRYPTION_PASSPHRASE is now required (fails loudly
# instead of silently writing an unencrypted dump) — generate one once and
# store it somewhere OTHER than this server (password manager, offline):
#   openssl rand -base64 32
# and set it wherever this script actually runs (e.g. the crontab
# environment, /etc/environment, or a root-only-readable file this script
# sources) — never inside the git repo.
if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  echo "[$(date -Iseconds)] XATOLIK: BACKUP_ENCRYPTION_PASSPHRASE o'rnatilmagan — shifrlanmagan backup yozilmaydi." >&2
  echo "  Generatsiya qiling: openssl rand -base64 32" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "[$(date -Iseconds)] Backup boshlandi -> ${ENC_FILE}"

if ! docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" > /dev/null 2>&1; then
  echo "[$(date -Iseconds)] XATOLIK: ${DB_CONTAINER} konteyner ishlamayapti yoki tayyor emas" >&2
  exit 1
fi

# --clean --if-exists: qayta tiklashda avval jadvallarni tozalab qo'yadi,
# shuning uchun restore idempotent bo'ladi. Dump gzip'langach GPG bilan
# simmetrik shifrlanadi va faqat .gpg fayl diskda qoladi (oraliq
# shifrlanmagan .sql.gz hech qachon yozilmaydi).
docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" \
  | gzip \
  | gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase "$BACKUP_ENCRYPTION_PASSPHRASE" \
        --output "$ENC_FILE"
chmod 600 "$ENC_FILE"

DUMP_SIZE=$(du -h "$ENC_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup tayyor: ${ENC_FILE} (${DUMP_SIZE})"
echo "  Tiklash: gpg --batch --yes --decrypt --passphrase \"\$BACKUP_ENCRYPTION_PASSPHRASE\" ${ENC_FILE} | gunzip | psql -U ${DB_USER} ${DB_NAME}"

# Eski nusxalarni tozalash
find "$BACKUP_DIR" -name "hr_platform_*.sql.gz.gpg" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "$BACKUP_DIR" -name "hr_platform_*.sql.gz.gpg" | wc -l)
echo "[$(date -Iseconds)] ${RETENTION_DAYS} kundan eski nusxalar tozalandi. Jami saqlangan: ${REMAINING} ta"
