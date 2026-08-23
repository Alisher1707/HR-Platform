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

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Backup boshlandi -> ${DUMP_FILE}"

if ! docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" > /dev/null 2>&1; then
  echo "[$(date -Iseconds)] XATOLIK: ${DB_CONTAINER} konteyner ishlamayapti yoki tayyor emas" >&2
  exit 1
fi

# --clean --if-exists: qayta tiklashda avval jadvallarni tozalab qo'yadi,
# shuning uchun restore idempotent bo'ladi.
docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" \
  | gzip > "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup tayyor: ${DUMP_FILE} (${DUMP_SIZE})"

# Eski nusxalarni tozalash
find "$BACKUP_DIR" -name "hr_platform_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "$BACKUP_DIR" -name "hr_platform_*.sql.gz" | wc -l)
echo "[$(date -Iseconds)] ${RETENTION_DAYS} kundan eski nusxalar tozalandi. Jami saqlangan: ${REMAINING} ta"
