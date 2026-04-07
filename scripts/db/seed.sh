#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_FILE="$ROOT_DIR/server/db/data/ranking_gastronomico.sqlite"
SEED_FILE="$ROOT_DIR/server/db/seeds/001_seed_data.sql"

if [[ ! -f "$DB_FILE" ]]; then
  bash "$ROOT_DIR/scripts/db/init.sh"
fi

sqlite3 "$DB_FILE" < "$SEED_FILE"
echo "Seed cargado en: $DB_FILE"
