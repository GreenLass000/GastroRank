#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_DIR="$ROOT_DIR/server/db/data"
DB_FILE="$DB_DIR/ranking_gastronomico.sqlite"
SCHEMA_FILE="$ROOT_DIR/server/db/migrations/001_initial_schema.sql"

mkdir -p "$DB_DIR"
sqlite3 "$DB_FILE" < "$SCHEMA_FILE"
echo "Base SQLite inicializada en: $DB_FILE"
