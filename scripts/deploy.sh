#!/usr/bin/env bash
# Runs on the EC2 host, after the repo has already been updated by the caller.
# Builds the app image, runs migrations as a one-off container, then does a
# zero-downtime cutover to the new app container behind the `proxy` (Caddy)
# service — see docker-compose.yml and infra/caddy/Caddyfile.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# `app` depends on `loki`, which is behind the `production` compose profile
# (skipped by default so plain local dev doesn't need it running) — without
# this, `docker compose config` fails validation entirely: "service app
# depends on undefined service loki". Set here rather than relying on the
# EC2 host's .env to have it, so this script is correct on its own.
export COMPOSE_PROFILES=production

echo "==> Starting infra services (postgres, redis, loki, grafana, maildev, proxy)"
docker compose up -d postgres redis loki grafana maildev proxy

echo "==> Building app image"
docker compose build app

echo "==> Running migrations"
docker compose run --rm app node ./node_modules/typeorm/cli.js -d dist/data-source.js migration:run

# Captured before scaling up — this is how we know exactly which container
# is "old" later, rather than trusting `--scale app=1` to remove the right
# one on scale-down (Compose does not guarantee it kills the newest-started
# container last).
OLD_CONTAINER_ID="$(docker compose ps -q app || true)"

echo "==> Starting a new app container alongside the current one"
# --no-recreate is load-bearing: without it, Compose "reconciles" the
# existing app-1 container to the freshly built image AS PART OF the scale-up
# itself (stopping/recreating it immediately, under a new container ID) —
# discovered by actually running this and watching `docker stop
# $OLD_CONTAINER_ID` fail with "No such container" because Compose had
# already destroyed and replaced it. --no-recreate forces Compose to leave
# any already-existing container alone and only add the one new replica
# needed to reach the requested scale.
docker compose up -d --no-deps --no-recreate --scale app=2 app

NEW_CONTAINER_ID=""
for candidate in $(docker compose ps -q app); do
    if [ "$candidate" != "$OLD_CONTAINER_ID" ]; then
        NEW_CONTAINER_ID="$candidate"
        break
    fi
done

if [ -z "$NEW_CONTAINER_ID" ]; then
    echo "==> Could not identify the new container — aborting" >&2
    exit 1
fi

echo "==> Waiting for the new container ($NEW_CONTAINER_ID) to report healthy"
HEALTHY=""
for _ in $(seq 1 30); do
    STATUS="$(docker inspect --format='{{.State.Health.Status}}' "$NEW_CONTAINER_ID" 2>/dev/null || echo starting)"
    if [ "$STATUS" = "healthy" ]; then
        HEALTHY=1
        break
    fi
    sleep 2
done

if [ -z "$HEALTHY" ]; then
    echo "==> New container never became healthy — rolling back, old container stays up" >&2
    docker stop "$NEW_CONTAINER_ID" >/dev/null
    docker rm "$NEW_CONTAINER_ID" >/dev/null
    exit 1
fi

echo "==> New container is healthy"

if [ -n "$OLD_CONTAINER_ID" ]; then
    echo "==> Stopping the old container ($OLD_CONTAINER_ID)"
    docker stop "$OLD_CONTAINER_ID" >/dev/null
    docker rm "$OLD_CONTAINER_ID" >/dev/null
else
    # First-ever deploy: both containers started brand new, so there's no
    # "old" one to protect — just settle back down to a single replica.
    echo "==> First deploy — scaling back down to a single replica"
    docker compose up -d --no-deps --scale app=1 app
fi

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Deploy finished"
docker compose ps
