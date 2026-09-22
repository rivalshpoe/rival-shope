#!/usr/bin/env bash
# Rival — استعادة نسخة احتياطية مشفّرة
# الاستخدام:  ./pg_restore.sh /var/backups/rival/rival-20260922T120000Z.dump.gpg [target_db]
# جرّبها دائمًا على قاعدة اختبار أولًا (target_db = rival_restore_test).
set -Eeuo pipefail

ARCHIVE="${1:?usage: pg_restore.sh <file.dump.gpg> [target_db]}"
ENV_FILE="${RIVAL_ENV_FILE:-/opt/rival/.env}"
[ -f "$ENV_FILE" ] || { echo "missing env file: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${BACKUP_DB_HOST:?}" "${BACKUP_DB_PORT:=5432}" "${BACKUP_GPG_PASSPHRASE:?}"
: "${RESTORE_DB_USER:?}" "${RESTORE_DB_PASSWORD:?}"   # دور له صلاحية DDL (rival_owner)
TARGET_DB="${2:-${BACKUP_DB_NAME:?}}"

TMP="$(mktemp /tmp/rival-restore-XXXXXX.dump)"
export PGPASSWORD="$RESTORE_DB_PASSWORD"
trap 'unset PGPASSWORD; rm -f "$TMP"' EXIT

echo "decrypting ..."
gpg --batch --yes --decrypt --passphrase "$BACKUP_GPG_PASSPHRASE" --output "$TMP" "$ARCHIVE"

echo "restoring into $TARGET_DB ..."
pg_restore \
  --host="$BACKUP_DB_HOST" --port="$BACKUP_DB_PORT" \
  --username="$RESTORE_DB_USER" --dbname="$TARGET_DB" \
  --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction \
  "$TMP"

echo "re-applying least-privilege grants ..."
echo "  psql -U postgres -d $TARGET_DB -v owner_role=rival_owner -f db/security/02-grant-privileges.sql"
echo "done."
