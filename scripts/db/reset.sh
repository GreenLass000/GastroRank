#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_FILE="$ROOT_DIR/server/db/data/ranking_gastronomico.sqlite"

rm -f "$DB_FILE" "$DB_FILE-shm" "$DB_FILE-wal"
bash "$ROOT_DIR/scripts/db/init.sh"
bash "$ROOT_DIR/scripts/db/seed.sh"
echo "Base SQLite recreada correctamente."
