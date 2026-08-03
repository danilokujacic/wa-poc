#!/usr/bin/env bash
# Restore a local pg_dump backup (see backup-db.sh) into a Postgres database
# on the running `postgres` container.
#
# Defaults to a throwaway database name (wa_poc_restore_test), NOT the live
# one — restoring into the real database overwrites its current data.
# Pass --target-db matching the real DB_NAME plus --drop-existing to do
# that deliberately.
#
# Run this periodically against the throwaway default as a restore drill —
# an untested backup is a hypothesis, not a backup.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

usage() {
    echo "Usage: $0 <dump-file> [--target-db NAME] [--drop-existing]" >&2
    exit 1
}

DUMP_FILE="${1:-}"
[ -z "$DUMP_FILE" ] && usage
[ -f "$DUMP_FILE" ] || { echo "No such file: $DUMP_FILE" >&2; exit 1; }
shift

TARGET_DB="wa_poc_restore_test"
DROP_EXISTING=""
while [ $# -gt 0 ]; do
    case "$1" in
        --target-db)
            TARGET_DB="$2"
            shift 2
            ;;
        --drop-existing)
            DROP_EXISTING=1
            shift
            ;;
        *)
            usage
            ;;
    esac
done

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

if [ "$TARGET_DB" = "${DB_NAME:-wa_poc}" ] && [ -z "$DROP_EXISTING" ]; then
    echo "Refusing to restore into the live database ('$TARGET_DB') without --drop-existing — this would overwrite current data." >&2
    exit 1
fi

echo "==> About to restore $DUMP_FILE into database '$TARGET_DB'"
if [ -n "$DROP_EXISTING" ]; then
    echo "==> --drop-existing set: '$TARGET_DB' will be dropped first if it exists"
fi
read -r -p "Continue? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted."
    exit 1
fi

PG_EXEC=(docker compose exec -T -e "PGPASSWORD=${DB_PASS:-postgres}" postgres)

if [ -n "$DROP_EXISTING" ]; then
    echo "==> Dropping '$TARGET_DB' if it exists"
    "${PG_EXEC[@]}" dropdb -U "${DB_USER:-postgres}" --if-exists "$TARGET_DB"
fi

echo "==> Creating '$TARGET_DB'"
"${PG_EXEC[@]}" createdb -U "${DB_USER:-postgres}" "$TARGET_DB"

echo "==> Restoring"
"${PG_EXEC[@]}" pg_restore -U "${DB_USER:-postgres}" -d "$TARGET_DB" --no-owner < "$DUMP_FILE"

echo "==> Restore complete into '$TARGET_DB'"
