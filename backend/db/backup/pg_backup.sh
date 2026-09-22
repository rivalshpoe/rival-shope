#!/usr/bin/env bash
# Rival — نسخ احتياطي مشفّر لقاعدة البيانات ورفعه إلى DigitalOcean Spaces
# الاستخدام (عبر cron كل 6 ساعات):
#   0 */6 * * * /opt/rival/db/backup/pg_backup.sh >> /var/log/rival-backup.log 2>&1
# يقرأ كل الأسرار من /opt/rival/.env ولا يحتوي أي سر بنفسه.
set -Eeuo pipefail

ENV_FILE="${RIVAL_ENV_FILE:-/opt/rival/.env}"
[ -f "$ENV_FILE" ] || { echo "missing env file: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${BACKUP_DB_HOST:?}" "${BACKUP_DB_PORT:=5432}" "${BACKUP_DB_NAME:?}"
: "${BACKUP_DB_USER:?}" "${BACKUP_DB_PASSWORD:?}" "${BACKUP_GPG_PASSPHRASE:?}"

WORK_DIR="${BACKUP_DIR:-/var/backups/rival}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$WORK_DIR/rival-$STAMP.dump"

mkdir -p "$WORK_DIR"
chmod 700 "$WORK_DIR"

export PGPASSWORD="$BACKUP_DB_PASSWORD"
trap 'unset PGPASSWORD; rm -f "$FILE"' EXIT

echo "[$(date -u +%FT%TZ)] dumping $BACKUP_DB_NAME ..."
pg_dump \
  --host="$BACKUP_DB_HOST" --port="$BACKUP_DB_PORT" \
  --username="$BACKUP_DB_USER" --dbname="$BACKUP_DB_NAME" \
  --format=custom --compress=9 --no-owner --no-privileges \
  --file="$FILE"

echo "[$(date -u +%FT%TZ)] encrypting ..."
gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase "$BACKUP_GPG_PASSPHRASE" \
    --output "$FILE.gpg" "$FILE"
rm -f "$FILE"
chmod 600 "$FILE.gpg"

if [ -n "${SPACES_BUCKET:-}" ]; then
  echo "[$(date -u +%FT%TZ)] uploading to Spaces ..."
  # يتطلب: s3cmd --configure (أو aws-cli مع endpoint مخصص)
  s3cmd put "$FILE.gpg" "s3://$SPACES_BUCKET/db-backups/" --no-progress
fi

echo "[$(date -u +%FT%TZ)] pruning local backups older than $RETENTION_DAYS days ..."
find "$WORK_DIR" -name 'rival-*.dump.gpg' -mtime "+$RETENTION_DAYS" -delete

if [ -n "${SPACES_BUCKET:-}" ]; then
  CUTOFF="$(date -u -d "-$RETENTION_DAYS days" +%Y-%m-%d)"
  s3cmd ls "s3://$SPACES_BUCKET/db-backups/" | while read -r d _ _ key; do
    [ "$d" \< "$CUTOFF" ] && s3cmd del "$key" || true
  done
fi

echo "[$(date -u +%FT%TZ)] done: $(basename "$FILE.gpg")"
