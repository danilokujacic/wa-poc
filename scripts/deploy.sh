#!/usr/bin/env bash
# Runs on the EC2 host, after the repo has already been updated by the caller.
# Builds the app image, runs migrations as a one-off container, then (re)starts the stack.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> Starting infra services (postgres, redis, loki, grafana, maildev)"
docker compose up -d postgres redis loki grafana maildev

echo "==> Building app image"
docker compose build app

echo "==> Running migrations"
docker compose run --rm app node ./node_modules/typeorm/cli.js -d dist/data-source.js migration:run

echo "==> Starting app"
docker compose up -d --remove-orphans app

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Deploy finished"
docker compose ps
