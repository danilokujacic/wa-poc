#!/usr/bin/env bash
# Local Postgres backup: pg_dump via the running `postgres` container,
# custom format (-Fc — compressed, supports parallel/selective restore),
# written to a directory on THIS host (not S3/off-host — see
# docs/PROD_READINESS.md for the wal-g + S3 upgrade path once that's set
# up). A local-only backup protects against the DB itself getting dropped,
# truncated, or corrupted by a bad migration/mistake; it does NOT protect
# against the host's disk failing — that gap stays open until backups also
# leave this machine.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Pick up DB_USER/DB_NAME/DB_PASS from .env if present, without requiring
# the caller to have already exported them.
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/wa_poc_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "==> Dumping database to $OUT_FILE"
docker compose exec -T -e PGPASSWORD="${DB_PASS:-postgres}" postgres \
    pg_dump -U "${DB_USER:-postgres}" -d "${DB_NAME:-wa_poc}" -Fc \
    > "$OUT_FILE"

echo "==> Verifying the dump is readable"
# No filename argument (not "-") — pg_restore reads stdin automatically
# when none is given; passing "-" explicitly is treated as a literal
# filename and fails with "No such file or directory". Confirmed by
# actually hitting that failure and testing the fix directly.
if ! docker compose exec -T postgres pg_restore --list < "$OUT_FILE" > /dev/null; then
    echo "==> Dump failed verification — deleting broken file" >&2
    rm -f "$OUT_FILE"
    exit 1
fi

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "==> Backup complete: $OUT_FILE ($SIZE)"

echo "==> Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'wa_poc_*.dump' -mtime "+${RETENTION_DAYS}" -print -delete
