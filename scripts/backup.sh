#!/bin/bash
# backup.sh — Realiza backup do banco de dados PostgreSQL
# Uso: ./scripts/backup.sh [diretório-de-saída]
#
# Exemplo:
#   ./scripts/backup.sh /mnt/backups

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="visit_control_${TIMESTAMP}.sql.gz"

# Carrega variáveis de ambiente do .env se existir
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_URL="${DATABASE_URL:-postgresql://visit_user:visit_pass@localhost:5432/visit_control}"

mkdir -p "$BACKUP_DIR"

echo "📦 Iniciando backup do banco de dados..."
echo "   Destino: $BACKUP_DIR/$FILENAME"

docker compose exec -T db pg_dump \
  -U visit_user \
  -d visit_control \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "$BACKUP_DIR/$FILENAME"

echo "✅ Backup concluído: $BACKUP_DIR/$FILENAME"
echo "   Tamanho: $(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)"
