#!/usr/bin/env bash
# =============================================
# Zaxira nusxadan ma'lumotlar bazasini tiklash
# =============================================
# backup-db.sh yaratgan .sql.gz fayllardan birini bazaga qayta yozadi.
# --clean --if-exists bilan olingani uchun avval mavjud jadvallarni
# tozalab, keyin qayta tiklaydi (idempotent).
#
# Ishlatish:  ./restore-db.sh /root/hr-platform-backups/hr_platform_2026-08-23_02-00-00.sql.gz
#
# DIQQAT: bu joriy bazadagi barcha ma'lumotni backup fayldagi holat
# bilan almashtiradi. Ishlatishdan oldin joriy holatning ham zaxirasini
# olib qo'yish tavsiya etiladi.

set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-hr_platform_db}"
DB_NAME="${DB_NAME:-hr_platform}"
DB_USER="${DB_USER:-postgres}"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Ishlatish: $0 <backup-fayli.sql.gz>" >&2
  echo "" >&2
  echo "Mavjud zaxira nusxalar:" >&2
  ls -lh "${BACKUP_DIR:-/root/hr-platform-backups}"/hr_platform_*.sql.gz 2>/dev/null || echo "  (topilmadi)" >&2
  exit 1
fi

read -p "\"$BACKUP_FILE\" dan tiklanadi, joriy baza ustidan yoziladi. Davom etilsinmi? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Bekor qilindi."
  exit 0
fi

echo "[$(date -Iseconds)] Tiklash boshlandi: ${BACKUP_FILE}"
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "[$(date -Iseconds)] Tiklash tugadi."
