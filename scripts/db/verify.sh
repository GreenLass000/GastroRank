#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_FILE="$ROOT_DIR/server/db/data/ranking_gastronomico.sqlite"

if [[ ! -f "$DB_FILE" ]]; then
  echo "No existe la base de datos local en $DB_FILE"
  echo "Ejecuta: npm run db:reset"
  exit 1
fi

echo "Base SQLite: $DB_FILE"
echo
echo "Tablas y vistas:"
sqlite3 "$DB_FILE" ".tables"
echo
echo "Conteos principales:"
sqlite3 -header -column "$DB_FILE" "
  SELECT 'users' AS entidad, COUNT(*) AS total FROM users
  UNION ALL
  SELECT 'groups', COUNT(*) FROM \"groups\"
  UNION ALL
  SELECT 'group_members', COUNT(*) FROM group_members
  UNION ALL
  SELECT 'restaurants', COUNT(*) FROM restaurants
  UNION ALL
  SELECT 'categories', COUNT(*) FROM categories
  UNION ALL
  SELECT 'dish_types', COUNT(*) FROM dish_types
  UNION ALL
  SELECT 'dish_entries', COUNT(*) FROM dish_entries
  UNION ALL
  SELECT 'public_share_tokens', COUNT(*) FROM public_share_tokens;
"
