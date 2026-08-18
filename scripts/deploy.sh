#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

export COMPOSE_PROFILES=production
# Defaults to a sibling of the repo checkout, not /opt/wa-poc/releases — that
# would need /opt to be pre-created and owned by whatever user runs this
# script, which a non-root deploy user won't have by default. This default
# needs zero VPS setup beyond what git already requires (write access to
# $REPO_DIR). Override RELEASES_DIR in .env if you want releases to survive
# a full re-clone of the repo.
RELEASES_DIR="${RELEASES_DIR:-$REPO_DIR/releases}"
KEEP_RELEASES=5

SHA="$(git rev-parse --short HEAD)"
RELEASE_DIR="$RELEASES_DIR/$SHA"
export RELEASES_DIR

echo "==> Starting infra services (redis, loki, grafana, maildev)"
docker compose up -d redis loki grafana maildev

echo "==> Building release $SHA"
docker build --target build -t "wa-poc-build:$SHA" .

mkdir -p "$RELEASE_DIR"
BUILD_CONTAINER="wa_poc_extract_$SHA"
docker create --name "$BUILD_CONTAINER" "wa-poc-build:$SHA" >/dev/null
docker cp "$BUILD_CONTAINER:/app/dist" "$RELEASE_DIR/dist"
docker cp "$BUILD_CONTAINER:/app/node_modules" "$RELEASE_DIR/node_modules"
docker cp "$BUILD_CONTAINER:/app/package.json" "$RELEASE_DIR/package.json"
docker rm "$BUILD_CONTAINER" >/dev/null
docker rmi "wa-poc-build:$SHA" >/dev/null 2>&1 || true

echo "==> Running migrations against release $SHA"
docker run --rm --env-file .env -v "$RELEASE_DIR:/app" -w /app node:22-alpine \
    node ./node_modules/typeorm/cli.js -d dist/data-source.js migration:run

wait_healthy() {
    local service="$1"
    local id
    id="$(docker compose ps -q "$service")"
    for _ in $(seq 1 30); do
        local status
        status="$(docker inspect --format='{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)"
        [ "$status" = "healthy" ] && return 0
        sleep 2
    done
    return 1
}

# RELEASE_SHA changing is what makes `up -d` actually recreate the container —
# same image every time (node:22-alpine, never rebuilt), so without this
# env var changing, Compose sees no config diff and does nothing.
export RELEASE_SHA="$SHA"

echo "==> Rolling restart: app_blue -> $SHA"
docker compose up -d --no-deps app_blue
if ! wait_healthy app_blue; then
    echo "==> app_blue never became healthy on $SHA — leaving app_green untouched, not proceeding" >&2
    exit 1
fi

echo "==> Rolling restart: app_green -> $SHA"
docker compose up -d --no-deps app_green
if ! wait_healthy app_green; then
    echo "==> app_green never became healthy on $SHA — app_blue is already on $SHA and healthy, so traffic is still served, but green is stuck" >&2
    exit 1
fi

echo "==> Pruning old releases (keeping $KEEP_RELEASES most recent)"
ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
    rm -rf "$old"
done

echo "==> Deploy finished, live on $SHA"
docker compose ps
